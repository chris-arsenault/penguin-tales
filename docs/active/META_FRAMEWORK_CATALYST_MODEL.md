# Meta-Framework: The Catalyst Model

**Status**: Design phase - Core framework refactor
**Date**: 2025-11-23
**Principle**: Entities are categorized by AGENCY, not by type

## The Core Insight

Instead of treating NPCs specially, we categorize ALL entities by their **catalyst potential**:

**The Question**: "Can this entity trigger world events?"

## Entity Categorization by Agency

### Category 1: AGENTS (can perform actions)

Entities that can **catalyze world events** through actions:

- **npc**: Humanoids (political, magical, economic, military actions)
- **faction**: Organizations (territorial expansion, economic control, warfare)
- **monster**: Non-sentient but active (territorial threats, predation)
- **artifact**: Objects of power (corruption, empowerment, curse spreading)
- **supernatural_abilities**: Magic/faith (manifestation, corruption, blessing)
- **transport**: Famous ships (if sentient/piloted - patrol, transport, siege)
- **installations**: Active structures (factories produce, stations defend)
- **ability**: Technology (if active - self-replicating nanotech, AI)

### Category 2: ANCHORS (mostly static)

Entities that are **targets** of actions, rarely act themselves:

- **geographic_location**: Mostly static (but can have rare environmental actions)
- **resource**: Passive (deposits discovered, depleted, but don't act)
- **edicts**: Laws/rules (can spread or be repealed, but passively)
- **Principles**: World rules (immutable, never act)

### Category 3: EVENTS (not entities)

These are occurrences, not things:

- **conflict**: Ongoing narrative tension (represented by relationships, not entities)
- **rumor**: Investigation hooks (could be entity status/tag, not separate entity)

## The Universal Catalyst Interface

```typescript
interface CatalystEntity extends HardState {
  kind: EntityKind;  // 'npc', 'faction', 'artifact', etc.

  // NEW: Optional catalyst properties
  catalyst?: {
    // Can this entity perform actions?
    canAct: boolean;

    // What domains can it act in?
    actionDomains: ActionDomain[];

    // How much influence does it have? (0-1)
    // Derived from prominence + relationships + catalyzed events
    influence: number;

    // What world events has it caused?
    catalyzedEvents: Array<{
      relationshipId: string;
      action: string;
      tick: number;
    }>;

    // What actions are currently available?
    // Determined by relationships + prominence + pressures
    availableActions: Action[];

    // Optional: Lifecycle state
    lifecycle?: 'active' | 'dormant' | 'destroyed' | 'legendary';
  };
}
```

## Action Domains (Domain-Agnostic)

Instead of NPC-specific actions, define universal **action domains**:

### Political Domain
```typescript
{
  domain: 'political',
  actions: [
    'seize_control',      // Take control of location/installation
    'broker_alliance',    // Form allied_with relationship
    'declare_war',        // Create enemy_of relationship
    'found_faction',      // Create new faction entity
    'dissolve_faction',   // Remove faction entity
    'establish_governance' // Create controls relationship
  ],
  availableTo: ['npc', 'faction'],
  targets: ['installation', 'geographic_location', 'faction']
}
```

### Magical Domain
```typescript
{
  domain: 'magical',
  actions: [
    'corrupt_location',   // Create corrupted_by relationship
    'bless_artifact',     // Create blessed_by relationship
    'manifest',           // Create manifests_at relationship
    'discover',           // Create discovered_by relationship
    'seal',               // Create sealed_in relationship
    'unleash'             // Remove sealed_in, create unleashed_from
  ],
  availableTo: ['npc', 'supernatural_abilities', 'artifact'],
  targets: ['geographic_location', 'installation', 'artifact', 'npc']
}
```

### Economic Domain
```typescript
{
  domain: 'economic',
  actions: [
    'monopolize',         // Create monopolizes relationship
    'establish_trade',    // Create trade_routes relationship
    'blockade',           // Create blockades relationship
    'extract_resource',   // Create extracts_from relationship
    'establish_market'    // Create market_at relationship
  ],
  availableTo: ['npc', 'faction', 'installation'],
  targets: ['resource', 'geographic_location', 'installation', 'transport']
}
```

### Military Domain
```typescript
{
  domain: 'military',
  actions: [
    'attack',             // Create threatens relationship
    'defend',             // Create protected_by relationship
    'siege',              // Create sieges relationship
    'patrol',             // Create patrols relationship
    'fortify'             // Create fortified_by relationship
  ],
  availableTo: ['npc', 'faction', 'transport', 'monster', 'installation'],
  targets: ['installation', 'geographic_location', 'faction', 'transport']
}
```

### Environmental Domain
```typescript
{
  domain: 'environmental',
  actions: [
    'erupt',              // Geographic location disaster
    'drift',              // Location movement
    'collapse',           // Structure destruction
    'grow',               // Organic expansion
    'spawn'               // Create new entities (monster nests)
  ],
  availableTo: ['geographic_location', 'monster', 'supernatural_abilities'],
  targets: ['installation', 'geographic_location', 'npc']
}
```

### Corrupting Domain
```typescript
{
  domain: 'corrupting',
  actions: [
    'corrupt',            // Create corrupted_by relationship
    'infect',             // Spread corruption
    'taint',              // Weaken/damage
    'possess',            // Control entity
    'twist'               // Transform entity
  ],
  availableTo: ['artifact', 'supernatural_abilities', 'monster', 'Principles'],
  targets: ['npc', 'installation', 'geographic_location', 'faction']
}
```

### Discovery Domain
```typescript
{
  domain: 'discovery',
  actions: [
    'discover',           // Create discovered_by relationship
    'chart',              // Create charted_by (geographic location)
    'decipher',           // Create deciphered_by (artifact, edict)
    'invent',             // Create invented_by (ability)
    'found'               // Create founded_by (installation, faction)
  ],
  availableTo: ['npc', 'faction', 'transport'],
  targets: ['geographic_location', 'artifact', 'resource', 'ability', 'Principles']
}
```

## Examples Across Entity Types

### Example 1: NPC Agent (Cutthroat Dave)

```typescript
{
  id: 'cutthroat_dave',
  kind: 'npc',
  subtype: 'crime_lord',
  prominence: 'mythic',

  // Links determine action domains
  links: [
    {kind: 'leader_of', dst: 'midnight_claws_faction'},
    {kind: 'resident_of', dst: 'nightfall_shelf'}
  ],

  catalyst: {
    canAct: true,

    // Domains derived from relationships
    actionDomains: ['political', 'military', 'economic'],
    // Because: leader_of (political), leader_of militia (military), controls trade (economic)

    influence: 0.8,

    catalyzedEvents: [
      {relationshipId: 'rel_001', action: 'seized control of Nightfall Shelf', tick: 45},
      {relationshipId: 'rel_023', action: 'monopolized shadow trade', tick: 67}
    ],

    availableActions: [
      {type: 'seize_control', domain: 'political', targetKinds: ['installation', 'geographic_location']},
      {type: 'siege', domain: 'military', targetKinds: ['installation']},
      {type: 'monopolize', domain: 'economic', targetKinds: ['resource', 'ability']}
    ],

    lifecycle: 'active'
  }
}
```

### Example 2: Faction Agent (The Midnight Claws)

```typescript
{
  id: 'midnight_claws',
  kind: 'faction',
  subtype: 'criminal',
  prominence: 'renowned',

  links: [
    {kind: 'controls', dst: 'nightfall_shelf'},
    {kind: 'enemy_of', dst: 'icebound_exchange'}
  ],

  catalyst: {
    canAct: true,
    actionDomains: ['political', 'economic', 'military'],
    influence: 0.6,

    catalyzedEvents: [
      {relationshipId: 'rel_078', action: 'expanded into Krill Shoals', tick: 89}
    ],

    availableActions: [
      {type: 'expand_territory', domain: 'political'},
      {type: 'monopolize', domain: 'economic', targetKinds: ['resource']},
      {type: 'attack', domain: 'military', targetKinds: ['faction', 'installation']}
    ],

    lifecycle: 'active'
  }
}
```

### Example 3: Artifact Agent (The Ring of Power)

```typescript
{
  id: 'ring_of_power',
  kind: 'artifact',
  subtype: 'dark_artifact',
  prominence: 'mythic',

  links: [
    {kind: 'possessed_by', dst: 'sauron_npc'},  // Current owner
    {kind: 'forged_at', dst: 'mount_doom'}      // Origin
  ],

  catalyst: {
    canAct: true,
    actionDomains: ['corrupting', 'magical'],
    influence: 0.9,  // Extremely powerful

    catalyzedEvents: [
      {relationshipId: 'rel_045', action: 'corrupted Isildur', tick: 12},
      {relationshipId: 'rel_102', action: 'corrupted the Nine Kings', tick: 34}
    ],

    availableActions: [
      {type: 'corrupt', domain: 'corrupting', targetKinds: ['npc']},
      {type: 'amplify_power', domain: 'magical', targetKinds: ['npc']},
      {type: 'influence', domain: 'political', targetKinds: ['faction']}
    ],

    lifecycle: 'active'
  }
}
```

### Example 4: Monster Agent (The Sarlac)

```typescript
{
  id: 'great_sarlac',
  kind: 'monster',
  subtype: 'pit_predator',
  prominence: 'renowned',

  links: [
    {kind: 'inhabits', dst: 'sarlac_pit'},
    {kind: 'threatens', dst: 'tatooine_location'}
  ],

  catalyst: {
    canAct: true,
    actionDomains: ['territorial', 'predatory'],
    influence: 0.5,

    catalyzedEvents: [
      {relationshipId: 'rel_067', action: 'consumed smuggler convoy', tick: 56}
    ],

    availableActions: [
      {type: 'threaten_location', domain: 'territorial', targetKinds: ['geographic_location', 'installation']},
      {type: 'consume', domain: 'predatory', targetKinds: ['npc', 'transport']}
    ],

    lifecycle: 'active'  // Monsters can be 'dormant' or 'slain'
  }
}
```

### Example 5: Transport Agent (The Millennium Falcon)

```typescript
{
  id: 'millennium_falcon',
  kind: 'transport',
  subtype: 'smuggling_ship',
  prominence: 'renowned',

  links: [
    {kind: 'piloted_by', dst: 'han_solo_npc'},
    {kind: 'docked_at', dst: 'mos_eisley_installation'}
  ],

  catalyst: {
    canAct: true,
    actionDomains: ['military', 'economic', 'discovery'],
    influence: 0.4,

    catalyzedEvents: [
      {relationshipId: 'rel_134', action: 'discovered Kessel Run shortcut', tick: 78}
    ],

    availableActions: [
      {type: 'patrol', domain: 'military', targetKinds: ['geographic_location']},
      {type: 'transport', domain: 'economic', targetKinds: ['resource', 'artifact']},
      {type: 'chart', domain: 'discovery', targetKinds: ['geographic_location']}
    ],

    lifecycle: 'active'  // Ships can be 'destroyed' or 'legendary' (decommissioned museum piece)
  }
}
```

### Example 6: Supernatural Ability Agent (The Force)

```typescript
{
  id: 'the_force',
  kind: 'supernatural_abilities',
  subtype: 'cosmic_energy',
  prominence: 'mythic',

  links: [
    {kind: 'manifests_in', dst: 'all_living_things'},
    {kind: 'discovered_by', dst: 'jedi_order_faction'}
  ],

  catalyst: {
    canAct: true,
    actionDomains: ['magical', 'corrupting', 'discovery'],
    influence: 1.0,  // Fundamental force

    catalyzedEvents: [
      {relationshipId: 'rel_201', action: 'manifested in Anakin Skywalker', tick: 45}
    ],

    availableActions: [
      {type: 'manifest', domain: 'magical', targetKinds: ['npc']},
      {type: 'corrupt', domain: 'corrupting', targetKinds: ['npc']},  // Dark side
      {type: 'bless', domain: 'magical', targetKinds: ['npc']}  // Light side
    ],

    lifecycle: 'active'  // Supernatural forces are always active
  }
}
```

### Example 7: Installation Agent (Death Star)

```typescript
{
  id: 'death_star',
  kind: 'installation',
  subtype: 'battle_station',
  prominence: 'mythic',

  links: [
    {kind: 'controlled_by', dst: 'galactic_empire_faction'},
    {kind: 'orbits', dst: 'alderaan_location'}
  ],

  catalyst: {
    canAct: true,
    actionDomains: ['military', 'political'],
    influence: 0.95,

    catalyzedEvents: [
      {relationshipId: 'rel_301', action: 'destroyed Alderaan', tick: 89}
    ],

    availableActions: [
      {type: 'destroy_location', domain: 'military', targetKinds: ['geographic_location', 'installation']},
      {type: 'threaten', domain: 'political', targetKinds: ['faction', 'geographic_location']}
    ],

    lifecycle: 'active'  // Can be 'destroyed' or 'under_construction'
  }
}
```

### Example 8: Geographic Location (mostly passive, rare actions)

```typescript
{
  id: 'mustafar',
  kind: 'geographic_location',
  subtype: 'volcanic_planet',
  prominence: 'recognized',

  links: [
    {kind: 'adjacent_to', dst: 'outer_rim'},
    {kind: 'contains', dst: 'lava_flows'}
  ],

  catalyst: {
    canAct: true,  // Special case: can have environmental events
    actionDomains: ['environmental'],
    influence: 0.3,

    catalyzedEvents: [
      {relationshipId: 'rel_156', action: 'eruption destroyed mining outpost', tick: 67}
    ],

    availableActions: [
      {type: 'erupt', domain: 'environmental', targetKinds: ['installation'], chance: 0.01}  // Very rare
    ],

    lifecycle: 'active'
  }
}
```

### Example 9: Resource (passive, no actions)

```typescript
{
  id: 'kyber_crystals',
  kind: 'resource',
  subtype: 'force_crystal',
  prominence: 'renowned',

  links: [
    {kind: 'found_at', dst: 'ilum_location'},
    {kind: 'monopolized_by', dst: 'galactic_empire_faction'}
  ],

  // No catalyst - resources are passive
  // They're acted UPON (monopolized, extracted, discovered)
  // But don't act themselves
}
```

### Example 10: Principle (immutable, no actions)

```typescript
{
  id: 'hyperspace',
  kind: 'Principles',
  subtype: 'faster_than_light',
  prominence: 'mythic',

  links: [
    {kind: 'enables', dst: 'all_transport'},
    {kind: 'discovered_by', dst: 'ancient_civilization'}
  ],

  // No catalyst - Principles are immutable world rules
  // They define how the world works, but don't act
}
```

## Universal Catalyst System

```typescript
const universal_catalyst_system: SimulationSystem = {
  id: 'universal_catalyst',
  name: 'Universal Agent Actions',

  apply: (graph: Graph, modifier: number = 1.0) => {
    // Find all entities that CAN act
    const agents = Array.from(graph.entities.values())
      .filter(entity => entity.catalyst?.canAct === true);

    const relationshipsCreated: Relationship[] = [];
    const entitiesModified: string[] = [];

    agents.forEach(agent => {
      // 1. Determine if agent attempts action this tick
      const attemptChance = calculateAttemptChance(agent);
      if (Math.random() > attemptChance * modifier) return;

      // 2. Select action from available actions
      // Weighted by prominence + domain relevance + current pressures
      const action = selectAction(agent, graph);
      if (!action) return;

      // 3. Attempt action (can succeed or fail)
      const outcome = attemptAction(agent, action, graph);

      // 4. Handle success/failure
      if (outcome.success) {
        // Create world relationships with attribution
        outcome.relationships.forEach(rel => {
          rel.catalyzedBy = agent.id;
          rel.createdAt = graph.tick;
          relationshipsCreated.push(rel);
          graph.relationships.push(rel);
        });

        // Update agent influence and prominence
        agent.catalyst.influence = Math.min(1.0, agent.catalyst.influence + outcome.influenceGain);

        if (shouldIncreaseProminence(agent)) {
          agent.prominence = increaseProminence(agent.prominence);
        }

        // Record catalyzed event
        agent.catalyst.catalyzedEvents.push({
          relationshipId: outcome.relationshipId,
          action: outcome.description,
          tick: graph.tick
        });

        entitiesModified.push(agent.id);

        // Create rich history event
        graph.history.push({
          tick: graph.tick,
          type: `${agent.kind}_action`,
          description: `${agent.name} ${outcome.description}`,
          protagonists: [agent.id],
          tags: [action.domain, outcome.impactLevel]
        });

      } else {
        // Failed action - influence decreases
        agent.catalyst.influence = Math.max(0, agent.catalyst.influence - outcome.influenceLoss);

        // But can increase prominence (infamy from failure)
        if (outcome.notableFailure) {
          agent.tags.push(outcome.failureTag);
        }

        entitiesModified.push(agent.id);
      }
    });

    return {
      relationshipsAdded: relationshipsCreated,
      entitiesModified,
      pressureChanges: {},
      description: relationshipsCreated.length > 0
        ? `${relationshipsCreated.length} catalyst actions shaped the world`
        : 'Agents dormant this cycle'
    };
  }
};
```

## Key Insight: Domain-Agnostic Framework

The beauty of this model:

1. **Works for any entity type**: NPCs, factions, artifacts, monsters, ships, abilities
2. **Action domains are universal**: Political, magical, military, economic, etc.
3. **Attribution is consistent**: All world events have `catalyzedBy`
4. **Lifecycle is flexible**: Different entity types have different lifecycle states
5. **Prominence evolution is universal**: Based on influence + catalyzed events

## Relationship Categories (Meta-Pattern)

Similarly, relationships fall into universal categories:

### Immutable Facts
```typescript
{
  category: 'immutable_fact',
  kinds: [
    // Geographic
    'adjacent_to', 'contains', 'orbits',

    // Historical
    'originated_in', 'founded_by', 'discovered_by', 'invented_by',

    // Supernatural constants
    'slumbers_beneath' (permanent manifestation)
  ],
  mutable: false,
  strength: 1.0,  // Always maximum
  applyDecay: false,
  applyReinforcement: false,
  applyCulling: false
}
```

### Mutable Political
```typescript
{
  category: 'political',
  kinds: ['controls', 'contests', 'allied_with', 'enemy_of', 'rival_of', 'governs'],
  mutable: true,
  decayRate: 'slow',
  reinforcementConditions: ['proximity', 'shared_interests'],
  cullable: true
}
```

### Mutable Economic
```typescript
{
  category: 'economic',
  kinds: ['monopolizes', 'trades_with', 'blockades', 'extracts_from', 'markets_at'],
  mutable: true,
  decayRate: 'medium',
  reinforcementConditions: ['active_trade', 'resource_availability'],
  cullable: true
}
```

### Mutable Magical
```typescript
{
  category: 'magical',
  kinds: ['corrupted_by', 'blessed_by', 'manifests_at', 'sealed_in', 'powered_by'],
  mutable: true,
  decayRate: 'varies',  // corrupted_by slow, manifests_at can be temporary
  reinforcementConditions: ['magical_instability', 'practitioner_presence'],
  cullable: false  // Magical effects don't cull, but can change
}
```

### Attribution (Immutable)
```typescript
{
  category: 'attribution',
  kinds: ['catalyzed_by', 'founded_by', 'discovered_by', 'invented_by', 'destroyed_by'],
  mutable: false,
  strength: 1.0,
  applyDecay: false,
  applyReinforcement: false,
  applyCulling: false,
  purpose: 'Historical attribution - who caused this'
}
```

## Implementation in Framework

### 1. Entity Schema Definition

```json
{
  "entityTypes": {
    "npc": {
      "catalyst": {
        "canAct": true,
        "defaultDomains": ["political", "economic"],
        "domainRules": {
          "political": {"requires": ["leader_of", "member_of"]},
          "magical": {"requires": ["practitioner_of"]},
          "military": {"requires": ["leader_of", "warrior_subtype"]}
        }
      }
    },

    "faction": {
      "catalyst": {
        "canAct": true,
        "defaultDomains": ["political", "economic", "military"],
        "domainRules": {
          "all": {"requires": ["prominence >= 'recognized'"]}
        }
      }
    },

    "artifact": {
      "catalyst": {
        "canAct": true,
        "defaultDomains": ["magical", "corrupting"],
        "domainRules": {
          "magical": {"requires": ["prominence >= 'renowned'"]},
          "corrupting": {"requires": ["subtype === 'dark_artifact'"]}
        }
      }
    },

    "monster": {
      "catalyst": {
        "canAct": true,
        "defaultDomains": ["territorial", "predatory"],
        "domainRules": {
          "territorial": {"requires": ["inhabits relationship"]},
          "predatory": {"always": true}
        }
      }
    },

    "resource": {
      "catalyst": {
        "canAct": false
      }
    },

    "Principles": {
      "catalyst": {
        "canAct": false
      }
    }
  }
}
```

### 2. Action Domain Definitions

```json
{
  "actionDomains": {
    "political": {
      "actions": ["seize_control", "broker_alliance", "declare_war", "found_faction"],
      "availableTo": ["npc", "faction"],
      "targetKinds": ["installation", "geographic_location", "faction"]
    },

    "magical": {
      "actions": ["corrupt_location", "bless_artifact", "manifest", "discover"],
      "availableTo": ["npc", "supernatural_abilities", "artifact"],
      "targetKinds": ["geographic_location", "installation", "artifact", "npc"]
    },

    "corrupting": {
      "actions": ["corrupt", "infect", "possess", "twist"],
      "availableTo": ["artifact", "supernatural_abilities", "monster"],
      "targetKinds": ["npc", "installation", "geographic_location"]
    }
  }
}
```

## Benefits of This Meta-Pattern

1. **Domain-Agnostic**: Works for Star Wars, fantasy, cyberpunk, historical, etc.
2. **Type-Agnostic**: NPCs, factions, artifacts, monsters all use same catalyst system
3. **Configurable**: Action domains defined in schema, not hardcoded
4. **Extensible**: Add new entity types by defining their catalyst properties
5. **Consistent**: All world events have attribution, all agents use same prominence/influence model
6. **Emergent**: Complex stories emerge from simple action rules

## Example: Penguin World vs Star Wars

**Same framework, different domains**:

### Penguin World
```
Agents: NPCs (leaders), Factions (guilds), Abilities (ice magic)
Domains: political (territorial control), magical (ice corruption), economic (fish trade)
```

### Star Wars
```
Agents: NPCs (Jedi/Sith), Factions (Empire/Rebellion), Artifacts (lightsabers), Transport (ships)
Domains: political (galactic control), magical (Force), military (space battles), corrupting (Dark Side)
```

### Medieval Fantasy
```
Agents: NPCs (knights), Factions (kingdoms), Monsters (dragons), Artifacts (magic swords)
Domains: political (feudal control), magical (sorcery), military (sieges), corrupting (necromancy)
```

**Same catalyst system, different content!**

## Summary

Instead of treating NPCs specially, we extract the meta-pattern:

**Entities** → Categorized by **agency** (can act? what domains?)
**Actions** → Organized by **domain** (political, magical, military, etc.)
**Events** → **Attributed** to catalyst entities (who caused this?)
**Relationships** → Categorized by **mutability** (immutable facts, mutable political, etc.)

This makes the framework truly generic while retaining the narrative depth of named catalysts.
