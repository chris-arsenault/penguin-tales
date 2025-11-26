import { Graph, EngineConfig, HistoryEvent } from '../types/engine';
import { LoreRecord } from '../types/lore';
import { HardState } from '../types/worldTypes';
import { EnrichmentService } from '../services/enrichmentService';
import { ImageGenerationService } from '../services/imageGenerationService';
import { SimulationStatistics, ValidationStats } from '../types/statistics';
export declare class WorldEngine {
    private config;
    private graph;
    private currentEpoch;
    private enrichmentService?;
    private imageGenerationService?;
    private templateSelector?;
    private systemSelector?;
    private distributionTracker?;
    private statisticsCollector;
    private populationTracker;
    private dynamicWeightCalculator;
    private feedbackAnalyzer;
    private contractEnforcer;
    private pendingEnrichments;
    private pendingNameEnrichments;
    private entityEnrichmentsUsed;
    private relationshipEnrichmentsUsed;
    private eraNarrativesUsed;
    private entityEnrichmentQueue;
    private readonly ENRICHMENT_BATCH_SIZE;
    private systemMetrics;
    private lastRelationshipCount;
    private warningLogPath;
    private templateRunCounts;
    private maxRunsPerTemplate;
    private growthBounds;
    private targetSelector;
    private entitySnapshots;
    private enrichmentAnalytics;
    private metaEntitiesFormed;
    constructor(config: EngineConfig, initialState: HardState[], enrichmentService?: EnrichmentService, imageGenerationService?: ImageGenerationService);
    private findEntityByName;
    /**
     * Write warning to log file instead of console
     */
    private logWarning;
    run(): Graph;
    private shouldContinue;
    /**
     * Link final era to prominent entities
     * Called at end of generation since final era never "ends"
     */
    private linkFinalEra;
    private runEpoch;
    /**
     * Validate all declared feedback loops and report broken loops
     */
    private validateFeedbackLoops;
    /**
     * Print comprehensive final feedback system report
     */
    private printFinalFeedbackReport;
    private runGrowthPhase;
    /**
     * Sample a single template with weighted probability
     * Applies diversity pressure to prevent template overuse
     */
    private sampleSingleTemplate;
    /**
     * Calculate dynamic growth target based on remaining entity deficits
     */
    private calculateGrowthTarget;
    /**
     * Calculate entity kind deficits (how underrepresented each kind is)
     */
    private calculateEntityDeficits;
    /**
     * Select templates using weighted randomization based on entity deficits
     */
    private selectWeightedTemplates;
    private runSimulationTick;
    private updatePressures;
    /**
     * Calculate distribution-based system modifier adjustments
     */
    private calculateDistributionSystemModifiers;
    /**
     * Calculate pressure adjustments based on distribution deviation
     * High deviation in certain areas should boost relevant pressures
     */
    private calculateDistributionPressureAdjustments;
    private monitorRelationshipGrowth;
    private pruneAndConsolidate;
    private reportEpochStats;
    /**
     * Report distribution statistics and deviation from targets
     */
    private reportDistributionStats;
    private waitForNameEnrichmentsSnapshot;
    private syncNameTags;
    private enrichInitialEntities;
    private queueEntityEnrichment;
    private flushEntityEnrichmentQueue;
    private queueRelationshipEnrichment;
    /**
     * Queue occurrence enrichment
     * Called after occurrence creation systems run
     */
    private queueOccurrenceEnrichment;
    /**
     * Queue era enrichment
     * Called after era transitions
     */
    private queueEraEnrichment;
    private queueChangeEnrichments;
    private snapshotEntity;
    private queueEraNarrative;
    private queueDiscoveryEnrichment;
    private buildEnrichmentContext;
    /**
     * Queue image generation for mythic entities
     * Called at the end of world generation
     */
    generateMythicImages(): Promise<void>;
    getGraph(): Graph;
    getLoreRecords(): LoreRecord[];
    finalizeNameLogging(): void;
    getHistory(): HistoryEvent[];
    finalizeEnrichments(): Promise<void>;
    exportState(): any;
    /**
     * Export statistics for fitness evaluation
     */
    exportStatistics(validationResults: ValidationStats): SimulationStatistics;
}
//# sourceMappingURL=worldEngine.d.ts.map