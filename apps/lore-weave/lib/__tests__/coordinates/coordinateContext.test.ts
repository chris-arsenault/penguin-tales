/**
 * Tests for CoordinateContext
 *
 * Tests the canonry-aligned coordinate system:
 * - entityKinds[]: array with semanticPlane on each entity kind
 * - cultures[]: array with axisBiases keyed by entity kind
 * - Culture-aware placement using region.culture field
 * - State export
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CoordinateContext,
  CoordinateContextConfig,
  EntityKindConfig,
  CultureConfig,
  createCoordinateContext
} from '../../coordinates/coordinateContext';
import type { Region } from '../../coordinates/types';

// Mock NameGenerationService for tests (matches interface in coordinateContext.ts)
const mockNameForgeService = {
  generate: async (kind: string, _subtype: string, _prominence: string, _tags: string[], cultureId: string) => {
    return `${cultureId}-${kind}-frontier`;
  }
};

describe('CoordinateContext', () => {
  // Regions for location kind (with culture associations)
  const locationRegions: Region[] = [
    {
      id: 'highlands',
      label: 'Highlands',
      culture: 'highland',  // Culture association via region.culture
      bounds: { shape: 'circle', center: { x: 30, y: 70 }, radius: 15 },
      tags: ['cold', 'mountainous']
    },
    {
      id: 'coastal',
      label: 'Coastal',
      culture: 'coastal',
      bounds: { shape: 'circle', center: { x: 70, y: 50 }, radius: 12 },
      tags: ['temperate', 'maritime']
    }
  ];

  // Regions for NPC kind
  const npcRegions: Region[] = [
    {
      id: 'merchant_district',
      label: 'Merchant District',
      culture: 'highland',
      bounds: { shape: 'circle', center: { x: 40, y: 60 }, radius: 10 }
    }
  ];

  // Entity kinds array (canonry format)
  const entityKinds: EntityKindConfig[] = [
    {
      id: 'location',
      name: 'Locations',
      semanticPlane: {
        axes: {
          x: { name: 'temperature', lowTag: 'cold', highTag: 'warm' },
          y: { name: 'population', lowTag: 'sparse', highTag: 'dense' },
          z: { name: 'depth', lowTag: 'surface', highTag: 'deep' }
        },
        regions: locationRegions
      }
    },
    {
      id: 'npc',
      name: 'NPCs',
      semanticPlane: {
        axes: {
          x: { name: 'alignment', lowTag: 'lawful', highTag: 'chaotic' },
          y: { name: 'disposition', lowTag: 'hostile', highTag: 'friendly' },
          z: { name: 'power', lowTag: 'weak', highTag: 'strong' }
        },
        regions: npcRegions
      }
    }
  ];

  // Cultures array (canonry format)
  const cultures: CultureConfig[] = [
    {
      id: 'highland',
      name: 'Highland',
      axisBiases: {
        location: { x: 20, y: 70, z: 50 },  // Cold, dense
        npc: { x: 30, y: 60, z: 50 }  // Lawful, friendly
      }
    },
    {
      id: 'coastal',
      name: 'Coastal',
      axisBiases: {
        location: { x: 40, y: 40, z: 50 },  // Cool, moderate
        npc: { x: 60, y: 50, z: 50 }  // Neutral alignment
      }
    }
  ];

  const validConfig: CoordinateContextConfig = {
    entityKinds,
    cultures,
    nameForgeService: mockNameForgeService
  };

  let context: CoordinateContext;

  beforeEach(() => {
    context = new CoordinateContext(validConfig);
  });

  describe('Configuration', () => {
    it('should accept valid configuration', () => {
      const ctx = new CoordinateContext(validConfig);
      expect(ctx).toBeInstanceOf(CoordinateContext);
    });

    it('should accept empty config (no regions/cultures)', () => {
      const ctx = new CoordinateContext({
        entityKinds: [],
        cultures: [],
        nameForgeService: mockNameForgeService
      });
      expect(ctx.getCultureIds()).toHaveLength(0);
      expect(ctx.getConfiguredKinds()).toHaveLength(0);
    });
  });

  describe('Semantic Data Access', () => {
    it('should return semantic plane for configured kind', () => {
      const plane = context.getSemanticPlane('location');
      expect(plane).toBeDefined();
      expect(plane!.axes.x.name).toBe('temperature');
      expect(plane!.axes.x.lowTag).toBe('cold');
      expect(plane!.axes.x.highTag).toBe('warm');
    });

    it('should return undefined for unconfigured kind', () => {
      const plane = context.getSemanticPlane('unknown');
      expect(plane).toBeUndefined();
    });

    it('should list configured kinds', () => {
      const kinds = context.getConfiguredKinds();
      expect(kinds).toContain('location');
      expect(kinds).toContain('npc');
      expect(kinds).toHaveLength(2);
    });

    it('should check if kind has map', () => {
      expect(context.hasKindMap('location')).toBe(true);
      expect(context.hasKindMap('unknown')).toBe(false);
    });

    it('should return regions for kind', () => {
      const regions = context.getRegions('location');
      expect(regions).toHaveLength(2);
      expect(regions[0].id).toBe('highlands');
    });

    it('should get specific region by ID', () => {
      const region = context.getRegion('location', 'highlands');
      expect(region).toBeDefined();
      expect(region!.label).toBe('Highlands');
    });
  });

  describe('Culture Queries', () => {
    it('should return culture config by ID', () => {
      const config = context.getCultureConfig('highland');
      expect(config).toBeDefined();
      expect(config!.axisBiases!.location.x).toBe(20);
    });

    it('should return undefined for unknown culture', () => {
      const config = context.getCultureConfig('unknown');
      expect(config).toBeUndefined();
    });

    it('should check if culture exists', () => {
      expect(context.hasCulture('highland')).toBe(true);
      expect(context.hasCulture('coastal')).toBe(true);
      expect(context.hasCulture('unknown')).toBe(false);
    });

    it('should list all culture IDs', () => {
      const ids = context.getCultureIds();
      expect(ids).toContain('highland');
      expect(ids).toContain('coastal');
      expect(ids).toHaveLength(2);
    });

    it('should derive seed regions from region.culture field', () => {
      const seedIds = context.getSeedRegionIds('highland', 'location');
      expect(seedIds).toContain('highlands');
      expect(seedIds).toHaveLength(1);
    });

    it('should get axis biases for culture and kind', () => {
      const biases = context.getAxisBiases('highland', 'location');
      expect(biases).toBeDefined();
      expect(biases!.x).toBe(20);
      expect(biases!.y).toBe(70);
    });
  });

  describe('Placement Context Building', () => {
    it('should build placement context from culture and kind', () => {
      const ctx = context.buildPlacementContext('highland', 'location');
      expect(ctx.cultureId).toBe('highland');
      expect(ctx.entityKind).toBe('location');
      expect(ctx.axisBiases?.x).toBe(20);
      expect(ctx.seedRegionIds).toContain('highlands');
    });

    it('should return context with undefined biases for unknown culture', () => {
      const ctx = context.buildPlacementContext('unknown', 'location');
      expect(ctx.cultureId).toBe('unknown');
      expect(ctx.axisBiases).toBeUndefined();
      expect(ctx.seedRegionIds).toHaveLength(0);
    });
  });

  describe('Culture-Aware Sampling', () => {
    it('should sample from seed regions when culture specified', async () => {
      const placementContext = context.buildPlacementContext('highland', 'location');

      // Should sample from highlands region (center: 30, 70)
      const result = await context.sampleWithCulture('location', placementContext);

      expect(result).toBeDefined();
      const point = result!.point;
      // Should be within or near highlands region (radius 15)
      expect(point.x).toBeGreaterThan(10);
      expect(point.x).toBeLessThan(50);
      expect(point.y).toBeGreaterThan(50);
      expect(point.y).toBeLessThan(90);
    });

    it('should respect minimum distance from existing points', async () => {
      const existingPoints = [{ x: 30, y: 70, z: 50 }];
      const placementContext = context.buildPlacementContext('highland', 'location');

      const result = await context.sampleWithCulture('location', placementContext, existingPoints, 10);

      if (result) {
        const point = result.point;
        // Should be at least 10 units away from existing
        const dx = point.x - 30;
        const dy = point.y - 70;
        const distance = Math.sqrt(dx * dx + dy * dy);
        expect(distance).toBeGreaterThanOrEqual(10);
      }
    });

    it('should fall back to axis biases when no seed regions available', async () => {
      const placementContext = context.buildPlacementContext('highland', 'faction');

      // faction has no regions, should use axis biases (or default)
      const result = await context.sampleWithCulture('faction', placementContext);
      expect(result).toBeDefined();
    });
  });

  describe('Culture-Aware Placement', () => {
    it('should place with full culture context', async () => {
      const placementContext = context.buildPlacementContext('highland', 'location');

      const result = await context.placeWithCulture(
        'location',
        'entity_1',
        100,
        placementContext
      );

      expect(result.success).toBe(true);
      expect(result.coordinates).toBeDefined();
      expect(result.cultureId).toBe('highland');
    });

    it('should derive tags including culture', async () => {
      const placementContext = context.buildPlacementContext('highland', 'location');

      const result = await context.placeWithCulture(
        'location',
        'entity_1',
        100,
        placementContext
      );

      expect(result.derivedTags?.culture).toBe('highland');
    });

    it('should identify region containing placed point', async () => {
      const placementContext = context.buildPlacementContext('highland', 'location');

      const result = await context.placeWithCulture(
        'location',
        'entity_1',
        100,
        placementContext
      );

      // Should be placed in highlands region
      expect(result.regionId).toBe('highlands');
    });
  });

  describe('State Export', () => {
    it('should export coordinate state', () => {
      const exported = context.export();
      expect(exported.entityKinds).toBeDefined();
      expect(exported.cultures).toBeDefined();
    });

    it('should export entityKinds with all kinds', () => {
      const exported = context.export();
      const kindIds = exported.entityKinds.map(k => k.id);
      expect(kindIds).toContain('location');
      expect(kindIds).toContain('npc');
    });

    it('should export cultures with all cultures', () => {
      const exported = context.export();
      const cultureIds = exported.cultures.map(c => c.id);
      expect(cultureIds).toContain('highland');
      expect(cultureIds).toContain('coastal');
    });
  });

  describe('Statistics', () => {
    it('should return coordinate system stats', () => {
      const stats = context.getStats();
      expect(stats.cultures).toBe(2);
      expect(stats.kinds).toBe(2);
      expect(stats.totalRegions).toBe(3);  // 2 location + 1 npc
    });
  });

  describe('Factory Function', () => {
    it('should create context via factory', () => {
      const ctx = createCoordinateContext(validConfig);
      expect(ctx).toBeInstanceOf(CoordinateContext);
      expect(ctx.hasCulture('highland')).toBe(true);
    });
  });

  describe('Entity Placement Near Reference', () => {
    it('should sample point near reference entity via sampleNearPoint', () => {
      const referencePoint = { x: 30, y: 70, z: 50 };

      const point = context.sampleNearPoint(referencePoint, []);

      expect(point).toBeDefined();
      // Should be within maxSearchRadius (defaultMinDistance * 4 = 20) of reference
      const dx = point!.x - referencePoint.x;
      const dy = point!.y - referencePoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      expect(distance).toBeLessThanOrEqual(20);
      expect(distance).toBeGreaterThanOrEqual(5); // minDistance = defaultMinDistance
    });

    it('should respect minimum distance from existing points in sampleNearPoint', () => {
      const referencePoint = { x: 50, y: 50, z: 50 };
      const existingPoints = [
        { x: 55, y: 50, z: 50 },
        { x: 45, y: 50, z: 50 },
        { x: 50, y: 55, z: 50 },
        { x: 50, y: 45, z: 50 }
      ];

      const point = context.sampleNearPoint(referencePoint, existingPoints);

      if (point) {
        // Should be at least defaultMinDistance (5) units from all existing points
        for (const existing of existingPoints) {
          const dx = point.x - existing.x;
          const dy = point.y - existing.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          expect(dist).toBeGreaterThanOrEqual(5);
        }
      }
    });

    it('should use referenceEntity in PlacementContext for sampleWithCulture', async () => {
      const referenceEntity = {
        id: 'ref_entity',
        coordinates: { x: 70, y: 50, z: 50 } // In coastal region
      };

      const placementContext = context.buildPlacementContext('highland', 'location');
      placementContext.referenceEntity = referenceEntity;

      const result = await context.sampleWithCulture('location', placementContext, [], 5);

      expect(result).toBeDefined();
      // Should be near the reference entity, not in highland region
      const dx = result!.point.x - 70;
      const dy = result!.point.y - 50;
      const distance = Math.sqrt(dx * dx + dy * dy);
      // Should be within maxSearchRadius (minDistance * 4 = 20)
      expect(distance).toBeLessThanOrEqual(20);
    });

    it('should place entity near reference via placeWithCulture with referenceEntity', async () => {
      const referenceEntity = {
        id: 'ref_entity',
        coordinates: { x: 30, y: 70, z: 50 } // In highlands region
      };

      const placementContext = context.buildPlacementContext('highland', 'location');
      placementContext.referenceEntity = referenceEntity;

      const result = await context.placeWithCulture(
        'location',
        'new_entity',
        100,
        placementContext,
        []
      );

      expect(result.success).toBe(true);
      expect(result.coordinates).toBeDefined();

      // Should be near the reference entity
      const dx = result.coordinates!.x - 30;
      const dy = result.coordinates!.y - 70;
      const distance = Math.sqrt(dx * dx + dy * dy);
      expect(distance).toBeLessThanOrEqual(20);
    });
  });

  describe('Sparse Area Placement', () => {
    let context: CoordinateContext;

    beforeEach(() => {
      context = createCoordinateContext(validConfig);
    });

    it('should find any point when no existing positions', () => {
      const result = context.findSparseArea({
        existingPositions: [],
        minDistanceFromEntities: 15,
        preferPeriphery: false
      });

      expect(result.success).toBe(true);
      expect(result.coordinates).toBeDefined();
      expect(result.coordinates!.x).toBeGreaterThanOrEqual(0);
      expect(result.coordinates!.x).toBeLessThanOrEqual(100);
      expect(result.coordinates!.y).toBeGreaterThanOrEqual(0);
      expect(result.coordinates!.y).toBeLessThanOrEqual(100);
      expect(result.minDistanceToEntity).toBe(100); // Maximum distance when empty
    });

    it('should find point far from existing entities', () => {
      const existingPositions = [
        { x: 50, y: 50, z: 50 }  // Single entity in center
      ];

      const result = context.findSparseArea({
        existingPositions,
        minDistanceFromEntities: 15,
        preferPeriphery: false
      });

      expect(result.success).toBe(true);
      expect(result.coordinates).toBeDefined();

      // Verify minimum distance is respected
      const dx = result.coordinates!.x - 50;
      const dy = result.coordinates!.y - 50;
      const distance = Math.sqrt(dx * dx + dy * dy);
      expect(distance).toBeGreaterThanOrEqual(15);
      expect(result.minDistanceToEntity).toBeGreaterThanOrEqual(15);
    });

    it('should find point far from multiple existing entities', () => {
      const existingPositions = [
        { x: 25, y: 25, z: 50 },
        { x: 25, y: 75, z: 50 },
        { x: 75, y: 25, z: 50 },
        { x: 75, y: 75, z: 50 }
      ];

      const result = context.findSparseArea({
        existingPositions,
        minDistanceFromEntities: 10,
        preferPeriphery: false
      });

      expect(result.success).toBe(true);
      expect(result.coordinates).toBeDefined();

      // Verify minimum distance from all existing entities
      for (const pos of existingPositions) {
        const dx = result.coordinates!.x - pos.x;
        const dy = result.coordinates!.y - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        expect(distance).toBeGreaterThanOrEqual(10);
      }
    });

    it('should fail when plane is too crowded', () => {
      // Create a dense grid of positions that covers most of the plane
      const existingPositions: Array<{ x: number; y: number; z: number }> = [];
      for (let x = 10; x <= 90; x += 15) {
        for (let y = 10; y <= 90; y += 15) {
          existingPositions.push({ x, y, z: 50 });
        }
      }

      const result = context.findSparseArea({
        existingPositions,
        minDistanceFromEntities: 30,  // Very large min distance
        preferPeriphery: false,
        maxAttempts: 20
      });

      expect(result.success).toBe(false);
      expect(result.failureReason).toContain('No sparse area found');
    });

    it('should bias toward periphery when preferPeriphery is true', () => {
      const existingPositions = [
        { x: 50, y: 50, z: 50 }  // Single entity in center
      ];

      // Run multiple times to check statistical bias
      const peripheryDistances: number[] = [];
      for (let i = 0; i < 20; i++) {
        const result = context.findSparseArea({
          existingPositions,
          minDistanceFromEntities: 5,
          preferPeriphery: true
        });

        if (result.success && result.coordinates) {
          // Distance from center (50, 50)
          const dx = result.coordinates.x - 50;
          const dy = result.coordinates.y - 50;
          const distFromCenter = Math.sqrt(dx * dx + dy * dy);
          peripheryDistances.push(distFromCenter);
        }
      }

      // Average distance from center should be higher with periphery bias
      const avgDistance = peripheryDistances.reduce((a, b) => a + b, 0) / peripheryDistances.length;
      expect(avgDistance).toBeGreaterThan(15); // Should be biased toward edges
    });

    it('should return the sparsest point (highest minDistanceToEntity)', () => {
      const existingPositions = [
        { x: 10, y: 10, z: 50 }  // Single entity in corner
      ];

      const result = context.findSparseArea({
        existingPositions,
        minDistanceFromEntities: 5,
        preferPeriphery: false,
        maxAttempts: 100
      });

      expect(result.success).toBe(true);
      expect(result.coordinates).toBeDefined();

      // The sparsest area should be toward the opposite corner
      // or at least far from (10, 10)
      const dx = result.coordinates!.x - 10;
      const dy = result.coordinates!.y - 10;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Should find a point reasonably far from the corner
      expect(distance).toBeGreaterThan(30);
      expect(result.minDistanceToEntity).toBeGreaterThan(30);
    });
  });
});
