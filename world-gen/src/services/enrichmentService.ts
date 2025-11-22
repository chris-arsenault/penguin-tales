import { HardState, Relationship } from '../types/worldTypes';
import { EnrichmentConfig, LLMConfig } from '../types/engine';
import { EnrichmentContext, LoreIndex, LoreRecord } from '../types/lore';
import { LLMClient } from './llmClient';
import { LoreValidator } from './loreValidator';
import { generateName, upsertNameTag } from '../utils/helpers';

function parseJsonSafe<T = any>(raw: string): T | null {
  if (!raw) return null;
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

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
    const loreHighlights = this.buildLoreHighlights();

    // Treat the entire cluster as one batch (up to 6 entities max for token safety)
    // If cluster is larger than 6, split it but maintain sub-clusters
    const maxClusterSize = 6;
    const batches = entities.length > maxClusterSize
      ? chunk(entities, maxClusterSize)
      : [entities];

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
        `You MUST change the placeholder names; do not repeat the provided placeholder.`,
        `IMPORTANT: Keep each description under 50 words. Be concise and evocative.`,
        `Return JSON array only.`
      ].join('\n');

      // Scale token limit based on batch size (150 tokens per entity baseline)
      const tokensPerEntity = 150;
      const dynamicMaxTokens = Math.min(1000, tokensPerEntity * batch.length + 200);

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

        const oldName = entity.name;
        if (entry.name) entity.name = entry.name;
        if (entry.description) entity.description = entry.description;

        if (entry.name && entry.name !== oldName) {
          upsertNameTag(entity, entry.name);
        }

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
      id: nextLoreId('era'),
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
        maxTokens: 440
      });

      const parsed = parseJsonSafe<any>(result.text);
      if (parsed) {
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
      maxTokens: 260
    });

    const parsed = parseJsonSafe<any>(result.text);
    if (parsed) {
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

    const prompt = [
      `Generate a lore-consistent discovery narrative for a new location.`,
      `Explorer: ${params.explorer.name} (${params.explorer.subtype}) - ${params.explorer.description}`,
      `Discovered: ${params.location.name} (${params.location.subtype})`,
      `Discovery method: ${contextClue}`,
      `Geographic context: ${this.loreIndex.geography.constraints.totalArea}, vertical depth matters`,
      `Recent discovery precedent: ${this.loreIndex.geography.discoveryPrecedents[0]?.significance || 'none'}`,
      `Keep it grounded in canon (${this.loreIndex.canon.join('; ')}).`,
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
