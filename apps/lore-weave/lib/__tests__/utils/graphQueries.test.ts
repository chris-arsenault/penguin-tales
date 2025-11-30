import { describe, it, expect, beforeEach } from 'vitest';
import {
  getEntitiesByRelationship,
  getRelationshipIdSet,
  countRelationships,
  findRelationship,
  getRelatedEntity
} from '../../graph/graphQueries';
import { Graph } from '../../engine/types';
import { HardState, Relationship } from '../../core/worldTypes';

describe('graphQueries', () => {
  let mockGraph: Graph;
  let entity1: HardState;
  let entity2: HardState;
  let entity3: HardState;
  let entity4: HardState;

  beforeEach(() => {
    entity1 = {
      id: 'e1',
      kind: 'npc',
      subtype: 'merchant',
      name: 'Entity 1',
      description: 'Test entity 1',
      status: 'alive',
      prominence: 'recognized', culture: 'world',
      tags: ['test'],
      links: [],
      createdAt: 0,
      updatedAt: 0
    };

    entity2 = {
      id: 'e2',
      kind: 'npc',
      subtype: 'hero',
      name: 'Entity 2',
      description: 'Test entity 2',
      status: 'alive',
      prominence: 'renowned', culture: 'world',
      tags: ['hero'],
      links: [],
      createdAt: 0,
      updatedAt: 0
    };

    entity3 = {
      id: 'e3',
      kind: 'faction',
      subtype: 'guild',
      name: 'Entity 3',
      description: 'Test entity 3',
      status: 'active',
      prominence: 'recognized', culture: 'world',
      tags: ['guild'],
      links: [],
      createdAt: 0,
      updatedAt: 0
    };

    entity4 = {
      id: 'e4',
      kind: 'location',
      subtype: 'colony',
      name: 'Entity 4',
      description: 'Test entity 4',
      status: 'thriving',
      prominence: 'marginal', culture: 'world',
      tags: [],
      links: [],
      createdAt: 0,
      updatedAt: 0
    };

    const _entities = new Map([
      ['e1', entity1],
      ['e2', entity2],
      ['e3', entity3],
      ['e4', entity4]
    ]);
    let _relationships: Relationship[] = [
      { kind: 'allied_with', src: 'e1', dst: 'e2' },
      { kind: 'member_of', src: 'e1', dst: 'e3' },
      { kind: 'located_at', src: 'e1', dst: 'e4' },
      { kind: 'allied_with', src: 'e2', dst: 'e3' },
      { kind: 'located_at', src: 'e3', dst: 'e4' }
    ];

    mockGraph = {
      tick: 0,
      currentEra: {} as any,
      pressures: new Map(),
      history: [],
      config: {} as any,
      relationshipCooldowns: new Map(),
      rateLimitState: {
        currentThreshold: 1,
        lastCreationTick: 0,
        creationsThisEpoch: 0
      },
      growthMetrics: {
        relationshipsPerTick: [],
        averageGrowthRate: 0
      },
      // New Graph interface methods - entity read
      getEntity(id: string): HardState | undefined {
        return _entities.get(id);
      },
      hasEntity(id: string): boolean {
        return _entities.has(id);
      },
      getEntityCount(): number {
        return _entities.size;
      },
      getEntities(): HardState[] {
        return Array.from(_entities.values());
      },
      getEntityIds(): string[] {
        return Array.from(_entities.keys());
      },
      forEachEntity(callback: (entity: HardState, id: string) => void): void {
        _entities.forEach((entity, id) => callback(entity, id));
      },
      findEntities(criteria: any): HardState[] {
        return Array.from(_entities.values()).filter(e => {
          if (criteria.kind && e.kind !== criteria.kind) return false;
          if (criteria.subtype && e.subtype !== criteria.subtype) return false;
          return true;
        });
      },
      getEntitiesByKind(kind: string): HardState[] {
        return Array.from(_entities.values()).filter(e => e.kind === kind);
      },
      getConnectedEntities(entityId: string, relationKind?: string): HardState[] {
        const connectedIds = new Set<string>();
        _relationships.forEach(r => {
          if (relationKind && r.kind !== relationKind) return;
          if (r.src === entityId) connectedIds.add(r.dst);
          if (r.dst === entityId) connectedIds.add(r.src);
        });
        return Array.from(connectedIds)
          .map(id => _entities.get(id))
          .filter((e): e is HardState => e !== undefined);
      },
      // Entity mutation methods
      createEntity(settings: any): string {
        const id = `${settings.kind}-${Date.now()}`;
        _entities.set(id, { ...settings, id, links: [] } as HardState);
        return id;
      },
      updateEntity(id: string, changes: Partial<HardState>): boolean {
        const entity = _entities.get(id);
        if (!entity) return false;
        Object.assign(entity, changes);
        return true;
      },
      deleteEntity(id: string): boolean {
        return _entities.delete(id);
      },
      _loadEntity(id: string, entity: HardState): void {
        _entities.set(id, entity);
      },
      // Relationship read methods
      getRelationships(): Relationship[] {
        return [..._relationships];
      },
      getRelationshipCount(): number {
        return _relationships.length;
      },
      findRelationships(criteria: any): Relationship[] {
        return _relationships.filter(r => {
          if (criteria.kind && r.kind !== criteria.kind) return false;
          if (criteria.src && r.src !== criteria.src) return false;
          if (criteria.dst && r.dst !== criteria.dst) return false;
          return true;
        });
      },
      getEntityRelationships(entityId: string): Relationship[] {
        return _relationships.filter(r => r.src === entityId || r.dst === entityId);
      },
      // Relationship mutation methods
      addRelationship(rel: Relationship): void {
        _relationships.push(rel);
      },
      _loadRelationship(rel: Relationship): void {
        _relationships.push(rel);
      },
      _setRelationships(rels: Relationship[]): void {
        _relationships = rels;
      }
    } as Graph;
  });

  describe('getEntitiesByRelationship', () => {
    it('should find entities where target is source', () => {
      const related = getEntitiesByRelationship(mockGraph, 'e1', 'allied_with', 'src');
      expect(related).toHaveLength(1);
      expect(related[0].id).toBe('e2');
    });

    it('should find entities where target is destination', () => {
      const related = getEntitiesByRelationship(mockGraph, 'e2', 'allied_with', 'dst');
      expect(related).toHaveLength(1);
      expect(related[0].id).toBe('e1');
    });

    it('should return empty array when no relationships match', () => {
      const related = getEntitiesByRelationship(mockGraph, 'e1', 'nonexistent', 'src');
      expect(related).toHaveLength(0);
    });

    it('should return empty array for entity with no relationships', () => {
      const isolatedEntity: HardState = {
        id: 'e5',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Isolated',
        description: 'No relationships',
        status: 'alive',
        prominence: 'forgotten', culture: 'world',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };
      mockGraph._loadEntity('e5', isolatedEntity);

      const related = getEntitiesByRelationship(mockGraph, 'e5', 'allied_with', 'src');
      expect(related).toHaveLength(0);
    });

    it('should filter out undefined entities', () => {
      // Add relationship to non-existent entity
      mockGraph._loadRelationship({ kind: 'allied_with', src: 'e1', dst: 'nonexistent' });

      const related = getEntitiesByRelationship(mockGraph, 'e1', 'allied_with', 'src');
      // Should only return e2, filtering out the nonexistent entity
      expect(related).toHaveLength(1);
      expect(related[0].id).toBe('e2');
      expect(related.every(e => e !== undefined)).toBe(true);
    });
  });

  describe('getRelationshipIdSet', () => {
    it('should return set of related entity IDs with no direction filter', () => {
      const relatedIds = getRelationshipIdSet(mockGraph, 'e1', ['allied_with', 'member_of']);
      expect(relatedIds.size).toBe(2);
      expect(relatedIds.has('e2')).toBe(true);
      expect(relatedIds.has('e3')).toBe(true);
    });

    it('should return set with source direction filter', () => {
      const relatedIds = getRelationshipIdSet(mockGraph, 'e1', ['allied_with'], 'src');
      expect(relatedIds.size).toBe(1);
      expect(relatedIds.has('e2')).toBe(true);
    });

    it('should return set with destination direction filter', () => {
      const relatedIds = getRelationshipIdSet(mockGraph, 'e2', ['allied_with'], 'dst');
      expect(relatedIds.size).toBe(1);
      expect(relatedIds.has('e1')).toBe(true);
    });

    it('should return empty set when no relationships match', () => {
      const relatedIds = getRelationshipIdSet(mockGraph, 'e1', ['nonexistent']);
      expect(relatedIds.size).toBe(0);
    });

    it('should filter by multiple relationship kinds', () => {
      const relatedIds = getRelationshipIdSet(mockGraph, 'e1', ['allied_with', 'located_at']);
      expect(relatedIds.size).toBe(2);
      expect(relatedIds.has('e2')).toBe(true);
      expect(relatedIds.has('e4')).toBe(true);
    });

    it('should return unique IDs (no duplicates)', () => {
      // Add duplicate relationship
      mockGraph._loadRelationship({ kind: 'allied_with', src: 'e1', dst: 'e2' });
      const relatedIds = getRelationshipIdSet(mockGraph, 'e1', ['allied_with']);
      expect(relatedIds.size).toBe(1);
    });
  });

  describe('countRelationships', () => {
    it('should count relationships without direction filter', () => {
      const count = countRelationships(mockGraph, 'e1', 'allied_with');
      expect(count).toBe(1);
    });

    it('should count relationships with source direction', () => {
      const count = countRelationships(mockGraph, 'e1', 'member_of', 'src');
      expect(count).toBe(1);
    });

    it('should count relationships with destination direction', () => {
      const count = countRelationships(mockGraph, 'e3', 'member_of', 'dst');
      expect(count).toBe(1);
    });

    it('should return 0 for no matching relationships', () => {
      const count = countRelationships(mockGraph, 'e1', 'nonexistent');
      expect(count).toBe(0);
    });

    it('should count all relationships of kind regardless of direction when no direction specified', () => {
      const count = countRelationships(mockGraph, 'e4', 'located_at');
      expect(count).toBe(2); // Both e1 and e3 are located_at e4
    });

    it('should handle entity with no relationships', () => {
      mockGraph._loadEntity('e5', {
        id: 'e5',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Isolated',
        description: 'No relationships',
        status: 'alive',
        prominence: 'forgotten', culture: 'world',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      });

      const count = countRelationships(mockGraph, 'e5', 'allied_with');
      expect(count).toBe(0);
    });
  });

  describe('findRelationship', () => {
    it('should find relationship where entity is source', () => {
      const rel = findRelationship(mockGraph, 'e1', 'allied_with', 'src');
      expect(rel).toBeDefined();
      expect(rel?.kind).toBe('allied_with');
      expect(rel?.src).toBe('e1');
      expect(rel?.dst).toBe('e2');
    });

    it('should find relationship where entity is destination', () => {
      const rel = findRelationship(mockGraph, 'e3', 'member_of', 'dst');
      expect(rel).toBeDefined();
      expect(rel?.kind).toBe('member_of');
      expect(rel?.src).toBe('e1');
      expect(rel?.dst).toBe('e3');
    });

    it('should return undefined when no relationship matches', () => {
      const rel = findRelationship(mockGraph, 'e1', 'nonexistent', 'src');
      expect(rel).toBeUndefined();
    });

    it('should return first matching relationship', () => {
      // Add duplicate relationship
      mockGraph._loadRelationship({ kind: 'allied_with', src: 'e1', dst: 'e3' });
      const rel = findRelationship(mockGraph, 'e1', 'allied_with', 'src');
      expect(rel).toBeDefined();
      expect(rel?.dst).toBe('e2'); // Should return first match
    });

    it('should not find relationship when direction does not match', () => {
      const rel = findRelationship(mockGraph, 'e2', 'member_of', 'src');
      expect(rel).toBeUndefined();
    });
  });

  describe('getRelatedEntity', () => {
    it('should get entity at other end when starting from source', () => {
      const relationship = mockGraph.getRelationships()[0]; // e1 allied_with e2
      const related = getRelatedEntity(mockGraph, relationship, 'e1');
      expect(related).toBeDefined();
      expect(related?.id).toBe('e2');
    });

    it('should get entity at other end when starting from destination', () => {
      const relationship = mockGraph.getRelationships()[0]; // e1 allied_with e2
      const related = getRelatedEntity(mockGraph, relationship, 'e2');
      expect(related).toBeDefined();
      expect(related?.id).toBe('e1');
    });

    it('should return undefined when relationship is undefined', () => {
      const related = getRelatedEntity(mockGraph, undefined, 'e1');
      expect(related).toBeUndefined();
    });

    it('should return undefined when target entity does not exist', () => {
      const relationship: Relationship = {
        kind: 'allied_with',
        src: 'e1',
        dst: 'nonexistent'
      };
      const related = getRelatedEntity(mockGraph, relationship, 'e1');
      expect(related).toBeUndefined();
    });

    it('should handle self-referential relationships', () => {
      const selfRel: Relationship = {
        kind: 'reflects_on',
        src: 'e1',
        dst: 'e1'
      };
      const related = getRelatedEntity(mockGraph, selfRel, 'e1');
      expect(related).toBeDefined();
      expect(related?.id).toBe('e1');
    });
  });

  describe('Integration: Complex graph queries', () => {
    it('should handle complex multi-step queries', () => {
      // Find all entities allied with e1, then find where they are located
      const allies = getEntitiesByRelationship(mockGraph, 'e1', 'allied_with', 'src');
      expect(allies).toHaveLength(1);

      const allyId = allies[0].id;
      const allyLocation = getEntitiesByRelationship(mockGraph, allyId, 'located_at', 'src');
      // e2 is not located anywhere in this test
      expect(allyLocation).toHaveLength(0);
    });

    it('should handle counting multiple relationship types', () => {
      const allyCount = countRelationships(mockGraph, 'e1', 'allied_with');
      const memberCount = countRelationships(mockGraph, 'e1', 'member_of');
      const locationCount = countRelationships(mockGraph, 'e1', 'located_at');

      expect(allyCount + memberCount + locationCount).toBe(3);
    });

    it('should handle empty graph', () => {
      const _entities = new Map<string, HardState>();
      let _relationships: Relationship[] = [];

      const emptyGraph: Graph = {
        tick: 0,
        currentEra: {} as any,
        pressures: new Map(),
        history: [],
        config: {} as any,
        relationshipCooldowns: new Map(),
        rateLimitState: {
          currentThreshold: 1,
          lastCreationTick: 0,
          creationsThisEpoch: 0
        },
        growthMetrics: {
          relationshipsPerTick: [],
          averageGrowthRate: 0
        },
        getEntity(id: string) { return _entities.get(id); },
        hasEntity(id: string) { return _entities.has(id); },
        getEntityCount() { return _entities.size; },
        getEntities() { return Array.from(_entities.values()); },
        getEntityIds() { return Array.from(_entities.keys()); },
        forEachEntity(cb: any) { _entities.forEach((e, id) => cb(e, id)); },
        findEntities() { return []; },
        getEntitiesByKind() { return []; },
        getConnectedEntities() { return []; },
        createEntity() { return ''; },
        updateEntity() { return false; },
        deleteEntity() { return false; },
        _loadEntity(id: string, e: HardState) { _entities.set(id, e); },
        getRelationships() { return [..._relationships]; },
        getRelationshipCount() { return _relationships.length; },
        findRelationships() { return []; },
        getEntityRelationships() { return []; },
        addRelationship(r: Relationship) { _relationships.push(r); },
        _loadRelationship(r: Relationship) { _relationships.push(r); },
        _setRelationships(r: Relationship[]) { _relationships = r; }
      } as Graph;

      const related = getEntitiesByRelationship(emptyGraph, 'e1', 'allied_with', 'src');
      expect(related).toHaveLength(0);

      const count = countRelationships(emptyGraph, 'e1', 'allied_with');
      expect(count).toBe(0);

      const idSet = getRelationshipIdSet(emptyGraph, 'e1', ['allied_with']);
      expect(idSet.size).toBe(0);
    });
  });
});
