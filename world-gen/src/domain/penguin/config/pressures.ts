import { Pressure } from '../../../types/engine';
import { findEntities, getRelated } from '../../../utils/helpers';

export const pressures: Pressure[] = [
  {
    id: 'resource_scarcity',
    name: 'Resource Scarcity',
    value: 20,
    decay: 6,
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
    decay: 5,
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
      // Each hero reduces conflict growth by 0.4% (negative feedback)
      const heroes = findEntities(graph, { kind: 'npc', subtype: 'hero' });
      const heroSuppression = heroes.length * 0.4;

      // Map 0-1 ratio to 0-6 growth, plus war bonus, minus hero suppression
      return Math.max(0, hostileRatio * 6 + warBonus - heroSuppression);
    }
  },
  
  {
    id: 'magical_instability',
    name: 'Magical Instability',
    value: 10,
    decay: 3,
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
    decay: 5,
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
    decay: 2,
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
