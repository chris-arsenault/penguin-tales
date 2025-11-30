import { describe, it, expect } from 'vitest';
import {
  calculateEntityKindCounts,
  calculateRatios,
  calculateProminenceDistribution,
  calculateRelationshipDistribution,
  calculateConnectivityMetrics,
  calculateSubtypeDistribution
} from '../../statistics/distributionCalculations';
import { Graph } from '../../engine/types';
import { HardState, Relationship, Prominence } from '../../core/worldTypes';

describe('distributionCalculations', () => {
  const createEntity = (id: string, kind: string, subtype: string, prominence: string): HardState => ({
    id,
    kind,
    subtype,
    name: `Entity ${id}`,
    description: `Test entity ${id}`,
    status: 'active',
    prominence: prominence as any,
    culture: 'world',
    tags: {},
    links: [],
    createdAt: 0,
    updatedAt: 0
  });

  // Helper to create mock graph with new interface
  function createMockGraph(
    entities: Map<string, HardState> = new Map(),
    relationships: Relationship[] = []
  ): Graph {
    return {
      tick: 0,
      currentEra: {} as any,
      pressures: new Map(),
      history: [],
      config: {} as any,
      relationshipCooldowns: new Map(),
      rateLimitState: {
        currentThreshold: 1,
        lastCreationTick: 0,
        creationsThisEpoch: 0
      },
      growthMetrics: {
        relationshipsPerTick: [],
        averageGrowthRate: 0
      },
      // New Graph interface methods
      getEntity(id: string) { return entities.get(id); },
      hasEntity(id: string) { return entities.has(id); },
      getEntityCount() { return entities.size; },
      getEntities() { return Array.from(entities.values()); },
      getRelationships() { return [...relationships]; },
      getRelationshipCount() { return relationships.length; },
      findRelationships(predicate: (r: Relationship) => boolean) { return relationships.filter(predicate); },
      updateEntity() { return false; },
      addRelationship() {},
      _loadEntity(id: string, entity: HardState) { entities.set(id, entity); },
      _loadRelationship(rel: Relationship) { relationships.push(rel); },
      _setRelationships(rels: Relationship[]) { relationships.length = 0; relationships.push(...rels); },
      // Keep backward compatibility
      get entities() { return entities; },
      get relationships() { return relationships; }
    } as Graph;
  }

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
      const mockGraph = createMockGraph(new Map(), [
        { kind: 'allied_with', src: 'e1', dst: 'e2' },
        { kind: 'allied_with', src: 'e2', dst: 'e3' },
        { kind: 'member_of', src: 'e1', dst: 'e3' },
        { kind: 'located_at', src: 'e1', dst: 'e4' },
        { kind: 'located_at', src: 'e2', dst: 'e4' }
      ]);

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
      const mockGraph = createMockGraph();

      const distribution = calculateRelationshipDistribution(mockGraph);

      expect(distribution.counts).toEqual({});
      expect(distribution.ratios).toEqual({});
      expect(distribution.diversity).toBe(0);
    });

    it('should calculate max diversity for uniform distribution', () => {
      const mockGraph = createMockGraph(new Map(), [
        { kind: 'type1', src: 'e1', dst: 'e2' },
        { kind: 'type2', src: 'e2', dst: 'e3' },
        { kind: 'type3', src: 'e3', dst: 'e4' },
        { kind: 'type4', src: 'e4', dst: 'e1' }
      ]);

      const distribution = calculateRelationshipDistribution(mockGraph);

      // Max diversity for 4 equal categories = log2(4) = 2
      expect(distribution.diversity).toBeCloseTo(2, 1);
    });

    it('should have zero diversity for single relationship type', () => {
      const mockGraph = createMockGraph(new Map(), [
        { kind: 'same_type', src: 'e1', dst: 'e2' },
        { kind: 'same_type', src: 'e2', dst: 'e3' },
        { kind: 'same_type', src: 'e3', dst: 'e4' }
      ]);

      const distribution = calculateRelationshipDistribution(mockGraph);

      expect(distribution.diversity).toBe(0);
    });

    it('should handle diversity with very small ratios', () => {
      const mockGraph = createMockGraph(new Map(), [
        { kind: 'type1', src: 'e1', dst: 'e2' },
        { kind: 'type1', src: 'e2', dst: 'e3' },
        { kind: 'type1', src: 'e3', dst: 'e4' },
        { kind: 'type1', src: 'e4', dst: 'e5' },
        { kind: 'type1', src: 'e5', dst: 'e6' },
        { kind: 'type1', src: 'e6', dst: 'e7' },
        { kind: 'type1', src: 'e7', dst: 'e8' },
        { kind: 'type1', src: 'e8', dst: 'e9' },
        { kind: 'type1', src: 'e9', dst: 'e10' },
        { kind: 'type2', src: 'e10', dst: 'e1' } // 10% vs 90%
      ]);

      const distribution = calculateRelationshipDistribution(mockGraph);

      // Should be low diversity due to skewed distribution
      expect(distribution.diversity).toBeGreaterThan(0);
      expect(distribution.diversity).toBeLessThan(1);
    });
  });

  describe('calculateConnectivityMetrics', () => {
    it('should calculate connectivity metrics', () => {
      const mockGraph = createMockGraph(
        new Map([
          ['e1', createEntity('e1', 'npc', 'merchant', 'recognized')],
          ['e2', createEntity('e2', 'npc', 'hero', 'renowned')],
          ['e3', createEntity('e3', 'faction', 'guild', 'recognized')],
          ['e4', createEntity('e4', 'location', 'colony', 'marginal')],
          ['e5', createEntity('e5', 'npc', 'outlaw', 'marginal')] // isolated
        ]),
        [
          { kind: 'allied_with', src: 'e1', dst: 'e2' },
          { kind: 'member_of', src: 'e1', dst: 'e3' },
          { kind: 'located_at', src: 'e1', dst: 'e4' },
          { kind: 'allied_with', src: 'e2', dst: 'e3' }
        ]
      );

      const metrics = calculateConnectivityMetrics(mockGraph);

      expect(metrics.isolatedNodes).toBe(1); // e5 has no relationships
      expect(metrics.avgConnections).toBeGreaterThan(0);
      expect(metrics.maxConnections).toBe(3); // e1 has 3 relationships
      expect(metrics.minConnections).toBe(1); // e4 has 1 relationship
    });

    it('should handle fully connected graph', () => {
      const mockGraph = createMockGraph(
        new Map([
          ['e1', createEntity('e1', 'npc', 'merchant', 'recognized')],
          ['e2', createEntity('e2', 'npc', 'hero', 'renowned')],
          ['e3', createEntity('e3', 'faction', 'guild', 'recognized')]
        ]),
        [
          { kind: 'allied_with', src: 'e1', dst: 'e2' },
          { kind: 'allied_with', src: 'e1', dst: 'e3' },
          { kind: 'allied_with', src: 'e2', dst: 'e3' }
        ]
      );

      const metrics = calculateConnectivityMetrics(mockGraph);

      expect(metrics.isolatedNodes).toBe(0);
      expect(metrics.avgConnections).toBe(2); // Each node has 2 connections
      expect(metrics.maxConnections).toBe(2);
      expect(metrics.minConnections).toBe(2);
    });

    it('should handle graph with all isolated nodes', () => {
      const mockGraph = createMockGraph(
        new Map([
          ['e1', createEntity('e1', 'npc', 'merchant', 'recognized')],
          ['e2', createEntity('e2', 'npc', 'hero', 'renowned')],
          ['e3', createEntity('e3', 'faction', 'guild', 'recognized')]
        ]),
        []
      );

      const metrics = calculateConnectivityMetrics(mockGraph);

      expect(metrics.isolatedNodes).toBe(3);
      expect(metrics.avgConnections).toBe(0);
      expect(metrics.maxConnections).toBe(0);
      expect(metrics.minConnections).toBe(0);
    });

    it('should handle empty graph', () => {
      const mockGraph = createMockGraph();

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

  describe('Edge cases and mathematical properties', () => {
    it('calculateRatios should handle negative total gracefully', () => {
      const counts = { a: 5, b: 10 };
      const ratios = calculateRatios(counts, -1);

      // Should treat negative total as 0 (no division)
      expect(ratios.a).toBe(0);
      expect(ratios.b).toBe(0);
    });

    it('calculateRatios should preserve order of keys', () => {
      const counts = { zebra: 1, apple: 2, mango: 3 };
      const ratios = calculateRatios(counts, 6);

      expect(Object.keys(ratios)).toEqual(['zebra', 'apple', 'mango']);
    });

    it('calculateConnectivityMetrics should count bidirectional connections correctly', () => {
      const mockGraph = createMockGraph(
        new Map([
          ['e1', createEntity('e1', 'npc', 'merchant', 'recognized')],
          ['e2', createEntity('e2', 'npc', 'hero', 'renowned')]
        ]),
        [
          { kind: 'allied_with', src: 'e1', dst: 'e2' },
          { kind: 'allied_with', src: 'e2', dst: 'e1' } // Bidirectional
        ]
      );

      const metrics = calculateConnectivityMetrics(mockGraph);

      // Each entity should have 2 connections (one outgoing, one incoming)
      expect(metrics.avgConnections).toBe(2);
      expect(metrics.maxConnections).toBe(2);
      expect(metrics.minConnections).toBe(2);
      expect(metrics.isolatedNodes).toBe(0);
    });

    it('calculateConnectivityMetrics should handle self-loops', () => {
      const mockGraph = createMockGraph(
        new Map([
          ['e1', createEntity('e1', 'npc', 'merchant', 'recognized')],
          ['e2', createEntity('e2', 'npc', 'hero', 'renowned')]
        ]),
        [
          { kind: 'self_reference', src: 'e1', dst: 'e1' } // Self-loop
        ]
      );

      const metrics = calculateConnectivityMetrics(mockGraph);

      // e1 has self-loop (counts as 2 connections: src and dst)
      // e2 has no connections
      expect(metrics.isolatedNodes).toBe(1); // e2
      expect(metrics.maxConnections).toBe(2); // e1
      expect(metrics.minConnections).toBe(2); // Only e1 in connection map
    });

    it('calculateRelationshipDistribution should handle large uniform distribution', () => {
      const relationships: Relationship[] = [];
      for (let i = 0; i < 100; i++) {
        relationships.push({
          kind: `type_${i}`,
          src: `e${i}`,
          dst: `e${(i + 1) % 100}`
        });
      }

      const mockGraph = createMockGraph(new Map(), relationships);

      const distribution = calculateRelationshipDistribution(mockGraph);

      // Perfect uniform distribution: entropy = log2(100) ≈ 6.64
      expect(distribution.diversity).toBeGreaterThan(6.5);
      expect(distribution.diversity).toBeLessThan(6.7);
      expect(Object.keys(distribution.counts).length).toBe(100);
    });

    it('calculateEntityKindCounts should handle very long kind names', () => {
      const longKind = 'a'.repeat(1000);
      const entities = [
        createEntity('e1', longKind, 'subtype', 'recognized')
      ];

      const counts = calculateEntityKindCounts(entities);

      expect(counts[longKind]).toBe(1);
    });

    it('calculateProminenceDistribution ratios should sum to 1 with many entities', () => {
      const entities: HardState[] = [];
      const prominenceLevels: Prominence[] = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

      // Create 100 entities with random prominence
      for (let i = 0; i < 100; i++) {
        const prominence = prominenceLevels[i % prominenceLevels.length];
        entities.push(createEntity(`e${i}`, 'npc', 'merchant', prominence));
      }

      const distribution = calculateProminenceDistribution(entities);
      const sum = Object.values(distribution.ratios).reduce((s, r) => s + r, 0);

      expect(sum).toBeCloseTo(1.0);
    });
  });
});
