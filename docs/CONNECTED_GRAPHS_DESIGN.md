# Connected Single-Kind Graphs & Distance Metrics

## Problem Statement

**Current State:**
- Locations: ~100% connected (all tie via contained_in/adjacent_to)
- NPCs: ~50% connected (some tie via family/faction/rivalry)
- Rules, Abilities, Factions: 0% connected (fully disconnected when filtered by kind)

**Goal:** Create fully connected single-kind graphs for ALL entity types using cognitive similarity distance metrics.

## Why This Matters

1. **Better Clustering:** Distance metrics enable more sophisticated clustering algorithms
2. **Richer Meta-Entities:** Connected entities provide more context for meta-entity formation
3. **Improved Lore:** Relationships show how entities relate within their domain
4. **Consistent Graph Structure:** All entity types follow same connectivity pattern

## Architecture

### Distance Metric

**New Field:** `Relationship.distance?: number`
- Range: 0.0 (identical) to 1.0 (maximally different)
- Represents cognitive similarity, not just physical distance
- Examples:
  - Combat techniques from same era/place: 0.2
  - Laws from same location: 0.3
  - Factions competing over same resource: 0.4
  - Completely unrelated abilities: 0.9

**Existing Field:** `Relationship.strength?: number`
- Keep current usage: 0.1 (weak/spatial) to 1.0 (strong/narrative)
- Represents narrative importance, not similarity

### Distance Calculation Framework

Create `calculateDistance(e1: HardState, e2: HardState): number` that considers:

1. **Temporal Proximity:** `|e1.createdAt - e2.createdAt| / maxTicks`
2. **Spatial Proximity:** Shared locations, containment depth
3. **Tag Overlap:** Jaccard distance `1 - (intersection / union)`
4. **Creator Overlap:** Do they share creators/practitioners?
5. **Subtype Similarity:** Same subtype = lower distance
6. **Prominence Similarity:** Similar prominence = lower distance

Combine with weighted formula:
```typescript
distance =
  0.3 * temporalDistance +
  0.2 * spatialDistance +
  0.2 * tagDistance +
  0.15 * creatorDistance +
  0.10 * subtypeDistance +
  0.05 * prominenceDistance
```

## Connected Graph Strategies by Entity Type

### 1. Abilities (Rules/Magic/Tech/Combat)

**Relationship:** `related_to` or `derived_from`
**Strategy:** Connect abilities with similar properties

```typescript
// For each ability:
// 1. Find 2-3 most similar abilities (lowest distance)
// 2. Create related_to relationships with distance metric
// 3. Prefer same subtype, same practitioner, similar tags

Example:
- Fireball ←[related_to, distance=0.2]→ Ice Bolt (both combat magic)
- Fireball ←[derived_from, distance=0.1]→ Greater Fireball (evolution)
```

**Distance Factors:**
- Same practitioner: -0.3
- Same subtype: -0.2
- Tag overlap: -0.1 per shared tag
- Created within 20 ticks: -0.2

### 2. Rules (Edicts/Taboos/Social/Natural)

**Relationship:** `related_to` or `supersedes`
**Strategy:** Connect rules by jurisdiction and purpose

```typescript
// For each rule:
// 1. Find rules in same location (applies_in)
// 2. Find rules from same era (active_during)
// 3. Create related_to with distance based on overlap

Example:
- "No theft" ←[related_to, distance=0.3]→ "No murder" (same colony)
- "Old tax law" ←[supersedes, distance=0.1]→ "New tax law" (replacement)
```

**Distance Factors:**
- Same applies_in location: -0.4
- Same active_during era: -0.2
- Similar tags (crime, trade, social): -0.2

### 3. Factions (Political/Criminal/Cult/Company)

**Relationship:** `allied_with`, `rival_of`, `predecessor_of`
**Strategy:** Connect factions through conflict, alliance, evolution

```typescript
// For each faction:
// 1. Find factions in same locations
// 2. Find factions with shared members
// 3. Create rival_of (distance based on conflict) or allied_with

Example:
- Merchant Guild ←[rival_of, distance=0.5]→ Criminal Syndicate (competition)
- Old Guard ←[predecessor_of, distance=0.2]→ New Guard (succession)
```

**Distance Factors:**
- Share territory: -0.3 (creates rivalry/alliance)
- Share members: -0.4 (close relationship)
- Same subtype: -0.2
- Competing for resources: inverse of conflict intensity

### 4. NPCs

**Already ~50% connected, improve to 100%**

**Additional Relationships:** `knows_of`, `heard_of`
**Strategy:** Weak social connections for unconnected NPCs

```typescript
// For unconnected NPCs:
// 1. Find NPCs in same/nearby locations
// 2. Find NPCs in same factions
// 3. Create weak knows_of relationships

Example:
- Distant NPC ←[heard_of, distance=0.7]→ Famous Hero (reputation)
- Colony Member ←[knows_of, distance=0.4]→ Colony Member (same location)
```

### 5. Locations

**Already ~100% connected** ✓
Continue using contained_in, adjacent_to with distance = spatial depth

## Implementation Phases

### Phase 1: Distance Calculation (Foundation)
1. Add `distance` field to Relationship type ✓
2. Create `calculateDistance(e1, e2)` helper in utils
3. Update clustering algorithms to use distance
4. Test with existing relationships

### Phase 2: Ability Linking
1. Create `linkAbilities()` system
2. For each ability, find 2-3 nearest (by distance)
3. Create `related_to` relationships with distance metric
4. Run at end of each epoch

### Phase 3: Rule Linking
1. Create `linkRules()` system
2. Group by location/era, create relationships
3. Add `supersedes` for temporal replacement

### Phase 4: Faction Linking
1. Create `linkFactions()` system
2. Detect territorial overlap → rival_of
3. Detect shared members → allied_with
4. Detect succession → predecessor_of

### Phase 5: NPC Completion
1. Create `completeNPCGraph()` system
2. Add weak `knows_of` for unconnected NPCs
3. Use reputation (prominence) for distance

### Phase 6: Clustering Integration
1. Update meta-entity clustering to use distance
2. Weight distance heavily in similarity calculation
3. Test magic schools, combat styles, legal codes

## Benefits for Meta-Entity Formation

With connected graphs and distance metrics:

```typescript
// Current clustering:
criteria: [
  { type: 'shared_practitioner', weight: 5.0 },
  { type: 'shared_tags', weight: 2.0 }
]

// Future clustering with distance:
criteria: [
  { type: 'shared_practitioner', weight: 5.0 },
  { type: 'low_distance', weight: 4.0, threshold: 0.3 },  // Distance < 0.3
  { type: 'connected_component', weight: 3.0 }  // Part of same subgraph
]
```

**Result:** Meta-entities form from tightly connected clusters of similar entities, not just shared practitioners.

## Example Output

```json
{
  "kind": "abilities",
  "name": "Frost Bolt",
  "relationships": [
    {
      "kind": "related_to",
      "dst": "ice_lance_42",
      "distance": 0.15,
      "strength": 0.5
    },
    {
      "kind": "practitioner_of",
      "dst": "frost_mage_12",
      "distance": 0.0,
      "strength": 1.0
    }
  ]
}
```

## Validation

For each entity type, measure:
- **Connectivity:** % of entities reachable from any other via same-kind relationships
- **Average Distance:** Mean distance in same-kind subgraph
- **Cluster Quality:** Silhouette coefficient using distance metric

**Target Metrics:**
- Connectivity: 100% for all entity types
- Average Distance: 0.3-0.5 (balanced - not too clustered, not too spread)
- Cluster Quality: > 0.5 (well-defined clusters)

## Open Questions

1. **Relationship Budget:** How many same-kind relationships per entity?
   - Proposal: 2-4 per entity (sparse but connected)

2. **Bidirectional vs Unidirectional:**
   - `related_to`: Bidirectional (mutual similarity)
   - `derived_from`: Unidirectional (has direction)

3. **Dynamic Updates:**
   - Should distance update as entities change?
   - Or freeze at relationship creation?

4. **Occurrence Integration:**
   - Should occurrences (wars, disasters) also form connected graph?
   - Probably yes - related_to for similar events
