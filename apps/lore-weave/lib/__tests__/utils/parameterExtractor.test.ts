// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { ParameterExtractor, extractParams } from '../../engine/parameterExtractor';
import { ComponentMetadata } from '../../engine/types';

describe('ParameterExtractor', () => {
  describe('constructor', () => {
    it('should initialize with metadata', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          testParam: { value: 42 },
        },
      };

      const extractor = new ParameterExtractor(metadata);
      expect(extractor).toBeDefined();
    });

    it('should handle undefined metadata', () => {
      const extractor = new ParameterExtractor(undefined);
      expect(extractor).toBeDefined();
    });
  });

  describe('get', () => {
    it('should extract parameter value', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          throttleChance: { value: 0.5 },
        },
      };

      const extractor = new ParameterExtractor(metadata);
      const value = extractor.get('throttleChance', 0.3);

      expect(value).toBe(0.5);
    });

    it('should return default if parameter not found', () => {
      const metadata: ComponentMetadata = {
        parameters: {},
      };

      const extractor = new ParameterExtractor(metadata);
      const value = extractor.get('missingParam', 100);

      expect(value).toBe(100);
    });

    it('should return default if metadata undefined', () => {
      const extractor = new ParameterExtractor(undefined);
      const value = extractor.get('anyParam', 'default');

      expect(value).toBe('default');
    });

    it('should handle different types', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          number: { value: 42 },
          string: { value: 'hello' },
          boolean: { value: true },
          object: { value: { nested: 'value' } },
        },
      };

      const extractor = new ParameterExtractor(metadata);

      expect(extractor.get('number', 0)).toBe(42);
      expect(extractor.get('string', '')).toBe('hello');
      expect(extractor.get('boolean', false)).toBe(true);
      expect(extractor.get('object', {})).toEqual({ nested: 'value' });
    });
  });

  describe('getAll', () => {
    it('should extract multiple parameters at once', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          throttleChance: { value: 0.5 },
          baseChance: { value: 0.8 },
          maxAttempts: { value: 10 },
        },
      };

      const extractor = new ParameterExtractor(metadata);
      const params = extractor.getAll({
        throttleChance: 0.3,
        baseChance: 0.2,
        maxAttempts: 5,
      });

      expect(params).toEqual({
        throttleChance: 0.5,
        baseChance: 0.8,
        maxAttempts: 10,
      });
    });

    it('should use defaults for missing parameters', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          throttleChance: { value: 0.5 },
        },
      };

      const extractor = new ParameterExtractor(metadata);
      const params = extractor.getAll({
        throttleChance: 0.3,
        baseChance: 0.2,
        maxAttempts: 5,
      });

      expect(params).toEqual({
        throttleChance: 0.5,
        baseChance: 0.2, // default
        maxAttempts: 5, // default
      });
    });

    it('should return all defaults if no metadata', () => {
      const extractor = new ParameterExtractor(undefined);
      const params = extractor.getAll({
        param1: 'default1',
        param2: 'default2',
      });

      expect(params).toEqual({
        param1: 'default1',
        param2: 'default2',
      });
    });
  });

  describe('getValidated', () => {
    it('should return value if validation passes', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          count: { value: 10 },
        },
      };

      const extractor = new ParameterExtractor(metadata);
      const value = extractor.getValidated('count', 5, (v) => v > 0);

      expect(value).toBe(10);
    });

    it('should throw if validation fails', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          count: { value: -5 },
        },
      };

      const extractor = new ParameterExtractor(metadata);

      expect(() => {
        extractor.getValidated('count', 5, (v) => v > 0);
      }).toThrow();
    });

    it('should validate default value if parameter missing', () => {
      const extractor = new ParameterExtractor(undefined);

      expect(() => {
        extractor.getValidated('missing', -1, (v) => v >= 0);
      }).toThrow();
    });
  });

  describe('getNumber', () => {
    it('should extract numeric parameter', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          value: { value: 42 },
        },
      };

      const extractor = new ParameterExtractor(metadata);
      const num = extractor.getNumber('value', 10);

      expect(num).toBe(42);
    });

    it('should enforce minimum bound', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          value: { value: 5 },
        },
      };

      const extractor = new ParameterExtractor(metadata);
      const num = extractor.getNumber('value', 10, 10, 100);

      expect(num).toBe(10); // Clamped to min
    });

    it('should enforce maximum bound', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          value: { value: 150 },
        },
      };

      const extractor = new ParameterExtractor(metadata);
      const num = extractor.getNumber('value', 10, 0, 100);

      expect(num).toBe(100); // Clamped to max
    });

    it('should allow value within bounds', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          value: { value: 50 },
        },
      };

      const extractor = new ParameterExtractor(metadata);
      const num = extractor.getNumber('value', 10, 0, 100);

      expect(num).toBe(50);
    });
  });

  describe('getBoolean', () => {
    it('should extract boolean parameter', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          enabled: { value: true },
        },
      };

      const extractor = new ParameterExtractor(metadata);
      const bool = extractor.getBoolean('enabled', false);

      expect(bool).toBe(true);
    });

    it('should return default for missing boolean', () => {
      const extractor = new ParameterExtractor(undefined);
      const bool = extractor.getBoolean('missing', false);

      expect(bool).toBe(false);
    });
  });

  describe('getString', () => {
    it('should extract string parameter', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          name: { value: 'test' },
        },
      };

      const extractor = new ParameterExtractor(metadata);
      const str = extractor.getString('name', 'default');

      expect(str).toBe('test');
    });

    it('should return default for missing string', () => {
      const extractor = new ParameterExtractor(undefined);
      const str = extractor.getString('missing', 'default');

      expect(str).toBe('default');
    });
  });

  describe('has', () => {
    it('should return true if parameter exists', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          existing: { value: 42 },
        },
      };

      const extractor = new ParameterExtractor(metadata);

      expect(extractor.has('existing')).toBe(true);
      expect(extractor.has('missing')).toBe(false);
    });

    it('should return false if metadata undefined', () => {
      const extractor = new ParameterExtractor(undefined);

      expect(extractor.has('anyParam')).toBe(false);
    });
  });

  describe('keys', () => {
    it('should return all parameter keys', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          param1: { value: 1 },
          param2: { value: 2 },
          param3: { value: 3 },
        },
      };

      const extractor = new ParameterExtractor(metadata);
      const keys = extractor.keys();

      expect(keys).toEqual(['param1', 'param2', 'param3']);
    });

    it('should return empty array if no parameters', () => {
      const extractor = new ParameterExtractor(undefined);
      const keys = extractor.keys();

      expect(keys).toEqual([]);
    });
  });

  describe('extractParams helper', () => {
    it('should extract parameters using helper function', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          throttleChance: { value: 0.7 },
          baseChance: { value: 0.3 },
        },
      };

      const params = extractParams(metadata, {
        throttleChance: 0.5,
        baseChance: 0.2,
        maxAttempts: 10,
      });

      expect(params).toEqual({
        throttleChance: 0.7,
        baseChance: 0.3,
        maxAttempts: 10, // default
      });
    });

    it('should handle undefined metadata', () => {
      const params = extractParams(undefined, {
        param1: 'default1',
        param2: 'default2',
      });

      expect(params).toEqual({
        param1: 'default1',
        param2: 'default2',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null/undefined parameter values', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          nullValue: { value: null },
          undefinedValue: { value: undefined },
        },
      };

      const extractor = new ParameterExtractor(metadata);

      expect(extractor.get('nullValue', 'default')).toBe('default');
      expect(extractor.get('undefinedValue', 'default')).toBe('default');
    });

    it('should handle zero and false values correctly', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          zero: { value: 0 },
          falseBool: { value: false },
        },
      };

      const extractor = new ParameterExtractor(metadata);

      expect(extractor.get('zero', 10)).toBe(0);
      expect(extractor.get('falseBool', true)).toBe(false);
    });

    it('should handle empty string', () => {
      const metadata: ComponentMetadata = {
        parameters: {
          empty: { value: '' },
        },
      };

      const extractor = new ParameterExtractor(metadata);

      expect(extractor.get('empty', 'default')).toBe('');
    });
  });
});
