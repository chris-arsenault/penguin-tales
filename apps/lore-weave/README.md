# Lore Weave

> Procedural world history generation for games and fiction.

A framework for generating rich, interconnected knowledge graphs through a hybrid template-simulation approach. Start with a minimal seed (~14 entities) and produce a dense, narratively coherent world (~150-200 entities, ~300-500 relationships) suitable for game initialization.

[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-purple.svg)](https://polyformproject.org/licenses/noncommercial/1.0.0/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)

## Features

- **Hybrid Generation Model** - Templates create entity clusters, simulation systems form relationships between them
- **Era-Based Progression** - World evolves through configurable historical eras with distinct characteristics
- **Pressure System** - Background forces accumulate and trigger narrative events
- **Domain-Agnostic Core** - Framework provides the engine; domains define the content
- **Intelligent Target Selection** - Anti-super-hub algorithms ensure realistic relationship distribution
- **Contract Enforcement** - Templates and systems declare their effects for validation
- **Optional LLM Enrichment** - Integrate narrative generation via Claude API

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Public API](#public-api)
- [Creating a Domain](#creating-a-domain)
- [Templates](#templates)
- [Systems](#systems)
- [Configuration](#configuration)
- [Framework Systems](#framework-systems)
- [Development](#development)
- [License](#license)

## Installation

```bash
# Clone the repository
git clone https://github.com/your-org/lore-weave.git
cd lore-weave

# Install dependencies
npm install

# Build the framework
npm run build
```

### Requirements

- Node.js 18+
- npm 9+

## Quick Start

Here's a minimal example using the penguin-tales domain:

```typescript
import { WorldEngine, normalizeInitialState } from '@lore-weave/core';
import { penguinSchema } from './schema';
import { penguinEras } from './config/eras';
import { allTemplates } from './templates';
import { allSystems } from './systems';
import initialStateData from './data/initialState.json';

// Normalize initial state (adds IDs and timestamps)
const initialState = normalizeInitialState(initialStateData.hardState);

// Configure the engine
const engine = new WorldEngine({
  eras: penguinEras,
  templates: allTemplates,
  systems: allSystems,
  domain: penguinSchema,
  initialState,
  targetEntitiesPerKind: 30,
  maxTicks: 500,
});

// Run the simulation
const result = await engine.run();

console.log(`Generated ${result.entities.size} entities`);
console.log(`Created ${result.relationships.length} relationships`);
```

## Public API

Lore Weave exports a minimal, focused API. Internal services and utilities are not exposed.

### Core Engine

```typescript
import { WorldEngine } from '@lore-weave/core';

const engine = new WorldEngine(config);
const result = await engine.run();
```

### Types

Core types for building domains:

```typescript
import type {
  // Entity and relationship types
  HardState,
  Relationship,
  Prominence,
  EntityKind,

  // Engine types
  Graph,
  Era,
  Pressure,
  GrowthTemplate,
  SimulationSystem,
  EngineConfig,
  HistoryEvent,
  SystemResult,
  TemplateResult,

  // Domain schema types
  DomainSchema,
  EntityKindDefinition,
  RelationshipKindDefinition,
  EmergentDiscoveryConfig,

  // Distribution types
  DistributionTargets,
} from '@lore-weave/core';

import { ComponentPurpose } from '@lore-weave/core';
```

### Services

Services available to templates and systems:

```typescript
import {
  TemplateGraphView,  // Restricted graph access for templates
  TargetSelector,     // Hub-aware entity selection
  EnrichmentService,  // LLM narrative generation (optional)
  ImageGenerationService, // Image generation (optional)
} from '@lore-weave/core';
```

### Utility Functions

Helper functions for templates and systems:

```typescript
import {
  // Entity helpers
  generateId,
  generateName,
  setNameGenerator,
  findEntities,
  getRelated,
  getLocation,
  getFactionMembers,

  // Random selection
  pickRandom,
  pickMultiple,

  // Relationship helpers
  hasRelationship,
  areRelationshipsCompatible,
  archiveRelationship,
  addRelationshipWithDistance,
  modifyRelationshipStrength,

  // State normalization
  normalizeInitialState,
  slugifyName,

  // Validation
  validateWorld,
  applyParameterOverrides,
} from '@lore-weave/core';
```

### Clustering and Archival

For meta-entity formation and entity lifecycle:

```typescript
import {
  // Clustering
  detectClusters,
  filterClusterableEntities,
  calculateSimilarity,
  findBestClusterMatch,

  // Entity archival
  archiveEntity,
  archiveEntities,
  transferRelationships,
  createPartOfRelationships,
  supersedeEntity,
  isHistoricalEntity,
} from '@lore-weave/core';
```

### Emergent Discovery

For location discovery templates:

```typescript
import {
  analyzeResourceDeficit,
  analyzeConflictPatterns,
  analyzeMagicPresence,
  generateResourceTheme,
  generateStrategicTheme,
  generateMysticalTheme,
  shouldDiscoverLocation,
  findNearbyLocations,
} from '@lore-weave/core';
```

### Template Building

Utilities for cleaner template code:

```typescript
import {
  EntityClusterBuilder,
  buildRelationships,
  extractParams,
} from '@lore-weave/core';

// EntityClusterBuilder example
const cluster = new EntityClusterBuilder()
  .addEntity({ kind: 'faction', name: 'Traders Guild', ... })
  .addEntity({ kind: 'npc', name: 'Guild Master', ... })
  .relate(1, 0, 'leader_of')
  .relateToExisting(0, existingColony.id, 'controls');

// buildRelationships example
const relationships = buildRelationships()
  .add('member_of', npc.id, faction.id)
  .addBidirectional('allied_with', faction1.id, faction2.id)
  .build();
```

## Creating a Domain

A domain provides the world-specific content. Implement the `DomainSchema` interface:

```typescript
import type { DomainSchema } from '@lore-weave/core';

export const myDomainSchema: DomainSchema = {
  // Entity kinds in your world
  entityKinds: {
    npc: { subtypes: ['hero', 'merchant', 'villain'], statuses: ['alive', 'dead'] },
    location: { subtypes: ['city', 'dungeon', 'wilderness'], statuses: ['active', 'ruins'] },
    faction: { subtypes: ['guild', 'kingdom', 'cult'], statuses: ['active', 'disbanded'] },
  },

  // Relationship kinds
  relationshipKinds: {
    member_of: { category: 'social', strength: 0.5 },
    allied_with: { category: 'political', strength: 0.7 },
    enemy_of: { category: 'conflict', strength: 0.8 },
  },

  // Name generator
  generateName: (type, context) => {
    // Return procedurally generated name
  },

  // Validation rules
  validateEntity: (entity) => {
    // Return validation result
  },
};
```

## Templates

Templates are entity factories that create clusters of related entities:

```typescript
import type { GrowthTemplate, TemplateResult } from '@lore-weave/core';
import { TemplateGraphView } from '@lore-weave/core';
import { ComponentPurpose } from '@lore-weave/core';

export const heroEmergence: GrowthTemplate = {
  id: 'hero_emergence',
  name: 'A Hero Rises',

  // Contract declares what this template does
  contract: {
    purpose: ComponentPurpose.ENTITY_CREATION,
    enabledBy: {
      pressures: [{ name: 'conflict', threshold: 30 }],
      entityCounts: [{ kind: 'location', subtype: 'colony', min: 1 }],
    },
    affects: {
      entities: [{ kind: 'npc', subtype: 'hero', operation: 'create', count: { min: 1, max: 1 } }],
      relationships: [{ kind: 'resident_of', category: 'social' }],
    },
  },

  // Check if template can run
  canApply: (graphView: TemplateGraphView): boolean => {
    return graphView.getEntityCount('location', 'colony') > 0;
  },

  // Find potential targets
  findTargets: (graphView: TemplateGraphView) => {
    return graphView.findEntities({ kind: 'location', subtype: 'colony' });
  },

  // Create entities and relationships
  expand: (graphView: TemplateGraphView, target): TemplateResult => {
    const hero = {
      kind: 'npc',
      subtype: 'hero',
      name: generateName('hero'),
      description: `A brave hero from ${target.name}`,
      status: 'alive',
      prominence: 'marginal',
      tags: ['brave', 'emergent'],
    };

    return {
      entities: [hero],
      relationships: [
        { kind: 'resident_of', src: 'will-be-assigned-0', dst: target.id },
      ],
      description: `${hero.name} emerges as a hero in ${target.name}`,
    };
  },
};
```

## Systems

Systems create relationships between existing entities:

```typescript
import type { SimulationSystem, SystemResult, Graph } from '@lore-weave/core';
import { findEntities, hasRelationship, ComponentPurpose } from '@lore-weave/core';

export const allianceFormation: SimulationSystem = {
  id: 'alliance_formation',
  name: 'Alliance Formation',

  contract: {
    purpose: ComponentPurpose.RELATIONSHIP_CREATION,
    enabledBy: {
      pressures: [{ name: 'external_threat', threshold: 20 }],
    },
    affects: {
      relationships: [{ kind: 'allied_with', category: 'political' }],
    },
  },

  apply: (graph: Graph, modifier: number): SystemResult => {
    const factions = findEntities(graph, { kind: 'faction', status: 'active' });
    const newRelationships = [];

    for (const faction of factions) {
      // Find potential allies based on shared enemies
      const potentialAllies = factions.filter(other =>
        other.id !== faction.id &&
        !hasRelationship(graph, faction.id, other.id, 'allied_with')
      );

      if (potentialAllies.length > 0 && Math.random() < 0.1 * modifier) {
        const ally = pickRandom(potentialAllies);
        newRelationships.push({
          kind: 'allied_with',
          src: faction.id,
          dst: ally.id,
        });
      }
    }

    return {
      relationshipsCreated: newRelationships,
      entitiesModified: [],
      pressureChanges: {},
      description: `${newRelationships.length} alliances formed`,
    };
  },
};
```

## Configuration

Configure the engine for your domain:

```typescript
const config: EngineConfig = {
  // Eras define historical periods
  eras: [
    {
      id: 'expansion',
      name: 'The Age of Expansion',
      templateWeights: { colony_founding: 2.0, hero_emergence: 1.5 },
      systemModifiers: { alliance_formation: 0.5 },
    },
    {
      id: 'conflict',
      name: 'The War Years',
      templateWeights: { colony_founding: 0.5, hero_emergence: 2.0 },
      systemModifiers: { alliance_formation: 2.0 },
    },
  ],

  // Your domain's templates
  templates: allTemplates,

  // Your domain's systems + framework systems
  systems: [
    ...domainSystems,
    relationshipCulling,
    eraSpawner,
    eraTransition,
    universalCatalyst,
  ],

  // Domain schema
  domain: myDomainSchema,

  // Initial seed entities
  initialState: normalizeInitialState(seedData),

  // Generation parameters
  targetEntitiesPerKind: 30,
  maxTicks: 500,
  simulationTicksPerGrowth: 15,

  // Optional: distribution targets
  distributionTargets: {
    entityKinds: { npc: 0.3, location: 0.25, faction: 0.2 },
    prominence: { mythic: 0.1, renowned: 0.2, recognized: 0.3 },
  },

  // Optional: LLM enrichment
  enrichmentService: new EnrichmentService(llmConfig, loreProvider),
};
```

## Framework Systems

Lore Weave provides domain-agnostic systems you can include:

```typescript
import {
  relationshipCulling,  // Removes excess relationships
  eraSpawner,           // Creates era entities
  eraTransition,        // Handles era progression
  occurrenceCreation,   // Creates historical events
  universalCatalyst,    // Entity-driven actions
} from '@lore-weave/core';
```

## Development

```bash
npm run build        # Compile TypeScript
npm run clean        # Remove build artifacts
npm test             # Run test suite
```

## Architecture

The engine follows a hybrid generation model:

```
Main Loop:
  while (shouldContinue):
    1. Select era based on current epoch
    2. GROWTH PHASE:
       - Select templates weighted by era
       - Apply templates to create entity clusters
       - Auto-initialize catalysts for new entities
    3. SIMULATION PHASE:
       - Run simulation ticks
       - Apply systems with era modifiers
       - Systems create relationships and modify states
    4. Update pressures based on world state
    5. Check stop conditions
```

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) - free for non-commercial use.

---

<p align="center">
  <sub>Copyright © 2025 tsonu</sub>
</p>
