import { describe, it, expect, beforeEach } from 'vitest';
import { EntityClusterBuilder, buildCluster } from '../../graph/entityClusterBuilder';
import { HardState } from '../../core/worldTypes';

describe('EntityClusterBuilder', () => {
  let builder: EntityClusterBuilder;

  beforeEach(() => {
    builder = new EntityClusterBuilder();
  });

  describe('addEntity', () => {
    it('should add a single entity', () => {
      builder.addEntity({
        kind: 'npc',
        subtype: 'merchant',
        name: 'Bob',
      });

      const result = builder.build();
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('Bob');
    });

    it('should support method chaining', () => {
      const result = builder
        .addEntity({ kind: 'npc', subtype: 'merchant', name: 'Alice' })
        .addEntity({ kind: 'npc', subtype: 'warrior', name: 'Bob' })
        .build();

      expect(result.entities).toHaveLength(2);
    });

    it('should preserve entity properties', () => {
      builder.addEntity({
        kind: 'faction',
        subtype: 'guild',
        name: 'Traders Guild',
        description: 'A merchant organization',
        status: 'active',
        prominence: 'recognized',
        tags: ['commerce', 'organized'],
      });

      const result = builder.build();
      const entity = result.entities[0];

      expect(entity.kind).toBe('faction');
      expect(entity.subtype).toBe('guild');
      expect(entity.name).toBe('Traders Guild');
      expect(entity.description).toBe('A merchant organization');
      expect(entity.status).toBe('active');
      expect(entity.prominence).toBe('recognized');
      expect(entity.tags).toEqual(['commerce', 'organized']);
    });
  });

  describe('addEntities', () => {
    it('should add multiple entities at once', () => {
      builder.addEntities([
        { kind: 'npc', subtype: 'merchant', name: 'Alice' },
        { kind: 'npc', subtype: 'warrior', name: 'Bob' },
        { kind: 'npc', subtype: 'mage', name: 'Carol' },
      ]);

      const result = builder.build();
      expect(result.entities).toHaveLength(3);
    });

    it('should handle empty array', () => {
      builder.addEntities([]);
      const result = builder.build();
      expect(result.entities).toHaveLength(0);
    });

    it('should support method chaining', () => {
      const result = builder
        .addEntities([{ kind: 'npc', name: 'Alice' }])
        .addEntity({ kind: 'npc', name: 'Bob' })
        .build();

      expect(result.entities).toHaveLength(2);
    });
  });

  describe('relate', () => {
    beforeEach(() => {
      builder
        .addEntity({ kind: 'faction', subtype: 'guild', name: 'Guild' })
        .addEntity({ kind: 'npc', subtype: 'merchant', name: 'Merchant' });
    });

    it('should create relationship between cluster entities using indices', () => {
      builder.relate(1, 0, 'member_of');
      const result = builder.build();

      expect(result.relationships).toHaveLength(1);
      expect(result.relationships[0]).toEqual({
        kind: 'member_of',
        src: 'will-be-assigned-1',
        dst: 'will-be-assigned-0',
      });
    });

    it('should create relationship with strength', () => {
      builder.relate(0, 1, 'leads', 1.0);
      const result = builder.build();

      expect(result.relationships[0].strength).toBe(1.0);
    });

    it('should support method chaining', () => {
      const result = builder
        .relate(0, 1, 'employs')
        .relate(1, 0, 'member_of')
        .build();

      expect(result.relationships).toHaveLength(2);
    });

    it('should handle relationship to existing entity by ID', () => {
      builder.relate(0, 'existing-entity-id', 'allied_with');
      const result = builder.build();

      expect(result.relationships[0].dst).toBe('existing-entity-id');
    });

    it('should not add strength property when undefined', () => {
      builder.relate(0, 1, 'trades_with');
      const result = builder.build();

      expect(result.relationships[0]).not.toHaveProperty('strength');
    });
  });

  describe('relateToExisting', () => {
    beforeEach(() => {
      builder.addEntity({ kind: 'npc', subtype: 'merchant', name: 'Bob' });
    });

    it('should create relationship from cluster entity to existing entity', () => {
      builder.relateToExisting(0, 'existing-colony-id', 'located_in');
      const result = builder.build();

      expect(result.relationships).toHaveLength(1);
      expect(result.relationships[0]).toEqual({
        kind: 'located_in',
        src: 'will-be-assigned-0',
        dst: 'existing-colony-id',
      });
    });

    it('should support strength parameter', () => {
      builder.relateToExisting(0, 'faction-id', 'member_of', 0.8);
      const result = builder.build();

      expect(result.relationships[0].strength).toBe(0.8);
    });

    it('should support method chaining', () => {
      const result = builder
        .relateToExisting(0, 'location-1', 'located_in')
        .relateToExisting(0, 'faction-1', 'member_of')
        .build();

      expect(result.relationships).toHaveLength(2);
    });
  });

  describe('relateFromExisting', () => {
    beforeEach(() => {
      builder.addEntity({ kind: 'location', subtype: 'colony', name: 'Colony' });
    });

    it('should create relationship from existing entity to cluster entity', () => {
      builder.relateFromExisting('npc-id', 0, 'located_in');
      const result = builder.build();

      expect(result.relationships).toHaveLength(1);
      expect(result.relationships[0]).toEqual({
        kind: 'located_in',
        src: 'npc-id',
        dst: 'will-be-assigned-0',
      });
    });

    it('should support strength parameter', () => {
      builder.relateFromExisting('faction-id', 0, 'controls', 0.9);
      const result = builder.build();

      expect(result.relationships[0].strength).toBe(0.9);
    });

    it('should support method chaining', () => {
      const result = builder
        .relateFromExisting('npc-1', 0, 'located_in')
        .relateFromExisting('npc-2', 0, 'located_in')
        .build();

      expect(result.relationships).toHaveLength(2);
    });
  });

  describe('relateManyFrom', () => {
    beforeEach(() => {
      builder
        .addEntity({ kind: 'faction', subtype: 'guild', name: 'Guild' })
        .addEntity({ kind: 'location', subtype: 'colony', name: 'Colony 1' })
        .addEntity({ kind: 'location', subtype: 'colony', name: 'Colony 2' })
        .addEntity({ kind: 'location', subtype: 'colony', name: 'Colony 3' });
    });

    it('should create relationships from one entity to many', () => {
      builder.relateManyFrom(0, [1, 2, 3], 'trades_with');
      const result = builder.build();

      expect(result.relationships).toHaveLength(3);
      expect(result.relationships[0].src).toBe('will-be-assigned-0');
      expect(result.relationships[0].dst).toBe('will-be-assigned-1');
      expect(result.relationships[1].dst).toBe('will-be-assigned-2');
      expect(result.relationships[2].dst).toBe('will-be-assigned-3');
    });

    it('should handle empty array', () => {
      builder.relateManyFrom(0, [], 'trades_with');
      const result = builder.build();

      expect(result.relationships).toHaveLength(0);
    });

    it('should support strength parameter', () => {
      builder.relateManyFrom(0, [1, 2], 'controls', 0.7);
      const result = builder.build();

      expect(result.relationships[0].strength).toBe(0.7);
      expect(result.relationships[1].strength).toBe(0.7);
    });

    it('should handle mixed indices and entity IDs', () => {
      builder.relateManyFrom(0, [1, 'existing-id', 2], 'allied_with');
      const result = builder.build();

      expect(result.relationships).toHaveLength(3);
      expect(result.relationships[1].dst).toBe('existing-id');
    });

    it('should support method chaining', () => {
      const result = builder
        .relateManyFrom(0, [1, 2], 'trades_with')
        .relate(0, 3, 'located_in')
        .build();

      expect(result.relationships).toHaveLength(3);
    });
  });

  describe('relateManyTo', () => {
    beforeEach(() => {
      builder
        .addEntity({ kind: 'npc', subtype: 'merchant', name: 'NPC 1' })
        .addEntity({ kind: 'npc', subtype: 'merchant', name: 'NPC 2' })
        .addEntity({ kind: 'npc', subtype: 'merchant', name: 'NPC 3' })
        .addEntity({ kind: 'faction', subtype: 'guild', name: 'Guild' });
    });

    it('should create relationships from many entities to one', () => {
      builder.relateManyTo([0, 1, 2], 3, 'member_of');
      const result = builder.build();

      expect(result.relationships).toHaveLength(3);
      expect(result.relationships[0].src).toBe('will-be-assigned-0');
      expect(result.relationships[1].src).toBe('will-be-assigned-1');
      expect(result.relationships[2].src).toBe('will-be-assigned-2');
      expect(result.relationships[0].dst).toBe('will-be-assigned-3');
    });

    it('should handle empty array', () => {
      builder.relateManyTo([], 3, 'member_of');
      const result = builder.build();

      expect(result.relationships).toHaveLength(0);
    });

    it('should support strength parameter', () => {
      builder.relateManyTo([0, 1], 3, 'loyal_to', 0.9);
      const result = builder.build();

      expect(result.relationships[0].strength).toBe(0.9);
      expect(result.relationships[1].strength).toBe(0.9);
    });

    it('should support relationship to existing entity ID', () => {
      builder.relateManyTo([0, 1], 'existing-faction-id', 'member_of');
      const result = builder.build();

      expect(result.relationships[0].dst).toBe('existing-faction-id');
      expect(result.relationships[1].dst).toBe('existing-faction-id');
    });

    it('should support method chaining', () => {
      const result = builder
        .relateManyTo([0, 1], 3, 'member_of')
        .relate(0, 1, 'friends_with')
        .build();

      expect(result.relationships).toHaveLength(3);
    });
  });

  describe('relateBidirectional', () => {
    beforeEach(() => {
      builder
        .addEntity({ kind: 'faction', subtype: 'guild', name: 'Guild 1' })
        .addEntity({ kind: 'faction', subtype: 'guild', name: 'Guild 2' });
    });

    it('should create relationships in both directions', () => {
      builder.relateBidirectional(0, 1, 'allied_with');
      const result = builder.build();

      expect(result.relationships).toHaveLength(2);
      expect(result.relationships[0]).toEqual({
        kind: 'allied_with',
        src: 'will-be-assigned-0',
        dst: 'will-be-assigned-1',
      });
      expect(result.relationships[1]).toEqual({
        kind: 'allied_with',
        src: 'will-be-assigned-1',
        dst: 'will-be-assigned-0',
      });
    });

    it('should support strength parameter', () => {
      builder.relateBidirectional(0, 1, 'trades_with', 0.6);
      const result = builder.build();

      expect(result.relationships[0].strength).toBe(0.6);
      expect(result.relationships[1].strength).toBe(0.6);
    });

    it('should support method chaining', () => {
      builder
        .addEntity({ kind: 'faction', subtype: 'guild', name: 'Guild 3' });

      const result = builder
        .relateBidirectional(0, 1, 'allied_with')
        .relateBidirectional(1, 2, 'trades_with')
        .build();

      expect(result.relationships).toHaveLength(4);
    });
  });

  describe('entityCount', () => {
    it('should return zero for new builder', () => {
      expect(builder.entityCount()).toBe(0);
    });

    it('should return correct count after adding entities', () => {
      builder
        .addEntity({ kind: 'npc', name: 'Alice' })
        .addEntity({ kind: 'npc', name: 'Bob' })
        .addEntity({ kind: 'faction', name: 'Guild' });

      expect(builder.entityCount()).toBe(3);
    });

    it('should update count after addEntities', () => {
      builder.addEntities([
        { kind: 'npc', name: 'Alice' },
        { kind: 'npc', name: 'Bob' },
      ]);

      expect(builder.entityCount()).toBe(2);
    });
  });

  describe('relationshipCount', () => {
    it('should return zero for new builder', () => {
      expect(builder.relationshipCount()).toBe(0);
    });

    it('should return correct count after adding relationships', () => {
      builder
        .addEntity({ kind: 'npc', name: 'Alice' })
        .addEntity({ kind: 'faction', name: 'Guild' })
        .relate(0, 1, 'member_of')
        .relate(1, 0, 'employs');

      expect(builder.relationshipCount()).toBe(2);
    });

    it('should count relationships from batch operations', () => {
      builder
        .addEntities([
          { kind: 'npc', name: 'NPC1' },
          { kind: 'npc', name: 'NPC2' },
          { kind: 'npc', name: 'NPC3' },
          { kind: 'faction', name: 'Guild' },
        ])
        .relateManyTo([0, 1, 2], 3, 'member_of');

      expect(builder.relationshipCount()).toBe(3);
    });
  });

  describe('buildWithDescription', () => {
    it('should return TemplateResult with description', () => {
      builder
        .addEntity({ kind: 'faction', subtype: 'guild', name: 'Traders' })
        .addEntity({ kind: 'npc', subtype: 'merchant', name: 'Bob' })
        .relate(1, 0, 'member_of');

      const result = builder.buildWithDescription('Created merchant guild with 1 member');

      expect(result.entities).toHaveLength(2);
      expect(result.relationships).toHaveLength(1);
      expect(result.description).toBe('Created merchant guild with 1 member');
    });

    it('should handle empty cluster', () => {
      const result = builder.buildWithDescription('Empty cluster');

      expect(result.entities).toHaveLength(0);
      expect(result.relationships).toHaveLength(0);
      expect(result.description).toBe('Empty cluster');
    });
  });

  describe('build', () => {
    it('should return entities and relationships', () => {
      builder
        .addEntity({ kind: 'npc', name: 'Alice' })
        .addEntity({ kind: 'faction', name: 'Guild' })
        .relate(0, 1, 'member_of');

      const result = builder.build();

      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('relationships');
      expect(result.entities).toHaveLength(2);
      expect(result.relationships).toHaveLength(1);
    });

    it('should return empty arrays for new builder', () => {
      const result = builder.build();

      expect(result.entities).toEqual([]);
      expect(result.relationships).toEqual([]);
    });
  });

  describe('clear', () => {
    it('should remove all entities and relationships', () => {
      builder
        .addEntity({ kind: 'npc', name: 'Alice' })
        .addEntity({ kind: 'faction', name: 'Guild' })
        .relate(0, 1, 'member_of');

      builder.clear();
      const result = builder.build();

      expect(result.entities).toHaveLength(0);
      expect(result.relationships).toHaveLength(0);
    });

    it('should support method chaining', () => {
      const result = builder
        .addEntity({ kind: 'npc', name: 'Alice' })
        .clear()
        .addEntity({ kind: 'npc', name: 'Bob' })
        .build();

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('Bob');
    });

    it('should reset entity and relationship counts', () => {
      builder
        .addEntities([{ kind: 'npc', name: 'Alice' }, { kind: 'npc', name: 'Bob' }])
        .relate(0, 1, 'friends_with');

      builder.clear();

      expect(builder.entityCount()).toBe(0);
      expect(builder.relationshipCount()).toBe(0);
    });
  });
});

describe('buildCluster helper', () => {
  it('should create new EntityClusterBuilder instance', () => {
    const cluster = buildCluster();
    expect(cluster).toBeInstanceOf(EntityClusterBuilder);
  });

  it('should return independent instances', () => {
    const cluster1 = buildCluster();
    const cluster2 = buildCluster();

    cluster1.addEntity({ kind: 'npc', name: 'Alice' });

    expect(cluster1.entityCount()).toBe(1);
    expect(cluster2.entityCount()).toBe(0);
  });

  it('should support fluent API', () => {
    const result = buildCluster()
      .addEntity({ kind: 'npc', name: 'Alice' })
      .addEntity({ kind: 'faction', name: 'Guild' })
      .relate(0, 1, 'member_of')
      .build();

    expect(result.entities).toHaveLength(2);
    expect(result.relationships).toHaveLength(1);
  });
});

describe('Integration scenarios', () => {
  it('should build a complete guild with members', () => {
    const result = buildCluster()
      .addEntity({ kind: 'faction', subtype: 'guild', name: 'Merchant Guild', status: 'active' })
      .addEntity({ kind: 'npc', subtype: 'merchant', name: 'Guild Master', status: 'active' })
      .addEntity({ kind: 'npc', subtype: 'merchant', name: 'Merchant 1', status: 'active' })
      .addEntity({ kind: 'npc', subtype: 'merchant', name: 'Merchant 2', status: 'active' })
      .relate(1, 0, 'leads', 1.0)
      .relateManyTo([1, 2, 3], 0, 'member_of', 0.8)
      .relateBidirectional(2, 3, 'friends_with', 0.5)
      .build();

    expect(result.entities).toHaveLength(4);
    expect(result.relationships).toHaveLength(6); // 1 leads + 3 member_of + 2 bidirectional friends
  });

  it('should connect cluster entities to existing world entities', () => {
    const result = buildCluster()
      .addEntity({ kind: 'npc', subtype: 'merchant', name: 'Traveler' })
      .addEntity({ kind: 'npc', subtype: 'warrior', name: 'Guard' })
      .relateManyTo([0, 1], 'existing-colony-id', 'located_in')
      .relate(0, 'existing-faction-id', 'member_of')
      .relateFromExisting('existing-npc-id', 1, 'friends_with')
      .build();

    expect(result.relationships).toHaveLength(4);
    expect(result.relationships.some(r => r.dst === 'existing-colony-id')).toBe(true);
    expect(result.relationships.some(r => r.dst === 'existing-faction-id')).toBe(true);
    expect(result.relationships.some(r => r.src === 'existing-npc-id')).toBe(true);
  });

  it('should build complex faction network', () => {
    const result = buildCluster()
      // Create three factions
      .addEntity({ kind: 'faction', subtype: 'guild', name: 'Traders' })
      .addEntity({ kind: 'faction', subtype: 'guild', name: 'Crafters' })
      .addEntity({ kind: 'faction', subtype: 'military', name: 'Guards' })
      // Create alliance between traders and crafters
      .relateBidirectional(0, 1, 'allied_with', 0.8)
      // Both ally with guards
      .relateManyFrom(0, [2], 'allied_with', 0.6)
      .relateManyFrom(1, [2], 'allied_with', 0.6)
      .relateManyFrom(2, [0, 1], 'allied_with', 0.6)
      .buildWithDescription('Created alliance network of 3 factions');

    expect(result.entities).toHaveLength(3);
    expect(result.relationships).toHaveLength(6); // 2 bidirectional + 4 directed
    expect(result.description).toContain('alliance network');
  });

  it('should handle builder reuse with clear', () => {
    const builder = buildCluster();

    // First cluster
    const cluster1 = builder
      .addEntity({ kind: 'npc', name: 'Alice' })
      .addEntity({ kind: 'npc', name: 'Bob' })
      .relate(0, 1, 'friends_with')
      .build();

    expect(cluster1.entities).toHaveLength(2);
    expect(cluster1.relationships).toHaveLength(1);

    // Clear and create second cluster
    builder.clear();

    const cluster2 = builder
      .addEntity({ kind: 'faction', name: 'Guild' })
      .build();

    expect(cluster2.entities).toHaveLength(1);
    expect(cluster2.relationships).toHaveLength(0);
  });
});
