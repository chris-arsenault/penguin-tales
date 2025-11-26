// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { outlawRecruitment } from '../../../../../domain/penguin/templates/npc/outlawRecruitment';
import { TemplateGraphView } from '@lore-weave/core/services/templateGraphView';
import { TargetSelector } from '@lore-weave/core/services/targetSelector';
import { Graph, Era } from '@lore-weave/core/types/engine';
import { HardState } from '@lore-weave/core/types/worldTypes';

describe('outlawRecruitment template', () => {
  let mockGraph: Graph;
  let mockGraphView: TemplateGraphView;
  let mockEra: Era;
  let targetSelector: TargetSelector;

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
      tick: 10,
      currentEra: mockEra,
      pressures: new Map(),
      history: [],
      config: {} as any,
      relationshipCooldowns: new Map(),
      discoveryState: {
        discoveredSites: new Map(),
        siteOccurrences: new Map()
      }
    };

    // Create a TargetSelector instance
    targetSelector = new TargetSelector({} as any);
    mockGraphView = new TemplateGraphView(mockGraph, targetSelector);
  });

  describe('contract and metadata', () => {
    it('should have correct id', () => {
      expect(outlawRecruitment.id).toBe('outlaw_recruitment');
    });

    it('should have correct name', () => {
      expect(outlawRecruitment.name).toBe('Criminal Recruitment');
    });

    it('should have metadata defining outlaws as produced entities', () => {
      const entityKind = outlawRecruitment.metadata.produces.entityKinds[0];
      expect(entityKind.kind).toBe('npc');
      expect(entityKind.subtype).toBe('outlaw');
      expect(entityKind.count).toEqual({ min: 1, max: 2 });
    });

    it('should have configurable parameters for number of outlaws', () => {
      expect(outlawRecruitment.metadata.parameters).toBeDefined();
      expect(outlawRecruitment.metadata.parameters!.numOutlawsMin).toBeDefined();
      expect(outlawRecruitment.metadata.parameters!.numOutlawsMax).toBeDefined();
    });

    it('should have criminal and faction-expansion tags', () => {
      expect(outlawRecruitment.metadata.tags).toContain('criminal');
      expect(outlawRecruitment.metadata.tags).toContain('faction-expansion');
    });

    it('should indicate high cluster formation effect', () => {
      expect(outlawRecruitment.metadata.effects.clusterFormation).toBe(0.7);
    });
  });

  describe('canApply', () => {
    it('should return false when no criminal factions exist', () => {
      expect(outlawRecruitment.canApply(mockGraphView)).toBe(false);
    });

    it('should return false when only non-criminal factions exist', () => {
      const merchantFaction: HardState = {
        id: 'fac-1',
        kind: 'faction',
        subtype: 'merchant',
        name: 'Merchant Guild',
        description: 'Trade organization',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };
      mockGraph.entities.set('fac-1', merchantFaction);
      mockGraphView = new TemplateGraphView(mockGraph, targetSelector);

      expect(outlawRecruitment.canApply(mockGraphView)).toBe(false);
    });

    it('should return true when at least one criminal faction exists', () => {
      const criminalFaction: HardState = {
        id: 'fac-1',
        kind: 'faction',
        subtype: 'criminal',
        name: 'Ice Syndicate',
        description: 'Criminal organization',
        status: 'active',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };
      mockGraph.entities.set('fac-1', criminalFaction);
      mockGraphView = new TemplateGraphView(mockGraph, targetSelector);

      expect(outlawRecruitment.canApply(mockGraphView)).toBe(true);
    });

    it('should return true when multiple criminal factions exist', () => {
      const faction1: HardState = {
        id: 'fac-1',
        kind: 'faction',
        subtype: 'criminal',
        name: 'Ice Syndicate',
        description: 'Criminal organization',
        status: 'active',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const faction2: HardState = {
        id: 'fac-2',
        kind: 'faction',
        subtype: 'criminal',
        name: 'Krill Cartel',
        description: 'Smuggling network',
        status: 'active',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('fac-1', faction1);
      mockGraph.entities.set('fac-2', faction2);
      mockGraphView = new TemplateGraphView(mockGraph, targetSelector);

      expect(outlawRecruitment.canApply(mockGraphView)).toBe(true);
    });
  });

  describe('findTargets', () => {
    it('should return empty array when no criminal factions exist', () => {
      const targets = outlawRecruitment.findTargets!(mockGraphView);
      expect(targets).toEqual([]);
    });

    it('should return all criminal factions', () => {
      const faction1: HardState = {
        id: 'fac-1',
        kind: 'faction',
        subtype: 'criminal',
        name: 'Ice Syndicate',
        description: 'Criminal organization',
        status: 'active',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const faction2: HardState = {
        id: 'fac-2',
        kind: 'faction',
        subtype: 'criminal',
        name: 'Krill Cartel',
        description: 'Smuggling network',
        status: 'active',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const merchantFaction: HardState = {
        id: 'fac-3',
        kind: 'faction',
        subtype: 'merchant',
        name: 'Trade Guild',
        description: 'Legal trade',
        status: 'active',
        prominence: 'recognized',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('fac-1', faction1);
      mockGraph.entities.set('fac-2', faction2);
      mockGraph.entities.set('fac-3', merchantFaction);
      mockGraphView = new TemplateGraphView(mockGraph, targetSelector);

      const targets = outlawRecruitment.findTargets!(mockGraphView);
      expect(targets).toHaveLength(2);
      expect(targets.map(t => t.id)).toContain('fac-1');
      expect(targets.map(t => t.id)).toContain('fac-2');
      expect(targets.map(t => t.id)).not.toContain('fac-3');
    });
  });

  describe('expand', () => {
    it('should return empty result when no criminal factions exist', () => {
      const result = outlawRecruitment.expand(mockGraphView);
      expect(result.entities).toEqual([]);
      expect(result.relationships).toEqual([]);
      expect(result.description).toContain('no criminal factions');
    });

    it('should return empty result when faction has no location', () => {
      const criminalFaction: HardState = {
        id: 'fac-1',
        kind: 'faction',
        subtype: 'criminal',
        name: 'Ice Syndicate',
        description: 'Criminal organization',
        status: 'active',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };
      mockGraph.entities.set('fac-1', criminalFaction);
      mockGraphView = new TemplateGraphView(mockGraph, targetSelector);

      const result = outlawRecruitment.expand(mockGraphView, criminalFaction);
      expect(result.entities).toEqual([]);
      expect(result.relationships).toEqual([]);
      expect(result.description).toContain('nowhere to recruit');
    });

    it('should use faction-controlled location if available', () => {
      const controlsRel = {
        kind: 'controls',
        src: 'fac-1',
        dst: 'loc-1'
      };

      const criminalFaction: HardState = {
        id: 'fac-1',
        kind: 'faction',
        subtype: 'criminal',
        name: 'Ice Syndicate',
        description: 'Criminal organization',
        status: 'active',
        prominence: 'marginal',
        tags: [],
        links: [controlsRel],
        createdAt: 0,
        updatedAt: 0
      };

      const stronghold: HardState = {
        id: 'loc-1',
        kind: 'location',
        subtype: 'stronghold',
        name: 'Hidden Lair',
        description: 'Secret hideout',
        status: 'active',
        prominence: 'marginal',
        tags: [],
        links: [controlsRel],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('fac-1', criminalFaction);
      mockGraph.entities.set('loc-1', stronghold);
      mockGraph.relationships.push(controlsRel);
      mockGraphView = new TemplateGraphView(mockGraph, targetSelector);

      // Mock selectTargets to return created entities
      vi.spyOn(mockGraphView, 'selectTargets').mockReturnValue({
        existing: [],
        created: [
          {
            kind: 'npc',
            subtype: 'outlaw',
            name: 'Test Outlaw',
            description: 'A recruit',
            status: 'alive',
            prominence: 'marginal',
            tags: ['criminal', 'recruit']
          }
        ]
      });

      const result = outlawRecruitment.expand(mockGraphView, criminalFaction);

      expect(result.entities.length).toBeGreaterThan(0);
      expect(result.description).toContain('Ice Syndicate');
      expect(result.description).toContain('recruits');
    });

    it('should fallback to any colony if faction has no stronghold', () => {
      const criminalFaction: HardState = {
        id: 'fac-1',
        kind: 'faction',
        subtype: 'criminal',
        name: 'Ice Syndicate',
        description: 'Criminal organization',
        status: 'active',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
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
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('fac-1', criminalFaction);
      mockGraph.entities.set('loc-1', colony);
      mockGraphView = new TemplateGraphView(mockGraph, targetSelector);

      // Mock selectTargets to return created entities
      vi.spyOn(mockGraphView, 'selectTargets').mockReturnValue({
        existing: [],
        created: [
          {
            kind: 'npc',
            subtype: 'outlaw',
            name: 'Test Outlaw',
            description: 'A recruit',
            status: 'alive',
            prominence: 'marginal',
            tags: ['criminal', 'recruit']
          }
        ]
      });

      const result = outlawRecruitment.expand(mockGraphView, criminalFaction);

      expect(result.entities.length).toBeGreaterThan(0);
    });

    it('should create relationships for existing NPCs recruited', () => {
      const criminalFaction: HardState = {
        id: 'fac-1',
        kind: 'faction',
        subtype: 'criminal',
        name: 'Ice Syndicate',
        description: 'Criminal organization',
        status: 'active',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
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
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      const existingNpc: HardState = {
        id: 'npc-1',
        kind: 'npc',
        subtype: 'merchant',
        name: 'Corrupt Merchant',
        description: 'A turncoat',
        status: 'alive',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('fac-1', criminalFaction);
      mockGraph.entities.set('loc-1', colony);
      mockGraph.entities.set('npc-1', existingNpc);
      mockGraphView = new TemplateGraphView(mockGraph, targetSelector);

      // Mock selectTargets to return existing NPCs
      vi.spyOn(mockGraphView, 'selectTargets').mockReturnValue({
        existing: [existingNpc],
        created: []
      });

      const result = outlawRecruitment.expand(mockGraphView, criminalFaction);

      expect(result.relationships).toContainEqual({
        kind: 'member_of',
        src: 'npc-1',
        dst: 'fac-1'
      });
      expect(result.relationships).toContainEqual({
        kind: 'resident_of',
        src: 'npc-1',
        dst: 'loc-1'
      });
    });

    it('should create placeholder relationships for new outlaws', () => {
      const criminalFaction: HardState = {
        id: 'fac-1',
        kind: 'faction',
        subtype: 'criminal',
        name: 'Ice Syndicate',
        description: 'Criminal organization',
        status: 'active',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
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
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('fac-1', criminalFaction);
      mockGraph.entities.set('loc-1', colony);
      mockGraphView = new TemplateGraphView(mockGraph, targetSelector);

      // Mock selectTargets to return new outlaws
      vi.spyOn(mockGraphView, 'selectTargets').mockReturnValue({
        existing: [],
        created: [
          {
            kind: 'npc',
            subtype: 'outlaw',
            name: 'New Outlaw 1',
            description: 'A recruit',
            status: 'alive',
            prominence: 'marginal',
            tags: ['criminal', 'recruit']
          },
          {
            kind: 'npc',
            subtype: 'outlaw',
            name: 'New Outlaw 2',
            description: 'Another recruit',
            status: 'alive',
            prominence: 'marginal',
            tags: ['criminal', 'recruit']
          }
        ]
      });

      const result = outlawRecruitment.expand(mockGraphView, criminalFaction);

      expect(result.relationships).toContainEqual({
        kind: 'member_of',
        src: 'will-be-assigned-0',
        dst: 'fac-1'
      });
      expect(result.relationships).toContainEqual({
        kind: 'resident_of',
        src: 'will-be-assigned-0',
        dst: 'loc-1'
      });
      expect(result.relationships).toContainEqual({
        kind: 'member_of',
        src: 'will-be-assigned-1',
        dst: 'fac-1'
      });
      expect(result.relationships).toContainEqual({
        kind: 'resident_of',
        src: 'will-be-assigned-1',
        dst: 'loc-1'
      });
    });

    it('should indicate number of new outlaws created in description', () => {
      const criminalFaction: HardState = {
        id: 'fac-1',
        kind: 'faction',
        subtype: 'criminal',
        name: 'Ice Syndicate',
        description: 'Criminal organization',
        status: 'active',
        prominence: 'marginal',
        tags: [],
        links: [],
        createdAt: 0,
        updatedAt: 0
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
        links: [],
        createdAt: 0,
        updatedAt: 0
      };

      mockGraph.entities.set('fac-1', criminalFaction);
      mockGraph.entities.set('loc-1', colony);
      mockGraphView = new TemplateGraphView(mockGraph, targetSelector);

      // Mock selectTargets
      vi.spyOn(mockGraphView, 'selectTargets').mockReturnValue({
        existing: [],
        created: [
          {
            kind: 'npc',
            subtype: 'outlaw',
            name: 'New Outlaw',
            description: 'A recruit',
            status: 'alive',
            prominence: 'marginal',
            tags: ['criminal', 'recruit']
          }
        ]
      });

      const result = outlawRecruitment.expand(mockGraphView, criminalFaction);

      expect(result.description).toContain('new outlaws created');
    });
  });
});
