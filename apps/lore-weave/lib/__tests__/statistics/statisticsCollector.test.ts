// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { StatisticsCollector } from '../../statistics/statisticsCollector';
import { Graph, EngineConfig } from '../../engine/types';
import { HardState, Relationship } from '../../core/worldTypes';
import { EnrichmentStats, ValidationStats } from '../../statistics/types';

describe('StatisticsCollector', () => {
  let collector: StatisticsCollector;
  let mockGraph: Graph;
  let mockConfig: EngineConfig;

  beforeEach(() => {
    collector = new StatisticsCollector();

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
      growthMetrics: {
        currentGrowthRate: 1.0,
        averageGrowthRate: 1.0,
        maxGrowthRate: 1.5,
        minGrowthRate: 0.5,
        relationshipHistory: [10, 20, 30],
        budgetPressure: 0,
        lastWindowSize: 10,
        ratesByKind: {}
      },
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

      // Keep backward compatibility for tests
      get entities() { return _entities; },
      get relationships() { return _relationships; }
    } as Graph;

    mockConfig = {
      epochLength: 20,
      simulationTicksPerGrowth: 10,
      targetEntitiesPerKind: 30,
      maxTicks: 500,
      relationshipBudget: 5000,
      eras: [],
      templates: [],
      systems: [],
      pressures: []
    } as EngineConfig;
  });

  describe('recordEpoch', () => {
    it('should record basic epoch statistics', () => {
      // Create test entities
      const entity1: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'hero',
        name: 'Hero 1',
        description: 'Test hero',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.setEntity('npc-1', entity1);
      mockGraph.relationships.push({
        kind: 'allied_with',
        src: 'npc-1',
        dst: 'npc-2'
      });
      mockGraph.tick = 10;

      collector.recordEpoch(mockGraph, 1, 5, 10, 15);

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.epochStats).toHaveLength(1);
      expect(stats.epochStats[0].epoch).toBe(1);
      expect(stats.epochStats[0].tick).toBe(10);
      expect(stats.epochStats[0].era).toBe('Test Era');
      expect(stats.epochStats[0].entitiesCreated).toBe(5);
      expect(stats.epochStats[0].relationshipsCreated).toBe(10);
      expect(stats.epochStats[0].growthTarget).toBe(15);
    });

    it('should count entities by kind', () => {
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.setEntity('npc-2', {
        id: 'npc-2', kind: 'npc', subtype: 'merchant', name: 'Merchant', description: '',
        status: 'active', prominence: 'marginal', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.setEntity('loc-1', {
        id: 'loc-1', kind: 'location', subtype: 'colony', name: 'Colony', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      collector.recordEpoch(mockGraph, 1, 3, 0, 5);

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.epochStats[0].entitiesByKind['npc']).toBe(2);
      expect(stats.epochStats[0].entitiesByKind['location']).toBe(1);
    });

    it('should count entities by subtype', () => {
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero 1', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.setEntity('npc-2', {
        id: 'npc-2', kind: 'npc', subtype: 'hero', name: 'Hero 2', description: '',
        status: 'active', prominence: 'marginal', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      collector.recordEpoch(mockGraph, 1, 2, 0, 5);

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.epochStats[0].entitiesBySubtype['npc:hero']).toBe(2);
    });

    it('should count relationships by type', () => {
      mockGraph.relationships.push(
        { kind: 'allied_with', src: 'npc-1', dst: 'npc-2' },
        { kind: 'allied_with', src: 'npc-2', dst: 'npc-3' },
        { kind: 'enemy_of', src: 'npc-1', dst: 'npc-4' }
      );

      collector.recordEpoch(mockGraph, 1, 0, 3, 5);

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.epochStats[0].relationshipsByType['allied_with']).toBe(2);
      expect(stats.epochStats[0].relationshipsByType['enemy_of']).toBe(1);
    });

    it('should track pressures', () => {
      mockGraph.pressures.set('conflict', 75);
      mockGraph.pressures.set('stability', 25);

      collector.recordEpoch(mockGraph, 1, 0, 0, 5);

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.epochStats[0].pressures['conflict']).toBe(75);
      expect(stats.epochStats[0].pressures['stability']).toBe(25);
    });

    it('should track relationship growth rate', () => {
      mockGraph.growthMetrics.averageGrowthRate = 1.5;

      collector.recordEpoch(mockGraph, 1, 0, 10, 5);

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.epochStats[0].relationshipGrowthRate).toBe(1.5);
    });

    it('should track eras visited', () => {
      collector.recordEpoch(mockGraph, 1, 0, 0, 5);

      mockGraph.currentEra.id = 'test-era-2';
      collector.recordEpoch(mockGraph, 2, 0, 0, 5);

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.temporalStats.erasVisited).toContain('test-era');
      expect(stats.temporalStats.erasVisited).toContain('test-era-2');
    });

    it('should count ticks per era', () => {
      collector.recordEpoch(mockGraph, 1, 0, 0, 5);
      collector.recordEpoch(mockGraph, 2, 0, 0, 5);
      collector.recordEpoch(mockGraph, 3, 0, 0, 5);

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.temporalStats.ticksPerEra['test-era']).toBe(3);
    });

    it('should store subtype metrics in graph', () => {
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      collector.recordEpoch(mockGraph, 1, 1, 0, 5);

      expect(mockGraph.subtypeMetrics).toBeDefined();
      expect(mockGraph.subtypeMetrics!.get('npc:hero')).toBe(1);
    });

    it('should handle multiple epochs', () => {
      collector.recordEpoch(mockGraph, 1, 5, 10, 15);
      collector.recordEpoch(mockGraph, 2, 3, 8, 10);
      collector.recordEpoch(mockGraph, 3, 7, 12, 20);

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.epochStats).toHaveLength(3);
      expect(stats.totalEpochs).toBe(3);
    });
  });

  describe('recordTemplateApplication', () => {
    it('should record template applications', () => {
      collector.recordTemplateApplication('template-1');
      collector.recordTemplateApplication('template-1');
      collector.recordTemplateApplication('template-2');

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.performanceStats.templatesApplied['template-1']).toBe(2);
      expect(stats.performanceStats.templatesApplied['template-2']).toBe(1);
    });

    it('should calculate total template applications', () => {
      collector.recordTemplateApplication('template-1');
      collector.recordTemplateApplication('template-2');
      collector.recordTemplateApplication('template-3');

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.performanceStats.totalTemplateApplications).toBe(3);
    });
  });

  describe('recordSystemExecution', () => {
    it('should record system executions', () => {
      collector.recordSystemExecution('system-1');
      collector.recordSystemExecution('system-1');
      collector.recordSystemExecution('system-2');

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.performanceStats.systemsExecuted['system-1']).toBe(2);
      expect(stats.performanceStats.systemsExecuted['system-2']).toBe(1);
    });

    it('should calculate total system executions', () => {
      collector.recordSystemExecution('system-1');
      collector.recordSystemExecution('system-2');
      collector.recordSystemExecution('system-3');

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.performanceStats.totalSystemExecutions).toBe(3);
    });
  });

  describe('recordWarning', () => {
    it('should record budget warnings', () => {
      collector.recordWarning('budget');
      collector.recordWarning('budget');

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.performanceStats.warnings).toBe(2);
      expect(stats.performanceStats.relationshipBudgetHits).toBe(2);
    });

    it('should record aggressive system warnings', () => {
      collector.recordWarning('aggressive', 'system-1');
      collector.recordWarning('aggressive', 'system-1');
      collector.recordWarning('aggressive', 'system-2');

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.performanceStats.warnings).toBe(3);
      expect(stats.performanceStats.aggressiveSystemWarnings['system-1']).toBe(2);
      expect(stats.performanceStats.aggressiveSystemWarnings['system-2']).toBe(1);
    });

    it('should record growth warnings', () => {
      collector.recordWarning('growth');

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.performanceStats.warnings).toBe(1);
    });

    it('should handle warnings without system ID', () => {
      collector.recordWarning('aggressive');

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.performanceStats.warnings).toBe(1);
    });
  });

  describe('generateStatistics - distribution stats', () => {
    it('should calculate entity kind ratios', () => {
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.setEntity('npc-2', {
        id: 'npc-2', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.setEntity('loc-1', {
        id: 'loc-1', kind: 'location', subtype: 'colony', name: 'Colony', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.distributionStats.entityKindRatios['npc']).toBeCloseTo(0.666, 2);
      expect(stats.distributionStats.entityKindRatios['location']).toBeCloseTo(0.333, 2);
    });

    it('should calculate prominence ratios', () => {
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.setEntity('npc-2', {
        id: 'npc-2', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'mythic', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.distributionStats.prominenceRatios['recognized']).toBe(0.5);
      expect(stats.distributionStats.prominenceRatios['mythic']).toBe(0.5);
      expect(stats.distributionStats.prominenceRatios['forgotten']).toBe(0);
    });

    it('should calculate relationship type ratios', () => {
      mockGraph.relationships.push(
        { kind: 'allied_with', src: 'npc-1', dst: 'npc-2' },
        { kind: 'allied_with', src: 'npc-2', dst: 'npc-3' },
        { kind: 'enemy_of', src: 'npc-1', dst: 'npc-4' }
      );

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.distributionStats.relationshipTypeRatios['allied_with']).toBeCloseTo(0.666, 2);
      expect(stats.distributionStats.relationshipTypeRatios['enemy_of']).toBeCloseTo(0.333, 2);
    });

    it('should calculate relationship diversity (Shannon entropy)', () => {
      mockGraph.relationships.push(
        { kind: 'allied_with', src: 'npc-1', dst: 'npc-2' },
        { kind: 'enemy_of', src: 'npc-3', dst: 'npc-4' }
      );

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      // With 50/50 split, Shannon entropy should be 1.0 (maximum for 2 types)
      expect(stats.distributionStats.relationshipDiversity).toBeCloseTo(1.0, 2);
    });

    it('should calculate isolated nodes', () => {
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.setEntity('npc-2', {
        id: 'npc-2', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.setEntity('npc-3', {
        id: 'npc-3', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      mockGraph.relationships.push({ kind: 'allied_with', src: 'npc-1', dst: 'npc-2' });

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.distributionStats.graphMetrics.isolatedNodes).toBe(1); // npc-3
      expect(stats.distributionStats.graphMetrics.isolatedNodeRatio).toBeCloseTo(0.333, 2);
    });

    it('should calculate clusters', () => {
      // Create two separate clusters
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.setEntity('npc-2', {
        id: 'npc-2', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.setEntity('npc-3', {
        id: 'npc-3', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.setEntity('npc-4', {
        id: 'npc-4', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      mockGraph.relationships.push(
        { kind: 'allied_with', src: 'npc-1', dst: 'npc-2' },
        { kind: 'allied_with', src: 'npc-3', dst: 'npc-4' }
      );

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.distributionStats.graphMetrics.clusters).toBe(2);
      expect(stats.distributionStats.graphMetrics.avgClusterSize).toBe(2);
    });

    it('should calculate average degree', () => {
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.setEntity('npc-2', {
        id: 'npc-2', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      mockGraph.relationships.push({ kind: 'allied_with', src: 'npc-1', dst: 'npc-2' });

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      // Average degree = (2 * edges) / nodes = (2 * 1) / 2 = 1
      expect(stats.distributionStats.graphMetrics.avgDegree).toBe(1);
    });

    it('should handle empty graph', () => {
      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.distributionStats.entityKindRatios).toEqual({});
      expect(stats.distributionStats.graphMetrics.clusters).toBe(0);
      expect(stats.distributionStats.graphMetrics.avgClusterSize).toBe(0);
    });
  });

  describe('generateStatistics - fitness metrics', () => {
    it('should calculate basic fitness metrics without distribution targets', () => {
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.fitnessMetrics).toBeDefined();
      expect(stats.fitnessMetrics.entityDistributionFitness).toBeGreaterThanOrEqual(0);
      expect(stats.fitnessMetrics.entityDistributionFitness).toBeLessThanOrEqual(1);
      expect(stats.fitnessMetrics.overallFitness).toBeGreaterThanOrEqual(0);
      expect(stats.fitnessMetrics.overallFitness).toBeLessThanOrEqual(1);
    });

    it('should calculate fitness with distribution targets', () => {
      mockConfig.distributionTargets = {
        global: {
          entityKindDistribution: {
            targets: { npc: 0.5, location: 0.5 }
          },
          prominenceDistribution: {
            targets: { forgotten: 0.2, marginal: 0.3, recognized: 0.3, renowned: 0.15, mythic: 0.05 }
          },
          graphConnectivity: {
            targetClusters: { min: 1, preferred: 3, max: 10 },
            isolatedNodeRatio: { max: 0.5 } // High threshold to avoid violations with small graphs
          }
        }
      } as any;

      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.setEntity('loc-1', {
        id: 'loc-1', kind: 'location', subtype: 'colony', name: 'Colony', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      // Add relationship to avoid isolated nodes
      mockGraph.relationships.push({ kind: 'located_in', src: 'npc-1', dst: 'loc-1' });

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.fitnessMetrics.entityDistributionFitness).toBeGreaterThan(0.9); // Should be close to perfect
      expect(stats.fitnessMetrics.constraintViolations).toBe(0);
    });

    it('should detect constraint violations for isolated nodes', () => {
      mockConfig.distributionTargets = {
        global: {
          entityKindDistribution: { targets: {} },
          prominenceDistribution: { targets: {} },
          graphConnectivity: {
            targetClusters: { min: 1, preferred: 3, max: 10 },
            isolatedNodeRatio: { max: 0.1 }
          }
        }
      } as any;

      // Create many isolated nodes
      for (let i = 1; i <= 10; i++) {
        mockGraph.setEntity(`npc-${i}`, {
          id: `npc-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.fitnessMetrics.constraintViolations).toBeGreaterThan(0);
    });

    it('should detect constraint violations for entity kind deviation', () => {
      mockConfig.distributionTargets = {
        global: {
          entityKindDistribution: {
            targets: { npc: 0.5, location: 0.5 }
          },
          prominenceDistribution: { targets: {} },
          graphConnectivity: {
            targetClusters: { min: 1, preferred: 3, max: 10 },
            isolatedNodeRatio: { max: 0.1 }
          }
        }
      } as any;

      // Create 9 NPCs and 1 location (90% vs target 50%)
      for (let i = 1; i <= 9; i++) {
        mockGraph.setEntity(`npc-${i}`, {
          id: `npc-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }
      mockGraph.setEntity('loc-1', {
        id: 'loc-1', kind: 'location', subtype: 'colony', name: 'Colony', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.fitnessMetrics.constraintViolations).toBeGreaterThan(0);
    });

    it('should calculate convergence rate', () => {
      mockConfig.distributionTargets = {
        global: {
          entityKindDistribution: {
            targets: { npc: 1.0 }
          },
          prominenceDistribution: {
            targets: { recognized: 1.0 }
          },
          graphConnectivity: {
            targetClusters: { min: 1, preferred: 1, max: 10 },
            isolatedNodeRatio: { max: 0.1 }
          }
        }
      } as any;

      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      collector.recordEpoch(mockGraph, 1, 1, 0, 5);

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.fitnessMetrics.convergenceRate).toBeGreaterThan(0);
    });

    it('should calculate stability score', () => {
      mockGraph.growthMetrics.averageGrowthRate = 1.0;

      // Record multiple epochs with stable growth
      for (let i = 1; i <= 6; i++) {
        collector.recordEpoch(mockGraph, i, 5, 10, 15);
      }

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.fitnessMetrics.stabilityScore).toBeGreaterThan(0);
      expect(stats.fitnessMetrics.stabilityScore).toBeLessThanOrEqual(1);
    });

    it('should handle zero mean in stability calculation', () => {
      mockGraph.growthMetrics.averageGrowthRate = 0;

      for (let i = 1; i <= 6; i++) {
        collector.recordEpoch(mockGraph, i, 0, 0, 0);
      }

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.fitnessMetrics.stabilityScore).toBe(1.0);
    });
  });

  describe('generateStatistics - protected relationship violations', () => {
    it('should track protected relationship violations', () => {
      mockGraph.protectedRelationshipViolations = [
        {
          tick: 10,
          violations: [
            { kind: 'allied_with', src: 'npc-1', dst: 'npc-2', strength: 5 },
            { kind: 'enemy_of', src: 'npc-3', dst: 'npc-4', strength: 3 }
          ]
        }
      ];
      mockGraph.tick = 20;

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.performanceStats.protectedRelationshipViolations.totalViolations).toBe(2);
      expect(stats.performanceStats.protectedRelationshipViolations.violationsByKind['allied_with']).toBe(1);
      expect(stats.performanceStats.protectedRelationshipViolations.violationsByKind['enemy_of']).toBe(1);
      expect(stats.performanceStats.protectedRelationshipViolations.violationRate).toBe(0.1); // 2/20
      expect(stats.performanceStats.protectedRelationshipViolations.avgStrength).toBe(4); // (5+3)/2
    });

    it('should handle no violations', () => {
      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.performanceStats.protectedRelationshipViolations.totalViolations).toBe(0);
      expect(stats.performanceStats.protectedRelationshipViolations.violationRate).toBe(0);
      expect(stats.performanceStats.protectedRelationshipViolations.avgStrength).toBe(0);
    });
  });

  describe('generateStatistics - temporal stats', () => {
    it('should calculate temporal statistics', () => {
      mockGraph.tick = 100;
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.relationships.push({ kind: 'allied_with', src: 'npc-1', dst: 'npc-2' });

      collector.recordEpoch(mockGraph, 1, 1, 1, 5);
      collector.recordEpoch(mockGraph, 2, 1, 1, 5);

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.temporalStats.totalTicks).toBe(100);
      expect(stats.temporalStats.totalEpochs).toBe(2);
      expect(stats.temporalStats.ticksPerEpoch).toBe(20);
      expect(stats.temporalStats.entitiesPerTick).toBe(0.01); // 1/100
      expect(stats.temporalStats.relationshipsPerTick).toBe(0.01); // 1/100
      expect(stats.temporalStats.entitiesPerEpoch).toBe(0.5); // 1/2
      expect(stats.temporalStats.relationshipsPerEpoch).toBe(0.5); // 1/2
    });
  });

  describe('generateStatistics - performance stats', () => {
    it('should calculate max relationship growth rate', () => {
      mockGraph.growthMetrics.averageGrowthRate = 1.0;
      collector.recordEpoch(mockGraph, 1, 0, 10, 5);

      mockGraph.growthMetrics.averageGrowthRate = 2.5;
      collector.recordEpoch(mockGraph, 2, 0, 20, 5);

      mockGraph.growthMetrics.averageGrowthRate = 1.5;
      collector.recordEpoch(mockGraph, 3, 0, 15, 5);

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.performanceStats.maxRelationshipGrowthRate).toBe(2.5);
      expect(stats.performanceStats.relationshipGrowthHistory).toEqual([1.0, 2.5, 1.5]);
    });

    it('should handle no growth history', () => {
      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.performanceStats.maxRelationshipGrowthRate).toBe(0);
    });
  });

  describe('generateStatistics - config snapshot', () => {
    it('should capture config snapshot', () => {
      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.configSnapshot.epochLength).toBe(20);
      expect(stats.configSnapshot.simulationTicksPerGrowth).toBe(10);
      expect(stats.configSnapshot.targetEntitiesPerKind).toBe(30);
      expect(stats.configSnapshot.maxTicks).toBe(500);
      expect(stats.configSnapshot.relationshipBudget).toBe(5000);
      expect(stats.configSnapshot.distributionTargetsEnabled).toBe(false);
    });

    it('should detect distribution targets enabled', () => {
      mockConfig.distributionTargets = {
        global: {
          entityKindDistribution: { targets: {} },
          prominenceDistribution: { targets: {} },
          graphConnectivity: {
            targetClusters: { min: 1, preferred: 3, max: 10 },
            isolatedNodeRatio: { max: 0.1 }
          }
        }
      } as any;

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.configSnapshot.distributionTargetsEnabled).toBe(true);
    });
  });

  describe('generateStatistics - metadata', () => {
    it('should include generation metadata', () => {
      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.generatedAt).toBeDefined();
      expect(new Date(stats.generatedAt)).toBeInstanceOf(Date);
      expect(stats.generationTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include final counts', () => {
      mockGraph.tick = 100;
      mockGraph.setEntity('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.relationships.push({ kind: 'allied_with', src: 'npc-1', dst: 'npc-2' });
      mockGraph.history.push({
        tick: 50,
        era: 'Test',
        description: 'Event'
      });

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        {} as EnrichmentStats,
        {} as ValidationStats
      );

      expect(stats.totalTicks).toBe(100);
      expect(stats.finalEntityCount).toBe(1);
      expect(stats.finalRelationshipCount).toBe(1);
      expect(stats.finalHistoryEventCount).toBe(1);
    });

    it('should include enrichment and validation stats', () => {
      const enrichment: EnrichmentStats = {
        namesEnriched: 10,
        descriptionsEnriched: 5,
        totalEnrichments: 15
      } as any;

      const validation: ValidationStats = {
        totalErrors: 2,
        totalWarnings: 3
      } as any;

      const stats = collector.generateStatistics(
        mockGraph,
        mockConfig,
        enrichment,
        validation
      );

      expect(stats.enrichmentStats).toEqual(enrichment);
      expect(stats.validationStats).toEqual(validation);
    });
  });
});
