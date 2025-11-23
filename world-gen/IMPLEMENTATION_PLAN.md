# Implementation Plan: Penguin World Catalyst Refactor

**Date**: 2025-11-23
**Scope**: Refactor penguin world to use catalyst model before expanding to sci-fi domain
**Goal**: Prove out domain-agnostic framework with 7 entity types

## Overview

### Current State (5 entity types)
- npc, location, faction, rules, abilities
- Template-based growth + simulation systems
- 96 entities (55% NPCs, 45% world entities)
- 69% NPC relationships, 31% world relationships
- Violations: ~774/tick (protected relationships decaying)

### Target State (7 entity types)
- npc, location, faction, rules, abilities, **era**, **occurrence**
- Catalyst-based agent actions + templates
- ~125 entities (20% NPCs, 80% world entities)
- 80% world relationships, 20% NPC structural
- Violations: <360/tick (immutable facts + proper reinforcement)

## Phase 0: Design Decisions

### Decision 1: Which Entity Types Can Act?

| Entity Type | Can Act? | Action Domains | Rationale |
|-------------|----------|----------------|-----------|
| **npc** | ✅ YES | political, economic, military, magical, technological | Leaders, practitioners can affect world |
| **location** | ⚠️ RARE | environmental | Only special locations (volcanic ice, drifting bergs) |
| **faction** | ✅ YES | political, economic, military | Organizations take collective action |
| **rules** | ❌ NO | - | Passive - spread via systems, don't act |
| **abilities** | ✅ YES | magical, technological, corrupting | Magic manifests, tech spreads |
| **era** | ❌ NO | - | Context modifier, not agent |
| **occurrence** | ✅ YES | conflict_escalation, disaster_spread, cultural | Second-order agents with momentum |

### Decision 2: Action Domains for Penguin World

**Political Domain**:
- Actions: seize_control, broker_alliance, declare_war, establish_governance, found_faction
- Agents: npc (leader_of), faction
- Targets: location (colonies), installation, faction

**Economic Domain**:
- Actions: monopolize, establish_trade, blockade, control_resources
- Agents: npc (leader_of merchant faction), faction (company subtype)
- Targets: location (resource-rich), abilities (fishing tech), faction

**Military Domain**:
- Actions: raid, defend, siege, patrol
- Agents: npc (leader_of), faction, occurrence (war)
- Targets: location (colonies), faction

**Magical Domain**:
- Actions: corrupt_location, manifest, seal_magic, discover_ability
- Agents: npc (practitioner_of), abilities (ice magic), occurrence (magical disaster)
- Targets: location, installation, npc

**Technological Domain**:
- Actions: invent, monopolize_tech, weaponize, spread_innovation
- Agents: npc (practitioner_of tech), faction
- Targets: abilities (technology), faction

**Environmental Domain**:
- Actions: ice_drift, volcanic_eruption, krill_migration, iceberg_calving
- Agents: location (special types), abilities (elemental)
- Targets: location, installation

**Cultural Domain**:
- Actions: convert_faction, inspire_hero, formalize_belief, create_schism
- Agents: npc (high prominence), occurrence (cultural movement), rules (via spread)
- Targets: faction, npc, rules

**Conflict Escalation Domain** (occurrence-specific):
- Actions: escalate_war, draw_in_faction, devastate_location, create_refugees, stalemate
- Agents: occurrence (war subtype)
- Targets: faction, location, npc

**Disaster Spread Domain** (occurrence-specific):
- Actions: spread_corruption, spawn_threat, create_refugees, wane
- Agents: occurrence (disaster subtype)
- Targets: location, installation, npc

### Decision 3: Pressures → Domains Crosswalk

| Pressure | Primary Domains Activated | Effect |
|----------|---------------------------|--------|
| **conflict** | military, conflict_escalation, political | Raids, wars, territorial disputes more likely |
| **resource_scarcity** | economic, political, military | Monopolization, blockades, resource wars |
| **magical_instability** | magical, disaster_spread | Corruption events, manifestations, disasters |
| **cultural_tension** | cultural, political | Schisms, conversions, belief conflicts |
| **stability** | political, economic | (Inverse) - high stability reduces conflict/disaster |
| **external_threat** | military, political, conflict_escalation | Defensive actions, alliances |

**Pressure-Domain Multipliers**:
```typescript
const pressureDomainMultipliers = {
  conflict: {
    military: 2.0,
    conflict_escalation: 2.5,
    political: 1.5
  },
  magical_instability: {
    magical: 2.0,
    disaster_spread: 2.5,
    corrupting: 1.8
  },
  resource_scarcity: {
    economic: 2.0,
    political: 1.5,
    military: 1.3
  }
  // etc.
};
```

### Decision 4: Systems and Templates - Start from 0 or Modify?

**Answer**: HYBRID APPROACH

**Keep & Modify** (map to domains):
- alliance_formation → political domain system
- conflict_contagion → conflict_escalation domain (for occurrences)
- legend_crystallization → Keep (creates historical anchors)
- succession_vacuum → political domain (modify to reduce NPC bloat)
- thermal_cascade → environmental domain

**Remove Entirely** (NPC bloat):
- relationship_formation (friend_of, lover_of, follower_of)
- familyExpansion
- kinshipConstellation
- outlawRecruitment
- mysteriousVanishing

**Add New** (world-level):
- universal_catalyst_system (agent actions across all types)
- occurrence_creation_system (creates war/disaster occurrences)
- era_transition_system (shifts eras based on world state)
- immutable_fact_system (geographic/historical facts skip processing)

**Templates**:
- Remove: familyExpansion, kinshipConstellation, outlawRecruitment
- Throttle: heroEmergence (90% reduction)
- Keep: factionSplinter, cultFormation, guildFormation (map to political/cultural domains)
- Add: territorial_expansion, magical_site_discovery, tech_breakthrough

## Phase 1: Core Framework (Week 1)

### 1.1: Type System Updates

**File**: `src/types/worldTypes.ts`

```typescript
// Add era and occurrence kinds
type EntityKind = 'npc' | 'location' | 'faction' | 'rules' | 'abilities' | 'era' | 'occurrence';

// Add catalyst interface
interface CatalystProperties {
  canAct: boolean;
  actionDomains: ActionDomain[];
  influence: number;
  catalyzedEvents: CatalyzedEvent[];
  availableActions: Action[];
  lifecycle?: 'active' | 'dormant' | 'destroyed' | 'legendary' | 'ended';
}

// Extend HardState
interface HardState {
  id: string;
  kind: EntityKind;
  subtype: string;
  name: string;
  description: string;
  status: string;
  prominence: Prominence;
  tags: string[];
  links: Relationship[];
  createdAt: number;
  updatedAt: number;

  // NEW: Optional catalyst properties
  catalyst?: CatalystProperties;

  // NEW: Entity-kind specific properties
  temporal?: {  // For era and occurrence
    startTick: number;
    endTick: number | null;
  };
}

// Action domain types
type ActionDomain =
  | 'political'
  | 'economic'
  | 'military'
  | 'magical'
  | 'technological'
  | 'environmental'
  | 'cultural'
  | 'conflict_escalation'
  | 'disaster_spread';

interface Action {
  type: string;
  domain: ActionDomain;
  targetKinds: EntityKind[];
  requirements?: {
    minProminence?: Prominence;
    requiredRelationships?: string[];  // Relationship kinds needed
    requiredPressures?: Record<string, number>;
  };
  successChance?: number;  // Base probability (modified by influence/prominence)
}

interface CatalyzedEvent {
  relationshipId: string;
  action: string;
  tick: number;
}
```

**Deliverables**:
- [ ] Update HardState interface with catalyst and temporal properties
- [ ] Define ActionDomain type
- [ ] Define Action, CatalyzedEvent interfaces
- [ ] Update EntityKind to include era, occurrence

### 1.2: Relationship Categories

**File**: `src/types/relationshipCategories.ts` (NEW)

```typescript
interface RelationshipCategory {
  category: string;
  kinds: string[];
  mutable: boolean;
  decayRate?: 'none' | 'slow' | 'medium' | 'fast';
  reinforcementConditions?: string[];
  cullable: boolean;
  applyDecay: boolean;
  applyReinforcement: boolean;
  applyCulling: boolean;
}

const RELATIONSHIP_CATEGORIES: Record<string, RelationshipCategory> = {
  immutable_fact: {
    category: 'immutable_fact',
    kinds: [
      // Geographic
      'adjacent_to', 'contains', 'contained_by',
      // Historical
      'originated_in', 'founded_by', 'discovered_by', 'discoverer_of',
      // Supernatural constants
      'slumbers_beneath'  // Permanent manifestation
    ],
    mutable: false,
    applyDecay: false,
    applyReinforcement: false,
    applyCulling: false,
    cullable: false
  },

  political: {
    category: 'political',
    kinds: ['controls', 'contests', 'allied_with', 'enemy_of', 'rival_of', 'governs'],
    mutable: true,
    decayRate: 'slow',
    reinforcementConditions: ['proximity', 'shared_interests'],
    cullable: true,
    applyDecay: true,
    applyReinforcement: true,
    applyCulling: true
  },

  economic: {
    category: 'economic',
    kinds: ['monopolizes', 'trades_with', 'blockades', 'extracts_from'],
    mutable: true,
    decayRate: 'medium',
    reinforcementConditions: ['active_trade', 'resource_availability'],
    cullable: true,
    applyDecay: true,
    applyReinforcement: true,
    applyCulling: true
  },

  magical: {
    category: 'magical',
    kinds: ['corrupted_by', 'blessed_by', 'manifests_at', 'sealed_in', 'powered_by'],
    mutable: true,
    decayRate: 'slow',  // Magical effects persist
    reinforcementConditions: ['magical_instability', 'practitioner_presence'],
    cullable: false,  // Don't cull magical effects
    applyDecay: true,
    applyReinforcement: true,
    applyCulling: false
  },

  structural: {
    category: 'structural',
    kinds: ['member_of', 'leader_of', 'resident_of', 'practitioner_of'],
    mutable: true,
    decayRate: 'slow',
    reinforcementConditions: ['proximity', 'active_participation'],
    cullable: false,  // Don't cull structural relationships
    applyDecay: true,
    applyReinforcement: true,
    applyCulling: false
  },

  attribution: {
    category: 'attribution',
    kinds: ['catalyzed_by', 'founded_by', 'discovered_by'],
    mutable: false,
    applyDecay: false,
    applyReinforcement: false,
    applyCulling: false,
    cullable: false
  }
};
```

**Deliverables**:
- [ ] Create relationship categories file
- [ ] Define all relationship kinds by category
- [ ] Export helper function: `getCategoryForRelationship(kind: string)`

### 1.3: Action Domain Definitions

**File**: `src/config/actionDomains.ts` (NEW)

```typescript
interface DomainDefinition {
  domain: ActionDomain;
  actions: ActionDefinition[];
  availableToEntityKinds: EntityKind[];
  targetEntityKinds: EntityKind[];
  description: string;
}

interface ActionDefinition {
  type: string;
  description: string;
  baseSuccessChance: number;
  relationshipsCreated: string[];  // Relationship kinds
  requirements?: {
    minProminence?: Prominence;
    requiredRelationships?: string[];
    requiredPressures?: Record<string, number>;
  };
}

const ACTION_DOMAINS: Record<ActionDomain, DomainDefinition> = {
  political: {
    domain: 'political',
    description: 'Governance, territorial control, alliances',
    availableToEntityKinds: ['npc', 'faction'],
    targetEntityKinds: ['location', 'faction'],
    actions: [
      {
        type: 'seize_control',
        description: 'Take control of a location or installation',
        baseSuccessChance: 0.3,
        relationshipsCreated: ['controls'],
        requirements: {
          minProminence: 'recognized',
          requiredRelationships: ['leader_of']
        }
      },
      {
        type: 'broker_alliance',
        description: 'Form alliance between factions',
        baseSuccessChance: 0.4,
        relationshipsCreated: ['allied_with'],
        requirements: {
          minProminence: 'recognized',
          requiredRelationships: ['leader_of', 'member_of']
        }
      },
      {
        type: 'declare_war',
        description: 'Create enemy_of relationship and war occurrence',
        baseSuccessChance: 0.6,
        relationshipsCreated: ['enemy_of'],
        requirements: {
          minProminence: 'renowned',
          requiredRelationships: ['leader_of']
        }
      }
      // etc.
    ]
  },

  magical: {
    domain: 'magical',
    description: 'Ice magic, corruption, manifestation',
    availableToEntityKinds: ['npc', 'abilities', 'occurrence'],
    targetEntityKinds: ['location', 'npc', 'abilities'],
    actions: [
      {
        type: 'corrupt_location',
        description: 'Spread magical corruption to a location',
        baseSuccessChance: 0.25,
        relationshipsCreated: ['corrupted_by'],
        requirements: {
          requiredRelationships: ['practitioner_of', 'manifests_at'],
          requiredPressures: {magical_instability: 50}
        }
      },
      {
        type: 'manifest',
        description: 'Magic manifests at a location',
        baseSuccessChance: 0.3,
        relationshipsCreated: ['manifests_at'],
        requirements: {
          requiredPressures: {magical_instability: 40}
        }
      }
      // etc.
    ]
  },

  conflict_escalation: {
    domain: 'conflict_escalation',
    description: 'War momentum, drawing in factions, devastation',
    availableToEntityKinds: ['occurrence'],
    targetEntityKinds: ['faction', 'location', 'npc'],
    actions: [
      {
        type: 'escalate_war',
        description: 'Increase war intensity',
        baseSuccessChance: 0.4,
        relationshipsCreated: ['at_war'],
        requirements: {
          // Occurrence must be war subtype
        }
      },
      {
        type: 'draw_in_faction',
        description: 'Neutral faction becomes participant',
        baseSuccessChance: 0.3,
        relationshipsCreated: ['participant', 'allied_with'],
        requirements: {}
      },
      {
        type: 'devastate_location',
        description: 'War destroys a location',
        baseSuccessChance: 0.2,
        relationshipsCreated: ['devastated_by'],
        requirements: {}
      }
      // etc.
    ]
  }

  // Define all 9 domains...
};
```

**Deliverables**:
- [ ] Define all 9 action domains
- [ ] Define 3-5 actions per domain
- [ ] Specify requirements and success chances
- [ ] Export helper: `getActionsForDomain(domain: ActionDomain)`

### 1.4: Initial State Updates

**File**: `data/initialState.json`

Add era entity to initial state:

```json
{
  "entities": [
    // Existing entities...

    // NEW: Starting era
    {
      "kind": "era",
      "subtype": "expansion",
      "name": "The Great Thaw",
      "description": "A time of settlement and discovery as penguins expand across the ice",
      "status": "active",
      "prominence": "mythic",
      "tags": ["expansion", "settlement"],
      "temporal": {
        "startTick": 0,
        "endTick": null
      }
    }
  ]
}
```

**Deliverables**:
- [ ] Add initial era entity to initialState.json
- [ ] Update entity IDs assignment to handle era/occurrence types

## Phase 2: Catalyst System Core (Week 2)

### 2.1: Catalyst Initialization

**File**: `src/utils/catalystHelpers.ts` (NEW)

```typescript
/**
 * Initialize catalyst properties for an entity based on its kind and relationships
 */
export function initializeCatalyst(entity: HardState, graph: Graph): void {
  const catalystConfig = getCatalystConfigForKind(entity.kind);

  if (!catalystConfig.canAct) {
    // Entity doesn't act
    return;
  }

  entity.catalyst = {
    canAct: true,
    actionDomains: determineActionDomains(entity, graph),
    influence: calculateInitialInfluence(entity),
    catalyzedEvents: [],
    availableActions: determineAvailableActions(entity, graph),
    lifecycle: 'active'
  };
}

/**
 * Determine action domains based on entity relationships
 */
function determineActionDomains(entity: HardState, graph: Graph): ActionDomain[] {
  const domains: ActionDomain[] = [];

  switch (entity.kind) {
    case 'npc':
      // NPCs get domains based on relationships
      if (hasRelationship(entity, 'leader_of')) {
        domains.push('political', 'military');
      }
      if (hasRelationship(entity, 'practitioner_of')) {
        const ability = getRelated(graph, entity.id, 'practitioner_of', 'src')[0];
        if (ability?.subtype === 'magic') {
          domains.push('magical');
        } else if (ability?.subtype === 'technology') {
          domains.push('technological');
        }
      }
      if (hasRelationship(entity, 'member_of')) {
        domains.push('economic');
      }
      break;

    case 'faction':
      // Factions always have political, economic
      domains.push('political', 'economic');
      if (entity.subtype === 'criminal' || entity.subtype === 'military') {
        domains.push('military');
      }
      break;

    case 'abilities':
      if (entity.subtype === 'magic') {
        domains.push('magical');
      } else if (entity.subtype === 'technology') {
        domains.push('technological');
      }
      break;

    case 'occurrence':
      if (entity.subtype === 'war') {
        domains.push('conflict_escalation', 'military', 'political');
      } else if (entity.subtype === 'magical_disaster') {
        domains.push('disaster_spread', 'magical');
      } else if (entity.subtype === 'cultural_movement') {
        domains.push('cultural', 'political');
      }
      break;

    case 'location':
      // Only special locations can act
      if (entity.subtype === 'volcanic' || entity.subtype === 'drifting_berg') {
        domains.push('environmental');
      }
      break;
  }

  return domains;
}
```

**Deliverables**:
- [ ] Create catalyst initialization helpers
- [ ] Implement domain determination logic
- [ ] Implement influence calculation
- [ ] Create action availability checker

### 2.2: Universal Catalyst System

**File**: `src/systems/universalCatalyst.ts` (NEW)

```typescript
export const universalCatalystSystem: SimulationSystem = {
  id: 'universal_catalyst',
  name: 'Universal Agent Actions',

  metadata: {
    parameters: {
      actionAttemptRate: {
        value: 0.3,
        min: 0.1,
        max: 0.8,
        description: 'Chance per tick that agents attempt actions'
      },
      prominenceMultiplier: {
        value: 1.5,
        min: 1.0,
        max: 3.0,
        description: 'Prominence affects action attempt rate'
      }
    }
  },

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const params = universalCatalystSystem.metadata?.parameters || {};
    const actionAttemptRate = params.actionAttemptRate?.value ?? 0.3;

    // Find all entities that can act
    const agents = Array.from(graph.entities.values())
      .filter(e => e.catalyst?.canAct === true);

    const relationshipsCreated: Relationship[] = [];
    const entitiesModified: string[] = [];

    agents.forEach(agent => {
      // Check if agent attempts action this tick
      const attemptChance = calculateAttemptChance(agent, actionAttemptRate);
      if (Math.random() > attemptChance * modifier) return;

      // Select action based on domains + pressures
      const action = selectAction(agent, graph);
      if (!action) return;

      // Attempt action
      const outcome = attemptAction(agent, action, graph);

      if (outcome.success) {
        // Create world relationships with attribution
        outcome.relationships.forEach(rel => {
          rel.catalyzedBy = agent.id;
          rel.createdAt = graph.tick;
          relationshipsCreated.push(rel);
        });

        // Update agent influence and prominence
        agent.catalyst.influence = Math.min(1.0, agent.catalyst.influence + outcome.influenceGain);

        // Record catalyzed event
        agent.catalyst.catalyzedEvents.push({
          relationshipId: outcome.relationshipId,
          action: outcome.description,
          tick: graph.tick
        });

        entitiesModified.push(agent.id);

        // Create history event
        graph.history.push({
          tick: graph.tick,
          type: `${agent.kind}_${action.domain}_action`,
          description: `${agent.name} ${outcome.description}`,
          protagonists: [agent.id],
          tags: [action.domain, outcome.impactLevel]
        });
      } else {
        // Failed action - influence decreases
        agent.catalyst.influence = Math.max(0, agent.catalyst.influence - outcome.influenceLoss);
        entitiesModified.push(agent.id);
      }
    });

    return {
      relationshipsAdded: relationshipsCreated,
      entitiesModified,
      pressureChanges: {},
      description: relationshipsCreated.length > 0
        ? `${relationshipsCreated.length} agents shaped the world`
        : 'Agents dormant this cycle'
    };
  }
};
```

**Deliverables**:
- [ ] Implement universal_catalyst_system
- [ ] Implement attemptAction function
- [ ] Implement selectAction function (pressure-weighted)
- [ ] Add to allSystems export

### 2.3: Occurrence Creation System

**File**: `src/systems/occurrenceCreation.ts` (NEW)

```typescript
export const occurrenceCreationSystem: SimulationSystem = {
  id: 'occurrence_creation',
  name: 'Major Event Occurrence Creation',

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const entitiesCreated: HardState[] = [];
    const relationshipsCreated: Relationship[] = [];

    // CONDITION 1: Create war occurrence if major faction conflict
    const majorConflicts = graph.relationships.filter(rel =>
      rel.kind === 'enemy_of' &&
      graph.entities.get(rel.src)?.kind === 'faction' &&
      graph.entities.get(rel.dst)?.kind === 'faction' &&
      rel.strength > 0.7
    );

    majorConflicts.forEach(conflict => {
      // Check if war occurrence already exists
      const existingWar = findEntities(graph, {
        kind: 'occurrence',
        subtype: 'war',
        filter: (occ) => occ.links.some(l =>
          l.kind === 'participant' &&
          (l.dst === conflict.src || l.dst === conflict.dst)
        )
      });

      if (existingWar.length > 0) return;  // War already exists

      // Create war occurrence
      const warOccurrence = createWarOccurrence(conflict, graph);
      entitiesCreated.push(warOccurrence);

      // Add participant relationships
      relationshipsCreated.push({
        kind: 'participant',
        src: warOccurrence.id,
        dst: conflict.src,
        strength: 1.0
      });
      relationshipsCreated.push({
        kind: 'participant',
        src: warOccurrence.id,
        dst: conflict.dst,
        strength: 1.0
      });

      graph.history.push({
        tick: graph.tick,
        type: 'war_outbreak',
        description: `${warOccurrence.name} begins`,
        protagonists: [warOccurrence.id],
        factions: [conflict.src, conflict.dst],
        tags: ['war', 'conflict']
      });
    });

    // CONDITION 2: Create magical disaster if corruption spreads
    const corruptionEvents = graph.relationships.filter(rel =>
      rel.kind === 'corrupted_by' &&
      graph.entities.get(rel.src)?.kind === 'location' &&
      rel.createdAt === graph.tick  // New corruption this tick
    );

    if (corruptionEvents.length >= 2) {
      // Multiple corruptions = disaster spreading
      const disaster = createMagicalDisasterOccurrence(corruptionEvents, graph);
      entitiesCreated.push(disaster);

      graph.history.push({
        tick: graph.tick,
        type: 'magical_disaster',
        description: `${disaster.name} unleashed`,
        protagonists: [disaster.id],
        tags: ['disaster', 'corruption']
      });
    }

    // CONDITION 3: Create cultural movement if belief spreading rapidly
    // ... etc.

    return {
      relationshipsAdded: relationshipsCreated,
      entitiesModified: [],
      pressureChanges: {},
      description: entitiesCreated.length > 0
        ? `${entitiesCreated.length} major occurrences emerged`
        : 'No major occurrences this cycle'
    };
  }
};
```

**Deliverables**:
- [ ] Implement occurrence_creation_system
- [ ] Create helper: createWarOccurrence
- [ ] Create helper: createMagicalDisasterOccurrence
- [ ] Create helper: createCulturalMovementOccurrence

### 2.4: Era Transition System

**File**: `src/systems/eraTransition.ts` (NEW)

```typescript
export const eraTransitionSystem: SimulationSystem = {
  id: 'era_transition',
  name: 'Era Transitions Based on World State',

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const currentEra = findEntities(graph, {
      kind: 'era',
      status: 'active'
    })[0];

    if (!currentEra) return {relationshipsAdded: [], entitiesModified: [], pressureChanges: {}, description: 'No active era'};

    // Check transition conditions
    const shouldTransition = checkTransitionConditions(currentEra, graph);

    if (!shouldTransition) {
      return {relationshipsAdded: [], entitiesModified: [], pressureChanges: {}, description: 'Era continues'};
    }

    // End current era
    currentEra.status = 'ended';
    currentEra.temporal!.endTick = graph.tick;

    // Create next era
    const nextEra = createNextEra(currentEra, graph);
    graph.entities.set(nextEra.id, nextEra);

    graph.history.push({
      tick: graph.tick,
      type: 'era_transition',
      description: `The ${currentEra.name} ends. The ${nextEra.name} begins.`,
      tags: ['temporal', 'era_change'],
      eras: [currentEra.id, nextEra.id]
    });

    return {
      relationshipsAdded: [],
      entitiesModified: [currentEra.id],
      pressureChanges: {},
      description: `Era transition: ${currentEra.name} → ${nextEra.name}`
    };
  }
};
```

**Deliverables**:
- [ ] Implement era_transition_system
- [ ] Define era progression rules (Great Thaw → Age of Conflict → etc.)
- [ ] Implement transition condition checks

## Phase 3: System Refactor (Week 3)

### 3.1: Modify Existing Systems

**Systems to Keep & Modify**:

**alliance_formation** → Map to political domain:
```typescript
// OLD: Creates allied_with directly
// NEW: Uses catalyst system or remains as template-like system
// Decision: Keep as system, but check if agents can broker alliance
```

**conflict_contagion** → Map to conflict_escalation:
```typescript
// OLD: Spreads enemy_of via allies
// NEW: Occurrence system handles war escalation
// Decision: Keep for initial conflict spread, occurrence handles escalation
```

**legend_crystallization** → Keep as-is:
```typescript
// Creates commemorates relationships for dead NPCs
// This is fine - creates historical anchors
```

**succession_vacuum** → Modify to reduce NPC creation:
```typescript
// OLD: Creates NPC claimants
// NEW: Uses existing NPCs as claimants, or creates minimal NPCs
// Decision: Modify to prefer existing NPCs
```

**prominence_evolution** → Modify for catalyst influence:
```typescript
// OLD: Prominence based on connections
// NEW: Prominence based on catalyzedEvents + influence
// Decision: Modify to use catalyst.catalyzedEvents
```

**Deliverables**:
- [ ] Modify alliance_formation to work with political domain
- [ ] Modify conflict_contagion for occurrence integration
- [ ] Modify prominence_evolution to use catalyst metrics
- [ ] Modify succession_vacuum to reduce NPC bloat
- [ ] Keep legend_crystallization unchanged

### 3.2: Remove NPC-Bloat Systems

**Systems to Remove**:
- relationship_formation (friend_of, lover_of, follower_of)
- Remove structuralBonus from relationship_reinforcement (no longer needed with immutable facts)

**Deliverables**:
- [ ] Remove relationship_formation from allSystems
- [ ] Remove structuralBonus parameter from relationship_reinforcement
- [ ] Update relationship_reinforcement to skip immutable facts

### 3.3: Add Category-Based Relationship Systems

**File**: `src/systems/relationshipDecay.ts` (MODIFY)

```typescript
export const relationshipDecay: SimulationSystem = {
  // ... existing metadata

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    let modificationsCount = 0;

    graph.relationships.forEach(rel => {
      // NEW: Check relationship category
      const category = getCategoryForRelationship(rel.kind);

      // Skip immutable facts
      if (!category.applyDecay) return;

      // Apply decay based on category settings
      const decayAmount = getDecayAmount(category, rel, graph);

      // ... existing decay logic
    });

    return { /* ... */ };
  }
};
```

**Deliverables**:
- [ ] Modify relationshipDecay to use categories
- [ ] Modify relationshipReinforcement to use categories
- [ ] Modify relationshipCulling to use categories
- [ ] Verify immutable facts are skipped

## Phase 4: Template Refactor (Week 4)

### 4.1: Remove NPC-Bloat Templates

**Templates to Remove**:
- familyExpansion
- kinshipConstellation
- outlawRecruitment
- mysteriousVanishing

**Deliverables**:
- [ ] Remove template files
- [ ] Remove from npcTemplates export
- [ ] Remove from era templateWeights

### 4.2: Throttle NPC Templates

**heroEmergence** → Reduce to 10% of current rate:
```typescript
// In eras.ts
templateWeights: {
  heroEmergence: 0.1  // Was 1.0, now 90% reduction
}
```

**Deliverables**:
- [ ] Update era templateWeights for heroEmergence
- [ ] Add cap: Maximum 5 heroes total (add to template logic)

### 4.3: Add World-Level Templates

**New Templates to Add**:

1. **territorial_expansion** (political domain):
   - Faction seizes control of location
   - Creates controls relationship
   - Catalyzed by leader NPC (if exists) or faction itself

2. **magical_site_discovery** (magical domain):
   - Creates new location with magical properties
   - Creates manifests_at relationship with ability
   - Catalyzed by practitioner NPC or ability itself

3. **tech_breakthrough** (technological domain):
   - Creates new ability (technology subtype)
   - Creates developed_by relationship with faction
   - Catalyzed by faction or inventor NPC

4. **trade_route_establishment** (economic domain):
   - Creates trade_routes relationship between locations
   - Catalyzed by merchant faction or location itself

**Deliverables**:
- [ ] Create territorial_expansion template
- [ ] Create magical_site_discovery template
- [ ] Create tech_breakthrough template
- [ ] Create trade_route_establishment template
- [ ] Add templates to era weights

## Phase 5: Integration & Testing (Week 5)

### 5.1: Update Configuration

**Files to Update**:
- `src/config/eras.ts` - Add era progression definitions
- `src/config/templateSystemParameters.json` - Add new system parameters
- `src/main.ts` - Wire up new systems

**Deliverables**:
- [ ] Define era progression (5-7 eras for penguin world)
- [ ] Add action domain parameters to config
- [ ] Update main.ts to include new systems
- [ ] Remove old NPC-bloat systems from execution

### 5.2: Test Scenarios

**Test 1: Minimal Run** (50 ticks, verify basics):
- [ ] Catalyst system creates world relationships
- [ ] Occurrences are created when conditions met
- [ ] Eras transition correctly
- [ ] No NPC bloat (verify <30 NPCs)
- [ ] Immutable facts don't decay

**Test 2: Full Run** (500 ticks, verify goals):
- [ ] Entity ratio: ~20% NPCs, ~80% world entities
- [ ] Relationship ratio: ~80% world-level, ~20% NPC structural
- [ ] Violations: <360 total (<3.0/tick)
- [ ] At least 1-2 occurrences created (wars or disasters)
- [ ] At least 1 era transition

**Test 3: Agent Coverage**:
- [ ] Verify NPCs with leader_of can perform political actions
- [ ] Verify factions can perform territorial expansion
- [ ] Verify abilities can manifest/corrupt
- [ ] Verify occurrences escalate/spread

### 5.3: GA Optimizer Updates

**Files to Update**:
- `world-gen-optimizer/src/configLoader.ts` - Load new parameters
- `world-gen-optimizer/src/fitnessEvaluator.ts` - Update fitness weights

**Deliverables**:
- [ ] Verify optimizer can load new parameters (action domain rates, etc.)
- [ ] Update fitness function to measure occurrence quality
- [ ] Run GA to optimize new parameter space

## Phase 6: Documentation (Week 6)

### 6.1: Framework Documentation

**Files to Create/Update**:
- `CATALYST_FRAMEWORK.md` - How the catalyst model works
- `ACTION_DOMAINS.md` - Complete domain/action reference
- `ENTITY_TYPES.md` - All 7 entity types explained
- Update `ARCHITECTURE.md` with new patterns

**Deliverables**:
- [ ] Document catalyst initialization
- [ ] Document action selection algorithm
- [ ] Document occurrence creation conditions
- [ ] Document era transition logic

### 6.2: Migration Guide

**File**: `MIGRATION_GUIDE.md`

**Sections**:
- What changed from old to new architecture
- How to add new action domains
- How to create new entity types
- How to define occurrence types
- How to configure eras

**Deliverables**:
- [ ] Write migration guide for future domains
- [ ] Include examples from penguin → sci-fi migration

## Success Criteria

### Quantitative Metrics

- [x] 7 entity types implemented (npc, location, faction, rules, abilities, era, occurrence)
- [ ] Entity ratio: 15-25% NPCs, 75-85% world entities
- [ ] Relationship ratio: 75-85% world-level, 15-25% NPC structural
- [ ] Violations: <360 total (<3.0/tick)
- [ ] At least 9 action domains defined
- [ ] At least 3-5 actions per domain
- [ ] At least 5 eras defined
- [ ] At least 2-3 occurrence types created during runs

### Qualitative Goals

- [ ] Framework is domain-agnostic (can swap to sci-fi with config changes)
- [ ] NPCs drive world events (catalyst attribution clear in history)
- [ ] Occurrences have momentum (wars escalate, disasters spread)
- [ ] Eras shape world evolution (clear thematic shifts)
- [ ] History events are rich ("Cutthroat Dave seized Nightfall Shelf for The Midnight Claws")
- [ ] Power laws emerge naturally (prominent agents attract more relationships)

## Open Questions

### Q1: Systems vs Templates - Final Decision?

**Current thinking**: Hybrid approach
- Keep templates for entity creation (factionSplinter, cultFormation)
- Use catalyst system for relationship creation (agents take actions)
- Templates create entities WITH catalyst properties
- Systems observe state and react (occurrence_creation, era_transition)

**Question**: Should templates trigger catalyst actions, or should they create entities that THEN act via catalyst system?

**Proposed answer**: Templates create entities, catalyst system makes them act. Separation of concerns.

### Q2: Pressures - Keep or Refactor?

**Current**: 6 pressures that grow/decay based on graph state

**Option A**: Keep as-is, use to modify action domain multipliers

**Option B**: Replace with action domain "heat" (each domain has activation level)

**Proposed answer**: Keep pressures, crosswalk to domains. Pressures are intuitive (conflict, scarcity, instability).

### Q3: Relationship Kinds - Add Many or Few?

**Current**: ~20 relationship kinds

**New catalyst model enables**: ~50+ kinds (controls, contests, monopolizes, corrupted_by, etc.)

**Question**: Add all at once, or incrementally?

**Proposed answer**: Add 10-15 core world-level kinds in Phase 1, add more as needed.

### Q4: Occurrence Lifecycle - Manual or Automatic?

**Question**: Do occurrences automatically end (war ticks down), or require agent action (broker_peace)?

**Proposed answer**: Hybrid - occurrences can wane naturally (low intensity) OR be ended by agent actions. Wars can stalemate (automatic), but peace requires treaty (agent action).

## Timeline Summary

- **Phase 0**: Design Decisions (Complete - this document)
- **Phase 1**: Core Framework (Week 1) - Types, categories, domains
- **Phase 2**: Catalyst System (Week 2) - Universal catalyst, occurrences, eras
- **Phase 3**: System Refactor (Week 3) - Modify/remove existing systems
- **Phase 4**: Template Refactor (Week 4) - Remove bloat, add world-level
- **Phase 5**: Integration & Testing (Week 5) - Wire up, test, optimize
- **Phase 6**: Documentation (Week 6) - Framework docs, migration guide

**Total**: 6 weeks to full catalyst model implementation

## Next Steps

1. Review this plan
2. Make decisions on open questions
3. Begin Phase 1 implementation
4. Test incrementally (don't wait until end)
