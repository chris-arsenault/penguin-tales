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
import { loadLastProjectId, saveLastProjectId } from './uiState.js';
import { loadWorldStore, saveWorldStore } from './worldStore.js';

/**
 * Default project ID - used to identify the default project for reload functionality
 */
export const DEFAULT_PROJECT_ID = 'project_1765083188592';

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
  'uiConfig',
  'eras',
  'pressures',
  'generators',
  'systems',
  'actions',
  'seedEntities',
  'seedRelationships',
  'distributionTargets',
  'illuminatorConfig',
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
    // illuminatorConfig is handled separately (stored in worldStore, not project)
    let project = { ...manifestResult.data };
    let illuminatorConfig = null;
    for (const { file, data } of responses) {
      if (file === 'manifest') continue;
      if (file === 'illuminatorConfig') {
        illuminatorConfig = data;
        continue;
      }
      if (data !== null) {
        project[file] = data;
      }
    }

    // Update timestamps to now
    const now = new Date().toISOString();
    project.createdAt = now;
    project.updatedAt = now;
    return { project, illuminatorConfig };
  } catch (error) {
    console.warn('Failed to load default project:', error);
    return null;
  }
}

/**
 * Create a zip file from project data using JSZip-like structure
 * Returns a Blob containing the zip file
 *
 * @param {Object} project - The project data
 * @param {Object} options - Optional config
 * @param {Object} options.illuminatorConfig - Illuminator settings to include
 */
async function createProjectZip(project, options = {}) {
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
  if (project.uiConfig) {
    zip.file('uiConfig.json', JSON.stringify(project.uiConfig, null, 2));
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
  if (project.distributionTargets !== undefined) {
    zip.file('distributionTargets.json', JSON.stringify(project.distributionTargets, null, 2));
  }

  // Add Illuminator configuration if provided
  const { illuminatorConfig } = options;
  if (illuminatorConfig) {
    zip.file('illuminatorConfig.json', JSON.stringify(illuminatorConfig, null, 2));
  }

  return zip.generateAsync({ type: 'blob' });
}

/**
 * Extract project data from a zip file
 * Returns { project, illuminatorConfig }
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
    'uiConfig',
    'eras',
    'pressures',
    'generators',
    'systems',
    'actions',
    'seedEntities',
    'seedRelationships',
    'distributionTargets',
  ];

  const defaultValues = {
    uiConfig: null,
    distributionTargets: null,
  };

  for (const fileName of fileNames) {
    const file = zip.file(`${fileName}.json`);
    if (file) {
      project[fileName] = JSON.parse(await file.async('string'));
    } else {
      project[fileName] = Object.prototype.hasOwnProperty.call(defaultValues, fileName)
        ? defaultValues[fileName]
        : [];
    }
  }

  // Load Illuminator config if present
  let illuminatorConfig = null;
  const illuminatorFile = zip.file('illuminatorConfig.json');
  if (illuminatorFile) {
    illuminatorConfig = JSON.parse(await illuminatorFile.async('string'));
  }

  return { project, illuminatorConfig };
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
          const defaultData = await fetchDefaultProject();
          if (defaultData?.project) {
            await saveProject(defaultData.project);
            list = await listProjects();

            // Store illuminatorConfig in worldStore if present
            if (defaultData.illuminatorConfig) {
              const worldStoreData = {
                slots: {},
                activeSlotIndex: 0,
              };
              if (defaultData.illuminatorConfig.worldContext) {
                worldStoreData.worldContext = defaultData.illuminatorConfig.worldContext;
              }
              if (defaultData.illuminatorConfig.promptTemplates) {
                worldStoreData.promptTemplates = defaultData.illuminatorConfig.promptTemplates;
              }
              if (defaultData.illuminatorConfig.enrichmentConfig) {
                worldStoreData.enrichmentConfig = defaultData.illuminatorConfig.enrichmentConfig;
              }
              if (defaultData.illuminatorConfig.styleSelection) {
                worldStoreData.styleSelection = defaultData.illuminatorConfig.styleSelection;
              }
              await saveWorldStore(defaultData.project.id, worldStoreData);
            }
          }
        }

        setProjects(list);

        // Auto-load last opened project if possible, otherwise most recent
        if (list.length > 0) {
          const lastProjectId = loadLastProjectId();
          if (lastProjectId) {
            const project = await loadProject(lastProjectId);
            if (project) {
              setCurrentProject(project);
              return;
            }
          }
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

  useEffect(() => {
    if (currentProject?.id) {
      saveLastProjectId(currentProject.id);
    } else {
      saveLastProjectId(null);
    }
  }, [currentProject?.id]);

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
  // Includes Illuminator configuration from worldStore
  const exportProject = useCallback(
    async (project = currentProject) => {
      if (!project) return null;
      try {
        // Load Illuminator config from worldStore
        let illuminatorConfig = null;
        const worldStore = await loadWorldStore(project.id);
        if (worldStore) {
          illuminatorConfig = {
            worldContext: worldStore.worldContext || null,
            promptTemplates: worldStore.promptTemplates || null,
            enrichmentConfig: worldStore.enrichmentConfig || null,
            styleSelection: worldStore.styleSelection || null,
          };
          // Only include if there's actual data
          const hasData = Object.values(illuminatorConfig).some(v => v !== null);
          if (!hasData) {
            illuminatorConfig = null;
          }
        }

        const zipBlob = await createProjectZip(project, { illuminatorConfig });
        return zipBlob;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [currentProject]
  );

  // Import project from zip file (Blob or File)
  // Restores Illuminator configuration to worldStore
  const importProject = useCallback(
    async (input) => {
      try {
        let extractedData;

        // Check if input is a Blob/File (zip)
        if (input instanceof Blob) {
          extractedData = await extractProjectZip(input);
        } else {
          throw new Error('Invalid import format: expected zip file');
        }

        const { project: data, illuminatorConfig } = extractedData;

        // Generate new ID to avoid conflicts
        let project = {
          ...data,
          id: `project_${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await saveProject(project);

        // Restore Illuminator configuration to worldStore
        if (illuminatorConfig) {
          const worldStoreData = {
            slots: {},
            activeSlotIndex: 0,
          };
          if (illuminatorConfig.worldContext) {
            worldStoreData.worldContext = illuminatorConfig.worldContext;
          }
          if (illuminatorConfig.promptTemplates) {
            worldStoreData.promptTemplates = illuminatorConfig.promptTemplates;
          }
          if (illuminatorConfig.enrichmentConfig) {
            worldStoreData.enrichmentConfig = illuminatorConfig.enrichmentConfig;
          }
          if (illuminatorConfig.styleSelection) {
            worldStoreData.styleSelection = illuminatorConfig.styleSelection;
          }
          await saveWorldStore(project.id, worldStoreData);
        }

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

  // Reload current project from default files (merge overwrite)
  // Only works for the default project
  const reloadProjectFromDefaults = useCallback(
    async () => {
      if (!currentProject) return null;
      if (currentProject.id !== DEFAULT_PROJECT_ID) {
        throw new Error('Can only reload the default project from defaults');
      }

      try {
        setLoading(true);

        // Fetch fresh default project files
        const defaultData = await fetchDefaultProject();
        if (!defaultData?.project) {
          throw new Error('Failed to load default project files');
        }

        // Merge: use fresh data but preserve the current project's ID and timestamps
        const reloaded = {
          ...defaultData.project,
          id: currentProject.id,
          createdAt: currentProject.createdAt,
          updatedAt: new Date().toISOString(),
        };

        // Save the merged project to IndexedDB
        await saveProject(reloaded);

        // Reload illuminatorConfig to worldStore if present
        if (defaultData.illuminatorConfig) {
          const worldStoreData = {
            slots: {},
            activeSlotIndex: 0,
          };
          if (defaultData.illuminatorConfig.worldContext) {
            worldStoreData.worldContext = defaultData.illuminatorConfig.worldContext;
          }
          if (defaultData.illuminatorConfig.promptTemplates) {
            worldStoreData.promptTemplates = defaultData.illuminatorConfig.promptTemplates;
          }
          if (defaultData.illuminatorConfig.enrichmentConfig) {
            worldStoreData.enrichmentConfig = defaultData.illuminatorConfig.enrichmentConfig;
          }
          if (defaultData.illuminatorConfig.styleSelection) {
            worldStoreData.styleSelection = defaultData.illuminatorConfig.styleSelection;
          }
          await saveWorldStore(currentProject.id, worldStoreData);
        }

        await refreshList();
        setCurrentProject(reloaded);
        return reloaded;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [currentProject, refreshList]
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
    reloadProjectFromDefaults,
    refreshList,

    // Constants
    DEFAULT_PROJECT_ID,
  };
}
