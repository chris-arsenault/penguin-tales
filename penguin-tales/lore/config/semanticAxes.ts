/**
 * Semantic Axis Definitions for Penguin Tales
 *
 * Each entity kind has 3 meaningful axes that define its coordinate space.
 * Tags are mapped to positions on these axes to encode semantic meaning.
 */

import type { EntityKindAxes, TagSemanticWeights, SemanticEncoderConfig } from '@lore-weave/core';

/**
 * Axis definitions for each entity kind.
 *
 * Axes correlate with pressures to create feedback loops:
 * - Entities at certain positions affect related pressures
 * - This drives emergent world behavior
 */
export const semanticAxes: EntityKindAxes[] = [
  // ============================================================================
  // ABILITIES
  // ============================================================================
  {
    entityKind: 'abilities',
    x: {
      name: 'source',
      lowConcept: 'physical',     // 0: martial, mundane, natural
      highConcept: 'mystical',    // 100: magical, supernatural, arcane
      relatedPressure: 'magical_instability',
      pressureCorrelation: 0.5,   // Mystical abilities increase instability
    },
    y: {
      name: 'application',
      lowConcept: 'defensive',    // 0: protective, healing, shielding
      highConcept: 'offensive',   // 100: destructive, aggressive, harmful
      relatedPressure: 'conflict',
      pressureCorrelation: 0.3,   // Offensive abilities increase conflict
    },
    z: {
      name: 'mastery',
      lowConcept: 'basic',        // 0: simple, novice, common
      highConcept: 'advanced',    // 100: complex, master, rare
    },
  },

  // ============================================================================
  // RULES
  // ============================================================================
  {
    entityKind: 'rules',
    x: {
      name: 'scope',
      lowConcept: 'personal',     // 0: individual, local, specific
      highConcept: 'universal',   // 100: global, widespread, general
      relatedPressure: 'stability',
      pressureCorrelation: 0.2,   // Universal rules increase stability
    },
    y: {
      name: 'nature',
      lowConcept: 'traditional',  // 0: conservative, established, old
      highConcept: 'progressive', // 100: innovative, reform, new
      relatedPressure: 'cultural_tension',
      pressureCorrelation: 0.4,   // Progressive rules increase tension
    },
    z: {
      name: 'enforcement',
      lowConcept: 'social',       // 0: suggestion, custom, informal
      highConcept: 'absolute',    // 100: law, mandate, strict
      relatedPressure: 'stability',
      pressureCorrelation: 0.3,   // Strict enforcement increases stability
    },
  },

  // ============================================================================
  // NPC
  // ============================================================================
  {
    entityKind: 'npc',
    x: {
      name: 'alignment',
      lowConcept: 'hostile',      // 0: enemy, threat, antagonist
      highConcept: 'friendly',    // 100: ally, helpful, protagonist
      relatedPressure: 'external_threat',
      pressureCorrelation: -0.5,  // Hostile NPCs increase threat
    },
    y: {
      name: 'role',
      lowConcept: 'follower',     // 0: subordinate, common, marginal
      highConcept: 'leader',      // 100: authority, influential, prominent
      relatedPressure: 'stability',
      pressureCorrelation: 0.2,   // Leaders increase stability
    },
    z: {
      name: 'approach',
      lowConcept: 'mundane',      // 0: practical, physical, material
      highConcept: 'mystical',    // 100: magical, spiritual, arcane
      relatedPressure: 'magical_instability',
      pressureCorrelation: 0.2,   // Mystical NPCs increase instability
    },
  },

  // ============================================================================
  // FACTION
  // ============================================================================
  {
    entityKind: 'faction',
    x: {
      name: 'structure',
      lowConcept: 'chaotic',      // 0: loose, disorganized, informal
      highConcept: 'organized',   // 100: hierarchical, structured, formal
      relatedPressure: 'stability',
      pressureCorrelation: 0.3,   // Organized factions increase stability
    },
    y: {
      name: 'purpose',
      lowConcept: 'destructive',  // 0: criminal, harmful, exploitative
      highConcept: 'constructive',// 100: beneficial, productive, helpful
      relatedPressure: 'conflict',
      pressureCorrelation: -0.4,  // Destructive factions increase conflict
    },
    z: {
      name: 'reach',
      lowConcept: 'local',        // 0: isolated, small, limited
      highConcept: 'widespread',  // 100: expansive, influential, broad
    },
  },

  // ============================================================================
  // LOCATION
  // ============================================================================
  {
    entityKind: 'location',
    x: {
      name: 'accessibility',
      lowConcept: 'hidden',       // 0: remote, secret, hard to reach
      highConcept: 'central',     // 100: accessible, prominent, well-known
    },
    y: {
      name: 'nature',
      lowConcept: 'mundane',      // 0: natural, ordinary, normal
      highConcept: 'anomalous',   // 100: mystical, strange, supernatural
      relatedPressure: 'magical_instability',
      pressureCorrelation: 0.4,   // Anomalous locations increase instability
    },
    z: {
      name: 'safety',
      lowConcept: 'dangerous',    // 0: hostile, hazardous, threatening
      highConcept: 'safe',        // 100: welcoming, protected, secure
      relatedPressure: 'external_threat',
      pressureCorrelation: -0.3,  // Safe locations reduce threat perception
    },
  },
];

/**
 * Tag semantic weights.
 *
 * Maps tags to positions (0-100) on each axis for each entity kind.
 * Tags not listed here will default to 50 with a warning.
 *
 * Weight interpretation:
 * - 0-20: Strong alignment with lowConcept
 * - 20-40: Moderate alignment with lowConcept
 * - 40-60: Neutral / mixed
 * - 60-80: Moderate alignment with highConcept
 * - 80-100: Strong alignment with highConcept
 */
export const tagSemanticWeights: TagSemanticWeights[] = [
  // ============================================================================
  // ABILITIES TAGS
  // ============================================================================
  {
    tag: 'magic',
    weights: {
      abilities: { source: 90, application: 50, mastery: 60 },
    },
  },
  {
    tag: 'mystical',
    weights: {
      abilities: { source: 85, application: 50, mastery: 55 },
      npc: { alignment: 50, role: 50, approach: 85 },
      faction: { structure: 40, purpose: 50, reach: 50 },
      location: { accessibility: 30, nature: 90, safety: 40 },
    },
  },
  {
    tag: 'technology',
    weights: {
      abilities: { source: 15, application: 50, mastery: 70 },
    },
  },
  {
    tag: 'innovation',
    weights: {
      abilities: { source: 20, application: 50, mastery: 75 },
      rules: { scope: 50, nature: 85, enforcement: 40 },
    },
  },
  {
    tag: 'combat',
    weights: {
      abilities: { source: 30, application: 85, mastery: 60 },
    },
  },
  {
    tag: 'offensive',
    weights: {
      abilities: { source: 40, application: 95, mastery: 65 },
    },
  },
  {
    tag: 'defensive',
    weights: {
      abilities: { source: 40, application: 10, mastery: 50 },
      location: { accessibility: 50, nature: 30, safety: 70 },
    },
  },
  {
    tag: 'external',
    weights: {
      abilities: { source: 50, application: 70, mastery: 60 },
    },
  },

  // ============================================================================
  // RULES TAGS
  // ============================================================================
  {
    tag: 'ideology',
    weights: {
      rules: { scope: 70, nature: 60, enforcement: 30 },
    },
  },
  {
    tag: 'cultural',
    weights: {
      rules: { scope: 60, nature: 50, enforcement: 25 },
    },
  },
  {
    tag: 'crisis',
    weights: {
      rules: { scope: 80, nature: 70, enforcement: 90 },
    },
  },
  {
    tag: 'emergency',
    weights: {
      rules: { scope: 75, nature: 65, enforcement: 95 },
    },
  },
  {
    tag: 'festival',
    weights: {
      rules: { scope: 70, nature: 40, enforcement: 15 },
    },
  },
  {
    tag: 'harvest',
    weights: {
      rules: { scope: 60, nature: 20, enforcement: 10 },
    },
  },
  {
    tag: 'memorial',
    weights: {
      rules: { scope: 65, nature: 25, enforcement: 20 },
    },
  },
  {
    tag: 'treaty',
    weights: {
      rules: { scope: 90, nature: 50, enforcement: 70 },
    },
  },
  {
    tag: 'celestial',
    weights: {
      rules: { scope: 80, nature: 30, enforcement: 15 },
    },
  },
  {
    tag: 'tradition',
    weights: {
      rules: { scope: 50, nature: 10, enforcement: 40 },
    },
  },
  {
    tag: 'militarism',
    weights: {
      rules: { scope: 70, nature: 30, enforcement: 85 },
    },
  },
  {
    tag: 'pacifism',
    weights: {
      rules: { scope: 70, nature: 70, enforcement: 30 },
    },
  },
  {
    tag: 'unity',
    weights: {
      rules: { scope: 90, nature: 50, enforcement: 50 },
    },
  },
  {
    tag: 'isolation',
    weights: {
      rules: { scope: 20, nature: 40, enforcement: 40 },
    },
  },
  {
    tag: 'equality',
    weights: {
      rules: { scope: 80, nature: 80, enforcement: 60 },
    },
  },
  {
    tag: 'hierarchy',
    weights: {
      rules: { scope: 60, nature: 15, enforcement: 75 },
    },
  },
  {
    tag: 'rationalism',
    weights: {
      rules: { scope: 70, nature: 75, enforcement: 50 },
    },
  },
  {
    tag: 'asceticism',
    weights: {
      rules: { scope: 40, nature: 30, enforcement: 45 },
    },
  },
  {
    tag: 'hedonism',
    weights: {
      rules: { scope: 50, nature: 65, enforcement: 20 },
    },
  },

  // ============================================================================
  // NPC TAGS
  // ============================================================================
  {
    tag: 'brave',
    weights: {
      npc: { alignment: 75, role: 70, approach: 40 },
    },
  },
  {
    tag: 'emergent',
    weights: {
      npc: { alignment: 70, role: 65, approach: 50 },
    },
  },
  {
    tag: 'criminal',
    weights: {
      npc: { alignment: 30, role: 40, approach: 30 },
    },
  },
  {
    tag: 'recruit',
    weights: {
      npc: { alignment: 40, role: 20, approach: 35 },
    },
  },
  {
    tag: 'successor',
    weights: {
      npc: { alignment: 60, role: 85, approach: 50 },
    },
  },
  {
    tag: 'second_generation',
    weights: {
      npc: { alignment: 55, role: 30, approach: 50 },
    },
  },
  {
    tag: 'orca',
    weights: {
      npc: { alignment: 5, role: 60, approach: 30 },
      abilities: { source: 25, application: 90, mastery: 70 },
    },
  },
  {
    tag: 'raider',
    weights: {
      npc: { alignment: 10, role: 50, approach: 25 },
    },
  },
  {
    tag: 'predator',
    weights: {
      npc: { alignment: 5, role: 55, approach: 20 },
    },
  },
  {
    tag: 'external-threat',
    weights: {
      npc: { alignment: 10, role: 45, approach: 30 },
    },
  },
  {
    tag: 'underwater',
    weights: {
      npc: { alignment: 50, role: 50, approach: 40 },
      location: { accessibility: 25, nature: 40, safety: 35 },
    },
  },
  {
    tag: 'trader',
    weights: {
      npc: { alignment: 70, role: 50, approach: 25 },
    },
  },
  {
    tag: 'guild-founder',
    weights: {
      npc: { alignment: 75, role: 80, approach: 30 },
    },
  },
  {
    tag: 'prophet',
    weights: {
      npc: { alignment: 50, role: 85, approach: 95 },
    },
  },
  {
    tag: 'cultist',
    weights: {
      npc: { alignment: 40, role: 30, approach: 80 },
    },
  },
  {
    tag: 'rebel',
    weights: {
      npc: { alignment: 35, role: 60, approach: 40 },
    },
  },
  {
    tag: 'charismatic',
    weights: {
      npc: { alignment: 55, role: 75, approach: 50 },
    },
  },
  {
    tag: 'traditional',
    weights: {
      npc: { alignment: 60, role: 50, approach: 35 },
    },
  },
  {
    tag: 'radical',
    weights: {
      npc: { alignment: 40, role: 55, approach: 55 },
    },
  },
  {
    tag: 'talented',
    weights: {
      npc: { alignment: 55, role: 60, approach: 60 },
    },
  },
  {
    tag: 'rebellious',
    weights: {
      npc: { alignment: 35, role: 45, approach: 45 },
    },
  },
  {
    tag: 'family',
    weights: {
      npc: { alignment: 65, role: 40, approach: 40 },
    },
  },
  {
    tag: 'explorer',
    weights: {
      npc: { alignment: 60, role: 55, approach: 45 },
    },
  },
  {
    tag: 'merchant',
    weights: {
      npc: { alignment: 65, role: 45, approach: 25 },
    },
  },

  // ============================================================================
  // FACTION TAGS
  // ============================================================================
  {
    tag: 'trade',
    weights: {
      faction: { structure: 70, purpose: 75, reach: 70 },
    },
  },
  {
    tag: 'guild',
    weights: {
      faction: { structure: 85, purpose: 80, reach: 60 },
    },
  },
  {
    tag: 'organized',
    weights: {
      faction: { structure: 90, purpose: 65, reach: 55 },
    },
  },
  {
    tag: 'cult',
    weights: {
      faction: { structure: 60, purpose: 35, reach: 40 },
    },
  },
  {
    tag: 'secretive',
    weights: {
      faction: { structure: 50, purpose: 40, reach: 25 },
    },
  },
  {
    tag: 'splinter',
    weights: {
      faction: { structure: 40, purpose: 45, reach: 30 },
    },
  },

  // ============================================================================
  // LOCATION TAGS
  // ============================================================================
  {
    tag: 'krill',
    weights: {
      location: { accessibility: 45, nature: 20, safety: 50 },
    },
  },
  {
    tag: 'bloom',
    weights: {
      location: { accessibility: 40, nature: 30, safety: 55 },
    },
  },
  {
    tag: 'resource',
    weights: {
      location: { accessibility: 55, nature: 25, safety: 60 },
    },
  },
  {
    tag: 'new',
    weights: {
      location: { accessibility: 50, nature: 30, safety: 55 },
    },
  },
  {
    tag: 'colony',
    weights: {
      location: { accessibility: 80, nature: 20, safety: 85 },
    },
  },
  {
    tag: 'anomaly',
    weights: {
      location: { accessibility: 25, nature: 95, safety: 25 },
    },
  },
  {
    tag: 'caverns',
    weights: {
      location: { accessibility: 20, nature: 50, safety: 35 },
    },
  },
  {
    tag: 'mystery',
    weights: {
      location: { accessibility: 15, nature: 70, safety: 30 },
    },
  },
  {
    tag: 'vanishing',
    weights: {
      location: { accessibility: 10, nature: 85, safety: 15 },
    },
  },
  {
    tag: 'hidden',
    weights: {
      location: { accessibility: 10, nature: 50, safety: 45 },
    },
  },
  {
    tag: 'deep',
    weights: {
      location: { accessibility: 15, nature: 40, safety: 30 },
    },
  },
  {
    tag: 'surface',
    weights: {
      location: { accessibility: 75, nature: 25, safety: 70 },
    },
  },
  {
    tag: 'strategic',
    weights: {
      location: { accessibility: 60, nature: 30, safety: 50 },
    },
  },
  {
    tag: 'icy',
    weights: {
      location: { accessibility: 50, nature: 25, safety: 45 },
    },
  },
  {
    tag: 'landmark',
    weights: {
      location: { accessibility: 85, nature: 35, safety: 65 },
    },
  },
  {
    tag: 'glowing',
    weights: {
      location: { accessibility: 35, nature: 80, safety: 40 },
    },
  },
  {
    tag: 'vantage',
    weights: {
      location: { accessibility: 55, nature: 30, safety: 60 },
    },
  },
];

/**
 * Get axis configuration for an entity kind.
 */
export function getAxesForKind(entityKind: string): EntityKindAxes | undefined {
  return semanticAxes.find(a => a.entityKind === entityKind);
}

/**
 * Get semantic weights for a tag.
 */
export function getTagWeights(tag: string): TagSemanticWeights | undefined {
  return tagSemanticWeights.find(t => t.tag === tag);
}

/**
 * Complete semantic encoder configuration for penguin domain.
 */
export const penguinSemanticConfig: SemanticEncoderConfig = {
  axes: semanticAxes,
  tagWeights: tagSemanticWeights,
  warnOnUnconfiguredTags: false  // Don't warn - many tags are intentionally unconfigured
};
