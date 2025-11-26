// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { relationshipCulling } from '../../systems/relationshipCulling';
import { Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';

describe('relationshipCulling', () => {
  let graph: Graph;

  const createEntity = (id: string, createdAt: number = 0): HardState => ({
    id,
    kind: 'npc',
    subtype: 'test',
    name: `Entity ${id}`,
    description: 'Test entity',
    status: 'active',
    prominence: 'marginal',
    tags: [],
    links: [],
    createdAt,
    updatedAt: createdAt,
  });

  const createRelationship = (src: string, dst: string, kind: string, strength?: number): Relationship => {
    const rel: Relationship = { kind, src, dst };
    if (strength !== undefined) rel.strength = strength;
    return rel;
  };

  beforeEach(() => {
    const entities = new Map<string, HardState>();
    entities.set('npc1', createEntity('npc1', 0));
    entities.set('npc2', createEntity('npc2', 0));
    entities.set('npc3', createEntity('npc3', 0));
    entities.set('npc4', createEntity('npc4', 0));

    const relationships: Relationship[] = [
      createRelationship('npc1', 'npc2', 'allies', 0.8), // Strong
      createRelationship('npc1', 'npc3', 'knows', 0.1), // Weak
      createRelationship('npc2', 'npc3', 'trades_with', 0.3), // Medium
      createRelationship('npc3', 'npc4', 'dislikes', 0.05), // Very weak
    ];

    // Sync links
    relationships.forEach(rel => {
      const src = entities.get(rel.src);
      const dst = entities.get(rel.dst);
      if (src) src.links.push(rel);
      if (dst) dst.links.push(rel);
    });

    graph = {
      entities,
      relationships,
      tick: 50,
      currentEra: {
        id: 'test',
        name: 'Test Era',
        description: 'Test',
        templateWeights: {},
        systemModifiers: {},
        pressureModifiers: {},
      },
      pressures: new Map(),
      relationshipCooldowns: new Map(),
      config: {
        domain: {
          getProtectedRelationshipKinds: () => ['resident_of', 'member_of'],
          getImmutableRelationshipKinds: () => ['located_at'],
        },
      } as any,
      discoveryState: {} as any,
      history: [],
      loreIndex: {} as any,
      nameLogger: {} as any,
      tagRegistry: {} as any,
      loreValidator: {} as any,
      statistics: {} as any,
      enrichmentService: {} as any,
    };
  });

  describe('metadata', () => {
    it('should have correct id and name', () => {
      expect(relationshipCulling.id).toBe('relationship_culling');
      expect(relationshipCulling.name).toBe('Relationship Pruning');
    });

    it('should have metadata defined', () => {
      expect(relationshipCulling.metadata).toBeDefined();
      expect(relationshipCulling.metadata!.produces).toBeDefined();
      expect(relationshipCulling.metadata!.effects).toBeDefined();
      expect(relationshipCulling.metadata!.parameters).toBeDefined();
    });

    it('should have parameters with correct defaults', () => {
      const params = relationshipCulling.metadata!.parameters!;
      expect(params.cullThreshold).toBeDefined();
      expect(params.cullThreshold!.value).toBe(0.15);
      expect(params.cullFrequency).toBeDefined();
      expect(params.gracePeriod).toBeDefined();
    });
  });

  describe('culling behavior', () => {
    it('should remove weak relationships below threshold', () => {
      graph.tick = 50; // Ensure past grace period
      const result = relationshipCulling.apply(graph);

      // Should remove relationships with strength < 0.15
      expect(graph.relationships.length).toBeLessThan(4);
      expect(graph.relationships.some(r => r.kind === 'dislikes')).toBe(false); // 0.05 strength
      expect(graph.relationships.some(r => r.kind === 'knows')).toBe(false); // 0.1 strength
    });

    it('should keep strong relationships', () => {
      graph.tick = 50;
      relationshipCulling.apply(graph);

      // Should keep allies (0.8 strength)
      expect(graph.relationships.some(r => r.kind === 'allies')).toBe(true);
    });

    it('should keep medium-strength relationships above threshold', () => {
      graph.tick = 50;
      relationshipCulling.apply(graph);

      // Should keep trades_with (0.3 strength > 0.15)
      expect(graph.relationships.some(r => r.kind === 'trades_with')).toBe(true);
    });

    it('should only run on cull frequency ticks', () => {
      graph.tick = 5; // Not a multiple of default frequency (10)
      const initialCount = graph.relationships.length;

      const result = relationshipCulling.apply(graph);

      expect(graph.relationships.length).toBe(initialCount);
      expect(result.description).toContain('dormant');
    });

    it('should run when tick is multiple of cull frequency', () => {
      graph.tick = 50; // Multiple of 10
      const initialCount = graph.relationships.length;

      relationshipCulling.apply(graph);

      // Should have culled some weak relationships
      expect(graph.relationships.length).toBeLessThan(initialCount);
    });

    it('should respect grace period for young relationships', () => {
      // Create entities and relationships just 5 ticks ago
      const entities = new Map<string, HardState>();
      entities.set('young1', createEntity('young1', 5));
      entities.set('young2', createEntity('young2', 5));

      const weakRel = createRelationship('young1', 'young2', 'fragile', 0.05);
      entities.get('young1')!.links.push(weakRel);
      entities.get('young2')!.links.push(weakRel);

      graph.entities = entities;
      graph.relationships = [weakRel];
      graph.tick = 10; // Only 5 ticks after creation (grace period default is 20)

      relationshipCulling.apply(graph);

      // Should keep the weak relationship due to grace period
      expect(graph.relationships.length).toBe(1);
    });

    it('should cull weak relationships after grace period expires', () => {
      const entities = new Map<string, HardState>();
      entities.set('old1', createEntity('old1', 0));
      entities.set('old2', createEntity('old2', 0));

      const weakRel = createRelationship('old1', 'old2', 'fragile', 0.05);
      entities.get('old1')!.links.push(weakRel);
      entities.get('old2')!.links.push(weakRel);

      graph.entities = entities;
      graph.relationships = [weakRel];
      graph.tick = 50; // Well past grace period

      relationshipCulling.apply(graph);

      // Should cull the weak relationship
      expect(graph.relationships.length).toBe(0);
    });
  });

  describe('protected relationships', () => {
    it('should never cull protected relationship kinds', () => {
      const protectedRel = createRelationship('npc1', 'npc2', 'member_of', 0.05); // Very weak but protected
      protectedRel.strength = 0.05;
      graph.entities.get('npc1')!.links.push(protectedRel);
      graph.entities.get('npc2')!.links.push(protectedRel);
      graph.relationships.push(protectedRel);

      graph.tick = 50;
      relationshipCulling.apply(graph);

      // Should keep protected relationship even though it's weak
      expect(graph.relationships.some(r => r.kind === 'member_of')).toBe(true);
    });

    it('should track violations for weak protected relationships', () => {
      const protectedRel = createRelationship('npc1', 'npc2', 'member_of', 0.05);
      graph.entities.get('npc1')!.links.push(protectedRel);
      graph.entities.get('npc2')!.links.push(protectedRel);
      graph.relationships.push(protectedRel);

      graph.tick = 50;
      relationshipCulling.apply(graph);

      expect(graph.protectedRelationshipViolations).toBeDefined();
      expect(graph.protectedRelationshipViolations!.length).toBeGreaterThan(0);
    });

    it('should never cull immutable relationship kinds', () => {
      const immutableRel = createRelationship('npc1', 'npc2', 'located_at', 0.01); // Extremely weak but immutable
      graph.entities.get('npc1')!.links.push(immutableRel);
      graph.entities.get('npc2')!.links.push(immutableRel);
      graph.relationships.push(immutableRel);

      graph.tick = 50;
      relationshipCulling.apply(graph);

      // Should keep immutable relationship
      expect(graph.relationships.some(r => r.kind === 'located_at')).toBe(true);
    });
  });

  describe('entity link synchronization', () => {
    it('should remove culled relationships from entity links', () => {
      graph.tick = 50;
      const npc1 = graph.entities.get('npc1')!;
      const initialLinkCount = npc1.links.length;

      relationshipCulling.apply(graph);

      // npc1's weak 'knows' relationship should be removed from links
      expect(npc1.links.length).toBeLessThan(initialLinkCount);
      expect(npc1.links.some(l => l.kind === 'knows' && l.strength === 0.1)).toBe(false);
    });

    it('should update entity updatedAt timestamp', () => {
      graph.tick = 50;
      const npc1 = graph.entities.get('npc1')!;
      npc1.updatedAt = 0;

      relationshipCulling.apply(graph);

      // Entity should be updated if its link was culled
      if (npc1.links.length < 2) { // Had 2 links initially
        expect(npc1.updatedAt).toBe(50);
      }
    });
  });

  describe('broken references', () => {
    it('should remove relationships to non-existent entities', () => {
      const brokenRel = createRelationship('npc1', 'nonexistent', 'knows', 0.9);
      graph.relationships.push(brokenRel);

      graph.tick = 50;
      const initialCount = graph.relationships.length;

      relationshipCulling.apply(graph);

      // Should remove relationship to non-existent entity
      expect(graph.relationships.length).toBeLessThan(initialCount);
      expect(graph.relationships.some(r => r.dst === 'nonexistent')).toBe(false);
    });

    it('should handle missing source entity', () => {
      const brokenRel = createRelationship('nonexistent', 'npc1', 'knows', 0.9);
      graph.relationships.push(brokenRel);

      graph.tick = 50;
      relationshipCulling.apply(graph);

      expect(graph.relationships.some(r => r.src === 'nonexistent')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle relationships without strength field', () => {
      const noStrengthRel = createRelationship('npc1', 'npc2', 'mysterious');
      // No strength field - should default to 0.5
      graph.entities.get('npc1')!.links.push(noStrengthRel);
      graph.entities.get('npc2')!.links.push(noStrengthRel);
      graph.relationships.push(noStrengthRel);

      graph.tick = 50;
      relationshipCulling.apply(graph);

      // Default 0.5 strength > 0.15 threshold, should be kept
      expect(graph.relationships.some(r => r.kind === 'mysterious')).toBe(true);
    });

    it('should handle empty relationships array', () => {
      graph.relationships = [];
      graph.tick = 50;

      const result = relationshipCulling.apply(graph);

      expect(result).toBeDefined();
      expect(graph.relationships.length).toBe(0);
    });

    it('should handle graph with no protected relationship kinds', () => {
      graph.config.domain.getProtectedRelationshipKinds = () => [];
      graph.config.domain.getImmutableRelationshipKinds = () => [];

      graph.tick = 50;
      relationshipCulling.apply(graph);

      // Should still work, culling weak relationships
      expect(graph.relationships.some(r => r.strength! < 0.15)).toBe(false);
    });

    it('should handle tick 0', () => {
      graph.tick = 0;

      const result = relationshipCulling.apply(graph);

      // Tick 0 is multiple of 10, should run
      expect(result.description).not.toContain('dormant');
    });

    it('should handle very high strength values', () => {
      const superStrong = createRelationship('npc1', 'npc2', 'unbreakable', 999.0);
      graph.entities.get('npc1')!.links.push(superStrong);
      graph.entities.get('npc2')!.links.push(superStrong);
      graph.relationships.push(superStrong);

      graph.tick = 50;
      relationshipCulling.apply(graph);

      expect(graph.relationships.some(r => r.kind === 'unbreakable')).toBe(true);
    });

    it('should handle negative strength values', () => {
      const negative = createRelationship('npc1', 'npc2', 'negative', -0.5);
      graph.entities.get('npc1')!.links.push(negative);
      graph.entities.get('npc2')!.links.push(negative);
      graph.relationships.push(negative);

      graph.tick = 50;
      relationshipCulling.apply(graph);

      // Negative strength < 0.15, should be culled
      expect(graph.relationships.some(r => r.kind === 'negative')).toBe(false);
    });
  });

  describe('custom modifier', () => {
    it('should accept modifier parameter', () => {
      graph.tick = 50;
      const result = relationshipCulling.apply(graph, 2.0);

      // Modifier doesn't affect culling logic currently, but shouldn't error
      expect(result).toBeDefined();
    });

    it('should work with zero modifier', () => {
      graph.tick = 50;
      const result = relationshipCulling.apply(graph, 0);

      expect(result).toBeDefined();
    });
  });

  describe('return value', () => {
    it('should return proper SystemResult structure', () => {
      graph.tick = 50;
      const result = relationshipCulling.apply(graph);

      expect(result).toHaveProperty('relationshipsAdded');
      expect(result).toHaveProperty('entitiesModified');
      expect(result).toHaveProperty('pressureChanges');
      expect(result).toHaveProperty('description');

      expect(Array.isArray(result.relationshipsAdded)).toBe(true);
      expect(Array.isArray(result.entitiesModified)).toBe(true);
      expect(typeof result.pressureChanges).toBe('object');
      expect(typeof result.description).toBe('string');
    });

    it('should describe culling action when relationships are removed', () => {
      graph.tick = 50;
      const result = relationshipCulling.apply(graph);

      if (graph.relationships.length < 4) {
        expect(result.description).toContain('fade');
        expect(result.description).toMatch(/\d+/); // Should contain numbers
      }
    });

    it('should describe when no culling occurs', () => {
      // Remove all weak relationships first
      graph.relationships = graph.relationships.filter(r => (r.strength ?? 0.5) >= 0.15);
      graph.tick = 50;

      const result = relationshipCulling.apply(graph);

      expect(result.description).toContain('above threshold');
    });
  });
});
