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

describe('CoordinateContext', () => {
  // Regions for location kind (with culture associations)
  const locationRegions: Region[] = [
    {
      id: 'aurora_stack',
      label: 'Aurora Stack',
      culture: 'aurora-stack',  // Culture association via region.culture
      bounds: { shape: 'circle', center: { x: 30, y: 70 }, radius: 15 },
      autoTags: ['cold', 'aurora']
    },
    {
      id: 'nightshelf',
      label: 'Nightshelf',
      culture: 'nightshelf',
      bounds: { shape: 'circle', center: { x: 70, y: 50 }, radius: 12 },
      autoTags: ['dark', 'shelf']
    }
  ];

  // Regions for NPC kind
  const npcRegions: Region[] = [
    {
      id: 'merchant_district',
      label: 'Merchant District',
      culture: 'aurora-stack',
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
          x: { name: 'temperature', lowLabel: 'Cold', highLabel: 'Warm' },
          y: { name: 'population', lowLabel: 'Sparse', highLabel: 'Dense' },
          z: { name: 'depth', lowLabel: 'Surface', highLabel: 'Deep' }
        },
        regions: locationRegions
      }
    },
    {
      id: 'npc',
      name: 'NPCs',
      semanticPlane: {
        axes: {
          x: { name: 'alignment', lowLabel: 'Lawful', highLabel: 'Chaotic' },
          y: { name: 'disposition', lowLabel: 'Hostile', highLabel: 'Friendly' },
          z: { name: 'power', lowLabel: 'Weak', highLabel: 'Strong' }
        },
        regions: npcRegions
      }
    }
  ];

  // Cultures array (canonry format)
  const cultures: CultureConfig[] = [
    {
      id: 'aurora-stack',
      name: 'Aurora Stack',
      axisBiases: {
        location: { x: 20, y: 70, z: 50 },  // Cold, dense
        npc: { x: 30, y: 60, z: 50 }  // Lawful, friendly
      }
    },
    {
      id: 'nightshelf',
      name: 'Nightshelf',
      axisBiases: {
        location: { x: 40, y: 40, z: 50 },  // Cool, moderate
        npc: { x: 60, y: 50, z: 50 }  // Neutral alignment
      }
    }
  ];

  const validConfig: CoordinateContextConfig = {
    entityKinds,
    cultures
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
        cultures: []
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
      expect(plane!.axes.x.lowLabel).toBe('Cold');
      expect(plane!.axes.x.highLabel).toBe('Warm');
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
      expect(regions[0].id).toBe('aurora_stack');
    });

    it('should get specific region by ID', () => {
      const region = context.getRegion('location', 'aurora_stack');
      expect(region).toBeDefined();
      expect(region!.label).toBe('Aurora Stack');
    });
  });

  describe('Culture Queries', () => {
    it('should return culture config by ID', () => {
      const config = context.getCultureConfig('aurora-stack');
      expect(config).toBeDefined();
      expect(config!.axisBiases!.location.x).toBe(20);
    });

    it('should return undefined for unknown culture', () => {
      const config = context.getCultureConfig('unknown');
      expect(config).toBeUndefined();
    });

    it('should check if culture exists', () => {
      expect(context.hasCulture('aurora-stack')).toBe(true);
      expect(context.hasCulture('nightshelf')).toBe(true);
      expect(context.hasCulture('unknown')).toBe(false);
    });

    it('should list all culture IDs', () => {
      const ids = context.getCultureIds();
      expect(ids).toContain('aurora-stack');
      expect(ids).toContain('nightshelf');
      expect(ids).toHaveLength(2);
    });

    it('should derive seed regions from region.culture field', () => {
      const seedIds = context.getSeedRegionIds('aurora-stack', 'location');
      expect(seedIds).toContain('aurora_stack');
      expect(seedIds).toHaveLength(1);
    });

    it('should get axis biases for culture and kind', () => {
      const biases = context.getAxisBiases('aurora-stack', 'location');
      expect(biases).toBeDefined();
      expect(biases!.x).toBe(20);
      expect(biases!.y).toBe(70);
    });
  });

  describe('Placement Context Building', () => {
    it('should build placement context from culture and kind', () => {
      const ctx = context.buildPlacementContext('aurora-stack', 'location');
      expect(ctx.cultureId).toBe('aurora-stack');
      expect(ctx.entityKind).toBe('location');
      expect(ctx.axisBiases?.x).toBe(20);
      expect(ctx.seedRegionIds).toContain('aurora_stack');
    });

    it('should return context with undefined biases for unknown culture', () => {
      const ctx = context.buildPlacementContext('unknown', 'location');
      expect(ctx.cultureId).toBe('unknown');
      expect(ctx.axisBiases).toBeUndefined();
      expect(ctx.seedRegionIds).toHaveLength(0);
    });
  });

  describe('Culture-Aware Sampling', () => {
    it('should sample from seed regions when culture specified', () => {
      const placementContext = context.buildPlacementContext('aurora-stack', 'location');

      // Should sample from aurora_stack region (center: 30, 70)
      const point = context.sampleWithCulture('location', placementContext);

      expect(point).toBeDefined();
      // Should be within or near aurora_stack region (radius 15)
      expect(point!.x).toBeGreaterThan(10);
      expect(point!.x).toBeLessThan(50);
      expect(point!.y).toBeGreaterThan(50);
      expect(point!.y).toBeLessThan(90);
    });

    it('should respect minimum distance from existing points', () => {
      const existingPoints = [{ x: 30, y: 70, z: 50 }];
      const placementContext = context.buildPlacementContext('aurora-stack', 'location');

      const point = context.sampleWithCulture('location', placementContext, existingPoints, 10);

      if (point) {
        // Should be at least 10 units away from existing
        const dx = point.x - 30;
        const dy = point.y - 70;
        const distance = Math.sqrt(dx * dx + dy * dy);
        expect(distance).toBeGreaterThanOrEqual(10);
      }
    });

    it('should fall back to axis biases when no seed regions available', () => {
      const placementContext = context.buildPlacementContext('aurora-stack', 'faction');

      // faction has no regions, should use axis biases (or default)
      const point = context.sampleWithCulture('faction', placementContext);
      expect(point).toBeDefined();
    });
  });

  describe('Culture-Aware Placement', () => {
    it('should place with full culture context', () => {
      const placementContext = context.buildPlacementContext('aurora-stack', 'location');

      const result = context.placeWithCulture(
        'location',
        'entity_1',
        100,
        placementContext
      );

      expect(result.success).toBe(true);
      expect(result.coordinates).toBeDefined();
      expect(result.cultureId).toBe('aurora-stack');
    });

    it('should derive tags including culture', () => {
      const placementContext = context.buildPlacementContext('aurora-stack', 'location');

      const result = context.placeWithCulture(
        'location',
        'entity_1',
        100,
        placementContext
      );

      expect(result.derivedTags?.culture).toBe('aurora-stack');
    });

    it('should identify region containing placed point', () => {
      const placementContext = context.buildPlacementContext('aurora-stack', 'location');

      const result = context.placeWithCulture(
        'location',
        'entity_1',
        100,
        placementContext
      );

      // Should be placed in aurora_stack region
      expect(result.regionId).toBe('aurora_stack');
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
      expect(cultureIds).toContain('aurora-stack');
      expect(cultureIds).toContain('nightshelf');
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
      expect(ctx.hasCulture('aurora-stack')).toBe(true);
    });
  });

  describe('Entity Placement Near Reference', () => {
    it('should sample point near reference entity via sampleNearPoint', () => {
      const referencePoint = { x: 30, y: 70, z: 50 };

      const point = context.sampleNearPoint(referencePoint, [], 5, 15);

      expect(point).toBeDefined();
      // Should be within maxSearchRadius (15) of reference
      const dx = point!.x - referencePoint.x;
      const dy = point!.y - referencePoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      expect(distance).toBeLessThanOrEqual(15);
      expect(distance).toBeGreaterThanOrEqual(5); // minDistance
    });

    it('should respect minimum distance from existing points in sampleNearPoint', () => {
      const referencePoint = { x: 50, y: 50, z: 50 };
      const existingPoints = [
        { x: 55, y: 50, z: 50 },
        { x: 45, y: 50, z: 50 },
        { x: 50, y: 55, z: 50 },
        { x: 50, y: 45, z: 50 }
      ];

      const point = context.sampleNearPoint(referencePoint, existingPoints, 8, 20);

      if (point) {
        // Should be at least 8 units from all existing points
        for (const existing of existingPoints) {
          const dx = point.x - existing.x;
          const dy = point.y - existing.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          expect(dist).toBeGreaterThanOrEqual(8);
        }
      }
    });

    it('should use referenceEntity in PlacementContext for sampleWithCulture', () => {
      const referenceEntity = {
        id: 'ref_entity',
        coordinates: { x: 70, y: 50, z: 50 } // In nightshelf region
      };

      const placementContext = context.buildPlacementContext('aurora-stack', 'location');
      placementContext.referenceEntity = referenceEntity;

      const point = context.sampleWithCulture('location', placementContext, [], 5);

      expect(point).toBeDefined();
      // Should be near the reference entity, not in aurora-stack region
      const dx = point!.x - 70;
      const dy = point!.y - 50;
      const distance = Math.sqrt(dx * dx + dy * dy);
      // Should be within maxSearchRadius (minDistance * 4 = 20)
      expect(distance).toBeLessThanOrEqual(20);
    });

    it('should place entity near reference via placeWithCulture with referenceEntity', () => {
      const referenceEntity = {
        id: 'ref_entity',
        coordinates: { x: 30, y: 70, z: 50 } // In aurora_stack region
      };

      const placementContext = context.buildPlacementContext('aurora-stack', 'location');
      placementContext.referenceEntity = referenceEntity;

      const result = context.placeWithCulture(
        'location',
        'new_entity',
        100,
        placementContext,
        [],
        5
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
});
