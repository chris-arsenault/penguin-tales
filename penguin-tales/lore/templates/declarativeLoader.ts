/**
 * Declarative Template Loader
 *
 * Loads growth templates from a JSON file (growthTemplates.json).
 * Templates are defined declaratively and can be created/edited via UI.
 *
 * Usage:
 *   import growthTemplatesJson from './data/growthTemplates.json';
 *   const templates = loadGrowthTemplates(growthTemplatesJson);
 */

import {
  TemplateInterpreter,
  createTemplateFromDeclarative,
  DeclarativeTemplate,
  GrowthTemplate
} from '@lore-weave/core';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Shape of the growthTemplates.json file
 */
export interface GrowthTemplatesFile {
  $schema?: string;
  templates: DeclarativeTemplate[];
}

// =============================================================================
// TEMPLATE INTERPRETER
// =============================================================================

/**
 * Shared template interpreter instance
 */
export const templateInterpreter = new TemplateInterpreter();

// =============================================================================
// LOADING FUNCTIONS
// =============================================================================

/**
 * Load all templates from a growthTemplates.json file
 */
export function loadGrowthTemplates(json: GrowthTemplatesFile): GrowthTemplate[] {
  return json.templates.map(t => createTemplateFromDeclarative(t, templateInterpreter));
}

/**
 * Load a single declarative template from JSON
 */
export function loadDeclarativeTemplate(json: DeclarativeTemplate): GrowthTemplate {
  return createTemplateFromDeclarative(json, templateInterpreter);
}

/**
 * Load multiple declarative templates from JSON array
 */
export function loadDeclarativeTemplates(templates: DeclarativeTemplate[]): GrowthTemplate[] {
  return templates.map(t => createTemplateFromDeclarative(t, templateInterpreter));
}
