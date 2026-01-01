# Numeric Prominence Plan

## Overview

Replace discrete string prominence with a continuous 0-5 numeric scale. Clean break, no backwards compatibility.

**Current System:**
- Storage: `prominence: 'forgotten' | 'marginal' | 'recognized' | 'renowned' | 'mythic'`
- Mutations: `direction: 'up' | 'down'` (full level changes)
- Problem: Agent success/failure uses full level changes, causing prominence to swing wildly

**New System:**
- Storage: `prominence: number` (0.0 to 5.0)
- Display: String labels computed from ranges via `prominenceLabel(value)`
- Mutations: `delta: number` (e.g., +0.1 for minor success, +1.0 for major event)
- Selection: String labels in configs, converted to numeric thresholds internally

## Numeric Ranges

| Range | Label | Index |
|-------|-------|-------|
| 0.0 - 0.99 | forgotten | 0 |
| 1.0 - 1.99 | marginal | 1 |
| 2.0 - 2.99 | recognized | 2 |
| 3.0 - 3.99 | renowned | 3 |
| 4.0 - 5.0 | mythic | 4 |

Default starting value: 2.0 (recognized)

## Changes Required

### 1. Type Definitions

#### `packages/world-schema/src/world.ts`

```typescript
// String type becomes display-only alias
export type ProminenceLabel = 'forgotten' | 'marginal' | 'recognized' | 'renowned' | 'mythic';

export interface WorldEntity {
  // ... existing fields ...

  // CHANGED: Now numeric (0.0-5.0)
  prominence: number;
}
```

#### `apps/lore-weave/lib/rules/types.ts`

```typescript
// Labels for display/config
export const PROMINENCE_LABELS = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'] as const;
export type ProminenceLabel = (typeof PROMINENCE_LABELS)[number];

// Numeric constants
export const PROMINENCE_MIN = 0.0;
export const PROMINENCE_MAX = 5.0;

// Convert numeric value to string label
export function prominenceLabel(value: number): ProminenceLabel {
  if (value < 1) return 'forgotten';
  if (value < 2) return 'marginal';
  if (value < 3) return 'recognized';
  if (value < 4) return 'renowned';
  return 'mythic';
}

// Convert string label to numeric threshold (lower bound of range)
export function prominenceThreshold(label: ProminenceLabel): number {
  switch (label) {
    case 'forgotten': return 0;
    case 'marginal': return 1;
    case 'recognized': return 2;
    case 'renowned': return 3;
    case 'mythic': return 4;
  }
}

// Get prominence index (0-4) from numeric value
export function prominenceIndex(value: number): number {
  return Math.min(4, Math.max(0, Math.floor(value)));
}

// Clamp value to valid range
export function clampProminence(value: number): number {
  return Math.max(PROMINENCE_MIN, Math.min(PROMINENCE_MAX, value));
}

// Compare two prominence values
export function compareProminence(a: number, b: number): number {
  return a - b;
}
```

### 2. Mutation Changes

#### `apps/lore-weave/lib/rules/mutations/types.ts`

```typescript
export interface AdjustProminenceMutation {
  type: 'adjust_prominence';
  entity: string;
  delta: number;  // Required. Positive = increase, negative = decrease
}
```

#### `apps/lore-weave/lib/rules/mutations/index.ts`

```typescript
function prepareAdjustProminence(
  mutation: AdjustProminenceMutation,
  ctx: RuleContext,
  result: MutationResult
): MutationResult {
  const entity = resolveEntityRef(mutation.entity, ctx);
  if (!entity) {
    result.applied = false;
    result.diagnostic = `entity ${mutation.entity} not found`;
    return result;
  }

  if (hasTag(entity.tags, FRAMEWORK_TAGS.PROMINENCE_LOCKED)) {
    result.diagnostic = `${entity.name} prominence locked`;
    return result;
  }

  const currentValue = entity.prominence;
  const newValue = clampProminence(currentValue + mutation.delta);
  const oldLabel = prominenceLabel(currentValue);
  const newLabel = prominenceLabel(newValue);

  if (newValue !== currentValue) {
    result.entityModifications.push({
      id: entity.id,
      changes: { prominence: newValue },
    });

    const levelChange = oldLabel !== newLabel ? ` (now ${newLabel})` : '';
    result.diagnostic = `adjusted ${entity.name} prominence by ${mutation.delta > 0 ? '+' : ''}${mutation.delta.toFixed(2)}${levelChange}`;
  } else {
    result.diagnostic = `${entity.name} prominence at ${mutation.delta > 0 ? 'maximum' : 'minimum'}`;
  }

  return result;
}
```

#### `apps/lore-weave/lib/rules/mutations/types.ts` - EntityModification

```typescript
export interface EntityModification {
  id: string;
  changes: {
    status?: string;
    prominence?: number;  // Changed from ProminenceLabel to number
    tags?: Record<string, string | boolean>;
  };
}
```

### 3. Entity Creation Changes

#### `apps/lore-weave/lib/engine/types.ts`

```typescript
export interface CreateEntitySettings {
  // ... existing fields ...
  prominence: number;  // Required, numeric (0.0-5.0)
}
```

#### Template/Generator configs

Templates specify prominence as string labels, converted at interpretation time:
```typescript
// In generator JSON:
{ "prominence": "recognized" }

// Interpreter converts to numeric:
const prominence = prominenceThreshold(config.prominence) + 0.5;  // midpoint of range
```

### 4. Condition/Filter Changes

#### `apps/lore-weave/lib/rules/conditions/types.ts`

```typescript
export interface ProminenceCondition {
  type: 'prominence';
  min?: ProminenceLabel;  // String label in config
  max?: ProminenceLabel;
}
```

#### `apps/lore-weave/lib/rules/conditions/index.ts`

```typescript
function evaluateProminence(condition: ProminenceCondition, self?: HardState): ConditionResult {
  if (!self) return { passed: false, reason: 'no self' };

  const currentValue = self.prominence;

  if (condition.min !== undefined) {
    const minValue = prominenceThreshold(condition.min);
    if (currentValue < minValue) {
      return { passed: false, reason: `prominence ${currentValue} < ${condition.min} (${minValue})` };
    }
  }

  if (condition.max !== undefined) {
    const maxValue = prominenceThreshold(condition.max) + 1;  // upper bound of range
    if (currentValue >= maxValue) {
      return { passed: false, reason: `prominence ${currentValue} >= ${condition.max} upper (${maxValue})` };
    }
  }

  return { passed: true };
}
```

#### `apps/lore-weave/lib/rules/filters/index.ts`

```typescript
case 'has_prominence': {
  const minValue = prominenceThreshold(filter.minProminence);
  return entities.filter(e => e.prominence >= minValue);
}
```

### 5. Metrics Changes

#### `apps/lore-weave/lib/rules/metrics/index.ts`

Multiplier calculation interpolates between levels:
```typescript
const SUCCESS_MULTIPLIERS = [0.6, 0.8, 1.0, 1.2, 1.5];   // forgotten->mythic
const ACTION_MULTIPLIERS = [0.3, 0.6, 1.0, 1.5, 2.0];

export function getProminenceMultiplierValue(
  prominence: number,
  mode: 'success_chance' | 'action_rate' = 'success_chance'
): number {
  const multipliers = mode === 'success_chance' ? SUCCESS_MULTIPLIERS : ACTION_MULTIPLIERS;
  const level = Math.floor(prominence);
  const fraction = prominence - level;

  const current = multipliers[Math.min(level, 4)];
  const next = multipliers[Math.min(level + 1, 4)];

  return current + (next - current) * fraction;
}
```

### 6. Narrative Event Changes

#### `apps/lore-weave/lib/narrative/significanceCalculator.ts`

```typescript
if (change.field === 'prominence') {
  const delta = Math.abs(newValue - oldValue);
  score += delta * 0.1;  // Each 1.0 of change adds 0.1 significance

  // Bonus for crossing level boundaries
  if (prominenceLabel(oldValue) !== prominenceLabel(newValue)) {
    score += 0.15;
  }
}
```

#### `apps/lore-weave/lib/narrative/narrativeEventBuilder.ts`

```typescript
if (field === 'prominence') {
  const oldLabel = prominenceLabel(oldValue);
  const newLabel = prominenceLabel(newValue);
  const delta = newValue - oldValue;

  if (oldLabel !== newLabel) {
    return delta > 0
      ? `rose to ${newLabel} prominence`
      : `fell to ${newLabel} prominence`;
  } else {
    return delta > 0 ? `gained influence` : `lost influence`;
  }
}
```

### 7. Action System Changes

#### Action config schema

Replace `applyProminenceToActor: boolean` with explicit deltas:

```typescript
interface ActionConfig {
  // ... existing fields ...

  // Actor prominence changes on action outcome
  actorProminenceDelta?: {
    onSuccess: number;   // e.g., +0.2
    onFailure: number;   // e.g., -0.1
  };

  // Target prominence changes
  targetProminenceDelta?: {
    onSuccess: number;
    onFailure: number;
  };
}
```

#### `apps/lore-weave/lib/engine/actionInterpreter.ts`

```typescript
function applyProminenceOutcome(
  action: ActionConfig,
  actor: HardState,
  target: HardState | undefined,
  succeeded: boolean,
  ctx: RuleContext
): MutationResult[] {
  const results: MutationResult[] = [];

  if (action.actorProminenceDelta) {
    const delta = succeeded
      ? action.actorProminenceDelta.onSuccess
      : action.actorProminenceDelta.onFailure;

    if (delta !== 0) {
      results.push(prepareMutation({
        type: 'adjust_prominence',
        entity: '$actor',
        delta,
      }, ctx));
    }
  }

  if (action.targetProminenceDelta && target) {
    const delta = succeeded
      ? action.targetProminenceDelta.onSuccess
      : action.targetProminenceDelta.onFailure;

    if (delta !== 0) {
      results.push(prepareMutation({
        type: 'adjust_prominence',
        entity: '$target',
        delta,
      }, ctx));
    }
  }

  return results;
}
```

### 8. UI Changes

#### Display components

All UIs display string labels derived from numeric value:
```tsx
// Utility function (shared)
function ProminenceDisplay({ value }: { value: number }) {
  const label = prominenceLabel(value);
  return (
    <span className={`prominence prominence-${label}`} title={value.toFixed(2)}>
      {label}
    </span>
  );
}
```

#### Editors (Canonry, Coherence-Engine)

Selection editors use string labels in dropdowns:
```tsx
// Dropdown options
const PROMINENCE_OPTIONS = [
  { value: 'forgotten', label: 'Forgotten' },
  { value: 'marginal', label: 'Marginal' },
  { value: 'recognized', label: 'Recognized' },
  { value: 'renowned', label: 'Renowned' },
  { value: 'mythic', label: 'Mythic' },
];

// Value stored in JSON configs as string label
// Converted to numeric at runtime by interpreter
```

#### Mutation editors

Delta inputs for prominence mutations:
```tsx
// Instead of direction dropdown, use numeric input
<label>Delta</label>
<input type="number" step="0.1" value={mutation.delta} />
// Hint: +1.0 = full level up, +0.1 = small boost
```

### 9. JSON Config Changes

#### `actions.json` - Replace `applyProminenceToActor`

Before:
```json
{
  "id": "colony_elevates_resident",
  "applyProminenceToActor": true
}
```

After:
```json
{
  "id": "colony_elevates_resident",
  "actorProminenceDelta": { "onSuccess": 0.2, "onFailure": 0 }
}
```

#### `systems.json` / `generators.json` - Replace direction with delta

Before:
```json
{
  "type": "adjust_prominence",
  "entity": "$self",
  "direction": "up"
}
```

After:
```json
{
  "type": "adjust_prominence",
  "entity": "$self",
  "delta": 1.0
}
```

#### Selection configs - Keep string labels

Configs continue using string labels (no change needed):
```json
{
  "minProminence": "recognized",
  "maxProminence": "renowned"
}
```

### 10. Helper Function Cleanup

#### Delete from `apps/lore-weave/lib/graph/entityQueries.ts`

```typescript
// DELETE - replaced by rules/types.ts functions
export function getProminenceValue(prominence: HardState['prominence']): number
export function adjustProminence(current: HardState['prominence'], delta: number): HardState['prominence']
```

#### Delete from `apps/lore-weave/lib/rules/types.ts`

```typescript
// DELETE - no longer needed with numeric prominence
export const PROMINENCE_ORDER = [...]  // Replace with PROMINENCE_LABELS
```

## Files to Modify

### Core Types
| File | Changes |
|------|---------|
| `packages/world-schema/src/world.ts` | Change `prominence: Prominence` to `prominence: number`, add `ProminenceLabel` type |
| `apps/lore-weave/lib/core/worldTypes.ts` | Update re-exports |
| `apps/lore-weave/lib/rules/types.ts` | Replace `PROMINENCE_ORDER` with `PROMINENCE_LABELS`, add conversion functions |

### Rules Engine
| File | Changes |
|------|---------|
| `apps/lore-weave/lib/rules/mutations/types.ts` | Change `direction` to `delta: number` in AdjustProminenceMutation |
| `apps/lore-weave/lib/rules/mutations/index.ts` | Update `prepareAdjustProminence` to use delta |
| `apps/lore-weave/lib/rules/conditions/index.ts` | Update `evaluateProminence` for numeric comparison |
| `apps/lore-weave/lib/rules/filters/index.ts` | Update `has_prominence` filter |
| `apps/lore-weave/lib/rules/metrics/index.ts` | Update `getProminenceMultiplierValue` for interpolation |

### Engine / Interpreters
| File | Changes |
|------|---------|
| `apps/lore-weave/lib/engine/types.ts` | Update `CreateEntitySettings.prominence` to number |
| `apps/lore-weave/lib/engine/templateInterpreter.ts` | Convert string prominence to numeric on entity creation |
| `apps/lore-weave/lib/engine/actionInterpreter.ts` | Replace `applyProminenceToActor` with delta-based system |
| `apps/lore-weave/lib/graph/entityQueries.ts` | Delete old prominence helpers |

### Narrative
| File | Changes |
|------|---------|
| `apps/lore-weave/lib/narrative/significanceCalculator.ts` | Update for numeric prominence |
| `apps/lore-weave/lib/narrative/narrativeEventBuilder.ts` | Update prominence change descriptions |
| `apps/lore-weave/lib/narrative/stateChangeTracker.ts` | Update prominence tracking |

### Systems
| File | Changes |
|------|---------|
| `apps/lore-weave/lib/systems/universalCatalyst.ts` | Use numeric prominence for multipliers |
| `apps/lore-weave/lib/systems/connectionEvolution.ts` | Update prominence_scaled threshold |
| Any system using `adjust_prominence` mutations | Change `direction` to `delta` |

### JSON Configs
| File | Changes |
|------|---------|
| `apps/canonry/webui/public/default-project/actions.json` | Replace `applyProminenceToActor` with `actorProminenceDelta` |
| `apps/canonry/webui/public/default-project/systems.json` | Replace `direction` with `delta` in mutations |
| `apps/canonry/webui/public/default-project/generators.json` | Keep string labels (interpreter converts) |

### UI Components
| File | Changes |
|------|---------|
| All components displaying `entity.prominence` | Use `prominenceLabel(entity.prominence)` |
| Mutation editors | Replace direction dropdown with delta number input |
| `apps/coherence-engine/webui/` mutation editors | Update for delta |
| `apps/canonry/webui/` mutation editors | Update for delta |

## Testing Strategy

1. **Build passes**: All TypeScript compiles
2. **Unit tests**: `prominenceLabel`, `prominenceThreshold`, `clampProminence`
3. **Run simulation**: Verify prominence distributions look reasonable
4. **UI verification**: Labels display correctly, editors work
