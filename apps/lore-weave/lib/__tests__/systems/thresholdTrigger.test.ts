import { describe, it, expect, beforeEach } from 'vitest';
import { createThresholdTriggerSystem, ThresholdTriggerConfig } from '../../systems/thresholdTrigger';
import { createTestGraph, createTestEntity } from '../testHelpers';
import { TemplateGraphView } from '../../graph/templateGraphView';
import { TargetSelector } from '../../selection/targetSelector';
import { CoordinateContext } from '../../coordinates/coordinateContext';
import { HardState } from '../../core/worldTypes';
import { Graph } from '../../engine/types';

describe('thresholdTrigger', () => {
  let testGraph: Graph;
  let graphView: TemplateGraphView;

  const mockCoordinateContext = {
    place: () => ({ x: 0.5, y: 0.5 }),
    placeWithCulture: () => ({ x: 0.5, y: 0.5 }),
    getRegionAtPoint: () => null,
    findOrCreateRegion: () => ({ id: 'test-region', name: 'Test', bounds: { type: 'circle', center: { x: 0.5, y: 0.5 }, radius: 0.1 } }),
    sampleRegion: () => ({ x: 0.5, y: 0.5 }),
    getRegions: () => [],
    getRegionById: () => null,
  } as unknown as CoordinateContext;

  beforeEach(() => {
    testGraph = createTestGraph();
    const targetSelector = new TargetSelector();
    graphView = new TemplateGraphView(testGraph, targetSelector, mockCoordinateContext);
  });

  function addEntity(entity: HardState): void {
    (testGraph as any)._loadEntity(entity.id, entity);
  }

  function addRelationship(kind: string, src: string, dst: string, strength: number = 0.5): void {
    (testGraph as any).addRelationship(kind, src, dst, strength);
  }

  function createFaction(id: string, status: string = 'active', tags: Record<string, string | boolean> = {}): HardState {
    return createTestEntity({
      id,
      kind: 'faction',
      subtype: 'political',
      name: `Faction ${id}`,
      status,
      tags
    });
  }

  function createNPC(id: string, status: string = 'alive', tags: Record<string, string | boolean> = {}): HardState {
    return createTestEntity({
      id,
      kind: 'npc',
      subtype: 'commoner',
      name: `NPC ${id}`,
      status,
      tags
    });
  }

  describe('basic functionality', () => {
    it('should create a valid SimulationSystem', () => {
      const config: ThresholdTriggerConfig = {
        id: 'test_trigger',
        name: 'Test Trigger',
        entityFilter: { kind: 'faction' },
        conditions: [],
        actions: []
      };

      const system = createThresholdTriggerSystem(config);

      expect(system.id).toBe('test_trigger');
      expect(system.name).toBe('Test Trigger');
      expect(system.apply).toBeDefined();
    });

    it('should set tags on matching entities', () => {
      const faction = createFaction('f1', 'active');
      addEntity(faction);

      const config: ThresholdTriggerConfig = {
        id: 'test_trigger',
        name: 'Test Trigger',
        entityFilter: { kind: 'faction', status: 'active' },
        conditions: [],
        actions: [{ type: 'set_tag', tag: 'triggered', tagValue: true }]
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('f1');
      expect(result.entitiesModified[0].changes.tags).toEqual({ triggered: true });
    });
  });

  describe('condition evaluation', () => {
    it('should filter by relationship_count condition', () => {
      const f1 = createFaction('f1');
      const f2 = createFaction('f2');
      const f3 = createFaction('f3');
      addEntity(f1);
      addEntity(f2);
      addEntity(f3);
      // f1 has 2 at_war_with relationships
      addRelationship('at_war_with', 'f1', 'f2');
      addRelationship('at_war_with', 'f1', 'f3');
      // f2 only has 1

      const config: ThresholdTriggerConfig = {
        id: 'war_trigger',
        name: 'War Trigger',
        entityFilter: { kind: 'faction' },
        conditions: [{
          type: 'relationship_count',
          relationshipKind: 'at_war_with',
          minCount: 2
        }],
        actions: [{ type: 'set_tag', tag: 'major_combatant', tagValue: true }]
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('f1');
    });

    it('should filter by entity_status condition', () => {
      const f1 = createFaction('f1', 'active');
      const f2 = createFaction('f2', 'waning');
      addEntity(f1);
      addEntity(f2);

      const config: ThresholdTriggerConfig = {
        id: 'waning_trigger',
        name: 'Waning Trigger',
        entityFilter: { kind: 'faction' },
        conditions: [{ type: 'entity_status', status: 'waning' }],
        actions: [{ type: 'set_tag', tag: 'declining', tagValue: true }]
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('f2');
    });

    it('should filter by tag_exists condition', () => {
      const f1 = createFaction('f1', 'active', { leaderless: true });
      const f2 = createFaction('f2', 'active');
      addEntity(f1);
      addEntity(f2);

      const config: ThresholdTriggerConfig = {
        id: 'leaderless_trigger',
        name: 'Leaderless Trigger',
        entityFilter: { kind: 'faction' },
        conditions: [{ type: 'tag_exists', tag: 'leaderless' }],
        actions: [{ type: 'set_tag', tag: 'power_vacuum', tagValue: true }]
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('f1');
    });

    it('should filter by tag_absent condition', () => {
      const f1 = createFaction('f1', 'active', { stable: true });
      const f2 = createFaction('f2', 'active');
      addEntity(f1);
      addEntity(f2);

      const config: ThresholdTriggerConfig = {
        id: 'unstable_trigger',
        name: 'Unstable Trigger',
        entityFilter: { kind: 'faction' },
        conditions: [{ type: 'tag_absent', tag: 'stable' }],
        actions: [{ type: 'set_tag', tag: 'needs_attention', tagValue: true }]
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('f2');
    });

    it('should filter by relationship_exists with target properties', () => {
      const f1 = createFaction('f1');
      const f2 = createFaction('f2');
      const deadLeader = createNPC('leader1', 'dead');
      const aliveLeader = createNPC('leader2', 'alive');
      addEntity(f1);
      addEntity(f2);
      addEntity(deadLeader);
      addEntity(aliveLeader);
      addRelationship('leader_of', 'leader1', 'f1');  // dead leader
      addRelationship('leader_of', 'leader2', 'f2');  // alive leader

      const config: ThresholdTriggerConfig = {
        id: 'dead_leader_trigger',
        name: 'Dead Leader Trigger',
        entityFilter: { kind: 'faction' },
        conditions: [{
          type: 'relationship_exists',
          relationshipKind: 'leader_of',
          relationshipDirection: 'dst',
          targetKind: 'npc',
          targetStatus: 'dead'
        }],
        actions: [{ type: 'set_tag', tag: 'power_vacuum', tagValue: true }]
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('f1');
    });

    it('should require ALL conditions to match', () => {
      const f1 = createFaction('f1', 'active', { leaderless: true });
      const f2 = createFaction('f2', 'waning', { leaderless: true });
      const f3 = createFaction('f3', 'waning');
      addEntity(f1);
      addEntity(f2);
      addEntity(f3);

      const config: ThresholdTriggerConfig = {
        id: 'crisis_trigger',
        name: 'Crisis Trigger',
        entityFilter: { kind: 'faction' },
        conditions: [
          { type: 'entity_status', status: 'waning' },
          { type: 'tag_exists', tag: 'leaderless' }
        ],
        actions: [{ type: 'set_tag', tag: 'crisis', tagValue: true }]
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      // Only f2 matches both conditions
      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('f2');
    });
  });

  describe('clustering', () => {
    it('should cluster all matching entities with all_matching mode', () => {
      const f1 = createFaction('f1');
      const f2 = createFaction('f2');
      const f3 = createFaction('f3');
      addEntity(f1);
      addEntity(f2);
      addEntity(f3);
      // All have at_war_with relationships
      addRelationship('at_war_with', 'f1', 'f2');
      addRelationship('at_war_with', 'f2', 'f3');

      const config: ThresholdTriggerConfig = {
        id: 'war_cluster',
        name: 'War Cluster',
        entityFilter: { kind: 'faction' },
        conditions: [{
          type: 'relationship_count',
          relationshipKind: 'at_war_with',
          minCount: 1
        }],
        actions: [{ type: 'set_cluster_tag', tag: 'war_brewing' }],
        clusterMode: 'all_matching'
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      // All 3 factions should have the same cluster tag value
      expect(result.entitiesModified.length).toBe(3);
      const tagValues = result.entitiesModified.map(m => m.changes.tags?.war_brewing);
      expect(new Set(tagValues).size).toBe(1);  // All same value
      expect(tagValues[0]).toMatch(/^cluster_/);  // Starts with cluster_
    });

    it('should cluster by shared relationship targets', () => {
      const f1 = createFaction('f1');
      const f2 = createFaction('f2');
      const f3 = createFaction('f3');
      const enemy = createFaction('enemy');
      addEntity(f1);
      addEntity(f2);
      addEntity(f3);
      addEntity(enemy);
      // f1 and f2 are both at war with enemy
      addRelationship('at_war_with', 'f1', 'enemy');
      addRelationship('at_war_with', 'f2', 'enemy');
      // f3 is at war with someone else (f1)
      addRelationship('at_war_with', 'f3', 'f1');

      const config: ThresholdTriggerConfig = {
        id: 'common_enemy_cluster',
        name: 'Common Enemy Cluster',
        entityFilter: { kind: 'faction' },
        conditions: [{
          type: 'relationship_count',
          relationshipKind: 'at_war_with',
          minCount: 1
        }],
        actions: [{ type: 'set_cluster_tag', tag: 'war_brewing' }],
        clusterMode: 'by_relationship',
        clusterRelationshipKind: 'at_war_with'
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      // f1 and f2 share 'enemy' as target, so they get same cluster
      // f3 shares f1 as target (which is in the f1-f2 cluster)
      // So all might end up clustered together
      expect(result.entitiesModified.length).toBeGreaterThanOrEqual(2);
    });

    it('should respect minClusterSize', () => {
      const f1 = createFaction('f1');
      const f2 = createFaction('f2');
      addEntity(f1);
      addEntity(f2);
      addRelationship('at_war_with', 'f1', 'f2');

      const config: ThresholdTriggerConfig = {
        id: 'large_war_trigger',
        name: 'Large War Trigger',
        entityFilter: { kind: 'faction' },
        conditions: [{
          type: 'relationship_count',
          relationshipKind: 'at_war_with',
          minCount: 1
        }],
        actions: [{ type: 'set_cluster_tag', tag: 'major_war' }],
        clusterMode: 'all_matching',
        minClusterSize: 3  // Need at least 3 factions
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      // Only 2 factions, cluster too small
      expect(result.entitiesModified.length).toBe(0);
      expect(result.description).toContain('too small');
    });
  });

  describe('actions', () => {
    it('should set boolean tags', () => {
      const f1 = createFaction('f1');
      addEntity(f1);

      const config: ThresholdTriggerConfig = {
        id: 'bool_tag_trigger',
        name: 'Bool Tag Trigger',
        entityFilter: { kind: 'faction' },
        conditions: [],
        actions: [{ type: 'set_tag', tag: 'active_conflict', tagValue: true }]
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified[0].changes.tags).toEqual({ active_conflict: true });
    });

    it('should set string tag values', () => {
      const f1 = createFaction('f1');
      addEntity(f1);

      const config: ThresholdTriggerConfig = {
        id: 'string_tag_trigger',
        name: 'String Tag Trigger',
        entityFilter: { kind: 'faction' },
        conditions: [],
        actions: [{ type: 'set_tag', tag: 'state', tagValue: 'war_brewing' }]
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified[0].changes.tags).toEqual({ state: 'war_brewing' });
    });

    it('should remove tags', () => {
      const f1 = createFaction('f1', 'active', { old_state: true });
      addEntity(f1);

      const config: ThresholdTriggerConfig = {
        id: 'remove_tag_trigger',
        name: 'Remove Tag Trigger',
        entityFilter: { kind: 'faction', hasTag: 'old_state' },
        conditions: [],
        actions: [{ type: 'remove_tag', tag: 'old_state' }]
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].changes.tags).not.toHaveProperty('old_state');
    });

    it('should create relationships between matching entities', () => {
      const f1 = createFaction('f1', 'active', { war_brewing: 'cluster1' });
      const f2 = createFaction('f2', 'active', { war_brewing: 'cluster1' });
      addEntity(f1);
      addEntity(f2);

      const config: ThresholdTriggerConfig = {
        id: 'rivalry_trigger',
        name: 'Rivalry Trigger',
        entityFilter: { kind: 'faction', hasTag: 'war_brewing' },
        conditions: [],
        actions: [{
          type: 'create_relationship',
          relationshipKind: 'rival_of',
          relationshipStrength: 0.7,
          betweenMatching: true
        }],
        clusterMode: 'all_matching'
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.relationshipsAdded.length).toBe(1);
      expect(result.relationshipsAdded[0].kind).toBe('rival_of');
      expect(result.relationshipsAdded[0].strength).toBe(0.7);
    });

    it('should apply pressure changes', () => {
      const f1 = createFaction('f1');
      addEntity(f1);

      const config: ThresholdTriggerConfig = {
        id: 'pressure_trigger',
        name: 'Pressure Trigger',
        entityFilter: { kind: 'faction' },
        conditions: [],
        actions: [{ type: 'set_tag', tag: 'triggered' }],
        pressureChanges: { conflict: 10, stability: -5 }
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.pressureChanges).toEqual({ conflict: 10, stability: -5 });
    });

    it('should apply modify_pressure action', () => {
      const f1 = createFaction('f1');
      addEntity(f1);

      const config: ThresholdTriggerConfig = {
        id: 'pressure_action_trigger',
        name: 'Pressure Action Trigger',
        entityFilter: { kind: 'faction' },
        conditions: [],
        actions: [
          { type: 'modify_pressure', pressureId: 'conflict', delta: 15 },
          { type: 'modify_pressure', pressureId: 'stability', delta: -10 }
        ]
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.pressureChanges).toEqual({ conflict: 15, stability: -10 });
    });
  });

  describe('throttling and cooldown', () => {
    it('should throttle execution based on throttleChance', () => {
      const f1 = createFaction('f1');
      addEntity(f1);

      const config: ThresholdTriggerConfig = {
        id: 'throttled_trigger',
        name: 'Throttled Trigger',
        entityFilter: { kind: 'faction' },
        conditions: [],
        actions: [{ type: 'set_tag', tag: 'triggered' }],
        throttleChance: 0.1  // Only 10% of ticks
      };

      const system = createThresholdTriggerSystem(config);

      let executions = 0;
      for (let i = 0; i < 100; i++) {
        const freshGraph = createTestGraph();
        (freshGraph as any)._loadEntity('f1', createFaction('f1'));
        const freshView = new TemplateGraphView(freshGraph, new TargetSelector(), mockCoordinateContext);
        const result = system.apply(freshView, 1.0);
        if (!result.description.includes('dormant')) executions++;
      }

      expect(executions).toBeLessThan(30);
      expect(executions).toBeGreaterThan(0);
    });

    it('should skip entities with cooldown tag', () => {
      const f1 = createFaction('f1', 'active', { recently_triggered: true });
      const f2 = createFaction('f2', 'active');
      addEntity(f1);
      addEntity(f2);

      const config: ThresholdTriggerConfig = {
        id: 'cooldown_trigger',
        name: 'Cooldown Trigger',
        entityFilter: { kind: 'faction' },
        conditions: [],
        actions: [{ type: 'set_tag', tag: 'triggered' }],
        cooldownTag: 'recently_triggered'
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      // Only f2 should be triggered (f1 has cooldown tag)
      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('f2');
    });
  });

  describe('entity filter', () => {
    it('should filter by notStatus', () => {
      const f1 = createFaction('f1', 'active');
      const f2 = createFaction('f2', 'historical');
      addEntity(f1);
      addEntity(f2);

      const config: ThresholdTriggerConfig = {
        id: 'active_only',
        name: 'Active Only',
        entityFilter: { kind: 'faction', notStatus: 'historical' },
        conditions: [],
        actions: [{ type: 'set_tag', tag: 'processed' }]
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('f1');
    });

    it('should filter by notHasTag', () => {
      const f1 = createFaction('f1', 'active', { already_processed: true });
      const f2 = createFaction('f2', 'active');
      addEntity(f1);
      addEntity(f2);

      const config: ThresholdTriggerConfig = {
        id: 'unprocessed_only',
        name: 'Unprocessed Only',
        entityFilter: { kind: 'faction', notHasTag: 'already_processed' },
        conditions: [],
        actions: [{ type: 'set_tag', tag: 'processed' }]
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('f2');
    });
  });

  describe('real-world scenarios', () => {
    it('should detect war brewing conditions', () => {
      // Setup: Multiple factions at war
      const f1 = createFaction('f1');
      const f2 = createFaction('f2');
      const f3 = createFaction('f3');
      addEntity(f1);
      addEntity(f2);
      addEntity(f3);
      addRelationship('at_war_with', 'f1', 'f2');
      addRelationship('at_war_with', 'f2', 'f3');

      const config: ThresholdTriggerConfig = {
        id: 'war_brewing_detector',
        name: 'War Brewing Detector',
        description: 'Detects factions engaged in conflicts and tags them for war occurrence creation',
        entityFilter: { kind: 'faction', notHasTag: 'war_brewing' },
        conditions: [{
          type: 'relationship_count',
          relationshipKind: 'at_war_with',
          minCount: 1
        }],
        actions: [
          { type: 'set_cluster_tag', tag: 'war_brewing' }
        ],
        clusterMode: 'by_relationship',
        clusterRelationshipKind: 'at_war_with',
        minClusterSize: 2,
        pressureChanges: { conflict: 10 }
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      // All 3 factions are connected via at_war_with
      expect(result.entitiesModified.length).toBeGreaterThanOrEqual(2);
      expect(result.pressureChanges.conflict).toBe(10);

      // All should have war_brewing tag with cluster ID
      const tags = result.entitiesModified.map(m => m.changes.tags?.war_brewing);
      expect(tags.every(t => typeof t === 'string' && t.startsWith('cluster_'))).toBe(true);
    });

    it('should detect power vacuum conditions', () => {
      // Setup: Faction with dead leader
      const faction = createFaction('f1', 'active');
      const deadLeader = createNPC('leader1', 'dead');
      addEntity(faction);
      addEntity(deadLeader);
      addRelationship('leader_of', 'leader1', 'f1');

      const config: ThresholdTriggerConfig = {
        id: 'power_vacuum_detector',
        name: 'Power Vacuum Detector',
        description: 'Detects factions with dead leaders',
        entityFilter: { kind: 'faction', status: 'active', notHasTag: 'power_vacuum' },
        conditions: [{
          type: 'relationship_exists',
          relationshipKind: 'leader_of',
          relationshipDirection: 'dst',
          targetKind: 'npc',
          targetStatus: 'dead'
        }],
        actions: [
          { type: 'set_tag', tag: 'power_vacuum', tagValue: true }
        ],
        pressureChanges: { stability: -15, conflict: 10 }
      };

      const system = createThresholdTriggerSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].changes.tags).toEqual({ power_vacuum: true });
      expect(result.pressureChanges).toEqual({ stability: -15, conflict: 10 });
    });
  });
});
