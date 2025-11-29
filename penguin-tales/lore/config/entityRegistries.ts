/**
 * Penguin Domain - Entity Operator Registries
 *
 * Declares all operators (creators, modifiers, lineage) for each entity kind.
 * This provides a formalized registry of what creates and modifies each entity type,
 * enabling framework validation and automatic lineage enforcement.
 *
 * Note: This is domain-specific configuration. The EntityOperatorRegistry interface
 * is defined in the framework, but the actual registries with template IDs and
 * lineage logic are penguin-domain specific.
 */

import type { EntityOperatorRegistry } from '@lore-weave/core';
import type { HardState } from '@lore-weave/core';
import type { TemplateGraphView } from '@lore-weave/core';

/**
 * NPC Entity Registry
 *
 * Creators:
 * - hero_emergence: Creates heroes that drive major events (primary)
 * - succession: Creates leaders to fill power vacuums (primary)
 * - orca_raider_arrival: Creates external threat NPCs (primary)
 *
 * Lineage: NPCs link to other NPCs via family_of or inspired_by
 */
export const npcRegistry: EntityOperatorRegistry = {
  kind: 'npc',

  creators: [
    { templateId: 'hero_emergence', primary: true, targetCount: 1 },
    { templateId: 'succession', primary: true, targetCount: 1 },
    { templateId: 'orca_raider_arrival', primary: true, targetCount: 1 }
  ],

  modifiers: [
    // TODO: Add systems that modify NPCs
  ],

  lineage: {
    relationshipKind: 'inspired_by',  // Heroes inspired by previous heroes
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      // Find existing NPCs to link to
      const existingNPCs = graphView.findEntities({ kind: 'npc', status: 'alive' })
        .filter(npc => npc.id !== newEntity.id);

      if (existingNPCs.length === 0) return undefined;

      // Prefer same subtype
      const sameSubtype = existingNPCs.filter(npc => npc.subtype === newEntity.subtype);
      if (sameSubtype.length > 0) {
        return sameSubtype[Math.floor(Math.random() * sameSubtype.length)];
      }

      // Otherwise any NPC
      return existingNPCs[Math.floor(Math.random() * existingNPCs.length)];
    },
    distanceRange: { min: 0.3, max: 0.6 }  // Moderate distance between heroes
  },

  expectedDistribution: {
    targetCount: 30,
    prominenceDistribution: {
      'marginal': 0.5,
      'recognized': 0.3,
      'renowned': 0.15,
      'mythic': 0.05
    }
  }
};

/**
 * Hero Subtype Registry (NPC:Hero)
 *
 * Heroes are special NPCs that emerge during times of crisis.
 * They reduce conflict and drive narrative events.
 */
export const heroRegistry: EntityOperatorRegistry = {
  kind: 'npc',
  subtype: 'hero',

  creators: [
    { templateId: 'hero_emergence', primary: true, targetCount: 1 }
  ],

  modifiers: [],

  lineage: {
    relationshipKind: 'inspired_by',
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      // Heroes are inspired by previous heroes (or other NPCs if no heroes exist)
      const existingHeroes = graphView.findEntities({ kind: 'npc', subtype: 'hero', status: 'alive' })
        .filter(hero => hero.id !== newEntity.id);

      if (existingHeroes.length > 0) {
        return existingHeroes[Math.floor(Math.random() * existingHeroes.length)];
      }

      // Fall back to any NPC
      const existingNPCs = graphView.findEntities({ kind: 'npc', status: 'alive' })
        .filter(npc => npc.id !== newEntity.id);

      if (existingNPCs.length > 0) {
        return existingNPCs[Math.floor(Math.random() * existingNPCs.length)];
      }

      return undefined;
    },
    distanceRange: { min: 0.4, max: 0.7 }  // Heroes have moderate-high distance (diverse heroic styles)
  },

  expectedDistribution: {
    targetCount: 5,  // Want 5 heroes total
    prominenceDistribution: {
      'recognized': 0.4,
      'renowned': 0.4,
      'mythic': 0.2
    }
  }
};

/**
 * Mayor Subtype Registry (NPC:Mayor)
 *
 * Mayors are colony leaders created through succession.
 * One mayor per colony.
 */
export const mayorRegistry: EntityOperatorRegistry = {
  kind: 'npc',
  subtype: 'mayor',

  creators: [
    { templateId: 'succession', primary: true, targetCount: 1 }
  ],

  modifiers: [],

  lineage: {
    relationshipKind: 'inspired_by',
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      // Mayors are inspired by previous mayors of same colony (or any mayor)
      const existingMayors = graphView.findEntities({ kind: 'npc', subtype: 'mayor' })
        .filter(mayor => mayor.id !== newEntity.id);

      if (existingMayors.length > 0) {
        return existingMayors[Math.floor(Math.random() * existingMayors.length)];
      }

      return undefined;
    },
    distanceRange: { min: 0.2, max: 0.4 }  // Mayors have low distance (similar political styles)
  },

  expectedDistribution: {
    targetCount: 10,  // Roughly 1 per colony, expect ~10 colonies
    prominenceDistribution: {
      'marginal': 0.7,
      'recognized': 0.2,
      'renowned': 0.1
    }
  }
};

/**
 * Orca Subtype Registry (NPC:Orca)
 *
 * Orcas are external threats that arrive during invasion era.
 * Limited number to prevent overwhelming the world.
 */
export const orcaRegistry: EntityOperatorRegistry = {
  kind: 'npc',
  subtype: 'orca',

  creators: [
    { templateId: 'orca_raider_arrival', primary: true, targetCount: 1 }
  ],

  modifiers: [],

  lineage: {
    relationshipKind: 'inspired_by',
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      // Orcas inspired by other orcas (pack coordination)
      const existingOrcas = graphView.findEntities({ kind: 'npc', subtype: 'orca' })
        .filter(orca => orca.id !== newEntity.id);

      if (existingOrcas.length > 0) {
        return existingOrcas[Math.floor(Math.random() * existingOrcas.length)];
      }

      return undefined;
    },
    distanceRange: { min: 0.1, max: 0.3 }  // Orcas have very low distance (pack coordination)
  },

  expectedDistribution: {
    targetCount: 5,  // Want max 5 orcas (they're supposed to be rare threats)
    prominenceDistribution: {
      'marginal': 0.6,
      'recognized': 0.3,
      'renowned': 0.1
    }
  }
};

/**
 * Faction Entity Registry
 *
 * Creators:
 * - faction_splinter: Factions split from parent factions (primary)
 * - guild_establishment: Creates merchant/trade guilds (primary)
 * - cult_formation: Creates mystical/religious factions (primary)
 * - territorial_expansion: Expands faction territory (not a creator)
 * - trade_route_establishment: Establishes trade routes (not a creator)
 *
 * Lineage: Factions link via split_from or related_to
 */
export const factionRegistry: EntityOperatorRegistry = {
  kind: 'faction',

  creators: [
    { templateId: 'faction_splinter', primary: true, targetCount: 1 },
    { templateId: 'guild_establishment', primary: true, targetCount: 1 },
    { templateId: 'cult_formation', primary: true, targetCount: 1 }
  ],

  modifiers: [
    // TODO: Add systems that modify factions
  ],

  lineage: {
    relationshipKind: 'split_from',  // Or 'related_to' for non-splinters
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      const existingFactions = graphView.findEntities({ kind: 'faction' })
        .filter(f => f.id !== newEntity.id && f.status !== 'disbanded');

      if (existingFactions.length === 0) return undefined;

      // Prefer same subtype
      const sameSubtype = existingFactions.filter(f => f.subtype === newEntity.subtype);
      if (sameSubtype.length > 0) {
        return sameSubtype[Math.floor(Math.random() * sameSubtype.length)];
      }

      // Otherwise any faction
      return existingFactions[Math.floor(Math.random() * existingFactions.length)];
    },
    distanceRange: { min: 0.2, max: 0.5 }  // Factions can be quite similar or quite different
  },

  expectedDistribution: {
    targetCount: 30,
    prominenceDistribution: {
      'marginal': 0.4,
      'recognized': 0.4,
      'renowned': 0.15,
      'mythic': 0.05
    }
  }
};

/**
 * Cult Subtype Registry (Faction:Cult)
 *
 * Mystical/religious factions that form around anomalies and magic.
 * Should be rare and mysterious.
 */
export const cultRegistry: EntityOperatorRegistry = {
  kind: 'faction',
  subtype: 'cult',

  creators: [
    { templateId: 'cult_formation', primary: true, targetCount: 1 }
  ],

  modifiers: [],

  lineage: {
    relationshipKind: 'split_from',
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      // Cults inspired by other cults (or any faction if no cults exist)
      const existingCults = graphView.findEntities({ kind: 'faction', subtype: 'cult' })
        .filter(cult => cult.id !== newEntity.id && cult.status !== 'disbanded');

      if (existingCults.length > 0) {
        return existingCults[Math.floor(Math.random() * existingCults.length)];
      }

      // Fall back to any faction
      const existingFactions = graphView.findEntities({ kind: 'faction' })
        .filter(f => f.id !== newEntity.id && f.status !== 'disbanded');

      if (existingFactions.length > 0) {
        return existingFactions[Math.floor(Math.random() * existingFactions.length)];
      }

      return undefined;
    },
    distanceRange: { min: 0.5, max: 0.8 }  // Cults have high distance (very different belief systems)
  },

  expectedDistribution: {
    targetCount: 3,  // Want max 3 cults (they should be rare and mysterious)
    prominenceDistribution: {
      'marginal': 0.5,
      'recognized': 0.3,
      'renowned': 0.2
    }
  }
};

/**
 * Company Subtype Registry (Faction:Company)
 *
 * Merchant guilds and trading companies.
 */
export const companyRegistry: EntityOperatorRegistry = {
  kind: 'faction',
  subtype: 'company',

  creators: [
    { templateId: 'guild_establishment', primary: true, targetCount: 1 }
  ],

  modifiers: [],

  lineage: {
    relationshipKind: 'split_from',
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      // Companies compete with other companies
      const existingCompanies = graphView.findEntities({ kind: 'faction', subtype: 'company' })
        .filter(co => co.id !== newEntity.id && co.status !== 'disbanded');

      if (existingCompanies.length > 0) {
        return existingCompanies[Math.floor(Math.random() * existingCompanies.length)];
      }

      return undefined;
    },
    distanceRange: { min: 0.2, max: 0.4 }  // Companies have low distance (similar business models)
  },

  expectedDistribution: {
    targetCount: 8,  // Want several competing merchant guilds
    prominenceDistribution: {
      'marginal': 0.4,
      'recognized': 0.4,
      'renowned': 0.2
    }
  }
};

/**
 * Criminal Subtype Registry (Faction:Criminal)
 *
 * Underworld syndicates and smuggling rings.
 */
export const criminalRegistry: EntityOperatorRegistry = {
  kind: 'faction',
  subtype: 'criminal',

  creators: [
    { templateId: 'faction_splinter', primary: true, targetCount: 1 }
  ],

  modifiers: [],

  lineage: {
    relationshipKind: 'split_from',
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      // Criminal factions split from other criminal factions
      const existingCriminals = graphView.findEntities({ kind: 'faction', subtype: 'criminal' })
        .filter(crim => crim.id !== newEntity.id && crim.status !== 'disbanded');

      if (existingCriminals.length > 0) {
        return existingCriminals[Math.floor(Math.random() * existingCriminals.length)];
      }

      return undefined;
    },
    distanceRange: { min: 0.3, max: 0.6 }  // Criminal factions have moderate distance
  },

  expectedDistribution: {
    targetCount: 5,  // Want a few criminal syndicates
    prominenceDistribution: {
      'marginal': 0.5,
      'recognized': 0.3,
      'renowned': 0.2
    }
  }
};

/**
 * Political Subtype Registry (Faction:Political)
 *
 * Political parties and reform movements.
 */
export const politicalRegistry: EntityOperatorRegistry = {
  kind: 'faction',
  subtype: 'political',

  creators: [
    { templateId: 'faction_splinter', primary: true, targetCount: 1 }
  ],

  modifiers: [],

  lineage: {
    relationshipKind: 'split_from',
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      // Political factions split from other political factions
      const existingPolitical = graphView.findEntities({ kind: 'faction', subtype: 'political' })
        .filter(pol => pol.id !== newEntity.id && pol.status !== 'disbanded');

      if (existingPolitical.length > 0) {
        return existingPolitical[Math.floor(Math.random() * existingPolitical.length)];
      }

      return undefined;
    },
    distanceRange: { min: 0.3, max: 0.6 }  // Political factions have moderate distance
  },

  expectedDistribution: {
    targetCount: 7,  // Want several political factions
    prominenceDistribution: {
      'marginal': 0.4,
      'recognized': 0.4,
      'renowned': 0.2
    }
  }
};

/**
 * Abilities Entity Registry
 *
 * Creators:
 * - tech_innovation: Creates new technologies (primary)
 * - tech_breakthrough: Creates breakthrough technologies (primary)
 * - magic_discovery: Creates new magic abilities (primary)
 * - orca_combat_technique: Creates orca combat techniques (incidental)
 * - magical_site_discovery: May create abilities at magical sites (incidental)
 *
 * Lineage: Abilities link via derived_from or related_to
 */
export const abilitiesRegistry: EntityOperatorRegistry = {
  kind: 'abilities',

  creators: [
    { templateId: 'tech_innovation', primary: true, targetCount: 1 },
    { templateId: 'tech_breakthrough', primary: true, targetCount: 1 },
    { templateId: 'magic_discovery', primary: true, targetCount: 1 },
    { templateId: 'orca_combat_technique', primary: false, targetCount: 1 },
    { templateId: 'magical_site_discovery', primary: false, targetCount: 1 }
  ],

  modifiers: [
    // TODO: Add systems that modify abilities
  ],

  lineage: {
    relationshipKind: 'derived_from',  // Tech builds on tech, magic on magic
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      const existingAbilities = graphView.findEntities({ kind: 'abilities' })
        .filter(a => a.id !== newEntity.id && a.status === 'active');

      if (existingAbilities.length === 0) return undefined;

      // Strongly prefer same subtype (tech→tech, magic→magic, combat→combat)
      const sameSubtype = existingAbilities.filter(a => a.subtype === newEntity.subtype);
      if (sameSubtype.length > 0) {
        return sameSubtype[Math.floor(Math.random() * sameSubtype.length)];
      }

      // Otherwise any ability (cross-pollination)
      return existingAbilities[Math.floor(Math.random() * existingAbilities.length)];
    },
    distanceRange: { min: 0.1, max: 0.3 }  // Incremental innovation (close distance)
  },

  expectedDistribution: {
    targetCount: 30,
    prominenceDistribution: {
      'marginal': 0.5,
      'recognized': 0.3,
      'renowned': 0.15,
      'mythic': 0.05
    }
  }
};

/**
 * Rules Entity Registry
 *
 * Creators:
 * - crisis_legislation: Creates emergency laws during crises (primary)
 * - ideology_emergence: Creates ideological movements (primary)
 * - great_festival: Creates festival traditions (primary)
 *
 * Lineage: Rules link via supersedes or related_to
 */
export const rulesRegistry: EntityOperatorRegistry = {
  kind: 'rules',

  creators: [
    { templateId: 'crisis_legislation', primary: true, targetCount: 1 },
    { templateId: 'ideology_emergence', primary: true, targetCount: 1 },
    { templateId: 'great_festival', primary: true, targetCount: 1 }
  ],

  modifiers: [
    // TODO: Add systems that modify rules
  ],

  lineage: {
    relationshipKind: 'supersedes',  // Or 'related_to' for non-superseding rules
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      const existingRules = graphView.findEntities({ kind: 'rules' })
        .filter(r => r.id !== newEntity.id && r.status !== 'repealed');

      if (existingRules.length === 0) return undefined;

      // Prefer same subtype (edict→edict, taboo→taboo, social→social)
      const sameSubtype = existingRules.filter(r => r.subtype === newEntity.subtype);
      if (sameSubtype.length > 0) {
        return sameSubtype[Math.floor(Math.random() * sameSubtype.length)];
      }

      // Otherwise any rule
      return existingRules[Math.floor(Math.random() * existingRules.length)];
    },
    distanceRange: { min: 0.1, max: 0.5 }  // Range from amendment (0.1) to revolutionary (0.5)
  },

  expectedDistribution: {
    targetCount: 30,
    prominenceDistribution: {
      'marginal': 0.6,
      'recognized': 0.3,
      'renowned': 0.1
    }
  }
};

/**
 * Location Entity Registry
 *
 * Creators:
 * - colony_founding: Creates new colonies (primary)
 * - anomaly_manifestation: Creates mystical anomalies (primary)
 * - resource_location_discovery: Creates resource locations (primary)
 * - strategic_location_discovery: Creates strategic locations (primary)
 * - mystical_location_discovery: Creates mystical locations (primary)
 * - geographic_exploration: Creates geographic features (primary)
 * - krill_bloom_migration: Creates krill bloom locations (primary)
 *
 * Lineage: Locations already have good geographic lineage via connected_to relationships
 */
export const locationRegistry: EntityOperatorRegistry = {
  kind: 'location',

  creators: [
    { templateId: 'colony_founding', primary: true, targetCount: 1 },
    { templateId: 'anomaly_manifestation', primary: true, targetCount: 1 },
    { templateId: 'resource_location_discovery', primary: true, targetCount: 1 },
    { templateId: 'emergent_location_discovery', primary: true, targetCount: 1 },
    { templateId: 'geographic_exploration', primary: true, targetCount: 1 },
    { templateId: 'krill_bloom_migration', primary: true, targetCount: 1 }
  ],

  modifiers: [
    // TODO: Add systems that modify locations
  ],

  lineage: {
    relationshipKind: 'connected_to',  // Geographic proximity
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      const existingLocations = graphView.findEntities({ kind: 'location' })
        .filter(l => l.id !== newEntity.id);

      if (existingLocations.length === 0) return undefined;

      // Prefer colonies for new colonies, anomalies for new anomalies
      const sameSubtype = existingLocations.filter(l => l.subtype === newEntity.subtype);
      if (sameSubtype.length > 0) {
        return sameSubtype[Math.floor(Math.random() * sameSubtype.length)];
      }

      // Otherwise any location
      return existingLocations[Math.floor(Math.random() * existingLocations.length)];
    },
    distanceRange: { min: 0.0, max: 1.0 }  // Full range for geographic distance
  },

  expectedDistribution: {
    targetCount: 30,
    prominenceDistribution: {
      'marginal': 0.5,
      'recognized': 0.3,
      'renowned': 0.15,
      'mythic': 0.05
    }
  }
};

/**
 * Colony Subtype Registry (Location:Colony)
 *
 * Settlements and population centers.
 */
export const colonyRegistry: EntityOperatorRegistry = {
  kind: 'location',
  subtype: 'colony',

  creators: [
    { templateId: 'colony_founding', primary: true, targetCount: 1 }
  ],

  modifiers: [],

  lineage: {
    relationshipKind: 'connected_to',
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      // Colonies connect to other colonies
      const existingColonies = graphView.findEntities({ kind: 'location', subtype: 'colony' })
        .filter(col => col.id !== newEntity.id);

      if (existingColonies.length > 0) {
        return existingColonies[Math.floor(Math.random() * existingColonies.length)];
      }

      return undefined;
    },
    distanceRange: { min: 0.3, max: 0.7 }  // Colonies have moderate geographic distance
  },

  expectedDistribution: {
    targetCount: 10,
    prominenceDistribution: {
      'marginal': 0.5,
      'recognized': 0.3,
      'renowned': 0.2
    }
  }
};

/**
 * Anomaly Subtype Registry (Location:Anomaly)
 *
 * Mystical and unusual geographic features.
 */
export const anomalyRegistry: EntityOperatorRegistry = {
  kind: 'location',
  subtype: 'anomaly',

  creators: [
    { templateId: 'anomaly_manifestation', primary: true, targetCount: 1 }
  ],

  modifiers: [],

  lineage: {
    relationshipKind: 'connected_to',
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      // Anomalies connect to other anomalies (mystical ley lines)
      const existingAnomalies = graphView.findEntities({ kind: 'location', subtype: 'anomaly' })
        .filter(anom => anom.id !== newEntity.id);

      if (existingAnomalies.length > 0) {
        return existingAnomalies[Math.floor(Math.random() * existingAnomalies.length)];
      }

      // Fall back to any location
      const existingLocations = graphView.findEntities({ kind: 'location' })
        .filter(loc => loc.id !== newEntity.id);

      if (existingLocations.length > 0) {
        return existingLocations[Math.floor(Math.random() * existingLocations.length)];
      }

      return undefined;
    },
    distanceRange: { min: 0.5, max: 0.9 }  // Anomalies have high distance (mystically different)
  },

  expectedDistribution: {
    targetCount: 15,
    prominenceDistribution: {
      'marginal': 0.4,
      'recognized': 0.3,
      'renowned': 0.2,
      'mythic': 0.1
    }
  }
};

/**
 * Magic Subtype Registry (Abilities:Magic)
 *
 * Mystical abilities and magical discoveries.
 */
export const magicRegistry: EntityOperatorRegistry = {
  kind: 'abilities',
  subtype: 'magic',

  creators: [
    { templateId: 'magic_discovery', primary: true, targetCount: 1 }
  ],

  modifiers: [],

  lineage: {
    relationshipKind: 'derived_from',
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      // Magic builds on previous magic
      const existingMagic = graphView.findEntities({ kind: 'abilities', subtype: 'magic' })
        .filter(mag => mag.id !== newEntity.id && mag.status === 'active');

      if (existingMagic.length > 0) {
        return existingMagic[Math.floor(Math.random() * existingMagic.length)];
      }

      return undefined;
    },
    distanceRange: { min: 0.2, max: 0.5 }  // Magic has moderate distance (diverse schools of magic)
  },

  expectedDistribution: {
    targetCount: 10,
    prominenceDistribution: {
      'marginal': 0.5,
      'recognized': 0.3,
      'renowned': 0.15,
      'mythic': 0.05
    }
  }
};

/**
 * Technology Subtype Registry (Abilities:Technology)
 *
 * Technological innovations and breakthroughs.
 */
export const technologyRegistry: EntityOperatorRegistry = {
  kind: 'abilities',
  subtype: 'technology',

  creators: [
    { templateId: 'tech_innovation', primary: true, targetCount: 1 },
    { templateId: 'tech_breakthrough', primary: true, targetCount: 1 }
  ],

  modifiers: [],

  lineage: {
    relationshipKind: 'derived_from',
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => {
      // Technology builds on previous technology
      const existingTech = graphView.findEntities({ kind: 'abilities', subtype: 'technology' })
        .filter(tech => tech.id !== newEntity.id && tech.status === 'active');

      if (existingTech.length > 0) {
        return existingTech[Math.floor(Math.random() * existingTech.length)];
      }

      return undefined;
    },
    distanceRange: { min: 0.1, max: 0.3 }  // Technology has low distance (incremental innovation)
  },

  expectedDistribution: {
    targetCount: 10,
    prominenceDistribution: {
      'marginal': 0.5,
      'recognized': 0.3,
      'renowned': 0.15,
      'mythic': 0.05
    }
  }
};

/**
 * All Penguin Entity Registries
 *
 * Exported array for framework validation and engine integration
 */
export const penguinEntityRegistries: EntityOperatorRegistry[] = [
  npcRegistry,
  heroRegistry,
  mayorRegistry,
  orcaRegistry,
  factionRegistry,
  cultRegistry,
  companyRegistry,
  criminalRegistry,
  politicalRegistry,
  abilitiesRegistry,
  magicRegistry,
  technologyRegistry,
  rulesRegistry,
  locationRegistry,
  colonyRegistry,
  anomalyRegistry
];

// Default export for backwards compatibility
export default penguinEntityRegistries;
