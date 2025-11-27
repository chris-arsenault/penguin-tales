import { Graph, MetaEntityConfig, Cluster } from '../types/engine';
import { HardState, Relationship } from '../types/worldTypes';
import { TemplateGraphView } from './templateGraphView';
import { generateId, addEntity, addRelationship, archiveRelationship, hasTag } from '../utils/helpers';

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
  detectClusters(graphView: TemplateGraphView, sourceKind: string): Cluster[] {
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
  formMetaEntity(graph: Graph, cluster: HardState[], config: MetaEntityConfig): HardState {
    // Call factory to create meta-entity
    const metaEntityPartial = config.factory(cluster, graph);

    // Add meta-entity to graph
    const metaId = addEntity(graph, metaEntityPartial);
    const metaEntity = graph.getEntity(metaId)!;

    // Transfer relationships FIRST (before archiving)
    if (config.transformation.transferRelationships) {
      this.transferRelationships(graph, cluster, metaId);
    }

    // Create part_of relationships from cluster members to meta-entity
    if (config.transformation.preserveOriginalLinks) {
      cluster.forEach(entity => {
        addRelationship(graph, 'part_of', entity.id, metaId);
      });
    }

    // Create governance faction if this is a legal code formation
    if (config.transformation.createGovernanceFaction && metaEntity.kind === 'rules') {
      this.createGovernanceFaction(graph, metaEntity, cluster);
    }

    // Mark originals as historical AFTER transferring (so we can find active relationships)
    if (config.transformation.markOriginalsHistorical) {
      cluster.forEach(entity => {
        // Mark the entity itself as historical
        entity.status = 'historical';

        // Archive all relationships of the original entity
        const entityRelationships = graph.getRelationships().filter(r =>
          (r.src === entity.id || r.dst === entity.id) &&
          r.status !== 'historical' &&
          r.kind !== 'part_of'  // Don't archive part_of (we just created it)
        );

        entityRelationships.forEach(rel => {
          archiveRelationship(graph, rel.src, rel.dst, rel.kind);
        });
      });
    }

    return metaEntity;
  }

  /**
   * Create a political faction to govern a legal code
   */
  private createGovernanceFaction(graph: Graph, legalCode: HardState, originalRules: HardState[]): void {
    // Check if a governance faction already exists for this location
    const codeLocations = graph.getRelationships()
      .filter(r => r.kind === 'applies_in' && r.src === legalCode.id)
      .map(r => graph.getEntity(r.dst))
      .filter(Boolean) as HardState[];

    // If no location, don't create faction
    if (codeLocations.length === 0) return;

    const primaryLocation = codeLocations[0];

    // Check if a political faction already governs this location
    const existingGoverningFaction = graph.getEntities().find(e =>
      e.kind === 'faction' &&
      e.subtype === 'political' &&
      graph.getRelationships().some(r =>
        r.kind === 'controls' &&
        r.src === e.id &&
        r.dst === primaryLocation.id
      )
    );

    // Don't create duplicate governance factions
    if (existingGoverningFaction) {
      // Just link the existing faction to the legal code
      addRelationship(graph, 'weaponized_by', existingGoverningFaction.id, legalCode.id);
      return;
    }

    // Generate faction name based on legal code
    const factionName = legalCode.name.includes('Code')
      ? legalCode.name.replace('Code', 'Council')
      : `Council of ${primaryLocation.name}`;

    // Create political faction
    const factionId = generateId('faction');
    const faction: HardState = {
      id: factionId,
      kind: 'faction',
      subtype: 'political',
      name: factionName,
      description: `A legislative body formed to administer ${legalCode.name}. Emerged from the consolidation of ${originalRules.length} laws.`,
      status: 'active',
      prominence: legalCode.prominence, // Match prominence of the legal code
      culture: primaryLocation.culture,  // Inherit culture from primary location
      tags: { governance: true, legislative: true, political: true },
      links: [],
      createdAt: graph.tick,
      updatedAt: graph.tick,
      coordinates: primaryLocation.coordinates  // Inherit coordinates from primary location
    };

    graph._loadEntity(factionId, faction);

    // Link faction to legal code
    addRelationship(graph, 'weaponized_by', factionId, legalCode.id);

    // Link faction to location
    addRelationship(graph, 'controls', factionId, primaryLocation.id);

    // Record in history
    graph.history.push({
      tick: graph.tick,
      era: graph.currentEra.id,
      type: 'special',
      description: `${factionName} formed to govern ${legalCode.name}`,
      entitiesCreated: [factionId],
      relationshipsCreated: [
        { kind: 'weaponized_by', src: factionId, dst: legalCode.id },
        { kind: 'controls', src: factionId, dst: primaryLocation.id }
      ],
      entitiesModified: []
    });
  }

  /**
   * Transfer relationships from cluster members to meta-entity
   */
  private transferRelationships(graph: Graph, cluster: HardState[], metaId: string): void {
    const clusterIds = new Set(cluster.map(e => e.id));

    // Find all relationships involving cluster entities
    const toTransfer = graph.getRelationships().filter(r =>
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
      addRelationship(graph, rel.kind, newSrc, newDst);
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
    graphView: TemplateGraphView
  ): number {
    let score = 0;

    for (const criterion of criteria) {
      let matches = false;

      switch (criterion.type) {
        case 'shared_practitioner':
          // Check if entities share a practitioner (practitioner_of relationship)
          const e1Practitioners = graphView.getRelatedEntities(e1.id, 'practitioner_of', 'dst');
          const e2Practitioners = graphView.getRelatedEntities(e2.id, 'practitioner_of', 'dst');
          const e1PractitionerIds = new Set(e1Practitioners.map(p => p.id));
          matches = e2Practitioners.some(p => e1PractitionerIds.has(p.id));
          break;

        case 'shared_location':
          // Check if entities share applies_in or active_during location
          const e1AppliesIn = graphView.getRelatedEntities(e1.id, 'applies_in', 'src');
          const e2AppliesIn = graphView.getRelatedEntities(e2.id, 'applies_in', 'src');
          const e1Locations = new Set(e1AppliesIn.map(l => l.id));
          matches = e2AppliesIn.some(l => e1Locations.has(l.id));

          // Also check active_during if applies_in doesn't match
          if (!matches) {
            const e1ActiveDuring = graphView.getRelatedEntities(e1.id, 'active_during', 'src');
            const e2ActiveDuring = graphView.getRelatedEntities(e2.id, 'active_during', 'src');
            const e1Eras = new Set(e1ActiveDuring.map(e => e.id));
            matches = e2ActiveDuring.some(e => e1Eras.has(e.id));
          }
          break;

        case 'same_creator':
          // Check if entities share a creator relationship
          const e1Creators = graphView.getRelatedEntities(e1.id, 'created_by', 'src');
          const e2Creators = graphView.getRelatedEntities(e2.id, 'created_by', 'src');
          const e1CreatorIds = new Set(e1Creators.map(c => c.id));
          matches = e2Creators.some(c => e1CreatorIds.has(c.id));
          break;

        case 'same_location':
          // Check if entities are at the same location
          const e1Location = graphView.getLocation(e1.id);
          const e2Location = graphView.getLocation(e2.id);
          matches = e1Location !== undefined && e2Location !== undefined &&
                   e1Location.id === e2Location.id;
          break;

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
