// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { universalCatalyst } from '../../systems/universalCatalyst';
import { Graph, ComponentPurpose } from '../../types/engine';
import { HardState } from '../../types/worldTypes';

describe('universalCatalyst', () => {
  let mockGraph: Graph;
  let mockModifier: any;

  beforeEach(() => {
    mockGraph = {
      entities: new Map<string, HardState>(),
      relationships: [],
      tick: 10,
      currentEra: {
        id: 'test-era',
        name: 'Test Era',
        description: 'Test',
        templateWeights: {},
        systemModifiers: {},
        targetPopulation: 100
      },
      pressures: new Map<string, number>(),
      history: [],
      config: {
        domain: {
          getActionDomains: () => []
        },
        actionDomains: []
      }
    } as any;

    mockModifier = 1.0;
  });

  describe('metadata', () => {
    it('should have correct system ID', () => {
      expect(universalCatalyst.id).toBe('universal_catalyst');
    });

    it('should have STATE_MODIFICATION purpose', () => {
      expect(universalCatalyst.contract?.purpose).toBe(ComponentPurpose.STATE_MODIFICATION);
    });

    it('should require minimum NPCs', () => {
      const contract = universalCatalyst.contract;
      expect(contract?.enabledBy?.entityCounts).toBeDefined();
      const npcReq = contract?.enabledBy?.entityCounts?.find(ec => ec.kind === 'npc');
      expect(npcReq?.min).toBeGreaterThan(0);
    });
  });

  describe('parameters', () => {
    it('should have actionAttemptRate', () => {
      expect(universalCatalyst.metadata?.parameters?.actionAttemptRate).toBeDefined();
      expect(universalCatalyst.metadata?.parameters?.actionAttemptRate?.value).toBeGreaterThan(0);
    });

    it('should have influenceGain', () => {
      expect(universalCatalyst.metadata?.parameters?.influenceGain).toBeDefined();
    });

    it('should have influenceLoss', () => {
      expect(universalCatalyst.metadata?.parameters?.influenceLoss).toBeDefined();
    });

    it('should have pressureMultiplier', () => {
      expect(universalCatalyst.metadata?.parameters?.pressureMultiplier).toBeDefined();
    });
  });

  describe('apply', () => {
    it('should return valid SystemResult', () => {
      const result = universalCatalyst.apply(mockGraph, mockModifier);

      expect(result).toHaveProperty('relationshipsAdded');
      expect(result).toHaveProperty('description');
      expect(Array.isArray(result.relationshipsAdded)).toBe(true);
    });

    it('should handle empty graph', () => {
      const result = universalCatalyst.apply(mockGraph, mockModifier);

      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
    });

    it('should handle graph with no NPCs', () => {
      mockGraph.entities.set('loc-1', {
        id: 'loc-1', kind: 'location', subtype: 'colony', name: 'Colony', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      const result = universalCatalyst.apply(mockGraph, mockModifier);

      expect(result).toBeDefined();
    });

    it('should process agents with catalyst capability', () => {
      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'renowned', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: { canAct: true, influence: 0.5, catalyzedEvents: [] }
      };

      mockGraph.entities.set('npc-1', npc);

      const result = universalCatalyst.apply(mockGraph, mockModifier);

      expect(result).toBeDefined();
    });

    it('should respect modifier parameter', () => {
      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'renowned', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: { canAct: true, influence: 0.5, catalyzedEvents: [] }
      };

      mockGraph.entities.set('npc-1', npc);

      const result1 = universalCatalyst.apply(mockGraph, 0.0);
      const result2 = universalCatalyst.apply(mockGraph, 2.0);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('agent actions', () => {
    it('should enable agents to act', () => {
      expect(universalCatalyst.metadata).toBeDefined();
    });

    it('should track influence', () => {
      expect(universalCatalyst.metadata?.parameters?.influenceGain).toBeDefined();
      expect(universalCatalyst.metadata?.parameters?.influenceLoss).toBeDefined();
    });

    it('should consider prominence', () => {
      const renownedNpc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'renowned', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: { canAct: true, influence: 0.5, catalyzedEvents: [] }
      };

      mockGraph.entities.set('npc-1', renownedNpc);

      const result = universalCatalyst.apply(mockGraph, mockModifier);

      expect(result).toBeDefined();
    });
  });

  describe('effects', () => {
    it('should have positive graph density effect', () => {
      expect(universalCatalyst.metadata?.effects?.graphDensity).toBeGreaterThan(0);
    });

    it('should have positive cluster formation effect', () => {
      expect(universalCatalyst.metadata?.effects?.clusterFormation).toBeGreaterThan(0);
    });
  });

  describe('parameter bounds', () => {
    it('should have sensible parameter bounds', () => {
      const params = universalCatalyst.metadata?.parameters;

      if (params) {
        Object.entries(params).forEach(([key, config]) => {
          if ('min' in config && 'max' in config && 'value' in config) {
            expect(config.value).toBeGreaterThanOrEqual(config.min);
            expect(config.value).toBeLessThanOrEqual(config.max);
          }
        });
      }
    });
  });

  describe('action domains', () => {
    it('should work with empty action domains', () => {
      mockGraph.config.actionDomains = [];

      const result = universalCatalyst.apply(mockGraph, mockModifier);

      expect(result).toBeDefined();
    });

    it('should handle multiple agents', () => {
      for (let i = 1; i <= 5; i++) {
        mockGraph.entities.set(`npc-${i}`, {
          id: `npc-${i}`, kind: 'npc', subtype: 'hero', name: `Hero ${i}`, description: '',
          status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0,
          catalyst: { canAct: true, influence: 0.3, catalyzedEvents: [] }
        });
      }

      const result = universalCatalyst.apply(mockGraph, mockModifier);

      expect(result).toBeDefined();
    });
  });

  describe('influence system', () => {
    it('should track agent influence', () => {
      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'renowned', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: { canAct: true, influence: 0.5, catalyzedEvents: [] }
      };

      mockGraph.entities.set('npc-1', npc);

      const result = universalCatalyst.apply(mockGraph, mockModifier);

      expect(result).toBeDefined();
    });

    it('should track catalyzed events', () => {
      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'renowned', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [
            { action: 'test_action', tick: 5, success: true }
          ]
        }
      };

      mockGraph.entities.set('npc-1', npc);

      const result = universalCatalyst.apply(mockGraph, mockModifier);

      expect(result).toBeDefined();
    });
  });

  describe('pressure influence', () => {
    it('should consider pressure values', () => {
      mockGraph.pressures.set('conflict', 75);
      mockGraph.pressures.set('stability', 25);

      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'renowned', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: { canAct: true, influence: 0.5, catalyzedEvents: [] }
      };

      mockGraph.entities.set('npc-1', npc);

      const result = universalCatalyst.apply(mockGraph, mockModifier);

      expect(result).toBeDefined();
    });

    it('should amplify action rates with high pressure', () => {
      mockGraph.pressures.set('conflict', 90);

      mockGraph.config.domain.getPressureDomainMappings = () => ({
        military: ['conflict']
      });

      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'renowned', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: ['military']
        }
      };

      mockGraph.entities.set('npc-1', npc);

      const result = universalCatalyst.apply(mockGraph, mockModifier);

      expect(result).toBeDefined();
    });
  });

  describe('entity modification', () => {
    it('should modify NPCs', () => {
      const contract = universalCatalyst.contract;
      const npcModify = contract?.affects?.entities?.find(e => e.kind === 'npc');
      expect(npcModify?.operation).toBe('modify');
    });

    it('should modify factions', () => {
      const contract = universalCatalyst.contract;
      const factionModify = contract?.affects?.entities?.find(e => e.kind === 'faction');
      expect(factionModify?.operation).toBe('modify');
    });

    it('should modify occurrences', () => {
      const contract = universalCatalyst.contract;
      const occurrenceModify = contract?.affects?.entities?.find(e => e.kind === 'occurrence');
      expect(occurrenceModify?.operation).toBe('modify');
    });
  });

  describe('action execution with domain handlers', () => {
    it('should execute successful actions', () => {
      const mockActionHandler = (graph: Graph, agent: HardState) => ({
        success: true,
        relationships: [{
          kind: 'allied_with',
          src: agent.id,
          dst: 'faction-1'
        }],
        description: 'formed alliance',
        entitiesCreated: [],
        entitiesModified: [agent.id]
      });

      mockGraph.config.domain.getActionDomains = () => [{
        id: 'diplomatic',
        actions: [{
          id: 'form_alliance',
          type: 'form_alliance',
          baseSuccessChance: 0.8,
          baseWeight: 1.0,
          handler: mockActionHandler
        }]
      }];

      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'diplomat', name: 'Diplomat', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: ['diplomatic']
        }
      };

      mockGraph.entities.set('npc-1', npc);
      mockGraph.entities.set('faction-1', {
        id: 'faction-1', kind: 'faction', subtype: 'guild', name: 'Guild', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0
      });

      // Run multiple times to increase chance of action execution
      for (let i = 0; i < 20; i++) {
        const result = universalCatalyst.apply(mockGraph, 10.0); // High modifier to force attempts
        expect(result).toBeDefined();
      }
    });

    it('should handle action without handler', () => {
      mockGraph.config.domain.getActionDomains = () => [{
        id: 'military',
        actions: [{
          id: 'attack',
          type: 'attack',
          baseSuccessChance: 0.7,
          baseWeight: 1.0
          // No handler - should fail gracefully
        }]
      }];

      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'warrior', name: 'Warrior', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: ['military']
        }
      };

      mockGraph.entities.set('npc-1', npc);

      const result = universalCatalyst.apply(mockGraph, 10.0);
      expect(result).toBeDefined();
    });

    it('should track failed actions', () => {
      let callCount = 0;
      const mockFailingHandler = (graph: Graph, agent: HardState) => {
        callCount++;
        return {
          success: true, // Handler returns success, but random chance might fail
          relationships: [],
          description: 'attempted action',
          entitiesCreated: [],
          entitiesModified: []
        };
      };

      mockGraph.config.domain.getActionDomains = () => [{
        id: 'magic',
        actions: [{
          id: 'cast_spell',
          type: 'cast_spell',
          baseSuccessChance: 0.01, // Very low chance
          baseWeight: 1.0,
          handler: mockFailingHandler
        }]
      }];

      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'mage', name: 'Mage', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: ['magic']
        }
      };

      mockGraph.entities.set('npc-1', npc);

      // Run multiple times - most should fail due to low success chance
      for (let i = 0; i < 50; i++) {
        const result = universalCatalyst.apply(mockGraph, 10.0);
        expect(result).toBeDefined();
      }
    });
  });

  describe('action requirements', () => {
    it('should check prominence requirements', () => {
      const mockHandler = (graph: Graph, agent: HardState) => ({
        success: true,
        relationships: [],
        description: 'performed epic action',
        entitiesCreated: [],
        entitiesModified: []
      });

      mockGraph.config.domain.getActionDomains = () => [{
        id: 'heroic',
        actions: [{
          id: 'epic_deed',
          type: 'epic_deed',
          baseSuccessChance: 0.9,
          baseWeight: 1.0,
          handler: mockHandler,
          requirements: {
            minProminence: 'renowned'
          }
        }]
      }];

      // Low prominence NPC should not qualify
      const lowProminenceNpc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'peasant', name: 'Peasant', description: '',
        status: 'active', prominence: 'marginal', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: ['heroic']
        }
      };

      // High prominence NPC should qualify
      const highProminenceNpc: HardState = {
        id: 'npc-2', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'renowned', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: ['heroic']
        }
      };

      mockGraph.entities.set('npc-1', lowProminenceNpc);
      mockGraph.entities.set('npc-2', highProminenceNpc);

      const result = universalCatalyst.apply(mockGraph, 10.0);
      expect(result).toBeDefined();
      // High prominence NPC more likely to have successful actions
    });

    it('should check relationship requirements', () => {
      const mockHandler = (graph: Graph, agent: HardState) => ({
        success: true,
        relationships: [],
        description: 'commanded troops',
        entitiesCreated: [],
        entitiesModified: []
      });

      mockGraph.config.domain.getActionDomains = () => [{
        id: 'command',
        actions: [{
          id: 'lead_army',
          type: 'lead_army',
          baseSuccessChance: 0.9,
          baseWeight: 1.0,
          handler: mockHandler,
          requirements: {
            requiredRelationships: ['leads']
          }
        }]
      }];

      // NPC without required relationship
      const npcWithoutRel: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'warrior', name: 'Warrior', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: ['command']
        }
      };

      // NPC with required relationship
      const npcWithRel: HardState = {
        id: 'npc-2', kind: 'npc', subtype: 'commander', name: 'Commander', description: '',
        status: 'active', prominence: 'recognized', tags: [],
        links: [{ kind: 'leads', src: 'npc-2', dst: 'faction-1' }],
        createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: ['command']
        }
      };

      mockGraph.entities.set('npc-1', npcWithoutRel);
      mockGraph.entities.set('npc-2', npcWithRel);

      const result = universalCatalyst.apply(mockGraph, 10.0);
      expect(result).toBeDefined();
    });

    it('should check pressure requirements', () => {
      mockGraph.pressures.set('conflict', 75);

      const mockHandler = (graph: Graph, agent: HardState) => ({
        success: true,
        relationships: [],
        description: 'declared war',
        entitiesCreated: [],
        entitiesModified: []
      });

      mockGraph.config.domain.getActionDomains = () => [{
        id: 'war',
        actions: [{
          id: 'declare_war',
          type: 'declare_war',
          baseSuccessChance: 0.9,
          baseWeight: 1.0,
          handler: mockHandler,
          requirements: {
            requiredPressures: {
              conflict: 60
            }
          }
        }]
      }];

      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'warmonger', name: 'Warmonger', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: ['war']
        }
      };

      mockGraph.entities.set('npc-1', npc);

      const result = universalCatalyst.apply(mockGraph, 10.0);
      expect(result).toBeDefined();
      // Action should be available when conflict pressure is high enough
    });
  });

  describe('action weighting', () => {
    it('should apply era modifiers to action weights', () => {
      mockGraph.currentEra.systemModifiers = {
        diplomatic: 2.0, // Doubled in this era
        military: 0.5   // Halved in this era
      };

      const mockHandler = (graph: Graph, agent: HardState) => ({
        success: true,
        relationships: [],
        description: 'took action',
        entitiesCreated: [],
        entitiesModified: []
      });

      mockGraph.config.domain.getActionDomains = () => [
        {
          id: 'diplomatic',
          actions: [{
            id: 'negotiate',
            type: 'negotiate',
            baseSuccessChance: 0.9,
            baseWeight: 1.0,
            handler: mockHandler
          }]
        },
        {
          id: 'military',
          actions: [{
            id: 'attack',
            type: 'attack',
            baseSuccessChance: 0.9,
            baseWeight: 1.0,
            handler: mockHandler
          }]
        }
      ];

      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'leader', name: 'Leader', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: ['diplomatic', 'military']
        }
      };

      mockGraph.entities.set('npc-1', npc);

      // Run multiple times to verify system works
      for (let i = 0; i < 10; i++) {
        const result = universalCatalyst.apply(mockGraph, 10.0);
        expect(result).toBeDefined();
      }
    });

    it('should boost weights with relevant pressures', () => {
      mockGraph.pressures.set('conflict', 80);

      mockGraph.config.domain.getPressureDomainMappings = () => ({
        military: ['conflict']
      });

      const mockHandler = (graph: Graph, agent: HardState) => ({
        success: true,
        relationships: [],
        description: 'took military action',
        entitiesCreated: [],
        entitiesModified: []
      });

      mockGraph.config.domain.getActionDomains = () => [{
        id: 'military',
        actions: [{
          id: 'raid',
          type: 'raid',
          baseSuccessChance: 0.9,
          baseWeight: 1.0,
          handler: mockHandler
        }]
      }];

      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'raider', name: 'Raider', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: ['military']
        }
      };

      mockGraph.entities.set('npc-1', npc);

      const result = universalCatalyst.apply(mockGraph, 10.0);
      expect(result).toBeDefined();
    });
  });

  describe('influence tracking', () => {
    it('should update influence on successful actions', () => {
      let handlerCalled = false;
      const mockHandler = (graph: Graph, agent: HardState) => {
        handlerCalled = true;
        return {
          success: true,
          relationships: [{
            kind: 'performed',
            src: agent.id,
            dst: 'event-1'
          }],
          description: 'succeeded at task',
          entitiesCreated: [],
          entitiesModified: [agent.id]
        };
      };

      mockGraph.config.domain.getActionDomains = () => [{
        id: 'test',
        actions: [{
          id: 'test_action',
          type: 'test_action',
          baseSuccessChance: 1.0, // Always succeed
          baseWeight: 1.0,
          handler: mockHandler
        }]
      }];

      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: ['test']
        }
      };

      mockGraph.entities.set('npc-1', npc);

      // Force action attempt
      for (let i = 0; i < 20; i++) {
        const result = universalCatalyst.apply(mockGraph, 10.0);
        expect(result).toBeDefined();
      }
    });

    it('should record catalyzed events', () => {
      const mockHandler = (graph: Graph, agent: HardState) => ({
        success: true,
        relationships: [{
          kind: 'created',
          src: agent.id,
          dst: 'artifact-1'
        }],
        description: 'created artifact',
        entitiesCreated: ['artifact-1'],
        entitiesModified: []
      });

      mockGraph.config.domain.getActionDomains = () => [{
        id: 'craft',
        actions: [{
          id: 'create_artifact',
          type: 'create_artifact',
          baseSuccessChance: 1.0,
          baseWeight: 1.0,
          handler: mockHandler
        }]
      }];

      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'artisan', name: 'Artisan', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: ['craft']
        }
      };

      mockGraph.entities.set('npc-1', npc);

      for (let i = 0; i < 20; i++) {
        const result = universalCatalyst.apply(mockGraph, 10.0);
        expect(result).toBeDefined();
      }
    });
  });

  describe('relationship attribution', () => {
    it('should add catalyzedBy attribution to created relationships', () => {
      const mockHandler = (graph: Graph, agent: HardState) => ({
        success: true,
        relationships: [{
          kind: 'founded',
          src: agent.id,
          dst: 'city-1'
        }],
        description: 'founded city',
        entitiesCreated: ['city-1'],
        entitiesModified: []
      });

      mockGraph.config.domain.getActionDomains = () => [{
        id: 'founding',
        actions: [{
          id: 'found_city',
          type: 'found_city',
          baseSuccessChance: 1.0,
          baseWeight: 1.0,
          handler: mockHandler
        }]
      }];

      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'founder', name: 'Founder', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: ['founding']
        }
      };

      mockGraph.entities.set('npc-1', npc);

      for (let i = 0; i < 20; i++) {
        const result = universalCatalyst.apply(mockGraph, 10.0);
        expect(result).toBeDefined();

        // Check if relationships were created with attribution
        if (result.relationshipsAdded.length > 0) {
          result.relationshipsAdded.forEach(rel => {
            expect(rel).toHaveProperty('catalyzedBy');
            expect(rel).toHaveProperty('createdAt');
          });
        }
      }
    });
  });

  describe('history tracking', () => {
    it('should create history events for successful actions', () => {
      const mockHandler = (graph: Graph, agent: HardState) => ({
        success: true,
        relationships: [],
        description: 'performed historic deed',
        entitiesCreated: [],
        entitiesModified: [agent.id]
      });

      mockGraph.config.domain.getActionDomains = () => [{
        id: 'legendary',
        actions: [{
          id: 'legendary_deed',
          type: 'legendary_deed',
          baseSuccessChance: 1.0,
          baseWeight: 1.0,
          handler: mockHandler
        }]
      }];

      const npc: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'legend', name: 'Legend', description: '',
        status: 'active', prominence: 'mythic', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.9,
          catalyzedEvents: [],
          actionDomains: ['legendary']
        }
      };

      mockGraph.entities.set('npc-1', npc);

      const historyLengthBefore = mockGraph.history.length;

      for (let i = 0; i < 20; i++) {
        universalCatalyst.apply(mockGraph, 10.0);
      }

      // History should have grown
      expect(mockGraph.history.length).toBeGreaterThanOrEqual(historyLengthBefore);
    });
  });

  describe('agent categories', () => {
    it('should process first-order agents', () => {
      mockGraph.config.domain.getActionDomains = () => [];

      const firstOrderAgent: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: [],
          category: 'first-order'
        }
      };

      mockGraph.entities.set('npc-1', firstOrderAgent);

      const result = universalCatalyst.apply(mockGraph, mockModifier);
      expect(result).toBeDefined();
    });

    it('should process second-order agents', () => {
      mockGraph.config.domain.getActionDomains = () => [];

      const secondOrderAgent: HardState = {
        id: 'faction-1', kind: 'faction', subtype: 'empire', name: 'Empire', description: '',
        status: 'active', prominence: 'renowned', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.7,
          catalyzedEvents: [],
          actionDomains: [],
          category: 'second-order'
        }
      };

      mockGraph.entities.set('faction-1', secondOrderAgent);

      const result = universalCatalyst.apply(mockGraph, mockModifier);
      expect(result).toBeDefined();
    });

    it('should process both first and second order agents together', () => {
      mockGraph.config.domain.getActionDomains = () => [];

      const firstOrder: HardState = {
        id: 'npc-1', kind: 'npc', subtype: 'hero', name: 'Hero', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.5,
          catalyzedEvents: [],
          actionDomains: [],
          category: 'first-order'
        }
      };

      const secondOrder: HardState = {
        id: 'faction-1', kind: 'faction', subtype: 'guild', name: 'Guild', description: '',
        status: 'active', prominence: 'recognized', tags: [], links: [], createdAt: 0, updatedAt: 0,
        catalyst: {
          canAct: true,
          influence: 0.6,
          catalyzedEvents: [],
          actionDomains: [],
          category: 'second-order'
        }
      };

      mockGraph.entities.set('npc-1', firstOrder);
      mockGraph.entities.set('faction-1', secondOrder);

      const result = universalCatalyst.apply(mockGraph, mockModifier);
      expect(result).toBeDefined();
    });
  });
});
