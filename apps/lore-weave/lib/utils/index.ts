/**
 * Utils Index
 *
 * Re-exports all utility functions for backward compatibility.
 * Individual utilities have been split into concern-specific files.
 */

// Tag utilities
export {
  mergeTags,
  hasTag,
  getTagValue,
  getTrueTagKeys,
  getStringTags,
  tagsToArray,
  arrayToTags
} from './tagUtils';

// Random utilities
export {
  shuffle,
  pickRandom,
  pickMultiple,
  weightedRandom,
  rollProbability
} from './randomUtils';

// ID generation (from core/)
export {
  generateId,
  generateLoreId
} from '../core/idGeneration';

// Entity queries (from graph/)
export {
  findEntities,
  getRelated,
  hasRelationship,
  getResidents,
  getLocation,
  getFactionMembers,
  getFactionLeader,
  getCoreFactionMembers,
  getStrongAllies,
  getWeakRelationships,
  getProminenceValue,
  adjustProminence,
  getConnectionWeight,
  getFactionRelationship
} from '../graph/entityQueries';
export type { RelationshipQueryOptions } from '../graph/entityQueries';

// Entity mutation (from graph/)
export {
  slugifyName,
  upsertNameTag,
  normalizeInitialState,
  addEntity,
  updateEntity
} from '../graph/entityMutation';

// Relationship mutation (from graph/)
export {
  isLineageRelationship,
  getExpectedDistanceRange,
  getRelationshipStrength,
  getRelationshipCategory,
  addRelationship,
  addRelationshipWithDistance,
  archiveRelationship,
  modifyRelationshipStrength,
  validateRelationship,
  canFormRelationship,
  recordRelationshipFormation,
  areRelationshipsCompatible
} from '../graph/relationshipMutation';

// Array/JSON utilities
export {
  parseJsonSafe,
  chunk
} from './arrayUtils';
