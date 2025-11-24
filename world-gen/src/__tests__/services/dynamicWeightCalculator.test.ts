import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicWeightCalculator, WeightAdjustment } from '../../services/dynamicWeightCalculator';
import { GrowthTemplate } from '../../types/engine';
import { PopulationMetrics, EntityMetric } from '../../services/populationTracker';

describe('DynamicWeightCalculator', () => {
  let calculator: DynamicWeightCalculator;
  let mockTemplate: GrowthTemplate;
  let mockMetrics: PopulationMetrics;

  beforeEach(() => {
    calculator = new DynamicWeightCalculator();

    mockTemplate = {
      id: 'test_template',
      canApply: () => true,
      expand: () => ({ entities: [], relationships: [], description: '' })
    };

    mockMetrics = {
      tick: 100,
      entities: new Map<string, EntityMetric>(),
      relationships: new Map(),
      pressures: new Map()
    };
  });

  describe('calculateWeight', () => {
    describe('disabled templates', () => {
      it('should return zero weight when base weight is zero', () => {
        const result = calculator.calculateWeight(mockTemplate, 0, mockMetrics);

        expect(result.adjustedWeight).toBe(0);
        expect(result.adjustmentFactor).toBe(0);
        expect(result.reason).toBe('Template disabled by era');
      });

      it('should preserve template ID', () => {
        const result = calculator.calculateWeight(mockTemplate, 0, mockMetrics);

        expect(result.templateId).toBe('test_template');
        expect(result.baseWeight).toBe(0);
      });
    });

    describe('templates without metadata', () => {
      it('should return base weight when no metadata', () => {
        const result = calculator.calculateWeight(mockTemplate, 1.5, mockMetrics);

        expect(result.adjustedWeight).toBe(1.5);
        expect(result.adjustmentFactor).toBe(1.0);
        expect(result.reason).toBe('No tracked entity output');
      });

      it('should return base weight when metadata has no produces', () => {
        mockTemplate.metadata = {} as any;

        const result = calculator.calculateWeight(mockTemplate, 2.0, mockMetrics);

        expect(result.adjustedWeight).toBe(2.0);
        expect(result.adjustmentFactor).toBe(1.0);
      });

      it('should return base weight when produces has no entityKinds', () => {
        mockTemplate.metadata = {
          produces: {}
        } as any;

        const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

        expect(result.adjustedWeight).toBe(1.0);
        expect(result.adjustmentFactor).toBe(1.0);
      });

      it('should return base weight when entityKinds array is empty', () => {
        mockTemplate.metadata = {
          produces: {
            entityKinds: []
          }
        } as any;

        const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

        expect(result.adjustedWeight).toBe(1.0);
        expect(result.adjustmentFactor).toBe(1.0);
      });
    });

    describe('population above target (suppression)', () => {
      it('should suppress when population exceeds target by >20%', () => {
        mockTemplate.metadata = {
          produces: {
            entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
          }
        } as any;

        mockMetrics.entities.set('npc:merchant', {
          kind: 'npc',
          subtype: 'merchant',
          count: 60,
          target: 50,
          deviation: 0.2, // 20% over
          trend: 0,
          history: []
        });

        const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

        expect(result.adjustedWeight).toBeLessThan(1.0);
        expect(result.adjustmentFactor).toBeLessThan(1.0);
        expect(result.reason).toContain('over target');
      });

      it('should suppress more when population is way over target', () => {
        mockTemplate.metadata = {
          produces: {
            entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
          }
        } as any;

        mockMetrics.entities.set('npc:merchant', {
          kind: 'npc',
          subtype: 'merchant',
          count: 100,
          target: 50,
          deviation: 1.0, // 100% over
          trend: 0,
          history: []
        });

        const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

        expect(result.adjustedWeight).toBe(0); // Maximum suppression (100% - 80% = 20%)
        expect(result.adjustmentFactor).toBe(0.2);
      });

      it('should not suppress when deviation is below threshold', () => {
        mockTemplate.metadata = {
          produces: {
            entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
          }
        } as any;

        mockMetrics.entities.set('npc:merchant', {
          kind: 'npc',
          subtype: 'merchant',
          count: 55,
          target: 50,
          deviation: 0.1, // 10% over (below 20% threshold)
          trend: 0,
          history: []
        });

        const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

        expect(result.adjustedWeight).toBe(1.0);
        expect(result.adjustmentFactor).toBe(1.0);
        expect(result.reason).toBe('No adjustment needed');
      });

      it('should include deviation percentage in reason', () => {
        mockTemplate.metadata = {
          produces: {
            entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
          }
        } as any;

        mockMetrics.entities.set('npc:merchant', {
          kind: 'npc',
          subtype: 'merchant',
          count: 75,
          target: 50,
          deviation: 0.5, // 50% over
          trend: 0,
          history: []
        });

        const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

        expect(result.reason).toContain('50%');
        expect(result.reason).toContain('75/50');
      });
    });

    describe('population below target (boosting)', () => {
      it('should boost when population is below target by >20%', () => {
        mockTemplate.metadata = {
          produces: {
            entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
          }
        } as any;

        mockMetrics.entities.set('npc:merchant', {
          kind: 'npc',
          subtype: 'merchant',
          count: 40,
          target: 50,
          deviation: -0.2, // 20% under
          trend: 0,
          history: []
        });

        const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

        expect(result.adjustedWeight).toBeGreaterThan(1.0);
        expect(result.adjustmentFactor).toBeGreaterThan(1.0);
        expect(result.reason).toContain('under target');
      });

      it('should boost more when population is way under target', () => {
        mockTemplate.metadata = {
          produces: {
            entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
          }
        } as any;

        mockMetrics.entities.set('npc:merchant', {
          kind: 'npc',
          subtype: 'merchant',
          count: 10,
          target: 50,
          deviation: -0.8, // 80% under
          trend: 0,
          history: []
        });

        const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

        expect(result.adjustedWeight).toBe(1.8); // 1.0 * (1 + 0.8)
        expect(result.adjustmentFactor).toBe(1.8);
      });

      it('should cap boost at 200% (maxBoostFactor)', () => {
        mockTemplate.metadata = {
          produces: {
            entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
          }
        } as any;

        mockMetrics.entities.set('npc:merchant', {
          kind: 'npc',
          subtype: 'merchant',
          count: 1,
          target: 50,
          deviation: -0.98, // 98% under
          trend: 0,
          history: []
        });

        const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

        expect(result.adjustedWeight).toBe(2.0); // Capped at maxBoostFactor
        expect(result.adjustmentFactor).toBe(2.0);
      });

      it('should include deviation percentage in reason', () => {
        mockTemplate.metadata = {
          produces: {
            entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
          }
        } as any;

        mockMetrics.entities.set('npc:merchant', {
          kind: 'npc',
          subtype: 'merchant',
          count: 25,
          target: 50,
          deviation: -0.5, // 50% under
          trend: 0,
          history: []
        });

        const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

        expect(result.reason).toContain('50%');
        expect(result.reason).toContain('25/50');
      });
    });

    describe('multiple entity kinds', () => {
      it('should apply cumulative adjustments for multiple kinds', () => {
        mockTemplate.metadata = {
          produces: {
            entityKinds: [
              { kind: 'npc', subtype: 'merchant' },
              { kind: 'npc', subtype: 'warrior' }
            ]
          }
        } as any;

        // Both over target
        mockMetrics.entities.set('npc:merchant', {
          kind: 'npc',
          subtype: 'merchant',
          count: 60,
          target: 50,
          deviation: 0.2,
          trend: 0,
          history: []
        });

        mockMetrics.entities.set('npc:warrior', {
          kind: 'npc',
          subtype: 'warrior',
          count: 60,
          target: 50,
          deviation: 0.2,
          trend: 0,
          history: []
        });

        const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

        // Should apply both suppressions cumulatively
        expect(result.adjustmentFactor).toBeLessThan(1.0);
        expect(result.reason).toContain('npc:merchant');
        expect(result.reason).toContain('npc:warrior');
      });

      it('should handle mixed over/under targets', () => {
        mockTemplate.metadata = {
          produces: {
            entityKinds: [
              { kind: 'npc', subtype: 'merchant' },
              { kind: 'npc', subtype: 'warrior' }
            ]
          }
        } as any;

        // One over, one under
        mockMetrics.entities.set('npc:merchant', {
          kind: 'npc',
          subtype: 'merchant',
          count: 60,
          target: 50,
          deviation: 0.2,
          trend: 0,
          history: []
        });

        mockMetrics.entities.set('npc:warrior', {
          kind: 'npc',
          subtype: 'warrior',
          count: 40,
          target: 50,
          deviation: -0.2,
          trend: 0,
          history: []
        });

        const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

        // Adjustments should offset somewhat
        expect(result.reason).toContain('npc:merchant');
        expect(result.reason).toContain('npc:warrior');
      });

      it('should skip entity kinds with no metrics', () => {
        mockTemplate.metadata = {
          produces: {
            entityKinds: [
              { kind: 'npc', subtype: 'merchant' },
              { kind: 'npc', subtype: 'nonexistent' }
            ]
          }
        } as any;

        mockMetrics.entities.set('npc:merchant', {
          kind: 'npc',
          subtype: 'merchant',
          count: 60,
          target: 50,
          deviation: 0.2,
          trend: 0,
          history: []
        });

        const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

        expect(result.reason).toContain('npc:merchant');
        expect(result.reason).not.toContain('nonexistent');
      });

      it('should skip entity kinds with zero target', () => {
        mockTemplate.metadata = {
          produces: {
            entityKinds: [
              { kind: 'npc', subtype: 'merchant' }
            ]
          }
        } as any;

        mockMetrics.entities.set('npc:merchant', {
          kind: 'npc',
          subtype: 'merchant',
          count: 10,
          target: 0,
          deviation: 0,
          trend: 0,
          history: []
        });

        const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

        expect(result.adjustedWeight).toBe(1.0);
        expect(result.reason).toBe('No adjustment needed');
      });
    });
  });

  describe('calculateAllWeights', () => {
    it('should calculate weights for all templates', () => {
      const templates: GrowthTemplate[] = [
        {
          id: 'template1',
          canApply: () => true,
          expand: () => ({ entities: [], relationships: [], description: '' }),
          metadata: {
            produces: {
              entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
            }
          } as any
        },
        {
          id: 'template2',
          canApply: () => true,
          expand: () => ({ entities: [], relationships: [], description: '' }),
          metadata: {
            produces: {
              entityKinds: [{ kind: 'npc', subtype: 'warrior' }]
            }
          } as any
        }
      ];

      const baseWeights = new Map([
        ['template1', 1.0],
        ['template2', 1.5]
      ]);

      const result = calculator.calculateAllWeights(templates, baseWeights, mockMetrics);

      expect(result.size).toBe(2);
      expect(result.has('template1')).toBe(true);
      expect(result.has('template2')).toBe(true);
    });

    it('should use zero weight for templates not in baseWeights', () => {
      const templates: GrowthTemplate[] = [
        {
          id: 'template1',
          canApply: () => true,
          expand: () => ({ entities: [], relationships: [], description: '' })
        }
      ];

      const baseWeights = new Map<string, number>();

      const result = calculator.calculateAllWeights(templates, baseWeights, mockMetrics);

      expect(result.get('template1')?.baseWeight).toBe(0);
      expect(result.get('template1')?.adjustedWeight).toBe(0);
    });

    it('should handle empty template array', () => {
      const result = calculator.calculateAllWeights([], new Map(), mockMetrics);

      expect(result.size).toBe(0);
    });
  });

  describe('getSuppressedTemplates', () => {
    it('should return templates with adjustment factor < 1.0', () => {
      const adjustments = new Map<string, WeightAdjustment>([
        [
          'template1',
          {
            templateId: 'template1',
            baseWeight: 1.0,
            adjustedWeight: 0.5,
            adjustmentFactor: 0.5,
            reason: 'Suppressed'
          }
        ],
        [
          'template2',
          {
            templateId: 'template2',
            baseWeight: 1.0,
            adjustedWeight: 1.5,
            adjustmentFactor: 1.5,
            reason: 'Boosted'
          }
        ]
      ]);

      const result = calculator.getSuppressedTemplates(adjustments);

      expect(result).toHaveLength(1);
      expect(result[0].templateId).toBe('template1');
    });

    it('should exclude templates with zero base weight', () => {
      const adjustments = new Map<string, WeightAdjustment>([
        [
          'template1',
          {
            templateId: 'template1',
            baseWeight: 0,
            adjustedWeight: 0,
            adjustmentFactor: 0,
            reason: 'Disabled'
          }
        ]
      ]);

      const result = calculator.getSuppressedTemplates(adjustments);

      expect(result).toHaveLength(0);
    });

    it('should exclude templates with adjustment factor = 1.0', () => {
      const adjustments = new Map<string, WeightAdjustment>([
        [
          'template1',
          {
            templateId: 'template1',
            baseWeight: 1.0,
            adjustedWeight: 1.0,
            adjustmentFactor: 1.0,
            reason: 'No adjustment'
          }
        ]
      ]);

      const result = calculator.getSuppressedTemplates(adjustments);

      expect(result).toHaveLength(0);
    });
  });

  describe('getBoostedTemplates', () => {
    it('should return templates with adjustment factor > 1.0', () => {
      const adjustments = new Map<string, WeightAdjustment>([
        [
          'template1',
          {
            templateId: 'template1',
            baseWeight: 1.0,
            adjustedWeight: 0.5,
            adjustmentFactor: 0.5,
            reason: 'Suppressed'
          }
        ],
        [
          'template2',
          {
            templateId: 'template2',
            baseWeight: 1.0,
            adjustedWeight: 1.5,
            adjustmentFactor: 1.5,
            reason: 'Boosted'
          }
        ]
      ]);

      const result = calculator.getBoostedTemplates(adjustments);

      expect(result).toHaveLength(1);
      expect(result[0].templateId).toBe('template2');
    });

    it('should include templates with base weight zero that are boosted', () => {
      const adjustments = new Map<string, WeightAdjustment>([
        [
          'template1',
          {
            templateId: 'template1',
            baseWeight: 0,
            adjustedWeight: 0.5,
            adjustmentFactor: 1.5,
            reason: 'Boosted from zero'
          }
        ]
      ]);

      const result = calculator.getBoostedTemplates(adjustments);

      expect(result).toHaveLength(1);
    });

    it('should exclude templates with adjustment factor = 1.0', () => {
      const adjustments = new Map<string, WeightAdjustment>([
        [
          'template1',
          {
            templateId: 'template1',
            baseWeight: 1.0,
            adjustedWeight: 1.0,
            adjustmentFactor: 1.0,
            reason: 'No adjustment'
          }
        ]
      ]);

      const result = calculator.getBoostedTemplates(adjustments);

      expect(result).toHaveLength(0);
    });
  });

  describe('configure', () => {
    it('should update deviation threshold', () => {
      calculator.configure({ deviationThreshold: 0.3 });

      mockTemplate.metadata = {
        produces: {
          entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
        }
      } as any;

      mockMetrics.entities.set('npc:merchant', {
        kind: 'npc',
        subtype: 'merchant',
        count: 62,
        target: 50,
        deviation: 0.24, // 24% - above old threshold (20%), below new (30%)
        trend: 0,
        history: []
      });

      const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

      // Should not suppress because deviation < new threshold
      expect(result.adjustedWeight).toBe(1.0);
    });

    it('should update max suppression factor', () => {
      calculator.configure({ maxSuppressionFactor: 0.5 });

      mockTemplate.metadata = {
        produces: {
          entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
        }
      } as any;

      mockMetrics.entities.set('npc:merchant', {
        kind: 'npc',
        subtype: 'merchant',
        count: 100,
        target: 50,
        deviation: 1.0, // 100% over
        trend: 0,
        history: []
      });

      const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

      // Max suppression is now 50% instead of 80%
      expect(result.adjustedWeight).toBe(0.5); // 1.0 * (1 - 0.5)
    });

    it('should update max boost factor', () => {
      calculator.configure({ maxBoostFactor: 3.0 });

      mockTemplate.metadata = {
        produces: {
          entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
        }
      } as any;

      mockMetrics.entities.set('npc:merchant', {
        kind: 'npc',
        subtype: 'merchant',
        count: 1,
        target: 50,
        deviation: -0.98, // 98% under
        trend: 0,
        history: []
      });

      const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

      // Max boost is now 300% instead of 200%
      expect(result.adjustedWeight).toBe(3.0); // Capped at new maxBoostFactor
    });

    it('should allow partial configuration', () => {
      calculator.configure({ deviationThreshold: 0.15 });

      // Other settings should remain default
      expect(() => {
        calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);
      }).not.toThrow();
    });

    it('should handle undefined options', () => {
      calculator.configure({
        deviationThreshold: undefined,
        maxSuppressionFactor: 0.6
      });

      expect(() => {
        calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle exactly at threshold deviation', () => {
      mockTemplate.metadata = {
        produces: {
          entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
        }
      } as any;

      mockMetrics.entities.set('npc:merchant', {
        kind: 'npc',
        subtype: 'merchant',
        count: 60,
        target: 50,
        deviation: 0.2, // Exactly at 20% threshold
        trend: 0,
        history: []
      });

      const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

      // Should not adjust at exactly threshold
      expect(result.adjustedWeight).toBe(1.0);
    });

    it('should handle zero count', () => {
      mockTemplate.metadata = {
        produces: {
          entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
        }
      } as any;

      mockMetrics.entities.set('npc:merchant', {
        kind: 'npc',
        subtype: 'merchant',
        count: 0,
        target: 50,
        deviation: -1.0, // 100% under
        trend: 0,
        history: []
      });

      const result = calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);

      expect(result.adjustedWeight).toBe(2.0); // Maximum boost
    });

    it('should handle very large base weight', () => {
      mockTemplate.metadata = {
        produces: {
          entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
        }
      } as any;

      mockMetrics.entities.set('npc:merchant', {
        kind: 'npc',
        subtype: 'merchant',
        count: 40,
        target: 50,
        deviation: -0.2,
        trend: 0,
        history: []
      });

      const result = calculator.calculateWeight(mockTemplate, 100.0, mockMetrics);

      expect(result.adjustedWeight).toBeGreaterThan(100.0);
      expect(result.baseWeight).toBe(100.0);
    });

    it('should handle negative base weight', () => {
      const result = calculator.calculateWeight(mockTemplate, -1.0, mockMetrics);

      // Should still process, even if unusual
      expect(result.baseWeight).toBe(-1.0);
    });

    it('should handle NaN deviation', () => {
      mockTemplate.metadata = {
        produces: {
          entityKinds: [{ kind: 'npc', subtype: 'merchant' }]
        }
      } as any;

      mockMetrics.entities.set('npc:merchant', {
        kind: 'npc',
        subtype: 'merchant',
        count: 50,
        target: 50,
        deviation: NaN,
        trend: 0,
        history: []
      });

      expect(() => {
        calculator.calculateWeight(mockTemplate, 1.0, mockMetrics);
      }).not.toThrow();
    });
  });
});
