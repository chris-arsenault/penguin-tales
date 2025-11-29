/**
 * React hook for managing Cosmographer projects in IndexedDB.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  openDatabase,
  saveProject,
  loadProject,
  deleteProject,
  listProjects,
  createEmptyProject
} from './db.js';

/**
 * Fetch and load the default example project (Penguin Colony World)
 * @returns {Promise<Object|null>} The default project or null if fetch fails
 */
async function fetchDefaultProject() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}default-project.json`);
    if (!response.ok) {
      console.warn('Default project not found');
      return null;
    }
    const project = await response.json();
    // Update timestamps to now
    const now = new Date().toISOString();
    project.createdAt = now;
    project.updatedAt = now;
    return project;
  } catch (error) {
    console.warn('Failed to load default project:', error);
    return null;
  }
}

export function useProjectStorage() {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load project list on mount
  useEffect(() => {
    async function init() {
      try {
        await openDatabase();
        let list = await listProjects();

        // If no projects exist, load the default Penguin Colony World
        if (list.length === 0) {
          const defaultProject = await fetchDefaultProject();
          if (defaultProject) {
            await saveProject(defaultProject);
            list = await listProjects();
          }
        }

        setProjects(list);

        // Auto-load most recent project if exists
        if (list.length > 0) {
          const project = await loadProject(list[0].id);
          setCurrentProject(project);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Refresh project list
  const refreshList = useCallback(async () => {
    try {
      const list = await listProjects();
      setProjects(list);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Create new project
  const createProject = useCallback(async (name) => {
    try {
      const project = createEmptyProject(name);
      await saveProject(project);
      await refreshList();
      setCurrentProject(project);
      return project;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshList]);

  // Open existing project
  const openProject = useCallback(async (id) => {
    try {
      setLoading(true);
      const project = await loadProject(id);
      if (project) {
        setCurrentProject(project);
      } else {
        throw new Error(`Project ${id} not found`);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Save current project
  const save = useCallback(async (updates = {}) => {
    if (!currentProject) return;

    try {
      const updated = { ...currentProject, ...updates };
      await saveProject(updated);
      setCurrentProject(updated);
      await refreshList();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [currentProject, refreshList]);

  // Delete project
  const removeProject = useCallback(async (id) => {
    try {
      await deleteProject(id);
      await refreshList();

      // If deleted current project, clear it
      if (currentProject?.id === id) {
        const list = await listProjects();
        if (list.length > 0) {
          const project = await loadProject(list[0].id);
          setCurrentProject(project);
        } else {
          setCurrentProject(null);
        }
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [currentProject, refreshList]);

  // Duplicate project
  const duplicateProject = useCallback(async (id) => {
    try {
      const source = await loadProject(id);
      if (!source) throw new Error(`Project ${id} not found`);

      const duplicate = {
        ...source,
        id: `project_${Date.now()}`,
        name: `${source.name} (copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await saveProject(duplicate);
      await refreshList();
      return duplicate;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshList]);

  // Export project as JSON
  const exportProject = useCallback((project = currentProject) => {
    if (!project) return null;

    const exportData = {
      $schema: 'https://penguin-tales.dev/schemas/world-seed-v1.json',
      version: project.version,
      name: project.name,
      exportedAt: new Date().toISOString(),

      schema: project.worldSchema,
      cultures: project.cultures,
      semanticPlanes: project.semanticPlanes,

      seed: {
        entities: project.seedEntities,
        relationships: project.seedRelationships
      }
    };

    return JSON.stringify(exportData, null, 2);
  }, [currentProject]);

  // Import project from JSON
  const importProject = useCallback(async (jsonString) => {
    try {
      const data = JSON.parse(jsonString);

      const project = {
        id: `project_${Date.now()}`,
        name: data.name || 'Imported World',
        version: data.version || '1.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),

        worldSchema: data.schema || { entityKinds: [], relationshipKinds: [] },
        cultures: data.cultures || [],
        semanticPlanes: data.semanticPlanes || [],
        seedEntities: data.seed?.entities || [],
        seedRelationships: data.seed?.relationships || []
      };

      await saveProject(project);
      await refreshList();
      setCurrentProject(project);
      return project;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [refreshList]);

  return {
    // State
    projects,
    currentProject,
    loading,
    error,

    // Actions
    createProject,
    openProject,
    save,
    removeProject,
    duplicateProject,
    exportProject,
    importProject,
    refreshList
  };
}
