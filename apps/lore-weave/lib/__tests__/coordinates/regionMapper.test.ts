/**
 * Tests for RegionMapper
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RegionMapper } from '../../coordinates/regionMapper.js';
import type { Region, RegionMapperConfig } from '../../types/regions.js';

describe('RegionMapper', () => {
  let mapper: RegionMapper;

  const testRegions: Region[] = [
    {
      id: 'northern_ice',
      label: 'Northern Ice Shelf',
      description: 'Frozen expanse in the north',
      bounds: {
        shape: 'circle',
        center: { x: 30, y: 80 },
        radius: 15
      },
      autoTags: ['cold', 'ice']
    },
    {
      id: 'southern_coast',
      label: 'Southern Coast',
      description: 'Warmer coastal region',
      bounds: {
        shape: 'rect',
        x1: 10,
        y1: 10,
        x2: 50,
        y2: 30
      },
      autoTags: ['coastal', 'fishing']
    },
    {
      id: 'sacred_cave',
      label: 'Sacred Cave',
      description: 'Ancient ritual site',
      bounds: {
        shape: 'circle',
        center: { x: 35, y: 20 },
        radius: 5
      },
      zRange: { min: 0, max: 30 },
      autoTags: ['sacred', 'underground']
    }
  ];

  const config: RegionMapperConfig = {
    regions: testRegions,
    defaultRegionLabel: 'Unknown Wilderness',
    defaultTags: ['wilderness'],
    allowEmergent: true,
    emergentConfig: {
      minDistanceFromExisting: 5,
      defaultRadius: 10,
      maxAttempts: 50
    }
  };

  beforeEach(() => {
    mapper = new RegionMapper(config);
  });

  describe('lookup', () => {
    it('finds region containing a point', () => {
      const result = mapper.lookup({ x: 30, y: 80, z: 50 });
      expect(result.primary?.id).toBe('northern_ice');
    });

    it('returns null primary when point is outside all regions', () => {
      const result = mapper.lookup({ x: 90, y: 90, z: 50 });
      expect(result.primary).toBeNull();
      expect(result.all).toHaveLength(0);
    });

    it('finds nested regions (point in multiple)', () => {
      // sacred_cave is inside southern_coast
      const result = mapper.lookup({ x: 35, y: 20, z: 10 });
      expect(result.all.length).toBeGreaterThanOrEqual(2);
      // Smallest region should be primary
      expect(result.primary?.id).toBe('sacred_cave');
    });

    it('finds nearest region when outside all', () => {
      const result = mapper.lookup({ x: 90, y: 90, z: 50 });
      expect(result.nearest).toBeDefined();
      expect(result.nearest!.distance).toBeGreaterThan(0);
    });
  });

  describe('getTagsForPoint', () => {
    it('returns region auto-tags for point in region', () => {
      const tags = mapper.getTagsForPoint({ x: 30, y: 80, z: 50 });
      expect(tags.cold).toBeTruthy();
      expect(tags.ice).toBeTruthy();
      expect(tags.region).toBe('northern_ice');
    });

    it('returns default tags for point outside all regions', () => {
      const tags = mapper.getTagsForPoint({ x: 90, y: 90, z: 50 });
      expect(tags.wilderness).toBeTruthy();
      expect(tags.region).toBe('unassigned');
    });

    it('returns combined tags for nested regions', () => {
      const tags = mapper.getTagsForPoint({ x: 35, y: 20, z: 10 });
      expect(tags.sacred).toBeTruthy();
      expect(tags.underground).toBeTruthy();
      expect(tags.coastal).toBeTruthy();
      expect(tags.fishing).toBeTruthy();
    });
  });

  describe('sampleRegion', () => {
    it('samples point within circle region', () => {
      const point = mapper.sampleRegion('northern_ice');
      expect(point).not.toBeNull();

      // Verify point is in region
      const result = mapper.lookup(point!);
      expect(result.primary?.id).toBe('northern_ice');
    });

    it('samples point within rect region', () => {
      const point = mapper.sampleRegion('southern_coast', { z: 50 });
      expect(point).not.toBeNull();
      expect(point!.x).toBeGreaterThanOrEqual(10);
      expect(point!.x).toBeLessThanOrEqual(50);
      expect(point!.y).toBeGreaterThanOrEqual(10);
      expect(point!.y).toBeLessThanOrEqual(30);
    });

    it('returns null for unknown region', () => {
      const point = mapper.sampleRegion('nonexistent');
      expect(point).toBeNull();
    });

    it('respects avoidance constraints', () => {
      const existing = [{ x: 30, y: 80, z: 50 }];
      const point = mapper.sampleRegion('northern_ice', {
        avoid: existing,
        minDistance: 5
      });

      if (point) {
        const dist = mapper.distance(point, existing[0]);
        expect(dist).toBeGreaterThanOrEqual(5);
      }
    });
  });

  describe('createEmergentRegion', () => {
    it('creates new region near reference point', () => {
      const result = mapper.createEmergentRegion(
        { x: 70, y: 70, z: 50 },
        'New Settlement',
        'A newly discovered area',
        100
      );

      expect(result.success).toBe(true);
      expect(result.region).toBeDefined();
      expect(result.region!.emergent).toBe(true);
      expect(result.region!.createdAt).toBe(100);
      expect(result.region!.autoTags).toContain('emergent');
    });

    it('fails when emergent not allowed', () => {
      const noEmergentMapper = new RegionMapper({
        ...config,
        allowEmergent: false
      });

      const result = noEmergentMapper.createEmergentRegion(
        { x: 70, y: 70, z: 50 },
        'New Settlement',
        'Test',
        100
      );

      expect(result.success).toBe(false);
      expect(result.failureReason).toContain('not allowed');
    });
  });

  describe('processEntityPlacement', () => {
    it('returns tags and emits event', () => {
      let emittedEvent: any = null;
      mapper.onEntityPlaced((e) => { emittedEvent = e; });

      const tags = mapper.processEntityPlacement('entity-1', { x: 30, y: 80, z: 50 });

      expect(tags.region).toBe('northern_ice');
      expect(emittedEvent).not.toBeNull();
      expect(emittedEvent.entityId).toBe('entity-1');
      expect(emittedEvent.region?.id).toBe('northern_ice');
    });
  });

  describe('geometry', () => {
    it('calculates distance correctly', () => {
      const dist = mapper.distance(
        { x: 0, y: 0, z: 0 },
        { x: 3, y: 4, z: 0 }
      );
      expect(dist).toBe(5);
    });

    it('gets region center', () => {
      const center = mapper.getRegionCenter(testRegions[0]);
      expect(center.x).toBe(30);
      expect(center.y).toBe(80);
    });
  });
});
