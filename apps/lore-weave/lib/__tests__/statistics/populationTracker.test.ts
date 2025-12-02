// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { PopulationTracker } from '../../statistics/populationTracker';
import { Graph } from '../../engine/types';
import { HardState, Relationship } from '../../core/worldTypes';
import { DistributionTargets } from '../../statistics/types';
import { DomainSchema } from '../../domainInterface/domainSchema';

describe('PopulationTracker', () => {
  let tracker: PopulationTracker;
  let mockGraph: Graph;
  let mockDistributionTargets: DistributionTargets;
  let mockDomainSchema: DomainSchema;

  beforeEach(() => {
    mockDomainSchema = {
      entityKinds: [
        {
          kind: 'npc',
          subtypes: [
            { id: 'hero', name: 'Hero' },
            { id: 'merchant', name: 'Merchant' },
            { id: 'villain', name: 'Villain' }
          ],
          statuses: []
        },
        {
          kind: 'location',
          subtypes: [
            { id: 'colony', name: 'Colony' },
            { id: 'landmark', name: 'Landmark' }
          ],
          statuses: []
        }
      ]
    } as DomainSchema;

    mockDistributionTargets = {
      entities: {
        npc: {
          hero: { target: 10 },
          merchant: { target: 15 },
          villain: { target: 5 }
        },
        location: {
          colony: { target: 8 },
          landmark: { target: 4 }
        }
      }
    } as any;

    tracker = new PopulationTracker(mockDistributionTargets, mockDomainSchema);

    const _entities = new Map<string, HardState>();
    let _relationships: Relationship[] = [];

    mockGraph = {
      tick: 0,
      currentEra: {
        id: 'test-era',
        name: 'Test Era',
        description: 'Test',
        templateWeights: {},
        systemModifiers: {},
        targetPopulation: 100
      },
      pressures: new Map<string, number>(),
      history: [],
      config: {} as any,

      // Entity read methods
      getEntity(id: string): HardState | undefined {
        const entity = _entities.get(id);
        return entity ? { ...entity, tags: [...entity.tags], links: [...entity.links] } : undefined;
      },
      hasEntity(id: string): boolean {
        return _entities.has(id);
      },
      getEntityCount(): number {
        return _entities.size;
      },
      getEntities(): HardState[] {
        return Array.from(_entities.values()).map(e => ({ ...e, tags: [...e.tags], links: [...e.links] }));
      },
      getEntityIds(): string[] {
        return Array.from(_entities.keys());
      },
      forEachEntity(callback: (entity: HardState, id: string) => void): void {
        _entities.forEach((entity, id) => {
          callback({ ...entity, tags: [...entity.tags], links: [...entity.links] }, id);
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
            if (criteria.tag && !e.tags.includes(criteria.tag)) return false;
            if (criteria.exclude && criteria.exclude.includes(e.id)) return false;
            return true;
          })
          .map(e => ({ ...e, tags: [...e.tags], links: [...e.links] }));
      },
      getEntitiesByKind(kind: string): HardState[] {
        return Array.from(_entities.values())
          .filter(e => e.kind === kind)
          .map(e => ({ ...e, tags: [...e.tags], links: [...e.links] }));
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
          .map(e => ({ ...e, tags: [...e.tags], links: [...e.links] }));
      },

      // Entity mutation methods
      setEntity(id: string, entity: HardState): void {
        _entities.set(id, entity);
      },
      updateEntity(id: string, changes: Partial<HardState>): boolean {
        const entity = _entities.get(id);
        if (!entity) return false;
        Object.assign(entity, changes);
        entity.updatedAt = this.tick;
        return true;
      },
      deleteEntity(id: string): boolean {
        return _entities.delete(id);
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

      // Relationship mutation methods
      pushRelationship(relationship: Relationship): void {
        _relationships.push(relationship);
        const srcEntity = _entities.get(relationship.src);
        if (srcEntity) {
          srcEntity.links.push({ ...relationship });
          srcEntity.updatedAt = this.tick;
        }
        const dstEntity = _entities.get(relationship.dst);
        if (dstEntity) {
          dstEntity.updatedAt = this.tick;
        }
      },
      setRelationships(rels: Relationship[]): void {
        _relationships = rels;
      },
      removeRelationship(srcId: string, dstId: string, kind: string): boolean {
        const idx = _relationships.findIndex(r => r.src === srcId && r.dst === dstId && r.kind === kind);
        if (idx >= 0) {
          _relationships.splice(idx, 1);
          const srcEntity = _entities.get(srcId);
          if (srcEntity) {
            srcEntity.links = srcEntity.links.filter(l => !(l.src === srcId && l.dst === dstId && l.kind === kind));
            srcEntity.updatedAt = this.tick;
          }
          return true;
        }
        return false;
      },

      get entities() { return _entities; },
      get relationships() { return _relationships; },
      set relationships(rels: Relationship[]) { _relationships = rels; }
    } as Graph;
  });

  describe('constructor and initialization', () => {
    it('should initialize with zero tick', () => {
      const metrics = tracker.getMetrics();
      expect(metrics.tick).toBe(0);
    });

    it('should initialize all known subtypes from schema', () => {
      const metrics = tracker.getMetrics();

      expect(metrics.entities.has('npc:hero')).toBe(true);
      expect(metrics.entities.has('npc:merchant')).toBe(true);
      expect(metrics.entities.has('npc:villain')).toBe(true);
      expect(metrics.entities.has('location:colony')).toBe(true);
      expect(metrics.entities.has('location:landmark')).toBe(true);
    });

    it('should initialize all subtypes with zero counts', () => {
      const metrics = tracker.getMetrics();
      const heroMetric = metrics.entities.get('npc:hero');

      expect(heroMetric).toBeDefined();
      expect(heroMetric!.count).toBe(0);
      expect(heroMetric!.deviation).toBe(-1); // Below target
    });

    it('should set targets from distribution config', () => {
      const metrics = tracker.getMetrics();

      expect(metrics.entities.get('npc:hero')!.target).toBe(10);
      expect(metrics.entities.get('npc:merchant')!.target).toBe(15);
      expect(metrics.entities.get('location:colony')!.target).toBe(8);
    });
  });

  describe('update', () => {
    it('should update tick from graph', () => {
      mockGraph.tick = 42;
      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      expect(metrics.tick).toBe(42);
    });

    it('should update entity metrics', () => {
      // Add entities to graph
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero 1', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.entities.set('npc-2', {
        id: 'npc-2', kind: 'npc', subtype: 'hero', name: 'Hero 2', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      const heroMetric = metrics.entities.get('npc:hero');

      expect(heroMetric!.count).toBe(2);
    });

    it('should use graph.subtypeMetrics if available', () => {
      mockGraph.subtypeMetrics = new Map<string, number>();
      mockGraph.subtypeMetrics.set('npc:hero', 5);
      mockGraph.subtypeMetrics.set('npc:merchant', 10);

      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      expect(metrics.entities.get('npc:hero')!.count).toBe(5);
      expect(metrics.entities.get('npc:merchant')!.count).toBe(10);
    });

    it('should fallback to counting entities if subtypeMetrics not available', () => {
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      expect(metrics.entities.get('npc:hero')!.count).toBe(1);
    });

    it('should update relationship metrics', () => {
      mockGraph.relationships.push(
        { kind: 'allied_with', src: 'npc-1', dst: 'npc-2' },
        { kind: 'allied_with', src: 'npc-2', dst: 'npc-3' },
        { kind: 'enemy_of', src: 'npc-1', dst: 'npc-4' }
      );

      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      expect(metrics.relationships.get('allied_with')!.count).toBe(2);
      expect(metrics.relationships.get('enemy_of')!.count).toBe(1);
    });

    it('should update pressure metrics', () => {
      mockGraph.pressures.set('conflict', 75);
      mockGraph.pressures.set('stability', 25);

      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      expect(metrics.pressures.get('conflict')!.value).toBe(75);
      expect(metrics.pressures.get('stability')!.value).toBe(25);
    });
  });

  describe('deviation calculation', () => {
    it('should calculate positive deviation when over target', () => {
      // Target is 10, add 15 entities
      for (let i = 1; i <= 15; i++) {
        mockGraph.entities.set(`npc-${i}`, {
          id: `npc-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }

      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      const heroMetric = metrics.entities.get('npc:hero');

      // Deviation = (15 - 10) / 10 = 0.5
      expect(heroMetric!.deviation).toBeCloseTo(0.5, 2);
    });

    it('should calculate negative deviation when under target', () => {
      // Target is 10, add 5 entities
      for (let i = 1; i <= 5; i++) {
        mockGraph.entities.set(`npc-${i}`, {
          id: `npc-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }

      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      const heroMetric = metrics.entities.get('npc:hero');

      // Deviation = (5 - 10) / 10 = -0.5
      expect(heroMetric!.deviation).toBeCloseTo(-0.5, 2);
    });

    it('should calculate zero deviation when at target', () => {
      // Target is 10, add 10 entities
      for (let i = 1; i <= 10; i++) {
        mockGraph.entities.set(`npc-${i}`, {
          id: `npc-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }

      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      const heroMetric = metrics.entities.get('npc:hero');

      expect(heroMetric!.deviation).toBeCloseTo(0, 2);
    });

    it('should handle zero target gracefully', () => {
      // Add entity with no target defined
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'unknown', name: 'Unknown', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      const unknownMetric = metrics.entities.get('npc:unknown');

      expect(unknownMetric!.deviation).toBe(0);
    });
  });

  describe('trend calculation', () => {
    it('should calculate increasing trend', () => {
      // Add entities incrementally over multiple ticks
      for (let tick = 1; tick <= 5; tick++) {
        mockGraph.tick = tick;
        for (let i = 1; i <= tick; i++) {
          mockGraph.entities.set(`npc-${i}`, {
            id: `npc-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
            status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
          });
        }
        tracker.update(mockGraph);
      }

      const metrics = tracker.getMetrics();
      const heroMetric = metrics.entities.get('npc:hero');

      // Trend should be positive (increasing by 1 each tick)
      expect(heroMetric!.trend).toBeGreaterThan(0);
      expect(heroMetric!.trend).toBeCloseTo(1, 1);
    });

    it('should calculate decreasing trend', () => {
      // Add entities decrementally
      for (let tick = 1; tick <= 5; tick++) {
        mockGraph.tick = tick;
        const entityIds = mockGraph.getEntityIds();
      entityIds.forEach(id => mockGraph.deleteEntity(id));
        for (let i = 1; i <= (6 - tick); i++) {
          mockGraph.entities.set(`npc-${i}`, {
            id: `npc-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
            status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
          });
        }
        tracker.update(mockGraph);
      }

      const metrics = tracker.getMetrics();
      const heroMetric = metrics.entities.get('npc:hero');

      // Trend should be negative (decreasing by 1 each tick)
      expect(heroMetric!.trend).toBeLessThan(0);
      expect(heroMetric!.trend).toBeCloseTo(-1, 1);
    });

    it('should calculate stable trend', () => {
      // Add same number of entities each tick
      for (let tick = 1; tick <= 5; tick++) {
        mockGraph.tick = tick;
        const entityIds = mockGraph.getEntityIds();
      entityIds.forEach(id => mockGraph.deleteEntity(id));
        for (let i = 1; i <= 5; i++) {
          mockGraph.entities.set(`npc-${i}`, {
            id: `npc-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
            status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
          });
        }
        tracker.update(mockGraph);
      }

      const metrics = tracker.getMetrics();
      const heroMetric = metrics.entities.get('npc:hero');

      // Trend should be zero (stable)
      expect(heroMetric!.trend).toBeCloseTo(0, 2);
    });

    it('should return zero trend with insufficient history', () => {
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      const heroMetric = metrics.entities.get('npc:hero');

      expect(heroMetric!.trend).toBe(0);
    });
  });

  describe('history tracking', () => {
    it('should maintain history window', () => {
      // Update 15 times (more than window of 10)
      for (let tick = 1; tick <= 15; tick++) {
        mockGraph.tick = tick;
        tracker.update(mockGraph);
      }

      const metrics = tracker.getMetrics();
      const heroMetric = metrics.entities.get('npc:hero');

      // History should be capped at 10
      expect(heroMetric!.history.length).toBeLessThanOrEqual(10);
    });

    it('should track count history correctly', () => {
      // Add entities over 3 ticks
      for (let tick = 1; tick <= 3; tick++) {
        mockGraph.tick = tick;
        const entityIds = mockGraph.getEntityIds();
      entityIds.forEach(id => mockGraph.deleteEntity(id));
        for (let i = 1; i <= tick; i++) {
          mockGraph.entities.set(`npc-${i}`, {
            id: `npc-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
            status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
          });
        }
        tracker.update(mockGraph);
      }

      const metrics = tracker.getMetrics();
      const heroMetric = metrics.entities.get('npc:hero');

      // History should be [1, 2, 3]
      expect(heroMetric!.history).toEqual([1, 2, 3]);
    });

    it('should track relationship history', () => {
      for (let tick = 1; tick <= 3; tick++) {
        mockGraph.tick = tick;
        mockGraph.relationships = [];
        for (let i = 1; i <= tick; i++) {
          mockGraph.relationships.push({ kind: 'allied_with', src: `npc-${i}`, dst: `npc-${i + 1}` });
        }
        tracker.update(mockGraph);
      }

      const metrics = tracker.getMetrics();
      const alliedMetric = metrics.relationships.get('allied_with');

      expect(alliedMetric!.history).toEqual([1, 2, 3]);
    });

    it('should track pressure history', () => {
      for (let tick = 1; tick <= 3; tick++) {
        mockGraph.tick = tick;
        mockGraph.pressures.set('conflict', tick * 10);
        tracker.update(mockGraph);
      }

      const metrics = tracker.getMetrics();
      const conflictMetric = metrics.pressures.get('conflict');

      expect(conflictMetric!.history).toEqual([10, 20, 30]);
    });
  });

  describe('getOutliers', () => {
    it('should identify overpopulated entities', () => {
      // Target is 10, add 15 (50% over)
      for (let i = 1; i <= 15; i++) {
        mockGraph.entities.set(`npc-${i}`, {
          id: `npc-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }

      tracker.update(mockGraph);
      const outliers = tracker.getOutliers(0.3);

      expect(outliers.overpopulated.length).toBeGreaterThan(0);
      expect(outliers.overpopulated[0].kind).toBe('npc');
      expect(outliers.overpopulated[0].subtype).toBe('hero');
    });

    it('should identify underpopulated entities', () => {
      // Target is 10, add 5 (50% under)
      for (let i = 1; i <= 5; i++) {
        mockGraph.entities.set(`npc-${i}`, {
          id: `npc-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }

      tracker.update(mockGraph);
      const outliers = tracker.getOutliers(0.3);

      expect(outliers.underpopulated.length).toBeGreaterThan(0);
      expect(outliers.underpopulated[0].kind).toBe('npc');
      expect(outliers.underpopulated[0].subtype).toBe('hero');
    });

    it('should respect custom threshold', () => {
      // Add 14 entities (40% over target of 10)
      for (let i = 1; i <= 14; i++) {
        mockGraph.entities.set(`npc-${i}`, {
          id: `npc-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }

      tracker.update(mockGraph);

      // With threshold 0.3, should be outlier
      const outliers30 = tracker.getOutliers(0.3);
      expect(outliers30.overpopulated.length).toBeGreaterThan(0);

      // With threshold 0.5, should NOT be outlier
      const outliers50 = tracker.getOutliers(0.5);
      expect(outliers50.overpopulated.length).toBe(0);
    });

    it('should skip entities with zero target', () => {
      // Add entity with no target
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'unknown', name: 'Unknown', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      tracker.update(mockGraph);
      const outliers = tracker.getOutliers(0.3);

      // Should not appear in outliers
      expect(outliers.overpopulated.find(m => m.subtype === 'unknown')).toBeUndefined();
      expect(outliers.underpopulated.find(m => m.subtype === 'unknown')).toBeUndefined();
    });

    it('should return empty arrays when all entities within threshold', () => {
      // Add exactly target number for each subtype with defined targets
      for (let i = 1; i <= 10; i++) {
        mockGraph.entities.set(`hero-${i}`, {
          id: `hero-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }
      for (let i = 1; i <= 15; i++) {
        mockGraph.entities.set(`merchant-${i}`, {
          id: `merchant-${i}`, kind: 'npc', subtype: 'merchant', name: 'Merchant', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }
      for (let i = 1; i <= 5; i++) {
        mockGraph.entities.set(`villain-${i}`, {
          id: `villain-${i}`, kind: 'npc', subtype: 'villain', name: 'Villain', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }
      // Add locations to meet their targets too
      for (let i = 1; i <= 8; i++) {
        mockGraph.entities.set(`colony-${i}`, {
          id: `colony-${i}`, kind: 'location', subtype: 'colony', name: 'Colony', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }
      for (let i = 1; i <= 4; i++) {
        mockGraph.entities.set(`landmark-${i}`, {
          id: `landmark-${i}`, kind: 'location', subtype: 'landmark', name: 'Landmark', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }

      tracker.update(mockGraph);
      const outliers = tracker.getOutliers(0.3);

      expect(outliers.overpopulated).toEqual([]);
      expect(outliers.underpopulated).toEqual([]);
    });
  });

  describe('getSummary', () => {
    it('should calculate total entities', () => {
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.entities.set('npc-2', {
        id: 'npc-2', kind: 'npc', subtype: 'merchant', name: 'Merchant', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      tracker.update(mockGraph);
      const summary = tracker.getSummary();

      expect(summary.totalEntities).toBe(2);
    });

    it('should calculate total relationships', () => {
      mockGraph.relationships.push(
        { kind: 'allied_with', src: 'npc-1', dst: 'npc-2' },
        { kind: 'enemy_of', src: 'npc-3', dst: 'npc-4' }
      );

      tracker.update(mockGraph);
      const summary = tracker.getSummary();

      expect(summary.totalRelationships).toBe(2);
    });

    it('should calculate average entity deviation', () => {
      // Hero: target 10, add 15 -> deviation 0.5
      for (let i = 1; i <= 15; i++) {
        mockGraph.entities.set(`hero-${i}`, {
          id: `hero-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }
      // Merchant: target 15, add 10 -> deviation -0.333
      for (let i = 1; i <= 10; i++) {
        mockGraph.entities.set(`merchant-${i}`, {
          id: `merchant-${i}`, kind: 'npc', subtype: 'merchant', name: 'Merchant', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }

      tracker.update(mockGraph);
      const summary = tracker.getSummary();

      // Average of |0.5| and |-0.333| = 0.416
      expect(summary.avgEntityDeviation).toBeGreaterThan(0);
      expect(summary.avgEntityDeviation).toBeLessThan(1);
    });

    it('should calculate max entity deviation', () => {
      // Hero: target 10, add 20 -> deviation 1.0
      for (let i = 1; i <= 20; i++) {
        mockGraph.entities.set(`hero-${i}`, {
          id: `hero-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }

      tracker.update(mockGraph);
      const summary = tracker.getSummary();

      expect(summary.maxEntityDeviation).toBeCloseTo(1.0, 2);
    });

    it('should provide pressure deviations', () => {
      mockGraph.pressures.set('conflict', 75);
      mockGraph.pressures.set('stability', 25);

      tracker.update(mockGraph);
      const summary = tracker.getSummary();

      expect(summary.pressureDeviations.has('conflict')).toBe(true);
      expect(summary.pressureDeviations.has('stability')).toBe(true);
    });

    it('should handle empty graph', () => {
      tracker.update(mockGraph);
      const summary = tracker.getSummary();

      expect(summary.totalEntities).toBe(0);
      expect(summary.totalRelationships).toBe(0);
      // Empty graph means all initialized subtypes have negative deviation
      // avgEntityDeviation = (abs(-1) + abs(-1) + abs(-1)) / 3 = 1
      expect(summary.avgEntityDeviation).toBeCloseTo(1.0, 2);
      expect(summary.maxEntityDeviation).toBe(1.0);
    });
  });

  describe('pressure targets', () => {
    it('should have predefined pressure targets', () => {
      mockGraph.pressures.set('resource_scarcity', 30);
      mockGraph.pressures.set('conflict', 40);
      mockGraph.pressures.set('stability', 60);

      tracker.update(mockGraph);
      const metrics = tracker.getMetrics();

      expect(metrics.pressures.get('resource_scarcity')!.target).toBe(30);
      expect(metrics.pressures.get('conflict')!.target).toBe(40);
      expect(metrics.pressures.get('stability')!.target).toBe(60);
    });

    it('should use default target for unknown pressures', () => {
      mockGraph.pressures.set('unknown_pressure', 50);

      tracker.update(mockGraph);
      const metrics = tracker.getMetrics();

      expect(metrics.pressures.get('unknown_pressure')!.target).toBe(50);
    });

    it('should calculate pressure deviations', () => {
      // Conflict target is 40, set to 60
      mockGraph.pressures.set('conflict', 60);

      tracker.update(mockGraph);
      const metrics = tracker.getMetrics();

      // Deviation = (60 - 40) / 40 = 0.5
      expect(metrics.pressures.get('conflict')!.deviation).toBeCloseTo(0.5, 2);
    });
  });

  describe('dynamic subtype discovery', () => {
    it('should track new subtypes discovered at runtime', () => {
      // Add entity with subtype not in initial schema
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'mysterious', name: 'Mysterious', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      expect(metrics.entities.has('npc:mysterious')).toBe(true);
      expect(metrics.entities.get('npc:mysterious')!.count).toBe(1);
    });

    it('should handle dynamic subtypes with no target', () => {
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'mysterious', name: 'Mysterious', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      expect(metrics.entities.get('npc:mysterious')!.target).toBe(0);
      expect(metrics.entities.get('npc:mysterious')!.deviation).toBe(0);
    });
  });

  describe('relationship metrics', () => {
    it('should track multiple relationship types', () => {
      mockGraph.relationships.push(
        { kind: 'allied_with', src: 'npc-1', dst: 'npc-2' },
        { kind: 'enemy_of', src: 'npc-3', dst: 'npc-4' },
        { kind: 'located_in', src: 'npc-5', dst: 'loc-1' }
      );

      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      expect(metrics.relationships.size).toBe(3);
      expect(metrics.relationships.has('allied_with')).toBe(true);
      expect(metrics.relationships.has('enemy_of')).toBe(true);
      expect(metrics.relationships.has('located_in')).toBe(true);
    });

    it('should calculate relationship trends', () => {
      for (let tick = 1; tick <= 5; tick++) {
        mockGraph.tick = tick;
        mockGraph.relationships = [];
        for (let i = 1; i <= tick; i++) {
          mockGraph.relationships.push({ kind: 'allied_with', src: `npc-${i}`, dst: `npc-${i + 1}` });
        }
        tracker.update(mockGraph);
      }

      const metrics = tracker.getMetrics();
      const alliedMetric = metrics.relationships.get('allied_with');

      expect(alliedMetric!.trend).toBeGreaterThan(0);
    });

    it('should handle zero relationship target', () => {
      mockGraph.relationships.push({ kind: 'allied_with', src: 'npc-1', dst: 'npc-2' });

      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      // Default relationship target is 0, so deviation should be 0
      expect(metrics.relationships.get('allied_with')!.target).toBe(0);
      expect(metrics.relationships.get('allied_with')!.deviation).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple updates in same tick', () => {
      mockGraph.tick = 1;
      tracker.update(mockGraph);
      tracker.update(mockGraph);

      const metrics = tracker.getMetrics();
      expect(metrics.tick).toBe(1);
    });

    it('should handle empty distribution targets', () => {
      const emptyTargets: DistributionTargets = { entities: {} } as any;
      const emptyTracker = new PopulationTracker(emptyTargets, mockDomainSchema);

      emptyTracker.update(mockGraph);

      const metrics = emptyTracker.getMetrics();
      expect(metrics.entities.get('npc:hero')!.target).toBe(0);
    });

    it('should handle missing entities object in targets', () => {
      const noEntitiesTargets: DistributionTargets = {} as any;
      const noEntitiesTracker = new PopulationTracker(noEntitiesTargets, mockDomainSchema);

      noEntitiesTracker.update(mockGraph);

      const metrics = noEntitiesTracker.getMetrics();
      expect(metrics.entities.get('npc:hero')!.target).toBe(0);
    });
  });
});
