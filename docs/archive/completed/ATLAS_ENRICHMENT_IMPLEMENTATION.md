# Atlas-Focused Enrichment Implementation

## Status: ✅ COMPLETE

The enrichment system has been transformed from NPC-centric to world-centric, prioritizing locations and factions as the primary focus for a world atlas.

## Implementation Summary

### 1. EntitySnapshot Interface (worldEngine.ts:27-53)

Extended snapshot tracking with kind-specific metrics:

```typescript
interface EntitySnapshot {
  // Common fields
  tick: number;
  status: string;
  prominence: string;
  keyRelationshipIds: Set<string>;

  // Location-specific
  residentCount?: number;          // Population tracking
  controllerId?: string;            // Who controls this location

  // Faction-specific
  leaderId?: string;                // Current leader
  territoryCount?: number;          // Number of controlled locations
  allyIds?: Set<string>;            // Allied factions
  enemyIds?: Set<string>;           // Enemy factions

  // Rule-specific
  enforcerIds?: Set<string>;        // Factions weaponizing/hiding this rule

  // Ability-specific
  practitionerCount?: number;       // Number of practitioners
  locationIds?: Set<string>;        // Locations where it manifests

  // NPC-specific
  leadershipIds?: Set<string>;      // Factions this NPC leads
}
```

### 2. Kind-Specific Detection Functions (worldEngine.ts:55-279)

Implemented five specialized change detection functions:

#### `detectLocationChanges()` (Tier 1: Always Enrich)
Triggers on:
- Population changes (±3 residents)
- Control changes (faction taking/losing control)
- Prominence changes
- Status changes (thriving → waning → abandoned)

**Example Triggers**:
- "population: +12 residents"
- "control: now controlled by The Midnight Claws"
- "prominence: marginal → recognized"

#### `detectFactionChanges()` (Tier 1: Always Enrich)
Triggers on:
- Leadership changes (new leader takes power)
- Territory changes (gained/lost locations)
- Alliance formation
- War declarations
- Status/prominence changes

**Example Triggers**:
- "leadership: Tide-Splitter Rukan took power"
- "territory: gained 2 locations"
- "alliance: allied with Covenant of the Ice"
- "war: declared war on The Icebound Exchange"

#### `detectRuleChanges()` (Tier 2: If Prominent)
**Prominence Filter**: Only enriches rules with prominence >= 'recognized'

Triggers on:
- Status changes (proposed → enacted → repealed → forgotten)
- Enforcement by factions (weaponized_by, kept_secret_by)
- Prominence changes

**Example Triggers**:
- "status: proposed → enacted"
- "enforcement: The Midnight Claws began enforcing this"

#### `detectAbilityChanges()` (Tier 2: If Spreading)
Triggers on:
- Practitioner count changes (±3 practitioners)
- Spread to new locations (manifests_at)
- Prominence changes (only if prominence >= 'recognized')

**Example Triggers**:
- "practitioners: +5"
- "spread: now manifests at East Haven"

#### `detectNPCChanges()` (Tier 3: Only if World-Significant)
**Prominence Filter**: Only enriches NPCs with prominence >= 'renowned'

Triggers on:
- Leadership changes (became leader of faction)
- Prominence changes

**Example Triggers**:
- "leadership: became leader of Covenant of the Ice"
- "prominence: renowned → mythic"

### 3. Enrichment Analytics Tracking (worldEngine.ts:46-52)

Added analytics counter that tracks enrichment triggers **even when enrichment is disabled**:

```typescript
private enrichmentAnalytics = {
  locationEnrichments: 0,
  factionEnrichments: 0,
  ruleEnrichments: 0,
  abilityEnrichments: 0,
  npcEnrichments: 0
};
```

### 4. Updated Change Detection Logic (worldEngine.ts:1209-1289)

Replaced generic change detection with kind-specific routing:

```typescript
private queueChangeEnrichments(): void {
  this.graph.entities.forEach(entity => {
    const snapshot = this.entitySnapshots.get(entity.id);
    if (!snapshot) return;

    // Use kind-specific detection
    let changes: string[] = [];
    switch (entity.kind) {
      case 'location':
        changes = detectLocationChanges(entity, snapshot, this.graph);
        break;
      case 'faction':
        changes = detectFactionChanges(entity, snapshot, this.graph);
        break;
      // ... etc
    }

    // Track analytics even when enrichment disabled
    if (changes.length > 0) {
      switch (entity.kind) {
        case 'location':
          this.enrichmentAnalytics.locationEnrichments++;
          break;
        // ... etc
      }
    }
  });

  // Only actually enrich if service is enabled
  if (!this.enrichmentService?.isEnabled()) return;
  // ... enrichment logic
}
```

### 5. Enhanced Snapshot Capture (worldEngine.ts:1291-1381)

Updated `snapshotEntity()` to capture kind-specific metrics:

```typescript
private snapshotEntity(entity: HardState): void {
  const snapshot: EntitySnapshot = {
    tick: this.graph.tick,
    status: entity.status,
    prominence: entity.prominence,
    keyRelationshipIds: new Set(/* ... */)
  };

  // Add kind-specific metrics
  switch (entity.kind) {
    case 'location':
      snapshot.residentCount = this.graph.relationships.filter(r =>
        r.kind === 'resident_of' && r.dst === entity.id
      ).length;

      const controller = this.graph.relationships.find(r =>
        (r.kind === 'stronghold_of' || r.kind === 'controls') && r.dst === entity.id
      );
      snapshot.controllerId = controller?.src;
      break;

    case 'faction':
      // Track leader, territory, allies, enemies
      // ...
      break;

    // ... other kinds
  }

  this.entitySnapshots.set(entity.id, snapshot);
}
```

### 6. Output Statistics (worldEngine.ts:444-470, 1558-1581)

Added enrichment analytics to both console output and exported JSON:

**Console Output**:
```
=== Atlas Enrichment Analytics ===
Total enrichment triggers: 49
  Locations: 28
  Factions:  10
  Rules:     0
  Abilities: 1
  NPCs:      10
Note: Enrichment disabled - these are detected triggers only
```

**JSON Export** (metadata.enrichmentTriggers):
```json
{
  "total": 49,
  "byKind": {
    "locationEnrichments": 28,
    "factionEnrichments": 10,
    "ruleEnrichments": 0,
    "abilityEnrichments": 1,
    "npcEnrichments": 10
  },
  "comment": "Counts detected enrichment triggers (tracks even when enrichment disabled)"
}
```

## Test Results

### Sample Run (164 entities, 951 relationships, 9 epochs)

**Enrichment Trigger Distribution**:
- **Locations**: 28 (57.1%) - Highest priority ✅
- **Factions**: 10 (20.4%) - High priority ✅
- **NPCs**: 10 (20.4%) - Only world-significant ✅
- **Abilities**: 1 (2.0%) - Only if spreading ✅
- **Rules**: 0 (0.0%) - None reached prominence threshold ✅

**Total**: 49 enrichment triggers detected

### Analysis

#### Before (NPC-Centric)
Enrichment would trigger on:
- Every NPC joining a faction
- Every NPC moving locations
- Every NPC becoming a merchant/outlaw
- Every friendship/rivalry formation

**Result**: Character bios, not world atlas content

#### After (World-Centric)
Enrichment triggers on:
- **Locations gaining/losing population** (28 triggers)
  - "North Haven gained 12 new residents as refugees flee the war"
  - "The Glow-Fissure became a mythic location"
- **Factions gaining/losing power** (10 triggers)
  - "The Midnight Claws seized control of East Haven"
  - "The Icebound Exchange allied with Covenant of the Ice"
- **World-significant NPCs** (10 triggers)
  - "Fissure-Walker Draen (mythic hero) became leader of Covenant of the Ice"
  - Only renowned/mythic NPCs doing world-changing things
- **Abilities spreading** (1 trigger)
  - "Fissure-Drawn Runes spread to 3 new colonies"
- **Prominent rules** (0 triggers)
  - None reached 'recognized' prominence threshold in this run

**Result**: World atlas entries describing places, powers, and political shifts

## Key Features

### 1. Tiered Priority System ✅
- **Tier 1** (Locations, Factions): Always enriched when significant changes occur
- **Tier 2** (Rules, Abilities): Only enriched if prominent or spreading
- **Tier 3** (NPCs): Only enriched if renowned/mythic and doing world-changing things

### 2. Inbound Relationship Tracking ✅
Detection functions now track both:
- **Outbound**: NPC → Faction (what this entity connects to)
- **Inbound**: Faction ← NPCs (what connects to this entity)

Examples:
- Faction tracks members joining (dst of member_of)
- Location tracks residents arriving (dst of resident_of)
- Ability tracks practitioners adopting (dst of practitioner_of)

### 3. Analytics Mode ✅
Even when enrichment is disabled (`enrichmentService` not provided):
- Change detection still runs
- Analytics counter still increments
- Statistics still output at end
- No LLM calls made (noop after detection)

This allows measuring enrichment impact without cost.

### 4. Prominence Filtering ✅
- **Rules**: Only enrich if prominence >= 'recognized' (2+)
- **Abilities**: Only enrich prominence changes if >= 'recognized' (2+)
- **NPCs**: Only enrich if prominence >= 'renowned' (3+)

This ensures only notable cultural/magical elements and world-significant NPCs are enriched.

### 5. Change Thresholds ✅
Prevents spam from minor fluctuations:
- **Population**: ±3 residents minimum
- **Practitioners**: ±3 practitioners minimum
- **Territory**: Any gain/loss triggers (more significant)

## Breaking Changes

**None - Backward Compatible** ✅

All changes are additive:
- New snapshot fields are optional (use `?:`)
- Existing enrichment service interface unchanged
- Analytics tracking is separate system
- Detection functions are internal implementation details

No data migration required.

## Files Modified

1. **src/engine/worldEngine.ts**
   - Added `EntitySnapshot` interface (27 lines)
   - Added 5 detection functions (224 lines)
   - Updated `enrichmentAnalytics` tracking (7 lines)
   - Updated `queueChangeEnrichments()` (80 lines)
   - Updated `snapshotEntity()` (90 lines)
   - Updated `run()` output (14 lines)
   - Updated `exportState()` metadata (11 lines)

**Total**: ~453 lines added/modified

## Summary

The enrichment system now focuses on **world-building** instead of **character-building**:

- ✅ Locations enriched when population/control/status changes
- ✅ Factions enriched when power shifts, wars declared, alliances formed
- ✅ Rules enriched only when prominent and enacted/repealed
- ✅ Abilities enriched only when spreading to new locations
- ✅ NPCs enriched only when doing world-changing things

Result: A **world atlas** with rich entries about places, factions, cultures, and magic systems, with notable NPCs as supporting context rather than the main focus.

The analytics system provides visibility into enrichment triggers even when enrichment is disabled, allowing for cost-free measurement of enrichment value.
