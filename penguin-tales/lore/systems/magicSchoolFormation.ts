/**
 * Magic School Formation System
 *
 * Clusters magic abilities into unified schools to create narrative density.
 * Runs at epoch end to consolidate related abilities.
 *
 * Example: 10 NPCs × 5 spells = thin history
 *         10 NPCs × 1 school = rich history
 */

import { SimulationSystem, SystemResult, Graph, ComponentPurpose } from '@lore-weave/core/types/engine';
import { HardState, Relationship } from '@lore-weave/core/types/worldTypes';
import {
  pickRandom,
  addEntity,
  generateId,
  hasTag
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
 * Clustering configuration for magic schools
 */
const MAGIC_SCHOOL_CLUSTER_CONFIG: ClusterConfig = {
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
 * Generate a school name based on subtype
 */
function generateSchoolName(majoritySubtype: string, clusterSize: number): string {
  const nameFragments: Record<string, string[]> = {
    magic: ['Arcane', 'Mystical', 'Ethereal', 'Elemental', 'Cosmic'],
    faith: ['Sacred', 'Divine', 'Holy', 'Blessed', 'Hallowed'],
    technology: ['Innovative', 'Advanced', 'Mechanical', 'Industrial', 'Technical'],
    physical: ['Martial', 'Athletic', 'Physical', 'Kinetic', 'Bodily'],
    combat: ['Warrior', 'Battle', 'Combat', 'Tactical', 'Strategic']
  };

  const descriptor = pickRandom(
    nameFragments[majoritySubtype] || nameFragments.magic
  );
  return `${descriptor} School of ${clusterSize} Arts`;
}

/**
 * Create a meta-entity ability from a cluster
 */
function createSchoolEntity(cluster: HardState[], graph: Graph, graphView: TemplateGraphView): Partial<HardState> {
  // Determine school subtype from cluster majority
  const subtypeCounts = new Map<string, number>();
  cluster.forEach(ability => {
    const subtype = ability.subtype;
    subtypeCounts.set(subtype, (subtypeCounts.get(subtype) || 0) + 1);
  });

  // Find most common subtype
  let majoritySubtype = 'magic';
  let maxCount = 0;
  subtypeCounts.forEach((count, subtype) => {
    if (count > maxCount) {
      maxCount = count;
      majoritySubtype = subtype;
    }
  });

  // Generate school name
  const schoolName = generateSchoolName(majoritySubtype, cluster.length);

  // Aggregate tags from cluster (top 4 to leave room for meta-entity tag)
  const allTags = new Set<string>();
  cluster.forEach(ability => {
    Object.keys(ability.tags || {}).forEach(tag => allTags.add(tag));
  });
  const tagArray = Array.from(allTags).slice(0, 4);

  // Build description
  const abilityNames = cluster.map(a => a.name).join(', ');
  const description = `A unified tradition encompassing ${abilityNames}. Formed from ${cluster.length} related abilities practiced by multiple penguins.`;

  // Determine prominence based on cluster size
  let prominence: HardState['prominence'] = 'recognized';
  if (cluster.length >= 6) {
    prominence = 'renowned';
  } else if (cluster.length >= 4) {
    prominence = 'recognized';
  } else {
    prominence = 'marginal';
  }

  // Determine dominant culture from cluster
  const cultureCounts = new Map<string, number>();
  cluster.forEach(ability => {
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

  // Convert to tag object
  const tags: Record<string, boolean> = {};
  tagArray.forEach(tag => tags[tag] = true);
  tags['meta-entity'] = true;

  // Derive coordinates from cluster entities
  const coords = graphView.deriveCoordinates(cluster, 'abilities', 'physical', { maxDistance: 0.3, minDistance: 0.1 });
  if (!coords) {
    throw new Error(
      `magic_school_formation: Failed to derive coordinates for magic school "${schoolName}". ` +
      `This indicates the coordinate system is not properly configured for 'abilities' entities.`
    );
  }

  return {
    kind: 'abilities',
    subtype: majoritySubtype,
    name: schoolName,
    description,
    status: 'active',
    prominence,
    culture: majorityCulture,
    tags,
    coordinates: coords
  };
}

export const magicSchoolFormation: SimulationSystem = {
  id: 'magic_school_formation',
  name: 'Magic School Formation',

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
        { kind: FRAMEWORK_RELATIONSHIP_KINDS.PART_OF, category: 'structural', frequency: 'rare', comment: 'Links abilities to their school' }
      ],
      modifications: []
    },
    effects: {
      graphDensity: 0.2,
      clusterFormation: 0.8,
      diversityImpact: -0.3,
      comment: 'Consolidates abilities into schools, reducing entity count but increasing coherence'
    },
    parameters: {
      minClusterSize: {
        value: 3,
        min: 2,
        max: 5,
        description: 'Minimum abilities to form a school'
      },
      minimumScore: {
        value: 5.0,
        min: 2.0,
        max: 10.0,
        description: 'Minimum similarity score for clustering'
      }
    },
    triggers: {
      graphConditions: ['Epoch end', 'Sufficient abilities'],
      comment: 'Runs at epoch end when enough abilities exist'
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
        description: 'Not epoch end, skipping magic school formation'
      };
    }

    // Create graph view for clustering
    const targetSelector = new TargetSelector();
    const graphView = new TemplateGraphView(graph, targetSelector);

    // Find magic abilities eligible for clustering (exclude combat subtypes for combat system)
    const allAbilities = graphView.findEntities({ kind: 'abilities' });
    const magicAbilities = filterClusterableEntities(allAbilities)
      .filter(a => a.subtype !== 'combat' && a.subtype !== 'physical');

    if (magicAbilities.length < MAGIC_SCHOOL_CLUSTER_CONFIG.minSize) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'Not enough abilities for school formation'
      };
    }

    // Detect clusters
    const clusters = detectClusters(magicAbilities, MAGIC_SCHOOL_CLUSTER_CONFIG, graphView);

    const relationshipsAdded: Relationship[] = [];
    const entitiesModified: Array<{ id: string; changes: Partial<HardState> }> = [];
    const entitiesCreated: string[] = [];

    // Form meta-entities from valid clusters
    for (const cluster of clusters) {
      if (cluster.score < MAGIC_SCHOOL_CLUSTER_CONFIG.minimumScore) continue;

      // Create the school entity
      const schoolPartial = createSchoolEntity(cluster.entities, graph, graphView);
      const schoolId = addEntity(graph, schoolPartial);
      entitiesCreated.push(schoolId);

      // Get cluster entity IDs
      const clusterIds = cluster.entities.map(e => e.id);

      // Transfer relationships from cluster to school
      transferRelationships(
        graph,
        clusterIds,
        schoolId,
        {
          excludeKinds: [FRAMEWORK_RELATIONSHIP_KINDS.PART_OF],
          archiveOriginals: true
        }
      );

      // Create part_of relationships
      createPartOfRelationships(graph, clusterIds, schoolId);
      clusterIds.forEach(id => {
        relationshipsAdded.push({
          kind: FRAMEWORK_RELATIONSHIP_KINDS.PART_OF,
          src: id,
          dst: schoolId
        });
      });

      // Archive original abilities
      archiveEntities(
        graph,
        clusterIds,
        {
          archiveRelationships: false, // Already handled by transfer
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
        description: `${entitiesCreated.length} magic schools formed from ${entitiesModified.length} abilities`,
        entitiesCreated,
        relationshipsCreated: relationshipsAdded,
        entitiesModified: entitiesModified.map(e => e.id)
      });
    }

    return {
      relationshipsAdded,
      entitiesModified,
      pressureChanges: entitiesCreated.length > 0 ? { 'stability': 2 } : {},
      description: `${entitiesCreated.length} magic schools formed`
    };
  }
};
