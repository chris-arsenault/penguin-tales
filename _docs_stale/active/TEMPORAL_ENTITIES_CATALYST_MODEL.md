# Temporal Entities in the Catalyst Model

**Date**: 2025-11-23
**New Entity Types**: `era`, `occurrence`
**Question**: How do temporal entities fit into the agent/anchor/event categorization?

## Quick Answer

**Era**: ANCHOR (context modifier, not an agent)
**Occurrence**: SECOND-ORDER AGENT (created by agents, then becomes agent itself!)

## Era: Context Modifier (Anchor)

### What Eras Are

Eras represent **temporal context** that shapes what's possible:
- "Age of Discovery" - exploration flourishes
- "The Dark Times" - magic wanes, conflict rises
- "The Great Thaw" - expansion and settlement

### Era as Entity

```typescript
{
  id: 'age_of_discovery',
  kind: 'era',
  name: 'The Age of Discovery',

  // Temporal bounds
  startTick: 80,
  endTick: 140,

  // Eras modify the world but DON'T act directly
  modifiers: {
    // What actions are more/less likely
    actionDomainMultipliers: {
      'discovery': 2.0,          // Discovery actions 2x more likely
      'political': 1.5,          // Territorial expansion encouraged
      'magical': 0.5,            // Magic waning this era
      'economic': 1.2            // Trade flourishing
    },

    // Template activation rates
    templateWeights: {
      'magical_site_discovery': 2.0,
      'territorial_expansion': 1.5,
      'cult_formation': 0.3      // Rare during rational age
    },

    // Pressure modifiers
    pressureMultipliers: {
      'exploration_drive': 2.0,
      'magical_instability': 0.5
    }
  },

  // Relationships to other temporal entities
  links: [
    {kind: 'preceded_by', dst: 'age_of_darkness'},
    {kind: 'succeeded_by', dst: 'age_of_conflict'}
  ],

  // NO catalyst - eras are context, not agents
  // They don't perform actions, they modify action probabilities
}
```

### Era Transitions

Eras can transition based on world state:

```typescript
const era_transition_system: SimulationSystem = {
  id: 'era_transition',

  apply: (graph: Graph) => {
    const currentEra = getCurrentEra(graph);

    // Check transition conditions
    const conditions = {
      'age_of_discovery → age_of_conflict': () => {
        // Too many factions, high conflict pressure
        const factions = findEntities(graph, {kind: 'faction'});
        const conflicts = graph.relationships.filter(r => r.kind === 'enemy_of');
        return factions.length > 15 && conflicts.length > 30;
      },

      'age_of_conflict → age_of_reconstruction': () => {
        // Major occurrence ends, stability rises
        const wars = findEntities(graph, {kind: 'occurrence', subtype: 'war', status: 'ongoing'});
        const stability = graph.pressures.get('stability');
        return wars.length === 0 && stability > 70;
      }
    };

    // Transition if conditions met
    const transitionKey = `${currentEra.name} → ?`;
    if (conditions[transitionKey]?.()) {
      const nextEra = createEra(/* next era config */);
      currentEra.endTick = graph.tick;
      nextEra.startTick = graph.tick + 1;

      graph.history.push({
        tick: graph.tick,
        type: 'era_transition',
        description: `The ${currentEra.name} ends, giving way to the ${nextEra.name}`,
        tags: ['temporal', 'era_change']
      });
    }
  }
};
```

### Era Category: ANCHOR

Eras are **anchors** because they:
- ❌ Don't perform actions (no catalyst)
- ❌ Don't catalyze events directly
- ✅ Modify probabilities and constraints
- ✅ Provide temporal context for agent actions
- ✅ Can transition based on world state

## Occurrence: Second-Order Agent

### What Occurrences Are

Occurrences represent **major happenings** that:
1. Are **created by** first-order agents (NPCs, factions, etc.)
2. Then **become agents themselves** with momentum and effects

Examples:
- "The Southpaw War" - ongoing conflict between factions
- "Cataclysm at Yeti Pond" - magical disaster
- "The Great Schism" - religious/political split
- "The Krill Boom" - economic event
- "Discovery of the New World" - exploration event

### The Key Insight: Occurrences Have Momentum

Wars don't just happen and sit there - they **escalate**, **draw in neutral parties**, **create refugees**, **devastate locations**.

Disasters don't just occur - they **spread**, **corrupt nearby areas**, **create ongoing threats**.

Movements don't just start - they **grow**, **inspire followers**, **split factions**.

### Occurrence as Second-Order Agent

```typescript
{
  id: 'southpaw_war',
  kind: 'occurrence',
  subtype: 'war',
  name: 'The Southpaw War',
  description: 'A brutal conflict between Aurora Stack and Southpaw Colony over fishing rights',

  // Temporal bounds
  startTick: 102,
  endTick: null,  // Still ongoing

  // Status can change
  status: 'escalating',  // 'brewing', 'ongoing', 'escalating', 'stalemate', 'winding_down', 'ended'

  // Relationships to first-order agents
  links: [
    // Attribution: who started this
    {kind: 'catalyzed_by', dst: 'penguin_bill_npc', note: 'Started the feud'},
    {kind: 'catalyzed_by', dst: 'penguin_bob_npc', note: 'Escalated to faction war'},

    // Participants
    {kind: 'participant', dst: 'aurora_stack_faction', role: 'aggressor'},
    {kind: 'participant', dst: 'southpaw_faction', role: 'defender'},
    {kind: 'participant', dst: 'icebound_exchange_faction', role: 'profiteer'},  // Drawn in later

    // Geography
    {kind: 'theater_of_war', dst: 'border_waters_location'},
    {kind: 'devastated', dst: 'krill_shoals_location'},  // War destroyed this

    // Nested relationship to era
    {kind: 'occurred_during', dst: 'age_of_conflict_era'}
  ],

  // OCCURRENCES CAN ACT!
  catalyst: {
    canAct: true,

    // War-specific action domains
    actionDomains: ['conflict_escalation', 'political', 'economic'],

    // Wars have influence/momentum
    influence: 0.7,  // High - major war affecting region

    // What has the war itself caused?
    catalyzedEvents: [
      {relationshipId: 'rel_456', action: 'drew Icebound Exchange into conflict', tick: 115},
      {relationshipId: 'rel_478', action: 'devastated Krill Shoals', tick: 123},
      {relationshipId: 'rel_501', action: 'created refugee crisis', tick: 134}
    ],

    // What can the war do?
    availableActions: [
      {type: 'escalate', domain: 'conflict_escalation', targetKinds: ['faction']},
      {type: 'draw_in_faction', domain: 'political', targetKinds: ['faction']},
      {type: 'create_refugees', domain: 'economic', targetKinds: ['npc', 'installation']},
      {type: 'devastate_location', domain: 'military', targetKinds: ['geographic_location', 'installation']},
      {type: 'stalemate', domain: 'conflict_escalation', targetKinds: []}  // No target, changes status
    ],

    lifecycle: 'ongoing'  // Can transition: ongoing → stalemate → ended
  },

  // Occurrence-specific metadata
  intensity: 0.8,        // How severe (affects action probabilities)
  scope: 'regional',     // 'local', 'regional', 'world'
  participants: 3        // Number of factions involved
}
```

### Example: War Occurrence Actions

**Action: Escalate**
```typescript
// The Southpaw War escalates
occurrence_catalyst_system: {
  // War has been ongoing for 20 ticks, intensity rising
  const war = graph.entities.get('southpaw_war');

  // War attempts to escalate
  const outcome = attemptAction(war, 'escalate');

  if (outcome.success) {
    // Status changes
    war.status = 'total_war';
    war.intensity = 0.95;

    // New relationships created
    graph.relationships.push({
      kind: 'at_war',
      src: 'aurora_stack',
      dst: 'southpaw',
      strength: 1.0,
      catalyzedBy: 'southpaw_war'  // The WAR catalyzed this escalation!
    });

    graph.history.push({
      tick: graph.tick,
      type: 'war_escalation',
      description: 'The Southpaw War escalates to total war, no quarter given',
      protagonists: ['southpaw_war'],  // The war itself is the protagonist!
      factions: ['aurora_stack', 'southpaw']
    });
  }
}
```

**Action: Draw In Faction**
```typescript
// The war draws in a neutral faction
const neutralFactions = findEntities(graph, {
  kind: 'faction',
  filter: (f) => !war.links.some(l => l.kind === 'participant' && l.dst === f.id)
});

const targetFaction = selectNearbyFaction(neutralFactions, war);

// War performs action
const outcome = attemptAction(war, 'draw_in_faction', targetFaction);

if (outcome.success) {
  // Add participant relationship
  war.links.push({
    kind: 'participant',
    dst: targetFaction.id,
    role: 'reluctant_ally'
  });

  // Create faction relationships
  graph.relationships.push({
    kind: 'allied_with',
    src: targetFaction.id,
    dst: war.links.find(l => l.role === 'defender').dst,
    strength: 0.6,
    catalyzedBy: 'southpaw_war',  // War forced this alliance!
    note: 'drawn into war'
  });

  war.participants += 1;
  war.catalyst.influence += 0.1;  // War grows in importance

  graph.history.push({
    tick: graph.tick,
    type: 'war_expansion',
    description: `The Southpaw War draws ${targetFaction.name} into the conflict`,
    protagonists: ['southpaw_war'],
    factions: [targetFaction.id]
  });
}
```

**Action: Devastate Location**
```typescript
// War devastates a location in the theater
const theatersOfWar = war.links
  .filter(l => l.kind === 'theater_of_war')
  .map(l => graph.entities.get(l.dst));

const location = pickRandom(theatersOfWar);

const outcome = attemptAction(war, 'devastate_location', location);

if (outcome.success) {
  // Modify location
  location.status = 'devastated';
  location.prominence = decreaseProminence(location.prominence);
  location.tags.push('war_torn', 'ruins');

  // Create devastation relationship
  graph.relationships.push({
    kind: 'devastated_by',
    src: location.id,
    dst: 'southpaw_war',
    strength: 0.9,
    catalyzedBy: 'southpaw_war'
  });

  // War records this devastation
  war.links.push({
    kind: 'devastated',
    dst: location.id
  });

  graph.history.push({
    tick: graph.tick,
    type: 'war_devastation',
    description: `The Southpaw War devastates ${location.name}, leaving it in ruins`,
    protagonists: ['southpaw_war'],
    locations: [location.id],
    tags: ['tragedy', 'destruction']
  });
}
```

### Example: Disaster Occurrence

```typescript
{
  id: 'yeti_pond_cataclysm',
  kind: 'occurrence',
  subtype: 'magical_disaster',
  name: 'Cataclysm at Yeti Pond',

  startTick: 67,
  endTick: null,
  status: 'spreading',

  links: [
    {kind: 'catalyzed_by', dst: 'sage_bungus_npc', note: 'Failed containment'},
    {kind: 'epicenter', dst: 'yeti_pond_location'},
    {kind: 'corrupted', dst: 'yeti_pond_location'},
    {kind: 'corrupted', dst: 'nearby_shrine_installation'},
    {kind: 'origin_ability', dst: 'void_magic_ability'}
  ],

  catalyst: {
    canAct: true,
    actionDomains: ['disaster_spread', 'magical', 'corrupting'],
    influence: 0.6,

    catalyzedEvents: [
      {relationshipId: 'rel_234', action: 'spread corruption to nearby shrine', tick: 72},
      {relationshipId: 'rel_267', action: 'created void-touched monsters', tick: 81}
    ],

    availableActions: [
      {type: 'spread_corruption', domain: 'disaster_spread', targetKinds: ['geographic_location', 'installation']},
      {type: 'spawn_monster', domain: 'disaster_spread', targetKinds: []},
      {type: 'create_refugees', domain: 'economic', targetKinds: ['installation']},
      {type: 'wane', domain: 'disaster_spread', targetKinds: []}  // Disaster can fade over time
    ],

    lifecycle: 'spreading'  // Can transition: emerging → spreading → contained → ended
  },

  intensity: 0.7,
  scope: 'local'
}
```

### Example: Cultural Movement Occurrence

```typescript
{
  id: 'ice_worship_schism',
  kind: 'occurrence',
  subtype: 'cultural_movement',
  name: 'The Great Ice Schism',

  startTick: 145,
  endTick: null,
  status: 'growing',

  links: [
    {kind: 'catalyzed_by', dst: 'prophet_icebeard_npc'},
    {kind: 'split_from', dst: 'traditional_ice_worship_edict'},
    {kind: 'proponent_faction', dst: 'reform_movement_faction'},
    {kind: 'opponent_faction', dst: 'orthodox_church_faction'}
  ],

  catalyst: {
    canAct: true,
    actionDomains: ['cultural', 'political'],
    influence: 0.5,

    catalyzedEvents: [
      {relationshipId: 'rel_678', action: 'converted Frost Clan to reform theology', tick: 156}
    ],

    availableActions: [
      {type: 'convert_faction', domain: 'cultural', targetKinds: ['faction']},
      {type: 'inspire_hero', domain: 'cultural', targetKinds: []},  // Creates new NPC champion
      {type: 'formalize', domain: 'political', targetKinds: []}  // Creates new edict entity
    ],

    lifecycle: 'growing'  // Can transition: emerging → growing → established → fading
  },

  intensity: 0.4,
  scope: 'regional'
}
```

## Occurrence Category: SECOND-ORDER AGENT

Occurrences are **second-order agents** because they:
- ✅ Are created BY first-order agents (NPCs, factions catalyze wars/disasters)
- ✅ Then BECOME agents themselves (wars escalate, disasters spread)
- ✅ Have catalyst properties (can act, have influence, catalyze events)
- ✅ Have lifecycle states (emerging → ongoing → ended)
- ✅ Can be targeted by first-order agent actions (broker peace to end war)

## Action Flow: First-Order → Second-Order

```typescript
// EXAMPLE: How a war occurrence is born and acts

// PHASE 1: First-order agents create occurrence
tick 102: Penguin Bill (NPC) enemy_of Penguin Bob (NPC)
  → First-order agent action

tick 104: Bill and Bob conflict escalates to faction conflict
  → Aurora Stack rival_of Southpaw
  → First-order agent action (conflict_escalation system)

tick 105: Faction conflict creates occurrence entity
  → Create "The Southpaw War" occurrence
  → Occurrence.catalyzed_by = [Bill, Bob]
  → Occurrence.participants = [Aurora Stack, Southpaw]

// PHASE 2: Second-order agent (the war) acts
tick 115: The Southpaw War (occurrence) draws in Icebound Exchange
  → War performs 'draw_in_faction' action
  → Icebound Exchange becomes participant
  → War.catalyzedEvents.push('drew in Icebound Exchange')

tick 123: The Southpaw War devastates Krill Shoals
  → War performs 'devastate_location' action
  → Krill Shoals status = 'devastated'
  → War.catalyzedEvents.push('devastated Krill Shoals')

tick 134: The Southpaw War creates refugee crisis
  → War performs 'create_refugees' action
  → Creates refugee_flows_to relationships
  → War.catalyzedEvents.push('created refugee crisis')

// PHASE 3: First-order agents can target occurrence
tick 156: Peacemaker NPC brokers peace
  → NPC performs 'broker_peace' action targeting "Southpaw War"
  → War.status = 'ended'
  → War.endTick = 156
  → War.lifecycle = 'ended'
```

## New Action Domains for Occurrences

### Conflict Escalation Domain
```typescript
{
  domain: 'conflict_escalation',
  actions: [
    'escalate',           // Increase intensity
    'draw_in_faction',    // Add participants
    'stalemate',          // Reduce to gridlock
    'create_atrocity'     // Generate war crimes, increase hatred
  ],
  availableTo: ['occurrence (war subtype)'],
  targets: ['faction', 'npc', 'geographic_location']
}
```

### Disaster Spread Domain
```typescript
{
  domain: 'disaster_spread',
  actions: [
    'spread_corruption',  // Expand corrupted area
    'spawn_monster',      // Create threats
    'create_refugees',    // Population displacement
    'wane'                // Disaster fades (self-targeting)
  ],
  availableTo: ['occurrence (disaster subtype)'],
  targets: ['geographic_location', 'installation', 'npc']
}
```

### Cultural Movement Domain
```typescript
{
  domain: 'cultural',
  actions: [
    'convert_faction',    // Win adherents
    'inspire_hero',       // Create champion NPC
    'formalize',          // Become official edict
    'splinter'            // Movement splits into factions
  ],
  availableTo: ['occurrence (cultural_movement subtype)'],
  targets: ['faction', 'edict']
}
```

## Occurrence Lifecycle

Occurrences transition through states:

**War Lifecycle**:
```
brewing → ongoing → escalating → total_war → stalemate → winding_down → ended
```

**Disaster Lifecycle**:
```
emerging → spreading → peak → contained → waning → ended
```

**Cultural Movement Lifecycle**:
```
underground → growing → established → mainstream → fading
```

**Economic Event Lifecycle**:
```
boom → peak → plateau → bust → recovery
```

## Summary: Modified Catalyst Model

### Entity Categories (Updated)

**1. FIRST-ORDER AGENTS** (directly act on world):
- npc, faction, monster, artifact, transport, supernatural_abilities, installations

**2. SECOND-ORDER AGENTS** (created by first-order, then act):
- **occurrence** (wars, disasters, movements, economic events)

**3. ANCHORS** (context/targets):
- geographic_location, resource, edicts, Principles
- **era** (temporal context modifier)

**4. EVENTS** (not entities):
- conflict, rumor (these might be better as occurrence subtypes or entity status)

### Key Insights

**Eras**:
- Don't act, but modify what actions are possible
- Provide temporal context
- Transition based on world state

**Occurrences**:
- Created by first-order agent actions (wars start, disasters happen)
- Become agents with their own momentum (wars escalate, disasters spread)
- Can be targeted by first-order agents (broker peace, contain disaster)
- Record their own catalyzed events (what the war/disaster itself caused)

**This creates emergent complexity**:
- Bill and Bob start a feud (first-order)
- Feud becomes faction war (first-order escalation)
- War becomes occurrence entity (second-order agent born)
- War draws in neutral parties (second-order acting)
- War devastates locations (second-order acting)
- Peacemaker ends war (first-order targeting second-order)

The framework handles both seamlessly!
