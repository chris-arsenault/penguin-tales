# Target Selector Usage Examples

## Before vs After

### ❌ OLD WAY (Ad-hoc, creates super-hubs)

```typescript
// cultFormation.ts - OLD CODE
const potentialCultists = findEntities(graph, { kind: 'npc', status: 'alive' })
  .filter(npc => !npc.links.some(l => l.kind === 'member_of'))
  .filter(npc => npc.subtype === 'merchant' || npc.subtype === 'outlaw')
  .slice(0, numCultists);

// Fallback to ANY NPCs - creates super-hubs!
const cultists = potentialCultists.length >= numCultists
  ? potentialCultists
  : findEntities(graph, { kind: 'npc', status: 'alive' }).slice(0, numCultists);
```

**Problems:**
- Binary logic (unaffiliated OR all)
- No penalty for existing connections
- Once all NPCs affiliated, picks randomly
- Result: Super-hubs like "Icewatcher" in 5+ factions

---

### ✅ NEW WAY (Framework-level, prevents super-hubs)

```typescript
// cultFormation.ts - NEW CODE
const result = targetSelector.selectTargets(
  graph,
  'npc',
  numCultists,
  {
    prefer: {
      subtypes: ['merchant', 'outlaw', 'hero'],
      sameLocationAs: location.id, // Prefer local NPCs
      preferenceBoost: 2.0
    },
    avoid: {
      relationshipKinds: ['member_of'], // Penalize multi-faction NPCs
      hubPenaltyStrength: 2.0, // Aggressive penalty (1/(1+count^2))
      maxTotalRelationships: 15, // Hard cap on super-hubs
      excludeRelatedTo: {
        entityId: 'will-be-assigned-0', // Don't recruit existing cult members
        relationshipKind: 'member_of'
      }
    },
    createIfSaturated: {
      threshold: 0.15, // If best score < 0.15, create new NPC
      factory: (graph, context) => ({
        kind: 'npc',
        subtype: pickRandom(['merchant', 'outlaw']),
        name: generateName('npc'),
        description: `A new convert drawn to the cult's teachings`,
        status: 'alive',
        prominence: 'marginal',
        tags: ['cultist']
      }),
      maxCreated: Math.ceil(numCultists / 2) // Max 50% new NPCs
    },
    diversityTracking: {
      trackingId: 'cult_recruitment',
      strength: 1.5
    }
  }
);

// result.existing = existing NPCs selected
// result.created = new NPCs to be created (need ID assignment)
const cultists = result.existing;
const newCultists = result.created; // Handle these separately
```

**Benefits:**
- ✅ Gradual penalty - entities with 1 member_of get 50% penalty, 2 get 80% penalty, etc.
- ✅ Hub detection - never selects entities with 15+ relationships
- ✅ Local preference - prefers NPCs from same colony
- ✅ Creates new NPCs when needed - prevents forcing connections
- ✅ Diversity tracking - penalizes recently recruited NPCs
- ✅ Diagnostic output - understand why selections were made

---

## More Examples

### Example 1: Guild Recruitment (Strong Hub Avoidance)

```typescript
// Guild wants merchants who aren't over-committed
const result = targetSelector.selectTargets(
  graph,
  'npc',
  3, // Need 3 founding members
  {
    prefer: {
      subtypes: ['merchant'],
      sameLocationAs: colony.id,
      preferenceBoost: 3.0 // Strongly prefer merchants
    },
    avoid: {
      relationshipKinds: ['member_of', 'leader_of'],
      hubPenaltyStrength: 3.0, // VERY aggressive - 1/(1+count^3)
      maxTotalRelationships: 10
    },
    createIfSaturated: {
      threshold: 0.2,
      factory: (graph, context) => ({
        kind: 'npc',
        subtype: 'merchant',
        name: generateName('npc'),
        description: `An independent merchant seeking guild membership`,
        status: 'alive',
        prominence: 'marginal',
        tags: ['trader', 'guild-founder']
      })
    }
  }
);
```

**Behavior:**
- Unaffiliated merchant: score ~3.0 (perfect match)
- 1 membership: score ~0.75 (3.0 * 1/(1+1^3) = 3.0 * 0.25)
- 2 memberships: score ~0.33 (3.0 * 1/(1+8))
- 3+ memberships: score <0.1 (effectively excluded)
- If all merchants have 2+ memberships, creates new merchant

---

### Example 2: War Alliance (Temporary Coalition)

```typescript
// Forming emergency alliance - OK to reuse factions
const result = targetSelector.selectTargets(
  graph,
  'faction',
  3,
  {
    avoid: {
      relationshipKinds: ['allied_with'],
      hubPenaltyStrength: 1.0, // Mild penalty
      excludeRelatedTo: {
        entityId: primaryFaction.id,
        relationshipKind: 'enemy_of' // Don't ally with enemies
      }
    }
    // No createIfSaturated - must use existing factions
  }
);
```

**Behavior:**
- No alliances: score 1.0
- 1 alliance: score 0.5
- 2 alliances: score 0.33
- Enemy of primary: excluded completely
- Never creates new factions (no factory)

---

### Example 3: Technology Discovery (Prefer Fresh Entities)

```typescript
const result = targetSelector.selectTargets(
  graph,
  'npc',
  1, // Single discoverer
  {
    prefer: {
      subtypes: ['hero', 'merchant'],
      prominence: ['renowned', 'mythic'], // Prefer notable NPCs
      preferenceBoost: 2.0
    },
    avoid: {
      relationshipKinds: ['discoverer_of'], // Penalize serial discoverers
      hubPenaltyStrength: 4.0 // EXTREME penalty
    },
    diversityTracking: {
      trackingId: 'tech_discovery',
      strength: 3.0 // Heavily penalize recent discoverers
    }
  }
);
```

**Behavior:**
- Renowned hero, 0 discoveries: score ~2.0
- Renowned hero, 1 discovery: score ~0.08 (2.0 * 1/(1+1^4))
- Same hero discovered 2 techs this session: score ~0.004
- Strongly encourages spreading discoveries across NPCs

---

### Example 4: Simple Relationship (Light Touch)

```typescript
// Just need a random NPC, but avoid obvious super-hubs
const result = targetSelector.selectTargets(
  graph,
  'npc',
  1,
  {
    avoid: {
      maxTotalRelationships: 20 // Only exclude extreme hubs
    }
  }
);
```

**Behavior:**
- Almost random selection
- Only excludes NPCs with 20+ total connections
- Good for non-critical relationships

---

## Integration with Templates

### Step 1: Add to WorldEngine

```typescript
// worldEngine.ts
import { TargetSelector } from '../services/targetSelector';

export class WorldEngine {
  private targetSelector: TargetSelector;

  constructor(config: EngineConfig) {
    // ...
    this.targetSelector = new TargetSelector();
  }

  // Make available to templates via expand() context
  private runGrowthPhase() {
    // ...
    const result = template.expand(this.graph, target, {
      targetSelector: this.targetSelector // Pass to templates
    });
  }
}
```

### Step 2: Update Template Signature

```typescript
// types/engine.ts
export interface GrowthTemplate {
  expand: (
    graph: Graph,
    target?: HardState,
    context?: TemplateContext // NEW
  ) => TemplateResult;
}

export interface TemplateContext {
  targetSelector: TargetSelector;
}
```

### Step 3: Update Templates

Templates can now use `context.targetSelector` instead of ad-hoc logic:

```typescript
expand: (graph: Graph, target?: HardState, context?: TemplateContext): TemplateResult => {
  const targetSelector = context?.targetSelector;
  if (!targetSelector) {
    // Fallback to old behavior if context not provided
    // (allows gradual migration)
  }

  const result = targetSelector.selectTargets(/* ... */);
  // Use result.existing and result.created
}
```

---

## Scoring Formula Details

### Hub Penalty Formula

```
score *= (1 / (1 + relationshipCount^strength))
```

**Examples with strength=2.0:**

| Relationship Count | Penalty Factor | Final Score (from 1.0) |
|--------------------|----------------|------------------------|
| 0                  | 1.00           | 1.00                   |
| 1                  | 0.50           | 0.50                   |
| 2                  | 0.20           | 0.20                   |
| 3                  | 0.10           | 0.10                   |
| 4                  | 0.06           | 0.06                   |
| 5                  | 0.04           | 0.04                   |
| 10                 | 0.01           | 0.01                   |

**This creates a "natural selection pressure":**
- Fresh entities: Highly desirable
- Lightly connected (1-2): Still viable
- Moderately connected (3-4): Unlikely
- Heavily connected (5+): Effectively excluded

---

## Migration Strategy

1. ✅ **Phase 1:** Create TargetSelector service (DONE)
2. **Phase 2:** Add to WorldEngine, pass via context
3. **Phase 3:** Update high-impact templates (cult, guild, faction splinter)
4. **Phase 4:** Migrate remaining templates gradually
5. **Phase 5:** Remove old selection helpers once all migrated

**Backward Compatibility:** Templates work without context (fallback to old behavior)

---

## Expected Impact

### Before (Current System)
```
NPC Connection Distribution:
  Icewatcher: 23 connections (5 factions, 3 discoveries, 15 other)
  Tidediver: 19 connections (4 factions, 2 discoveries, 13 other)
  Icewalker: 18 connections (3 factions, 4 discoveries, 11 other)
  [10 other NPCs]: 1-3 connections each

Graph Structure: Dense core, sparse periphery (unrealistic)
```

### After (With TargetSelector)
```
NPC Connection Distribution:
  [40 NPCs]: 3-8 connections each
  [5 NPCs]: 9-12 connections (natural leaders)
  [3 NPCs]: 1-2 connections (marginal)

Graph Structure: Multiple balanced clusters (realistic)
```

### Metrics
- **Hub Concentration:** 3 super-hubs → 0 super-hubs
- **Average Degree:** More uniform (std dev reduced)
- **New Entity Creation:** Triggered when needed (prevents forced connections)
- **Template Diversity:** Selection diversity tracked separately from template diversity

---

## Advanced: Custom Scoring

For special cases, templates can provide custom scoring:

```typescript
const result = targetSelector.selectTargets(
  graph,
  'npc',
  3,
  {
    // ... standard bias ...
    customScoring: (entity: HardState, baseScore: number) => {
      // Custom logic
      if (entity.tags.includes('exile')) {
        return baseScore * 0.1; // Heavily penalize exiles
      }
      if (entity.prominence === 'mythic') {
        return baseScore * 3.0; // Strongly prefer mythic NPCs
      }
      return baseScore;
    }
  }
);
```

(Note: This requires adding `customScoring` to SelectionBias interface)
