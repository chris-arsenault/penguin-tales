# World-Level Systems Design

**Status**: Design phase - implement AFTER framework/domain decoupling refactor
**Date**: 2025-11-23
**Context**: Current systems are 69% NPC-focused, but output is day 0 game lore where factions/locations/magic matter more than NPC social drama

## Problem Statement

### Current System Output Analysis

```
NPC-related relationships: 774 (69%)
  - NPC ↔ NPC social: 592 (lover_of, mentor_of, rival_of, enemy_of, follower_of)
  - NPC ↔ Faction: 66 (member_of, leader_of)
  - NPC ↔ Location: 79 (resident_of)
  - NPC ↔ Ability: 37 (practitioner_of, discoverer_of)

World-level relationships: 344 (31%)
  - Faction ↔ Faction: 300 (mostly enemy_of from conflict contagion)
  - Faction ↔ Location: 7 (only originated_in)
  - Location ↔ Location: 25 (adjacent_to, contains - geographic facts)
  - Location ↔ Ability: 12 (manifests_at, slumbers_beneath)
```

**Goal**: Invert this ratio to 30% NPC, 70% world-level

### Why This Matters

The output is used as **day 0 lore for a narrative game**. Players care about:
- ✓ "Why do these two cities hate each other?" (Location ↔ Location conflict)
- ✓ "What magic disaster shaped this region?" (Ability ↔ Location corruption)
- ✓ "Which faction controls the ancient technology?" (Faction ↔ Ability monopoly)
- ✓ "Why is this location cursed/blessed?" (Location ↔ Ability effects)
- ❌ "Who is dating whom?" (NPC social drama - low game relevance)

**Current systems focus on the wrong entity types.**

## Primary Goals (Reminder)

The system must produce graphs with:
1. **Normal distributions** for entity and relationship kind counts
2. **Power law distribution** for connectivity (hubs and long tails)
3. **Narrative/historical depth** and variety
4. **Game-relevant lore** (factions, locations, magic, tech)

## Recommended Solution: Three-Layer Architecture

### Layer 1: Immutable Facts (Simple, Emergent)

**Principle**: Geographic, historical, and supernatural facts are **constants**, not dynamics.

```typescript
const IMMUTABLE_KINDS = [
  // Geographic facts (never change)
  'adjacent_to', 'contains', 'contained_by',

  // Historical facts (can't change the past)
  'originated_in', 'founded_by', 'discoverer_of',

  // Supernatural facts (permanent magic)
  'slumbers_beneath', 'manifests_at'
];
```

**Implementation**: These relationships:
- Created once (by templates)
- Always strength = 1.0
- Skip ALL system processing (no decay, no reinforcement, no culling)
- Form the stable backbone for narrative depth

**Impact on Goals**:
- ✓ Narrative depth: Historical anchors preserved forever
- ✓ Power law: Stable backbone doesn't interfere with emergent hubs
- ✓ Simplicity: One exemption list, clear semantics

### Layer 2: NPC Social Dynamics (Reduce, Don't Remove)

**Principle**: Social bonds are emergent but **de-emphasized** for game lore.

**Changes**:
```typescript
// Throttle NPC relationship formation
relationship_formation.throttle = 0.9  // Run 10% of ticks (was 30%)

// Keep existing decay/reinforcement
// But only for social bonds: friend_of, lover_of, mentor_of, follower_of, rival_of
```

**Impact on Goals**:
- ✓ Power law: Still creates NPC social hubs (but less dominant)
- ✓ Variety: Some social dynamics for flavor
- ✓ Simplicity: Keep existing systems, just throttle down

### Layer 3: World-Level Systems (NEW - Core Focus)

**Principle**: Factions, locations, and abilities are the **protagonists** of the world story.

## Missing World-Level Systems

### A. Territorial Control System

**Purpose**: Factions compete for control of locations

**Creates**:
- `controls`: Faction has authority over location
- `contests`: Faction actively trying to seize location
- `sieges`: Active military conflict over location

**Mechanics**:
```typescript
// Triggers
- Faction prominence > location prominence → attempt control
- Factions with enemy_of relationship → contest each other's territories
- Resource scarcity pressure → territorial expansion

// Dynamics
- controls relationships decay if faction loses prominence
- contests escalate to sieges based on conflict pressure
- Successful siege → transfer controls relationship
```

**Game Impact**:
```
"The Midnight Claws control Nightfall Shelf" (power structure)
"East Perch Merchants contest Aurora Stack's trade routes" (conflict driver)
"The Icebound Exchange lost control of Krill Shoals to raiders" (historical event)
```

**Parameters** (tunable via GA):
- `controlAttemptChance`: Base chance faction tries to control location
- `contestEscalationRate`: How quickly contests become sieges
- `controlDecayRate`: How fast control weakens without reinforcement

### B. Magical Corruption System

**Purpose**: Abilities physically shape locations

**Creates**:
- `corrupted_by`: Ability warps/damages location
- `blessed_by`: Ability enhances/protects location
- `scarred_by`: Permanent mark from magical disaster
- `amplifies`: Location strengthens ability manifestation

**Mechanics**:
```typescript
// Triggers
- Ability with manifests_at location → chance of corruption/blessing
- Magical instability pressure → corruption spreads
- Prominent abilities affect more locations (preferential attachment)

// Dynamics
- corrupted_by increases over time (progressive corruption)
- blessed_by can counter corruption
- scarred_by is permanent (historical anchors)
```

**Game Impact**:
```
"The Glow-Fissure corrupts Nightfall Shelf, warping reality" (danger zone)
"Aurora Berg blessed_by ancient ice magic" (safe haven)
"Krill Shoals scarred_by failed arcane experiment" (historical depth)
```

**Parameters**:
- `corruptionSpreadRate`: How fast corruption spreads per tick
- `blessingDecayRate`: How fast blessings fade
- `prominenceThreshold`: Ability prominence needed to affect locations

### C. Technological Adoption System

**Purpose**: Factions gain power through technology/magic control

**Creates**:
- `weaponizes`: Faction militarizes an ability
- `monopolizes`: Faction controls exclusive access to ability
- `bans`: Faction prohibits ability (creates black markets)
- `researches`: Faction actively developing ability

**Mechanics**:
```typescript
// Triggers
- Faction has practitioner_of ability → chance to weaponize
- Innovation era → increased adoption rates
- Conflict pressure → weaponization pressure
- Prominent factions monopolize rare abilities (power law)

// Dynamics
- monopolizes creates advantage (faction prominence boost)
- weaponizes enables new conflict capabilities
- bans creates enemy_of with violator factions
```

**Game Impact**:
```
"East Perch Merchants weaponize fishing gun technology" (military advantage)
"The Icebound Exchange monopolizes ice magic trade" (economic power)
"Aurora Stack bans shadow magic after disaster" (cultural conflict)
```

**Parameters**:
- `weaponizationChance`: Base chance faction militarizes tech
- `monopolyDecayRate`: How fast monopolies erode
- `banEnforcementStrength`: Impact of bans on relationships

### D. Location Rivalry System (Optional)

**Purpose**: Cities/colonies compete directly

**Creates**:
- `rival_of`: Locations compete for resources/influence
- `allied_with`: Locations cooperate (trade, defense)
- `trade_routes`: Economic connections
- `refugee_flows`: Population movement under pressure

**Mechanics**:
```typescript
// Triggers
- Locations with same controlling factions (enemy_of) → rivalry
- Adjacent locations with resource competition
- External threat pressure → alliances

// Dynamics
- Trade routes strengthen alliances
- Rivalries intensify under scarcity
- Refugee flows shift population/prominence
```

**Game Impact**:
```
"Aurora Stack rival_of East Perch (trade competition)" (economic conflict)
"Nightfall Shelf allied_with Krill Shoals (mutual defense)" (political alliance)
"Refugee flows from corrupted South Roost to Aurora Berg" (crisis event)
```

### E. Magical Discovery System (Optional)

**Purpose**: Abilities emerge from and affect specific places

**Creates**:
- `discovered_at`: Ability first found at location
- `sealed_in`: Ability contained/hidden in location
- `unleashed_from`: Ability released from containment

**Mechanics**:
```typescript
// Triggers
- New ability creation → discovered_at assignment
- Magical instability → unleashed_from events
- Faction control + dangerous ability → sealed_in

// Dynamics
- discovered_at creates historical anchors
- sealed_in creates quest hooks ("break the seal")
- unleashed_from creates crisis events
```

**Game Impact**:
```
"Shadow magic discovered_at The Glow-Fissure" (origin story)
"Ancient ice power sealed_in Aurora Berg" (mystery/quest)
"Chaos magic unleashed_from broken containment" (world event)
```

## Implementation Priority

**Phase 1** (After framework refactor):
1. `territorial_control` - Core game mechanic, high impact
2. `magical_corruption` - Creates environmental storytelling
3. `technological_adoption` - Power dynamics and conflict drivers

**Phase 2** (Optional enhancements):
4. `location_rivalry` - Adds economic/political layer
5. `magical_discovery` - Origin stories and quest hooks

## Impact on Primary Goals

### Normal Distributions
- ✓ Templates still control entity creation rates
- ✓ New systems control world-level relationship creation rates
- ✓ GA can tune system parameters to achieve target distributions

### Power Law Connectivity
- ✓✓ **Improved**: Prominent factions/locations become hubs via world systems
- ✓ Preferential attachment: Powerful factions control more territories
- ✓ Currently only NPCs create hubs; this adds faction/location hubs

### Narrative Depth
- ✓✓✓ **Significantly improved**: World-shaping events replace NPC gossip
- ✓ Historical anchors: discovered_at, scarred_by, originated_in
- ✓ Emergent stories: Territorial wars, magical corruption, tech races

### Variety
- ✓✓ More relationship types (15+ new kinds)
- ✓ More entity interaction patterns (9 new dynamics)
- ✓ Era-specific activation (Innovation → tech adoption, Conflict → territorial control)

## System Design Principles (Post-Refactor)

When implementing these systems after the framework refactor:

1. **Separation of Concerns**: Systems should be pure functions of graph state
2. **Declarative Metadata**: All parameters declared in metadata, not hardcoded
3. **Compositional**: Systems don't know about each other
4. **Tunable**: All rates/thresholds exposed to GA optimization
5. **Semantic Categories**: Relationship kinds grouped by semantic meaning

## Relationship Categories (Post-Refactor Schema)

```typescript
// Add to worldSchema.json (when created)
const relationshipCategories = {
  geographic: {
    kinds: ['adjacent_to', 'contains', 'contained_by'],
    mutable: false,  // Never decay/change
    strength: 1.0
  },
  historical: {
    kinds: ['originated_in', 'founded_by', 'discoverer_of', 'discovered_at'],
    mutable: false,
    strength: 1.0
  },
  supernatural: {
    kinds: ['slumbers_beneath', 'manifests_at', 'corrupted_by', 'blessed_by', 'scarred_by'],
    mutable: 'partial',  // Some decay, some immutable
    strength: 'varies'
  },
  political: {
    kinds: ['controls', 'contests', 'sieges', 'allied_with'],
    mutable: true,
    decay: 'medium'
  },
  economic: {
    kinds: ['monopolizes', 'trade_routes', 'blockades'],
    mutable: true,
    decay: 'slow'
  },
  technological: {
    kinds: ['weaponizes', 'bans', 'researches'],
    mutable: true,
    decay: 'medium'
  },
  social: {
    kinds: ['friend_of', 'lover_of', 'mentor_of', 'follower_of', 'rival_of'],
    mutable: true,
    decay: 'fast'
  }
};
```

## Expected Outcome

After implementing these systems:

```
Target relationship distribution:
  World-level: ~70%
    - Faction ↔ Location: 25% (controls, contests, originated_in)
    - Faction ↔ Ability: 15% (weaponizes, monopolizes, bans)
    - Location ↔ Ability: 15% (corrupted_by, blessed_by, manifests_at)
    - Location ↔ Location: 10% (adjacent_to, rival_of, trade_routes)
    - Faction ↔ Faction: 5% (allied_with, enemy_of)

  NPC-related: ~30%
    - NPC ↔ NPC: 15% (throttled social bonds)
    - NPC ↔ Faction: 10% (member_of, leader_of)
    - NPC ↔ Location: 3% (resident_of)
    - NPC ↔ Ability: 2% (practitioner_of)
```

**Game Lore Quality**: High - focuses on world-shaping events, faction conflicts, magical corruption, territorial struggles

## Questions for Future Implementation

1. **System Interactions**: How do world systems interact?
   - Example: `controls` + `corrupted_by` → controlling faction tries to `seal_in` corruption?

2. **Cascading Effects**: Should systems trigger each other?
   - Example: `monopolizes` tech → rival factions form `allied_with` against monopolist?

3. **Historical Events**: Should major changes create history entries?
   - Example: "The Midnight Claws seized control of Nightfall Shelf" (tick 47)

4. **Pressure Mapping**: Which pressures drive which systems?
   - `conflict` → territorial_control, weaponization
   - `magical_instability` → corruption, sealing
   - `resource_scarcity` → monopolization, trade competition

## References

- Original analysis: `/world-gen-optimizer/scripts/analyze-relationship-semantics.ts`
- System coverage analysis: `/world-gen-optimizer/scripts/analyze-coverage.ts`
- System focus analysis: `/world-gen-optimizer/scripts/analyze-system-focus.ts`
- Current violations issue: `BUG_FIXES.md` (relationship decay/culling problems)

## Notes

- This design assumes the framework/domain refactor provides cleaner system composition
- All parameters should be exposed to GA optimization
- Systems should declare their relationship kind outputs in metadata
- Consider adding relationship kind validation against schema (when schema exists)
- World-level systems should use the same preferential attachment patterns as social systems (prominent entities attract more relationships)
