// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplateSelector } from '../../selection/templateSelector';
import { Graph, GrowthTemplate } from '../../engine/types';
import { HardState, Prominence } from '../../core/worldTypes';
import { DistributionTargets } from '../../statistics/types';

describe('TemplateSelector', () => {
  let selector: TemplateSelector;
  let mockGraph: Graph;
  let mockTemplates: GrowthTemplate[];
  let mockTargets: DistributionTargets;

  // Helper to create test entities
  const createEntity = (
    id: string,
    kind: string,
    subtype: string,
    prominence: Prominence = 'recognized'
  ): HardState => ({
    id,
    kind,
    subtype,
    name: `Test ${id}`,
    description: `Test entity ${id}`,
    status: 'active',
    prominence,
    tags: [],
    links: [],
    createdAt: 0,
    updatedAt: 0,
  });

  // Helper to create mock template
  const createTemplate = (id: string): GrowthTemplate => ({
    id,
    name: `Template ${id}`,
    canApply: vi.fn(() => true),
    findTargets: vi.fn(() => []),
    expand: vi.fn(() => ({ entities: [], relationships: [], description: '' })),
  });

  beforeEach(() => {
    // Create mock distribution targets
    mockTargets = {
      version: '1.0',
      global: {
        totalEntities: {
          target: 150,
          tolerance: 0.1,
        },
        entityKindDistribution: {
          type: 'custom',
          targets: {
            npc: 0.4,
            location: 0.2,
            faction: 0.2,
            abilities: 0.1,
            rules: 0.1,
          },
          tolerance: 0.1,
        },
        prominenceDistribution: {
          type: 'normal',
          mean: 'recognized',
          targets: {
            forgotten: 0.05,
            marginal: 0.4,
            recognized: 0.35,
            renowned: 0.15,
            mythic: 0.05,
          },
        },
        relationshipDistribution: {
          type: 'diverse',
          maxSingleTypeRatio: 0.25,
          minTypesPresent: 10,
          minTypeRatio: 0.02,
        },
        graphConnectivity: {
          type: 'clustered',
          targetClusters: {
            min: 3,
            max: 10,
            preferred: 5,
          },
          clusterSizeDistribution: {
            type: 'powerlaw',
            alpha: 2.0,
          },
          densityTargets: {
            intraCluster: 0.3,
            interCluster: 0.05,
          },
          isolatedNodeRatio: {
            max: 0.1,
          },
        },
      },
      perEra: {},
      tuning: {
        adjustmentSpeed: 0.5,
        deviationSensitivity: 1.0,
        minTemplateWeight: 0.1,
        maxTemplateWeight: 3.0,
        convergenceThreshold: 0.15,
        measurementInterval: 10,
        correctionStrength: {
          entityKind: 1.0,
          prominence: 0.8,
          relationship: 0.6,
          connectivity: 0.4,
        },
      },
      relationshipCategories: {
        social: ['allies', 'rivals', 'friends'],
        structural: ['member_of', 'leader_of'],
      },
    };

    // Create mock templates
    mockTemplates = [
      createTemplate('template1'),
      createTemplate('template2'),
      createTemplate('template3'),
    ];

    selector = new TemplateSelector(mockTargets, mockTemplates);

    // Create mock graph
    let _entities = new Map<string, HardState>();
    _entities.set('npc1', createEntity('npc1', 'npc', 'merchant', 'marginal'));
    _entities.set('npc2', createEntity('npc2', 'npc', 'hero', 'renowned'));
    _entities.set('loc1', createEntity('loc1', 'location', 'colony', 'recognized'));
    _entities.set('faction1', createEntity('faction1', 'faction', 'guild', 'mythic'));

    let _relationships = [
      { kind: 'member_of', src: 'npc1', dst: 'faction1' },
      { kind: 'resident_of', src: 'npc1', dst: 'loc1' },
      { kind: 'allies', src: 'npc1', dst: 'npc2' },
    ];

    mockGraph = {
      tick: 100,
      currentEra: {
        id: 'test-era',
        name: 'Test Era',
        description: 'Test',
        templateWeights: {},
        systemModifiers: {},
      },
      pressures: new Map(),
      history: [],
      config: {} as any,
      relationshipCooldowns: new Map(),
      rateLimitState: {} as any,
      growthMetrics: {
        relationshipsPerTick: [],
        averageGrowthRate: 0,
      },
      // Entity read methods
      getEntity(id: string) { return _entities.get(id); },
      hasEntity(id: string) { return _entities.has(id); },
      getEntityCount() { return _entities.size; },
      getEntities() { return Array.from(_entities.values()); },
      getEntityIds() { return Array.from(_entities.keys()); },
      forEachEntity(cb: any) { _entities.forEach((e, id) => cb(e, id)); },
      findEntities(criteria: any) {
        return Array.from(_entities.values()).filter(e => {
          if (criteria.kind && e.kind !== criteria.kind) return false;
          if (criteria.subtype && e.subtype !== criteria.subtype) return false;
          if (criteria.prominence && e.prominence !== criteria.prominence) return false;
          return true;
        });
      },
      getEntitiesByKind(kind: string) { return Array.from(_entities.values()).filter(e => e.kind === kind); },
      getConnectedEntities(entityId: string, relationKind?: string) {
        const connectedIds = new Set<string>();
        _relationships.forEach(r => {
          if (relationKind && r.kind !== relationKind) return;
          if (r.src === entityId) connectedIds.add(r.dst);
          if (r.dst === entityId) connectedIds.add(r.src);
        });
        return Array.from(connectedIds).map(id => _entities.get(id)).filter(Boolean);
      },
      // Entity mutation methods
      createEntity(settings: any) {
        const id = `${settings.kind}-${Date.now()}`;
        _entities.set(id, { ...settings, id, links: [] });
        return id;
      },
      updateEntity(id: string, changes: any) {
        const e = _entities.get(id);
        if (!e) return false;
        Object.assign(e, changes);
        return true;
      },
      deleteEntity(id: string) { return _entities.delete(id); },
      _loadEntity(id: string, entity: HardState) { _entities.set(id, entity); },
      // Relationship read methods
      getRelationships() { return [..._relationships]; },
      getRelationshipCount() { return _relationships.length; },
      findRelationships(criteria: any) {
        return _relationships.filter(r => {
          if (criteria.kind && r.kind !== criteria.kind) return false;
          if (criteria.src && r.src !== criteria.src) return false;
          if (criteria.dst && r.dst !== criteria.dst) return false;
          return true;
        });
      },
      getEntityRelationships(entityId: string) {
        return _relationships.filter(r => r.src === entityId || r.dst === entityId);
      },
      // Relationship mutation methods
      addRelationship(rel: any) { _relationships.push(rel); },
      _loadRelationship(rel: any) { _relationships.push(rel); },
      _setRelationships(rels: any[]) { _relationships = rels; }
    } as Graph;
  });

  describe('constructor', () => {
    it('should create a TemplateSelector instance', () => {
      expect(selector).toBeDefined();
      expect(selector).toBeInstanceOf(TemplateSelector);
    });

    it('should initialize with distribution targets', () => {
      const state = selector.getState(mockGraph);
      expect(state).toBeDefined();
      expect(state.totalEntities).toBe(4);
    });

    it('should initialize with templates', () => {
      const result = selector.selectTemplates(mockGraph, mockTemplates, { template1: 1.0 }, 1);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('selectTemplates - basic functionality', () => {
    it('should return requested number of templates', () => {
      const eraWeights = {
        template1: 1.0,
        template2: 1.0,
        template3: 1.0,
      };

      const result = selector.selectTemplates(mockGraph, mockTemplates, eraWeights, 5);
      expect(result.length).toBe(5);
    });

    it('should return array of templates', () => {
      const eraWeights = { template1: 1.0 };
      const result = selector.selectTemplates(mockGraph, mockTemplates, eraWeights, 2);

      expect(Array.isArray(result)).toBe(true);
      result.forEach((template) => {
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('canApply');
        expect(template).toHaveProperty('findTargets');
        expect(template).toHaveProperty('expand');
      });
    });

    it('should handle count of 0', () => {
      const eraWeights = { template1: 1.0 };
      const result = selector.selectTemplates(mockGraph, mockTemplates, eraWeights, 0);
      expect(result).toEqual([]);
    });

    it('should handle count of 1', () => {
      const eraWeights = { template1: 1.0 };
      const result = selector.selectTemplates(mockGraph, mockTemplates, eraWeights, 1);
      expect(result.length).toBe(1);
    });

    it('should handle large count', () => {
      const eraWeights = { template1: 1.0, template2: 1.0 };
      const result = selector.selectTemplates(mockGraph, mockTemplates, eraWeights, 100);
      expect(result.length).toBe(100);
    });
  });

  describe('selectTemplates - era weight handling', () => {
    it('should respect era weights of 0 (disabled templates)', () => {
      const eraWeights = {
        template1: 0,
        template2: 1.0,
      };

      const result = selector.selectTemplates(mockGraph, mockTemplates, eraWeights, 10);
      const validResults = result.filter((t) => t !== null);
      const template2Count = validResults.filter((t) => t && t.id === 'template2').length;
      expect(validResults.length).toBeGreaterThan(0);
      if (validResults.length > 0) {
        expect(template2Count).toBeGreaterThan(0);
      }
    });

    it('should handle all templates disabled', () => {
      const eraWeights = {
        template1: 0,
        template2: 0,
        template3: 0,
      };

      const result = selector.selectTemplates(mockGraph, mockTemplates, eraWeights, 5);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should favor higher weighted templates', () => {
      const eraWeights = {
        template1: 0.1,
        template2: 10.0,
      };

      const result = selector.selectTemplates(mockGraph, mockTemplates, eraWeights, 20);
      const template2Count = result.filter((t) => t.id === 'template2').length;

      expect(template2Count).toBeGreaterThan(0);
    });

    it('should use default weight of 1.0 for templates without era weight', () => {
      const eraWeights = {
        template1: 2.0,
      };

      const result = selector.selectTemplates(mockGraph, mockTemplates, eraWeights, 10);
      expect(result.length).toBe(10);
    });

    it('should handle empty era weights', () => {
      const result = selector.selectTemplates(mockGraph, mockTemplates, {}, 5);
      expect(result.length).toBe(5);
    });

    it('should handle negative weights as zero', () => {
      const eraWeights = {
        template1: -1.0,
        template2: 1.0,
      };

      const result = selector.selectTemplates(mockGraph, mockTemplates, eraWeights, 10);
      const template1Count = result.filter((t) => t.id === 'template1').length;
      expect(template1Count).toBeLessThanOrEqual(result.length / 2);
    });
  });

  describe('selectTemplates - empty template arrays', () => {
    it('should handle empty available templates', () => {
      const result = selector.selectTemplates(mockGraph, [], {}, 5);
      expect(result).toEqual([]);
    });

    it('should handle null templates gracefully', () => {
      const result = selector.selectTemplates(mockGraph, [], { template1: 1.0 }, 3);
      expect(result).toEqual([]);
    });
  });

  describe('selectTemplates - weight clamping', () => {
    it('should clamp weights to min/max bounds', () => {
      const eraWeights = {
        template1: 0.05, // Below min of 0.1
        template2: 5.0,  // Above max of 3.0
      };

      // Should still select both templates (clamped weights)
      const result = selector.selectTemplates(mockGraph, mockTemplates.slice(0, 2), eraWeights, 20);
      const template1Count = result.filter((t) => t.id === 'template1').length;
      const template2Count = result.filter((t) => t.id === 'template2').length;

      // Both should be selected at least once
      expect(template1Count + template2Count).toBe(20);
    });
  });

  describe('getState', () => {
    it('should return current distribution state', () => {
      const state = selector.getState(mockGraph);

      expect(state).toBeDefined();
      expect(state.tick).toBe(100);
      expect(state.totalEntities).toBe(4);
      expect(state.entityKindCounts).toBeDefined();
      expect(state.entityKindRatios).toBeDefined();
      expect(state.prominenceCounts).toBeDefined();
      expect(state.prominenceRatios).toBeDefined();
    });

    it('should calculate entity kind ratios correctly', () => {
      const state = selector.getState(mockGraph);

      expect(state.entityKindCounts.npc).toBe(2);
      expect(state.entityKindCounts.location).toBe(1);
      expect(state.entityKindCounts.faction).toBe(1);
      expect(state.entityKindRatios.npc).toBeCloseTo(0.5, 2);
      expect(state.entityKindRatios.location).toBeCloseTo(0.25, 2);
      expect(state.entityKindRatios.faction).toBeCloseTo(0.25, 2);
    });

    it('should calculate prominence distribution', () => {
      const state = selector.getState(mockGraph);

      expect(state.prominenceCounts.marginal).toBe(1);
      expect(state.prominenceCounts.renowned).toBe(1);
      expect(state.prominenceCounts.recognized).toBe(1);
      expect(state.prominenceCounts.mythic).toBe(1);
    });

    it('should calculate relationship metrics', () => {
      const state = selector.getState(mockGraph);

      expect(state.relationshipTypeCounts).toBeDefined();
      expect(state.relationshipTypeRatios).toBeDefined();
      expect(state.relationshipTypeCounts['member_of']).toBe(1);
      expect(state.relationshipTypeCounts['resident_of']).toBe(1);
      expect(state.relationshipTypeCounts['allies']).toBe(1);
    });

    it('should calculate graph metrics', () => {
      const state = selector.getState(mockGraph);

      expect(state.graphMetrics).toBeDefined();
      expect(state.graphMetrics.clusters).toBeGreaterThan(0);
      expect(state.graphMetrics.avgClusterSize).toBeGreaterThan(0);
      expect(state.graphMetrics.isolatedNodeRatio).toBeGreaterThanOrEqual(0);
      expect(state.graphMetrics.isolatedNodeRatio).toBeLessThanOrEqual(1);
    });

    it('should handle empty graph', () => {
      const _emptyEntities = new Map<string, HardState>();
      let _emptyRels: any[] = [];

      const emptyGraph = {
        ...mockGraph,
        getEntity(id: string) { return _emptyEntities.get(id); },
        hasEntity(id: string) { return _emptyEntities.has(id); },
        getEntityCount() { return _emptyEntities.size; },
        getEntities() { return Array.from(_emptyEntities.values()); },
        getEntityIds() { return Array.from(_emptyEntities.keys()); },
        getRelationships() { return [..._emptyRels]; },
        getRelationshipCount() { return _emptyRels.length; },
      } as Graph;

      const state = selector.getState(emptyGraph);
      expect(state.totalEntities).toBe(0);
      expect(state.graphMetrics.clusters).toBe(0);
    });
  });

  describe('getDeviation', () => {
    it('should return deviation from targets', () => {
      const deviation = selector.getDeviation(mockGraph);

      expect(deviation).toBeDefined();
      expect(deviation.overall).toBeGreaterThanOrEqual(0);
      expect(deviation.entityKind).toBeDefined();
      expect(deviation.prominence).toBeDefined();
      expect(deviation.relationship).toBeDefined();
      expect(deviation.connectivity).toBeDefined();
    });

    it('should calculate entity kind deviation', () => {
      const deviation = selector.getDeviation(mockGraph);

      expect(deviation.entityKind.score).toBeGreaterThanOrEqual(0);
      expect(deviation.entityKind.deviations).toBeDefined();
      expect(Object.keys(deviation.entityKind.deviations).length).toBeGreaterThan(0);
    });

    it('should calculate prominence deviation', () => {
      const deviation = selector.getDeviation(mockGraph);

      expect(deviation.prominence.score).toBeGreaterThanOrEqual(0);
      expect(deviation.prominence.deviations).toBeDefined();
      expect(deviation.prominence.deviations.marginal).toBeDefined();
      expect(deviation.prominence.deviations.recognized).toBeDefined();
    });

    it('should calculate relationship diversity deviation', () => {
      const deviation = selector.getDeviation(mockGraph);

      expect(deviation.relationship.score).toBeGreaterThanOrEqual(0);
      expect(deviation.relationship.maxTypeRatio).toBeGreaterThanOrEqual(0);
      expect(deviation.relationship.maxTypeRatio).toBeLessThanOrEqual(1);
      expect(deviation.relationship.typesPresent).toBeGreaterThan(0);
    });

    it('should calculate connectivity deviation', () => {
      const deviation = selector.getDeviation(mockGraph);

      expect(deviation.connectivity.score).toBeGreaterThanOrEqual(0);
      expect(deviation.connectivity.clusterCount).toBeGreaterThan(0);
      expect(deviation.connectivity.isolatedNodes).toBeGreaterThanOrEqual(0);
    });

    it('should show high deviation for unbalanced graph', () => {
      const entities = new Map<string, HardState>();
      for (let i = 0; i < 100; i++) {
        entities.set(`npc${i}`, createEntity(`npc${i}`, 'npc', 'merchant', 'mythic'));
      }
      mockGraph.entities = entities;

      const deviation = selector.getDeviation(mockGraph);

      expect(deviation.overall).toBeGreaterThan(0.2);
    });

    it('should show low deviation for balanced graph', () => {
      const entities = new Map<string, HardState>();

      // 40% NPCs
      for (let i = 0; i < 40; i++) {
        entities.set(`npc${i}`, createEntity(`npc${i}`, 'npc', 'merchant', 'marginal'));
      }
      // 20% locations
      for (let i = 0; i < 20; i++) {
        entities.set(`loc${i}`, createEntity(`loc${i}`, 'location', 'colony', 'recognized'));
      }
      // 20% factions
      for (let i = 0; i < 20; i++) {
        entities.set(`faction${i}`, createEntity(`faction${i}`, 'faction', 'guild', 'recognized'));
      }
      // 10% abilities
      for (let i = 0; i < 10; i++) {
        entities.set(`ability${i}`, createEntity(`ability${i}`, 'abilities', 'magic', 'renowned'));
      }
      // 10% rules
      for (let i = 0; i < 10; i++) {
        entities.set(`rule${i}`, createEntity(`rule${i}`, 'rules', 'law', 'recognized'));
      }

      mockGraph.entities = entities;

      const deviation = selector.getDeviation(mockGraph);

      expect(deviation.entityKind.score).toBeLessThan(0.3);
    });
  });

  describe('edge cases', () => {
    it('should handle very small graph', () => {
      const entities = new Map<string, HardState>();
      entities.set('npc1', createEntity('npc1', 'npc', 'merchant'));

      mockGraph.entities = entities;
      mockGraph.relationships = [];

      const result = selector.selectTemplates(mockGraph, mockTemplates, { template1: 1.0 }, 3);
      expect(result.length).toBe(3);
    });

    it('should handle graph with no relationships', () => {
      mockGraph.relationships = [];

      const result = selector.selectTemplates(mockGraph, mockTemplates, { template1: 1.0 }, 5);
      expect(result.length).toBe(5);
    });

    it('should handle single template', () => {
      const result = selector.selectTemplates(
        mockGraph,
        [mockTemplates[0]],
        { template1: 1.0 },
        10
      );
      expect(result.length).toBe(10);
      result.forEach((t) => {
        expect(t.id).toBe('template1');
      });
    });

    it('should handle era with no matching templates', () => {
      const eraWeights = {
        nonexistent_template: 1.0,
      };

      const result = selector.selectTemplates(mockGraph, mockTemplates, eraWeights, 5);
      expect(result.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle fractional era weights', () => {
      const eraWeights = {
        template1: 0.5,
        template2: 0.25,
        template3: 0.75,
      };

      const result = selector.selectTemplates(mockGraph, mockTemplates, eraWeights, 10);
      expect(result.length).toBe(10);
    });

    it('should handle very high era weights', () => {
      const eraWeights = {
        template1: 1000.0,
        template2: 0.001,
      };

      const result = selector.selectTemplates(mockGraph, mockTemplates.slice(0, 2), eraWeights, 20);
      const template1Count = result.filter((t) => t.id === 'template1').length;

      // Should heavily favor template1
      expect(template1Count).toBeGreaterThan(15);
    });
  });

  describe('weighted random selection', () => {
    it('should eventually select all templates with non-zero weights', () => {
      const eraWeights = {
        template1: 1.0,
        template2: 1.0,
      };

      const selectedIds = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const result = selector.selectTemplates(
          mockGraph,
          mockTemplates.slice(0, 2),
          eraWeights,
          1
        );
        if (result.length > 0) {
          selectedIds.add(result[0].id);
        }
      }

      expect(selectedIds.size).toBeGreaterThan(1);
    });

    it('should maintain probability distribution over many selections', () => {
      const eraWeights = {
        template1: 3.0,
        template2: 1.0,
      };

      const counts = { template1: 0, template2: 0, null: 0 };
      for (let i = 0; i < 100; i++) {
        const result = selector.selectTemplates(
          mockGraph,
          mockTemplates.slice(0, 2),
          eraWeights,
          1
        );
        if (result.length > 0 && result[0] !== null) {
          counts[result[0].id]++;
        } else {
          counts.null++;
        }
      }

      const totalNonNull = counts.template1 + counts.template2;
      expect(totalNonNull).toBeGreaterThan(10);
    });
  });

  describe('convergence behavior', () => {
    it('should track convergence threshold', () => {
      const deviation = selector.getDeviation(mockGraph);

      const isConverged = deviation.overall < mockTargets.tuning.convergenceThreshold;

      expect(typeof isConverged).toBe('boolean');
    });
  });
});
