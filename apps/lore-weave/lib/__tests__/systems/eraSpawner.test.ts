// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { eraSpawner } from '../../systems/eraSpawner';
import { Graph } from '../../engine/types';
import { HardState, Relationship } from '../../core/worldTypes';

describe('eraSpawner', () => {
  let graph: Graph;

  beforeEach(() => {
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
      discoveryState: {} as any,
      history: [],
      loreIndex: {} as any,
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
      }
    };
  });

  describe('metadata', () => {
    it('should have correct id and name', () => {
      expect(eraSpawner.id).toBe('era_spawner');
      expect(eraSpawner.name).toBe('Era Initialization');
    });

    it('should have metadata defined', () => {
      expect(eraSpawner.metadata).toBeDefined();
      expect(eraSpawner.metadata!.parameters).toBeDefined();
    });
  });

  describe('spawning behavior', () => {
    it('should create era entities from config', () => {
      const result = eraSpawner.apply(graph);

      // Should create 3 eras from config
      const eraEntities = Array.from(graph.entities.values()).filter(e => e.kind === 'era');
      expect(eraEntities.length).toBe(3);
      expect(result.description.toLowerCase()).toContain('spawned');
    });

    it('should set first era to current status', () => {
      eraSpawner.apply(graph);

      const currentEras = Array.from(graph.entities.values()).filter(e => e.kind === 'era' && e.status === 'current');
      expect(currentEras.length).toBe(1);
      expect(currentEras[0].name).toBe('Era One');
    });

    it('should set remaining eras to future status', () => {
      eraSpawner.apply(graph);

      const futureEras = Array.from(graph.entities.values()).filter(e => e.kind === 'era' && e.status === 'future');
      expect(futureEras.length).toBe(2);
    });

    it('should create supersedes relationships', () => {
      const result = eraSpawner.apply(graph);

      const supersedesRels = graph.relationships.filter(r => r.kind === 'supersedes');
      // Should have N-1 supersedes relationships for N eras
      // Check result or graph relationships
      expect(supersedesRels.length + result.relationshipsAdded.filter((r: any) => r.kind === 'supersedes').length).toBeGreaterThanOrEqual(2);
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
