# Lore Weave

> Procedural world history generation for games and fiction.

A framework for generating rich, interconnected knowledge graphs through a hybrid template-simulation approach. Start with a minimal seed (~14 entities) and produce a dense, narratively coherent world (~150-200 entities, ~300-500 relationships).

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-purple.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

## Quick Start

```typescript
import { WorldEngine, normalizeInitialState } from '@lore-weave/core';

const engine = new WorldEngine({
  eras: penguinEras,
  templates: allTemplates,
  systems: allSystems,
  domain: penguinSchema,
  initialState: normalizeInitialState(seedData),
  targetEntitiesPerKind: 30,
  maxTicks: 500,
});

const result = await engine.run();
```

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Templates** | Entity factories that create clusters of related entities during growth phases |
| **Systems** | Simulation logic that creates relationships between existing entities |
| **Eras** | Historical periods with distinct template weights and system modifiers |
| **Pressures** | Background forces that accumulate and trigger narrative events |
| **Contracts** | Declarations of what templates/systems produce for validation |

## Architecture

The engine alternates between two phases:

```
GROWTH PHASE:    Templates create entity clusters
SIMULATION PHASE: Systems form relationships between entities
```

Each tick: select era → apply weighted templates → run systems → update pressures → check stop conditions.

## Project Structure

The framework uses **concern-specific organization**:

| Folder | Concern |
|--------|---------|
| `core/` | Foundational types (HardState, Relationship, EntityTags) |
| `engine/` | World generation engine and configuration |
| `graph/` | Graph operations, queries, and mutations |
| `selection/` | Entity and template selection algorithms |
| `systems/` | Framework simulation systems |
| `coordinates/` | Spatial coordinate system and regions |
| `statistics/` | Metrics and distribution tracking |
| `llm/` | LLM integration (optional) |
| `domainInterface/` | Domain schema contract |
| `utils/` | Concern-agnostic utilities (last resort) |

**Organization principle:** Always place code in its concern-specific folder. Only use `utils/` for pure utilities with no specific concern (e.g., `shuffle`, `pickRandom`).

## Creating a Domain

Domains provide world-specific content via the `DomainSchema` interface:

```typescript
export const mySchema: DomainSchema = {
  entityKinds: {
    npc: { subtypes: ['hero', 'merchant'], statuses: ['alive', 'dead'] },
    location: { subtypes: ['city', 'wilderness'], statuses: ['active', 'ruins'] },
    faction: { subtypes: ['guild', 'kingdom'], statuses: ['active', 'disbanded'] },
  },
  relationshipKinds: {
    member_of: { category: 'social', strength: 0.5 },
    allied_with: { category: 'political', strength: 0.7 },
  },
  generateName: (type, context) => { /* ... */ },
};
```

## Templates

Templates implement `GrowthTemplate` with `canApply`, `findTargets`, and `expand` methods:

```typescript
export const heroEmergence: GrowthTemplate = {
  id: 'hero_emergence',
  name: 'A Hero Rises',
  contract: { /* declares what this template produces */ },
  canApply: (view) => view.getEntityCount('location', 'colony') > 0,
  findTargets: (view) => view.findEntities({ kind: 'location' }),
  expand: (view, target) => ({
    entities: [{ kind: 'npc', subtype: 'hero', name: 'New Hero', ... }],
    relationships: [{ kind: 'resident_of', src: 'will-be-assigned-0', dst: target.id }],
  }),
};
```

## Systems

Systems implement `SimulationSystem` with an `apply` method:

```typescript
export const allianceFormation: SimulationSystem = {
  id: 'alliance_formation',
  name: 'Alliance Formation',
  contract: { /* declares what this system produces */ },
  apply: (graph, modifier) => ({
    relationshipsCreated: [{ kind: 'allied_with', src: faction1.id, dst: faction2.id }],
    entitiesModified: [],
    pressureChanges: {},
  }),
};
```

## Framework Systems

Include these domain-agnostic systems in your configuration:

```typescript
import {
  relationshipCulling,  // Prunes excess relationships
  eraSpawner,           // Creates era entities
  eraTransition,        // Handles era progression
  universalCatalyst,    // Entity-driven actions
} from '@lore-weave/core';
```

## Development

```bash
npm install            # Install dependencies
npm run build          # Compile TypeScript
npm test               # Run test suite
```

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) - free for non-commercial use.

---

<p align="center">
  <sub>Copyright © 2025 tsonu</sub>
</p>
