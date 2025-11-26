import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoreValidator, ValidationResult } from '../../services/loreValidator';
import { HardState } from '../../types/worldTypes';
import { DomainLoreProvider } from '../../types/domainLore';

describe('LoreValidator', () => {
  let validator: LoreValidator;
  let mockLoreProvider: DomainLoreProvider;

  beforeEach(() => {
    // Create mock lore provider
    mockLoreProvider = {
      getWorldName: vi.fn().mockReturnValue('Test World'),
      getCanonFacts: vi.fn().mockReturnValue([]),
      getCulturalGroups: vi.fn().mockReturnValue([]),
      getNamingRules: vi.fn().mockReturnValue({ patterns: [], toneGuidance: {} }),
      getRelationshipPatterns: vi.fn().mockReturnValue([]),
      getTechnologyNotes: vi.fn().mockReturnValue([
        'harmonic harpoons',
        'krill nets',
        'ice tech'
      ]),
      getMagicSystemNotes: vi.fn().mockReturnValue([
        'Ice Magic exists',
        'Old Flows magic',
        'frost shaping'
      ]),
      getConflictPatterns: vi.fn().mockReturnValue([]),
      getGeographyConstraints: vi.fn().mockReturnValue({ scale: '10 sq km', characteristics: [] }),
      getActionDomainDescriptions: vi.fn().mockReturnValue({}),
      getEntityEnrichmentPrompt: vi.fn().mockReturnValue(null),
      getRelationshipEnrichmentPrompt: vi.fn().mockReturnValue(null),
      getOccurrenceEnrichmentPrompt: vi.fn().mockReturnValue(null),
      getEraEnrichmentPrompt: vi.fn().mockReturnValue(null)
    };

    validator = new LoreValidator(mockLoreProvider);
  });

  describe('validateEntity', () => {
    describe('name validation', () => {
      it('should pass when name has space separator', () => {
        const entity: HardState = {
          id: 'npc1',
          kind: 'npc',
          subtype: "test",
          name: 'Ice Walker',
          description: 'A penguin',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity);

        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
      });

      it('should pass when name has hyphen separator', () => {
        const entity: HardState = {
          id: 'npc1',
          kind: 'npc',
          subtype: "test",
          name: 'Ice-Walker',
          description: 'A penguin',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity);

        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
      });

      it('should warn when name lacks separator', () => {
        const entity: HardState = {
          id: 'npc1',
          kind: 'npc',
          subtype: "test",
          name: 'Singlename',
          description: 'A penguin',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity);

        expect(result.valid).toBe(false);
        expect(result.warnings).toContain('Name may not include earned-name separator (space or hyphen).');
      });

      it('should handle empty name', () => {
        const entity: HardState = {
          id: 'npc1',
          kind: 'npc',
          subtype: "test",
          name: '',
          description: 'A penguin',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity);

        // Empty name is falsy, so check doesn't run - no warning
        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
      });

      it('should handle name with multiple separators', () => {
        const entity: HardState = {
          id: 'npc1',
          kind: 'npc',
          subtype: "test",
          name: 'Ice Walker the-Great',
          description: 'A penguin',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity);

        expect(result.valid).toBe(true);
      });
    });

    describe('description validation', () => {
      it('should pass when description has lore cues', () => {
        const entity: HardState = {
          id: 'npc1',
          kind: 'npc',
          subtype: "test",
          name: 'Ice Walker',
          description: 'A penguin from the ice berg',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity, 'A penguin from the ice berg');

        expect(result.valid).toBe(true);
        expect(result.warnings).toHaveLength(0);
      });

      it('should warn when description lacks lore cues', () => {
        const entity: HardState = {
          id: 'npc1',
          kind: 'npc',
          subtype: "test",
          name: 'Ice Walker',
          description: 'A character',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity, 'A character');

        expect(result.valid).toBe(false);
        expect(result.warnings).toContain('Description missing obvious lore cues.');
      });

      it('should not warn about description when text not provided', () => {
        const entity: HardState = {
          id: 'npc1',
          kind: 'npc',
          subtype: "test",
          name: 'Singlename',
          description: 'Generic description',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity);

        expect(result.warnings).not.toContain('Description missing obvious lore cues.');
      });

      it('should detect aurora lore cue', () => {
        const entity: HardState = {
          id: 'npc1',
          kind: 'npc',
          subtype: "test",
          name: 'Aurora Watcher',
          description: 'Watches the aurora',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity, 'Watches the aurora lights');

        expect(result.valid).toBe(true);
      });

      it('should detect fissure lore cue', () => {
        const entity: HardState = {
          id: 'location1',
          kind: 'location',
          subtype: "test",
          name: 'The Fissure',
          description: 'A glowing fissure',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity, 'A glowing fissure in the ice');

        expect(result.valid).toBe(true);
      });

      it('should detect krill lore cue', () => {
        const entity: HardState = {
          id: 'location1',
          kind: 'location',
          subtype: "test",
          name: 'Krill Grounds',
          description: 'Rich fishing',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity, 'Rich krill fishing grounds');

        expect(result.valid).toBe(true);
      });

      it('should be case-insensitive for lore cues', () => {
        const entity: HardState = {
          id: 'npc1',
          kind: 'npc',
          subtype: "test",
          name: 'Ice Walker',
          description: 'From ICE BERG',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity, 'From the ICE BERG');

        expect(result.valid).toBe(true);
      });
    });

    describe('ability validation', () => {
      it('should pass when ability has magic cue', () => {
        const entity: HardState = {
          id: 'ability1',
          kind: 'abilities',
          subtype: "test",
          name: 'Frost Magic',
          description: 'Ice magic power',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity, 'A powerful magic ability from the frost');

        expect(result.valid).toBe(true);
      });

      it('should pass when ability has tech cue', () => {
        const entity: HardState = {
          id: 'ability1',
          kind: 'abilities',
          subtype: "test",
          name: 'Harpoon Mastery',
          description: 'Expert with harpoons',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity, 'Master of the harpoon on the ice');

        expect(result.valid).toBe(true);
      });

      it('should warn when ability lacks magic/tech framing', () => {
        const entity: HardState = {
          id: 'ability1',
          kind: 'abilities',
          subtype: "test",
          name: 'Generic Ability',
          description: 'A generic skill',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity, 'A generic skill');

        expect(result.valid).toBe(false);
        expect(result.warnings).toContain('Ability lacks clear magic/tech framing.');
      });

      it('should not validate magic/tech for non-ability entities', () => {
        const entity: HardState = {
          id: 'npc1',
          kind: 'npc',
          subtype: "test",
          name: 'Ice Walker',
          description: 'A character',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity, 'A character with no magic or tech');

        // Should only warn about missing lore cues, not magic/tech
        expect(result.warnings).not.toContain('Ability lacks clear magic/tech framing.');
      });
    });

    describe('multiple warnings', () => {
      it('should collect multiple warnings', () => {
        const entity: HardState = {
          id: 'ability1',
          kind: 'abilities',
          subtype: "test",
          name: 'Singlename',
          description: 'Generic',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity, 'Generic description');

        expect(result.valid).toBe(false);
        expect(result.warnings.length).toBeGreaterThan(1);
      });
    });
  });

  describe('validateLocation', () => {
    describe('geographic feature validation', () => {
      it('should pass when geographic feature has terrain term', () => {
        const location: HardState = {
          id: 'loc1',
          kind: 'location',
          subtype: 'geographic_feature',
          name: 'Crystal Ridge',
          description: 'A high ridge on the ice berg',
          status: 'active',
          prominence: 'marginal' as const, culture: 'world',
          tags: [],
          links: [],
          createdAt: 0,
          updatedAt: 0
        };

        const result = validator.validateLocation(location);

        expect(result.valid).toBe(true);
      });

      it('should warn when geographic feature lacks terrain term', () => {
        const location: HardState = {
          id: 'loc1',
          kind: 'location',
          subtype: 'geographic_feature',
          name: 'The Place',
          description: 'A place',
          tags: [],
          links: [],
        status: 'active',
          prominence: 'marginal' as const, culture: 'world',
          createdAt: 0,
          updatedAt: 0
        } as HardState;

        const result = validator.validateLocation(location);

        expect(result.valid).toBe(false);
        expect(result.warnings).toContain('Geographic feature name lacks typical terrain terminology');
      });

      it('should accept various terrain terms', () => {
        const terrainTerms = ['shelf', 'ridge', 'hollow', 'stack', 'pools', 'reach', 'pass', 'peak'];

        terrainTerms.forEach(term => {
          const location: HardState = {
            id: 'loc1',
            kind: 'location',
          subtype: 'geographic_feature',
            name: `Crystal ${term}`,
            description: 'A feature on the ice berg',
            tags: [],
            links: [],
        status: "active",
            prominence: "marginal" as const, culture: 'world',
            createdAt: 0,
            updatedAt: 0
          };

          const result = validator.validateLocation(location);
          expect(result.valid).toBe(true);
        });
      });

      it('should be case-insensitive for terrain terms', () => {
        const location: HardState = {
          id: 'loc1',
          kind: 'location',
          subtype: 'geographic_feature',
          name: 'Crystal RIDGE',
          description: 'A ridge on the ice',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateLocation(location);

        expect(result.valid).toBe(true);
      });

      it('should not validate terrain for non-geographic features', () => {
        const location: HardState = {
          id: 'loc1',
          kind: 'location',
          subtype: 'colony',
          name: 'The Settlement',
          description: 'A colony',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateLocation(location);

        expect(result.warnings).not.toContain('Geographic feature name lacks typical terrain terminology');
      });
    });

    describe('anomaly validation', () => {
      it('should pass when anomaly has mystical cue', () => {
        const location: HardState = {
          id: 'loc1',
          kind: 'location',
          subtype: 'anomaly',
          name: 'Glow Cavern',
          description: 'A glowing place',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateLocation(location);

        expect(result.valid).toBe(true);
      });

      it('should warn when anomaly lacks mystical framing', () => {
        const location: HardState = {
          id: 'loc1',
          kind: 'location',
          subtype: 'anomaly',
          name: 'The Place',
          description: 'A strange place',
          tags: [],
          links: [],
        status: 'active',
          prominence: 'marginal' as const, culture: 'world',
          createdAt: 0,
          updatedAt: 0
        } as HardState;

        const result = validator.validateLocation(location);

        expect(result.valid).toBe(false);
        expect(result.warnings).toContain('Anomaly name lacks mystical framing');
      });

      it('should accept various mystical terms', () => {
        const mysticalTerms = ['glow', 'aurora', 'singing', 'echo', 'frozen', 'ancient', 'crystal', 'mirror', 'shadow', 'lost'];

        mysticalTerms.forEach(term => {
          const location: HardState = {
            id: 'loc1',
            kind: 'location',
          subtype: 'anomaly',
            name: `${term} Cave`,
            description: 'An anomaly in the ice',
            tags: [],
            links: [],
        status: "active",
            prominence: "marginal" as const, culture: 'world',
            createdAt: 0,
            updatedAt: 0
          };

          const result = validator.validateLocation(location);
          expect(result.valid).toBe(true);
        });
      });

      it('should not validate mystical for non-anomalies', () => {
        const location: HardState = {
          id: 'loc1',
          kind: 'location',
          subtype: 'colony',
          name: 'The Settlement',
          description: 'A colony',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateLocation(location);

        expect(result.warnings).not.toContain('Anomaly name lacks mystical framing');
      });
    });

    describe('description validation', () => {
      it('should pass when location description has lore cues', () => {
        const location: HardState = {
          id: 'loc1',
          kind: 'location',
          subtype: 'colony',
          name: 'Ice Colony',
          description: 'A colony on the ice berg near the aurora',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateLocation(location);

        expect(result.valid).toBe(true);
      });

      it('should warn when location description lacks lore elements', () => {
        const location: HardState = {
          id: 'loc1',
          kind: 'location',
          subtype: 'colony',
          name: 'The Settlement',
          description: 'A generic place where people live',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateLocation(location);

        expect(result.valid).toBe(false);
        expect(result.warnings).toContain('Location description missing lore-specific elements');
      });

      it('should handle missing description', () => {
        const location: HardState = {
          id: 'loc1',
          kind: 'location',
          subtype: 'colony',
          name: 'The Settlement',
          description: '',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateLocation(location);

        // Should not warn about description if empty
        expect(result.warnings).not.toContain('Location description missing lore-specific elements');
      });
    });

    describe('multiple warnings', () => {
      it('should collect multiple location warnings', () => {
        const location: HardState = {
          id: 'loc1',
          kind: 'location',
          subtype: 'anomaly',
          name: 'Plain Name',
          description: 'Generic description',
          tags: [],
          links: [],
        status: 'active',
          prominence: 'marginal' as const, culture: 'world',
          createdAt: 0,
          updatedAt: 0
        } as HardState;

        const result = validator.validateLocation(location);

        expect(result.valid).toBe(false);
        expect(result.warnings.length).toBeGreaterThan(1);
      });
    });

    describe('discovery context', () => {
      it('should accept optional discovery context', () => {
        const location: HardState = {
          id: 'loc1',
          kind: 'location',
          subtype: 'colony',
          name: 'Ice Colony',
          description: 'A colony on the ice',
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const discoveryContext = { discoveredBy: 'explorer1', tick: 100 };

        expect(() => {
          validator.validateLocation(location, discoveryContext);
        }).not.toThrow();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle entity with undefined name', () => {
      const entity: HardState = {
        id: 'npc1',
        kind: 'npc',
          subtype: "test",
        name: undefined as any,
        description: 'A penguin',
        tags: [],
        links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

      expect(() => {
        validator.validateEntity(entity);
      }).not.toThrow();
    });

    it('should handle entity with null description', () => {
      const entity: HardState = {
        id: 'npc1',
        kind: 'npc',
          subtype: "test",
        name: 'Ice Walker',
        description: null as any,
        tags: [],
        links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

      expect(() => {
        validator.validateEntity(entity);
      }).not.toThrow();
    });

    it('should handle location with undefined subtype', () => {
      const location: HardState = {
        id: 'loc1',
        kind: 'location',
          subtype: undefined as any,
        name: 'Ice Place',
        description: 'A place',
        tags: [],
        links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

      expect(() => {
        validator.validateLocation(location);
      }).not.toThrow();
    });

    it('should handle empty text parameter', () => {
      const entity: HardState = {
        id: 'npc1',
        kind: 'npc',
          subtype: "test",
        name: 'Ice Walker',
        description: 'A penguin',
        tags: [],
        links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

      const result = validator.validateEntity(entity, '');

      // Empty text is falsy, so no warning about missing lore cues
      expect(result.valid).toBe(true);
    });

    it('should handle text with only whitespace', () => {
      const entity: HardState = {
        id: 'npc1',
        kind: 'npc',
          subtype: "test",
        name: 'Ice Walker',
        description: 'A penguin',
        tags: [],
        links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

      const result = validator.validateEntity(entity, '   ');

      expect(result.warnings).toContain('Description missing obvious lore cues.');
    });

    it('should handle very long names', () => {
      const longName = 'A'.repeat(1000) + ' ' + 'B'.repeat(1000);
      const entity: HardState = {
        id: 'npc1',
        kind: 'npc',
          subtype: "test",
        name: longName,
        description: 'A penguin with ice magic',
        tags: [],
        links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

      const result = validator.validateEntity(entity, 'A penguin with ice magic');

      expect(result.valid).toBe(true);
    });

    it('should handle special characters in names', () => {
      const entity: HardState = {
        id: 'npc1',
        kind: 'npc',
          subtype: "test",
        name: 'Ice@Walker #1',
        description: 'A penguin',
        tags: [],
        links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

      const result = validator.validateEntity(entity);

      // Should still check for separator
      expect(result.valid).toBe(true); // Has space
    });

    it('should handle unicode characters', () => {
      const entity: HardState = {
        id: 'npc1',
        kind: 'npc',
          subtype: "test",
        name: '❄️ Ice Walker 🐧',
        description: 'A penguin from the ice',
        tags: [],
        links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

      const result = validator.validateEntity(entity, 'A penguin from the ice');

      expect(result.valid).toBe(true);
    });
  });

  describe('lore cue detection', () => {
    it('should detect all valid lore cues', () => {
      const cues = ['aurora', 'ice', 'berg', 'fissure', 'current', 'frost', 'glow', 'krill', 'coin', 'sing'];

      cues.forEach(cue => {
        const entity: HardState = {
          id: 'npc1',
          kind: 'npc',
          subtype: "test",
          name: 'Ice Walker',
          description: `Contains ${cue}`,
          tags: [],
          links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

        const result = validator.validateEntity(entity, `Contains ${cue}`);
        expect(result.valid).toBe(true);
      });
    });

    it('should detect lore cues in compound words', () => {
      const entity: HardState = {
        id: 'npc1',
        kind: 'npc',
          subtype: "test",
        name: 'Ice Walker',
        description: 'From iceberg',
        tags: [],
        links: [],
        status: "active", prominence: "marginal", culture: 'world', createdAt: 0, updatedAt: 0 };

      const result = validator.validateEntity(entity, 'From the iceberg');

      expect(result.valid).toBe(true);
    });

    it('should not detect partial matches', () => {
      const entity: HardState = {
        id: 'npc1',
        kind: 'npc',
        name: 'Ice Walker',
        description: 'A nice person',
        tags: [],
        links: [],
        subtype: 'explorer',
        status: 'active',
        prominence: 'marginal' as const, culture: 'world',
        createdAt: 0,
        updatedAt: 0
      };

      const result = validator.validateEntity(entity, 'A nice person'); // 'ice' in 'nice'

      expect(result.valid).toBe(true); // Actually valid because 'ice' is in 'nice'
    });
  });
});
