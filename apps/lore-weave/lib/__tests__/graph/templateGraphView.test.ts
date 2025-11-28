// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { TemplateGraphView } from '../../graph/templateGraphView';
import { Graph } from '../../engine/types';
import { HardState, Relationship } from '../../core/worldTypes';
import { TargetSelector } from '../../selection/targetSelector';

describe('TemplateGraphView', () => {
  let graph: Graph;
  let targetSelector: TargetSelector;
  let view: TemplateGraphView;

  // Helper to create a test entity
  const createEntity = (
    id: string,
    kind: string,
    subtype: string,
    options: Partial<HardState> = {}
  ): HardState => ({
    id,
    kind,
    subtype,
    name: `Test ${id}`,
    description: `Test entity ${id}`,
    status: 'active',
    prominence: 'recognized',
    tags: {},
    links: [],
    createdAt: 0,
    updatedAt: 0,
    ...options,
  });

  beforeEach(() => {
    // Create a basic graph with some test entities
    const _entities = new Map<string, HardState>();
    _entities.set('npc1', createEntity('npc1', 'npc', 'merchant', { tags: { trader: 'true', wealthy: 'true' } }));
    _entities.set('npc2', createEntity('npc2', 'npc', 'hero', { prominence: 'renowned' }));
    _entities.set('npc3', createEntity('npc3', 'npc', 'merchant', { status: 'retired' }));
    _entities.set('loc1', createEntity('loc1', 'location', 'colony'));
    _entities.set('faction1', createEntity('faction1', 'faction', 'guild'));

    // Add some relationships
    const rel1: Relationship = { kind: 'member_of', src: 'npc1', dst: 'faction1' };
    const rel2: Relationship = { kind: 'resident_of', src: 'npc1', dst: 'loc1' };
    const rel3: Relationship = { kind: 'leader_of', src: 'npc2', dst: 'faction1' };

    _entities.get('npc1')!.links = [rel1, rel2];
    _entities.get('npc2')!.links = [rel3];
    _entities.get('faction1')!.links = [rel1, rel3];
    _entities.get('loc1')!.links = [rel2];

    let _relationships: Relationship[] = [rel1, rel2, rel3];

    graph = {
      tick: 100,
      currentEra: {
        id: 'test-era',
        name: 'Test Era',
        description: 'Test era',
        templateWeights: {},
        systemModifiers: {},
        pressureModifiers: {},
      },
      pressures: new Map([
        ['conflict', 50],
        ['stability', 75],
      ]),
      relationshipCooldowns: new Map([
        ['npc1', new Map([['allies', 95]])],
      ]),
      config: {} as any,
      discoveryState: {} as any,
      history: [],
      loreIndex: {} as any,
      nameLogger: {} as any,
      tagRegistry: {} as any,
      loreValidator: {} as any,
      statistics: {} as any,
      enrichmentService: {} as any,

      // Entity read methods
      getEntity(id: string): HardState | undefined {
        const entity = _entities.get(id);
        return entity ? { ...entity, tags: { ...entity.tags }, links: [...entity.links] } : undefined;
      },
      hasEntity(id: string): boolean {
        return _entities.has(id);
      },
      getEntityCount(): number {
        return _entities.size;
      },
      getEntities(): HardState[] {
        return Array.from(_entities.values()).map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
      },
      getEntityIds(): string[] {
        return Array.from(_entities.keys());
      },
      forEachEntity(callback: (entity: HardState, id: string) => void): void {
        _entities.forEach((entity, id) => {
          callback({ ...entity, tags: { ...entity.tags }, links: [...entity.links] }, id);
        });
      },
      findEntities(criteria: { kind?: string; subtype?: string; status?: string; prominence?: string; culture?: string; tag?: string; exclude?: string[] }): HardState[] {
        return Array.from(_entities.values())
          .filter(e => {
            if (criteria.kind && e.kind !== criteria.kind) return false;
            if (criteria.subtype && e.subtype !== criteria.subtype) return false;
            if (criteria.status && e.status !== criteria.status) return false;
            if (criteria.prominence && e.prominence !== criteria.prominence) return false;
            if (criteria.culture && e.culture !== criteria.culture) return false;
            if (criteria.tag && !(criteria.tag in e.tags)) return false;
            if (criteria.exclude && criteria.exclude.includes(e.id)) return false;
            return true;
          })
          .map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
      },
      getEntitiesByKind(kind: string): HardState[] {
        return Array.from(_entities.values())
          .filter(e => e.kind === kind)
          .map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
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
          .filter((e): e is HardState => e !== undefined)
          .map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
      },

      // Entity mutation methods
      setEntity(id: string, entity: HardState): void {
        _entities.set(id, entity);
      },
      updateEntity(id: string, changes: Partial<HardState>): boolean {
        const entity = _entities.get(id);
        if (!entity) return false;
        Object.assign(entity, changes);
        entity.updatedAt = this.tick;
        return true;
      },
      deleteEntity(id: string): boolean {
        return _entities.delete(id);
      },

      // Relationship read methods
      getRelationships(): Relationship[] {
        return [..._relationships];
      },
      getRelationshipCount(): number {
        return _relationships.length;
      },
      findRelationships(criteria: { kind?: string; src?: string; dst?: string; category?: string; minStrength?: number }): Relationship[] {
        return _relationships.filter(r => {
          if (criteria.kind && r.kind !== criteria.kind) return false;
          if (criteria.src && r.src !== criteria.src) return false;
          if (criteria.dst && r.dst !== criteria.dst) return false;
          if (criteria.minStrength !== undefined && (r.strength ?? 0.5) < criteria.minStrength) return false;
          return true;
        });
      },
      getEntityRelationships(entityId: string, direction?: 'src' | 'dst' | 'both'): Relationship[] {
        return _relationships.filter(r => {
          if (direction === 'src') return r.src === entityId;
          if (direction === 'dst') return r.dst === entityId;
          return r.src === entityId || r.dst === entityId;
        });
      },
      hasRelationship(srcId: string, dstId: string, kind?: string): boolean {
        return _relationships.some(r =>
          r.src === srcId && r.dst === dstId && (!kind || r.kind === kind)
        );
      },

      // Relationship mutation methods
      pushRelationship(relationship: Relationship): void {
        _relationships.push(relationship);
        const srcEntity = _entities.get(relationship.src);
        if (srcEntity) {
          srcEntity.links.push({ ...relationship });
          srcEntity.updatedAt = this.tick;
        }
        const dstEntity = _entities.get(relationship.dst);
        if (dstEntity) {
          dstEntity.updatedAt = this.tick;
        }
      },
      setRelationships(rels: Relationship[]): void {
        _relationships = rels;
      },
      removeRelationship(srcId: string, dstId: string, kind: string): boolean {
        const idx = _relationships.findIndex(r => r.src === srcId && r.dst === dstId && r.kind === kind);
        if (idx >= 0) {
          _relationships.splice(idx, 1);
          const srcEntity = _entities.get(srcId);
          if (srcEntity) {
            srcEntity.links = srcEntity.links.filter(l => !(l.src === srcId && l.dst === dstId && l.kind === kind));
            srcEntity.updatedAt = this.tick;
          }
          return true;
        }
        return false;
      },

      // Keep backward compatibility for tests
      get entities() { return _entities; },
      get relationships() { return _relationships; },
      set relationships(rels: Relationship[]) { _relationships = rels; }
    };

    targetSelector = new TargetSelector();
    view = new TemplateGraphView(graph, targetSelector);
  });

  describe('constructor', () => {
    it('should initialize with graph and targetSelector', () => {
      expect(view).toBeDefined();
      expect(view.targetSelector).toBe(targetSelector);
    });
  });

  describe('selectTargets', () => {
    it('should delegate to targetSelector', () => {
      const result = view.selectTargets('npc', 1, {});
      expect(result).toBeDefined();
      expect(result.existing).toBeDefined();
      expect(result.created).toBeDefined();
      expect(result.diagnostics).toBeDefined();
    });

    it('should handle empty graph', () => {
      // Clear all entities to create an empty graph
      graph.entities.clear();
      graph.relationships = [];
      const result = view.selectTargets('npc', 1, {});
      expect(result.existing).toEqual([]);
    });
  });

  describe('tick', () => {
    it('should return current tick', () => {
      expect(view.tick).toBe(100);
    });

    it('should reflect updated tick', () => {
      graph.tick = 200;
      expect(view.tick).toBe(200);
    });
  });

  describe('currentEra', () => {
    it('should return current era', () => {
      expect(view.currentEra.id).toBe('test-era');
      expect(view.currentEra.name).toBe('Test Era');
    });
  });

  describe('getPressure', () => {
    it('should return existing pressure value', () => {
      expect(view.getPressure('conflict')).toBe(50);
      expect(view.getPressure('stability')).toBe(75);
    });

    it('should return 0 for non-existent pressure', () => {
      expect(view.getPressure('unknown')).toBe(0);
    });

    it('should handle empty pressure map', () => {
      graph.pressures = new Map();
      expect(view.getPressure('conflict')).toBe(0);
    });
  });

  describe('getAllPressures', () => {
    it('should return all pressures as read-only map', () => {
      const pressures = view.getAllPressures();
      expect(pressures.size).toBe(2);
      expect(pressures.get('conflict')).toBe(50);
      expect(pressures.get('stability')).toBe(75);
    });

    it('should return empty map when no pressures', () => {
      graph.pressures = new Map();
      const pressures = view.getAllPressures();
      expect(pressures.size).toBe(0);
    });
  });

  describe('config', () => {
    it('should return graph config', () => {
      expect(view.config).toBe(graph.config);
    });
  });

  describe('discoveryState', () => {
    it('should return discovery state', () => {
      expect(view.discoveryState).toBe(graph.discoveryState);
    });
  });

  describe('getInternalGraph', () => {
    it('should return internal graph', () => {
      expect(view.getInternalGraph()).toBe(graph);
    });
  });

  describe('getEntity', () => {
    it('should return entity by ID', () => {
      const entity = view.getEntity('npc1');
      expect(entity).toBeDefined();
      expect(entity!.id).toBe('npc1');
      expect(entity!.kind).toBe('npc');
    });

    it('should return undefined for non-existent entity', () => {
      expect(view.getEntity('nonexistent')).toBeUndefined();
    });

    it('should handle empty string ID', () => {
      expect(view.getEntity('')).toBeUndefined();
    });
  });

  describe('hasEntity', () => {
    it('should return true for existing entity', () => {
      expect(view.hasEntity('npc1')).toBe(true);
      expect(view.hasEntity('loc1')).toBe(true);
    });

    it('should return false for non-existent entity', () => {
      expect(view.hasEntity('nonexistent')).toBe(false);
    });

    it('should handle empty string ID', () => {
      expect(view.hasEntity('')).toBe(false);
    });
  });

  describe('getEntityCount', () => {
    it('should return total entity count without parameters', () => {
      expect(view.getEntityCount()).toBe(5);
    });

    it('should count entities by kind', () => {
      expect(view.getEntityCount('npc')).toBe(3);
      expect(view.getEntityCount('location')).toBe(1);
      expect(view.getEntityCount('faction')).toBe(1);
    });

    it('should count entities by kind and subtype', () => {
      expect(view.getEntityCount('npc', 'merchant')).toBe(2);
      expect(view.getEntityCount('npc', 'hero')).toBe(1);
      expect(view.getEntityCount('location', 'colony')).toBe(1);
    });

    it('should return 0 for non-existent kind', () => {
      expect(view.getEntityCount('nonexistent')).toBe(0);
    });

    it('should return 0 for non-existent subtype', () => {
      expect(view.getEntityCount('npc', 'nonexistent')).toBe(0);
    });

    it('should handle empty graph', () => {
      graph.entities.clear();
      expect(view.getEntityCount()).toBe(0);
      expect(view.getEntityCount('npc')).toBe(0);
    });
  });

  describe('findEntities', () => {
    it('should find entities by kind', () => {
      const npcs = view.findEntities({ kind: 'npc' });
      expect(npcs.length).toBe(3);
      expect(npcs.every(e => e.kind === 'npc')).toBe(true);
    });

    it('should find entities by subtype', () => {
      const merchants = view.findEntities({ subtype: 'merchant' });
      expect(merchants.length).toBe(2);
      expect(merchants.every(e => e.subtype === 'merchant')).toBe(true);
    });

    it('should find entities by kind and subtype', () => {
      const npcMerchants = view.findEntities({ kind: 'npc', subtype: 'merchant' });
      expect(npcMerchants.length).toBe(2);
    });

    it('should find entities by status', () => {
      const retired = view.findEntities({ status: 'retired' });
      expect(retired.length).toBe(1);
      expect(retired[0].id).toBe('npc3');
    });

    it('should find entities by prominence', () => {
      const renowned = view.findEntities({ prominence: 'renowned' });
      expect(renowned.length).toBe(1);
      expect(renowned[0].id).toBe('npc2');
    });

    it('should find entities by tag', () => {
      const traders = view.findEntities({ tag: 'trader' });
      expect(traders.length).toBe(1);
      expect(traders[0].id).toBe('npc1');
    });

    it('should find entities with multiple criteria', () => {
      const activeTraders = view.findEntities({ status: 'active', tag: 'trader' });
      expect(activeTraders.length).toBe(1);
      expect(activeTraders[0].id).toBe('npc1');
    });

    it('should return empty array when no matches', () => {
      const results = view.findEntities({ kind: 'nonexistent' });
      expect(results).toEqual([]);
    });

    it('should return all entities with empty criteria', () => {
      const results = view.findEntities({});
      expect(results.length).toBe(5);
    });

    it('should handle empty graph', () => {
      graph.entities.clear();
      const results = view.findEntities({ kind: 'npc' });
      expect(results).toEqual([]);
    });
  });

  describe('getAllRelationships', () => {
    it('should return all relationships', () => {
      const rels = view.getAllRelationships();
      expect(rels.length).toBe(3);
    });

    it('should return empty array for empty graph', () => {
      graph.relationships = [];
      const rels = view.getAllRelationships();
      expect(rels).toEqual([]);
    });
  });

  describe('getRelationships', () => {
    it('should return all relationships for entity', () => {
      const rels = view.getRelationships('npc1');
      expect(rels.length).toBe(2);
    });

    it('should filter relationships by kind', () => {
      const memberRels = view.getRelationships('npc1', 'member_of');
      expect(memberRels.length).toBe(1);
      expect(memberRels[0].kind).toBe('member_of');
    });

    it('should return empty array for non-existent entity', () => {
      const rels = view.getRelationships('nonexistent');
      expect(rels).toEqual([]);
    });

    it('should return empty array for entity with no relationships', () => {
      graph.entities.set('npc4', createEntity('npc4', 'npc', 'commoner'));
      const rels = view.getRelationships('npc4');
      expect(rels).toEqual([]);
    });

    it('should return empty array when kind does not match', () => {
      const rels = view.getRelationships('npc1', 'nonexistent');
      expect(rels).toEqual([]);
    });
  });

  describe('getRelatedEntities', () => {
    it('should get all related entities (both directions)', () => {
      const related = view.getRelatedEntities('npc1');
      expect(related.length).toBe(2);
      const ids = related.map(e => e.id);
      expect(ids).toContain('faction1');
      expect(ids).toContain('loc1');
    });

    it('should filter by relationship kind', () => {
      const members = view.getRelatedEntities('npc1', 'member_of');
      expect(members.length).toBe(1);
      expect(members[0].id).toBe('faction1');
    });

    it('should filter by direction (src)', () => {
      const srcRelated = view.getRelatedEntities('npc1', undefined, 'src');
      expect(srcRelated.length).toBe(2);
    });

    it('should filter by direction (dst)', () => {
      const dstRelated = view.getRelatedEntities('faction1', undefined, 'dst');
      expect(dstRelated.length).toBe(2);
    });

    it('should combine kind and direction filters', () => {
      const members = view.getRelatedEntities('faction1', 'member_of', 'dst');
      expect(members.length).toBe(1);
      expect(members[0].id).toBe('npc1');
    });

    it('should return empty array for non-existent entity', () => {
      const related = view.getRelatedEntities('nonexistent');
      expect(related).toEqual([]);
    });

    it('should return empty array for entity with no relationships', () => {
      graph.entities.set('npc4', createEntity('npc4', 'npc', 'commoner'));
      const related = view.getRelatedEntities('npc4');
      expect(related).toEqual([]);
    });

    it('should handle broken relationship references gracefully', () => {
      // Add a relationship to a non-existent entity
      const badRel: Relationship = { kind: 'allies', src: 'npc1', dst: 'nonexistent' };
      graph.entities.get('npc1')!.links.push(badRel);
      const related = view.getRelatedEntities('npc1');
      // Should only return valid entities
      expect(related.every(e => graph.entities.has(e.id))).toBe(true);
    });
  });

  describe('hasRelationship', () => {
    it('should return true for existing relationship', () => {
      expect(view.hasRelationship('npc1', 'faction1')).toBe(true);
      expect(view.hasRelationship('npc1', 'loc1')).toBe(true);
    });

    it('should check specific relationship kind', () => {
      expect(view.hasRelationship('npc1', 'faction1', 'member_of')).toBe(true);
      expect(view.hasRelationship('npc1', 'faction1', 'allies')).toBe(false);
    });

    it('should work in both directions', () => {
      expect(view.hasRelationship('npc1', 'faction1')).toBe(true);
      expect(view.hasRelationship('faction1', 'npc1')).toBe(true);
    });

    it('should return false for non-existent relationship', () => {
      expect(view.hasRelationship('npc1', 'npc2')).toBe(false);
    });

    it('should return false for non-existent source entity', () => {
      expect(view.hasRelationship('nonexistent', 'npc1')).toBe(false);
    });

    it('should return false for empty IDs', () => {
      expect(view.hasRelationship('', 'npc1')).toBe(false);
      expect(view.hasRelationship('npc1', '')).toBe(false);
    });
  });

  describe('getRelationshipCooldown', () => {
    it('should return cooldown ticks remaining', () => {
      // npc1 formed 'allies' at tick 95, current tick is 100, cooldown is 10
      // So 5 ticks elapsed, 5 remaining
      expect(view.getRelationshipCooldown('npc1', 'allies')).toBe(5);
    });

    it('should return 0 when cooldown expired', () => {
      graph.tick = 200;
      expect(view.getRelationshipCooldown('npc1', 'allies')).toBe(0);
    });

    it('should return 0 for entity with no cooldowns', () => {
      expect(view.getRelationshipCooldown('npc2', 'allies')).toBe(0);
    });

    it('should return 0 for non-existent relationship type', () => {
      expect(view.getRelationshipCooldown('npc1', 'enemies')).toBe(0);
    });

    it('should return 0 for non-existent entity', () => {
      expect(view.getRelationshipCooldown('nonexistent', 'allies')).toBe(0);
    });

    it('should handle edge case at exact cooldown expiration', () => {
      graph.tick = 105; // Exactly 10 ticks after formation at 95
      expect(view.getRelationshipCooldown('npc1', 'allies')).toBe(0);
    });
  });

  describe('canFormRelationship', () => {
    it('should return false when on cooldown', () => {
      expect(view.canFormRelationship('npc1', 'allies')).toBe(false);
    });

    it('should return true when cooldown expired', () => {
      graph.tick = 200;
      expect(view.canFormRelationship('npc1', 'allies')).toBe(true);
    });

    it('should return true for entity with no cooldowns', () => {
      expect(view.canFormRelationship('npc2', 'allies')).toBe(true);
    });

    it('should return true for non-existent relationship type', () => {
      expect(view.canFormRelationship('npc1', 'enemies')).toBe(true);
    });
  });

  describe('getLocation', () => {
    it('should find location via resident_of', () => {
      const location = view.getLocation('npc1');
      expect(location).toBeDefined();
      expect(location!.id).toBe('loc1');
    });

    it('should find location via located_at', () => {
      const locatedAtRel: Relationship = { kind: 'located_at', src: 'npc2', dst: 'loc1' };
      graph.entities.get('npc2')!.links.push(locatedAtRel);
      const location = view.getLocation('npc2');
      expect(location).toBeDefined();
      expect(location!.id).toBe('loc1');
    });

    it('should return undefined for entity with no location', () => {
      expect(view.getLocation('faction1')).toBeUndefined();
    });

    it('should return undefined for non-existent entity', () => {
      expect(view.getLocation('nonexistent')).toBeUndefined();
    });

    it('should handle broken location reference', () => {
      const badRel: Relationship = { kind: 'resident_of', src: 'npc3', dst: 'nonexistent-loc' };
      graph.entities.get('npc3')!.links.push(badRel);
      const location = view.getLocation('npc3');
      expect(location).toBeUndefined();
    });
  });

  describe('getFactionMembers', () => {
    it('should return all faction members', () => {
      const members = view.getFactionMembers('faction1');
      expect(members.length).toBeGreaterThanOrEqual(1);
      expect(members.some(m => m.id === 'npc1')).toBe(true);
    });

    it('should return empty array for faction with no members', () => {
      graph.entities.set('faction2', createEntity('faction2', 'faction', 'guild'));
      const members = view.getFactionMembers('faction2');
      expect(members).toEqual([]);
    });

    it('should return empty array for non-existent faction', () => {
      const members = view.getFactionMembers('nonexistent');
      expect(members).toEqual([]);
    });

    it('should handle multiple members', () => {
      // Create a fresh npc without existing faction membership
      const npc4 = createEntity('npc4', 'npc', 'commoner');
      const memberRel: Relationship = { kind: 'member_of', src: 'npc4', dst: 'faction1' };
      npc4.links.push(memberRel);
      graph.entities.set('npc4', npc4);

      const members = view.getFactionMembers('faction1');
      expect(members.length).toBeGreaterThanOrEqual(2);
      expect(members.some(m => m.id === 'npc1')).toBe(true);
      expect(members.some(m => m.id === 'npc4')).toBe(true);
    });
  });

  describe('getFactionLeader', () => {
    it('should return faction leader', () => {
      const leader = view.getFactionLeader('faction1');
      expect(leader).toBeDefined();
      expect(leader!.id).toBe('npc2');
    });

    it('should return undefined for faction with no leader', () => {
      graph.entities.set('faction2', createEntity('faction2', 'faction', 'guild'));
      const leader = view.getFactionLeader('faction2');
      expect(leader).toBeUndefined();
    });

    it('should return undefined for non-existent faction', () => {
      const leader = view.getFactionLeader('nonexistent');
      expect(leader).toBeUndefined();
    });

    it('should return first leader if multiple exist (edge case)', () => {
      // Add another leader (shouldn't happen in practice, but test handles it)
      const leaderRel: Relationship = { kind: 'leader_of', src: 'npc1', dst: 'faction1' };
      graph.entities.get('npc1')!.links.push(leaderRel);
      const leader = view.getFactionLeader('faction1');
      expect(leader).toBeDefined();
      expect(['npc1', 'npc2']).toContain(leader!.id);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle graph with no entities', () => {
      graph.entities.clear();
      graph.relationships = [];
      expect(view.getEntityCount()).toBe(0);
      expect(view.findEntities({})).toEqual([]);
      expect(view.getAllRelationships()).toEqual([]);
    });

    it('should handle graph with no relationships', () => {
      graph.relationships = [];
      graph.entities.forEach(e => (e.links = []));
      expect(view.getAllRelationships()).toEqual([]);
      expect(view.getRelationships('npc1')).toEqual([]);
      expect(view.getRelatedEntities('npc1')).toEqual([]);
    });

    it('should handle entities with empty links array', () => {
      const entity = createEntity('npc5', 'npc', 'commoner');
      entity.links = [];
      graph.entities.set('npc5', entity);
      expect(view.getRelationships('npc5')).toEqual([]);
      expect(view.getRelatedEntities('npc5')).toEqual([]);
    });

    it('should handle pressure map with undefined values', () => {
      graph.pressures.set('test', undefined as any);
      expect(view.getPressure('test')).toBe(0);
    });

    it('should handle finding entities with all undefined criteria', () => {
      const results = view.findEntities({
        kind: undefined,
        subtype: undefined,
        status: undefined,
        prominence: undefined,
        tag: undefined,
      });
      expect(results.length).toBe(5);
    });
  });
});
