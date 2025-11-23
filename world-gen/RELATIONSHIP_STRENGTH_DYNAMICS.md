# Dynamic Relationship Strength Proposal

## Current State Analysis

### What's Implemented ✅
1. **Relationship strength field**: `strength?: number` (0.0-1.0) in `Relationship` type
2. **Auto-assignment**: `addRelationship()` assigns strength from `RELATIONSHIP_STRENGTHS` config
3. **Static strengths**: 46 relationship kinds with hardcoded initial values

### What's Missing ❌
1. **No dynamic strength changes**: Relationships never strengthen or weaken over time
2. **No strength-aware queries**: `getRelated()` and all graph queries ignore strength
3. **No culling**: Weak relationships persist forever
4. **No emergent behavior**: Strength doesn't respond to context (proximity, shared events, etc.)
5. **Tags used incorrectly**: Some systems may be using tags where strength would be better

### Problems This Creates

**Example**: Two NPCs form a friendship (`follower_of`, strength 0.6):
- They never interact again → friendship should weaken → but stays 0.6 forever
- They fight together in a war → friendship should strengthen → but stays 0.6 forever
- After 100 ticks, graph has 500 relationships, many irrelevant → query performance degrades

**Query Issue**: `getFactionMembers(faction)` returns ALL members, even those with strength 0.1 (barely affiliated). No way to get "core members" (strength > 0.7).

---

## Proposed Systems for Dynamic Strength

### Philosophy: Emergent, Not Declarative
- Systems observe graph patterns and modify strengths incrementally
- No "set strength to X" - only "increase by +0.1" or "decay by -0.05"
- Multiple systems can affect same relationship (additive)
- Strength changes are consequences of simulation, not authored outcomes

---

### System 1: **Relationship Decay** (Passive Entropy)

**Purpose**: All relationships naturally weaken without reinforcement

**Mechanism**:
```typescript
relationship_decay: {
  id: 'relationship_decay',

  metadata: {
    parameters: {
      // Different relationship types decay at different rates
      baseDecayRate: { value: 0.02 },        // -0.02 per tick for most relationships
      spatialDecayRate: { value: 0.05 },     // -0.05 for spatial (resident_of, adjacent_to)
      narrativeDecayRate: { value: 0.01 },   // -0.01 for narrative (leader_of, member_of)

      // Decay is slower when entities are nearby or connected
      proximityDecayReduction: { value: 0.5 },  // 50% slower if same location
      sharedEventDecayReduction: { value: 0.3 },// 30% slower if in same faction/events

      // Floor: relationships don't decay below this unless culled
      decayFloor: { value: 0.1 }
    }
  },

  apply: (graph, modifier) => {
    // For each relationship, apply decay based on:
    // 1. Relationship kind (spatial decay faster)
    // 2. Proximity (same location = slower decay)
    // 3. Shared context (same faction = slower decay)

    const modifications = [];
    graph.relationships.forEach(rel => {
      const baseRate = getDecayRateForKind(rel.kind);
      const proximity = checkProximity(graph, rel.src, rel.dst);
      const sharedContext = checkSharedContext(graph, rel.src, rel.dst);

      const decayRate = baseRate * (1 - proximity * 0.5) * (1 - sharedContext * 0.3);
      const newStrength = Math.max(
        params.decayFloor,
        (rel.strength ?? 0.5) - decayRate
      );

      if (newStrength !== rel.strength) {
        modifications.push({ rel, newStrength });
      }
    });

    return { relationshipsModified: modifications };
  }
}
```

**Effects**:
- Relationships created but never reinforced gradually weaken
- Spatial relationships (resident_of) decay fastest if NPC moves away
- Narrative relationships (leader_of) decay slowest
- Creates pressure for other systems to reinforce important relationships

---

### System 2: **Relationship Reinforcement** (Active Strengthening)

**Purpose**: Relationships strengthen through shared experiences and proximity

**Mechanism**:
```typescript
relationship_reinforcement: {
  id: 'relationship_reinforcement',

  metadata: {
    parameters: {
      proximityBonus: { value: 0.03 },       // +0.03 per tick if same location
      sharedFactionBonus: { value: 0.02 },   // +0.02 per tick if same faction
      sharedConflictBonus: { value: 0.05 },  // +0.05 if both in same conflict
      sharedEventBonus: { value: 0.04 },     // +0.04 if both affected by same event

      // Cap: relationships can't exceed 1.0
      reinforcementCap: { value: 1.0 }
    }
  },

  apply: (graph, modifier) => {
    // For each relationship, check for strengthening conditions:
    // 1. Same location this tick
    // 2. Same faction membership
    // 3. Both involved in recent conflict (last 5 ticks)
    // 4. Both affected by same template/event recently

    const modifications = [];
    graph.relationships.forEach(rel => {
      let bonus = 0;

      const srcEntity = graph.entities.get(rel.src);
      const dstEntity = graph.entities.get(rel.dst);

      if (!srcEntity || !dstEntity) return;

      // Proximity: same location
      if (getLocation(graph, rel.src)?.id === getLocation(graph, rel.dst)?.id) {
        bonus += params.proximityBonus;
      }

      // Shared faction
      const srcFactions = getRelated(graph, rel.src, 'member_of', 'src');
      const dstFactions = getRelated(graph, rel.dst, 'member_of', 'src');
      if (srcFactions.some(f => dstFactions.some(df => df.id === f.id))) {
        bonus += params.sharedFactionBonus;
      }

      // Shared conflict (both have enemy_of to same target in last 5 ticks)
      const srcEnemies = getRelated(graph, rel.src, 'enemy_of', 'src');
      const dstEnemies = getRelated(graph, rel.dst, 'enemy_of', 'src');
      if (srcEnemies.some(e => dstEnemies.some(de => de.id === e.id))) {
        bonus += params.sharedConflictBonus;
      }

      if (bonus > 0) {
        const newStrength = Math.min(
          params.reinforcementCap,
          (rel.strength ?? 0.5) + bonus
        );
        modifications.push({ rel, newStrength });
      }
    });

    return { relationshipsModified: modifications };
  }
}
```

**Effects**:
- NPCs in same colony slowly strengthen friendships
- Faction members' loyalty gradually increases
- Allies in war strengthen bonds faster
- Creates emergent "veteran companions" from shared battles

---

### System 3: **Conflict-Driven Strength Changes**

**Purpose**: Conflicts weaken positive relationships, strengthen negative ones

**Mechanism**:
```typescript
conflict_strength_modifier: {
  id: 'conflict_strength_modifier',

  metadata: {
    parameters: {
      enemyStrengtheningRate: { value: 0.08 }, // Hatred grows fast
      allyWeakeningFromConflict: { value: 0.04 }, // Allies drift if fighting different wars
      neutralDrift: { value: 0.02 }  // Neutral relationships weaken in conflict zones
    }
  },

  apply: (graph, modifier) => {
    // For each active conflict (enemy_of, at_war_with):
    // 1. Strengthen enemy relationships (hatred grows)
    // 2. Weaken cross-faction friendships (tension)
    // 3. Strengthen same-faction bonds (rally effect)

    const conflicts = graph.relationships.filter(r =>
      r.kind === 'enemy_of' || r.kind === 'at_war_with'
    );

    const modifications = [];

    conflicts.forEach(conflict => {
      // Strengthen enemy bonds
      const newEnemyStrength = Math.min(1.0,
        (conflict.strength ?? 0.7) + params.enemyStrengtheningRate
      );
      modifications.push({ rel: conflict, newStrength: newEnemyStrength });

      // Weaken cross-faction friendships involving these entities
      const srcFriends = graph.relationships.filter(r =>
        r.src === conflict.src && (r.kind === 'follower_of' || r.kind === 'friend_of')
      );

      srcFriends.forEach(friendship => {
        if (isInConflictFaction(graph, friendship.dst, conflict.dst)) {
          const newStrength = Math.max(0.1,
            (friendship.strength ?? 0.5) - params.allyWeakeningFromConflict
          );
          modifications.push({ rel: friendship, newStrength });
        }
      });
    });

    return { relationshipsModified: modifications };
  }
}
```

**Effects**:
- Enemy relationships intensify during wars
- Star-crossed lovers' relationships weaken under faction pressure
- Creates emergent tension between personal and political loyalties

---

### System 4: **Prominence-Based Strength Scaling**

**Purpose**: Relationships with prominent entities are stronger/more stable

**Mechanism**:
```typescript
prominence_strength_modifier: {
  id: 'prominence_strength_modifier',

  metadata: {
    parameters: {
      mythicBonus: { value: 0.05 },      // +0.05 per tick if linked to mythic entity
      renownedBonus: { value: 0.03 },    // +0.03 per tick if linked to renowned
      forgottenPenalty: { value: 0.02 }  // -0.02 per tick if linked to forgotten
    }
  },

  apply: (graph, modifier) => {
    // For each relationship:
    // If either entity is mythic/renowned → strengthen
    // If either entity is forgotten → weaken

    const modifications = [];

    graph.relationships.forEach(rel => {
      const srcEntity = graph.entities.get(rel.src);
      const dstEntity = graph.entities.get(rel.dst);

      if (!srcEntity || !dstEntity) return;

      const srcProminence = getProminenceValue(srcEntity.prominence);
      const dstProminence = getProminenceValue(dstEntity.prominence);
      const maxProminence = Math.max(srcProminence, dstProminence);

      let change = 0;
      if (maxProminence >= 4) change = params.mythicBonus;      // mythic
      else if (maxProminence >= 3) change = params.renownedBonus; // renowned
      else if (maxProminence <= 0) change = -params.forgottenPenalty; // forgotten

      if (change !== 0) {
        const newStrength = Math.max(0.1, Math.min(1.0,
          (rel.strength ?? 0.5) + change
        ));
        modifications.push({ rel, newStrength });
      }
    });

    return { relationshipsModified: modifications };
  }
}
```

**Effects**:
- Mythic hero's followers have stronger loyalty
- Forgotten entities' relationships fade
- Creates emergent celebrity effect

---

## Strength-Aware Query System

### Problem with Current Queries

```typescript
// Current: Returns ALL members, even barely affiliated (strength 0.1)
const members = getFactionMembers(graph, factionId);

// Desired: Get only core members (strength > 0.7)
const coreMembers = getFactionMembers(graph, factionId, { minStrength: 0.7 });
```

### Proposed Query Updates

```typescript
// Update getRelated() signature
export function getRelated(
  graph: Graph,
  entityId: string,
  kind?: string,
  direction: 'src' | 'dst' | 'both' = 'both',
  options?: {
    minStrength?: number;     // Filter by minimum strength
    maxStrength?: number;     // Filter by maximum strength
    sortByStrength?: boolean; // Sort by strength descending
  }
): HardState[] {
  const related: HardState[] = [];
  const opts = options || {};

  graph.relationships
    .filter(rel => {
      // Existing filters
      if (kind && rel.kind !== kind) return false;

      // NEW: Strength filters
      if (opts.minStrength !== undefined && (rel.strength ?? 0.5) < opts.minStrength) {
        return false;
      }
      if (opts.maxStrength !== undefined && (rel.strength ?? 0.5) > opts.maxStrength) {
        return false;
      }

      return true;
    })
    .forEach(rel => {
      // ... rest of existing logic
    });

  // NEW: Optional sorting by strength
  if (opts.sortByStrength) {
    related.sort((a, b) => {
      const aRel = graph.relationships.find(r =>
        (r.src === entityId && r.dst === a.id) ||
        (r.dst === entityId && r.src === a.id)
      );
      const bRel = graph.relationships.find(r =>
        (r.src === entityId && r.dst === b.id) ||
        (r.dst === entityId && r.src === b.id)
      );
      return (bRel?.strength ?? 0.5) - (aRel?.strength ?? 0.5);
    });
  }

  return related;
}

// Helper wrappers with sensible defaults
export function getCoreMembers(graph: Graph, factionId: string): HardState[] {
  return getRelated(graph, factionId, 'member_of', 'dst', { minStrength: 0.7 });
}

export function getStrongAllies(graph: Graph, factionId: string): HardState[] {
  return getRelated(graph, factionId, 'ally_of', 'src', { minStrength: 0.6 });
}

export function getWeakRelationships(graph: Graph, entityId: string): Relationship[] {
  return graph.relationships.filter(r =>
    (r.src === entityId || r.dst === entityId) &&
    (r.strength ?? 0.5) < 0.3
  );
}
```

### Update Existing Systems to Use Strength

**Example: Conflict Contagion**

```typescript
// BEFORE: All allies spread conflict
const srcAllies = getRelated(graph, conflict.src, 'follower_of', 'dst');

// AFTER: Only strong allies spread conflict (>= 0.5 loyalty)
const srcAllies = getRelated(graph, conflict.src, 'follower_of', 'dst', {
  minStrength: 0.5
});
```

**Example: Succession Vacuum**

```typescript
// BEFORE: All faction members are claimants
const members = getFactionMembers(graph, faction.id);

// AFTER: Only core members (strength >= 0.7) can claim leadership
const claimants = getRelated(graph, faction.id, 'member_of', 'dst', {
  minStrength: 0.7
}).filter(m => m.kind === 'npc' && m.status === 'alive');
```

---

## Culling Mechanism

### System: **Relationship Culling**

**Purpose**: Remove weak relationships to improve performance and narrative focus

**Mechanism**:
```typescript
relationship_culling: {
  id: 'relationship_culling',

  metadata: {
    parameters: {
      cullThreshold: { value: 0.15 },     // Remove relationships below this
      cullFrequency: { value: 10 },        // Check every N ticks
      protectedKinds: [                    // Never cull these
        'member_of',      // Don't auto-remove faction membership
        'leader_of',      // Don't auto-remove leadership
        'resident_of'     // Don't auto-remove location (use migration instead)
      ],
      gracePeriod: { value: 20 }          // Don't cull relationships younger than this
    }
  },

  apply: (graph, modifier) => {
    // Only run every N ticks
    if (graph.tick % params.cullFrequency !== 0) {
      return { relationshipsRemoved: [] };
    }

    const removed: Relationship[] = [];

    graph.relationships = graph.relationships.filter(rel => {
      // Protected kinds never get culled
      if (params.protectedKinds.includes(rel.kind)) return true;

      // Young relationships get grace period
      const srcEntity = graph.entities.get(rel.src);
      const dstEntity = graph.entities.get(rel.dst);
      const age = Math.min(
        graph.tick - (srcEntity?.createdAt ?? 0),
        graph.tick - (dstEntity?.createdAt ?? 0)
      );
      if (age < params.gracePeriod) return true;

      // Cull if below threshold
      const strength = rel.strength ?? 0.5;
      if (strength < params.cullThreshold) {
        removed.push(rel);

        // Also remove from entity links
        if (srcEntity) {
          srcEntity.links = srcEntity.links.filter(l =>
            !(l.kind === rel.kind && l.src === rel.src && l.dst === rel.dst)
          );
        }
        if (dstEntity) {
          dstEntity.links = dstEntity.links.filter(l =>
            !(l.kind === rel.kind && l.src === rel.src && l.dst === rel.dst)
          );
        }

        return false; // Remove from graph
      }

      return true; // Keep
    });

    return {
      relationshipsRemoved: removed,
      description: `Weak relationships fade (${removed.length} culled)`
    };
  }
}
```

**Effects**:
- Graph size stays manageable (weak relationships removed)
- Query performance improves (fewer relationships to filter)
- Narrative focus: only meaningful relationships persist
- Creates survival-of-the-fittest for relationships

**Example Lifecycle**:
```
Tick 0:   NPC A meets NPC B → follower_of created (strength 0.6)
Tick 5:   Not in same location → decay to 0.58
Tick 10:  Not in same location → decay to 0.56
Tick 15:  Both join war → reinforce to 0.64
Tick 20:  War ends, separate → decay to 0.62
...
Tick 100: After many decays → strength 0.12
Tick 110: Culling system runs → relationship removed
```

---

## Review: Tags vs Strength in Existing Systems

### Current Tag Usage (Audit)

Let me check where tags might be incorrectly encoding strength:

1. **Proximity/Connection tags**: e.g., `'close_allies'`, `'trusted'`, `'estranged'`
   - ❌ Should use relationship strength instead
   - Example: Instead of `npc.tags.includes('trusted')`, use `getRelated(..., {minStrength: 0.8})`

2. **Status tags**: e.g., `'isolated'`, `'connected'`, `'influential'`
   - ⚠️ Mixed: `'isolated'` is emergent property (connection count), not relationship strength
   - ✅ Keep: Tags for entity state, strength for relationship state

3. **Temporal tags**: e.g., `'recent_conflict'`, `'veteran'`
   - ⚠️ Could use relationship age + strength instead
   - Example: Veterans = NPCs with old (age > 50) strong (strength > 0.7) `member_of` relationships

### Recommendation

**Tags for**: Entity-level properties (isolated, influential, fictional, etc.)
**Strength for**: Relationship-level properties (how strong is this specific bond)

**Migration**:
1. Search codebase for tags like `'strong_'`, `'weak_'`, `'close_'`, `'distant_'`
2. Replace with strength-based queries
3. Document tag → strength mapping

---

## Implementation Phases

### Phase 1: Foundation (1-2 hours)
1. ✅ Add `strength` field to Relationship type (DONE)
2. ✅ Add `RELATIONSHIP_STRENGTHS` config (DONE)
3. ✅ Update `addRelationship()` to assign strength (DONE)
4. ⬜ Add strength parameter to queries (`getRelated` options)
5. ⬜ Add helper functions (`getCoreMembers`, `getStrongAllies`)

### Phase 2: Dynamics (2-3 hours)
6. ⬜ Implement `relationship_decay` system
7. ⬜ Implement `relationship_reinforcement` system
8. ⬜ Add strength modification infrastructure (like `addRelationship`, create `modifyRelationshipStrength`)
9. ⬜ Add strength to parameter config (`config/templateSystemParameters.json`)

### Phase 3: Integration (1-2 hours)
10. ⬜ Update `conflictContagion` to use strength-filtered queries
11. ⬜ Update `successionVacuum` to use core members only
12. ⬜ Update `beliefContagion` to weight influence by strength
13. ⬜ Implement `conflict_strength_modifier` system

### Phase 4: Culling (1 hour)
14. ⬜ Implement `relationship_culling` system
15. ⬜ Add culling parameters to config
16. ⬜ Test culling doesn't remove critical relationships

### Phase 5: Advanced (optional, 2-3 hours)
17. ⬜ Implement `prominence_strength_modifier` system
18. ⬜ Add relationship strength to distribution metrics
19. ⬜ Add strength visualization to graph export
20. ⬜ Create relationship strength analysis tools

---

## Expected Outcomes

### Emergent Behaviors
1. **Veteran Bonds**: NPCs who survive many conflicts together develop unbreakable loyalty (strength → 1.0)
2. **Forgotten Allegiances**: Old faction members who left slowly lose connection (strength → 0.0 → culled)
3. **War Hardens Enemies**: Long conflicts create permanent hatred (enemy_of strength → 1.0)
4. **Fair-Weather Friends**: Friendships without proximity decay quickly
5. **Core vs Fringe**: Factions develop clear core membership (strength 0.8+) vs fringe (strength 0.3-0.5)

### Performance Improvements
- Graph queries faster (filter by strength before traversing)
- Smaller graph (weak relationships culled)
- More focused narratives (only strong relationships matter)

### Tuning Flexibility
All dynamics controlled by parameters:
- Decay rates: How fast do relationships fade?
- Reinforcement rates: How fast do they strengthen?
- Cull threshold: What counts as "too weak"?
- Protected kinds: Which relationships never decay?

---

## Questions for Review

1. **Decay Rates**: Should narrative relationships (leader_of, member_of) decay at all, or only via special events (death, betrayal)?

2. **Strength-Aware Templates**: Should templates create relationships with explicit strength overrides?
   ```typescript
   relationships: [
     { kind: 'member_of', src: cultistId, dst: cultId, strength: 0.9 } // Cultists start very loyal
   ]
   ```

3. **Bidirectional Strength**: Should `follower_of` have different strength in each direction?
   - NPC A → B (strength 0.8): "A really admires B"
   - NPC B → A (strength 0.3): "B barely knows A"
   - Currently relationships are directional but strength is symmetric

4. **Strength Decay During Sleep**: Should decay pause during eras/events where entities are inactive?

5. **Cull Notification**: Should culling generate history events? ("Old friendship between A and B fades into memory")
