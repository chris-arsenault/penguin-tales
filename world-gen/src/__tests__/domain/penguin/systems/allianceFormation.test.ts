// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { allianceFormation } from '../../../../../domain/penguin/systems/allianceFormation';
import { Graph } from '../../../../../types/engine';
import { HardState } from '../../../../../types/worldTypes';

describe('allianceFormation System', () => {
  let mockGraph: Graph;

  beforeEach(() => {
    mockGraph = {
      entities: new Map<string, HardState>(),
      relationships: [],
      tick: 0,
      currentEra: { id: 'test_era', name: 'Test Era' },
      pressures: new Map(),
      history: [],
      config: {} as any,
      relationshipCooldowns: new Map(),
      discoveryState: { sites: [], discovered: new Set() }
    };
  });

  describe('System Metadata', () => {
    it('should have correct id and name', () => {
      expect(allianceFormation.id).toBe('alliance_formation');
      expect(allianceFormation.name).toBe('Strategic Alliances');
    });

    it('should have contract with correct purpose', () => {
      expect(allianceFormation.contract.purpose).toBe('relationship_creation');
    });

    it('should have metadata with produces information', () => {
      expect(allianceFormation.metadata).toBeDefined();
      expect(allianceFormation.metadata.produces.relationships).toHaveLength(1);
      expect(allianceFormation.metadata.produces.relationships[0].kind).toBe('allied_with');
    });

    it('should have parameters defined', () => {
      expect(allianceFormation.metadata.parameters).toBeDefined();
      expect(allianceFormation.metadata.parameters.allianceBaseChance).toBeDefined();
      expect(allianceFormation.metadata.parameters.allianceBaseChance.value).toBe(0.5);
    });
  });

  describe('apply', () => {
    it('should return empty result when no factions exist', () => {
      const result = allianceFormation.apply(mockGraph);

      expect(result.relationshipsAdded).toEqual([]);
      expect(result.entitiesModified).toEqual([]);
      expect(result.pressureChanges).toEqual({});
    });

    it('should return empty result when only 1 faction exists', () => {
      const faction1: HardState = {
        id: 'faction1',
        kind: 'faction',
        subtype: 'political',
        name: 'Faction 1',
        description: 'A faction',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set(faction1.id, faction1);

      const result = allianceFormation.apply(mockGraph);

      expect(result.relationshipsAdded).toEqual([]);
    });

    it('should not create alliances when no common enemies', () => {
      const faction1: HardState = {
        id: 'faction1',
        kind: 'faction',
        subtype: 'political',
        name: 'Faction 1',
        description: 'A faction',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const faction2: HardState = {
        id: 'faction2',
        kind: 'faction',
        subtype: 'political',
        name: 'Faction 2',
        description: 'A faction',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set(faction1.id, faction1);
      mockGraph.entities.set(faction2.id, faction2);

      const result = allianceFormation.apply(mockGraph);

      expect(result.relationshipsAdded).toEqual([]);
    });

    it('should create alliances when factions have common enemies', () => {
      const faction1: HardState = {
        id: 'faction1',
        kind: 'faction',
        subtype: 'political',
        name: 'Faction 1',
        description: 'A faction',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const faction2: HardState = {
        id: 'faction2',
        kind: 'faction',
        subtype: 'political',
        name: 'Faction 2',
        description: 'A faction',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const enemy: HardState = {
        id: 'enemy1',
        kind: 'faction',
        subtype: 'political',
        name: 'Enemy Faction',
        description: 'An enemy',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set(faction1.id, faction1);
      mockGraph.entities.set(faction2.id, faction2);
      mockGraph.entities.set(enemy.id, enemy);

      // Both factions are at war with the same enemy
      mockGraph.relationships.push(
        { kind: 'at_war_with', src: faction1.id, dst: enemy.id, strength: 0.8 },
        { kind: 'at_war_with', src: faction2.id, dst: enemy.id, strength: 0.8 }
      );

      // Run multiple times to account for randomness
      let allianceFormed = false;
      for (let i = 0; i < 20; i++) {
        const result = allianceFormation.apply(mockGraph, 1.0);
        if (result.relationshipsAdded.length > 0) {
          allianceFormed = true;
          expect(result.relationshipsAdded[0].kind).toBe('allied_with');
          expect([faction1.id, faction2.id]).toContain(result.relationshipsAdded[0].src);
          expect([faction1.id, faction2.id]).toContain(result.relationshipsAdded[0].dst);
          break;
        }
      }

      // With 20 attempts at 50% probability, should succeed at least once
      expect(allianceFormed).toBe(true);
    });

    it('should increase stability pressure when alliances form', () => {
      const faction1: HardState = {
        id: 'faction1',
        kind: 'faction',
        subtype: 'political',
        name: 'Faction 1',
        description: 'A faction',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const faction2: HardState = {
        id: 'faction2',
        kind: 'faction',
        subtype: 'political',
        name: 'Faction 2',
        description: 'A faction',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const enemy: HardState = {
        id: 'enemy1',
        kind: 'faction',
        subtype: 'political',
        name: 'Enemy Faction',
        description: 'An enemy',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set(faction1.id, faction1);
      mockGraph.entities.set(faction2.id, faction2);
      mockGraph.entities.set(enemy.id, enemy);

      mockGraph.relationships.push(
        { kind: 'at_war_with', src: faction1.id, dst: enemy.id, strength: 0.8 },
        { kind: 'at_war_with', src: faction2.id, dst: enemy.id, strength: 0.8 }
      );

      // Run until alliance forms
      for (let i = 0; i < 20; i++) {
        const result = allianceFormation.apply(mockGraph, 1.0);
        if (result.relationshipsAdded.length > 0) {
          expect(result.pressureChanges.stability).toBe(5);
          break;
        }
      }
    });

    it('should not create duplicate alliances', () => {
      const faction1: HardState = {
        id: 'faction1',
        kind: 'faction',
        subtype: 'political',
        name: 'Faction 1',
        description: 'A faction',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const faction2: HardState = {
        id: 'faction2',
        kind: 'faction',
        subtype: 'political',
        name: 'Faction 2',
        description: 'A faction',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const enemy: HardState = {
        id: 'enemy1',
        kind: 'faction',
        subtype: 'political',
        name: 'Enemy Faction',
        description: 'An enemy',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set(faction1.id, faction1);
      mockGraph.entities.set(faction2.id, faction2);
      mockGraph.entities.set(enemy.id, enemy);

      mockGraph.relationships.push(
        { kind: 'at_war_with', src: faction1.id, dst: enemy.id, strength: 0.8 },
        { kind: 'at_war_with', src: faction2.id, dst: enemy.id, strength: 0.8 }
      );

      // First call creates alliance
      for (let i = 0; i < 20; i++) {
        const result1 = allianceFormation.apply(mockGraph, 1.0);
        if (result1.relationshipsAdded.length > 0) {
          // Add the alliance to the graph
          mockGraph.relationships.push(...result1.relationshipsAdded);
          break;
        }
      }

      // Second call should not create duplicate
      const result2 = allianceFormation.apply(mockGraph, 1.0);
      expect(result2.relationshipsAdded).toEqual([]);
    });

    it('should respect modifier parameter', () => {
      const faction1: HardState = {
        id: 'faction1',
        kind: 'faction',
        subtype: 'political',
        name: 'Faction 1',
        description: 'A faction',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const faction2: HardState = {
        id: 'faction2',
        kind: 'faction',
        subtype: 'political',
        name: 'Faction 2',
        description: 'A faction',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const enemy: HardState = {
        id: 'enemy1',
        kind: 'faction',
        subtype: 'political',
        name: 'Enemy Faction',
        description: 'An enemy',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set(faction1.id, faction1);
      mockGraph.entities.set(faction2.id, faction2);
      mockGraph.entities.set(enemy.id, enemy);

      mockGraph.relationships.push(
        { kind: 'at_war_with', src: faction1.id, dst: enemy.id, strength: 0.8 },
        { kind: 'at_war_with', src: faction2.id, dst: enemy.id, strength: 0.8 }
      );

      // With modifier 0, should never create alliances
      const result = allianceFormation.apply(mockGraph, 0);
      expect(result.relationshipsAdded).toEqual([]);
    });

    it('should have descriptive result text', () => {
      const result = allianceFormation.apply(mockGraph);

      expect(result.description).toBeDefined();
      expect(result.description).toContain('alliances formed');
    });
  });
});
