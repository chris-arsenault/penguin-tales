// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { createEraSpawnerSystem } from '../../systems/eraSpawner';
import { Graph, SimulationSystem } from '../../engine/types';
import { HardState, Relationship } from '../../core/worldTypes';

describe('eraSpawner', () => {
  let graph: Graph;
  let eraSpawner: SimulationSystem;

  beforeEach(() => {
    // Create the era spawner system with default config
    eraSpawner = createEraSpawnerSystem({
      id: 'era_spawner',
      name: 'Era Initialization',
      ticksPerEra: 30
    });
    const _entities = new Map();
    let _relationships: Relationship[] = [];

    graph = {
      get entities() { return _entities; },
      get relationships() { return _relationships; },
      set relationships(rels: Relationship[]) { _relationships = rels; },
      tick: 0,
      currentEra: { id: 'test', name: 'Test', description: 'Test', templateWeights: {}, systemModifiers: {}, pressureModifiers: {} },
      pressures: new Map(),
      relationshipCooldowns: new Map(),
      config: {
        eras: [
          { id: 'era1', name: 'Era One', description: 'First', templateWeights: {}, systemModifiers: {}, pressureModifiers: {} },
          { id: 'era2', name: 'Era Two', description: 'Second', templateWeights: {}, systemModifiers: {}, pressureModifiers: {} },
          { id: 'era3', name: 'Era Three', description: 'Third', templateWeights: {}, systemModifiers: {}, pressureModifiers: {} },
        ],
        maxTicks: 500,
      } as any,
      rateLimitState: {} as any,
      history: [],
      nameLogger: {} as any,
      tagRegistry: {} as any,
      loreValidator: {} as any,
      statistics: {} as any,
      enrichmentService: {} as any,

      // Entity read methods
      getEntity(id: string) { return _entities.get(id); },
      hasEntity(id: string) { return _entities.has(id); },
      getEntityCount() { return _entities.size; },
      getEntities() { return Array.from(_entities.values()); },
      getEntityIds() { return Array.from(_entities.keys()); },
      findEntities(criteria: any) {
        return Array.from(_entities.values()).filter((e: any) => {
          if (criteria.kind && e.kind !== criteria.kind) return false;
          if (criteria.subtype && e.subtype !== criteria.subtype) return false;
          if (criteria.status && e.status !== criteria.status) return false;
          return true;
        });
      },
      getEntitiesByKind(kind: string) {
        return Array.from(_entities.values()).filter((e: any) => e.kind === kind);
      },

      // Relationship read methods
      getRelationships() { return [..._relationships]; },
      getRelationshipCount() { return _relationships.length; },
      findRelationships(criteria: any) {
        return _relationships.filter(r => {
          if (criteria.kind && r.kind !== criteria.kind) return false;
          if (criteria.src && r.src !== criteria.src) return false;
          if (criteria.dst && r.dst !== criteria.dst) return false;
          return true;
        });
      },

      // Mutation methods
      setEntity(id: string, entity: HardState): void {
        _entities.set(id, entity);
      },
      updateEntity(id: string, changes: Partial<HardState>): boolean {
        const entity = _entities.get(id);
        if (!entity) return false;
        Object.assign(entity, changes);
        return true;
      },
      deleteEntity(id: string): boolean {
        return _entities.delete(id);
      },
      pushRelationship(relationship: Relationship): void {
        _relationships.push(relationship);
      },
      addRelationship(relationship: Relationship): void {
        _relationships.push(relationship);
      },
      setRelationships(rels: Relationship[]): void {
        _relationships = rels;
      },
      _loadEntity(id: string, entity: HardState): void {
        _entities.set(id, entity);
      },
      _loadRelationship(relationship: Relationship): void {
        _relationships.push(relationship);
      },
      // TemplateGraphView methods for eraSpawner
      loadEntity(entity: HardState): void {
        _entities.set(entity.id, entity);
      },
      setCurrentEra(era: any): void {
        graph.currentEra = era;
      },
      addHistoryEvent(event: any): void {
        graph.history.push(event);
      },
      log(_level: string, _message: string, _context?: any): void {
        // no-op for tests
      }
    };
  });

  describe('metadata', () => {
    it('should have correct id and name', () => {
      expect(eraSpawner.id).toBe('era_spawner');
      expect(eraSpawner.name).toBe('Era Initialization');
    });

    // Note: metadata removed - parameters are now passed via config
  });

  describe('spawning behavior (lazy model)', () => {
    // NEW MODEL: eraSpawner only spawns the FIRST era.
    // Subsequent eras are spawned lazily by eraTransition when conditions are met.

    it('should create only the first era entity (lazy spawning)', () => {
      const result = eraSpawner.apply(graph);

      // Should create only the FIRST era (lazy spawning model)
      const eraEntities = Array.from(graph.entities.values()).filter(e => e.kind === 'era');
      expect(eraEntities.length).toBe(1);
      expect(eraEntities[0].name).toBe('Era One');
      expect(result.description).toContain('Started first era');
    });

    it('should set first era to current status', () => {
      eraSpawner.apply(graph);

      const currentEras = Array.from(graph.entities.values()).filter(e => e.kind === 'era' && e.status === 'current');
      expect(currentEras.length).toBe(1);
      expect(currentEras[0].name).toBe('Era One');
    });

    it('should not spawn future eras (lazy spawning model)', () => {
      eraSpawner.apply(graph);

      // No future eras should be created - they are spawned lazily by eraTransition
      const futureEras = Array.from(graph.entities.values()).filter(e => e.kind === 'era' && e.status === 'future');
      expect(futureEras.length).toBe(0);
    });

    it('should not create supersedes relationships (lazy spawning model)', () => {
      const result = eraSpawner.apply(graph);

      // No supersedes relationships at init - they are created by eraTransition
      expect(result.relationshipsAdded.length).toBe(0);
    });

    it('should only run once', () => {
      eraSpawner.apply(graph);
      const firstCount = graph.entities.size;

      const result = eraSpawner.apply(graph);

      expect(graph.entities.size).toBe(firstCount);
      expect(result.description).toContain('already exist');
    });

    it('should handle empty eras config', () => {
      graph.config.eras = [];

      const result = eraSpawner.apply(graph);

      expect(graph.entities.size).toBe(0);
      expect(result.description).toContain('No eras');
    });

    it('should handle single era', () => {
      graph.config.eras = [
        { id: 'only', name: 'Only Era', description: 'Only', templateWeights: {}, systemModifiers: {}, pressureModifiers: {} }
      ];

      eraSpawner.apply(graph);

      const eraEntities = Array.from(graph.entities.values()).filter(e => e.kind === 'era');
      expect(eraEntities.length).toBe(1);
      expect(eraEntities[0].status).toBe('current');
    });

    it('should set currentEra reference', () => {
      eraSpawner.apply(graph);

      expect(graph.currentEra.id).toBe('era1');
      expect(graph.currentEra.name).toBe('Era One');
    });

    it('should apply entry effects for first era', () => {
      graph.config.eras[0].entryEffects = {
        mutations: [
          { type: 'modify_pressure', pressureId: 'exploration', delta: 10 },
          { type: 'modify_pressure', pressureId: 'stability', delta: 5 }
        ]
      };

      const result = eraSpawner.apply(graph);

      expect(result.pressureChanges).toEqual({ exploration: 10, stability: 5 });
    });
  });

  describe('edge cases', () => {
    it('should handle undefined eras config', () => {
      graph.config.eras = undefined as any;

      const result = eraSpawner.apply(graph);

      expect(result).toBeDefined();
      expect(graph.entities.size).toBe(0);
    });

    it('should work with modifier parameter', () => {
      const result = eraSpawner.apply(graph, 2.0);

      expect(result).toBeDefined();
      expect(graph.entities.size).toBeGreaterThan(0);
    });
  });
});
