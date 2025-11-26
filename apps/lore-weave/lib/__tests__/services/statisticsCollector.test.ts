// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { StatisticsCollector } from '../../services/statisticsCollector';
import { Graph, EngineConfig } from '../../types/engine';
import { HardState } from '../../types/worldTypes';
import { EnrichmentStats, ValidationStats } from '../../types/statistics';

describe('StatisticsCollector', () => {
  let collector: StatisticsCollector;
  let mockGraph: Graph;
  let mockConfig: EngineConfig;

  beforeEach(() => {
    collector = new StatisticsCollector();

    mockGraph = {
      entities: new Map<string, HardState>(),
      relationships: [],
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
      }
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

      mockGraph.entities.set('npc-1', entity1);
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
      mockGraph.entities.set('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.entities.set('npc-2', {
        id: 'npc-2', kind: 'npc', subtype: 'merchant', name: 'Merchant', description: '',
        status: 'active', prominence: 'marginal', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.entities.set('loc-1', {
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
      mockGraph.entities.set('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero 1', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.entities.set('npc-2', {
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
      mockGraph.entities.set('npc-1', {
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
      mockGraph.entities.set('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.entities.set('npc-2', {
        id: 'npc-2', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.entities.set('loc-1', {
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
      mockGraph.entities.set('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.entities.set('npc-2', {
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
      mockGraph.entities.set('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.entities.set('npc-2', {
        id: 'npc-2', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.entities.set('npc-3', {
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
      mockGraph.entities.set('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.entities.set('npc-2', {
        id: 'npc-2', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.entities.set('npc-3', {
        id: 'npc-3', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.entities.set('npc-4', {
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
      mockGraph.entities.set('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.entities.set('npc-2', {
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
      mockGraph.entities.set('npc-1', {
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

      mockGraph.entities.set('npc-1', {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });
      mockGraph.entities.set('loc-1', {
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
        mockGraph.entities.set(`npc-${i}`, {
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
        mockGraph.entities.set(`npc-${i}`, {
          id: `npc-${i}`, kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
        });
      }
      mockGraph.entities.set('loc-1', {
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

      mockGraph.entities.set('npc-1', {
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
      mockGraph.entities.set('npc-1', {
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
      mockGraph.entities.set('npc-1', {
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
