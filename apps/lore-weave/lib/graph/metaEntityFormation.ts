import { MetaEntityConfig, Cluster } from '../engine/types';
import { HardState, Relationship } from '../core/worldTypes';
import { WorldRuntime } from '../runtime/worldRuntime';
import { hasTag } from '../utils';

/**
 * Meta-Entity Formation Service
 *
 * Clusters similar entities (abilities, rules) into unified meta-entities
 * (schools, legal codes) to create narrative density anchors and prevent
 * target proliferation.
 */
export class MetaEntityFormation {
  private configs: Map<string, MetaEntityConfig>;

  constructor() {
    this.configs = new Map();
  }

  /**
   * Register a meta-entity configuration
   */
  registerConfig(config: MetaEntityConfig): void {
    this.configs.set(config.sourceKind, config);
  }

  /**
   * Detect clusters of similar entities
   * Uses greedy clustering algorithm: entities are sorted by creation time,
   * then grouped based on similarity scores
   */
  detectClusters(graphView: WorldRuntime, sourceKind: string): Cluster[] {
    const config = this.configs.get(sourceKind);
    if (!config) return [];

    // Find all entities of the source kind that aren't already historical
    // CRITICAL: Exclude meta-entities to prevent recursive clustering
    const entities = graphView.findEntities({ kind: sourceKind })
      .filter(e => e.status !== 'historical')
      .filter(e => !hasTag(e.tags, 'meta-entity'));  // Don't cluster meta-entities

    if (entities.length < config.clustering.minSize) {
      return [];
    }

    // Sort by creation time (cluster chronologically related entities)
    const sorted = entities.sort((a, b) => a.createdAt - b.createdAt);

    // Greedy clustering: try to add each entity to an existing cluster or create new one
    const clusters: Cluster[] = [];

    for (const entity of sorted) {
      let addedToCluster = false;

      // Try to add to existing cluster
      for (const cluster of clusters) {
        // Check if entity is similar enough to cluster members
        let clusterScore = 0;
        let matchCount = 0;

        for (const member of cluster.entities) {
          const similarity = this.calculateSimilarity(entity, member, config.clustering.criteria, graphView);
          if (similarity > 0) {
            clusterScore += similarity;
            matchCount++;
          }
        }

        // Average similarity to cluster members
        const avgSimilarity = matchCount > 0 ? clusterScore / matchCount : 0;

        // If similar enough, add to cluster
        if (avgSimilarity >= config.clustering.minimumScore * 0.7) {
          cluster.entities.push(entity);
          cluster.score = (cluster.score + avgSimilarity) / 2; // Update cluster score
          addedToCluster = true;
          break;
        }
      }

      // If not added to any cluster, create new cluster
      if (!addedToCluster) {
        clusters.push({
          entities: [entity],
          score: config.clustering.minimumScore,
          matchedCriteria: []
        });
      }
    }

    // Filter clusters by minimum size and maximum size
    const validClusters = clusters.filter(c => {
      if (c.entities.length < config.clustering.minSize) return false;
      if (config.clustering.maxSize && c.entities.length > config.clustering.maxSize) {
        // Truncate cluster to max size
        c.entities = c.entities.slice(0, config.clustering.maxSize);
      }
      return true;
    });

    return validClusters;
  }

  /**
   * Form a meta-entity from a cluster
   */
  async formMetaEntity(graphView: WorldRuntime, cluster: HardState[], config: MetaEntityConfig): Promise<HardState> {
    // Call factory to create meta-entity
    const metaEntityPartial = config.factory(cluster, graphView);

    // Add meta-entity to graph
    const metaId = await graphView.addEntity(metaEntityPartial);
    const metaEntity = graphView.getEntity(metaId)!;

    // Transfer relationships FIRST (before archiving)
    if (config.transformation.transferRelationships) {
      this.transferRelationships(graphView, cluster, metaId);
    }

    // Create part_of relationships from cluster members to meta-entity
    if (config.transformation.preserveOriginalLinks) {
      cluster.forEach(entity => {
        graphView.createRelationship('part_of', entity.id, metaId);
      });
    }

    // Mark originals as historical AFTER transferring (so we can find active relationships)
    if (config.transformation.markOriginalsHistorical) {
      cluster.forEach(entity => {
        // Mark the entity itself as historical
        graphView.updateEntity(entity.id, { status: 'historical' });

        // Archive all relationships of the original entity
        const entityRelationships = graphView.getAllRelationships().filter(r =>
          (r.src === entity.id || r.dst === entity.id) &&
          r.status !== 'historical' &&
          r.kind !== 'part_of'  // Don't archive part_of (we just created it)
        );

        entityRelationships.forEach(rel => {
          graphView.archiveRelationship(rel.src, rel.dst, rel.kind);
        });
      });
    }

    return metaEntity;
  }

  /**
   * Transfer relationships from cluster members to meta-entity
   */
  private transferRelationships(graphView: WorldRuntime, cluster: HardState[], metaId: string): void {
    const clusterIds = new Set(cluster.map(e => e.id));

    // Find all relationships involving cluster entities
    const toTransfer = graphView.getAllRelationships().filter(r =>
      (clusterIds.has(r.src) || clusterIds.has(r.dst)) &&
      r.status !== 'historical' &&
      r.kind !== 'part_of'  // Don't transfer part_of relationships
    );

    // Group by unique (src, dst, kind) combinations to avoid duplicates
    const transferred = new Set<string>();

    toTransfer.forEach(rel => {
      let newSrc = rel.src;
      let newDst = rel.dst;

      // Update src if in cluster
      if (clusterIds.has(rel.src)) {
        newSrc = metaId;
      }

      // Update dst if in cluster
      if (clusterIds.has(rel.dst)) {
        newDst = metaId;
      }

      // Avoid self-loops and duplicates
      if (newSrc === newDst) return;
      const key = `${newSrc}:${newDst}:${rel.kind}`;
      if (transferred.has(key)) return;

      // Create new relationship with updated endpoints
      graphView.createRelationship(rel.kind, newSrc, newDst);
      transferred.add(key);
    });
  }

  /**
   * Calculate similarity score between two entities based on criteria
   */
  private calculateSimilarity(
    e1: HardState,
    e2: HardState,
    criteria: MetaEntityConfig['clustering']['criteria'],
    graphView: WorldRuntime
  ): number {
    let score = 0;

    for (const criterion of criteria) {
      let matches = false;

      switch (criterion.type) {
        case 'shares_related': {
          // Generic check: do entities share a common related entity via specified relationship?
          const relKind = criterion.relationshipKind;
          if (!relKind) {
            console.warn('[MetaEntityFormation] shares_related criterion missing relationshipKind');
            break;
          }
          const e1Related = graphView.getRelatedEntities(e1.id, relKind, 'src');
          const e2Related = graphView.getRelatedEntities(e2.id, relKind, 'src');
          const e1RelatedIds = new Set(e1Related.map(r => r.id));
          matches = e2Related.some(r => e1RelatedIds.has(r.id));
          break;
        }

        case 'shared_tags':
          // Check tag overlap (Jaccard similarity)
          const e1Tags = new Set(Object.keys(e1.tags || {}));
          const e2Tags = new Set(Object.keys(e2.tags || {}));
          const intersection = Array.from(e1Tags).filter(t => e2Tags.has(t)).length;
          const union = new Set([...e1Tags, ...e2Tags]).size;
          const jaccard = union > 0 ? intersection / union : 0;
          matches = jaccard >= (criterion.threshold || 0.5);
          break;

        case 'temporal_proximity':
          // Check if entities were created close in time
          const timeDiff = Math.abs(e1.createdAt - e2.createdAt);
          matches = timeDiff <= (criterion.threshold || 30);
          break;
      }

      if (matches) {
        score += criterion.weight;
      }
    }

    return score;
  }

  /**
   * Get all registered configs
   */
  getConfigs(): Map<string, MetaEntityConfig> {
    return this.configs;
  }
}
