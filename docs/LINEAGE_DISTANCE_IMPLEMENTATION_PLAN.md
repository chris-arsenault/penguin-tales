# Lineage-Based Distance Implementation Plan

## Overview

Implement a lineage-based connectivity system where entities link to existing same-kind entities **during creation** (not post-processing), using bounded random distance metrics.

## Core Principle

**All entities have lineage** - they connect to existing entities when created, just like locations do. This creates fully connected single-kind graphs naturally through the generation process.

## Relationship Properties

```typescript
interface Relationship {
  strength?: number;   // Narrative importance (0.1 = weak, 1.0 = strong)
  distance?: number;   // Cognitive similarity (0 = identical, 1 = maximally different)
  category?: string;   // Domain-defined category (e.g., 'immutable_fact', 'political', 'social')
}
```

### Immutable vs Mutable Relationships

**Immutable Relationships** (Static - set at spawn, never change):
- **Definition**: Formed at entity creation, represent cognitive distance or spatial facts
- **Characteristics**: Distance is static, relationship can't change
- **Same-Kind Examples**:
  - `derived_from`: New ability derived from existing (distance = how different)
  - `related_to`: Generic similarity connection between same-kind entities
  - `split_from`: Faction lineage (distance = ideological difference)
  - `supersedes`: Rule replacement (distance = legal distance)
- **Spatial Examples**:
  - `adjacent_to`: Location proximity (distance = actual distance in km)
  - `contained_by`: Structural containment
  - `part_of`: Meta-entity subsumption
- **Category**: Mark with `category: 'immutable_fact'`

**Mutable Relationships** (Dynamic - change over time):
- **Definition**: Form during events/simulation, can strengthen/weaken/end
- **Characteristics**: Strength can change, relationships can be archived
- **Examples**:
  - `trades_with`: Economic relationship (strength fluctuates)
  - `at_war_with`: Conflict (can start/end)
  - `ally_of`: Alliance (can strengthen/weaken)
  - `enemy_of`: Enmity (can escalate/de-escalate)
  - `member_of`: Faction membership (can change/end)
- **Category**: Mark with domain-specific categories like `category: 'political'`, `category: 'social'`, etc.

**Example - Two Cities:**
```typescript
// Immutable - geographic fact, set at city creation
{ kind: 'adjacent_to', src: 'city_a', dst: 'city_b', distance: 0.4, category: 'immutable_fact' }

// Mutable - political relationship, changes over time
{ kind: 'trades_with', src: 'city_a', dst: 'city_b', strength: 0.8, category: 'political' }
{ kind: 'at_war_with', src: 'city_a', dst: 'city_b', strength: 0.6, category: 'political' }
```

### Distance Meaning (for Immutable Relationships)

**Distance represents:**
- 0.0-0.2: Incremental improvement, minor variation
- 0.3-0.5: Moderate difference, related approach
- 0.6-0.8: Major departure, new school of thought
- 0.9-1.0: Revolutionary, completely different

## Implementation Strategy

### Phase 1: Helper Functions ✅ COMPLETED
Update `src/utils/helpers.ts` to support distance:

```typescript
// Updated function signature
addRelationship(graph, kind, src, dst, strengthOverride?, distance?)
  - strengthOverride: Optional strength (overrides auto-assigned)
  - distance: Optional cognitive distance

// New convenience function
addRelationshipWithDistance(graph, kind, src, dst, distanceRange, strengthOverride?)
  - distanceRange: { min: number, max: number }
  - Randomly selects distance within range
  - Calls addRelationship with selected distance
```

**Implementation Notes:**
- Both functions now support distance parameter
- addRelationship auto-assigns strength if not provided
- addRelationshipWithDistance validates range and randomizes within bounds

### Phase 2: Template Updates

Update templates to create same-kind relationships when spawning entities:

#### Abilities Templates

**Tech Breakthrough** (`src/domain/penguin/templates/abilities/techBreakthrough.ts`)
- Find existing technology abilities
- Link new tech to most recent/related with `derived_from` or `related_to`
- Distance range: 0.1-0.3 (incremental innovation)

**Magical Site Discovery** (`src/domain/penguin/templates/abilities/magicalSiteDiscovery.ts`)
- Find existing magic abilities
- Link new magic to existing with `related_to`
- Distance range: 0.5-0.9 (distinct magical tradition)

**Ability Discovery** (general)
- Link to existing abilities of same subtype
- Distance range based on discovery context:
  - Same practitioner learning: 0.1-0.2
  - Different practitioner, same school: 0.3-0.5
  - New discovery: 0.6-0.8

#### Faction Templates

**Faction Splinter** (`src/domain/penguin/templates/faction/factionSplinter.ts`)
- Already creates `split_from` to parent
- Add distance based on split severity:
  - Minor disagreement: 0.15-0.35
  - Major ideological split: 0.6-0.8

**Faction Founding**
- Link to existing factions via `allied_with` or `rival_of`
- Distance based on relationship:
  - Allied (similar goals): 0.2-0.4
  - Rival (competing): 0.5-0.7

#### Rules Templates

**Rule Creation**
- Link to existing rules in same location with `related_to` or `supersedes`
- Distance range:
  - Amendment/refinement: 0.1-0.2
  - New but related law: 0.3-0.5
  - Revolutionary legal change: 0.7-0.9

#### NPC Templates

**Hero Emergence**
- Link to existing heroes via `inspired_by` or `rival_of`
- Distance range:
  - Same tradition: 0.1-0.3
  - Different approach: 0.5-0.7

**Family Expansion**
- Already creates family relationships (not same-kind)
- No changes needed

### Phase 3: Relationship Kind and Category Additions

Add relationship kinds to schema for lineage tracking:

**Same-Kind Immutable Relationships:**
- `derived_from`: abilities → abilities, rules → rules (incremental improvements)
- `related_to`: any → same-kind (generic similarity connection)
- `split_from`: factions → factions (already exists, add distance)
- `supersedes`: rules → rules (replacement/evolution)
- `inspired_by`: npcs → npcs, abilities → abilities (influence)

**Category Field:**
Add `category` to all relationships to mark mutability:
- `'immutable_fact'`: Never changes (lineage, spatial facts)
- `'political'`: Can change (alliances, wars, trades)
- `'social'`: Can change (friendships, rivalries)
- `'institutional'`: Can change (memberships, leadership)

**Default Categories by Relationship Kind:**
```typescript
const IMMUTABLE_RELATIONSHIPS = [
  'derived_from', 'related_to', 'split_from', 'supersedes',
  'inspired_by', 'adjacent_to', 'contained_by', 'part_of',
  'founded_by', 'created_by', 'discovered_by'
];

const RELATIONSHIP_CATEGORIES: Record<string, string> = {
  // Immutable (lineage and facts)
  'derived_from': 'immutable_fact',
  'related_to': 'immutable_fact',
  'split_from': 'immutable_fact',
  'supersedes': 'immutable_fact',
  'inspired_by': 'immutable_fact',
  'adjacent_to': 'immutable_fact',
  'contained_by': 'immutable_fact',
  'part_of': 'immutable_fact',

  // Mutable (political)
  'trades_with': 'political',
  'at_war_with': 'political',
  'ally_of': 'political',
  'enemy_of': 'political',
  'controls': 'political',

  // Mutable (social)
  'friend_of': 'social',
  'rival_of': 'social',
  'lover_of': 'social',
  'mentor_of': 'social',

  // Mutable (institutional)
  'member_of': 'institutional',
  'leader_of': 'institutional',
  'practitioner_of': 'institutional',
};
```

### Phase 4: Validation

After implementation, verify:
- **Connectivity**: All entity kinds form connected graphs (except era/occurrence)
- **Distance Distribution**: Distances are meaningful and varied
- **No Orphans**: New entities always link to at least one same-kind entity
- **Distance Consistency**: Similar templates produce similar distance ranges

## Template Priority

Update in this order (highest impact first):

1. **Faction Splinter** - Already has parent link, just add distance
2. **Tech Breakthrough** - Clear incremental lineage
3. **Rule Creation** - Legal evolution
4. **Ability Discovery** - Magic/combat lineage
5. **Faction Founding** - Alliance/rivalry network
6. **Hero Emergence** - Inspiration chains

## Testing Strategy

1. Run generation with small target (30 entities)
2. Verify all abilities/rules/factions are connected
3. Check distance distribution in output
4. Verify no same-kind orphans
5. Run full generation, check connectivity at scale

## Notes

- **Immutable relationships**: Distance is static, set at creation, never changes
- **Mutable relationships**: Strength can change, relationships can be archived
- Templates determine distance based on **narrative context** for lineage relationships
- This replaces the need for post-creation fix-up systems
- Locations already work this way - we're extending the pattern to all entity kinds
- Category field enables systems to know which relationships can change vs which are permanent facts
