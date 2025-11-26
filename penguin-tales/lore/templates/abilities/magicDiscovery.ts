import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core/types/engine';
import { TemplateGraphView } from '@lore-weave/core/services/templateGraphView';
import { HardState, Relationship } from '@lore-weave/core/types/worldTypes';
import { pickRandom } from '@lore-weave/core/utils/helpers';

/**
 * Magic Discovery Template
 *
 * Heroes discover magical abilities near anomalies.
 * Creates magic abilities linked to the discoverer and manifestation location.
 */
export const magicDiscovery: GrowthTemplate = {
  id: 'magic_discovery',
  name: 'Magical Discovery',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      entityCounts: [
        { kind: 'location', min: 1 },  // Need anomalies for manifestation
        { kind: 'npc', min: 1 }        // Need heroes to discover
      ],
      pressures: [
        { name: 'magical_instability', threshold: 10 }  // FIXED: Lowered from 15 to 10
      ]
    },
    affects: {
      entities: [
        { kind: 'abilities', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'discoverer_of', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'manifests_at', operation: 'create', count: { min: 0, max: 1 } },  // FIXED: 0-1 (anomaly may not exist at high instability)
        { kind: 'related_to', operation: 'create', count: { min: 0, max: 1 } }  // Lineage
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'abilities',
          subtype: 'magic',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'recognized', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'discoverer_of', category: 'immutable_fact', probability: 1.0, comment: 'Hero discovers magic' },
        { kind: 'manifests_at', category: 'immutable_fact', probability: 1.0, comment: 'Magic manifests at anomaly' },
        { kind: 'related_to', category: 'immutable_fact', probability: 0.7, comment: 'Related to existing magic' },
      ],
    },
    effects: {
      graphDensity: 0.3,
      clusterFormation: 0.4,
      diversityImpact: 0.9,
      comment: 'Creates mystical abilities linked to anomalies and heroes',
    },
    tags: ['mystical', 'ability-creation'],
  },

  canApply: (graphView: TemplateGraphView) => {
    // Prerequisite: anomalies must exist (but loosen this - let magic be discovered elsewhere)
    const anomalies = graphView.findEntities({ kind: 'location', subtype: 'anomaly' });
    // FIXED: Allow discovery even without anomalies if instability is high enough

    // Enabled at moderate magical instability (10+)
    // FIXED: Lowered threshold from 15 to 10
    const magicalInstability = graphView.getPressure('magical_instability') || 0;
    if (magicalInstability < 10) {
      return false; // Need at least 10 instability to discover magic
    }

    // FIXED: Removed anomaly requirement when instability is very high (desperate measures)
    if (anomalies.length === 0 && magicalInstability < 30) {
      return false; // Need anomalies for low-instability discovery
    }

    // BIDIRECTIONAL PRESSURE THRESHOLD: High magical instability suppresses magic discovery
    // (Too much magical energy makes new discoveries dangerous/unstable)
    if (magicalInstability > 70) {
      return Math.random() < 0.4; // Only 40% chance when instability is very high
    }

    // SATURATION LIMIT: Check if magic count is at or above threshold
    const existingMagic = graphView.findEntities({ kind: 'abilities', subtype: 'magic' });
    const targets = graphView.config.distributionTargets as any;
    const target = targets?.entities?.abilities?.magic?.target || 15;
    const saturationThreshold = target * 1.5; // Allow 50% overshoot

    if (existingMagic.length >= saturationThreshold) {
      return false; // Too much magic, suppress creation
    }

    return true;
  },

  findTargets: (graphView: TemplateGraphView) => {
    const maxDiscoveriesPerHero = 2; // Reduced from 3 to 2 discoveries per hero
    const heroes = graphView.findEntities({ kind: 'npc', subtype: 'hero' });

    // Filter out heroes who have already discovered too many abilities
    return heroes.filter(hero => {
      const discoveryCount = graphView.getAllRelationships().filter(r =>
        r.kind === 'discoverer_of' && r.src === hero.id
      ).length;
      return discoveryCount < maxDiscoveriesPerHero;
    });
  },
  
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const hero = target || pickRandom(graphView.findEntities({ kind: 'npc', subtype: 'hero' }));
    const anomaly = pickRandom(graphView.findEntities({ kind: 'location', subtype: 'anomaly' }));

    if (!hero) {
      return {
        entities: [],
        relationships: [],
        description: 'Cannot discover magic - no heroes exist'
      };
    }

    // Find existing magic to establish lineage
    const existingMagic = graphView.findEntities({ kind: 'abilities', subtype: 'magic' })
      .filter(m => m.status !== 'lost');

    // Find magic at same anomaly or any magic
    let relatedMagic: HardState | undefined;
    if (existingMagic.length > 0) {
      // Prefer magic from same anomaly
      const sameLocationMagic = existingMagic.filter(magic =>
        graphView.getAllRelationships().some(r =>
          r.kind === 'manifests_at' && r.src === magic.id && r.dst === anomaly.id
        )
      );

      if (sameLocationMagic.length > 0) {
        relatedMagic = pickRandom(sameLocationMagic);
      } else {
        // Otherwise, link to any existing magic (distinct traditions)
        relatedMagic = pickRandom(existingMagic);
      }
    }

    const magicName = `${pickRandom(['Frost', 'Ice', 'Glow'])} ${pickRandom(['Ward', 'Sight', 'Bond'])}`;
    const relationships: Relationship[] = [
      { kind: 'discoverer_of', src: hero.id, dst: 'will-be-assigned-0' }
    ];

    // Only add manifests_at if anomaly exists
    if (anomaly) {
      relationships.push({ kind: 'manifests_at', src: 'will-be-assigned-0', dst: anomaly.id });
    }

    // Add lineage relationship with higher distance (0.5-0.9) - magic is diverse
    if (relatedMagic) {
      relationships.push({
        kind: 'related_to',
        src: 'will-be-assigned-0',
        dst: relatedMagic.id,
        distance: 0.5 + Math.random() * 0.4,  // Distinct magical tradition
        strength: 0.5
      });
    }

    const lineageDesc = relatedMagic ? ` related to ${relatedMagic.name}` : '';
    const locationDesc = anomaly ? ` at ${anomaly.name}` : ' through mystical insight';

    const magicAbility: Partial<HardState> = {
      kind: 'abilities',
      subtype: 'magic',
      name: magicName,
      description: `Mystical ability discovered by ${hero.name}${lineageDesc}`,
      status: 'emergent',
      prominence: 'recognized',
      culture: hero.culture || anomaly?.culture || 'world',  // Inherit from discoverer or manifestation location
      tags: ['magic', 'mystical']
    };

    return {
      entities: [magicAbility],
      relationships,
      description: `${hero.name} discovers ${magicName}${locationDesc}${lineageDesc}`
    };
  }
};
