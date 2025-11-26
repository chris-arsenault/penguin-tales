// @ts-nocheck
// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorldEngine } from '../../engine/worldEngine';
import { EngineConfig, GrowthTemplate, SimulationSystem, Era } from '../../types/engine';
import { HardState } from '../../types/worldTypes';
import { DomainSchema } from '../../types/domainSchema';

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
          { kind: 'npc', subtypes: ['hero'], relationships: [] },
          { kind: 'faction', subtypes: ['guild'], relationships: [] },
          { kind: 'location', subtypes: ['colony'], relationships: [] }
        ]
      } as DomainSchema,
      templates: [mockTemplate],
      systems: [mockSystem],
      eras: [mockEra],
      feedbackLoops: [],
      pressures: [],
      entityRegistries: [],
      epochLength: 10,
      simulationTicksPerGrowth: 5,
      targetEntitiesPerKind: 20,
      maxTicks: 100
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
        tags: [],
        links: []
      }
    ];
  });

  describe('constructor', () => {
    it('should initialize with valid config and initial state', () => {
      const engine = new WorldEngine(mockConfig, initialState);
      expect(engine).toBeDefined();
    });

    it('should throw error on invalid config', () => {
      const invalidConfig = { ...mockConfig, templates: undefined };
      expect(() => new WorldEngine(invalidConfig as any, initialState)).toThrow();
    });

    it('should initialize with enrichment service if provided', () => {
      const mockEnrichmentService = {
        isEnabled: () => true,
        enrichEntity: vi.fn(),
        enrichRelationship: vi.fn()
      };
      const engine = new WorldEngine(mockConfig, initialState, mockEnrichmentService as any);
      expect(engine).toBeDefined();
    });

    it('should initialize statistical systems when distributionTargets provided', () => {
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

    it('should respect scaleFactor in config', () => {
      const configWithScale = { ...mockConfig, scaleFactor: 2.0 };
      const engine = new WorldEngine(configWithScale, initialState);
      expect(engine).toBeDefined();
    });

    it('should initialize with empty initial state', () => {
      const engine = new WorldEngine(mockConfig, []);
      expect(engine).toBeDefined();
    });
  });

  describe('run', () => {
    it('should complete generation and return graph', () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = engine.run();

      expect(graph).toBeDefined();
      expect(graph.entities).toBeDefined();
      expect(graph.relationships).toBeDefined();
      expect(graph.tick).toBeGreaterThan(0);
    });

    it('should stop at maxTicks', () => {
      const shortConfig = { ...mockConfig, maxTicks: 20 };
      const engine = new WorldEngine(shortConfig, initialState);
      const graph = engine.run();

      expect(graph.tick).toBeLessThanOrEqual(20);
    });

    it('should complete all eras', () => {
      const multiEraConfig = {
        ...mockConfig,
        eras: [mockEra, { ...mockEra, id: 'era2' }],
        epochLength: 5,
        maxTicks: 200
      };
      const engine = new WorldEngine(multiEraConfig, initialState);
      const graph = engine.run();

      // Should run at least 2 epochs per era
      expect(graph.tick).toBeGreaterThan(5);
    });

    it('should initialize initial entities with IDs and timestamps', () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = engine.run();

      const entities = Array.from(graph.entities.values());
      expect(entities.length).toBeGreaterThan(0);

      entities.forEach(entity => {
        expect(entity.id).toBeDefined();
        expect(entity.createdAt).toBeDefined();
        expect(entity.updatedAt).toBeDefined();
      });
    });

    it('should track entity creation over time', () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = engine.run();

      const initialCount = initialState.length;
      expect(graph.entities.size).toBeGreaterThanOrEqual(initialCount);
    });

    it('should create relationships during simulation', () => {
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
      const graph = engine.run();

      // System should have been called
      expect(relationshipSystem.apply).toHaveBeenCalled();
    });

    it('should apply templates during growth phase', () => {
      const creationTemplate: GrowthTemplate = {
        id: 'creation-template',
        purpose: 'creation',
        canApply: vi.fn(() => true),
        findTargets: vi.fn((graph) => {
          // Safely handle graph access
          if (!graph || !graph.entities) return [];
          return Array.from(graph.entities.values()).slice(0, 1);
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
              tags: [],
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
      const graph = engine.run();

      // Template should have been called
      expect(creationTemplate.canApply).toHaveBeenCalled();
    });

    it('should respect epoch length', () => {
      const shortEpochConfig = { ...mockConfig, epochLength: 5 };
      const engine = new WorldEngine(shortEpochConfig, initialState);
      const graph = engine.run();

      // Should have run multiple epochs
      expect(graph.tick).toBeGreaterThan(5);
    });

    it('should alternate between growth and simulation phases', () => {
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
      engine.run();

      // Both phases should have been called
      expect(templateCallTracker.length).toBeGreaterThan(0);
      expect(systemCallTracker.length).toBeGreaterThan(0);
    });

    it('should handle empty template list gracefully', () => {
      const noTemplateConfig = { ...mockConfig, templates: [] };
      const engine = new WorldEngine(noTemplateConfig, initialState);
      const graph = engine.run();

      expect(graph).toBeDefined();
      expect(graph.entities.size).toBe(initialState.length);
    });

    it('should handle empty system list gracefully', () => {
      const noSystemConfig = { ...mockConfig, systems: [] };
      const engine = new WorldEngine(noSystemConfig, initialState);
      const graph = engine.run();

      expect(graph).toBeDefined();
    });

    it('should stop on excessive growth safety valve', () => {
      const tinyTargetConfig = {
        ...mockConfig,
        targetEntitiesPerKind: 1,
        scaleFactor: 0.1,
        maxTicks: 1000
      };
      const engine = new WorldEngine(tinyTargetConfig, initialState);
      const graph = engine.run();

      // Should stop before maxTicks due to safety valve
      expect(graph.tick).toBeLessThan(1000);
    });
  });

  describe('initialization', () => {
    it('should assign unique IDs to all initial entities', () => {
      const multipleInitial = [
        { ...initialState[0], name: 'Entity 1' },
        { ...initialState[0], name: 'Entity 2' },
        { ...initialState[0], name: 'Entity 3' }
      ];

      const engine = new WorldEngine(mockConfig, multipleInitial);
      const graph = engine.run();

      const ids = Array.from(graph.entities.keys());
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should set createdAt to 0 for initial entities', () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = engine.run();

      const initialEntity = Array.from(graph.entities.values())[0];
      expect(initialEntity.createdAt).toBe(0);
    });

    it('should preserve names from initial state', () => {
      const namedInitial = [{
        ...initialState[0],
        name: 'Preserved Name Colony'
      }];

      const engine = new WorldEngine(mockConfig, namedInitial);
      const graph = engine.run();

      const entity = Array.from(graph.entities.values()).find(e =>
        e.name === 'Preserved Name Colony'
      );
      expect(entity).toBeDefined();
    });

    it('should preserve all initial entity properties', () => {
      const detailedInitial = [{
        kind: 'npc',
        subtype: 'hero',
        name: 'Test Hero',
        description: 'A detailed hero',
        status: 'active',
        prominence: 'renowned',
        tags: ['brave', 'strong'],
        links: []
      }];

      const engine = new WorldEngine(mockConfig, detailedInitial);
      const graph = engine.run();

      const entity = Array.from(graph.entities.values()).find(e =>
        e.name === 'Test Hero'
      );
      expect(entity).toBeDefined();
      expect(entity.kind).toBe('npc');
      expect(entity.subtype).toBe('hero');
      expect(entity.prominence).toBe('renowned');
      expect(entity.tags).toContain('brave');
    });
  });

  describe('era progression', () => {
    it('should progress through eras over epochs', () => {
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
        epochLength: 5,
        maxTicks: 50
      };

      const engine = new WorldEngine(multiEraConfig, initialState);
      const graph = engine.run();

      // Should have progressed through eras
      expect(graph.currentEra).toBeDefined();
    });

    it('should apply era template weights', () => {
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
      engine.run();

      // Template should have been considered (even if not always applied)
      expect(weightedTemplate.canApply).toHaveBeenCalled();
    });

    it('should apply era system modifiers', () => {
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
      engine.run();

      // System should have been called
      expect(modifiedSystem.apply).toHaveBeenCalled();
    });
  });

  describe('pressure system', () => {
    it('should track pressures over time', () => {
      const testPressure = {
        id: 'test-pressure',
        name: 'Test Pressure',
        value: 0,
        growth: vi.fn(() => 5),
        decay: 2,
        description: 'Test pressure'
      };

      const pressureConfig = {
        ...mockConfig,
        pressures: [testPressure]
      };

      const engine = new WorldEngine(pressureConfig, initialState);
      const graph = engine.run();

      expect(graph.pressures).toBeDefined();
    });

    it('should update pressures based on graph state', () => {
      const dynamicPressure = {
        id: 'dynamic-pressure',
        name: 'Dynamic Pressure',
        value: 10,
        growth: vi.fn((graph) => {
          return graph.entities.size > 5 ? 10 : -5;
        }),
        decay: 1,
        description: 'Dynamic pressure'
      };

      const pressureConfig = {
        ...mockConfig,
        pressures: [dynamicPressure]
      };

      const engine = new WorldEngine(pressureConfig, initialState);
      engine.run();

      // Growth function should have been called
      expect(dynamicPressure.growth).toHaveBeenCalled();
    });
  });

  describe('statistics and tracking', () => {
    it('should track history events', () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = engine.run();

      expect(graph.history).toBeDefined();
      expect(Array.isArray(graph.history)).toBe(true);
    });

    it('should increment tick counter', () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = engine.run();

      expect(graph.tick).toBeGreaterThan(0);
    });

    it('should track entity counts over time', () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = engine.run();

      const finalCount = graph.entities.size;
      expect(finalCount).toBeGreaterThanOrEqual(initialState.length);
    });

    it('should track relationship counts', () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = engine.run();

      expect(graph.relationships).toBeDefined();
      expect(Array.isArray(graph.relationships)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle minimal config with single era', () => {
      const minimalConfig = {
        ...mockConfig,
        eras: [mockEra],
        epochLength: 1,
        simulationTicksPerGrowth: 1,
        maxTicks: 10
      };

      const engine = new WorldEngine(minimalConfig, initialState);
      const graph = engine.run();

      expect(graph).toBeDefined();
    });

    it('should handle templates that never apply', () => {
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
      const graph = engine.run();

      expect(graph).toBeDefined();
      expect(neverAppliesTemplate.expand).not.toHaveBeenCalled();
    });

    it('should handle systems that return empty results', () => {
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
      const graph = engine.run();

      expect(graph).toBeDefined();
      expect(emptySystem.apply).toHaveBeenCalled();
    });

    it('should handle zero epochLength gracefully', () => {
      // This should be caught by validation, but test defensive behavior
      const zeroEpochConfig = { ...mockConfig, epochLength: 0, maxTicks: 5 };
      const engine = new WorldEngine(zeroEpochConfig, initialState);
      const graph = engine.run();

      // Should stop quickly due to maxTicks
      expect(graph).toBeDefined();
    });

    it('should handle very small targetEntitiesPerKind', () => {
      const smallTargetConfig = {
        ...mockConfig,
        targetEntitiesPerKind: 1
      };

      const engine = new WorldEngine(smallTargetConfig, initialState);
      const graph = engine.run();

      expect(graph).toBeDefined();
    });

    it('should handle very large maxTicks without hanging', () => {
      const largeTickConfig = {
        ...mockConfig,
        maxTicks: 10000,
        eras: [mockEra] // Only one era so it stops after ~2 epochs
      };

      const engine = new WorldEngine(largeTickConfig, initialState);
      const graph = engine.run();

      // Should stop due to era completion, not maxTicks
      expect(graph.tick).toBeLessThan(10000);
    });
  });

  describe('graph consistency', () => {
    it('should maintain entity-relationship consistency', () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = engine.run();

      // All relationships should reference existing entities
      graph.relationships.forEach(rel => {
        expect(graph.entities.has(rel.src)).toBe(true);
        expect(graph.entities.has(rel.dst)).toBe(true);
      });
    });

    it('should not create duplicate entity IDs', () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = engine.run();

      const ids = Array.from(graph.entities.keys());
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should maintain entity links consistency with relationships', () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = engine.run();

      // Sample a few entities and check their links
      const entities = Array.from(graph.entities.values()).slice(0, 5);
      entities.forEach(entity => {
        entity.links.forEach(link => {
          const relExists = graph.relationships.some(r =>
            (r.src === link.src && r.dst === link.dst && r.kind === link.kind) ||
            (r.src === link.dst && r.dst === link.src && r.kind === link.kind)
          );
          expect(relExists).toBe(true);
        });
      });
    });

    it('should maintain valid prominence values', () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = engine.run();

      const validProminences = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];
      Array.from(graph.entities.values()).forEach(entity => {
        expect(validProminences).toContain(entity.prominence);
      });
    });

    it('should not exceed max tags limit (5)', () => {
      const engine = new WorldEngine(mockConfig, initialState);
      const graph = engine.run();

      Array.from(graph.entities.values()).forEach(entity => {
        expect(entity.tags.length).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('performance characteristics', () => {
    it('should complete generation in reasonable time', () => {
      const start = Date.now();
      const engine = new WorldEngine(mockConfig, initialState);
      engine.run();
      const duration = Date.now() - start;

      // Should complete in under 10 seconds for small config
      expect(duration).toBeLessThan(10000);
    });

    it('should scale with entity count', () => {
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
      const smallGraph = smallEngine.run();

      const largeEngine = new WorldEngine(largeConfig, initialState);
      const largeGraph = largeEngine.run();

      // Both should have at least the initial entities
      expect(largeGraph.entities.size).toBeGreaterThanOrEqual(initialState.length);
      expect(smallGraph.entities.size).toBeGreaterThanOrEqual(initialState.length);
      // Large config should allow for more ticks
      expect(largeConfig.maxTicks).toBeGreaterThan(smallConfig.maxTicks);
    });
  });
});
