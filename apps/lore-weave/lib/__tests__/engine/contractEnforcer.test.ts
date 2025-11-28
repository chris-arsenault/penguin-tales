// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContractEnforcer } from '../../engine/contractEnforcer';
import { Graph, GrowthTemplate, EngineConfig, ComponentContract, EntityRegistry } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { TemplateGraphView } from '../../graph/templateGraphView';

// Mock dependencies
vi.mock('../../statistics/tagHealthAnalyzer');
vi.mock('../../config/tagRegistry');

describe('ContractEnforcer', () => {
  let enforcer: ContractEnforcer;
  let mockConfig: EngineConfig;
  let mockGraph: Graph;
  let mockGraphView: TemplateGraphView;

  beforeEach(() => {
    // Setup mock config
    mockConfig = {
      domain: {} as any,
      templates: [],
      systems: [],
      feedbackLoops: [],
      entityRegistries: [],
      epochLength: 20,
      simulationTicksPerGrowth: 10,
      targetEntitiesPerKind: 30,
      maxTicks: 500
    };

    // Setup mock graph with mutation methods
    const _entities = new Map<string, HardState>();
    let _relationships: Relationship[] = [];

    mockGraph = {
      tick: 0,
      epoch: 0,
      currentEra: { id: 'expansion', name: 'Expansion Era' } as any,
      pressures: new Map<string, number>(),
      history: [],
      tagIndex: new Map(),
      relationshipIndex: new Map(),
      config: {} as any,

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
        return Array.from(_entities.values()).map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
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
            if (criteria.tag && !(criteria.tag in e.tags)) return false;
            if (criteria.exclude && criteria.exclude.includes(e.id)) return false;
            return true;
          })
          .map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
      },
      getEntitiesByKind(kind: string): HardState[] {
        return Array.from(_entities.values())
          .filter(e => e.kind === kind)
          .map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
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
          .map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
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
      addRelationship(kind: string, srcId: string, dstId: string, strength?: number, distance?: number, category?: string): void {
        const relationship: Relationship = { kind, src: srcId, dst: dstId, strength, distance, category };
        _relationships.push(relationship);
        const srcEntity = _entities.get(srcId);
        if (srcEntity) {
          srcEntity.links.push({ ...relationship });
          srcEntity.updatedAt = this.tick;
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

      // Keep backward compatibility for tests
      get entities() { return _entities; },
      get relationships() { return _relationships; },
      set relationships(rels: Relationship[]) { _relationships = rels; }
    } as Graph;

    // Setup mock graph view
    mockGraphView = {
      query: vi.fn(),
      getRelated: vi.fn(),
      hasRelationship: vi.fn(),
      countEntities: vi.fn(),
      getEntityById: vi.fn()
    } as any;

    enforcer = new ContractEnforcer(mockConfig);
  });

  describe('checkContractEnabledBy', () => {
    it('should allow templates without contracts', () => {
      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' })
      };

      const result = enforcer.checkContractEnabledBy(template, mockGraph, mockGraphView);
      expect(result.allowed).toBe(true);
    });

    it('should allow templates without enabledBy conditions', () => {
      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {} as ComponentContract
      };

      const result = enforcer.checkContractEnabledBy(template, mockGraph, mockGraphView);
      expect(result.allowed).toBe(true);
    });

    it('should check pressure thresholds', () => {
      mockGraph.pressures.set('conflict', 30);

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          enabledBy: {
            pressures: [{ name: 'conflict', threshold: 50 }]
          }
        } as ComponentContract
      };

      const result = enforcer.checkContractEnabledBy(template, mockGraph, mockGraphView);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('conflict');
      expect(result.reason).toContain('30');
      expect(result.reason).toContain('50');
    });

    it('should allow templates when pressure exceeds threshold', () => {
      mockGraph.pressures.set('conflict', 75);

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          enabledBy: {
            pressures: [{ name: 'conflict', threshold: 50 }]
          }
        } as ComponentContract
      };

      const result = enforcer.checkContractEnabledBy(template, mockGraph, mockGraphView);
      expect(result.allowed).toBe(true);
    });

    it('should check entity count requirements - minimum', () => {
      // Add 2 NPCs to graph
      mockGraph.setEntity('npc1', { id: 'npc1', kind: 'npc', tags: {}, links: [] } as HardState);
      mockGraph.setEntity('npc2', { id: 'npc2', kind: 'npc', tags: {}, links: [] } as HardState);

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          enabledBy: {
            entityCounts: [{ kind: 'npc', min: 5 }]
          }
        } as ComponentContract
      };

      const result = enforcer.checkContractEnabledBy(template, mockGraph, mockGraphView);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Need 5 npc');
      expect(result.reason).toContain('have 2');
    });

    it('should check entity count requirements - maximum', () => {
      // Add 10 NPCs to graph
      for (let i = 0; i < 10; i++) {
        mockGraph.setEntity(`npc${i}`, { id: `npc${i}`, kind: 'npc', tags: {}, links: [] } as HardState);
      }

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          enabledBy: {
            entityCounts: [{ kind: 'npc', min: 1, max: 5 }]
          }
        } as ComponentContract
      };

      const result = enforcer.checkContractEnabledBy(template, mockGraph, mockGraphView);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Too many npc');
      expect(result.reason).toContain('10 > 5');
    });

    it('should check entity subtype requirements', () => {
      mockGraph.setEntity('npc1', { id: 'npc1', kind: 'npc', subtype: 'merchant', tags: {}, links: [] } as HardState);
      mockGraph.setEntity('npc2', { id: 'npc2', kind: 'npc', subtype: 'warrior', tags: {}, links: [] } as HardState);

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          enabledBy: {
            entityCounts: [{ kind: 'npc', subtype: 'merchant', min: 3 }]
          }
        } as ComponentContract
      };

      const result = enforcer.checkContractEnabledBy(template, mockGraph, mockGraphView);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('npc:merchant');
    });

    it('should check era restrictions', () => {
      mockGraph.currentEra = { id: 'conflict', name: 'Conflict Era' } as any;

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          enabledBy: {
            era: ['expansion', 'innovation']
          }
        } as ComponentContract
      };

      const result = enforcer.checkContractEnabledBy(template, mockGraph, mockGraphView);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('conflict');
      expect(result.reason).toContain('expansion, innovation');
    });

    it('should allow template in correct era', () => {
      mockGraph.currentEra = { id: 'expansion', name: 'Expansion Era' } as any;

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          enabledBy: {
            era: ['expansion', 'innovation']
          }
        } as ComponentContract
      };

      const result = enforcer.checkContractEnabledBy(template, mockGraph, mockGraphView);
      expect(result.allowed).toBe(true);
    });

    it('should check custom conditions', () => {
      const customCondition = vi.fn().mockReturnValue(false);

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          enabledBy: {
            custom: customCondition
          }
        } as ComponentContract
      };

      const result = enforcer.checkContractEnabledBy(template, mockGraph, mockGraphView);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Custom enabledBy condition failed');
      expect(customCondition).toHaveBeenCalledWith(mockGraphView);
    });

    it('should pass when custom condition returns true', () => {
      const customCondition = vi.fn().mockReturnValue(true);

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          enabledBy: {
            custom: customCondition
          }
        } as ComponentContract
      };

      const result = enforcer.checkContractEnabledBy(template, mockGraph, mockGraphView);
      expect(result.allowed).toBe(true);
    });

    it('should check multiple conditions (all must pass)', () => {
      mockGraph.pressures.set('conflict', 60);
      mockGraph.setEntity('npc1', { id: 'npc1', kind: 'npc', tags: {}, links: [] } as HardState);
      mockGraph.currentEra = { id: 'conflict', name: 'Conflict Era' } as any;

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          enabledBy: {
            pressures: [{ name: 'conflict', threshold: 50 }],
            entityCounts: [{ kind: 'npc', min: 1 }],
            era: ['conflict']
          }
        } as ComponentContract
      };

      const result = enforcer.checkContractEnabledBy(template, mockGraph, mockGraphView);
      expect(result.allowed).toBe(true);
    });
  });

  describe('enforceLineage', () => {
    it('should return empty array when no registries configured', () => {
      const newEntities: HardState[] = [
        { id: 'entity1', kind: 'npc', tags: {}, links: [] } as HardState
      ];

      const result = enforcer.enforceLineage(mockGraph, mockGraphView, newEntities);
      expect(result).toEqual([]);
    });

    it('should return empty array when registry has no lineage', () => {
      mockConfig.entityRegistries = [
        { kind: 'npc', expectedDistribution: { targetCount: 10 } }
      ];

      const newEntities: HardState[] = [
        { id: 'entity1', kind: 'npc', tags: {}, links: [] } as HardState
      ];

      const result = enforcer.enforceLineage(mockGraph, mockGraphView, newEntities);
      expect(result).toEqual([]);
    });

    it('should add lineage relationship when ancestor found', () => {
      const ancestor: HardState = { id: 'ancestor1', kind: 'npc', tags: {}, links: [] } as HardState;

      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          expectedDistribution: { targetCount: 10 },
          lineage: {
            relationshipKind: 'derived_from',
            findAncestor: vi.fn().mockReturnValue(ancestor),
            distanceRange: { min: 1, max: 5 }
          }
        }
      ];

      const newEntities: HardState[] = [
        { id: 'entity1', kind: 'npc', tags: {}, links: [] } as HardState
      ];

      const result = enforcer.enforceLineage(mockGraph, mockGraphView, newEntities);

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('derived_from');
      expect(result[0].src).toBe('entity1');
      expect(result[0].dst).toBe('ancestor1');
      expect(result[0].distance).toBeGreaterThanOrEqual(1);
      expect(result[0].distance).toBeLessThanOrEqual(5);
    });

    it('should not add lineage when ancestor not found', () => {
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          expectedDistribution: { targetCount: 10 },
          lineage: {
            relationshipKind: 'derived_from',
            findAncestor: vi.fn().mockReturnValue(null),
            distanceRange: { min: 1, max: 5 }
          }
        }
      ];

      const newEntities: HardState[] = [
        { id: 'entity1', kind: 'npc', tags: {}, links: [] } as HardState
      ];

      const result = enforcer.enforceLineage(mockGraph, mockGraphView, newEntities);
      expect(result).toEqual([]);
    });

    it('should process multiple entities with different kinds', () => {
      const npcAncestor: HardState = { id: 'npc_ancestor', kind: 'npc' } as HardState;
      const factionAncestor: HardState = { id: 'faction_ancestor', kind: 'faction' } as HardState;

      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          expectedDistribution: { targetCount: 10 },
          lineage: {
            relationshipKind: 'child_of',
            findAncestor: vi.fn().mockReturnValue(npcAncestor),
            distanceRange: { min: 1, max: 2 }
          }
        },
        {
          kind: 'faction',
          expectedDistribution: { targetCount: 5 },
          lineage: {
            relationshipKind: 'split_from',
            findAncestor: vi.fn().mockReturnValue(factionAncestor),
            distanceRange: { min: 0, max: 1 }
          }
        }
      ];

      const newEntities: HardState[] = [
        { id: 'entity1', kind: 'npc', tags: {}, links: [] } as HardState,
        { id: 'entity2', kind: 'faction', tags: {}, links: [] } as HardState
      ];

      const result = enforcer.enforceLineage(mockGraph, mockGraphView, newEntities);

      expect(result).toHaveLength(2);
      expect(result[0].kind).toBe('child_of');
      expect(result[1].kind).toBe('split_from');
    });
  });

  describe('checkSaturation', () => {
    it('should return not saturated when template has no metadata', () => {
      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' })
      };

      const result = enforcer.checkSaturation(template, mockGraph);
      expect(result.saturated).toBe(false);
    });

    it('should return not saturated when template metadata has no entityKinds', () => {
      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        metadata: { produces: {} } as any
      };

      const result = enforcer.checkSaturation(template, mockGraph);
      expect(result.saturated).toBe(false);
    });

    it('should return not saturated when no registries configured', () => {
      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        metadata: {
          produces: {
            entityKinds: [{ kind: 'npc' }]
          }
        } as any
      };

      const result = enforcer.checkSaturation(template, mockGraph);
      expect(result.saturated).toBe(false);
    });

    it('should return saturated when entity count exceeds 2x target', () => {
      // Add 20 NPCs (target is 10, threshold is 20)
      for (let i = 0; i < 20; i++) {
        mockGraph.setEntity(`npc${i}`, { id: `npc${i}`, kind: 'npc', tags: {}, links: [] } as HardState);
      }

      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          expectedDistribution: { targetCount: 10 }
        }
      ];

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        metadata: {
          produces: {
            entityKinds: [{ kind: 'npc' }]
          }
        } as any
      };

      const result = enforcer.checkSaturation(template, mockGraph);
      expect(result.saturated).toBe(true);
      expect(result.reason).toContain('npc');
      expect(result.reason).toContain('20');
    });

    it('should return not saturated when count is below 2x target', () => {
      // Add 15 NPCs (target is 10, threshold is 20)
      for (let i = 0; i < 15; i++) {
        mockGraph.setEntity(`npc${i}`, { id: `npc${i}`, kind: 'npc', tags: {}, links: [] } as HardState);
      }

      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          expectedDistribution: { targetCount: 10 }
        }
      ];

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        metadata: {
          produces: {
            entityKinds: [{ kind: 'npc' }]
          }
        } as any
      };

      const result = enforcer.checkSaturation(template, mockGraph);
      expect(result.saturated).toBe(false);
    });

    it('should check subtype-specific saturation', () => {
      // Add 30 merchant NPCs
      for (let i = 0; i < 30; i++) {
        mockGraph.setEntity(`npc${i}`, {
          id: `npc${i}`,
          kind: 'npc',
          subtype: 'merchant'
        } as HardState);
      }

      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          subtype: 'merchant',
          expectedDistribution: { targetCount: 10 }
        }
      ];

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        metadata: {
          produces: {
            entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
          }
        } as any
      };

      const result = enforcer.checkSaturation(template, mockGraph);
      expect(result.saturated).toBe(true);
      expect(result.reason).toContain('npc:merchant');
    });

    it('should allow template if at least one kind is unsaturated', () => {
      // Add 20 NPCs (saturated)
      for (let i = 0; i < 20; i++) {
        mockGraph.setEntity(`npc${i}`, { id: `npc${i}`, kind: 'npc', tags: {}, links: [] } as HardState);
      }
      // Add 5 factions (not saturated)
      for (let i = 0; i < 5; i++) {
        mockGraph.setEntity(`faction${i}`, { id: `faction${i}`, kind: 'faction' } as HardState);
      }

      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          expectedDistribution: { targetCount: 10 }
        },
        {
          kind: 'faction',
          expectedDistribution: { targetCount: 10 }
        }
      ];

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        metadata: {
          produces: {
            entityKinds: [{ kind: 'npc' }, { kind: 'faction' }]
          }
        } as any
      };

      const result = enforcer.checkSaturation(template, mockGraph);
      expect(result.saturated).toBe(false);
    });
  });

  describe('validateAffects', () => {
    it('should return no warnings when template has no contract', () => {
      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' })
      };

      const warnings = enforcer.validateAffects(template, 5, 10, new Map());
      expect(warnings).toEqual([]);
    });

    it('should return no warnings when contract has no affects', () => {
      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {} as ComponentContract
      };

      const warnings = enforcer.validateAffects(template, 5, 10, new Map());
      expect(warnings).toEqual([]);
    });

    it('should warn when too few entities created', () => {
      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          affects: {
            entities: [
              { operation: 'create', count: { min: 3, max: 5 } }
            ]
          }
        } as ComponentContract
      };

      const warnings = enforcer.validateAffects(template, 2, 0, new Map());
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('2 entities');
      expect(warnings[0]).toContain('min 3');
    });

    it('should warn when too many entities created', () => {
      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          affects: {
            entities: [
              { operation: 'create', count: { min: 3, max: 5 } }
            ]
          }
        } as ComponentContract
      };

      const warnings = enforcer.validateAffects(template, 8, 0, new Map());
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('8 entities');
      expect(warnings[0]).toContain('max 5');
    });

    it('should warn when relationships exceed expected (with 20% tolerance)', () => {
      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          affects: {
            relationships: [
              { operation: 'create', count: { min: 2, max: 5 } }
            ]
          }
        } as ComponentContract
      };

      // Max is 5, with 20% tolerance = 6, so 7 should warn
      const warnings = enforcer.validateAffects(template, 0, 7, new Map());
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('7 relationships');
    });

    it('should warn when pressure change direction is wrong', () => {
      const pressureChanges = new Map([['conflict', -10]]);

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          affects: {
            pressures: [
              { name: 'conflict', delta: 5 }
            ]
          }
        } as ComponentContract
      };

      const warnings = enforcer.validateAffects(template, 0, 0, pressureChanges);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('conflict');
      expect(warnings[0]).toContain('-10');
      expect(warnings[0]).toContain('5');
    });

    it('should not warn when pressure change matches direction', () => {
      const pressureChanges = new Map([['conflict', 8]]);

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          affects: {
            pressures: [
              { name: 'conflict', delta: 5 }
            ]
          }
        } as ComponentContract
      };

      const warnings = enforcer.validateAffects(template, 0, 0, pressureChanges);
      expect(warnings).toEqual([]);
    });
  });

  describe('getDiagnostic', () => {
    it('should provide comprehensive diagnostic output', () => {
      mockGraph.pressures.set('conflict', 30);
      mockGraph.setEntity('npc1', { id: 'npc1', kind: 'npc', tags: {}, links: [] } as HardState);

      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: vi.fn().mockReturnValue(true),
        findTargets: vi.fn().mockReturnValue([{ id: 'target1' }]),
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          enabledBy: {
            pressures: [{ name: 'conflict', threshold: 50 }]
          }
        } as ComponentContract
      };

      const diagnostic = enforcer.getDiagnostic(template, mockGraph, mockGraphView);

      expect(diagnostic).toContain('Contract:');
      expect(diagnostic).toContain('Saturation:');
      expect(diagnostic).toContain('canApply()');
      expect(diagnostic).toContain('Targets: 1');
    });
  });

  describe('getTagAnalyzer', () => {
    it('should return tag analyzer instance', () => {
      const analyzer = enforcer.getTagAnalyzer();
      expect(analyzer).toBeDefined();
    });
  });

  describe('enforceTagCoverage', () => {
    it('should accept entity with 3-5 tags', () => {
      const entity: HardState = {
        id: 'entity1',
        kind: 'npc',
        tags: { tag1: 'true', tag2: 'true', tag3: 'true', tag4: 'true' },
        links: []
      } as HardState;

      const result = enforcer.enforceTagCoverage(entity, mockGraph);
      expect(result.needsAdjustment).toBe(false);
    });

    it('should suggest adding tags when too few', () => {
      const entity: HardState = {
        id: 'entity1',
        kind: 'npc',
        name: 'Test Entity',
        tags: { tag1: 'true' },
        links: []
      } as HardState;

      const result = enforcer.enforceTagCoverage(entity, mockGraph);
      expect(result.needsAdjustment).toBe(true);
      expect(result.suggestion).toContain('only 1 tags');
      expect(result.suggestion).toContain('needs 2 more');
    });

    it('should suggest removing tags when too many', () => {
      const entity: HardState = {
        id: 'entity1',
        kind: 'npc',
        name: 'Test Entity',
        tags: { tag1: 'true', tag2: 'true', tag3: 'true', tag4: 'true', tag5: 'true', tag6: 'true', tag7: 'true' },
        links: []
      } as HardState;

      const result = enforcer.enforceTagCoverage(entity, mockGraph);
      expect(result.needsAdjustment).toBe(true);
      expect(result.suggestion).toContain('7 tags');
      expect(result.suggestion).toContain('should remove 2');
      expect(result.tagsToRemove).toEqual(['tag6', 'tag7']);
    });
  });

  describe('edge cases', () => {
    it('should handle empty graph gracefully', () => {
      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          enabledBy: {
            entityCounts: [{ kind: 'npc', min: 1 }]
          }
        } as ComponentContract
      };

      const result = enforcer.checkContractEnabledBy(template, mockGraph, mockGraphView);
      expect(result.allowed).toBe(false);
    });

    it('should handle undefined pressure gracefully', () => {
      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: {
          enabledBy: {
            pressures: [{ name: 'nonexistent', threshold: 50 }]
          }
        } as ComponentContract
      };

      const result = enforcer.checkContractEnabledBy(template, mockGraph, mockGraphView);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('nonexistent');
      expect(result.reason).toContain('0');
    });

    it('should handle null/undefined template contract gracefully', () => {
      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: () => true,
        expand: () => ({ entities: [], relationships: [], description: '' }),
        contract: null as any
      };

      const result = enforcer.checkContractEnabledBy(template, mockGraph, mockGraphView);
      expect(result.allowed).toBe(true);
    });
  });
});
