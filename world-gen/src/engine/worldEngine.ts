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
import { selectEra, getTemplateWeight, getSystemModifier } from '../config/eras';
import { EnrichmentService } from '../services/enrichmentService';

export class WorldEngine {
  private config: EngineConfig;
  private graph: Graph;
  private currentEpoch: number;
  private enrichmentService?: EnrichmentService;
  private pendingEnrichments: Promise<void>[] = [];
  private pendingNameEnrichments: Promise<void>[] = [];
  private entityEnrichmentsUsed = 0;
  private relationshipEnrichmentsUsed = 0;
  private eraNarrativesUsed = 0;

  // Engine-level safeguards
  private systemMetrics: Map<string, { relationshipsCreated: number; lastThrottleCheck: number }> = new Map();
  private lastRelationshipCount: number = 0;
  
  constructor(config: EngineConfig, initialState: HardState[], enrichmentService?: EnrichmentService) {
    this.config = config;
    this.enrichmentService = enrichmentService;
    this.currentEpoch = 0;
    
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
            dst: dstEntity.id
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
  
  // Main execution loop
  public run(): Graph {
    console.log('Starting world generation...');
    console.log(`Initial state: ${this.graph.entities.size} entities`);
    
    while (this.shouldContinue()) {
      this.runEpoch();
      this.currentEpoch++;
    }
    
    console.log(`\nGeneration complete!`);
    console.log(`Final state: ${this.graph.entities.size} entities, ${this.graph.relationships.length} relationships`);
    
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

    // Growth phase
    this.runGrowthPhase(era);
    
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
    
    this.reportEpochStats();
    
    this.queueEraNarrative(previousEra, era);
  }
  
  private runGrowthPhase(era: Era): void {
    // Calculate dynamic growth target based on remaining entity deficits
    const growthTargets = this.calculateGrowthTarget();
    let entitiesCreated = 0;
    const createdEntities: HardState[] = [];

    // Calculate entity kind deficits for weighted template selection
    const deficits = this.calculateEntityDeficits();

    // Weighted template selection based on entity kind deficits
    const weightedTemplates = this.selectWeightedTemplates(era, deficits, growthTargets);

    for (const template of weightedTemplates) {
      if (entitiesCreated >= growthTargets) break;

      // Check if template can apply
      if (!template.canApply(this.graph)) continue;

      // Find targets
      const targets = template.findTargets(this.graph);
      if (targets.length === 0) continue;

      // Apply template to random target
      const target = pickRandom(targets);
      try {
        const result = template.expand(this.graph, target);

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

    console.log(`  Growth: +${entitiesCreated} entities (target: ${growthTargets})`);
  }

  /**
   * Calculate dynamic growth target based on remaining entity deficits
   */
  private calculateGrowthTarget(): number {
    const entityKinds = ['npc', 'faction', 'rules', 'abilities', 'location'];
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
    const entityKinds = ['npc', 'faction', 'rules', 'abilities', 'location'];
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
      const templateId = template.id.toLowerCase();
      let deficitWeight = 1.0;

      // Map template IDs to entity kinds (heuristic based on naming)
      if (templateId.includes('npc') || templateId.includes('family') || templateId.includes('hero') ||
          templateId.includes('outlaw') || templateId.includes('succession') || templateId.includes('kinship') ||
          templateId.includes('vanishing') || templateId.includes('merchant')) {
        deficitWeight = (deficits.get('npc') || 0) + 1;
      } else if (templateId.includes('faction') || templateId.includes('guild') || templateId.includes('cult') ||
                 templateId.includes('splinter')) {
        deficitWeight = (deficits.get('faction') || 0) + 1;
      } else if (templateId.includes('rule') || templateId.includes('tradition') || templateId.includes('legislation') ||
                 templateId.includes('festival') || templateId.includes('law')) {
        deficitWeight = (deficits.get('rules') || 0) + 1;
      } else if (templateId.includes('abilit') || templateId.includes('tech') || templateId.includes('magic') ||
                 templateId.includes('innovation')) {
        deficitWeight = (deficits.get('abilities') || 0) + 1;
      } else if (templateId.includes('location') || templateId.includes('colony') || templateId.includes('geographic') ||
                 templateId.includes('krill') || templateId.includes('structure') || templateId.includes('discovery')) {
        deficitWeight = (deficits.get('location') || 0) + 1;
      }

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

    for (const system of this.config.systems) {
      const modifier = getSystemModifier(era, system.id);
      if (modifier === 0) continue; // System disabled

      try {
        const result = system.apply(this.graph, modifier);

        // Track system metrics
        const metric = this.systemMetrics.get(system.id) || { relationshipsCreated: 0, lastThrottleCheck: 0 };

        // Apply relationships with budget check
        for (const rel of result.relationshipsAdded) {
          // Check budget
          if (relationshipsAddedThisTick >= budget) {
            console.warn(`⚠️  RELATIONSHIP BUDGET REACHED: ${budget}/tick at tick ${this.graph.tick}`);
            console.warn(`   Remaining systems may not add relationships this tick`);
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
          console.warn(`⚠️  AGGRESSIVE SYSTEM: ${system.id} has created ${metric.relationshipsCreated} relationships`);
          console.warn(`   Consider adding throttling or reducing probabilities`);
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
    this.config.pressures.forEach(pressure => {
      const current = this.graph.pressures.get(pressure.id) || pressure.value;
      const growth = pressure.growth(this.graph);
      const decay = current > 50 ? pressure.decay : -pressure.decay;

      // Apply era modifier if present
      const eraModifier = era.pressureModifiers?.[pressure.id] || 1.0;

      const newValue = current + (growth + decay) * eraModifier;
      this.graph.pressures.set(pressure.id, Math.max(0, Math.min(100, newValue)));
    });
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
      console.warn(`⚠️  HIGH RELATIONSHIP GROWTH RATE: ${avgGrowth.toFixed(1)}/tick`);
      console.warn(`   Current: ${currentCount} relationships, growing at ${avgGrowth.toFixed(1)}/tick`);
      console.warn(`   Consider reducing system probabilities or adding throttling`);
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
        pressures: Object.fromEntries(this.graph.pressures)
      },
      relatedHistory: this.graph.history.slice(-5).map(h => h.description)
    };
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
    return {
      metadata: {
        tick: this.graph.tick,
        epoch: this.currentEpoch,
        era: this.graph.currentEra.name,
        entityCount: entities.length,
        relationshipCount: this.graph.relationships.length,
        historyEventCount: this.graph.history.length
      },
      hardState: entities,
      relationships: this.graph.relationships,
      pressures: Object.fromEntries(this.graph.pressures),
      history: this.graph.history,  // Export ALL events, not just last 50
      loreRecords: this.graph.loreRecords
    };
  }
}
