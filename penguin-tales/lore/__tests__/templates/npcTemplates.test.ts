// @ts-nocheck
// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { familyExpansion } from '../../templates/npc/familyExpansion';
import { heroEmergence } from '../../templates/npc/heroEmergence';
import { succession } from '../../templates/npc/succession';
import { outlawRecruitment } from '../../templates/npc/outlawRecruitment';
import { kinshipConstellation } from '../../templates/npc/kinshipConstellation';
import { TemplateGraphView, TargetSelector } from '@lore-weave/core';
import { Graph, Era } from '@lore-weave/core';
import { HardState } from '@lore-weave/core';

// Mock CoordinateContext for testing
const mockCoordinateContext = {
  getKindRegionService: () => ({
    getMapper: () => ({
      getAllRegions: () => [],
      getRegion: () => null,
      sampleRegion: () => ({ x: 50, y: 50, z: 50 }),
      distance: () => 0,
      lookup: () => ({ region: null, distance: 0 })
    }),
    processEntityPlacement: () => ({ region: null, allRegions: [], tags: {} }),
    placeNear: () => ({ coordinates: { x: 50, y: 50, z: 50 }, region: null, tags: {} })
  }),
  getSemanticEncoder: () => ({
    encode: () => ({ coordinates: { x: 50, y: 50, z: 50 }, matchedTags: [], confidence: 1 }),
    getAxes: () => null
  }),
  getCultureConfig: () => ({ cultureId: 'test', seedRegionIds: [] }),
  hasCulture: () => true,
  getCultureIds: () => ['test'],
  buildPlacementContext: () => ({})
} as any;

describe('NPC Templates', () => {
  let mockGraph: Graph;
  let mockGraphView: TemplateGraphView;
  let mockTargetSelector: TargetSelector;
  let mockEra: Era;

  beforeEach(() => {
    mockEra = {
      id: 'test-era',
      name: 'Test Era',
      templateWeights: {},
      systemModifiers: {}
    };

    mockGraph = {
      entities: new Map(),
      relationships: [],
      tick: 10,
      currentEra: mockEra,
      pressures: new Map(),
      history: [],
      getEntities() { return [...this.entities.values()]; },
      getEntity(id: string) { return this.entities.get(id); },
      forEachEntity(cb: any) { this.entities.forEach(cb); },
      getRelationships() { return this.relationships; },
      getEntityCount() { return this.entities.size; }
    };

    mockTargetSelector = new TargetSelector();
    mockGraphView = new TemplateGraphView(mockGraph, mockTargetSelector, mockCoordinateContext);
  });

  describe('familyExpansion', () => {
    it('should have correct id and metadata', () => {
      expect(familyExpansion.id).toBe('family_expansion');
      expect(familyExpansion.metadata).toBeDefined();
      expect(familyExpansion.metadata.produces).toBeDefined();
    });

    it('should not apply to empty graph', () => {
      const result = familyExpansion.canApply(mockGraphView);
      expect(result).toBe(false);
    });

    it('should not apply with only one NPC', () => {
      const npc: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Solo Merchant',
        description: 'A merchant',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('npc-1', npc);
      mockGraphView = new TemplateGraphView(mockGraph, mockTargetSelector, mockCoordinateContext);

      const result = familyExpansion.canApply(mockGraphView);
      expect(result).toBe(false);
    });

    it('should apply with multiple NPCs', () => {
      const npc1: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 1',
        description: 'A merchant',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const npc2: HardState = {
        id: 'npc-2',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 2',
        description: 'Another merchant',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('npc-1', npc1);
      mockGraph.entities.set('npc-2', npc2);
      mockGraphView = new TemplateGraphView(mockGraph, mockTargetSelector, mockCoordinateContext);

      const result = familyExpansion.canApply(mockGraphView);
      expect(result).toBe(true);
    });

    it('should find valid targets', () => {
      const colony: HardState = {
        id: 'colony-1',
        kind: 'location',
        subtype: 'colony',
        name: 'Test Colony',
        description: 'A colony',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const npc1: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant Parent',
        description: 'A merchant',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [
          { kind: 'resident_of', src: 'npc-1', dst: 'colony-1' }
        ],
        createdAt: 0,
        updatedAt: 0
      };

      const npc2: HardState = {
        id: 'npc-2',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant Spouse',
        description: 'Another merchant',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [
          { kind: 'resident_of', src: 'npc-2', dst: 'colony-1' }
        ],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('colony-1', colony);
      mockGraph.entities.set('npc-1', npc1);
      mockGraph.entities.set('npc-2', npc2);
      mockGraph.relationships = [
        { kind: 'resident_of', src: 'npc-1', dst: 'colony-1' },
        { kind: 'resident_of', src: 'npc-2', dst: 'colony-1' }
      ];
      mockGraphView = new TemplateGraphView(mockGraph, mockTargetSelector, mockCoordinateContext);

      const targets = familyExpansion.findTargets(mockGraphView);
      expect(targets.length).toBeGreaterThan(0);
    });

    it('should have expand method', () => {
      expect(typeof familyExpansion.expand).toBe('function');
    });

    it('should handle dead NPCs correctly', () => {
      const npc: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Dead Merchant',
        description: 'A deceased merchant',
        status: 'deceased',
        prominence: 'forgotten',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('npc-1', npc);
      mockGraphView = new TemplateGraphView(mockGraph, mockTargetSelector, mockCoordinateContext);

      const result = familyExpansion.canApply(mockGraphView);
      expect(result).toBe(false);
    });
  });

  describe('heroEmergence', () => {
    it('should have correct id and metadata', () => {
      expect(heroEmergence.id).toBe('hero_emergence');
      expect(heroEmergence.metadata).toBeDefined();
    });

    it('should not apply to empty graph', () => {
      const result = heroEmergence.canApply(mockGraphView);
      expect(result).toBe(false);
    });

    it('should have canApply method', () => {
      expect(typeof heroEmergence.canApply).toBe('function');
    });

    it('should have findTargets method', () => {
      expect(typeof heroEmergence.findTargets).toBe('function');
    });

    it('should have expand method', () => {
      expect(typeof heroEmergence.expand).toBe('function');
    });

    it('should have metadata', () => {
      expect(heroEmergence.metadata).toBeDefined();
      expect(heroEmergence.metadata.produces).toBeDefined();
    });
  });

  describe('succession', () => {
    it('should have correct id and metadata', () => {
      expect(succession.id).toBe('succession');
      expect(succession.metadata).toBeDefined();
    });

    it('should not apply to empty graph', () => {
      const result = succession.canApply(mockGraphView);
      expect(result).toBe(false);
    });

    it('should have canApply method', () => {
      expect(typeof succession.canApply).toBe('function');
    });

    it('should have findTargets method', () => {
      expect(typeof succession.findTargets).toBe('function');
    });

    it('should have expand method', () => {
      expect(typeof succession.expand).toBe('function');
    });
  });

  describe('outlawRecruitment', () => {
    it('should have correct id and metadata', () => {
      expect(outlawRecruitment.id).toBe('outlaw_recruitment');
      expect(outlawRecruitment.metadata).toBeDefined();
    });

    it('should not apply to empty graph', () => {
      const result = outlawRecruitment.canApply(mockGraphView);
      expect(result).toBe(false);
    });

    it('should have canApply method', () => {
      expect(typeof outlawRecruitment.canApply).toBe('function');
    });

    it('should have findTargets method', () => {
      expect(typeof outlawRecruitment.findTargets).toBe('function');
    });

    it('should have expand method', () => {
      expect(typeof outlawRecruitment.expand).toBe('function');
    });
  });

  describe('kinshipConstellation', () => {
    it('should have correct id and metadata', () => {
      expect(kinshipConstellation.id).toBe('kinship_constellation');
      expect(kinshipConstellation.metadata).toBeDefined();
    });

    it('should not apply to empty graph', () => {
      const result = kinshipConstellation.canApply(mockGraphView);
      expect(result).toBe(false);
    });

    it('should have canApply method', () => {
      expect(typeof kinshipConstellation.canApply).toBe('function');
    });

    it('should have findTargets method', () => {
      expect(typeof kinshipConstellation.findTargets).toBe('function');
      const targets = kinshipConstellation.findTargets(mockGraphView);
      expect(Array.isArray(targets)).toBe(true);
    });

    it('should have expand method', () => {
      expect(typeof kinshipConstellation.expand).toBe('function');
    });
  });
});
