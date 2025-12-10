import { describe, it, expect } from 'vitest';
import {
  validateConnectedEntities,
  validateNPCStructure,
  validateRelationshipIntegrity,
  validateLinkSync,
  validateWorld,
  ValidationResult,
  ValidationReport
} from '../../engine/validators';
import { Graph } from '../../engine/types';
import { HardState, Relationship } from '../../core/worldTypes';

// Helper function to create a mock graph with the new Graph API methods
function createMockGraph(overrides: Partial<Graph> = {}): Graph {
  const _entities = new Map<string, HardState>();
  let _relationships: Relationship[] = [];

  return {
    tick: overrides.tick ?? 10,
    currentEra: overrides.currentEra ?? {
      id: 'test-era',
      name: 'Test Era',
      description: 'Test',
      templateWeights: {},
      systemModifiers: {},
    },
    pressures: overrides.pressures ?? new Map<string, number>(),
    history: overrides.history ?? [],
    relationshipCooldowns: overrides.relationshipCooldowns ?? new Map(),
    // loreRecords/loreIndex moved to @illuminator
    rateLimitState: overrides.rateLimitState ?? {
      currentThreshold: 1.0,
      lastCreationTick: 0,
      creationsThisEpoch: 0
    },
    config: overrides.config ?? {
      domain: {
        schema: {},
        templates: [],
        systems: [],
        eras: [],
        pressures: [],
        initialState: [],
        nameGenerator: { generate: () => 'Test Name' },
        actionDomains: [],
        metaEntityConfigs: []
      },
      targetEntitiesPerKind: 30,
      ticksPerEpoch: 10,
      maxTicks: 500,
      llmEnrichment: {
        enabled: false,
        batchSize: 5,
        mode: 'off' as const
      }
    } as any,
    growthMetrics: overrides.growthMetrics ?? {
      relationshipsPerTick: [],
      averageGrowthRate: 0
    },
    subtypeMetrics: overrides.subtypeMetrics,
    protectedRelationshipViolations: overrides.protectedRelationshipViolations,

    // Entity read methods
    getEntity(id: string) { return _entities.get(id); },
    hasEntity(id: string) { return _entities.has(id); },
    getEntityCount() { return _entities.size; },
    getEntities() { return Array.from(_entities.values()); },
    getEntityIds() { return Array.from(_entities.keys()); },
    forEachEntity(cb: (e: HardState, id: string) => void) { _entities.forEach(cb); },
    findEntities(criteria: any) {
      return Array.from(_entities.values()).filter(e => {
        if (criteria.kind && e.kind !== criteria.kind) return false;
        if (criteria.subtype && e.subtype !== criteria.subtype) return false;
        if (criteria.status && e.status !== criteria.status) return false;
        return true;
      });
    },
    getEntitiesByKind(kind: string) { return Array.from(_entities.values()).filter(e => e.kind === kind); },
    getConnectedEntities(id: string) { return []; },

    // Entity mutation (framework-aware)
    createEntity(settings: any): string {
      const id = `${settings.kind}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const tags = settings.tags || {};
      const name = settings.name || `Test ${settings.kind}`;
      const entity: HardState = {
        id, kind: settings.kind, subtype: settings.subtype, name,
        description: settings.description || '', status: settings.status || 'active',
        prominence: settings.prominence || 'marginal', culture: settings.culture || 'world',
        tags, links: [], coordinates: settings.coordinates, createdAt: 10, updatedAt: 10
      };
      _entities.set(id, entity);
      return id;
    },
    updateEntity(id: string, changes: Partial<HardState>) { const e = _entities.get(id); if(e) Object.assign(e, changes); return !!e; },
    deleteEntity(id: string) { return _entities.delete(id); },
    _loadEntity(id: string, entity: HardState) { _entities.set(id, entity); },

    // Relationship read methods
    getRelationships() { return _relationships; },
    getRelationshipCount() { return _relationships.length; },
    findRelationships(criteria: any) {
      return _relationships.filter(r => {
        if (criteria.kind && r.kind !== criteria.kind) return false;
        if (criteria.src && r.src !== criteria.src) return false;
        if (criteria.dst && r.dst !== criteria.dst) return false;
        return true;
      });
    },
    getEntityRelationships(id: string, direction?: 'src' | 'dst' | 'both') {
      return _relationships.filter(r => {
        if (direction === 'src') return r.src === id;
        if (direction === 'dst') return r.dst === id;
        return r.src === id || r.dst === id;
      });
    },
    hasRelationship(src: string, dst: string, kind?: string) {
      return _relationships.some(r => r.src === src && r.dst === dst && (!kind || r.kind === kind));
    },

    // Relationship mutation (framework-aware)
    addRelationship(kind: string, srcId: string, dstId: string, strength?: number, distance?: number, category?: string): boolean {
      const exists = _relationships.some(r => r.src === srcId && r.dst === dstId && r.kind === kind);
      if (exists) return false;
      _relationships.push({ kind, src: srcId, dst: dstId, strength: strength ?? 0.5, distance, category, status: 'active' });
      return true;
    },
    removeRelationship(src: string, dst: string, kind: string) {
      const idx = _relationships.findIndex(r => r.src === src && r.dst === dst && r.kind === kind);
      if(idx >= 0) { _relationships.splice(idx, 1); return true; }
      return false;
    },
    _setRelationships(rels: Relationship[]) { _relationships = rels; },
    // Test helper: load relationship directly without validation
    _loadRelationship(rel: Relationship) { _relationships.push(rel); }
  } as Graph;
}

// Helper function to create a mock entity
function createMockEntity(overrides: Partial<HardState> = {}): HardState {
  return {
    id: 'test-id',
    kind: 'npc',
    subtype: 'merchant',
    name: 'Test Entity',
    description: 'A test entity',
    status: 'alive',
    prominence: 'marginal',
    culture: 'world',
    tags: [],
    links: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides
  };
}

describe('Connected Entities Validation', () => {
  describe('validateConnectedEntities', () => {
    it('should pass when all entities are connected', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1', links: [] });
      const entity2 = createMockEntity({ id: 'e2', links: [] });

      graph._loadEntity(entity1.id, entity1);
      graph._loadEntity(entity2.id, entity2);

      // Add relationships
      const rel: Relationship = { kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 };
      graph._loadRelationship(rel);
      entity1.links.push(rel);

      const result = validateConnectedEntities(graph);
      expect(result.passed).toBe(true);
      expect(result.failureCount).toBe(0);
      expect(result.details).toContain('All entities have at least one connection');
    });

    it('should fail when entities have no connections', () => {
      const graph = createMockGraph();
      const isolated1 = createMockEntity({ id: 'e1', name: 'Isolated 1', links: [] });
      const isolated2 = createMockEntity({ id: 'e2', name: 'Isolated 2', links: [] });

      graph._loadEntity(isolated1.id, isolated1);
      graph._loadEntity(isolated2.id, isolated2);

      const result = validateConnectedEntities(graph);
      expect(result.passed).toBe(false);
      expect(result.failureCount).toBe(2);
      expect(result.details).toContain('2 entities have no connections');
      expect(result.failedEntities).toHaveLength(2);
    });

    it('should detect incoming relationships (dst)', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1', links: [] });
      const entity2 = createMockEntity({ id: 'e2', links: [] }); // No outgoing, but has incoming

      graph._loadEntity(entity1.id, entity1);
      graph._loadEntity(entity2.id, entity2);

      // entity2 has incoming relationship
      const rel: Relationship = { kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 };
      graph._loadRelationship(rel);
      entity1.links.push(rel);

      const result = validateConnectedEntities(graph);
      expect(result.passed).toBe(true);
    });

    it('should group unconnected entities by kind:subtype', () => {
      const graph = createMockGraph();
      const npc1 = createMockEntity({ id: 'e1', kind: 'npc', subtype: 'merchant', links: [] });
      const npc2 = createMockEntity({ id: 'e2', kind: 'npc', subtype: 'merchant', links: [] });
      const location1 = createMockEntity({ id: 'e3', kind: 'location', subtype: 'colony', links: [] });

      graph._loadEntity(npc1.id, npc1);
      graph._loadEntity(npc2.id, npc2);
      graph._loadEntity(location1.id, location1);

      const result = validateConnectedEntities(graph);
      expect(result.details).toContain('npc:merchant: 2');
      expect(result.details).toContain('location:colony: 1');
    });

    it('should include sample unconnected entities', () => {
      const graph = createMockGraph();
      const entity = createMockEntity({ id: 'e1', name: 'Lonely Entity', links: [], createdAt: 50 });
      graph._loadEntity(entity.id, entity);

      const result = validateConnectedEntities(graph);
      expect(result.details).toContain('Sample unconnected entities');
      expect(result.details).toContain('Lonely Entity');
      expect(result.details).toContain('created tick 50');
    });

    it('should pass for empty graph', () => {
      const graph = createMockGraph();
      const result = validateConnectedEntities(graph);
      expect(result.passed).toBe(true);
      expect(result.failureCount).toBe(0);
    });
  });
});

describe('NPC Structure Validation', () => {
  describe('validateNPCStructure', () => {
    it('should pass when domain validation passes', () => {
      const graph = createMockGraph();
      graph.config.domain.validateEntityStructure = (entity: HardState) => ({
        valid: true,
        missing: []
      });

      const entity = createMockEntity({ id: 'e1' });
      graph._loadEntity(entity.id, entity);

      const result = validateNPCStructure(graph);
      expect(result.passed).toBe(true);
      expect(result.failureCount).toBe(0);
      expect(result.details).toContain('All entities have required relationships');
    });

    it('should fail when domain validation fails', () => {
      const graph = createMockGraph();
      graph.config.domain.validateEntityStructure = (entity: HardState) => ({
        valid: false,
        missing: ['resident_of']
      });

      const entity = createMockEntity({ id: 'e1', kind: 'npc', subtype: 'merchant' });
      graph._loadEntity(entity.id, entity);

      const result = validateNPCStructure(graph);
      expect(result.passed).toBe(false);
      expect(result.failureCount).toBe(1);
      expect(result.details).toContain('1 entities missing required relationships');
      expect(result.details).toContain('npc:merchant');
      expect(result.details).toContain('resident_of');
      expect(result.failedEntities).toHaveLength(1);
    });

    it('should skip when domain does not provide validation', () => {
      const graph = createMockGraph();
      // No validateEntityStructure function

      const entity = createMockEntity({ id: 'e1' });
      graph._loadEntity(entity.id, entity);

      const result = validateNPCStructure(graph);
      expect(result.passed).toBe(true);
      expect(result.failureCount).toBe(0);
    });

    it('should group missing relationships by kind:subtype', () => {
      const graph = createMockGraph();
      graph.config.domain.validateEntityStructure = (entity: HardState) => ({
        valid: false,
        missing: ['resident_of', 'member_of']
      });

      const npc1 = createMockEntity({ id: 'e1', kind: 'npc', subtype: 'merchant' });
      const npc2 = createMockEntity({ id: 'e2', kind: 'npc', subtype: 'merchant' });

      graph._loadEntity(npc1.id, npc1);
      graph._loadEntity(npc2.id, npc2);

      const result = validateNPCStructure(graph);
      expect(result.details).toContain('npc:merchant');
      expect(result.details).toContain('2 (missing resident_of)');
      expect(result.details).toContain('2 (missing member_of)');
    });

    it('should handle multiple entity kinds', () => {
      const graph = createMockGraph();
      graph.config.domain.validateEntityStructure = (entity: HardState) => {
        if (entity.kind === 'npc') {
          return { valid: false, missing: ['resident_of'] };
        }
        return { valid: true, missing: [] };
      };

      const npc = createMockEntity({ id: 'e1', kind: 'npc', subtype: 'merchant' });
      const location = createMockEntity({ id: 'e2', kind: 'location', subtype: 'colony' });

      graph._loadEntity(npc.id, npc);
      graph._loadEntity(location.id, location);

      const result = validateNPCStructure(graph);
      expect(result.failureCount).toBe(1);
      expect(result.failedEntities![0].id).toBe('e1');
    });
  });
});

describe('Relationship Integrity Validation', () => {
  describe('validateRelationshipIntegrity', () => {
    it('should pass when all relationships reference existing entities', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1' });
      const entity2 = createMockEntity({ id: 'e2' });

      graph._loadEntity(entity1.id, entity1);
      graph._loadEntity(entity2.id, entity2);

      graph._loadRelationship({
        kind: 'friend_of',
        src: 'e1',
        dst: 'e2',
        strength: 0.5
      });

      const result = validateRelationshipIntegrity(graph);
      expect(result.passed).toBe(true);
      expect(result.failureCount).toBe(0);
      expect(result.details).toContain('All relationships reference existing entities');
    });

    it('should fail when source entity is missing', () => {
      const graph = createMockGraph();
      const entity2 = createMockEntity({ id: 'e2', name: 'Existing' });

      graph._loadEntity(entity2.id, entity2);

      graph._loadRelationship({
        kind: 'friend_of',
        src: 'missing-e1',
        dst: 'e2',
        strength: 0.5
      });

      const result = validateRelationshipIntegrity(graph);
      expect(result.passed).toBe(false);
      expect(result.failureCount).toBe(1);
      expect(result.details).toContain('1 broken relationships');
      expect(result.details).toContain('src missing');
    });

    it('should fail when destination entity is missing', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1', name: 'Existing' });

      graph._loadEntity(entity1.id, entity1);

      graph._loadRelationship({
        kind: 'friend_of',
        src: 'e1',
        dst: 'missing-e2',
        strength: 0.5
      });

      const result = validateRelationshipIntegrity(graph);
      expect(result.passed).toBe(false);
      expect(result.failureCount).toBe(1);
      expect(result.details).toContain('dst missing');
    });

    it('should fail when both entities are missing', () => {
      const graph = createMockGraph();

      graph._loadRelationship({
        kind: 'friend_of',
        src: 'missing-e1',
        dst: 'missing-e2',
        strength: 0.5
      });

      const result = validateRelationshipIntegrity(graph);
      expect(result.passed).toBe(false);
      expect(result.details).toContain('src missing');
      expect(result.details).toContain('dst missing');
    });

    it('should truncate details for many broken relationships', () => {
      const graph = createMockGraph();

      // Add 15 broken relationships
      for (let i = 0; i < 15; i++) {
        graph._loadRelationship({
          kind: 'friend_of',
          src: `missing-${i}`,
          dst: `missing-${i + 1}`,
          strength: 0.5
        });
      }

      const result = validateRelationshipIntegrity(graph);
      expect(result.failureCount).toBe(15);
      expect(result.details).toContain('15 broken relationships');
      expect(result.details).toContain('... and 5 more');
    });

    it('should include relationship index and kind', () => {
      const graph = createMockGraph();

      graph._loadRelationship({
        kind: 'enemy_of',
        src: 'missing-e1',
        dst: 'missing-e2',
        strength: 0.7
      });

      const result = validateRelationshipIntegrity(graph);
      expect(result.details).toContain('[0]');
      expect(result.details).toContain('enemy_of');
    });

    it('should pass for empty graph', () => {
      const graph = createMockGraph();
      const result = validateRelationshipIntegrity(graph);
      expect(result.passed).toBe(true);
    });
  });
});

describe('Link Synchronization Validation', () => {
  describe('validateLinkSync', () => {
    it('should pass when links match relationships', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1', links: [] });
      const entity2 = createMockEntity({ id: 'e2', links: [] });

      graph._loadEntity(entity1.id, entity1);
      graph._loadEntity(entity2.id, entity2);

      const rel: Relationship = { kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 };
      graph._loadRelationship(rel);
      entity1.links.push(rel);

      const result = validateLinkSync(graph);
      expect(result.passed).toBe(true);
      expect(result.failureCount).toBe(0);
      expect(result.details).toContain('All entity links match relationships');
    });

    it('should fail when entity has more links than relationships', () => {
      const graph = createMockGraph();
      const entity = createMockEntity({
        id: 'e1',
        name: 'Mismatched Entity',
        links: [
          { kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 },
          { kind: 'friend_of', src: 'e1', dst: 'e3', strength: 0.5 }
        ]
      });

      graph._loadEntity(entity.id, entity);

      // Only one actual relationship
      graph._loadRelationship({
        kind: 'friend_of',
        src: 'e1',
        dst: 'e2',
        strength: 0.5
      });

      const result = validateLinkSync(graph);
      expect(result.passed).toBe(false);
      expect(result.failureCount).toBe(1);
      expect(result.details).toContain('1 entities with mismatched links');
      expect(result.details).toContain('Mismatched Entity');
      expect(result.details).toContain('2 in links array, 1 in relationships');
    });

    it('should fail when entity has fewer links than relationships', () => {
      const graph = createMockGraph();
      const entity = createMockEntity({
        id: 'e1',
        name: 'Entity',
        links: []
      });

      graph._loadEntity(entity.id, entity);

      // Two actual relationships
      graph._loadRelationship({
        kind: 'friend_of',
        src: 'e1',
        dst: 'e2',
        strength: 0.5
      });
      graph._loadRelationship({
        kind: 'friend_of',
        src: 'e1',
        dst: 'e3',
        strength: 0.5
      });

      const result = validateLinkSync(graph);
      expect(result.passed).toBe(false);
      expect(result.details).toContain('0 in links array, 2 in relationships');
    });

    it('should truncate details for many mismatches', () => {
      const graph = createMockGraph();

      // Add 15 entities with mismatches
      for (let i = 0; i < 15; i++) {
        const entity = createMockEntity({
          id: `e${i}`,
          name: `Entity ${i}`,
          links: [{ kind: 'friend_of', src: `e${i}`, dst: 'other', strength: 0.5 }]
        });
        graph._loadEntity(entity.id, entity);
        // No relationships added, so all will mismatch
      }

      const result = validateLinkSync(graph);
      expect(result.failureCount).toBe(15);
      expect(result.details).toContain('... and 5 more');
    });

    it('should ignore entities that are not src of relationships', () => {
      const graph = createMockGraph();
      const entity1 = createMockEntity({ id: 'e1', links: [] });
      const entity2 = createMockEntity({ id: 'e2', links: [] }); // dst only

      graph._loadEntity(entity1.id, entity1);
      graph._loadEntity(entity2.id, entity2);

      const rel: Relationship = { kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 };
      graph._loadRelationship(rel);
      entity1.links.push(rel);

      const result = validateLinkSync(graph);
      expect(result.passed).toBe(true);
    });

    it('should pass for empty graph', () => {
      const graph = createMockGraph();
      const result = validateLinkSync(graph);
      expect(result.passed).toBe(true);
    });
  });
});

// Lore Presence Validation moved to @illuminator

describe('Complete World Validation', () => {
  describe('validateWorld', () => {
    it('should run all validators', () => {
      const graph = createMockGraph();
      const report = validateWorld(graph);

      expect(report.totalChecks).toBe(4);
      expect(report.results).toHaveLength(4);
      expect(report.results[0].name).toBe('Connected Entities');
      expect(report.results[1].name).toBe('Entity Structure');
      expect(report.results[2].name).toBe('Relationship Integrity');
      expect(report.results[3].name).toBe('Link Synchronization');
      // Lore Presence moved to @illuminator
    });

    it('should count passed and failed checks', () => {
      const graph = createMockGraph();

      // Add valid entity with connections
      const entity1 = createMockEntity({ id: 'e1', links: [] });
      const entity2 = createMockEntity({ id: 'e2', links: [] });
      graph._loadEntity(entity1.id, entity1);
      graph._loadEntity(entity2.id, entity2);

      const rel: Relationship = { kind: 'friend_of', src: 'e1', dst: 'e2', strength: 0.5 };
      graph._loadRelationship(rel);
      entity1.links.push(rel);

      const report = validateWorld(graph);

      // All checks should pass for this simple valid graph
      expect(report.passed).toBeGreaterThanOrEqual(4); // At least most should pass
      expect(report.failed).toBeLessThanOrEqual(1); // At most one might fail
    });

    it('should report failures correctly', () => {
      const graph = createMockGraph();

      // Add broken relationship
      graph._loadRelationship({
        kind: 'friend_of',
        src: 'missing-e1',
        dst: 'missing-e2',
        strength: 0.5
      });

      const report = validateWorld(graph);

      expect(report.failed).toBeGreaterThanOrEqual(1);
      const failedResult = report.results.find(r => !r.passed);
      expect(failedResult).toBeDefined();
    });

    it('should pass for empty graph', () => {
      const graph = createMockGraph();
      const report = validateWorld(graph);

      // Empty graph should pass most checks (no violations)
      expect(report.passed).toBeGreaterThanOrEqual(4);
    });

    it('should return correct report structure', () => {
      const graph = createMockGraph();
      const report = validateWorld(graph);

      expect(report).toHaveProperty('totalChecks');
      expect(report).toHaveProperty('passed');
      expect(report).toHaveProperty('failed');
      expect(report).toHaveProperty('results');
      expect(Array.isArray(report.results)).toBe(true);

      report.results.forEach(result => {
        expect(result).toHaveProperty('name');
        expect(result).toHaveProperty('passed');
        expect(result).toHaveProperty('failureCount');
        expect(result).toHaveProperty('details');
        expect(typeof result.passed).toBe('boolean');
        expect(typeof result.failureCount).toBe('number');
      });
    });
  });
});
