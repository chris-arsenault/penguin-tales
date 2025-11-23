# Atlas-Focused Enrichment Proposal

## Problem Statement

Current enrichment system is **NPC-centric**:
- Triggers on NPC faction membership changes
- Triggers on NPC location changes
- Triggers on NPC becoming leaders
- NPCs are the lens through which we view the world

**For a world atlas**, we need to flip this: the world (locations, factions, cultures, magic) should be the focus, with NPCs as supporting context.

## Current Trigger Logic

```typescript
// worldEngine.ts - Current implementation
const currentKeyRels = new Set(
  entity.links
    .filter(l => l.kind === 'member_of' || l.kind === 'resident_of' || l.kind === 'leader_of')
    .map(l => `${l.kind}:${l.dst}`)
);
```

**Issues**:
1. Only tracks outbound relationships from entities (NPCs gaining membership)
2. Doesn't track world state changes (locations gaining residents, factions gaining power)
3. Misses cultural/magical events (rules enacted, abilities spreading)

## Proposed: World-Centric Enrichment

### Priority Tiers

**Tier 1: Atlas Essentials** (always enrich)
- **Locations**: Population changes, control changes, prominence changes, notable events
- **Factions**: Power shifts, territory changes, alliance/war declarations, status changes

**Tier 2: Cultural Context** (enrich if prominent or impactful)
- **Rules**: Enactment, repeal, becoming cultural touchstones
- **Abilities**: Spreading to new locations, gaining practitioners, prominence changes

**Tier 3: Notable Figures** (enrich only if world-significant)
- **NPCs**: Only mythic/renowned NPCs doing world-changing things (becoming leaders, founding factions, discovering abilities)

### Enrichment Triggers by Entity Kind

#### Locations (Highest Priority)

**Always Enrich When**:
```typescript
{
  // Population changes (track as dst of resident_of)
  residentCountChange: threshold > 3,  // Gained/lost 3+ residents

  // Control/ownership changes (track as dst of stronghold_of, controls)
  controlChange: true,  // Any faction taking/losing control

  // Prominence changes
  prominenceChange: true,  // Becoming landmark vs fading into obscurity

  // Status changes
  statusChange: true,  // Thriving → waning → abandoned

  // Notable events
  anomalyManifestation: true,  // manifests_at added
  newAdjacency: true  // Connected to new location (trade route, etc.)
}
```

**Example Triggers**:
- "North Haven gained 15 new residents as refugees flee the war"
- "The Midnight Claws seized control of Nightfall Shelf"
- "The Glow-Fissure became a mythic location"
- "South Perch was abandoned due to resource depletion"

#### Factions (High Priority)

**Always Enrich When**:
```typescript
{
  // Membership changes (track as dst of member_of)
  prominentMemberJoined: true,  // Renowned/mythic NPC joined
  leadershipChange: true,  // New leader (track as dst of leader_of)

  // Territory changes (track as src of stronghold_of, controls)
  territoryGained: true,  // Captured location
  territoryLost: true,  // Lost location

  // Diplomatic changes (track as src of allied_with, at_war_with)
  allianceFormed: true,
  warDeclared: true,

  // Status changes
  statusChange: true,  // Active → waning → disbanded

  // Prominence changes
  prominenceChange: true
}
```

**Example Triggers**:
- "The Icebound Exchange allied with the Covenant of the Ice"
- "The Midnight Claws declared war on The Icebound Exchange"
- "The Midnight Claws captured North Haven"
- "Fissure-Walker Draen (mythic hero) joined the Covenant of the Ice"

#### Rules (Medium Priority)

**Enrich When Prominent OR Impactful**:
```typescript
{
  // Status changes
  statusChange: true,  // Proposed → enacted → repealed → forgotten

  // Prominence changes
  prominenceChange: prominence >= 'recognized',  // Only if notable

  // Enforcement changes (track as dst of weaponized_by, kept_secret_by)
  factionEnforcement: true,  // Faction starts enforcing/hiding rule

  // Cultural adoption (track via tags/references)
  widespreadAdoption: references >= 5  // Many entities reference it
}
```

**Example Triggers**:
- "The Fortress Doctrine was enacted in Aurora Stack"
- "The taboo against magic was repealed after the Glow-Fissure incident"
- "The Icebound Exchange began weaponizing Fissure-Drawn Runes"

#### Abilities (Medium Priority)

**Enrich When Spreading OR Prominent**:
```typescript
{
  // Practitioner changes (track as dst of practitioner_of)
  practitionerCountChange: threshold > 3,  // Gained 3+ practitioners

  // Location spread (track as dst of manifests_at)
  newManifestation: true,  // Appears at new location

  // Prominence changes
  prominenceChange: prominence >= 'recognized',  // Only if notable

  // Mastery (track as dst of mastered_by)
  newMaster: prominence >= 'renowned'  // Only if master is famous
}
```

**Example Triggers**:
- "Fissure-Drawn Runes spread to West Roost (5 new practitioners)"
- "Glacier-Tech became a mythic ability"
- "Fissure-Walker Draen mastered the Glow-Fissure magic"

#### NPCs (Lowest Priority)

**Only Enrich If World-Significant**:
```typescript
{
  // Only track mythic/renowned NPCs
  prominenceThreshold: prominence >= 'renowned',

  // And only for world-changing events
  becameLeader: true,  // leader_of added
  foundedFaction: true,  // Founded new faction
  discoveredAbility: true,  // First practitioner of new ability
  discoveredLocation: true,  // discovered_by relationship

  // Otherwise, NPCs are just context for other entities
}
```

**Example Triggers**:
- "Fissure-Walker Draen became leader of the Covenant of the Ice"
- "Captain Aurorawing founded The Sky Guard faction"
- "Mystic Tidefisher discovered Fissure-Drawn Runes"

## Implementation Strategy

### 1. Track Inbound Relationships

Currently we only track outbound:
```typescript
// Current: Only tracks entity's outbound relationships
entity.links.filter(l => l.kind === 'member_of')
```

Need to track inbound too:
```typescript
// Proposed: Track both directions
const outbound = entity.links;  // What this entity is connected to
const inbound = graph.relationships.filter(r => r.dst === entity.id);  // What's connected to this entity
```

### 2. Entity-Specific Trigger Logic

Replace single `detectChanges()` with kind-specific functions:

```typescript
function detectLocationChanges(location: HardState, snapshot: Snapshot): string[] {
  const changes: string[] = [];

  // Population changes
  const currentResidents = graph.relationships.filter(r =>
    r.kind === 'resident_of' && r.dst === location.id
  );
  const residentDelta = currentResidents.length - snapshot.residentCount;
  if (Math.abs(residentDelta) >= 3) {
    changes.push(`population: ${residentDelta > 0 ? '+' : ''}${residentDelta} residents`);
  }

  // Control changes
  const currentController = graph.relationships.find(r =>
    r.kind === 'stronghold_of' && r.dst === location.id
  );
  if (currentController?.src !== snapshot.controllerId) {
    const controller = graph.entities.get(currentController?.src);
    changes.push(`control: now controlled by ${controller?.name || 'none'}`);
  }

  // Prominence/status changes
  if (location.prominence !== snapshot.prominence) {
    changes.push(`prominence: ${snapshot.prominence} → ${location.prominence}`);
  }
  if (location.status !== snapshot.status) {
    changes.push(`status: ${snapshot.status} → ${location.status}`);
  }

  return changes;
}

function detectFactionChanges(faction: HardState, snapshot: Snapshot): string[] {
  const changes: string[] = [];

  // Leadership changes
  const currentLeader = graph.relationships.find(r =>
    r.kind === 'leader_of' && r.dst === faction.id
  );
  if (currentLeader?.src !== snapshot.leaderId) {
    const leader = graph.entities.get(currentLeader?.src);
    changes.push(`leadership: ${leader?.name || 'none'} took power`);
  }

  // Territory changes
  const currentTerritories = graph.relationships.filter(r =>
    (r.kind === 'stronghold_of' || r.kind === 'controls') && r.src === faction.id
  );
  const territoryDelta = currentTerritories.length - snapshot.territoryCount;
  if (territoryDelta > 0) {
    changes.push(`territory: gained ${territoryDelta} locations`);
  } else if (territoryDelta < 0) {
    changes.push(`territory: lost ${Math.abs(territoryDelta)} locations`);
  }

  // Alliance/war changes
  const currentAllies = graph.relationships.filter(r =>
    r.kind === 'allied_with' && r.src === faction.id
  );
  const newAllies = currentAllies.filter(a =>
    !snapshot.allyIds.has(a.dst)
  );
  newAllies.forEach(ally => {
    const allyFaction = graph.entities.get(ally.dst);
    changes.push(`alliance: allied with ${allyFaction?.name}`);
  });

  // Wars
  const currentEnemies = graph.relationships.filter(r =>
    r.kind === 'at_war_with' && r.src === faction.id
  );
  const newEnemies = currentEnemies.filter(e =>
    !snapshot.enemyIds.has(e.dst)
  );
  newEnemies.forEach(enemy => {
    const enemyFaction = graph.entities.get(enemy.dst);
    changes.push(`war: declared war on ${enemyFaction?.name}`);
  });

  // Status/prominence changes
  if (faction.status !== snapshot.status) {
    changes.push(`status: ${snapshot.status} → ${faction.status}`);
  }
  if (faction.prominence !== snapshot.prominence) {
    changes.push(`prominence: ${snapshot.prominence} → ${faction.prominence}`);
  }

  return changes;
}

function detectRuleChanges(rule: HardState, snapshot: Snapshot): string[] {
  const changes: string[] = [];

  // Only enrich if rule is prominent
  if (rule.prominence < 'recognized') return changes;

  // Status changes
  if (rule.status !== snapshot.status) {
    changes.push(`status: ${snapshot.status} → ${rule.status}`);
  }

  // Enforcement by factions
  const enforcingFactions = graph.relationships.filter(r =>
    (r.kind === 'weaponized_by' || r.kind === 'kept_secret_by') && r.dst === rule.id
  );
  const newEnforcers = enforcingFactions.filter(f =>
    !snapshot.enforcerIds.has(f.src)
  );
  newEnforcers.forEach(enforcer => {
    const faction = graph.entities.get(enforcer.src);
    changes.push(`enforcement: ${faction?.name} began enforcing this`);
  });

  return changes;
}

function detectAbilityChanges(ability: HardState, snapshot: Snapshot): string[] {
  const changes: string[] = [];

  // Practitioner count changes
  const currentPractitioners = graph.relationships.filter(r =>
    r.kind === 'practitioner_of' && r.dst === ability.id
  );
  const practitionerDelta = currentPractitioners.length - snapshot.practitionerCount;
  if (Math.abs(practitionerDelta) >= 3) {
    changes.push(`practitioners: ${practitionerDelta > 0 ? '+' : ''}${practitionerDelta}`);
  }

  // Spread to new locations
  const manifestLocations = graph.relationships.filter(r =>
    r.kind === 'manifests_at' && r.src === ability.id
  );
  const newLocations = manifestLocations.filter(l =>
    !snapshot.locationIds.has(l.dst)
  );
  newLocations.forEach(loc => {
    const location = graph.entities.get(loc.dst);
    changes.push(`spread: now manifests at ${location?.name}`);
  });

  // Prominence changes
  if (ability.prominence !== snapshot.prominence && ability.prominence >= 'recognized') {
    changes.push(`prominence: ${snapshot.prominence} → ${ability.prominence}`);
  }

  return changes;
}

function detectNPCChanges(npc: HardState, snapshot: Snapshot): string[] {
  const changes: string[] = [];

  // Only track renowned/mythic NPCs
  if (npc.prominence < 'renowned') return changes;

  // World-changing events only
  const currentLeaderOf = npc.links.filter(l => l.kind === 'leader_of');
  const newLeaderships = currentLeaderOf.filter(l =>
    !snapshot.leadershipIds.has(l.dst)
  );
  newLeaderships.forEach(leadership => {
    const faction = graph.entities.get(leadership.dst);
    changes.push(`leadership: became leader of ${faction?.name}`);
  });

  return changes;
}
```

### 3. Snapshot Updates

Expand snapshots to track entity-specific metrics:

```typescript
interface EntitySnapshot {
  // Common
  id: string;
  prominence: Prominence;
  status: string;
  updatedAt: number;

  // Location-specific
  residentCount?: number;
  controllerId?: string;

  // Faction-specific
  leaderId?: string;
  territoryCount?: number;
  allyIds?: Set<string>;
  enemyIds?: Set<string>;

  // Rule-specific
  enforcerIds?: Set<string>;

  // Ability-specific
  practitionerCount?: number;
  locationIds?: Set<string>;

  // NPC-specific
  leadershipIds?: Set<string>;
}
```

## Expected Outcomes

### Before (NPC-Centric)
```
Enrichment triggers:
- Snowcaller joined Covenant of the Ice
- Frostslider moved to Nightfall Shelf
- Glacierbreaker became a merchant
- Auroraswimmer joined The Icebound Exchange
```
**Result**: Character bios, not world atlas content

### After (World-Centric)
```
Enrichment triggers:
- Nightfall Shelf gained 12 new residents (population boom)
- The Midnight Claws seized control of North Haven
- The Icebound Exchange allied with Covenant of the Ice
- The Fortress Doctrine was enacted across Aurora Stack
- Fissure-Drawn Runes spread to 3 new colonies
- Fissure-Walker Draen (mythic hero) became leader of Covenant of the Ice
```
**Result**: World atlas entries describing places, powers, and cultures

## Migration Path

### Phase 1: Add Inbound Tracking
- Extend snapshots to track inbound relationships
- Add entity-kind-specific snapshot fields

### Phase 2: Implement Kind-Specific Detection
- Create `detectLocationChanges()`, `detectFactionChanges()`, etc.
- Replace single `detectChanges()` with dispatcher

### Phase 3: Adjust Enrichment Priorities
- Modify enrichment queue to prioritize locations/factions
- Add prominence/significance filters for rules/abilities/NPCs

### Phase 4: Update Prompts
- Rewrite enrichment prompts to focus on world-building:
  - "Describe this location as an atlas entry"
  - "Describe this faction's role in the political landscape"
  - "Describe this rule's cultural significance"

## Configuration

Add enrichment priority config:

```json
{
  "enrichment": {
    "priorities": {
      "location": 1.0,      // Always enrich
      "faction": 0.9,       // Almost always
      "rules": 0.5,         // If prominent
      "abilities": 0.5,     // If spreading
      "npc": 0.2            // Only if world-significant
    },
    "thresholds": {
      "populationChange": 3,
      "practitionerChange": 3,
      "territoryChange": 1,
      "npcProminence": "renowned"
    }
  }
}
```

## Summary

This proposal transforms enrichment from **character-focused** to **world-focused**:

- ✅ Locations enriched when population/control/status changes
- ✅ Factions enriched when power shifts, wars declared, alliances formed
- ✅ Rules enriched when enacted/repealed/becoming cultural touchstones
- ✅ Abilities enriched when spreading to new locations
- ✅ NPCs enriched only when doing world-changing things

Result: A **world atlas** with rich entries about places, factions, cultures, and magic systems, with notable NPCs as supporting context rather than the main focus.
