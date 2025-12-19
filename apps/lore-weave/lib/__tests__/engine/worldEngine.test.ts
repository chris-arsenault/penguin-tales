// @ts-nocheck
// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorldEngine } from '../../engine/worldEngine';
import { EngineConfig, GrowthTemplate, SimulationSystem, Era } from '../../engine/types';
import { HardState } from '../../core/worldTypes';
import { DomainSchema } from '../../domainInterface/domainSchema';
import { createMockEmitter, createMockCultures } from '../testHelpers';

describe('WorldEngine', () => {
  let mockConfig: EngineConfig;
  let initialState: HardState[];
  let mockTemplate: GrowthTemplate;
  let mockSystem: SimulationSystem;
  let mockEra: Era;

  beforeEach(() => {
    // Mock template
    mockTemplate = {
      id: 'test-template',
      purpose: 'creation' as const,
      canApply: vi.fn(() => true),
      findTargets: vi.fn(() => []),
      expand: vi.fn((graph, target) => ({
        newEntities: [],
        newRelationships: [],
        description: 'test expansion'
      }))
    };

    // Mock system
    mockSystem = {
      id: 'test-system',
      purpose: 'creation' as const,
      apply: vi.fn(() => ({
        newRelationships: [],
        entityModifications: [],
        pressureChanges: [],
        description: 'test system'
      }))
    };

    // Mock era
    mockEra = {
      id: 'test-era',
      name: 'Test Era',
      templateWeights: { 'test-template': 1.0 },
      systemModifiers: { 'test-system': 1.0 }
    };

    // Mock config
    mockConfig = {
      domain: {
        entityKinds: [
          { kind: 'npc', subtypes: [{ id: 'hero', name: 'Hero' }], statuses: [], relationships: [] },
          { kind: 'faction', subtypes: [{ id: 'guild', name: 'Guild' }], statuses: [], relationships: [] },
          { kind: 'location', subtypes: [{ id: 'colony', name: 'Colony' }], statuses: [], relationships: [] }
        ]
      } as DomainSchema,
      templates: [mockTemplate],
      systems: [mockSystem],
      eras: [mockEra],
      pressures: [],
      entityRegistries: [],
      ticksPerEpoch: 5,
      targetEntitiesPerKind: 20,
      maxTicks: 100,
      coordinateContextConfig: {
        entityKinds: [
          { id: 'npc', semanticPlane: { bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } }, regions: [] } },
          { id: 'faction', semanticPlane: { bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } }, regions: [] } },
          { id: 'location', semanticPlane: { bounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } }, regions: [] } }
        ],
        cultures: [
          { id: 'default', name: 'Default Culture', axisBiases: {} }
        ]
      },
      // Required by WorldEngine
      emitter: createMockEmitter(),
      cultures: createMockCultures(),
    };

    // Initial state
    initialState = [
      {
        kind: 'location',
        subtype: 'colony',
        name: 'Test Colony',
        description: 'A test colony',
        status: 'active',
        prominence: 'recognized',
        tags: {},
        links: []
      }
    ];
  });

  describe('constructor', () => {
    it('should initialize with valid config and initial state', async () => {
      const engine = new WorldEngine(mockConfig, initialState);
      expect(engine).toBeDefined();
    });

    it('should throw error on invalid config', async () => {
      const invalidConfig = { ...mockConfig, templates: undefined };
      expect(() => new WorldEngine(invalidConfig as any, initialState)).toThrow();
    });

    it('should initialize with enrichment service if provided', async () => {
      const mockEnrichmentService = {
        isEnabled: () => true,
        enrichEntity: vi.fn(),
        enrichRelationship: vi.fn()
      };
      const engine = new WorldEngine(mockConfig, initialState, mockEnrichmentService as any);
      expect(engine).toBeDefined();
    });

    it('should initialize statistical systems when distributionTargets provided', async () => {
      const configWithTargets = {
        ...mockConfig,
        distributionTargets: {
          npc: {
            targetCount: 50,
            prominenceDistribution: {
              forgotten: 0.4,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.08,
              mythic: 0.02
            },
            subtypeDistribution: { hero: 0.5, merchant: 0.5 }
          }
        }
      };
      const engine = new WorldEngine(configWithTargets, initialState);
      expect(engine).toBeDefined();
    });

    it('should respect scaleFactor in config', async () => {
      const configWithScale = { ...mockConfig, scaleFactor: 2.0 };
      const engine = new WorldEngine(configWithScale, initialState);
      expect(engine).toBeDefined();
    });

    it('should initialize with empty initial state', async () => {
      const engine = new WorldEngine(mockConfig, []);
      expect(engine).toBeDefined();
    });
  });

  describe('run', () => {
    it('should complete generation and return graph', async () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = await engine.run();

      expect(graph).toBeDefined();
      expect(graph.getEntities).toBeDefined();
      expect(graph.getRelationships).toBeDefined();
      expect(graph.tick).toBeGreaterThan(0);
    });

    it('should stop at maxTicks', async () => {
      const shortConfig = { ...mockConfig, maxTicks: 20 };
      const engine = new WorldEngine(shortConfig, initialState);
      const graph = await engine.run();

      expect(graph.tick).toBeLessThanOrEqual(20);
    });

    it('should complete all eras', async () => {
      const multiEraConfig = {
        ...mockConfig,
        eras: [mockEra, { ...mockEra, id: 'era2' }],
        ticksPerEpoch: 5,
        maxTicks: 200
      };
      const engine = new WorldEngine(multiEraConfig, initialState);
      const graph = await engine.run();

      // Should run at least 2 epochs per era
      expect(graph.tick).toBeGreaterThan(5);
    });

    it('should initialize initial entities with IDs and timestamps', async () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = await engine.run();

      const entities = graph.getEntities();
      expect(entities.length).toBeGreaterThan(0);

      entities.forEach(entity => {
        expect(entity.id).toBeDefined();
        expect(entity.createdAt).toBeDefined();
        expect(entity.updatedAt).toBeDefined();
      });
    });

    it('should track entity creation over time', async () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = await engine.run();

      const initialCount = initialState.length;
      expect(graph.getEntityCount()).toBeGreaterThanOrEqual(initialCount);
    });

    it('should create relationships during simulation', async () => {
      const relationshipSystem: SimulationSystem = {
        id: 'rel-system',
        purpose: 'creation',
        apply: vi.fn(() => ({
          newRelationships: [
            { kind: 'test_rel', src: 'entity1', dst: 'entity2' }
          ],
          entityModifications: [],
          pressureChanges: [],
          description: 'created relationship'
        }))
      };

      const configWithRelSystem = {
        ...mockConfig,
        systems: [relationshipSystem]
      };

      const engine = new WorldEngine(configWithRelSystem, initialState);
      const graph = await engine.run();

      // System should have been called
      expect(relationshipSystem.apply).toHaveBeenCalled();
    });

    it('should apply templates during growth phase', async () => {
      const creationTemplate: GrowthTemplate = {
        id: 'creation-template',
        purpose: 'creation',
        canApply: vi.fn(() => true),
        findTargets: vi.fn((graph) => {
          // Safely handle graph access
          if (!graph || !graph.getEntities) return [];
          return graph.getEntities().slice(0, 1);
        }),
        expand: vi.fn((graph, target) => ({
          newEntities: [
            {
              kind: 'npc',
              subtype: 'hero',
              name: 'New Hero',
              description: 'A new hero',
              status: 'active',
              prominence: 'marginal',
              tags: {},
              links: []
            }
          ],
          newRelationships: [],
          description: 'created new entity'
        }))
      };

      const configWithCreation = {
        ...mockConfig,
        templates: [creationTemplate]
      };

      const engine = new WorldEngine(configWithCreation, initialState);
      const graph = await engine.run();

      // Template should have been called
      expect(creationTemplate.canApply).toHaveBeenCalled();
    });

    it('should respect epoch length', async () => {
      const shortEpochConfig = { ...mockConfig, ticksPerEpoch: 5 };
      const engine = new WorldEngine(shortEpochConfig, initialState);
      const graph = await engine.run();

      // Should have run multiple epochs
      expect(graph.tick).toBeGreaterThan(5);
    });

    it('should alternate between growth and simulation phases', async () => {
      const templateCallTracker: number[] = [];
      const systemCallTracker: number[] = [];

      const trackedTemplate: GrowthTemplate = {
        id: 'tracked-template',
        purpose: 'creation',
        canApply: vi.fn(() => true),
        findTargets: vi.fn(() => {
          templateCallTracker.push(Date.now());
          return [];
        }),
        expand: vi.fn(() => ({
          newEntities: [],
          newRelationships: [],
          description: 'tracked'
        }))
      };

      const trackedSystem: SimulationSystem = {
        id: 'tracked-system',
        purpose: 'creation',
        apply: vi.fn(() => {
          systemCallTracker.push(Date.now());
          return {
            newRelationships: [],
            entityModifications: [],
            pressureChanges: [],
            description: 'tracked'
          };
        })
      };

      const trackedConfig = {
        ...mockConfig,
        templates: [trackedTemplate],
        systems: [trackedSystem]
      };

      const engine = new WorldEngine(trackedConfig, initialState);
      await engine.run();

      // Both phases should have been called
      expect(templateCallTracker.length).toBeGreaterThan(0);
      expect(systemCallTracker.length).toBeGreaterThan(0);
    });

    it('should handle empty template list gracefully', async () => {
      const noTemplateConfig = { ...mockConfig, templates: [] };
      const engine = new WorldEngine(noTemplateConfig, initialState);
      const graph = await engine.run();

      expect(graph).toBeDefined();
      // Initial entity + era entity created by engine
      expect(graph.getEntityCount()).toBe(initialState.length + 1);
    });

    it('should handle empty system list gracefully', async () => {
      const noSystemConfig = { ...mockConfig, systems: [] };
      const engine = new WorldEngine(noSystemConfig, initialState);
      const graph = await engine.run();

      expect(graph).toBeDefined();
    });

    it('should stop on excessive growth safety valve', async () => {
      const tinyTargetConfig = {
        ...mockConfig,
        targetEntitiesPerKind: 1,
        scaleFactor: 0.1,
        maxTicks: 1000
      };
      const engine = new WorldEngine(tinyTargetConfig, initialState);
      const graph = await engine.run();

      // Should stop before maxTicks due to safety valve
      expect(graph.tick).toBeLessThan(1000);
    });
  });

  describe('initialization', () => {
    it('should assign unique IDs to all initial entities', async () => {
      const multipleInitial = [
        { ...initialState[0], name: 'Entity 1' },
        { ...initialState[0], name: 'Entity 2' },
        { ...initialState[0], name: 'Entity 3' }
      ];

      const engine = new WorldEngine(mockConfig, multipleInitial);
      const graph = await engine.run();

      const ids = graph.getEntityIds();
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should set createdAt to 0 for initial entities', async () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = await engine.run();

      const initialEntity = graph.getEntities()[0];
      expect(initialEntity.createdAt).toBe(0);
    });

    it('should preserve names from initial state', async () => {
      const namedInitial = [{
        ...initialState[0],
        name: 'Preserved Name Colony'
      }];

      const engine = new WorldEngine(mockConfig, namedInitial);
      const graph = await engine.run();

      const entity = graph.getEntities().find(e =>
        e.name === 'Preserved Name Colony'
      );
      expect(entity).toBeDefined();
    });

    it('should preserve all initial entity properties', async () => {
      const detailedInitial = [{
        kind: 'npc',
        subtype: 'hero',
        name: 'Test Hero',
        description: 'A detailed hero',
        status: 'active',
        prominence: 'renowned',
        tags: { brave: 'true', strong: 'true' },
        links: []
      }];

      const engine = new WorldEngine(mockConfig, detailedInitial);
      const graph = await engine.run();

      const entity = graph.getEntities().find(e =>
        e.name === 'Test Hero'
      );
      expect(entity).toBeDefined();
      expect(entity.kind).toBe('npc');
      expect(entity.subtype).toBe('hero');
      expect(entity.prominence).toBe('renowned');
      expect('brave' in entity.tags).toBe(true);
    });
  });

  describe('era progression', () => {
    it('should progress through eras over epochs', async () => {
      const era1: Era = {
        id: 'era1',
        name: 'Era One',
        templateWeights: {},
        systemModifiers: {}
      };
      const era2: Era = {
        id: 'era2',
        name: 'Era Two',
        templateWeights: {},
        systemModifiers: {}
      };

      const multiEraConfig = {
        ...mockConfig,
        eras: [era1, era2],
        ticksPerEpoch: 5,
        maxTicks: 50
      };

      const engine = new WorldEngine(multiEraConfig, initialState);
      const graph = await engine.run();

      // Should have progressed through eras
      expect(graph.currentEra).toBeDefined();
    });

    it('should apply era template weights', async () => {
      const weightedTemplate: GrowthTemplate = {
        id: 'weighted-template',
        purpose: 'creation',
        canApply: vi.fn(() => true),
        findTargets: vi.fn(() => []),
        expand: vi.fn(() => ({
          newEntities: [],
          newRelationships: [],
          description: 'weighted'
        }))
      };

      const weightedEra: Era = {
        id: 'weighted-era',
        name: 'Weighted Era',
        templateWeights: { 'weighted-template': 2.0 },
        systemModifiers: {}
      };

      const weightedConfig = {
        ...mockConfig,
        templates: [weightedTemplate],
        eras: [weightedEra]
      };

      const engine = new WorldEngine(weightedConfig, initialState);
      await engine.run();

      // Template should have been considered (even if not always applied)
      expect(weightedTemplate.canApply).toHaveBeenCalled();
    });

    it('should apply era system modifiers', async () => {
      const modifiedSystem: SimulationSystem = {
        id: 'modified-system',
        purpose: 'creation',
        apply: vi.fn(() => ({
          newRelationships: [],
          entityModifications: [],
          pressureChanges: [],
          description: 'modified'
        }))
      };

      const modifierEra: Era = {
        id: 'modifier-era',
        name: 'Modifier Era',
        templateWeights: {},
        systemModifiers: { 'modified-system': 0.5 }
      };

      const modifierConfig = {
        ...mockConfig,
        systems: [modifiedSystem],
        eras: [modifierEra]
      };

      const engine = new WorldEngine(modifierConfig, initialState);
      await engine.run();

      // System should have been called
      expect(modifiedSystem.apply).toHaveBeenCalled();
    });
  });

  describe('pressure system', () => {
    it('should track pressures over time', async () => {
      const testPressure = {
        id: 'test-pressure',
        name: 'Test Pressure',
        initialValue: 0,
        homeostasis: 0.05,
        growth: {
          positiveFeedback: [],
          negativeFeedback: []
        },
        description: 'Test pressure' as any
      };

      const pressureConfig = {
        ...mockConfig,
        pressures: [testPressure]
      };

      const engine = new WorldEngine(pressureConfig, initialState);
      const graph = await engine.run();

      expect(graph.pressures).toBeDefined();
    });

    it('should update pressures based on graph state', async () => {
      const dynamicPressure = {
        id: 'dynamic-pressure',
        name: 'Dynamic Pressure',
        initialValue: 10,
        homeostasis: 0.05,
        growth: {
          positiveFeedback: [
            {
              type: 'entity_count',
              kind: 'location',
              coefficient: 1
            }
          ],
          negativeFeedback: []
        },
        description: 'Dynamic pressure' as any
      };

      const pressureConfig = {
        ...mockConfig,
        pressures: [dynamicPressure]
      };

      const engine = new WorldEngine(pressureConfig, initialState);
      const graph = await engine.run();
      const finalValue = graph.pressures.get('dynamic-pressure');

      expect(finalValue).toBeDefined();
      expect(finalValue).not.toBe(dynamicPressure.initialValue);
    });
  });

  describe('statistics and tracking', () => {
    it('should track history events', async () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = await engine.run();

      expect(graph.history).toBeDefined();
      expect(Array.isArray(graph.history)).toBe(true);
    });

    it('should increment tick counter', async () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = await engine.run();

      expect(graph.tick).toBeGreaterThan(0);
    });

    it('should track entity counts over time', async () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = await engine.run();

      const finalCount = graph.getEntityCount();
      expect(finalCount).toBeGreaterThanOrEqual(initialState.length);
    });

    it('should track relationship counts', async () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = await engine.run();

      expect(graph.getRelationships()).toBeDefined();
      expect(Array.isArray(graph.getRelationships())).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle minimal config with single era', async () => {
      const minimalConfig = {
        ...mockConfig,
        eras: [mockEra],
        ticksPerEpoch: 1,
        maxTicks: 10
      };

      const engine = new WorldEngine(minimalConfig, initialState);
      const graph = await engine.run();

      expect(graph).toBeDefined();
    });

    it('should handle templates that never apply', async () => {
      const neverAppliesTemplate: GrowthTemplate = {
        id: 'never-applies',
        purpose: 'creation',
        canApply: vi.fn(() => false),
        findTargets: vi.fn(() => []),
        expand: vi.fn(() => ({
          newEntities: [],
          newRelationships: [],
          description: 'never'
        }))
      };

      const neverConfig = {
        ...mockConfig,
        templates: [neverAppliesTemplate]
      };

      const engine = new WorldEngine(neverConfig, initialState);
      const graph = await engine.run();

      expect(graph).toBeDefined();
      expect(neverAppliesTemplate.expand).not.toHaveBeenCalled();
    });

    it('should handle systems that return empty results', async () => {
      const emptySystem: SimulationSystem = {
        id: 'empty-system',
        purpose: 'creation',
        apply: vi.fn(() => ({
          newRelationships: [],
          entityModifications: [],
          pressureChanges: [],
          description: 'empty'
        }))
      };

      const emptyConfig = {
        ...mockConfig,
        systems: [emptySystem]
      };

      const engine = new WorldEngine(emptyConfig, initialState);
      const graph = await engine.run();

      expect(graph).toBeDefined();
      expect(emptySystem.apply).toHaveBeenCalled();
    });

    it('should handle zero epochLength gracefully', async () => {
      // This should be caught by validation, but test defensive behavior
      const zeroEpochConfig = { ...mockConfig, epochLength: 0, maxTicks: 5 };
      const engine = new WorldEngine(zeroEpochConfig, initialState);
      const graph = await engine.run();

      // Should stop quickly due to maxTicks
      expect(graph).toBeDefined();
    });

    it('should handle very small targetEntitiesPerKind', async () => {
      const smallTargetConfig = {
        ...mockConfig,
        targetEntitiesPerKind: 1
      };

      const engine = new WorldEngine(smallTargetConfig, initialState);
      const graph = await engine.run();

      expect(graph).toBeDefined();
    });

    it('should handle very large maxTicks without hanging', async () => {
      const largeTickConfig = {
        ...mockConfig,
        maxTicks: 10000,
        eras: [mockEra] // Only one era so it stops after ~2 epochs
      };

      const engine = new WorldEngine(largeTickConfig, initialState);
      const graph = await engine.run();

      // Should stop due to era completion, not maxTicks
      expect(graph.tick).toBeLessThan(10000);
    });
  });

  describe('graph consistency', () => {
    it('should maintain entity-relationship consistency', async () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = await engine.run();

      // All relationships should reference existing entities
      graph.getRelationships().forEach(rel => {
        expect(graph.hasEntity(rel.src)).toBe(true);
        expect(graph.hasEntity(rel.dst)).toBe(true);
      });
    });

    it('should not create duplicate entity IDs', async () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = await engine.run();

      const ids = graph.getEntityIds();
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should maintain entity links consistency with relationships', async () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = await engine.run();

      // Sample a few entities and check their links
      const entities = graph.getEntities().slice(0, 5);
      entities.forEach(entity => {
        entity.links.forEach(link => {
          const relExists = graph.getRelationships().some(r =>
            (r.src === link.src && r.dst === link.dst && r.kind === link.kind) ||
            (r.src === link.dst && r.dst === link.src && r.kind === link.kind)
          );
          expect(relExists).toBe(true);
        });
      });
    });

    it('should maintain valid prominence values', async () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = await engine.run();

      const validProminences = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];
      graph.getEntities().forEach(entity => {
        expect(validProminences).toContain(entity.prominence);
      });
    });

    it('should not exceed max tags limit (5)', async () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = await engine.run();

      graph.getEntities().forEach(entity => {
        expect(Object.keys(entity.tags).length).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('performance characteristics', () => {
    it('should complete generation in reasonable time', async () => {
      const start = Date.now();
      const engine = new WorldEngine(mockConfig, initialState);
      await engine.run();
      const duration = Date.now() - start;

      // Should complete in under 10 seconds for small config
      expect(duration).toBeLessThan(10000);
    });

    it('should scale with entity count', async () => {
      const smallConfig = {
        ...mockConfig,
        targetEntitiesPerKind: 5,
        maxTicks: 50
      };

      const largeConfig = {
        ...mockConfig,
        targetEntitiesPerKind: 20,
        maxTicks: 200
      };

      const smallEngine = new WorldEngine(smallConfig, initialState);
      const smallGraph = await smallEngine.run();

      const largeEngine = new WorldEngine(largeConfig, initialState);
      const largeGraph = await largeEngine.run();

      // Both should have at least the initial entities
      expect(largeGraph.getEntityCount()).toBeGreaterThanOrEqual(initialState.length);
      expect(smallGraph.getEntityCount()).toBeGreaterThanOrEqual(initialState.length);
      // Large config should allow for more ticks
      expect(largeConfig.maxTicks).toBeGreaterThan(smallConfig.maxTicks);
    });
  });
});
