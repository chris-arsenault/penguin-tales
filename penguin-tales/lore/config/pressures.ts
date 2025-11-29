import { Pressure, ComponentPurpose } from '@lore-weave/core';
import { findEntities, hasTag } from '@lore-weave/core';

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
      const geographicFeatures = findEntities(graph, { kind: 'location', subtype: 'geographic_feature' });
      const allNPCs = findEntities(graph, { kind: 'npc' });

      if (colonies.length === 0) return 0;

      // SIMPLIFIED APPROACH: Use ratio of total population to geographic features
      // This ensures scarcity actually accumulates even if tags aren't perfect
      const populationPressure = allNPCs.length / Math.max(1, colonies.length);  // NPCs per colony
      const resourceAvailability = geographicFeatures.length / Math.max(1, colonies.length);  // Resources per colony

      // Scarcity increases with population density, decreases with resource availability
      const scarcityRatio = populationPressure / Math.max(0.5, resourceAvailability);  // Prevent div by 0

      // Map ratio to growth: 0-10 range
      // If scarcityRatio = 1 (balanced), growth = 5
      // If scarcityRatio = 2 (2x pop vs resources), growth = 10
      // If scarcityRatio = 0.5 (plenty of resources), growth = 2.5
      const scarcityGrowth = Math.min(scarcityRatio * 5, 10);

      // FEEDBACK LOOP: Colony count drives scarcity (positive feedback coefficient 0.5)
      // More colonies = more demand = more scarcity pressure
      const colonyPressure = colonies.length * 0.5;

      // FEEDBACK LOOP: Geographic features reduce scarcity (negative feedback coefficient 0.6)
      // More resource locations = less scarcity
      const resourceRelief = geographicFeatures.length * 0.6;

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
      const hostileRelations = graph.getRelationships().filter(r =>
        r.kind === 'enemy_of' || r.kind === 'rival_of' || r.kind === 'at_war_with'
      );

      const friendlyRelations = graph.getRelationships().filter(r =>
        r.kind === 'allied_with' || r.kind === 'trades_with' || r.kind === 'member_of'
      );

      const totalSocialBonds = hostileRelations.length + friendlyRelations.length;
      if (totalSocialBonds === 0) return 0;

      // Ratio of hostile to total social bonds (0 = all friendly, 1 = all hostile)
      const hostileRatio = hostileRelations.length / totalSocialBonds;

      // Active wars add extra tension
      const factionWars = graph.getRelationships().filter(r => r.kind === 'at_war_with');
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
    value: 30,  // FIXED: Increased from 10 to 30 to overcome decay
    decay: 6,   // FIXED: Increased from 3 to 6 to bring down overcorrection (was 84.7, target 25)
    contract: {
      purpose: ComponentPurpose.PRESSURE_ACCUMULATION,
      sources: [
        { component: 'template.anomaly_manifestation', formula: 'anomalyDensity * 2.5' },
        { component: 'template.magic_discovery', formula: 'magicAbilities.length * 0.8' },
        { component: 'template.cult_formation', formula: 'cults.length * 0.3' },
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
      const totalEntities = graph.getEntityCount();

      if (totalEntities === 0) return 0;

      // FIXED: Base growth starts at 2.0 to ensure it's never 0
      let baseGrowth = 2.0;

      // Anomaly density (anomalies per 20 entities)
      const anomalyDensity = (anomalies.length / Math.max(1, totalEntities)) * 20;

      // FEEDBACK LOOP: Magic count drives instability (positive feedback coefficient 0.8, increased from 0.5)
      const magicPressure = magicAbilities.length * 0.8;

      // FEEDBACK LOOP: Cults increase instability (positive feedback coefficient 0.3)
      const cults = findEntities(graph, { kind: 'faction', subtype: 'cult' });
      const cultPressure = cults.length * 0.3;

      // Magic vs tech ratio (tech stabilizes magic)
      const magicRatio = allAbilities.length > 0
        ? magicAbilities.length / allAbilities.length
        : 0;

      // FEEDBACK LOOP: Tech reduces instability
      const techStabilization = techAbilities.length * 0.3;

      // Combine: base + anomaly density (0-5) + magic pressure (direct count feedback) + cult pressure + magic dominance (0-5) - tech stabilization
      return Math.max(0, baseGrowth + Math.min(anomalyDensity * 2.5, 5) + Math.min(magicPressure, 10) + cultPressure + magicRatio * 5 - techStabilization);
    }
  },
  
  {
    id: 'cultural_tension',
    name: 'Cultural Divergence',
    value: 5,
    decay: 15,
    contract: {
      purpose: ComponentPurpose.PRESSURE_ACCUMULATION,
      sources: [
        { component: 'formula.cross_culture_ratio', formula: 'crossCultureRatio * 10' },
        { component: 'formula.location_diversity', formula: 'locationDiversity * 4' },
        { component: 'formula.faction_diversity', formula: 'factionDiversity * 3' },
        { component: 'template.faction_splinter', formula: 'fragmentationRatio * 5' }
      ],
      sinks: [
        { component: 'formula.same_culture_alliances', formula: 'sameCultureAlliances * 0.5' },
        { component: 'formula.cultural_homogeneity', formula: 'homogeneousLocations * 0.3' },
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
      // CULTURE-FIRST: Measure actual cultural state, not just political fragmentation

      // 1. Cross-culture relationship ratio
      const socialRelationships = graph.getRelationships().filter(r =>
        ['follower_of', 'rival_of', 'lover_of', 'enemy_of', 'allied_with'].includes(r.kind)
      );

      let crossCultureCount = 0;
      for (const rel of socialRelationships) {
        const src = graph.getEntity(rel.src);
        const dst = graph.getEntity(rel.dst);
        if (src && dst && src.culture !== dst.culture) {
          crossCultureCount++;
        }
      }
      const crossCultureRatio = socialRelationships.length > 0
        ? crossCultureCount / socialRelationships.length
        : 0;

      // 2. Location cultural diversity (entities of different cultures in same location)
      const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
      let totalLocationDiversity = 0;
      let homogeneousLocations = 0;

      for (const colony of colonies) {
        const residents = graph.getRelationships()
          .filter(r => r.kind === 'resident_of' && r.dst === colony.id);
        const residentCultures = new Set<string>();
        for (const rel of residents) {
          const resident = graph.getEntity(rel.src);
          if (resident) residentCultures.add(resident.culture);
        }
        if (residentCultures.size > 1) {
          totalLocationDiversity += residentCultures.size - 1;
        } else if (residentCultures.size === 1) {
          homogeneousLocations++;
        }
      }

      // 3. Faction cultural diversity (members of different cultures in same faction)
      const factions = findEntities(graph, { kind: 'faction' });
      let totalFactionDiversity = 0;

      for (const faction of factions) {
        const members = graph.getRelationships()
          .filter(r => r.kind === 'member_of' && r.dst === faction.id);
        const memberCultures = new Set<string>();
        for (const rel of members) {
          const member = graph.getEntity(rel.src);
          if (member) memberCultures.add(member.culture);
        }
        if (memberCultures.size > 1) {
          totalFactionDiversity += memberCultures.size - 1;
        }
      }

      // 4. Same-culture alliances reduce tension
      const alliances = graph.getRelationships().filter(r => r.kind === 'allied_with');
      let sameCultureAlliances = 0;
      for (const rel of alliances) {
        const src = graph.getEntity(rel.src);
        const dst = graph.getEntity(rel.dst);
        if (src && dst && src.culture === dst.culture) {
          sameCultureAlliances++;
        }
      }

      // 5. Traditional factors (splinters, isolation)
      const splinterFactions = graph.getRelationships().filter(r => r.kind === 'splinter_of');
      const fragmentationRatio = factions.length > 0
        ? splinterFactions.length / factions.length
        : 0;

      // Combine cultural metrics:
      // - Cross-culture relationships increase tension
      // - Location diversity increases tension
      // - Faction diversity increases tension
      // - Same-culture alliances reduce tension
      // - Homogeneous locations reduce tension
      // - Splinters add moderate tension
      const growth = (
        crossCultureRatio * 10 +           // 0-10: Cross-culture relationship pressure
        totalLocationDiversity * 0.5 +      // Location cultural mixing
        totalFactionDiversity * 0.3 +       // Faction cultural mixing
        fragmentationRatio * 5 -            // Political fragmentation
        sameCultureAlliances * 0.5 -        // Same-culture cooperation
        homogeneousLocations * 0.3          // Cultural homogeneity stabilizes
      );

      return Math.max(0, Math.min(growth, 10));
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
      const alliances = graph.getRelationships().filter(r => r.kind === 'allied_with');
      const conflicts = graph.getRelationships().filter(r =>
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
      const leadershipRelations = graph.getRelationships().filter(r => r.kind === 'leader_of');
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
      const externalTags = graph.getEntities()
        .filter(e => hasTag(e.tags, 'external') || hasTag(e.tags, 'invader'));

      // FEEDBACK LOOP: Orca count drives external threat (positive feedback coefficient 0.8)
      const orcas = findEntities(graph, { kind: 'npc', subtype: 'orca' });
      const orcaPressure = orcas.length * 0.8;

      return externalTags.length * 10 + orcaPressure;
    }
  }
];
