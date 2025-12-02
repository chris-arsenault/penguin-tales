# ADR 002: Pressure-Based Template Triggering

**Status**: Accepted
**Date**: 2025-11-24
**Deciders**: Core team
**Related**: ADR 001 (Hybrid Model)

## Context

Templates need triggering conditions beyond simple "era weights." We want templates to activate based on world state, creating causality and preventing nonsensical scenarios (e.g., faction splintering when no factions exist).

### Problem Statement

Without state-based triggering:
- Templates fire randomly regardless of world readiness
- No causality between world state and template selection
- Designer must manually predict all prerequisites
- World generation lacks responsiveness to emergent conditions

### Alternatives Considered

1. **Manual Prerequisites** (Entity count checks only)
   - ✅ Simple to implement
   - ❌ Static and brittle
   - ❌ No response to world dynamics
   - ❌ Can't express complex conditions

2. **LLM-Based Selection** (Ask LLM which template to apply)
   - ✅ Highly flexible
   - ❌ Slow and expensive
   - ❌ Non-deterministic
   - ❌ Hard to debug

3. **Pressure System** (CHOSEN)
   - ✅ Responds to world state dynamically
   - ✅ Provides clear causality
   - ✅ Designers control formulas
   - ✅ Deterministic and fast
   - ❌ Requires pressure formula design

4. **Event Queue** (Scheduled events)
   - ✅ Precise control of timing
   - ❌ Requires scripting all events
   - ❌ Not responsive to emergent conditions
   - ❌ Breaks procedural generation philosophy

## Decision

We will use a **pressure system** where:

1. **Pressures** are numeric values (0-100) representing world conditions
2. **Growth formulas** calculate pressure changes based on graph state
3. **Decay** naturally reduces pressures each tick
4. **Templates reference pressures** in their contracts

### Pressure Types

- `resource_scarcity`: Ratio of NPCs to resource locations
- `conflict`: Count of hostile relationships
- `magical_instability`: Anomalies and magic use
- `cultural_tension`: Isolated colonies and splinter factions
- `stability`: Peace treaties and alliances
- `external_threat`: Invasions and orca incursions

## Implementation

```typescript
// Pressure definition
interface Pressure {
  id: string;
  value: number;  // 0-100
  growth: (graph: Graph) => number;  // Calculate delta
  decay: number;  // Natural decay per tick
}

// Template contract
contract: {
  enabledBy: {
    pressures: [
      { name: 'conflict', threshold: 30 }  // Only when conflict >= 30
    ]
  }
}

// Each tick
pressures.forEach(pressure => {
  const delta = pressure.growth(graph) - pressure.decay;
  pressure.value = clamp(pressure.value + delta, 0, 100);
});
```

### Growth Formula Example

```typescript
resource_scarcity: {
  growth: (graph) => {
    const npcCount = countEntities(graph, { kind: 'npc' });
    const resourceCount = countEntities(graph, { kind: 'location', subtype: 'resource' });
    const ratio = npcCount / Math.max(resourceCount, 1);

    if (ratio > 5) return 10;  // Critical scarcity
    if (ratio > 3) return 5;   // Moderate scarcity
    return -5;                  // Abundant resources
  },
  decay: 2  // Natural improvement
}
```

## Consequences

### Positive

- **Emergent causality**: Templates trigger based on world dynamics
- **Design control**: Formulas are explicit and tunable
- **Fast**: Simple numeric calculations
- **Debuggable**: Pressure values visible in output
- **Extensible**: New pressures don't affect existing code

### Negative

- **Formula design burden**: Each pressure needs careful balancing
- **Indirect control**: Can't force specific templates to fire
- **Tuning complexity**: Pressure thresholds interact with era weights
- **Not event-based**: Can't schedule "war starts in era 3"

### Mitigations

- **Default formulas** provided for common patterns
- **Pressure tracking** in output for debugging
- **Era progression** provides temporal structure
- **Manual overrides** possible via config

## Examples

### Conflict Contagion

```typescript
// Conflict pressure rises when wars exist
conflict: {
  growth: (graph) => {
    const wars = graph.relationships.filter(r => r.kind === 'at_war_with');
    return wars.length * 3;  // Each war adds 3 points/tick
  },
  decay: 5  // Peace naturally emerges
}

// Template requires high conflict
factionSplinter: {
  contract: {
    enabledBy: {
      pressures: [{ name: 'conflict', threshold: 40 }]
    }
  }
}
```

### Resource Scarcity → Colony Founding

```typescript
resource_scarcity: {
  growth: (graph) => {
    // Formula calculates scarcity
  },
  decay: 2
}

colonyFounding: {
  contract: {
    enabledBy: {
      pressures: [{ name: 'resource_scarcity', threshold: 30 }]
    }
  }
}
```

## Related Decisions

- ADR 001: Hybrid Model (pressures enable templates)
- ADR 003: Era-Based Progression (eras modify pressure effects)
- ADR 005: Contract Enforcement System (contracts specify pressure requirements)

## References

- src/config/pressures.ts: Pressure definitions
- src/engine/worldEngine.ts: Pressure update logic
- Oxygen Not Included: Similar "need" system
