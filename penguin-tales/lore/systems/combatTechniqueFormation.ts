/**
 * Combat Technique Formation System
 *
 * Clusters combat abilities into unified fighting styles.
 * Similar to magic schools but for physical/combat abilities.
 */

import { SimulationSystem, SystemResult, Graph, ComponentPurpose } from '@lore-weave/core/types/engine';
import { HardState, Relationship } from '@lore-weave/core/types/worldTypes';
import {
  pickRandom,
  addEntity
} from '@lore-weave/core/utils/helpers';
import {
  detectClusters,
  filterClusterableEntities,
  ClusterConfig
} from '@lore-weave/core/utils/clusteringUtils';
import {
  archiveEntities,
  transferRelationships,
  createPartOfRelationships
} from '@lore-weave/core/utils/entityArchival';
import { TemplateGraphView } from '@lore-weave/core/services/templateGraphView';
import { TargetSelector } from '@lore-weave/core/services/targetSelector';
import { FRAMEWORK_RELATIONSHIP_KINDS } from '@lore-weave/core/types/frameworkPrimitives';

/**
 * Clustering configuration for combat techniques
 */
const COMBAT_TECHNIQUE_CLUSTER_CONFIG: ClusterConfig = {
  minSize: 3,
  maxSize: 8,
  criteria: [
    {
      type: 'shared_relationship',
      weight: 5.0,
      relationshipKind: 'practitioner_of',
      direction: 'dst'
    },
    {
      type: 'shared_tags',
      weight: 2.0,
      threshold: 0.3
    },
    {
      type: 'temporal_proximity',
      weight: 1.5,
      threshold: 50
    }
  ],
  minimumScore: 5.0
};

/**
 * Generate a combat style name based on subtype
 */
function generateStyleName(majoritySubtype: string, clusterSize: number): string {
  const nameFragments: Record<string, string[]> = {
    combat: ['Deadly', 'Swift', 'Brutal', 'Precise', 'Devastating'],
    physical: ['Athletic', 'Graceful', 'Powerful', 'Agile', 'Coordinated']
  };

  const descriptor = pickRandom(
    nameFragments[majoritySubtype] || nameFragments.combat
  );
  return `${descriptor} Style of ${clusterSize} Techniques`;
}

/**
 * Create a combat style entity from a cluster
 */
function createStyleEntity(cluster: HardState[], graph: Graph): Partial<HardState> {
  // Filter to only combat-type abilities
  const combatAbilities = cluster.filter(a =>
    a.subtype === 'combat' || a.subtype === 'physical'
  );

  // If no combat abilities, fallback to all
  const effectiveCluster = combatAbilities.length > 0 ? combatAbilities : cluster;

  // Determine style subtype from cluster majority
  const subtypeCounts = new Map<string, number>();
  effectiveCluster.forEach(ability => {
    const subtype = ability.subtype;
    subtypeCounts.set(subtype, (subtypeCounts.get(subtype) || 0) + 1);
  });

  let majoritySubtype = 'combat';
  let maxCount = 0;
  subtypeCounts.forEach((count, subtype) => {
    if (count > maxCount) {
      maxCount = count;
      majoritySubtype = subtype;
    }
  });

  // Generate style name
  const styleName = generateStyleName(majoritySubtype, effectiveCluster.length);

  // Aggregate tags from cluster
  const allTags = new Set<string>();
  effectiveCluster.forEach(ability => {
    (ability.tags || []).forEach(tag => allTags.add(tag));
  });
  const tags = Array.from(allTags).slice(0, 4);

  // Build description
  const techniqueNames = effectiveCluster.map(a => a.name).join(', ');
  const description = `A unified combat tradition encompassing ${techniqueNames}. Mastered by warriors who practice ${effectiveCluster.length} techniques in harmony.`;

  // Determine prominence
  let prominence: HardState['prominence'] = 'recognized';
  if (effectiveCluster.length >= 6) {
    prominence = 'renowned';
  } else if (effectiveCluster.length >= 4) {
    prominence = 'recognized';
  } else {
    prominence = 'marginal';
  }

  // Determine dominant culture from cluster
  const cultureCounts = new Map<string, number>();
  effectiveCluster.forEach(ability => {
    const culture = ability.culture || 'world';
    cultureCounts.set(culture, (cultureCounts.get(culture) || 0) + 1);
  });
  let majorityCulture = 'world';
  let maxCultureCount = 0;
  cultureCounts.forEach((count, culture) => {
    if (count > maxCultureCount) {
      maxCultureCount = count;
      majorityCulture = culture;
    }
  });

  return {
    kind: 'abilities',
    subtype: majoritySubtype,
    name: styleName,
    description,
    status: 'active',
    prominence,
    culture: majorityCulture,
    tags: [...tags, 'meta-entity', 'combat-style']
  };
}

export const combatTechniqueFormation: SimulationSystem = {
  id: 'combat_technique_formation',
  name: 'Combat Technique Formation',

  contract: {
    purpose: ComponentPurpose.STATE_MODIFICATION,
    enabledBy: {
      entityCounts: [
        { kind: 'abilities', min: 6 }
      ]
    },
    affects: {
      entities: [
        { kind: 'abilities', operation: 'create', count: { min: 0, max: 5 } },
        { kind: 'abilities', operation: 'modify', count: { min: 0, max: 20 } }
      ],
      relationships: [
        { kind: FRAMEWORK_RELATIONSHIP_KINDS.PART_OF, operation: 'create', count: { min: 0, max: 20 } }
      ]
    }
  },

  metadata: {
    produces: {
      relationships: [
        { kind: FRAMEWORK_RELATIONSHIP_KINDS.PART_OF, category: 'structural', frequency: 'rare', comment: 'Links techniques to their style' }
      ],
      modifications: []
    },
    effects: {
      graphDensity: 0.2,
      clusterFormation: 0.8,
      diversityImpact: -0.3,
      comment: 'Consolidates combat abilities into fighting styles'
    },
    parameters: {
      minClusterSize: {
        value: 3,
        min: 2,
        max: 5,
        description: 'Minimum techniques to form a style'
      },
      minimumScore: {
        value: 5.0,
        min: 2.0,
        max: 10.0,
        description: 'Minimum similarity score for clustering'
      }
    },
    triggers: {
      graphConditions: ['Epoch end', 'Sufficient combat abilities'],
      comment: 'Runs at epoch end when enough combat abilities exist'
    }
  },

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    // Only run at epoch end
    const epochLength = graph.config.epochLength || 20;
    if (graph.tick % epochLength !== 0) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'Not epoch end, skipping combat technique formation'
      };
    }

    // Create graph view for clustering
    const targetSelector = new TargetSelector();
    const graphView = new TemplateGraphView(graph, targetSelector);

    // Find combat abilities eligible for clustering
    const allAbilities = graphView.findEntities({ kind: 'abilities' });
    const combatAbilities = filterClusterableEntities(allAbilities)
      .filter(a => a.subtype === 'combat' || a.subtype === 'physical');

    if (combatAbilities.length < COMBAT_TECHNIQUE_CLUSTER_CONFIG.minSize) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'Not enough combat abilities for technique formation'
      };
    }

    // Detect clusters
    const clusters = detectClusters(combatAbilities, COMBAT_TECHNIQUE_CLUSTER_CONFIG, graphView);

    const relationshipsAdded: Relationship[] = [];
    const entitiesModified: Array<{ id: string; changes: Partial<HardState> }> = [];
    const entitiesCreated: string[] = [];

    // Form meta-entities from valid clusters
    for (const cluster of clusters) {
      if (cluster.score < COMBAT_TECHNIQUE_CLUSTER_CONFIG.minimumScore) continue;

      // Create the style entity
      const stylePartial = createStyleEntity(cluster.entities, graph);
      const styleId = addEntity(graph, stylePartial);
      entitiesCreated.push(styleId);

      // Get cluster entity IDs
      const clusterIds = cluster.entities.map(e => e.id);

      // Transfer relationships from cluster to style
      transferRelationships(
        graph,
        clusterIds,
        styleId,
        {
          excludeKinds: [FRAMEWORK_RELATIONSHIP_KINDS.PART_OF],
          archiveOriginals: true
        }
      );

      // Create part_of relationships
      createPartOfRelationships(graph, clusterIds, styleId);
      clusterIds.forEach(id => {
        relationshipsAdded.push({
          kind: FRAMEWORK_RELATIONSHIP_KINDS.PART_OF,
          src: id,
          dst: styleId
        });
      });

      // Archive original abilities
      archiveEntities(
        graph,
        clusterIds,
        {
          archiveRelationships: false,
          excludeRelationshipKinds: [FRAMEWORK_RELATIONSHIP_KINDS.PART_OF]
        }
      );

      // Track modifications
      clusterIds.forEach(id => {
        entitiesModified.push({
          id,
          changes: { status: 'historical' }
        });
      });
    }

    // Record in history
    if (entitiesCreated.length > 0) {
      graph.history.push({
        tick: graph.tick,
        era: graph.currentEra.id,
        type: 'special',
        description: `${entitiesCreated.length} combat styles formed from ${entitiesModified.length} techniques`,
        entitiesCreated,
        relationshipsCreated: relationshipsAdded,
        entitiesModified: entitiesModified.map(e => e.id)
      });
    }

    return {
      relationshipsAdded,
      entitiesModified,
      pressureChanges: entitiesCreated.length > 0 ? { 'stability': 2 } : {},
      description: `${entitiesCreated.length} combat styles formed`
    };
  }
};
