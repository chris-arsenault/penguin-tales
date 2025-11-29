# CLAUDE.md

**Note**: This project uses [bd (beads)](https://github.com/steveyegge/beads) for issue tracking. Use `bd` commands instead of markdown TODOs or plan files. When working on multi-step tasks, create a bead with `bd create` to track progress rather than writing implementation plans to markdown files. See AGENTS.md for workflow details.

**Bead Guidelines:**
- **Never create analysis-only tickets.** Analysis is not useful on its own - implementation is. If analysis is needed, do it as part of implementing the ticket, not as a separate task.
- When closing a ticket, ensure the work is actually done. If implementation remains, create a new implementation ticket before closing.
- Beads should track actionable work, not research or investigation.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **monorepo** containing framework tools for procedural world generation:

- **Lore Weave** (`apps/lore-weave/`) - Procedural world history generator that creates interconnected knowledge graphs through template-based entity generation and simulation-based relationship formation
- **Name Forge** (`apps/name-forge/`) - Domain-aware procedural name generation system
- **Penguin Tales** (`penguin-tales/`) - Domain-specific content (penguin colony world configuration)

The architecture separates **framework code** (domain-agnostic engines) from **domain code** (world-specific templates, systems, and schemas).

## Repository Structure

```
penguin-tales/                    # Repository root
├── apps/
│   ├── lore-weave/              # World generation framework
│   │   ├── lib/                 # Core library
│   │   │   ├── engine/          # WorldEngine, validators
│   │   │   ├── types/           # HardState, Graph, Era, etc.
│   │   │   ├── services/        # Enrichment, statistics, selectors
│   │   │   ├── systems/         # Framework systems (culling, catalysts)
│   │   │   ├── utils/           # Helpers, validators
│   │   │   └── config/          # Entity registries, feedback loops
│   │   ├── validation/          # Optimizer/genetic algorithm
│   │   └── webui/               # World explorer UI
│   │
│   └── name-forge/              # Name generation framework
│       ├── lib/                 # Core generation library
│       ├── validation/          # Validation and optimization
│       └── webui/               # Name generation UI
│
├── penguin-tales/               # Penguin domain content
│   └── lore/                    # Lore Weave domain config
│       ├── config/              # Eras, pressures, action domains
│       ├── templates/           # Entity templates (npc, faction, etc.)
│       ├── systems/             # Simulation systems
│       ├── data/                # Initial state, lore bible
│       └── main.ts              # Domain runner
│
├── docs/                        # Project documentation
└── infrastructure/              # CI/CD configuration
```

## Development Commands

### Penguin Tales (Lore Weave Domain)

```bash
cd penguin-tales/lore

# Run world generation
npm run dev

# Build
npm run build

# Test
npm test
```

### Name Forge

```bash
cd apps/name-forge

# Run UI (API + frontend)
npm run ui

# Generate names via CLI
npm run cli

# Test
npm test
```

## Core Architecture (Lore Weave)

### The Hybrid Generation Model

The system alternates between two phases:

1. **Growth Phase**: Templates rapidly populate the graph by creating **batches of pre-connected entities**
2. **Simulation Phase**: Systems create **relationships between existing entities** and modify their states

### Framework vs Domain Separation

**Framework** (`apps/lore-weave/lib/`):
- `WorldEngine` - Core generation loop
- Type definitions (`HardState`, `Graph`, `Era`, `Pressure`, etc.)
- Services (enrichment, statistics, selectors)
- Generic systems (relationship culling, catalysts)
- Utilities (helpers, validators)

**Domain** (`penguin-tales/lore/`):
- Era definitions with template weights
- Pressure configurations
- Entity templates (NPC, faction, location, etc.)
- Simulation systems (relationship formation, cultural drift, etc.)
- Domain schema (entity kinds, relationship types)
- Initial state data

### Framework Primitives

The framework defines a minimal set of entity kinds, relationship kinds, and status values in `apps/lore-weave/lib/types/frameworkPrimitives.ts` that **must be implemented** for the framework to function:

**Entity Kinds:**
- `era` - Time periods that structure the simulation
- `occurrence` - Events/happenings during the simulation

**Relationship Kinds:**
- `supersedes` - Era lineage (newer era supersedes older)
- `part_of` - Subsumption into meta-entity
- `active_during` - Temporal association with era

**Status Values:**
- `active` - Entity is currently active
- `historical` - Entity has been archived
- `current` - Era is currently running
- `future` - Era is queued for the future

**Important:** Domains are free to define additional entity kinds, relationship kinds, and status values beyond these framework primitives. For example, the penguin domain defines occurrence statuses like `'brewing'`, `'waning'`, `'legendary'` in addition to the framework's `'active'` and `'historical'`.

### Key Files

| Component | Framework Location | Domain Location |
|-----------|-------------------|-----------------|
| Engine | `apps/lore-weave/lib/engine/worldEngine.ts` | - |
| Types | `apps/lore-weave/lib/types/` | - |
| Templates | - | `penguin-tales/lore/templates/` |
| Systems | `apps/lore-weave/lib/systems/` | `penguin-tales/lore/systems/` |
| Eras | - | `penguin-tales/lore/config/eras.ts` |
| Schema | - | `penguin-tales/lore/schema.ts` |
| Runner | - | `penguin-tales/lore/main.ts` |

## Type System

### Core Entity Structure (`apps/lore-weave/lib/types/worldTypes.ts`)

```typescript
HardState {
  id: string                    // Stable ID in graph
  kind: 'npc' | 'location' | 'faction' | 'rules' | 'abilities'
  subtype: string               // e.g., 'merchant', 'colony', 'criminal'
  name: string
  description: string
  status: string                // Entity-kind specific
  prominence: Prominence        // 'forgotten' | 'marginal' | 'recognized' | 'renowned' | 'mythic'
  tags: string[]                // Maximum 5 elements
  links: Relationship[]         // Cached relationships
  createdAt: number             // Tick of creation
  updatedAt: number             // Last modification tick
}
```

### Engine Configuration

```typescript
const config: EngineConfig = {
  domain: penguinDomain,        // Domain schema
  eras: penguinEras,            // Era configurations
  templates: allTemplates,      // Growth templates
  systems: allSystems,          // Simulation systems
  pressures: pressures,         // Pressure definitions
  metaEntityConfigs: [...],     // Meta-entity formation configs

  epochLength: 20,              // Ticks per epoch
  simulationTicksPerGrowth: 15, // Balance between growth and simulation
  targetEntitiesPerKind: 30,    // Final size (~150 total for 5 kinds)
  maxTicks: 500                 // Maximum simulation ticks
};
```

## Extending the System

### Adding New Templates (Domain)

1. Create template in `penguin-tales/lore/templates/{category}/`
2. Implement `GrowthTemplate` interface (import from `@lore-weave/core`)
3. Export from category's `index.ts`
4. Add template ID to era `templateWeights` in `config/eras.ts`

### Adding New Systems (Domain)

1. Create system in `penguin-tales/lore/systems/`
2. Implement `SimulationSystem` interface
3. Export from `systems/index.ts`
4. Add system ID to era `systemModifiers` in `config/eras.ts`

### Adding Framework Features

Framework changes go in `apps/lore-weave/lib/`:
- New types → `types/`
- New services → `services/`
- New utilities → `utils/`
- Export from `index.ts`

## Refactoring Rules

**CRITICAL: Always complete refactors. Never stop in the middle.**

1. **No "consolidation" modules without actual consolidation**: Do not create new shared modules/functions unless you immediately update ALL callers to use them.

2. **Delete duplicate code, don't add to it**: When fixing bugs in duplicated code, either fix all instances or consolidate to one implementation.

3. **Backwards compatibility is not an excuse**: In this codebase, prefer breaking changes over accumulating cruft.

4. **Complete the refactor in one session**: If you start consolidating code, finish it.

## Framework/Domain Design Principles

**Domain should only import from framework.** The domain should never directly depend on external libraries that the framework wraps. This prevents dependency proliferation and keeps domain code simple.

**When facades are appropriate:**
- **YES**: Facade around external library (e.g., name-forge) - Framework wraps external dependencies so domain only interacts with framework APIs
- **NO**: Facade around deprecated internal code - Don't create compatibility layers; delete old code and update all callers

**Framework should handle complexity:**
- Extract reusable services into framework to prevent implementation errors in domain
- Provide high-level APIs (e.g., `createEntity(settings)` handles naming automatically)
- Domain passes configuration/data, framework handles mechanics

**No fallbacks that hide misconfiguration:**
- Errors should bubble up with clear, actionable messages
- Fail fast, fail loud - don't silently use defaults when config is wrong
- Domain misconfiguration should be obvious immediately, not hidden by framework workarounds

## API Discipline - CRITICAL

**This section exists because Claude repeatedly creates backwards-compatibility shims that cause architectural divergence. These rules are non-negotiable.**

### NEVER Do These Things

**1. NEVER add methods that return internal objects:**
```typescript
// FORBIDDEN - Creates escape hatch
getGraph(): Graph { return this.graph; }
getMapper(): RegionMapper { return this.mapper; }
getInternal*(): any { ... }
```
If code needs functionality, add a specific method to the wrapper class instead.

**2. NEVER add fallback defaults for required config:**
```typescript
// FORBIDDEN - Hides misconfiguration
const culture = config.culture ?? 'default';
const options = settings || {};
const value = context?.value ?? fallbackValue;
```
If config is required, make it required. If it's missing, throw an error.

**3. NEVER leave deprecated code "for compatibility":**
```typescript
// FORBIDDEN - Creates parallel paths
/** @deprecated Use newMethod instead */
oldMethod() { return this.newMethod(); }
```
Delete deprecated code immediately. Fix all callers in the same PR.

**4. NEVER create multiple ways to do the same thing:**
```typescript
// FORBIDDEN - Creates divergent paths
placeEntity()           // Method 1
addEntityInRegion()     // Method 2
deriveCoordinates()     // Method 3
placeWithCulture()      // Method 4
```
Have ONE canonical way. Delete the others.

### ALWAYS Do These Things

**1. ALWAYS throw on missing required config:**
```typescript
// CORRECT
if (!config.culture) {
  throw new Error('culture is required in PlacementConfig');
}
```

**2. ALWAYS delete old APIs when adding new ones:**
```typescript
// CORRECT - In the SAME PR:
// 1. Add new API
// 2. Update ALL callers to use new API
// 3. DELETE old API
// No deprecation period. No compatibility shims.
```

**3. ALWAYS make the type system enforce correct usage:**
```typescript
// CORRECT - Required, not optional
interface PlacementConfig {
  cultureId: string;      // NOT string | undefined
  coordinates: Point;     // NOT Point | undefined
}
```

**4. ALWAYS break domain code when framework changes:**
Domain code should fail to compile or fail at startup when framework APIs change. This is correct behavior - it forces immediate fixes rather than silent divergence.

### Validation

Run `./scripts/check-escape-hatches.sh` before committing. It checks for:
- Methods returning internal objects
- Fallback patterns for config
- @deprecated markers (code should be deleted)
- Legacy API usage in domain code

## Debugging Tips

1. Set small targets first: `targetEntitiesPerKind: 5` in domain's main.ts
2. Enable verbose logging: Add `console.log` in templates/systems
3. Check sample history events and notable entities in output
4. Use `SCALE_FACTOR` environment variable to control world size
