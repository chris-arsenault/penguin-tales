/**
 * Penguin Domain Schema
 *
 * Defines all penguin-specific world knowledge:
 * - Entity kinds and their subtypes/statuses
 * - Relationship kinds and their mutability
 * - Name generation
 * - Validation rules
 */

import {
  BaseDomainSchema,
  EntityKindDefinition,
  RelationshipKindDefinition,
  NameGenerator
} from '../../types/domainSchema';
import { pickRandom } from '../../utils/helpers';

// ===========================
// NAME GENERATION
// ===========================

const penguinFirstNames = [
  'Frost', 'Ice', 'Snow', 'Crystal', 'Aurora', 'Storm', 'Tide', 'Wave',
  'Glacier', 'Floe', 'Drift', 'Chill', 'Blizzard', 'Shimmer', 'Glint'
];

const penguinLastNames = [
  'beak', 'wing', 'diver', 'slider', 'walker', 'swimmer', 'fisher',
  'hunter', 'watcher', 'keeper', 'breaker', 'caller', 'singer'
];

const titles: Record<string, string[]> = {
  hero: ['Brave', 'Bold', 'Swift', 'Mighty'],
  mayor: ['Elder', 'Wise', 'High', 'Chief'],
  merchant: ['Trader', 'Dealer', 'Master', 'Guild'],
  outlaw: ['Shadow', 'Silent', 'Quick', 'Sly'],
  leader: ['Lord', 'Commander', 'Captain', 'Chief'],
  mystic: ['Seer', 'Oracle', 'Prophet', 'Mystic']
};

const penguinNameGenerator: NameGenerator = {
  generate(type: string = 'default'): string {
    const first = pickRandom(penguinFirstNames);
    const last = pickRandom(penguinLastNames);

    if (type in titles) {
      const title = pickRandom(titles[type]);
      return `${title} ${first}${last}`;
    }

    return `${first}${last}`;
  }
};

// ===========================
// ENTITY KIND DEFINITIONS
// ===========================

const penguinEntityKinds: EntityKindDefinition[] = [
  {
    kind: 'npc',
    description: 'Non-player characters - penguins with agency',
    subtypes: ['merchant', 'mayor', 'hero', 'outlaw', 'orca'],
    statusValues: ['alive', 'dead', 'fictional', 'missing'],
    defaultStatus: 'alive',
    requiredRelationships: [
      {
        kind: 'resident_of',
        when: (entity) => entity.status === 'alive' && entity.subtype !== 'orca',
        description: 'Living non-orca NPCs must have a location'
      }
    ]
  },
  {
    kind: 'location',
    description: 'Physical places in the world',
    subtypes: ['iceberg', 'colony', 'igloo', 'geographic_feature', 'anomaly'],
    statusValues: ['thriving', 'waning', 'abandoned'],
    defaultStatus: 'thriving'
  },
  {
    kind: 'faction',
    description: 'Organized groups with shared goals',
    subtypes: ['political', 'criminal', 'cult', 'company'],
    statusValues: ['active', 'disbanded', 'waning'],
    defaultStatus: 'active'
  },
  {
    kind: 'rules',
    description: 'Social norms, laws, and customs',
    subtypes: ['edict', 'taboo', 'social', 'natural'],
    statusValues: ['active', 'forgotten', 'proposed', 'enacted', 'repealed'],
    defaultStatus: 'enacted'
  },
  {
    kind: 'abilities',
    description: 'Special powers, technologies, or skills',
    subtypes: ['magic', 'faith', 'technology', 'physical', 'combat'],
    statusValues: ['active', 'lost', 'emergent'],
    defaultStatus: 'active'
  },
  {
    kind: 'era',
    description: 'Temporal contexts that modify action probabilities and template weights',
    subtypes: ['expansion', 'conflict', 'innovation', 'invasion', 'reconstruction'],
    statusValues: ['past', 'current', 'future'],
    defaultStatus: 'future'
  },
  {
    kind: 'occurrence',
    description: 'Major happenings with their own momentum (second-order agents)',
    subtypes: ['war', 'magical_disaster', 'cultural_movement', 'economic_boom'],
    statusValues: ['brewing', 'active', 'waning', 'ended', 'legendary'],
    defaultStatus: 'brewing'
  }
];

// ===========================
// RELATIONSHIP KIND DEFINITIONS
// ===========================

const penguinRelationshipKinds: RelationshipKindDefinition[] = [
  // SPATIAL RELATIONSHIPS (Immutable - facts about the world)
  {
    kind: 'contains',
    description: 'Location A contains location B',
    srcKinds: ['location'],
    dstKinds: ['location'],
    mutability: 'immutable',
    protected: true,
    structural: true
  },
  {
    kind: 'contained_by',
    description: 'Inverse of contains',
    srcKinds: ['location'],
    dstKinds: ['location'],
    mutability: 'immutable',
    protected: true,
    structural: true
  },
  {
    kind: 'adjacent_to',
    description: 'Two locations are next to each other',
    srcKinds: ['location'],
    dstKinds: ['location'],
    mutability: 'immutable',
    protected: true,
    structural: true
  },

  // MEMBERSHIP RELATIONSHIPS (Mutable but protected - core structure)
  {
    kind: 'member_of',
    description: 'NPC is a member of a faction',
    srcKinds: ['npc'],
    dstKinds: ['faction'],
    mutability: 'mutable',
    protected: true
  },
  {
    kind: 'leader_of',
    description: 'NPC leads a faction',
    srcKinds: ['npc'],
    dstKinds: ['faction'],
    mutability: 'mutable',
    protected: true
  },
  {
    kind: 'resident_of',
    description: 'NPC lives at a location',
    srcKinds: ['npc'],
    dstKinds: ['location'],
    mutability: 'mutable',
    protected: true,
    structural: true
  },

  // ABILITY RELATIONSHIPS (Immutable - facts about abilities)
  {
    kind: 'practitioner_of',
    description: 'NPC practices an ability',
    srcKinds: ['npc'],
    dstKinds: ['abilities'],
    mutability: 'mutable',
    protected: true
  },
  {
    kind: 'manifests_at',
    description: 'Ability manifests at a location',
    srcKinds: ['abilities'],
    dstKinds: ['location'],
    mutability: 'immutable',
    protected: true
  },
  {
    kind: 'slumbers_beneath',
    description: 'Ability is dormant beneath a location',
    srcKinds: ['abilities'],
    dstKinds: ['location'],
    mutability: 'immutable',
    protected: true
  },
  {
    kind: 'discoverer_of',
    description: 'NPC discovered an ability',
    srcKinds: ['npc'],
    dstKinds: ['abilities'],
    mutability: 'immutable',
    protected: true
  },
  {
    kind: 'originated_in',
    description: 'Ability originated in a location',
    srcKinds: ['abilities'],
    dstKinds: ['location'],
    mutability: 'immutable',
    protected: true
  },

  // SOCIAL RELATIONSHIPS (Mutable - naturally change over time)
  // REMOVED: lover_of (social drama, 219 instances - 20% of relationships)
  // REMOVED: follower_of (social drama, 108 instances - 10% of relationships)
  {
    kind: 'enemy_of',
    description: 'NPCs are enemies',
    srcKinds: ['npc'],
    dstKinds: ['npc'],
    mutability: 'mutable',
    protected: false
  },
  {
    kind: 'rival_of',
    description: 'NPCs are rivals',
    srcKinds: ['npc'],
    dstKinds: ['npc'],
    mutability: 'mutable',
    protected: false
  },
  {
    kind: 'ally_of',
    description: 'NPCs are allies',
    srcKinds: ['npc'],
    dstKinds: ['npc'],
    mutability: 'mutable',
    protected: false
  },

  // POLITICAL RELATIONSHIPS (Mutable)
  {
    kind: 'allied_with',
    description: 'Factions are allied',
    srcKinds: ['faction'],
    dstKinds: ['faction'],
    mutability: 'mutable',
    protected: false
  },
  {
    kind: 'at_war_with',
    description: 'Factions are at war',
    srcKinds: ['faction'],
    dstKinds: ['faction'],
    mutability: 'mutable',
    protected: false
  },
  {
    kind: 'stronghold_of',
    description: 'Faction controls a location',
    srcKinds: ['faction'],
    dstKinds: ['location'],
    mutability: 'mutable',
    protected: false
  },
  {
    kind: 'controls',
    description: 'Faction controls a location',
    srcKinds: ['faction'],
    dstKinds: ['location'],
    mutability: 'mutable',
    protected: false
  },

  // RULE RELATIONSHIPS (Mutable)
  {
    kind: 'weaponized_by',
    description: 'Rule is enforced by a faction',
    srcKinds: ['faction'],
    dstKinds: ['rules'],
    mutability: 'mutable',
    protected: false
  },
  {
    kind: 'kept_secret_by',
    description: 'Rule is kept secret by a faction',
    srcKinds: ['faction'],
    dstKinds: ['rules'],
    mutability: 'mutable',
    protected: false
  },

  // TEMPORAL RELATIONSHIPS (New - for era and occurrence entities)
  {
    kind: 'active_during',
    description: 'Entity was prominent during this era',
    srcKinds: ['npc', 'faction', 'occurrence', 'location', 'abilities'],
    dstKinds: ['era'],
    mutability: 'immutable',
    protected: true
  },
  {
    kind: 'participant_in',
    description: 'Entity participates in an occurrence',
    srcKinds: ['npc', 'faction', 'location'],
    dstKinds: ['occurrence'],
    mutability: 'mutable',
    protected: false
  },
  {
    kind: 'epicenter_of',
    description: 'Occurrence is centered at this location',
    srcKinds: ['occurrence'],
    dstKinds: ['location'],
    mutability: 'immutable',
    protected: true
  },
  {
    kind: 'triggered_by',
    description: 'Occurrence was triggered by this agent',
    srcKinds: ['occurrence'],
    dstKinds: ['npc', 'faction'],
    mutability: 'immutable',
    protected: true
  },
  {
    kind: 'escalated_by',
    description: 'Occurrence was escalated by this agent',
    srcKinds: ['occurrence'],
    dstKinds: ['npc', 'faction'],
    mutability: 'mutable',
    protected: false
  },
  {
    kind: 'ended_by',
    description: 'Occurrence was ended by this agent action',
    srcKinds: ['occurrence'],
    dstKinds: ['npc', 'faction'],
    mutability: 'immutable',
    protected: true
  },
  {
    kind: 'spawned',
    description: 'Occurrence spawned another occurrence',
    srcKinds: ['occurrence'],
    dstKinds: ['occurrence'],
    mutability: 'immutable',
    protected: true
  },
  {
    kind: 'concurrent_with',
    description: 'Occurrences overlapped in time',
    srcKinds: ['occurrence'],
    dstKinds: ['occurrence'],
    mutability: 'immutable',
    protected: false
  }
];

// ===========================
// PENGUIN DOMAIN SCHEMA
// ===========================

export const penguinDomain = new BaseDomainSchema({
  id: 'penguin-colony',
  name: 'Super Penguin Colony',
  version: '1.0.0',
  entityKinds: penguinEntityKinds,
  relationshipKinds: penguinRelationshipKinds,
  nameGenerator: penguinNameGenerator
});

// Export penguin-specific constants for backward compatibility
export const PENGUIN_ENTITY_KINDS = penguinEntityKinds.map(ek => ek.kind);
export const PENGUIN_RELATIONSHIP_KINDS = penguinRelationshipKinds.map(rk => rk.kind);
