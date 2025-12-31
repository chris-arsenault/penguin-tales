# Lineage System Design

## Overview

The lineage system tracks **why** changes happen during simulation, not just **what** changed.
This enables intelligent event generation that avoids duplicate/redundant narrative events.

## The Problem It Solves

Before lineage, event generation worked by diffing world state at tick start vs tick end:
- "New relationship detected" → emit relationship_formed
- "New tag detected" → emit tag_gained
- "Entity created" → emit creation_batch

This caused duplicate events because multiple detectors saw the same changes:
- Template creates hero with 5 relationships → creation_batch event
- Relationship detector sees 5 new relationships → 5 relationship_formed events
- Tag detector sees new tags → tag_gained events
- **Result: 8 events for one logical action (hero emergence)**

With lineage, we know that all those changes came from the same source (the template),
so we emit ONE event that captures the full story.

## Core Concept: ExecutionContext

Every mutation happens within an ExecutionContext:

```typescript
interface ExecutionContext {
  tick: number;
  source: 'template' | 'system' | 'action' | 'pressure' | 'seed' | 'framework';
  sourceId: string;  // e.g., "hero_emergence", "conflict_escalation"
}
```

## Hybrid Storage Strategy

The system uses two complementary approaches:

### 1. Persistent Lineage (Entities & Relationships)

Entities and relationships store their lineage in the world state via `createdBy`:

```typescript
interface WorldEntity {
  // ... existing fields ...
  createdBy?: ExecutionContext;
}

interface WorldRelationship {
  // ... existing fields ...
  createdBy?: ExecutionContext;
}
```

**Why persistent?**
- Useful for debugging ("why does this relationship exist?")
- Survives serialization/deserialization
- Enables queries like "show all entities created by template X"

### 2. Transient Lineage (Tags & Field Changes)

Tag changes and field mutations are tracked via MutationTracker during tick execution:

```typescript
interface TrackedMutation {
  type: 'tag_added' | 'tag_removed' | 'field_changed';
  tick: number;
  context: ExecutionContext;
  entityId: string;
  data: { tag?: string; field?: string; oldValue?: any; newValue?: any };
}
```

**Why transient?**
- Tags/fields change frequently; storing full history would bloat state
- Only needed for event generation within the same tick
- Cleared at tick end after events are generated

## Unified Event Generation

Despite hybrid storage, event generation sees a unified view:

```typescript
// StateChangeTracker.flush()

// 1. Collect ALL mutations with lineage
const mutations = this.collectMutationsWithLineage();
//    - Entity creations: from graph, read entity.createdBy
//    - Relationship creations: from graph, read relationship.createdBy
//    - Tag/field changes: from MutationTracker

// 2. Group by execution context
const byContext = groupBy(mutations, m => contextKey(m.context));

// 3. Generate events per context
for (const [key, contextMutations] of byContext) {
  if (contextMutations[0].context.source === 'template') {
    // Single rich event for template execution
    this.emitTemplateEvent(contextMutations);
  } else {
    // System/action events - may still group related changes
    this.emitSystemEvents(contextMutations);
  }
}
```

## Design Principles

1. **Single Source of Truth for Context**
   - WorldEngine manages the current ExecutionContext
   - All mutation paths read from this single source
   - No passing context through 10 layers of function calls

2. **Fail-Safe Default**
   - If context is missing, mutations still work (backward compatible)
   - Events will be generated with source='unknown'
   - Prefer noisy events over lost data

3. **Lineage is Metadata, Not Logic**
   - Lineage doesn't change WHAT happens, only HOW it's reported
   - Simulation logic remains unchanged
   - Only event generation uses lineage

4. **Unified Mental Model**
   - External code sees one lineage system
   - Internal hybrid implementation is an optimization detail
   - API surface treats all mutations uniformly

## File Locations

- `packages/world-schema/src/world.ts` - ExecutionContext type, createdBy on entities/relationships
- `apps/lore-weave/lib/narrative/mutationTracker.ts` - Transient tag/field tracking
- `apps/lore-weave/lib/narrative/stateChangeTracker.ts` - Unified event generation
- `apps/lore-weave/lib/engine/worldEngine.ts` - Context management

## Future Considerations

- **Nested contexts**: Actions triggered by systems could have parent context
- **Context inheritance**: Child entities could inherit parent's creation context
- **Lineage queries**: "Show causal chain for this entity's current state"
