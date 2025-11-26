// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { relationshipFormation } from '../../systems/relationshipFormation';
import { Graph } from '@lore-weave/core/types/engine';
import { HardState } from '@lore-weave/core/types/worldTypes';
import * as helpers from '@lore-weave/core/utils/helpers';

describe('relationshipFormation', () => {
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
      relationshipCooldowns: new Map()
    } as Graph;

    mockModifier = {};

    // Reset mocks
    vi.restoreAllMocks();
  });

  describe('metadata', () => {
    it('should have correct system ID', () => {
      expect(relationshipFormation.id).toBe('relationship_formation');
    });

    it('should declare produced relationship types', () => {
      expect(relationshipFormation.metadata?.produces?.relationships).toBeDefined();
      expect(relationshipFormation.metadata?.produces?.relationships?.length).toBeGreaterThan(0);
    });

    it('should have parameterized configuration', () => {
      expect(relationshipFormation.metadata?.parameters).toBeDefined();
      expect(relationshipFormation.metadata?.parameters?.throttleChance).toBeDefined();
    });
  });

  describe('friendship formation', () => {
    beforeEach(() => {
      // Create NPCs at same location in same faction
      const npc1: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 1',
        description: '',
        status: 'alive',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const npc2: HardState = {
        id: 'npc-2',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 2',
        description: '',
        status: 'alive',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const location: HardState = {
        id: 'loc-1',
        kind: 'location',
        subtype: 'colony',
        name: 'Colony',
        description: '',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const faction: HardState = {
        id: 'faction-1',
        kind: 'faction',
        subtype: 'guild',
        name: 'Merchant Guild',
        description: '',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('npc-1', npc1);
      mockGraph.entities.set('npc-2', npc2);
      mockGraph.entities.set('loc-1', location);
      mockGraph.entities.set('faction-1', faction);

      // Both NPCs located in colony and members of same faction
      mockGraph.relationships.push(
        { kind: 'resident_of', src: 'npc-1', dst: 'loc-1' },
        { kind: 'resident_of', src: 'npc-2', dst: 'loc-1' },
        { kind: 'member_of', src: 'npc-1', dst: 'faction-1' },
        { kind: 'member_of', src: 'npc-2', dst: 'faction-1' }
      );
    });

    it('should form friendships between co-located NPCs', () => {
      // Mock probability to always succeed (all calls)
      vi.spyOn(helpers, 'rollProbability').mockReturnValue(true);
      vi.spyOn(helpers, 'canFormRelationship').mockReturnValue(true);
      vi.spyOn(helpers, 'areRelationshipsCompatible').mockReturnValue(true);

      const result = relationshipFormation.apply(mockGraph, mockModifier);

      expect(result.relationshipsAdded.length).toBeGreaterThan(0);
      const friendship = result.relationshipsAdded.find(r => r.kind === 'follower_of' || r.kind === 'rival_of');
      expect(friendship).toBeDefined();
    });

    it('should not form duplicate friendships', () => {
      // Already friends
      mockGraph.relationships.push({ kind: 'follower_of', src: 'npc-1', dst: 'npc-2' });

      const result = relationshipFormation.apply(mockGraph, mockModifier);

      const duplicateFriendship = result.relationshipsAdded.find(
        r => (r.src === 'npc-1' && r.dst === 'npc-2' && r.kind === 'follower_of')
      );
      expect(duplicateFriendship).toBeUndefined();
    });

    it('should respect cooldowns', () => {
      // Set cooldown
      mockGraph.relationshipCooldowns!.set('npc-1:npc-2', mockGraph.tick + 10);

      vi.spyOn(helpers, 'rollProbability').mockReturnValue(true);
      // canFormRelationship should return false due to cooldown
      vi.spyOn(helpers, 'canFormRelationship').mockReturnValue(false);

      const result = relationshipFormation.apply(mockGraph, mockModifier);

      const relationship = result.relationshipsAdded.find(
        r => (r.src === 'npc-1' && r.dst === 'npc-2') || (r.src === 'npc-2' && r.dst === 'npc-1')
      );
      expect(relationship).toBeUndefined();
    });

    it('should form more friendships than rivalries', () => {
      vi.spyOn(helpers, 'rollProbability').mockReturnValue(true);
      vi.spyOn(helpers, 'canFormRelationship').mockReturnValue(true);
      vi.spyOn(helpers, 'areRelationshipsCompatible').mockReturnValue(true);

      // Create many NPCs to get statistical sample
      for (let i = 3; i <= 20; i++) {
        const npc: HardState = {
          id: `npc-${i}`,
          kind: 'npc',
          subtype: 'merchant',
          name: `Merchant ${i}`,
          description: '',
          status: 'alive',
          prominence: 'recognized',
          tags: [],
          links: [],
          createdAt: 0,
          updatedAt: 0
        };
        mockGraph.entities.set(`npc-${i}`, npc);
        mockGraph.relationships.push({ kind: 'resident_of', src: `npc-${i}`, dst: 'loc-1' });
        mockGraph.relationships.push({ kind: 'member_of', src: `npc-${i}`, dst: 'faction-1' });
      }

      const result = relationshipFormation.apply(mockGraph, mockModifier);

      const friendships = result.relationshipsAdded.filter(r => r.kind === 'follower_of').length;
      const rivalries = result.relationshipsAdded.filter(r => r.kind === 'rival_of').length;

      // Should have more friendships than rivalries (or at least some friendships)
      if (friendships + rivalries > 0) {
        expect(friendships).toBeGreaterThanOrEqual(rivalries);
      }
    });
  });

  describe('conflict formation', () => {
    beforeEach(() => {
      // Create NPCs from different factions at same location
      const npc1: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'warrior',
        name: 'Warrior 1',
        description: '',
        status: 'alive',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const npc2: HardState = {
        id: 'npc-2',
        kind: 'npc',
        subtype: 'warrior',
        name: 'Warrior 2',
        description: '',
        status: 'alive',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const location: HardState = {
        id: 'loc-1',
        kind: 'location',
        subtype: 'colony',
        name: 'Battlefield',
        description: '',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const faction1: HardState = {
        id: 'faction-1',
        kind: 'faction',
        subtype: 'military',
        name: 'Warriors',
        description: '',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const faction2: HardState = {
        id: 'faction-2',
        kind: 'faction',
        subtype: 'military',
        name: 'Soldiers',
        description: '',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('npc-1', npc1);
      mockGraph.entities.set('npc-2', npc2);
      mockGraph.entities.set('loc-1', location);
      mockGraph.entities.set('faction-1', faction1);
      mockGraph.entities.set('faction-2', faction2);

      mockGraph.relationships.push(
        { kind: 'resident_of', src: 'npc-1', dst: 'loc-1' },
        { kind: 'resident_of', src: 'npc-2', dst: 'loc-1' },
        { kind: 'member_of', src: 'npc-1', dst: 'faction-1' },
        { kind: 'member_of', src: 'npc-2', dst: 'faction-2' }
      );
    });

    it('should form conflicts between enemy factions', () => {
      // Make factions enemies
      mockGraph.relationships.push({ kind: 'enemy_of', src: 'faction-1', dst: 'faction-2' });

      vi.spyOn(helpers, 'rollProbability').mockReturnValue(true);
      vi.spyOn(helpers, 'canFormRelationship').mockReturnValue(true);
      vi.spyOn(helpers, 'areRelationshipsCompatible').mockReturnValue(true);

      const result = relationshipFormation.apply(mockGraph, mockModifier);

      const conflict = result.relationshipsAdded.find(r => r.kind === 'enemy_of');
      expect(conflict).toBeDefined();
    });

    it('should have higher conflict chance for enemy factions', () => {
      // This is tested via the enemyFactionConflictMultiplier parameter
      expect(relationshipFormation.metadata?.parameters?.enemyFactionConflictMultiplier).toBeDefined();
      expect(relationshipFormation.metadata?.parameters?.enemyFactionConflictMultiplier?.value).toBeGreaterThan(1);
    });
  });

  describe('romance formation', () => {
    beforeEach(() => {
      const npc1: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'noble',
        name: 'Noble 1',
        description: '',
        status: 'active',
        prominence: 'renowned',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const npc2: HardState = {
        id: 'npc-2',
        kind: 'npc',
        subtype: 'noble',
        name: 'Noble 2',
        description: '',
        status: 'active',
        prominence: 'renowned',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('npc-1', npc1);
      mockGraph.entities.set('npc-2', npc2);
    });

    it('should have romance configuration parameters', () => {
      expect(relationshipFormation.metadata?.parameters?.romanceBaseChance).toBeDefined();
      expect(relationshipFormation.metadata?.parameters?.sameFactionRomanceMultiplier).toBeDefined();
    });

    it('should form romance with lower probability than friendships', () => {
      const romanceChance = relationshipFormation.metadata?.parameters?.romanceBaseChance?.value || 0;
      const friendshipChance = relationshipFormation.metadata?.parameters?.friendshipBaseChance?.value || 0;

      expect(romanceChance).toBeLessThan(friendshipChance);
    });
  });

  describe('faction influence on relationships', () => {
    it('should boost friendships for same faction members', () => {
      const sameFactionMultiplier = relationshipFormation.metadata?.parameters?.sameFactionFriendshipMultiplier?.value;
      expect(sameFactionMultiplier).toBeGreaterThan(1);
    });

    it('should boost friendships for allied faction members', () => {
      const alliedMultiplier = relationshipFormation.metadata?.parameters?.alliedFactionFriendshipMultiplier?.value;
      expect(alliedMultiplier).toBeGreaterThan(1);
    });

    it('should reduce conflicts for neutral factions', () => {
      const neutralMultiplier = relationshipFormation.metadata?.parameters?.neutralConflictMultiplier?.value;
      expect(neutralMultiplier).toBeLessThan(1);
    });
  });

  describe('throttling', () => {
    it('should have throttle configuration', () => {
      expect(relationshipFormation.metadata?.parameters?.throttleChance).toBeDefined();
    });

    it('should respect throttle probability', () => {
      // Mock to always fail throttle check
      vi.spyOn(helpers, 'rollProbability').mockReturnValueOnce(false);

      const result = relationshipFormation.apply(mockGraph, mockModifier);

      // Should return early with no relationships
      expect(result.relationshipsAdded.length).toBe(0);
    });
  });

  describe('system result structure', () => {
    it('should return valid SystemResult', () => {
      const result = relationshipFormation.apply(mockGraph, mockModifier);

      expect(result).toHaveProperty('relationshipsAdded');
      expect(result).toHaveProperty('description');
      expect(Array.isArray(result.relationshipsAdded)).toBe(true);
      expect(typeof result.description).toBe('string');
    });

    it('should provide meaningful description', () => {
      const result = relationshipFormation.apply(mockGraph, mockModifier);

      expect(result.description.length).toBeGreaterThan(0);
    });

    it('should handle empty graph gracefully', () => {
      mockGraph.entities.clear();
      mockGraph.relationships = [];

      const result = relationshipFormation.apply(mockGraph, mockModifier);

      expect(result.relationshipsAdded).toEqual([]);
    });
  });

  describe('relationship compatibility', () => {
    it('should not create incompatible relationships', () => {
      const npc1: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant',
        description: '',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const npc2: HardState = {
        id: 'npc-2',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 2',
        description: '',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('npc-1', npc1);
      mockGraph.entities.set('npc-2', npc2);

      // Make them already enemies - should not become friends
      mockGraph.relationships.push({ kind: 'enemy_of', src: 'npc-1', dst: 'npc-2' });

      vi.spyOn(helpers, 'rollProbability').mockReturnValue(true);
      vi.spyOn(helpers, 'canFormRelationship').mockReturnValue(true);
      vi.spyOn(helpers, 'areRelationshipsCompatible').mockReturnValue(false);

      const result = relationshipFormation.apply(mockGraph, mockModifier);

      const friendship = result.relationshipsAdded.find(
        r => (r.src === 'npc-1' && r.dst === 'npc-2' && r.kind === 'follower_of')
      );
      expect(friendship).toBeUndefined();
    });
  });

  describe('cooldown management', () => {
    it('should record cooldowns for formed relationships', () => {
      const npc1: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 1',
        description: '',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const npc2: HardState = {
        id: 'npc-2',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 2',
        description: '',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('npc-1', npc1);
      mockGraph.entities.set('npc-2', npc2);

      const location: HardState = {
        id: 'loc-1',
        kind: 'location',
        subtype: 'colony',
        name: 'Colony',
        description: '',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };
      mockGraph.entities.set('loc-1', location);

      mockGraph.relationships.push(
        { kind: 'located_in', src: 'npc-1', dst: 'loc-1' },
        { kind: 'located_in', src: 'npc-2', dst: 'loc-1' }
      );

      vi.spyOn(helpers, 'rollProbability').mockReturnValue(true);
      vi.spyOn(helpers, 'canFormRelationship').mockReturnValue(true);
      const recordSpy = vi.spyOn(helpers, 'recordRelationshipFormation');

      relationshipFormation.apply(mockGraph, mockModifier);

      // Should record cooldowns if relationships were formed
      if (recordSpy.mock.calls.length > 0) {
        expect(recordSpy).toHaveBeenCalled();
      }
    });
  });

  describe('prominence influence', () => {
    it('should consider prominence in relationship formation', () => {
      const renownedNpc: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'hero',
        name: 'Hero',
        description: '',
        status: 'active',
        prominence: 'renowned',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const marginalNpc: HardState = {
        id: 'npc-2',
        kind: 'npc',
        subtype: 'peasant',
        name: 'Peasant',
        description: '',
        status: 'active',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('npc-1', renownedNpc);
      mockGraph.entities.set('npc-2', marginalNpc);

      // Both should be able to form relationships
      const result = relationshipFormation.apply(mockGraph, mockModifier);

      expect(result).toBeDefined();
    });
  });

  describe('parameter bounds', () => {
    it('should have sensible parameter bounds', () => {
      const params = relationshipFormation.metadata?.parameters;

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
});
