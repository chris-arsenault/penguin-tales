import { Era } from '../../../apps/lore-weave/lib/types/engine';

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
      'resource_location_discovery': 2.5,  // FIXED: Increased from 1.2 to 2.5 (high exploration)
      'geographic_exploration': 2.5,       // FIXED: Increased from 1.5 to 2.5 (high exploration)
      'krill_bloom_migration': 2.0,

      // NPC templates (REDUCED - NPCs as catalysts, not protagonists)
      // REMOVED: family_expansion (NPC bloat)
      // REMOVED: kinship_constellation (NPC bloat)
      // REMOVED: mysterious_vanishing (low value)
      'hero_emergence': 1.0,         // FIXED: Increased from 0.3 to 1.0 (was suppressed)
      'merchant_arrival': 0.5,       // Reduced from 1.5
      'orca_raider_arrival': 0,      // No orcas during expansion

      // Faction templates
      'guild_establishment': 1.0,
      'faction_splinter': 0.2,  // few conflicts yet

      // Rules templates
      'cultural_tradition': 2.0,  // Boost rules generation
      'crisis_legislation': 1.0,   // FIXED: Increased from 0 to 1.0 (even expansion has minor crises)
      'great_festival': 0.5,     // NEW: Rare festivals in expansion
      'ideology_emergence': 0.5,  // NEW: Few ideological debates in unified expansion

      // Abilities templates
      'tech_innovation': 1.0,     // Boost abilities generation
      'magic_discovery': 0.2,     // Reduced from 0.8 to 0.2
      'orca_combat_technique': 0,  // No orcas during expansion

      // World-level templates
      'territorial_expansion': 2.5,    // High expansion during Great Thaw
      'trade_route_establishment': 1.5, // Moderate trade establishment
      'magical_site_discovery': 1.0,   // Some magical discoveries
      'tech_breakthrough': 1.2         // Innovation is growing
    },
    systemModifiers: {
      'resource_flow': 1.5,       // resources plentiful
      'conflict_contagion': 0.3,   // conflicts don't spread
      'cultural_drift': 0.5,       // cultures still unified
      'relationship_formation': 1.5, // lots of new connections
      'thermal_cascade': 1.0,     // NEW: Normal thermal activity
      'belief_contagion': 0.8,    // NEW: Ideologies less divisive in expansion
      'legend_crystallization': 0.5, // NEW: Few legends yet
      'succession_vacuum': 0.5    // NEW: Stable leadership
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
      'krill_bloom_migration': 0.3,  // NEW: Resource scarcity during war

      // NPC templates (REDUCED)
      // REMOVED: outlaw_recruitment (NPC bloat - created 39 outlaws!)
      // REMOVED: kinship_constellation (NPC bloat)
      // REMOVED: mysterious_vanishing (low value)
      'hero_emergence': 1.5,         // FIXED: Increased from 0.5 to 1.5 - heroes emerge from conflict
      'orca_raider_arrival': 0,      // No orcas during faction wars

      // Faction templates
      'faction_splinter': 2.0,
      'underground_formation': 1.5,

      // Rules templates
      'crisis_legislation': 2.0,
      'martial_law': 1.5,
      'great_festival': 2.0,     // NEW: Peace festivals at peak conflict
      'ideology_emergence': 2.5,  // NEW: War creates competing ideologies

      // Abilities templates
      'combat_technique': 1.5,
      'orca_combat_technique': 0,  // No orcas during faction wars

      // World-level templates
      'territorial_expansion': 3.0,    // Very high during faction wars
      'trade_route_establishment': 0.3, // Trade disrupted by war
      'magical_site_discovery': 0.5,   // Few discoveries during conflict
      'tech_breakthrough': 0.8         // Some war-driven innovation
    },
    systemModifiers: {
      'conflict_contagion': 2.0,   // conflicts spread rapidly
      'alliance_formation': 2.0,   // desperate alliances
      'resource_flow': 0.5,        // war disrupts resources
      'status_volatility': 2.0,    // rapid status changes
      'thermal_cascade': 1.2,     // NEW: War disrupts thermal stability
      'belief_contagion': 2.0,    // NEW: Ideologies spread in crisis
      'legend_crystallization': 2.0, // NEW: War creates heroes and legends
      'succession_vacuum': 2.5    // NEW: Leaders die, crises emerge
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
      'krill_bloom_migration': 1.0,  // NEW: Resource innovation

      // NPC templates (REDUCED)
      // REMOVED: kinship_constellation (NPC bloat)
      // REMOVED: mysterious_vanishing (low value)
      'scholar_emergence': 0.5,      // Reduced from 2.0
      'merchant_arrival': 0.5,       // Reduced from 1.5
      'orca_raider_arrival': 0,      // No orcas during innovation

      // Faction templates
      'guild_establishment': 2.0,
      'cult_formation': 0.1,      // Reduced from 1.0 to 0.1 (very rare)

      // Rules templates
      'natural_law_discovery': 2.5,  // Boost rules in innovation era
      'regulation_creation': 2.0,
      'great_festival': 1.0,     // NEW: Innovation celebrations
      'ideology_emergence': 3.0,  // NEW: Reform movements and new thinking flourish

      // Abilities templates
      'tech_innovation': 3.0,
      'magic_discovery': 0.6,     // Reduced from 2.5 to 0.6
      'technique_evolution': 2.0,
      'orca_combat_technique': 0,  // No orcas during innovation

      // World-level templates
      'territorial_expansion': 0.8,    // Low territorial expansion during innovation
      'trade_route_establishment': 2.5, // High trade for knowledge sharing
      'magical_site_discovery': 3.0,   // Very high magical discoveries
      'tech_breakthrough': 3.5         // Peak technological innovation
    },
    systemModifiers: {
      'knowledge_spread': 2.0,
      'resource_flow': 1.2,        // tech improves efficiency
      'cultural_exchange': 1.5,
      'ability_mutation': 2.0,     // rapid ability evolution
      'thermal_cascade': 1.5,     // NEW: Discovery of thermal patterns
      'belief_contagion': 1.5,    // NEW: New ideas spread
      'legend_crystallization': 1.0, // NEW: Moderate legend formation
      'succession_vacuum': 0.8    // NEW: Stable innovative leadership
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
      'krill_bloom_migration': 0.2,  // NEW: Resources scarce during invasion

      // NPC templates (REDUCED)
      // REMOVED: kinship_constellation (NPC bloat)
      // REMOVED: mysterious_vanishing (low value)
      'hero_emergence': 2.0,         // FIXED: Increased from 0.8 to 2.0 - crisis creates heroes
      'war_leader': 0.5,             // Reduced from 2.0
      'orca_raider_arrival': 2.0,    // Reduced from 4.0 (half) - ORCA INVASION

      // Faction templates
      'military_order': 2.0,
      'resistance_cell': 1.5,

      // Rules templates
      'emergency_decree': 2.0,
      'alliance_pact': 3.0,
      'great_festival': 0.5,     // NEW: Rare unity festivals
      'ideology_emergence': 1.0,  // NEW: Unity beliefs and resistance ideologies

      // Abilities templates
      'combat_technique': 2.0,
      'defensive_magic': 2.5,
      'orca_combat_technique': 3.0,  // ORCA INVASION: Orca combat abilities

      // World-level templates
      'territorial_expansion': 1.5,    // Moderate as territories change hands
      'trade_route_establishment': 0.2, // Trade heavily disrupted
      'magical_site_discovery': 1.0,   // Some defensive discoveries
      'tech_breakthrough': 1.5         // War-driven defensive innovation
    },
    systemModifiers: {
      'external_pressure': 3.0,
      'internal_solidarity': 2.0,   // colonies unite
      'conflict_contagion': 0.3,   // internal conflicts pause
      'hero_emergence': 2.0,
      'thermal_cascade': 1.8,     // NEW: War disrupts environment
      'belief_contagion': 1.2,    // NEW: Unity beliefs spread
      'legend_crystallization': 3.0, // NEW: Many heroes fall, become legends
      'succession_vacuum': 2.0    // NEW: Leaders die in battle
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
      'krill_bloom_migration': 1.5,  // NEW: Resource recovery

      // NPC templates (REDUCED)
      // REMOVED: kinship_constellation (NPC bloat)
      // REMOVED: mysterious_vanishing (low value)
      'succession': 1.0,             // Reduced from 2.0 - generational change
      'diplomat_emergence': 0.4,     // Reduced from 1.5
      'orca_raider_arrival': 0,      // No orcas during reconstruction

      // Faction templates
      'merchant_consortium': 1.5,
      'veteran_society': 1.0,

      // Rules templates
      'peace_treaty': 2.0,
      'cultural_codification': 3.0,  // Boost cultural rules
      'trade_agreement': 2.5,
      'great_festival': 3.0,     // NEW: Celebration and memorial festivals
      'ideology_emergence': 2.0,  // NEW: Reform movements and cultural reassessment

      // Abilities templates
      'tradition_preservation': 2.0,  // Boost abilities preservation
      'hybrid_technique': 1.5,    // combining war knowledge
      'orca_combat_technique': 0,  // No orcas during reconstruction

      // World-level templates
      'territorial_expansion': 1.0,    // Some consolidation
      'trade_route_establishment': 3.0, // High trade during reconstruction
      'magical_site_discovery': 1.2,   // Moderate rediscovery
      'tech_breakthrough': 1.8         // Rebuilding innovation
    },
    systemModifiers: {
      'cultural_drift': 1.5,      // cultures diverge in peace
      'trade_flow': 2.0,
      'conflict_decay': 2.0,       // old conflicts fade
      'prominence_stabilization': 1.5,
      'thermal_cascade': 0.8,     // NEW: Stable thermal conditions
      'belief_contagion': 1.0,    // NEW: Normal ideological spread
      'legend_crystallization': 2.5, // NEW: War heroes crystallize into legend
      'succession_vacuum': 1.5    // NEW: Generational transitions
    }
  }
];

// Function to select era based on epoch
export function selectEra(epoch: number, eras: Era[] = penguinEras, epochsPerEra: number = 2): Era {
  // Distribute epochs evenly across eras
  const eraIndex = Math.floor(epoch / epochsPerEra);
  return eras[Math.min(eraIndex, eras.length - 1)];
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
