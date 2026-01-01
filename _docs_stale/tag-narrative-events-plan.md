# Tag Narrative Events Implementation Plan

## Overview
Generate narrative events when tags are added or removed during simulation (not entity creation).

## Requirements
1. Generate events for tag added/removed (not updated)
2. Skip events for tags set during entity creation
3. Lower weight for system tags, higher for narrative category tags
4. Factor in rarity from tag registry

## Implementation Phases

### Phase 1: Type Definitions
- [x] Add `tag_gained` and `tag_lost` to `NarrativeEventKind` in world-schema
- [x] Add `PendingTagChange` interface to stateChangeTracker

### Phase 2: State Change Tracker
- [x] Add `pendingTagChanges` map to track tag changes
- [x] Add `recordTagChange()` method
- [x] Add `generateTagChangeEvents()` method
- [x] Integrate into `flush()` to emit tag events
- [x] Clear pending tag changes at tick start

### Phase 3: Significance Calculator
- [x] Add `calculateTagSignificance()` function
- [x] Category weights: status > behavior > trait > theme > location
- [x] Rarity multipliers: rare 1.5x, uncommon 1.2x, common 1.0x
- [x] Entity prominence multipliers (reuse existing)
- [x] High-value tag bonuses for combat/corruption tags

### Phase 4: Narrative Event Builder
- [x] Add `buildTagGainedEvent()` method
- [x] Add `buildTagLostEvent()` method
- [x] Implement headline generation with special cases
- [x] Include tag metadata in narrativeTags

### Phase 5: Engine Integration
- [x] Modify worldEngine to detect tag changes from mutations
- [x] Call `recordTagChange()` for added/removed tags
- [x] Pass catalyst (system/action) information

### Phase 6: Tag Registry Integration
- [x] Pass tag registry to stateChangeTracker for metadata lookup
- [x] Use category/rarity for significance scoring

## Implementation Status: COMPLETE

## Significance Calculation Formula

```
base = categoryWeights[category]  // 0.2 - 0.4
base *= rarityModifier            // 1.0 - 1.5
base *= prominenceModifier        // 0.5 - 1.5
if (highValueTag) base += 0.2
return min(1.0, base)
```

### Category Weights
- status: 0.4
- behavior: 0.35
- trait: 0.3
- affiliation: 0.3
- theme: 0.25
- location: 0.2

### Rarity Modifiers
- rare: 1.5
- uncommon: 1.2
- common: 1.0

### High-Value Tags
wounded, maimed, corrupted, legendary, hostile, leader, war_leader, armed_raider, crisis

## Files to Modify

1. `packages/world-schema/src/narrative.ts` - Add event kinds
2. `apps/lore-weave/lib/narrative/stateChangeTracker.ts` - Track tag changes
3. `apps/lore-weave/lib/narrative/significanceCalculator.ts` - Tag significance
4. `apps/lore-weave/lib/narrative/narrativeEventBuilder.ts` - Build tag events
5. `apps/lore-weave/lib/engine/worldEngine.ts` - Hook tag mutations
