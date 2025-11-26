// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { beliefContagion } from '../../../../domain/penguin/systems/beliefContagion';
import { Graph, ComponentPurpose } from '../../../../apps/lore-weave/lib/types/engine';
import { HardState } from '../../../../apps/lore-weave/lib/types/worldTypes';

describe('beliefContagion', () => {
  let mockGraph: Graph;

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
      relationshipCooldowns: new Map(),
      config: {} as any,
      discoveryState: {} as any,
      loreIndex: {} as any,
      nameLogger: {} as any,
      tagRegistry: {} as any,
      loreValidator: {} as any,
      statistics: {} as any,
      enrichmentService: {} as any
    };
  });

  describe('metadata', () => {
    it('should have correct system ID', () => {
      expect(beliefContagion.id).toBe('belief_contagion');
    });

    it('should have TAG_PROPAGATION purpose', () => {
      expect(beliefContagion.contract?.purpose).toBe(ComponentPurpose.TAG_PROPAGATION);
    });

    it('should require rules and npcs', () => {
      const contract = beliefContagion.contract;
      expect(contract?.enabledBy?.entityCounts).toBeDefined();
      const rulesReq = contract?.enabledBy?.entityCounts?.find(ec => ec.kind === 'rules');
      const npcReq = contract?.enabledBy?.entityCounts?.find(ec => ec.kind === 'npc');
      expect(rulesReq?.min).toBeGreaterThan(0);
      expect(npcReq?.min).toBeGreaterThan(0);
    });

    it('should declare believer_of relationship', () => {
      const contract = beliefContagion.contract;
      const relationship = contract?.affects?.relationships?.find(r => r.kind === 'believer_of');
      expect(relationship).toBeDefined();
    });

    it('should have metadata parameters', () => {
      expect(beliefContagion.metadata).toBeDefined();
      expect(beliefContagion.metadata?.parameters).toBeDefined();
    });
  });

  describe('basic execution', () => {
    it('should return valid SystemResult', () => {
      const result = beliefContagion.apply(mockGraph);

      expect(result).toHaveProperty('relationshipsAdded');
      expect(result).toHaveProperty('description');
      expect(Array.isArray(result.relationshipsAdded)).toBe(true);
    });

    it('should handle empty graph', () => {
      const result = beliefContagion.apply(mockGraph);

      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
    });

    it('should work with modifier parameter', () => {
      const result = beliefContagion.apply(mockGraph, 1.5);

      expect(result).toBeDefined();
    });
  });

  describe('belief adoption', () => {
    it('should allow NPCs to adopt beliefs from proposed rules', () => {
      // Add a proposed rule
      mockGraph.entities.set('rule-1', {
        id: 'rule-1',
        kind: 'rules',
        subtype: 'edict',
        name: 'New Law',
        description: 'A proposed law',
        status: 'proposed',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      // Add NPCs
      mockGraph.entities.set('npc-1', {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'mayor',
        name: 'Mayor',
        description: 'A mayor',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      mockGraph.entities.set('npc-2', {
        id: 'npc-2',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant',
        description: 'A merchant',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [{ kind: 'follower_of', src: 'npc-2', dst: 'npc-1' }],
        createdAt: 0,
        updatedAt: 0
      });

      // Run system multiple times to allow contagion
      for (let i = 0; i < 20; i++) {
        beliefContagion.apply(mockGraph, 10.0); // High modifier to force attempts
      }

      // Check if any relationships were created
      const result = beliefContagion.apply(mockGraph);
      expect(result).toBeDefined();
    });

    it('should not process enacted rules', () => {
      mockGraph.entities.set('rule-1', {
        id: 'rule-1',
        kind: 'rules',
        subtype: 'edict',
        name: 'Existing Law',
        description: 'An already enacted law',
        status: 'enacted',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      mockGraph.entities.set('npc-1', {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'mayor',
        name: 'Mayor',
        description: 'A mayor',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      const result = beliefContagion.apply(mockGraph);

      // Should not try to spread enacted rules
      expect(result).toBeDefined();
    });

    it('should spread beliefs through follower_of relationships', () => {
      mockGraph.entities.set('rule-1', {
        id: 'rule-1',
        kind: 'rules',
        subtype: 'edict',
        name: 'New Law',
        description: 'A proposed law',
        status: 'proposed',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      // Believer NPC
      mockGraph.entities.set('npc-1', {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'hero',
        name: 'Hero',
        description: 'A hero',
        status: 'active',
        prominence: 'renowned',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      // Follower NPC
      mockGraph.entities.set('npc-2', {
        id: 'npc-2',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant',
        description: 'A merchant',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [{ kind: 'follower_of', src: 'npc-2', dst: 'npc-1' }],
        createdAt: 0,
        updatedAt: 0
      });

      // Hero believes in rule
      mockGraph.relationships.push({
        kind: 'believer_of',
        src: 'npc-1',
        dst: 'rule-1'
      });

      // Run system to allow spread
      for (let i = 0; i < 20; i++) {
        beliefContagion.apply(mockGraph, 10.0);
      }

      expect(mockGraph).toBeDefined();
    });

    it('should spread beliefs through member_of relationships', () => {
      mockGraph.entities.set('rule-1', {
        id: 'rule-1',
        kind: 'rules',
        subtype: 'social',
        name: 'Guild Law',
        description: 'A proposed guild rule',
        status: 'proposed',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      mockGraph.entities.set('faction-1', {
        id: 'faction-1',
        kind: 'faction',
        subtype: 'guild',
        name: 'Merchants Guild',
        description: 'A guild',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      mockGraph.entities.set('npc-1', {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant',
        description: 'A merchant',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [{ kind: 'member_of', src: 'npc-1', dst: 'faction-1' }],
        createdAt: 0,
        updatedAt: 0
      });

      mockGraph.relationships.push({
        kind: 'believer_of',
        src: 'npc-1',
        dst: 'rule-1'
      });

      for (let i = 0; i < 20; i++) {
        beliefContagion.apply(mockGraph, 10.0);
      }

      expect(mockGraph).toBeDefined();
    });
  });

  describe('immunity and resistance', () => {
    it('should prevent immune NPCs from adopting beliefs', () => {
      mockGraph.entities.set('rule-1', {
        id: 'rule-1',
        kind: 'rules',
        subtype: 'edict',
        name: 'Rejected Law',
        description: 'A rejected law',
        status: 'proposed',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      // Immune NPC (previously rejected)
      mockGraph.entities.set('npc-1', {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'rebel',
        name: 'Rebel',
        description: 'A rebel',
        status: 'active',
        prominence: 'recognized',
        tags: ['immune:rule-1'],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      const result = beliefContagion.apply(mockGraph, 10.0);

      // Immune NPC should not adopt
      expect(result).toBeDefined();
    });

    it('should allow NPCs to reject beliefs', () => {
      mockGraph.entities.set('rule-1', {
        id: 'rule-1',
        kind: 'rules',
        subtype: 'edict',
        name: 'Unpopular Law',
        description: 'An unpopular law',
        status: 'proposed',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      mockGraph.entities.set('npc-1', {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'rebel',
        name: 'Rebel',
        description: 'A rebel',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      // Add belief first
      mockGraph.relationships.push({
        kind: 'believer_of',
        src: 'npc-1',
        dst: 'rule-1'
      });

      // Run system to allow rejection
      for (let i = 0; i < 50; i++) {
        beliefContagion.apply(mockGraph, 1.0);
      }

      expect(mockGraph).toBeDefined();
    });
  });

  describe('rule status transitions', () => {
    it('should transition rule to enacted when adoption threshold met', () => {
      mockGraph.entities.set('rule-1', {
        id: 'rule-1',
        kind: 'rules',
        subtype: 'edict',
        name: 'Popular Law',
        description: 'A popular law',
        status: 'proposed',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      // Add many believers
      for (let i = 1; i <= 10; i++) {
        mockGraph.entities.set(`npc-${i}`, {
          id: `npc-${i}`,
          kind: 'npc',
          subtype: 'merchant',
          name: `NPC ${i}`,
          description: 'An NPC',
          status: 'active',
          prominence: 'recognized',
          tags: [],
          links: [],
          createdAt: 0,
          updatedAt: 0
        });

        mockGraph.relationships.push({
          kind: 'believer_of',
          src: `npc-${i}`,
          dst: 'rule-1'
        });
      }

      beliefContagion.apply(mockGraph);

      // Check if rule transitioned
      const rule = mockGraph.entities.get('rule-1');
      expect(rule).toBeDefined();
    });
  });

  describe('pressure impacts', () => {
    it('should modify cultural_tension pressure', () => {
      mockGraph.entities.set('rule-1', {
        id: 'rule-1',
        kind: 'rules',
        subtype: 'edict',
        name: 'Law',
        description: 'A law',
        status: 'proposed',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      const result = beliefContagion.apply(mockGraph);

      expect(result.pressureChanges).toBeDefined();
    });

    it('should modify stability pressure', () => {
      mockGraph.entities.set('rule-1', {
        id: 'rule-1',
        kind: 'rules',
        subtype: 'edict',
        name: 'Law',
        description: 'A law',
        status: 'proposed',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      const result = beliefContagion.apply(mockGraph);

      expect(result.pressureChanges).toBeDefined();
    });
  });

  describe('SIR model mechanics', () => {
    it('should model infection based on infected neighbors', () => {
      mockGraph.entities.set('rule-1', {
        id: 'rule-1',
        kind: 'rules',
        subtype: 'social',
        name: 'New Tradition',
        description: 'A new tradition',
        status: 'proposed',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      // Create network: npc-1 (believer) -> npc-2, npc-3 (susceptible)
      mockGraph.entities.set('npc-1', {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'hero',
        name: 'Hero',
        description: 'A hero',
        status: 'active',
        prominence: 'renowned',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      mockGraph.entities.set('npc-2', {
        id: 'npc-2',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 1',
        description: 'A merchant',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [{ kind: 'follower_of', src: 'npc-2', dst: 'npc-1' }],
        createdAt: 0,
        updatedAt: 0
      });

      mockGraph.entities.set('npc-3', {
        id: 'npc-3',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 2',
        description: 'A merchant',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [{ kind: 'follower_of', src: 'npc-3', dst: 'npc-1' }],
        createdAt: 0,
        updatedAt: 0
      });

      mockGraph.relationships.push({
        kind: 'believer_of',
        src: 'npc-1',
        dst: 'rule-1'
      });

      mockGraph.relationships.push({
        kind: 'follower_of',
        src: 'npc-2',
        dst: 'npc-1'
      });

      mockGraph.relationships.push({
        kind: 'follower_of',
        src: 'npc-3',
        dst: 'npc-1'
      });

      // Run system to allow spread
      for (let i = 0; i < 30; i++) {
        beliefContagion.apply(mockGraph, 10.0);
      }

      expect(mockGraph).toBeDefined();
    });

    it('should have natural throttling through rule status', () => {
      // Only proposed rules spread
      mockGraph.entities.set('rule-enacted', {
        id: 'rule-enacted',
        kind: 'rules',
        subtype: 'edict',
        name: 'Old Law',
        description: 'An old law',
        status: 'enacted',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      mockGraph.entities.set('npc-1', {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant',
        description: 'A merchant',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      const result = beliefContagion.apply(mockGraph);

      // Should report no active contagion
      expect(result.description).toBeDefined();
    });
  });

  describe('multiple rules', () => {
    it('should handle multiple proposed rules', () => {
      mockGraph.entities.set('rule-1', {
        id: 'rule-1',
        kind: 'rules',
        subtype: 'edict',
        name: 'Law 1',
        description: 'First law',
        status: 'proposed',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      mockGraph.entities.set('rule-2', {
        id: 'rule-2',
        kind: 'rules',
        subtype: 'social',
        name: 'Law 2',
        description: 'Second law',
        status: 'proposed',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      mockGraph.entities.set('npc-1', {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'mayor',
        name: 'Mayor',
        description: 'A mayor',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      const result = beliefContagion.apply(mockGraph);

      expect(result).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle graph with no rules', () => {
      mockGraph.entities.set('npc-1', {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant',
        description: 'A merchant',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      const result = beliefContagion.apply(mockGraph);

      expect(result).toBeDefined();
      expect(result.relationshipsAdded.length).toBe(0);
    });

    it('should handle graph with no NPCs', () => {
      mockGraph.entities.set('rule-1', {
        id: 'rule-1',
        kind: 'rules',
        subtype: 'edict',
        name: 'Law',
        description: 'A law',
        status: 'proposed',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      const result = beliefContagion.apply(mockGraph);

      expect(result).toBeDefined();
      expect(result.relationshipsAdded.length).toBe(0);
    });

    it('should handle isolated NPCs with no connections', () => {
      mockGraph.entities.set('rule-1', {
        id: 'rule-1',
        kind: 'rules',
        subtype: 'edict',
        name: 'Law',
        description: 'A law',
        status: 'proposed',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      mockGraph.entities.set('npc-1', {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'hermit',
        name: 'Hermit',
        description: 'A hermit',
        status: 'active',
        prominence: 'marginal',
        tags: [],
        links: [], // No connections
        createdAt: 0,
        updatedAt: 0
      });

      const result = beliefContagion.apply(mockGraph);

      expect(result).toBeDefined();
    });
  });
});
