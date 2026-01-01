# ADR 001: Hybrid Template + Simulation Model

**Status**: Accepted
**Date**: 2025-11-24
**Deciders**: Core team

## Context

We need a system that generates rich, interconnected world histories suitable for game initialization. The world should feel "lived-in" with dense populations (~150-200 entities) and many interconnections (~300-500 relationships).

### Alternatives Considered

1. **Pure LLM Generation**: Use LLMs to generate all entities and relationships
   - ❌ Produces disconnected entities
   - ❌ No guarantee of structural coherence
   - ❌ Expensive and slow
   - ✅ Rich descriptions

2. **Pure Simulation**: Simulate every birth, death, and event over centuries (Dwarf Fortress style)
   - ❌ Extremely complex to implement
   - ❌ Slow performance
   - ❌ Requires detailed behavioral models for every entity type
   - ✅ Excellent coherence and causality

3. **Pure Template-Based**: Use templates to generate batches of entities
   - ✅ Fast population generation
   - ❌ Entities are pre-connected but lack emergent relationships
   - ❌ World feels "assembled" rather than "lived-in"
   - ✅ Predictable and controllable

4. **Hybrid Template + Simulation** (CHOSEN)
   - ✅ Templates provide rapid population (density)
   - ✅ Simulation creates emergent relationships (interconnection)
   - ✅ 80% of full simulation depth with 20% of complexity
   - ✅ Fast enough for real-time generation (2-5 seconds)
   - ✅ Maintains causality through eras and pressures

## Decision

We will use a **hybrid approach** that alternates between two phases:

1. **Growth Phase**: Templates create batches of pre-connected entities
2. **Simulation Phase**: Systems form relationships between existing entities and modify states

### Key Principles

- **Templates are entity factories** that create clusters, not isolated nodes
- **Systems are relationship generators** that operate on graph patterns
- **Eras provide temporal context** and modify template/system behavior
- **Pressures accumulate based on graph state** and enable certain templates

## Implementation

```typescript
for each epoch:
  1. Select era based on progression
  2. GROWTH PHASE:
     - Select 5-15 templates weighted by era
     - Apply templates to create entity batches (2-5 entities each)
  3. SIMULATION PHASE:
     - Run 10 simulation ticks
     - Each tick applies all systems with era modifiers
  4. Update pressures based on new world state
```

## Consequences

### Positive

- **Fast generation**: 2-5 seconds for 150+ entities
- **Controllable**: Era weights and pressure thresholds provide design control
- **Extensible**: New templates/systems can be added without changing engine
- **Balanced**: Achieves both density and interconnection
- **Maintainable**: Simple mental model (factories + emergent dynamics)

### Negative

- **Not historically accurate**: Events happen in discrete phases rather than continuous time
- **Template coverage burden**: Need templates for all entity kinds and subtypes
- **System design complexity**: Systems must be carefully designed to avoid runaway effects
- **Two-phase rhythm**: Some relationships can only form during simulation, not growth

### Mitigations

- **Era progression** provides narrative structure even without true timelines
- **Pressure system** ensures templates trigger based on world state
- **System modifiers** prevent runaway effects
- **Relationship decay** removes stale connections over time

## Trade-offs Accepted

1. **Speed vs Historical Accuracy**: We chose speed. Games need fast initialization.
2. **Simplicity vs Behavioral Realism**: We chose simplicity. Agents require complex decision logic.
3. **Control vs Emergence**: We balanced both. Templates provide control, systems provide emergence.

## Related Decisions

- ADR 002: Pressure-Based Template Triggering
- ADR 003: Era-Based Progression System
- ADR 004: Relationship Culling Strategy

## References

- ARCHITECTURE.md: "Core Design Philosophy" section
- worldEngine.ts: Main loop implementation
- Dwarf Fortress world generation (inspiration)
- Procedural generation in Caves of Qud (similar approach)
