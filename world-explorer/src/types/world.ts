export type Prominence = 'forgotten' | 'marginal' | 'recognized' | 'renowned' | 'mythic';

export type EntityKind = 'npc' | 'location' | 'faction' | 'rules' | 'abilities';

export interface Relationship {
  kind: string;
  src: string;
  dst: string;
}

export interface HardState {
  id: string;
  kind: EntityKind;
  subtype: string;
  name: string;
  description: string;
  status: string;
  prominence: Prominence;
  tags: string[];
  links: Relationship[];
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEvent {
  tick: number;
  era: string;
  type: 'growth' | 'simulation' | 'special';
  description: string;
  entitiesCreated: string[];
  relationshipsCreated: Relationship[];
  entitiesModified: string[];
}

export interface WorldMetadata {
  tick: number;
  epoch: number;
  entityCount: number;
  relationshipCount: number;
}

export interface WorldState {
  metadata: WorldMetadata;
  hardState: HardState[];
  relationships: Relationship[];
  pressures: Record<string, number>;
  history: HistoryEvent[];
}

export interface Filters {
  kinds: EntityKind[];
  minProminence: Prominence;
  timeRange: [number, number];
  tags: string[];
  searchQuery: string;
}

export type GraphMode = 'full' | 'radial' | 'temporal' | 'faction' | 'conflict' | 'economic';
