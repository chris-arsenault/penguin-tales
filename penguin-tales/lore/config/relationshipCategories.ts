/**
 * Penguin Relationship Categories
 *
 * Domain-specific categorization of relationships for system processing.
 * Categories determine how relationships are treated by decay, reinforcement, and culling systems.
 */

export interface RelationshipCategory {
  category: string;
  kinds: string[];
  mutable: boolean;
  decayRate?: 'none' | 'slow' | 'medium' | 'fast';
  reinforcementConditions?: string[];
  cullable: boolean;
  applyDecay: boolean;
  applyReinforcement: boolean;
  applyCulling: boolean;
  description: string;
}

/**
 * Relationship categories for the penguin domain
 */
export const relationshipCategories: Record<string, RelationshipCategory> = {
  // IMMUTABLE FACTS - Never change, never decay, never cull
  immutable_fact: {
    category: 'immutable_fact',
    kinds: [
      // Geographic facts
      'adjacent_to',
      'contains',
      'contained_by',

      // Historical facts
      'originated_in',
      'founded_by',
      'discovered_by',
      'discoverer_of',

      // Supernatural constants
      'slumbers_beneath',
      'manifests_at',

      // Temporal immutables
      'active_during',
      'epicenter_of',
      'triggered_by',
      'ended_by',
      'spawned',
      'concurrent_with'
    ],
    mutable: false,
    decayRate: 'none',
    cullable: false,
    applyDecay: false,
    applyReinforcement: false,
    applyCulling: false,
    description: 'Permanent facts that never change (geography, history, discoveries)'
  },

  // STRUCTURAL - Core relationships that define entity roles
  structural: {
    category: 'structural',
    kinds: [
      'member_of',
      'leader_of',
      'resident_of',
      'practitioner_of',
      'participant_in'
    ],
    mutable: true,
    decayRate: 'slow',
    reinforcementConditions: ['proximity', 'active_participation'],
    cullable: false,  // Don't cull structural relationships
    applyDecay: true,
    applyReinforcement: true,
    applyCulling: false,
    description: 'Core relationships defining roles and memberships'
  },

  // POLITICAL - Power dynamics, alliances, conflicts
  political: {
    category: 'political',
    kinds: [
      'controls',
      'contests',
      'allied_with',
      'at_war_with',
      'stronghold_of',
      'governs'
    ],
    mutable: true,
    decayRate: 'slow',
    reinforcementConditions: ['shared_enemies', 'proximity', 'common_goals'],
    cullable: true,
    applyDecay: true,
    applyReinforcement: true,
    applyCulling: true,
    description: 'Political relationships - alliances, conflicts, control'
  },

  // ECONOMIC - Trade, resources, monopolies
  economic: {
    category: 'economic',
    kinds: [
      'monopolizes',
      'trades_with',
      'blockades',
      'extracts_from'
    ],
    mutable: true,
    decayRate: 'medium',
    reinforcementConditions: ['active_trade', 'resource_availability', 'proximity'],
    cullable: true,
    applyDecay: true,
    applyReinforcement: true,
    applyCulling: true,
    description: 'Economic relationships - trade routes, resource control'
  },

  // MAGICAL - Supernatural effects and corruption
  magical: {
    category: 'magical',
    kinds: [
      'corrupted_by',
      'blessed_by',
      'sealed_in',
      'powered_by'
    ],
    mutable: true,
    decayRate: 'slow',  // Magical effects persist
    reinforcementConditions: ['magical_instability', 'practitioner_presence'],
    cullable: false,  // Don't cull magical effects - they're narratively important
    applyDecay: true,
    applyReinforcement: true,
    applyCulling: false,
    description: 'Magical relationships - corruption, blessings, manifestations'
  },

  // SOCIAL - Personal relationships between NPCs
  social: {
    category: 'social',
    kinds: [
      'enemy_of',
      'rival_of',
      'ally_of'
      // REMOVED: lover_of, follower_of (social drama)
    ],
    mutable: true,
    decayRate: 'medium',
    reinforcementConditions: ['proximity', 'shared_faction', 'common_enemies'],
    cullable: true,
    applyDecay: true,
    applyReinforcement: true,
    applyCulling: true,
    description: 'Personal relationships between NPCs'
  },

  // ATTRIBUTION - Who caused what
  attribution: {
    category: 'attribution',
    kinds: [
      'catalyzed_by',  // Generic attribution (stored in relationship.catalyzedBy field)
      'triggered_by',
      'escalated_by',
      'ended_by'
    ],
    mutable: false,
    decayRate: 'none',
    cullable: false,
    applyDecay: false,
    applyReinforcement: false,
    applyCulling: false,
    description: 'Attribution relationships tracking who caused events'
  },

  // TEMPORAL - Time-based relationships
  temporal: {
    category: 'temporal',
    kinds: [
      'active_during',
      'participant_in',
      'concurrent_with'
    ],
    mutable: false,
    decayRate: 'none',
    cullable: false,
    applyDecay: false,
    applyReinforcement: false,
    applyCulling: false,
    description: 'Temporal relationships linking entities to eras and occurrences'
  },

  // IDEOLOGICAL - Rules and beliefs
  ideological: {
    category: 'ideological',
    kinds: [
      'applies_in',       // Edicts/laws apply in locations
      'champion_of',      // NPCs champion ideologies
      'believer_of',      // NPCs believe in ideologies
      'celebrated_by',    // Festivals celebrated by factions
      'weaponized_by',
      'kept_secret_by',
      'wields'            // Factions wield abilities
    ],
    mutable: true,
    decayRate: 'slow',
    reinforcementConditions: ['cultural_alignment', 'faction_stability'],
    cullable: false,    // Don't cull - these are structural to rules/abilities
    applyDecay: true,
    applyReinforcement: true,
    applyCulling: false,
    description: 'Ideological relationships - how factions use rules and beliefs'
  }
};

/**
 * Get category for a relationship kind
 */
export function getCategoryForRelationship(kind: string): RelationshipCategory | null {
  for (const category of Object.values(relationshipCategories)) {
    if (category.kinds.includes(kind)) {
      return category;
    }
  }
  return null;
}

/**
 * Check if relationship should decay
 */
export function shouldDecay(kind: string): boolean {
  const category = getCategoryForRelationship(kind);
  return category?.applyDecay ?? false;
}

/**
 * Check if relationship should be reinforced
 */
export function shouldReinforce(kind: string): boolean {
  const category = getCategoryForRelationship(kind);
  return category?.applyReinforcement ?? false;
}

/**
 * Check if relationship can be culled
 */
export function canCull(kind: string): boolean {
  const category = getCategoryForRelationship(kind);
  return category?.cullable ?? false;
}

/**
 * Get decay rate for a relationship kind
 */
export function getDecayRate(kind: string): 'none' | 'slow' | 'medium' | 'fast' {
  const category = getCategoryForRelationship(kind);
  return category?.decayRate ?? 'medium';
}

/**
 * Get all immutable relationship kinds
 */
export function getImmutableRelationshipKinds(): string[] {
  return Object.values(relationshipCategories)
    .filter(cat => !cat.mutable)
    .flatMap(cat => cat.kinds);
}

/**
 * Get all protected relationship kinds (structural + immutable)
 */
export function getProtectedRelationshipKinds(): string[] {
  return Object.values(relationshipCategories)
    .filter(cat => !cat.mutable || !cat.cullable)
    .flatMap(cat => cat.kinds);
}

/**
 * Get relationship kinds by category
 */
export function getRelationshipKindsByCategory(categoryName: string): string[] {
  const category = relationshipCategories[categoryName];
  return category?.kinds || [];
}

/**
 * Get all categories
 */
export function getAllCategories(): RelationshipCategory[] {
  return Object.values(relationshipCategories);
}
