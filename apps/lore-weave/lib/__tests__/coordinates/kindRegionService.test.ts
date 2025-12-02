/**
 * Tests for KindRegionService
 *
 * Tests:
 * - Kind initialization and configuration
 * - Per-kind region management
 * - Emergent region creation with culture context
 * - Entity placement processing
 * - State export/import
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KindRegionService, KindRegionServiceConfig } from '../../coordinates/kindRegionService';
import type { Region, EntityKindMaps, EmergentRegionConfig, Point } from '../../coordinates/types';

describe('KindRegionService', () => {
  let service: KindRegionService;

  // Test seed regions for locations
  const locationRegions: Region[] = [
    {
      id: 'highlands',
      label: 'Highlands',
      description: 'Northern mountain region',
      bounds: { shape: 'circle', center: { x: 30, y: 70 }, radius: 15 },
      tags: ['cold', 'mountainous']
    },
    {
      id: 'coastal',
      label: 'Coastal',
      description: 'Eastern coastal region',
      bounds: { shape: 'circle', center: { x: 70, y: 50 }, radius: 12 },
      tags: ['temperate', 'maritime']
    }
  ];

  // Test seed regions for abilities
  const abilityRegions: Region[] = [
    {
      id: 'combat_zone',
      label: 'Combat Zone',
      description: 'Combat-oriented abilities',
      bounds: { shape: 'rect', x1: 0, y1: 0, x2: 50, y2: 50 },
      tags: ['combat']
    },
    {
      id: 'utility_zone',
      label: 'Utility Zone',
      description: 'Utility abilities',
      bounds: { shape: 'rect', x1: 50, y1: 50, x2: 100, y2: 100 },
      tags: ['utility']
    }
  ];

  const defaultEmergentConfig: EmergentRegionConfig = {
    minDistanceFromExisting: 5,
    defaultRadius: 10,
    maxAttempts: 50
  };

  const kindMaps: EntityKindMaps = {
    location: {
      entityKind: 'location',
      name: 'World Map',
      description: 'Geographic coordinate space',
      bounds: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
      hasZAxis: true,
      seedRegions: locationRegions,
      emergentConfig: defaultEmergentConfig
    },
    abilities: {
      entityKind: 'abilities',
      name: 'Ability Space',
      description: 'Conceptual ability dimensions',
      bounds: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
      hasZAxis: false,
      seedRegions: abilityRegions
    }
  };

  const config: KindRegionServiceConfig = {
    kindMaps,
    defaultEmergentConfig
  };

  beforeEach(() => {
    service = new KindRegionService(config);
  });

  describe('Kind Configuration', () => {
    it('should initialize all configured kinds', () => {
      const kinds = service.getConfiguredKinds();
      expect(kinds).toContain('location');
      expect(kinds).toContain('abilities');
      expect(kinds).toHaveLength(2);
    });

    it('should report configured kinds correctly', () => {
      expect(service.hasKindMap('location')).toBe(true);
      expect(service.hasKindMap('abilities')).toBe(true);
      expect(service.hasKindMap('unknown')).toBe(false);
    });

    it('should create default mapper for unconfigured kinds', () => {
      const mapper = service.getMapper('npc');
      expect(mapper).toBeDefined();
      // After accessing, it should be tracked
      expect(service.hasKindMap('npc')).toBe(true);
    });
  });

  describe('Region Queries', () => {
    it('should return seed regions for configured kinds', () => {
      const locationRegs = service.getRegions('location');
      expect(locationRegs).toHaveLength(2);
      expect(locationRegs.map(r => r.id)).toContain('highlands');
      expect(locationRegs.map(r => r.id)).toContain('coastal');
    });

    it('should return empty regions for unconfigured kinds', () => {
      const npcRegions = service.getRegions('npc');
      expect(npcRegions).toHaveLength(0);
    });

    it('should find specific region by ID', () => {
      const region = service.getRegion('location', 'highlands');
      expect(region).toBeDefined();
      expect(region?.label).toBe('Highlands');
    });

    it('should lookup region containing point', () => {
      const result = service.lookupRegion('location', { x: 30, y: 70, z: 50 });
      expect(result.primary?.id).toBe('highlands');
    });

    it('should return null for point outside all regions', () => {
      const result = service.lookupRegion('location', { x: 50, y: 20, z: 50 });
      expect(result.primary).toBeNull();
    });
  });

  describe('Emergent Region Creation', () => {
    it('should create emergent region at valid location', () => {
      const point: Point = { x: 50, y: 10, z: 50 }; // Far from existing regions
      const result = service.createEmergentRegion(
        'location',
        point,
        'New Colony',
        'Emergent settlement',
        100,
        'entity_123'
      );

      expect(result.success).toBe(true);
      expect(result.region).toBeDefined();
      expect(result.region?.label).toBe('New Colony');
    });

    it('should track emergent regions in state', () => {
      const point: Point = { x: 50, y: 10, z: 50 };
      service.createEmergentRegion('location', point, 'New Colony', 'Test', 100);

      const regions = service.getRegions('location');
      expect(regions.length).toBe(3); // 2 seed + 1 emergent
    });

    it('should create emergent regions for unconfigured kinds', () => {
      const point: Point = { x: 50, y: 50, z: 50 };
      const result = service.createEmergentRegion('npc', point, 'NPC Zone', 'Test', 100);

      expect(result.success).toBe(true);
      const regions = service.getRegions('npc');
      expect(regions.length).toBe(1);
    });
  });

  describe('Entity Placement with Culture Context', () => {
    it('should process placement and return tags', () => {
      const point: Point = { x: 30, y: 70, z: 50 };
      const result = service.processEntityPlacement('location', 'entity_1', point, 100);

      expect(result.tags.cold).toBeTruthy();
      expect(result.tags.mountainous).toBeTruthy();
      expect(result.tags.region).toBe('highlands');
      expect(result.region?.id).toBe('highlands');
    });

    // NOTE: Emergent region creation via PlacementContext is paused.
    // These tests verify placement works without emergent region creation.

    it('should include culture ID in placement result', () => {
      const point: Point = { x: 10, y: 10, z: 50 }; // Outside all regions
      const result = service.processEntityPlacement(
        'location',
        'entity_1',
        point,
        100,
        {
          cultureId: 'highland'
        }
      );

      expect(result.cultureId).toBe('highland');
    });

    it('should identify region when point is inside', () => {
      const point: Point = { x: 30, y: 70, z: 50 }; // Inside highlands
      const result = service.processEntityPlacement(
        'location',
        'entity_1',
        point,
        100,
        { cultureId: 'highland' }
      );

      expect(result.region?.id).toBe('highlands');
    });
  });

  describe('State Export/Import', () => {
    it('should export all kind states', () => {
      const states = service.getAllStates();
      expect(states.location).toBeDefined();
      expect(states.abilities).toBeDefined();
      expect(states.location.regions).toHaveLength(2);
    });

    it('should export complete state for persistence', () => {
      const exported = service.export();
      expect(exported.states).toBeDefined();
      expect(exported.states.location).toBeDefined();
    });

    it('should import state and restore regions', () => {
      // Create emergent region
      service.createEmergentRegion(
        'location',
        { x: 10, y: 10, z: 50 },
        'New Colony',
        'Test',
        100
      );

      const exported = service.export();
      expect(exported.states.location.regions).toHaveLength(3);

      // Create new service and import
      const newService = new KindRegionService(config);
      expect(newService.getRegions('location')).toHaveLength(2); // Just seeds

      newService.import(exported.states);
      expect(newService.getRegions('location')).toHaveLength(3); // Seeds + emergent
    });
  });

  describe('Statistics', () => {
    it('should provide stats for all kinds', () => {
      const stats = service.getAllStats();
      expect(stats.kinds).toBe(2);
      expect(stats.totalRegions).toBe(4); // 2 location + 2 ability regions
      expect(stats.predefinedRegions).toBe(4);
      expect(stats.emergentRegions).toBe(0);
    });

    it('should provide per-kind stats', () => {
      const locationStats = service.getKindStats('location');
      expect(locationStats).toBeDefined();
      expect(locationStats!.totalRegions).toBe(2);

      const abilityStats = service.getKindStats('abilities');
      expect(abilityStats).toBeDefined();
      expect(abilityStats!.totalRegions).toBe(2);
    });

    it('should update stats when emergent regions created', () => {
      service.createEmergentRegion(
        'location',
        { x: 10, y: 10, z: 50 },
        'New Colony',
        'Test',
        100
      );

      const stats = service.getAllStats();
      expect(stats.totalRegions).toBe(5); // 4 predefined + 1 emergent
      expect(stats.emergentRegions).toBe(1);

      const locationStats = service.getKindStats('location');
      expect(locationStats!.totalRegions).toBe(3);
    });
  });
});
