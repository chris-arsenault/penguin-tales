/**
 * Cluster Formation System Factory
 *
 * Creates configurable systems that cluster similar entities into meta-entities.
 * This pattern can implement:
 * - Magic school formation (cluster magic abilities)
 * - Legal code formation (cluster rules)
 * - Combat technique formation (cluster combat abilities)
 * - Any domain-specific entity consolidation
 *
 * The factory creates a SimulationSystem from a ClusterFormationConfig.
 */

import { SimulationSystem, SystemResult, ComponentPurpose } from '../engine/types';
import { HardState, Relationship, Prominence } from '../core/worldTypes';
import { TemplateGraphView } from '../graph/templateGraphView';
import {
  ClusterConfig,
  ClusterCriterion,
  ClusterCriterionType,
  detectClusters,
  filterClusterableEntities
} from '../graph/clusteringUtils';
import { FRAMEWORK_RELATIONSHIP_KINDS } from '../core/frameworkPrimitives';
import { pickRandom } from '../utils';

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Entity filter configuration
 */
export interface EntityFilter {
  /** Entity kind to cluster */
  kind: string;
  /** Optional: only include these subtypes */
  subtypes?: string[];
  /** Optional: exclude these subtypes */
  excludeSubtypes?: string[];
  /** Optional: only include entities with this status */
  status?: string;
}

/**
 * Declarative clustering criterion (JSON-safe, no functions)
 */
export interface DeclarativeClusterCriterion {
  /** Type of criterion */
  type: Exclude<ClusterCriterionType, 'custom'>;
  /** Weight contribution to similarity score */
  weight: number;
  /** Optional threshold for this criterion */
  threshold?: number;
  /** For 'shared_relationship': the relationship kind to check */
  relationshipKind?: string;
  /** For 'shared_relationship': direction to check */
  direction?: 'src' | 'dst';
}

/**
 * Clustering configuration (JSON-safe)
 */
export interface DeclarativeClusterConfig {
  /** Minimum entities required to form a cluster */
  minSize: number;
  /** Maximum entities in a cluster (optional) */
  maxSize?: number;
  /** Criteria for calculating similarity */
  criteria: DeclarativeClusterCriterion[];
  /** Minimum total similarity score to be clustered together */
  minimumScore: number;
}

/**
 * Meta-entity configuration
 */
export interface MetaEntityConfig {
  /** Kind for the meta-entity */
  kind: string;
  /** If true, use majority subtype from cluster */
  subtypeFromMajority: boolean;
  /** Fixed subtype if subtypeFromMajority is false */
  fixedSubtype?: string;
  /** Status for the meta-entity */
  status: string;
  /** Prominence thresholds based on cluster size */
  prominenceFromSize: {
    /** Size threshold for 'marginal' prominence */
    marginal: number;
    /** Size threshold for 'recognized' prominence */
    recognized: number;
    /** Size threshold for 'renowned' prominence */
    renowned: number;
  };
  /** Tags to add to meta-entity */
  additionalTags?: string[];
  /** Description template (use {count} for cluster size, {names} for entity names) */
  descriptionTemplate?: string;
}

/**
 * Post-processing configuration
 */
export interface PostProcessConfig {
  /** Whether to create a governance faction (for legal codes) */
  createGovernanceFaction?: boolean;
  /** Faction subtype if creating governance faction */
  governanceFactionSubtype?: string;
  /** Relationship kind for faction→meta-entity */
  governanceRelationship?: string;
  /** Pressure changes after formation */
  pressureChanges?: Record<string, number>;
}

/**
 * Full cluster formation configuration
 */
export interface ClusterFormationConfig {
  /** Unique system identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;

  /** Entity filter for clustering */
  entityFilter: EntityFilter;

  /** Whether to only run at epoch end */
  runAtEpochEnd: boolean;

  /** Clustering configuration */
  clustering: DeclarativeClusterConfig;

  /** Meta-entity configuration */
  metaEntity: MetaEntityConfig;

  /** Optional post-processing */
  postProcess?: PostProcessConfig;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert declarative criteria to ClusterCriterion[]
 */
function toClusterCriteria(declarative: DeclarativeClusterCriterion[]): ClusterCriterion[] {
  return declarative.map(d => ({
    type: d.type,
    weight: d.weight,
    threshold: d.threshold,
    relationshipKind: d.relationshipKind,
    direction: d.direction
  }));
}

/**
 * Get majority value from a map of counts
 */
function getMajority<T>(counts: Map<T, number>, defaultValue: T): T {
  let maxCount = 0;
  let majority = defaultValue;
  counts.forEach((count, value) => {
    if (count > maxCount) {
      maxCount = count;
      majority = value;
    }
  });
  return majority;
}

/**
 * Determine prominence based on cluster size
 */
function getProminence(
  size: number,
  thresholds: { marginal: number; recognized: number; renowned: number }
): Prominence {
  if (size >= thresholds.renowned) return 'renowned';
  if (size >= thresholds.recognized) return 'recognized';
  return 'marginal';
}

/**
 * Create a meta-entity from a cluster
 */
function createMetaEntity(
  cluster: HardState[],
  config: MetaEntityConfig,
  graphView: TemplateGraphView
): Partial<HardState> {
  // Determine subtype
  let subtype: string;
  if (config.subtypeFromMajority) {
    const subtypeCounts = new Map<string, number>();
    cluster.forEach(e => {
      subtypeCounts.set(e.subtype, (subtypeCounts.get(e.subtype) || 0) + 1);
    });
    subtype = getMajority(subtypeCounts, cluster[0].subtype);
  } else {
    subtype = config.fixedSubtype || cluster[0].subtype;
  }

  // Determine culture from majority
  const cultureCounts = new Map<string, number>();
  cluster.forEach(e => {
    const culture = e.culture || 'world';
    cultureCounts.set(culture, (cultureCounts.get(culture) || 0) + 1);
  });
  const culture = getMajority(cultureCounts, 'world');

  // Aggregate tags from cluster (top 4 to leave room for meta-entity tag)
  const allTags = new Set<string>();
  cluster.forEach(e => {
    Object.keys(e.tags || {}).forEach(tag => {
      // Skip meta-entity and temp tags
      if (!tag.startsWith('meta-entity') && !tag.startsWith('temp:')) {
        allTags.add(tag);
      }
    });
  });
  const tagArray = Array.from(allTags).slice(0, 4);

  // Build tags object
  const tags: Record<string, boolean> = {};
  tagArray.forEach(tag => tags[tag] = true);
  tags['meta-entity'] = true;
  if (config.additionalTags) {
    config.additionalTags.forEach(tag => tags[tag] = true);
  }

  // Build description
  const entityNames = cluster.map(e => e.name).join(', ');
  let description = config.descriptionTemplate
    ? config.descriptionTemplate
        .replace('{count}', String(cluster.length))
        .replace('{names}', entityNames)
    : `A unified tradition encompassing ${entityNames}. Formed from ${cluster.length} related entities.`;

  // Determine prominence
  const prominence = getProminence(cluster.length, config.prominenceFromSize);

  // Derive coordinates from cluster using culture-aware placement
  const placement = graphView.deriveCoordinatesWithCulture(
    culture,
    config.kind,
    cluster
  );
  if (!placement) {
    throw new Error(
      `cluster_formation: Failed to derive coordinates for meta-entity. ` +
      `Ensure coordinate system is configured for '${config.kind}' entities.`
    );
  }

  return {
    kind: config.kind,
    subtype,
    description,
    status: config.status,
    prominence,
    culture,
    tags,
    coordinates: placement.coordinates
  };
}

/**
 * Create a governance faction for a legal code
 */
async function createGovernanceFaction(
  graphView: TemplateGraphView,
  metaEntityId: string,
  metaEntity: HardState,
  config: PostProcessConfig
): Promise<{ factionId: string | null; relationships: Relationship[] }> {
  const relationships: Relationship[] = [];

  // Find locations where this code applies
  const codeLocations = graphView.getAllRelationships()
    .filter(r => r.kind === 'applies_in' && r.src === metaEntityId)
    .map(r => graphView.getEntity(r.dst))
    .filter((l): l is HardState => l !== undefined);

  if (codeLocations.length === 0) {
    return { factionId: null, relationships: [] };
  }

  const primaryLocation = codeLocations[0];

  // Check if a political faction already governs this location
  const existingGoverningFaction = graphView.getEntities().find(e =>
    e.kind === 'faction' &&
    e.subtype === (config.governanceFactionSubtype || 'political') &&
    graphView.getAllRelationships().some(r =>
      r.kind === 'controls' &&
      r.src === e.id &&
      r.dst === primaryLocation.id
    )
  );

  if (existingGoverningFaction) {
    // Link existing faction to the meta-entity
    const relKind = config.governanceRelationship || 'weaponized_by';
    graphView.createRelationship(relKind, existingGoverningFaction.id, metaEntityId);
    relationships.push({
      kind: relKind,
      src: existingGoverningFaction.id,
      dst: metaEntityId
    });
    return { factionId: null, relationships };
  }

  // Derive coordinates for faction
  const factionPlacement = graphView.deriveCoordinatesWithCulture(
    primaryLocation.culture ?? 'default',
    'faction',
    [primaryLocation, metaEntity]
  );
  if (!factionPlacement) {
    return { factionId: null, relationships: [] };
  }

  // Create political faction
  const factionPartial: Partial<HardState> = {
    kind: 'faction',
    subtype: config.governanceFactionSubtype || 'political',
    description: `A legislative body formed to administer ${metaEntity.name}.`,
    status: 'active',
    prominence: metaEntity.prominence,
    culture: primaryLocation.culture,
    tags: { governance: true, legislative: true, political: true },
    coordinates: factionPlacement.coordinates
  };

  const factionId = await graphView.addEntity(factionPartial);

  // Link faction to meta-entity
  const relKind = config.governanceRelationship || 'weaponized_by';
  graphView.createRelationship(relKind, factionId, metaEntityId);
  relationships.push({
    kind: relKind,
    src: factionId,
    dst: metaEntityId
  });

  // Link faction to location
  graphView.createRelationship('controls', factionId, primaryLocation.id);
  relationships.push({
    kind: 'controls',
    src: factionId,
    dst: primaryLocation.id
  });

  return { factionId, relationships };
}

// =============================================================================
// SYSTEM FACTORY
// =============================================================================

/**
 * Create a SimulationSystem from a ClusterFormationConfig
 */
export function createClusterFormationSystem(
  config: ClusterFormationConfig
): SimulationSystem {
  // Convert declarative criteria to runtime criteria
  const clusterConfig: ClusterConfig = {
    minSize: config.clustering.minSize,
    maxSize: config.clustering.maxSize,
    criteria: toClusterCriteria(config.clustering.criteria),
    minimumScore: config.clustering.minimumScore
  };

  return {
    id: config.id,
    name: config.name,

    // Note: contract removed - systems don't need lineage and affects is redundant

    metadata: {
      produces: {
        relationships: [
          { kind: FRAMEWORK_RELATIONSHIP_KINDS.PART_OF, category: 'structural', frequency: 'rare', comment: 'Links entities to meta-entity' }
        ],
        modifications: []
      },
      effects: {
        graphDensity: 0.2,
        clusterFormation: 0.8,
        diversityImpact: -0.3,
        comment: config.description || `Consolidates ${config.entityFilter.kind} entities into meta-entities`
      },
      parameters: {
        minClusterSize: {
          value: config.clustering.minSize,
          min: 2,
          max: 10,
          description: 'Minimum entities to form a cluster'
        },
        minimumScore: {
          value: config.clustering.minimumScore,
          min: 1.0,
          max: 15.0,
          description: 'Minimum similarity score for clustering'
        }
      },
      triggers: {
        graphConditions: config.runAtEpochEnd
          ? ['Epoch end', `Sufficient ${config.entityFilter.kind} entities`]
          : [`Sufficient ${config.entityFilter.kind} entities`],
        comment: config.runAtEpochEnd
          ? 'Runs at epoch end when enough entities exist'
          : 'Runs every tick when enough entities exist'
      }
    },

    apply: async (graphView: TemplateGraphView, modifier: number = 1.0): Promise<SystemResult> => {
      // Check epoch end if required
      if (config.runAtEpochEnd) {
        const epochLength = graphView.config.epochLength || 20;
        if (graphView.tick % epochLength !== 0) {
          return {
            relationshipsAdded: [],
            entitiesModified: [],
            pressureChanges: {},
            description: `${config.name}: not epoch end, skipping`
          };
        }
      }

      // Find entities eligible for clustering
      let entities = graphView.findEntities({ kind: config.entityFilter.kind });

      // Apply subtype filters
      if (config.entityFilter.subtypes) {
        entities = entities.filter(e => config.entityFilter.subtypes!.includes(e.subtype));
      }
      if (config.entityFilter.excludeSubtypes) {
        entities = entities.filter(e => !config.entityFilter.excludeSubtypes!.includes(e.subtype));
      }
      if (config.entityFilter.status) {
        entities = entities.filter(e => e.status === config.entityFilter.status);
      }

      // Filter out historical and meta-entities
      entities = filterClusterableEntities(entities);

      if (entities.length < clusterConfig.minSize) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${config.name}: not enough entities (${entities.length})`
        };
      }

      // Detect clusters
      const clusters = detectClusters(entities, clusterConfig, graphView);

      const relationshipsAdded: Relationship[] = [];
      const entitiesModified: Array<{ id: string; changes: Partial<HardState> }> = [];
      const metaEntitiesCreated: string[] = [];
      const factionsCreated: string[] = [];

      // Form meta-entities from valid clusters
      for (const cluster of clusters) {
        if (cluster.score < clusterConfig.minimumScore) continue;

        // Create the meta-entity
        const metaEntityPartial = createMetaEntity(cluster.entities, config.metaEntity, graphView);
        const metaEntityId = await graphView.addEntity(metaEntityPartial);
        const metaEntity = graphView.getEntity(metaEntityId)!;
        metaEntitiesCreated.push(metaEntityId);

        // Get cluster entity IDs
        const clusterIds = cluster.entities.map(e => e.id);

        // Transfer relationships from cluster to meta-entity
        graphView.transferRelationships(
          clusterIds,
          metaEntityId,
          {
            excludeKinds: [FRAMEWORK_RELATIONSHIP_KINDS.PART_OF],
            archiveOriginals: true
          }
        );

        // Create part_of relationships
        graphView.createPartOfRelationships(clusterIds, metaEntityId);
        clusterIds.forEach(id => {
          relationshipsAdded.push({
            kind: FRAMEWORK_RELATIONSHIP_KINDS.PART_OF,
            src: id,
            dst: metaEntityId
          });
        });

        // Post-process: create governance faction if configured
        if (config.postProcess?.createGovernanceFaction) {
          const { factionId, relationships } = await createGovernanceFaction(
            graphView,
            metaEntityId,
            metaEntity,
            config.postProcess
          );

          relationshipsAdded.push(...relationships);
          if (factionId) {
            factionsCreated.push(factionId);
          }
        }

        // Archive original entities
        graphView.archiveEntities(
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
      if (metaEntitiesCreated.length > 0) {
        const allCreated = [...metaEntitiesCreated, ...factionsCreated];
        graphView.addHistoryEvent({
          tick: graphView.tick,
          era: graphView.currentEra.id,
          type: 'special',
          description: `${metaEntitiesCreated.length} ${config.name} from ${entitiesModified.length} entities` +
            (factionsCreated.length > 0 ? `, ${factionsCreated.length} governance factions` : ''),
          entitiesCreated: allCreated,
          relationshipsCreated: relationshipsAdded,
          entitiesModified: entitiesModified.map(e => e.id)
        });
      }

      // Pressure changes
      const pressureChanges = metaEntitiesCreated.length > 0
        ? (config.postProcess?.pressureChanges ?? { stability: 2 })
        : {};

      return {
        relationshipsAdded,
        entitiesModified,
        pressureChanges,
        description: `${config.name}: ${metaEntitiesCreated.length} meta-entities formed` +
          (factionsCreated.length > 0 ? `, ${factionsCreated.length} factions` : '')
      };
    }
  };
}
