/**
 * Shared test helpers for creating mock entities
 */

import { HardState, Relationship, Prominence, EntityTags } from '../core/worldTypes';
import { Graph, Era, EngineConfig, CreateEntitySettings } from '../engine/types';
import type { ISimulationEmitter } from '../observer/types';
import type { Culture } from '../naming/nameForgeService';

/**
 * Create a no-op emitter for tests that don't care about events
 */
export function createMockEmitter(): ISimulationEmitter {
  return {
    emit: () => {},
    progress: () => {},
    log: () => {},
    validation: () => {},
    epochStart: () => {},
    epochStats: () => {},
    growthPhase: () => {},
    populationReport: () => {},
    templateUsage: () => {},
    coordinateStats: () => {},
    tagHealth: () => {},
    systemHealth: () => {},
    // Final diagnostics
    entityBreakdown: () => {},
    catalystStats: () => {},
    relationshipBreakdown: () => {},
    notableEntities: () => {},
    sampleHistory: () => {},
    complete: () => {},
    error: () => {},
  };
}

/**
 * Minimal naming config for test cultures
 */
const minimalNamingConfig = {
  domains: [{ id: 'default', name: 'Default' }],
  lexemeLists: {},
  grammars: [{
    id: 'simple',
    domain: 'default',
    patterns: [{ pattern: 'Test {id}', weight: 1 }]
  }],
  profiles: [{
    id: 'default',
    domain: 'default',
    grammar: 'simple',
    conditions: {}
  }]
};

/**
 * Create minimal cultures for tests with required naming config
 */
export function createMockCultures(): Culture[] {
  return [
    { id: 'default', name: 'Default Culture', naming: minimalNamingConfig },
    { id: 'world', name: 'World Culture', naming: minimalNamingConfig },
  ];
}

/**
 * Create a minimal test graph with all Graph interface methods for testing
 *
 * This creates a Graph-compatible object that implements all required methods.
 */
export function createTestGraph(overrides: Partial<Graph> = {}): Graph {
  const _entities = new Map<string, HardState>();
  let _relationships: Relationship[] = [];
  let _tick = overrides.tick ?? 0;

  // Create a graph object implementing the full Graph interface
  const graph = {
    // State properties
    get tick() { return _tick; },
    set tick(val: number) { _tick = val; },
    currentEra: overrides.currentEra ?? {
      id: 'test-era',
      name: 'Test Era',
      description: 'Test era for unit tests',
      templateWeights: {},
      systemModifiers: {}
    },
    pressures: overrides.pressures ?? new Map(),
    history: overrides.history ?? [],
    config: overrides.config ?? {} as EngineConfig,
    relationshipCooldowns: overrides.relationshipCooldowns ?? new Map(),
    // loreRecords/loreIndex moved to @illuminator
    rateLimitState: overrides.rateLimitState ?? {
      currentThreshold: 0.5,
      lastCreationTick: 0,
      creationsThisEpoch: 0
    },
    growthMetrics: overrides.growthMetrics ?? {
      relationshipsPerTick: [],
      averageGrowthRate: 0
    },
    subtypeMetrics: overrides.subtypeMetrics,
    protectedRelationshipViolations: overrides.protectedRelationshipViolations,

    // Entity read methods (return clones)
    getEntity(id: string): HardState | undefined {
      const entity = _entities.get(id);
      return entity ? { ...entity, tags: { ...entity.tags }, links: [...entity.links] } : undefined;
    },
    hasEntity(id: string): boolean {
      return _entities.has(id);
    },
    getEntityCount(): number {
      return _entities.size;
    },
    getEntities(): HardState[] {
      return Array.from(_entities.values()).map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
    },
    getEntityIds(): string[] {
      return Array.from(_entities.keys());
    },
    forEachEntity(callback: (entity: HardState, id: string) => void): void {
      _entities.forEach((entity, id) => {
        callback({ ...entity, tags: { ...entity.tags }, links: [...entity.links] }, id);
      });
    },
    findEntities(criteria: { kind?: string; subtype?: string; status?: string; prominence?: string; culture?: string; tag?: string; exclude?: string[] }): HardState[] {
      return Array.from(_entities.values())
        .filter(e => {
          if (criteria.kind && e.kind !== criteria.kind) return false;
          if (criteria.subtype && e.subtype !== criteria.subtype) return false;
          if (criteria.status && e.status !== criteria.status) return false;
          if (criteria.prominence && e.prominence !== criteria.prominence) return false;
          if (criteria.culture && e.culture !== criteria.culture) return false;
          if (criteria.tag && !(criteria.tag in e.tags)) return false;
          if (criteria.exclude && criteria.exclude.includes(e.id)) return false;
          return true;
        })
        .map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
    },
    getEntitiesByKind(kind: string): HardState[] {
      return Array.from(_entities.values())
        .filter(e => e.kind === kind)
        .map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
    },
    getConnectedEntities(entityId: string, relationKind?: string): HardState[] {
      const connectedIds = new Set<string>();
      _relationships.forEach(r => {
        if (relationKind && r.kind !== relationKind) return;
        if (r.src === entityId) connectedIds.add(r.dst);
        if (r.dst === entityId) connectedIds.add(r.src);
      });
      return Array.from(connectedIds)
        .map(id => _entities.get(id))
        .filter((e): e is HardState => e !== undefined)
        .map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
    },

    // Entity mutation methods (framework-aware)
    createEntity(settings: CreateEntitySettings): string {
      const id = `${settings.kind}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const tags: EntityTags = settings.tags || {};
      const name = settings.name || `Test ${settings.kind}`;
      const entity: HardState = {
        id,
        kind: settings.kind,
        subtype: settings.subtype,
        name,
        description: settings.description || '',
        status: settings.status || 'active',
        prominence: settings.prominence || 'marginal',
        culture: settings.culture || 'world',
        tags,
        links: [],
        coordinates: settings.coordinates,
        temporal: settings.temporal,
        createdAt: _tick,
        updatedAt: _tick
      };
      _entities.set(id, entity);
      return id;
    },
    updateEntity(id: string, changes: Partial<HardState>): boolean {
      const entity = _entities.get(id);
      if (!entity) return false;
      Object.assign(entity, changes);
      entity.updatedAt = _tick;
      return true;
    },
    deleteEntity(id: string): boolean {
      return _entities.delete(id);
    },
    _loadEntity(id: string, entity: HardState): void {
      _entities.set(id, entity);
    },

    // Relationship read methods
    getRelationships(): Relationship[] {
      return [..._relationships];
    },
    getRelationshipCount(): number {
      return _relationships.length;
    },
    findRelationships(criteria: { kind?: string; src?: string; dst?: string; category?: string; minStrength?: number }): Relationship[] {
      return _relationships.filter(r => {
        if (criteria.kind && r.kind !== criteria.kind) return false;
        if (criteria.src && r.src !== criteria.src) return false;
        if (criteria.dst && r.dst !== criteria.dst) return false;
        if (criteria.minStrength !== undefined && (r.strength ?? 0.5) < criteria.minStrength) return false;
        return true;
      });
    },
    getEntityRelationships(entityId: string, direction?: 'src' | 'dst' | 'both'): Relationship[] {
      return _relationships.filter(r => {
        if (direction === 'src') return r.src === entityId;
        if (direction === 'dst') return r.dst === entityId;
        return r.src === entityId || r.dst === entityId;
      });
    },
    hasRelationship(srcId: string, dstId: string, kind?: string): boolean {
      return _relationships.some(r =>
        r.src === srcId && r.dst === dstId && (!kind || r.kind === kind)
      );
    },

    // Relationship mutation methods (framework-aware)
    addRelationship(kind: string, srcId: string, dstId: string, strength?: number, distance?: number, category?: string): boolean {
      // Check for duplicate
      const exists = _relationships.some(r => r.src === srcId && r.dst === dstId && r.kind === kind);
      if (exists) return false;

      const relationship: Relationship = {
        kind,
        src: srcId,
        dst: dstId,
        strength: strength ?? 0.5,
        distance,
        category,
        status: 'active'
      };
      _relationships.push(relationship);

      // Update entity links
      const srcEntity = _entities.get(srcId);
      if (srcEntity) {
        srcEntity.links.push({ ...relationship });
        srcEntity.updatedAt = _tick;
      }
      const dstEntity = _entities.get(dstId);
      if (dstEntity) {
        dstEntity.updatedAt = _tick;
      }
      return true;
    },
    removeRelationship(srcId: string, dstId: string, kind: string): boolean {
      const idx = _relationships.findIndex(r => r.src === srcId && r.dst === dstId && r.kind === kind);
      if (idx >= 0) {
        _relationships.splice(idx, 1);
        const srcEntity = _entities.get(srcId);
        if (srcEntity) {
          srcEntity.links = srcEntity.links.filter(l => !(l.src === srcId && l.dst === dstId && l.kind === kind));
          srcEntity.updatedAt = _tick;
        }
        return true;
      }
      return false;
    },
    _setRelationships(rels: Relationship[]): void {
      _relationships = rels;
    }
  } as Graph;

  return graph;
}

/**
 * Create a minimal HardState entity for testing
 */
export function createTestEntity(
  overrides: Partial<HardState> = {}
): HardState {
  return {
    id: overrides.id || 'test-entity',
    kind: overrides.kind || 'npc',
    subtype: overrides.subtype || 'merchant',
    name: overrides.name || 'Test Entity',
    description: overrides.description || 'A test entity',
    status: overrides.status || 'active',
    prominence: overrides.prominence || 'marginal',
    culture: overrides.culture || 'world',
    tags: overrides.tags || [],
    links: overrides.links || [],
    createdAt: overrides.createdAt ?? 0,
    updatedAt: overrides.updatedAt ?? 0,
    ...overrides
  };
}

/**
 * Create a minimal NPC for testing
 */
export function createTestNpc(
  id: string,
  name: string,
  overrides: Partial<HardState> = {}
): HardState {
  return createTestEntity({
    id,
    kind: 'npc',
    name,
    ...overrides
  });
}

/**
 * Create a minimal faction for testing
 */
export function createTestFaction(
  id: string,
  name: string,
  overrides: Partial<HardState> = {}
): HardState {
  return createTestEntity({
    id,
    kind: 'faction',
    subtype: 'political',
    name,
    ...overrides
  });
}

/**
 * Create a minimal location for testing
 */
export function createTestLocation(
  id: string,
  name: string,
  overrides: Partial<HardState> = {}
): HardState {
  return createTestEntity({
    id,
    kind: 'location',
    subtype: 'colony',
    name,
    ...overrides
  });
}
