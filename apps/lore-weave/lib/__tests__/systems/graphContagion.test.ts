import { describe, it, expect, beforeEach } from 'vitest';
import { createGraphContagionSystem, GraphContagionConfig } from '../../systems/graphContagion';
import { createTestGraph, createTestEntity } from '../testHelpers';
import { TemplateGraphView } from '../../graph/templateGraphView';
import { TargetSelector } from '../../selection/targetSelector';
import { CoordinateContext } from '../../coordinates/coordinateContext';
import { HardState } from '../../core/worldTypes';
import { Graph } from '../../engine/types';

describe('graphContagion', () => {
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

  // Helper functions
  function addEntity(entity: HardState): void {
    (testGraph as any)._loadEntity(entity.id, entity);
  }

  function addRelationship(kind: string, src: string, dst: string, strength: number = 0.5): void {
    (testGraph as any).addRelationship(kind, src, dst, strength);
  }

  function createNPC(id: string, tags: Record<string, string | boolean> = {}): HardState {
    return createTestEntity({
      id,
      kind: 'npc',
      subtype: 'commoner',
      name: `NPC ${id}`,
      status: 'alive',
      tags
    });
  }

  function createRule(id: string, status: string = 'proposed'): HardState {
    return createTestEntity({
      id,
      kind: 'rules',
      subtype: 'belief',
      name: `Rule ${id}`,
      status
    });
  }

  describe('basic transmission', () => {
    it('should spread tag-based contagion through contact networks', () => {
      // Set up infected carrier and susceptible contact
      const carrier = createNPC('carrier', { infected: true });
      const susceptible = createNPC('susceptible');
      addEntity(carrier);
      addEntity(susceptible);
      addRelationship('allied_with', 'susceptible', 'carrier');

      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: {
          type: 'tag',
          tagPattern: 'infected'
        },
        vectors: [{
          relationshipKind: 'allied_with',
          direction: 'both'
        }],
        transmission: {
          baseRate: 1.0, // Guaranteed transmission
          contactMultiplier: 0,
          maxProbability: 1.0
        },
        infectionAction: {
          type: 'add_tag',
          tagKey: 'infected',
          tagValue: true
        }
      };

      const system = createGraphContagionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('susceptible');
      expect(result.entitiesModified[0].changes.tags).toEqual({ infected: true });
    });

    it('should spread relationship-based contagion', () => {
      const carrier = createNPC('carrier');
      const source = createRule('ideology');
      const susceptible = createNPC('susceptible');
      addEntity(carrier);
      addEntity(source);
      addEntity(susceptible);
      addRelationship('believer_of', 'carrier', 'ideology');
      addRelationship('follower_of', 'susceptible', 'carrier');

      const config: GraphContagionConfig = {
        id: 'belief_spread',
        name: 'Belief Spread',
        entityKind: 'npc',
        contagion: {
          type: 'relationship',
          relationshipKind: 'believer_of'
        },
        vectors: [{
          relationshipKind: 'follower_of',
          direction: 'both'
        }],
        transmission: {
          baseRate: 1.0,
          contactMultiplier: 0,
          maxProbability: 1.0
        },
        infectionAction: {
          type: 'create_relationship',
          relationshipKind: 'believer_of',
          strength: 0.5
        }
      };

      const system = createGraphContagionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.relationshipsAdded.length).toBe(1);
      expect(result.relationshipsAdded[0].src).toBe('susceptible');
      expect(result.relationshipsAdded[0].kind).toBe('believer_of');
    });

    it('should not infect entities already infected', () => {
      const carrier = createNPC('carrier', { infected: true });
      const alsoInfected = createNPC('also_infected', { infected: true });
      addEntity(carrier);
      addEntity(alsoInfected);
      addRelationship('allied_with', 'also_infected', 'carrier');

      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: { type: 'tag', tagPattern: 'infected' },
        vectors: [{ relationshipKind: 'allied_with', direction: 'both' }],
        transmission: { baseRate: 1.0, contactMultiplier: 0, maxProbability: 1.0 },
        infectionAction: { type: 'add_tag', tagKey: 'infected' }
      };

      const system = createGraphContagionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(0);
    });

    it('should not spread when no infected entities exist', () => {
      const susceptible1 = createNPC('s1');
      const susceptible2 = createNPC('s2');
      addEntity(susceptible1);
      addEntity(susceptible2);
      addRelationship('allied_with', 's1', 's2');

      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: { type: 'tag', tagPattern: 'infected' },
        vectors: [{ relationshipKind: 'allied_with', direction: 'both' }],
        transmission: { baseRate: 1.0, contactMultiplier: 0, maxProbability: 1.0 },
        infectionAction: { type: 'add_tag', tagKey: 'infected' }
      };

      const system = createGraphContagionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.description).toContain('no carriers');
      expect(result.entitiesModified.length).toBe(0);
    });
  });

  describe('susceptibility modifiers', () => {
    it('should reduce infection chance for resistant entities', () => {
      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: { type: 'tag', tagPattern: 'infected' },
        vectors: [{ relationshipKind: 'allied_with', direction: 'both' }],
        transmission: {
          baseRate: 0.3,  // 30% base chance
          contactMultiplier: 0
        },
        susceptibilityModifiers: [
          { tag: 'conservative', modifier: 0.9 }  // 90% resistance = 3% effective chance
        ],
        infectionAction: { type: 'add_tag', tagKey: 'infected' }
      };

      const system = createGraphContagionSystem(config);

      // Run many times to check probability is reduced
      let infections = 0;
      for (let i = 0; i < 100; i++) {
        const freshGraph = createTestGraph();
        const carrier = createNPC('carrier', { infected: true });
        const conservative = createNPC('conservative', { conservative: true });
        (freshGraph as any)._loadEntity('carrier', carrier);
        (freshGraph as any)._loadEntity('conservative', conservative);
        (freshGraph as any).addRelationship('allied_with', 'conservative', 'carrier', 0.5);

        const freshView = new TemplateGraphView(freshGraph, new TargetSelector(), mockCoordinateContext);
        const result = system.apply(freshView, 1.0);
        if (result.entitiesModified.length > 0) infections++;
      }

      // Should be significantly less than 30% (the base rate)
      expect(infections).toBeLessThan(20);
    });

    it('should increase infection chance for susceptible entities', () => {
      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: { type: 'tag', tagPattern: 'infected' },
        vectors: [{ relationshipKind: 'allied_with', direction: 'both' }],
        transmission: {
          baseRate: 0.3,
          contactMultiplier: 0
        },
        susceptibilityModifiers: [
          { tag: 'radical', modifier: -0.3 }  // Negative = more susceptible
        ],
        infectionAction: { type: 'add_tag', tagKey: 'infected' }
      };

      const system = createGraphContagionSystem(config);

      let infections = 0;
      for (let i = 0; i < 100; i++) {
        const freshGraph = createTestGraph();
        const carrier = createNPC('carrier', { infected: true });
        const radical = createNPC('radical', { radical: true });
        (freshGraph as any)._loadEntity('carrier', carrier);
        (freshGraph as any)._loadEntity('radical', radical);
        (freshGraph as any).addRelationship('allied_with', 'radical', 'carrier', 0.5);

        const freshView = new TemplateGraphView(freshGraph, new TargetSelector(), mockCoordinateContext);
        const result = system.apply(freshView, 1.0);
        if (result.entitiesModified.length > 0) infections++;
      }

      // Should be more than 30% (base rate), accounting for 39% effective rate
      expect(infections).toBeGreaterThan(25);
    });
  });

  describe('contact multiplier', () => {
    it('should increase infection chance with more infected contacts', () => {
      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: { type: 'tag', tagPattern: 'infected' },
        vectors: [{ relationshipKind: 'allied_with', direction: 'both' }],
        transmission: {
          baseRate: 0.1,
          contactMultiplier: 0.2  // Each contact adds 20%
        },
        infectionAction: { type: 'add_tag', tagKey: 'infected' }
      };

      const system = createGraphContagionSystem(config);

      let infections = 0;
      for (let i = 0; i < 100; i++) {
        const freshGraph = createTestGraph();
        const c1 = createNPC('c1', { infected: true });
        const c2 = createNPC('c2', { infected: true });
        const c3 = createNPC('c3', { infected: true });
        const susceptible = createNPC('susceptible');
        (freshGraph as any)._loadEntity('c1', c1);
        (freshGraph as any)._loadEntity('c2', c2);
        (freshGraph as any)._loadEntity('c3', c3);
        (freshGraph as any)._loadEntity('susceptible', susceptible);
        (freshGraph as any).addRelationship('allied_with', 'susceptible', 'c1', 0.5);
        (freshGraph as any).addRelationship('allied_with', 'susceptible', 'c2', 0.5);
        (freshGraph as any).addRelationship('allied_with', 'susceptible', 'c3', 0.5);

        const freshView = new TemplateGraphView(freshGraph, new TargetSelector(), mockCoordinateContext);
        const result = system.apply(freshView, 1.0);
        if (result.entitiesModified.length > 0) infections++;
      }

      // 10% base + 3 * 20% = 70% effective rate
      expect(infections).toBeGreaterThan(50);
    });
  });

  describe('recovery', () => {
    it('should allow recovery with immunity', () => {
      const infected = createNPC('infected', { infected: true });
      addEntity(infected);

      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: { type: 'tag', tagPattern: 'infected' },
        vectors: [{ relationshipKind: 'allied_with', direction: 'both' }],
        transmission: { baseRate: 0.5, contactMultiplier: 0 },
        recovery: {
          baseRate: 1.0,  // Guaranteed recovery
          immunityTag: 'immune'
        },
        infectionAction: { type: 'add_tag', tagKey: 'infected' }
      };

      const system = createGraphContagionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('infected');
      expect(result.entitiesModified[0].changes.tags).toEqual({ immune: true });
    });

    it('should boost recovery for entities with recovery traits', () => {
      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: { type: 'tag', tagPattern: 'infected' },
        vectors: [{ relationshipKind: 'allied_with', direction: 'both' }],
        transmission: { baseRate: 0.5, contactMultiplier: 0 },
        recovery: {
          baseRate: 0.1,
          immunityTag: 'immune',
          recoveryBonusTraits: [
            { tag: 'traditional', bonus: 0.5 }
          ]
        },
        infectionAction: { type: 'add_tag', tagKey: 'infected' }
      };

      const system = createGraphContagionSystem(config);

      let recoveries = 0;
      for (let i = 0; i < 100; i++) {
        const freshGraph = createTestGraph();
        const infected = createNPC('infected', { infected: true, traditional: true });
        (freshGraph as any)._loadEntity('infected', infected);

        const freshView = new TemplateGraphView(freshGraph, new TargetSelector(), mockCoordinateContext);
        const result = system.apply(freshView, 1.0);
        if (result.entitiesModified.length > 0) recoveries++;
      }

      // 10% base + 50% bonus = 60% recovery rate
      expect(recoveries).toBeGreaterThan(40);
    });
  });

  describe('immunity', () => {
    it('should not infect immune entities', () => {
      const carrier = createNPC('carrier', { infected: true });
      const immune = createNPC('immune', { immune: true });
      addEntity(carrier);
      addEntity(immune);
      addRelationship('allied_with', 'immune', 'carrier');

      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: { type: 'tag', tagPattern: 'infected' },
        vectors: [{ relationshipKind: 'allied_with', direction: 'both' }],
        transmission: { baseRate: 1.0, contactMultiplier: 0, maxProbability: 1.0 },
        recovery: {
          baseRate: 0.1,
          immunityTag: 'immune'
        },
        infectionAction: { type: 'add_tag', tagKey: 'infected' }
      };

      const system = createGraphContagionSystem(config);
      const result = system.apply(graphView, 1.0);

      // Should not infect the immune entity
      const infectionMods = result.entitiesModified.filter(m =>
        m.id === 'immune' && m.changes.tags?.infected
      );
      expect(infectionMods.length).toBe(0);
    });
  });

  describe('phase transitions', () => {
    it('should trigger phase transition when adoption threshold met', () => {
      // 3 infected out of 4 = 75% adoption
      const infected1 = createNPC('i1', { infected: true });
      const infected2 = createNPC('i2', { infected: true });
      const infected3 = createNPC('i3', { infected: true });
      const susceptible = createNPC('s1');
      const rule = createRule('ideology', 'proposed');
      addEntity(infected1);
      addEntity(infected2);
      addEntity(infected3);
      addEntity(susceptible);
      addEntity(rule);

      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: { type: 'tag', tagPattern: 'infected' },
        vectors: [{ relationshipKind: 'allied_with', direction: 'both' }],
        transmission: { baseRate: 0.5, contactMultiplier: 0 },
        infectionAction: { type: 'add_tag', tagKey: 'infected' },
        phaseTransitions: [{
          entityKind: 'rules',
          fromStatus: 'proposed',
          toStatus: 'enacted',
          adoptionThreshold: 0.5,  // 50% threshold
          descriptionSuffix: 'This belief is now widely accepted.'
        }]
      };

      const system = createGraphContagionSystem(config);
      const result = system.apply(graphView, 1.0);

      const ruleModification = result.entitiesModified.find(m => m.id === 'ideology');
      expect(ruleModification).toBeDefined();
      expect(ruleModification!.changes.status).toBe('enacted');
      expect(ruleModification!.changes.description).toContain('widely accepted');
    });

    it('should not trigger transition when threshold not met', () => {
      // 1 infected out of 4 = 25% adoption
      const infected = createNPC('i1', { infected: true });
      const s1 = createNPC('s1');
      const s2 = createNPC('s2');
      const s3 = createNPC('s3');
      const rule = createRule('ideology', 'proposed');
      addEntity(infected);
      addEntity(s1);
      addEntity(s2);
      addEntity(s3);
      addEntity(rule);

      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: { type: 'tag', tagPattern: 'infected' },
        vectors: [{ relationshipKind: 'allied_with', direction: 'both' }],
        transmission: { baseRate: 0.0, contactMultiplier: 0 },  // No new infections
        infectionAction: { type: 'add_tag', tagKey: 'infected' },
        phaseTransitions: [{
          entityKind: 'rules',
          fromStatus: 'proposed',
          toStatus: 'enacted',
          adoptionThreshold: 0.5
        }]
      };

      const system = createGraphContagionSystem(config);
      const result = system.apply(graphView, 1.0);

      const ruleModification = result.entitiesModified.find(m => m.id === 'ideology');
      expect(ruleModification).toBeUndefined();
    });
  });

  describe('throttling', () => {
    it('should throttle execution based on throttleChance', () => {
      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: { type: 'tag', tagPattern: 'infected' },
        vectors: [{ relationshipKind: 'allied_with', direction: 'both' }],
        transmission: { baseRate: 1.0, contactMultiplier: 0, maxProbability: 1.0 },
        infectionAction: { type: 'add_tag', tagKey: 'infected' },
        throttleChance: 0.1  // Only 10% of ticks
      };

      const system = createGraphContagionSystem(config);

      let executions = 0;
      for (let i = 0; i < 100; i++) {
        const freshGraph = createTestGraph();
        const carrier = createNPC('carrier', { infected: true });
        const susceptible = createNPC('susceptible');
        (freshGraph as any)._loadEntity('carrier', carrier);
        (freshGraph as any)._loadEntity('susceptible', susceptible);
        (freshGraph as any).addRelationship('allied_with', 'susceptible', 'carrier', 0.5);

        const freshView = new TemplateGraphView(freshGraph, new TargetSelector(), mockCoordinateContext);
        const result = system.apply(freshView, 1.0);
        if (!result.description.includes('dormant')) executions++;
      }

      // Should be around 10% (with some variance)
      expect(executions).toBeLessThan(30);
      expect(executions).toBeGreaterThan(0);
    });
  });

  describe('pressure changes', () => {
    it('should apply pressure changes when contagion spreads', () => {
      const carrier = createNPC('carrier', { infected: true });
      const susceptible = createNPC('susceptible');
      addEntity(carrier);
      addEntity(susceptible);
      addRelationship('allied_with', 'susceptible', 'carrier');

      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: { type: 'tag', tagPattern: 'infected' },
        vectors: [{ relationshipKind: 'allied_with', direction: 'both' }],
        transmission: { baseRate: 1.0, contactMultiplier: 0, maxProbability: 1.0 },
        infectionAction: { type: 'add_tag', tagKey: 'infected' },
        pressureChanges: { conflict: 5, stability: -3 }
      };

      const system = createGraphContagionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.pressureChanges).toEqual({ conflict: 5, stability: -3 });
    });

    it('should not apply pressure changes when nothing spreads', () => {
      const susceptible = createNPC('susceptible');
      addEntity(susceptible);

      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: { type: 'tag', tagPattern: 'infected' },
        vectors: [{ relationshipKind: 'allied_with', direction: 'both' }],
        transmission: { baseRate: 1.0, contactMultiplier: 0, maxProbability: 1.0 },
        infectionAction: { type: 'add_tag', tagKey: 'infected' },
        pressureChanges: { conflict: 5 }
      };

      const system = createGraphContagionSystem(config);
      const result = system.apply(graphView, 1.0);

      expect(result.pressureChanges).toEqual({});
    });
  });

  describe('vector direction filtering', () => {
    it('should only spread through specified direction (dst)', () => {
      // Setup: carrier is infected
      // follower -> carrier (follower is src, carrier is dst)
      // carrier -> leader (carrier is src, leader is dst)
      // With direction 'dst', we get contacts where entity is dst
      // For follower: no relationship where follower is dst, so no contact with carrier
      // For leader: carrier -> leader has leader as dst, so leader sees carrier as contact
      const carrier = createNPC('carrier', { infected: true });
      const follower = createNPC('follower');
      const leader = createNPC('leader');
      addEntity(carrier);
      addEntity(follower);
      addEntity(leader);
      addRelationship('follower_of', 'follower', 'carrier');  // follower follows carrier
      addRelationship('follower_of', 'carrier', 'leader');    // carrier follows leader

      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: { type: 'tag', tagPattern: 'infected' },
        vectors: [{
          relationshipKind: 'follower_of',
          direction: 'dst'  // Entity must be dst to see contacts through this relationship
        }],
        transmission: { baseRate: 1.0, contactMultiplier: 0, maxProbability: 1.0 },
        infectionAction: { type: 'add_tag', tagKey: 'infected' }
      };

      const system = createGraphContagionSystem(config);
      const result = system.apply(graphView, 1.0);

      // Only leader should be infected (leader is dst of carrier's follower_of)
      // Follower won't be infected because follower is src (not dst) of their relationship with carrier
      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('leader');
    });
  });

  describe('minimum strength filtering', () => {
    it('should only spread through strong enough relationships', () => {
      const carrier = createNPC('carrier', { infected: true });
      const strongAlly = createNPC('strong_ally');
      const weakAlly = createNPC('weak_ally');
      addEntity(carrier);
      addEntity(strongAlly);
      addEntity(weakAlly);
      addRelationship('allied_with', 'strong_ally', 'carrier', 0.8);
      addRelationship('allied_with', 'weak_ally', 'carrier', 0.2);

      const config: GraphContagionConfig = {
        id: 'test_contagion',
        name: 'Test Contagion',
        entityKind: 'npc',
        contagion: { type: 'tag', tagPattern: 'infected' },
        vectors: [{
          relationshipKind: 'allied_with',
          direction: 'both',
          minStrength: 0.5
        }],
        transmission: { baseRate: 1.0, contactMultiplier: 0, maxProbability: 1.0 },
        infectionAction: { type: 'add_tag', tagKey: 'infected' }
      };

      const system = createGraphContagionSystem(config);
      const result = system.apply(graphView, 1.0);

      // Only strong ally should be infected
      expect(result.entitiesModified.length).toBe(1);
      expect(result.entitiesModified[0].id).toBe('strong_ally');
    });
  });
});
