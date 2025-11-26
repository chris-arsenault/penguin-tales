// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContractEnforcer } from '../../engine/contractEnforcer';
import { Graph, GrowthTemplate, EngineConfig, ComponentContract, EntityRegistry } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { TemplateGraphView } from '../../services/templateGraphView';

// Mock dependencies
vi.mock('../../services/tagHealthAnalyzer');
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

    // Setup mock graph
    mockGraph = {
      entities: new Map<string, HardState>(),
      relationships: [],
      tick: 0,
      epoch: 0,
      currentEra: { id: 'expansion', name: 'Expansion Era' } as any,
      pressures: new Map<string, number>(),
      history: [],
      tagIndex: new Map(),
      relationshipIndex: new Map()
    };

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
      mockGraph.entities.set('npc1', { id: 'npc1', kind: 'npc' } as HardState);
      mockGraph.entities.set('npc2', { id: 'npc2', kind: 'npc' } as HardState);

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
        mockGraph.entities.set(`npc${i}`, { id: `npc${i}`, kind: 'npc' } as HardState);
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
      mockGraph.entities.set('npc1', { id: 'npc1', kind: 'npc', subtype: 'merchant' } as HardState);
      mockGraph.entities.set('npc2', { id: 'npc2', kind: 'npc', subtype: 'warrior' } as HardState);

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
      mockGraph.entities.set('npc1', { id: 'npc1', kind: 'npc' } as HardState);
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
        { id: 'entity1', kind: 'npc', tags: [], links: [] } as HardState
      ];

      const result = enforcer.enforceLineage(mockGraph, mockGraphView, newEntities);
      expect(result).toEqual([]);
    });

    it('should return empty array when registry has no lineage', () => {
      mockConfig.entityRegistries = [
        { kind: 'npc', expectedDistribution: { targetCount: 10 } }
      ];

      const newEntities: HardState[] = [
        { id: 'entity1', kind: 'npc', tags: [], links: [] } as HardState
      ];

      const result = enforcer.enforceLineage(mockGraph, mockGraphView, newEntities);
      expect(result).toEqual([]);
    });

    it('should add lineage relationship when ancestor found', () => {
      const ancestor: HardState = { id: 'ancestor1', kind: 'npc' } as HardState;

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
        { id: 'entity1', kind: 'npc', tags: [], links: [] } as HardState
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
        { id: 'entity1', kind: 'npc', tags: [], links: [] } as HardState
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
        { id: 'entity1', kind: 'npc', tags: [], links: [] } as HardState,
        { id: 'entity2', kind: 'faction', tags: [], links: [] } as HardState
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
        mockGraph.entities.set(`npc${i}`, { id: `npc${i}`, kind: 'npc' } as HardState);
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
        mockGraph.entities.set(`npc${i}`, { id: `npc${i}`, kind: 'npc' } as HardState);
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
        mockGraph.entities.set(`npc${i}`, {
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
        mockGraph.entities.set(`npc${i}`, { id: `npc${i}`, kind: 'npc' } as HardState);
      }
      // Add 5 factions (not saturated)
      for (let i = 0; i < 5; i++) {
        mockGraph.entities.set(`faction${i}`, { id: `faction${i}`, kind: 'faction' } as HardState);
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
      mockGraph.entities.set('npc1', { id: 'npc1', kind: 'npc' } as HardState);

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
        tags: ['tag1', 'tag2', 'tag3', 'tag4'],
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
        tags: ['tag1'],
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
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7'],
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
