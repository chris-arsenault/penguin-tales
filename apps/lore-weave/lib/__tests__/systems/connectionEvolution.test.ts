import { describe, it, expect, beforeEach } from 'vitest';
import {
  createConnectionEvolutionSystem,
  ConnectionEvolutionConfig
} from '../../systems/connectionEvolution';
import { createTestGraph, createTestEntity } from '../testHelpers';
import { TemplateGraphView } from '../../graph/templateGraphView';
import { TargetSelector } from '../../selection/targetSelector';
import { CoordinateContext } from '../../coordinates/coordinateContext';
import { HardState, Relationship } from '../../core/worldTypes';
import { EngineConfig } from '../../engine/types';

describe('connectionEvolution', () => {
  let testGraph: ReturnType<typeof createTestGraph>;
  let graphView: TemplateGraphView;

  beforeEach(() => {
    testGraph = createTestGraph();

    const targetSelector = new TargetSelector();
    const mockCoordinateContext = {
      place: () => ({ x: 0.5, y: 0.5 }),
      placeWithCulture: () => ({ x: 0.5, y: 0.5 }),
      getRegionAtPoint: () => null,
      findOrCreateRegion: () => ({ id: 'test-region', name: 'Test', bounds: { type: 'circle', center: { x: 0.5, y: 0.5 }, radius: 0.1 } }),
      sampleRegion: () => ({ x: 0.5, y: 0.5 }),
      getRegions: () => [],
      getRegionById: () => null,
    } as unknown as CoordinateContext;

    graphView = new TemplateGraphView(testGraph, targetSelector, mockCoordinateContext);
  });

  describe('createConnectionEvolutionSystem', () => {
    it('creates a valid SimulationSystem', () => {
      const config: ConnectionEvolutionConfig = {
        id: 'test_evolution',
        name: 'Test Evolution',
        entityKind: 'npc',
        metric: { type: 'connection_count' },
        rules: []
      };

      const system = createConnectionEvolutionSystem(config);

      expect(system.id).toBe('test_evolution');
      expect(system.name).toBe('Test Evolution');
      expect(system.apply).toBeDefined();
      expect(system.contract).toBeDefined();
    });
  });

  describe('connection_count metric', () => {
    it('counts all relationships involving entity', () => {
      const npc1 = createTestEntity({ id: 'npc1', kind: 'npc', prominence: 'marginal' });
      const npc2 = createTestEntity({ id: 'npc2', kind: 'npc', prominence: 'marginal' });
      const npc3 = createTestEntity({ id: 'npc3', kind: 'npc', prominence: 'marginal' });

      testGraph._loadEntity('npc1', npc1);
      testGraph._loadEntity('npc2', npc2);
      testGraph._loadEntity('npc3', npc3);

      // npc1 has 2 connections, npc2 has 1, npc3 has 1
      testGraph.addRelationship('allied_with', 'npc1', 'npc2', 0.6);
      testGraph.addRelationship('enemy_of', 'npc1', 'npc3', 0.5);

      const config: ConnectionEvolutionConfig = {
        id: 'prominence_test',
        name: 'Prominence Test',
        entityKind: 'npc',
        metric: { type: 'connection_count' },
        rules: [{
          condition: { operator: '>=', threshold: 2 },
          probability: 1.0,
          action: { type: 'adjust_prominence', direction: 'up' }
        }]
      };

      const system = createConnectionEvolutionSystem(config);
      const result = system.apply(graphView, 1.0);

      // Only npc1 should be modified (has 2 connections)
      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('npc1');
      expect(result.entitiesModified[0].changes.prominence).toBe('recognized');
    });

    it('filters by relationship kinds', () => {
      const npc1 = createTestEntity({ id: 'npc1', kind: 'npc', prominence: 'marginal' });
      const npc2 = createTestEntity({ id: 'npc2', kind: 'npc', prominence: 'marginal' });

      testGraph._loadEntity('npc1', npc1);
      testGraph._loadEntity('npc2', npc2);

      testGraph.addRelationship('allied_with', 'npc1', 'npc2', 0.6);
      testGraph.addRelationship('enemy_of', 'npc1', 'npc2', 0.5);

      const config: ConnectionEvolutionConfig = {
        id: 'filter_test',
        name: 'Filter Test',
        entityKind: 'npc',
        metric: {
          type: 'connection_count',
          relationshipKinds: ['allied_with']
        },
        rules: [{
          condition: { operator: '>=', threshold: 1 },
          probability: 1.0,
          action: { type: 'adjust_prominence', direction: 'up' }
        }]
      };

      const system = createConnectionEvolutionSystem(config);
      const result = system.apply(graphView, 1.0);

      // Both npcs have 1 allied_with connection each
      expect(result.entitiesModified.length).toBe(2);
    });

    it('respects minStrength filter', () => {
      const npc1 = createTestEntity({ id: 'npc1', kind: 'npc', prominence: 'marginal' });
      const npc2 = createTestEntity({ id: 'npc2', kind: 'npc', prominence: 'marginal' });

      testGraph._loadEntity('npc1', npc1);
      testGraph._loadEntity('npc2', npc2);

      testGraph.addRelationship('allied_with', 'npc1', 'npc2', 0.3); // Weak

      const config: ConnectionEvolutionConfig = {
        id: 'strength_test',
        name: 'Strength Test',
        entityKind: 'npc',
        metric: {
          type: 'connection_count',
          minStrength: 0.5
        },
        rules: [{
          condition: { operator: '>=', threshold: 1 },
          probability: 1.0,
          action: { type: 'adjust_prominence', direction: 'up' }
        }]
      };

      const system = createConnectionEvolutionSystem(config);
      const result = system.apply(graphView, 1.0);

      // No modifications - relationship too weak
      expect(result.entitiesModified.length).toBe(0);
    });
  });

  describe('shared_relationship metric', () => {
    it('counts entities with shared relationships (common enemies)', () => {
      const faction1 = createTestEntity({ id: 'faction1', kind: 'faction', prominence: 'marginal' });
      const faction2 = createTestEntity({ id: 'faction2', kind: 'faction', prominence: 'marginal' });
      const faction3 = createTestEntity({ id: 'faction3', kind: 'faction', prominence: 'marginal' });
      const enemy = createTestEntity({ id: 'enemy', kind: 'faction', prominence: 'marginal' });

      testGraph._loadEntity('faction1', faction1);
      testGraph._loadEntity('faction2', faction2);
      testGraph._loadEntity('faction3', faction3);
      testGraph._loadEntity('enemy', enemy);

      // faction1 and faction2 both have enemy as common enemy
      testGraph.addRelationship('at_war_with', 'faction1', 'enemy', 0.7);
      testGraph.addRelationship('at_war_with', 'faction2', 'enemy', 0.6);
      // faction3 has different enemy
      testGraph.addRelationship('at_war_with', 'faction3', 'faction1', 0.5);

      const config: ConnectionEvolutionConfig = {
        id: 'alliance_formation',
        name: 'Alliance Formation',
        entityKind: 'faction',
        metric: {
          type: 'shared_relationship',
          sharedRelationshipKind: 'at_war_with',
          sharedDirection: 'src',
          minStrength: 0.5
        },
        rules: [{
          condition: { operator: '>=', threshold: 1 },
          probability: 1.0,
          action: { type: 'create_relationship', kind: 'allied_with' },
          betweenMatching: true
        }]
      };

      const system = createConnectionEvolutionSystem(config);
      const result = system.apply(graphView, 1.0);

      // faction1 and faction2 should become allied (they share enemy as common enemy)
      expect(result.relationshipsAdded.length).toBe(1);
      const rel = result.relationshipsAdded[0];
      expect(rel.kind).toBe('allied_with');
      expect([rel.src, rel.dst]).toContain('faction1');
      expect([rel.src, rel.dst]).toContain('faction2');
    });
  });

  describe('prominence_scaled threshold', () => {
    it('scales threshold based on prominence level', () => {
      const npc1 = createTestEntity({ id: 'npc1', kind: 'npc', prominence: 'forgotten' });
      const npc2 = createTestEntity({ id: 'npc2', kind: 'npc', prominence: 'marginal' });
      const npc3 = createTestEntity({ id: 'npc3', kind: 'npc', prominence: 'recognized' });

      testGraph._loadEntity('npc1', npc1);
      testGraph._loadEntity('npc2', npc2);
      testGraph._loadEntity('npc3', npc3);

      // All have same number of connections
      const other1 = createTestEntity({ id: 'other1', kind: 'npc' });
      const other2 = createTestEntity({ id: 'other2', kind: 'npc' });
      const other3 = createTestEntity({ id: 'other3', kind: 'npc' });
      const other4 = createTestEntity({ id: 'other4', kind: 'npc' });
      const other5 = createTestEntity({ id: 'other5', kind: 'npc' });
      const other6 = createTestEntity({ id: 'other6', kind: 'npc' });

      testGraph._loadEntity('other1', other1);
      testGraph._loadEntity('other2', other2);
      testGraph._loadEntity('other3', other3);
      testGraph._loadEntity('other4', other4);
      testGraph._loadEntity('other5', other5);
      testGraph._loadEntity('other6', other6);

      // Give each NPC 6 connections
      testGraph.addRelationship('allied_with', 'npc1', 'other1', 0.5);
      testGraph.addRelationship('allied_with', 'npc1', 'other2', 0.5);
      testGraph.addRelationship('allied_with', 'npc1', 'other3', 0.5);
      testGraph.addRelationship('allied_with', 'npc1', 'other4', 0.5);
      testGraph.addRelationship('allied_with', 'npc1', 'other5', 0.5);
      testGraph.addRelationship('allied_with', 'npc1', 'other6', 0.5);

      testGraph.addRelationship('allied_with', 'npc2', 'other1', 0.5);
      testGraph.addRelationship('allied_with', 'npc2', 'other2', 0.5);
      testGraph.addRelationship('allied_with', 'npc2', 'other3', 0.5);
      testGraph.addRelationship('allied_with', 'npc2', 'other4', 0.5);
      testGraph.addRelationship('allied_with', 'npc2', 'other5', 0.5);
      testGraph.addRelationship('allied_with', 'npc2', 'other6', 0.5);

      testGraph.addRelationship('allied_with', 'npc3', 'other1', 0.5);
      testGraph.addRelationship('allied_with', 'npc3', 'other2', 0.5);
      testGraph.addRelationship('allied_with', 'npc3', 'other3', 0.5);
      testGraph.addRelationship('allied_with', 'npc3', 'other4', 0.5);
      testGraph.addRelationship('allied_with', 'npc3', 'other5', 0.5);
      testGraph.addRelationship('allied_with', 'npc3', 'other6', 0.5);

      // prominence_scaled with multiplier 6:
      // forgotten (0): threshold = (0+1)*6 = 6 - npc1 meets (6 >= 6)
      // marginal (1): threshold = (1+1)*6 = 12 - npc2 doesn't meet (6 < 12)
      // recognized (2): threshold = (2+1)*6 = 18 - npc3 doesn't meet (6 < 18)

      const config: ConnectionEvolutionConfig = {
        id: 'scaled_prominence',
        name: 'Scaled Prominence',
        entityKind: 'npc',
        metric: { type: 'connection_count' },
        rules: [{
          condition: {
            operator: '>=',
            threshold: 'prominence_scaled',
            multiplier: 6
          },
          probability: 1.0,
          action: { type: 'adjust_prominence', direction: 'up' }
        }]
      };

      const system = createConnectionEvolutionSystem(config);
      const result = system.apply(graphView, 1.0);

      // Only npc1 (forgotten) should be modified
      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('npc1');
    });
  });

  describe('subtype bonuses', () => {
    it('adds bonus to metric value for specified subtypes', () => {
      const hero = createTestEntity({ id: 'hero', kind: 'npc', subtype: 'hero', prominence: 'marginal' });
      const merchant = createTestEntity({ id: 'merchant', kind: 'npc', subtype: 'merchant', prominence: 'marginal' });

      testGraph._loadEntity('hero', hero);
      testGraph._loadEntity('merchant', merchant);

      // Both have 1 connection
      const other = createTestEntity({ id: 'other', kind: 'npc' });
      testGraph._loadEntity('other', other);
      testGraph.addRelationship('allied_with', 'hero', 'other', 0.5);
      testGraph.addRelationship('allied_with', 'merchant', 'other', 0.5);

      const config: ConnectionEvolutionConfig = {
        id: 'subtype_bonus_test',
        name: 'Subtype Bonus Test',
        entityKind: 'npc',
        metric: { type: 'connection_count' },
        subtypeBonuses: [
          { subtype: 'hero', bonus: 2 }
        ],
        rules: [{
          condition: { operator: '>=', threshold: 3 },
          probability: 1.0,
          action: { type: 'adjust_prominence', direction: 'up' }
        }]
      };

      const system = createConnectionEvolutionSystem(config);
      const result = system.apply(graphView, 1.0);

      // Hero: 1 connection + 2 bonus = 3 >= 3 ✓
      // Merchant: 1 connection + 0 bonus = 1 < 3 ✗
      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('hero');
    });
  });

  describe('action types', () => {
    it('handles change_status action', () => {
      const npc = createTestEntity({ id: 'npc1', kind: 'npc', status: 'active', prominence: 'marginal' });
      // Use a different kind so only npc1 gets evaluated
      const other = createTestEntity({ id: 'other', kind: 'location' });

      testGraph._loadEntity('npc1', npc);
      testGraph._loadEntity('other', other);
      testGraph.addRelationship('allied_with', 'npc1', 'other', 0.5);

      const config: ConnectionEvolutionConfig = {
        id: 'status_change',
        name: 'Status Change',
        entityKind: 'npc',
        metric: { type: 'connection_count' },
        rules: [{
          condition: { operator: '>=', threshold: 1 },
          probability: 1.0,
          action: { type: 'change_status', newStatus: 'legendary' }
        }]
      };

      const system = createConnectionEvolutionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].changes.status).toBe('legendary');
    });

    it('handles add_tag action', () => {
      const npc = createTestEntity({ id: 'npc1', kind: 'npc', prominence: 'marginal', tags: {} });
      // Use a different kind so only npc1 gets evaluated
      const other = createTestEntity({ id: 'other', kind: 'location' });

      testGraph._loadEntity('npc1', npc);
      testGraph._loadEntity('other', other);
      testGraph.addRelationship('allied_with', 'npc1', 'other', 0.5);

      const config: ConnectionEvolutionConfig = {
        id: 'add_tag',
        name: 'Add Tag',
        entityKind: 'npc',
        metric: { type: 'connection_count' },
        rules: [{
          condition: { operator: '>=', threshold: 1 },
          probability: 1.0,
          action: { type: 'add_tag', tag: 'well_connected', value: true }
        }]
      };

      const system = createConnectionEvolutionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].changes.tags).toEqual({ well_connected: true });
    });

    it('handles adjust_prominence down', () => {
      const npc = createTestEntity({ id: 'npc1', kind: 'npc', prominence: 'recognized' });
      testGraph._loadEntity('npc1', npc);

      // No connections

      const config: ConnectionEvolutionConfig = {
        id: 'decay_prominence',
        name: 'Decay Prominence',
        entityKind: 'npc',
        metric: { type: 'connection_count' },
        rules: [{
          condition: { operator: '<', threshold: 1 },
          probability: 1.0,
          action: { type: 'adjust_prominence', direction: 'down' }
        }]
      };

      const system = createConnectionEvolutionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].changes.prominence).toBe('marginal');
    });
  });

  describe('entity filtering', () => {
    it('filters by entitySubtypes', () => {
      const hero = createTestEntity({ id: 'hero', kind: 'npc', subtype: 'hero', prominence: 'marginal' });
      const merchant = createTestEntity({ id: 'merchant', kind: 'npc', subtype: 'merchant', prominence: 'marginal' });
      const other = createTestEntity({ id: 'other', kind: 'npc' });

      testGraph._loadEntity('hero', hero);
      testGraph._loadEntity('merchant', merchant);
      testGraph._loadEntity('other', other);

      testGraph.addRelationship('allied_with', 'hero', 'other', 0.5);
      testGraph.addRelationship('allied_with', 'merchant', 'other', 0.5);

      const config: ConnectionEvolutionConfig = {
        id: 'hero_only',
        name: 'Hero Only',
        entityKind: 'npc',
        entitySubtypes: ['hero'],
        metric: { type: 'connection_count' },
        rules: [{
          condition: { operator: '>=', threshold: 1 },
          probability: 1.0,
          action: { type: 'adjust_prominence', direction: 'up' }
        }]
      };

      const system = createConnectionEvolutionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('hero');
    });

    it('filters by entityStatus', () => {
      const active = createTestEntity({ id: 'active', kind: 'npc', status: 'active', prominence: 'marginal' });
      const retired = createTestEntity({ id: 'retired', kind: 'npc', status: 'retired', prominence: 'marginal' });
      // Make 'other' have a different status so it doesn't get evaluated
      const other = createTestEntity({ id: 'other', kind: 'npc', status: 'helper' });

      testGraph._loadEntity('active', active);
      testGraph._loadEntity('retired', retired);
      testGraph._loadEntity('other', other);

      testGraph.addRelationship('allied_with', 'active', 'other', 0.5);
      testGraph.addRelationship('allied_with', 'retired', 'other', 0.5);

      const config: ConnectionEvolutionConfig = {
        id: 'active_only',
        name: 'Active Only',
        entityKind: 'npc',
        entityStatus: 'active',
        metric: { type: 'connection_count' },
        rules: [{
          condition: { operator: '>=', threshold: 1 },
          probability: 1.0,
          action: { type: 'adjust_prominence', direction: 'up' }
        }]
      };

      const system = createConnectionEvolutionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('active');
    });
  });

  describe('throttling', () => {
    it('respects throttleChance', () => {
      const npc = createTestEntity({ id: 'npc1', kind: 'npc', prominence: 'marginal' });
      const other = createTestEntity({ id: 'other', kind: 'npc' });

      testGraph._loadEntity('npc1', npc);
      testGraph._loadEntity('other', other);
      testGraph.addRelationship('allied_with', 'npc1', 'other', 0.5);

      const config: ConnectionEvolutionConfig = {
        id: 'throttled',
        name: 'Throttled',
        entityKind: 'npc',
        metric: { type: 'connection_count' },
        throttleChance: 0, // Never run
        rules: [{
          condition: { operator: '>=', threshold: 1 },
          probability: 1.0,
          action: { type: 'adjust_prominence', direction: 'up' }
        }]
      };

      const system = createConnectionEvolutionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(0);
      expect(result.description).toContain('throttled');
    });
  });

  describe('pressure changes', () => {
    it('applies pressure changes when entities are modified', () => {
      const npc = createTestEntity({ id: 'npc1', kind: 'npc', prominence: 'marginal' });
      const other = createTestEntity({ id: 'other', kind: 'npc' });

      testGraph._loadEntity('npc1', npc);
      testGraph._loadEntity('other', other);
      testGraph.addRelationship('allied_with', 'npc1', 'other', 0.5);

      const config: ConnectionEvolutionConfig = {
        id: 'with_pressure',
        name: 'With Pressure',
        entityKind: 'npc',
        metric: { type: 'connection_count' },
        pressureChanges: { stability: 5, conflict: -2 },
        rules: [{
          condition: { operator: '>=', threshold: 1 },
          probability: 1.0,
          action: { type: 'adjust_prominence', direction: 'up' }
        }]
      };

      const system = createConnectionEvolutionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.pressureChanges).toEqual({ stability: 5, conflict: -2 });
    });

    it('does not apply pressure changes when nothing modified', () => {
      const npc = createTestEntity({ id: 'npc1', kind: 'npc', prominence: 'marginal' });
      testGraph._loadEntity('npc1', npc);
      // No connections

      const config: ConnectionEvolutionConfig = {
        id: 'with_pressure',
        name: 'With Pressure',
        entityKind: 'npc',
        metric: { type: 'connection_count' },
        pressureChanges: { stability: 5 },
        rules: [{
          condition: { operator: '>=', threshold: 10 }, // Won't be met
          probability: 1.0,
          action: { type: 'adjust_prominence', direction: 'up' }
        }]
      };

      const system = createConnectionEvolutionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.pressureChanges).toEqual({});
    });
  });

  describe('catalyzed_events metric', () => {
    it('counts catalyzed events from entity catalyst data', () => {
      const npc = createTestEntity({
        id: 'npc1',
        kind: 'npc',
        prominence: 'marginal',
        catalyst: {
          agentCategory: 'individual',
          influence: 50,
          catalyzedEvents: ['event1', 'event2', 'event3']
        }
      });

      testGraph._loadEntity('npc1', npc);

      const config: ConnectionEvolutionConfig = {
        id: 'catalyst_evolution',
        name: 'Catalyst Evolution',
        entityKind: 'npc',
        metric: { type: 'catalyzed_events' },
        rules: [{
          condition: { operator: '>=', threshold: 3 },
          probability: 1.0,
          action: { type: 'adjust_prominence', direction: 'up' }
        }]
      };

      const system = createConnectionEvolutionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].changes.prominence).toBe('recognized');
    });
  });
});
