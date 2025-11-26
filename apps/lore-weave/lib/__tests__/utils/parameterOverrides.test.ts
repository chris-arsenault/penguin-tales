import { describe, it, expect } from 'vitest';
import {
  applyTemplateOverrides,
  applySystemOverrides,
  applyParameterOverrides
} from '../../utils/parameterOverrides';
import { GrowthTemplate, SimulationSystem } from '../../types/engine';
import { TemplateMetadata, SystemMetadata } from '../../types/distribution';

describe('parameterOverrides', () => {
  const createMockTemplate = (id: string, metadata?: TemplateMetadata): GrowthTemplate => ({
    id,
    name: `Template ${id}`,
    metadata,
    canApply: () => true,
    findTargets: () => [],
    expand: () => ({ entities: [], relationships: [], description: 'test' })
  });

  const createMockSystem = (id: string, metadata?: SystemMetadata): SimulationSystem => ({
    id,
    name: `System ${id}`,
    metadata,
    apply: () => ({
      relationshipsAdded: [],
      entitiesModified: [],
      pressureChanges: {},
      description: 'test'
    })
  });

  // Helper to create simple template metadata for testing
  const createSimpleTemplateMetadata = (params?: Record<string, any>): TemplateMetadata => ({
    produces: {
      entityKinds: [],
      relationships: []
    },
    effects: {
      graphDensity: 0,
      clusterFormation: 0,
      diversityImpact: 0
    },
    parameters: params
  });

  // Helper to create simple system metadata for testing
  const createSimpleSystemMetadata = (params?: Record<string, any>): SystemMetadata => ({
    produces: {
      relationships: [],
      modifications: []
    },
    effects: {
      graphDensity: 0,
      clusterFormation: 0,
      diversityImpact: 0
    },
    parameters: params
  });

  describe('applyTemplateOverrides', () => {
    it('should apply parameter overrides to matching template', () => {
      const templates = [
        createMockTemplate('template1', createSimpleTemplateMetadata({
          param1: { value: 1.0, description: 'Test param' }
        }))
      ];

      const overrides = {
        templates: {
          template1: {
            metadata: {
              parameters: {
                param1: { value: 2.0, description: 'Overridden' }
              }
            }
          }
        }
      };

      const result = applyTemplateOverrides(templates, overrides);

      expect(result[0].metadata?.parameters?.param1.value).toBe(2.0);
    });

    it('should not modify template without override', () => {
      const originalMetadata = createSimpleTemplateMetadata({
        param1: { value: 1.0, description: 'Test' }
      });

      const templates = [createMockTemplate('template1', originalMetadata)];
      const overrides = {
        templates: {
          template2: { metadata: { parameters: {} } }
        }
      };

      const result = applyTemplateOverrides(templates, overrides);

      expect(result[0].metadata?.parameters?.param1.value).toBe(1.0);
    });

    it('should handle template without metadata', () => {
      const templates = [createMockTemplate('template1')];
      const overrides = {
        templates: {
          template1: { metadata: { parameters: {} } }
        }
      };

      const result = applyTemplateOverrides(templates, overrides);

      // Should not apply override if template has no metadata
      expect(result[0].metadata).toBeUndefined();
    });

    it('should handle override without metadata', () => {
      const templates = [
        createMockTemplate('template1', createSimpleTemplateMetadata({
          param1: { value: 1.0, description: 'Test' }
        }))
      ];

      const overrides = {
        templates: {
          template1: {}
        }
      };

      const result = applyTemplateOverrides(templates, overrides);

      // Should not modify if override has no metadata
      expect(result[0].metadata?.parameters?.param1.value).toBe(1.0);
    });

    it('should handle empty overrides', () => {
      const templates = [
        createMockTemplate('template1', createSimpleTemplateMetadata())
      ];

      const result = applyTemplateOverrides(templates, {});

      expect(result).toEqual(templates);
    });

    it('should handle multiple templates', () => {
      const templates = [
        createMockTemplate('template1', createSimpleTemplateMetadata({
          param1: { value: 1.0, description: 'Test' }
        })),
        createMockTemplate('template2', createSimpleTemplateMetadata({
          param2: { value: 2.0, description: 'Test' }
        }))
      ];

      const overrides = {
        templates: {
          template1: {
            metadata: {
              parameters: {
                param1: { value: 10.0, description: 'Overridden' }
              }
            }
          },
          template2: {
            metadata: {
              parameters: {
                param2: { value: 20.0, description: 'Overridden' }
              }
            }
          }
        }
      };

      const result = applyTemplateOverrides(templates, overrides);

      expect(result[0].metadata?.parameters?.param1.value).toBe(10.0);
      expect(result[1].metadata?.parameters?.param2.value).toBe(20.0);
    });

    it('should deep merge nested parameters', () => {
      const templates = [
        createMockTemplate('template1', createSimpleTemplateMetadata({
          param1: { value: 1.0, min: 0, max: 10, description: 'Test' },
          param2: { value: 2.0, description: 'Test 2' }
        }))
      ];

      const overrides: any = {
        templates: {
          template1: {
            metadata: {
              parameters: {
                param1: { value: 5.0 }
                // param2 not specified - should be preserved
              }
            }
          }
        }
      };

      const result = applyTemplateOverrides(templates, overrides);

      expect(result[0].metadata?.parameters?.param1.value).toBe(5.0);
      expect(result[0].metadata?.parameters?.param1.min).toBe(0);  // Preserved
      expect(result[0].metadata?.parameters?.param2.value).toBe(2.0);  // Preserved
    });
  });

  describe('applySystemOverrides', () => {
    it('should apply parameter overrides to matching system', () => {
      const systems = [
        createMockSystem('system1', createSimpleSystemMetadata({
          frequency: { value: 1.0, description: 'Test' }
        }))
      ];

      const overrides = {
        systems: {
          system1: {
            metadata: {
              parameters: {
                frequency: { value: 0.5, description: 'Overridden' }
              }
            }
          }
        }
      };

      const result = applySystemOverrides(systems, overrides);

      expect(result[0].metadata?.parameters?.frequency.value).toBe(0.5);
    });

    it('should not modify system without override', () => {
      const originalMetadata = createSimpleSystemMetadata({
        frequency: { value: 1.0, description: 'Test' }
      });

      const systems = [createMockSystem('system1', originalMetadata)];
      const overrides = {
        systems: {
          system2: { metadata: { parameters: {} } }
        }
      };

      const result = applySystemOverrides(systems, overrides);

      expect(result[0].metadata?.parameters?.frequency.value).toBe(1.0);
    });

    it('should handle system without metadata', () => {
      const systems = [createMockSystem('system1')];
      const overrides = {
        systems: {
          system1: { metadata: { parameters: {} } }
        }
      };

      const result = applySystemOverrides(systems, overrides);

      expect(result[0].metadata).toBeUndefined();
    });

    it('should handle empty overrides', () => {
      const systems = [
        createMockSystem('system1', createSimpleSystemMetadata())
      ];

      const result = applySystemOverrides(systems, {});

      expect(result).toEqual(systems);
    });

    it('should handle multiple systems', () => {
      const systems = [
        createMockSystem('system1', createSimpleSystemMetadata({
          param1: { value: 1.0, description: 'Test' }
        })),
        createMockSystem('system2', createSimpleSystemMetadata({
          param2: { value: 2.0, description: 'Test' }
        }))
      ];

      const overrides = {
        systems: {
          system1: {
            metadata: {
              parameters: {
                param1: { value: 10.0, description: 'Overridden' }
              }
            }
          },
          system2: {
            metadata: {
              parameters: {
                param2: { value: 20.0, description: 'Overridden' }
              }
            }
          }
        }
      };

      const result = applySystemOverrides(systems, overrides);

      expect(result[0].metadata?.parameters?.param1.value).toBe(10.0);
      expect(result[1].metadata?.parameters?.param2.value).toBe(20.0);
    });
  });

  describe('applyParameterOverrides', () => {
    it('should apply both template and system overrides', () => {
      const templates = [
        createMockTemplate('template1', createSimpleTemplateMetadata({
          param1: { value: 1.0, description: 'Test' }
        }))
      ];

      const systems = [
        createMockSystem('system1', createSimpleSystemMetadata({
          param1: { value: 1.0, description: 'Test' }
        }))
      ];

      const overrides = {
        templates: {
          template1: {
            metadata: {
              parameters: {
                param1: { value: 10.0, description: 'Overridden' }
              }
            }
          }
        },
        systems: {
          system1: {
            metadata: {
              parameters: {
                param1: { value: 5.0, description: 'Overridden' }
              }
            }
          }
        }
      };

      const result = applyParameterOverrides(templates, systems, overrides);

      expect(result.templates[0].metadata?.parameters?.param1.value).toBe(10.0);
      expect(result.systems[0].metadata?.parameters?.param1.value).toBe(5.0);
    });

    it('should handle partial overrides', () => {
      const templates = [
        createMockTemplate('template1', createSimpleTemplateMetadata({
          param1: { value: 1.0, description: 'Test' }
        }))
      ];

      const systems = [
        createMockSystem('system1', createSimpleSystemMetadata({
          param1: { value: 1.0, description: 'Test' }
        }))
      ];

      const overrides = {
        templates: {
          template1: {
            metadata: {
              parameters: {
                param1: { value: 10.0, description: 'Overridden' }
              }
            }
          }
        }
        // No system overrides
      };

      const result = applyParameterOverrides(templates, systems, overrides);

      expect(result.templates[0].metadata?.parameters?.param1.value).toBe(10.0);
      expect(result.systems[0].metadata?.parameters?.param1.value).toBe(1.0);
    });

    it('should handle empty overrides', () => {
      const templates = [createMockTemplate('template1')];
      const systems = [createMockSystem('system1')];

      const result = applyParameterOverrides(templates, systems, {});

      expect(result.templates).toEqual(templates);
      expect(result.systems).toEqual(systems);
    });

    it('should not mutate original arrays', () => {
      const templates = [
        createMockTemplate('template1', createSimpleTemplateMetadata({
          param1: { value: 1.0, description: 'Test' }
        }))
      ];

      const systems = [
        createMockSystem('system1', createSimpleSystemMetadata({
          param1: { value: 1.0, description: 'Test' }
        }))
      ];

      const originalTemplateValue = templates[0].metadata?.parameters?.param1.value;
      const originalSystemValue = systems[0].metadata?.parameters?.param1.value;

      const overrides = {
        templates: {
          template1: {
            metadata: {
              parameters: {
                param1: { value: 10.0, description: 'Overridden' }
              }
            }
          }
        },
        systems: {
          system1: {
            metadata: {
              parameters: {
                param1: { value: 5.0, description: 'Overridden' }
              }
            }
          }
        }
      };

      applyParameterOverrides(templates, systems, overrides);

      // Original arrays should not be mutated
      expect(templates[0].metadata?.parameters?.param1.value).toBe(originalTemplateValue);
      expect(systems[0].metadata?.parameters?.param1.value).toBe(originalSystemValue);
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined parameter fields gracefully', () => {
      const templates = [
        createMockTemplate('template1', createSimpleTemplateMetadata({
          param1: { value: 1.0, description: 'Test' }
        }))
      ];

      const overrides = {
        templates: {
          template1: {
            metadata: {
              parameters: {
                param1: { value: undefined as any, description: 'Overridden' }
              }
            }
          }
        }
      };

      const result = applyTemplateOverrides(templates, overrides);

      // undefined values should not override existing values
      expect(result[0].metadata?.parameters?.param1.value).toBe(1.0);
      // But description should be overridden
      expect(result[0].metadata?.parameters?.param1.description).toBe('Overridden');
    });
  });
});
