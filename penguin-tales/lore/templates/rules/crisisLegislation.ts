import { GrowthTemplate, TemplateResult, ComponentPurpose } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { HardState, Relationship } from '@lore-weave/core';
import { pickRandom, slugifyName } from '@lore-weave/core';

/**
 * Crisis Legislation Template
 *
 * Emergency laws enacted during times of conflict or resource scarcity.
 * Creates edicts, taboos, or social rules in response to crises.
 */
export const crisisLegislation: GrowthTemplate = {
  id: 'crisis_legislation',
  name: 'Crisis Law',

  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      pressures: [
        { name: 'conflict', threshold: 10 },  // FIXED: Lowered from 20 to 10
        { name: 'resource_scarcity', threshold: 10 }  // FIXED: Lowered from 20 to 10
      ]
    },
    affects: {
      entities: [
        { kind: 'rules', operation: 'create', count: { min: 1, max: 1 } }
      ],
      relationships: [
        { kind: 'applies_in', operation: 'create', count: { min: 1, max: 1 } },
        { kind: 'supersedes', operation: 'create', count: { min: 0, max: 1 } },
        { kind: 'related_to', operation: 'create', count: { min: 0, max: 1 } }
      ],
      pressures: [
        { name: 'cultural_tension', delta: 2 }  // New laws create tension
      ]
    }
  },

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'rules',
          subtype: 'various',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'recognized', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'applies_in', category: 'immutable_fact', probability: 1.0, comment: 'Law applies in colony' },
        { kind: 'supersedes', category: 'immutable_fact', probability: 0.4, comment: 'Supersedes existing law' },
        { kind: 'related_to', category: 'immutable_fact', probability: 0.6, comment: 'Related to existing rule' },
      ],
    },
    effects: {
      graphDensity: 0.2,
      clusterFormation: 0.3,
      diversityImpact: 0.5,
      comment: 'Creates emergency laws in response to crises',
    },
    tags: ['crisis-driven', 'legislation'],
  },

  canApply: (graphView: TemplateGraphView) => {
    const conflict = graphView.getPressure('conflict') || 0;
    const scarcity = graphView.getPressure('resource_scarcity') || 0;
    return conflict > 10 || scarcity > 10;  // FIXED: Lowered from 20 to 10
  },
  
  findTargets: (graphView: TemplateGraphView) => graphView.findEntities({ kind: 'location', subtype: 'colony' }),
  
  expand: (graphView: TemplateGraphView, target?: HardState): TemplateResult => {
    const colony = target || pickRandom(graphView.findEntities({ kind: 'location', subtype: 'colony' }));

    if (!colony) {
      return {
        entities: [],
        relationships: [],
        description: 'Cannot enact crisis legislation - no colonies exist'
      };
    }

    const ruleType = pickRandom(['edict', 'taboo', 'social']);

    // Find existing rules in same location to establish lineage
    const existingRules = graphView.findEntities({ kind: 'rules' })
      .filter(r => r.status !== 'repealed')
      .filter(rule =>
        graphView.getAllRelationships().some(rel =>
          rel.kind === 'applies_in' && rel.src === rule.id && rel.dst === colony.id
        )
      );

    // Find most related rule (same subtype preferred)
    let relatedRule: HardState | undefined;
    let isSuperseding = false;

    if (existingRules.length > 0) {
      // Prefer same subtype
      const sameSubtype = existingRules.filter(r => r.subtype === ruleType);

      if (sameSubtype.length > 0 && Math.random() < 0.4) {
        // 40% chance to supersede existing rule of same type
        relatedRule = pickRandom(sameSubtype);
        isSuperseding = true;
      } else if (existingRules.length > 0) {
        // Otherwise, create related rule
        relatedRule = pickRandom(existingRules);
        isSuperseding = false;
      }
    }

    // Derive coordinates in conceptual space - rules exist near the colony they apply to
    const referenceEntities: HardState[] = [colony];
    if (relatedRule) {
      referenceEntities.push(relatedRule);
    }

    const cultureId = colony.culture ?? 'default';
    const rulePlacement = graphView.deriveCoordinatesWithCulture(
      cultureId,
      'rules',
      referenceEntities
    );

    if (!rulePlacement) {
      throw new Error(
        `crisis_legislation: Failed to derive coordinates for rule in ${colony.name}. ` +
        `This indicates the coordinate system is not properly configured for 'rules' entities.`
      );
    }

    const conceptualCoords = rulePlacement.coordinates;

    const relationships: Relationship[] = [
      { kind: 'applies_in', src: 'will-be-assigned-0', dst: colony.id }
    ];

    // Add lineage relationship
    if (relatedRule) {
      if (isSuperseding) {
        // Supersedes: close distance (0.1-0.2) - amendment/replacement
        relationships.push({
          kind: 'supersedes',
          src: 'will-be-assigned-0',
          dst: relatedRule.id,
          distance: 0.1 + Math.random() * 0.1,
          strength: 0.7
        });
      } else {
        // Related: moderate distance (0.3-0.5) - new but related law
        relationships.push({
          kind: 'related_to',
          src: 'will-be-assigned-0',
          dst: relatedRule.id,
          distance: 0.3 + Math.random() * 0.2,
          strength: 0.5
        });
      }
    }

    const lineageDesc = relatedRule
      ? (isSuperseding ? ` (superseding ${relatedRule.name})` : ` (related to ${relatedRule.name})`)
      : '';

    return {
      entities: [{
        kind: 'rules',
        subtype: ruleType,
        description: `Emergency measure enacted in ${colony.name}${lineageDesc}`,
        status: 'enacted',
        prominence: 'recognized',
        culture: colony.culture,  // Inherit culture from enacting colony
        tags: { crisis: true, emergency: true },
        coordinates: conceptualCoords
      }],
      relationships,
      description: `New ${ruleType} enacted in ${colony.name}${lineageDesc}`
    };
  }
};
