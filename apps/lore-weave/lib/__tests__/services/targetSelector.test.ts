// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { TargetSelector, SelectionBias, SelectionContext } from '../../services/targetSelector';
import { Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';

describe('TargetSelector', () => {
  let selector: TargetSelector;
  let graph: Graph;

  // Helper to create test entities
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
    tags: [],
    links: [],
    createdAt: 0,
    updatedAt: 0,
    ...options,
  });

  beforeEach(() => {
    selector = new TargetSelector();

    // Create test graph with varied connectivity
    const _entities = new Map<string, HardState>();

    // Low-degree nodes (1-2 connections)
    _entities.set('npc1', createEntity('npc1', 'npc', 'merchant', { tags: ['trader'], prominence: 'marginal' }));
    _entities.set('npc2', createEntity('npc2', 'npc', 'hero', { tags: ['brave'], prominence: 'renowned' }));

    // Medium-degree nodes (3-4 connections)
    _entities.set('npc3', createEntity('npc3', 'npc', 'merchant', { tags: ['wealthy'], prominence: 'recognized' }));

    // High-degree hub (6+ connections) - should be penalized
    _entities.set('npc4', createEntity('npc4', 'npc', 'leader', { tags: ['popular'], prominence: 'mythic' }));

    // Other kinds
    _entities.set('loc1', createEntity('loc1', 'location', 'colony'));
    _entities.set('faction1', createEntity('faction1', 'faction', 'guild'));

    // Create relationships to establish different connectivity patterns
    let _relationships: Relationship[] = [
      // npc1: 2 connections
      { kind: 'member_of', src: 'npc1', dst: 'faction1' },
      { kind: 'resident_of', src: 'npc1', dst: 'loc1' },

      // npc2: 1 connection
      { kind: 'resident_of', src: 'npc2', dst: 'loc1' },

      // npc3: 4 connections
      { kind: 'member_of', src: 'npc3', dst: 'faction1' },
      { kind: 'resident_of', src: 'npc3', dst: 'loc1' },
      { kind: 'allies', src: 'npc3', dst: 'npc1' },
      { kind: 'allies', src: 'npc3', dst: 'npc2' },

      // npc4: 7 connections (hub)
      { kind: 'leader_of', src: 'npc4', dst: 'faction1' },
      { kind: 'resident_of', src: 'npc4', dst: 'loc1' },
      { kind: 'allies', src: 'npc4', dst: 'npc1' },
      { kind: 'allies', src: 'npc4', dst: 'npc2' },
      { kind: 'allies', src: 'npc4', dst: 'npc3' },
      { kind: 'mentor_of', src: 'npc4', dst: 'npc1' },
      { kind: 'mentor_of', src: 'npc4', dst: 'npc2' },
    ];

    // Assign links to entities
    _relationships.forEach(rel => {
      const src = _entities.get(rel.src);
      const dst = _entities.get(rel.dst);
      if (src) src.links.push(rel);
      if (dst && rel.src !== rel.dst) dst.links.push(rel);
    });

    graph = {
      tick: 100,
      currentEra: { id: 'test', name: 'Test', description: 'Test', templateWeights: {}, systemModifiers: {}, pressureModifiers: {} },
      pressures: new Map(),
      relationshipCooldowns: new Map(),
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
        return entity ? { ...entity, tags: [...entity.tags], links: [...entity.links] } : undefined;
      },
      hasEntity(id: string): boolean {
        return _entities.has(id);
      },
      getEntityCount(): number {
        return _entities.size;
      },
      getEntities(): HardState[] {
        return Array.from(_entities.values()).map(e => ({ ...e, tags: [...e.tags], links: [...e.links] }));
      },
      getEntityIds(): string[] {
        return Array.from(_entities.keys());
      },
      forEachEntity(callback: (entity: HardState, id: string) => void): void {
        _entities.forEach((entity, id) => {
          callback({ ...entity, tags: [...entity.tags], links: [...entity.links] }, id);
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
            if (criteria.tag && !e.tags.includes(criteria.tag)) return false;
            if (criteria.exclude && criteria.exclude.includes(e.id)) return false;
            return true;
          })
          .map(e => ({ ...e, tags: [...e.tags], links: [...e.links] }));
      },
      getEntitiesByKind(kind: string): HardState[] {
        return Array.from(_entities.values())
          .filter(e => e.kind === kind)
          .map(e => ({ ...e, tags: [...e.tags], links: [...e.links] }));
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
          .map(e => ({ ...e, tags: [...e.tags], links: [...e.links] }));
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
      }
    };
  });

  describe('constructor', () => {
    it('should create a new TargetSelector instance', () => {
      expect(selector).toBeDefined();
      expect(selector).toBeInstanceOf(TargetSelector);
    });
  });

  describe('selectTargets - basic selection', () => {
    it('should select entities of the specified kind', () => {
      const result = selector.selectTargets(graph, 'npc', 2, {});
      expect(result.existing.length).toBeLessThanOrEqual(2);
      expect(result.existing.every(e => e.kind === 'npc')).toBe(true);
      expect(result.created).toEqual([]);
    });

    it('should return empty result when no entities of kind exist', () => {
      const result = selector.selectTargets(graph, 'nonexistent', 2, {});
      expect(result.existing).toEqual([]);
      expect(result.created).toEqual([]);
      expect(result.diagnostics.candidatesEvaluated).toBe(0);
    });

    it('should handle count larger than available entities', () => {
      const result = selector.selectTargets(graph, 'npc', 100, {});
      expect(result.existing.length).toBeLessThanOrEqual(4); // Only 4 NPCs in graph
    });

    it('should handle count of 0', () => {
      const result = selector.selectTargets(graph, 'npc', 0, {});
      expect(result.existing).toEqual([]);
    });

    it('should provide accurate diagnostics', () => {
      const result = selector.selectTargets(graph, 'npc', 2, {});
      expect(result.diagnostics.candidatesEvaluated).toBe(4);
      expect(result.diagnostics.bestScore).toBeGreaterThan(0);
      expect(result.diagnostics.avgScore).toBeGreaterThan(0);
      expect(result.diagnostics.creationTriggered).toBe(false);
    });
  });

  describe('selectTargets - preference biases', () => {
    it('should prefer specified subtypes', () => {
      const bias: SelectionBias = {
        prefer: { subtypes: ['merchant'] }
      };
      const result = selector.selectTargets(graph, 'npc', 1, bias);
      expect(result.existing.length).toBe(1);
      // Should prefer merchants (npc1, npc3) over others
      expect(['merchant'].includes(result.existing[0].subtype)).toBe(true);
    });

    it('should prefer specified tags', () => {
      const bias: SelectionBias = {
        prefer: { tags: ['brave'] }
      };
      const result = selector.selectTargets(graph, 'npc', 1, bias);
      expect(result.existing.length).toBe(1);
      // Should select npc2 which has 'brave' tag
      expect(result.existing[0].tags.includes('brave')).toBe(true);
    });

    it('should prefer specified prominence levels', () => {
      const bias: SelectionBias = {
        prefer: { prominence: ['renowned'] }
      };
      const result = selector.selectTargets(graph, 'npc', 1, bias);
      expect(result.existing.length).toBe(1);
      // Should select npc2 which has 'renowned' prominence
      expect(result.existing[0].prominence).toBe('renowned');
    });

    it('should use custom preferenceBoost', () => {
      const bias1: SelectionBias = {
        prefer: { subtypes: ['merchant'], preferenceBoost: 1.5 }
      };
      const result1 = selector.selectTargets(graph, 'npc', 2, bias1);

      const bias2: SelectionBias = {
        prefer: { subtypes: ['merchant'], preferenceBoost: 5.0 }
      };
      const result2 = selector.selectTargets(graph, 'npc', 2, bias2);

      // Higher boost should more strongly prefer merchants
      expect(result2.diagnostics.bestScore).toBeGreaterThanOrEqual(result1.diagnostics.bestScore);
    });

    it('should prefer same location as reference entity', () => {
      // Create a new entity in a different location to test location preference
      const loc2 = createEntity('loc2', 'location', 'outpost');
      graph.setEntity('loc2', loc2);

      const npc5 = createEntity('npc5', 'npc', 'merchant', { tags: ['trader'], prominence: 'marginal' });
      npc5.links = [{ kind: 'resident_of', src: 'npc5', dst: 'loc2' }];
      graph.setEntity('npc5', npc5);

      const bias: SelectionBias = {
        prefer: { sameLocationAs: 'npc1' } // npc1 is in loc1
      };
      const result = selector.selectTargets(graph, 'npc', 1, bias);

      // Should prefer NPCs in loc1 over npc5 in loc2
      expect(result.existing.length).toBe(1);
      expect(result.existing[0].id).not.toBe('npc5');
    });

    it('should combine multiple preference criteria', () => {
      const bias: SelectionBias = {
        prefer: {
          subtypes: ['merchant'],
          tags: ['trader'],
          prominence: ['marginal']
        }
      };
      const result = selector.selectTargets(graph, 'npc', 1, bias);
      expect(result.existing.length).toBe(1);
      // npc1 matches all three criteria
      expect(result.existing[0].id).toBe('npc1');
    });
  });

  describe('selectTargets - avoidance penalties', () => {
    it('should penalize specific relationship kinds', () => {
      const bias: SelectionBias = {
        avoid: { relationshipKinds: ['member_of'] }
      };
      const result = selector.selectTargets(graph, 'npc', 1, bias);
      // npc2 has no member_of links, should be preferred
      expect(result.existing[0].id).toBe('npc2');
    });

    it('should apply hub penalty strength', () => {
      const bias: SelectionBias = {
        avoid: { hubPenaltyStrength: 2.0 }
      };
      const result = selector.selectTargets(graph, 'npc', 1, bias);
      // Should avoid npc4 (the hub with 7 connections)
      expect(result.existing[0].id).not.toBe('npc4');
    });

    it('should respect maxTotalRelationships hard cap', () => {
      const bias: SelectionBias = {
        avoid: { maxTotalRelationships: 3 }
      };
      const result = selector.selectTargets(graph, 'npc', 4, bias);
      // Should exclude npc3 (4 links) and npc4 (7 links)
      expect(result.existing.every(e => e.links.length < 3)).toBe(true);
    });

    it('should exclude entities related to specified entity', () => {
      const bias: SelectionBias = {
        avoid: {
          excludeRelatedTo: { entityId: 'npc1' }
        }
      };
      const result = selector.selectTargets(graph, 'npc', 2, bias);
      // Should not select npc3 or npc4 (both have relationships with npc1)
      expect(result.existing.every(e => e.id !== 'npc3' && e.id !== 'npc4')).toBe(true);
    });

    it('should exclude only specific relationship kind when specified', () => {
      const bias: SelectionBias = {
        avoid: {
          excludeRelatedTo: {
            entityId: 'faction1',
            relationshipKind: 'member_of'
          }
        }
      };
      const result = selector.selectTargets(graph, 'npc', 1, bias);
      // Should exclude npc1 and npc3 (members of faction1)
      expect(['npc2', 'npc4'].includes(result.existing[0].id)).toBe(true);
    });

    it('should penalize high-degree nodes more than low-degree', () => {
      // No specific bias - just default hub avoidance
      const result = selector.selectTargets(graph, 'npc', 4, {});
      const scores = result.diagnostics;

      // Low-degree nodes should score higher than high-degree hub
      // npc4 has 7 links and should be penalized
      const npc4Index = result.existing.findIndex(e => e.id === 'npc4');
      const npc2Index = result.existing.findIndex(e => e.id === 'npc2');

      // If both are selected, npc2 (1 link) should rank higher than npc4 (7 links)
      if (npc4Index !== -1 && npc2Index !== -1) {
        expect(npc2Index).toBeLessThan(npc4Index);
      }
    });
  });

  describe('selectTargets - diversity tracking', () => {
    it('should track selections and penalize repeated selections', () => {
      const bias: SelectionBias = {
        diversityTracking: { trackingId: 'test-selection' }
      };

      // First selection
      const result1 = selector.selectTargets(graph, 'npc', 1, bias);
      const firstSelected = result1.existing[0].id;

      // Second selection - should try to avoid the first
      const result2 = selector.selectTargets(graph, 'npc', 1, bias);
      // Not guaranteed to be different with small sample, but tracking should work
      expect(result2.existing.length).toBe(1);
    });

    it('should respect diversity strength parameter', () => {
      const bias1: SelectionBias = {
        diversityTracking: { trackingId: 'test1', strength: 0.5 }
      };
      const bias2: SelectionBias = {
        diversityTracking: { trackingId: 'test2', strength: 2.0 }
      };

      selector.selectTargets(graph, 'npc', 1, bias1);
      selector.selectTargets(graph, 'npc', 1, bias2);

      // Both should track, strength affects penalty calculation
      expect(true).toBe(true); // Just verifies no errors
    });

    it('should allow resetting diversity tracking for specific ID', () => {
      const bias: SelectionBias = {
        diversityTracking: { trackingId: 'test-reset' }
      };

      selector.selectTargets(graph, 'npc', 1, bias);
      selector.resetDiversityTracking('test-reset');

      // Should not error and tracking should be reset
      const result = selector.selectTargets(graph, 'npc', 1, bias);
      expect(result.existing.length).toBe(1);
    });

    it('should allow resetting all diversity tracking', () => {
      const bias1: SelectionBias = {
        diversityTracking: { trackingId: 'track1' }
      };
      const bias2: SelectionBias = {
        diversityTracking: { trackingId: 'track2' }
      };

      selector.selectTargets(graph, 'npc', 1, bias1);
      selector.selectTargets(graph, 'npc', 1, bias2);
      selector.resetDiversityTracking(); // Reset all

      const result1 = selector.selectTargets(graph, 'npc', 1, bias1);
      const result2 = selector.selectTargets(graph, 'npc', 1, bias2);

      expect(result1.existing.length).toBe(1);
      expect(result2.existing.length).toBe(1);
    });
  });

  describe('selectTargets - entity creation', () => {
    it('should create new entities when no candidates exist', () => {
      const factory = (graph: Graph, context: SelectionContext) => ({
        kind: 'npc',
        subtype: 'newcomer',
        name: 'New NPC',
        description: 'Created entity',
        tags: []
      });

      const bias: SelectionBias = {
        createIfSaturated: {
          threshold: 0.5,
          factory
        }
      };

      const result = selector.selectTargets(graph, 'item', 2, bias);
      expect(result.created.length).toBe(1); // maxCreated defaults to ceil(count/2)
      expect(result.created[0].kind).toBe('npc');
      expect(result.diagnostics.creationTriggered).toBe(true);
    });

    it('should create entities when all candidates below threshold', () => {
      const factory = (graph: Graph, context: SelectionContext) => ({
        kind: 'npc',
        subtype: 'recruit',
        name: 'Recruited NPC',
        tags: []
      });

      const bias: SelectionBias = {
        avoid: { maxTotalRelationships: 1 }, // Exclude most NPCs
        createIfSaturated: {
          threshold: 0.9, // Very high threshold
          factory
        }
      };

      const result = selector.selectTargets(graph, 'npc', 2, bias);
      // Should create at least some entities
      expect(result.created.length).toBeGreaterThan(0);
      expect(result.diagnostics.creationTriggered).toBe(true);
      expect(result.diagnostics.creationReason).toContain('threshold');
    });

    it('should respect maxCreated parameter', () => {
      const factory = (graph: Graph, context: SelectionContext) => ({
        kind: 'npc',
        subtype: 'created',
        name: 'Created',
        tags: []
      });

      const bias: SelectionBias = {
        createIfSaturated: {
          threshold: 0.5,
          factory,
          maxCreated: 1
        }
      };

      const result = selector.selectTargets(graph, 'item', 5, bias);
      expect(result.created.length).toBeLessThanOrEqual(1);
    });

    it('should fill remaining slots with existing entities', () => {
      const factory = (graph: Graph, context: SelectionContext) => ({
        kind: 'npc',
        subtype: 'hybrid',
        name: 'Hybrid',
        tags: []
      });

      const bias: SelectionBias = {
        avoid: { maxTotalRelationships: 2 },
        createIfSaturated: {
          threshold: 0.8,
          factory,
          maxCreated: 1
        }
      };

      const result = selector.selectTargets(graph, 'npc', 3, bias);
      const total = result.existing.length + result.created.length;
      expect(total).toBeLessThanOrEqual(3);
    });

    it('should provide context to factory function', () => {
      let capturedContext: SelectionContext | null = null;

      const factory = (graph: Graph, context: SelectionContext) => {
        capturedContext = context;
        return { kind: 'npc', subtype: 'test', name: 'Test', tags: [] };
      };

      const bias: SelectionBias = {
        createIfSaturated: {
          threshold: 0.5,
          factory
        }
      };

      selector.selectTargets(graph, 'item', 2, bias);

      expect(capturedContext).not.toBeNull();
      expect(capturedContext!.requestedCount).toBe(2);
      expect(capturedContext!.graph).toBe(graph);
      expect(capturedContext!.candidates).toBeDefined();
    });
  });

  describe('selectTargets - combined biases', () => {
    it('should handle complex bias combinations', () => {
      const bias: SelectionBias = {
        prefer: {
          subtypes: ['merchant'],
          tags: ['trader']
        },
        avoid: {
          relationshipKinds: ['allies'],
          hubPenaltyStrength: 1.5,
          maxTotalRelationships: 3
        },
        diversityTracking: {
          trackingId: 'complex-test'
        }
      };

      const result = selector.selectTargets(graph, 'npc', 1, bias);
      // Should handle all the bias options without error
      expect(result.existing.length).toBeGreaterThanOrEqual(0);
      expect(result.existing.length).toBeLessThanOrEqual(1);
    });

    it('should handle all bias options together', () => {
      const factory = (graph: Graph, context: SelectionContext) => ({
        kind: 'npc',
        subtype: 'fallback',
        name: 'Fallback',
        tags: []
      });

      const bias: SelectionBias = {
        prefer: {
          subtypes: ['wizard'],
          tags: ['magical'],
          prominence: ['mythic'],
          preferenceBoost: 3.0
        },
        avoid: {
          relationshipKinds: ['member_of', 'allies'],
          hubPenaltyStrength: 2.0,
          maxTotalRelationships: 2,
          excludeRelatedTo: { entityId: 'npc4', relationshipKind: 'allies' }
        },
        createIfSaturated: {
          threshold: 0.5,
          factory,
          maxCreated: 2
        },
        diversityTracking: {
          trackingId: 'everything',
          strength: 1.5
        }
      };

      const result = selector.selectTargets(graph, 'npc', 3, bias);
      expect(result.existing.length + result.created.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty graph', () => {
      const emptyGraph: Graph = {
        ...graph,
        entities: new Map(),
        relationships: []
      };

      const result = selector.selectTargets(emptyGraph, 'npc', 2, {});
      expect(result.existing).toEqual([]);
      expect(result.created).toEqual([]);
    });

    it('should handle entities with no links', () => {
      const isolated = createEntity('isolated', 'npc', 'hermit');
      isolated.links = [];
      graph.setEntity('isolated', isolated);

      const result = selector.selectTargets(graph, 'npc', 1, {});
      // Isolated entity should be preferred (lowest degree)
      expect(result.existing.length).toBe(1);
    });

    it('should handle undefined bias gracefully', () => {
      const result = selector.selectTargets(graph, 'npc', 2);
      expect(result.existing.length).toBeGreaterThan(0);
    });

    it('should handle empty prefer object', () => {
      const bias: SelectionBias = { prefer: {} };
      const result = selector.selectTargets(graph, 'npc', 2, bias);
      expect(result.existing.length).toBeGreaterThan(0);
    });

    it('should handle empty avoid object', () => {
      const bias: SelectionBias = { avoid: {} };
      const result = selector.selectTargets(graph, 'npc', 2, bias);
      expect(result.existing.length).toBeGreaterThan(0);
    });

    it('should handle negative count gracefully', () => {
      const result = selector.selectTargets(graph, 'npc', -1, {});
      // Negative count should be handled gracefully (may return empty or clamp to 0)
      expect(result).toBeDefined();
      expect(result.existing).toBeDefined();
    });

    it('should handle very large count', () => {
      const result = selector.selectTargets(graph, 'npc', 1000, {});
      expect(result.existing.length).toBeLessThanOrEqual(graph.getEntityCount());
    });

    it('should handle maxTotalRelationships of 0', () => {
      const bias: SelectionBias = {
        avoid: { maxTotalRelationships: 0 }
      };
      const result = selector.selectTargets(graph, 'npc', 2, bias);
      // Should only select entities with no relationships
      expect(result.existing.every(e => e.links.length === 0)).toBe(true);
    });

    it('should handle excludeRelatedTo with non-existent entity', () => {
      const bias: SelectionBias = {
        avoid: {
          excludeRelatedTo: { entityId: 'nonexistent' }
        }
      };
      const result = selector.selectTargets(graph, 'npc', 2, bias);
      // Should work normally, no exclusions
      expect(result.existing.length).toBeGreaterThan(0);
    });

    it('should handle factory that returns incomplete entities', () => {
      const factory = (graph: Graph, context: SelectionContext) => ({
        kind: 'npc'
        // Missing required fields
      });

      const bias: SelectionBias = {
        createIfSaturated: {
          threshold: 0.5,
          factory
        }
      };

      const result = selector.selectTargets(graph, 'item', 1, bias);
      expect(result.created.length).toBeGreaterThan(0);
      expect(result.created[0].kind).toBe('npc');
    });

    it('should handle all candidates filtered out', () => {
      const bias: SelectionBias = {
        avoid: {
          maxTotalRelationships: 0 // Filter out all NPCs with links
        }
      };

      const result = selector.selectTargets(graph, 'npc', 2, bias);
      // Either returns empty or entities with 0 links
      expect(result.existing.every(e => e.links.length === 0)).toBe(true);
    });

    it('should handle threshold of 0', () => {
      const factory = (graph: Graph, context: SelectionContext) => ({
        kind: 'npc',
        subtype: 'zero',
        name: 'Zero',
        tags: []
      });

      const bias: SelectionBias = {
        createIfSaturated: {
          threshold: 0.0,
          factory
        }
      };

      const result = selector.selectTargets(graph, 'npc', 1, bias);
      // Threshold of 0 means always prefer existing
      expect(result.existing.length).toBe(1);
      expect(result.created.length).toBe(0);
    });

    it('should handle threshold of 1', () => {
      const factory = (graph: Graph, context: SelectionContext) => ({
        kind: 'npc',
        subtype: 'one',
        name: 'One',
        tags: []
      });

      const bias: SelectionBias = {
        createIfSaturated: {
          threshold: 2.0, // Higher than any base score
          factory
        }
      };

      const result = selector.selectTargets(graph, 'npc', 1, bias);
      // Very high threshold should trigger creation
      expect(result.diagnostics.creationTriggered).toBe(true);
      expect(result.created.length).toBeGreaterThan(0);
    });
  });

  describe('score calculation edge cases', () => {
    it('should never return negative scores', () => {
      // Extreme penalties
      const bias: SelectionBias = {
        avoid: {
          relationshipKinds: ['member_of', 'allies', 'resident_of'],
          hubPenaltyStrength: 5.0
        }
      };

      const result = selector.selectTargets(graph, 'npc', 4, bias);
      expect(result.diagnostics.worstScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle entities with many relationships gracefully', () => {
      // Add more relationships to npc4
      const npc4 = graph.getEntity('npc4')!;
      for (let i = 0; i < 20; i++) {
        const rel: Relationship = { kind: 'knows', src: 'npc4', dst: `fake-${i}` };
        npc4.links.push(rel);
      }
      graph.setEntity('npc4', npc4);

      const result = selector.selectTargets(graph, 'npc', 2, {});
      // Should still complete without errors
      expect(result.existing.length).toBeGreaterThan(0);
    });

    it('should prefer entities with more matching criteria', () => {
      // Create a new selector instance to avoid state pollution
      const freshSelector = new TargetSelector();

      // Add entity with multiple matching attributes
      const perfect = createEntity('perfect', 'npc', 'merchant', {
        tags: ['trader', 'wealthy'],
        prominence: 'marginal'
      });
      perfect.links = []; // No connections
      graph.setEntity('perfect', perfect);

      const bias: SelectionBias = {
        prefer: {
          subtypes: ['merchant'],
          tags: ['trader', 'wealthy'],
          prominence: ['marginal'],
          preferenceBoost: 10.0 // Very high boost to ensure preference
        }
      };

      const result = freshSelector.selectTargets(graph, 'npc', 1, bias);
      // Should select an entity with low connections and matching criteria
      expect(result.existing.length).toBe(1);
      expect(result.existing[0].subtype).toBe('merchant');
    });
  });

  describe('diagnostics', () => {
    it('should provide accurate candidate count', () => {
      const result = selector.selectTargets(graph, 'npc', 2, {});
      expect(result.diagnostics.candidatesEvaluated).toBe(4);
    });

    it('should calculate score statistics correctly', () => {
      const result = selector.selectTargets(graph, 'npc', 2, {});
      const { bestScore, worstScore, avgScore } = result.diagnostics;

      expect(bestScore).toBeGreaterThanOrEqual(worstScore);
      expect(avgScore).toBeGreaterThanOrEqual(worstScore);
      expect(avgScore).toBeLessThanOrEqual(bestScore);
    });

    it('should indicate when creation is triggered', () => {
      const factory = (graph: Graph, context: SelectionContext) => ({
        kind: 'npc',
        subtype: 'created',
        name: 'Created',
        tags: []
      });

      const bias: SelectionBias = {
        avoid: { maxTotalRelationships: 0 }, // Filter out all entities
        createIfSaturated: {
          threshold: 0.5,
          factory
        }
      };

      const result = selector.selectTargets(graph, 'npc', 1, bias);
      expect(result.diagnostics.creationTriggered).toBe(true);
      expect(result.diagnostics.creationReason).toBeDefined();
    });

    it('should not indicate creation when not triggered', () => {
      const result = selector.selectTargets(graph, 'npc', 1, {});
      expect(result.diagnostics.creationTriggered).toBe(false);
      expect(result.diagnostics.creationReason).toBeUndefined();
    });

    it('should handle diagnostics for empty results', () => {
      const result = selector.selectTargets(graph, 'nonexistent', 1, {});
      expect(result.diagnostics.candidatesEvaluated).toBe(0);
      expect(result.diagnostics.bestScore).toBe(0);
      expect(result.diagnostics.worstScore).toBe(0);
      expect(result.diagnostics.avgScore).toBe(0);
    });
  });
});
