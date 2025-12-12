/**
 * React hook for managing Canonry projects in IndexedDB.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  openDatabase,
  saveProject,
  loadProject,
  deleteProject,
  listProjects,
  createEmptyProject,
} from './db.js';

/**
 * Project file names for individual domain files
 */
const PROJECT_FILES = [
  'manifest',
  'entityKinds',
  'relationshipKinds',
  'cultures',
  'tagRegistry',
  'axisDefinitions',
  'eras',
  'pressures',
  'generators',
  'systems',
  'actions',
  'seedEntities',
  'seedRelationships',
  'distributionTargets',
];

/**
 * Fetch and load the default seed project from individual files
 */
async function fetchDefaultProject() {
  try {
    const baseUrl = `${import.meta.env.BASE_URL}default-project/`;

    // Load all files in parallel
    const responses = await Promise.all(
      PROJECT_FILES.map(async (file) => {
        const response = await fetch(`${baseUrl}${file}.json`);
        if (!response.ok) {
          console.warn(`Default project file ${file}.json not found`);
          return { file, data: null };
        }
        const data = await response.json();
        return { file, data };
      })
    );

    // Check if manifest was loaded
    const manifestResult = responses.find((r) => r.file === 'manifest');
    if (!manifestResult?.data) {
      console.warn('Default project manifest not found');
      return null;
    }

    // Assemble the project from individual files
    const project = { ...manifestResult.data };
    for (const { file, data } of responses) {
      if (file !== 'manifest' && data !== null) {
        project[file] = data;
      }
    }

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

/**
 * Create a zip file from project data using JSZip-like structure
 * Returns a Blob containing the zip file
 */
async function createProjectZip(project) {
  // We'll use the browser's native compression API or a simple implementation
  // For now, use a custom zip implementation that works in browsers
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  // Add manifest (project metadata without domain data)
  const manifest = {
    id: project.id,
    name: project.name,
    version: project.version || '1.0',
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Add individual domain files
  if (project.entityKinds) {
    zip.file('entityKinds.json', JSON.stringify(project.entityKinds, null, 2));
  }
  if (project.relationshipKinds) {
    zip.file('relationshipKinds.json', JSON.stringify(project.relationshipKinds, null, 2));
  }
  if (project.cultures) {
    zip.file('cultures.json', JSON.stringify(project.cultures, null, 2));
  }
  if (project.tagRegistry) {
    zip.file('tagRegistry.json', JSON.stringify(project.tagRegistry, null, 2));
  }
  if (project.axisDefinitions) {
    zip.file('axisDefinitions.json', JSON.stringify(project.axisDefinitions, null, 2));
  }
  if (project.eras) {
    zip.file('eras.json', JSON.stringify(project.eras, null, 2));
  }
  if (project.pressures) {
    zip.file('pressures.json', JSON.stringify(project.pressures, null, 2));
  }
  if (project.generators) {
    zip.file('generators.json', JSON.stringify(project.generators, null, 2));
  }
  if (project.systems) {
    zip.file('systems.json', JSON.stringify(project.systems, null, 2));
  }
  if (project.actions) {
    zip.file('actions.json', JSON.stringify(project.actions, null, 2));
  }
  if (project.seedEntities) {
    zip.file('seedEntities.json', JSON.stringify(project.seedEntities, null, 2));
  }
  if (project.seedRelationships) {
    zip.file('seedRelationships.json', JSON.stringify(project.seedRelationships, null, 2));
  }
  if (project.distributionTargets) {
    zip.file('distributionTargets.json', JSON.stringify(project.distributionTargets, null, 2));
  }

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Extract project data from a zip file
 * Returns the assembled project object
 */
async function extractProjectZip(zipBlob) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(zipBlob);

  // Load manifest first
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Invalid project zip: missing manifest.json');
  }
  const manifest = JSON.parse(await manifestFile.async('string'));

  // Load all other files
  const project = { ...manifest };

  const fileNames = [
    'entityKinds',
    'relationshipKinds',
    'cultures',
    'tagRegistry',
    'axisDefinitions',
    'eras',
    'pressures',
    'generators',
    'systems',
    'actions',
    'seedEntities',
    'seedRelationships',
    'distributionTargets',
  ];

  for (const fileName of fileNames) {
    const file = zip.file(`${fileName}.json`);
    if (file) {
      project[fileName] = JSON.parse(await file.async('string'));
    } else {
      project[fileName] = [];
    }
  }

  return project;
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

        // If no projects exist, load the default seed project
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
  const createProject = useCallback(
    async (name) => {
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
    },
    [refreshList]
  );

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

  // Save current project (auto-save on changes)
  // Uses ref to track pending updates and avoid stale closure issues
  const pendingUpdatesRef = useRef({});

  const save = useCallback(
    async (updates = {}) => {
      if (!currentProject) return;

      try {
        // Merge with any pending updates to handle rapid sequential saves
        pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };
        const allUpdates = pendingUpdatesRef.current;

        const updated = { ...currentProject, ...allUpdates };
        await saveProject(updated);
        setCurrentProject(updated);

        // Clear pending updates after successful save
        pendingUpdatesRef.current = {};
        await refreshList();
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [currentProject, refreshList]
  );

  // Delete project
  const removeProject = useCallback(
    async (id) => {
      try {
        await deleteProject(id);
        await refreshList();

        // If deleted current project, switch to another
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
    },
    [currentProject, refreshList]
  );

  // Duplicate project
  const duplicateProject = useCallback(
    async (id) => {
      try {
        const source = await loadProject(id);
        if (!source) throw new Error(`Project ${id} not found`);

        const duplicate = {
          ...source,
          id: `project_${Date.now()}`,
          name: `${source.name} (copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveProject(duplicate);
        await refreshList();
        return duplicate;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [refreshList]
  );

  // Export project as a zip file (Blob)
  const exportProject = useCallback(
    async (project = currentProject) => {
      if (!project) return null;
      try {
        const zipBlob = await createProjectZip(project);
        return zipBlob;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [currentProject]
  );

  // Import project from zip file (Blob or File) or legacy JSON string
  const importProject = useCallback(
    async (input) => {
      try {
        let data;

        // Check if input is a Blob/File (zip) or string (legacy JSON)
        if (input instanceof Blob) {
          data = await extractProjectZip(input);
        } else if (typeof input === 'string') {
          // Legacy JSON import support
          data = JSON.parse(input);
        } else {
          throw new Error('Invalid import format: expected zip file or JSON string');
        }

        // Generate new ID to avoid conflicts
        const project = {
          ...data,
          id: `project_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveProject(project);
        await refreshList();
        setCurrentProject(project);
        return project;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [refreshList]
  );

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
    refreshList,
  };
}
