// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { FrameworkValidator, ValidationResult } from '../../engine/frameworkValidator';
import { EngineConfig, ComponentPurpose, Pressure, EntityRegistry, GrowthTemplate, SimulationSystem } from '../../types/engine';
import { DomainSchema } from '../../types/domainSchema';

describe('FrameworkValidator', () => {
  let mockConfig: EngineConfig;
  let validator: FrameworkValidator;

  beforeEach(() => {
    // Create minimal valid config
    mockConfig = {
      domain: {
        entityKinds: [
          { kind: 'npc', subtypes: [], relationships: [] },
          { kind: 'faction', subtypes: [], relationships: [] },
          { kind: 'location', subtypes: [], relationships: [] }
        ]
      } as DomainSchema,
      templates: [],
      systems: [],
      feedbackLoops: [],
      pressures: [],
      entityRegistries: [],
      epochLength: 20,
      simulationTicksPerGrowth: 10,
      targetEntitiesPerKind: 30,
      maxTicks: 500
    };
  });

  describe('validate', () => {
    it('should pass validation for minimal valid config', () => {
      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect errors from all validation methods', () => {
      // Create invalid config with multiple issues
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [], // Missing creators
          modifiers: [],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.4
              // Missing other prominence levels - should error
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return validation result with errors and warnings', () => {
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [],
          modifiers: [],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
    });
  });

  describe('validateCoverage', () => {
    it('should warn when no entity registries defined', () => {
      mockConfig.entityRegistries = [];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.warnings).toContain('No entity registries defined - lineage enforcement disabled');
    });

    it('should error when entity kind has no creators', () => {
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [],
          modifiers: [],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).toContainEqual(expect.stringContaining("Entity kind 'npc' has no creators"));
    });

    it('should error when creator references non-existent template', () => {
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'non_existent_template', primary: true, targetCount: 5 }
          ],
          modifiers: [],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).toContainEqual(
        expect.stringContaining("references non-existent template: non_existent_template")
      );
    });

    it('should pass when creator references existing template', () => {
      mockConfig.templates = [
        {
          id: 'valid_template',
          canApply: () => true,
          expand: () => ({ entities: [], relationships: [], description: '' })
        }
      ];

      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'valid_template', primary: true, targetCount: 5 }
          ],
          modifiers: [],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).not.toContainEqual(
        expect.stringContaining("non-existent template")
      );
    });

    it('should error when modifier references non-existent system', () => {
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'some_template', primary: true, targetCount: 5 }
          ],
          modifiers: [
            { systemId: 'non_existent_system', frequency: 0.5 }
          ],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).toContainEqual(
        expect.stringContaining("references non-existent system: non_existent_system")
      );
    });

    it('should pass when modifier references existing system', () => {
      mockConfig.systems = [
        {
          id: 'valid_system',
          apply: () => ({
            relationshipsAdded: [],
            entitiesModified: [],
            pressureChanges: new Map(),
            description: ''
          })
        }
      ];

      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'some_template', primary: true, targetCount: 5 }
          ],
          modifiers: [
            { systemId: 'valid_system', frequency: 0.5 }
          ],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).not.toContainEqual(
        expect.stringContaining("non-existent system")
      );
    });

    it('should error when pressure has no sources', () => {
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'template', primary: true, targetCount: 5 }
          ],
          modifiers: [],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];
      mockConfig.pressures = [
        {
          id: 'test_pressure',
          name: 'test_pressure',
          value: 0,
          growth: () => 0,
          decay: 0.1,
          contract: {
            sources: [],
            sinks: [{ component: 'time', delta: -1 }],
            equilibrium: {
              expectedRange: [30, 50],
              purpose: 'test'
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).toContainEqual(
        expect.stringContaining("Pressure 'test_pressure' has no sources")
      );
    });

    it('should error when pressure has no sinks', () => {
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'template', primary: true, targetCount: 5 }
          ],
          modifiers: [],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];
      mockConfig.pressures = [
        {
          id: 'test_pressure',
          name: 'test_pressure',
          value: 0,
          growth: () => 0,
          decay: 0.1,
          contract: {
            sources: [{ component: 'time', delta: 1 }],
            sinks: [],
            equilibrium: {
              expectedRange: [30, 50],
              purpose: 'test'
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).toContainEqual(
        expect.stringContaining("Pressure 'test_pressure' has no sinks - will saturate at 100!")
      );
    });

    it('should warn when pressure has no contract', () => {
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'template', primary: true, targetCount: 5 }
          ],
          modifiers: [],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];
      mockConfig.pressures = [
        {
          id: 'test_pressure',
          name: 'test_pressure',
          value: 0,
          growth: () => 0,
          decay: 0.1
        } as Pressure
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.warnings).toContainEqual(
        expect.stringContaining("Pressure 'test_pressure' has no contract")
      );
    });

    it('should error when pressure source references non-existent component', () => {
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'template', primary: true, targetCount: 5 }
          ],
          modifiers: [],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];
      mockConfig.pressures = [
        {
          id: 'test_pressure',
          name: 'test_pressure',
          value: 0,
          growth: () => 0,
          decay: 0.1,
          contract: {
            sources: [{ component: 'template.nonexistent', delta: 1 }],
            sinks: [{ component: 'time', delta: -1 }],
            equilibrium: {
              expectedRange: [30, 50],
              purpose: 'test'
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).toContainEqual(
        expect.stringContaining("references non-existent source: template.nonexistent")
      );
    });

    it('should accept special component types (time, formula, relationship, tag)', () => {
      mockConfig.pressures = [
        {
          id: 'test_pressure',
          name: 'test_pressure',
          value: 0,
          growth: () => 0,
          decay: 0.1,
          contract: {
            sources: [
              { component: 'time', delta: 1 },
              { component: 'formula.entities_count', delta: 0.1 }
            ],
            sinks: [
              { component: 'relationship.trades_with', delta: -0.5 },
              { component: 'tag.peaceful', delta: -0.2 }
            ],
            equilibrium: {
              expectedRange: [30, 50],
              purpose: 'test'
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).not.toContainEqual(
        expect.stringContaining("non-existent")
      );
    });
  });

  describe('validateEquilibrium', () => {
    it('should error when equilibrium range is invalid (below 0)', () => {
      mockConfig.pressures = [
        {
          id: 'test_pressure',
          name: 'test_pressure',
          value: 0,
          growth: () => 0,
          decay: 0.1,
          contract: {
            sources: [{ component: 'time', delta: 1 }],
            sinks: [{ component: 'time', delta: -1 }],
            equilibrium: {
              expectedRange: [-10, 50],
              purpose: 'test'
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).toContainEqual(
        expect.stringContaining("invalid equilibrium range: [-10, 50]. Must be within [0, 100]")
      );
    });

    it('should error when equilibrium range is invalid (above 100)', () => {
      mockConfig.pressures = [
        {
          id: 'test_pressure',
          name: 'test_pressure',
          value: 0,
          growth: () => 0,
          decay: 0.1,
          contract: {
            sources: [{ component: 'time', delta: 1 }],
            sinks: [{ component: 'time', delta: -1 }],
            equilibrium: {
              expectedRange: [30, 150],
              purpose: 'test'
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).toContainEqual(
        expect.stringContaining("invalid equilibrium range: [30, 150]. Must be within [0, 100]")
      );
    });

    it('should error when min >= max in equilibrium range', () => {
      mockConfig.pressures = [
        {
          id: 'test_pressure',
          name: 'test_pressure',
          value: 0,
          growth: () => 0,
          decay: 0.1,
          contract: {
            sources: [{ component: 'time', delta: 1 }],
            sinks: [{ component: 'time', delta: -1 }],
            equilibrium: {
              expectedRange: [60, 40],
              purpose: 'test'
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).toContainEqual(
        expect.stringContaining("invalid equilibrium range: min (60) >= max (40)")
      );
    });

    it('should warn when predicted equilibrium differs from expected', () => {
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'template', primary: true, targetCount: 5 }
          ],
          modifiers: [],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];
      mockConfig.pressures = [
        {
          id: 'test_pressure',
          name: 'test_pressure',
          value: 0,
          growth: () => 0,
          decay: 0.1,
          contract: {
            sources: [{ component: 'time', delta: 5 }],
            sinks: [{ component: 'time', delta: -1 }],
            equilibrium: {
              expectedRange: [10, 20], // Predicted: (5-1)/0.1 = 40, way above expected
              purpose: 'test'
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.warnings).toContainEqual(
        expect.stringContaining("equilibrium mismatch")
      );
      const mismatchWarning = result.warnings.find(w => w.includes("equilibrium mismatch"));
      expect(mismatchWarning).toBeDefined();
      expect(mismatchWarning).toContain("predicted=40.0");
    });

    it('should not warn when predicted equilibrium matches expected', () => {
      mockConfig.pressures = [
        {
          id: 'test_pressure',
          name: 'test_pressure',
          value: 0,
          growth: () => 0,
          decay: 0.1,
          contract: {
            sources: [{ component: 'time', delta: 4 }],
            sinks: [{ component: 'time', delta: -1 }],
            equilibrium: {
              expectedRange: [25, 35], // Predicted: (4-1)/0.1 = 30, within range
              purpose: 'test'
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.warnings).not.toContainEqual(
        expect.stringContaining("equilibrium mismatch")
      );
    });

    it('should skip equilibrium check for pressures without contracts', () => {
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'template', primary: true, targetCount: 5 }
          ],
          modifiers: [],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];
      mockConfig.pressures = [
        {
          id: 'test_pressure',
          name: 'test_pressure',
          value: 0,
          growth: () => 0,
          decay: 0.1
        } as Pressure
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      // Should have warning about missing contract, but no equilibrium errors
      expect(result.warnings).toContainEqual(
        expect.stringContaining("has no contract")
      );
    });
  });

  describe('validateAchievability', () => {
    it('should warn when capacity is below target', () => {
      mockConfig.templates = [
        {
          id: 'npc_creator',
          canApply: () => true,
          expand: () => ({ entities: [], relationships: [], description: '' })
        }
      ];

      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'npc_creator', primary: true, targetCount: 1 }
          ],
          modifiers: [],
          expectedDistribution: {
            targetCount: 100, // Target 100, but capacity only 1*10 = 10
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.warnings).toContainEqual(
        expect.stringContaining("may not reach target count 100")
      );
    });

    it('should not warn when capacity meets target', () => {
      mockConfig.templates = [
        {
          id: 'npc_creator',
          canApply: () => true,
          expand: () => ({ entities: [], relationships: [], description: '' })
        }
      ];

      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'npc_creator', primary: true, targetCount: 5 }
          ],
          modifiers: [],
          expectedDistribution: {
            targetCount: 30, // Target 30, capacity 5*10 = 50
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.warnings).not.toContainEqual(
        expect.stringContaining("may not reach target count")
      );
    });

    it('should error when prominence distribution does not sum to 1.0', () => {
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'npc_creator', primary: true, targetCount: 5 }
          ],
          modifiers: [],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.05 // Sum = 0.95, not 1.0
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).toContainEqual(
        expect.stringContaining("prominence distribution sums to 0.95, expected 1.0")
      );
    });

    it('should pass when prominence distribution sums to 1.0', () => {
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'npc_creator', primary: true, targetCount: 5 }
          ],
          modifiers: [],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).not.toContainEqual(
        expect.stringContaining("prominence distribution")
      );
    });
  });

  describe('validateContracts', () => {
    it('should warn when template has no contract', () => {
      mockConfig.templates = [
        {
          id: 'template_no_contract',
          canApply: () => true,
          expand: () => ({ entities: [], relationships: [], description: '' })
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.warnings).toContainEqual(
        expect.stringContaining("Template 'template_no_contract' has no contract")
      );
    });

    it('should warn when template has wrong purpose', () => {
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'template', primary: true, targetCount: 5 }
          ],
          modifiers: [],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];
      mockConfig.templates = [
        {
          id: 'template_wrong_purpose',
          canApply: () => true,
          expand: () => ({ entities: [], relationships: [], description: '' }),
          contract: {
            purpose: ComponentPurpose.STATE_MODIFICATION,
            affects: {
              entities: []
            }
          } as any
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      // Check for the warning about purpose
      expect(result.warnings).toContainEqual(
        expect.stringContaining("has purpose")
      );
      expect(result.warnings).toContainEqual(
        expect.stringContaining("expected ENTITY_CREATION or RELATIONSHIP_CREATION")
      );
    });

    it('should error when template references non-existent pressure', () => {
      mockConfig.templates = [
        {
          id: 'template_bad_pressure',
          canApply: () => true,
          expand: () => ({ entities: [], relationships: [], description: '' }),
          contract: {
            purpose: ComponentPurpose.ENTITY_CREATION,
            enabledBy: {
              pressures: [{ name: 'nonexistent_pressure', threshold: 50 }]
            },
            affects: {
              entities: []
            }
          } as any
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).toContainEqual(
        expect.stringContaining("references non-existent pressure: nonexistent_pressure")
      );
    });

    it('should pass when template references existing pressure', () => {
      mockConfig.pressures = [
        {
          id: 'valid_pressure',
          name: 'valid_pressure',
          value: 0,
          growth: () => 0,
          decay: 0.1
        } as Pressure
      ];

      mockConfig.templates = [
        {
          id: 'template_good_pressure',
          canApply: () => true,
          expand: () => ({ entities: [], relationships: [], description: '' }),
          contract: {
            purpose: ComponentPurpose.ENTITY_CREATION,
            enabledBy: {
              pressures: [{ name: 'valid_pressure', threshold: 50 }]
            },
            affects: {
              entities: []
            }
          } as any
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).not.toContainEqual(
        expect.stringContaining("non-existent pressure")
      );
    });

    it('should error when template references non-existent entity kind', () => {
      mockConfig.templates = [
        {
          id: 'template_bad_kind',
          canApply: () => true,
          expand: () => ({ entities: [], relationships: [], description: '' }),
          contract: {
            purpose: ComponentPurpose.ENTITY_CREATION,
            enabledBy: {
              entityCounts: [{ kind: 'nonexistent_kind', min: 1 }]
            },
            affects: {
              entities: [{ kind: 'nonexistent_kind', operation: 'create' as any }]
            }
          } as any
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContainEqual(
        expect.stringContaining("nonexistent_kind")
      );
    });

    it('should error when system has ENTITY_CREATION purpose', () => {
      mockConfig.systems = [
        {
          id: 'system_bad_purpose',
          apply: () => ({
            relationshipsAdded: [],
            entitiesModified: [],
            pressureChanges: new Map(),
            description: ''
          }),
          contract: {
            purpose: ComponentPurpose.ENTITY_CREATION,
            affects: {
              entities: []
            }
          } as any
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.errors).toContainEqual(
        expect.stringContaining("System 'system_bad_purpose' has purpose ENTITY_CREATION")
      );
    });

    it('should warn when system has no contract', () => {
      mockConfig.systems = [
        {
          id: 'system_no_contract',
          apply: () => ({
            relationshipsAdded: [],
            entitiesModified: [],
            pressureChanges: new Map(),
            description: ''
          })
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      expect(result.warnings).toContainEqual(
        expect.stringContaining("System 'system_no_contract' has no contract")
      );
    });

    it('should accept standard entity kinds from domain schema', () => {
      mockConfig.entityRegistries = [
        {
          kind: 'npc',
          creators: [
            { templateId: 'template', primary: true, targetCount: 5 }
          ],
          modifiers: [],
          expectedDistribution: {
            targetCount: 30,
            prominenceDistribution: {
              forgotten: 0.3,
              marginal: 0.3,
              recognized: 0.2,
              renowned: 0.1,
              mythic: 0.1
            }
          }
        }
      ];
      mockConfig.templates = [
        {
          id: 'template_standard_kinds',
          canApply: () => true,
          expand: () => ({ entities: [], relationships: [], description: '' }),
          contract: {
            purpose: ComponentPurpose.ENTITY_CREATION,
            affects: {
              entities: [
                { kind: 'npc', operation: 'create' as any },
                { kind: 'faction', operation: 'create' as any },
                { kind: 'location', operation: 'create' as any }
              ]
            }
          } as any
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      // Should not error on kinds defined in domain schema
      expect(result.errors).not.toContainEqual(
        expect.stringContaining("affects non-existent entity kind: npc")
      );
      expect(result.errors).not.toContainEqual(
        expect.stringContaining("affects non-existent entity kind: faction")
      );
      expect(result.errors).not.toContainEqual(
        expect.stringContaining("affects non-existent entity kind: location")
      );
    });
  });

  describe('edge cases', () => {
    it('should handle empty config gracefully', () => {
      const emptyConfig: EngineConfig = {
        domain: { entityKinds: [] } as DomainSchema,
        templates: [],
        systems: [],
        feedbackLoops: [],
        pressures: [],
        entityRegistries: [],
        epochLength: 20,
        simulationTicksPerGrowth: 10,
        targetEntitiesPerKind: 30,
        maxTicks: 500
      };

      validator = new FrameworkValidator(emptyConfig);
      const result = validator.validate();

      expect(result).toBeDefined();
      expect(result).toHaveProperty('valid');
    });

    it('should handle config without domain schema', () => {
      const noDomainConfig: EngineConfig = {
        domain: undefined as any,
        templates: [],
        systems: [],
        feedbackLoops: [],
        pressures: [],
        entityRegistries: [],
        epochLength: 20,
        simulationTicksPerGrowth: 10,
        targetEntitiesPerKind: 30,
        maxTicks: 500
      };

      validator = new FrameworkValidator(noDomainConfig);
      const result = validator.validate();

      expect(result).toBeDefined();
    });

    it('should handle zero decay pressure gracefully', () => {
      mockConfig.pressures = [
        {
          id: 'zero_decay_pressure',
          name: 'zero_decay_pressure',
          value: 0,
          growth: () => 0,
          decay: 0, // Zero decay
          contract: {
            sources: [{ component: 'time', delta: 5 }],
            sinks: [{ component: 'time', delta: -1 }],
            equilibrium: {
              expectedRange: [30, 50],
              purpose: 'test'
            }
          }
        }
      ];

      validator = new FrameworkValidator(mockConfig);
      const result = validator.validate();

      // Should not crash, but may warn
      expect(result).toBeDefined();
    });
  });
});
