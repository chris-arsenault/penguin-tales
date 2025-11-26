// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { succession } from '../../../../../domain/penguin/templates/npc/succession';
import { TemplateGraphView } from '../../../../../apps/lore-weave/lib/services/templateGraphView';
import { Graph, Era, ComponentPurpose } from '../../../../../apps/lore-weave/lib/types/engine';
import { HardState } from '../../../../../apps/lore-weave/lib/types/worldTypes';

describe('succession template', () => {
  let mockGraph: Graph;
  let mockGraphView: TemplateGraphView;
  let mockEra: Era;

  beforeEach(() => {
    mockEra = {
      id: 'test-era',
      name: 'Test Era',
      templateWeights: {},
      systemModifiers: {}
    };

    mockGraph = {
      entities: new Map(),
      relationships: [],
      tick: 60,
      currentEra: mockEra,
      pressures: new Map([['stability', 50]]),
      history: [],
      config: {} as any,
      relationshipCooldowns: new Map(),
      discoveryState: {
        discoveredSites: new Map(),
        siteOccurrences: new Map()
      }
    };

    mockGraphView = new TemplateGraphView(mockGraph);
  });

  describe('contract and metadata', () => {
    it('should have correct id', () => {
      expect(succession.id).toBe('succession');
    });

    it('should have correct name', () => {
      expect(succession.name).toBe('Leadership Succession');
    });

    it('should have contract with entity creation purpose', () => {
      expect(succession.contract.purpose).toBe(ComponentPurpose.ENTITY_CREATION);
    });

    it('should require at least 1 NPC to be enabled', () => {
      expect(succession.contract.enabledBy.entityCounts).toContainEqual({
        kind: 'npc',
        min: 1
      });
    });

    it('should create exactly 1 NPC', () => {
      const npcAffect = succession.contract.affects.entities.find(e => e.kind === 'npc');
      expect(npcAffect).toBeDefined();
      expect(npcAffect!.count).toEqual({ min: 1, max: 1 });
    });

    it('should affect stability pressure', () => {
      const stabilityAffect = succession.contract.affects.pressures.find(p => p.name === 'stability');
      expect(stabilityAffect).toBeDefined();
      expect(stabilityAffect!.delta).toBe(-1);
    });

    it('should have metadata with mayor subtype', () => {
      expect(succession.metadata.produces.entityKinds[0]).toMatchObject({
        kind: 'npc',
        subtype: 'mayor',
        count: { min: 1, max: 1 }
      });
    });

    it('should have succession and leadership-change tags', () => {
      expect(succession.metadata.tags).toContain('succession');
      expect(succession.metadata.tags).toContain('leadership-change');
    });
  });

  describe('canApply', () => {
    it('should return false for empty graph', () => {
      expect(succession.canApply(mockGraphView)).toBe(false);
    });

    it('should return false when no mayors exist', () => {
      const merchant: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Test Merchant',
        description: 'A merchant',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };
      mockGraph.entities.set('npc-1', merchant);
      mockGraphView = new TemplateGraphView(mockGraph);

      expect(succession.canApply(mockGraphView)).toBe(false);
    });

    it('should return true when a mayor is dead', () => {
      const deadMayor: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'mayor',
        name: 'Dead Mayor',
        description: 'Former leader',
        status: 'dead',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 10
      };
      mockGraph.entities.set('npc-1', deadMayor);
      mockGraphView = new TemplateGraphView(mockGraph);

      expect(succession.canApply(mockGraphView)).toBe(true);
    });

    it('should return true after tick 50 even if mayors are alive', () => {
      const aliveMayor: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'mayor',
        name: 'Alive Mayor',
        description: 'Current leader',
        status: 'alive',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 10
      };
      mockGraph.entities.set('npc-1', aliveMayor);
      mockGraph.tick = 60;
      mockGraphView = new TemplateGraphView(mockGraph);

      expect(succession.canApply(mockGraphView)).toBe(true);
    });

    it('should return false before tick 50 with only alive mayors', () => {
      const aliveMayor: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'mayor',
        name: 'Young Mayor',
        description: 'New leader',
        status: 'alive',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 5,
        updatedAt: 5
      };
      mockGraph.entities.set('npc-1', aliveMayor);
      mockGraph.tick = 30;
      mockGraphView = new TemplateGraphView(mockGraph);

      expect(succession.canApply(mockGraphView)).toBe(false);
    });
  });

  describe('findTargets', () => {
    it('should return empty array when no mayors exist', () => {
      const targets = succession.findTargets!(mockGraphView);
      expect(targets).toEqual([]);
    });

    it('should return dead mayors', () => {
      const deadMayor: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'mayor',
        name: 'Dead Mayor',
        description: 'Former leader',
        status: 'dead',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 10
      };
      mockGraph.entities.set('npc-1', deadMayor);
      mockGraphView = new TemplateGraphView(mockGraph);

      const targets = succession.findTargets!(mockGraphView);
      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe('npc-1');
    });

    it('should return old mayors (created >40 ticks ago)', () => {
      const oldMayor: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'mayor',
        name: 'Old Mayor',
        description: 'Elderly leader',
        status: 'alive',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 5,
        updatedAt: 5
      };
      mockGraph.entities.set('npc-1', oldMayor);
      mockGraph.tick = 60;
      mockGraphView = new TemplateGraphView(mockGraph);

      const targets = succession.findTargets!(mockGraphView);
      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe('npc-1');
    });

    it('should not return young mayors', () => {
      const youngMayor: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'mayor',
        name: 'Young Mayor',
        description: 'New leader',
        status: 'alive',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 55,
        updatedAt: 55
      };
      mockGraph.entities.set('npc-1', youngMayor);
      mockGraph.tick = 60;
      mockGraphView = new TemplateGraphView(mockGraph);

      const targets = succession.findTargets!(mockGraphView);
      expect(targets).toEqual([]);
    });
  });

  describe('expand', () => {
    it('should return empty result when no mayors exist', () => {
      const result = succession.expand(mockGraphView);
      expect(result.entities).toEqual([]);
      expect(result.relationships).toEqual([]);
      expect(result.description).toBe('No mayor to succeed');
    });

    it('should return empty result when target mayor has no colony', () => {
      const mayorWithoutColony: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'mayor',
        name: 'Isolated Mayor',
        description: 'Leader without colony',
        status: 'dead',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 10
      };
      mockGraph.entities.set('npc-1', mayorWithoutColony);
      mockGraphView = new TemplateGraphView(mockGraph);

      const result = succession.expand(mockGraphView, mayorWithoutColony);
      expect(result.entities).toEqual([]);
      expect(result.relationships).toEqual([]);
      expect(result.description).toContain('had no colony to succeed');
    });

    it('should create new mayor succeeding old mayor in colony', () => {
      const leaderOfRel = {
        kind: 'leader_of',
        src: 'npc-1',
        dst: 'loc-1'
      };

      const oldMayor: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'mayor',
        name: 'Old Mayor',
        description: 'Former leader',
        status: 'dead',
        prominence: 'recognized',
        tags: [],
        links: [leaderOfRel],
        createdAt: 0,
        updatedAt: 10
      };

      const colony: HardState = {
        id: 'loc-1',
        kind: 'location',
        subtype: 'colony',
        name: 'Test Colony',
        description: 'A settlement',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [leaderOfRel],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('npc-1', oldMayor);
      mockGraph.entities.set('loc-1', colony);
      mockGraph.relationships.push(leaderOfRel);
      mockGraphView = new TemplateGraphView(mockGraph);

      const result = succession.expand(mockGraphView, oldMayor);

      expect(result.entities).toHaveLength(1);
      const newMayor = result.entities[0];
      expect(newMayor.kind).toBe('npc');
      expect(newMayor.subtype).toBe('mayor');
      expect(newMayor.status).toBe('alive');
      expect(newMayor.prominence).toBe('marginal');
      expect(newMayor.tags).toContain('successor');
      expect(newMayor.description).toContain('Old Mayor');
      expect(newMayor.description).toContain('Test Colony');
    });

    it('should create leader_of and resident_of relationships', () => {
      const leaderOfRel = {
        kind: 'leader_of',
        src: 'npc-1',
        dst: 'loc-1'
      };

      const oldMayor: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'mayor',
        name: 'Old Mayor',
        description: 'Former leader',
        status: 'dead',
        prominence: 'recognized',
        tags: [],
        links: [leaderOfRel],
        createdAt: 0,
        updatedAt: 10
      };

      const colony: HardState = {
        id: 'loc-1',
        kind: 'location',
        subtype: 'colony',
        name: 'Test Colony',
        description: 'A settlement',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [leaderOfRel],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('npc-1', oldMayor);
      mockGraph.entities.set('loc-1', colony);
      mockGraph.relationships.push(leaderOfRel);
      mockGraphView = new TemplateGraphView(mockGraph);

      const result = succession.expand(mockGraphView, oldMayor);

      expect(result.relationships).toHaveLength(2);
      expect(result.relationships).toContainEqual({
        kind: 'leader_of',
        src: 'will-be-assigned-0',
        dst: 'loc-1'
      });
      expect(result.relationships).toContainEqual({
        kind: 'resident_of',
        src: 'will-be-assigned-0',
        dst: 'loc-1'
      });
    });

    it('should also succeed faction leadership if old mayor led faction', () => {
      const colonyRel = { kind: 'leader_of', src: 'npc-1', dst: 'loc-1' };
      const factionRel = { kind: 'leader_of', src: 'npc-1', dst: 'fac-1' };

      const oldMayor: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'mayor',
        name: 'Old Mayor',
        description: 'Former leader',
        status: 'dead',
        prominence: 'recognized',
        tags: [],
        links: [colonyRel, factionRel],
        createdAt: 0,
        updatedAt: 10
      };

      const colony: HardState = {
        id: 'loc-1',
        kind: 'location',
        subtype: 'colony',
        name: 'Test Colony',
        description: 'A settlement',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [colonyRel],
        createdAt: 0,
        updatedAt: 0
      };

      const faction: HardState = {
        id: 'fac-1',
        kind: 'faction',
        subtype: 'merchant',
        name: 'Merchant Guild',
        description: 'Trade organization',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [factionRel],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('npc-1', oldMayor);
      mockGraph.entities.set('loc-1', colony);
      mockGraph.entities.set('fac-1', faction);
      mockGraph.relationships.push(colonyRel, factionRel);
      mockGraphView = new TemplateGraphView(mockGraph);

      const result = succession.expand(mockGraphView, oldMayor);

      expect(result.relationships).toHaveLength(4);
      expect(result.relationships).toContainEqual({
        kind: 'leader_of',
        src: 'will-be-assigned-0',
        dst: 'fac-1'
      });
      expect(result.relationships).toContainEqual({
        kind: 'member_of',
        src: 'will-be-assigned-0',
        dst: 'fac-1'
      });
    });

    it('should generate descriptive text mentioning succession', () => {
      const leaderOfRel = {
        kind: 'leader_of',
        src: 'npc-1',
        dst: 'loc-1'
      };

      const oldMayor: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'mayor',
        name: 'Old Mayor',
        description: 'Former leader',
        status: 'dead',
        prominence: 'recognized',
        tags: [],
        links: [leaderOfRel],
        createdAt: 0,
        updatedAt: 10
      };

      const colony: HardState = {
        id: 'loc-1',
        kind: 'location',
        subtype: 'colony',
        name: 'Test Colony',
        description: 'A settlement',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [leaderOfRel],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('npc-1', oldMayor);
      mockGraph.entities.set('loc-1', colony);
      mockGraph.relationships.push(leaderOfRel);
      mockGraphView = new TemplateGraphView(mockGraph);

      const result = succession.expand(mockGraphView, oldMayor);

      // Check that description is about succession (either "succeeds" or contains mayor/colony names)
      const hasSuccession = result.description.includes('succeed');
      const hasMayor = result.description.includes('Old Mayor');
      const hasColony = result.description.includes('Test Colony');

      expect(hasSuccession || (hasMayor && hasColony)).toBe(true);
    });
  });
});
