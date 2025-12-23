import type { HardState, Relationship, EnrichmentConfig, LLMConfig } from '../types';
import { EnrichmentContext, LoreRecord } from '../llm/types';
import { DomainLoreProvider } from '../llm/types';
import { LLMClient } from './llmClient';
import { LoreValidator } from './loreValidator';
import { NameLogger } from '../naming/nameLogger';
import { upsertNameTag, parseJsonSafe, chunk, generateLoreId, hasTag } from '../utils';
import { FRAMEWORK_ENTITY_KINDS, FRAMEWORK_STATUS, FRAMEWORK_RELATIONSHIP_KINDS, FRAMEWORK_TAGS } from '@canonry/world-schema';

export class EnrichmentService {
  private llm: LLMClient;
  private loreProvider: DomainLoreProvider;
  private validator: LoreValidator;
  private nameLogger: NameLogger;
  private config: EnrichmentConfig;
  private loreLog: LoreRecord[] = [];

  constructor(llmConfig: LLMConfig, loreProvider: DomainLoreProvider, config?: Partial<EnrichmentConfig>) {
    this.llm = new LLMClient(llmConfig);
    this.loreProvider = loreProvider;
    this.validator = new LoreValidator(loreProvider);
    this.nameLogger = new NameLogger();
    this.config = {
      batchSize: config?.batchSize || 3,
      mode: config?.mode || 'full',
      maxEntityEnrichments: config?.maxEntityEnrichments,
      maxRelationshipEnrichments: config?.maxRelationshipEnrichments,
      maxEraNarratives: config?.maxEraNarratives
    };
  }

  public getNameLogger(): NameLogger {
    return this.nameLogger;
  }

  public isEnabled(): boolean {
    return this.llm.isEnabled();
  }

  public getLoreLog(): LoreRecord[] {
    return this.loreLog;
  }

  public async enrichEntities(
    entities: HardState[],
    context: EnrichmentContext
  ): Promise<LoreRecord[]> {
    if (!this.isEnabled() || entities.length === 0) {
      return [];
    }

    const records: LoreRecord[] = [];
    const loreHighlights = this.buildLoreHighlights();

    // Names are now generated synchronously by name-forge via addEntity()
    // This method only handles description enrichment
    const descriptionBatchSize = 6;
    const batches = entities.length > descriptionBatchSize
      ? chunk(entities, descriptionBatchSize)
      : [entities];

    for (const batch of batches) {
      const promptEntities = batch.map(e => {
        // Build relationship context using the SNAPSHOT to avoid timing issues
        // (entity relationships might change during simulation after enrichment is queued)
        const relationships: Record<string, string[]> = {};
        const historicalRelationships: Record<string, string[]> = {};

        const addRelationship = (
          rel: Relationship,
          targetMap: Record<string, string[]>
        ) => {
          const targetId = rel.src === e.id ? rel.dst : rel.src;
          const target = context.graphSnapshot.entities.get(targetId);
          if (!target) return;
          if (!targetMap[rel.kind]) targetMap[rel.kind] = [];
          targetMap[rel.kind].push(target.name);
        };

        context.graphSnapshot.relationships
          .filter(rel => rel.src === e.id || rel.dst === e.id)
          .forEach(rel => {
            const targetMap = rel.status === 'historical' ? historicalRelationships : relationships;
            addRelationship(rel, targetMap);
          });

        // Add catalyst information (Phase 3)
        const catalystInfo: any = {};
        if (e.catalyst) {
          catalystInfo.canAct = e.catalyst.canAct;
          catalystInfo.eventsTriggered = e.catalyst.catalyzedEvents?.length || 0;
        }

        // Detect meta-entities
        const isMetaEntity = hasTag(e.tags, FRAMEWORK_TAGS.META_ENTITY);
        const clusterInfo: any = {};
        if (isMetaEntity) {
          // Find part_of relationships (components of this meta-entity)
          const components = context.graphSnapshot.relationships
            .filter(rel => rel.kind === 'part_of' && rel.dst === e.id && rel.status !== 'historical')
            .map(rel => context.graphSnapshot.entities.get(rel.src))
            .filter((ent): ent is HardState => !!ent);
          clusterInfo.isMetaEntity = true;
          clusterInfo.componentCount = components.length;
          clusterInfo.componentNames = components.map(c => c.name).slice(0, 5);  // First 5
        }

        return {
          id: e.id,
          kind: e.kind,
          subtype: e.subtype,
          prominence: e.prominence,
          name: e.name, // Use the final name we just generated
          relationships: relationships,
          historicalRelationships: Object.keys(historicalRelationships).length > 0 ? historicalRelationships : undefined,
          catalyst: catalystInfo,
          metaEntity: isMetaEntity ? clusterInfo : undefined,
          placeholders: {
            description: e.description
          }
        };
      });

      // Get action domain descriptions for catalyst awareness
      const actionDomainDescs = this.loreProvider.getActionDomainDescriptions();
      const actionDomainContext = Object.entries(actionDomainDescs)
        .map(([domain, desc]) => `${domain}: ${desc}`)
        .join('; ');

      const prompt = [
        `You are enriching descriptions for ${this.loreProvider.getWorldName()} entities.`,
        `Names are FINAL - do not change them. Only write descriptions.`,
        `Lore highlights:`,
        loreHighlights,
        `Context tick ${context.graphSnapshot.tick} in era ${context.graphSnapshot.era}.`,
        `Entities (JSON array - return with id, name unchanged, and description):`,
        JSON.stringify(promptEntities, null, 2),
        `CRITICAL: Use each entity's "relationships" field to inform descriptions.`,
        `If an NPC has "resident_of": ["Colony X"], mention Colony X in their description.`,
        `If they have "member_of": ["Faction Y"], reference the Faction Y faction.`,
        `Descriptions must be consistent with actual relationships shown above.`,
        ``,
        `HISTORICAL CONTEXT: Some entities have "historicalRelationships" - past connections that ended.`,
        `Use historical relationships to add depth (e.g., "once practiced by...", "formerly taught to...").`,
        `Historical relationships show an entity's legacy and evolution over time.`,
        ``,
        `META-ENTITIES: If entity.metaEntity exists, this is a UNIFIED TRADITION formed from clustering.`,
        `Meta-entities represent schools of thought, unified codes, or synthesized practices.`,
        `If metaEntity.componentCount exists, mention it emerged from X individual practices/rules.`,
        `If metaEntity.componentNames exists, reference some by name (e.g., "unifying Fireball, Ice Lance...").`,
        `Meta-entities should feel like living traditions with shared practitioners, not abstract concepts.`,
        `Their descriptions should emphasize the synthesis and shared practice across multiple practitioners.`,
        ``,
        `CATALYST AWARENESS: Some entities have agency and trigger events.`,
        `If entity.catalyst.eventsTriggered > 5, describe them as influential/impactful.`,
        `Action domains: ${actionDomainContext}`,
        ``,
        `Do not invent new mechanics; stay within canon: ${this.loreProvider.getCanonFacts().join('; ')}.`,
        `IMPORTANT: Keep each description under 50 words. Be concise and evocative.`,
        `Return JSON array: [{"id": "...", "name": "...", "description": "..."}]`
      ].join('\n');

      // Scale token limit based on batch size (180 tokens per entity to account for relationship context)
      const tokensPerEntity = 180;
      const dynamicMaxTokens = Math.min(1200, tokensPerEntity * batch.length + 250);

      const result = await this.llm.complete({
        systemPrompt: 'You are a precise lore keeper. Maximum 50 words per description. Respond only with JSON when asked.',
        prompt,
        maxTokens: dynamicMaxTokens,
        temperature: 0.2
      });

      let parsed: Array<{ id: string; name?: string; description?: string }> = [];
      const parsedResult = parseJsonSafe<Array<{ id: string; name?: string; description?: string }>>(result.text);
      if (parsedResult) {
        parsed = parsedResult;
      } else if (result.text) {
        console.warn('Failed to parse enrichment response, using placeholders.');
      }

      parsed.forEach(entry => {
        const entity = batch.find(e => e.id === entry.id);
        if (!entity) return;

        // Names were already set in Phase 1, only update description
        if (entry.description) entity.description = entry.description;

        const validation = this.validator.validateEntity(entity, entry.description);
        const record: LoreRecord = {
          id: generateLoreId('desc'),
          type: 'description',
          targetId: entity.id,
          text: `${entity.name}: ${entry.description || ''}`.trim(),
          cached: result.cached,
          warnings: validation.warnings
        };

        this.loreLog.push(record);
        records.push(record);
      });
    }

    return records;
  }

  public async generateEraNarrative(params: {
    fromEra: string;
    toEra: string;
    pressures: Record<string, number>;
    actors: HardState[];
    tick: number;
  }): Promise<LoreRecord | null> {
    if (!this.isEnabled()) return null;

    const prompt = [
      `Create a pivotal event that shifts ${this.loreProvider.getWorldName()} from ${params.fromEra} to ${params.toEra}.`,
      `Pressures: ${JSON.stringify(params.pressures)}`,
      `Notable actors: ${params.actors.map(a => a.name).join(', ') || 'none'}.`,
      `Reference conflicts (${this.loreProvider.getConflictPatterns().join('; ')}) and stay within canon (${this.loreProvider.getCanonFacts().join('; ')}).`,
      `IMPORTANT: Keep description under 100 words. Be concise and direct.`,
      `Return JSON: { "eventName": string, "description": string }.`
    ].join('\n');

    const result = await this.llm.complete({
      systemPrompt: 'You write brief, punchy historical events. Maximum 100 words per description. Output JSON only.',
      prompt,
      maxTokens: 400,
      temperature: 0.2
    });

    const parsed = parseJsonSafe<any>(result.text);
    if (!parsed) {
      if (result.text) console.warn('Failed to parse era narrative response');
      return null;
    }

    const record: LoreRecord = {
      id: generateLoreId('era'),
      type: 'era_narrative',
      text: `${parsed.eventName}: ${parsed.description}`,
      metadata: { from: params.fromEra, to: params.toEra, tick: params.tick },
      cached: result.cached
    };
    this.loreLog.push(record);
    return record;
  }

  public async enrichRelationships(
    relationships: Relationship[],
    actors: Record<string, HardState>,
    context: EnrichmentContext
  ): Promise<LoreRecord[]> {
    if (!this.isEnabled() || relationships.length === 0) return [];

    const records: LoreRecord[] = [];
    for (const rel of relationships) {
      const actor1 = actors[rel.src];
      const actor2 = actors[rel.dst];
      if (!actor1 || !actor2) continue;

      // Get catalyst information
      const catalystId = rel.catalyzedBy;
      const catalyst = catalystId ? context.graphSnapshot.entities.get(catalystId) : null;
      const catalystDesc = catalyst
        ? `through the actions of ${catalyst.name}`
        : 'through circumstance';

      // Get domain-specific relationship prompt hint
      const domainPromptHint = this.loreProvider.getRelationshipEnrichmentPrompt(rel.kind);

      const prompt = [
        `Generate a brief backstory for relationship ${rel.kind}.`,
        `Actor 1: ${actor1.name} (${actor1.kind}/${actor1.subtype}) - ${actor1.description}`,
        `Actor 2: ${actor2.name} (${actor2.kind}/${actor2.subtype}) - ${actor2.description}`,
        `Catalyst: This relationship formed ${catalystDesc}.`,
        domainPromptHint || '',
        `Recent history: ${(context.relatedHistory || []).join('; ') || 'none'}.`,
        `Relationship norms: ${this.loreProvider.getRelationshipPatterns().join('; ')}`,
        `Keep it grounded in canon (${this.loreProvider.getCanonFacts().join('; ')}).`,
        `Return JSON: { "incident": string, "stakes": string, "publicPerception": string }.`
      ].join('\n');

      const result = await this.llm.complete({
        systemPrompt: 'You write concise, lore-aware relationship backstories. Output JSON only.',
        prompt,
        maxTokens: 440
      });

      const parsed = parseJsonSafe<any>(result.text);
      if (parsed) {
        const text = `${parsed.incident} | Stakes: ${parsed.stakes} | Perception: ${parsed.publicPerception}`;
        const record: LoreRecord = {
          id: generateLoreId('relationship'),
          type: 'relationship_backstory',
          targetId: rel.dst,
          relationship: rel,
          text,
          cached: result.cached
        };
        this.loreLog.push(record);
        records.push(record);
      } else if (result.text) {
        console.warn('Failed to parse relationship backstory response');
      }
    }

    return records;
  }

  public async enrichAbility(
    ability: HardState,
    context: EnrichmentContext
  ): Promise<LoreRecord | null> {
    if (!this.isEnabled()) return null;

    const techOrMagic = ability.subtype === 'magic'
      ? this.loreProvider.getMagicSystemNotes()
      : this.loreProvider.getTechnologyNotes();

    const prompt = [
      `Create a lore-consistent name and description for an ability (${ability.subtype}).`,
      `Current era: ${context.graphSnapshot.era} at tick ${context.graphSnapshot.tick}.`,
      `System notes: ${techOrMagic.join('; ')}`,
      `Stay within canon: ${this.loreProvider.getCanonFacts().join('; ')}.`,
      `Return JSON: { "name": string, "description": string, "flavor": string }.`
    ].join('\n');

    const result = await this.llm.complete({
      systemPrompt: `You design abilities consistent with ${this.loreProvider.getWorldName()} lore. Output JSON only.`,
      prompt,
      maxTokens: 260
    });

    const parsed = parseJsonSafe<any>(result.text);
    if (parsed) {
      ability.name = parsed.name || ability.name;
      ability.description = parsed.description || ability.description;
      const validation = this.validator.validateEntity(ability, parsed.description);
      const record: LoreRecord = {
        id: generateLoreId('ability'),
        type: 'tech_magic',
        targetId: ability.id,
        text: `${parsed.name}: ${parsed.description}`,
        cached: result.cached,
        warnings: validation.warnings,
        metadata: { flavor: parsed.flavor }
      };
      this.loreLog.push(record);
      return record;
    }
    
    if (result.text) {
      console.warn('Failed to parse ability enrichment response');
    }
    return null;
  }

  public async enrichDiscoveryEvent(params: {
    location: HardState;
    explorer: HardState;
    discoveryType: 'pressure' | 'exploration' | 'chain';
    triggerContext: {
      pressure?: string;
      chainSource?: HardState;
    };
    tick: number;
  }): Promise<LoreRecord | null> {
    if (!this.isEnabled()) return null;

    let contextClue = '';
    if (params.discoveryType === 'pressure' && params.triggerContext.pressure) {
      contextClue = `driven by ${params.triggerContext.pressure} pressure`;
    } else if (params.discoveryType === 'chain' && params.triggerContext.chainSource) {
      contextClue = `following clues from ${params.triggerContext.chainSource.name}`;
    } else {
      contextClue = 'through exploratory ventures';
    }

    const geoConstraints = this.loreProvider.getGeographyConstraints();

    const prompt = [
      `Generate a lore-consistent discovery narrative for a new location.`,
      `Explorer: ${params.explorer.name} (${params.explorer.subtype}) - ${params.explorer.description}`,
      `Discovered: ${params.location.name} (${params.location.subtype})`,
      `Discovery method: ${contextClue}`,
      `Geographic context: ${geoConstraints.scale}, ${geoConstraints.characteristics.join(', ')}`,
      `Keep it grounded in canon (${this.loreProvider.getCanonFacts().join('; ')}).`,
      `IMPORTANT: Keep each field under 75 words. Be direct and atmospheric.`,
      `Return JSON: { "narrative": string, "significance": string }.`
    ].join('\n');

    const result = await this.llm.complete({
      systemPrompt: 'You write brief, atmospheric discovery narratives. Maximum 75 words per field. Output JSON only.',
      prompt,
      maxTokens: 400,
      temperature: 0.2
    });

    const parsed = parseJsonSafe<any>(result.text);
    if (!parsed) {
      if (result.text) console.warn('Failed to parse discovery event response');
      return null;
    }

    const record: LoreRecord = {
      id: generateLoreId('discovery'),
      type: 'discovery_event',
      targetId: params.location.id,
      text: `${params.explorer.name} discovered ${params.location.name}: ${parsed.narrative}`,
      cached: result.cached,
      metadata: {
        explorer: params.explorer.id,
        discoveryType: params.discoveryType,
        significance: parsed.significance,
        tick: params.tick
      }
    };
    this.loreLog.push(record);
    return record;
  }

  public async generateChainLink(params: {
    sourceLocation: HardState;
    revealedLocationTheme: string;
    explorer?: HardState;
  }): Promise<LoreRecord | null> {
    if (!this.isEnabled()) return null;

    const geoConstraints = this.loreProvider.getGeographyConstraints();

    const prompt = [
      `Explain why discovering ${params.sourceLocation.name} would lead to finding a ${params.revealedLocationTheme}.`,
      `Source location: ${params.sourceLocation.name} (${params.sourceLocation.subtype}) - ${params.sourceLocation.description}`,
      params.explorer ? `Explorer: ${params.explorer.name}` : 'Explorers investigating the site',
      `Geographic constraints: ${geoConstraints.scale}, ${geoConstraints.characteristics.join(', ')}`,
      `IMPORTANT: Keep each field under 40 words. Be direct.`,
      `Return JSON: { "connection": string, "clue": string }.`
    ].join('\n');

    const result = await this.llm.complete({
      systemPrompt: 'You explain brief geographic connections. Maximum 40 words per field. Output JSON only.',
      prompt,
      maxTokens: 250,
      temperature: 0.2
    });

    const parsed = parseJsonSafe<any>(result.text);
    if (!parsed) {
      if (result.text) console.warn('Failed to parse chain link response');
      return null;
    }

    const record: LoreRecord = {
      id: generateLoreId('chain'),
      type: 'chain_link',
      targetId: params.sourceLocation.id,
      text: `${parsed.connection} | Clue: ${parsed.clue}`,
      cached: result.cached,
      metadata: {
        sourceLocation: params.sourceLocation.id,
        revealedTheme: params.revealedLocationTheme
      }
    };
    this.loreLog.push(record);
    return record;
  }

  public async enrichOccurrence(
    occurrence: HardState,
    context: EnrichmentContext
  ): Promise<LoreRecord | null> {
    if (!this.isEnabled()) return null;

    // Get catalyst-specific data
    const catalyzedBy = context.catalystInfo?.entityId || 'unknown forces';
    const catalystEntity = catalyzedBy !== 'unknown forces'
      ? context.graphSnapshot.entities.get(catalyzedBy)
      : null;

    // Get participants
    const participants = context.graphSnapshot.relationships
      .filter(r => r.kind === 'participant_in' && r.dst === occurrence.id && r.status !== 'historical')
      .map(r => context.graphSnapshot.entities.get(r.src)?.name)
      .filter(Boolean);

    // Get epicenter
    const epicenterRel = context.graphSnapshot.relationships
      .find(r => r.kind === 'epicenter_of' && r.src === occurrence.id && r.status !== 'historical');
    const epicenter = epicenterRel
      ? context.graphSnapshot.entities.get(epicenterRel.dst)?.name
      : null;

    // Get domain-specific prompt template
    const domainPromptHint = this.loreProvider.getOccurrenceEnrichmentPrompt(occurrence.subtype);

    const prompt = [
      `Create a lore-consistent name and description for an occurrence (${occurrence.subtype}).`,
      `Catalyst: ${catalystEntity?.name || catalyzedBy} triggered this event.`,
      `Participants: ${participants.join(', ')}`,
      epicenter ? `Epicenter: ${epicenter}` : '',
      `Current era: ${context.graphSnapshot.era} at tick ${context.graphSnapshot.tick}.`,
      domainPromptHint || '',
      `Stay within canon: ${this.loreProvider.getCanonFacts().join('; ')}.`,
      `IMPORTANT: Keep description under 100 words. Be evocative and specific.`,
      `Return JSON: { "name": string, "description": string, "stakes": string }.`
    ].join('\n');

    const result = await this.llm.complete({
      systemPrompt: 'You write concise, dramatic occurrence descriptions. Maximum 100 words. Output JSON only.',
      prompt,
      maxTokens: 400,
      temperature: 0.2
    });

    const parsed = parseJsonSafe<any>(result.text);
    if (!parsed) {
      if (result.text) console.warn('Failed to parse occurrence enrichment response');
      return null;
    }

    occurrence.name = parsed.name || occurrence.name;
    occurrence.description = parsed.description || occurrence.description;

    const record: LoreRecord = {
      id: generateLoreId('occurrence'),
      type: 'description',
      targetId: occurrence.id,
      text: `${parsed.name}: ${parsed.description}`,
      cached: result.cached,
      metadata: {
        stakes: parsed.stakes,
        catalyst: catalystEntity?.name || catalyzedBy
      }
    };

    this.loreLog.push(record);
    return record;
  }

  public async enrichEra(
    era: HardState,
    context: EnrichmentContext
  ): Promise<LoreRecord | null> {
    if (!this.isEnabled()) return null;

    // Get era-specific data
    const pressures = Object.entries(context.graphSnapshot.pressures || {})
      .map(([k, v]) => `${k}: ${v.toFixed(1)}`)
      .join(', ');

    // Get major occurrences during this era
    const eraOccurrences = Array.from(context.graphSnapshot.entities.values())
      .filter(e => e.kind === FRAMEWORK_ENTITY_KINDS.OCCURRENCE &&
        context.graphSnapshot.relationships.some(r =>
          r.kind === FRAMEWORK_RELATIONSHIP_KINDS.ACTIVE_DURING &&
          r.src === e.id &&
          r.dst === era.id &&
          r.status !== 'historical'
        ))
      .map(e => e.name);

    // Get domain-specific prompt template
    const domainPromptHint = this.loreProvider.getEraEnrichmentPrompt(era.subtype);

    const prompt = [
      `Create a lore-consistent description for a historical era (${era.subtype}).`,
      `Era name: ${era.name}`,
      `World: ${this.loreProvider.getWorldName()}`,
      `Pressures: ${pressures}`,
      `Major occurrences: ${eraOccurrences.join(', ') || 'peaceful times'}`,
      domainPromptHint || '',
      `What defined this era? What will be remembered?`,
      `Stay within canon: ${this.loreProvider.getCanonFacts().join('; ')}.`,
      `IMPORTANT: Keep description under 150 words. Be evocative.`,
      `Return JSON: { "description": string, "definingEvents": string[], "legacy": string }.`
    ].join('\n');

    const result = await this.llm.complete({
      systemPrompt: 'You write concise era descriptions. Maximum 150 words. Output JSON only.',
      prompt,
      maxTokens: 500,
      temperature: 0.2
    });

    const parsed = parseJsonSafe<any>(result.text);
    if (!parsed) {
      if (result.text) console.warn('Failed to parse era enrichment response');
      return null;
    }

    era.description = parsed.description || era.description;

    const record: LoreRecord = {
      id: generateLoreId('era'),
      type: 'description',
      targetId: era.id,
      text: `${era.name}: ${parsed.description}`,
      cached: result.cached,
      metadata: {
        definingEvents: parsed.definingEvents,
        legacy: parsed.legacy
      }
    };

    this.loreLog.push(record);
    return record;
  }

  public async enrichEntityChanges(
    entity: HardState,
    changes: string[],
    context: EnrichmentContext
  ): Promise<LoreRecord | null> {
    if (!this.isEnabled()) return null;

    const prompt = [
      `An entity has undergone significant changes in ${this.loreProvider.getWorldName()}.`,
      `Entity: ${entity.name} (${entity.kind}:${entity.subtype})`,
      `Current description: ${entity.description}`,
      `Changes that occurred: ${changes.join('; ')}`,
      `Era: ${context.graphSnapshot.era} at tick ${context.graphSnapshot.tick}`,
      `Write a brief narrative supplement (2-3 sentences) describing what happened.`,
      `Reference the changes above and stay consistent with the existing description.`,
      `Stay within canon (${this.loreProvider.getCanonFacts().join('; ')}).`,
      `Return JSON: { "narrative": string }.`
    ].join('\n');

    const result = await this.llm.complete({
      systemPrompt: 'You write brief narrative supplements for entity changes. Maximum 60 words. Output JSON only.',
      prompt,
      maxTokens: 300,
      temperature: 0.2
    });

    const parsed = parseJsonSafe<any>(result.text);
    if (!parsed) {
      if (result.text) console.warn('Failed to parse change enrichment response');
      return null;
    }

    const record: LoreRecord = {
      id: generateLoreId('change'),
      type: 'entity_change',
      targetId: entity.id,
      text: parsed.narrative,
      cached: result.cached,
      metadata: {
        changes: changes,
        tick: context.graphSnapshot.tick
      }
    };

    this.loreLog.push(record);
    return record;
  }

  private buildLoreHighlights(): string {
    const culturalGroups = this.loreProvider.getCulturalGroups()
      .map(c => `${c.name}: ${c.style} | values: ${c.values.join(', ')}`)
      .join(' ; ');

    const conflictLines = `Conflicts: ${this.loreProvider.getConflictPatterns().join('; ')}`;
    const techLines = `Tech: ${this.loreProvider.getTechnologyNotes().join('; ')}`;
    const magicLines = `Magic: ${this.loreProvider.getMagicSystemNotes().join('; ')}`;

    return [culturalGroups, conflictLines, techLines, magicLines].join(' | ');
  }
}
