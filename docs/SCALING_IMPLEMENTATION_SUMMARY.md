# World Generation Scaling Implementation

## Overview
Consolidated all entity caps, tick limits, and relationship budgets into a single `SCALE_FACTOR` parameter that proportionally scales the entire world generation system.

## Changes Made

### 1. Main Configuration (main.ts)
**Added:**
- `SCALE_FACTOR` constant (line ~59) - reads from `process.env.SCALE_FACTOR` or defaults to 1.0
- Console log showing active scale factor
- `scaleDistributionTargets()` function - recursively scales all "target" fields in distributionTargets.json
- `scaleEntityRegistries()` function - shallow clones and scales targetCount fields while preserving functions
- Scaling applied to all config parameters

**Parameters Scaled:**
- `epochLength`: 20 → 20 * SCALE_FACTOR (ticks per epoch)
- `simulationTicksPerGrowth`: 15 → 15 * SCALE_FACTOR (simulation ticks between growth phases)
- `targetEntitiesPerKind`: 30 → 30 * SCALE_FACTOR (target entities per kind, ~150 total at 1x)
- `maxTicks`: 500 → 500 * SCALE_FACTOR (maximum simulation ticks)
- `relationshipBudget.maxPerSimulationTick`: 50 → 50 * SCALE_FACTOR
- `relationshipBudget.maxPerGrowthPhase`: 150 → 150 * SCALE_FACTOR
- `distributionTargets`: All numeric "target" fields scaled (prevents saturation control blocking)
- `entityRegistries`: All "targetCount" fields in creators and expectedDistribution scaled
- Added `scaleFactor` to config object to pass to engine

### 2. Engine Internal Limits (worldEngine.ts)
**Added:**
- `maxRunsPerTemplate` now calculated in constructor: 12 * scaleFactor^1.5 (superlinear)
- `growthBounds` object with min/max: { min: 3 * scale, max: 25 * scale }
- Scale factor used in multiple calculation points

**Parameters Scaled:**
- `maxRunsPerTemplate`: 12 → 12 * scaleFactor^1.5 (hard cap per template, superlinear scaling)
- `safetyLimit`: targetEntitiesPerKind * 10 → targetEntitiesPerKind * 10 * scaleFactor
- `maxAttempts`: targets * 10 → targets * 10 * scaleFactor (template selection safety limit)
- Growth target bounds: [3, 25] → [3 * scale, 25 * scale] (entities per epoch)

### 3. Type Definitions (types/engine.ts)
**Added:**
- `scaleFactor?: number` field to `EngineConfig` interface

## Expected Results at Different Scales

### SCALE_FACTOR = 1.0 (Default/Baseline)
- Target: ~150 entities (30 per kind)
- Max ticks: 500
- Epoch length: 20 ticks
- Growth per epoch: 3-25 entities
- Max template runs: 12 per template

### SCALE_FACTOR = 10.0 (10x Larger World)
- Target: ~1,500 entities (300 per kind)
- Max ticks: 5,000
- Epoch length: 200 ticks
- Growth per epoch: 30-250 entities
- Max template runs: 379 per template (12 * 10^1.5)
- Relationship budgets: 500/tick, 1500/growth phase

### SCALE_FACTOR = 5.0 (5x Larger World)
- Target: ~750 entities (150 per kind)
- Max ticks: 2,500
- Epoch length: 100 ticks
- Growth per epoch: 15-125 entities
- Max template runs: 60 per template

## How to Use

### Set via Environment Variable:
```bash
export SCALE_FACTOR=10.0
npm run dev
```

### One-time execution:
```bash
SCALE_FACTOR=10.0 npm run dev
```

### With run-id:
```bash
SCALE_FACTOR=10.0 npm run dev -- --run-id my-large-world
```

## Implementation Notes

1. **Proportional Scaling**: Most limits scale linearly with SCALE_FACTOR to maintain the same generation characteristics at any scale

2. **Integer Rounding**: All scaled values use `Math.ceil()` to ensure minimum viable limits at fractional scales

3. **Safety Valves**: Internal safety limits (maxAttempts, safetyLimit) scale with SCALE_FACTOR to prevent premature termination

4. **Template Diversity**: maxRunsPerTemplate scales superlinearly (^1.5 exponent), allowing templates to run more times in larger worlds. This handles cases where only a subset of templates are applicable in early epochs due to prerequisites

5. **Saturation Control**: distributionTargets and entityRegistries targetCount fields scale to prevent premature saturation blocking. Without this, templates would be blocked from creating entities after hitting 1x scale targets

6. **Growth Rate**: Both minimum and maximum entities per epoch scale proportionally, maintaining the same pacing curve

7. **Relationship Budgets**: Both per-tick and per-growth-phase budgets scale to prevent relationship explosion in larger worlds

## Files Modified

1. **src/main.ts** (~lines 51-220)
   - Added SCALE_FACTOR constant and calculation
   - Added scaleDistributionTargets() and scaleEntityRegistries() functions
   - Applied scaling to all config parameters, distribution targets, and entity registries
   - Added scaleFactor to config object

2. **src/engine/worldEngine.ts** (~lines 319-1263)
   - Added scaled instance variables
   - Initialized scaled values in constructor
   - Applied scaling to safety limits and growth calculations

3. **src/types/engine.ts** (~line 294)
   - Added scaleFactor field to EngineConfig interface

## Testing Recommendations

1. Test at SCALE_FACTOR=1.0 to verify no regression
2. Test at SCALE_FACTOR=2.0 to verify linear scaling
3. Test at SCALE_FACTOR=10.0 for target use case
4. Monitor generation time and memory usage at high scales
5. Verify entity distribution remains balanced at all scales

## Potential Issues

1. **Memory**: 10x entities means ~10x memory usage
2. **Performance**: Relationship checks scale O(n²) with entity count
3. **LLM Costs**: If enrichment is enabled, costs scale with entity count
4. **Generation Time**: Expect ~10x longer generation at 10x scale

## Future Improvements

1. Monitor if relationship budgets need superlinear scaling at extreme scales
2. Add validation to warn if SCALE_FACTOR exceeds recommended limits (e.g., > 20x)
3. Consider separate scale factors for different aspects (entity scale vs tick scale)
4. Add profiling to identify bottlenecks at high scales

## Superlinear Scaling Rationale

`maxRunsPerTemplate` uses a 1.5 exponent (12 * scale^1.5) rather than linear scaling because:
- Not all templates are applicable at all times (prerequisites, era weights, pressure requirements)
- In early epochs, only a subset of templates may be applicable
- Linear scaling exhausts applicable templates too quickly at high scales
- Superlinear scaling provides headroom for the smaller set of early-game templates
- At 1x scale: 12 runs (unchanged)
- At 10x scale: 379 runs (vs 120 with linear scaling)
- At 20x scale: 1,073 runs
