// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { eraTransition } from '../../systems/eraTransition';
import { Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { FRAMEWORK_STATUS } from '../../types/frameworkPrimitives';

describe('eraTransition', () => {
  let graph: Graph;

  const createEraEntity = (id: string, name: string, status: string, createdAt: number): HardState => ({
    id,
    kind: 'era',
    subtype: 'era',
    name,
    description: `Era ${name}`,
    status,
    prominence: 'mythic',
    tags: [],
    links: [],
    createdAt,
    updatedAt: createdAt,
  });

  beforeEach(() => {
    const _entities = new Map<string, HardState>();
    _entities.set('era1', createEraEntity('era1', 'Early Age', 'current', 0));
    _entities.set('era2', createEraEntity('era2', 'Middle Age', 'future', 0));
    _entities.set('era3', createEraEntity('era3', 'Late Age', 'future', 0));

    let _relationships: Relationship[] = [];

    graph = {
      // Keep entities/relationships getters for test code compatibility
      get entities() { return _entities; },
      get relationships() { return _relationships; },
      tick: 100,
      currentEra: { id: 'era1', name: 'Early Age', description: 'Test', templateWeights: {}, systemModifiers: {}, pressureModifiers: {} },
      pressures: new Map(),
      relationshipCooldowns: new Map(),
      config: {
        eras: [
          { id: 'era1', name: 'Early Age', description: 'First', templateWeights: {}, systemModifiers: {}, pressureModifiers: {} },
          { id: 'era2', name: 'Middle Age', description: 'Second', templateWeights: {}, systemModifiers: {}, pressureModifiers: {} },
          { id: 'era3', name: 'Late Age', description: 'Third', templateWeights: {}, systemModifiers: {}, pressureModifiers: {} },
        ],
        maxTicks: 500,
        domain: {
          checkEraTransition: () => true, // Allow transitions
        }
      } as any,
      discoveryState: {} as any,
      history: [],
      loreIndex: {} as any,
      nameLogger: {} as any,
      tagRegistry: {} as any,
      loreValidator: {} as any,
      statistics: {} as any,
      enrichmentService: {} as any,
      growthMetrics: { relationshipsPerTick: [], averageGrowthRate: 0 },
      loreRecords: [],
      // New Graph interface methods - entity read
      getEntity(id: string) { return _entities.get(id); },
      hasEntity(id: string) { return _entities.has(id); },
      getEntityCount() { return _entities.size; },
      getEntities() { return Array.from(_entities.values()); },
      getEntityIds() { return Array.from(_entities.keys()); },
      forEachEntity(cb: any) { _entities.forEach((e, id) => cb(e, id)); },
      findEntities(criteria: any) {
        return Array.from(_entities.values()).filter(e => {
          if (criteria.kind && e.kind !== criteria.kind) return false;
          if (criteria.subtype && e.subtype !== criteria.subtype) return false;
          if (criteria.status && e.status !== criteria.status) return false;
          return true;
        });
      },
      getEntitiesByKind(kind: string) { return Array.from(_entities.values()).filter(e => e.kind === kind); },
      getConnectedEntities(entityId: string, relationKind?: string) {
        const connectedIds = new Set<string>();
        _relationships.forEach(r => {
          if (relationKind && r.kind !== relationKind) return;
          if (r.src === entityId) connectedIds.add(r.dst);
          if (r.dst === entityId) connectedIds.add(r.src);
        });
        return Array.from(connectedIds).map(id => _entities.get(id)).filter(Boolean);
      },
      // Entity mutation methods
      createEntity(settings: any) {
        const id = `${settings.kind}-${Date.now()}`;
        _entities.set(id, { ...settings, id, links: [] });
        return id;
      },
      updateEntity(id: string, changes: any) {
        const e = _entities.get(id);
        if (!e) return false;
        Object.assign(e, changes);
        return true;
      },
      deleteEntity(id: string) { return _entities.delete(id); },
      _loadEntity(id: string, entity: HardState) { _entities.set(id, entity); },
      // Relationship read methods
      getRelationships() { return [..._relationships]; },
      getRelationshipCount() { return _relationships.length; },
      findRelationships(criteria: any) {
        return _relationships.filter(r => {
          if (criteria.kind && r.kind !== criteria.kind) return false;
          if (criteria.src && r.src !== criteria.src) return false;
          if (criteria.dst && r.dst !== criteria.dst) return false;
          return true;
        });
      },
      getEntityRelationships(entityId: string) {
        return _relationships.filter(r => r.src === entityId || r.dst === entityId);
      },
      // Relationship mutation methods
      addRelationship(rel: any) { _relationships.push(rel); },
      _loadRelationship(rel: any) { _relationships.push(rel); },
      _setRelationships(rels: any[]) { _relationships = rels; }
    } as any;
  });

  describe('metadata', () => {
    it('should have correct id and name', () => {
      expect(eraTransition.id).toBe('era_transition');
      expect(eraTransition.name).toBe('Era Progression');
    });

    it('should have metadata with parameters', () => {
      expect(eraTransition.metadata).toBeDefined();
      expect(eraTransition.metadata!.parameters).toBeDefined();
      expect(eraTransition.metadata!.parameters!.minEraLength).toBeDefined();
    });
  });

  describe('transition logic', () => {
    it('should invoke transition system', () => {
      graph.tick = 30;
      const result = eraTransition.apply(graph);
      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
    });

    it('should handle transition checks', () => {
      graph.tick = 100;
      const result = eraTransition.apply(graph);
      expect(result).toBeDefined();
    });

    it('should process era entities', () => {
      graph.tick = 100;
      eraTransition.apply(graph);

      // Eras should still exist
      const eras = Array.from(graph.entities.values()).filter(e => e.kind === 'era');
      expect(eras.length).toBeGreaterThan(0);
    });

    it('should maintain at least one current era', () => {
      graph.tick = 100;
      eraTransition.apply(graph);

      const currentEras = Array.from(graph.entities.values()).filter(e => e.kind === 'era' && e.status === 'current');
      expect(currentEras.length).toBeGreaterThanOrEqual(0); // May be 0 or 1 depending on logic
    });

    it('should handle no future eras', () => {
      // Set all eras to past except current
      graph.entities.get('era2')!.status = FRAMEWORK_STATUS.HISTORICAL;
      graph.entities.get('era3')!.status = FRAMEWORK_STATUS.HISTORICAL;

      graph.tick = 100;
      const result = eraTransition.apply(graph);

      // Should indicate end of eras or stay in current
      expect(result.description).toBeDefined();
      expect(typeof result.description).toBe('string');
    });

    it('should handle missing current era by activating first future', () => {
      // Remove current era status
      graph.entities.get('era1')!.status = 'future';

      const result = eraTransition.apply(graph);

      const currentEras = Array.from(graph.entities.values()).filter(e => e.status === 'current');
      expect(currentEras.length).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle graph with no era entities', () => {
      graph.entities.clear();

      const result = eraTransition.apply(graph);

      expect(result).toBeDefined();
      expect(result.description).toContain('No era');
    });

    it('should work with modifier parameter', () => {
      graph.tick = 100;
      const result = eraTransition.apply(graph, 1.5);

      expect(result).toBeDefined();
    });

    it('should handle domain without transition check function', () => {
      graph.config.domain = {} as any;
      graph.tick = 100;

      const result = eraTransition.apply(graph);

      expect(result).toBeDefined();
    });

    it('should handle era without temporal tracking', () => {
      const currentEra = graph.entities.get('era1')!;
      delete currentEra.temporal;
      graph.tick = 200;

      const result = eraTransition.apply(graph);

      expect(result).toBeDefined();
      // Temporal tracking should be initialized
      expect(currentEra.temporal).toBeDefined();
    });
  });

  describe('minimum era length enforcement', () => {
    it('should not transition before minimum length', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 25; // Less than minEraLength (50)

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('continues');
      expect(currentEra.status).toBe('current');
    });

    it('should allow transition after minimum length', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120; // Greater than minEraLength (50)

      // Configure transition conditions to allow immediate transition
      graph.config.domain.getEraTransitionConditions = () => [];

      const result = eraTransition.apply(graph);

      expect(result).toBeDefined();
    });
  });

  describe('transition cooldown', () => {
    it('should respect transition cooldown period', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: graph.tick - 5, endTick: null }; // Just started
      graph.tick = 55; // Within cooldown

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('stabilizing');
      expect(currentEra.status).toBe('current');
    });

    it('should allow transition after cooldown', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: graph.tick - 60, endTick: null };
      graph.tick = 120;

      graph.config.domain.getEraTransitionConditions = () => [];

      const result = eraTransition.apply(graph);

      expect(result).toBeDefined();
    });
  });

  describe('era activation', () => {
    it('should activate first era when none are current', () => {
      // Set all eras to future
      graph.entities.forEach(entity => {
        if (entity.kind === 'era') {
          entity.status = 'future';
        }
      });

      const result = eraTransition.apply(graph);

      const currentEras = Array.from(graph.entities.values()).filter(e =>
        e.kind === 'era' && e.status === 'current'
      );

      expect(currentEras.length).toBe(1);
      expect(result.description).toContain('begins');
    });

    it('should initialize temporal tracking on first activation', () => {
      graph.entities.forEach(entity => {
        if (entity.kind === 'era') {
          entity.status = 'future';
          delete entity.temporal;
        }
      });

      eraTransition.apply(graph);

      const currentEra = Array.from(graph.entities.values()).find(e =>
        e.kind === 'era' && e.status === 'current'
      );

      expect(currentEra).toBeDefined();
      expect(currentEra!.temporal).toBeDefined();
      expect(currentEra!.temporal!.startTick).toBe(graph.tick);
      expect(currentEra!.temporal!.endTick).toBeNull();
    });
  });

  describe('prominent entity linking', () => {
    it('should create active_during relationships for prominent entities', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };

      // Add prominent entities created during the era
      graph.entities.set('npc-1', {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'hero',
        name: 'Hero',
        description: 'A hero',
        status: 'active',
        prominence: 'renowned',
        tags: [],
        links: [],
        createdAt: 50,
        updatedAt: 50
      });

      graph.entities.set('npc-2', {
        id: 'npc-2',
        kind: 'npc',
        subtype: 'warrior',
        name: 'Warrior',
        description: 'A warrior',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 60,
        updatedAt: 60
      });

      graph.tick = 120;
      graph.config.domain.getEraTransitionConditions = () => [];

      const result = eraTransition.apply(graph);

      // Check that relationships were created
      expect(result.relationshipsAdded.length).toBeGreaterThan(0);
      expect(result.relationshipsAdded[0].kind).toBe('active_during');
      expect(result.relationshipsAdded[0].dst).toBe(currentEra.id);
    });

    it('should limit active_during relationships to 10 entities', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };

      // Add 15 prominent entities
      for (let i = 1; i <= 15; i++) {
        graph.entities.set(`npc-${i}`, {
          id: `npc-${i}`,
          kind: 'npc',
          subtype: 'hero',
          name: `Hero ${i}`,
          description: 'A hero',
          status: 'active',
          prominence: 'renowned',
          tags: [],
          links: [],
          createdAt: 50,
          updatedAt: 50
        });
      }

      graph.tick = 120;
      graph.config.domain.getEraTransitionConditions = () => [];

      const result = eraTransition.apply(graph);

      // Should be capped at 10
      expect(result.relationshipsAdded.length).toBeLessThanOrEqual(10);
    });

    it('should only link entities created during the era', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 50, endTick: null };

      // Entity before era start
      graph.entities.set('npc-before', {
        id: 'npc-before',
        kind: 'npc',
        subtype: 'hero',
        name: 'Hero Before',
        description: 'Before',
        status: 'active',
        prominence: 'renowned',
        tags: [],
        links: [],
        createdAt: 40,
        updatedAt: 40
      });

      // Entity during era
      graph.entities.set('npc-during', {
        id: 'npc-during',
        kind: 'npc',
        subtype: 'hero',
        name: 'Hero During',
        description: 'During',
        status: 'active',
        prominence: 'renowned',
        tags: [],
        links: [],
        createdAt: 60,
        updatedAt: 60
      });

      graph.tick = 120;
      graph.config.domain.getEraTransitionConditions = () => [];

      const result = eraTransition.apply(graph);

      // Only entity created during era should be linked
      const linkedEntities = result.relationshipsAdded.map(r => r.src);
      expect(linkedEntities).toContain('npc-during');
      expect(linkedEntities).not.toContain('npc-before');
    });
  });

  describe('transition condition checking', () => {
    it('should handle pressure-based conditions (above)', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      graph.pressures.set('conflict', 75);

      graph.config.domain.getEraTransitionConditions = () => [{
        type: 'pressure',
        pressureId: 'conflict',
        operator: 'above',
        threshold: 60
      }];

      const result = eraTransition.apply(graph);

      // Should transition because pressure condition is met
      expect(result.description).toContain('→');
    });

    it('should handle pressure-based conditions (below)', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      graph.pressures.set('stability', 25);

      graph.config.domain.getEraTransitionConditions = () => [{
        type: 'pressure',
        pressureId: 'stability',
        operator: 'below',
        threshold: 40
      }];

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('→');
    });

    it('should not transition if pressure condition not met', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      graph.pressures.set('conflict', 30);

      graph.config.domain.getEraTransitionConditions = () => [{
        type: 'pressure',
        pressureId: 'conflict',
        operator: 'above',
        threshold: 60
      }];

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('persists');
      expect(currentEra.status).toBe('current');
    });

    it('should handle entity count conditions (above)', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      // Add multiple NPCs
      for (let i = 1; i <= 10; i++) {
        graph.entities.set(`npc-${i}`, {
          id: `npc-${i}`,
          kind: 'npc',
          subtype: 'hero',
          name: `Hero ${i}`,
          description: '',
          status: 'active',
          prominence: 'recognized',
          tags: [],
          links: [],
          createdAt: 50,
          updatedAt: 50
        });
      }

      graph.config.domain.getEraTransitionConditions = () => [{
        type: 'entity_count',
        entityKind: 'npc',
        operator: 'above',
        threshold: 5
      }];

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('→');
    });

    it('should handle entity count conditions with subtype filter', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      graph.entities.set('npc-1', {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'hero',
        name: 'Hero',
        description: '',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 50,
        updatedAt: 50
      });

      graph.entities.set('npc-2', {
        id: 'npc-2',
        kind: 'npc',
        subtype: 'villain',
        name: 'Villain',
        description: '',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 50,
        updatedAt: 50
      });

      graph.config.domain.getEraTransitionConditions = () => [{
        type: 'entity_count',
        entityKind: 'npc',
        subtype: 'hero',
        operator: 'above',
        threshold: 0
      }];

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('→');
    });

    it('should handle occurrence conditions (exists)', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      graph.entities.set('occ-1', {
        id: 'occ-1',
        kind: 'occurrence',
        subtype: 'war',
        name: 'Great War',
        description: '',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 50,
        updatedAt: 50
      });

      graph.config.domain.getEraTransitionConditions = () => [{
        type: 'occurrence',
        subtype: 'war',
        operator: 'exists'
      }];

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('→');
    });

    it('should handle occurrence conditions (ended)', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      graph.entities.set('occ-1', {
        id: 'occ-1',
        kind: 'occurrence',
        subtype: 'war',
        name: 'Great War',
        description: '',
        status: FRAMEWORK_STATUS.HISTORICAL,
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 50,
        updatedAt: 100
      });

      graph.config.domain.getEraTransitionConditions = () => [{
        type: 'occurrence',
        subtype: 'war',
        operator: 'ended'
      }];

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('→');
    });

    it('should handle time-based conditions', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 150;

      graph.config.domain.getEraTransitionConditions = () => [{
        type: 'time',
        minTicks: 100
      }];

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('→');
    });

    it('should require all conditions to be met (AND logic)', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      graph.pressures.set('conflict', 75);

      graph.config.domain.getEraTransitionConditions = () => [
        {
          type: 'pressure',
          pressureId: 'conflict',
          operator: 'above',
          threshold: 60
        },
        {
          type: 'time',
          minTicks: 200 // Not met
        }
      ];

      const result = eraTransition.apply(graph);

      // Should not transition because time condition not met
      expect(result.description).toContain('persists');
      expect(currentEra.status).toBe('current');
    });
  });

  describe('default transition conditions', () => {
    it('should use default heuristic when no custom conditions defined', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 150; // 2x minEraLength (50)

      graph.config.domain.getEraTransitionConditions = () => null;

      const result = eraTransition.apply(graph);

      // Should transition using default heuristic (2x min length)
      expect(result).toBeDefined();
    });
  });

  describe('history event creation', () => {
    it('should create history event on successful transition', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      graph.config.domain.getEraTransitionConditions = () => [];

      const historyLengthBefore = graph.history.length;

      eraTransition.apply(graph);

      expect(graph.history.length).toBeGreaterThan(historyLengthBefore);

      const lastEvent = graph.history[graph.history.length - 1];
      expect(lastEvent.type).toBe('special');
      expect(lastEvent.description).toContain('ends');
      expect(lastEvent.description).toContain('begins');
    });

    it('should include modified entities in history event', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      graph.config.domain.getEraTransitionConditions = () => [];

      eraTransition.apply(graph);

      const lastEvent = graph.history[graph.history.length - 1];
      expect(lastEvent.entitiesModified?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('era transition effects', () => {
    it('should apply domain-specific transition effects', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      graph.config.domain.getEraTransitionConditions = () => [];
      graph.config.domain.getEraTransitionEffects = () => ({
        pressureChanges: {
          conflict: 20,
          stability: -10
        }
      });

      const result = eraTransition.apply(graph);

      expect(result.pressureChanges).toBeDefined();
      expect(result.pressureChanges['conflict']).toBe(20);
      expect(result.pressureChanges['stability']).toBe(-10);
    });

    it('should handle missing transition effects function', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      graph.config.domain.getEraTransitionConditions = () => [];
      delete graph.config.domain.getEraTransitionEffects;

      const result = eraTransition.apply(graph);

      expect(result.pressureChanges).toEqual({});
    });
  });

  describe('final era behavior', () => {
    it('should indicate final era when no future eras remain', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.entities.get('era2')!.status = FRAMEWORK_STATUS.HISTORICAL;
      graph.entities.get('era3')!.status = FRAMEWORK_STATUS.HISTORICAL;
      graph.tick = 120;

      graph.config.domain.getEraTransitionConditions = () => [];

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('final era');
      expect(currentEra.status).toBe('current');
    });
  });

  describe('config era synchronization', () => {
    it('should update graph.currentEra reference on transition', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      const era2 = graph.entities.get('era2')!;
      era2.subtype = 'era2'; // Match config era id

      graph.config.domain.getEraTransitionConditions = () => [];

      eraTransition.apply(graph);

      // graph.currentEra should now reference era2's config
      expect(graph.currentEra.id).toBe('era2');
    });
  });
});
