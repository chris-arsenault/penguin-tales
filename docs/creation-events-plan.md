# Creation Events Implementation Plan

## Overview
Generate a single narrative event per template execution that aggregates all entities and relationships created.

## Requirements
1. One event per template execution (not per entity)
2. Entity-centric headlines, reuse descriptions from creation items
3. Include relationship details (kinds, not just counts)
4. No minimum threshold - every creation tracked for full entity lifecycle

## Implementation Phases

### Phase 1: Type Definitions
- [x] Add `creation_batch` to `NarrativeEventKind` in world-schema

### Phase 2: State Change Tracker
- [x] Add `PendingCreationBatch` interface
- [x] Add `pendingCreationBatches` array
- [x] Add `recordCreationBatch()` method
- [x] Add `generateCreationBatchEvents()` method
- [x] Integrate into `flush()`
- [x] Clear at tick start

### Phase 3: Significance Calculator
- [x] Add `calculateCreationBatchSignificance()` function
- [x] Base score: 0.3
- [x] Entity count bonus: +0.05 per entity (cap +0.2)
- [x] Relationship count bonus: +0.02 per relationship (cap +0.1)
- [x] Primary entity prominence multiplier

### Phase 4: Event Builder
- [x] Add `buildCreationBatchEvent()` method
- [x] Entity-centric headline generation
- [x] Include relationship breakdown by kind
- [x] Reuse creation item descriptions

### Phase 5: Engine Integration
- [x] Hook into growthSystem after template execution
- [x] Call recordCreationBatch with template info and created entities
- [x] Pass relationship details
- [x] Added stateChangeTracker to GrowthSystemDependencies

## Event Structure

```typescript
{
  eventKind: 'creation_batch',
  significance: 0.45,
  subject: { id: 'frostheim', name: 'Frostheim', kind: 'location', subtype: 'colony' },
  action: 'created',
  participants: [
    { id: 'erik', name: 'Erik', kind: 'npc', subtype: 'settler' },
    ...
  ],
  headline: 'Frostheim founded with 4 settlers',
  description: 'A hardy band of settlers establishes a new colony on the frozen frontier.',
  stateChanges: [],
  causedBy: { entityId: 'colony_foundation', actionType: 'Colony Foundation' },
  narrativeTags: ['creation', 'colony', 'location', 'npc'],
  // Extended data for creation events
  relationshipsSummary: [
    { kind: 'settler_of', count: 4 },
    { kind: 'governed_by', count: 1 }
  ]
}
```

## Files to Modify

1. `packages/world-schema/src/world.ts` - Add event kind
2. `apps/lore-weave/lib/narrative/stateChangeTracker.ts` - Creation batch tracking
3. `apps/lore-weave/lib/narrative/narrativeEventBuilder.ts` - Builder method
4. `apps/lore-weave/lib/narrative/significanceCalculator.ts` - Significance calc
5. `apps/lore-weave/lib/engine/worldEngine.ts` - Hook in growth phase

## Implementation Status: COMPLETE
