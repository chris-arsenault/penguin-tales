# Template Strategy Taxonomy

This document defines the meta-structure for templates as composable strategies. Each template follows an ordered pipeline with multiple strategy options at each step.

## Pipeline Overview

```
┌─────────────────────┐
│ 1. APPLICABILITY    │  Should template run?
│    CHECK            │
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 2. TARGET           │  What entities to act upon?
│    SELECTION        │
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 3. ENTITY           │  How to create new entities?
│    CREATION         │
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 4. RELATIONSHIP     │  How to connect entities?
│    CREATION         │
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 5. STATE            │  What side effects to apply?
│    UPDATES          │
└─────────────────────┘
```

---

## Step 1: Applicability Strategies

Determines when a template can run.

| Strategy | Description | Parameters | Used By |
|----------|-------------|------------|---------|
| `pressure_threshold` | Run when pressure is within bounds | pressureId, min, max | heroEmergence, magicDiscovery |
| `pressure_any_above` | Run when any pressure exceeds threshold | minValue | emergentLocationDiscovery |
| `entity_count_min` | Run when entity count meets minimum | kind, subtype, min | most templates |
| `entity_count_max` | Saturation check - below maximum | kind, subtype, max | heroEmergence, cultFormation |
| `era_match` | Run only in specific eras | eras[] | geographicExploration |
| `random_chance` | Probabilistic trigger | chance (0-1) | geographicExploration |
| `cooldown_elapsed` | Time since last action | cooldownTicks | location discoveries |
| `composite_and` | All conditions must pass | children[] | complex templates |
| `composite_or` | Any condition can pass | children[] | flexible triggers |

---

## Step 2: Target Selection Strategies

Determines how to find entities to act upon.

| Strategy | Description | Parameters | Used By |
|----------|-------------|------------|---------|
| `by_kind` | Filter by entity kind/subtype | kind, subtypes[] | most templates |
| `by_preference_order` | Try subtypes in order | kind, subtypes[] | explorer selection |
| `by_status` | Filter by entity status | kind, statusFilter | NPC templates |
| `by_relationship` | Has/lacks relationships | kind, relKind, required | succession, guild |
| `by_proximity` | Spatial proximity to reference | kind, refEntity, maxDist | kinship, family |
| `by_prominence` | Filter by prominence level | kind, prominenceMin | mysteriousVanishing |
| `by_culture` | Filter by culture match | kind, cultureId | culture-specific |
| `by_faction` | Filter by faction membership | kind, factionId | faction templates |
| `random_from_pool` | Random from filtered pool | maxResults | most templates |
| `weighted_random` | Weighted by scoring function | - | mysteriousVanishing |
| `all_matching` | Return all matching | - | batch operations |

---

## Step 3: Entity Creation Strategies

Determines how to generate new entities.

| Strategy | Description | Parameters | Used By |
|----------|-------------|------------|---------|
| `simple_direct` | Single entity, fixed attributes | kind, subtype, status | heroEmergence |
| `batch_uniform` | N entities, same attributes | kind, subtype, count | - |
| `batch_varied` | N entities, varied attributes | kind, countRange | orcaRaiderArrival, kinship |
| `near_reference` | Place near reference entity | kind, refKind, culture | familyExpansion |
| `in_culture_region` | Place in culture's region | kind, subtype, culture | most templates |
| `with_lineage` | Link to existing similar | kind, lineageKind, dist | magicDiscovery |
| `procedural_theme` | Generate from world state | kind, themeSource | geographicExploration |
| `computed_placement` | Algorithm placement | kind, algorithm | colonyFounding (Voronoi) |
| `selection_hybrid` | Select existing OR create | kind, preferExisting | cultFormation, guild |
| `from_relationship` | Derive from relationships | refRelationship | succession |
| `none` | No entity creation | - | territorialExpansion |

### Creation Modifiers

| Modifier | Description | Values |
|----------|-------------|--------|
| `cultureInherit` | Inherit culture from reference | true/false |
| `zAdjustment` | Vertical offset (underwater/sky) | { min, max } |
| `maxCreated` | Cap on new entities | number |
| `distanceRange` | Lineage distance range | { min, max } |

---

## Step 4: Relationship Creation Strategies

Determines how to connect entities.

### Relationship Categories

| Category | Relationship Kinds | Description |
|----------|-------------------|-------------|
| **Hierarchical** | leader_of, member_of, resident_of | Ownership/authority |
| **Discovery** | explorer_of, discovered_by, discoverer_of | Attribution |
| **Lineage** | inspired_by, related_to, split_from, derived_from, supersedes | Heritage/evolution |
| **Conflict** | enemy_of, rival_of, at_war_with | Opposition |
| **Social** | mentor_of, lover_of, believer_of, champion_of, searching_for | Bonds |
| **Economic** | controls, trades_with, occupies, seeks | Resources |
| **Spatial** | adjacent_to, contained_by, manifests_at, originated_in, last_seen_at | Geography |

### Relationship Strategies

| Strategy | Description | Parameters |
|----------|-------------|------------|
| `unidirectional` | Single direction relationship | kind, src, dst |
| `bidirectional` | Pair of opposite relationships | kind, src, dst |
| `with_distance` | Include semantic distance (0-1) | kind, distanceRange |
| `with_strength` | Include relationship intensity | kind, strength |
| `with_catalyst` | Include catalyzedBy attribution | kind, catalystId |
| `conditional` | Only if condition met | kind, condition fn |

### Lineage Distance Semantics

| Distance | Meaning | Examples |
|----------|---------|----------|
| 0.1-0.2 | Amendment/refinement | Tech evolution, succession |
| 0.2-0.4 | Minor variation | Pack coordination, cultural drift |
| 0.4-0.7 | Moderate change | Reform movements, ideological shift |
| 0.7-0.9 | Revolutionary change | Faction splinter, foreign influence |

---

## Step 5: State Update Strategies

Side effects after entity/relationship creation.

| Strategy | Description | Parameters | Used By |
|----------|-------------|------------|---------|
| `update_discovery_state` | Track discovery timing | - | location discoveries |
| `archive_relationship` | Mark old rel as historical | entityId, relKind | succession |
| `modify_pressure` | Change pressure values | pressureId, delta | conflict templates |
| `update_entity_status` | Change entity status | entityId, newStatus | death, transitions |
| `record_history_event` | Add to history log | eventType, details | major events |
| `none` | No state updates | - | simple templates |

---

## Template Examples by Pattern

### Pattern A: NPC Creation (heroEmergence, succession, familyExpansion)

```yaml
applicability:
  - strategy: pressure_threshold
    pressureId: conflict
    min: 5, max: 80
  - strategy: entity_count_max
    kind: npc, subtype: hero, max: 30

selection:
  strategy: by_kind
  kind: location
  subtypes: [colony]

creation:
  strategy: near_reference
  kind: npc
  subtype: hero
  cultureInherit: true

relationships:
  - strategy: hierarchical
    kind: resident_of
```

### Pattern B: Location Discovery (geographicExploration, resourceLocationDiscovery)

```yaml
applicability:
  - strategy: era_match
    eras: [expansion, reconstruction]
  - strategy: cooldown_elapsed
    cooldownTicks: 8
  - strategy: random_chance
    chance: 0.08

selection:
  strategy: by_preference_order
  kind: npc
  subtypes: [hero, merchant]
  statusFilter: alive

creation:
  strategy: procedural_theme
  kind: location
  themeSource: era
  cultureInherit: true

relationships:
  - strategy: discovery
    kind: explorer_of
  - strategy: discovery
    kind: discovered_by
  - strategy: bidirectional
    kind: adjacent_to
```

### Pattern C: Faction with Members (cultFormation, guildEstablishment)

```yaml
applicability:
  - strategy: entity_count_min
    kind: location, subtype: anomaly, min: 1
  - strategy: entity_count_max
    kind: faction, subtype: cult, max: 15

selection:
  strategy: by_kind
  kind: location
  subtypes: [anomaly]

creation:
  - strategy: in_culture_region  # Faction
    kind: faction
    subtype: cult
  - strategy: near_reference     # Leader
    kind: npc
    subtype: hero
  - strategy: selection_hybrid   # Members
    kind: npc
    preferExisting: true
    maxCreated: 2

relationships:
  - kind: occupies (faction → location)
  - kind: leader_of (leader → faction)
  - kind: member_of (members → faction)
```

### Pattern D: Ability Creation with Lineage (magicDiscovery, techInnovation)

```yaml
applicability:
  - strategy: pressure_threshold
    pressureId: magical_instability
    min: 10, max: 70

selection:
  strategy: by_kind
  kind: npc
  subtypes: [hero]
  statusFilter: alive

creation:
  strategy: with_lineage
  kind: abilities
  subtype: magic
  lineageKind: related_to
  distanceRange: { min: 0.5, max: 0.9 }

relationships:
  - kind: discoverer_of (hero → ability)
  - kind: practitioner_of (hero → ability)
  - kind: manifests_at (ability → anomaly)
  - kind: related_to (ability → existing ability) [with distance]
```

### Pattern E: Relationship-Only (territorialExpansion, tradeRouteEstablishment)

```yaml
applicability:
  - strategy: entity_count_min
    kind: faction, min: 2

selection:
  strategy: by_kind
  kind: faction
  subtypes: [company, colony]

creation:
  strategy: none

relationships:
  - strategy: with_catalyst
    kind: controls
    catalystId: leader
  - strategy: bidirectional
    kind: trades_with
```

---

## Strategy Composition Rules

1. **Applicability**: Multiple strategies combined with AND logic by default
2. **Selection**: Single primary strategy, can chain filters
3. **Creation**: Usually single strategy, can have multiple entities
4. **Relationships**: Multiple relationships common, each with own strategy
5. **State Updates**: Optional, zero or more updates

---

## UI/DSL Mapping

Each strategy can be represented in a UI as:

```
┌────────────────────────────────────────┐
│ Template: Hero Emergence               │
├────────────────────────────────────────┤
│ When to Run:                           │
│  ☑ Pressure: conflict 5-80            │
│  ☑ Max heroes: 30                     │
├────────────────────────────────────────┤
│ Select Target:                         │
│  Kind: [location ▼] Subtype: [colony] │
├────────────────────────────────────────┤
│ Create Entity:                         │
│  Kind: [npc ▼] Subtype: [hero]        │
│  ☑ Inherit culture from target        │
│  ☑ Place near target                  │
├────────────────────────────────────────┤
│ Relationships:                         │
│  + [resident_of] new → target         │
└────────────────────────────────────────┘
```
