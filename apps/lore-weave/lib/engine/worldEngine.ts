import { Graph, GraphStore, EngineConfig, Era, GrowthTemplate, HistoryEvent } from '../types/engine';
import { LoreRecord } from '../types/lore';
import { HardState, Relationship } from '../types/worldTypes';
import {
  generateId,
  addEntity,
  addRelationship,
  updateEntity,
  pickRandom,
  weightedRandom,
  findEntities,
  getProminenceValue,
  upsertNameTag,
  hasTag
} from '../utils/helpers';
import { initializeCatalystSmart } from '../utils/catalystHelpers';
import { selectEra, getTemplateWeight, getSystemModifier } from '../utils/eraUtils';
import { EnrichmentService } from '../llm/enrichmentService';
import { ImageGenerationService } from '../llm/imageGenerationService';
import { TemplateSelector } from '../selection/templateSelector';
import { SystemSelector } from '../selection/systemSelector';
import { DistributionTracker } from '../statistics/distributionTracker';
import { StatisticsCollector } from '../statistics/statisticsCollector';
import { PopulationTracker, PopulationMetrics } from '../statistics/populationTracker';
import { DynamicWeightCalculator } from '../selection/dynamicWeightCalculator';
import { FeedbackAnalyzer } from '../feedback/feedbackAnalyzer';
import { TargetSelector } from '../selection/targetSelector';
import { TemplateGraphView } from '../graph/templateGraphView';
// MetaEntityFormation removed - now handled by SimulationSystems (magicSchoolFormation, etc.)
import { SimulationStatistics, ValidationStats } from '../types/statistics';
import { FrameworkValidator } from './frameworkValidator';
import { ContractEnforcer } from './contractEnforcer';
import { FRAMEWORK_ENTITY_KINDS, FRAMEWORK_STATUS } from '../types/frameworkPrimitives';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Entity snapshot for change detection
 * Tracks kind-specific metrics to enable world-centric enrichment
 */
interface EntitySnapshot {
  // Common fields
  tick: number;
  status: string;
  prominence: string;
  keyRelationshipIds: Set<string>;

  // Location-specific
  residentCount?: number;
  controllerId?: string;

  // Faction-specific
  leaderId?: string;
  territoryCount?: number;
  allyIds?: Set<string>;
  enemyIds?: Set<string>;

  // Rule-specific
  enforcerIds?: Set<string>;

  // Ability-specific
  practitionerCount?: number;
  locationIds?: Set<string>;

  // NPC-specific
  leadershipIds?: Set<string>;
}

/**
 * Detect location-specific changes (Tier 1: Always enrich)
 */
function detectLocationChanges(
  location: HardState,
  snapshot: EntitySnapshot,
  graph: Graph
): string[] {
  const changes: string[] = [];

  // Population changes (track as dst of resident_of)
  const currentResidents = graph.findRelationships({ kind: 'resident_of', dst: location.id });
  const residentDelta = currentResidents.length - (snapshot.residentCount || 0);
  if (Math.abs(residentDelta) >= 3) {
    changes.push(`population: ${residentDelta > 0 ? '+' : ''}${residentDelta} residents`);
  }

  // Control changes (track as dst of stronghold_of or controls)
  const controlRelations = graph.getEntityRelationships(location.id, 'dst');
  const currentController = controlRelations.find(r =>
    r.kind === 'stronghold_of' || r.kind === 'controls'
  );
  const currentControllerId = currentController?.src;
  if (currentControllerId !== snapshot.controllerId) {
    const controller = graph.getEntity(currentControllerId || '');
    changes.push(`control: now controlled by ${controller?.name || 'none'}`);
  }

  // Prominence changes
  if (location.prominence !== snapshot.prominence) {
    changes.push(`prominence: ${snapshot.prominence} → ${location.prominence}`);
  }

  // Status changes
  if (location.status !== snapshot.status) {
    changes.push(`status: ${snapshot.status} → ${location.status}`);
  }

  return changes;
}

/**
 * Detect faction-specific changes (Tier 1: Always enrich)
 */
function detectFactionChanges(
  faction: HardState,
  snapshot: EntitySnapshot,
  graph: Graph
): string[] {
  const changes: string[] = [];

  // Leadership changes (track as dst of leader_of)
  const leaderRelations = graph.findRelationships({ kind: 'leader_of', dst: faction.id });
  const currentLeader = leaderRelations[0];
  const currentLeaderId = currentLeader?.src;
  if (currentLeaderId !== snapshot.leaderId) {
    const leader = graph.getEntity(currentLeaderId || '');
    changes.push(`leadership: ${leader?.name || 'none'} took power`);
  }

  // Territory changes (track as src of stronghold_of or controls)
  const factionRels = graph.getEntityRelationships(faction.id, 'src');
  const currentTerritories = factionRels.filter(r =>
    r.kind === 'stronghold_of' || r.kind === 'controls'
  );
  const territoryDelta = currentTerritories.length - (snapshot.territoryCount || 0);
  if (territoryDelta > 0) {
    changes.push(`territory: gained ${territoryDelta} locations`);
  } else if (territoryDelta < 0) {
    changes.push(`territory: lost ${Math.abs(territoryDelta)} locations`);
  }

  // Alliance changes (track as src of allied_with)
  const currentAllies = new Set(
    graph.findRelationships({ kind: 'allied_with', src: faction.id })
      .map(r => r.dst)
  );
  const previousAllies = snapshot.allyIds || new Set();
  const newAllies = Array.from(currentAllies).filter(id => !previousAllies.has(id));
  newAllies.forEach(allyId => {
    const ally = graph.getEntity(allyId);
    if (ally) changes.push(`alliance: allied with ${ally.name}`);
  });

  // War changes (track as src of at_war_with)
  const currentEnemies = new Set(
    graph.findRelationships({ kind: 'at_war_with', src: faction.id })
      .map(r => r.dst)
  );
  const previousEnemies = snapshot.enemyIds || new Set();
  const newWars = Array.from(currentEnemies).filter(id => !previousEnemies.has(id));
  newWars.forEach(enemyId => {
    const enemy = graph.getEntity(enemyId);
    if (enemy) changes.push(`war: declared war on ${enemy.name}`);
  });

  // Status/prominence changes
  if (faction.status !== snapshot.status) {
    changes.push(`status: ${snapshot.status} → ${faction.status}`);
  }
  if (faction.prominence !== snapshot.prominence) {
    changes.push(`prominence: ${snapshot.prominence} → ${faction.prominence}`);
  }

  return changes;
}

/**
 * Detect rule-specific changes (Tier 2: If prominent)
 */
function detectRuleChanges(
  rule: HardState,
  snapshot: EntitySnapshot,
  graph: Graph
): string[] {
  const changes: string[] = [];

  // Only enrich if rule is prominent
  const prominenceValue = getProminenceValue(rule.prominence);
  if (prominenceValue < 2) return changes; // Skip if not 'recognized' or higher

  // Status changes (proposed → enacted → repealed → forgotten)
  if (rule.status !== snapshot.status) {
    changes.push(`status: ${snapshot.status} → ${rule.status}`);
  }

  // Enforcement by factions (track as dst of weaponized_by or kept_secret_by)
  const enforcementRels = graph.getEntityRelationships(rule.id, 'dst');
  const currentEnforcers = new Set(
    enforcementRels
      .filter(r => r.kind === 'weaponized_by' || r.kind === 'kept_secret_by')
      .map(r => r.src)
  );
  const previousEnforcers = snapshot.enforcerIds || new Set();
  const newEnforcers = Array.from(currentEnforcers).filter(id => !previousEnforcers.has(id));
  newEnforcers.forEach(enforcerId => {
    const faction = graph.getEntity(enforcerId);
    if (faction) changes.push(`enforcement: ${faction.name} began enforcing this`);
  });

  // Prominence changes
  if (rule.prominence !== snapshot.prominence) {
    changes.push(`prominence: ${snapshot.prominence} → ${rule.prominence}`);
  }

  return changes;
}

/**
 * Detect ability-specific changes (Tier 2: If spreading)
 */
function detectAbilityChanges(
  ability: HardState,
  snapshot: EntitySnapshot,
  graph: Graph
): string[] {
  const changes: string[] = [];

  // Practitioner count changes (track as dst of practitioner_of)
  const currentPractitioners = graph.findRelationships({ kind: 'practitioner_of', dst: ability.id });
  const practitionerDelta = currentPractitioners.length - (snapshot.practitionerCount || 0);
  if (Math.abs(practitionerDelta) >= 3) {
    changes.push(`practitioners: ${practitionerDelta > 0 ? '+' : ''}${practitionerDelta}`);
  }

  // Spread to new locations (track as src of manifests_at)
  const currentLocations = new Set(
    graph.findRelationships({ kind: 'manifests_at', src: ability.id })
      .map(r => r.dst)
  );
  const previousLocations = snapshot.locationIds || new Set();
  const newLocations = Array.from(currentLocations).filter(id => !previousLocations.has(id));
  newLocations.forEach(locId => {
    const location = graph.getEntity(locId);
    if (location) changes.push(`spread: now manifests at ${location.name}`);
  });

  // Prominence changes (only if notable)
  const prominenceValue = getProminenceValue(ability.prominence);
  if (ability.prominence !== snapshot.prominence && prominenceValue >= 2) {
    changes.push(`prominence: ${snapshot.prominence} → ${ability.prominence}`);
  }

  return changes;
}

/**
 * Detect NPC-specific changes (Tier 3: Only if world-significant)
 */
function detectNPCChanges(
  npc: HardState,
  snapshot: EntitySnapshot,
  graph: Graph
): string[] {
  const changes: string[] = [];

  // Only track renowned/mythic NPCs
  const prominenceValue = getProminenceValue(npc.prominence);
  if (prominenceValue < 3) return changes; // Skip if not 'renowned' or 'mythic'

  // Leadership changes (track as src of leader_of)
  const currentLeaderships = new Set(
    npc.links
      .filter(l => l.kind === 'leader_of')
      .map(l => l.dst)
  );
  const previousLeaderships = snapshot.leadershipIds || new Set();
  const newLeaderships = Array.from(currentLeaderships).filter(id => !previousLeaderships.has(id));
  newLeaderships.forEach(factionId => {
    const faction = graph.getEntity(factionId);
    if (faction) changes.push(`leadership: became leader of ${faction.name}`);
  });

  // Prominence changes
  if (npc.prominence !== snapshot.prominence) {
    changes.push(`prominence: ${snapshot.prominence} → ${npc.prominence}`);
  }

  return changes;
}

export class WorldEngine {
  private config: EngineConfig;
  private graph: Graph;
  private currentEpoch: number;
  private enrichmentService?: EnrichmentService;
  private imageGenerationService?: ImageGenerationService;
  private templateSelector?: TemplateSelector;  // Optional statistical template selector
  private systemSelector?: SystemSelector;      // Optional statistical system weighting
  private distributionTracker?: DistributionTracker;  // Distribution measurement
  private statisticsCollector: StatisticsCollector;  // Statistics tracking for fitness evaluation
  private populationTracker: PopulationTracker;  // Population metrics for homeostatic control
  private dynamicWeightCalculator: DynamicWeightCalculator;  // Dynamic template weight adjustment
  private feedbackAnalyzer: FeedbackAnalyzer;  // Feedback loop validation
  private contractEnforcer: ContractEnforcer;  // Active contract enforcement
  private pendingEnrichments: Promise<void>[] = [];
  private pendingNameEnrichments: Promise<void>[] = [];
  private entityEnrichmentsUsed = 0;
  private relationshipEnrichmentsUsed = 0;
  private eraNarrativesUsed = 0;

  // Entity enrichment batching queue
  private entityEnrichmentQueue: HardState[] = [];
  private readonly ENRICHMENT_BATCH_SIZE = 15;  // Batch size for accumulating entities

  // Engine-level safeguards
  private systemMetrics: Map<string, { relationshipsCreated: number; lastThrottleCheck: number }> = new Map();
  private lastRelationshipCount: number = 0;
  private warningLogPath: string;

  // Template diversity tracking
  private templateRunCounts: Map<string, number> = new Map();
  // DIVERSITY PRESSURE: Track template usage frequency to enforce variety
  // Hard cap per template (scaled by config.scaleFactor)
  private maxRunsPerTemplate: number;
  // Growth target bounds (min, max) - scaled by config.scaleFactor
  private growthBounds: { min: number; max: number };

  // Target selection service (prevents super-hub formation)
  private targetSelector: TargetSelector;

  // Track entity state for change detection
  private entitySnapshots = new Map<string, EntitySnapshot>();

  // Enrichment analytics (tracks even when enrichment disabled)
  private enrichmentAnalytics = {
    locationEnrichments: 0,
    factionEnrichments: 0,
    ruleEnrichments: 0,
    abilityEnrichments: 0,
    npcEnrichments: 0,
    occurrenceEnrichments: 0,
    eraEnrichments: 0
  };

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
  
  constructor(
    config: EngineConfig,
    initialState: HardState[],
    enrichmentService?: EnrichmentService,
    imageGenerationService?: ImageGenerationService
  ) {
    this.config = config;
    this.enrichmentService = enrichmentService;
    this.imageGenerationService = imageGenerationService;
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

    // Framework Validation
    console.log('='.repeat(80));
    console.log('FRAMEWORK VALIDATION');
    console.log('='.repeat(80));
    const validator = new FrameworkValidator(config);
    const validationResult = validator.validate();

    // Display errors
    if (validationResult.errors.length > 0) {
      console.error('\n❌ VALIDATION ERRORS:');
      validationResult.errors.forEach(error => console.error(`  - ${error}`));
      throw new Error(`Framework validation failed with ${validationResult.errors.length} error(s)`);
    } else {
      console.log('✓ No validation errors');
    }

    // Display warnings
    if (validationResult.warnings.length > 0) {
      console.warn('\n⚠️  VALIDATION WARNINGS:');
      validationResult.warnings.forEach(warning => console.warn(`  - ${warning}`));
    } else {
      console.log('✓ No validation warnings');
    }

    console.log('='.repeat(80));
    console.log();

    // Initialize warning log file
    this.warningLogPath = path.join(process.cwd(), 'output', 'warnings.log');
    try {
      const dir = path.dirname(this.warningLogPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Clear previous log
      fs.writeFileSync(this.warningLogPath, `World Generation Warnings Log\nStarted: ${new Date().toISOString()}\n${'='.repeat(80)}\n\n`);
    } catch (error) {
      console.warn('Could not initialize warning log file:', error);
    }

    // Initialize statistical distribution system if targets are provided
    if (config.distributionTargets) {
      this.distributionTracker = new DistributionTracker(config.distributionTargets);
      this.templateSelector = new TemplateSelector(config.distributionTargets, config.templates);
      this.systemSelector = new SystemSelector(config.distributionTargets);
      console.log('✓ Statistical template selection enabled');
      console.log('✓ Statistical system weighting enabled');
    }

    // Initialize homeostatic control system
    this.populationTracker = new PopulationTracker(
      config.distributionTargets || {} as any,
      config.domain
    );
    this.dynamicWeightCalculator = new DynamicWeightCalculator();
    const loops = config.feedbackLoops || [];
    this.feedbackAnalyzer = new FeedbackAnalyzer(loops, config);
    console.log('✓ Homeostatic feedback control enabled');
    console.log(`  - Tracking ${loops.length} feedback loops`);

    // Initialize contract enforcement system
    this.contractEnforcer = new ContractEnforcer(config);
    console.log('✓ Contract enforcement enabled');
    console.log('  - Template filtering by enabledBy conditions');
    console.log('  - Automatic lineage relationship creation');
    console.log('  - Entity saturation control');
    console.log('  - Contract affects validation');

    // Initialize target selector (prevents super-hub formation)
    this.targetSelector = new TargetSelector();
    console.log('✓ Intelligent target selection enabled (anti-super-hub)');

    // Meta-entity formation is now handled by SimulationSystems (magicSchoolFormation, etc.)
    // These systems run at epoch end and use the clustering/archival utilities

    // Initialize graph from initial state using GraphStore
    this.graph = GraphStore.create(config, config.eras[0]);
    this.graph.loreIndex = config.loreIndex;
    // Override discovery state defaults
    this.graph.discoveryState = {
      currentThreshold: 0.3,  // Base threshold
      lastDiscoveryTick: -999,  // Start far in past so first discovery can happen
      discoveriesThisEpoch: 0
    };
    
    // Load initial entities and initialize catalysts
    initialState.forEach(entity => {
      const id = entity.id || generateId(entity.kind);

      // Convert legacy 6D coordinates to simple Point format
      let coordinates = entity.coordinates;
      if (coordinates && !('x' in coordinates && typeof (coordinates as any).x === 'number')) {
        // Legacy format - convert to Point
        const physical = (coordinates as any).physical;
        if (physical) {
          const zBandValues: Record<string, number> = {
            'sky': 90, 'surface': 70, 'shallow_water': 50,
            'deep_water': 30, 'ice_caverns': 10
          };
          coordinates = {
            x: typeof physical.sector_x === 'number' ? physical.sector_x : 50,
            y: typeof physical.sector_y === 'number' ? physical.sector_y : 50,
            z: typeof physical.z_band === 'string' ? (zBandValues[physical.z_band] ?? 50) : 50
          };
        } else {
          // No valid coordinates - use default
          console.warn(`Entity "${entity.name}" (${entity.kind}) has invalid coordinates format, using default`);
          coordinates = { x: 50, y: 50, z: 50 };
        }
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
      initializeCatalystSmart(loadedEntity, this.graph);

      this.graph._loadEntity(id, loadedEntity);
    });

    // Extract relationships from entity links
    initialState.forEach(entity => {
      entity.links?.forEach(link => {
        // Find actual IDs from names
        const srcEntity = this.findEntityByName(link.src) || entity;
        const dstEntity = this.findEntityByName(link.dst);

        if (srcEntity && dstEntity) {
          this.graph.addRelationship(
            link.kind,
            srcEntity.id,
            dstEntity.id,
            link.strength,
            link.distance  // Preserve lineage distance from seed data
          );
        }
      });
    });

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
   * Write warning to log file instead of console
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

    try {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [Tick ${this.graph.tick}] ${message}\n`;
      fs.appendFileSync(this.warningLogPath, logEntry);
    } catch (error) {
      // Fallback to console if file write fails
      console.warn(message);
    }
  }
  
  // Main execution loop
  public run(): Graph {
    console.log('Starting world generation...');
    console.log(`Initial state: ${this.graph.getEntityCount()} entities`);

    // Enrich initial entities (descriptions only, preserve canonical names)
    this.enrichInitialEntities();

    while (this.shouldContinue()) {
      this.runEpoch();
      this.currentEpoch++;
    }

    // Link final era to prominent entities (since it never "ends")
    this.linkFinalEra();

    console.log(`\nGeneration complete!`);
    console.log(`Final state: ${this.graph.getEntityCount()} entities, ${this.graph.getRelationshipCount()} relationships`);

    // Report enrichment analytics
    const totalTriggers = Object.values(this.enrichmentAnalytics).reduce((a, b) => a + b, 0);
    console.log(`\n=== Atlas Enrichment Analytics ===`);
    console.log(`Total enrichment triggers: ${totalTriggers}`);
    console.log(`  Locations:    ${this.enrichmentAnalytics.locationEnrichments}`);
    console.log(`  Factions:     ${this.enrichmentAnalytics.factionEnrichments}`);
    console.log(`  Rules:        ${this.enrichmentAnalytics.ruleEnrichments}`);
    console.log(`  Abilities:    ${this.enrichmentAnalytics.abilityEnrichments}`);
    console.log(`  NPCs:         ${this.enrichmentAnalytics.npcEnrichments}`);
    console.log(`  Occurrences:  ${this.enrichmentAnalytics.occurrenceEnrichments}`);
    console.log(`  Eras:         ${this.enrichmentAnalytics.eraEnrichments}`);
    if (!this.enrichmentService?.isEnabled()) {
      console.log(`Note: Enrichment disabled - these are detected triggers only`);
    }

    // FINAL HOMEOSTATIC SYSTEM REPORT
    this.printFinalFeedbackReport();

    // Log warning file location
    try {
      const stats = fs.statSync(this.warningLogPath);
      if (stats.size > 100) {  // If there are warnings beyond header
        console.log(`\n⚠️  Warnings logged to: ${path.relative(process.cwd(), this.warningLogPath)}`);
      }
    } catch (error) {
      // File doesn't exist or is empty - no warnings
    }

    // Final flush of any remaining queued entities
    this.flushEntityEnrichmentQueue(true);

    return this.graph;
  }
  
  private shouldContinue(): boolean {
    // PRIORITY 1: Complete all eras (each era should run ~2 epochs)
    const allErasCompleted = this.currentEpoch >= this.config.eras.length * 2;

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
      console.log(`\n⚠️  Stopped: Hit maximum tick limit (${this.config.maxTicks})`);
      return false;
    }

    if (allErasCompleted) {
      if (excessiveGrowth) {
        console.log(`\n⚠️  Stopped: All eras complete + excessive growth (${this.graph.getEntityCount()} entities)`);
        return false;
      }
      console.log(`\n✓ All eras completed at epoch ${this.currentEpoch}`);
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
      console.log(`\n✓ Linked final era "${currentEra.name}" to ${linkedCount} prominent entities`);
    }
  }

  private runEpoch(): void {
    // Era progression is handled by eraTransition system, not selectEra()
    // The eraTransition system manages era entity status and updates graph.currentEra
    const previousEra = this.graph.currentEra;
    const era = this.graph.currentEra;

    console.log(`\n=== Epoch ${this.currentEpoch}: ${era.name} ===`);

    // Reset discovery counter for new epoch
    this.graph.discoveryState.discoveriesThisEpoch = 0;

    // Track initial counts for statistics
    const initialEntityCount = this.graph.getEntityCount();
    const initialRelationshipCount = this.graph.getRelationshipCount();

    // Growth phase
    const growthTargets = this.calculateGrowthTarget();
    this.runGrowthPhase(era, growthTargets);

    // Simulation phase
    for (let i = 0; i < this.config.simulationTicksPerGrowth; i++) {
      this.runSimulationTick(era);
      this.graph.tick++;
    }

    // Apply era special rules if any
    if (era.specialRules) {
      era.specialRules(this.graph);
    }

    // Meta-entity formation is now handled by SimulationSystems (run at epoch end)

    // Update pressures
    this.updatePressures(era);

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
      growthTargets
    );

    this.reportEpochStats();

    this.queueEraNarrative(previousEra, era);

    // Check for significant entity changes and enrich them
    this.queueChangeEnrichments();

    // HOMEOSTATIC CONTROL: Validate feedback loops every 5 epochs
    if (this.currentEpoch % 5 === 0 && this.currentEpoch > 0) {
      this.validateFeedbackLoops();
    }
  }

  /**
   * Validate all declared feedback loops and report broken loops
   */
  private validateFeedbackLoops(): void {
    const metrics = this.populationTracker.getMetrics();
    const results = this.feedbackAnalyzer.validateAll(metrics, this.graph);
    const brokenLoops = this.feedbackAnalyzer.getBrokenLoops(results);

    if (brokenLoops.length > 0) {
      console.warn(`\n⚠️  ${brokenLoops.length} feedback loops not functioning correctly:`);
      // Use enhanced diagnostics that check component contracts
      this.feedbackAnalyzer.printDetailedDiagnostics(results);
    } else {
      console.log(`\n✓ All ${results.length} feedback loops functioning correctly`);
    }

    // Report population outliers
    const outliers = this.populationTracker.getOutliers(0.3);
    if (outliers.overpopulated.length > 0 || outliers.underpopulated.length > 0) {
      console.log(`\n=== Population Deviations ===`);
      if (outliers.overpopulated.length > 0) {
        console.log(`Overpopulated (>30% above target):`);
        outliers.overpopulated.forEach(metric => {
          console.log(`  - ${metric.kind}:${metric.subtype}: ${metric.count}/${metric.target} (+${(metric.deviation * 100).toFixed(0)}%)`);
        });
      }
      if (outliers.underpopulated.length > 0) {
        console.log(`Underpopulated (>30% below target):`);
        outliers.underpopulated.forEach(metric => {
          console.log(`  - ${metric.kind}:${metric.subtype}: ${metric.count}/${metric.target} (${(metric.deviation * 100).toFixed(0)}%)`);
        });
      }
    }
  }

  /**
   * Print comprehensive final feedback system report
   */
  private printFinalFeedbackReport(): void {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`HOMEOSTATIC FEEDBACK SYSTEM - FINAL REPORT`);
    console.log('='.repeat(80));

    // Update metrics one final time
    this.populationTracker.update(this.graph);
    const metrics = this.populationTracker.getMetrics();
    const summary = this.populationTracker.getSummary();

    // Validate feedback loops
    const results = this.feedbackAnalyzer.validateAll(metrics, this.graph);
    const brokenLoops = this.feedbackAnalyzer.getBrokenLoops(results);
    const workingLoops = results.filter(r => r.valid);

    // 1. Feedback Loop Health
    console.log(`\n📊 FEEDBACK LOOP HEALTH`);
    console.log(`  Total loops tracked: ${results.length}`);
    console.log(`  ✓ Working correctly: ${workingLoops.length} (${((workingLoops.length / results.length) * 100).toFixed(0)}%)`);
    console.log(`  ⚠️  Not functioning: ${brokenLoops.length} (${((brokenLoops.length / results.length) * 100).toFixed(0)}%)`);

    // Use enhanced diagnostics that check component contracts
    this.feedbackAnalyzer.printDetailedDiagnostics(results);

    // 2. Population Metrics
    console.log(`\n📈 POPULATION METRICS`);
    console.log(`  Total entities: ${summary.totalEntities}`);
    console.log(`  Total relationships: ${summary.totalRelationships}`);
    console.log(`  Average deviation from targets: ${(summary.avgEntityDeviation * 100).toFixed(1)}%`);
    console.log(`  Maximum deviation: ${(summary.maxEntityDeviation * 100).toFixed(1)}%`);

    // 3. Entity Type Summary
    console.log(`\n🎯 ENTITY POPULATIONS (vs targets)`);
    const entityMetrics = Array.from(metrics.entities.values())
      .filter(m => m.target > 0)
      .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

    entityMetrics.forEach(metric => {
      const status = Math.abs(metric.deviation) < 0.2 ? '✓' :
                     Math.abs(metric.deviation) < 0.5 ? '⚠️' : '❌';
      const sign = metric.deviation > 0 ? '+' : '';
      console.log(`  ${status} ${metric.kind}:${metric.subtype.padEnd(20)} ${metric.count.toString().padStart(3)}/${metric.target.toString().padStart(3)} (${sign}${(metric.deviation * 100).toFixed(0)}%)`);
    });

    // 4. Critical Outliers
    const outliers = this.populationTracker.getOutliers(0.3);
    if (outliers.overpopulated.length > 0 || outliers.underpopulated.length > 0) {
      console.log(`\n⚠️  CRITICAL DEVIATIONS (>30%)`);
      if (outliers.overpopulated.length > 0) {
        console.log(`  Overpopulated:`);
        outliers.overpopulated.forEach(metric => {
          console.log(`    • ${metric.kind}:${metric.subtype}: ${metric.count}/${metric.target} (+${(metric.deviation * 100).toFixed(0)}%)`);
        });
      }
      if (outliers.underpopulated.length > 0) {
        console.log(`  Underpopulated:`);
        outliers.underpopulated.forEach(metric => {
          console.log(`    • ${metric.kind}:${metric.subtype}: ${metric.count}/${metric.target} (${(metric.deviation * 100).toFixed(0)}%)`);
        });
      }
    }

    // 5. Pressure States
    console.log(`\n🌡️  PRESSURE EQUILIBRIUM`);
    summary.pressureDeviations.forEach((deviation, pressureId) => {
      const metric = metrics.pressures.get(pressureId);
      if (metric) {
        const status = Math.abs(deviation) < 0.2 ? '✓' :
                       Math.abs(deviation) < 0.5 ? '⚠️' : '❌';
        const sign = deviation > 0 ? '+' : '';
        console.log(`  ${status} ${pressureId.padEnd(22)} ${metric.value.toFixed(1).padStart(5)}/${metric.target.toString().padStart(5)} (${sign}${(deviation * 100).toFixed(0)}%)`);
      }
    });

    // 6. Template Usage Statistics
    console.log(`\n📋 TEMPLATE USAGE (Diversity Report)`);
    const sortedTemplates = Array.from(this.templateRunCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    if (sortedTemplates.length > 0) {
      const totalRuns = sortedTemplates.reduce((sum, [_, count]) => sum + count, 0);
      console.log(`  Total template applications: ${totalRuns}`);
      console.log(`  Unique templates used: ${sortedTemplates.length}/${this.config.templates.length}`);
      console.log(`\n  Top templates by usage:`);

      sortedTemplates.slice(0, 10).forEach(([templateId, count]) => {
        const percentage = ((count / totalRuns) * 100).toFixed(1);
        const status = count >= this.maxRunsPerTemplate ? '🔴' :
                       count >= this.maxRunsPerTemplate * 0.7 ? '🟡' : '🟢';
        console.log(`    ${status} ${templateId.padEnd(35)} ${count.toString().padStart(3)}x (${percentage}%)`);
      });

      const unusedTemplates = this.config.templates.filter(t => !this.templateRunCounts.has(t.id));
      if (unusedTemplates.length > 0) {
        console.log(`\n  ⚠️  Unused templates (${unusedTemplates.length}) - Diagnostic Analysis:`);
        unusedTemplates.forEach(t => {
          // Test canApply to diagnose why it didn't run
          const diagnosticView = new TemplateGraphView(this.graph, this.targetSelector);

          console.log(`    • ${t.id.padEnd(35)}`);
          console.log(`      ${this.contractEnforcer.getDiagnostic(t, this.graph, diagnosticView)}`);
        });
      }
    }

    // 7. Overall System Health
    const systemHealth = workingLoops.length / results.length;
    const populationHealth = 1 - summary.avgEntityDeviation;
    const overallHealth = (systemHealth + populationHealth) / 2;

    console.log(`\n🏥 OVERALL SYSTEM HEALTH: ${(overallHealth * 100).toFixed(0)}%`);
    console.log(`  Feedback loops: ${(systemHealth * 100).toFixed(0)}%`);
    console.log(`  Population control: ${(populationHealth * 100).toFixed(0)}%`);

    if (overallHealth > 0.8) {
      console.log(`  ✓ System is STABLE - populations are well-regulated`);
    } else if (overallHealth > 0.6) {
      console.log(`  ⚠️  System is FUNCTIONAL - some tuning needed`);
    } else {
      console.log(`  ❌ System needs ATTENTION - significant deviations detected`);
    }

    // 8. Tag Health Report
    console.log('');
    const tagHealthReport = this.contractEnforcer.getTagAnalyzer().analyzeGraph(this.graph);
    const tagHealthSummary = this.contractEnforcer.getTagAnalyzer().getSummary(tagHealthReport);
    console.log(tagHealthSummary);

    // Print detailed issues if there are any significant problems
    if (tagHealthReport.issues.orphanTags.length > 10 ||
        tagHealthReport.issues.overusedTags.length > 0 ||
        tagHealthReport.issues.conflicts.length > 0) {
      const detailedIssues = this.contractEnforcer.getTagAnalyzer().getDetailedIssues(tagHealthReport);
      console.log(detailedIssues);
    }

    console.log('='.repeat(80));
  }

  private runGrowthPhase(era: Era, growthTargets?: number): void {
    // Use provided growth targets or calculate new ones
    const targets = growthTargets ?? this.calculateGrowthTarget();
    let entitiesCreated = 0;
    const createdEntities: HardState[] = [];

    // HOMEOSTATIC CONTROL: Update population metrics and calculate dynamic weights
    this.populationTracker.update(this.graph);
    const metrics = this.populationTracker.getMetrics();

    // Sample templates ONE AT A TIME until target reached
    let attempts = 0;
    const scale = this.config.scaleFactor || 1.0;
    const maxAttempts = Math.ceil(targets * 10 * scale);  // Safety limit (scaled)

    while (entitiesCreated < targets && attempts < maxAttempts) {
      attempts++;

      // Create restricted graph view for template (enforces targetSelector usage)
      const graphView = new TemplateGraphView(this.graph, this.targetSelector);

      // Re-filter applicable templates each iteration (graph state changes)
      const applicableTemplates = this.config.templates.filter(t => {
        // ENFORCEMENT 1: Contract-based filtering (enabledBy conditions)
        const contractCheck = this.contractEnforcer.checkContractEnabledBy(t, this.graph, graphView);
        if (!contractCheck.allowed) return false;

        // ENFORCEMENT 3: Registry-based saturation control
        const saturationCheck = this.contractEnforcer.checkSaturation(t, this.graph);
        if (saturationCheck.saturated) return false;

        // Original canApply check (template-specific logic)
        if (!t.canApply(graphView)) return false;

        // DIVERSITY PRESSURE: Hard cap on template runs
        const runCount = this.templateRunCounts.get(t.id) || 0;
        if (runCount >= this.maxRunsPerTemplate) return false;

        return true;
      });

      if (applicableTemplates.length === 0) {
        console.warn(`  No applicable templates remaining (${entitiesCreated}/${targets} entities created)`);
        break;
      }

      // Sample ONE template with weighted probability
      const template = this.sampleSingleTemplate(era, applicableTemplates, metrics);
      if (!template) {
        if (attempts < 5 || attempts % 50 === 0) {
          console.warn(`  [Attempt ${attempts}] Failed to sample template from ${applicableTemplates.length} options`);
        }
        continue;
      }

      // Check if template can apply
      if (!template.canApply(graphView)) {
        if (attempts < 5 || attempts % 50 === 0) {
          console.warn(`  [Attempt ${attempts}] Template ${template.id} canApply returned false`);
        }
        continue;
      }

      // Find targets
      const templateTargets = template.findTargets(graphView);
      if (templateTargets.length === 0) {
        if (attempts < 5 || attempts % 50 === 0) {
          console.warn(`  [Attempt ${attempts}] Template ${template.id} found no targets`);
        }
        continue;
      }

      // Apply template to random target
      const target = pickRandom(templateTargets);
      try {
        // Execute template with restricted graph view
        const result = template.expand(graphView, target);

        // ENFORCEMENT: Check tag saturation before creating entities
        // Collect all tags that would be added (convert EntityTags to array of keys)
        const allTagsToAdd = result.entities.flatMap(e => Object.keys(e.tags || {}));
        const tagSaturationCheck = this.contractEnforcer.checkTagSaturation(this.graph, allTagsToAdd);

        if (tagSaturationCheck.saturated) {
          console.warn(`  ⚠️  Template ${template.id} would oversaturate tags: ${tagSaturationCheck.oversaturatedTags.join(', ')}`);
          // Don't skip template, but log the warning for analysis
        }

        // ENFORCEMENT: Check for orphan tags (warn only)
        const orphanCheck = this.contractEnforcer.checkTagOrphans(allTagsToAdd);
        if (orphanCheck.hasOrphans && orphanCheck.orphanTags.length > 0) {
          // Only warn if there are multiple orphan tags (single legendary tags are expected)
          if (orphanCheck.orphanTags.length >= 3) {
            console.warn(`  ℹ️  Template ${template.id} creates unregistered tags: ${orphanCheck.orphanTags.slice(0, 5).join(', ')}`);
          }
        }

        // Record template application
        this.statisticsCollector.recordTemplateApplication(template.id);

        // Add entities to graph
        const newIds: string[] = [];
        const clusterEntities: HardState[] = [];
        result.entities.forEach((entity, i) => {
          const id = addEntity(this.graph, entity);
          newIds.push(id);
          const ref = this.graph.getEntity(id);
          if (ref) {
            createdEntities.push(ref);
            clusterEntities.push(ref);
          }
        });

        // Auto-initialize catalysts for newly created entities
        // This ensures consistent catalyst initialization for all entities,
        // whether from initial state or templates
        for (const entity of clusterEntities) {
          initializeCatalystSmart(entity, this.graph);
        }

        // Add relationships (resolve placeholder IDs and preserve distance/strength)
        result.relationships.forEach(rel => {
          const srcId = rel.src.startsWith('will-be-assigned-')
            ? newIds[parseInt(rel.src.split('-')[3])]
            : rel.src;
          const dstId = rel.dst.startsWith('will-be-assigned-')
            ? newIds[parseInt(rel.dst.split('-')[3])]
            : rel.dst;

          if (srcId && dstId) {
            // Pass through strength and distance from template relationships
            addRelationship(this.graph, rel.kind, srcId, dstId, rel.strength, rel.distance);
          }
        });

        // ENFORCEMENT 2: Automatic lineage enforcement
        // Add lineage relationships for newly created entities
        const lineageRelationships = this.contractEnforcer.enforceLineage(
          this.graph,
          graphView,
          clusterEntities
        );

        // ENFORCEMENT: Tag coverage validation
        // Check that entities have appropriate tag count (3-5 tags)
        for (const entity of clusterEntities) {
          const coverageCheck = this.contractEnforcer.enforceTagCoverage(entity, this.graph);
          if (coverageCheck.needsAdjustment) {
            // Log for debugging but don't fail - templates should handle this
            // console.warn(`  ℹ️  ${coverageCheck.suggestion}`);
          }
        }

        // ENFORCEMENT: Tag taxonomy validation
        // Check for conflicting tags on newly created entities
        for (const entity of clusterEntities) {
          const taxonomyCheck = this.contractEnforcer.validateTagTaxonomy(entity);
          if (!taxonomyCheck.valid) {
            console.warn(`  ⚠️  Entity ${entity.name} has conflicting tags:`);
            taxonomyCheck.conflicts.forEach(c => {
              console.warn(`      "${c.tag1}" vs "${c.tag2}": ${c.reason}`);
            });
          }
        }

        // ENFORCEMENT 4: Contract affects validation
        // Validate that template effects match contract declarations
        const warnings = this.contractEnforcer.validateAffects(
          template,
          result.entities.length,
          result.relationships.length + lineageRelationships.length,
          new Map() // TODO: Track pressure changes
        );

        if (warnings.length > 0) {
          console.warn(`  ⚠️  Template ${template.id} contract violations:`);
          warnings.forEach(w => console.warn(`      ${w}`));
        }

        // Merge lineage relationships into history
        const allRelationships = [...result.relationships, ...lineageRelationships] as Relationship[];

        // Record history
        this.graph.history.push({
          tick: this.graph.tick,
          era: era.id,
          type: 'growth',
          description: result.description,
          entitiesCreated: newIds,
          relationshipsCreated: allRelationships,
          entitiesModified: []
        });

        entitiesCreated += result.entities.length;

        // DIVERSITY TRACKING: Only count successful template runs (where entities were created)
        if (result.entities.length > 0) {
          const currentCount = this.templateRunCounts.get(template.id) || 0;
          this.templateRunCounts.set(template.id, currentCount + 1);
        }

        // Queue enrichment for this template's cluster immediately
        // Filter out eras - they get enriched separately and shouldn't go through entity enrichment
        const enrichableEntities = clusterEntities.filter(e => e.kind !== FRAMEWORK_ENTITY_KINDS.ERA);
        if (enrichableEntities.length > 0) {
          this.queueEntityEnrichment(enrichableEntities);
          this.queueDiscoveryEnrichment(enrichableEntities);
        }

      } catch (error) {
        console.error(`Template ${template.id} failed:`, error);
      }
    }

    console.log(`  Growth: +${entitiesCreated} entities (target: ${targets})`);

    // Flush any remaining entities in the enrichment queue
    this.flushEntityEnrichmentQueue(true);
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

    // Apply dynamic weight adjustments (homeostatic control)
    const adjustments = this.dynamicWeightCalculator.calculateAllWeights(
      applicableTemplates,
      new Map(Object.entries(baseEraWeights)),
      metrics
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
    // Get entity kinds from domain schema (not hardcoded)
    const entityKinds = this.config.domain.entityKinds.map(ek => ek.kind);
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
    const epochsRemaining = Math.max(1, this.config.eras.length * 2 - this.currentEpoch);

    // Dynamic target: spread remaining entities over remaining epochs
    const baseTarget = Math.ceil(totalRemaining / epochsRemaining);

    // Add some variance for organic feel (±30%)
    const variance = 0.3;
    const target = Math.floor(baseTarget * (1 - variance + Math.random() * variance * 2));

    // Cap at reasonable bounds (scaled by config.scaleFactor)
    return Math.max(this.growthBounds.min, Math.min(this.growthBounds.max, target));
  }

  /**
   * Calculate entity kind deficits (how underrepresented each kind is)
   */
  private calculateEntityDeficits(): Map<string, number> {
    // Get entity kinds from domain schema (not hardcoded)
    const entityKinds = this.config.domain.entityKinds.map(ek => ek.kind);
    const deficits = new Map<string, number>();

    // Count current entities by kind
    const currentCounts = new Map<string, number>();
    this.graph.forEachEntity((entity) => {
      currentCounts.set(entity.kind, (currentCounts.get(entity.kind) || 0) + 1);
    });

    // Calculate deficit for each kind
    for (const kind of entityKinds) {
      const current = currentCounts.get(kind) || 0;
      const target = this.config.targetEntitiesPerKind;
      const deficit = Math.max(0, target - current);
      deficits.set(kind, deficit);
    }

    return deficits;
  }

  /**
   * Select templates using weighted randomization based on entity deficits
   */
  private selectWeightedTemplates(era: Era, deficits: Map<string, number>, growthTarget: number): GrowthTemplate[] {
    // Build template weights based on era and deficits
    const templateWeights: Array<{ template: GrowthTemplate; weight: number }> = [];

    for (const template of this.config.templates) {
      // Get era weight
      const eraWeight = getTemplateWeight(era, template.id);
      if (eraWeight === 0) continue; // Template disabled in this era

      // Estimate what entity kind(s) this template creates
      // by looking at template naming convention or ID
      let deficitWeight = 1.0;

      // Use template metadata to determine what entity kinds it produces
      // No more string matching heuristics!
      if (template.metadata?.produces?.entityKinds) {
        // Calculate average deficit across all kinds this template produces
        let totalDeficit = 0;
        let kindCount = 0;

        for (const entityKindDef of template.metadata.produces.entityKinds) {
          const deficit = deficits.get(entityKindDef.kind) || 0;
          totalDeficit += deficit;
          kindCount++;
        }

        if (kindCount > 0) {
          deficitWeight = (totalDeficit / kindCount) + 1;
        }
      }
      // Fallback: if no metadata, use default weight (no deficit bonus)
      // This encourages templates to have proper metadata

      // Normalize deficit weight to be a multiplier (0.5x to 3x)
      // This ensures templates for underrepresented kinds are 2-6x more likely
      const normalizedDeficitWeight = 0.5 + (deficitWeight / this.config.targetEntitiesPerKind) * 2.5;

      // Combined weight = era weight × deficit weight
      const combinedWeight = eraWeight * normalizedDeficitWeight;

      templateWeights.push({ template, weight: combinedWeight });
    }

    // Select templates using weighted randomization
    // We select more templates than growth target to account for failures
    const selectCount = Math.min(templateWeights.length, growthTarget * 3);
    const selected: GrowthTemplate[] = [];

    for (let i = 0; i < selectCount; i++) {
      if (templateWeights.length === 0) break;

      // Weighted random selection
      const totalWeight = templateWeights.reduce((sum, tw) => sum + tw.weight, 0);
      if (totalWeight === 0) break;

      let roll = Math.random() * totalWeight;
      let selectedIndex = 0;

      for (let j = 0; j < templateWeights.length; j++) {
        roll -= templateWeights[j].weight;
        if (roll <= 0) {
          selectedIndex = j;
          break;
        }
      }

      // Add selected template and remove from pool (sample without replacement)
      selected.push(templateWeights[selectedIndex].template);
      templateWeights.splice(selectedIndex, 1);
    }

    return selected;
  }
  
  private runSimulationTick(era: Era): void {
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

    for (const system of this.config.systems) {
      const baseModifier = getSystemModifier(era, system.id);
      if (baseModifier === 0) continue; // System disabled by era

      // Apply distribution-based adjustment on top of era modifier
      const modifier = distributionModifiers[system.id] ?? baseModifier;

      try {
        const result = system.apply(this.graph, modifier);

        // Record system execution
        this.statisticsCollector.recordSystemExecution(system.id);

        // Track system metrics
        const metric = this.systemMetrics.get(system.id) || { relationshipsCreated: 0, lastThrottleCheck: 0 };

        // Apply relationships with budget check
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

        // Apply pressure changes
        for (const [pressure, delta] of Object.entries(result.pressureChanges)) {
          const current = this.graph.pressures.get(pressure) || 0;
          this.graph.pressures.set(pressure, Math.max(0, Math.min(100, current + delta)));
        }

        totalRelationships += result.relationshipsAdded.length;
        totalModifications += result.entitiesModified.length;

      } catch (error) {
        console.error(`System ${system.id} failed:`, error);
      }
    }

    if (relationshipsThisTick.length > 0) {
      this.queueRelationshipEnrichment(relationshipsThisTick);
    }

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

    this.config.pressures.forEach(pressure => {
      const current = this.graph.pressures.get(pressure.id) || pressure.value;
      const rawGrowth = pressure.growth(this.graph);

      // Apply diminishing returns for high pressure values to prevent maxing out
      // Growth is scaled down as pressure approaches 100
      // Use exponential decay to prevent maxing out
      const growthScaling = Math.max(0.1, 1 - Math.pow(current / 100, 2)); // At 80, ~36%; at 100, ~10%
      const growth = rawGrowth * growthScaling;

      // Decay always subtracts (no conditional flip)
      const decay = -pressure.decay;

      // Apply era modifier if present
      const eraModifier = era.pressureModifiers?.[pressure.id] || 1.0;

      // Apply distribution feedback adjustment
      const distributionFeedback = distributionAdjustments[pressure.id] || 0;

      const delta = (growth + decay) * eraModifier + distributionFeedback;

      // Smooth large changes to prevent spikes (max change per epoch: ±15)
      const smoothedDelta = Math.max(-15, Math.min(15, delta));

      const newValue = current + smoothedDelta;
      this.graph.pressures.set(pressure.id, Math.max(0, Math.min(100, newValue)));
    });
  }

  /**
   * Calculate distribution-based system modifier adjustments
   */
  private calculateDistributionSystemModifiers(era: Era): Record<string, number> {
    if (!this.systemSelector) return {};

    // Build era modifiers map
    const eraModifiers: Record<string, number> = {};
    this.config.systems.forEach(system => {
      eraModifiers[system.id] = getSystemModifier(era, system.id);
    });

    return this.systemSelector.calculateSystemModifiers(
      this.graph,
      this.config.systems,
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

  private reportEpochStats(): void {
    const byKind = new Map<string, number>();
    const bySubtype = new Map<string, number>();

    this.graph.forEachEntity((entity) => {
      byKind.set(entity.kind, (byKind.get(entity.kind) || 0) + 1);
      const key = `${entity.kind}:${entity.subtype}`;
      bySubtype.set(key, (bySubtype.get(key) || 0) + 1);
    });

    console.log(`  Entities by kind:`, Object.fromEntries(byKind));
    console.log(`  Relationships: ${this.graph.getRelationshipCount()}`);
    console.log(`  Pressures:`, Object.fromEntries(this.graph.pressures));

    // Report distribution statistics if using TemplateSelector
    if (this.templateSelector) {
      this.reportDistributionStats();
    }
  }

  /**
   * Report distribution statistics and deviation from targets
   */
  private reportDistributionStats(): void {
    if (!this.templateSelector) return;

    const state = this.templateSelector.getState(this.graph);
    const deviation = this.templateSelector.getDeviation(this.graph);

    // Entity kind distribution
    console.log(`\n  === Distribution Statistics ===`);
    console.log(`  Entity Kinds (current vs target):`);
    Object.entries(state.entityKindRatios).forEach(([kind, ratio]) => {
      const target = this.config.distributionTargets?.global.entityKindDistribution.targets[kind] || 0;
      const delta = ratio - target;
      const sign = delta > 0 ? '+' : '';
      const status = Math.abs(delta) > 0.05 ? '⚠️' : '✓';
      console.log(`    ${status} ${kind}: ${(ratio * 100).toFixed(1)}% (target: ${(target * 100).toFixed(1)}%, ${sign}${(delta * 100).toFixed(1)}%)`);
    });

    // Prominence distribution
    console.log(`  Prominence (current vs target):`);
    Object.entries(state.prominenceRatios).forEach(([level, ratio]) => {
      const target = this.config.distributionTargets?.global.prominenceDistribution.targets[level as any] || 0;
      const delta = ratio - target;
      const sign = delta > 0 ? '+' : '';
      const status = Math.abs(delta) > 0.05 ? '⚠️' : '✓';
      console.log(`    ${status} ${level}: ${(ratio * 100).toFixed(1)}% (target: ${(target * 100).toFixed(1)}%, ${sign}${(delta * 100).toFixed(1)}%)`);
    });

    // Relationship diversity
    const topRelTypes = Object.entries(state.relationshipTypeRatios)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    console.log(`  Top relationship types:`);
    topRelTypes.forEach(([type, ratio]) => {
      const status = ratio > 0.15 ? '⚠️' : '✓';
      console.log(`    ${status} ${type}: ${(ratio * 100).toFixed(1)}%`);
    });

    // Graph metrics
    const avgDegree = (this.graph.getRelationshipCount() * 2) / state.totalEntities; // Each relationship connects 2 entities
    console.log(`  Graph Connectivity:`);
    console.log(`    Clusters: ${state.graphMetrics.clusters} (target: ${this.config.distributionTargets?.global.graphConnectivity.targetClusters.preferred || 5})`);
    console.log(`    Avg cluster size: ${state.graphMetrics.avgClusterSize.toFixed(1)}`);
    console.log(`    Avg connections/entity: ${avgDegree.toFixed(1)}`);
    console.log(`    Isolated nodes: ${state.graphMetrics.isolatedNodes} (${(state.graphMetrics.isolatedNodeRatio * 100).toFixed(1)}%)`);

    // Overall deviation score
    console.log(`\n  Overall Deviation Score: ${deviation.overall.toFixed(3)}`);
    if (deviation.overall > 0.15) {
      console.log(`  ⚠️  HIGH DEVIATION - template selection will be heavily guided`);
    } else if (deviation.overall < 0.08) {
      console.log(`  ✓ CONVERGED - template selection is lightly guided`);
    }
  }
  
  private async waitForNameEnrichmentsSnapshot(): Promise<void> {
    if (this.pendingNameEnrichments.length === 0) return;
    const pending = [...this.pendingNameEnrichments];
    await Promise.allSettled(pending);
    this.pendingNameEnrichments = this.pendingNameEnrichments.filter(p => !pending.includes(p));
  }
  
  private syncNameTags(): void {
    this.graph.forEachEntity((entity) => {
      const hasNameTag = entity.tags?.name !== undefined;
      if (!hasNameTag) return;
      // Note: This modifies a clone, need to use updateEntity
      this.graph.updateEntity(entity.id, { tags: { ...entity.tags, name: entity.name } });
    });
  }

  private enrichInitialEntities(): void {
    if (!this.enrichmentService?.isEnabled()) return;

    const initialEntities = this.graph.getEntities().filter(e => e.createdAt === 0);
    if (initialEntities.length === 0) return;

    console.log(`Enriching ${initialEntities.length} initial entities (descriptions only)...`);

    const context = this.buildEnrichmentContext();
    const enrichmentPromise = (async () => {
      // Names are now generated at entity creation time via name-forge
      const records = await this.enrichmentService!.enrichEntities(
        initialEntities,
        context
      );
      this.graph.loreRecords.push(...records);
    })().catch(error => console.warn('Initial entity enrichment failed:', error));

    const tracked = enrichmentPromise.then(() => undefined);
    this.pendingEnrichments.push(tracked);
    this.pendingNameEnrichments.push(tracked);
    tracked.finally(() => {
      this.pendingNameEnrichments = this.pendingNameEnrichments.filter(p => p !== tracked);
    });
  }

  private queueEntityEnrichment(entities: HardState[]): void {
    if (!this.enrichmentService?.isEnabled() || entities.length === 0) return;

    // Add entities to the batching queue
    this.entityEnrichmentQueue.push(...entities);

    // Track analytics for all queued entities
    entities.forEach(entity => {
      switch (entity.kind) {
        case 'location':
          this.enrichmentAnalytics.locationEnrichments++;
          break;
        case 'faction':
          this.enrichmentAnalytics.factionEnrichments++;
          break;
        case 'rules':
          this.enrichmentAnalytics.ruleEnrichments++;
          break;
        case 'abilities':
          this.enrichmentAnalytics.abilityEnrichments++;
          break;
        case 'npc':
          this.enrichmentAnalytics.npcEnrichments++;
          break;
        case FRAMEWORK_ENTITY_KINDS.OCCURRENCE:
          this.enrichmentAnalytics.occurrenceEnrichments++;
          break;
        case FRAMEWORK_ENTITY_KINDS.ERA:
          this.enrichmentAnalytics.eraEnrichments++;
          break;
      }
    });

    // Flush queue if it reaches batch size threshold
    if (this.entityEnrichmentQueue.length >= this.ENRICHMENT_BATCH_SIZE) {
      this.flushEntityEnrichmentQueue();
    }
  }

  private flushEntityEnrichmentQueue(force: boolean = false): void {
    if (!this.enrichmentService?.isEnabled()) return;
    if (this.entityEnrichmentQueue.length === 0) return;

    // Only flush if we have enough entities, unless forced
    if (!force && this.entityEnrichmentQueue.length < this.ENRICHMENT_BATCH_SIZE) return;

    // Take all queued entities
    const entitiesToEnrich = [...this.entityEnrichmentQueue];
    this.entityEnrichmentQueue = [];

    // Apply partial mode limits
    const limit = this.config.enrichmentConfig?.maxEntityEnrichments;
    if (this.config.enrichmentConfig?.mode === 'partial') {
      const remaining = (limit ?? 0) - this.entityEnrichmentsUsed;
      if (remaining <= 0) return;
      entitiesToEnrich.splice(remaining); // Truncate to remaining budget
      this.entityEnrichmentsUsed += entitiesToEnrich.length;
    }

    // CRITICAL: Wait for all previous name enrichments to complete before enriching new entities
    // This ensures that lore references use final entity names, not placeholder names
    const enrichmentPromise = this.waitForNameEnrichmentsSnapshot().then(async () => {
      // Build context AFTER name enrichments complete, so snapshot has final names
      const context = this.buildEnrichmentContext();
      const records = await this.enrichmentService!.enrichEntities(entitiesToEnrich, context);
      this.graph.loreRecords.push(...records);

      // Abilities get an extra pass to keep tech/magic in bounds
      const abilityRecords = await Promise.all(
        entitiesToEnrich
          .filter(e => e.kind === 'abilities')
          .map(e => this.enrichmentService!.enrichAbility(e, context))
      );

      abilityRecords
        .filter((r): r is LoreRecord => Boolean(r))
        .forEach(r => this.graph.loreRecords.push(r));
    }).catch(error => console.warn('Enrichment failed:', error));

    const tracked = enrichmentPromise.then(() => undefined);
    this.pendingEnrichments.push(tracked);
    this.pendingNameEnrichments.push(tracked);
    tracked.finally(() => {
      this.pendingNameEnrichments = this.pendingNameEnrichments.filter(p => p !== tracked);
    });
  }
  
  private queueRelationshipEnrichment(newRelationships: Relationship[]): void {
    if (!this.enrichmentService?.isEnabled()) return;
    
    const notable = newRelationships.filter(rel => {
      const a = this.graph.getEntity(rel.src);
      const b = this.graph.getEntity(rel.dst);
      if (!a || !b) return false;

      return getProminenceValue(a.prominence) >= 3 && getProminenceValue(b.prominence) >= 3;
    }).slice(0, 3); // keep batches small for quality

    if (notable.length === 0) return;

    const actors: Record<string, HardState> = {};
    notable.forEach(rel => {
      const a = this.graph.getEntity(rel.src);
      const b = this.graph.getEntity(rel.dst);
      if (a) actors[a.id] = a;
      if (b) actors[b.id] = b;
    });
    
    const context = this.buildEnrichmentContext();
    let relationshipsToEnrich = notable;
    if (this.config.enrichmentConfig?.mode === 'partial') {
      const limit = this.config.enrichmentConfig?.maxRelationshipEnrichments ?? 0;
      const remaining = limit - this.relationshipEnrichmentsUsed;
      if (remaining <= 0) return;
      relationshipsToEnrich = notable.slice(0, remaining);
    }
    if (this.config.enrichmentConfig?.mode === 'partial') {
      this.relationshipEnrichmentsUsed += relationshipsToEnrich.length;
    }
    
    const promise = this.waitForNameEnrichmentsSnapshot()
      .then(() => this.enrichmentService!.enrichRelationships(relationshipsToEnrich, actors, context))
      .then(records => {
        this.graph.loreRecords.push(...records);
      })
      .catch(error => console.warn('Relationship enrichment failed:', error));
    
    this.pendingEnrichments.push(promise.then(() => undefined));
  }

  /**
   * Queue occurrence enrichment
   * Called after occurrence creation systems run
   */
  private queueOccurrenceEnrichment(occurrence: HardState, catalystId?: string): void {
    if (!this.enrichmentService?.isEnabled()) return;

    const context: any = this.buildEnrichmentContext();
    // Add catalyst info to context
    if (catalystId) {
      context.catalystInfo = { entityId: catalystId };
    }

    const enrichmentPromise = (async () => {
      const record = await this.enrichmentService!.enrichOccurrence(occurrence, context);
      if (record) {
        this.graph.loreRecords.push(record);
        // Update occurrence with enriched data
        occurrence.name = (record.metadata?.name as string) || occurrence.name;
        occurrence.description = record.text;
      }
    })().catch(error => console.warn('Occurrence enrichment failed:', error));

    this.pendingEnrichments.push(enrichmentPromise.then(() => undefined));
  }

  /**
   * Queue era enrichment
   * Called after era transitions
   */
  private queueEraEnrichment(era: HardState): void {
    if (!this.enrichmentService?.isEnabled()) return;

    const context = this.buildEnrichmentContext();

    const enrichmentPromise = (async () => {
      const record = await this.enrichmentService!.enrichEra(era, context);
      if (record) {
        this.graph.loreRecords.push(record);
        // Update era with enriched data
        era.name = (record.metadata?.name as string) || era.name;
        era.description = record.text;
      }
    })().catch(error => console.warn('Era enrichment failed:', error));

    this.pendingEnrichments.push(enrichmentPromise.then(() => undefined));
  }

  private queueChangeEnrichments(): void {
    const changedEntities: Array<{ entity: HardState; changes: string[] }> = [];

    // Check all entities for significant changes using kind-specific detection
    this.graph.forEachEntity((entity) => {
      const snapshot = this.entitySnapshots.get(entity.id);

      // Skip if no snapshot (newly created entities already enriched)
      if (!snapshot) {
        // Create snapshot for next epoch
        this.snapshotEntity(entity);
        return;
      }

      // Use kind-specific detection functions
      let changes: string[] = [];
      switch (entity.kind) {
        case 'location':
          changes = detectLocationChanges(entity, snapshot, this.graph);
          break;
        case 'faction':
          changes = detectFactionChanges(entity, snapshot, this.graph);
          break;
        case 'rules':
          changes = detectRuleChanges(entity, snapshot, this.graph);
          break;
        case 'abilities':
          changes = detectAbilityChanges(entity, snapshot, this.graph);
          break;
        case 'npc':
          changes = detectNPCChanges(entity, snapshot, this.graph);
          break;
      }

      // Track analytics even when enrichment disabled
      if (changes.length > 0) {
        switch (entity.kind) {
          case 'location':
            this.enrichmentAnalytics.locationEnrichments++;
            break;
          case 'faction':
            this.enrichmentAnalytics.factionEnrichments++;
            break;
          case 'rules':
            this.enrichmentAnalytics.ruleEnrichments++;
            break;
          case 'abilities':
            this.enrichmentAnalytics.abilityEnrichments++;
            break;
          case 'npc':
            this.enrichmentAnalytics.npcEnrichments++;
            break;
          case FRAMEWORK_ENTITY_KINDS.OCCURRENCE:
            this.enrichmentAnalytics.occurrenceEnrichments++;
            break;
          case FRAMEWORK_ENTITY_KINDS.ERA:
            this.enrichmentAnalytics.eraEnrichments++;
            break;
        }

        changedEntities.push({ entity, changes });
        // Update snapshot
        this.snapshotEntity(entity);
      }
    });

    // Only actually enrich if service is enabled
    if (!this.enrichmentService?.isEnabled()) return;

    // Enrich changed entities (batch by up to 3)
    if (changedEntities.length > 0) {
      const context = this.buildEnrichmentContext();

      changedEntities.forEach(({ entity, changes }) => {
        const promise = this.waitForNameEnrichmentsSnapshot()
          .then(() => this.enrichmentService!.enrichEntityChanges(entity, changes, context))
          .then(record => {
            if (record) {
              this.graph.loreRecords.push(record);
            }
          })
          .catch(error => console.warn('Change enrichment failed:', error));

        this.pendingEnrichments.push(promise.then(() => undefined));
      });
    }
  }

  private snapshotEntity(entity: HardState): void {
    const keyRelationshipIds = new Set(
      entity.links
        .filter(l => l.kind === 'member_of' || l.kind === 'resident_of' || l.kind === 'leader_of')
        .map(l => `${l.kind}:${l.dst}`)
    );

    const snapshot: EntitySnapshot = {
      tick: this.graph.tick,
      status: entity.status,
      prominence: entity.prominence,
      keyRelationshipIds
    };

    // Add kind-specific metrics
    switch (entity.kind) {
      case 'location':
        // Population (count of resident_of relationships pointing to this location)
        snapshot.residentCount = this.graph.findRelationships({ kind: 'resident_of', dst: entity.id }).length;

        // Controller (faction with stronghold_of or controls pointing to this location)
        const locationRels = this.graph.getEntityRelationships(entity.id, 'dst');
        const controller = locationRels.find(r =>
          r.kind === 'stronghold_of' || r.kind === 'controls'
        );
        snapshot.controllerId = controller?.src;
        break;

      case 'faction':
        // Leader (who has leader_of pointing to this faction)
        const leaderRels = this.graph.findRelationships({ kind: 'leader_of', dst: entity.id });
        const leader = leaderRels[0];
        snapshot.leaderId = leader?.src;

        // Territory count (stronghold_of or controls from this faction)
        const factionRels = this.graph.getEntityRelationships(entity.id, 'src');
        snapshot.territoryCount = factionRels.filter(r =>
          r.kind === 'stronghold_of' || r.kind === 'controls'
        ).length;

        // Allies (allied_with from this faction)
        snapshot.allyIds = new Set(
          this.graph.findRelationships({ kind: 'allied_with', src: entity.id })
            .map(r => r.dst)
        );

        // Enemies (at_war_with from this faction)
        snapshot.enemyIds = new Set(
          this.graph.findRelationships({ kind: 'at_war_with', src: entity.id })
            .map(r => r.dst)
        );
        break;

      case 'rules':
        // Enforcers (factions with weaponized_by or kept_secret_by pointing to this rule)
        const ruleRels = this.graph.getEntityRelationships(entity.id, 'dst');
        snapshot.enforcerIds = new Set(
          ruleRels
            .filter(r => r.kind === 'weaponized_by' || r.kind === 'kept_secret_by')
            .map(r => r.src)
        );
        break;

      case 'abilities':
        // Practitioner count (practitioner_of relationships pointing to this ability)
        snapshot.practitionerCount = this.graph.findRelationships({ kind: 'practitioner_of', dst: entity.id }).length;

        // Locations where it manifests (manifests_at from this ability)
        snapshot.locationIds = new Set(
          this.graph.findRelationships({ kind: 'manifests_at', src: entity.id })
            .map(r => r.dst)
        );
        break;

      case 'npc':
        // Leadership positions (leader_of from this NPC)
        snapshot.leadershipIds = new Set(
          entity.links
            .filter(l => l.kind === 'leader_of')
            .map(l => l.dst)
        );
        break;
    }

    this.entitySnapshots.set(entity.id, snapshot);
  }

  private queueEraNarrative(fromEra: Era, toEra: Era): void {
    if (!this.enrichmentService?.isEnabled()) return;
    if (fromEra.id === toEra.id) return;
    if (this.config.enrichmentConfig?.mode === 'partial') {
      const limit = this.config.enrichmentConfig?.maxEraNarratives ?? 0;
      if (this.eraNarrativesUsed >= limit) return;
    }
    if (this.config.enrichmentConfig?.mode === 'partial') {
      this.eraNarrativesUsed += 1;
    }

    const actors = this.graph.getEntities()
      .filter(e => getProminenceValue(e.prominence) >= 3)
      .slice(0, 5);

    const pressures = Object.fromEntries(this.graph.pressures);
    const currentTick = this.graph.tick; // Capture tick at time of era transition

    const promise = this.waitForNameEnrichmentsSnapshot()
      .then(() => this.enrichmentService!.generateEraNarrative({
        fromEra: fromEra.name,
        toEra: toEra.name,
        pressures,
        actors,
        tick: currentTick
      })).then(record => {
        if (record) {
          this.graph.loreRecords.push(record);
          this.eraNarrativesUsed += 1;
          this.graph.history.push({
            tick: currentTick,
            era: toEra.id,
            type: 'special',
            description: record.text,
            entitiesCreated: [],
            relationshipsCreated: [],
            entitiesModified: []
          });
        }
      }).catch(error => console.warn('Era narrative enrichment failed:', error));

    this.pendingEnrichments.push(promise.then(() => undefined));
  }

  private queueDiscoveryEnrichment(entities: HardState[]): void {
    if (!this.enrichmentService?.isEnabled()) return;

    // Find newly created locations that were discovered
    const discoveries = entities.filter(e => e.kind === 'location');
    if (discoveries.length === 0) return;

    discoveries.forEach(location => {
      // Find the explorer via discovered_by or explorer_of relationships
      const locationRels = this.graph.getEntityRelationships(location.id);
      const discoveryRel = locationRels.find(r =>
        (r.kind === 'discovered_by' && r.src === location.id) ||
        (r.kind === 'explorer_of' && r.dst === location.id)
      );

      if (!discoveryRel) return;

      const explorerId = discoveryRel.kind === 'discovered_by' ? discoveryRel.dst : discoveryRel.src;
      const explorer = this.graph.getEntity(explorerId);
      if (!explorer || explorer.kind !== 'npc') return;

      // Capture tick at time of discovery
      const discoveryTick = this.graph.tick;

      // Determine discovery type based on tags and world state
      let discoveryType: 'pressure' | 'exploration' | 'chain' = 'exploration';
      let triggerContext: { pressure?: string; chainSource?: HardState } = {};

      // Check if pressure-driven (resource, strategic, mystical locations)
      if (location.subtype === 'geographic_feature' && hasTag(location.tags, 'resource')) {
        discoveryType = 'pressure';
        triggerContext.pressure = 'resource_scarcity';
      } else if (hasTag(location.tags, 'strategic')) {
        discoveryType = 'pressure';
        triggerContext.pressure = 'conflict';
      } else if (location.subtype === 'anomaly' || hasTag(location.tags, 'mystical')) {
        discoveryType = 'pressure';
        triggerContext.pressure = 'magical_instability';
      }

      // Check for chain discoveries (adjacent to other discovered locations)
      const adjacentLocations = this.graph.findRelationships({ kind: 'adjacent_to', src: location.id })
        .map(r => this.graph.getEntity(r.dst))
        .filter((e): e is HardState => e !== undefined && e.kind === 'location');

      if (adjacentLocations.length > 0) {
        const recentlyDiscovered = adjacentLocations.find(loc =>
          (this.graph.tick - loc.createdAt) <= 20
        );
        if (recentlyDiscovered) {
          discoveryType = 'chain';
          triggerContext.chainSource = recentlyDiscovered;
        }
      }

      // Queue discovery event enrichment
      const promise = this.waitForNameEnrichmentsSnapshot()
        .then(() => this.enrichmentService!.enrichDiscoveryEvent({
          location,
          explorer,
          discoveryType,
          triggerContext,
          tick: discoveryTick
        }))
        .then(record => {
          if (record) {
            this.graph.loreRecords.push(record);
          }
        })
        .catch(error => console.warn('Discovery enrichment failed:', error));

      this.pendingEnrichments.push(promise.then(() => undefined));

      // If this was a chain discovery, also generate chain link explanation
      if (discoveryType === 'chain' && triggerContext.chainSource) {
        const chainPromise = this.waitForNameEnrichmentsSnapshot()
          .then(() => this.enrichmentService!.generateChainLink({
            sourceLocation: triggerContext.chainSource!,
            revealedLocationTheme: location.subtype,
            explorer
          }))
          .then(record => {
            if (record) {
              this.graph.loreRecords.push(record);
            }
          })
          .catch(error => console.warn('Chain link enrichment failed:', error));

        this.pendingEnrichments.push(chainPromise.then(() => undefined));
      }
    });
  }

  private buildEnrichmentContext() {
    // Separate active and historical relationships for lore generation
    const allRelationships = this.graph.getRelationships();
    const activeRelationships = allRelationships.filter(r => r.status !== 'historical');
    const historicalRelationships = allRelationships.filter(r => r.status === 'historical');

    // Build entities map for enrichment context
    const entitiesMap = new Map<string, HardState>();
    this.graph.forEachEntity((entity, id) => {
      entitiesMap.set(id, entity);
    });

    return {
      graphSnapshot: {
        tick: this.graph.tick,
        era: this.graph.currentEra.name,
        pressures: Object.fromEntries(this.graph.pressures),
        entities: entitiesMap,
        relationships: activeRelationships,  // Current state
        historicalRelationships: historicalRelationships  // Past state for context
      },
      relatedHistory: this.graph.history.slice(-5).map(h => h.description)
    };
  }

  /**
   * Queue image generation for mythic entities
   * Called at the end of world generation
   */
  public async generateMythicImages(): Promise<void> {
    if (!this.imageGenerationService?.isEnabled()) {
      return;
    }

    const entities = this.graph.getEntities();
    const context = this.buildEnrichmentContext();

    console.log(`\n=== Generating Images for Mythic Entities ===`);

    const results = await this.imageGenerationService.generateImagesForMythicEntities(
      entities,
      context
    );

    const stats = this.imageGenerationService.getStats();
    console.log(`✓ Generated ${stats.imagesGenerated} images`);
    console.log(`  Output: ${path.relative(process.cwd(), stats.outputDir)}`);
    console.log(`  Log: ${path.relative(process.cwd(), stats.logPath)}`);

    // Export image metadata
    const imageMetadata = {
      generatedAt: new Date().toISOString(),
      totalImages: stats.imagesGenerated,
      results: results.map(r => ({
        entityId: r.entityId,
        entityName: r.entityName,
        entityKind: r.entityKind,
        prompt: r.prompt,
        localPath: r.localPath ? path.relative(process.cwd(), r.localPath) : undefined,
        error: r.error
      }))
    };

    const metadataPath = path.join(stats.outputDir, 'image_metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(imageMetadata, null, 2));
    console.log(`  Metadata: ${path.relative(process.cwd(), metadataPath)}`);
  }
  
  // Export methods
  public getGraph(): Graph {
    return this.graph;
  }

  public getLoreRecords(): LoreRecord[] {
    return this.graph.loreRecords;
  }

  public finalizeNameLogging(): void {
    if (this.enrichmentService?.isEnabled()) {
      this.enrichmentService.getNameLogger().writeFinalReport();
    }
  }

  public getHistory(): HistoryEvent[] {
    return this.graph.history;
  }
  
  public async finalizeEnrichments(): Promise<void> {
    if (this.pendingEnrichments.length === 0) {
      await this.waitForNameEnrichmentsSnapshot();
      this.syncNameTags();
      return;
    }
    const pending = [...this.pendingEnrichments];
    this.pendingEnrichments = [];
    await Promise.allSettled(pending);
    await this.waitForNameEnrichmentsSnapshot();
    this.syncNameTags();
  }
  
  public exportState(): any {
    const entities = this.graph.getEntities();
    const totalEnrichmentTriggers = Object.values(this.enrichmentAnalytics).reduce((a, b) => a + b, 0);

    // Filter historical relationships for day 0 coherence
    // Exported state represents the current moment, not accumulated history
    const allRelationships = this.graph.getRelationships();
    const activeRelationships = allRelationships.filter(r => r.status !== 'historical');
    const historicalRelationships = allRelationships.filter(r => r.status === 'historical');

    // Extract meta-entities for visibility
    const metaEntities = entities.filter(e => hasTag(e.tags, 'meta-entity'));

    const exportData: any = {
      metadata: {
        tick: this.graph.tick,
        epoch: this.currentEpoch,
        era: this.graph.currentEra.name,
        entityCount: entities.length,
        relationshipCount: activeRelationships.length,
        historicalRelationshipCount: historicalRelationships.length,
        historyEventCount: this.graph.history.length,
        metaEntityCount: metaEntities.length,
        enrichmentTriggers: {
          total: totalEnrichmentTriggers,
          byKind: this.enrichmentAnalytics,
          comment: 'Counts detected enrichment triggers (tracks even when enrichment disabled)'
        },
        metaEntityFormation: {
          totalFormed: this.metaEntitiesFormed.length,
          formations: this.metaEntitiesFormed,
          comment: 'Meta-entities are abilities/rules that emerged from clustering, marked with meta-entity tag'
        }
      },
      hardState: entities,
      relationships: activeRelationships,  // Only active relationships for day 0 game state
      historicalRelationships: historicalRelationships,  // Historical relationships for lore generation
      pressures: Object.fromEntries(this.graph.pressures),
      history: this.graph.history,  // Export ALL events, not just last 50
      loreRecords: this.graph.loreRecords
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

    return exportData;
  }

  /**
   * Export statistics for fitness evaluation
   */
  public exportStatistics(validationResults: ValidationStats): SimulationStatistics {
    return this.statisticsCollector.generateStatistics(
      this.graph,
      this.config,
      {
        locationEnrichments: this.enrichmentAnalytics.locationEnrichments,
        factionEnrichments: this.enrichmentAnalytics.factionEnrichments,
        ruleEnrichments: this.enrichmentAnalytics.ruleEnrichments,
        abilityEnrichments: this.enrichmentAnalytics.abilityEnrichments,
        npcEnrichments: this.enrichmentAnalytics.npcEnrichments,
        totalEnrichments: Object.values(this.enrichmentAnalytics).reduce((a, b) => a + b, 0)
      },
      validationResults
    );
  }
}
