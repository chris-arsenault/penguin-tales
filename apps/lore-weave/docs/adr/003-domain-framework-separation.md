# ADR 003: Domain/Framework Separation

**Status**: Accepted
**Date**: 2025-11-24
**Deciders**: Core team

## Context

The world generation engine should be **domain-agnostic** and reusable for different settings (penguin colonies, space stations, medieval kingdoms, etc.). Domain-specific content should be easily swappable without modifying the engine.

### Problem Statement

Without separation:
- Engine hardcoded to penguin domain
- Cannot reuse for other projects (Glass Frontier, etc.)
- Templates, systems, eras mixed with engine code
- Name generation, schema, lore tightly coupled

### Alternatives Considered

1. **Monolithic Design** (Everything together)
   - ✅ Simple to start
   - ❌ Not reusable
   - ❌ Hard to maintain
   - ❌ Cannot support multiple domains

2. **Plugin Architecture** (Domains as plugins)
   - ✅ Very flexible
   - ❌ Complex plugin system needed
   - ❌ Versioning and compatibility issues
   - ❌ Over-engineered for current needs

3. **Domain/Framework Separation** (CHOSEN)
   - ✅ Clear boundary
   - ✅ Reusable framework
   - ✅ Simple dependency injection
   - ✅ Easy to add new domains
   - ❌ Requires discipline to maintain boundary

4. **Inheritance-Based** (Domain extends framework classes)
   - ✅ Object-oriented
   - ❌ Tight coupling
   - ❌ Inflexible
   - ❌ Hard to compose behaviors

## Decision

We will strictly separate **framework** (domain-agnostic) from **domain** (setting-specific) code.

### Directory Structure

```
src/
├── engine/          # Framework: orchestration, contracts
├── systems/         # Framework: core relationship systems
├── services/        # Framework: selection, tracking, enrichment
├── types/           # Framework: core type definitions
├── utils/           # Framework: graph operations, helpers
├── config/          # Framework: registries, feedback loops
└── domain/          # Domain-specific content
    └── penguin/     # Penguin colony domain
        ├── config/
        │   ├── eras.ts          # Penguin-specific eras
        │   ├── pressures.ts     # Penguin-specific pressures
        │   └── loreProvider.ts  # Penguin lore
        ├── templates/           # Penguin templates
        │   ├── npc/
        │   ├── faction/
        │   ├── location/
        │   ├── abilities/
        │   └── rules/
        ├── systems/             # Penguin-specific systems
        │   ├── thermalCascade.ts
        │   └── ...
        └── schema.ts            # Penguin entity/relationship schema
```

### Dependency Rules

1. **Framework NEVER imports from domain**
   - ❌ `import { penguinDomain } from '../domain/penguin'`
   - ✅ Inject via `EngineConfig`

2. **Domain can import from framework**
   - ✅ `import { GrowthTemplate } from '../../types/engine'`
   - ✅ Domain implements framework interfaces

3. **Configuration wires domain to framework**
   ```typescript
   // main.ts
   const config: EngineConfig = {
     domain: penguinDomain,      // Inject domain
     eras: penguinEras,
     templates: penguinTemplates,
     systems: penguinSystems,
     pressures: penguinPressures
   };
   ```

## Implementation

### Framework Interfaces

```typescript
// Framework defines contracts
export interface DomainSchema {
  kinds: string[];
  subtypes: Record<string, string[]>;
  relationships: Record<string, Record<string, string[]>>;
  nameGenerator: NameGenerator;
}

export interface NameGenerator {
  generate(type?: string): string;
}

export interface GrowthTemplate {
  id: string;
  canApply(graph: Graph): boolean;
  expand(graph: Graph, target?: HardState): TemplateResult;
}
```

### Domain Implementation

```typescript
// Domain implements contracts
export const penguinDomain: DomainSchema = {
  kinds: ['npc', 'location', 'faction', 'abilities', 'rules'],
  subtypes: {
    npc: ['merchant', 'hero', 'outlaw', ...],
    location: ['colony', 'resource', 'anomaly', ...],
    ...
  },
  relationships: { /* matrix */ },
  nameGenerator: new PenguinNameGenerator()
};

// Domain templates
export const familyExpansion: GrowthTemplate = {
  id: 'family_expansion',
  canApply: (graph) => { /* domain logic */ },
  expand: (graph, target) => { /* domain logic */ }
};
```

### Engine Uses Injected Domain

```typescript
// worldEngine.ts
export class WorldEngine {
  constructor(config: EngineConfig) {
    this.domain = config.domain;  // Injected!
    this.templates = config.templates;
    this.systems = config.systems;
  }

  generateName(type: string): string {
    return this.domain.nameGenerator.generate(type);  // Use injected generator
  }
}
```

## Consequences

### Positive

- **Reusable framework**: Can generate Glass Frontier worlds by swapping domain
- **Clear boundaries**: Easy to see what's framework vs domain
- **Testable**: Framework tests use mock domains
- **Maintainable**: Domain changes don't affect framework
- **Extensible**: Add new domains without changing engine

### Negative

- **Boilerplate**: Need interfaces for all extension points
- **Discipline required**: Easy to violate boundary accidentally
- **Indirection**: Domain accessed via config, not direct import
- **Documentation burden**: Must explain separation to contributors

### Mitigations

- **Linting rules**: Check for domain imports in framework
- **CI validation**: Test that framework compiles without domain
- **Examples**: Provide template for new domains
- **Code review**: Enforce boundary in PRs

## Examples

### Framework Helper (Generic)

```typescript
// utils/helpers.ts (FRAMEWORK)
export function findEntities(
  graph: Graph,
  criteria: Partial<HardState>
): HardState[] {
  // Domain-agnostic entity finding
  return Array.from(graph.entities.values())
    .filter(e => matches(e, criteria));
}
```

### Domain Template (Penguin-Specific)

```typescript
// domain/penguin/templates/npc/familyExpansion.ts (DOMAIN)
import { GrowthTemplate } from '../../../../types/engine';  // Framework import OK
import { generateName } from '../../../../utils/helpers';    // Framework import OK

export const familyExpansion: GrowthTemplate = {
  id: 'family_expansion',
  expand: (graph, target) => {
    return {
      entities: [{
        kind: 'npc',
        subtype: 'child',           // Penguin-specific
        name: generateName('npc'),   // Uses framework helper
        description: 'A young penguin',  // Penguin-specific
        ...
      }],
      ...
    };
  }
};
```

### Creating a New Domain

```typescript
// domain/glassfront/schema.ts
export const glassFrontDomain: DomainSchema = {
  kinds: ['character', 'station', 'corporation', 'tech', 'laws'],
  subtypes: {
    character: ['miner', 'engineer', 'pilot', ...],
    station: ['colony', 'waypoint', 'blacksite', ...],
    ...
  },
  nameGenerator: new SciFiNameGenerator()
};

// main.ts
const config = {
  domain: glassFrontDomain,  // Swap domain!
  templates: glassFrontTemplates,
  systems: glassFrontSystems,
  ...
};
```

## Related Decisions

- ADR 001: Hybrid Model (templates and systems inject domain logic)
- ADR 005: Contract Enforcement (contracts are domain-agnostic)

## References

- src/domain/penguin/: Penguin domain implementation
- src/types/domainSchema.ts: Domain interface definition
- Clean Architecture (Robert C. Martin): Dependency inversion principle
- Hexagonal Architecture: Ports and adapters pattern
