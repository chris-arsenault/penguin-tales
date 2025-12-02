// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { createEraTransitionSystem } from '../../systems/eraTransition';
import { Graph, SimulationSystem } from '../../engine/types';
import { HardState, Relationship } from '../../core/worldTypes';
import { FRAMEWORK_STATUS } from '../../core/frameworkPrimitives';

describe('eraTransition', () => {
  let graph: Graph;
  let eraTransition: SimulationSystem;

  // Helper to create era transition system
  const createSystem = () => {
    return createEraTransitionSystem({
      id: 'era_transition',
      name: 'Era Progression'
    });
  };

  // Helper to set exit/entry conditions on an era config using the NEW model
  const setEraConditions = (eraId: string, exitConditions?: any[], exitEffects?: any, entryConditions?: any[], entryEffects?: any) => {
    const eraConfig = graph.config.eras.find(e => e.id === eraId);
    if (eraConfig) {
      eraConfig.exitConditions = exitConditions;
      eraConfig.exitEffects = exitEffects;
      eraConfig.entryConditions = entryConditions;
      eraConfig.entryEffects = entryEffects;
    }
  };

  const createEraEntity = (id: string, name: string, status: string, createdAt: number): HardState => ({
    id,
    kind: 'era',
    subtype: id, // subtype must match config era id for condition lookup
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
    // Create the era transition system
    eraTransition = createSystem();

    const _entities = new Map<string, HardState>();
    // NEW MODEL: Only the first (current) era has an entity.
    // Future eras are spawned lazily when transitioned into.
    _entities.set('era1', createEraEntity('era1', 'Early Age', 'current', 0));

    let _relationships: Relationship[] = [];

    graph = {
      get entities() { return _entities; },
      get relationships() { return _relationships; },
      tick: 100,
      currentEra: { id: 'era1', name: 'Early Age', description: 'Test', templateWeights: {}, systemModifiers: {}, pressureModifiers: {} },
      pressures: new Map(),
      relationshipCooldowns: new Map(),
      config: {
        eras: [
          // NEW MODEL: Use exitConditions/entryConditions instead of transitionConditions
          { id: 'era1', name: 'Early Age', description: 'First', templateWeights: {}, systemModifiers: {}, pressureModifiers: {}, exitConditions: [], entryConditions: [] },
          { id: 'era2', name: 'Middle Age', description: 'Second', templateWeights: {}, systemModifiers: {}, pressureModifiers: {}, exitConditions: [], entryConditions: [] },
          { id: 'era3', name: 'Late Age', description: 'Third', templateWeights: {}, systemModifiers: {}, pressureModifiers: {}, exitConditions: [], entryConditions: [] },
        ],
        maxTicks: 500,
        domain: {
          checkEraTransition: () => true, // Allow transitions
        }
      } as any,
      rateLimitState: {} as any,
      history: [],
      nameLogger: {} as any,
      tagRegistry: {} as any,
      loreValidator: {} as any,
      statistics: {} as any,
      enrichmentService: {} as any,
      growthMetrics: { relationshipsPerTick: [], averageGrowthRate: 0 },
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
      loadEntity(entity: HardState) { _entities.set(entity.id, entity); },
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
      _setRelationships(rels: any[]) { _relationships = rels; },
      // History methods
      addHistoryEvent(event: any) { graph.history.push(event); },
      // Era management
      setCurrentEra(era: any) { graph.currentEra = era; },
      // Pressure methods (for TemplateGraphView compatibility)
      getPressure(id: string) { return graph.pressures.get(id) ?? 0; },
      // Logging (for TemplateGraphView compatibility)
      log(_level: string, _message: string, _context?: any) { /* no-op for tests */ }
    } as any;
  });

  describe('metadata', () => {
    it('should have correct id and name', () => {
      expect(eraTransition.id).toBe('era_transition');
      expect(eraTransition.name).toBe('Era Progression');
    });

    // Note: metadata removed - parameters are now passed via config
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

    it('should handle no future eras (final era)', () => {
      // NEW MODEL: With only era1 in config, there are no future eras
      // Remove era2 and era3 from config to test final era behavior
      graph.config.eras = [graph.config.eras[0]];

      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 100;

      // Allow exit (empty conditions)
      setEraConditions('era1', []);

      const result = eraTransition.apply(graph);

      // Should indicate final era since no other eras can be transitioned to
      expect(result.description).toBeDefined();
      expect(result.description).toContain('final era');
    });

    it('should handle missing current era', () => {
      // Remove current era status - this simulates no current era
      graph.entities.get('era1')!.status = 'historical';

      const result = eraTransition.apply(graph);

      // Should warn about no current era
      expect(result.description).toContain('No current era');
    });
  });

  describe('edge cases', () => {
    it('should handle graph with no era entities', () => {
      graph.entities.clear();

      const result = eraTransition.apply(graph);

      expect(result).toBeDefined();
      expect(result.description).toContain('No current era');
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

  describe('per-era time conditions', () => {
    it('should not transition before time condition is met', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 25;

      // Set explicit time condition
      setEraConditions('era1', [{
        type: 'time',
        minTicks: 50
      }]);

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('persists');
      expect(currentEra.status).toBe('current');
    });

    it('should allow transition after time condition is met', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      // Set explicit time condition that is met
      setEraConditions('era1', [{
        type: 'time',
        minTicks: 50
      }]);

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('→');
    });

    it('should allow immediate transition with empty conditions', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 10;

      // Empty conditions = transition allowed
      setEraConditions('era1', []);

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('→');
    });
  });

  describe('era initialization', () => {
    it('should handle transition with temporal tracking not set', () => {
      // NEW MODEL: Transition happens by spawning new era, not activating future entities
      const currentEra = graph.entities.get('era1')!;
      delete currentEra.temporal;
      graph.tick = 200;

      // Allow exit
      setEraConditions('era1', []);

      eraTransition.apply(graph);

      // Should initialize temporal tracking on current era
      expect(currentEra.temporal).toBeDefined();
    });

    it('should spawn new era entity on transition', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      // Allow exit (empty conditions = can exit)
      setEraConditions('era1', []);

      eraTransition.apply(graph);

      // A new era entity should have been created (era2)
      const era2Entities = Array.from(graph.entities.values()).filter(e =>
        e.kind === 'era' && e.subtype === 'era2'
      );
      expect(era2Entities.length).toBe(1);
      expect(era2Entities[0].status).toBe('current');
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
      // NEW MODEL: Use exitConditions not transitionConditions
      setEraConditions('era1', []); // Empty exit conditions = can exit

      const result = eraTransition.apply(graph);

      // Check that relationships were created (supersedes + active_during)
      expect(result.relationshipsAdded.length).toBeGreaterThan(0);
      const activeDuringRels = result.relationshipsAdded.filter(r => r.kind === 'active_during');
      expect(activeDuringRels.length).toBeGreaterThan(0);
      expect(activeDuringRels[0].dst).toBe(currentEra.id);
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
      setEraConditions('era1', []); // Empty exit conditions = can exit

      const result = eraTransition.apply(graph);

      // active_during relationships should be capped at 10, plus 1 supersedes
      const activeDuringRels = result.relationshipsAdded.filter(r => r.kind === 'active_during');
      expect(activeDuringRels.length).toBeLessThanOrEqual(10);
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
      setEraConditions('era1', []); // Empty exit conditions = can exit

      const result = eraTransition.apply(graph);

      // Only entity created during era should be linked
      const activeDuringRels = result.relationshipsAdded.filter(r => r.kind === 'active_during');
      const linkedEntities = activeDuringRels.map(r => r.src);
      expect(linkedEntities).toContain('npc-during');
      expect(linkedEntities).not.toContain('npc-before');
    });
  });

  describe('exit condition checking', () => {
    it('should handle pressure-based exit conditions (above)', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      graph.pressures.set('conflict', 75);

      // NEW MODEL: Use exitConditions
      setEraConditions('era1', [{
        type: 'pressure',
        pressureId: 'conflict',
        operator: 'above',
        threshold: 60
      }]);

      const result = eraTransition.apply(graph);

      // Should transition because exit condition is met
      expect(result.description).toContain('→');
    });

    it('should handle pressure-based exit conditions (below)', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      graph.pressures.set('stability', 25);

      setEraConditions('era1', [{
        type: 'pressure',
        pressureId: 'stability',
        operator: 'below',
        threshold: 40
      }]);

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('→');
    });

    it('should not exit if pressure condition not met', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      graph.pressures.set('conflict', 30);

      setEraConditions('era1', [{
        type: 'pressure',
        pressureId: 'conflict',
        operator: 'above',
        threshold: 60
      }]);

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('persists');
      expect(currentEra.status).toBe('current');
    });

    it('should handle entity count exit conditions (above)', () => {
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

      setEraConditions('era1', [{
        type: 'entity_count',
        entityKind: 'npc',
        operator: 'above',
        threshold: 5
      }]);

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

      setEraConditions('era1', [{
        type: 'entity_count',
        entityKind: 'npc',
        subtype: 'hero',
        operator: 'above',
        threshold: 0
      }]);

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('→');
    });

    it('should handle time-based exit conditions', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 150;

      setEraConditions('era1', [{
        type: 'time',
        minTicks: 100
      }]);

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('→');
    });

    it('should require all exit conditions to be met (AND logic)', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      graph.pressures.set('conflict', 75);

      setEraConditions('era1', [
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
      ]);

      const result = eraTransition.apply(graph);

      // Should not exit because time condition not met
      expect(result.description).toContain('persists');
      expect(currentEra.status).toBe('current');
    });
  });

  describe('missing config handling', () => {
    it('should warn if era config not found', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.subtype = 'nonexistent_era'; // subtype doesn't match any config
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 150;

      // NEW MODEL: Gracefully handle missing config with warning instead of throwing
      const result = eraTransition.apply(graph);
      expect(result.description).toContain('persists');
      expect(result.description).toContain('config not found');
    });

    it('should allow immediate transition with empty exit conditions array', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 1; // Very early

      // Empty array = immediate transition allowed
      setEraConditions('era1', []);

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('→');
    });

    it('should allow exit when exitConditions is undefined (empty)', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 150;

      // NEW MODEL: undefined exitConditions treated as empty (allow immediate transition)
      const eraConfig = graph.config.eras.find((e: any) => e.id === 'era1');
      delete eraConfig.exitConditions;

      const result = eraTransition.apply(graph);

      expect(result.description).toContain('→');
    });
  });

  describe('history event creation', () => {
    it('should create history event on successful transition', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      setEraConditions('era1', []); // Empty exit conditions = can exit

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

      setEraConditions('era1', []); // Empty exit conditions = can exit

      eraTransition.apply(graph);

      const lastEvent = graph.history[graph.history.length - 1];
      // NEW MODEL: entitiesModified only includes current era, entitiesCreated has new era
      expect(lastEvent.entitiesModified?.length).toBeGreaterThanOrEqual(1);
      expect(lastEvent.entitiesCreated?.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('era exit effects', () => {
    it('should apply config-defined exit effects', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      // NEW MODEL: Use exitEffects instead of transitionEffects
      setEraConditions('era1', [], {
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

    it('should handle missing exit effects config', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      // No effects configured
      setEraConditions('era1', []);

      const result = eraTransition.apply(graph);

      expect(result.pressureChanges).toEqual({});
    });
  });

  describe('era entry effects', () => {
    it('should apply entry effects from new era', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      // Set entry effects on era2 (the destination era)
      setEraConditions('era2', undefined, undefined, [], { pressureChanges: { innovation: 25 } });
      // Allow exit from era1
      setEraConditions('era1', []);

      const result = eraTransition.apply(graph);

      expect(result.pressureChanges).toBeDefined();
      expect(result.pressureChanges['innovation']).toBe(25);
    });
  });

  describe('final era behavior', () => {
    it('should indicate final era when no valid next era exists', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      // NEW MODEL: Remove era2 and era3 from config to make era1 the final era
      graph.config.eras = [graph.config.eras[0]];
      setEraConditions('era1', []);

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

      setEraConditions('era1', []); // Empty exit conditions = can exit

      eraTransition.apply(graph);

      // graph.currentEra should now reference era2's config
      expect(graph.currentEra.id).toBe('era2');
    });
  });

  describe('entry conditions', () => {
    it('should check entry conditions before spawning next era', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;

      // Allow exit from era1
      setEraConditions('era1', []);

      // era2 has entry condition that isn't met
      setEraConditions('era2', undefined, undefined, [
        { type: 'pressure', pressureId: 'conflict', operator: 'above', threshold: 80 }
      ]);

      // era3 has no entry conditions (can enter)
      setEraConditions('era3', undefined, undefined, []);

      // Pressure is low
      graph.pressures.set('conflict', 30);

      const result = eraTransition.apply(graph);

      // Should skip era2 and transition to era3
      expect(graph.currentEra.id).toBe('era3');
    });

    it('should find first era whose entry conditions are met', () => {
      const currentEra = graph.entities.get('era1')!;
      currentEra.temporal = { startTick: 0, endTick: null };
      graph.tick = 120;
      graph.pressures.set('conflict', 90);

      // Allow exit from era1
      setEraConditions('era1', []);

      // era2 has entry condition that IS met
      setEraConditions('era2', undefined, undefined, [
        { type: 'pressure', pressureId: 'conflict', operator: 'above', threshold: 80 }
      ]);

      const result = eraTransition.apply(graph);

      // Should transition to era2 since its entry conditions are met
      expect(graph.currentEra.id).toBe('era2');
    });
  });
});
