import { describe, it, expect } from 'vitest';
import {
  calculateEntityKindCounts,
  calculateRatios,
  calculateProminenceDistribution,
  calculateRelationshipDistribution,
  calculateConnectivityMetrics,
  calculateSubtypeDistribution
} from '../../utils/distributionCalculations';
import { Graph } from '../../types/engine';
import { HardState } from '../../types/worldTypes';

describe('distributionCalculations', () => {
  const createEntity = (id: string, kind: string, subtype: string, prominence: string): HardState => ({
    id,
    kind,
    subtype,
    name: `Entity ${id}`,
    description: `Test entity ${id}`,
    status: 'active',
    prominence: prominence as any,
    tags: [],
    links: [],
    createdAt: 0,
    updatedAt: 0
  });

  describe('calculateEntityKindCounts', () => {
    it('should count entities by kind', () => {
      const entities = [
        createEntity('e1', 'npc', 'merchant', 'recognized'),
        createEntity('e2', 'npc', 'hero', 'renowned'),
        createEntity('e3', 'faction', 'guild', 'recognized'),
        createEntity('e4', 'location', 'colony', 'marginal')
      ];

      const counts = calculateEntityKindCounts(entities);

      expect(counts).toEqual({
        npc: 2,
        faction: 1,
        location: 1
      });
    });

    it('should handle empty array', () => {
      const counts = calculateEntityKindCounts([]);
      expect(counts).toEqual({});
    });

    it('should handle single entity', () => {
      const entities = [createEntity('e1', 'npc', 'merchant', 'recognized')];
      const counts = calculateEntityKindCounts(entities);

      expect(counts).toEqual({ npc: 1 });
    });

    it('should handle all entities of same kind', () => {
      const entities = [
        createEntity('e1', 'npc', 'merchant', 'recognized'),
        createEntity('e2', 'npc', 'hero', 'renowned'),
        createEntity('e3', 'npc', 'mayor', 'recognized')
      ];

      const counts = calculateEntityKindCounts(entities);
      expect(counts).toEqual({ npc: 3 });
    });
  });

  describe('calculateRatios', () => {
    it('should calculate ratios from counts', () => {
      const counts = { npc: 2, faction: 1, location: 1 };
      const ratios = calculateRatios(counts, 4);

      expect(ratios).toEqual({
        npc: 0.5,
        faction: 0.25,
        location: 0.25
      });
    });

    it('should handle zero total', () => {
      const counts = { npc: 0, faction: 0 };
      const ratios = calculateRatios(counts, 0);

      expect(ratios).toEqual({
        npc: 0,
        faction: 0
      });
    });

    it('should handle single item', () => {
      const counts = { npc: 5 };
      const ratios = calculateRatios(counts, 5);

      expect(ratios).toEqual({ npc: 1 });
    });

    it('should handle fractional ratios', () => {
      const counts = { a: 1, b: 2, c: 3 };
      const ratios = calculateRatios(counts, 6);

      expect(ratios.a).toBeCloseTo(1 / 6);
      expect(ratios.b).toBeCloseTo(2 / 6);
      expect(ratios.c).toBeCloseTo(3 / 6);
    });

    it('should sum to 1.0', () => {
      const counts = { a: 1, b: 2, c: 3 };
      const ratios = calculateRatios(counts, 6);

      const sum = Object.values(ratios).reduce((s, r) => s + r, 0);
      expect(sum).toBeCloseTo(1.0);
    });
  });

  describe('calculateProminenceDistribution', () => {
    it('should calculate prominence distribution', () => {
      const entities = [
        createEntity('e1', 'npc', 'merchant', 'forgotten'),
        createEntity('e2', 'npc', 'hero', 'marginal'),
        createEntity('e3', 'npc', 'mayor', 'recognized'),
        createEntity('e4', 'faction', 'guild', 'renowned'),
        createEntity('e5', 'location', 'colony', 'mythic'),
        createEntity('e6', 'npc', 'outlaw', 'recognized')
      ];

      const distribution = calculateProminenceDistribution(entities);

      expect(distribution.counts).toEqual({
        forgotten: 1,
        marginal: 1,
        recognized: 2,
        renowned: 1,
        mythic: 1
      });

      expect(distribution.ratios.recognized).toBeCloseTo(2 / 6);
      expect(distribution.ratios.forgotten).toBeCloseTo(1 / 6);
    });

    it('should handle empty array', () => {
      const distribution = calculateProminenceDistribution([]);

      expect(distribution.counts).toEqual({
        forgotten: 0,
        marginal: 0,
        recognized: 0,
        renowned: 0,
        mythic: 0
      });

      expect(Object.values(distribution.ratios).every(r => r === 0)).toBe(true);
    });

    it('should handle all same prominence', () => {
      const entities = [
        createEntity('e1', 'npc', 'merchant', 'recognized'),
        createEntity('e2', 'npc', 'hero', 'recognized'),
        createEntity('e3', 'faction', 'guild', 'recognized')
      ];

      const distribution = calculateProminenceDistribution(entities);

      expect(distribution.counts.recognized).toBe(3);
      expect(distribution.ratios.recognized).toBe(1);
      expect(distribution.ratios.mythic).toBe(0);
    });
  });

  describe('calculateRelationshipDistribution', () => {
    it('should calculate relationship distribution and diversity', () => {
      const mockGraph: Graph = {
        entities: new Map(),
        relationships: [
          { kind: 'allied_with', src: 'e1', dst: 'e2' },
          { kind: 'allied_with', src: 'e2', dst: 'e3' },
          { kind: 'member_of', src: 'e1', dst: 'e3' },
          { kind: 'located_at', src: 'e1', dst: 'e4' },
          { kind: 'located_at', src: 'e2', dst: 'e4' }
        ],
        tick: 0,
        currentEra: {} as any,
        pressures: new Map(),
        history: [],
        config: {} as any,
        relationshipCooldowns: new Map(),
        loreRecords: [],
        discoveryState: {
          currentThreshold: 1,
          lastDiscoveryTick: 0,
          discoveriesThisEpoch: 0
        },
        growthMetrics: {
          relationshipsPerTick: [],
          averageGrowthRate: 0
        }
      };

      const distribution = calculateRelationshipDistribution(mockGraph);

      expect(distribution.counts).toEqual({
        allied_with: 2,
        member_of: 1,
        located_at: 2
      });

      expect(distribution.ratios.allied_with).toBeCloseTo(2 / 5);
      expect(distribution.ratios.member_of).toBeCloseTo(1 / 5);

      // Shannon entropy should be > 0 for diverse distribution
      expect(distribution.diversity).toBeGreaterThan(0);
    });

    it('should handle empty graph', () => {
      const mockGraph: Graph = {
        entities: new Map(),
        relationships: [],
        tick: 0,
        currentEra: {} as any,
        pressures: new Map(),
        history: [],
        config: {} as any,
        relationshipCooldowns: new Map(),
        loreRecords: [],
        discoveryState: {
          currentThreshold: 1,
          lastDiscoveryTick: 0,
          discoveriesThisEpoch: 0
        },
        growthMetrics: {
          relationshipsPerTick: [],
          averageGrowthRate: 0
        }
      };

      const distribution = calculateRelationshipDistribution(mockGraph);

      expect(distribution.counts).toEqual({});
      expect(distribution.ratios).toEqual({});
      expect(distribution.diversity).toBe(0);
    });

    it('should calculate max diversity for uniform distribution', () => {
      const mockGraph: Graph = {
        entities: new Map(),
        relationships: [
          { kind: 'type1', src: 'e1', dst: 'e2' },
          { kind: 'type2', src: 'e2', dst: 'e3' },
          { kind: 'type3', src: 'e3', dst: 'e4' },
          { kind: 'type4', src: 'e4', dst: 'e1' }
        ],
        tick: 0,
        currentEra: {} as any,
        pressures: new Map(),
        history: [],
        config: {} as any,
        relationshipCooldowns: new Map(),
        loreRecords: [],
        discoveryState: {
          currentThreshold: 1,
          lastDiscoveryTick: 0,
          discoveriesThisEpoch: 0
        },
        growthMetrics: {
          relationshipsPerTick: [],
          averageGrowthRate: 0
        }
      };

      const distribution = calculateRelationshipDistribution(mockGraph);

      // Max diversity for 4 equal categories = log2(4) = 2
      expect(distribution.diversity).toBeCloseTo(2, 1);
    });

    it('should have zero diversity for single relationship type', () => {
      const mockGraph: Graph = {
        entities: new Map(),
        relationships: [
          { kind: 'same_type', src: 'e1', dst: 'e2' },
          { kind: 'same_type', src: 'e2', dst: 'e3' },
          { kind: 'same_type', src: 'e3', dst: 'e4' }
        ],
        tick: 0,
        currentEra: {} as any,
        pressures: new Map(),
        history: [],
        config: {} as any,
        relationshipCooldowns: new Map(),
        loreRecords: [],
        discoveryState: {
          currentThreshold: 1,
          lastDiscoveryTick: 0,
          discoveriesThisEpoch: 0
        },
        growthMetrics: {
          relationshipsPerTick: [],
          averageGrowthRate: 0
        }
      };

      const distribution = calculateRelationshipDistribution(mockGraph);

      expect(distribution.diversity).toBe(0);
    });
  });

  describe('calculateConnectivityMetrics', () => {
    it('should calculate connectivity metrics', () => {
      const mockGraph: Graph = {
        entities: new Map([
          ['e1', createEntity('e1', 'npc', 'merchant', 'recognized')],
          ['e2', createEntity('e2', 'npc', 'hero', 'renowned')],
          ['e3', createEntity('e3', 'faction', 'guild', 'recognized')],
          ['e4', createEntity('e4', 'location', 'colony', 'marginal')],
          ['e5', createEntity('e5', 'npc', 'outlaw', 'marginal')] // isolated
        ]),
        relationships: [
          { kind: 'allied_with', src: 'e1', dst: 'e2' },
          { kind: 'member_of', src: 'e1', dst: 'e3' },
          { kind: 'located_at', src: 'e1', dst: 'e4' },
          { kind: 'allied_with', src: 'e2', dst: 'e3' }
        ],
        tick: 0,
        currentEra: {} as any,
        pressures: new Map(),
        history: [],
        config: {} as any,
        relationshipCooldowns: new Map(),
        loreRecords: [],
        discoveryState: {
          currentThreshold: 1,
          lastDiscoveryTick: 0,
          discoveriesThisEpoch: 0
        },
        growthMetrics: {
          relationshipsPerTick: [],
          averageGrowthRate: 0
        }
      };

      const metrics = calculateConnectivityMetrics(mockGraph);

      expect(metrics.isolatedNodes).toBe(1); // e5 has no relationships
      expect(metrics.avgConnections).toBeGreaterThan(0);
      expect(metrics.maxConnections).toBe(3); // e1 has 3 relationships
      expect(metrics.minConnections).toBe(1); // e4 has 1 relationship
    });

    it('should handle fully connected graph', () => {
      const mockGraph: Graph = {
        entities: new Map([
          ['e1', createEntity('e1', 'npc', 'merchant', 'recognized')],
          ['e2', createEntity('e2', 'npc', 'hero', 'renowned')],
          ['e3', createEntity('e3', 'faction', 'guild', 'recognized')]
        ]),
        relationships: [
          { kind: 'allied_with', src: 'e1', dst: 'e2' },
          { kind: 'allied_with', src: 'e1', dst: 'e3' },
          { kind: 'allied_with', src: 'e2', dst: 'e3' }
        ],
        tick: 0,
        currentEra: {} as any,
        pressures: new Map(),
        history: [],
        config: {} as any,
        relationshipCooldowns: new Map(),
        loreRecords: [],
        discoveryState: {
          currentThreshold: 1,
          lastDiscoveryTick: 0,
          discoveriesThisEpoch: 0
        },
        growthMetrics: {
          relationshipsPerTick: [],
          averageGrowthRate: 0
        }
      };

      const metrics = calculateConnectivityMetrics(mockGraph);

      expect(metrics.isolatedNodes).toBe(0);
      expect(metrics.avgConnections).toBe(2); // Each node has 2 connections
      expect(metrics.maxConnections).toBe(2);
      expect(metrics.minConnections).toBe(2);
    });

    it('should handle graph with all isolated nodes', () => {
      const mockGraph: Graph = {
        entities: new Map([
          ['e1', createEntity('e1', 'npc', 'merchant', 'recognized')],
          ['e2', createEntity('e2', 'npc', 'hero', 'renowned')],
          ['e3', createEntity('e3', 'faction', 'guild', 'recognized')]
        ]),
        relationships: [],
        tick: 0,
        currentEra: {} as any,
        pressures: new Map(),
        history: [],
        config: {} as any,
        relationshipCooldowns: new Map(),
        loreRecords: [],
        discoveryState: {
          currentThreshold: 1,
          lastDiscoveryTick: 0,
          discoveriesThisEpoch: 0
        },
        growthMetrics: {
          relationshipsPerTick: [],
          averageGrowthRate: 0
        }
      };

      const metrics = calculateConnectivityMetrics(mockGraph);

      expect(metrics.isolatedNodes).toBe(3);
      expect(metrics.avgConnections).toBe(0);
      expect(metrics.maxConnections).toBe(0);
      expect(metrics.minConnections).toBe(0);
    });

    it('should handle empty graph', () => {
      const mockGraph: Graph = {
        entities: new Map(),
        relationships: [],
        tick: 0,
        currentEra: {} as any,
        pressures: new Map(),
        history: [],
        config: {} as any,
        relationshipCooldowns: new Map(),
        loreRecords: [],
        discoveryState: {
          currentThreshold: 1,
          lastDiscoveryTick: 0,
          discoveriesThisEpoch: 0
        },
        growthMetrics: {
          relationshipsPerTick: [],
          averageGrowthRate: 0
        }
      };

      const metrics = calculateConnectivityMetrics(mockGraph);

      expect(metrics.isolatedNodes).toBe(0);
      expect(metrics.avgConnections).toBe(0);
      expect(metrics.maxConnections).toBe(0);
      expect(metrics.minConnections).toBe(0);
    });
  });

  describe('calculateSubtypeDistribution', () => {
    it('should calculate subtype distribution', () => {
      const entities = [
        createEntity('e1', 'npc', 'merchant', 'recognized'),
        createEntity('e2', 'npc', 'merchant', 'marginal'),
        createEntity('e3', 'npc', 'hero', 'renowned'),
        createEntity('e4', 'faction', 'guild', 'recognized'),
        createEntity('e5', 'faction', 'criminal', 'marginal')
      ];

      const distribution = calculateSubtypeDistribution(entities);

      expect(distribution.counts).toEqual({
        'npc:merchant': 2,
        'npc:hero': 1,
        'faction:guild': 1,
        'faction:criminal': 1
      });

      expect(distribution.ratios['npc:merchant']).toBeCloseTo(2 / 5);
      expect(distribution.ratios['npc:hero']).toBeCloseTo(1 / 5);
    });

    it('should handle empty array', () => {
      const distribution = calculateSubtypeDistribution([]);

      expect(distribution.counts).toEqual({});
      expect(distribution.ratios).toEqual({});
    });

    it('should handle single subtype', () => {
      const entities = [
        createEntity('e1', 'npc', 'merchant', 'recognized'),
        createEntity('e2', 'npc', 'merchant', 'marginal'),
        createEntity('e3', 'npc', 'merchant', 'renowned')
      ];

      const distribution = calculateSubtypeDistribution(entities);

      expect(distribution.counts).toEqual({
        'npc:merchant': 3
      });

      expect(distribution.ratios['npc:merchant']).toBe(1);
    });

    it('should format subtype key correctly', () => {
      const entities = [
        createEntity('e1', 'location', 'colony', 'recognized')
      ];

      const distribution = calculateSubtypeDistribution(entities);

      expect(distribution.counts).toHaveProperty('location:colony');
      expect(distribution.counts['location:colony']).toBe(1);
    });
  });

  describe('Integration: Multiple calculations', () => {
    it('should produce consistent results across multiple calculations', () => {
      const entities = [
        createEntity('e1', 'npc', 'merchant', 'forgotten'),
        createEntity('e2', 'npc', 'hero', 'renowned'),
        createEntity('e3', 'faction', 'guild', 'recognized')
      ];

      const kindCounts = calculateEntityKindCounts(entities);
      const subtypeDist = calculateSubtypeDistribution(entities);
      const prominenceDist = calculateProminenceDistribution(entities);

      // Total entities should be consistent
      const totalFromKinds = Object.values(kindCounts).reduce((s, c) => s + c, 0);
      const totalFromSubtypes = Object.values(subtypeDist.counts).reduce((s, c) => s + c, 0);
      const totalFromProminence = Object.values(prominenceDist.counts).reduce((s, c) => s + c, 0);

      expect(totalFromKinds).toBe(entities.length);
      expect(totalFromSubtypes).toBe(entities.length);
      expect(totalFromProminence).toBe(entities.length);
    });
  });
});
