import { HardState, Relationship } from './worldTypes';
import { LoreIndex, LoreRecord } from './lore';
import { TemplateMetadata, SystemMetadata, DistributionTargets } from './distribution';
import { DomainSchema } from './domainSchema';
export interface LLMConfig {
    enabled: boolean;
    model: string;
    apiKey?: string;
    maxTokens?: number;
    temperature?: number;
}
export type EnrichmentMode = 'off' | 'partial' | 'full';
export interface EnrichmentConfig {
    batchSize: number;
    mode: EnrichmentMode;
    maxEntityEnrichments?: number;
    maxRelationshipEnrichments?: number;
    maxEraNarratives?: number;
}
export interface Era {
    id: string;
    name: string;
    description: string;
    templateWeights: Record<string, number>;
    systemModifiers: Record<string, number>;
    pressureModifiers?: Record<string, number>;
    specialRules?: (graph: Graph) => void;
}
export interface Graph {
    entities: Map<string, HardState>;
    relationships: Relationship[];
    tick: number;
    currentEra: Era;
    pressures: Map<string, number>;
    history: HistoryEvent[];
    config: EngineConfig;
    relationshipCooldowns: Map<string, Map<string, number>>;
    loreIndex?: LoreIndex;
    loreRecords: LoreRecord[];
    discoveryState: import('./worldTypes').DiscoveryState;
    growthMetrics: {
        relationshipsPerTick: number[];
        averageGrowthRate: number;
    };
    subtypeMetrics?: Map<string, number>;
    protectedRelationshipViolations?: Array<{
        tick: number;
        violations: Array<{
            kind: string;
            strength: number;
        }>;
    }>;
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
export interface GrowthTemplate {
    id: string;
    name: string;
    requiredEra?: string[];
    metadata?: TemplateMetadata;
    contract?: ComponentContract;
    canApply: (graphView: import('../services/templateGraphView').TemplateGraphView) => boolean;
    findTargets: (graphView: import('../services/templateGraphView').TemplateGraphView) => HardState[];
    expand: (graphView: import('../services/templateGraphView').TemplateGraphView, target?: HardState) => TemplateResult;
}
export interface TemplateResult {
    entities: Partial<HardState>[];
    relationships: Relationship[];
    description: string;
}
export interface SimulationSystem {
    id: string;
    name: string;
    metadata?: SystemMetadata;
    contract?: ComponentContract;
    apply: (graph: Graph, modifier: number) => SystemResult;
}
export interface SystemResult {
    relationshipsAdded: Relationship[];
    entitiesModified: Array<{
        id: string;
        changes: Partial<HardState>;
    }>;
    pressureChanges: Record<string, number>;
    description: string;
}
export declare enum ComponentPurpose {
    ENTITY_CREATION = "Creates entities based on prerequisites",
    RELATIONSHIP_CREATION = "Creates relationships based on graph patterns",
    TAG_PROPAGATION = "Spreads tags through relationship networks",
    STATE_MODIFICATION = "Changes entity states based on context",
    PROMINENCE_EVOLUTION = "Adjusts entity prominence over time",
    PRESSURE_ACCUMULATION = "Measures graph state to produce pressure signal",
    CONSTRAINT_ENFORCEMENT = "Enforces population/density limits",
    PHASE_TRANSITION = "Changes era based on conditions",
    BEHAVIORAL_MODIFIER = "Modifies template weights or system frequencies"
}
export interface ComponentContract {
    purpose: ComponentPurpose;
    enabledBy?: {
        pressures?: Array<{
            name: string;
            threshold: number;
        }>;
        entityCounts?: Array<{
            kind: string;
            subtype?: string;
            min: number;
            max?: number;
        }>;
        era?: string[];
        custom?: (graphView: import('../services/templateGraphView').TemplateGraphView) => boolean;
    };
    affects: {
        entities?: Array<{
            kind: string;
            subtype?: string;
            operation: 'create' | 'modify' | 'delete';
            count?: {
                min: number;
                max: number;
            };
        }>;
        relationships?: Array<{
            kind: string;
            operation: 'create' | 'delete';
            count?: {
                min: number;
                max: number;
            };
        }>;
        pressures?: Array<{
            name: string;
            delta?: number;
            formula?: string;
        }>;
        tags?: Array<{
            operation: 'add' | 'remove' | 'propagate';
            pattern: string;
        }>;
    };
}
export interface PressureContract extends Omit<ComponentContract, 'affects'> {
    purpose: ComponentPurpose.PRESSURE_ACCUMULATION;
    sources: Array<{
        component: string;
        delta?: number;
        formula?: string;
    }>;
    sinks: Array<{
        component: string;
        delta?: number;
        formula?: string;
    }>;
    affects?: Array<{
        component: string;
        effect: 'enabler' | 'amplifier' | 'suppressor';
        threshold?: number;
        factor?: number;
    }>;
    equilibrium: {
        expectedRange: [number, number];
        restingPoint: number;
        oscillationPeriod?: number;
    };
}
export interface EntityOperatorRegistry {
    kind: string;
    subtype?: string;
    creators: Array<{
        templateId: string;
        primary: boolean;
        targetCount?: number;
    }>;
    modifiers: Array<{
        systemId: string;
        operation: 'state_change' | 'tag_modification' | 'prominence_change';
    }>;
    lineage: {
        relationshipKind: string;
        findAncestor: (graphView: import('../services/templateGraphView').TemplateGraphView, newEntity: HardState) => HardState | undefined;
        distanceRange: {
            min: number;
            max: number;
        };
    };
    expectedDistribution: {
        targetCount: number;
        prominenceDistribution: Record<string, number>;
    };
}
export interface Pressure {
    id: string;
    name: string;
    value: number;
    growth: (graph: Graph) => number;
    decay: number;
    contract?: PressureContract;
}
export interface EngineConfig {
    domain: DomainSchema;
    eras: Era[];
    templates: GrowthTemplate[];
    systems: SimulationSystem[];
    pressures: Pressure[];
    entityRegistries?: EntityOperatorRegistry[];
    epochLength: number;
    simulationTicksPerGrowth: number;
    targetEntitiesPerKind: number;
    maxTicks: number;
    maxRelationshipsPerType: number;
    relationshipBudget?: {
        maxPerSimulationTick: number;
        maxPerGrowthPhase: number;
    };
    scaleFactor?: number;
    llmConfig?: LLMConfig;
    enrichmentConfig?: EnrichmentConfig;
    loreIndex?: LoreIndex;
    distributionTargets?: DistributionTargets;
}
export interface MetaEntityConfig {
    sourceKind: string;
    metaKind: string;
    trigger: 'epoch_end';
    clustering: {
        minSize: number;
        maxSize?: number;
        criteria: Array<{
            type: 'shared_practitioner' | 'shared_location' | 'same_creator' | 'same_location' | 'shared_tags' | 'temporal_proximity';
            weight: number;
            threshold?: number;
        }>;
        minimumScore: number;
    };
    transformation: {
        markOriginalsHistorical: boolean;
        transferRelationships: boolean;
        redirectFutureRelationships: boolean;
        preserveOriginalLinks: boolean;
        createGovernanceFaction?: boolean;
    };
    factory: (cluster: HardState[], graph: Graph) => Partial<HardState>;
}
export interface Cluster {
    entities: HardState[];
    score: number;
    matchedCriteria: string[];
}
export interface TagMetadata {
    tag: string;
    category: 'status' | 'trait' | 'affiliation' | 'behavior' | 'theme' | 'location';
    rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
    description: string;
    usageCount: number;
    templates: string[];
    entityKinds: string[];
    minUsage?: number;
    maxUsage?: number;
    relatedTags?: string[];
    conflictingTags?: string[];
    consolidateInto?: string;
}
export interface TagHealthReport {
    coverage: {
        totalEntities: number;
        entitiesWithTags: number;
        entitiesWithOptimalTags: number;
        coveragePercentage: number;
        optimalCoveragePercentage: number;
    };
    diversity: {
        uniqueTags: number;
        shannonIndex: number;
        evenness: number;
    };
    issues: {
        orphanTags: Array<{
            tag: string;
            count: number;
        }>;
        overusedTags: Array<{
            tag: string;
            count: number;
            max: number;
        }>;
        conflicts: Array<{
            entityId: string;
            tags: string[];
            conflict: string;
        }>;
        consolidationOpportunities: Array<{
            from: string;
            to: string;
            count: number;
        }>;
    };
    entityIssues: {
        undertagged: string[];
        overtagged: string[];
    };
    recommendations: string[];
}
//# sourceMappingURL=engine.d.ts.map