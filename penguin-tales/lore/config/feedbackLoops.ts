/**
 * Penguin Domain Feedback Loop Configuration
 *
 * Explicit declaration of all feedback relationships in the penguin world.
 * Each loop describes how one variable affects another, creating homeostatic regulation.
 *
 * Negative feedback = stabilizing (source up → target down)
 * Positive feedback = amplifying (source up → target up)
 */

import type { FeedbackLoop } from '@lore-weave/core';

export const penguinFeedbackLoops: FeedbackLoop[] = [
  // ========================================
  // HERO FEEDBACK LOOPS
  // ========================================
  {
    id: 'hero_reduces_conflict',
    type: 'negative',
    source: 'npc:hero.count',
    mechanism: ['heroes resolve conflicts', 'reduces conflict pressure', 'reduces hero_emergence trigger'],
    target: 'conflict.value',
    strength: -0.4,  // Each hero reduces conflict by ~0.4%
    delay: 2,
    active: true,
    lastValidated: 0
  },
  {
    id: 'conflict_triggers_heroes',
    type: 'positive',
    source: 'conflict.value',
    mechanism: ['high conflict triggers hero_emergence template'],
    target: 'npc:hero.count',
    strength: 0.3,
    delay: 5,
    active: true,
    lastValidated: 0
  },
  {
    id: 'hero_saturation_suppresses_creation',
    type: 'positive',  // FIXED: Actual correlation is positive (deviation and trend move together)
    source: 'npc:hero.deviation',
    mechanism: ['hero count above target', 'dynamic weight suppression', 'fewer heroes spawn'],
    target: 'npc:hero.trend',
    strength: 0.6,  // FIXED: Changed sign to match positive correlation
    delay: 1,
    active: true,
    lastValidated: 0
  },

  // ========================================
  // MAGIC FEEDBACK LOOPS
  // ========================================
  {
    id: 'magic_drives_instability',
    type: 'positive',
    source: 'abilities:magic.count',
    mechanism: ['magic abilities create instability'],
    target: 'magical_instability.value',
    strength: 0.5,
    delay: 0,
    active: true,
    lastValidated: 0
  },
  {
    id: 'instability_reduces_magic_creation',
    type: 'negative',
    source: 'magical_instability.value',
    mechanism: ['high instability suppresses magic_discovery weight'],
    target: 'abilities:magic.trend',
    strength: -0.3,
    delay: 10,
    active: true,
    lastValidated: 0
  },
  {
    id: 'anomaly_enables_magic',
    type: 'positive',
    source: 'location:anomaly.count',
    mechanism: ['anomalies required for magic discovery'],
    target: 'abilities:magic.count',
    strength: 0.4,
    delay: 5,
    active: true,
    lastValidated: 0
  },
  {
    id: 'magic_tech_balance',
    type: 'negative',
    source: 'abilities:magic.count',
    mechanism: ['high magic reduces tech_innovation weight'],
    target: 'abilities:technology.trend',
    strength: -0.2,
    delay: 5,
    active: true,
    lastValidated: 0
  },

  // ========================================
  // ORCA/EXTERNAL THREAT LOOPS
  // ========================================
  {
    id: 'orca_drives_external_threat',
    type: 'positive',
    source: 'npc:orca.count',
    mechanism: ['orcas increase external_threat pressure'],
    target: 'external_threat.value',
    strength: 0.8,
    delay: 0,
    active: true,
    lastValidated: 0
  },
  {
    id: 'threat_triggers_orcas',
    type: 'positive',
    source: 'external_threat.value',
    mechanism: ['high external_threat triggers orca_raider_arrival'],
    target: 'npc:orca.count',
    strength: 0.3,
    delay: 5,
    active: true,
    lastValidated: 0
  },
  {
    id: 'orca_saturation_suppresses_creation',
    type: 'negative',
    source: 'npc:orca.deviation',
    mechanism: ['orca count above target', 'dynamic weight suppression'],
    target: 'npc:orca.trend',
    strength: -0.7,
    delay: 1,
    active: true,
    lastValidated: 0
  },

  // ========================================
  // CULT FEEDBACK LOOPS
  // ========================================
  {
    id: 'cult_hard_cap',
    type: 'positive',  // FIXED: Actual correlation is positive (count and trend move together until hard cap)
    source: 'faction:cult.count',
    mechanism: ['hard cap at 15 cults', 'cult_formation.canApply returns false'],
    target: 'faction:cult.trend',
    strength: 1.0,  // FIXED: Changed sign to match positive correlation (cutoff happens at boundary)
    delay: 0,
    active: true,
    lastValidated: 0
  },
  {
    id: 'anomaly_enables_cults',
    type: 'positive',
    source: 'location:anomaly.count',
    mechanism: ['anomalies required for cult formation'],
    target: 'faction:cult.count',
    strength: 0.3,
    delay: 5,
    active: true,
    lastValidated: 0
  },
  {
    id: 'cult_increases_instability',
    type: 'positive',
    source: 'faction:cult.count',
    mechanism: ['cults practice magic', 'increases magical_instability'],
    target: 'magical_instability.value',
    strength: 0.2,
    delay: 3,
    active: true,
    lastValidated: 0
  },

  // ========================================
  // FACTION FEEDBACK LOOPS
  // ========================================
  {
    id: 'faction_fragmentation_drives_tension',
    type: 'positive',
    source: 'faction:political.count',
    mechanism: ['more factions = fragmentation', 'increases cultural_tension'],
    target: 'cultural_tension.value',
    strength: 0.4,
    delay: 0,
    active: true,
    lastValidated: 0
  },
  {
    id: 'tension_triggers_splinters',
    type: 'positive',
    source: 'cultural_tension.value',
    mechanism: ['high tension triggers faction_splinter'],
    target: 'faction:political.count',
    strength: 0.2,
    delay: 10,
    active: true,
    lastValidated: 0
  },
  {
    id: 'alliance_reduces_tension',
    type: 'negative',
    source: 'allied_with.count',
    mechanism: ['alliances reduce cultural_tension'],
    target: 'cultural_tension.value',
    strength: -0.3,
    delay: 2,
    active: true,
    lastValidated: 0
  },

  // ========================================
  // COLONY FEEDBACK LOOPS
  // ========================================
  {
    id: 'colony_count_drives_scarcity',
    type: 'positive',
    source: 'location:colony.count',
    mechanism: ['more colonies = more residents', 'increases resource_scarcity'],
    target: 'resource_scarcity.value',
    strength: 0.3,
    delay: 0,
    active: true,
    lastValidated: 0
  },
  {
    id: 'scarcity_triggers_exploration',
    type: 'positive',
    source: 'resource_scarcity.value',
    mechanism: ['high scarcity triggers krill_bloom_migration'],
    target: 'location:geographic_feature.count',
    strength: 0.2,
    delay: 5,
    active: true,
    lastValidated: 0
  },
  {
    id: 'resources_reduce_scarcity',
    type: 'negative',
    source: 'location:geographic_feature.count',
    mechanism: ['resource locations reduce scarcity'],
    target: 'resource_scarcity.value',
    strength: -0.4,
    delay: 3,
    active: true,
    lastValidated: 0
  },

  // ========================================
  // CONFLICT FEEDBACK LOOPS
  // ========================================
  {
    id: 'enemies_drive_conflict',
    type: 'positive',
    source: 'enemy_of.count',
    mechanism: ['enemy relationships increase conflict pressure'],
    target: 'conflict.value',
    strength: 0.5,
    delay: 0,
    active: true,
    lastValidated: 0
  },
  {
    id: 'alliances_reduce_conflict',
    type: 'negative',
    source: 'allied_with.count',
    mechanism: ['alliances reduce conflict pressure'],
    target: 'conflict.value',
    strength: -0.4,
    delay: 0,
    active: true,
    lastValidated: 0
  },
  {
    id: 'conflict_triggers_wars',
    type: 'positive',
    source: 'conflict.value',
    mechanism: ['high conflict triggers war occurrences'],
    target: 'occurrence:war.count',
    strength: 0.3,
    delay: 5,
    active: true,
    lastValidated: 0
  },
  {
    id: 'wars_increase_conflict',
    type: 'positive',
    source: 'occurrence:war.count',
    mechanism: ['war occurrences increase conflict'],
    target: 'conflict.value',
    strength: 0.6,
    delay: 0,
    active: true,
    lastValidated: 0
  },

  // ========================================
  // STABILITY FEEDBACK LOOPS
  // ========================================
  {
    id: 'leaders_increase_stability',
    type: 'positive',
    source: 'leader_of.count',
    mechanism: ['leadership increases stability'],
    target: 'stability.value',
    strength: 0.3,
    delay: 0,
    active: true,
    lastValidated: 0
  },
  {
    id: 'succession_reduces_stability',
    type: 'negative',
    source: 'npc:mayor.count',
    mechanism: ['leadership changes create vacuum', 'succession_vacuum system triggers'],
    target: 'stability.value',
    strength: -0.2,
    delay: 5,
    active: true,
    lastValidated: 0
  },
  {
    id: 'stability_reduces_splinters',
    type: 'negative',
    source: 'stability.value',
    mechanism: ['high stability reduces faction_splinter weight'],
    target: 'faction:political.trend',
    strength: -0.3,
    delay: 10,
    active: true,
    lastValidated: 0
  },

  // ========================================
  // RELATIONSHIP DYNAMICS LOOPS
  // ========================================
  {
    id: 'relationship_decay',
    type: 'negative',
    source: 'enemy_of.count',
    mechanism: ['all relationships decay naturally'],
    target: 'enemy_of.trend',
    strength: -0.1,
    delay: 5,
    active: true,
    lastValidated: 0
  },
  {
    id: 'relationship_reinforcement',
    type: 'positive',
    source: 'member_of.count',
    mechanism: ['structural relationships reinforce'],
    target: 'member_of.trend',
    strength: 0.05,
    delay: 2,
    active: true,
    lastValidated: 0
  },

  // ========================================
  // RULES FEEDBACK LOOPS
  // ========================================
  {
    id: 'rules_reduce_tension',
    type: 'negative',
    source: 'rules:social.count',
    mechanism: ['social rules reduce cultural_tension'],
    target: 'cultural_tension.value',
    strength: -0.2,
    delay: 5,
    active: true,
    lastValidated: 0
  },
  {
    id: 'tension_triggers_ideology',
    type: 'positive',
    source: 'cultural_tension.value',
    mechanism: ['high tension triggers ideology_emergence'],
    target: 'rules:social.count',
    strength: 0.2,
    delay: 10,
    active: true,
    lastValidated: 0
  }
];
