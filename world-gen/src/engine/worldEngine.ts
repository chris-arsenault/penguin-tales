import { Graph, EngineConfig, Era, GrowthTemplate, HistoryEvent } from '../types/engine';
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
  upsertNameTag
} from '../utils/helpers';
import { selectEra, getTemplateWeight, getSystemModifier } from '../domain/penguin/config/eras';
import { EnrichmentService } from '../services/enrichmentService';
import { ImageGenerationService } from '../services/imageGenerationService';
import { TemplateSelector } from '../services/templateSelector';
import { SystemSelector } from '../services/systemSelector';
import { DistributionTracker } from '../services/distributionTracker';
import { StatisticsCollector } from '../services/statisticsCollector';
import { SimulationStatistics, ValidationStats } from '../types/statistics';
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
  const currentResidents = graph.relationships.filter(r =>
    r.kind === 'resident_of' && r.dst === location.id
  );
  const residentDelta = currentResidents.length - (snapshot.residentCount || 0);
  if (Math.abs(residentDelta) >= 3) {
    changes.push(`population: ${residentDelta > 0 ? '+' : ''}${residentDelta} residents`);
  }

  // Control changes (track as dst of stronghold_of or controls)
  const currentController = graph.relationships.find(r =>
    (r.kind === 'stronghold_of' || r.kind === 'controls') && r.dst === location.id
  );
  const currentControllerId = currentController?.src;
  if (currentControllerId !== snapshot.controllerId) {
    const controller = graph.entities.get(currentControllerId || '');
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
  const currentLeader = graph.relationships.find(r =>
    r.kind === 'leader_of' && r.dst === faction.id
  );
  const currentLeaderId = currentLeader?.src;
  if (currentLeaderId !== snapshot.leaderId) {
    const leader = graph.entities.get(currentLeaderId || '');
    changes.push(`leadership: ${leader?.name || 'none'} took power`);
  }

  // Territory changes (track as src of stronghold_of or controls)
  const currentTerritories = graph.relationships.filter(r =>
    (r.kind === 'stronghold_of' || r.kind === 'controls') && r.src === faction.id
  );
  const territoryDelta = currentTerritories.length - (snapshot.territoryCount || 0);
  if (territoryDelta > 0) {
    changes.push(`territory: gained ${territoryDelta} locations`);
  } else if (territoryDelta < 0) {
    changes.push(`territory: lost ${Math.abs(territoryDelta)} locations`);
  }

  // Alliance changes (track as src of allied_with)
  const currentAllies = new Set(
    graph.relationships
      .filter(r => r.kind === 'allied_with' && r.src === faction.id)
      .map(r => r.dst)
  );
  const previousAllies = snapshot.allyIds || new Set();
  const newAllies = Array.from(currentAllies).filter(id => !previousAllies.has(id));
  newAllies.forEach(allyId => {
    const ally = graph.entities.get(allyId);
    if (ally) changes.push(`alliance: allied with ${ally.name}`);
  });

  // War changes (track as src of at_war_with)
  const currentEnemies = new Set(
    graph.relationships
      .filter(r => r.kind === 'at_war_with' && r.src === faction.id)
      .map(r => r.dst)
  );
  const previousEnemies = snapshot.enemyIds || new Set();
  const newWars = Array.from(currentEnemies).filter(id => !previousEnemies.has(id));
  newWars.forEach(enemyId => {
    const enemy = graph.entities.get(enemyId);
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
  const currentEnforcers = new Set(
    graph.relationships
      .filter(r => (r.kind === 'weaponized_by' || r.kind === 'kept_secret_by') && r.dst === rule.id)
      .map(r => r.src)
  );
  const previousEnforcers = snapshot.enforcerIds || new Set();
  const newEnforcers = Array.from(currentEnforcers).filter(id => !previousEnforcers.has(id));
  newEnforcers.forEach(enforcerId => {
    const faction = graph.entities.get(enforcerId);
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
  const currentPractitioners = graph.relationships.filter(r =>
    r.kind === 'practitioner_of' && r.dst === ability.id
  );
  const practitionerDelta = currentPractitioners.length - (snapshot.practitionerCount || 0);
  if (Math.abs(practitionerDelta) >= 3) {
    changes.push(`practitioners: ${practitionerDelta > 0 ? '+' : ''}${practitionerDelta}`);
  }

  // Spread to new locations (track as src of manifests_at)
  const currentLocations = new Set(
    graph.relationships
      .filter(r => r.kind === 'manifests_at' && r.src === ability.id)
      .map(r => r.dst)
  );
  const previousLocations = snapshot.locationIds || new Set();
  const newLocations = Array.from(currentLocations).filter(id => !previousLocations.has(id));
  newLocations.forEach(locId => {
    const location = graph.entities.get(locId);
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
    const faction = graph.entities.get(factionId);
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
  private pendingEnrichments: Promise<void>[] = [];
  private pendingNameEnrichments: Promise<void>[] = [];
  private entityEnrichmentsUsed = 0;
  private relationshipEnrichmentsUsed = 0;
  private eraNarrativesUsed = 0;

  // Engine-level safeguards
  private systemMetrics: Map<string, { relationshipsCreated: number; lastThrottleCheck: number }> = new Map();
  private lastRelationshipCount: number = 0;
  private warningLogPath: string;

  // Track entity state for change detection
  private entitySnapshots = new Map<string, EntitySnapshot>();

  // Enrichment analytics (tracks even when enrichment disabled)
  private enrichmentAnalytics = {
    locationEnrichments: 0,
    factionEnrichments: 0,
    ruleEnrichments: 0,
    abilityEnrichments: 0,
    npcEnrichments: 0
  };
  
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
    
    // Initialize graph from initial state
    this.graph = {
      entities: new Map(),
      relationships: [],
      tick: 0,
      currentEra: config.eras[0],
      pressures: new Map(config.pressures.map(p => [p.id, p.value])),
      history: [],
      config: config,
      relationshipCooldowns: new Map(),
      loreRecords: [],
      loreIndex: config.loreIndex,

      // Discovery tracking (emergent system)
      discoveryState: {
        currentThreshold: 0.3,  // Base threshold
        lastDiscoveryTick: -999,  // Start far in past so first discovery can happen
        discoveriesThisEpoch: 0
      },

      // Relationship growth monitoring
      growthMetrics: {
        relationshipsPerTick: [],
        averageGrowthRate: 0
      }
    };
    
    // Load initial entities
    initialState.forEach(entity => {
      const id = entity.id || generateId(entity.kind);
      this.graph.entities.set(id, {
        ...entity,
        id,
        createdAt: 0,
        updatedAt: 0
      });
    });
    
    // Extract relationships from entity links
    initialState.forEach(entity => {
      entity.links?.forEach(link => {
        // Find actual IDs from names
        const srcEntity = this.findEntityByName(link.src) || entity;
        const dstEntity = this.findEntityByName(link.dst);

        if (srcEntity && dstEntity) {
          this.graph.relationships.push({
            kind: link.kind,
            src: srcEntity.id,
            dst: dstEntity.id,
            strength: link.strength
          });
        }
      });
    });

    // Record initial state as first history event
    const initialEntityIds = Array.from(this.graph.entities.keys());
    const initialRelationships = [...this.graph.relationships];
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
    for (const entity of this.graph.entities.values()) {
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
    console.log(`Initial state: ${this.graph.entities.size} entities`);

    // Enrich initial entities (descriptions only, preserve canonical names)
    this.enrichInitialEntities();

    while (this.shouldContinue()) {
      this.runEpoch();
      this.currentEpoch++;
    }

    console.log(`\nGeneration complete!`);
    console.log(`Final state: ${this.graph.entities.size} entities, ${this.graph.relationships.length} relationships`);

    // Report enrichment analytics
    const totalTriggers = Object.values(this.enrichmentAnalytics).reduce((a, b) => a + b, 0);
    console.log(`\n=== Atlas Enrichment Analytics ===`);
    console.log(`Total enrichment triggers: ${totalTriggers}`);
    console.log(`  Locations: ${this.enrichmentAnalytics.locationEnrichments}`);
    console.log(`  Factions:  ${this.enrichmentAnalytics.factionEnrichments}`);
    console.log(`  Rules:     ${this.enrichmentAnalytics.ruleEnrichments}`);
    console.log(`  Abilities: ${this.enrichmentAnalytics.abilityEnrichments}`);
    console.log(`  NPCs:      ${this.enrichmentAnalytics.npcEnrichments}`);
    if (!this.enrichmentService?.isEnabled()) {
      console.log(`Note: Enrichment disabled - these are detected triggers only`);
    }

    // Log warning file location
    try {
      const stats = fs.statSync(this.warningLogPath);
      if (stats.size > 100) {  // If there are warnings beyond header
        console.log(`\n⚠️  Warnings logged to: ${path.relative(process.cwd(), this.warningLogPath)}`);
      }
    } catch (error) {
      // File doesn't exist or is empty - no warnings
    }

    return this.graph;
  }
  
  private shouldContinue(): boolean {
    // Stop conditions
    if (this.graph.tick >= this.config.maxTicks) return false;
    if (this.currentEpoch >= this.config.eras.length * 2) return false;
    
    // Check if we've reached target population
    const targetTotal = this.config.targetEntitiesPerKind * 5; // 5 kinds
    if (this.graph.entities.size >= targetTotal) return false;
    
    return true;
  }
  
  private runEpoch(): void {
    const previousEra = this.graph.currentEra;
    const era = selectEra(this.currentEpoch, this.config.eras);
    this.graph.currentEra = era;

    console.log(`\n=== Epoch ${this.currentEpoch}: ${era.name} ===`);

    // Reset discovery counter for new epoch
    this.graph.discoveryState.discoveriesThisEpoch = 0;

    // Track initial counts for statistics
    const initialEntityCount = this.graph.entities.size;
    const initialRelationshipCount = this.graph.relationships.length;

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

    // Update pressures
    this.updatePressures(era);

    // Prune and consolidate
    this.pruneAndConsolidate();

    // Record epoch statistics
    const entitiesCreated = this.graph.entities.size - initialEntityCount;
    const relationshipsCreated = this.graph.relationships.length - initialRelationshipCount;
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
  }

  private runGrowthPhase(era: Era, growthTargets?: number): void {
    // Use provided growth targets or calculate new ones
    const targets = growthTargets ?? this.calculateGrowthTarget();
    let entitiesCreated = 0;
    const createdEntities: HardState[] = [];

    // Template selection: Use statistical selector if available, otherwise use heuristic method
    let weightedTemplates: GrowthTemplate[];

    if (this.templateSelector) {
      // Statistical template selection based on distribution targets
      // Filter templates that can apply
      const applicableTemplates = this.config.templates.filter(t => t.canApply(this.graph));

      // Build era weights map
      const eraWeights: Record<string, number> = {};
      applicableTemplates.forEach(t => {
        eraWeights[t.id] = getTemplateWeight(era, t.id);
      });

      // Use TemplateSelector for guided selection
      weightedTemplates = this.templateSelector.selectTemplates(
        this.graph,
        applicableTemplates,
        eraWeights,
        targets * 3  // Select more than needed to account for failures
      );
    } else {
      // Fallback to heuristic method
      const deficits = this.calculateEntityDeficits();
      weightedTemplates = this.selectWeightedTemplates(era, deficits, targets);
    }

    for (const template of weightedTemplates) {
      if (entitiesCreated >= targets) break;

      // Check if template can apply
      if (!template.canApply(this.graph)) continue;

      // Find targets
      const templateTargets = template.findTargets(this.graph);
      if (templateTargets.length === 0) continue;

      // Apply template to random target
      const target = pickRandom(templateTargets);
      try {
        const result = template.expand(this.graph, target);

        // Record template application
        this.statisticsCollector.recordTemplateApplication(template.id);

        // Add entities to graph
        const newIds: string[] = [];
        const clusterEntities: HardState[] = [];
        result.entities.forEach((entity, i) => {
          const id = addEntity(this.graph, entity);
          newIds.push(id);
          const ref = this.graph.entities.get(id);
          if (ref) {
            createdEntities.push(ref);
            clusterEntities.push(ref);
          }
        });

        // Add relationships (resolve placeholder IDs)
        result.relationships.forEach(rel => {
          const srcId = rel.src.startsWith('will-be-assigned-')
            ? newIds[parseInt(rel.src.split('-')[3])]
            : rel.src;
          const dstId = rel.dst.startsWith('will-be-assigned-')
            ? newIds[parseInt(rel.dst.split('-')[3])]
            : rel.dst;

          if (srcId && dstId) {
            addRelationship(this.graph, rel.kind, srcId, dstId);
          }
        });

        // Record history
        this.graph.history.push({
          tick: this.graph.tick,
          era: era.id,
          type: 'growth',
          description: result.description,
          entitiesCreated: newIds,
          relationshipsCreated: result.relationships as Relationship[],
          entitiesModified: []
        });

        entitiesCreated += result.entities.length;

        // Queue enrichment for this template's cluster immediately
        if (clusterEntities.length > 0) {
          this.queueEntityEnrichment(clusterEntities);
          this.queueDiscoveryEnrichment(clusterEntities);
        }

      } catch (error) {
        console.error(`Template ${template.id} failed:`, error);
      }
    }

    console.log(`  Growth: +${entitiesCreated} entities (target: ${targets})`);
  }

  /**
   * Calculate dynamic growth target based on remaining entity deficits
   */
  private calculateGrowthTarget(): number {
    // Get entity kinds from domain schema (not hardcoded)
    const entityKinds = this.config.domain.entityKinds.map(ek => ek.kind);
    const currentCounts = new Map<string, number>();

    // Count current entities by kind
    for (const entity of this.graph.entities.values()) {
      currentCounts.set(entity.kind, (currentCounts.get(entity.kind) || 0) + 1);
    }

    // Calculate total remaining entities needed
    let totalRemaining = 0;
    for (const kind of entityKinds) {
      const current = currentCounts.get(kind) || 0;
      const target = this.config.targetEntitiesPerKind;
      const remaining = Math.max(0, target - current);
      totalRemaining += remaining;
    }

    // If we're close to target, reduce growth rate
    if (totalRemaining === 0) return 3; // Minimal growth when at target

    // Calculate epochs remaining (rough estimate)
    const totalTarget = this.config.targetEntitiesPerKind * entityKinds.length;
    const currentTotal = this.graph.entities.size;
    const progressRatio = currentTotal / totalTarget;
    const epochsRemaining = Math.max(1, this.config.eras.length * 2 - this.currentEpoch);

    // Dynamic target: spread remaining entities over remaining epochs
    const baseTarget = Math.ceil(totalRemaining / epochsRemaining);

    // Add some variance for organic feel (±30%)
    const variance = 0.3;
    const target = Math.floor(baseTarget * (1 - variance + Math.random() * variance * 2));

    // Cap at reasonable bounds (3-25 entities per epoch)
    return Math.max(3, Math.min(25, target));
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
    for (const entity of this.graph.entities.values()) {
      currentCounts.set(entity.kind, (currentCounts.get(entity.kind) || 0) + 1);
    }

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

          const before = this.graph.relationships.length;
          addRelationship(this.graph, rel.kind, rel.src, rel.dst);
          const after = this.graph.relationships.length;

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
    const currentCount = this.graph.relationships.length;
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
    for (const entity of this.graph.entities.values()) {
      if (entity.prominence === 'forgotten') continue;
      
      const age = this.graph.tick - entity.createdAt;
      const connections = this.graph.relationships.filter(r => 
        r.src === entity.id || r.dst === entity.id
      ).length;
      
      if (age > 50 && connections < 2) {
        entity.prominence = 'forgotten';
        entity.updatedAt = this.graph.tick;
      }
    }
    
    // Mark dead NPCs
    const npcs = findEntities(this.graph, { kind: 'npc', status: 'alive' });
    npcs.forEach(npc => {
      const age = this.graph.tick - npc.createdAt;
      if (age > 80 && Math.random() > 0.7) {
        npc.status = 'dead';
        npc.updatedAt = this.graph.tick;
      }
    });
  }
  
  private reportEpochStats(): void {
    const byKind = new Map<string, number>();
    const bySubtype = new Map<string, number>();

    for (const entity of this.graph.entities.values()) {
      byKind.set(entity.kind, (byKind.get(entity.kind) || 0) + 1);
      const key = `${entity.kind}:${entity.subtype}`;
      bySubtype.set(key, (bySubtype.get(key) || 0) + 1);
    }

    console.log(`  Entities by kind:`, Object.fromEntries(byKind));
    console.log(`  Relationships: ${this.graph.relationships.length}`);
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
    const avgDegree = (this.graph.relationships.length * 2) / state.totalEntities; // Each relationship connects 2 entities
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
    this.graph.entities.forEach(entity => {
      const hasNameTag = (entity.tags || []).some(t => t.startsWith('name:'));
      if (!hasNameTag) return;
      upsertNameTag(entity, entity.name);
    });
  }
  
  private enrichInitialEntities(): void {
    if (!this.enrichmentService?.isEnabled()) return;

    const initialEntities = Array.from(this.graph.entities.values()).filter(e => e.createdAt === 0);
    if (initialEntities.length === 0) return;

    console.log(`Enriching ${initialEntities.length} initial entities (descriptions only)...`);

    const context = this.buildEnrichmentContext();
    const enrichmentPromise = (async () => {
      const records = await this.enrichmentService!.enrichEntities(
        initialEntities,
        context,
        { preserveNames: true } // Keep canonical names
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
    
    const limit = this.config.enrichmentConfig?.maxEntityEnrichments;
    if (this.config.enrichmentConfig?.mode === 'partial') {
      const remaining = (limit ?? 0) - this.entityEnrichmentsUsed;
      if (remaining <= 0) return;
      entities = entities.slice(0, remaining);
    }
    // Consume budget up front so failures don't re-attempt
    if (this.config.enrichmentConfig?.mode === 'partial') {
      this.entityEnrichmentsUsed += entities.length;
    }
    
    const context = this.buildEnrichmentContext();
    const enrichmentPromise = (async () => {
      const records = await this.enrichmentService!.enrichEntities(entities, context);
      this.graph.loreRecords.push(...records);
      
      // Abilities get an extra pass to keep tech/magic in bounds
      const abilityRecords = await Promise.all(
        entities
          .filter(e => e.kind === 'abilities')
          .map(e => this.enrichmentService!.enrichAbility(e, context))
      );
      
      abilityRecords
        .filter((r): r is LoreRecord => Boolean(r))
        .forEach(r => this.graph.loreRecords.push(r));
    })().catch(error => console.warn('Enrichment failed:', error));
    
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
      const a = this.graph.entities.get(rel.src);
      const b = this.graph.entities.get(rel.dst);
      if (!a || !b) return false;
      
      return getProminenceValue(a.prominence) >= 3 && getProminenceValue(b.prominence) >= 3;
    }).slice(0, 3); // keep batches small for quality
    
    if (notable.length === 0) return;
    
    const actors: Record<string, HardState> = {};
    notable.forEach(rel => {
      const a = this.graph.entities.get(rel.src);
      const b = this.graph.entities.get(rel.dst);
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
  
  private queueChangeEnrichments(): void {
    const changedEntities: Array<{ entity: HardState; changes: string[] }> = [];

    // Check all entities for significant changes using kind-specific detection
    this.graph.entities.forEach(entity => {
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
        snapshot.residentCount = this.graph.relationships.filter(r =>
          r.kind === 'resident_of' && r.dst === entity.id
        ).length;

        // Controller (faction with stronghold_of or controls pointing to this location)
        const controller = this.graph.relationships.find(r =>
          (r.kind === 'stronghold_of' || r.kind === 'controls') && r.dst === entity.id
        );
        snapshot.controllerId = controller?.src;
        break;

      case 'faction':
        // Leader (who has leader_of pointing to this faction)
        const leader = this.graph.relationships.find(r =>
          r.kind === 'leader_of' && r.dst === entity.id
        );
        snapshot.leaderId = leader?.src;

        // Territory count (stronghold_of or controls from this faction)
        snapshot.territoryCount = this.graph.relationships.filter(r =>
          (r.kind === 'stronghold_of' || r.kind === 'controls') && r.src === entity.id
        ).length;

        // Allies (allied_with from this faction)
        snapshot.allyIds = new Set(
          this.graph.relationships
            .filter(r => r.kind === 'allied_with' && r.src === entity.id)
            .map(r => r.dst)
        );

        // Enemies (at_war_with from this faction)
        snapshot.enemyIds = new Set(
          this.graph.relationships
            .filter(r => r.kind === 'at_war_with' && r.src === entity.id)
            .map(r => r.dst)
        );
        break;

      case 'rules':
        // Enforcers (factions with weaponized_by or kept_secret_by pointing to this rule)
        snapshot.enforcerIds = new Set(
          this.graph.relationships
            .filter(r => (r.kind === 'weaponized_by' || r.kind === 'kept_secret_by') && r.dst === entity.id)
            .map(r => r.src)
        );
        break;

      case 'abilities':
        // Practitioner count (practitioner_of relationships pointing to this ability)
        snapshot.practitionerCount = this.graph.relationships.filter(r =>
          r.kind === 'practitioner_of' && r.dst === entity.id
        ).length;

        // Locations where it manifests (manifests_at from this ability)
        snapshot.locationIds = new Set(
          this.graph.relationships
            .filter(r => r.kind === 'manifests_at' && r.src === entity.id)
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

    const actors = Array.from(this.graph.entities.values())
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
      const discoveryRel = this.graph.relationships.find(r =>
        (r.kind === 'discovered_by' && r.src === location.id) ||
        (r.kind === 'explorer_of' && r.dst === location.id)
      );

      if (!discoveryRel) return;

      const explorerId = discoveryRel.kind === 'discovered_by' ? discoveryRel.dst : discoveryRel.src;
      const explorer = this.graph.entities.get(explorerId);
      if (!explorer || explorer.kind !== 'npc') return;

      // Capture tick at time of discovery
      const discoveryTick = this.graph.tick;

      // Determine discovery type based on tags and world state
      let discoveryType: 'pressure' | 'exploration' | 'chain' = 'exploration';
      let triggerContext: { pressure?: string; chainSource?: HardState } = {};

      // Check if pressure-driven (resource, strategic, mystical locations)
      if (location.subtype === 'geographic_feature' && location.tags.includes('resource')) {
        discoveryType = 'pressure';
        triggerContext.pressure = 'resource_scarcity';
      } else if (location.tags.includes('strategic')) {
        discoveryType = 'pressure';
        triggerContext.pressure = 'conflict';
      } else if (location.subtype === 'anomaly' || location.tags.includes('mystical')) {
        discoveryType = 'pressure';
        triggerContext.pressure = 'magical_instability';
      }

      // Check for chain discoveries (adjacent to other discovered locations)
      const adjacentLocations = this.graph.relationships
        .filter(r => r.kind === 'adjacent_to' && r.src === location.id)
        .map(r => this.graph.entities.get(r.dst))
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
    return {
      graphSnapshot: {
        tick: this.graph.tick,
        era: this.graph.currentEra.name,
        pressures: Object.fromEntries(this.graph.pressures),
        entities: this.graph.entities
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

    const entities = Array.from(this.graph.entities.values());
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
    const entities = Array.from(this.graph.entities.values());
    const totalEnrichmentTriggers = Object.values(this.enrichmentAnalytics).reduce((a, b) => a + b, 0);

    const exportData: any = {
      metadata: {
        tick: this.graph.tick,
        epoch: this.currentEpoch,
        era: this.graph.currentEra.name,
        entityCount: entities.length,
        relationshipCount: this.graph.relationships.length,
        historyEventCount: this.graph.history.length,
        enrichmentTriggers: {
          total: totalEnrichmentTriggers,
          byKind: this.enrichmentAnalytics,
          comment: 'Counts detected enrichment triggers (tracks even when enrichment disabled)'
        }
      },
      hardState: entities,
      relationships: this.graph.relationships,
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
