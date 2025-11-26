/**
 * Export/Import utilities for NameForge projects
 *
 * Handles file download/upload of project JSON files.
 */

import { validateProject, migrateProject, CURRENT_SCHEMA_VERSION } from './types.js';

/**
 * Export a project as a downloadable JSON file
 * @param {import('./types').NameForgeProject} project
 * @param {string} [filename] - Optional custom filename
 */
export function exportProject(project, filename) {
  const exportData = {
    ...project,
    exportedAt: new Date().toISOString(),
    exportVersion: CURRENT_SCHEMA_VERSION
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const safeName = (filename || project.name || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.nameforge.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import a project from a JSON file
 * @param {File} file
 * @returns {Promise<import('./types').NameForgeProject>}
 */
export async function importProject(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);

        // Validate structure
        const { valid, errors } = validateProject(data);
        if (!valid) {
          reject(new Error(`Invalid project file: ${errors.join(', ')}`));
          return;
        }

        // Migrate to current version
        const migrated = migrateProject(data);

        // Generate new ID to avoid conflicts
        migrated.id = `project_${Date.now()}`;
        migrated.updatedAt = new Date().toISOString();

        resolve(migrated);
      } catch (err) {
        reject(new Error(`Failed to parse project file: ${err.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Create a file input and trigger import dialog
 * @returns {Promise<import('./types').NameForgeProject>}
 */
export function promptImportProject() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.nameforge.json';

    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      try {
        const project = await importProject(file);
        resolve(project);
      } catch (err) {
        reject(err);
      }
    };

    input.click();
  });
}

/**
 * Convert legacy API format to single-file project format
 * @param {string} name - Project name
 * @param {Object} worldSchema - World schema from API
 * @param {Object} cultures - Cultures data from API
 * @returns {import('./types').NameForgeProject}
 */
export function convertFromApiFormat(name, worldSchema, cultures) {
  const now = new Date().toISOString();

  return migrateProject({
    id: `project_${Date.now()}`,
    name,
    version: CURRENT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    worldSchema,
    cultures
  });
}

/**
 * Convert project to legacy API format (for backward compatibility)
 * @param {import('./types').NameForgeProject} project
 * @returns {{ worldSchema: Object, cultures: Object }}
 */
export function convertToApiFormat(project) {
  return {
    worldSchema: project.worldSchema,
    cultures: project.cultures
  };
}
