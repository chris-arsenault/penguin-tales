import { describe, it, expect, beforeEach } from 'vitest';
import {
  RelationshipBuilder,
  buildRelationships,
  createRelationship,
} from '../../graph/relationshipBuilder';
import { Graph } from '../../engine/types';
import { Relationship } from '../../core/worldTypes';

describe('RelationshipBuilder', () => {
  let builder: RelationshipBuilder;

  beforeEach(() => {
    builder = new RelationshipBuilder();
  });

  describe('add', () => {
    it('should add a simple relationship', () => {
      builder.add('trades_with', 'entity1', 'entity2');
      const result = builder.build();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        kind: 'trades_with',
        src: 'entity1',
        dst: 'entity2',
      });
    });

    it('should add relationship with strength', () => {
      builder.add('allied_with', 'faction1', 'faction2', 0.8);
      const result = builder.build();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        kind: 'allied_with',
        src: 'faction1',
        dst: 'faction2',
        strength: 0.8,
      });
    });

    it('should support method chaining', () => {
      const result = builder
        .add('trades_with', 'a', 'b')
        .add('allied_with', 'b', 'c')
        .add('at_war_with', 'a', 'c')
        .build();

      expect(result).toHaveLength(3);
      expect(result[0].kind).toBe('trades_with');
      expect(result[1].kind).toBe('allied_with');
      expect(result[2].kind).toBe('at_war_with');
    });

    it('should handle multiple relationships between same entities', () => {
      builder.add('trades_with', 'a', 'b').add('allied_with', 'a', 'b');
      const result = builder.build();

      expect(result).toHaveLength(2);
    });

    it('should not add strength field when undefined', () => {
      builder.add('trades_with', 'a', 'b');
      const result = builder.build();

      expect(result[0]).not.toHaveProperty('strength');
    });

    it('should handle strength of 0', () => {
      builder.add('trades_with', 'a', 'b', 0);
      const result = builder.build();

      expect(result[0].strength).toBe(0);
    });
  });

  describe('addManyFrom', () => {
    it('should add relationships from one source to multiple destinations', () => {
      builder.addManyFrom('trades_with', 'merchant', ['colony1', 'colony2', 'colony3']);
      const result = builder.build();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ kind: 'trades_with', src: 'merchant', dst: 'colony1' });
      expect(result[1]).toEqual({ kind: 'trades_with', src: 'merchant', dst: 'colony2' });
      expect(result[2]).toEqual({ kind: 'trades_with', src: 'merchant', dst: 'colony3' });
    });

    it('should handle empty destinations array', () => {
      builder.addManyFrom('trades_with', 'merchant', []);
      const result = builder.build();

      expect(result).toHaveLength(0);
    });

    it('should add relationships with strength', () => {
      builder.addManyFrom('allied_with', 'faction1', ['faction2', 'faction3'], 0.7);
      const result = builder.build();

      expect(result).toHaveLength(2);
      expect(result[0].strength).toBe(0.7);
      expect(result[1].strength).toBe(0.7);
    });

    it('should support method chaining', () => {
      const result = builder
        .addManyFrom('trades_with', 'a', ['b', 'c'])
        .add('located_in', 'a', 'd')
        .build();

      expect(result).toHaveLength(3);
    });
  });

  describe('addManyTo', () => {
    it('should add relationships from multiple sources to one destination', () => {
      builder.addManyTo('located_in', ['npc1', 'npc2', 'npc3'], 'colony');
      const result = builder.build();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ kind: 'located_in', src: 'npc1', dst: 'colony' });
      expect(result[1]).toEqual({ kind: 'located_in', src: 'npc2', dst: 'colony' });
      expect(result[2]).toEqual({ kind: 'located_in', src: 'npc3', dst: 'colony' });
    });

    it('should handle empty sources array', () => {
      builder.addManyTo('member_of', [], 'faction');
      const result = builder.build();

      expect(result).toHaveLength(0);
    });

    it('should add relationships with strength', () => {
      builder.addManyTo('member_of', ['npc1', 'npc2'], 'guild', 0.9);
      const result = builder.build();

      expect(result).toHaveLength(2);
      expect(result[0].strength).toBe(0.9);
      expect(result[1].strength).toBe(0.9);
    });

    it('should support method chaining', () => {
      const result = builder
        .addManyTo('member_of', ['a', 'b'], 'faction')
        .add('leads', 'a', 'faction')
        .build();

      expect(result).toHaveLength(3);
    });
  });

  describe('addBidirectional', () => {
    it('should add relationships in both directions', () => {
      builder.addBidirectional('allied_with', 'faction1', 'faction2');
      const result = builder.build();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ kind: 'allied_with', src: 'faction1', dst: 'faction2' });
      expect(result[1]).toEqual({ kind: 'allied_with', src: 'faction2', dst: 'faction1' });
    });

    it('should add bidirectional relationships with strength', () => {
      builder.addBidirectional('friends_with', 'npc1', 'npc2', 0.6);
      const result = builder.build();

      expect(result).toHaveLength(2);
      expect(result[0].strength).toBe(0.6);
      expect(result[1].strength).toBe(0.6);
    });

    it('should support method chaining', () => {
      const result = builder
        .addBidirectional('allied_with', 'a', 'b')
        .add('leads', 'a', 'faction')
        .build();

      expect(result).toHaveLength(3);
    });
  });

  describe('addIfNotExists', () => {
    let mockGraph: Graph;

    beforeEach(() => {
      const _entities = new Map();
      let _relationships: Relationship[] = [
        { kind: 'trades_with', src: 'a', dst: 'b' },
        { kind: 'allied_with', src: 'c', dst: 'd', strength: 0.5 },
      ];

      mockGraph = {
        tick: 0,
        currentEra: { id: 'era1', name: 'Era 1' } as any,
        pressures: new Map(),
        history: [],
        config: {} as any,
        relationshipCooldowns: new Map(),
        discoveryState: { currentThreshold: 0, lastDiscoveryTick: 0, discoveriesThisEpoch: 0 },
        loreRecords: [],
        growthMetrics: { relationshipsPerTick: [], averageGrowthRate: 0 },

        // Entity read methods
        getEntity(id: string) { return _entities.get(id); },
        hasEntity(id: string) { return _entities.has(id); },
        getEntityCount() { return _entities.size; },
        getEntities() { return Array.from(_entities.values()); },
        getEntityIds() { return Array.from(_entities.keys()); },
        forEachEntity(cb: (e: any, id: string) => void) { _entities.forEach(cb); },
        findEntities() { return []; },
        getEntitiesByKind() { return []; },
        getConnectedEntities() { return []; },

        // Entity mutation
        setEntity(id: string, entity: any): void {
          _entities.set(id, entity);
        },
        updateEntity() { return false; },
        deleteEntity(id: string): boolean {
          return _entities.delete(id);
        },

        // Relationship read methods
        getRelationships() { return _relationships; },
        getRelationshipCount() { return _relationships.length; },
        findRelationships() { return []; },
        getEntityRelationships() { return []; },
        hasRelationship() { return false; },

        // Relationship mutation
        pushRelationship(relationship: Relationship): void {
          _relationships.push(relationship);
        },
        setRelationships(rels: Relationship[]): void {
          _relationships = rels;
        },
        removeRelationship() { return false; }
      };
    });

    it('should add relationship if it does not exist', () => {
      builder.addIfNotExists(mockGraph, 'trades_with', 'e', 'f');
      const result = builder.build();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ kind: 'trades_with', src: 'e', dst: 'f' });
    });

    it('should not add relationship if it already exists', () => {
      builder.addIfNotExists(mockGraph, 'trades_with', 'a', 'b');
      const result = builder.build();

      expect(result).toHaveLength(0);
    });

    it('should add relationship if kind differs', () => {
      builder.addIfNotExists(mockGraph, 'allied_with', 'a', 'b');
      const result = builder.build();

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('allied_with');
    });

    it('should add relationship if src differs', () => {
      builder.addIfNotExists(mockGraph, 'trades_with', 'x', 'b');
      const result = builder.build();

      expect(result).toHaveLength(1);
    });

    it('should add relationship if dst differs', () => {
      builder.addIfNotExists(mockGraph, 'trades_with', 'a', 'z');
      const result = builder.build();

      expect(result).toHaveLength(1);
    });

    it('should support method chaining', () => {
      const result = builder
        .addIfNotExists(mockGraph, 'trades_with', 'a', 'b')
        .addIfNotExists(mockGraph, 'trades_with', 'e', 'f')
        .build();

      expect(result).toHaveLength(1);
      expect(result[0].src).toBe('e');
    });

    it('should handle strength parameter', () => {
      builder.addIfNotExists(mockGraph, 'new_rel', 'x', 'y', 0.75);
      const result = builder.build();

      expect(result[0].strength).toBe(0.75);
    });

    it('should work with empty graph', () => {
      mockGraph.setRelationships([]);
      builder.addIfNotExists(mockGraph, 'trades_with', 'a', 'b');
      const result = builder.build();

      expect(result).toHaveLength(1);
    });
  });

  describe('build', () => {
    it('should return relationships array', () => {
      builder.add('trades_with', 'a', 'b');
      const result1 = builder.build();
      const result2 = builder.build();

      expect(result1).toEqual(result2);
      // Both calls return the same array reference (not a copy)
      expect(result1).toBe(result2);
    });

    it('should return empty array when no relationships added', () => {
      const result = builder.build();
      expect(result).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should remove all relationships', () => {
      builder.add('trades_with', 'a', 'b').add('allied_with', 'c', 'd');
      builder.clear();
      const result = builder.build();

      expect(result).toHaveLength(0);
    });

    it('should support method chaining', () => {
      const result = builder
        .add('trades_with', 'a', 'b')
        .clear()
        .add('allied_with', 'c', 'd')
        .build();

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('allied_with');
    });

    it('should allow reuse after clear', () => {
      builder.add('trades_with', 'a', 'b');
      builder.clear();
      builder.add('allied_with', 'c', 'd');
      const result = builder.build();

      expect(result).toHaveLength(1);
      expect(result[0].kind).toBe('allied_with');
    });
  });

  describe('count', () => {
    it('should return zero for new builder', () => {
      expect(builder.count()).toBe(0);
    });

    it('should return correct count after adding relationships', () => {
      builder.add('trades_with', 'a', 'b').add('allied_with', 'c', 'd');
      expect(builder.count()).toBe(2);
    });

    it('should update count after clear', () => {
      builder.add('trades_with', 'a', 'b');
      expect(builder.count()).toBe(1);
      builder.clear();
      expect(builder.count()).toBe(0);
    });

    it('should count relationships from batch operations', () => {
      builder.addManyFrom('trades_with', 'a', ['b', 'c', 'd']);
      expect(builder.count()).toBe(3);
    });
  });
});

describe('buildRelationships helper', () => {
  it('should create new RelationshipBuilder instance', () => {
    const builder = buildRelationships();
    expect(builder).toBeInstanceOf(RelationshipBuilder);
  });

  it('should return independent instances', () => {
    const builder1 = buildRelationships();
    const builder2 = buildRelationships();

    builder1.add('trades_with', 'a', 'b');
    expect(builder1.count()).toBe(1);
    expect(builder2.count()).toBe(0);
  });

  it('should support fluent API', () => {
    const result = buildRelationships()
      .add('trades_with', 'a', 'b')
      .add('allied_with', 'c', 'd')
      .build();

    expect(result).toHaveLength(2);
  });
});

describe('createRelationship helper', () => {
  it('should create relationship without strength', () => {
    const rel = createRelationship('trades_with', 'a', 'b');

    expect(rel).toEqual({
      kind: 'trades_with',
      src: 'a',
      dst: 'b',
    });
  });

  it('should create relationship with strength', () => {
    const rel = createRelationship('allied_with', 'faction1', 'faction2', 0.9);

    expect(rel).toEqual({
      kind: 'allied_with',
      src: 'faction1',
      dst: 'faction2',
      strength: 0.9,
    });
  });

  it('should handle strength of 0', () => {
    const rel = createRelationship('trades_with', 'a', 'b', 0);
    expect(rel.strength).toBe(0);
  });

  it('should not add strength property when undefined', () => {
    const rel = createRelationship('trades_with', 'a', 'b');
    expect(rel).not.toHaveProperty('strength');
  });

  it('should handle different relationship kinds', () => {
    const rel1 = createRelationship('located_in', 'npc', 'colony');
    const rel2 = createRelationship('member_of', 'npc', 'guild');
    const rel3 = createRelationship('at_war_with', 'faction1', 'faction2');

    expect(rel1.kind).toBe('located_in');
    expect(rel2.kind).toBe('member_of');
    expect(rel3.kind).toBe('at_war_with');
  });
});

describe('Integration scenarios', () => {
  it('should handle complex relationship network creation', () => {
    const builder = buildRelationships();

    // Create a guild with members
    builder.addManyTo('member_of', ['npc1', 'npc2', 'npc3'], 'merchant_guild');

    // Add leadership
    builder.add('leads', 'npc1', 'merchant_guild', 1.0);

    // Create trade relationships
    builder.addManyFrom('trades_with', 'merchant_guild', ['colony1', 'colony2'], 0.6);

    // Add alliance
    builder.addBidirectional('allied_with', 'merchant_guild', 'shipwright_guild', 0.8);

    const relationships = builder.build();

    expect(relationships).toHaveLength(8); // 3 members + 1 leader + 2 trades + 2 bidirectional alliance
  });

  it('should handle conditional relationship creation', () => {
    const _entities = new Map();
    let _relationships: Relationship[] = [{ kind: 'trades_with', src: 'a', dst: 'b' }];

    const graph: Graph = {
      tick: 0,
      currentEra: { id: 'era1', name: 'Era 1' } as any,
      pressures: new Map(),
      history: [],
      config: {} as any,
      relationshipCooldowns: new Map(),
      discoveryState: { currentThreshold: 0, lastDiscoveryTick: 0, discoveriesThisEpoch: 0 },
      loreRecords: [],
      growthMetrics: { relationshipsPerTick: [], averageGrowthRate: 0 },

      // Entity read methods
      getEntity(id: string) { return _entities.get(id); },
      hasEntity(id: string) { return _entities.has(id); },
      getEntityCount() { return _entities.size; },
      getEntities() { return Array.from(_entities.values()); },
      getEntityIds() { return Array.from(_entities.keys()); },
      forEachEntity(cb: (e: any, id: string) => void) { _entities.forEach(cb); },
      findEntities() { return []; },
      getEntitiesByKind() { return []; },
      getConnectedEntities() { return []; },

      // Entity mutation
      setEntity(id: string, entity: any): void {
        _entities.set(id, entity);
      },
      updateEntity() { return false; },
      deleteEntity(id: string): boolean {
        return _entities.delete(id);
      },

      // Relationship read methods
      getRelationships() { return _relationships; },
      getRelationshipCount() { return _relationships.length; },
      findRelationships() { return []; },
      getEntityRelationships() { return []; },
      hasRelationship() { return false; },

      // Relationship mutation
      pushRelationship(relationship: Relationship): void {
        _relationships.push(relationship);
      },
      setRelationships(rels: Relationship[]): void {
        _relationships = rels;
      },
      removeRelationship() { return false; }
    };

    const builder = buildRelationships();

    // Attempt to add existing relationship
    builder.addIfNotExists(graph, 'trades_with', 'a', 'b');

    // Add new relationships
    builder.addIfNotExists(graph, 'trades_with', 'c', 'd');
    builder.addIfNotExists(graph, 'allied_with', 'a', 'b');

    const relationships = builder.build();
    expect(relationships).toHaveLength(2);
  });

  it('should handle builder reuse with clear', () => {
    const builder = buildRelationships();

    // First batch
    builder.add('trades_with', 'a', 'b').add('trades_with', 'c', 'd');
    const batch1 = builder.build();
    expect(batch1).toHaveLength(2);

    // Clear and create second batch
    builder.clear();
    builder.add('allied_with', 'e', 'f');
    const batch2 = builder.build();
    expect(batch2).toHaveLength(1);
    expect(batch2[0].kind).toBe('allied_with');
  });
});
