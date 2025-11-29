/**
 * Tests for CoordinateContext
 *
 * Tests:
 * - Culture configuration and injection
 * - No fallbacks for missing config (explicit errors)
 * - Culture-aware placement
 * - Integration with KindRegionService and SemanticEncoder
 * - State export/import
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CoordinateContext,
  CoordinateContextConfig,
  CultureCoordinateConfig,
  createCoordinateContext
} from '../../coordinates/coordinateContext';
import type { KindRegionServiceConfig } from '../../coordinates/kindRegionService';
import type { SemanticEncoderConfig, Region, EntityKindAxes, TagSemanticWeights } from '../../coordinates/types';

describe('CoordinateContext', () => {
  // Seed regions for location kind
  const locationRegions: Region[] = [
    {
      id: 'aurora_stack',
      label: 'Aurora Stack',
      description: 'Northern colony',
      bounds: { shape: 'circle', center: { x: 30, y: 70 }, radius: 15 },
      autoTags: ['cold', 'aurora']
    },
    {
      id: 'nightshelf',
      label: 'Nightshelf',
      description: 'Eastern shelf',
      bounds: { shape: 'circle', center: { x: 70, y: 50 }, radius: 12 },
      autoTags: ['dark', 'shelf']
    }
  ];

  const kindRegionConfig: KindRegionServiceConfig = {
    kindMaps: {
      location: {
        entityKind: 'location',
        name: 'Penguin Lands',
        description: 'Geographic space',
        bounds: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
        hasZAxis: true,
        seedRegions: locationRegions
      },
      npc: {
        entityKind: 'npc',
        name: 'NPC Space',
        description: 'Character space',
        bounds: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
        hasZAxis: true,
        seedRegions: []
      }
    },
    defaultEmergentConfig: {
      minDistanceFromExisting: 5,
      defaultRadius: 10,
      maxAttempts: 50
    }
  };

  const npcAxes: EntityKindAxes = {
    entityKind: 'npc',
    x: { name: 'lawful_chaotic', low: 'lawful', high: 'chaotic' },
    y: { name: 'kind_cruel', low: 'cruel', high: 'kind' },
    z: { name: 'timid_bold', low: 'timid', high: 'bold' }
  };

  const tagWeights: TagSemanticWeights[] = [
    {
      tag: 'merchant',
      weights: {
        npc: { lawful_chaotic: 30, kind_cruel: 60, timid_bold: 50 }
      }
    },
    {
      tag: 'outlaw',
      weights: {
        npc: { lawful_chaotic: 85, kind_cruel: 30, timid_bold: 70 }
      }
    }
  ];

  const semanticConfig: SemanticEncoderConfig = {
    axes: [npcAxes],
    tagWeights,
    warnOnUnconfiguredTags: false
  };

  const cultures: CultureCoordinateConfig[] = [
    {
      cultureId: 'aurora-stack',
      seedRegionIds: ['aurora_stack'],
      preferredAxes: { lawful_chaotic: 20 } // Aurora Stack penguins are lawful
    },
    {
      cultureId: 'nightshelf',
      seedRegionIds: ['nightshelf'],
      preferredAxes: { lawful_chaotic: 60 } // Nightshelf penguins are neutral
    }
  ];

  const validConfig: CoordinateContextConfig = {
    kindRegionConfig,
    semanticConfig,
    cultures
  };

  let context: CoordinateContext;

  beforeEach(() => {
    context = new CoordinateContext(validConfig);
  });

  describe('Configuration Validation (No Fallbacks)', () => {
    it('should throw if kindRegionConfig is missing', () => {
      expect(() => new CoordinateContext({
        kindRegionConfig: undefined as any,
        semanticConfig,
        cultures
      })).toThrow('kindRegionConfig is required');
    });

    it('should throw if semanticConfig is missing', () => {
      expect(() => new CoordinateContext({
        kindRegionConfig,
        semanticConfig: undefined as any,
        cultures
      })).toThrow('semanticConfig is required');
    });

    it('should throw if cultures array is empty', () => {
      expect(() => new CoordinateContext({
        kindRegionConfig,
        semanticConfig,
        cultures: []
      })).toThrow('at least one culture configuration is required');
    });

    it('should throw if cultures is undefined', () => {
      expect(() => new CoordinateContext({
        kindRegionConfig,
        semanticConfig,
        cultures: undefined as any
      })).toThrow('at least one culture configuration is required');
    });

    it('should throw if culture missing cultureId', () => {
      expect(() => new CoordinateContext({
        kindRegionConfig,
        semanticConfig,
        cultures: [{ cultureId: '', seedRegionIds: ['aurora_stack'] }]
      })).toThrow('missing cultureId');
    });

    it('should throw if culture has no seedRegionIds', () => {
      expect(() => new CoordinateContext({
        kindRegionConfig,
        semanticConfig,
        cultures: [{ cultureId: 'test', seedRegionIds: [] }]
      })).toThrow('must have at least one seedRegionId');
    });
  });

  describe('Culture Queries', () => {
    it('should return culture config by ID', () => {
      const config = context.getCultureConfig('aurora-stack');
      expect(config.cultureId).toBe('aurora-stack');
      expect(config.seedRegionIds).toContain('aurora_stack');
    });

    it('should throw for unknown culture', () => {
      expect(() => context.getCultureConfig('unknown')).toThrow('culture "unknown" not found');
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

    it('should build placement context from culture', () => {
      const placementContext = context.buildPlacementContext('aurora-stack');
      expect(placementContext.cultureId).toBe('aurora-stack');
      expect(placementContext.seedRegionIds).toContain('aurora_stack');
      expect(placementContext.preferredAxes?.lawful_chaotic).toBe(20);
    });
  });

  describe('Service Access', () => {
    it('should provide shared KindRegionService', () => {
      const service = context.getKindRegionService();
      expect(service).toBeDefined();
      expect(service.hasKindMap('location')).toBe(true);
    });

    it('should provide shared SemanticEncoder', () => {
      const encoder = context.getSemanticEncoder();
      expect(encoder).toBeDefined();
      expect(encoder.hasConfigForKind('npc')).toBe(true);
    });

    it('should check kind maps through context', () => {
      expect(context.hasKindMap('location')).toBe(true);
      expect(context.hasKindMap('unknown')).toBe(false);
    });

    it('should list configured kinds', () => {
      const kinds = context.getConfiguredKinds();
      expect(kinds).toContain('location');
      expect(kinds).toContain('npc');
    });
  });

  describe('Culture-Weighted Encoding', () => {
    it('should encode with culture bias', () => {
      const placementContext = context.buildPlacementContext('aurora-stack');
      const result = context.encodeWithCulture('npc', ['merchant'], placementContext);

      // Base merchant: lawful_chaotic=30
      // Culture bias: lawful_chaotic=20
      // Blended: 0.7*30 + 0.3*20 = 21 + 6 = 27
      // With jitter, expect close to 27
      expect(result.coordinates.x).toBeGreaterThan(20);
      expect(result.coordinates.x).toBeLessThan(35);
    });

    it('should encode without culture bias when no context', () => {
      const result = context.encodeWithCulture('npc', ['merchant']);

      // Just base merchant: lawful_chaotic=30
      expect(result.coordinates.x).toBeGreaterThan(25);
      expect(result.coordinates.x).toBeLessThan(35);
    });
  });

  describe('Culture-Aware Sampling', () => {
    it('should sample from seed regions when culture specified', () => {
      const placementContext = context.buildPlacementContext('aurora-stack');

      // Should sample from aurora_stack region (center: 30, 70)
      const point = context.sampleWithCulture('location', placementContext);

      expect(point).toBeDefined();
      // Should be within or near aurora_stack region
      expect(point!.x).toBeGreaterThan(10);
      expect(point!.x).toBeLessThan(50);
      expect(point!.y).toBeGreaterThan(50);
      expect(point!.y).toBeLessThan(90);
    });

    it('should respect minimum distance from existing points', () => {
      const existingPoints = [{ x: 30, y: 70, z: 50 }];
      const placementContext = context.buildPlacementContext('aurora-stack');

      const point = context.sampleWithCulture('location', placementContext, existingPoints, 10);

      if (point) {
        // Should be at least 10 units away from existing
        const dx = point.x - 30;
        const dy = point.y - 70;
        const distance = Math.sqrt(dx * dx + dy * dy);
        expect(distance).toBeGreaterThanOrEqual(10);
      }
    });
  });

  describe('Culture-Aware Placement', () => {
    it('should place with full culture context', () => {
      const placementContext = context.buildPlacementContext('aurora-stack');

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
      const placementContext = {
        ...context.buildPlacementContext('aurora-stack'),
        createEmergentRegion: false
      };

      const result = context.placeWithCulture(
        'location',
        'entity_1',
        100,
        placementContext
      );

      expect(result.derivedTags?.culture).toBe('aurora-stack');
    });
  });

  describe('State Export/Import', () => {
    it('should export coordinate state', () => {
      const exported = context.export();
      expect(exported.kindRegionState).toBeDefined();
    });

    it('should import coordinate state', () => {
      // Create emergent region
      const service = context.getKindRegionService();
      service.createEmergentRegion(
        'location',
        { x: 10, y: 10, z: 50 },
        'New Colony',
        'Test',
        100
      );

      const exported = context.export();

      // Create new context and import
      const newContext = new CoordinateContext(validConfig);
      newContext.import(exported);

      const regions = newContext.getKindRegionService().getRegions('location');
      expect(regions.length).toBe(3); // 2 seed + 1 emergent
    });

    it('should preserve regions across export/import', () => {
      // Create emergent region directly (at point outside all seed regions)
      const service = context.getKindRegionService();
      service.createEmergentRegion(
        'location',
        { x: 90, y: 90, z: 50 }, // Outside aurora_stack and nightshelf
        'Aurora Outpost',
        'Emergent test region',
        100
      );

      const exported = context.export();
      const newContext = new CoordinateContext(validConfig);
      newContext.import(exported);

      // Verify region persisted
      const regions = newContext.getKindRegionService().getRegions('location');
      const outpost = regions.find(r => r.label === 'Aurora Outpost');
      expect(outpost).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should return coordinate system stats', () => {
      const stats = context.getStats();
      expect(stats.cultures).toBe(2);
      expect(stats.kinds).toBe(2);
      expect(stats.regions).toBeDefined();
    });
  });

  describe('Factory Function', () => {
    it('should create context via factory', () => {
      const ctx = createCoordinateContext(validConfig);
      expect(ctx).toBeInstanceOf(CoordinateContext);
      expect(ctx.hasCulture('aurora-stack')).toBe(true);
    });
  });
});
