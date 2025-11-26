# Name Forge Integration Plan

## Overview

Replace the current name generation system with synchronous name-forge based generation.

## Design Principles

1. **No backwards compatibility** - Breaking changes are fine
2. **Facade around external library is OK** - Framework wraps name-forge so domain only imports from framework
3. **No fallbacks that hide misconfiguration** - Errors bubble up with clear messages
4. **Framework handles naming automatically** - Templates don't call nameGenerator directly
5. **Domain provides config, framework handles mechanics** - Domain passes name-forge JSON, framework uses it

## Current State (TO BE REMOVED)

1. **Simple NameGenerator interface** - `generate(type: string): string`
2. **Global setter pattern** - `setNameGenerator()` / `generateName()`
3. **LLM batch naming** - Async post-hoc name replacement in enrichmentService

## New Architecture

### Framework: NameForgeService wraps name-forge

The framework wraps name-forge so domain never imports it directly.

```typescript
// lib/services/nameForgeService.ts

import { generateFromProfile, type ExecutionContext, type NamingProfile } from 'name-forge';

export interface NameForgeConfig {
  cultures: Record<string, {
    id: string;
    name: string;
    domains: any[];
    lexemeLists: Record<string, any>;
    grammars: any[];
    profiles: NamingProfile[];
  }>;
}

export class NameForgeService {
  constructor(private config: NameForgeConfig) {
    if (Object.keys(config.cultures).length === 0) {
      throw new Error('NameForgeService: config.cultures is empty');
    }
  }

  generate(kind: string, subtype: string, prominence: string, tags: string[], culture: string): string {
    const cultureConfig = this.config.cultures[culture];
    if (!cultureConfig) {
      throw new Error(
        `NameForgeService: culture '${culture}' not found. ` +
        `Available: ${Object.keys(this.config.cultures).join(', ')}`
      );
    }

    if (cultureConfig.profiles.length === 0) {
      throw new Error(`NameForgeService: culture '${culture}' has no profiles`);
    }

    const execContext: ExecutionContext = {
      domains: cultureConfig.domains,
      profiles: cultureConfig.profiles,
      lexemeLists: Object.values(cultureConfig.lexemeLists),
      grammarRules: cultureConfig.grammars,
      seed: `${Date.now()}-${Math.random()}`,
      entityAttributes: { tags, prominence: prominence as any, subtype },
    };

    // Profile selection based on entity kind handled by name-forge conditions
    const profile = cultureConfig.profiles[0];
    return generateFromProfile(profile, execContext);
  }
}
```

### Framework: Automatic naming in addEntity()

The key change: `addEntity()` automatically generates names. Templates don't call nameGenerator.

```typescript
// lib/utils/helpers.ts

export function addEntity(graph: Graph, entity: Partial<HardState>): string {
  const id = generateId(entity.kind || 'unknown');

  // Framework automatically generates name if not provided
  let name = entity.name;
  if (!name) {
    const nameForge = graph.config.nameForgeService;
    if (!nameForge) {
      throw new Error('addEntity: name not provided and no NameForgeService configured');
    }
    name = nameForge.generate(
      entity.kind || 'npc',
      entity.subtype || 'default',
      entity.prominence || 'marginal',
      entity.tags || [],
      entity.culture || 'world'
    );
  }

  const fullEntity: HardState = {
    id,
    kind: entity.kind || 'npc',
    subtype: entity.subtype || 'default',
    name,
    // ... rest of fields
  };

  graph.entities.set(id, fullEntity);
  return id;
}
```

### Domain: Provides config only

Domain loads name-forge JSON and passes to framework. No name-forge imports in domain.

```typescript
// penguin-tales/lore/main.ts

import { WorldEngine, NameForgeService } from '@lore-weave/core';
import nameForgeConfig from './data/penguins.nameforge.json';

const nameForgeService = new NameForgeService(nameForgeConfig);

const config: EngineConfig = {
  // ...
  nameForgeService,  // Framework uses this for automatic naming
};

const engine = new WorldEngine(config);
```

### Remove Global Pattern

Delete from `helpers.ts`:
- `setNameGenerator()`
- `generateName()`
- `currentNameGenerator` variable
- `defaultNameGenerator`

### Remove LLM Naming

Delete from `enrichmentService.ts`:
- `batchGenerateNames()` method
- All calls to it from `enrichEntities()`
- Keep description enrichment only

## Template Updates

Templates become SIMPLER - they omit name entirely:

```typescript
// Before
const hero: Partial<HardState> = {
  kind: 'npc',
  subtype: 'hero',
  name: generateName('hero'),  // Template calls name generator
  prominence: 'marginal',
  culture: colony.culture,
  tags: ['brave'],
};

// After
const hero: Partial<HardState> = {
  kind: 'npc',
  subtype: 'hero',
  // name omitted - framework generates automatically
  prominence: 'marginal',
  culture: colony.culture,
  tags: ['brave'],
};
```

Templates that need custom naming (rare) can still provide a name explicitly.

## Implementation Steps

### Phase 1: Framework Changes
1. Create `lib/services/nameForgeService.ts` - wrapper around name-forge
2. Add `NameGenerationContext` interface to `domainSchema.ts` (for type reference)
3. Update `EngineConfig` to include optional `nameForgeService`
4. Update `addEntity()` in `helpers.ts` to auto-generate names via nameForgeService
5. Remove `setNameGenerator`, `generateName`, `defaultNameGenerator` from `helpers.ts`
6. Remove `batchGenerateNames()` from `enrichmentService.ts`
7. Export `NameForgeService` and `NameForgeConfig` from `index.ts`

### Phase 2: Domain Changes (penguin-tales)
1. Create `penguins.nameforge.json` config via name-forge web UI
2. Update `main.ts` to instantiate `NameForgeService` and pass to engine config
3. Update ALL templates to omit `name` field (let framework handle it)
4. Remove `setNameGenerator()` call from `main.ts`

## Files to Modify

### Framework (apps/lore-weave)
| File | Changes |
|------|---------|
| `lib/services/nameForgeService.ts` | **NEW** - wraps name-forge |
| `lib/types/engine.ts` | Add `nameForgeService` to `EngineConfig` |
| `lib/utils/helpers.ts` | Update `addEntity()`, remove global name generation |
| `lib/services/enrichmentService.ts` | Remove `batchGenerateNames` |
| `lib/index.ts` | Export `NameForgeService`, `NameForgeConfig` |

### Domain (penguin-tales/lore)
| File | Changes |
|------|---------|
| `data/penguins.nameforge.json` | **NEW** - export from name-forge web UI |
| `main.ts` | Instantiate `NameForgeService`, add to config |
| `templates/**/*.ts` | Remove `name:` field, remove `generateName` imports |

## Error Messages

Clear errors from framework:

```
addEntity: name not provided and no NameForgeService configured

NameForgeService: culture 'unknown_culture' not found. Available: imperial, wanderer, orca

NameForgeService: culture 'imperial' has no profiles
```

name-forge errors bubble up:

```
No strategies available for profile npc_names

Domain not found: elvish_phonemes (referenced by strategy elvish_base)
```

## Success Criteria

1. All names generated synchronously via name-forge
2. No LLM name generation code remains
3. No global state (`setNameGenerator` pattern removed)
4. Templates are SIMPLER - they omit names, framework handles it
5. Domain only imports from framework (no direct name-forge dependency)
6. Misconfiguration produces clear errors
7. Zero modifications to name-forge
