import { Pressure } from '../types/engine';
import { findEntities, getRelated } from '../utils/helpers';

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

      return scarcityGrowth;
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
        r.kind === 'ally_of' || r.kind === 'allied_with' || r.kind === 'friend_of'
      );

      const totalSocialBonds = hostileRelations.length + friendlyRelations.length;
      if (totalSocialBonds === 0) return 0;

      // Ratio of hostile to total social bonds (0 = all friendly, 1 = all hostile)
      const hostileRatio = hostileRelations.length / totalSocialBonds;

      // Active wars add extra tension
      const factionWars = graph.relationships.filter(r => r.kind === 'at_war_with');
      const warBonus = Math.min(factionWars.length * 2, 5); // Cap war bonus at 5

      // Map 0-1 ratio to 0-6 growth, plus war bonus
      return hostileRatio * 6 + warBonus;
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
      const allAbilities = findEntities(graph, { kind: 'abilities' });
      const totalEntities = graph.entities.size;

      if (totalEntities === 0) return 0;

      // Anomaly density (anomalies per 20 entities)
      const anomalyDensity = (anomalies.length / Math.max(1, totalEntities)) * 20;

      // Magic vs tech ratio
      const magicRatio = allAbilities.length > 0
        ? magicAbilities.length / allAbilities.length
        : 0;

      // Combine: anomaly density (0-5) + magic dominance (0-5)
      return Math.min(anomalyDensity * 2.5, 5) + magicRatio * 5;
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

      // Combine: fragmentation (0-4) + isolation (0-4)
      // Cap total growth at 8
      return Math.min(fragmentationRatio * 8 + isolationRatio * 4, 8);
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

      // Map to growth: cooperation (0-7) + leadership (0-3)
      return cooperationRatio * 7 + leadershipRatio * 3;
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

      return externalTags.length * 10;
    }
  }
];
