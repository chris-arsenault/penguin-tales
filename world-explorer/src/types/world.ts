export type Prominence = 'forgotten' | 'marginal' | 'recognized' | 'renowned' | 'mythic';

export type EntityKind = 'npc' | 'location' | 'faction' | 'rules' | 'abilities' | 'era' | 'occurrence';

export interface Relationship {
  kind: string;
  src: string;
  dst: string;
  strength?: number;
}

export interface HardState {
  id: string;
  kind: EntityKind;
  subtype: string;
  name: string;
  description: string;
  status: string;
  prominence: Prominence;
  tags: string[];
  links: Relationship[];
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEvent {
  tick: number;
  era: string;
  type: 'growth' | 'simulation' | 'special';
  description: string;
  entitiesCreated: string[];
  relationshipsCreated: Relationship[];
  entitiesModified: string[];
}

export interface EnrichmentTriggers {
  total: number;
  byKind: {
    locationEnrichments: number;
    factionEnrichments: number;
    ruleEnrichments: number;
    abilityEnrichments: number;
    npcEnrichments: number;
  };
  comment: string;
}

export interface WorldMetadata {
  tick: number;
  epoch: number;
  era: string;
  entityCount: number;
  relationshipCount: number;
  historyEventCount: number;
  enrichmentTriggers: EnrichmentTriggers;
}

export interface ValidationResult {
  name: string;
  passed: boolean;
  failureCount: number;
  details: string;
}

export interface Validation {
  totalChecks: number;
  passed: number;
  failed: number;
  results: ValidationResult[];
}

export interface GraphMetrics {
  clusters: number;
  avgClusterSize: number;
  intraClusterDensity: number;
  interClusterDensity: number;
  isolatedNodes: number;
  isolatedNodeRatio: number;
}

export interface DistributionMetrics {
  entityKindRatios: Record<string, number>;
  prominenceRatios: Record<string, number>;
  relationshipTypeRatios: Record<string, number>;
  graphMetrics: GraphMetrics;
  deviation: Record<string, number>;
  targets: Record<string, any>;
}

export interface WorldState {
  metadata: WorldMetadata;
  hardState: HardState[];
  relationships: Relationship[];
  pressures: Record<string, number>;
  history: HistoryEvent[];
  distributionMetrics?: DistributionMetrics;
  validation?: Validation;
}

export interface Filters {
  kinds: EntityKind[];
  minProminence: Prominence;
  timeRange: [number, number];
  tags: string[];
  searchQuery: string;
  relationshipTypes: string[];
  minStrength: number;
  showCatalyzedBy: boolean;
}

export type GraphMode = 'full' | 'radial' | 'temporal' | 'faction' | 'conflict' | 'economic';

// Lore types
export type LoreType = 'description' | 'relationship_backstory' | 'era_narrative' | 'chain_link' | 'discovery_event';

export interface LoreRecord {
  id: string;
  type: LoreType;
  targetId?: string;  // For description, relationship_backstory, chain_link, discovery_event
  text: string;
  cached?: boolean;
  warnings?: string[];
}

export interface DescriptionLore extends LoreRecord {
  type: 'description';
  targetId: string;
}

export interface RelationshipBackstoryLore extends LoreRecord {
  type: 'relationship_backstory';
  targetId: string;
  relationship: {
    kind: string;
    src: string;
    dst: string;
  };
}

export interface EraNarrativeLore extends LoreRecord {
  type: 'era_narrative';
  metadata: {
    from: string;
    to: string;
    tick: number;
  };
}

export interface ChainLinkLore extends LoreRecord {
  type: 'chain_link';
  targetId: string;
  metadata: {
    sourceLocation: string;
    revealedTheme: string;
  };
}

export interface DiscoveryEventLore extends LoreRecord {
  type: 'discovery_event';
  targetId: string;
  metadata: {
    explorer: string;
    discoveryType: 'pressure' | 'chain';
    significance: string;
    tick: number;
  };
}

export interface LoreData {
  llmEnabled: boolean;
  model: string;
  records: (DescriptionLore | RelationshipBackstoryLore | EraNarrativeLore | ChainLinkLore | DiscoveryEventLore)[];
}

export interface EntityImage {
  entityId: string;
  entityName: string;
  entityKind: string;
  prompt: string;
  localPath: string;
}

export interface ImageMetadata {
  generatedAt: string;
  totalImages: number;
  results: EntityImage[];
}
