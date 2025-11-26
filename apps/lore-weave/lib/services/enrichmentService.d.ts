import { HardState, Relationship } from '../types/worldTypes';
import { EnrichmentConfig, LLMConfig } from '../types/engine';
import { EnrichmentContext, LoreRecord } from '../types/lore';
import { DomainLoreProvider } from '../types/domainLore';
import { NameLogger } from './nameLogger';
export declare class EnrichmentService {
    private llm;
    private loreProvider;
    private validator;
    private nameLogger;
    private config;
    private loreLog;
    constructor(llmConfig: LLMConfig, loreProvider: DomainLoreProvider, config?: Partial<EnrichmentConfig>);
    getNameLogger(): NameLogger;
    isEnabled(): boolean;
    getLoreLog(): LoreRecord[];
    /**
     * Generate unique names for entities in large batches
     * This runs BEFORE description generation to ensure all lore uses final names
     */
    private batchGenerateNames;
    enrichEntities(entities: HardState[], context: EnrichmentContext, options?: {
        preserveNames?: boolean;
    }): Promise<LoreRecord[]>;
    generateEraNarrative(params: {
        fromEra: string;
        toEra: string;
        pressures: Record<string, number>;
        actors: HardState[];
        tick: number;
    }): Promise<LoreRecord | null>;
    enrichRelationships(relationships: Relationship[], actors: Record<string, HardState>, context: EnrichmentContext): Promise<LoreRecord[]>;
    enrichAbility(ability: HardState, context: EnrichmentContext): Promise<LoreRecord | null>;
    enrichDiscoveryEvent(params: {
        location: HardState;
        explorer: HardState;
        discoveryType: 'pressure' | 'exploration' | 'chain';
        triggerContext: {
            pressure?: string;
            chainSource?: HardState;
        };
        tick: number;
    }): Promise<LoreRecord | null>;
    generateChainLink(params: {
        sourceLocation: HardState;
        revealedLocationTheme: string;
        explorer?: HardState;
    }): Promise<LoreRecord | null>;
    enrichOccurrence(occurrence: HardState, context: EnrichmentContext): Promise<LoreRecord | null>;
    enrichEra(era: HardState, context: EnrichmentContext): Promise<LoreRecord | null>;
    enrichEntityChanges(entity: HardState, changes: string[], context: EnrichmentContext): Promise<LoreRecord | null>;
    private buildLoreHighlights;
}
//# sourceMappingURL=enrichmentService.d.ts.map