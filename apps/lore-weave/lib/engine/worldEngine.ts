import { Graph, GraphStore, EngineConfig, Era, GrowthTemplate, HistoryEvent, Pressure, SimulationSystem } from '../engine/types';
import { createPressureFromDeclarative, evaluatePressureGrowthWithBreakdown } from './pressureInterpreter';
import { DeclarativePressure } from './declarativePressureTypes';
import { TemplateInterpreter, createTemplateFromDeclarative } from './templateInterpreter';
import { DeclarativeTemplate } from './declarativeTypes';
import { createSystemFromDeclarative, DeclarativeSystem, DeclarativeGrowthSystem, isDeclarativeSystem } from './systemInterpreter';
import { loadActions } from './actionInterpreter';
import { HardState, Relationship } from '../core/worldTypes';
import {
  generateId,
  addRelationship,
  modifyRelationshipStrength,
  updateEntity,
  pickRandom,
  weightedRandom,
  findEntities,
  getProminenceValue,
  hasTag
} from '../utils';
import { initializeCatalystSmart } from '../systems/catalystHelpers';
import { selectEra, getTemplateWeight, getSystemModifier } from '../engine/eraUtils';
import { TemplateSelector } from '../selection/templateSelector';
import { SystemSelector } from '../selection/systemSelector';
import { DistributionTracker } from '../statistics/distributionTracker';
import { StatisticsCollector } from '../statistics/statisticsCollector';
import { PopulationTracker, PopulationMetrics } from '../statistics/populationTracker';
import { DynamicWeightCalculator } from '../selection/dynamicWeightCalculator';
import { TargetSelector } from '../selection/targetSelector';
import { WorldRuntime } from '../runtime/worldRuntime';
import { CoordinateContext } from '../coordinates/coordinateContext';
import { coordinateStats } from '../coordinates/coordinateStatistics';
import { SimulationStatistics, ValidationStats } from '../statistics/types';
import { FrameworkValidator } from './frameworkValidator';
import { ContractEnforcer } from './contractEnforcer';
import { FRAMEWORK_ENTITY_KINDS, FRAMEWORK_STATUS, FRAMEWORK_TAGS } from '@canonry/world-schema';
import { createEraEntity } from '../systems/eraSpawner';
import type {
  ISimulationEmitter,
  PressureChangeDetail,
  DiscretePressureModification,
  PressureModificationSource
} from '../observer/types';
import { NameForgeService } from '../naming/nameForgeService';
import type { NameGenerationService } from './types';
import { createGrowthSystem, GrowthSystem, GrowthEpochSummary } from '../systems/growthSystem';

// Change detection functions moved to @illuminator/lib/engine/changeDetection.ts
// EntitySnapshot interface and detect*Changes functions available there

export class WorldEngine {
  private config: EngineConfig;
  private emitter: ISimulationEmitter;  // REQUIRED - emits all simulation events
  private runtimePressures: Pressure[];  // Converted from declarative pressures
  private declarativePressures: Map<string, DeclarativePressure>;  // Original declarative pressures for breakdown
  private runtimeTemplates: GrowthTemplate[];  // Converted from declarative templates
  private declarativeTemplates: Map<string, DeclarativeTemplate>;  // Original declarative templates for diagnostics
  private runtimeSystems: SimulationSystem[];  // Converted from declarative systems
  private growthSystem?: GrowthSystem;  // Distributed growth system (framework-managed)
  private templateInterpreter: TemplateInterpreter;  // Interprets declarative templates
  private graph: Graph;
  private runtime!: WorldRuntime;
  private currentEpoch: number;
  private startTime: number = 0;  // Track simulation duration
  private templateSelector?: TemplateSelector;  // Optional statistical template selector
  private systemSelector?: SystemSelector;      // Optional statistical system weighting
  private distributionTracker?: DistributionTracker;  // Distribution measurement
  private statisticsCollector: StatisticsCollector;  // Statistics tracking for fitness evaluation
  private populationTracker: PopulationTracker;  // Population metrics for homeostatic control
  private dynamicWeightCalculator: DynamicWeightCalculator;  // Dynamic template weight adjustment
  private contractEnforcer: ContractEnforcer;  // Active contract enforcement
  // Enrichment tracking moved to @illuminator
  // private pendingEnrichments: Promise<void>[] = [];
  // private pendingNameEnrichments: Promise<void>[] = [];
  // private entityEnrichmentsUsed = 0;
  // private relationshipEnrichmentsUsed = 0;
  // private eraNarrativesUsed = 0;
  // private entityEnrichmentQueue: HardState[] = [];
  // private readonly ENRICHMENT_BATCH_SIZE = 15;

  // Engine-level safeguards
  private systemMetrics: Map<string, { relationshipsCreated: number; lastThrottleCheck: number }> = new Map();
  private lastRelationshipCount: number = 0;

  // Template diversity tracking
  private templateRunCounts: Map<string, number> = new Map();
  // DIVERSITY PRESSURE: Track template usage frequency to enforce variety
  // Hard cap per template (scaled by config.scaleFactor)
  private maxRunsPerTemplate: number;
  // Growth target bounds (min, max) - scaled by config.scaleFactor
  private growthBounds: { min: number; max: number };
  // Track growth output per epoch for diagnostics/emissions
  private lastGrowthSummary: GrowthEpochSummary | null = null;

  // Target selection service (prevents super-hub formation)
  private targetSelector: TargetSelector;

  // Coordinate context (shared across all templates/systems)
  private coordinateContext: CoordinateContext;

  // Name generation service (created from cultures config)
  private nameForgeService: NameGenerationService | null = null;

  // Change detection moved to @illuminator
  // private entitySnapshots = new Map<string, EntitySnapshot>();
  // private enrichmentAnalytics = { ... };

  // Meta-entity formation tracking
  private metaEntitiesFormed: Array<{
    tick: number;
    epoch: number;
    metaEntityId: string;
    metaEntityName: string;
    sourceKind: string;
    clusterSize: number;
    clusterIds: string[];
  }> = [];

  // Pressure modification tracking - accumulates discrete changes per tick
  private pendingPressureModifications: DiscretePressureModification[] = [];

  // Starting pressure values for each tick (captured before any modifications)
  private tickStartPressures: Map<string, number> = new Map();
  
  constructor(
    config: EngineConfig,
    initialState: HardState[]
  ) {
    // REQUIRED: Emitter must be provided - no fallback to console.log
    if (!config.emitter) {
      throw new Error(
        'WorldEngine: emitter is required in EngineConfig. ' +
        'Provide a SimulationEmitter instance that handles simulation events.'
      );
    }
    if (!config.schema) {
      throw new Error(
        'WorldEngine: schema is required in EngineConfig. ' +
        'Provide the canonical world schema used to run the simulation.'
      );
    }
    this.emitter = config.emitter;
    this.config = config;

    // Emit initializing progress
    this.emitter.progress({
      phase: 'initializing',
      tick: 0,
      maxTicks: config.maxTicks,
      epoch: 0,
      totalEpochs: this.getTotalEpochs(),
      entityCount: initialState.length,
      relationshipCount: 0
    });

    // Convert declarative pressures to runtime pressures
    // If pressure already has a growth function, it's already a runtime Pressure - use as-is
    // Also store declarative definitions for detailed breakdown in pressure_update events
    this.declarativePressures = new Map();
    this.runtimePressures = config.pressures.map(p => {
      const runtimePressure = p as any;
      if (runtimePressure.homeostasis === undefined) {
        throw new Error(`Pressure '${runtimePressure.id}' is missing required homeostasis parameter.`);
      }
      if (typeof runtimePressure.growth === 'function') {
        throw new Error(`Pressure '${runtimePressure.id}' must be declarative. Runtime pressure objects are no longer supported.`);
      }
      // Store declarative pressure for breakdown
      this.declarativePressures.set(p.id, p);
      return createPressureFromDeclarative(p);
    });

    // Convert declarative templates to runtime templates
    // If template already has canApply function, it's already a GrowthTemplate - use as-is
    this.templateInterpreter = new TemplateInterpreter();
    this.declarativeTemplates = new Map();
    this.runtimeTemplates = config.templates.map(t => {
      if (typeof (t as any).canApply === 'function') {
        // Already a GrowthTemplate (e.g., from tests)
        return t as unknown as GrowthTemplate;
      }
      // Store declarative template for diagnostics
      this.declarativeTemplates.set(t.id, t);
      return createTemplateFromDeclarative(t, this.templateInterpreter);
    });

    // Convert declarative actions to runtime executable actions
    // These are used by the universalCatalyst system
    if (config.actions && config.actions.length > 0) {
      config.executableActions = loadActions(config.actions);
    }

    this.statisticsCollector = new StatisticsCollector();
    this.currentEpoch = 0;

    // Initialize scaled values
    const scale = config.scaleFactor || 1.0;
    // Scale maxRunsPerTemplate more aggressively (1.5 exponent) to handle
    // cases where only a subset of templates are applicable in early epochs
    // INCREASED: From 12 to 20 to prevent template starvation in later epochs
    this.maxRunsPerTemplate = Math.ceil(20 * Math.pow(scale, 1.5));
    this.growthBounds = {
      min: Math.ceil(3 * scale),
      max: Math.ceil(25 * scale)
    };

    // Emit validating progress
    this.emitter.progress({
      phase: 'validating',
      tick: 0,
      maxTicks: config.maxTicks,
      epoch: 0,
      totalEpochs: this.getTotalEpochs(),
      entityCount: initialState.length,
      relationshipCount: 0
    });

    // Framework Validation
    const validator = new FrameworkValidator(config);
    const validationResult = validator.validate();

    // Emit validation result
    this.emitter.validation({
      status: validationResult.errors.length > 0 ? 'failed' : 'success',
      errors: validationResult.errors,
      warnings: validationResult.warnings
    });

    // Throw on validation errors
    if (validationResult.errors.length > 0) {
      const errorDetails = validationResult.errors.join('\n  - ');
      this.emitter.error({
        message: `Framework validation failed with ${validationResult.errors.length} error(s):\n  - ${errorDetails}`,
        phase: 'validation',
        context: { errors: validationResult.errors }
      });
      throw new Error(`Framework validation failed with ${validationResult.errors.length} error(s):\n  - ${errorDetails}`);
    }

    this.emitter.log('info', 'Framework validation passed');

    // Initialize statistical distribution system if targets are provided
    if (config.distributionTargets) {
      this.distributionTracker = new DistributionTracker(config.distributionTargets);
      this.templateSelector = new TemplateSelector(config.distributionTargets, this.runtimeTemplates);
      this.systemSelector = new SystemSelector(config.distributionTargets);
      this.emitter.log('info', 'Statistical template selection enabled');
      this.emitter.log('info', 'Statistical system weighting enabled');
    }

    // Initialize homeostatic control system
    this.populationTracker = new PopulationTracker(
      config.distributionTargets || {} as any,
      config.schema
    );
    this.dynamicWeightCalculator = new DynamicWeightCalculator();
    this.emitter.log('info', 'Population tracking enabled');

    // Initialize contract enforcement system
    this.contractEnforcer = new ContractEnforcer(config);
    this.emitter.log('info', 'Contract enforcement enabled', {
      features: [
        'Template filtering by applicability rules',
        'Automatic lineage relationship creation',
        'Contract affects validation'
      ]
    });

    // Initialize target selector (prevents super-hub formation)
    this.targetSelector = new TargetSelector();
    this.emitter.log('info', 'Intelligent target selection enabled (anti-super-hub)');

    // Initialize NameForgeService from schema cultures that have naming config
    // Must be done before CoordinateContext since it requires nameForgeService
    const schemaCultures = config.schema.cultures;
    if (!schemaCultures || schemaCultures.length === 0) {
      throw new Error(
        'WorldEngine: schema.cultures is required in EngineConfig. ' +
        'Provide cultures with naming configuration for name generation.'
      );
    }
    const culturesWithNaming = schemaCultures.filter(c => c.naming);
    if (culturesWithNaming.length === 0) {
      throw new Error(
        'WorldEngine: No cultures have naming configuration. ' +
        'At least one culture must have a naming property for name generation.'
      );
    }
    this.nameForgeService = new NameForgeService(culturesWithNaming, this.emitter);
    // Set on config so Graph can access it for entity name generation
    this.config.nameForgeService = this.nameForgeService;
    this.emitter.log('info', 'NameForgeService initialized', {
      cultures: culturesWithNaming.length,
      cultureIds: culturesWithNaming.map(c => c.id)
    });

    // Initialize coordinate context (REQUIRED - no fallbacks)
    const coordinateConfig = {
      schema: config.schema,
      defaultMinDistance: config.defaultMinDistance,
      nameForgeService: this.nameForgeService,
    };
    this.coordinateContext = new CoordinateContext(coordinateConfig);
    this.emitter.log('info', 'Coordinate context initialized', {
      cultures: this.coordinateContext.getCultureIds().length,
      entityKinds: this.coordinateContext.getConfiguredKinds().length,
      defaultMinDistance: config.defaultMinDistance ?? 5
    });

    // Build runtime systems (including new distributed growth system)
    const runtimeSystems: SimulationSystem[] = [];
    const growthDependencies = {
      engineConfig: this.config,
      runtimeTemplates: this.runtimeTemplates,
      declarativeTemplates: this.declarativeTemplates,
      templateInterpreter: this.templateInterpreter,
      populationTracker: this.populationTracker,
      contractEnforcer: this.contractEnforcer,
      templateRunCounts: this.templateRunCounts,
      maxRunsPerTemplate: this.maxRunsPerTemplate,
      statisticsCollector: this.statisticsCollector,
      emitter: this.emitter,
      getPendingPressureModifications: () => this.pendingPressureModifications,
      trackPressureModification: this.trackPressureModification.bind(this),
      calculateGrowthTarget: () => this.calculateGrowthTarget(),
      sampleTemplate: (era: Era, templates: GrowthTemplate[], metrics: PopulationMetrics) => this.sampleSingleTemplate(era, templates, metrics),
      getCurrentEpoch: () => this.currentEpoch
    };

    for (const sys of config.systems) {
      if (typeof (sys as any).apply === 'function') {
        const runtime = sys as SimulationSystem;
        if (!this.growthSystem && (runtime.id === 'growth' || runtime.id === 'framework-growth')) {
          this.growthSystem = runtime as GrowthSystem;
          continue;
        }
        runtimeSystems.push(runtime);
        continue;
      }

      if (isDeclarativeSystem(sys) && (sys as DeclarativeGrowthSystem).systemType === 'growth') {
        if (this.growthSystem) {
          throw new Error('Multiple growth systems configured. Only one growth system is supported.');
        }
        this.growthSystem = createGrowthSystem((sys as DeclarativeGrowthSystem).config, growthDependencies);
        continue;
      }

      runtimeSystems.push(createSystemFromDeclarative(sys as DeclarativeSystem));
    }

    if (!this.growthSystem) {
      this.growthSystem = createGrowthSystem(
        {
          id: 'framework-growth',
          name: 'Framework Growth',
          description: 'Distributes template growth across simulation ticks'
        },
        growthDependencies
      );
      this.config.systems.push({
        systemType: 'growth',
        config: {
          id: 'framework-growth',
          name: 'Framework Growth',
          description: 'Distributes template growth across simulation ticks'
        }
      } as DeclarativeGrowthSystem);
    }

    this.runtimeSystems = this.growthSystem
      ? [this.growthSystem, ...runtimeSystems]
      : runtimeSystems;

    // Initialize any systems that have an initialize() method
    for (const system of this.runtimeSystems) {
      if (system.initialize) {
        system.initialize();
      }
    }

    // Meta-entity formation is now handled by SimulationSystems (magicSchoolFormation, etc.)
    // These systems run at epoch end and use the clustering/archival utilities

    // Initialize graph from initial state using GraphStore
    this.graph = GraphStore.create(config.eras[0], config.pressures);
    // LLM loreIndex moved to @illuminator
    // Override rate limit state defaults
    this.graph.rateLimitState = {
      currentThreshold: 0.3,  // Base threshold
      lastCreationTick: -999,  // Start far in past so first creation can happen
      creationsThisEpoch: 0
    };

    this.runtime = new WorldRuntime(this.graph, this.targetSelector, this.coordinateContext, this.config);
    
    // Load initial entities and initialize catalysts
    initialState.forEach(entity => {
      const id = entity.id || generateId(entity.kind);
      const coordinates = entity.coordinates;
      if (!coordinates || typeof coordinates.x !== 'number' || typeof coordinates.y !== 'number' || typeof coordinates.z !== 'number') {
        throw new Error(
          `WorldEngine: initial entity "${entity.name}" (${entity.kind}) has invalid coordinates. ` +
          `Expected {x, y, z} numbers, received: ${JSON.stringify(coordinates)}.`
        );
      }
      if (!entity.culture || entity.culture.startsWith('$')) {
        throw new Error(
          `WorldEngine: initial entity "${entity.name}" (${entity.kind}) has invalid culture "${entity.culture}".`
        );
      }

      const loadedEntity: HardState = {
        ...entity,
        id,
        coordinates,
        createdAt: 0,
        updatedAt: 0
      };

      // Initialize catalyst properties for prominent entities
      // Pass graph for domain-specific action domain mapping
      initializeCatalystSmart(loadedEntity);

      this.graph._loadEntity(id, loadedEntity);
    });

    // Load relationships from seedRelationships array
    if (config.seedRelationships) {
      config.seedRelationships.forEach(rel => {
        const srcEntity = this.graph.getEntity(rel.src) || this.findEntityByName(rel.src);
        const dstEntity = this.graph.getEntity(rel.dst) || this.findEntityByName(rel.dst);

        if (srcEntity && dstEntity) {
          this.graph.addRelationship(
            rel.kind,
            srcEntity.id,
            dstEntity.id,
            rel.strength,
            rel.distance
          );
        }
      });
    }

    // Record initial state as first history event
    const initialEntityIds = this.graph.getEntityIds();
    const initialRelationships = this.graph.getRelationships();
    this.graph.history.push({
      tick: 0,
      era: config.eras[0].id,
      type: 'special',
      description: `World initialized: ${initialEntityIds.length} entities, ${initialRelationships.length} relationships`,
      entitiesCreated: initialEntityIds,
      relationshipsCreated: initialRelationships,
      entitiesModified: []
    });
  }

  private findEntityByName(name: string): HardState | undefined {
    const entities = this.graph.getEntities();
    for (const entity of entities) {
      if (entity.name === name || entity.id === name) {
        return entity;
      }
    }
    return undefined;
  }

  /**
   * Emit warning via emitter and record in statistics
   */
  private logWarning(message: string): void {
    // Record warning in statistics
    if (message.includes('BUDGET')) {
      this.statisticsCollector.recordWarning('budget');
    } else if (message.includes('AGGRESSIVE SYSTEM')) {
      const match = message.match(/AGGRESSIVE SYSTEM: (\S+)/);
      if (match) {
        this.statisticsCollector.recordWarning('aggressive', match[1]);
      }
    } else if (message.includes('GROWTH RATE')) {
      this.statisticsCollector.recordWarning('growth');
    }

    this.emitter.log('warn', message, { tick: this.graph.tick });
  }

  // Simulation state tracking
  private simulationStarted: boolean = false;
  private simulationComplete: boolean = false;

  /**
   * Initialize simulation (called once before stepping or running)
   */
  private initializeSimulation(): void {
    if (this.simulationStarted) return;

    this.startTime = Date.now();
    this.simulationStarted = true;

    this.emitter.log('info', 'Starting world generation...');
    this.emitter.log('info', `Initial state: ${this.graph.getEntityCount()} entities`);

    // Ensure first era entity exists BEFORE any growth phase runs
    // This is critical so entities created in the first growth phase can have ORIGINATED_IN relationships
    this.ensureFirstEraExists();

    // Reset coordinate statistics for this run
    coordinateStats.reset();

    // Emit running progress
    this.emitProgress('running');
  }

  /**
   * Ensure the first era entity exists in the graph.
   * This must be called before the first growth phase so that ORIGINATED_IN
   * relationships can be created for all template-generated entities.
   */
  private ensureFirstEraExists(): void {
    // Check if any era entities already exist
    const existingEras = this.graph.findEntities({ kind: FRAMEWORK_ENTITY_KINDS.ERA });

    if (existingEras.length > 0) {
      // Era already exists - nothing to do
      return;
    }

    // Get first era from config
    const configEras = this.config.eras;
    if (!configEras || configEras.length === 0) {
      this.emitter.log('warn', 'No eras defined in config - entities will not have ORIGINATED_IN relationships');
      return;
    }

    // Create the first era entity
    const firstEraConfig = configEras[0];
    const { entity: firstEra } = createEraEntity(
      firstEraConfig,
      this.graph.tick,
      FRAMEWORK_STATUS.CURRENT
    );

    // Add era entity to graph directly (bypasses addEntity to avoid circular ORIGINATED_IN)
    this.graph._loadEntity(firstEra.id, firstEra);

    this.emitter.log('info', `[WorldEngine] Initialized first era: ${firstEraConfig.name}`);
  }

  /**
   * Emit current progress state
   */
  private emitProgress(phase: 'initializing' | 'validating' | 'running' | 'finalizing'): void {
    this.emitter.progress({
      phase,
      tick: this.graph.tick,
      maxTicks: this.config.maxTicks,
      epoch: this.currentEpoch,
      totalEpochs: this.getTotalEpochs(),
      entityCount: this.graph.getEntityCount(),
      relationshipCount: this.graph.getRelationshipCount()
    });
  }

  /**
   * Run a single epoch (step mode)
   * @returns true if more epochs remain, false if simulation should end
   */
  public async step(): Promise<boolean> {
    // Initialize on first step
    this.initializeSimulation();

    if (this.simulationComplete) {
      return false;
    }

    if (!this.shouldContinue()) {
      // Simulation naturally ended
      await this.finalize();
      return false;
    }

    // Run one epoch
    await this.runEpoch();
    this.currentEpoch++;

    // Check if we should continue
    if (!this.shouldContinue()) {
      await this.finalize();
      return false;
    }

    // Emit progress after epoch
    this.emitProgress('running');
    return true;
  }

  /**
   * Finalize the simulation (call after last step or automatically at end of run)
   */
  public async finalize(): Promise<Graph> {
    if (this.simulationComplete) {
      return this.graph;
    }

    this.simulationComplete = true;

    // Link final era to prominent entities (since it never "ends")
    this.linkFinalEra();

    // Emit finalizing progress
    this.emitProgress('finalizing');

    this.emitter.log('info', 'Generation complete!');
    this.emitter.log('info', `Final state: ${this.graph.getEntityCount()} entities, ${this.graph.getRelationshipCount()} relationships`);

    // Emit final reports
    this.emitFinalFeedbackReport();
    this.emitCoordinateStats();

    // Emit completion event
    this.emitCompleteEvent();

    return this.graph;
  }

  /**
   * Check if simulation is complete
   */
  public isComplete(): boolean {
    return this.simulationComplete;
  }

  /**
   * Get current epoch number
   */
  public getCurrentEpoch(): number {
    return this.currentEpoch;
  }

  /**
   * Get total expected epochs
   */
  public getTotalEpochs(): number {
    if (this.config.maxEpochs === undefined) {
      throw new Error('WorldEngine config missing required maxEpochs');
    }
    return this.config.maxEpochs;
  }

  /**
   * Reset simulation to initial state (for step mode)
   * Allows re-running the simulation from the beginning
   */
  public reset(initialState: HardState[]): void {
    // Reset simulation state
    this.simulationStarted = false;
    this.simulationComplete = false;
    this.currentEpoch = 0;
    this.startTime = 0;

    // Reset tracking maps
    this.templateRunCounts.clear();
    this.systemMetrics.clear();
    this.metaEntitiesFormed = [];
    this.lastRelationshipCount = 0;
    this.lastGrowthSummary = null;
    this.growthSystem?.reset();

    // Reset coordinate statistics
    coordinateStats.reset();

    // Recreate graph from initial state
    this.graph = GraphStore.create(this.config.eras[0], this.config.pressures);
    this.graph.rateLimitState = {
      currentThreshold: 0.3,
      lastCreationTick: -999,
      creationsThisEpoch: 0
    };

    this.runtime = new WorldRuntime(this.graph, this.targetSelector, this.coordinateContext, this.config);

    // Reload initial entities
    initialState.forEach(entity => {
      const id = entity.id || generateId(entity.kind);
      const coordinates = entity.coordinates;
      if (!coordinates || typeof coordinates.x !== 'number' || typeof coordinates.y !== 'number' || typeof coordinates.z !== 'number') {
        throw new Error(
          `WorldEngine: initial entity "${entity.name}" (${entity.kind}) has invalid coordinates. ` +
          `Expected {x, y, z} numbers, received: ${JSON.stringify(coordinates)}.`
        );
      }
      if (!entity.culture || entity.culture.startsWith('$')) {
        throw new Error(
          `WorldEngine: initial entity "${entity.name}" (${entity.kind}) has invalid culture "${entity.culture}".`
        );
      }

      const loadedEntity: HardState = {
        ...entity,
        id,
        coordinates,
        createdAt: 0,
        updatedAt: 0
      };

      initializeCatalystSmart(loadedEntity);
      this.graph._loadEntity(id, loadedEntity);
    });

    // Reload seed relationships
    if (this.config.seedRelationships) {
      this.config.seedRelationships.forEach(rel => {
        const srcEntity = this.graph.getEntity(rel.src) || this.findEntityByName(rel.src);
        const dstEntity = this.graph.getEntity(rel.dst) || this.findEntityByName(rel.dst);

        if (srcEntity && dstEntity) {
          this.graph.addRelationship(
            rel.kind,
            srcEntity.id,
            dstEntity.id,
            rel.strength,
            rel.distance
          );
        }
      });
    }

    // Record initial state as first history event
    const initialEntityIds = this.graph.getEntityIds();
    const initialRelationships = this.graph.getRelationships();
    this.graph.history.push({
      tick: 0,
      era: this.config.eras[0].id,
      type: 'special',
      description: `World reset: ${initialEntityIds.length} entities, ${initialRelationships.length} relationships`,
      entitiesCreated: initialEntityIds,
      relationshipsCreated: initialRelationships,
      entitiesModified: []
    });

    this.emitter.log('info', 'Simulation reset to initial state');
    this.emitter.progress({
      phase: 'initializing',
      tick: 0,
      maxTicks: this.config.maxTicks,
      epoch: 0,
      totalEpochs: this.getTotalEpochs(),
      entityCount: this.graph.getEntityCount(),
      relationshipCount: this.graph.getRelationshipCount()
    });
  }

  // Main execution loop - runs all epochs to completion
  public async run(): Promise<Graph> {
    this.initializeSimulation();

    while (this.shouldContinue()) {
      await this.runEpoch();
      this.currentEpoch++;
    }

    return this.finalize();
  }
  
  private shouldContinue(): boolean {
    // PRIORITY 1: Complete all eras (each era should run ~2 epochs)
    const allErasCompleted = this.currentEpoch >= this.getTotalEpochs();

    // PRIORITY 2: Respect maximum tick limit (safety valve)
    const hitTickLimit = this.graph.tick >= this.config.maxTicks;

    // PRIORITY 3: Excessive growth safety valve (only if WAY over target AND all eras done)
    const scale = this.config.scaleFactor || 1.0;
    const safetyLimit = this.config.targetEntitiesPerKind * 10 * scale; // 10x target (scaled)
    const excessiveGrowth = this.graph.getEntityCount() >= safetyLimit;

    // Stop only if:
    // - Hit tick limit, OR
    // - Completed all eras AND (hit tick limit OR excessive growth)
    if (hitTickLimit) {
      this.emitter.log('warn', `Stopped: Hit maximum tick limit (${this.config.maxTicks})`);
      return false;
    }

    if (allErasCompleted) {
      if (excessiveGrowth) {
        this.emitter.log('warn', `Stopped: All eras complete + excessive growth (${this.graph.getEntityCount()} entities)`);
        return false;
      }
      this.emitter.log('info', `All eras completed at epoch ${this.currentEpoch}`);
      return false;
    }

    return true;
  }

  /**
   * Link final era to prominent entities
   * Called at end of generation since final era never "ends"
   */
  private linkFinalEra(): void {
    // Find current era entity
    const eraEntities = this.graph.findEntities({ kind: FRAMEWORK_ENTITY_KINDS.ERA, status: FRAMEWORK_STATUS.CURRENT });
    const currentEra = eraEntities[0];

    if (!currentEra || !currentEra.temporal) return;

    const eraStartTick = currentEra.temporal.startTick;

    // Find prominent entities created during this era (include 'recognized' for better coverage)
    const allEntities = this.graph.getEntities();
    const prominentEntities = allEntities.filter(e =>
      (e.prominence === 'recognized' || e.prominence === 'renowned' || e.prominence === 'mythic') &&
      e.kind !== FRAMEWORK_ENTITY_KINDS.ERA &&
      e.createdAt >= eraStartTick
    );

    // If no prominent entities from this era, link to most prominent entities from any time
    const entitiesToLink = prominentEntities.length > 0
      ? prominentEntities
      : allEntities
          .filter(e => (e.prominence === 'renowned' || e.prominence === 'mythic') && e.kind !== FRAMEWORK_ENTITY_KINDS.ERA)
          .sort((a, b) => {
            const prominenceOrder = { mythic: 3, renowned: 2, recognized: 1, marginal: 0, forgotten: 0 };
            return (prominenceOrder[b.prominence] || 0) - (prominenceOrder[a.prominence] || 0);
          });

    // Link up to 10 most prominent entities
    let linkedCount = 0;
    entitiesToLink.slice(0, 10).forEach(entity => {
      addRelationship(this.graph, 'active_during', entity.id, currentEra.id);
      linkedCount++;
    });

    if (linkedCount > 0) {
      this.emitter.log('info', `Linked final era "${currentEra.name}" to ${linkedCount} prominent entities`);
    }
  }

  private async runEpoch(): Promise<void> {
    // Era progression is handled by eraTransition system, not selectEra()
    // The eraTransition system manages era entity status and updates graph.currentEra
    const previousEra = this.graph.currentEra;
    const era = this.graph.currentEra;

    // Emit epoch start event
    this.emitter.epochStart({
      epoch: this.currentEpoch,
      era: {
        id: era.id,
        name: era.name,
        description: era.description
      },
      tick: this.graph.tick
    });

    // Reset rate limit counter for new epoch
    this.graph.rateLimitState.creationsThisEpoch = 0;

    // Track initial counts for statistics
    const initialEntityCount = this.graph.getEntityCount();
    const initialRelationshipCount = this.graph.getRelationshipCount();

    // Initialize distributed growth for this epoch
    if (!this.growthSystem) {
      throw new Error('Growth system was not initialized');
    }
    this.growthSystem.startEpoch(era);
    this.lastGrowthSummary = null;

    // Simulation phase
    for (let i = 0; i < this.config.ticksPerEpoch; i++) {
      // Capture pressure values BEFORE any modifications this tick
      // This ensures previousValue in pressure_update reflects true start-of-tick values
      this.tickStartPressures.clear();
      for (const [pressureId, value] of this.graph.pressures) {
        this.tickStartPressures.set(pressureId, value);
      }

      // Run simulation tick first so system pressure changes are tracked
      await this.runSimulationTick(era);

      // Update pressures (calculates feedback, emits pressure_update with all mods from this tick)
      this.updatePressures(era);
      this.graph.tick++;

      // Emit progress every few ticks
      if (i % 5 === 0) {
        this.emitter.progress({
          phase: 'running',
          tick: this.graph.tick,
          maxTicks: this.config.maxTicks,
          epoch: this.currentEpoch,
          totalEpochs: this.getTotalEpochs(),
          entityCount: this.graph.getEntityCount(),
          relationshipCount: this.graph.getRelationshipCount()
        });
      }
    }

    // Capture growth summary for this epoch
    this.lastGrowthSummary = this.growthSystem.completeEpoch();
    this.emitter.growthPhase({
      epoch: this.currentEpoch,
      entitiesCreated: this.lastGrowthSummary.entitiesCreated,
      target: this.lastGrowthSummary.target,
      templatesApplied: this.lastGrowthSummary.templatesUsed
    });

    // Apply era special rules if any
    if (era.specialRules) {
      era.specialRules(this.runtime);
    }

    // Meta-entity formation is now handled by SimulationSystems (run at epoch end)

    // Prune and consolidate
    this.pruneAndConsolidate();

    // Record epoch statistics
    const entitiesCreated = this.graph.getEntityCount() - initialEntityCount;
    const relationshipsCreated = this.graph.getRelationshipCount() - initialRelationshipCount;
    this.statisticsCollector.recordEpoch(
      this.graph,
      this.currentEpoch,
      entitiesCreated,
      relationshipsCreated,
      this.lastGrowthSummary?.target ?? 0
    );

    // Emit epoch stats
    this.emitEpochStats(era, entitiesCreated, relationshipsCreated, this.lastGrowthSummary?.target ?? 0);

    // Emit diagnostics (updated each epoch for visibility during stepping)
    this.emitDiagnostics();

    // Emit feedback reports (population, template usage, system health)
    // so dashboards update during stepping, not just at finalize
    this.emitEpochFeedback();

    this.queueEraNarrative(previousEra, era);

    // Check for significant entity changes and enrich them
    this.queueChangeEnrichments();
  }

  /**
   * Emit epoch statistics via emitter
   */
  private emitEpochStats(era: Era, entitiesCreated: number, relationshipsCreated: number, growthTarget: number): void {
    const byKind: Record<string, number> = {};
    this.graph.forEachEntity((entity) => {
      byKind[entity.kind] = (byKind[entity.kind] || 0) + 1;
    }, { includeHistorical: true });

    this.emitter.epochStats({
      epoch: this.currentEpoch,
      era: era.name,
      entitiesByKind: byKind,
      relationshipCount: this.graph.getRelationshipCount({ includeHistorical: true }),
      pressures: Object.fromEntries(this.graph.pressures),
      entitiesCreated,
      relationshipsCreated,
      growthTarget
    });
  }

  /**
   * Emit final population report via emitter
   */
  private emitFinalFeedbackReport(): void {
    // Update metrics one final time
    this.populationTracker.update(this.graph);
    const metrics = this.populationTracker.getMetrics();
    const summary = this.populationTracker.getSummary();
    const outliers = this.populationTracker.getOutliers(0.3);

    // Build entity metrics array
    const entityMetrics = Array.from(metrics.entities.values())
      .filter(m => m.target > 0)
      .map(m => ({
        kind: m.kind,
        subtype: m.subtype,
        count: m.count,
        target: m.target,
        deviation: m.deviation
      }));

    // Build pressure metrics array
    const pressureMetrics: Array<{ id: string; value: number; target: number; deviation: number }> = [];
    summary.pressureDeviations.forEach((deviation, pressureId) => {
      const metric = metrics.pressures.get(pressureId);
      if (metric) {
        pressureMetrics.push({
          id: pressureId,
          value: metric.value,
          target: metric.target,
          deviation
        });
      }
    });

    this.emitter.populationReport({
      totalEntities: summary.totalEntities,
      totalRelationships: summary.totalRelationships,
      avgDeviation: summary.avgEntityDeviation,
      maxDeviation: summary.maxEntityDeviation,
      entityMetrics,
      pressureMetrics,
      outliers: {
        overpopulated: outliers.overpopulated.map(m => ({
          kind: m.kind,
          subtype: m.subtype,
          count: m.count,
          target: m.target,
          deviation: m.deviation
        })),
        underpopulated: outliers.underpopulated.map(m => ({
          kind: m.kind,
          subtype: m.subtype,
          count: m.count,
          target: m.target,
          deviation: m.deviation
        }))
      }
    });

    // Emit template usage report
    const sortedTemplates = Array.from(this.templateRunCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    const totalRuns = sortedTemplates.reduce((sum, [_, count]) => sum + count, 0);

    const unusedTemplates = this.runtimeTemplates.filter(t => !this.templateRunCounts.has(t.id));
    const diagnosticView = this.runtime;

    this.emitter.templateUsage({
      totalApplications: totalRuns,
      uniqueTemplatesUsed: sortedTemplates.length,
      totalTemplates: this.runtimeTemplates.length,
      maxRunsPerTemplate: this.maxRunsPerTemplate,
      usage: sortedTemplates.slice(0, 20).map(([templateId, count]) => ({
        templateId,
        count,
        percentage: totalRuns > 0 ? (count / totalRuns) * 100 : 0,
        status: count >= this.maxRunsPerTemplate ? 'saturated' as const :
                count >= this.maxRunsPerTemplate * 0.7 ? 'warning' as const : 'healthy' as const
      })),
      unusedTemplates: unusedTemplates.map(t => {
        const declarativeTemplate = this.declarativeTemplates.get(t.id);
        if (declarativeTemplate) {
          const diagnosis = this.templateInterpreter.diagnoseCanApply(declarativeTemplate, diagnosticView);
          const summary = diagnosis.failedRules.length > 0
            ? `Failed: ${diagnosis.failedRules[0].split(':')[0]}`
            : diagnosis.selectionCount === 0
              ? 'No valid targets'
              : !diagnosis.requiredVariablesPassed
                ? `Required variables failed: ${diagnosis.failedVariables.join(', ')}`
                : 'Unknown';
          return {
            templateId: t.id,
            failedRules: diagnosis.failedRules,
            selectionCount: diagnosis.selectionCount,
            summary,
            selectionDiagnosis: diagnosis.selectionDiagnosis,
            variableDiagnoses: diagnosis.failedVariableDiagnoses.length > 0
              ? diagnosis.failedVariableDiagnoses
              : undefined
          };
        }
        return {
          templateId: t.id,
          failedRules: [],
          selectionCount: 0,
          summary: 'Non-declarative template'
        };
      })
    });

    // Emit tag health report
    const tagHealthReport = this.contractEnforcer.getTagAnalyzer().analyzeGraph(this.graph);
    this.emitter.tagHealth({
      coverage: {
        totalEntities: tagHealthReport.coverage.totalEntities,
        entitiesWithTags: tagHealthReport.coverage.entitiesWithTags,
        coveragePercentage: tagHealthReport.coverage.coveragePercentage
      },
      diversity: {
        uniqueTags: tagHealthReport.diversity.uniqueTags,
        shannonIndex: tagHealthReport.diversity.shannonIndex,
        evenness: tagHealthReport.diversity.evenness
      },
      issues: {
        orphanTagCount: tagHealthReport.issues.orphanTags.length,
        overusedTagCount: tagHealthReport.issues.overusedTags.length,
        conflictCount: tagHealthReport.issues.conflicts.length
      }
    });

    // Emit system health
    const populationHealth = 1 - summary.avgEntityDeviation;
    this.emitter.systemHealth({
      populationHealth,
      status: populationHealth > 0.8 ? 'stable' :
              populationHealth > 0.6 ? 'functional' : 'needs_attention'
    });
  }

  /**
   * Emit diagnostics (entity breakdown, catalyst stats, etc.)
   * Called after each epoch so diagnostics are visible during step mode.
   */
  private emitDiagnostics(): void {
    const entities = this.graph.getEntities();
    const relationships = this.graph.getRelationships();

    // Entity breakdown by kind:subtype
    const byKind: Record<string, { total: number; bySubtype: Record<string, number> }> = {};
    entities.forEach(e => {
      if (!byKind[e.kind]) {
        byKind[e.kind] = { total: 0, bySubtype: {} };
      }
      byKind[e.kind].total++;
      byKind[e.kind].bySubtype[e.subtype] = (byKind[e.kind].bySubtype[e.subtype] || 0) + 1;
    });

    this.emitter.entityBreakdown({
      totalEntities: entities.length,
      byKind
    });

    // Catalyst statistics
    const agents = entities.filter(e => e.catalyst?.canAct);
    const activeAgents = agents.filter(e => e.catalyst && e.catalyst.catalyzedEvents.length > 0);
    const agentActions = new Map<string, { name: string; kind: string; count: number }>();

    entities.forEach(e => {
      if (e.catalyst?.catalyzedEvents?.length) {
        agentActions.set(e.id, {
          name: e.name,
          kind: e.kind,
          count: e.catalyst.catalyzedEvents.length
        });
      }
    });

    const topAgents = Array.from(agentActions.entries())
      .map(([id, data]) => ({ id, name: data.name, kind: data.kind, actionCount: data.count }))
      .sort((a, b) => b.actionCount - a.actionCount)
      .slice(0, 10);

    const totalActions = Array.from(agentActions.values()).reduce((sum, a) => sum + a.count, 0);

    this.emitter.catalystStats({
      totalAgents: agents.length,
      activeAgents: activeAgents.length,
      totalActions,
      uniqueActors: agentActions.size,
      topAgents
    });

    // Relationship breakdown
    const relCounts = new Map<string, number>();
    relationships.forEach(r => {
      relCounts.set(r.kind, (relCounts.get(r.kind) || 0) + 1);
    });

    const relBreakdown = Array.from(relCounts.entries())
      .map(([kind, count]) => ({
        kind,
        count,
        percentage: relationships.length > 0 ? (count / relationships.length) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    this.emitter.relationshipBreakdown({
      totalRelationships: relationships.length,
      byKind: relBreakdown
    });

    // Notable entities (mythic and renowned)
    const mythic = entities
      .filter(e => e.prominence === 'mythic')
      .map(e => ({ id: e.id, name: e.name, kind: e.kind, subtype: e.subtype }));

    const renowned = entities
      .filter(e => e.prominence === 'renowned')
      .map(e => ({ id: e.id, name: e.name, kind: e.kind, subtype: e.subtype }));

    this.emitter.notableEntities({ mythic, renowned });

    // Sample history events (last 10)
    const history = this.graph.history;
    const recentEvents = history.slice(-10).map(h => ({
      tick: h.tick,
      type: h.type,
      summary: h.description,
      entityIds: h.entitiesCreated || []
    }));

    this.emitter.sampleHistory({
      totalEvents: history.length,
      recentEvents
    });
  }

  /**
   * Emit epoch feedback reports (population, template usage, system health).
   * Called after each epoch so dashboards update during stepping.
   */
  private emitEpochFeedback(): void {
    // Update population metrics
    this.populationTracker.update(this.graph);
    const metrics = this.populationTracker.getMetrics();
    const summary = this.populationTracker.getSummary();
    const outliers = this.populationTracker.getOutliers(0.3);

    // Build entity metrics array
    const entityMetrics = Array.from(metrics.entities.values())
      .filter(m => m.target > 0)
      .map(m => ({
        kind: m.kind,
        subtype: m.subtype,
        count: m.count,
        target: m.target,
        deviation: m.deviation
      }));

    // Build pressure metrics array
    const pressureMetrics: Array<{ id: string; value: number; target: number; deviation: number }> = [];
    summary.pressureDeviations.forEach((deviation, pressureId) => {
      const metric = metrics.pressures.get(pressureId);
      if (metric) {
        pressureMetrics.push({
          id: pressureId,
          value: metric.value,
          target: metric.target,
          deviation
        });
      }
    });

    // Emit population report
    this.emitter.populationReport({
      totalEntities: summary.totalEntities,
      totalRelationships: summary.totalRelationships,
      avgDeviation: summary.avgEntityDeviation,
      maxDeviation: summary.maxEntityDeviation,
      entityMetrics,
      pressureMetrics,
      outliers: {
        overpopulated: outliers.overpopulated.map(m => ({
          kind: m.kind,
          subtype: m.subtype,
          count: m.count,
          target: m.target,
          deviation: m.deviation
        })),
        underpopulated: outliers.underpopulated.map(m => ({
          kind: m.kind,
          subtype: m.subtype,
          count: m.count,
          target: m.target,
          deviation: m.deviation
        }))
      }
    });

    // Emit template usage report
    const sortedTemplates = Array.from(this.templateRunCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    const totalRuns = sortedTemplates.reduce((sum, [_, count]) => sum + count, 0);

    const unusedTemplates = this.runtimeTemplates.filter(t => !this.templateRunCounts.has(t.id));
    const diagnosticView = this.runtime;

    this.emitter.templateUsage({
      totalApplications: totalRuns,
      uniqueTemplatesUsed: sortedTemplates.length,
      totalTemplates: this.runtimeTemplates.length,
      maxRunsPerTemplate: this.maxRunsPerTemplate,
      usage: sortedTemplates.slice(0, 20).map(([templateId, count]) => ({
        templateId,
        count,
        percentage: totalRuns > 0 ? (count / totalRuns) * 100 : 0,
        status: count >= this.maxRunsPerTemplate ? 'saturated' as const :
                count >= this.maxRunsPerTemplate * 0.7 ? 'warning' as const : 'healthy' as const
      })),
      unusedTemplates: unusedTemplates.map(t => {
        const declarativeTemplate = this.declarativeTemplates.get(t.id);
        if (declarativeTemplate) {
          const diagnosis = this.templateInterpreter.diagnoseCanApply(declarativeTemplate, diagnosticView);
          const summary = diagnosis.failedRules.length > 0
            ? `Failed: ${diagnosis.failedRules[0].split(':')[0]}`
            : diagnosis.selectionCount === 0
              ? 'No valid targets'
              : !diagnosis.requiredVariablesPassed
                ? `Required variables failed: ${diagnosis.failedVariables.join(', ')}`
                : 'Unknown';
          return {
            templateId: t.id,
            failedRules: diagnosis.failedRules,
            selectionCount: diagnosis.selectionCount,
            summary,
            selectionDiagnosis: diagnosis.selectionDiagnosis,
            variableDiagnoses: diagnosis.failedVariableDiagnoses.length > 0
              ? diagnosis.failedVariableDiagnoses
              : undefined
          };
        }
        return {
          templateId: t.id,
          failedRules: [],
          selectionCount: 0,
          summary: 'Non-declarative template'
        };
      })
    });

    // Emit system health
    const populationHealth = 1 - summary.avgEntityDeviation;
    this.emitter.systemHealth({
      populationHealth,
      status: populationHealth > 0.8 ? 'stable' :
              populationHealth > 0.6 ? 'functional' : 'needs_attention'
    });
  }

  /**
   * Emit coordinate statistics via emitter
   */
  private emitCoordinateStats(): void {
    const stats = coordinateStats.getSummary();
    this.emitter.coordinateStats({
      totalPlacements: stats.totalPlacements,
      byKind: stats.placementsByKind,
      regionUsage: stats.regionUsagePerKind,
      cultureDistribution: Object.fromEntries(
        stats.cultureClusterStats.map(cs => [cs.cultureId, cs.entityCount])
      )
    });
  }

  /**
   * Emit simulation complete event
   */
  private emitCompleteEvent(): void {
    const durationMs = Date.now() - this.startTime;
    const coordinateState = this.coordinateContext.export();
    const entities = this.graph.getEntities({ includeHistorical: true });
    const relationships = this.graph.getRelationships({ includeHistorical: true });

    this.emitter.complete({
      schema: this.config.schema,
      metadata: {
        tick: this.graph.tick,
        epoch: this.currentEpoch,
        era: this.graph.currentEra.name,
        entityCount: entities.length,
        relationshipCount: relationships.length,
        historyEventCount: this.graph.history.length,
        durationMs,
        enrichmentTriggers: {}
      },
      hardState: entities,
      relationships,
      history: this.graph.history,
      pressures: Object.fromEntries(this.graph.pressures),
      distributionMetrics: this.templateSelector ? (() => {
        const state = this.templateSelector.getState(this.graph);
        const deviation = this.templateSelector.getDeviation(this.graph);
        return {
          entityKindRatios: state.entityKindRatios,
          prominenceRatios: state.prominenceRatios,
          relationshipTypeRatios: state.relationshipTypeRatios,
          graphMetrics: state.graphMetrics,
          deviation: {
            overall: deviation.overall,
            entityKind: deviation.entityKind.score,
            prominence: deviation.prominence.score,
            relationship: deviation.relationship.score,
            connectivity: deviation.connectivity.score
          },
          targets: this.config.distributionTargets?.global
        };
      })() : undefined,
      coordinateState
    });
  }
  // Meta-entity formation is now handled by SimulationSystems:
  // - magicSchoolFormation
  // - legalCodeFormation
  // - combatTechniqueFormation
  // These run at epoch end and use the clustering/archival utilities

  /**
   * Sample a single template with weighted probability
   * Applies diversity pressure to prevent template overuse
   */
  private sampleSingleTemplate(
    era: Era,
    applicableTemplates: GrowthTemplate[],
    metrics: PopulationMetrics
  ): GrowthTemplate | undefined {
    if (applicableTemplates.length === 0) return undefined;

    // Build era weights
    const baseEraWeights: Record<string, number> = {};
    applicableTemplates.forEach(t => {
      baseEraWeights[t.id] = getTemplateWeight(era, t.id);
    });

    // Build creation info map from declarative templates for homeostatic control
    const creationInfoMap = new Map<string, { entityKinds: Array<{ kind: string; subtype: string }> }>();
    applicableTemplates.forEach(t => {
      const declTemplate = this.declarativeTemplates.get(t.id);
      if (declTemplate?.creation) {
        creationInfoMap.set(t.id, {
          entityKinds: declTemplate.creation.map(c => ({
            kind: c.kind,
            subtype: typeof c.subtype === 'string' ? c.subtype : 'default'
          }))
        });
      }
    });

    // Apply dynamic weight adjustments (homeostatic control)
    const adjustments = this.dynamicWeightCalculator.calculateAllWeights(
      applicableTemplates,
      new Map(Object.entries(baseEraWeights)),
      metrics,
      creationInfoMap
    );

    // Build final weights with diversity pressure
    const finalWeights: number[] = [];
    applicableTemplates.forEach(t => {
      const adjustment = adjustments.get(t.id);
      let weight = adjustment?.adjustedWeight || baseEraWeights[t.id];

      // DIVERSITY PRESSURE: Extreme negative pressure based on run count
      // Formula: weight * (1 / (1 + runCount^2))
      // Effect: 0 runs = 100%, 1 run = 50%, 2 runs = 20%, 3 runs = 10%, 4+ runs = <6%
      const runCount = this.templateRunCounts.get(t.id) || 0;
      const diversityPenalty = 1 / (1 + runCount * runCount);
      weight *= diversityPenalty;

      finalWeights.push(Math.max(0, weight));
    });

    // Check if all weights are zero
    const totalWeight = finalWeights.reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) {
      // All templates exhausted, pick randomly
      return pickRandom(applicableTemplates);
    }

    // Weighted random selection
    return weightedRandom(applicableTemplates, finalWeights);
  }

  /**
   * Calculate dynamic growth target based on remaining entity deficits
   */
  private calculateGrowthTarget(): number {
    // Get entity kinds from canonical schema (not hardcoded)
    const entityKinds = this.config.schema.entityKinds.map(ek => ek.kind);
    const currentCounts = new Map<string, number>();

    // Count current entities by kind
    this.graph.forEachEntity((entity) => {
      currentCounts.set(entity.kind, (currentCounts.get(entity.kind) || 0) + 1);
    });

    // Calculate total remaining entities needed
    let totalRemaining = 0;
    for (const kind of entityKinds) {
      const current = currentCounts.get(kind) || 0;
      const target = this.config.targetEntitiesPerKind;
      const remaining = Math.max(0, target - current);
      totalRemaining += remaining;
    }

    // If we've met minimum target, reduce (but don't stop) growth rate
    if (totalRemaining === 0) return 3; // Minimal growth when minimum target met

    // Calculate epochs remaining (rough estimate)
    const totalTarget = this.config.targetEntitiesPerKind * entityKinds.length;
    const currentTotal = this.graph.getEntityCount();
    const progressRatio = currentTotal / totalTarget;
    const epochsRemaining = Math.max(1, this.getTotalEpochs() - this.currentEpoch);

    // Dynamic target: spread remaining entities over remaining epochs
    const baseTarget = Math.ceil(totalRemaining / epochsRemaining);

    // Add some variance for organic feel (±30%)
    const variance = 0.3;
    const target = Math.floor(baseTarget * (1 - variance + Math.random() * variance * 2));

    // Cap at reasonable bounds (scaled by config.scaleFactor)
    return Math.max(this.growthBounds.min, Math.min(this.growthBounds.max, target));
  }

  private async runSimulationTick(era: Era): Promise<void> {
    let totalRelationships = 0;
    let totalModifications = 0;
    const relationshipsThisTick: Relationship[] = [];
    const modifiedEntityIds: string[] = [];

    // Budget enforcement
    const budget = this.config.relationshipBudget?.maxPerSimulationTick || Infinity;
    let relationshipsAddedThisTick = 0;

    // Calculate distribution-based system modifiers if available
    const distributionModifiers = this.systemSelector
      ? this.calculateDistributionSystemModifiers(era)
      : {};

    for (const system of this.runtimeSystems) {
      const baseModifier = getSystemModifier(era, system.id);
      if (baseModifier === 0) continue; // System disabled by era

      // Apply distribution-based adjustment on top of era modifier
      const modifier = distributionModifiers[system.id] ?? baseModifier;

      try {
        const systemGraphView = this.runtime;
        const relationshipsBefore = this.graph.getRelationshipCount();
        const result = await system.apply(systemGraphView, modifier);

        // Record system execution
        this.statisticsCollector.recordSystemExecution(system.id);

        // Track system metrics
        const metric = this.systemMetrics.get(system.id) || { relationshipsCreated: 0, lastThrottleCheck: 0 };

        // Account for relationships added directly by the system (e.g., growth)
        const directAdded = this.graph.getRelationshipCount() - relationshipsBefore;
        if (directAdded > 0) {
          relationshipsAddedThisTick += directAdded;
          metric.relationshipsCreated += directAdded;
          totalRelationships += directAdded;
          if (relationshipsAddedThisTick > budget) {
            this.logWarning(`⚠️  RELATIONSHIP BUDGET EXCEEDED BY SYSTEM ${system.id}: ${relationshipsAddedThisTick}/${budget}`);
          }
        }

        // Apply relationships with budget check
        let addedFromResult = 0;
        for (const rel of result.relationshipsAdded) {
          // Check budget
          if (relationshipsAddedThisTick >= budget) {
            this.logWarning(`⚠️  RELATIONSHIP BUDGET REACHED: ${budget}/tick`);
            this.logWarning(`   Remaining systems may not add relationships this tick`);
            break;
          }

          const before = this.graph.getRelationshipCount();
          addRelationship(this.graph, rel.kind, rel.src, rel.dst);
          const after = this.graph.getRelationshipCount();

          if (after > before) {
            relationshipsThisTick.push(rel);
            relationshipsAddedThisTick++;
            metric.relationshipsCreated++;
            addedFromResult++;
          }
        }
        totalRelationships += addedFromResult;

        if (result.relationshipsAdjusted && result.relationshipsAdjusted.length > 0) {
          for (const rel of result.relationshipsAdjusted) {
            modifyRelationshipStrength(this.graph, rel.src, rel.dst, rel.kind, rel.delta);
          }
        }

        // Update system metrics and check for aggressive systems
        if (metric.relationshipsCreated > 500 && this.graph.tick - metric.lastThrottleCheck > 20) {
          this.logWarning(`⚠️  AGGRESSIVE SYSTEM: ${system.id} has created ${metric.relationshipsCreated} relationships`);
          this.logWarning(`   Consider adding throttling or reducing probabilities`);
          metric.lastThrottleCheck = this.graph.tick;
        }
        this.systemMetrics.set(system.id, metric);

        // Apply modifications
        result.entitiesModified.forEach(mod => {
          updateEntity(this.graph, mod.id, mod.changes);
          modifiedEntityIds.push(mod.id);
        });

        // Apply pressure changes and track for emitting
        for (const [pressure, delta] of Object.entries(result.pressureChanges)) {
          const current = this.graph.pressures.get(pressure) || 0;
          this.graph.pressures.set(pressure, Math.max(-100, Math.min(100, current + delta)));
          this.trackPressureModification(pressure, delta, { type: 'system', systemId: system.id });
        }

        // Emit systemAction event if meaningful work was done
        // Use significantModificationCount from details if present (for systems like
        // diffusion that want to squelch false positives from value tag updates)
        const reportedModifications = typeof result.details?.significantModificationCount === 'number'
          ? result.details.significantModificationCount
          : result.entitiesModified.length;

        const didMeaningfulWork =
          directAdded > 0 ||
          addedFromResult > 0 ||
          (result.relationshipsAdjusted && result.relationshipsAdjusted.length > 0) ||
          reportedModifications > 0 ||
          Object.keys(result.pressureChanges).length > 0;

        if (didMeaningfulWork) {
          this.emitter.systemAction({
            tick: this.graph.tick,
            epoch: this.currentEpoch,
            systemId: system.id,
            systemName: system.name,
            relationshipsAdded: directAdded + addedFromResult,
            entitiesModified: reportedModifications,
            pressureChanges: result.pressureChanges,
            description: result.description,
            details: result.details,
          });
        }

        totalModifications += result.entitiesModified.length;

      } catch (error) {
        this.emitter.log('error', `System ${system.id} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Enrichment moved to @illuminator
    // if (relationshipsThisTick.length > 0) {
    //   this.queueRelationshipEnrichment(relationshipsThisTick);
    // }

    if (totalRelationships > 0 || totalModifications > 0) {
      // Record significant ticks only
      this.graph.history.push({
        tick: this.graph.tick,
        era: era.id,
        type: 'simulation',
        description: `Systems: +${totalRelationships} relationships, ${totalModifications} modifications`,
        entitiesCreated: [],
        relationshipsCreated: relationshipsThisTick,
        entitiesModified: modifiedEntityIds
      });
    }

    // Monitor relationship growth rate
    this.monitorRelationshipGrowth();
  }
  
  private updatePressures(era: Era): void {
    // Calculate distribution-based pressure adjustments if we have a tracker
    const distributionAdjustments = this.templateSelector
      ? this.calculateDistributionPressureAdjustments()
      : {};

    // Collect detailed pressure changes for emitting
    const pressureDetails: PressureChangeDetail[] = [];

    this.runtimePressures.forEach(pressure => {
      // previousValue = tick start value (before systems ran) for accurate delta reporting
      const previousValue = this.tickStartPressures.get(pressure.id)
        ?? this.graph.pressures.get(pressure.id)
        ?? pressure.value;

      // currentValue = value AFTER systems ran (includes discrete modifications)
      const currentValueAfterSystems = this.graph.pressures.get(pressure.id) ?? pressure.value;

      // Get detailed breakdown from declarative definition
      const declarativeDef = this.declarativePressures.get(pressure.id);
      if (!declarativeDef) {
        throw new Error(`No declarative definition found for pressure: ${pressure.id}`);
      }
      const breakdown = evaluatePressureGrowthWithBreakdown(declarativeDef, this.graph);

      // Apply diminishing returns for high pressure values to prevent maxing out
      // Growth is scaled down as pressure magnitude approaches limits
      const normalizedMagnitude = Math.abs(currentValueAfterSystems) / 100;
      const growthScaling = Math.max(0.1, 1 - Math.pow(normalizedMagnitude, 2)); // Symmetric damping near ±100
      const scaledFeedback = breakdown.feedbackTotal * growthScaling;

      // Homeostatic pull toward equilibrium (0)
      const homeostaticDelta = (0 - currentValueAfterSystems) * pressure.homeostasis;

      // Apply era modifier if present
      const eraModifier = era.pressureModifiers?.[pressure.id] || 1.0;

      // Apply distribution feedback adjustment
      const distributionFeedback = distributionAdjustments[pressure.id] || 0;

      const rawDelta = (scaledFeedback + homeostaticDelta) * eraModifier + distributionFeedback;

      // Smooth large changes to prevent spikes (default max change per tick: ±10)
      const smoothingLimit = this.config.pressureDeltaSmoothing ?? 10;
      const smoothedDelta = Math.max(-smoothingLimit, Math.min(smoothingLimit, rawDelta));

      // Apply feedback delta ON TOP OF system modifications
      const newValue = Math.max(-100, Math.min(100, currentValueAfterSystems + smoothedDelta));
      this.graph.pressures.set(pressure.id, newValue);

      // Build detailed change record
      pressureDetails.push({
        id: pressure.id,
        name: pressure.name,
        previousValue,
        newValue,
        delta: newValue - previousValue,
        breakdown: {
          positiveFeedback: breakdown.positiveFeedback,
          negativeFeedback: breakdown.negativeFeedback,
          feedbackTotal: breakdown.feedbackTotal,
          growthScaling,
          scaledFeedback,
          homeostasis: pressure.homeostasis,
          homeostaticDelta,
          eraModifier,
          distributionFeedback,
          rawDelta,
          smoothedDelta
        }
      });
    });

    // Emit pressure update event with full breakdown
    this.emitter.pressureUpdate({
      tick: this.graph.tick,
      epoch: this.currentEpoch,
      pressures: pressureDetails,
      discreteModifications: [...this.pendingPressureModifications]
    });

    // Clear pending modifications for next tick
    this.pendingPressureModifications = [];
  }

  /**
   * Track a discrete pressure modification for inclusion in pressure_update event
   */
  private trackPressureModification(
    pressureId: string,
    delta: number,
    source: PressureModificationSource
  ): void {
    if (delta !== 0) {
      this.pendingPressureModifications.push({ pressureId, delta, source });
    }
  }

  /**
   * Calculate distribution-based system modifier adjustments
   */
  private calculateDistributionSystemModifiers(era: Era): Record<string, number> {
    if (!this.systemSelector) return {};

    // Build era modifiers map
    const eraModifiers: Record<string, number> = {};
    this.runtimeSystems.forEach(system => {
      eraModifiers[system.id] = getSystemModifier(era, system.id);
    });

    return this.systemSelector.calculateSystemModifiers(
      this.graph,
      this.runtimeSystems,
      eraModifiers
    );
  }

  /**
   * Calculate pressure adjustments based on distribution deviation
   * High deviation in certain areas should boost relevant pressures
   */
  private calculateDistributionPressureAdjustments(): Record<string, number> {
    if (!this.templateSelector) return {};

    const state = this.distributionTracker!.measureState(this.graph);
    const deviation = this.distributionTracker!.calculateDeviation(state, this.graph.currentEra.name);
    const adjustments: Record<string, number> = {};

    const threshold = this.config.distributionTargets!.tuning.convergenceThreshold;

    // High faction deficit → boost cultural_tension to trigger faction templates
    if (deviation.entityKind.score > threshold) {
      const factionDeviation = deviation.entityKind.deviations['faction'] || 0;
      if (factionDeviation > 0.1) {
        // We need more factions
        adjustments['cultural_tension'] = Math.min(factionDeviation * 20, 5);
      }
    }

    // High conflict/rivalry → boost conflict pressure
    if (deviation.relationship.score > threshold) {
      const enemyRatio = state.relationshipTypeRatios['enemy_of'] || 0;
      const rivalRatio = state.relationshipTypeRatios['rival_of'] || 0;
      const conflictRatio = enemyRatio + rivalRatio;

      if (conflictRatio > 0.15) {
        adjustments['conflict'] = Math.min(conflictRatio * 15, 5);
      }
    }

    // High abilities deficit → boost magical_instability to trigger ability discovery
    if (deviation.entityKind.score > threshold) {
      const abilityDeviation = deviation.entityKind.deviations['abilities'] || 0;
      if (abilityDeviation > 0.08) {
        adjustments['magical_instability'] = Math.min(abilityDeviation * 25, 5);
      }
    }

    // Low isolated nodes and good connectivity → boost stability
    if (deviation.connectivity.score < threshold) {
      const isolatedRatio = state.graphMetrics.isolatedNodeRatio;
      if (isolatedRatio < 0.1) {
        adjustments['stability'] = 3;
      }
    }

    return adjustments;
  }

  private monitorRelationshipGrowth(): void {
    const currentCount = this.graph.getRelationshipCount();
    const growth = currentCount - this.lastRelationshipCount;

    // Update rolling window
    this.graph.growthMetrics.relationshipsPerTick.push(growth);
    if (this.graph.growthMetrics.relationshipsPerTick.length > 20) {
      this.graph.growthMetrics.relationshipsPerTick.shift();
    }

    // Calculate average growth rate
    const window = this.graph.growthMetrics.relationshipsPerTick;
    const avgGrowth = window.reduce((a, b) => a + b, 0) / (window.length || 1);
    this.graph.growthMetrics.averageGrowthRate = avgGrowth;

    // Warn if exponential growth detected
    if (avgGrowth > 30 && window.length >= 10) {
      this.logWarning(`⚠️  HIGH RELATIONSHIP GROWTH RATE: ${avgGrowth.toFixed(1)}/tick`);
      this.logWarning(`   Current: ${currentCount} relationships, growing at ${avgGrowth.toFixed(1)}/tick`);
      this.logWarning(`   Consider reducing system probabilities or adding throttling`);
    }

    this.lastRelationshipCount = currentCount;
  }

  private pruneAndConsolidate(): void {
    // Mark very old, unconnected entities as 'forgotten'
    const allEntities = this.graph.getEntities();
    for (const entity of allEntities) {
      if (entity.prominence === 'forgotten') continue;

      const age = this.graph.tick - entity.createdAt;
      const connections = this.graph.getEntityRelationships(entity.id).length;

      if (age > 50 && connections < 2) {
        this.graph.updateEntity(entity.id, { prominence: 'forgotten' });
      }
    }
    
    // Mark dead NPCs
    const npcs = findEntities(this.graph, { kind: 'npc', status: 'alive' });
    npcs.forEach(npc => {
      const age = this.graph.tick - npc.createdAt;
      if (age > 80 && Math.random() > 0.7) {
        this.graph.updateEntity(npc.id, { status: 'dead' });
      }
    });
  }

  // =============================================================================
  // ENRICHMENT METHODS - Moved to @illuminator
  // These are stubs/no-ops. Connect illuminator for LLM enrichment.
  // =============================================================================

  // Era narrative - no-op without illuminator
  private queueEraNarrative(_fromEra: Era, _toEra: Era): void {
    // Enrichment moved to @illuminator - this is a no-op
  }

  // Change enrichments - no-op without illuminator
  private queueChangeEnrichments(): void {
    // Enrichment moved to @illuminator - this is a no-op
  }

  // Export methods
  public getGraph(): Graph {
    return this.graph;
  }

  public getHistory(): HistoryEvent[] {
    return this.graph.history;
  }

  public finalizeNameLogging(): void {
    // Print name-forge generation stats
    if (this.nameForgeService) {
      this.nameForgeService.printStats();
    }
    // LLM name logging moved to @illuminator
  }

  public async finalizeEnrichments(): Promise<void> {
    // Enrichment moved to @illuminator - this is now a no-op
  }

  public exportState(): any {
    const entities = this.graph.getEntities({ includeHistorical: true });
    const relationships = this.graph.getRelationships({ includeHistorical: true });

    // Extract meta-entities for visibility
    const metaEntities = entities.filter(e => hasTag(e.tags, FRAMEWORK_TAGS.META_ENTITY));

    const coordinateState = this.coordinateContext.export();

    const exportData: any = {
      schema: this.config.schema,
      metadata: {
        tick: this.graph.tick,
        epoch: this.currentEpoch,
        era: this.graph.currentEra.name,
        entityCount: entities.length,
        relationshipCount: relationships.length,
        historyEventCount: this.graph.history.length,
        metaEntityCount: metaEntities.length,
        metaEntityFormation: {
          totalFormed: this.metaEntitiesFormed.length,
          formations: this.metaEntitiesFormed,
          comment: 'Meta-entities are abilities/rules that emerged from clustering, marked with meta-entity tag'
        },
        enrichmentTriggers: {}
      },
      hardState: entities,
      relationships,
      pressures: Object.fromEntries(this.graph.pressures),
      history: this.graph.history  // Export ALL events, not just last 50
      // loreRecords moved to @illuminator
    };

    // Include distribution metrics if using statistical template selection
    if (this.templateSelector) {
      const state = this.templateSelector.getState(this.graph);
      const deviation = this.templateSelector.getDeviation(this.graph);

      exportData.distributionMetrics = {
        entityKindRatios: state.entityKindRatios,
        prominenceRatios: state.prominenceRatios,
        relationshipTypeRatios: state.relationshipTypeRatios,
        graphMetrics: state.graphMetrics,
        deviation: {
          overall: deviation.overall,
          entityKind: deviation.entityKind.score,
          prominence: deviation.prominence.score,
          relationship: deviation.relationship.score,
          connectivity: deviation.connectivity.score
        },
        targets: this.config.distributionTargets?.global
      };
    }

    // Export coordinate context state (emergent regions, etc.)
    exportData.coordinateState = coordinateState;

    return exportData;
  }

  /**
   * Import coordinate state from a previously exported world.
   * Restores emergent regions into the active coordinate context.
   */
  public importCoordinateState(coordinateState: ReturnType<CoordinateContext['export']>): void {
    this.coordinateContext.import(coordinateState);
  }

  /**
   * Export statistics for fitness evaluation
   */
  public exportStatistics(validationResults: ValidationStats): SimulationStatistics {
    // Enrichment analytics moved to @illuminator - pass zeros
    return this.statisticsCollector.generateStatistics(
      this.graph,
      this.config,
      {
        locationEnrichments: 0,
        factionEnrichments: 0,
        ruleEnrichments: 0,
        abilityEnrichments: 0,
        npcEnrichments: 0,
        totalEnrichments: 0
      },
      validationResults
    );
  }
}
