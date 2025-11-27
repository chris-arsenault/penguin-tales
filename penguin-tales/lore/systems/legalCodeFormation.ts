/**
 * Legal Code Formation System
 *
 * Clusters rules into unified legal codes to create coherent legal systems.
 * Also creates governance factions to administer the legal codes.
 *
 * Example: 15 scattered laws → 2-3 unified codes
 */

import { SimulationSystem, SystemResult, Graph, ComponentPurpose } from '@lore-weave/core/types/engine';
import { HardState, Relationship } from '@lore-weave/core/types/worldTypes';
import {
  pickRandom,
  addEntity,
  addRelationship,
  generateId,
  hasTag
} from '@lore-weave/core/utils/helpers';
import {
  detectClusters,
  filterClusterableEntities,
  ClusterConfig,
  ClusterCriterion
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
 * Custom criterion for shared location using applies_in or active_during
 */
const sharedLocationCriterion: ClusterCriterion = {
  type: 'custom',
  weight: 5.0,
  predicate: (e1, e2, graphView) => {
    // Check applies_in locations
    const e1AppliesIn = graphView.getRelatedEntities(e1.id, 'applies_in', 'src');
    const e2AppliesIn = graphView.getRelatedEntities(e2.id, 'applies_in', 'src');
    const e1Locations = new Set(e1AppliesIn.map(l => l.id));

    if (e2AppliesIn.some(l => e1Locations.has(l.id))) {
      return true;
    }

    // Also check active_during if applies_in doesn't match
    const e1ActiveDuring = graphView.getRelatedEntities(e1.id, 'active_during', 'src');
    const e2ActiveDuring = graphView.getRelatedEntities(e2.id, 'active_during', 'src');
    const e1Eras = new Set(e1ActiveDuring.map(e => e.id));

    return e2ActiveDuring.some(e => e1Eras.has(e.id));
  }
};

/**
 * Clustering configuration for legal codes
 */
const LEGAL_CODE_CLUSTER_CONFIG: ClusterConfig = {
  minSize: 4,
  criteria: [
    sharedLocationCriterion,
    {
      type: 'temporal_proximity',
      weight: 2.0,
      threshold: 40
    }
  ],
  minimumScore: 5.0
};

/**
 * Generate a legal code name based on subtype
 */
function generateCodeName(majoritySubtype: string, clusterSize: number): string {
  const nameFragments: Record<string, string[]> = {
    edict: ['Statutory', 'Administrative', 'Governmental', 'Official', 'Imperial'],
    taboo: ['Sacred', 'Divine', 'Ecclesiastical', 'Forbidden', 'Holy'],
    social: ['Traditional', 'Ancestral', 'Cultural', 'Folk', 'Common'],
    natural: ['Natural', 'Universal', 'Fundamental', 'Eternal', 'Immutable']
  };

  const descriptor = pickRandom(
    nameFragments[majoritySubtype] || nameFragments.edict
  );
  return `${descriptor} Code of ${clusterSize} Laws`;
}

/**
 * Create a meta-entity rule from a cluster
 */
function createCodeEntity(cluster: HardState[], graph: Graph, graphView: TemplateGraphView): Partial<HardState> {
  // Determine code subtype from cluster majority
  const subtypeCounts = new Map<string, number>();
  cluster.forEach(rule => {
    const subtype = rule.subtype;
    subtypeCounts.set(subtype, (subtypeCounts.get(subtype) || 0) + 1);
  });

  // Find most common subtype
  let majoritySubtype = 'institutional';
  let maxCount = 0;
  subtypeCounts.forEach((count, subtype) => {
    if (count > maxCount) {
      maxCount = count;
      majoritySubtype = subtype;
    }
  });

  // Generate code name
  const codeName = generateCodeName(majoritySubtype, cluster.length);

  // Aggregate tags from cluster
  const allTags = new Set<string>();
  cluster.forEach(rule => {
    Object.keys(rule.tags || {}).forEach(tag => allTags.add(tag));
  });
  const tagArray = Array.from(allTags).slice(0, 4);

  // Build description
  const ruleNames = cluster.map(r => r.name).join(', ');
  const description = `A unified legal system encompassing ${ruleNames}. Codified from ${cluster.length} related rules.`;

  // Determine prominence
  let prominence: HardState['prominence'] = 'recognized';
  if (cluster.length >= 7) {
    prominence = 'renowned';
  } else if (cluster.length >= 5) {
    prominence = 'recognized';
  } else {
    prominence = 'marginal';
  }

  // Determine dominant culture from cluster
  const cultureCounts = new Map<string, number>();
  cluster.forEach(rule => {
    const culture = rule.culture || 'world';
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
  const coords = graphView.deriveCoordinates(cluster, 'rules', 'physical', { maxDistance: 0.3, minDistance: 0.1 });
  if (!coords) {
    throw new Error(
      `legal_code_formation: Failed to derive coordinates for legal code "${codeName}". ` +
      `This indicates the coordinate system is not properly configured for 'rules' entities.`
    );
  }

  return {
    kind: 'rules',
    subtype: majoritySubtype,
    name: codeName,
    description,
    status: 'enacted',
    prominence,
    culture: majorityCulture,
    tags,
    coordinates: coords
  };
}

/**
 * Create a governance faction for a legal code
 */
function createGovernanceFaction(
  graph: Graph,
  graphView: TemplateGraphView,
  legalCode: HardState,
  originalRules: HardState[]
): { faction: HardState | null; relationships: Relationship[] } {
  const relationships: Relationship[] = [];

  // Find locations where this code applies
  const codeLocations = graph.getRelationships()
    .filter(r => r.kind === 'applies_in' && r.src === legalCode.id)
    .map(r => graph.getEntity(r.dst))
    .filter((l): l is HardState => l !== undefined);

  // If no location, don't create faction
  if (codeLocations.length === 0) {
    return { faction: null, relationships: [] };
  }

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
    relationships.push({
      kind: 'weaponized_by',
      src: existingGoverningFaction.id,
      dst: legalCode.id
    });
    return { faction: null, relationships };
  }

  // Generate faction name based on legal code
  const factionName = legalCode.name.includes('Code')
    ? legalCode.name.replace('Code', 'Council')
    : `Council of ${primaryLocation.name}`;

  // Derive coordinates from location and legal code
  const referenceEntities = [primaryLocation, legalCode];
  const coords = graphView.deriveCoordinates(referenceEntities, 'faction', 'physical', { maxDistance: 0.2, minDistance: 0.05 });
  if (!coords) {
    // Can't place faction without coordinates - skip creation
    return { faction: null, relationships: [] };
  }

  // Create political faction
  const factionPartial: Partial<HardState> = {
    kind: 'faction',
    subtype: 'political',
    name: factionName,
    description: `A legislative body formed to administer ${legalCode.name}. Emerged from the consolidation of ${originalRules.length} laws.`,
    status: 'active',
    prominence: legalCode.prominence,
    culture: primaryLocation.culture,
    tags: { governance: true, legislative: true, political: true },
    coordinates: coords
  };

  const factionId = addEntity(graph, factionPartial);
  const faction = graph.getEntity(factionId)!;

  // Link faction to legal code
  addRelationship(graph, 'weaponized_by', factionId, legalCode.id);
  relationships.push({
    kind: 'weaponized_by',
    src: factionId,
    dst: legalCode.id
  });

  // Link faction to location
  addRelationship(graph, 'controls', factionId, primaryLocation.id);
  relationships.push({
    kind: 'controls',
    src: factionId,
    dst: primaryLocation.id
  });

  return { faction, relationships };
}

export const legalCodeFormation: SimulationSystem = {
  id: 'legal_code_formation',
  name: 'Legal Code Formation',

  contract: {
    purpose: ComponentPurpose.STATE_MODIFICATION,
    enabledBy: {
      entityCounts: [
        { kind: 'rules', min: 8 }
      ]
    },
    affects: {
      entities: [
        { kind: 'rules', operation: 'create', count: { min: 0, max: 5 } },
        { kind: 'rules', operation: 'modify', count: { min: 0, max: 20 } },
        { kind: 'faction', subtype: 'political', operation: 'create', count: { min: 0, max: 5 } }
      ],
      relationships: [
        { kind: FRAMEWORK_RELATIONSHIP_KINDS.PART_OF, operation: 'create', count: { min: 0, max: 20 } },
        { kind: 'weaponized_by', operation: 'create', count: { min: 0, max: 5 } },
        { kind: 'controls', operation: 'create', count: { min: 0, max: 5 } }
      ]
    }
  },

  metadata: {
    produces: {
      relationships: [
        { kind: FRAMEWORK_RELATIONSHIP_KINDS.PART_OF, category: 'structural', frequency: 'rare', comment: 'Links rules to their legal code' },
        { kind: 'weaponized_by', category: 'political', frequency: 'rare', comment: 'Factions using legal codes' },
        { kind: 'controls', category: 'political', frequency: 'rare', comment: 'Governance over locations' }
      ],
      modifications: []
    },
    effects: {
      graphDensity: 0.3,
      clusterFormation: 0.9,
      diversityImpact: -0.2,
      comment: 'Consolidates rules into legal codes, creates governance structure'
    },
    parameters: {
      minClusterSize: {
        value: 4,
        min: 3,
        max: 6,
        description: 'Minimum rules to form a legal code'
      },
      createGovernance: {
        value: 1,
        min: 0,
        max: 1,
        description: 'Whether to create governance factions (1=yes, 0=no)'
      }
    },
    triggers: {
      graphConditions: ['Epoch end', 'Sufficient rules'],
      comment: 'Runs at epoch end when enough rules exist'
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
        description: 'Not epoch end, skipping legal code formation'
      };
    }

    // Create graph view for clustering
    const targetSelector = new TargetSelector();
    const graphView = new TemplateGraphView(graph, targetSelector);

    // Find rules eligible for clustering
    const allRules = graphView.findEntities({ kind: 'rules' });
    const rules = filterClusterableEntities(allRules);

    if (rules.length < LEGAL_CODE_CLUSTER_CONFIG.minSize) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'Not enough rules for code formation'
      };
    }

    // Detect clusters
    const clusters = detectClusters(rules, LEGAL_CODE_CLUSTER_CONFIG, graphView);

    const relationshipsAdded: Relationship[] = [];
    const entitiesModified: Array<{ id: string; changes: Partial<HardState> }> = [];
    const codesCreated: string[] = [];
    const factionsCreated: string[] = [];

    // Form meta-entities from valid clusters
    for (const cluster of clusters) {
      if (cluster.score < LEGAL_CODE_CLUSTER_CONFIG.minimumScore) continue;

      // Create the legal code entity
      const codePartial = createCodeEntity(cluster.entities, graph, graphView);
      const codeId = addEntity(graph, codePartial);
      const codeEntity = graph.getEntity(codeId)!;
      codesCreated.push(codeId);

      // Get cluster entity IDs
      const clusterIds = cluster.entities.map(e => e.id);

      // Transfer relationships from cluster to code
      transferRelationships(
        graph,
        clusterIds,
        codeId,
        {
          excludeKinds: [FRAMEWORK_RELATIONSHIP_KINDS.PART_OF],
          archiveOriginals: true
        }
      );

      // Create part_of relationships
      createPartOfRelationships(graph, clusterIds, codeId);
      clusterIds.forEach(id => {
        relationshipsAdded.push({
          kind: FRAMEWORK_RELATIONSHIP_KINDS.PART_OF,
          src: id,
          dst: codeId
        });
      });

      // Create governance faction
      const params = legalCodeFormation.metadata?.parameters || {};
      const shouldCreateGovernance = (params.createGovernance?.value ?? 1) === 1;

      if (shouldCreateGovernance) {
        const { faction, relationships } = createGovernanceFaction(
          graph,
          graphView,
          codeEntity,
          cluster.entities
        );

        relationshipsAdded.push(...relationships);

        if (faction) {
          factionsCreated.push(faction.id);
        }
      }

      // Archive original rules
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
    if (codesCreated.length > 0) {
      const allCreated = [...codesCreated, ...factionsCreated];
      graph.history.push({
        tick: graph.tick,
        era: graph.currentEra.id,
        type: 'special',
        description: `${codesCreated.length} legal codes formed from ${entitiesModified.length} rules` +
          (factionsCreated.length > 0 ? `, ${factionsCreated.length} governance factions established` : ''),
        entitiesCreated: allCreated,
        relationshipsCreated: relationshipsAdded,
        entitiesModified: entitiesModified.map(e => e.id)
      });
    }

    return {
      relationshipsAdded,
      entitiesModified,
      pressureChanges: codesCreated.length > 0 ? { 'stability': 5 } : {},
      description: `${codesCreated.length} legal codes formed` +
        (factionsCreated.length > 0 ? `, ${factionsCreated.length} governance factions` : '')
    };
  }
};
