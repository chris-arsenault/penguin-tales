import { HardState, Relationship } from '../types/worldTypes';
import { EnrichmentConfig, LLMConfig } from '../types/engine';
import { EnrichmentContext, LoreIndex, LoreRecord } from '../types/lore';
import { LLMClient } from './llmClient';
import { LoreValidator } from './loreValidator';

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

let loreRecordCounter = 0;
function nextLoreId(prefix: string): string {
  return `${prefix}_${Date.now()}_${loreRecordCounter++}`;
}

export class EnrichmentService {
  private llm: LLMClient;
  private loreIndex: LoreIndex;
  private validator: LoreValidator;
  private config: EnrichmentConfig;
  private loreLog: LoreRecord[] = [];

  constructor(llmConfig: LLMConfig, loreIndex: LoreIndex, config?: Partial<EnrichmentConfig>) {
    this.llm = new LLMClient(llmConfig);
    this.loreIndex = loreIndex;
    this.validator = new LoreValidator(loreIndex);
    this.config = {
      batchSize: config?.batchSize || 3,
      mode: config?.mode || 'full',
      maxEntityEnrichments: config?.maxEntityEnrichments,
      maxRelationshipEnrichments: config?.maxRelationshipEnrichments,
      maxEraNarratives: config?.maxEraNarratives
    };
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
    const batches = chunk(entities, this.config.batchSize);
    const loreHighlights = this.buildLoreHighlights();

    for (const batch of batches) {
      const promptEntities = batch.map(e => ({
        id: e.id,
        kind: e.kind,
        subtype: e.subtype,
        prominence: e.prominence,
        placeholders: {
          name: e.name,
          description: e.description
        }
      }));

      const prompt = [
        `You are enriching a penguin history simulation using the lore below.`,
        `Lore highlights:`,
        loreHighlights,
        `Context tick ${context.graphSnapshot.tick} in era ${context.graphSnapshot.era}.`,
        `Entities to enrich (JSON array expected with id,name,description):`,
        JSON.stringify(promptEntities, null, 2),
        `Use colony tone differences:`,
        `Aurora Stack practical; Nightfall Shelf poetic; two-part names with earned names.`,
        `Do not invent new mechanics; stay within canon list; avoid legends unless noting rumor.`,
        `Return JSON array only.`
      ].join('\n');

      const result = await this.llm.complete({
        systemPrompt: 'You are a precise lore keeper. Respond only with JSON when asked.',
        prompt,
        json: true,
        maxTokens: 400
      });

      let parsed: Array<{ id: string; name?: string; description?: string }> = [];

      if (result.text) {
        try {
          parsed = JSON.parse(result.text);
        } catch (error) {
          console.warn('Failed to parse enrichment response, using placeholders.', error);
        }
      }

      parsed.forEach(entry => {
        const entity = batch.find(e => e.id === entry.id);
        if (!entity) return;

        if (entry.name) entity.name = entry.name;
        if (entry.description) entity.description = entry.description;

        const validation = this.validator.validateEntity(entity, entry.description);
        const record: LoreRecord = {
          id: nextLoreId('name_desc'),
          type: entry.description ? 'description' : 'name',
          targetId: entity.id,
          text: `${entry.name || entity.name}: ${entry.description || ''}`.trim(),
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
      `Create a pivotal event that shifts the world from ${params.fromEra} to ${params.toEra}.`,
      `Pressures: ${JSON.stringify(params.pressures)}`,
      `Notable actors: ${params.actors.map(a => a.name).join(', ') || 'none'}.`,
      `Reference lore tensions (${this.loreIndex.tensions.join('; ')}) and stay within canon (${this.loreIndex.canon.join('; ')}).`,
      `Return JSON: { "eventName": string, "description": string }.`
    ].join('\n');

    const result = await this.llm.complete({
      systemPrompt: 'You write concise historical events grounded in provided lore. Output JSON only.',
      prompt,
      json: true,
      maxTokens: 300
    });

    if (!result.text) return null;

    try {
      const parsed = JSON.parse(result.text);
      const record: LoreRecord = {
        id: nextLoreId('era'),
        type: 'era_narrative',
        text: `${parsed.eventName}: ${parsed.description}`,
        metadata: { from: params.fromEra, to: params.toEra, tick: params.tick },
        cached: result.cached
      };
      this.loreLog.push(record);
      return record;
    } catch (error) {
      console.warn('Failed to parse era narrative response', error);
      return null;
    }
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

      const prompt = [
        `Generate a brief backstory for relationship ${rel.kind}.`,
        `Actor 1: ${actor1.name} (${actor1.kind}/${actor1.subtype}) - ${actor1.description}`,
        `Actor 2: ${actor2.name} (${actor2.kind}/${actor2.subtype}) - ${actor2.description}`,
        `Recent history: ${(context.relatedHistory || []).join('; ') || 'none'}.`,
        `Lore relationship norms: ${this.loreIndex.relationshipPatterns.join('; ')}`,
        `Keep it grounded in canon (${this.loreIndex.canon.join('; ')}).`,
        `Return JSON: { "incident": string, "stakes": string, "publicPerception": string }.`
      ].join('\n');

      const result = await this.llm.complete({
        systemPrompt: 'You write concise, lore-aware relationship backstories. Output JSON only.',
        prompt,
        json: true,
        maxTokens: 240
      });

      if (!result.text) continue;

      try {
        const parsed = JSON.parse(result.text);
        const text = `${parsed.incident} | Stakes: ${parsed.stakes} | Perception: ${parsed.publicPerception}`;
        const record: LoreRecord = {
          id: nextLoreId('relationship'),
          type: 'relationship_backstory',
          targetId: rel.dst,
          relationship: rel,
          text,
          cached: result.cached
        };
        this.loreLog.push(record);
        records.push(record);
      } catch (error) {
        console.warn('Failed to parse relationship backstory response', error);
      }
    }

    return records;
  }

  public async enrichAbility(
    ability: HardState,
    context: EnrichmentContext
  ): Promise<LoreRecord | null> {
    if (!this.isEnabled()) return null;

    const prompt = [
      `Create a lore-consistent name and description for an ability (${ability.subtype}).`,
      `Current era: ${context.graphSnapshot.era} at tick ${context.graphSnapshot.tick}.`,
      `Tech notes: ${this.loreIndex.techNotes.join('; ')}`,
      `Magic notes: ${this.loreIndex.magicNotes.join('; ')}`,
      `Stay within canon: ${this.loreIndex.canon.join('; ')}.`,
      `Return JSON: { "name": string, "description": string, "flavor": string }.`
    ].join('\n');

    const result = await this.llm.complete({
      systemPrompt: 'You design abilities consistent with penguin lore. Output JSON only.',
      prompt,
      json: true,
      maxTokens: 260
    });

    if (!result.text) return null;

    try {
      const parsed = JSON.parse(result.text);
      ability.name = parsed.name || ability.name;
      ability.description = parsed.description || ability.description;
      const validation = this.validator.validateEntity(ability, parsed.description);
      const record: LoreRecord = {
        id: nextLoreId('ability'),
        type: 'tech_magic',
        targetId: ability.id,
        text: `${parsed.name}: ${parsed.description}`,
        cached: result.cached,
        warnings: validation.warnings,
        metadata: { flavor: parsed.flavor }
      };
      this.loreLog.push(record);
      return record;
    } catch (error) {
      console.warn('Failed to parse ability enrichment response', error);
      return null;
    }
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

    const prompt = [
      `Generate a lore-consistent discovery narrative for a new location.`,
      `Explorer: ${params.explorer.name} (${params.explorer.subtype}) - ${params.explorer.description}`,
      `Discovered: ${params.location.name} (${params.location.subtype})`,
      `Discovery method: ${contextClue}`,
      `Geographic context: ${this.loreIndex.geography.constraints.totalArea}, vertical depth matters`,
      `Recent discovery precedent: ${this.loreIndex.geography.discoveryPrecedents[0]?.significance || 'none'}`,
      `Keep it grounded in canon (${this.loreIndex.canon.join('; ')}).`,
      `Return JSON: { "narrative": string, "significance": string }.`
    ].join('\n');

    const result = await this.llm.complete({
      systemPrompt: 'You write concise, lore-aware discovery narratives. Output JSON only.',
      prompt,
      json: true,
      maxTokens: 300
    });

    if (!result.text) return null;

    try {
      const parsed = JSON.parse(result.text);
      const record: LoreRecord = {
        id: nextLoreId('discovery'),
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
    } catch (error) {
      console.warn('Failed to parse discovery event response', error);
      return null;
    }
  }

  public async generateChainLink(params: {
    sourceLocation: HardState;
    revealedLocationTheme: string;
    explorer?: HardState;
  }): Promise<LoreRecord | null> {
    if (!this.isEnabled()) return null;

    const prompt = [
      `Explain why discovering ${params.sourceLocation.name} would lead to finding a ${params.revealedLocationTheme}.`,
      `Source location: ${params.sourceLocation.name} (${params.sourceLocation.subtype}) - ${params.sourceLocation.description}`,
      params.explorer ? `Explorer: ${params.explorer.name}` : 'Explorers investigating the site',
      `Geographic constraints: ${this.loreIndex.geography.constraints.totalArea}`,
      `Examples of connections: ice caves lead to underground lakes, ruins reveal artifact chambers`,
      `Return JSON: { "connection": string, "clue": string }.`
    ].join('\n');

    const result = await this.llm.complete({
      systemPrompt: 'You explain logical geographic connections in discovery chains. Output JSON only.',
      prompt,
      json: true,
      maxTokens: 200
    });

    if (!result.text) return null;

    try {
      const parsed = JSON.parse(result.text);
      const record: LoreRecord = {
        id: nextLoreId('chain'),
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
    } catch (error) {
      console.warn('Failed to parse chain link response', error);
      return null;
    }
  }

  private buildLoreHighlights(): string {
    const colonyLines = this.loreIndex.colonies
      .map(c => `${c.name}: ${c.style} | values: ${c.values.join(', ')}`)
      .join(' ; ');

    const tensionLines = `Tensions: ${this.loreIndex.tensions.join('; ')}`;
    const techLines = `Tech: ${this.loreIndex.techNotes.join('; ')}`;
    const magicLines = `Magic: ${this.loreIndex.magicNotes.join('; ')}`;

    return [colonyLines, tensionLines, techLines, magicLines].join(' | ');
  }
}
