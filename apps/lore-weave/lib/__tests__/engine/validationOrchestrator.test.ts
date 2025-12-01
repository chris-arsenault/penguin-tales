// @ts-nocheck
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ValidationOrchestrator, ValidationResult } from '../../engine/validationOrchestrator';
import { FrameworkValidator } from '../../engine/frameworkValidator';
import { EngineConfig } from '../../engine/types';
import { DomainSchema } from '../../domainInterface/domainSchema';

describe('ValidationOrchestrator', () => {
  let mockConfig: EngineConfig;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let mockValidatorInstance: any;

  beforeEach(() => {
    // Setup mock config
    mockConfig = {
      domain: {
        entityKinds: [
          { kind: 'npc', subtypes: [], relationships: [] },
          { kind: 'faction', subtypes: [], relationships: [] }
        ]
      } as DomainSchema,
      templates: [],
      systems: [],
      pressures: [],
      entityRegistries: [],
      epochLength: 20,
      simulationTicksPerGrowth: 10,
      targetEntitiesPerKind: 30,
      maxTicks: 500
    };

    // Create mock validator instance
    mockValidatorInstance = {
      validate: vi.fn()
    };

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock FrameworkValidator constructor
    vi.spyOn(FrameworkValidator.prototype, 'validate').mockImplementation(
      function(this: any) {
        return mockValidatorInstance.validate();
      }
    );
  });

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe('validateAndDisplay', () => {
    it('should create FrameworkValidator and call validate', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      ValidationOrchestrator.validateAndDisplay(mockConfig);

      expect(mockValidatorInstance.validate).toHaveBeenCalled();
    });

    it('should display header with separators', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      ValidationOrchestrator.validateAndDisplay(mockConfig);

      expect(consoleLogSpy).toHaveBeenCalledWith('='.repeat(80));
      expect(consoleLogSpy).toHaveBeenCalledWith('FRAMEWORK VALIDATION');
    });

    it('should display success message when no errors', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      ValidationOrchestrator.validateAndDisplay(mockConfig);

      expect(consoleLogSpy).toHaveBeenCalledWith('✓ No validation errors');
    });

    it('should return validation result with no errors', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      const result = ValidationOrchestrator.validateAndDisplay(mockConfig);

      expect(result).toEqual({
        hasErrors: false,
        hasWarnings: false,
        errors: [],
        warnings: []
      });
    });

    it('should display errors and throw when validation fails', () => {
      const mockErrors = [
        'Error 1: Something went wrong',
        'Error 2: Another issue'
      ];

      mockValidatorInstance.validate.mockReturnValue({
        valid: false,
        errors: mockErrors,
        warnings: []
      });

      expect(() => {
        ValidationOrchestrator.validateAndDisplay(mockConfig);
      }).toThrow('Framework validation failed with 2 error(s)');

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ VALIDATION ERRORS:');
      expect(consoleErrorSpy).toHaveBeenCalledWith('  - Error 1: Something went wrong');
      expect(consoleErrorSpy).toHaveBeenCalledWith('  - Error 2: Another issue');
    });

    it('should display all errors individually', () => {
      const mockErrors = [
        'Error A',
        'Error B',
        'Error C'
      ];

      mockValidatorInstance.validate.mockReturnValue({
        valid: false,
        errors: mockErrors,
        warnings: []
      });

      expect(() => {
        ValidationOrchestrator.validateAndDisplay(mockConfig);
      }).toThrow();

      mockErrors.forEach(error => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(`  - ${error}`);
      });
    });

    it('should throw error with correct count', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: false,
        errors: ['Error 1', 'Error 2', 'Error 3'],
        warnings: []
      });

      expect(() => {
        ValidationOrchestrator.validateAndDisplay(mockConfig);
      }).toThrow('Framework validation failed with 3 error(s)');
    });

    it('should display warnings when validation passes with warnings', () => {
      const mockWarnings = [
        'Warning 1: Potential issue',
        'Warning 2: Consider this'
      ];

      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: mockWarnings
      });

      ValidationOrchestrator.validateAndDisplay(mockConfig);

      expect(consoleWarnSpy).toHaveBeenCalledWith('\n⚠️  VALIDATION WARNINGS:');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  - Warning 1: Potential issue');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  - Warning 2: Consider this');
    });

    it('should return validation result with warnings', () => {
      const mockWarnings = ['Warning 1', 'Warning 2'];

      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: mockWarnings
      });

      const result = ValidationOrchestrator.validateAndDisplay(mockConfig);

      expect(result).toEqual({
        hasErrors: false,
        hasWarnings: true,
        errors: [],
        warnings: mockWarnings
      });
    });

    it('should not display warning section when no warnings', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      ValidationOrchestrator.validateAndDisplay(mockConfig);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should display errors but not warnings when validation fails', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: false,
        errors: ['Error 1'],
        warnings: ['Warning 1']
      });

      expect(() => {
        ValidationOrchestrator.validateAndDisplay(mockConfig);
      }).toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
      // Warnings should not be displayed when errors exist
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should display separators correctly', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      ValidationOrchestrator.validateAndDisplay(mockConfig);

      // Check that separators are 80 characters
      expect(consoleLogSpy).toHaveBeenCalledWith('='.repeat(80));
      // Should be called at least twice (opening and closing)
      const separatorCalls = consoleLogSpy.mock.calls.filter(
        call => call[0] === '='.repeat(80)
      );
      expect(separatorCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle single error correctly', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: false,
        errors: ['Single error'],
        warnings: []
      });

      expect(() => {
        ValidationOrchestrator.validateAndDisplay(mockConfig);
      }).toThrow('Framework validation failed with 1 error(s)');
    });

    it('should handle many warnings correctly', () => {
      const mockWarnings = Array.from({ length: 10 }, (_, i) => `Warning ${i + 1}`);

      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: mockWarnings
      });

      const result = ValidationOrchestrator.validateAndDisplay(mockConfig);

      expect(result.warnings).toHaveLength(10);
      expect(result.hasWarnings).toBe(true);

      // All warnings should be displayed
      mockWarnings.forEach(warning => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(`  - ${warning}`);
      });
    });
  });

  describe('displayServiceStatus', () => {
    it('should always display contract enforcement status', () => {
      ValidationOrchestrator.displayServiceStatus([], false);

      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Contract enforcement enabled');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - Template filtering by applicability rules');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - Automatic lineage relationship creation');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - Contract affects validation');
    });

    it('should display target selector status when enabled', () => {
      ValidationOrchestrator.displayServiceStatus([], true);

      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Intelligent target selection enabled (anti-super-hub)');
    });

    it('should not display target selector status when disabled', () => {
      ValidationOrchestrator.displayServiceStatus([], false);

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Intelligent target selection')
      );
    });

    it('should display meta-entity formation status when configs provided', () => {
      const metaEntityConfigs = [
        { name: 'Dynasty Formation' },
        { name: 'Trade Network Formation' }
      ];

      ValidationOrchestrator.displayServiceStatus(metaEntityConfigs, false);

      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Meta-entity formation system initialized');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - Registered Dynasty Formation formation');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - Registered Trade Network Formation formation');
    });

    it('should not display meta-entity status when no configs', () => {
      ValidationOrchestrator.displayServiceStatus([], false);

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Meta-entity formation')
      );
    });

    it('should not display meta-entity status when null', () => {
      ValidationOrchestrator.displayServiceStatus(null, false);

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Meta-entity formation')
      );
    });

    it('should display all services when all enabled', () => {
      const metaEntityConfigs = [{ name: 'Formation 1' }];

      ValidationOrchestrator.displayServiceStatus(metaEntityConfigs, true);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Contract enforcement')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Intelligent target selection')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Meta-entity formation')
      );
    });

    it('should handle empty arrays correctly', () => {
      ValidationOrchestrator.displayServiceStatus([], false);

      // Should still display contract enforcement (always on)
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Contract enforcement enabled');
    });

    it('should handle undefined parameters gracefully', () => {
      expect(() => {
        ValidationOrchestrator.displayServiceStatus(undefined, undefined);
      }).not.toThrow();
    });

    it('should display each meta-entity config name', () => {
      const metaEntityConfigs = [
        { name: 'Alliance Network' },
        { name: 'Trade Consortium' },
        { name: 'Cultural Movement' }
      ];

      ValidationOrchestrator.displayServiceStatus(metaEntityConfigs, false);

      expect(consoleLogSpy).toHaveBeenCalledWith('  - Registered Alliance Network formation');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - Registered Trade Consortium formation');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - Registered Cultural Movement formation');
    });

    it('should handle single meta-entity config', () => {
      const metaEntityConfigs = [{ name: 'Single Formation' }];

      ValidationOrchestrator.displayServiceStatus(metaEntityConfigs, false);

      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Meta-entity formation system initialized');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - Registered Single Formation formation');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete validation flow with errors', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: false,
        errors: ['Critical error'],
        warnings: ['Some warning']
      });

      expect(() => {
        ValidationOrchestrator.validateAndDisplay(mockConfig);
      }).toThrow('Framework validation failed with 1 error(s)');

      expect(consoleLogSpy).toHaveBeenCalledWith('FRAMEWORK VALIDATION');
      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ VALIDATION ERRORS:');
      expect(consoleErrorSpy).toHaveBeenCalledWith('  - Critical error');
    });

    it('should handle complete validation flow with warnings only', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['Warning 1', 'Warning 2']
      });

      const result = ValidationOrchestrator.validateAndDisplay(mockConfig);

      expect(result.hasErrors).toBe(false);
      expect(result.hasWarnings).toBe(true);
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ No validation errors');
      expect(consoleWarnSpy).toHaveBeenCalledWith('\n⚠️  VALIDATION WARNINGS:');
    });

    it('should handle complete validation flow with no issues', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      const result = ValidationOrchestrator.validateAndDisplay(mockConfig);

      expect(result.hasErrors).toBe(false);
      expect(result.hasWarnings).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ No validation errors');
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle validator returning empty result', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      const result = ValidationOrchestrator.validateAndDisplay(mockConfig);

      expect(result).toBeDefined();
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('should handle very long error messages', () => {
      const longError = 'Error: ' + 'A'.repeat(500);

      mockValidatorInstance.validate.mockReturnValue({
        valid: false,
        errors: [longError],
        warnings: []
      });

      expect(() => {
        ValidationOrchestrator.validateAndDisplay(mockConfig);
      }).toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(`  - ${longError}`);
    });

    it('should handle special characters in error messages', () => {
      const specialError = 'Error: <>&"\'\t\n';

      mockValidatorInstance.validate.mockReturnValue({
        valid: false,
        errors: [specialError],
        warnings: []
      });

      expect(() => {
        ValidationOrchestrator.validateAndDisplay(mockConfig);
      }).toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(`  - ${specialError}`);
    });

    it('should handle empty service arrays', () => {
      expect(() => {
        ValidationOrchestrator.displayServiceStatus([], false);
      }).not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalledWith('✓ Contract enforcement enabled');
    });

    it('should handle meta-entity configs without name property', () => {
      const invalidConfigs = [
        { id: 'config1' }, // Missing name
        { name: 'Valid Config' }
      ];

      expect(() => {
        ValidationOrchestrator.displayServiceStatus(invalidConfigs as any, false);
      }).not.toThrow();
    });
  });

  describe('ValidationResult interface', () => {
    it('should return object matching ValidationResult interface', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['test warning']
      });

      const result: ValidationResult = ValidationOrchestrator.validateAndDisplay(mockConfig);

      expect(result).toHaveProperty('hasErrors');
      expect(result).toHaveProperty('hasWarnings');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');

      expect(typeof result.hasErrors).toBe('boolean');
      expect(typeof result.hasWarnings).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should correctly set hasErrors flag', () => {
      const result = {
        hasErrors: ['Error'].length > 0,
        hasWarnings: false,
        errors: ['Error'],
        warnings: []
      };

      expect(result.hasErrors).toBe(true);
    });

    it('should correctly set hasWarnings flag', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['Warning']
      });

      const result = ValidationOrchestrator.validateAndDisplay(mockConfig);

      expect(result.hasWarnings).toBe(true);
      expect(result.hasErrors).toBe(false);
    });
  });

  describe('console output formatting', () => {
    it('should indent error messages with correct spacing', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: false,
        errors: ['Test error'],
        warnings: []
      });

      expect(() => {
        ValidationOrchestrator.validateAndDisplay(mockConfig);
      }).toThrow();

      // Error messages should be indented with "  - "
      expect(consoleErrorSpy).toHaveBeenCalledWith('  - Test error');
    });

    it('should indent warning messages with correct spacing', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['Test warning']
      });

      ValidationOrchestrator.validateAndDisplay(mockConfig);

      // Warning messages should be indented with "  - "
      expect(consoleWarnSpy).toHaveBeenCalledWith('  - Test warning');
    });

    it('should use checkmark emoji for success', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: []
      });

      ValidationOrchestrator.validateAndDisplay(mockConfig);

      expect(consoleLogSpy).toHaveBeenCalledWith('✓ No validation errors');
    });

    it('should use warning emoji for warnings header', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: true,
        errors: [],
        warnings: ['Warning']
      });

      ValidationOrchestrator.validateAndDisplay(mockConfig);

      expect(consoleWarnSpy).toHaveBeenCalledWith('\n⚠️  VALIDATION WARNINGS:');
    });

    it('should use cross emoji for errors header', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: false,
        errors: ['Error'],
        warnings: []
      });

      expect(() => {
        ValidationOrchestrator.validateAndDisplay(mockConfig);
      }).toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ VALIDATION ERRORS:');
    });

    it('should use newlines in headers appropriately', () => {
      mockValidatorInstance.validate.mockReturnValue({
        valid: false,
        errors: ['Error'],
        warnings: []
      });

      expect(() => {
        ValidationOrchestrator.validateAndDisplay(mockConfig);
      }).toThrow();

      // Error header should start with newline
      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ VALIDATION ERRORS:');
    });
  });
});
