/**
 * NameForge Project Schema Types
 *
 * Single-file format for complete project data.
 * Can be stored in IndexedDB, exported as JSON, or bundled as static demos.
 */

/**
 * @typedef {Object} NameForgeProject
 * @property {string} id - Unique project identifier
 * @property {string} name - Human-readable project name
 * @property {string} version - Schema version for migrations
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 * @property {WorldSchema} worldSchema - World configuration
 * @property {Object.<string, CultureData>} cultures - Culture configurations keyed by culture ID
 */

/**
 * @typedef {Object} WorldSchema
 * @property {EntityKindDefinition[]} hardState - Entity types (npc, location, faction, etc.)
 * @property {Object} relationships - Relationship matrix between entity types
 * NOTE: cultures are stored in the top-level 'cultures' object, not here
 */

/**
 * @typedef {Object} EntityKindDefinition
 * @property {string} kind - Entity type (npc, location, etc.)
 * @property {string[]} subtype - Available subtypes
 * @property {string[]} status - Available statuses
 */

/**
 * @typedef {Object} CultureData
 * @property {string} id - Culture identifier
 * @property {string} name - Display name
 * @property {string} [description] - Culture description
 * @property {NamingDomain[]} domains - Culture-level phonotactic domains
 * @property {Object.<string, EntityConfig>} entityConfigs - Per-entity-kind configurations
 */

/**
 * @typedef {Object} EntityConfig
 * @property {Object.<string, LexemeList>} lexemeLists - Lexeme lists keyed by ID
 * @property {Grammar[]} grammars - Grammar rules
 * @property {NamingProfile|null} profile - Naming profile
 * @property {Object} [completionStatus] - UI completion tracking
 */

export const CURRENT_SCHEMA_VERSION = '1.0';

/**
 * Create a new empty project
 * @param {string} name - Project name
 * @returns {NameForgeProject}
 */
export function createEmptyProject(name) {
  const now = new Date().toISOString();
  return {
    id: `project_${Date.now()}`,
    name,
    version: CURRENT_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    worldSchema: {
      hardState: [
        { kind: 'npc', subtype: ['warrior', 'mage', 'merchant', 'noble', 'outlaw'], status: ['alive', 'dead', 'missing', 'ascended'] },
        { kind: 'location', subtype: ['city', 'fortress', 'ruins', 'wilderness', 'anomaly'], status: ['thriving', 'derelict', 'contested', 'hidden'] },
        { kind: 'faction', subtype: ['guild', 'cult', 'military', 'criminal'], status: ['dominant', 'rising', 'declining', 'underground'] },
        { kind: 'rules', subtype: ['law', 'tradition', 'prophecy', 'natural'], status: ['enforced', 'forgotten', 'disputed', 'sacred'] },
        { kind: 'abilities', subtype: ['magic', 'divine', 'technology', 'martial'], status: ['common', 'rare', 'forbidden', 'lost'] }
      ],
      relationships: {}
    },
    cultures: {}
  };
}

/**
 * Validate project structure
 * @param {any} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProject(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Invalid project data'] };
  }

  if (!data.name || typeof data.name !== 'string') {
    errors.push('Missing or invalid project name');
  }

  if (!data.worldSchema || typeof data.worldSchema !== 'object') {
    errors.push('Missing or invalid worldSchema');
  }

  if (!data.cultures || typeof data.cultures !== 'object') {
    errors.push('Missing or invalid cultures');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Migrate project to current schema version
 * @param {any} data
 * @returns {NameForgeProject}
 */
export function migrateProject(data) {
  // Add version if missing
  if (!data.version) {
    data.version = '1.0';
  }

  // Add id if missing
  if (!data.id) {
    data.id = `project_${Date.now()}`;
  }

  // Add timestamps if missing
  const now = new Date().toISOString();
  if (!data.createdAt) data.createdAt = now;
  if (!data.updatedAt) data.updatedAt = now;

  // Ensure cultures object exists
  if (!data.cultures) data.cultures = {};

  // Ensure worldSchema exists
  if (!data.worldSchema) {
    data.worldSchema = createEmptyProject('').worldSchema;
  }

  return data;
}
