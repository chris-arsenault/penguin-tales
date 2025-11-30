/**
 * Templates Index
 *
 * Growth templates for procedural content generation.
 *
 * Templates are defined in data/growthTemplates.json and loaded dynamically.
 * Use loadGrowthTemplates() to load from the JSON file.
 *
 * Users can create/edit templates via UI and save to JSON.
 */

// Re-export declarative loader
export {
  loadGrowthTemplates,
  loadDeclarativeTemplate,
  loadDeclarativeTemplates,
  templateInterpreter,
  type GrowthTemplatesFile
} from './declarativeLoader';
