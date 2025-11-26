# Catalyst Model Implementation Plan

## Overview

Refactor penguin world generation to implement the catalyst model where NPCs and other agents catalyze world events rather than being protagonists. Target: 80% world-level entities/relationships, 20% NPC structural relationships.

## Design Decisions (Confirmed)

1. **Division of Labor**: Templates create entities, systems make them act
2. **Pressures**: Keep as general concept, ensure they drive meaningful domain dynamics
3. **Relationship Kinds**: Add focused kinds for temporal entities, remove social drama (lover_of, follower_of, mentor_of)
4. **Occurrence Lifecycle**: Hybrid (can wane naturally OR be ended by agent actions)
5. **Eras**: Convert 5 existing eras from `eras.ts` to HardState entities (pre-seed in initialState.json)
6. **Occurrence Subtypes**: war, magical_disaster, cultural_movement, economic_boom

## Domain vs Framework Separation

### Framework Code (`src/`)
Abstract, domain-agnostic systems that work for any setting:
- Catalyst interface and categories
- Universal catalyst system
- Occurrence creation system
- Era transition system
- Catalyst helper utilities

### Domain Code (`src/domain/penguin/`)
Penguin-specific implementations:
- Entity kinds (7 types with subtypes/statuses)
- Relationship kinds (structural + temporal, remove social drama)
- Action domains (9 penguin-specific domains)
- Systems (modified to use catalyst model)
- Templates (remove 4 NPC-bloat, add 4 world-level)
- Eras (5 existing eras as HardState entities)
- Pressures (ensure domain-relevant)
- Initial state (seed entities + 5 era entities)

## File Structure After Refactor

```
src/
├── types/              # Framework (+ catalyst interface)
├── systems/            # Framework (universalCatalyst, occurrenceCreation, eraTransition)
├── utils/              # Framework (catalystHelpers)
└── domain/penguin/
    ├── schema.ts       # + era, occurrence kinds
    ├── config/
    │   ├── eras.ts     # 5 eras
    │   ├── actionDomains.ts       # NEW
    │   └── relationshipCategories.ts  # NEW
    ├── data/
    │   └── initialState.json  # + 5 era entities
    ├── systems/        # Modified existing systems
    └── templates/      # Remove 4, add 4 new
```

## Phase 1: Framework Core (Catalyst Interface)

### 1.1 Update Type System (`src/types/worldTypes.ts`)

Add catalyst properties to HardState:
```typescript
interface CatalystProperties {
  canAct: boolean;
  actionDomains: string[];  // Domain-defined action categories
  influence: number;        // 0-1, affects action success probability
  catalyzedEvents: string[]; // IDs of relationships/entities this catalyzed
}

interface HardState {
  // ... existing fields
  catalyst?: CatalystProperties;  // Optional: only for agents
}

interface Relationship {
  // ... existing fields
  catalyzedBy?: string;  // Optional: ID of agent that caused this
  category?: string;     // Domain-defined relationship category
}
```

### 1.2 Catalyst Helpers (`src/utils/catalystHelpers.ts` - NEW)

```typescript
// Get all agents of a category
export function getAgentsByCategory(
  graph: Graph,
  category: 'first-order' | 'second-order'
): HardState[]

// Check if entity can perform action
export function canPerformAction(
  entity: HardState,
  actionDomain: string
): boolean

// Record catalyst attribution
export function recordCatalyst(
  relationship: Relationship,
  catalystId: string
): Relationship
```

## Phase 2: Framework Systems

### 2.1 Universal Catalyst System (`src/systems/universalCatalyst.ts` - NEW)

Core system that enables agents to perform domain-defined actions. This is framework code but calls domain-defined action handlers.

### 2.2 Occurrence Creation System (`src/systems/occurrenceCreation.ts` - NEW)

Creates occurrence entities when domain-defined conditions are met (faction conflicts → war, magic corruption → disaster, etc.)

### 2.3 Era Transition System (`src/systems/eraTransition.ts` - NEW)

Transitions between era entities based on world state and domain-defined transition conditions.

## Phase 3: Domain Schema Updates

### 3.1 Entity Kinds (`src/domain/penguin/schema.ts`)

Add two new entity kinds:

```typescript
const penguinEntityKinds: EntityKindDefinition[] = [
  // ... existing: npc, location, faction, rules, abilities

  {
    kind: 'era',
    description: 'Temporal contexts that modify action probabilities',
    subtypes: ['expansion', 'conflict', 'innovation', 'invasion', 'reconstruction'],
    statusValues: ['current', 'past', 'future'],
    defaultStatus: 'past'
  },

  {
    kind: 'occurrence',
    description: 'Major happenings with their own momentum',
    subtypes: ['war', 'magical_disaster', 'cultural_movement', 'economic_boom'],
    statusValues: ['brewing', 'active', 'waning', 'ended', 'legendary'],
    defaultStatus: 'brewing'
  }
];
```

Update existing entity kinds with catalyst properties (defined in schema).

### 3.2 Relationship Kinds (`src/domain/penguin/schema.ts`)

**Remove** (social drama, 3 kinds):
- lover_of (219 instances, 20% of all relationships!)
- follower_of (108 instances, 10%)
- mentor_of (10 instances)

**Add** (temporal entity relationships, ~8 kinds):
- active_during (entity → era)
- participant_in (entity → occurrence)
- epicenter_of (occurrence → location)
- triggered_by (occurrence → agent)
- escalated_by (occurrence → agent)
- ended_by (occurrence → agent)
- spawned (occurrence → occurrence)
- concurrent_with (occurrence → occurrence)

### 3.3 Action Domains (`src/domain/penguin/config/actionDomains.ts` - NEW)

Define 9 penguin-specific action domains:

1. **political**: seize_control, form_alliance, declare_war
2. **military**: raid, defend, siege, patrol
3. **economic**: establish_trade, monopolize, blockade
4. **magical**: corrupt_location, manifest, discover_ability
5. **technological**: invent, weaponize, spread_innovation
6. **environmental**: ice_drift, krill_migration, iceberg_calving
7. **cultural**: convert_faction, inspire_hero, create_schism
8. **conflict_escalation**: escalate_war, draw_in_faction, devastate_location
9. **disaster_spread**: spread_corruption, spawn_threat, create_refugees

Each domain defines:
- Valid actor entity kinds
- Available actions
- Action handlers (domain-specific logic)

### 3.4 Relationship Categories (`src/domain/penguin/config/relationshipCategories.ts` - NEW)

Define semantic categories:
- immutable_fact (geographic, historical)
- structural (member_of, leader_of, resident_of)
- political (controls, allied_with, at_war_with)
- attribution (triggered_by, catalyzed_by)
- temporal (active_during, participant_in)

## Phase 4: Domain Templates

### 4.1 Remove NPC-Bloat Templates (4 templates)

Remove from `src/domain/penguin/templates/npc/index.ts`:
- familyExpansion (creates 3-5 family NPCs per invocation)
- kinshipConstellation (creates 2-4 related NPCs)
- outlawRecruitment (creates outlaws, 39 exist!)
- mysteriousVanishing (pure narrative, low game value)

### 4.2 Add World-Level Templates (4 templates)

**territorial_expansion** (`src/domain/penguin/templates/location/`):
- Faction expands control to adjacent location
- Creates 'controls' relationship with catalyzedBy attribution

**magicalSiteDiscovery** (`src/domain/penguin/templates/abilities/`):
- Discover location with magical properties
- Creates manifests_at relationship + catalyzedBy

**techBreakthrough** (`src/domain/penguin/templates/abilities/`):
- Faction develops new technology
- Creates abilities (technology) + practitioner_of

**tradeRouteEstablishment** (`src/domain/penguin/templates/faction/`):
- Establish trade connection between locations
- Creates trade_route relationship + catalyzedBy

### 4.3 Occurrence Templates (NEW)

Create `src/domain/penguin/templates/occurrence/index.ts`:

**warOccurrence**: Factional conflict escalates into war
**magicalDisasterOccurrence**: Magical instability causes disaster
**culturalMovementOccurrence**: Ideology spreads into movement
**economicBoomOccurrence**: Trade network triggers boom

## Phase 5: Domain Systems

### 5.1 Modify Existing Systems

**Keep and modify**:
- conflictContagionSystem: Record catalyzedBy attribution
- prominenceEvolutionSystem: Use catalyst.catalyzedEvents
- successionVacuumSystem: Prefer existing NPCs over creating new ones

**Remove**:
- relationshipFormationSystem (social drama)

### 5.2 Add New Domain Systems

**occurrenceLifecycleSystem**: Occurrences wane naturally or are ended by actions
**npcLifecycleSystem**: NPCs die, retire, ascend to legend
**abilitySpreadSystem**: Abilities spread to new practitioners

## Phase 6: Domain Configuration

### 6.1 Update Eras (`src/domain/penguin/config/eras.ts`)

Update template weights to reflect new templates:
- Remove weights for deleted templates (family_expansion, kinship_constellation, outlaw_recruitment)
- Add weights for new templates (territorial_expansion, trade_route_establishment, war_outbreak)
- Keep existing 5 eras with updated weights

### 6.2 Update Pressures (`src/domain/penguin/config/pressures.ts`)

Ensure pressures are domain-relevant:
- conflict: Based on at_war_with + war occurrences
- magical_instability: Based on magical abilities + anomalies + disasters
- resource_scarcity: Based on faction/location ratio
- cultural_tension: Based on rules diversity + cultural movements

### 6.3 Initial State (`src/domain/penguin/data/initialState.json`)

Add 5 era entities (pre-seed):
- The Great Thaw (expansion, status: current)
- The Faction Wars (conflict, status: future)
- The Clever Ice Age (innovation, status: future)
- The Orca Incursion (invasion, status: future)
- The Frozen Peace (reconstruction, status: future)

## Phase 7: Integration & Testing

### 7.1 Wire Up Systems

Update `src/engine/worldEngine.ts`:
1. Get current era entity (not from config)
2. Apply framework systems (universalCatalyst, occurrenceCreation, eraTransition)
3. Apply domain systems
4. Use era entity's templateWeights

### 7.2 Testing Strategy

1. **Smoke test**: targetEntitiesPerKind: 5
2. **Entity distribution**: ~20% NPCs, ~15% occurrences, ~65% world entities
3. **Relationship distribution**: ~80% world, ~20% NPC structural
4. **Catalyst attribution**: >70% relationships have catalyzedBy
5. **Occurrence lifecycle**: Created, act, and end
6. **Era transitions**: Based on world state

## Success Criteria

1. **Entity Distribution**:
   - NPCs: 15-25% (target: 20%)
   - Occurrences: 10-20% (target: 15%)
   - World entities: 60-70% (target: 65%)

2. **Relationship Distribution**:
   - World-level: 75-85% (target: 80%)
   - NPC structural: 15-25% (target: 20%)
   - Social drama: 0%

3. **Catalyst Coverage**:
   - Relationships with catalyzedBy: >70%
   - Agents with catalyzedEvents: >50%

4. **Occurrence Dynamics**:
   - At least 2-3 war occurrences
   - At least 1 magical disaster
   - Occurrences have participants and lifecycle transitions

5. **Era Transitions**:
   - At least 3 era transitions
   - Each era has distinct template/system behavior

6. **Narrative Quality**:
   - History events show NPC catalysts: "Cutthroat Dave seized control..."
   - Occurrences have clear origins and participants
   - World feels like geopolitical history, not social network
