# System & Template Implementation Guide

This guide describes best practices and requirements for implementing **SimulationSystems** and **GrowthTemplates** that integrate safely with the world generation engine.

## Table of Contents

1. [Core Principles](#core-principles)
2. [Simulation Systems](#simulation-systems)
3. [Growth Templates](#growth-templates)
4. [Helper Functions (Required Usage)](#helper-functions-required-usage)
5. [Common Pitfalls](#common-pitfalls)
6. [Examples](#examples)

---

## Core Principles

### 1. **Always Use Helper Functions**
The engine provides helper functions in `src/utils/helpers.ts` that enforce critical invariants. **Direct manipulation of the graph is forbidden.**

### 2. **Respect Cooldowns**
Relationships should not spam the same entity. The engine tracks cooldowns per entity+relationship type.

### 3. **Check for Contradictions**
Some relationships are incompatible (e.g., `enemy_of` and `lover_of`). Always verify compatibility before creating relationships.

### 4. **Fail Gracefully**
If preconditions aren't met (no valid targets, missing references), return empty results rather than creating incomplete entities.

### 5. **Throttle Appropriately**
Systems that create many relationships should include throttling (random early-exit) to prevent spam.

### 6. **Cap Probabilities**
Before passing to `rollProbability()`, ensure probabilities don't exceed 0.95 to prevent guaranteed outcomes after odds scaling.

---

## Simulation Systems

### Interface

```typescript
export interface SimulationSystem {
  id: string;
  name: string;
  apply: (graph: Graph, modifier: number) => SystemResult;
}

export interface SystemResult {
  relationshipsAdded: Relationship[];
  entitiesModified: Array<{ id: string; changes: Partial<HardState> }>;
  pressureChanges: Record<string, number>;
  description: string;
}
```

### Required Patterns

#### 1. **Throttling**
Most systems should include throttling to reduce spam:

```typescript
apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
  // Throttle: Only run 30% of ticks
  if (!rollProbability(0.3, modifier)) {
    return {
      relationshipsAdded: [],
      entitiesModified: [],
      pressureChanges: {},
      description: 'System dormant'
    };
  }

  // ... rest of system logic
}
```

#### 2. **Cooldown Checking**
Before creating relationships, always check cooldowns:

```typescript
const COOLDOWN = 8;  // Ticks to wait before same entity can form this relationship type again

if (!hasRelationship(graph, srcId, dstId, 'enemy_of') &&
    canFormRelationship(graph, srcId, 'enemy_of', COOLDOWN) &&
    areRelationshipsCompatible(graph, srcId, dstId, 'enemy_of')) {
  relationships.push({ kind: 'enemy_of', src: srcId, dst: dstId });
  recordRelationshipFormation(graph, srcId, 'enemy_of');
}
```

#### 3. **Contradiction Checking**
Use `areRelationshipsCompatible` to prevent contradictory relationships:

```typescript
// This prevents creating enemy_of if lover_of already exists, etc.
if (areRelationshipsCompatible(graph, srcId, dstId, 'enemy_of')) {
  // Safe to create relationship
}
```

#### 4. **Probability Capping**
Always cap calculated probabilities before passing to `rollProbability`:

```typescript
const baseChance = 0.4;
const multiplier = 3.0;  // Could make this > 1.0
const probability = Math.min(0.95, baseChance * multiplier * balancingFactor);

if (rollProbability(probability, modifier)) {
  // Create relationship
}
```

### Complete System Example

```typescript
export const exampleSystem: SimulationSystem = {
  id: 'example_system',
  name: 'Example Relationship System',

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    // 1. THROTTLE (30% run rate)
    if (!rollProbability(0.3, modifier)) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'Example system dormant'
      };
    }

    const relationships: Relationship[] = [];
    const COOLDOWN = 8;

    const npcs = findEntities(graph, { kind: 'npc', status: 'alive' });

    npcs.forEach((npc, i) => {
      npcs.slice(i + 1).forEach(neighbor => {
        // 2. CAP PROBABILITY
        const baseChance = 0.2;
        const probability = Math.min(0.95, baseChance * modifier);

        if (rollProbability(probability, modifier)) {
          // 3. CHECK ALL CONDITIONS
          if (!hasRelationship(graph, npc.id, neighbor.id, 'example_of') &&
              canFormRelationship(graph, npc.id, 'example_of', COOLDOWN) &&
              areRelationshipsCompatible(graph, npc.id, neighbor.id, 'example_of')) {

            relationships.push({
              kind: 'example_of',
              src: npc.id,
              dst: neighbor.id
            });

            // 4. RECORD COOLDOWN
            recordRelationshipFormation(graph, npc.id, 'example_of');
          }
        }
      });
    });

    return {
      relationshipsAdded: relationships,
      entitiesModified: [],
      pressureChanges: {},
      description: `Example system created ${relationships.length} relationships`
    };
  }
};
```

---

## Growth Templates

### Interface

```typescript
export interface GrowthTemplate {
  id: string;
  name: string;
  canApply: (graph: Graph) => boolean;
  findTargets: (graph: Graph) => HardState[];
  expand: (graph: Graph, target?: HardState) => TemplateResult;
}

export interface TemplateResult {
  entities: Partial<HardState>[];
  relationships: Relationship[];
  description: string;
}
```

### Required Patterns

#### 1. **Validation and Graceful Failure**
Always validate inputs and fail gracefully:

```typescript
expand: (graph: Graph, target?: HardState): TemplateResult => {
  const faction = target || pickRandom(findEntities(graph, { kind: 'faction' }));

  // VALIDATE: Check if faction exists
  if (!faction) {
    return {
      entities: [],
      relationships: [],
      description: 'Cannot create entity - no factions exist'
    };
  }

  // VALIDATE: Check if faction has required property
  const location = graph.entities.get(faction.links.find(l => l.kind === 'controls')?.dst || '');
  if (!location) {
    return {
      entities: [],
      relationships: [],
      description: `${faction.name} has no location for this template`
    };
  }

  // ... proceed with entity creation
}
```

#### 2. **Required Structural Relationships**
NPCs MUST have `resident_of`, faction members SHOULD have `member_of`:

```typescript
const relationships: Relationship[] = [
  // Required: NPCs must live somewhere
  {
    kind: 'resident_of',
    src: 'will-be-assigned-0',
    dst: location.id
  },

  // Recommended: If in a faction, add membership
  {
    kind: 'member_of',
    src: 'will-be-assigned-0',
    dst: faction.id
  }
];
```

#### 3. **Placeholder ID Resolution**
Use `will-be-assigned-N` for entities created in the same template:

```typescript
const entities: Partial<HardState>[] = [];
const relationships: Relationship[] = [];

// Create multiple entities
for (let i = 0; i < 3; i++) {
  entities.push({
    kind: 'npc',
    subtype: 'merchant',
    name: generateName('merchant'),
    // ... other fields
  });

  // Reference them with placeholders
  relationships.push({
    kind: 'member_of',
    src: `will-be-assigned-${i}`,  // ← Will be resolved to real ID
    dst: faction.id
  });
}

return { entities, relationships, description: '...' };
```

### Complete Template Example

```typescript
export const exampleTemplate: GrowthTemplate = {
  id: 'example_template',
  name: 'Example Entity Creation',

  canApply: (graph: Graph) => {
    const factions = findEntities(graph, { kind: 'faction', subtype: 'company' });
    return factions.length > 0;
  },

  findTargets: (graph: Graph) => {
    return findEntities(graph, { kind: 'faction', subtype: 'company' });
  },

  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const faction = target || pickRandom(findEntities(graph, { kind: 'faction', subtype: 'company' }));

    // 1. VALIDATE FACTION
    if (!faction) {
      return {
        entities: [],
        relationships: [],
        description: 'No company factions exist'
      };
    }

    // 2. VALIDATE LOCATION
    const locationLink = faction.links.find(l => l.kind === 'controls');
    let location = locationLink ? graph.entities.get(locationLink.dst) : undefined;

    // Fallback to any colony
    if (!location) {
      const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
      location = colonies.length > 0 ? pickRandom(colonies) : undefined;
    }

    if (!location) {
      return {
        entities: [],
        relationships: [],
        description: `${faction.name} has no location for this template`
      };
    }

    // 3. CREATE ENTITIES
    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    for (let i = 0; i < 2; i++) {
      entities.push({
        kind: 'npc',
        subtype: 'merchant',
        name: generateName('merchant'),
        description: `A merchant working for ${faction.name}`,
        status: 'alive',
        prominence: 'marginal',
        tags: ['merchant', 'employee']
      });

      // 4. ADD REQUIRED RELATIONSHIPS
      relationships.push({
        kind: 'member_of',
        src: `will-be-assigned-${i}`,
        dst: faction.id
      });

      relationships.push({
        kind: 'resident_of',  // ← REQUIRED for NPCs
        src: `will-be-assigned-${i}`,
        dst: location.id
      });
    }

    return {
      entities,
      relationships,
      description: `${faction.name} recruits new merchants`
    };
  }
};
```

---

## Helper Functions (Required Usage)

### Relationship Management

```typescript
// Check if specific relationship exists
hasRelationship(graph: Graph, srcId: string, dstId: string, kind?: string): boolean

// Check if entity is on cooldown for relationship type
canFormRelationship(graph: Graph, entityId: string, relType: string, cooldown: number): boolean

// Record that entity formed a relationship (for cooldown tracking)
recordRelationshipFormation(graph: Graph, entityId: string, relType: string): void

// Check if two entities can form this relationship type (no contradictions)
areRelationshipsCompatible(graph: Graph, srcId: string, dstId: string, relType: string): boolean

// Add relationship to graph (handles deduplication and link updates)
addRelationship(graph: Graph, kind: string, srcId: string, dstId: string): void
```

### Probability

```typescript
// Roll probability with era modifier (uses odds-based scaling)
// baseProbability MUST be capped at 0.95 before calling!
rollProbability(baseProbability: number, eraModifier: number = 1.0): boolean
```

### Entity Queries

```typescript
// Find entities matching criteria
findEntities(graph: Graph, criteria: Partial<HardState>): HardState[]

// Get related entities
getRelated(graph: Graph, entityId: string, relationshipKind?: string, direction?: 'src' | 'dst'): HardState[]

// Get entity's location
getLocation(graph: Graph, entityId: string): HardState | undefined

// Get faction members
getFactionMembers(graph: Graph, factionId: string): HardState[]

// Get faction relationship status (allied, enemy, neutral)
getFactionRelationship(factions1: HardState[], factions2: HardState[], graph: Graph): 'allied' | 'enemy' | 'neutral'
```

---

## Common Pitfalls

### ❌ DON'T: Bypass Helper Functions

```typescript
// WRONG: Direct manipulation
graph.relationships.push({ kind: 'enemy_of', src: npc1.id, dst: npc2.id });
```

```typescript
// CORRECT: Use helper
addRelationship(graph, 'enemy_of', npc1.id, npc2.id);
```

### ❌ DON'T: Skip Cooldown Checks

```typescript
// WRONG: No cooldown check
if (!hasRelationship(graph, src, dst, 'enemy_of')) {
  relationships.push({ kind: 'enemy_of', src, dst });
}
```

```typescript
// CORRECT: Check cooldown and record formation
if (!hasRelationship(graph, src, dst, 'enemy_of') &&
    canFormRelationship(graph, src, 'enemy_of', COOLDOWN)) {
  relationships.push({ kind: 'enemy_of', src, dst });
  recordRelationshipFormation(graph, src, 'enemy_of');
}
```

### ❌ DON'T: Create Contradictory Relationships

```typescript
// WRONG: No contradiction check
if (!hasRelationship(graph, src, dst, 'enemy_of')) {
  relationships.push({ kind: 'enemy_of', src, dst });
}
```

```typescript
// CORRECT: Check for contradictions
if (!hasRelationship(graph, src, dst, 'enemy_of') &&
    areRelationshipsCompatible(graph, src, dst, 'enemy_of')) {
  relationships.push({ kind: 'enemy_of', src, dst });
}
```

### ❌ DON'T: Allow Probabilities > 0.95

```typescript
// WRONG: Can exceed 1.0
const chance = 0.4 * 3.0;  // = 1.2!
if (rollProbability(chance, modifier)) { ... }
```

```typescript
// CORRECT: Cap probability
const chance = Math.min(0.95, 0.4 * 3.0);
if (rollProbability(chance, modifier)) { ... }
```

### ❌ DON'T: Create Disconnected Entities

```typescript
// WRONG: NPC with no residence
return {
  entities: [{
    kind: 'npc',
    subtype: 'merchant',
    // ...
  }],
  relationships: [
    { kind: 'member_of', src: 'will-be-assigned-0', dst: faction.id }
    // Missing resident_of!
  ],
  description: '...'
};
```

```typescript
// CORRECT: Always add residence for NPCs
return {
  entities: [{
    kind: 'npc',
    subtype: 'merchant',
    // ...
  }],
  relationships: [
    { kind: 'member_of', src: 'will-be-assigned-0', dst: faction.id },
    { kind: 'resident_of', src: 'will-be-assigned-0', dst: location.id }  // ✓
  ],
  description: '...'
};
```

---

## Validation Checklist

Before submitting a new system or template, verify:

### For Systems:
- [ ] Includes throttling (unless very rare, <0.1 base probability)
- [ ] Uses `canFormRelationship` before creating relationships
- [ ] Uses `recordRelationshipFormation` after creating relationships
- [ ] Uses `areRelationshipsCompatible` to prevent contradictions
- [ ] Caps probabilities at 0.95 before `rollProbability`
- [ ] Uses specific `kind` parameter in `hasRelationship` checks

### For Templates:
- [ ] Validates all inputs (target, faction, location, etc.)
- [ ] Fails gracefully with empty result if preconditions not met
- [ ] Adds `resident_of` for all NPCs
- [ ] Adds `member_of` for faction members
- [ ] Uses `will-be-assigned-N` placeholders correctly
- [ ] Never references entities that might not exist

---

## Engine-Level Safeguards

The engine enforces these limits automatically:

1. **Relationship Budget**: Maximum relationships per simulation tick (default: 50)
2. **Growth Rate Monitoring**: Warns when relationship growth exceeds 30/tick
3. **System Metrics**: Tracks and warns about aggressive systems (>500 relationships total)
4. **Validation**: Post-generation checks for disconnected entities and structural issues

These are **last-resort protections**. Proper system/template design should never trigger these limits.

---

## Questions?

See existing templates and systems in:
- `src/templates/npc/` - NPC creation templates
- `src/templates/faction/` - Faction creation templates
- `src/systems/relationshipFormation.ts` - Primary relationship system
- `src/systems/conflictContagion.ts` - Conflict spread system

All of these follow the patterns described in this guide.
