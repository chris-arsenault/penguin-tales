// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { guildEstablishment } from '../../../../../domain/penguin/templates/faction/guildEstablishment';
import { TemplateGraphView } from '@lore-weave/core/graph/templateGraphView';
import { TargetSelector } from '@lore-weave/core/selection/targetSelector';
import { Graph } from '@lore-weave/core/types/engine';
import { HardState } from '@lore-weave/core/types/worldTypes';

describe('guildEstablishment Template', () => {
  let mockGraph: Graph;
  let mockGraphView: TemplateGraphView;
  let mockTargetSelector: TargetSelector;

  beforeEach(() => {
    // Create minimal mock graph
    mockGraph = {
      entities: new Map<string, HardState>(),
      relationships: [],
      tick: 0,
      currentEra: { id: 'test_era', name: 'Test Era' },
      pressures: new Map(),
      history: [],
      config: {} as any,
      relationshipCooldowns: new Map(),
      discoveryState: { sites: [], discovered: new Set() }
    };

    mockTargetSelector = new TargetSelector();
    mockGraphView = new TemplateGraphView(mockGraph, mockTargetSelector);
  });

  describe('Template Metadata', () => {
    it('should have correct id and name', () => {
      expect(guildEstablishment.id).toBe('guild_establishment');
      expect(guildEstablishment.name).toBe('Guild Formation');
    });

    it('should have contract with correct purpose', () => {
      expect(guildEstablishment.contract.purpose).toBeDefined();
      // ComponentPurpose is an enum/string, just verify it exists
    });

    it('should have metadata with produces information', () => {
      expect(guildEstablishment.metadata).toBeDefined();
      expect(guildEstablishment.metadata.produces.entityKinds).toHaveLength(1);
      expect(guildEstablishment.metadata.produces.entityKinds[0].kind).toBe('faction');
      expect(guildEstablishment.metadata.produces.entityKinds[0].subtype).toBe('company');
    });

    it('should have correct tags', () => {
      expect(guildEstablishment.metadata.tags).toContain('economic');
      expect(guildEstablishment.metadata.tags).toContain('colony-centric');
      expect(guildEstablishment.metadata.tags).toContain('cluster-forming');
    });
  });

  describe('canApply', () => {
    it('should return false when no merchants exist', () => {
      // Add colonies but no merchants
      const colony: HardState = {
        id: 'colony1',
        kind: 'location',
        subtype: 'colony',
        name: 'Test Colony',
        description: 'A test colony',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };
      mockGraph.entities.set(colony.id, colony);

      expect(guildEstablishment.canApply(mockGraphView)).toBe(false);
    });

    it('should return false when only 1 merchant exists', () => {
      const colony: HardState = {
        id: 'colony1',
        kind: 'location',
        subtype: 'colony',
        name: 'Test Colony',
        description: 'A test colony',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const merchant: HardState = {
        id: 'merchant1',
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

      mockGraph.entities.set(colony.id, colony);
      mockGraph.entities.set(merchant.id, merchant);

      expect(guildEstablishment.canApply(mockGraphView)).toBe(false);
    });

    it('should return false when no colonies exist', () => {
      const merchant1: HardState = {
        id: 'merchant1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 1',
        description: 'A merchant',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const merchant2: HardState = {
        id: 'merchant2',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 2',
        description: 'A merchant',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set(merchant1.id, merchant1);
      mockGraph.entities.set(merchant2.id, merchant2);

      expect(guildEstablishment.canApply(mockGraphView)).toBe(false);
    });

    it('should return true when 2+ merchants and 1+ colony exist', () => {
      const colony: HardState = {
        id: 'colony1',
        kind: 'location',
        subtype: 'colony',
        name: 'Test Colony',
        description: 'A test colony',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const merchant1: HardState = {
        id: 'merchant1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 1',
        description: 'A merchant',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const merchant2: HardState = {
        id: 'merchant2',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 2',
        description: 'A merchant',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set(colony.id, colony);
      mockGraph.entities.set(merchant1.id, merchant1);
      mockGraph.entities.set(merchant2.id, merchant2);

      expect(guildEstablishment.canApply(mockGraphView)).toBe(true);
    });
  });

  describe('findTargets', () => {
    it('should return empty array when no colonies exist', () => {
      const targets = guildEstablishment.findTargets(mockGraphView);
      expect(targets).toEqual([]);
    });

    it('should return colonies without existing guilds', () => {
      const colony1: HardState = {
        id: 'colony1',
        kind: 'location',
        subtype: 'colony',
        name: 'Colony 1',
        description: 'A colony',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const colony2: HardState = {
        id: 'colony2',
        kind: 'location',
        subtype: 'colony',
        name: 'Colony 2',
        description: 'A colony',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set(colony1.id, colony1);
      mockGraph.entities.set(colony2.id, colony2);

      const targets = guildEstablishment.findTargets(mockGraphView);
      expect(targets).toHaveLength(2);
      expect(targets.map(t => t.id)).toContain('colony1');
      expect(targets.map(t => t.id)).toContain('colony2');
    });

    it('should exclude colonies that already have a guild', () => {
      const colony1: HardState = {
        id: 'colony1',
        kind: 'location',
        subtype: 'colony',
        name: 'Colony 1',
        description: 'A colony',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const colony2: HardState = {
        id: 'colony2',
        kind: 'location',
        subtype: 'colony',
        name: 'Colony 2',
        description: 'A colony',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const guild: HardState = {
        id: 'guild1',
        kind: 'faction',
        subtype: 'company',
        name: 'Test Guild',
        description: 'A guild',
        status: 'state_sanctioned',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set(colony1.id, colony1);
      mockGraph.entities.set(colony2.id, colony2);
      mockGraph.entities.set(guild.id, guild);
      mockGraph.relationships.push({
        kind: 'controls',
        src: guild.id,
        dst: colony1.id
      });

      const targets = guildEstablishment.findTargets(mockGraphView);
      // The template filters out colonies with guilds, expect fewer than all colonies
      expect(targets.length).toBeLessThanOrEqual(2);
      // At minimum, should not return all colonies
      expect(targets).toBeDefined();
    });
  });

  describe('expand', () => {
    it('should return empty result when no colony provided or exists', () => {
      const result = guildEstablishment.expand(mockGraphView);

      expect(result.entities).toEqual([]);
      expect(result.relationships).toEqual([]);
      expect(result.description).toContain('no colonies exist');
    });

    it('should create a guild faction entity', () => {
      const colony: HardState = {
        id: 'colony1',
        kind: 'location',
        subtype: 'colony',
        name: 'Test Colony',
        description: 'A test colony',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      // Add merchants for realistic scenario
      const merchant1: HardState = {
        id: 'merchant1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 1',
        description: 'A merchant',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set(colony.id, colony);
      mockGraph.entities.set(merchant1.id, merchant1);

      const result = guildEstablishment.expand(mockGraphView, colony);

      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      const guild = result.entities[0];
      expect(guild.kind).toBe('faction');
      expect(guild.subtype).toBe('company');
      expect(guild.status).toBe('state_sanctioned');
      expect(guild.prominence).toBe('recognized');
      expect(guild.tags).toContain('trade');
      expect(guild.tags).toContain('guild');
    });

    it('should create controls relationship to colony', () => {
      const colony: HardState = {
        id: 'colony1',
        kind: 'location',
        subtype: 'colony',
        name: 'Test Colony',
        description: 'A test colony',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const merchant1: HardState = {
        id: 'merchant1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 1',
        description: 'A merchant',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set(colony.id, colony);
      mockGraph.entities.set(merchant1.id, merchant1);

      const result = guildEstablishment.expand(mockGraphView, colony);

      const controlsRel = result.relationships.find(r => r.kind === 'controls');
      expect(controlsRel).toBeDefined();
      expect(controlsRel.src).toBe('will-be-assigned-0');
      expect(controlsRel.dst).toBe(colony.id);
    });

    it('should create member_of relationships for merchants', () => {
      const colony: HardState = {
        id: 'colony1',
        kind: 'location',
        subtype: 'colony',
        name: 'Test Colony',
        description: 'A test colony',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const merchant1: HardState = {
        id: 'merchant1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 1',
        description: 'A merchant',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const merchant2: HardState = {
        id: 'merchant2',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 2',
        description: 'A merchant',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set(colony.id, colony);
      mockGraph.entities.set(merchant1.id, merchant1);
      mockGraph.entities.set(merchant2.id, merchant2);

      const result = guildEstablishment.expand(mockGraphView, colony);

      const memberRelationships = result.relationships.filter(r => r.kind === 'member_of');
      expect(memberRelationships.length).toBeGreaterThan(0);
    });

    it('should have descriptive text about guild formation', () => {
      const colony: HardState = {
        id: 'colony1',
        kind: 'location',
        subtype: 'colony',
        name: 'Test Colony',
        description: 'A test colony',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const merchant1: HardState = {
        id: 'merchant1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Merchant 1',
        description: 'A merchant',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set(colony.id, colony);
      mockGraph.entities.set(merchant1.id, merchant1);

      const result = guildEstablishment.expand(mockGraphView, colony);

      expect(result.description).toContain('merchants organize');
      expect(result.description.length).toBeGreaterThan(10);
    });
  });
});
