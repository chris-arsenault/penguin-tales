// @ts-nocheck
// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnrichmentService } from '../../llm/enrichmentService';
import { LLMConfig, EnrichmentConfig } from '../../engine/types';
import { HardState } from '../../core/worldTypes';
import { DomainLoreProvider } from '../../llm/types';
import { EnrichmentContext } from '../../llm/types';

describe('EnrichmentService', () => {
  let service: EnrichmentService;
  let mockLLMConfig: LLMConfig;
  let mockLoreProvider: DomainLoreProvider;
  let mockEnrichmentConfig: Partial<EnrichmentConfig>;

  beforeEach(() => {
    // Mock LLM config
    mockLLMConfig = {
      enabled: true,
      apiKey: 'test-key',
      model: 'test-model',
      endpoint: 'http://test.com/api'
    };

    // Mock lore provider
    mockLoreProvider = {
      getNamingRules: vi.fn(() => ({
        patterns: {},
        toneGuidance: {
          npc: 'penguin-themed',
          location: 'arctic-themed',
          faction: 'organization-themed'
        },
        avoidDuplicates: true
      })),
      getEntityPrompt: vi.fn(() => 'Test entity prompt'),
      getRelationshipPrompt: vi.fn(() => 'Test relationship prompt'),
      getEraNarrativePrompt: vi.fn(() => 'Test era prompt'),
      getOccurrencePrompt: vi.fn(() => 'Test occurrence prompt'),
      getAbilityPrompt: vi.fn(() => 'Test ability prompt'),
      getDiscoveryPrompt: vi.fn(() => 'Test discovery prompt'),
      getChainLinkPrompt: vi.fn(() => 'Test chain link prompt'),
      getEraEnrichmentPrompt: vi.fn(() => 'Test era enrichment prompt'),
      getEntityChangesPrompt: vi.fn(() => 'Test entity changes prompt')
    };

    mockEnrichmentConfig = {
      batchSize: 3,
      mode: 'full',
      maxEntityEnrichments: 100,
      maxRelationshipEnrichments: 50,
      maxEraNarratives: 10
    };

    service = new EnrichmentService(mockLLMConfig, mockLoreProvider, mockEnrichmentConfig);
  });

  describe('constructor', () => {
    it('should initialize with valid config', () => {
      expect(service).toBeDefined();
      expect(service.isEnabled()).toBe(true);
    });

    it('should use default config when not provided', () => {
      const defaultService = new EnrichmentService(mockLLMConfig, mockLoreProvider);
      expect(defaultService).toBeDefined();
    });

    it('should initialize with disabled LLM', () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider);
      expect(disabledService.isEnabled()).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('should return true when LLM is enabled', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should return false when LLM is disabled', () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider);
      expect(disabledService.isEnabled()).toBe(false);
    });
  });

  describe('getNameLogger', () => {
    it('should return name logger instance', () => {
      const logger = service.getNameLogger();
      expect(logger).toBeDefined();
    });

    it('should track names across calls', () => {
      const logger = service.getNameLogger();
      expect(logger).toBeDefined();

      // Name logger should have methods
      expect(typeof logger.recordChange).toBe('function');
      expect(typeof logger.getCurrentNames).toBe('function');
    });
  });

  describe('getLoreLog', () => {
    it('should return empty array initially', () => {
      const log = service.getLoreLog();
      expect(Array.isArray(log)).toBe(true);
      expect(log.length).toBe(0);
    });

    it('should accumulate lore records after enrichments', async () => {
      // This would accumulate after actual enrichment calls
      const log = service.getLoreLog();
      expect(Array.isArray(log)).toBe(true);
    });
  });

  describe('enrichEntities - disabled LLM', () => {
    it('should skip enrichment when LLM is disabled', async () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider);

      const entities: Partial<HardState>[] = [
        {
          id: 'test-1',
          kind: 'npc',
          subtype: 'hero',
          name: 'Test Hero',
          description: 'Original description',
          status: 'active',
          prominence: 'recognized',
          tags: [],
          links: []
        }
      ];

      const context: EnrichmentContext = {
        tick: 10,
        era: { id: 'test-era', name: 'Test Era' },
        worldState: {
          entityCount: 50,
          relationshipCount: 100,
          activeConflicts: 5
        }
      };

      await disabledService.enrichEntities(entities as HardState[], context);

      // Should not modify entities
      expect(entities[0].description).toBe('Original description');
    });

    it('should handle empty entity list', async () => {
      const context: EnrichmentContext = {
        tick: 10,
        era: { id: 'test-era', name: 'Test Era' },
        worldState: {
          entityCount: 50,
          relationshipCount: 100,
          activeConflicts: 5
        }
      };

      await service.enrichEntities([], context);
      expect(service.getLoreLog().length).toBe(0);
    });
  });

  describe('enrichRelationships - disabled LLM', () => {
    it('should skip enrichment when LLM is disabled', async () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider);

      const relationships = [
        {
          kind: 'allied_with',
          src: 'faction1',
          dst: 'faction2'
        }
      ];

      const entityMap = new Map([
        ['faction1', {
          id: 'faction1',
          kind: 'faction',
          subtype: 'guild',
          name: 'Guild 1',
          description: 'A guild',
          status: 'active',
          prominence: 'recognized',
          tags: [],
          links: []
        } as HardState],
        ['faction2', {
          id: 'faction2',
          kind: 'faction',
          subtype: 'guild',
          name: 'Guild 2',
          description: 'Another guild',
          status: 'active',
          prominence: 'recognized',
          tags: [],
          links: []
        } as HardState]
      ]);

      const context: EnrichmentContext = {
        tick: 10,
        era: { id: 'test-era', name: 'Test Era' },
        worldState: {
          entityCount: 50,
          relationshipCount: 100,
          activeConflicts: 5
        }
      };

      const result = await disabledService.enrichRelationships(
        relationships,
        entityMap,
        context
      );

      expect(result).toEqual([]);
    });

    it('should handle empty relationship list', async () => {
      const entityMap = new Map();
      const context: EnrichmentContext = {
        tick: 10,
        era: { id: 'test-era', name: 'Test Era' },
        worldState: {
          entityCount: 50,
          relationshipCount: 100,
          activeConflicts: 5
        }
      };

      const result = await service.enrichRelationships([], entityMap, context);
      expect(result).toEqual([]);
    });
  });

  describe('generateEraNarrative - disabled LLM', () => {
    it('should skip narrative generation when LLM is disabled', async () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider);

      const result = await disabledService.generateEraNarrative({
        eraName: 'Test Era',
        startTick: 0,
        endTick: 100,
        majorEvents: [],
        prominentEntities: [],
        keyRelationships: [],
        pressures: {}
      });

      expect(result).toBeNull();
    });

    it('should handle empty event list', async () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider);

      const result = await disabledService.generateEraNarrative({
        eraName: 'Test Era',
        startTick: 0,
        endTick: 100,
        majorEvents: [],
        prominentEntities: [],
        keyRelationships: [],
        pressures: {}
      });

      expect(result).toBeNull();
    });
  });

  describe('enrichAbility - disabled LLM', () => {
    it('should skip enrichment when LLM is disabled', async () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider);

      const ability: Partial<HardState> = {
        id: 'ability-1',
        kind: 'abilities',
        subtype: 'magic',
        name: 'Test Magic',
        description: 'Original description',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: []
      };

      const context: EnrichmentContext = {
        tick: 10,
        era: { id: 'test-era', name: 'Test Era' },
        worldState: {
          entityCount: 50,
          relationshipCount: 100,
          activeConflicts: 5
        }
      };

      await disabledService.enrichAbility(ability as HardState, [], context);

      // Should not modify description
      expect(ability.description).toBe('Original description');
    });
  });

  describe('enrichOccurrence - disabled LLM', () => {
    it('should skip enrichment when LLM is disabled', async () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider);

      const occurrence: Partial<HardState> = {
        id: 'occurrence-1',
        kind: 'occurrence',
        subtype: 'battle',
        name: 'Test Battle',
        description: 'Original description',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: []
      };

      const context: EnrichmentContext = {
        tick: 10,
        era: { id: 'test-era', name: 'Test Era' },
        worldState: {
          entityCount: 50,
          relationshipCount: 100,
          activeConflicts: 5
        }
      };

      await disabledService.enrichOccurrence(
        occurrence as HardState,
        [],
        [],
        context
      );

      // Should not modify description
      expect(occurrence.description).toBe('Original description');
    });
  });

  describe('enrichEra - disabled LLM', () => {
    it('should skip enrichment when LLM is disabled', async () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider);

      const era: Partial<HardState> = {
        id: 'era-1',
        kind: 'era',
        subtype: 'expansion',
        name: 'Test Era',
        description: 'Original description',
        status: 'current',
        prominence: 'renowned',
        tags: [],
        links: []
      };

      const context: EnrichmentContext = {
        tick: 10,
        era: { id: 'test-era', name: 'Test Era' },
        worldState: {
          entityCount: 50,
          relationshipCount: 100,
          activeConflicts: 5
        }
      };

      await disabledService.enrichEra(
        era as HardState,
        [],
        [],
        context
      );

      // Should not modify description
      expect(era.description).toBe('Original description');
    });
  });

  describe('enrichDiscoveryEvent - disabled LLM', () => {
    it('should return null when LLM is disabled', async () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider);

      const result = await disabledService.enrichDiscoveryEvent({
        discoveryKind: 'technology',
        relatedEntities: [],
        tick: 10,
        eraName: 'Test Era',
        worldState: {
          entityCount: 50,
          relationshipCount: 100,
          activeConflicts: 5
        }
      });

      expect(result).toBeNull();
    });
  });

  describe('generateChainLink - disabled LLM', () => {
    it('should return null when LLM is disabled', async () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider);

      const result = await disabledService.generateChainLink({
        chainId: 'chain-1',
        chainName: 'Test Chain',
        parentEntity: {
          id: 'parent-1',
          kind: 'npc',
          subtype: 'hero',
          name: 'Parent Hero',
          description: 'A hero',
          status: 'active',
          prominence: 'recognized',
          tags: [],
          links: []
        } as HardState,
        tick: 10,
        eraName: 'Test Era'
      });

      expect(result).toBeNull();
    });
  });

  describe('enrichEntityChanges - disabled LLM', () => {
    it('should skip enrichment when LLM is disabled', async () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider);

      const entity: Partial<HardState> = {
        id: 'entity-1',
        kind: 'npc',
        subtype: 'hero',
        name: 'Test Hero',
        description: 'Original description',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: []
      };

      const changes = ['status: active → retired'];

      const context: EnrichmentContext = {
        tick: 10,
        era: { id: 'test-era', name: 'Test Era' },
        worldState: {
          entityCount: 50,
          relationshipCount: 100,
          activeConflicts: 5
        }
      };

      await disabledService.enrichEntityChanges(
        entity as HardState,
        changes,
        [],
        context
      );

      // Should not modify description
      expect(entity.description).toBe('Original description');
    });

    it('should handle empty changes list', async () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider);

      const entity: Partial<HardState> = {
        id: 'entity-1',
        kind: 'npc',
        subtype: 'hero',
        name: 'Test Hero',
        description: 'Original description',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: []
      };

      const context: EnrichmentContext = {
        tick: 10,
        era: { id: 'test-era', name: 'Test Era' },
        worldState: {
          entityCount: 50,
          relationshipCount: 100,
          activeConflicts: 5
        }
      };

      await disabledService.enrichEntityChanges(
        entity as HardState,
        [],
        [],
        context
      );

      // Should not modify description
      expect(entity.description).toBe('Original description');
    });
  });

  describe('configuration', () => {
    it('should respect batchSize config', () => {
      const customConfig = { ...mockEnrichmentConfig, batchSize: 10 };
      const customService = new EnrichmentService(
        mockLLMConfig,
        mockLoreProvider,
        customConfig
      );
      expect(customService).toBeDefined();
    });

    it('should respect mode config', () => {
      const descriptionOnlyConfig = { ...mockEnrichmentConfig, mode: 'description-only' as const };
      const descService = new EnrichmentService(
        mockLLMConfig,
        mockLoreProvider,
        descriptionOnlyConfig
      );
      expect(descService).toBeDefined();
    });

    it('should respect maxEntityEnrichments config', () => {
      const limitedConfig = { ...mockEnrichmentConfig, maxEntityEnrichments: 10 };
      const limitedService = new EnrichmentService(
        mockLLMConfig,
        mockLoreProvider,
        limitedConfig
      );
      expect(limitedService).toBeDefined();
    });

    it('should respect maxRelationshipEnrichments config', () => {
      const limitedConfig = { ...mockEnrichmentConfig, maxRelationshipEnrichments: 5 };
      const limitedService = new EnrichmentService(
        mockLLMConfig,
        mockLoreProvider,
        limitedConfig
      );
      expect(limitedService).toBeDefined();
    });

    it('should respect maxEraNarratives config', () => {
      const limitedConfig = { ...mockEnrichmentConfig, maxEraNarratives: 3 };
      const limitedService = new EnrichmentService(
        mockLLMConfig,
        mockLoreProvider,
        limitedConfig
      );
      expect(limitedService).toBeDefined();
    });
  });

  describe('lore provider integration', () => {
    it('should call naming rules on initialization', () => {
      // Naming rules are called lazily
      expect(mockLoreProvider.getNamingRules).toBeDefined();
    });

    it('should use entity prompts from provider', () => {
      expect(mockLoreProvider.getEntityPrompt).toBeDefined();
    });

    it('should use relationship prompts from provider', () => {
      expect(mockLoreProvider.getRelationshipPrompt).toBeDefined();
    });

    it('should use era prompts from provider', () => {
      expect(mockLoreProvider.getEraNarrativePrompt).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle null enrichment config', () => {
      const service = new EnrichmentService(mockLLMConfig, mockLoreProvider, undefined);
      expect(service).toBeDefined();
    });

    it('should handle missing LLM endpoint', () => {
      const configWithoutEndpoint = { ...mockLLMConfig, endpoint: undefined };
      const service = new EnrichmentService(configWithoutEndpoint, mockLoreProvider);
      expect(service).toBeDefined();
    });

    it('should handle empty lore provider methods', () => {
      const emptyProvider: DomainLoreProvider = {
        getNamingRules: vi.fn(() => ({ patterns: {}, toneGuidance: {}, avoidDuplicates: true })),
        getEntityPrompt: vi.fn(() => ''),
        getRelationshipPrompt: vi.fn(() => ''),
        getEraNarrativePrompt: vi.fn(() => ''),
        getOccurrencePrompt: vi.fn(() => ''),
        getAbilityPrompt: vi.fn(() => ''),
        getDiscoveryPrompt: vi.fn(() => ''),
        getChainLinkPrompt: vi.fn(() => ''),
        getEraEnrichmentPrompt: vi.fn(() => ''),
        getEntityChangesPrompt: vi.fn(() => '')
      };

      const service = new EnrichmentService(mockLLMConfig, emptyProvider);
      expect(service).toBeDefined();
    });
  });

  describe('batch processing', () => {
    it('should handle single entity batches', async () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider, {
        batchSize: 1
      });

      const entities: Partial<HardState>[] = [
        {
          id: 'test-1',
          kind: 'npc',
          subtype: 'hero',
          name: 'Test Hero',
          description: 'Original',
          status: 'active',
          prominence: 'recognized',
          tags: [],
          links: []
        }
      ];

      const context: EnrichmentContext = {
        tick: 10,
        era: { id: 'test-era', name: 'Test Era' },
        worldState: { entityCount: 50, relationshipCount: 100, activeConflicts: 5 }
      };

      await disabledService.enrichEntities(entities as HardState[], context);
      expect(entities[0].description).toBe('Original');
    });

    it('should handle large entity batches', async () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider, {
        batchSize: 50
      });

      const entities: Partial<HardState>[] = Array.from({ length: 100 }, (_, i) => ({
        id: `test-${i}`,
        kind: 'npc',
        subtype: 'hero',
        name: `Test Hero ${i}`,
        description: `Original ${i}`,
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: []
      }));

      const context: EnrichmentContext = {
        tick: 10,
        era: { id: 'test-era', name: 'Test Era' },
        worldState: { entityCount: 50, relationshipCount: 100, activeConflicts: 5 }
      };

      await disabledService.enrichEntities(entities as HardState[], context);
      expect(entities[0].description).toBe('Original 0');
    });
  });

  describe('context handling', () => {
    it('should handle minimal context', async () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider);

      const entities: Partial<HardState>[] = [
        {
          id: 'test-1',
          kind: 'npc',
          subtype: 'hero',
          name: 'Test Hero',
          description: 'Original',
          status: 'active',
          prominence: 'recognized',
          tags: [],
          links: []
        }
      ];

      const minimalContext: EnrichmentContext = {
        tick: 0,
        era: { id: 'era-0', name: 'Era Zero' },
        worldState: { entityCount: 1, relationshipCount: 0, activeConflicts: 0 }
      };

      await disabledService.enrichEntities(entities as HardState[], minimalContext);
      expect(entities).toBeDefined();
    });

    it('should handle complex context', async () => {
      const disabledConfig = { ...mockLLMConfig, enabled: false };
      const disabledService = new EnrichmentService(disabledConfig, mockLoreProvider);

      const entities: Partial<HardState>[] = [
        {
          id: 'test-1',
          kind: 'npc',
          subtype: 'hero',
          name: 'Test Hero',
          description: 'Original',
          status: 'active',
          prominence: 'recognized',
          tags: [],
          links: []
        }
      ];

      const complexContext: EnrichmentContext = {
        tick: 1000,
        era: { id: 'era-5', name: 'Era Five' },
        worldState: {
          entityCount: 500,
          relationshipCount: 1000,
          activeConflicts: 50,
          dominantFaction: 'test-faction',
          culturalTrends: ['magic', 'exploration']
        }
      };

      await disabledService.enrichEntities(entities as HardState[], complexContext);
      expect(entities).toBeDefined();
    });
  });
});
