import { Era } from '../types/engine';

export const penguinEras: Era[] = [
  {
    id: 'expansion',
    name: 'The Great Thaw',
    description: 'A period of exploration and colony founding as the ice recedes',
    templateWeights: {
      // Location templates
      'colony_founding': 2.0,
      'geographic_discovery': 1.5,
      'structure_building': 1.2,
      'resource_location_discovery': 1.2,
      'geographic_exploration': 1.5,

      // NPC templates
      'family_expansion': 2.0,
      'merchant_arrival': 1.5,

      // Faction templates
      'guild_establishment': 1.0,
      'faction_splinter': 0.2,  // few conflicts yet

      // Rules templates
      'cultural_tradition': 1.0,
      'crisis_legislation': 0,   // no crises yet

      // Abilities templates
      'tech_innovation': 0.5,
      'magic_discovery': 0.3
    },
    systemModifiers: {
      'resource_flow': 1.5,       // resources plentiful
      'conflict_contagion': 0.3,   // conflicts don't spread
      'cultural_drift': 0.5,       // cultures still unified
      'relationship_formation': 1.5 // lots of new connections
    }
  },
  
  {
    id: 'conflict',
    name: 'The Faction Wars',
    description: 'Resource scarcity leads to inter-colony conflicts',
    templateWeights: {
      // Location templates
      'colony_founding': 0,        // no new colonies during war
      'fortification_building': 2.0,
      'strategic_location_discovery': 1.5,  // War drives strategic finds

      // NPC templates
      'hero_emergence': 2.0,
      'outlaw_recruitment': 2.0,

      // Faction templates
      'faction_splinter': 2.0,
      'underground_formation': 1.5,

      // Rules templates
      'crisis_legislation': 2.0,
      'martial_law': 1.5,

      // Abilities templates
      'combat_technique': 1.5
    },
    systemModifiers: {
      'conflict_contagion': 2.0,   // conflicts spread rapidly
      'alliance_formation': 2.0,   // desperate alliances
      'resource_flow': 0.5,        // war disrupts resources
      'status_volatility': 2.0     // rapid status changes
    }
  },
  
  {
    id: 'innovation',
    name: 'The Clever Ice Age',
    description: 'Technology and magic flourish as penguins seek solutions',
    templateWeights: {
      // Location templates
      'anomaly_manifestation': 1.5,
      'research_site': 2.0,
      'mystical_location_discovery': 1.3,
      'resource_location_discovery': 0.8,

      // NPC templates
      'scholar_emergence': 2.0,
      'merchant_arrival': 1.5,

      // Faction templates
      'guild_establishment': 2.0,
      'cult_formation': 1.0,

      // Rules templates
      'natural_law_discovery': 2.0,
      'regulation_creation': 1.5,

      // Abilities templates
      'tech_innovation': 3.0,
      'magic_discovery': 2.5,
      'technique_evolution': 2.0
    },
    systemModifiers: {
      'knowledge_spread': 2.0,
      'resource_flow': 1.2,        // tech improves efficiency
      'cultural_exchange': 1.5,
      'ability_mutation': 2.0      // rapid ability evolution
    }
  },
  
  {
    id: 'invasion',
    name: 'The Orca Incursion',
    description: 'External threats unite the colonies against common enemies',
    templateWeights: {
      // Location templates
      'defensive_structure': 3.0,
      'refugee_camp': 2.0,
      'strategic_location_discovery': 1.0,  // Escape routes, defensive positions

      // NPC templates
      'hero_emergence': 3.0,
      'war_leader': 2.0,

      // Faction templates
      'military_order': 2.0,
      'resistance_cell': 1.5,

      // Rules templates
      'emergency_decree': 2.0,
      'alliance_pact': 3.0,

      // Abilities templates
      'combat_technique': 2.0,
      'defensive_magic': 2.5
    },
    systemModifiers: {
      'external_pressure': 3.0,
      'internal_solidarity': 2.0,   // colonies unite
      'conflict_contagion': 0.3,   // internal conflicts pause
      'hero_emergence': 2.0
    },
    specialRules: (graph) => {
      // Add external threat entities if not present
      // Suspend internal faction conflicts
    }
  },
  
  {
    id: 'reconstruction',
    name: 'The Frozen Peace',
    description: 'Rebuilding and consolidation after the wars',
    templateWeights: {
      // Location templates
      'memorial_sites': 1.5,
      'trade_posts': 2.0,
      'geographic_exploration': 1.3,  // Peaceful rediscovery

      // NPC templates
      'succession': 2.0,          // generational change
      'diplomat_emergence': 1.5,

      // Faction templates
      'merchant_consortium': 1.5,
      'veteran_society': 1.0,

      // Rules templates
      'peace_treaty': 2.0,
      'cultural_codification': 2.5,
      'trade_agreement': 2.0,

      // Abilities templates
      'tradition_preservation': 1.5,
      'hybrid_technique': 1.0     // combining war knowledge
    },
    systemModifiers: {
      'cultural_drift': 1.5,      // cultures diverge in peace
      'trade_flow': 2.0,
      'conflict_decay': 2.0,       // old conflicts fade
      'prominence_stabilization': 1.5
    }
  }
];

// Function to select era based on epoch
export function selectEra(epoch: number, eras: Era[] = penguinEras): Era {
  // Simple progression through eras
  return eras[Math.min(epoch, eras.length - 1)];
}

// Function to get era-modified weight
export function getTemplateWeight(
  era: Era,
  templateId: string,
  baseWeight: number = 1.0
): number {
  const modifier = era.templateWeights[templateId] ?? 1.0;
  return baseWeight * modifier;
}

// Function to get system modifier
export function getSystemModifier(
  era: Era,
  systemId: string,
  baseValue: number = 1.0
): number {
  const modifier = era.systemModifiers[systemId] ?? 1.0;
  return baseValue * modifier;
}
