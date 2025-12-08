// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { SystemSelector } from '../../selection/systemSelector';
import { Graph, SimulationSystem } from '../../engine/types';
import { DistributionTargets } from '../../statistics/types';
import { HardState, Relationship } from '../../core/worldTypes';

describe('SystemSelector', () => {
  let selector: SystemSelector;
  let mockTargets: DistributionTargets;
  let mockGraph: Graph;
  let mockSystems: SimulationSystem[];

  // Helper to create a mock system
  const createMockSystem = (id: string): SimulationSystem => ({
    id,
    name: `System ${id}`,
    apply: () => ({ newRelationships: [], modifications: [], description: '' })
  });

  // Helper to create a test entity
  const createEntity = (
    id: string,
    kind: string,
    subtype: string,
    options: Partial<HardState> = {}
  ): HardState => ({
    id,
    kind,
    subtype,
    name: `Test ${id}`,
    description: `Test entity ${id}`,
    status: 'active',
    prominence: 'recognized',
    tags: [],
    links: [],
    createdAt: 0,
    updatedAt: 0,
    ...options,
  });

  beforeEach(() => {
    // Create mock distribution targets
    mockTargets = {
      version: '1.0.0',
      global: {
        totalEntities: { target: 150, tolerance: 0.1 },
        entityKindDistribution: {
          type: 'uniform',
          targets: { npc: 0.4, location: 0.2, faction: 0.2, rules: 0.1, abilities: 0.1 },
          tolerance: 0.15
        },
        prominenceDistribution: {
          type: 'normal',
          mean: 'recognized',
          stdDev: 1,
          targets: {
            forgotten: 0.15,
            marginal: 0.25,
            recognized: 0.35,
            renowned: 0.2,
            mythic: 0.05
          }
        },
        relationshipDistribution: {
          type: 'diverse',
          maxSingleTypeRatio: 0.3,
          minTypesPresent: 8,
          minTypeRatio: 0.02
        },
        graphConnectivity: {
          type: 'clustered',
          targetClusters: { min: 3, max: 8, preferred: 5 },
          clusterSizeDistribution: { type: 'powerlaw', alpha: 2.0 },
          densityTargets: {
            intraCluster: 0.6,
            interCluster: 0.1
          },
          isolatedNodeRatio: { max: 0.05 }
        }
      },
      perEra: {},
      tuning: {
        adjustmentSpeed: 0.3,
        deviationSensitivity: 0.5,
        minTemplateWeight: 0.1,
        maxTemplateWeight: 3.0,
        convergenceThreshold: 0.15,
        measurementInterval: 10,
        correctionStrength: {
          entityKind: 0.8,
          prominence: 0.6,
          relationship: 0.7,
          connectivity: 0.75
        }
      },
      relationshipCategories: {
        social: ['allies', 'rivals', 'friends'],
        hierarchical: ['leader_of', 'member_of'],
        spatial: ['resident_of', 'located_in']
      }
    };

    selector = new SystemSelector(mockTargets);

    // Create mock graph with some entities and relationships
    const _entities = new Map<string, HardState>();
    _entities.set('npc1', createEntity('npc1', 'npc', 'merchant'));
    _entities.set('npc2', createEntity('npc2', 'npc', 'hero'));
    _entities.set('npc3', createEntity('npc3', 'npc', 'warrior'));
    _entities.set('loc1', createEntity('loc1', 'location', 'colony'));
    _entities.set('faction1', createEntity('faction1', 'faction', 'guild'));

    let _relationships: Relationship[] = [
      { kind: 'resident_of', src: 'npc1', dst: 'loc1' },
      { kind: 'resident_of', src: 'npc2', dst: 'loc1' },
      { kind: 'member_of', src: 'npc1', dst: 'faction1' },
      { kind: 'allies', src: 'npc1', dst: 'npc2' },
      { kind: 'leader_of', src: 'npc3', dst: 'faction1' }
    ];

    mockGraph = {
      tick: 100,
      currentEra: {
        id: 'expansion',
        name: 'Expansion',
        description: 'Test era',
        templateWeights: {},
        systemModifiers: {},
        pressureModifiers: {}
      },
      pressures: new Map(),
      relationshipCooldowns: new Map(),
      config: {} as any,
      rateLimitState: {} as any,
      history: [],
      nameLogger: {} as any,
      tagRegistry: {} as any,
      loreValidator: {} as any,
      statistics: {} as any,
      enrichmentService: {} as any,

      // Entity read methods
      getEntity(id: string): HardState | undefined {
        const entity = _entities.get(id);
        return entity ? { ...entity, tags: { ...entity.tags }, links: [...entity.links] } : undefined;
      },
      hasEntity(id: string): boolean {
        return _entities.has(id);
      },
      getEntityCount(): number {
        return _entities.size;
      },
      getEntities(): HardState[] {
        return Array.from(_entities.values()).map(e => ({ ...e, tags: [...e.tags], links: [...e.links] }));
      },
      getEntityIds(): string[] {
        return Array.from(_entities.keys());
      },
      forEachEntity(callback: (entity: HardState, id: string) => void): void {
        _entities.forEach((entity, id) => {
          callback({ ...entity, tags: { ...entity.tags }, links: [...entity.links] }, id);
        });
      },
      findEntities(criteria: { kind?: string; subtype?: string; status?: string; prominence?: string; culture?: string; tag?: string; exclude?: string[] }): HardState[] {
        return Array.from(_entities.values())
          .filter(e => {
            if (criteria.kind && e.kind !== criteria.kind) return false;
            if (criteria.subtype && e.subtype !== criteria.subtype) return false;
            if (criteria.status && e.status !== criteria.status) return false;
            if (criteria.prominence && e.prominence !== criteria.prominence) return false;
            if (criteria.culture && e.culture !== criteria.culture) return false;
            if (criteria.tag && !e.tags.includes(criteria.tag)) return false;
            if (criteria.exclude && criteria.exclude.includes(e.id)) return false;
            return true;
          })
          .map(e => ({ ...e, tags: [...e.tags], links: [...e.links] }));
      },
      getEntitiesByKind(kind: string): HardState[] {
        return Array.from(_entities.values())
          .filter(e => e.kind === kind)
          .map(e => ({ ...e, tags: [...e.tags], links: [...e.links] }));
      },
      getConnectedEntities(entityId: string, relationKind?: string): HardState[] {
        const connectedIds = new Set<string>();
        _relationships.forEach(r => {
          if (relationKind && r.kind !== relationKind) return;
          if (r.src === entityId) connectedIds.add(r.dst);
          if (r.dst === entityId) connectedIds.add(r.src);
        });
        return Array.from(connectedIds)
          .map(id => _entities.get(id))
          .filter((e): e is HardState => e !== undefined)
          .map(e => ({ ...e, tags: [...e.tags], links: [...e.links] }));
      },

      // Entity mutation methods
      setEntity(id: string, entity: HardState): void {
        _entities.set(id, entity);
      },
      updateEntity(id: string, changes: Partial<HardState>): boolean {
        const entity = _entities.get(id);
        if (!entity) return false;
        Object.assign(entity, changes);
        entity.updatedAt = this.tick;
        return true;
      },
      deleteEntity(id: string): boolean {
        return _entities.delete(id);
      },

      // Relationship read methods
      getRelationships(): Relationship[] {
        return [..._relationships];
      },
      getRelationshipCount(): number {
        return _relationships.length;
      },
      findRelationships(criteria: { kind?: string; src?: string; dst?: string; category?: string; minStrength?: number }): Relationship[] {
        return _relationships.filter(r => {
          if (criteria.kind && r.kind !== criteria.kind) return false;
          if (criteria.src && r.src !== criteria.src) return false;
          if (criteria.dst && r.dst !== criteria.dst) return false;
          if (criteria.minStrength !== undefined && (r.strength ?? 0.5) < criteria.minStrength) return false;
          return true;
        });
      },
      getEntityRelationships(entityId: string, direction?: 'src' | 'dst' | 'both'): Relationship[] {
        return _relationships.filter(r => {
          if (direction === 'src') return r.src === entityId;
          if (direction === 'dst') return r.dst === entityId;
          return r.src === entityId || r.dst === entityId;
        });
      },
      hasRelationship(srcId: string, dstId: string, kind?: string): boolean {
        return _relationships.some(r =>
          r.src === srcId && r.dst === dstId && (!kind || r.kind === kind)
        );
      },

      // Relationship mutation methods
      pushRelationship(relationship: Relationship): void {
        _relationships.push(relationship);
        const srcEntity = _entities.get(relationship.src);
        if (srcEntity) {
          srcEntity.links.push({ ...relationship });
          srcEntity.updatedAt = this.tick;
        }
        const dstEntity = _entities.get(relationship.dst);
        if (dstEntity) {
          dstEntity.updatedAt = this.tick;
        }
      },
      setRelationships(rels: Relationship[]): void {
        _relationships = rels;
      },
      removeRelationship(srcId: string, dstId: string, kind: string): boolean {
        const idx = _relationships.findIndex(r => r.src === srcId && r.dst === dstId && r.kind === kind);
        if (idx >= 0) {
          _relationships.splice(idx, 1);
          const srcEntity = _entities.get(srcId);
          if (srcEntity) {
            srcEntity.links = srcEntity.links.filter(l => !(l.src === srcId && l.dst === dstId && l.kind === kind));
            srcEntity.updatedAt = this.tick;
          }
          return true;
        }
        return false;
      },

      get entities() { return _entities; },
      get relationships() { return _relationships; },
      set relationships(rels: Relationship[]) { _relationships = rels; }
    };

    // Create mock systems
    mockSystems = [
      createMockSystem('system1'),
      createMockSystem('system2'),
      createMockSystem('system3')
    ];
  });

  describe('constructor', () => {
    it('should create a SystemSelector instance', () => {
      expect(selector).toBeDefined();
      expect(selector).toBeInstanceOf(SystemSelector);
    });

    it('should initialize with distribution targets', () => {
      const newSelector = new SystemSelector(mockTargets);
      expect(newSelector).toBeDefined();
    });
  });

  describe('calculateSystemModifiers', () => {
    describe('basic functionality', () => {
      it('should return modifiers for all systems', () => {
        const eraModifiers = {
          system1: 1.0,
          system2: 1.0,
          system3: 1.0
        };

        const result = selector.calculateSystemModifiers(mockGraph, mockSystems, eraModifiers);

        expect(result).toBeDefined();
        expect(Object.keys(result).length).toBe(3);
        expect(result.system1).toBeDefined();
        expect(result.system2).toBeDefined();
        expect(result.system3).toBeDefined();
      });

      it('should use base modifiers directly', () => {
        const eraModifiers = {
          system1: 1.5,
          system2: 2.0,
          system3: 0.5
        };

        const result = selector.calculateSystemModifiers(mockGraph, mockSystems, eraModifiers);

        expect(result.system1).toBe(1.5);
        expect(result.system2).toBe(2.0);
        expect(result.system3).toBe(0.5);
      });

      it('should default to 1.0 for systems not in era modifiers', () => {
        const eraModifiers = {
          system1: 1.0
        };

        const result = selector.calculateSystemModifiers(mockGraph, mockSystems, eraModifiers);

        expect(result.system1).toBe(1.0);
        expect(result.system2).toBe(1.0);
        expect(result.system3).toBe(1.0);
      });

      it('should handle empty systems array', () => {
        const eraModifiers = {};
        const result = selector.calculateSystemModifiers(mockGraph, [], eraModifiers);

        expect(result).toBeDefined();
        expect(Object.keys(result).length).toBe(0);
      });

      it('should handle empty era modifiers', () => {
        const result = selector.calculateSystemModifiers(mockGraph, mockSystems, {});

        expect(result.system1).toBe(1.0);
        expect(result.system2).toBe(1.0);
        expect(result.system3).toBe(1.0);
      });
    });

    describe('modifier clamping', () => {
      it('should clamp modifiers to minimum 0.2', () => {
        const eraModifiers = {
          system1: 0.1 // Below minimum
        };

        const result = selector.calculateSystemModifiers(mockGraph, mockSystems, eraModifiers);

        expect(result.system1).toBe(0.2);
      });

      it('should clamp modifiers to maximum 2.0', () => {
        const eraModifiers = {
          system1: 3.0 // Above maximum
        };

        const result = selector.calculateSystemModifiers(mockGraph, mockSystems, eraModifiers);

        expect(result.system1).toBe(2.0);
      });

      it('should not modify values within bounds', () => {
        const eraModifiers = {
          system1: 0.5,
          system2: 1.0,
          system3: 1.8
        };

        const result = selector.calculateSystemModifiers(mockGraph, mockSystems, eraModifiers);

        expect(result.system1).toBe(0.5);
        expect(result.system2).toBe(1.0);
        expect(result.system3).toBe(1.8);
      });

      it('should handle edge values exactly at bounds', () => {
        const eraModifiers = {
          system1: 0.2, // Exactly at minimum
          system2: 2.0  // Exactly at maximum
        };

        const result = selector.calculateSystemModifiers(mockGraph, mockSystems, eraModifiers);

        expect(result.system1).toBe(0.2);
        expect(result.system2).toBe(2.0);
      });
    });

    describe('edge cases', () => {
      it('should handle graph with no relationships', () => {
        const emptyGraph = {
          ...mockGraph,
          relationships: []
        };

        const eraModifiers = { system1: 1.0 };
        const result = selector.calculateSystemModifiers(
          emptyGraph,
          mockSystems,
          eraModifiers
        );

        expect(result).toBeDefined();
        expect(Object.keys(result).length).toBe(3);
      });

      it('should handle graph with no entities', () => {
        const emptyGraph = {
          ...mockGraph,
          entities: new Map(),
          relationships: []
        };

        const eraModifiers = { system1: 1.0 };

        expect(() => {
          selector.calculateSystemModifiers(emptyGraph, mockSystems, eraModifiers);
        }).not.toThrow();
      });

      it('should handle negative era modifiers', () => {
        const eraModifiers = {
          system1: -1.0,
          system2: 1.0
        };

        const result = selector.calculateSystemModifiers(
          mockGraph,
          mockSystems,
          eraModifiers
        );

        // Should clamp to minimum
        expect(result.system1).toBe(0.2);
        expect(result.system2).toBe(1.0);
      });

      it('should handle very large era modifiers', () => {
        const eraModifiers = {
          system1: 100.0,
          system2: 1.0
        };

        const result = selector.calculateSystemModifiers(
          mockGraph,
          mockSystems,
          eraModifiers
        );

        // Should clamp to maximum
        expect(result.system1).toBe(2.0);
      });

      it('should handle zero era modifiers', () => {
        const eraModifiers = {
          system1: 0,
          system2: 1.0
        };

        const result = selector.calculateSystemModifiers(
          mockGraph,
          mockSystems,
          eraModifiers
        );

        // Should clamp to minimum
        expect(result.system1).toBe(0.2);
        expect(result.system2).toBe(1.0);
      });
    });

    describe('deterministic behavior', () => {
      it('should provide deterministic results for same input', () => {
        const eraModifiers = {
          system1: 1.0,
          system2: 1.5,
          system3: 0.5
        };

        const result1 = selector.calculateSystemModifiers(
          mockGraph,
          mockSystems,
          eraModifiers
        );

        const result2 = selector.calculateSystemModifiers(
          mockGraph,
          mockSystems,
          eraModifiers
        );

        expect(result1).toEqual(result2);
      });

      it('should maintain system ordering when modifiers are similar', () => {
        const identicalSystems = [
          createMockSystem('sys_a'),
          createMockSystem('sys_b'),
          createMockSystem('sys_c')
        ];

        const eraModifiers = {
          sys_a: 1.0,
          sys_b: 1.0,
          sys_c: 1.0
        };

        const result = selector.calculateSystemModifiers(
          mockGraph,
          identicalSystems,
          eraModifiers
        );

        expect(result.sys_a).toBe(result.sys_b);
        expect(result.sys_b).toBe(result.sys_c);
      });
    });
  });

  describe('getState', () => {
    it('should return current distribution state', () => {
      const state = selector.getState(mockGraph);

      expect(state).toBeDefined();
      expect(state.tick).toBe(100);
      expect(state.totalEntities).toBe(5);
    });

    it('should calculate entity counts correctly', () => {
      const state = selector.getState(mockGraph);

      expect(state.entityKindCounts).toBeDefined();
      expect(state.entityKindCounts.npc).toBe(3);
      expect(state.entityKindCounts.location).toBe(1);
      expect(state.entityKindCounts.faction).toBe(1);
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

    it('should calculate relationship metrics', () => {
      const deviation = selector.getDeviation(mockGraph);

      expect(deviation.relationship.score).toBeGreaterThanOrEqual(0);
      expect(deviation.relationship.typesPresent).toBeGreaterThan(0);
    });
  });

  describe('integration scenarios', () => {
    it('should handle realistic world generation scenario', () => {
      const realisticSystems = [
        createMockSystem('social_bonds'),
        createMockSystem('hierarchy'),
        createMockSystem('conflict')
      ];

      const eraModifiers = {
        social_bonds: 1.2,
        hierarchy: 0.8,
        conflict: 1.5
      };

      const result = selector.calculateSystemModifiers(
        mockGraph,
        realisticSystems,
        eraModifiers
      );

      expect(Object.keys(result).length).toBe(3);
      expect(result.social_bonds).toBe(1.2);
      expect(result.hierarchy).toBe(0.8);
      expect(result.conflict).toBe(1.5);

      // All should be within bounds
      Object.values(result).forEach(modifier => {
        expect(modifier).toBeGreaterThanOrEqual(0.2);
        expect(modifier).toBeLessThanOrEqual(2.0);
      });
    });
  });
});
