import { Pressure, ComponentPurpose } from '../../../types/engine';
import { findEntities, getRelated } from '../../../utils/helpers';

export const pressures: Pressure[] = [
  {
    id: 'resource_scarcity',
    name: 'Resource Scarcity',
    value: 20,
    decay: 18,  // TUNED: Increased from 12 to 18 (still at 88 vs target 30)
    contract: {
      purpose: ComponentPurpose.PRESSURE_ACCUMULATION,
      sources: [
        { component: 'template.colony_founding', formula: 'colonies.length * 0.3' },
        { component: 'formula.resource_ratio', formula: '(1 - avgAvailability) * 8' }
      ],
      sinks: [
        { component: 'template.resource_location_discovery', formula: 'geographicFeatures.length * 0.4' },
        { component: 'time', formula: 'value * 18' }
      ],
      affects: [
        // Resource scarcity doesn't directly enable templates, but influences exploration
      ],
      equilibrium: {
        expectedRange: [25, 40],
        restingPoint: 30
      }
    },
    growth: (graph) => {
      // Calculate resource strain as a RATIO, not absolute count
      const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
      const resources = findEntities(graph, { kind: 'location' })
        .filter(loc => loc.tags.includes('resource'));
      const geographicFeatures = findEntities(graph, { kind: 'location', subtype: 'geographic_feature' });

      if (colonies.length === 0) return 0;

      // Calculate average resource ratio across all colonies
      let totalRatio = 0;
      let coloniesEvaluated = 0;

      colonies.forEach(colony => {
        const residents = getRelated(graph, colony.id, 'resident_of', 'dst');
        const nearbyResources = resources.filter(r =>
          graph.relationships.some(rel =>
            rel.kind === 'adjacent_to' &&
            ((rel.src === colony.id && rel.dst === r.id) ||
             (rel.dst === colony.id && rel.src === r.id))
          )
        );

        if (residents.length > 0) {
          const resourceRatio = nearbyResources.length / residents.length;
          totalRatio += Math.min(1, resourceRatio); // Cap at 1 (perfect supply)
          coloniesEvaluated++;
        }
      });

      if (coloniesEvaluated === 0) return 0;

      // Average resource availability (0 = no resources, 1 = perfect supply)
      const avgAvailability = totalRatio / coloniesEvaluated;

      // Scarcity is inverse of availability
      // Map 0-1 availability to 0-8 growth (reduced max)
      const scarcityGrowth = (1 - avgAvailability) * 8;

      // FEEDBACK LOOP: Colony count drives scarcity (positive feedback coefficient 0.3)
      // More colonies = more demand = more scarcity pressure
      const colonyPressure = colonies.length * 0.3;

      // FEEDBACK LOOP: Geographic features reduce scarcity (negative feedback coefficient 0.4)
      // More resource locations = less scarcity
      const resourceRelief = geographicFeatures.length * 0.4;

      return Math.max(0, scarcityGrowth + colonyPressure - resourceRelief);
    }
  },
  
  {
    id: 'conflict',
    name: 'Conflict Tension',
    value: 15,
    decay: 2,  // TUNED: Decreased from 3 to 2 (still at 21 vs target 40)
    contract: {
      purpose: ComponentPurpose.PRESSURE_ACCUMULATION,
      sources: [
        { component: 'template.faction_splinter', formula: 'hostileRatio * 10' },
        { component: 'relationship.enemy_of', formula: 'count' },
        { component: 'relationship.rival_of', formula: 'count' },
        { component: 'relationship.at_war_with', formula: 'count * 2' }
      ],
      sinks: [
        { component: 'template.hero_emergence', formula: 'heroes.length * 0.2' },
        { component: 'time', formula: 'value * 2' }
      ],
      affects: [
        { component: 'template.crisis_legislation', effect: 'enabler', threshold: 40 },
        { component: 'template.faction_splinter', effect: 'amplifier', factor: 1.5 }
      ],
      equilibrium: {
        expectedRange: [30, 50],
        restingPoint: 40
      }
    },
    growth: (graph) => {
      // Measure conflict as RATIO of hostile vs friendly relationships
      const hostileRelations = graph.relationships.filter(r =>
        r.kind === 'enemy_of' || r.kind === 'rival_of' || r.kind === 'at_war_with'
      );

      const friendlyRelations = graph.relationships.filter(r =>
        r.kind === 'allied_with' || r.kind === 'trades_with' || r.kind === 'member_of'
      );

      const totalSocialBonds = hostileRelations.length + friendlyRelations.length;
      if (totalSocialBonds === 0) return 0;

      // Ratio of hostile to total social bonds (0 = all friendly, 1 = all hostile)
      const hostileRatio = hostileRelations.length / totalSocialBonds;

      // Active wars add extra tension
      const factionWars = graph.relationships.filter(r => r.kind === 'at_war_with');
      const warBonus = Math.min(factionWars.length * 2, 5); // Cap war bonus at 5

      // FEEDBACK LOOP: Heroes reduce conflict
      // FIXED: Reduced hero suppression from 0.4 to 0.2 (was too aggressive)
      const heroes = findEntities(graph, { kind: 'npc', subtype: 'hero' });
      const heroSuppression = heroes.length * 0.2;

      // FIXED: Increased growth multiplier from 6 to 10 to reach target faster
      // Map 0-1 ratio to 0-10 growth, plus war bonus, minus hero suppression
      return Math.max(0, hostileRatio * 10 + warBonus - heroSuppression);
    }
  },
  
  {
    id: 'magical_instability',
    name: 'Magical Instability',
    value: 10,
    decay: 8,  // TUNED: Set to 8 as middle ground (was 6→too high, 10→too low)
    contract: {
      purpose: ComponentPurpose.PRESSURE_ACCUMULATION,
      sources: [
        { component: 'template.anomaly_manifestation', formula: 'anomalyDensity * 2.5' },
        { component: 'template.magic_discovery', formula: 'magicAbilities.length * 0.5' },
        { component: 'formula.magic_dominance', formula: 'magicRatio * 5' }
      ],
      sinks: [
        { component: 'template.tech_innovation', formula: 'techAbilities.length * stabilization' },
        { component: 'time', formula: 'value * 8' }
      ],
      affects: [
        { component: 'template.magic_discovery', effect: 'enabler', threshold: 30 },
        { component: 'template.anomaly_manifestation', effect: 'amplifier', factor: 1.3 }
      ],
      equilibrium: {
        expectedRange: [20, 45],
        restingPoint: 30
      }
    },
    growth: (graph) => {
      // Measure magic saturation as RATIO, not absolute count
      const anomalies = findEntities(graph, { kind: 'location', subtype: 'anomaly' });
      const magicAbilities = findEntities(graph, { kind: 'abilities', subtype: 'magic' });
      const techAbilities = findEntities(graph, { kind: 'abilities', subtype: 'technology' });
      const allAbilities = findEntities(graph, { kind: 'abilities' });
      const totalEntities = graph.entities.size;

      if (totalEntities === 0) return 0;

      // Anomaly density (anomalies per 20 entities)
      const anomalyDensity = (anomalies.length / Math.max(1, totalEntities)) * 20;

      // FEEDBACK LOOP: Magic count drives instability (positive feedback coefficient 0.5)
      const magicPressure = magicAbilities.length * 0.5;

      // Magic vs tech ratio (tech stabilizes magic)
      const magicRatio = allAbilities.length > 0
        ? magicAbilities.length / allAbilities.length
        : 0;

      // Combine: anomaly density (0-5) + magic pressure (direct count feedback) + magic dominance (0-5)
      return Math.min(anomalyDensity * 2.5, 5) + Math.min(magicPressure, 10) + magicRatio * 5;
    }
  },
  
  {
    id: 'cultural_tension',
    name: 'Cultural Divergence',
    value: 5,
    decay: 15,  // TUNED: Increased from 10 to 15 (still at 90 vs target 35)
    contract: {
      purpose: ComponentPurpose.PRESSURE_ACCUMULATION,
      sources: [
        { component: 'template.faction_splinter', formula: 'fragmentationRatio * 8' },
        { component: 'template.colony_founding', formula: 'isolationRatio * 4' },
        { component: 'formula.faction_pressure', formula: 'politicalFactions.length * 0.4' }
      ],
      sinks: [
        { component: 'relationship.allied_with', formula: 'alliances.length * 0.3' },
        { component: 'template.ideology_emergence', formula: 'socialRules.length * 0.2' },
        { component: 'time', formula: 'value * 15' }
      ],
      affects: [
        { component: 'template.ideology_emergence', effect: 'enabler', threshold: 50 },
        { component: 'template.faction_splinter', effect: 'amplifier', factor: 1.2 }
      ],
      equilibrium: {
        expectedRange: [30, 50],
        restingPoint: 35
      }
    },
    growth: (graph) => {
      // Measure cultural fragmentation as RATIO
      const allFactions = findEntities(graph, { kind: 'faction' });
      const politicalFactions = findEntities(graph, { kind: 'faction', subtype: 'political' });
      const splinterFactions = graph.relationships.filter(r => r.kind === 'splinter_of');

      if (allFactions.length === 0) return 0;

      // Faction fragmentation ratio (splinters / total factions)
      const fragmentationRatio = splinterFactions.length / Math.max(1, allFactions.length);

      // Isolated colonies add to tension
      const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
      const isolatedColonies = colonies.filter(c =>
        c.tags.includes('isolated') || c.tags.includes('divergent')
      );

      const isolationRatio = colonies.length > 0
        ? isolatedColonies.length / colonies.length
        : 0;

      // FEEDBACK LOOP: Political faction count drives tension (positive feedback coefficient 0.4)
      const factionPressure = politicalFactions.length * 0.4;

      // FEEDBACK LOOP: Alliances reduce tension (negative feedback)
      const alliances = graph.relationships.filter(r => r.kind === 'allied_with');
      const allianceReduction = alliances.length * 0.3;

      // FEEDBACK LOOP: Social rules reduce tension (negative feedback)
      const socialRules = findEntities(graph, { kind: 'rules', subtype: 'social' });
      const ruleReduction = socialRules.length * 0.2;

      // Combine: fragmentation (0-4) + isolation (0-4) + faction pressure - alliance reduction - rule reduction
      // Cap total growth at 8
      return Math.max(0, Math.min(
        fragmentationRatio * 8 + isolationRatio * 4 + factionPressure - allianceReduction - ruleReduction,
        8
      ));
    }
  },
  
  {
    id: 'stability',
    name: 'Political Stability',
    value: 50,
    decay: 3,
    contract: {
      purpose: ComponentPurpose.PRESSURE_ACCUMULATION,
      sources: [
        { component: 'relationship.allied_with', formula: 'cooperationRatio * 7' },
        { component: 'relationship.leader_of', formula: 'leadershipRelations.length * 0.3' },
        { component: 'formula.leadership_ratio', formula: 'leadershipRatio * 3' }
      ],
      sinks: [
        { component: 'template.succession', formula: 'successionPenalty' },
        { component: 'relationship.at_war_with', formula: 'conflicts.length' },
        { component: 'time', formula: 'value * 3' }
      ],
      affects: [
        { component: 'template.ideology_emergence', effect: 'enabler', threshold: 40 }  // Low stability enables reform
      ],
      equilibrium: {
        expectedRange: [40, 60],
        restingPoint: 50
      }
    },
    growth: (graph) => {
      // Measure stability indicators as ratios
      const alliances = graph.relationships.filter(r => r.kind === 'allied_with');
      const conflicts = graph.relationships.filter(r =>
        r.kind === 'enemy_of' || r.kind === 'rival_of' || r.kind === 'at_war_with'
      );

      const socialRelations = alliances.length + conflicts.length;
      const cooperationRatio = socialRelations > 0
        ? alliances.length / socialRelations
        : 0.5; // Neutral if no relationships

      // Active governance
      const allLeaders = findEntities(graph, { kind: 'npc', subtype: 'mayor' });
      const aliveLeaders = allLeaders.filter(n => n.status === 'alive');
      const leadershipRatio = allLeaders.length > 0
        ? aliveLeaders.length / allLeaders.length
        : 1; // No leaders = stable (not tracked yet)

      // FEEDBACK LOOP: Leader count increases stability (positive feedback coefficient 0.3)
      const leadershipRelations = graph.relationships.filter(r => r.kind === 'leader_of');
      const leadershipBonus = leadershipRelations.length * 0.3;

      // FEEDBACK LOOP: Mayor count (succession events) can reduce stability over time
      // (Leadership changes create vacuum, but we measure current state not change rate)
      const successionPenalty = allLeaders.length > 0 && aliveLeaders.length < allLeaders.length
        ? (allLeaders.length - aliveLeaders.length) * 0.2
        : 0;

      // Map to growth: cooperation (0-7) + leadership ratio (0-3) + leadership bonus - succession penalty
      return Math.max(0, cooperationRatio * 7 + leadershipRatio * 3 + leadershipBonus - successionPenalty);
    }
  },
  
  {
    id: 'external_threat',
    name: 'External Danger',
    value: 0,
    decay: 6,  // TUNED: Increased from 4 to 6 (still at 30 vs target 15)
    contract: {
      purpose: ComponentPurpose.PRESSURE_ACCUMULATION,
      sources: [
        { component: 'template.orca_raider_arrival', formula: 'orcas.length * 0.8' },
        { component: 'tag.external', formula: 'externalTags.length * 10' },
        { component: 'tag.invader', formula: 'count * 10' }
      ],
      sinks: [
        { component: 'time', formula: 'value * 6' }
        // TODO: Add defensive systems/templates that reduce external threat
      ],
      affects: [
        { component: 'template.orca_combat_technique', effect: 'enabler', threshold: 20 },
        { component: 'template.hero_emergence', effect: 'amplifier', factor: 1.5 }
      ],
      equilibrium: {
        expectedRange: [10, 25],
        restingPoint: 15
      }
    },
    growth: (graph) => {
      // Increases during invasion era or when entities marked as external appear
      const externalTags = Array.from(graph.entities.values())
        .filter(e => e.tags.includes('external') || e.tags.includes('invader'));

      // FEEDBACK LOOP: Orca count drives external threat (positive feedback coefficient 0.8)
      const orcas = findEntities(graph, { kind: 'npc', subtype: 'orca' });
      const orcaPressure = orcas.length * 0.8;

      return externalTags.length * 10 + orcaPressure;
    }
  }
];
