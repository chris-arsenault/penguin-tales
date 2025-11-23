# NPCs as Catalysts: Agent-Based World Events

**Status**: Design phase - Part of framework/domain refactor
**Date**: 2025-11-23
**Core Principle**: NPCs are not the story - they're the ones who MAKE the story happen

## The Key Insight

**Bad (current)**: NPCs form relationships with each other
```
"Rukan lover_of Nyla"
"Frost follower_of Drift"
"Wave mentor_of Tide"
→ 70% of relationships, 0% game relevance
```

**Good (proposed)**: NPCs trigger world-level events
```
"Cutthroat Dave seized control of Nightfall Shelf for The Midnight Claws"
"Sage Bungus failed to contain The Glow-Fissure, corrupting Nightfall Shelf"
"The feud between Penguin Bill and Penguin Bob escalated into the Aurora-East Perch War"
→ NPCs as catalysts for world relationships
```

## Core Design: NPCs as Agents

### NPC Agency Properties

```typescript
interface NPCAgent extends HardState {
  kind: 'npc';

  // NEW: Agency system
  agency: {
    // How much this NPC affects world events (0-1)
    // Derived from prominence + relationships + actions taken
    influence: number;

    // What domains this NPC can affect
    // Based on their roles and relationships
    domains: AgencyDomain[];  // ['political', 'magical', 'economic', 'military']

    // World events this NPC has caused
    // Creates narrative attribution
    catalystFor: Array<{
      relationshipId: string;  // Which world relationship
      action: string;          // What they did
      tick: number;           // When
    }>;

    // Actions available to this NPC
    // Based on prominence, relationships, pressures
    availableActions: NPCAction[];
  };
}

interface NPCAction {
  type:
    | 'seize_control'      // Political: Take territory
    | 'spark_conflict'     // Political: Start war
    | 'found_faction'      // Political: Create organization
    | 'monopolize_tech'    // Economic: Control technology
    | 'corrupt_location'   // Magical: Unleash corruption
    | 'protect_location'   // Magical: Shield from harm
    | 'discover_ability'   // Magical: Find new magic/tech
    | 'betray_faction'     // Political: Defection drama
    | 'assassinate'        // Political: Remove leader
    | 'broker_peace'       // Political: End conflicts
    | 'establish_trade';   // Economic: Create routes

  target: string;  // Entity ID this action affects

  requirements: {
    minProminence: Prominence;
    requiredRelationships: Relationship[];
    requiredPressures: Record<string, number>;
  };

  worldEffect: {
    triggerTemplate?: string;           // World template to trigger
    createRelationships?: Relationship[]; // Direct world relationships
    modifyEntities?: Array<{id: string; changes: Partial<HardState>}>;
  };
}
```

### Flow: NPCs Drive World Events

**Before (template-driven)**:
```
1. territorial_expansion template fires
2. Checks conditions: faction wants location
3. Creates controls relationship
4. Generic history: "The Midnight Claws expand into Nightfall Shelf"
```

**After (NPC-driven)**:
```
1. System identifies opportunity: Midnight Claws can seize Nightfall Shelf
2. Finds eligible NPC agent: Cutthroat Dave (leader_of Midnight Claws, prominence: renowned)
3. Dave has available action: seize_control (requirements met)
4. Dave performs action → triggers territorial_expansion template
5. Template creates controls relationship
6. Relationship attributed to Dave
7. Rich history: "Cutthroat Dave seized control of Nightfall Shelf for The Midnight Claws"
8. Dave's influence increases, becomes historically significant
```

## Examples of NPC-Catalyzed Events

### Example 1: Territorial Takeover

**Setup**:
- Faction: The Midnight Claws (criminal syndicate)
- Location: Nightfall Shelf (weak governance)
- NPC: Cutthroat Dave (leader_of Midnight Claws, prominence: renowned)

**Event Flow**:
```typescript
// System: territorial_control
// 1. Identify opportunity
const opportunity = {
  faction: midnight_claws,
  target: nightfall_shelf,
  reason: 'weak_governance'
};

// 2. Find NPC agent
const agent = findEligibleAgent({
  faction: midnight_claws,
  action: 'seize_control',
  minProminence: 'recognized'
});
// → Returns: Cutthroat Dave

// 3. Execute action
dave.performAction('seize_control', nightfall_shelf);

// 4. Create world relationships
relationships.push({
  kind: 'controls',
  src: midnight_claws.id,
  dst: nightfall_shelf.id,
  strength: 1.0,
  catalyzedBy: dave.id,
  createdAt: tick
});

// 5. Update history
history.push({
  tick: tick,
  type: 'territorial_takeover',
  description: "Cutthroat Dave seized control of Nightfall Shelf for The Midnight Claws",
  protagonists: [dave.id],
  factions: [midnight_claws.id],
  locations: [nightfall_shelf.id]
});

// 6. Update NPC agency
dave.agency.catalystFor.push({
  relationshipId: rel.id,
  action: 'seized control of Nightfall Shelf',
  tick: tick
});
dave.agency.influence += 0.1;  // Significant action
dave.prominence = 'mythic';    // Legendary figure
```

**Outcome**:
- World relationship: Midnight Claws controls Nightfall Shelf ✓
- NPC attribution: Caused by Cutthroat Dave ✓
- Rich narrative: Named character with motivation ✓
- Game utility: Dave is now quest-relevant (the crime boss who took over) ✓

### Example 2: Magical Corruption (Failure Case)

**Setup**:
- Location: Nightfall Shelf
- Ability: The Glow-Fissure (slumbers_beneath Nightfall Shelf)
- NPC: Sage Bungus (practitioner_of Glow-Fissure magic, resident_of Nightfall Shelf)
- Pressure: magical_instability = 75

**Event Flow**:
```typescript
// System: magical_corruption
// 1. Detect corruption risk
const risk = {
  ability: glow_fissure,
  location: nightfall_shelf,
  pressure: magical_instability,
  severity: 'high'
};

// 2. Find NPC who could prevent/cause
const protector = findEligibleAgent({
  ability: glow_fissure,
  action: 'protect_location',
  location: nightfall_shelf
});
// → Returns: Sage Bungus

// 3. Attempt containment (probabilistic)
const success = attemptContainment(bungus, glow_fissure);
// → Fails! (random chance based on prominence vs instability)

// 4. Corruption spreads (because containment failed)
relationships.push({
  kind: 'corrupted_by',
  src: nightfall_shelf.id,
  dst: glow_fissure.id,
  strength: 0.8,
  catalyzedBy: bungus.id,  // Failed to prevent
  createdAt: tick
});

// 5. Update location
nightfall_shelf.status = 'corrupted';
nightfall_shelf.tags.push('dangerous', 'warped');

// 6. Tragic history
history.push({
  tick: tick,
  type: 'magical_disaster',
  description: "Sage Bungus failed to contain The Glow-Fissure, and corruption spread through Nightfall Shelf",
  protagonists: [bungus.id],
  locations: [nightfall_shelf.id],
  abilities: [glow_fissure.id]
});

// 7. NPC becomes tragic figure
bungus.agency.catalystFor.push({
  relationshipId: rel.id,
  action: 'failed to contain The Glow-Fissure',
  tick: tick
});
bungus.prominence = 'mythic';  // Infamous failure
bungus.tags.push('tragic', 'blamed');
```

**Outcome**:
- World relationship: Nightfall Shelf corrupted_by Glow-Fissure ✓
- NPC attribution: Sage Bungus failed to prevent it ✓
- Tragic narrative: Well-intentioned failure ✓
- Game utility: Bungus is quest-relevant (the sage who failed, maybe needs redemption) ✓

### Example 3: Personal Feud → Faction War

**Setup**:
- NPC A: Penguin Bill (member_of Aurora Stack, prominence: renowned)
- NPC B: Penguin Bob (member_of East Perch, prominence: renowned)
- Personal conflict: Bill stole Bob's lover (if we keep lover_of for rare dramatic catalysts)

**Event Flow**:
```typescript
// System: conflict_escalation
// 1. Detect high-prominence personal conflict
const personalConflict = findRelationship({
  kind: 'enemy_of',
  src: bill.id,
  dst: bob.id
});

// 2. Check if it can escalate
const canEscalate =
  bill.prominence >= 'renowned' &&
  bob.prominence >= 'renowned' &&
  bill.getFaction() !== bob.getFaction();

// 3. Personal actions spiral
bill.performAction('spark_conflict', bob.getFaction());

// 4. Create faction-level conflict
relationships.push({
  kind: 'rival_of',
  src: aurora_stack.id,
  dst: east_perch.id,
  strength: 0.6,
  catalyzedBy: [bill.id, bob.id],  // Both responsible
  origin: 'personal_feud_escalation',
  createdAt: tick
});

// 5. Epic history
history.push({
  tick: tick,
  type: 'war_origins',
  description: "The bitter feud between Penguin Bill and Penguin Bob escalated into open conflict between Aurora Stack and East Perch",
  protagonists: [bill.id, bob.id],
  factions: [aurora_stack.id, east_perch.id],
  tags: ['tragedy', 'escalation']
});

// 6. Both become historically significant
bill.agency.catalystFor.push({
  relationshipId: rel.id,
  action: 'sparked war with East Perch',
  tick: tick
});
bob.agency.catalystFor.push({
  relationshipId: rel.id,
  action: 'responded to Aurora Stack aggression',
  tick: tick
});
```

**Outcome**:
- World relationship: Aurora Stack rival_of East Perch ✓
- NPC attribution: Caused by Bill & Bob's feud ✓
- Tragic narrative: Personal drama becomes war ✓
- Game utility: Both NPCs quest-relevant (the idiots who started the war) ✓

### Example 4: Tech Monopoly Formation

**Setup**:
- Faction: The Icebound Exchange (merchant guild)
- Ability: Ice Magic (powerful technology)
- NPC: Master Frostweaver (leader_of Icebound Exchange, practitioner_of Ice Magic)

**Event Flow**:
```typescript
// System: technological_adoption
// 1. Identify monopoly opportunity
const opportunity = {
  faction: icebound_exchange,
  ability: ice_magic,
  reason: 'faction_controls_practitioners'
};

// 2. Find NPC agent (faction leader + practitioner)
const agent = master_frostweaver;

// 3. Perform monopolization action
frostweaver.performAction('monopolize_tech', ice_magic);

// 4. Create monopoly relationship
relationships.push({
  kind: 'monopolizes',
  src: icebound_exchange.id,
  dst: ice_magic.id,
  strength: 0.9,
  catalyzedBy: frostweaver.id,
  createdAt: tick
});

// 5. Create ban on competitors
relationships.push({
  kind: 'bans',
  src: icebound_exchange.id,
  dst: ice_magic.id,  // Bans unauthorized practice
  strength: 0.7,
  catalyzedBy: frostweaver.id
});

// 6. Power consolidation history
history.push({
  tick: tick,
  type: 'monopoly_formation',
  description: "Master Frostweaver consolidated The Icebound Exchange's monopoly over ice magic, banning unauthorized practitioners",
  protagonists: [frostweaver.id],
  factions: [icebound_exchange.id],
  abilities: [ice_magic.id]
});

// 7. NPC becomes powerful gatekeeper
frostweaver.agency.influence += 0.15;
frostweaver.agency.domains.push('economic_control');
```

**Outcome**:
- World relationship: Icebound Exchange monopolizes ice magic ✓
- NPC attribution: Master Frostweaver the monopolist ✓
- Power narrative: Economic control through hoarding ✓
- Game utility: Frostweaver is quest-relevant (the gatekeeper to ice magic) ✓

## NPC Creation Strategy

### Stop Creating Random NPCs

**Remove**:
- familyExpansion (random children)
- kinshipConstellation (random families)
- outlawRecruitment (random thugs)
- mysteriousVanishing (random disappearances)

### Create NPCs as Part of World Events

**World Template Creates NPC**:

```typescript
// Template: faction_founding
// Creates: New faction + founder NPC

const founderNPC = {
  id: generateId('npc'),
  kind: 'npc',
  subtype: 'founder',
  name: generateName('founder'),
  prominence: 'recognized',

  // Agency from birth
  agency: {
    influence: 0.5,
    domains: ['political'],
    catalystFor: [{
      relationshipId: founded_rel.id,
      action: `founded ${newFaction.name}`,
      tick: tick
    }],
    availableActions: [
      {type: 'expand_faction', target: newFaction.id},
      {type: 'seize_control', requirements: {...}}
    ]
  }
};

// Relationship: NPC founded faction
relationships.push({
  kind: 'founded_by',
  src: newFaction.id,
  dst: founderNPC.id,
  strength: 1.0,
  immutable: true  // Historical fact
});
```

**Result**: Every NPC is created WITH PURPOSE and ATTRIBUTION

### NPC Archetypes

Instead of random NPCs, create archetypal NPCs tied to world events:

**Political Agents**:
- `founder`: Created by faction_founding (founds organizations)
- `conqueror`: Created by territorial_expansion (seizes control)
- `betrayer`: Created by faction_schism (causes splits)
- `peacemaker`: Created by alliance_formation (brokers deals)

**Magical Agents**:
- `discoverer`: Created by magical_discovery (finds new magic)
- `corruptor`: Created by magical_corruption (unleashes danger)
- `protector`: Created by location_protection (shields from harm)
- `researcher`: Created by tech_breakthrough (develops abilities)

**Economic Agents**:
- `monopolist`: Created by monopoly_formation (controls tech)
- `trader`: Created by trade_route_establishment (creates commerce)
- `saboteur`: Created by economic_warfare (disrupts trade)

**Military Agents**:
- `general`: Created by territorial_conflict (leads wars)
- `defender`: Created by location_defense (protects territory)
- `assassin`: Created by leadership_crisis (removes leaders)

## NPC Relationship Changes

### KEEP (Structural - Connect NPCs to World)
- `member_of`: NPC → Faction
- `leader_of`: NPC → Faction (makes them political agents)
- `resident_of`: NPC → Location
- `practitioner_of`: NPC → Ability (makes them magical/tech agents)
- `founded_by`: Faction → NPC (attribution)
- `discovered_by`: Ability → NPC (attribution)

### REMOVE (Pure NPC Drama)
- `lover_of`: No game value
- `follower_of`: Redundant with prominence
- `mentor_of`: Niche, low value
- `friend_of`: Social network noise

### ADD (NPC Agency & Attribution)
- `catalyzed_by`: World relationship → NPC (who caused this)
- `protected_by`: Location → NPC (who guards this)
- `betrayed_by`: Faction → NPC (who defected)
- `founded_by`: Faction/Rule → NPC (who created this)
- `discovered_by`: Ability/Location → NPC (who found this)

## System Changes

### New System: NPC Agency

```typescript
const npc_agency_system: SimulationSystem = {
  id: 'npc_agency',
  name: 'NPC Agency & World Events',

  apply: (graph: Graph) => {
    const opportunities = [];

    // 1. Scan for world event opportunities
    // (territorial expansion, magical corruption, tech monopoly, etc.)

    // 2. For each opportunity, find eligible NPC agents
    const agents = findEligibleAgents(opportunity);

    // 3. Select agent probabilistically (prominence-weighted)
    const agent = selectAgent(agents);

    // 4. Agent performs action
    const outcome = agent.performAction(opportunity.actionType);

    // 5. Create world relationships with attribution
    outcome.relationships.forEach(rel => {
      rel.catalyzedBy = agent.id;
      graph.relationships.push(rel);
    });

    // 6. Update agent's influence and prominence
    agent.agency.influence += outcome.influenceGain;
    agent.agency.catalystFor.push(outcome.attribution);

    // 7. Create rich history event
    graph.history.push({
      description: `${agent.name} ${outcome.action}`,
      protagonists: [agent.id],
      ...outcome.historicalDetails
    });

    return outcome;
  }
};
```

### Modified System: Conflict Contagion

Instead of just spreading enemy_of, check if high-prominence NPCs can escalate to faction-level:

```typescript
// Before: NPC A enemy_of NPC B → spreads via allies

// After: NPC A enemy_of NPC B
// → Check: Both prominent? Different factions?
// → If yes: Escalate to faction rival_of
// → Attribution: Both NPCs catalyzed this faction conflict
```

## Expected Outcome

### Entity Distribution
```
NPCs: ~25 (20%)
  - All named, all quest-relevant
  - Each created as part of a world event
  - Each has agency and domain

World entities: ~100 (80%)
  - Factions, locations, abilities, rules
  - Primary focus of generation
```

### Relationship Distribution
```
World-level: ~800 (80%)
  - Faction ↔ Location, Faction ↔ Ability, etc.
  - Each has NPC attribution (catalyzedBy)

NPC structural: ~200 (20%)
  - member_of, leader_of, resident_of, practitioner_of
  - Connects NPCs to world entities
  - Determines NPC agency domains
```

### Narrative Quality

**Before**:
```
"The Midnight Claws expanded into Nightfall Shelf"
```

**After**:
```
"Cutthroat Dave, the ruthless leader of The Midnight Claws,
seized control of Nightfall Shelf in a bloody coup,
establishing criminal rule over the shadowed colony"
```

Every world event has:
- ✓ Named protagonist (Cutthroat Dave)
- ✓ Motivation (ruthless power grab)
- ✓ Action (seized control)
- ✓ Consequence (criminal rule established)
- ✓ Game relevance (Dave is the crime boss players interact with)

## Implementation Notes

### Phase 1: NPC Attribution (Quick)
1. Add `catalyzedBy` field to relationships
2. Modify world templates to find/create NPC agents
3. Update history events to include NPC names

### Phase 2: NPC Agency System (Post-Refactor)
1. Add agency properties to NPC type
2. Implement NPC action system
3. Create archetypal NPC creation
4. Implement influence/prominence feedback

### Phase 3: Remove NPC Bloat
1. Disable NPC-creating templates (familyExpansion, etc.)
2. Remove NPC-drama relationships (lover_of, etc.)
3. Verify NPC count drops to ~25

## Key Principles

1. **Named Characters, Not Noise**: Every NPC is "Cutthroat Dave", not "outlaw_042"
2. **Catalysts, Not Protagonists**: NPCs drive world events, world events are the story
3. **Attribution Creates Meaning**: "Who did this?" makes history memorable
4. **Agency = Game Utility**: NPCs who affect the world are quest-relevant
5. **Few but Mighty**: 25 legendary NPCs > 100 random NPCs

## Benefits

**Game Design**:
- Every NPC is quest-relevant (they CAUSED something important)
- Named bosses: "Defeat Cutthroat Dave to liberate Nightfall Shelf"
- Named allies: "Help Sage Bungus redeem his failure"
- Named villains: "Stop Master Frostweaver's ice magic monopoly"

**Narrative Depth**:
- World events have human faces
- Tragedies have victims: "Sage Bungus failed..."
- Triumphs have heroes: "Cutthroat Dave seized..."
- Wars have origins: "Bill and Bob's feud escalated..."

**Emergent Stories**:
- NPC prominence affects what they can do
- Failures reduce influence, successes increase it
- NPCs build legacies through their catalyzed events
- Player interactions affect NPC-driven future events

**Technical Simplicity**:
- Still only ~25 NPCs (down from 96)
- Still 80% world-level relationships
- But: NPCs give every world event narrative weight
- Attribution is just metadata, not architectural complexity
