export type Prominence = 'forgotten' | 'marginal' | 'recognized' | 'renowned' | 'mythic';
export interface HardState {
    id: string;
    kind: string;
    subtype: string;
    name: string;
    description: string;
    status: string;
    prominence: Prominence;
    culture: string;
    tags: string[];
    links: Relationship[];
    createdAt: number;
    updatedAt: number;
    catalyst?: CatalystProperties;
    temporal?: {
        startTick: number;
        endTick: number | null;
    };
}
export interface CatalyzedEvent {
    relationshipId?: string;
    entityId?: string;
    action: string;
    tick: number;
}
export interface CatalystProperties {
    canAct: boolean;
    actionDomains: string[];
    influence: number;
    catalyzedEvents: CatalyzedEvent[];
}
export interface Relationship {
    kind: string;
    src: string;
    dst: string;
    strength?: number;
    distance?: number;
    catalyzedBy?: string;
    category?: string;
    createdAt?: number;
    status?: 'active' | 'historical';
    archivedAt?: number;
}
export interface WorldSchema {
    hardState: Array<{
        kind: string;
        subtype: string[];
        status: string[];
    }>;
    relationships: Record<string, Record<string, string[]>>;
}
export type EntityKind = string;
export type NPCSubtype = string;
export type LocationSubtype = string;
export type FactionSubtype = string;
export type RulesSubtype = string;
export type AbilitiesSubtype = string;
export type NPCStatus = string;
export type FactionStatus = string;
export type LocationStatus = string;
export type RulesStatus = string;
export type AbilitiesStatus = string;
export interface DiscoveryState {
    currentThreshold: number;
    lastDiscoveryTick: number;
    discoveriesThisEpoch: number;
}
//# sourceMappingURL=worldTypes.d.ts.map