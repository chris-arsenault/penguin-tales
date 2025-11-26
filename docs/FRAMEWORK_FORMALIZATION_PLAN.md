# Framework Formalization Plan

## Overview

This document outlines the architecture for formalizing all framework constructs to enable:
1. **Provable Consistency**: Validate that the framework achieves its intended emergent properties
2. **Traceable Operators**: Know definitively what creates each entity kind and how to tune frequency
3. **Enforceable Contracts**: Make mistakes impossible through type system and runtime validation
4. **Emergence Documentation**: Explicit model of how components interact to create narrative depth

## Core Problems Being Solved

### Current Issues
1. **Fragile Lineage**: Templates can forget to add lineage relationships (no enforcement)
2. **Template Proliferation**: Too many creation templates for one entity kind (e.g., NPCs)
3. **Opaque Systems**: No formal definition of what systems do (tag spreading? relationship creation? anything?)
4. **Purposeless Pressures**: Pressures scale to 100 but have no defined purpose or equilibrium model
5. **Unvalidated Interactions**: No model of how components interact to produce narrative depth and statistical distributions

### Design Constraints
- Preserve narrative units (multi-entity templates must remain intact)
- Don't make the system more cumbersome to use
- Focus on framework-level enforcement, not developer discipline
- Backward compatibility is NOT required (fresh branch)

## Component Formalization

### 1. Component Purpose Taxonomy

All framework components declare their **purpose** using an enum:

```typescript
enum ComponentPurpose {
  // Creation purposes
  ENTITY_CREATION = 'Creates entities based on prerequisites',
  RELATIONSHIP_CREATION = 'Creates relationships based on graph patterns',

  // Modification purposes
  TAG_PROPAGATION = 'Spreads tags through relationship networks',
  STATE_MODIFICATION = 'Changes entity states based on context',
  PROMINENCE_EVOLUTION = 'Adjusts entity prominence over time',

  // Signal purposes
  PRESSURE_ACCUMULATION = 'Measures graph state to produce pressure signal',

  // Control purposes
  CONSTRAINT_ENFORCEMENT = 'Enforces population/density limits',
  PHASE_TRANSITION = 'Changes era based on conditions',
  BEHAVIORAL_MODIFIER = 'Modifies template weights or system frequencies'
}
```

### 2. Bidirectional Interaction Contracts

Components declare both **inputs** (what enables them) and **outputs** (what they affect):

```typescript
interface ComponentContract {
  purpose: ComponentPurpose;

  // INPUT CONTRACT: What enables this component
  enabledBy?: {
    pressures?: Array<{ name: string; threshold: number }>;
    entityCounts?: Array<{ kind: string; min: number; max?: number }>;
    era?: string[];
    custom?: (graphView: TemplateGraphView) => boolean;
  };

  // OUTPUT CONTRACT: What this component affects
  affects: {
    entities?: Array<{
      kind: string;
      operation: 'create' | 'modify' | 'delete';
      count?: { min: number; max: number };
    }>;
    relationships?: Array<{
      kind: string;
      operation: 'create' | 'delete';
      count?: { min: number; max: number };
    }>;
    pressures?: Array<{
      name: string;
      delta?: number;
      formula?: string;
    }>;
    tags?: Array<{
      operation: 'add' | 'remove' | 'propagate';
      pattern: string;
    }>;
  };
}
```

### 3. Pressure Equilibrium Model

Pressures explicitly declare their **sources** (what increases them), **sinks** (what decreases them), and **equilibrium**:

```typescript
interface PressureContract extends ComponentContract {
  purpose: ComponentPurpose.PRESSURE_ACCUMULATION;

  // What creates this pressure
  sources: Array<{
    component: string;  // e.g., 'template.faction_splinter'
    delta?: number;     // Fixed amount
    formula?: string;   // Dynamic calculation
  }>;

  // What reduces this pressure
  sinks: Array<{
    component: string;  // e.g., 'system.peace_treaty'
    delta?: number;     // Fixed amount
    formula?: string;   // Dynamic calculation (e.g., 'value * 0.05')
  }>;

  // What this pressure enables
  affects: Array<{
    component: string;
    effect: 'enabler' | 'amplifier' | 'suppressor';
    threshold?: number;
    factor?: number;
  }>;

  // Expected equilibrium behavior
  equilibrium: {
    expectedRange: [number, number];  // [min, max] under normal operation
    restingPoint: number;             // Where pressure settles with no stimuli
    oscillationPeriod?: number;       // Ticks for one cycle (if oscillating)
  };
}
```

### 4. Entity Operator Registry

Each entity kind declares its **operators** (functions that act on it):

```typescript
interface EntityOperatorRegistry {
  kind: string;  // e.g., 'npc', 'faction', 'abilities'

  // Templates that create this entity
  creators: Array<{
    templateId: string;
    primary: boolean;        // Is this a primary creator or incidental?
    targetCount?: number;    // Expected entities created per activation
  }>;

  // Systems that modify this entity
  modifiers: Array<{
    systemId: string;
    operation: 'state_change' | 'tag_modification' | 'prominence_change';
  }>;

  // Lineage function (called after any creator)
  lineage: {
    relationshipKind: string;  // e.g., 'derived_from', 'related_to'
    findAncestor: (graphView: TemplateGraphView, newEntity: HardState) => HardState | undefined;
    distanceRange: { min: number; max: number };
  };

  // Expected distribution
  expectedDistribution: {
    targetCount: number;
    prominenceDistribution: Record<Prominence, number>;  // e.g., { marginal: 0.6, recognized: 0.3, renowned: 0.1 }
  };
}
```

## Framework Validation

### Validation Rules

The framework validates itself at **startup** to ensure consistency:

#### 1. Coverage Validation
```typescript
validateCoverage() {
  // Every entity kind has at least one creator
  for (const entityKind of ALL_ENTITY_KINDS) {
    const creators = findTemplates({ affects: { entities: { kind: entityKind, operation: 'create' }}});
    if (creators.length === 0) {
      throw new Error(`No creator for entity kind: ${entityKind}`);
    }
  }

  // Every pressure has at least one source and one sink
  for (const pressure of pressures) {
    if (pressure.sources.length === 0) {
      throw new Error(`Pressure ${pressure.name} has no sources`);
    }
    if (pressure.sinks.length === 0) {
      throw new Error(`Pressure ${pressure.name} has no sinks - will saturate!`);
    }
  }
}
```

#### 2. Equilibrium Validation
```typescript
validateEquilibrium() {
  for (const pressure of pressures) {
    // Calculate maximum inflow
    const maxInflow = sumSources(pressure.sources);

    // Calculate decay outflow
    const decayOutflow = (value) => value * pressure.decay;

    // Calculate fixed sinks
    const fixedOutflow = sumFixedSinks(pressure.sinks);

    // Predicted equilibrium: maxInflow = decayOutflow + fixedOutflow
    // value * decay = maxInflow - fixedOutflow
    const predictedEquilibrium = (maxInflow - fixedOutflow) / pressure.decay;

    // Verify it's within expected range
    if (predictedEquilibrium < pressure.equilibrium.expectedRange[0] ||
        predictedEquilibrium > pressure.equilibrium.expectedRange[1]) {
      console.warn(`Equilibrium mismatch for ${pressure.name}: predicted=${predictedEquilibrium}, expected=${pressure.equilibrium.expectedRange}`);
    }
  }
}
```

#### 3. Achievability Validation
```typescript
validateAchievability() {
  // For each entity kind, verify target count is achievable
  for (const registry of entityRegistries) {
    const creators = registry.creators.filter(c => c.primary);
    const totalCapacity = creators.reduce((sum, c) => sum + (c.targetCount || 1), 0);

    if (totalCapacity < registry.expectedDistribution.targetCount * 0.8) {
      console.warn(`Entity kind ${registry.kind} may not reach target count ${registry.expectedDistribution.targetCount} with current creators`);
    }
  }
}
```

#### 4. Contract Consistency
```typescript
validateContracts() {
  // Verify all component references exist
  for (const pressure of pressures) {
    for (const source of pressure.sources) {
      if (!componentExists(source.component)) {
        throw new Error(`Pressure ${pressure.name} references non-existent source: ${source.component}`);
      }
    }

    for (const affected of pressure.affects) {
      if (!componentExists(affected.component)) {
        throw new Error(`Pressure ${pressure.name} references non-existent affected component: ${affected.component}`);
      }
    }
  }
}
```

## Emergence Model Documentation

### How Narrative Depth Emerges

The framework produces narrative depth through **layered interactions**:

1. **Creation Layer**: Templates create entity clusters with pre-connected relationships
2. **Simulation Layer**: Systems spread influence through existing relationships
3. **Pressure Layer**: Accumulated signals enable phase-appropriate templates
4. **Era Layer**: Temporal context modulates all frequencies

**Example Emergence Path**:
```
conflict pressure rises (source: faction_splinter, enemy_of relationships)
  → enables crisis_legislation template (threshold: 40)
    → creates emergency laws linked to existing rules (lineage)
      → prominence_evolution system elevates prominent entities
        → cultural_tension pressure rises (source: conflicting rules)
          → enables ideology_emergence template
            → creates belief systems with initial believers
              → belief_contagion system spreads through social networks
```

### How Statistical Distributions Emerge

The framework achieves target distributions through **feedback loops**:

1. **Pressure Equilibrium**: Sources and sinks balance at resting point
2. **Template Saturation**: Templates self-disable when targets are met
3. **Prominence Evolution**: Systems elevate entities based on connectivity
4. **Era Progression**: Phase transitions reset template weights

**Example Distribution Path**:
```
targetCount: 30 NPCs
creators: [family_expansion, hero_emergence, succession, outlaw_recruitment]

Initial: 4 NPCs from seed
→ family_expansion creates 2-3 NPCs/activation (high weight in expansion era)
→ hero_emergence creates 1 NPC/activation (moderate weight, conflict-gated)
→ succession creates 1 NPC/activation (low weight, replaces dead NPCs)

After 20 ticks: 25 NPCs
→ constraint_enforcement reduces template weights
→ Only replacement creators active

Final: 30 NPCs with prominence distribution:
  marginal: 60% (background characters)
  recognized: 30% (faction members)
  renowned: 10% (heroes, leaders)
```

## Implementation Phases

### Phase 1: Type System Foundation
- Add `ComponentPurpose` enum to `src/types/engine.ts`
- Add `ComponentContract` interface to `src/types/engine.ts`
- Add `PressureContract` interface extending `ComponentContract`
- Add `EntityOperatorRegistry` interface

### Phase 2: Component Contract Migration
- Update `GrowthTemplate` to include `contract: ComponentContract`
- Update `SimulationSystem` to include `contract: ComponentContract`
- Update `Pressure` to include `contract: PressureContract`
- Update `Era` to reference contracts

### Phase 3: Entity Registry Creation
- Create `src/config/entityRegistries.ts`
- Define registries for all entity kinds: npc, faction, location, abilities, rules
- Include lineage functions for each entity kind

### Phase 4: Validation Layer
- Create `src/engine/frameworkValidator.ts`
- Implement coverage validation
- Implement equilibrium validation
- Implement achievability validation
- Implement contract consistency validation

### Phase 5: Existing Component Updates
- Update all templates in `src/domain/penguin/templates/` with contracts
- Update all systems in `src/systems/simulationSystems.ts` with contracts
- Update all pressures in `src/config/pressures.ts` with contracts

### Phase 6: Engine Integration
- Update `worldEngine.ts` to run validation at startup
- Add lineage enforcement (call lineage function after entity creation)
- Add contract-based logging (show what enabled each template/system)

### Phase 7: Documentation
- Update `CLAUDE.md` with formalized framework model
- Add examples of contracts for common patterns
- Document emergence paths

## Success Criteria

The refactor is successful when:
1. Framework validator runs at startup with zero errors
2. All pressures reach expected equilibrium ranges during generation
3. All entity kinds reach target counts within 10%
4. Lineage relationships are created for 100% of applicable entities
5. No templates/systems violate their declared contracts

## Migration Strategy

Since backward compatibility is not required:
1. Create new type definitions in parallel
2. Update one component category at a time (templates → systems → pressures)
3. Delete old interfaces once migration is complete
4. Run full generation test after each phase
