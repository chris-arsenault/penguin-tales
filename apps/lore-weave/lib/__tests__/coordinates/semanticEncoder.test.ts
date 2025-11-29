/**
 * Tests for SemanticEncoder
 *
 * Tests:
 * - Tag encoding to coordinates
 * - Culture-weighted encoding
 * - Unconfigured tag handling
 * - Per-kind axis definitions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticEncoder } from '../../coordinates/semanticEncoder';
import type { SemanticEncoderConfig, EntityKindAxes, TagSemanticWeights } from '../../coordinates/types';

describe('SemanticEncoder', () => {
  let encoder: SemanticEncoder;

  const abilitiesAxes: EntityKindAxes = {
    entityKind: 'abilities',
    x: { name: 'offensive_defensive', low: 'defensive', high: 'offensive' },
    y: { name: 'physical_magical', low: 'physical', high: 'magical' },
    z: { name: 'individual_group', low: 'individual', high: 'group' }
  };

  const npcAxes: EntityKindAxes = {
    entityKind: 'npc',
    x: { name: 'lawful_chaotic', low: 'lawful', high: 'chaotic' },
    y: { name: 'kind_cruel', low: 'cruel', high: 'kind' },
    z: { name: 'timid_bold', low: 'timid', high: 'bold' }
  };

  const tagWeights: TagSemanticWeights[] = [
    {
      tag: 'combat',
      weights: {
        abilities: { offensive_defensive: 80, physical_magical: 30, individual_group: 40 },
        npc: { lawful_chaotic: 60, kind_cruel: 30, timid_bold: 70 }
      }
    },
    {
      tag: 'healing',
      weights: {
        abilities: { offensive_defensive: 10, physical_magical: 60, individual_group: 60 },
        npc: { lawful_chaotic: 40, kind_cruel: 90, timid_bold: 50 }
      }
    },
    {
      tag: 'stealth',
      weights: {
        abilities: { offensive_defensive: 30, physical_magical: 20, individual_group: 10 },
        npc: { lawful_chaotic: 70, kind_cruel: 50, timid_bold: 30 }
      }
    },
    {
      tag: 'leadership',
      weights: {
        abilities: { offensive_defensive: 50, physical_magical: 50, individual_group: 90 },
        npc: { lawful_chaotic: 30, kind_cruel: 60, timid_bold: 85 }
      }
    }
  ];

  const config: SemanticEncoderConfig = {
    axes: [abilitiesAxes, npcAxes],
    tagWeights,
    warnOnUnconfiguredTags: false // Disable warnings in tests
  };

  beforeEach(() => {
    encoder = new SemanticEncoder(config);
  });

  describe('Configuration', () => {
    it('should recognize configured entity kinds', () => {
      expect(encoder.hasConfigForKind('abilities')).toBe(true);
      expect(encoder.hasConfigForKind('npc')).toBe(true);
      expect(encoder.hasConfigForKind('unknown')).toBe(false);
    });

    it('should return axis definitions for configured kinds', () => {
      const axes = encoder.getAxes('abilities');
      expect(axes).toBeDefined();
      expect(axes?.x.name).toBe('offensive_defensive');
      expect(axes?.y.name).toBe('physical_magical');
      expect(axes?.z.name).toBe('individual_group');
    });

    it('should return undefined for unconfigured kinds', () => {
      const axes = encoder.getAxes('unknown');
      expect(axes).toBeUndefined();
    });
  });

  describe('Tag Encoding', () => {
    it('should encode tags to coordinates based on weights', () => {
      const result = encoder.encode('abilities', ['combat']);

      // Combat: offensive_defensive=80, physical_magical=30, individual_group=40
      // With jitter (±2), expect values close to these
      expect(result.coordinates.x).toBeGreaterThan(75);
      expect(result.coordinates.x).toBeLessThan(85);
      expect(result.coordinates.y).toBeGreaterThan(25);
      expect(result.coordinates.y).toBeLessThan(35);
    });

    it('should average weights for multiple tags', () => {
      // combat: offensive_defensive=80, healing: offensive_defensive=10
      // Average = 45
      const result = encoder.encode('abilities', ['combat', 'healing']);

      expect(result.coordinates.x).toBeGreaterThan(40);
      expect(result.coordinates.x).toBeLessThan(50);
    });

    it('should accept tags as object', () => {
      const result = encoder.encode('abilities', { combat: true, healing: true });
      expect(result.contributingTags).toContain('combat');
      expect(result.contributingTags).toContain('healing');
    });

    it('should track contributing tags', () => {
      const result = encoder.encode('abilities', ['combat', 'healing']);
      expect(result.contributingTags).toContain('combat');
      expect(result.contributingTags).toContain('healing');
      expect(result.hasConfiguredWeights).toBe(true);
    });
  });

  describe('Unconfigured Tags', () => {
    it('should handle unconfigured tags gracefully', () => {
      const result = encoder.encode('abilities', ['combat', 'unknown_tag']);

      expect(result.contributingTags).toContain('combat');
      expect(result.unconfiguredTags).toContain('unknown_tag');
    });

    it('should use default value (50) for unconfigured tags', () => {
      // Only unconfigured tag - should get ~50 on all axes
      const result = encoder.encode('abilities', ['unknown_tag']);

      expect(result.coordinates.x).toBeGreaterThan(45);
      expect(result.coordinates.x).toBeLessThan(55);
      expect(result.hasConfiguredWeights).toBe(false);
    });

    it('should return center for unconfigured entity kind', () => {
      const result = encoder.encode('unknown_kind', ['combat']);

      expect(result.coordinates.x).toBe(50);
      expect(result.coordinates.y).toBe(50);
      expect(result.coordinates.z).toBe(50);
      expect(result.hasConfiguredWeights).toBe(false);
    });
  });

  describe('Per-Kind Encoding', () => {
    it('should use different weights for different entity kinds', () => {
      const abilitiesResult = encoder.encode('abilities', ['combat']);
      const npcResult = encoder.encode('npc', ['combat']);

      // Same tag, different axes -> different coordinates
      // abilities: offensive_defensive=80
      // npc: lawful_chaotic=60
      expect(abilitiesResult.coordinates.x).not.toBe(npcResult.coordinates.x);
    });

    it('should encode same tags differently per kind', () => {
      // healing for abilities: kind_cruel axis N/A
      // healing for npc: kind_cruel=90
      const abilitiesResult = encoder.encode('abilities', ['healing']);
      const npcResult = encoder.encode('npc', ['healing']);

      // Y axis: abilities uses physical_magical=60, npc uses kind_cruel=90
      expect(Math.abs(abilitiesResult.coordinates.y - 60)).toBeLessThan(5);
      expect(Math.abs(npcResult.coordinates.y - 90)).toBeLessThan(5);
    });
  });

  describe('Coordinate Bounds', () => {
    it('should clamp coordinates to 0-100 range', () => {
      const result = encoder.encode('abilities', ['combat', 'combat', 'combat']);

      expect(result.coordinates.x).toBeGreaterThanOrEqual(0);
      expect(result.coordinates.x).toBeLessThanOrEqual(100);
      expect(result.coordinates.y).toBeGreaterThanOrEqual(0);
      expect(result.coordinates.y).toBeLessThanOrEqual(100);
      expect(result.coordinates.z).toBeGreaterThanOrEqual(0);
      expect(result.coordinates.z).toBeLessThanOrEqual(100);
    });

    it('should add jitter to prevent exact overlaps', () => {
      // Same tags should produce slightly different coordinates due to jitter
      const result1 = encoder.encode('abilities', ['combat']);
      const result2 = encoder.encode('abilities', ['combat']);

      // At least one coordinate should differ due to jitter
      const exactMatch =
        result1.coordinates.x === result2.coordinates.x &&
        result1.coordinates.y === result2.coordinates.y &&
        result1.coordinates.z === result2.coordinates.z;

      expect(exactMatch).toBe(false);
    });
  });

  describe('Empty Tags', () => {
    it('should return center for empty tag array', () => {
      const result = encoder.encode('abilities', []);

      // Center is 50, with jitter of ±2
      expect(result.coordinates.x).toBeGreaterThan(45);
      expect(result.coordinates.x).toBeLessThan(55);
      expect(result.coordinates.y).toBeGreaterThan(45);
      expect(result.coordinates.y).toBeLessThan(55);
      expect(result.coordinates.z).toBeGreaterThan(45);
      expect(result.coordinates.z).toBeLessThan(55);
    });

    it('should return center for empty tag object', () => {
      const result = encoder.encode('abilities', {});

      // Center is 50, with jitter of ±2
      expect(result.coordinates.x).toBeGreaterThan(45);
      expect(result.coordinates.x).toBeLessThan(55);
      expect(result.coordinates.y).toBeGreaterThan(45);
      expect(result.coordinates.y).toBeLessThan(55);
      expect(result.coordinates.z).toBeGreaterThan(45);
      expect(result.coordinates.z).toBeLessThan(55);
    });
  });
});
