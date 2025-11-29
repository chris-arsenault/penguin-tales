/**
 * Tests for Catalyst Helper Utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAgentsByCategory,
  canPerformAction,
  getInfluence,
  recordCatalyst,
  getCatalyzedEvents,
  getCatalyzedEventCount,
  addCatalyzedEvent,
  hasRelationship,
  calculateAttemptChance,
  initializeCatalyst,
  initializeCatalystSmart,
  updateInfluence
} from '../../systems/catalystHelpers';
import { Graph } from '../../engine/types';
import { HardState, Relationship, Prominence, CatalyzedEvent } from '../../core/worldTypes';

// Helper function to create minimal HardState for testing
function createEntity(
  id: string,
  kind: HardState['kind'],
  subtype: string,
  prominence: Prominence = 'recognized',
  catalyst?: Partial<HardState['catalyst']>
): HardState {
  const entity: HardState = {
    id,
    kind,
    subtype,
    name: `Test ${kind}`,
    description: '',
    status: 'active',
    prominence, culture: 'world',
    tags: {},
    links: [],
    createdAt: 0,
    updatedAt: 0
  };

  if (catalyst) {
    entity.catalyst = {
      canAct: catalyst.canAct ?? false,
      actionDomains: catalyst.actionDomains ?? [],
      influence: catalyst.influence ?? 0.5,
      catalyzedEvents: catalyst.catalyzedEvents ?? []
    };
  }

  return entity;
}

// Helper function to create minimal Graph for testing
function createGraph(entities: HardState[], relationships: Relationship[] = []): Graph {
  const _entities = new Map<string, HardState>();
  let _relationships = relationships;
  entities.forEach(e => _entities.set(e.id, e));

  return {
    tick: 0,
    currentEra: { id: 'test', name: 'Test Era' } as any,
    pressures: new Map(),
    history: [],
    config: {
      domain: {
        getActionDomainsForEntity(entity: HardState): string[] {
          // Mock implementation based on test expectations
          if (entity.kind === 'faction') return ['political', 'economic'];
          if (entity.kind === 'abilities' && entity.subtype === 'magic') return ['magical'];
          if (entity.kind === 'occurrence' && entity.subtype === 'war') return ['conflict_escalation', 'military'];
          if (entity.kind === 'location' && entity.subtype === 'anomaly') return ['environmental', 'magical'];
          if (entity.kind === 'npc' && entity.subtype === 'hero') return ['political', 'military'];
          if (entity.kind === 'npc' && entity.subtype === 'mayor') return ['political', 'economic'];
          return [];
        }
      }
    } as any,
    relationshipCooldowns: new Map(),
    loreRecords: [],
    discoveryState: {
      currentThreshold: 0,
      lastDiscoveryTick: 0,
      discoveriesThisEpoch: 0
    },
    growthMetrics: {
      relationshipsPerTick: [],
      averageGrowthRate: 0
    },

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

    // Entity mutation
    setEntity(id: string, entity: HardState) { _entities.set(id, entity); },
    updateEntity(id: string, changes: Partial<HardState>) { const e = _entities.get(id); if(e) Object.assign(e, changes); return !!e; },
    deleteEntity(id: string) { return _entities.delete(id); },

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

    // Relationship mutation
    pushRelationship(rel: Relationship) { _relationships.push(rel); },
    setRelationships(rels: Relationship[]) { _relationships = rels; },
    removeRelationship(src: string, dst: string, kind: string) {
      const idx = _relationships.findIndex(r => r.src === src && r.dst === dst && r.kind === kind);
      if(idx >= 0) { _relationships.splice(idx, 1); return true; }
      return false;
    }
  } as Graph;
}

describe('getAgentsByCategory', () => {
  it('should return all agents when category is "all"', () => {
    const npc = createEntity('npc1', 'npc', 'hero', 'renowned', { canAct: true, actionDomains: ['military'] });
    const faction = createEntity('faction1', 'faction', 'guild', 'recognized', { canAct: true, actionDomains: ['political'] });
    const occurrence = createEntity('occ1', 'occurrence', 'war', 'recognized', { canAct: true, actionDomains: ['military'] });
    const nonAgent = createEntity('npc2', 'npc', 'citizen', 'marginal');

    const graph = createGraph([npc, faction, occurrence, nonAgent]);
    const agents = getAgentsByCategory(graph, 'all');

    expect(agents).toHaveLength(3);
    expect(agents.map(a => a.id)).toContain('npc1');
    expect(agents.map(a => a.id)).toContain('faction1');
    expect(agents.map(a => a.id)).toContain('occ1');
  });

  it('should return only first-order agents', () => {
    const npc = createEntity('npc1', 'npc', 'hero', 'renowned', { canAct: true, actionDomains: ['military'] });
    const occurrence = createEntity('occ1', 'occurrence', 'war', 'recognized', { canAct: true, actionDomains: ['military'] });

    const graph = createGraph([npc, occurrence]);
    const agents = getAgentsByCategory(graph, 'first-order');

    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('npc1');
  });

  it('should return only second-order agents', () => {
    const npc = createEntity('npc1', 'npc', 'hero', 'renowned', { canAct: true, actionDomains: ['military'] });
    const occurrence = createEntity('occ1', 'occurrence', 'war', 'recognized', { canAct: true, actionDomains: ['military'] });

    const graph = createGraph([npc, occurrence]);
    const agents = getAgentsByCategory(graph, 'second-order');

    expect(agents).toHaveLength(1);
    expect(agents[0].id).toBe('occ1');
  });

  it('should return empty array when no agents exist', () => {
    const nonAgent = createEntity('npc1', 'npc', 'citizen', 'marginal');
    const graph = createGraph([nonAgent]);
    const agents = getAgentsByCategory(graph, 'all');

    expect(agents).toHaveLength(0);
  });

  it('should default to "all" category', () => {
    const npc = createEntity('npc1', 'npc', 'hero', 'renowned', { canAct: true, actionDomains: ['military'] });
    const occurrence = createEntity('occ1', 'occurrence', 'war', 'recognized', { canAct: true, actionDomains: ['military'] });

    const graph = createGraph([npc, occurrence]);
    const agents = getAgentsByCategory(graph);

    expect(agents).toHaveLength(2);
  });
});

describe('canPerformAction', () => {
  it('should return true when entity can act in the domain', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'renowned', {
      canAct: true,
      actionDomains: ['political', 'military']
    });

    expect(canPerformAction(entity, 'political')).toBe(true);
    expect(canPerformAction(entity, 'military')).toBe(true);
  });

  it('should return false when entity cannot act in the domain', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'renowned', {
      canAct: true,
      actionDomains: ['political']
    });

    expect(canPerformAction(entity, 'military')).toBe(false);
  });

  it('should return false when entity cannot act', () => {
    const entity = createEntity('npc1', 'npc', 'citizen', 'marginal', {
      canAct: false,
      actionDomains: ['political']
    });

    expect(canPerformAction(entity, 'political')).toBe(false);
  });

  it('should return false when entity has no catalyst properties', () => {
    const entity = createEntity('npc1', 'npc', 'citizen', 'marginal');

    expect(canPerformAction(entity, 'political')).toBe(false);
  });
});

describe('getInfluence', () => {
  it('should return base influence for recognized entities', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'recognized', {
      canAct: true,
      actionDomains: ['military'],
      influence: 0.5
    });

    const influence = getInfluence(entity, 'military');
    expect(influence).toBe(0.5); // 0.5 base + 0 prominence bonus
  });

  it('should add prominence bonus for renowned entities', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'renowned', {
      canAct: true,
      actionDomains: ['military'],
      influence: 0.5
    });

    const influence = getInfluence(entity, 'military');
    expect(influence).toBe(0.65); // 0.5 base + 0.15 prominence bonus
  });

  it('should add prominence bonus for mythic entities', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'mythic', {
      canAct: true,
      actionDomains: ['military'],
      influence: 0.5
    });

    const influence = getInfluence(entity, 'military');
    expect(influence).toBe(0.8); // 0.5 base + 0.3 prominence bonus
  });

  it('should subtract prominence penalty for forgotten entities', () => {
    const entity = createEntity('npc1', 'npc', 'citizen', 'forgotten', {
      canAct: true,
      actionDomains: ['economic'],
      influence: 0.5
    });

    const influence = getInfluence(entity, 'economic');
    expect(influence).toBe(0.3); // 0.5 base - 0.2 prominence penalty
  });

  it('should clamp influence to [0, 1]', () => {
    const highEntity = createEntity('npc1', 'npc', 'hero', 'mythic', {
      canAct: true,
      actionDomains: ['military'],
      influence: 0.9
    });

    const lowEntity = createEntity('npc2', 'npc', 'citizen', 'forgotten', {
      canAct: true,
      actionDomains: ['economic'],
      influence: 0.1
    });

    expect(getInfluence(highEntity, 'military')).toBe(1.0); // Clamped to max
    expect(getInfluence(lowEntity, 'economic')).toBe(0); // Clamped to min
  });

  it('should return 0 when entity has no catalyst', () => {
    const entity = createEntity('npc1', 'npc', 'citizen', 'marginal');

    expect(getInfluence(entity, 'economic')).toBe(0);
  });
});

describe('recordCatalyst', () => {
  it('should add catalyzedBy property to relationship', () => {
    const rel: Relationship = {
      kind: 'allies_with',
      src: 'npc1',
      dst: 'npc2'
    };

    const attributed = recordCatalyst(rel, 'catalyst1');

    expect(attributed.catalyzedBy).toBe('catalyst1');
    expect(attributed.kind).toBe('allies_with');
    expect(attributed.src).toBe('npc1');
    expect(attributed.dst).toBe('npc2');
  });

  it('should not mutate original relationship', () => {
    const rel: Relationship = {
      kind: 'allies_with',
      src: 'npc1',
      dst: 'npc2'
    };

    const attributed = recordCatalyst(rel, 'catalyst1');

    expect(rel.catalyzedBy).toBeUndefined();
    expect(attributed).not.toBe(rel);
  });
});

describe('getCatalyzedEvents', () => {
  it('should find relationships catalyzed by entity', () => {
    const rel1: Relationship = { kind: 'allies_with', src: 'npc1', dst: 'npc2', catalyzedBy: 'catalyst1' };
    const rel2: Relationship = { kind: 'rivals_with', src: 'npc3', dst: 'npc4', catalyzedBy: 'catalyst1' };
    const rel3: Relationship = { kind: 'trades_with', src: 'npc5', dst: 'npc6', catalyzedBy: 'other' };

    const graph = createGraph([], [rel1, rel2, rel3]);
    const events = getCatalyzedEvents(graph, 'catalyst1');

    expect(events).toHaveLength(2);
    expect(events).toContain(rel1);
    expect(events).toContain(rel2);
  });

  it('should find entities triggered by entity', () => {
    const occurrence = createEntity('occ1', 'occurrence', 'war', 'recognized');
    occurrence.links = [{ kind: 'triggered_by', src: 'occ1', dst: 'catalyst1' }];

    const graph = createGraph([occurrence]);
    const events = getCatalyzedEvents(graph, 'catalyst1');

    expect(events).toHaveLength(1);
    expect(events[0]).toBe(occurrence);
  });

  it('should return empty array when no events found', () => {
    const graph = createGraph([]);
    const events = getCatalyzedEvents(graph, 'catalyst1');

    expect(events).toHaveLength(0);
  });
});

describe('getCatalyzedEventCount', () => {
  it('should return count from catalyst properties', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'renowned', {
      canAct: true,
      actionDomains: ['military'],
      catalyzedEvents: [
        { action: 'formed alliance', tick: 10 },
        { action: 'started rivalry', tick: 20 }
      ]
    });

    const graph = createGraph([entity]);
    const count = getCatalyzedEventCount(graph, 'npc1');

    expect(count).toBe(2);
  });

  it('should return 0 when entity has no catalyst', () => {
    const entity = createEntity('npc1', 'npc', 'citizen', 'marginal');
    const graph = createGraph([entity]);
    const count = getCatalyzedEventCount(graph, 'npc1');

    expect(count).toBe(0);
  });

  it('should return 0 when entity not found', () => {
    const graph = createGraph([]);
    const count = getCatalyzedEventCount(graph, 'nonexistent');

    expect(count).toBe(0);
  });
});

describe('addCatalyzedEvent', () => {
  it('should add event to catalyst record', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'renowned', {
      canAct: true,
      actionDomains: ['military'],
      catalyzedEvents: []
    });

    const event: CatalyzedEvent = { action: 'formed alliance', tick: 42 };
    addCatalyzedEvent(entity, event);

    expect(entity.catalyst?.catalyzedEvents).toHaveLength(1);
    expect(entity.catalyst?.catalyzedEvents[0]).toEqual(event);
  });

  it('should do nothing when entity has no catalyst', () => {
    const entity = createEntity('npc1', 'npc', 'citizen', 'marginal');
    const event: CatalyzedEvent = { action: 'formed alliance', tick: 42 };

    expect(() => addCatalyzedEvent(entity, event)).not.toThrow();
  });
});

describe('hasRelationship', () => {
  it('should return true when relationship exists', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'renowned');
    entity.links = [
      { kind: 'allies_with', src: 'npc1', dst: 'npc2' },
      { kind: 'member_of', src: 'npc1', dst: 'faction1' }
    ];

    expect(hasRelationship(entity, 'allies_with')).toBe(true);
    expect(hasRelationship(entity, 'member_of')).toBe(true);
  });

  it('should return false when relationship does not exist', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'renowned');
    entity.links = [
      { kind: 'allies_with', src: 'npc1', dst: 'npc2' }
    ];

    expect(hasRelationship(entity, 'rivals_with')).toBe(false);
  });

  it('should return false when no links', () => {
    const entity = createEntity('npc1', 'npc', 'citizen', 'marginal');

    expect(hasRelationship(entity, 'allies_with')).toBe(false);
  });

  it('should handle different direction parameters', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'renowned');
    entity.links = [
      { kind: 'allies_with', src: 'npc1', dst: 'npc2' }
    ];

    // Current implementation treats all directions the same (simplified)
    expect(hasRelationship(entity, 'allies_with', 'both')).toBe(true);
    expect(hasRelationship(entity, 'allies_with', 'src')).toBe(true);
    expect(hasRelationship(entity, 'allies_with', 'dst')).toBe(true);
  });
});

describe('calculateAttemptChance', () => {
  it('should calculate chance with base rate and prominence', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'recognized', {
      canAct: true,
      actionDomains: ['military'],
      influence: 0.5
    });

    const chance = calculateAttemptChance(entity, 0.1);
    expect(chance).toBe(0.05); // 0.1 * 1.0 (recognized) * 0.5 (influence)
  });

  it('should apply prominence multipliers', () => {
    const mythic = createEntity('npc1', 'npc', 'hero', 'mythic', {
      canAct: true,
      actionDomains: ['military'],
      influence: 1.0
    });

    const forgotten = createEntity('npc2', 'npc', 'citizen', 'forgotten', {
      canAct: true,
      actionDomains: ['economic'],
      influence: 1.0
    });

    expect(calculateAttemptChance(mythic, 0.1)).toBe(0.2); // 0.1 * 2.0 * 1.0
    expect(calculateAttemptChance(forgotten, 0.1)).toBe(0.03); // 0.1 * 0.3 * 1.0
  });

  it('should return 0 when entity cannot act', () => {
    const entity = createEntity('npc1', 'npc', 'citizen', 'marginal', {
      canAct: false,
      actionDomains: []
    });

    expect(calculateAttemptChance(entity, 0.1)).toBe(0);
  });

  it('should clamp result to [0, 1]', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'mythic', {
      canAct: true,
      actionDomains: ['military'],
      influence: 1.0
    });

    const chance = calculateAttemptChance(entity, 1.0);
    expect(chance).toBe(1.0); // Would be 2.0, but clamped to 1.0
  });
});

describe('initializeCatalyst', () => {
  it('should initialize catalyst with given parameters', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'renowned');

    initializeCatalyst(entity, true, ['political', 'military'], 0.7);

    expect(entity.catalyst).toBeDefined();
    expect(entity.catalyst?.canAct).toBe(true);
    expect(entity.catalyst?.actionDomains).toEqual(['political', 'military']);
    expect(entity.catalyst?.influence).toBe(0.7);
    expect(entity.catalyst?.catalyzedEvents).toEqual([]);
  });

  it('should use default influence when not provided', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'renowned');

    initializeCatalyst(entity, true, ['political']);

    expect(entity.catalyst?.influence).toBe(0.5);
  });

  it('should handle empty action domains', () => {
    const entity = createEntity('npc1', 'npc', 'citizen', 'marginal');

    initializeCatalyst(entity, false, []);

    expect(entity.catalyst?.canAct).toBe(false);
    expect(entity.catalyst?.actionDomains).toEqual([]);
  });
});

describe('initializeCatalystSmart', () => {
  it('should initialize catalyst for recognized hero', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'recognized');
    const graph = createGraph([entity]);

    initializeCatalystSmart(entity, graph);

    expect(entity.catalyst).toBeDefined();
    expect(entity.catalyst?.canAct).toBe(true);
    expect(entity.catalyst?.actionDomains).toContain('political');
    expect(entity.catalyst?.actionDomains).toContain('military');
    expect(entity.catalyst?.influence).toBe(0.5); // Recognized prominence
  });

  it('should initialize catalyst for renowned mayor', () => {
    const entity = createEntity('npc1', 'npc', 'mayor', 'renowned');
    const graph = createGraph([entity]);

    initializeCatalystSmart(entity, graph);

    expect(entity.catalyst).toBeDefined();
    expect(entity.catalyst?.actionDomains).toContain('political');
    expect(entity.catalyst?.actionDomains).toContain('economic');
    expect(entity.catalyst?.influence).toBe(0.7); // Renowned prominence
  });

  it('should not initialize catalyst for marginal entities', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'marginal');
    const graph = createGraph([entity]);

    initializeCatalystSmart(entity, graph);

    expect(entity.catalyst).toBeUndefined();
  });

  it('should not initialize catalyst for forgotten entities', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'forgotten');
    const graph = createGraph([entity]);

    initializeCatalystSmart(entity, graph);

    expect(entity.catalyst).toBeUndefined();
  });

  it('should initialize catalyst for mythic faction', () => {
    const entity = createEntity('faction1', 'faction', 'guild', 'mythic');
    const graph = createGraph([entity]);

    initializeCatalystSmart(entity, graph);

    expect(entity.catalyst).toBeDefined();
    expect(entity.catalyst?.actionDomains).toContain('political');
    expect(entity.catalyst?.actionDomains).toContain('economic');
    expect(entity.catalyst?.influence).toBe(0.9); // Mythic prominence
  });

  it('should initialize catalyst for magic abilities', () => {
    const entity = createEntity('ability1', 'abilities', 'magic', 'recognized');
    const graph = createGraph([entity]);

    initializeCatalystSmart(entity, graph);

    expect(entity.catalyst).toBeDefined();
    expect(entity.catalyst?.actionDomains).toContain('magical');
  });

  it('should initialize catalyst for occurrences', () => {
    const entity = createEntity('occ1', 'occurrence', 'war', 'recognized');
    const graph = createGraph([entity]);

    initializeCatalystSmart(entity, graph);

    expect(entity.catalyst).toBeDefined();
    expect(entity.catalyst?.actionDomains).toContain('conflict_escalation');
    expect(entity.catalyst?.actionDomains).toContain('military');
  });

  it('should handle anomaly locations', () => {
    const entity = createEntity('loc1', 'location', 'anomaly', 'renowned');
    const graph = createGraph([entity]);

    initializeCatalystSmart(entity, graph);

    expect(entity.catalyst).toBeDefined();
    expect(entity.catalyst?.actionDomains).toContain('environmental');
    expect(entity.catalyst?.actionDomains).toContain('magical');
  });
});

describe('updateInfluence', () => {
  it('should increase influence on success', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'renowned', {
      canAct: true,
      actionDomains: ['military'],
      influence: 0.5
    });

    updateInfluence(entity, true, 0.1);

    expect(entity.catalyst?.influence).toBe(0.6);
  });

  it('should decrease influence on failure', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'renowned', {
      canAct: true,
      actionDomains: ['military'],
      influence: 0.5
    });

    updateInfluence(entity, false, 0.1);

    expect(entity.catalyst?.influence).toBe(0.45); // 0.5 - (0.1 * 0.5)
  });

  it('should clamp influence to maximum 1.0', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'mythic', {
      canAct: true,
      actionDomains: ['military'],
      influence: 0.95
    });

    updateInfluence(entity, true, 0.1);

    expect(entity.catalyst?.influence).toBe(1.0);
  });

  it('should clamp influence to minimum 0', () => {
    const entity = createEntity('npc1', 'npc', 'citizen', 'forgotten', {
      canAct: true,
      actionDomains: ['economic'],
      influence: 0.02
    });

    updateInfluence(entity, false, 0.1);

    expect(entity.catalyst?.influence).toBe(0);
  });

  it('should do nothing when entity has no catalyst', () => {
    const entity = createEntity('npc1', 'npc', 'citizen', 'marginal');

    expect(() => updateInfluence(entity, true, 0.1)).not.toThrow();
  });

  it('should use default magnitude when not provided', () => {
    const entity = createEntity('npc1', 'npc', 'hero', 'renowned', {
      canAct: true,
      actionDomains: ['military'],
      influence: 0.5
    });

    updateInfluence(entity, true);

    expect(entity.catalyst?.influence).toBe(0.6); // Default magnitude 0.1
  });
});
