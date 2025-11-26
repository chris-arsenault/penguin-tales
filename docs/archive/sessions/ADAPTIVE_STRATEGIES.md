# Adaptive Mutation Strategies

## Overview

The optimizer now includes intelligent adaptive mutation that learns which parameters matter most and focuses exploration accordingly. This helps escape local optima and accelerate convergence.

## Key Improvements

### 1. **Violation Penalty** ✅
**Problem**: Protected relationships (like `resident_of`, `leader_of`) were decaying when they shouldn't, indicating mistuned relationship decay parameters.

**Solution**: Added `protectedRelationshipViolations` penalty to fitness function.

- **Weight**: 10% of total fitness
- **Calculation**: Exponential decay based on violation rate
  - `score = e^(-violationRate / 5.0)`
  - Lower violations = higher score
- **Current baseline**: ~985 violations at 8.2/tick (needs improvement!)

**Edit to configure**: `src/fitnessEvaluator.ts` lines 22-23

```typescript
const VIOLATION_PENALTY_WEIGHT = 0.10;  // Increase to prioritize violations
const VIOLATION_RATE_THRESHOLD = 5.0;   // Lower = stricter penalty
```

---

### 2. **Adaptive Mutation Strategies**

The system offers 4 strategies (currently using **hybrid**):

#### Strategy A: **Impact-Based Mutation** 🎯
**What it does**: Learns which parameters actually affect fitness over time.

**How it works**:
1. Tracks parameter changes across generations
2. Calculates correlation between parameter changes and fitness changes
3. Boosts mutation rate 3x for high-impact parameters (impact > 0.7)
4. Reduces mutation rate 0.5x for low-impact parameters (impact < 0.3)

**Example**: If `relationship_decay.socialDecayRate` consistently correlates with fitness changes, it gets mutated more often.

**Configure**: `src/index.ts` line 60
```typescript
impactBoostFactor: 3.0,  // Multiply mutation by this for influential params
```

#### Strategy B: **Component-Focused Mutation** 🔍
**What it does**: Focuses mutation on parameters that affect weak fitness components.

**How it works**:
1. Maps parameters to fitness components using keywords
   - `relationship*` → affects connectivity & relationshipDiversity
   - `num*`, `count*` → affects entityDistribution
   - `*Gain`, `*Decay` → affects prominenceDistribution
2. If a component is weak (< 0.7), boosts mutation 2x for related parameters

**Example**: If `relationshipDiversity` is 0.65, parameters like `friendshipBaseChance` and `romanceBaseChance` get mutated more aggressively.

**Configure**: `src/adaptiveMutation.ts` lines 65-88 (parameter mappings)

#### Strategy C: **Simulated Annealing** 🌡️
**What it does**: Starts with high exploration, gradually shifts to exploitation.

**How it works**:
1. Generation 0: 20% mutation rate (high exploration)
2. Generation 100: 5% mutation rate (fine-tuning)
3. Exponential decay curve: `rate = 0.05 + (0.20 - 0.05) * e^(-5 * progress)`

**Why it helps**: Escapes local optima early when fitness is already "good enough" but not optimal.

**Configure**: `src/index.ts` lines 61-63
```typescript
initialMutationRate: 0.20,       // Start here
finalMutationRate: 0.05,         // End here
annealingSchedule: 'exponential' // 'linear', 'exponential', or 'cosine'
```

#### Strategy D: **Hybrid** (Currently Active) 🔀
Combines all three strategies above:
- Impact-based learning identifies influential parameters
- Component-focused targeting attacks weak areas
- Annealing provides time-based exploration/exploitation balance

---

## What You'll See During Optimization

### Every Generation:
```
Generation 10/100
Best fitness: 0.8234
Average fitness: 0.7821
Diversity: 0.1234

Fitness breakdown:
  Entity distribution: 0.8912
  Prominence distribution: 0.9012
  Relationship diversity: 0.7234  ← Weak! Will boost related params
  Connectivity: 0.7123
  Overall: 0.8123
```

### Every 10 Generations:
```
--- Parameter Impact Report ---
Top 10 most influential parameters:

1. systems.relationship_decay.socialDecayRate
   Impact: 0.842 | Variance: 0.0234

2. systems.relationship_reinforcement.proximityBonus
   Impact: 0.791 | Variance: 0.0189

3. templates.familyExpansion.numChildrenMax
   Impact: 0.723 | Variance: 0.1234
...

Current mutation strategy: hybrid
Annealing progress: 50% | Current base rate: 0.097
```

**Interpretation**:
- **Impact > 0.7**: Parameter strongly correlates with fitness changes (will get 3x mutation)
- **Variance**: How much this parameter varies (higher = more exploration happening)

---

## Configuration Options

### Easy Changes (src/index.ts)

```typescript
const adaptiveMutation = new AdaptiveMutation(configLoader, parameterMetadata, {
  strategy: 'hybrid',              // 'impact', 'component', 'annealing', 'hybrid'

  // Impact-based
  impactBoostFactor: 3.0,          // How much to boost high-impact params
  impactLearningRate: 0.1,         // How quickly to adapt (0-1)
  impactHistoryWindow: 5,          // Generations to consider

  // Annealing
  initialMutationRate: 0.20,       // Start mutation rate
  finalMutationRate: 0.05,         // End mutation rate
  annealingSchedule: 'exponential',// Decay curve

  // Component-focused
  componentThreshold: 0.7,         // Focus on components below this
  componentMutationBoost: 2.0      // Boost mutation by this much
});
```

### Strategy Recommendations

**If fitness is stuck (local optimum)**:
- Increase `initialMutationRate` to 0.30
- Use `strategy: 'annealing'` to force more exploration

**If fitness is improving but slowly**:
- Use `strategy: 'hybrid'` (current default)
- Increase `impactBoostFactor` to 4.0 or 5.0

**If you know specific components are weak**:
- Use `strategy: 'component'`
- Lower `componentThreshold` to 0.8

**If you want pure learning-based**:
- Use `strategy: 'impact'`
- Increase `impactHistoryWindow` to 10

---

## Expected Results

### Before (Standard GA):
```
Gen 0:  Fitness 0.801
Gen 10: Fitness 0.812  (+0.011)
Gen 20: Fitness 0.818  (+0.006)  ← Diminishing returns
Gen 30: Fitness 0.821  (+0.003)
```

### After (Adaptive):
```
Gen 0:  Fitness 0.801
Gen 10: Fitness 0.827  (+0.026)  ← Better exploration
Gen 20: Fitness 0.849  (+0.022)  ← Learning which params matter
Gen 30: Fitness 0.878  (+0.029)  ← Focused mutation on weak areas
Gen 50: Fitness 0.912  (+0.034)  ← Annealing for fine-tuning
```

The adaptive system should:
1. **Learn faster** which parameters affect violations
2. **Escape local optima** through strategic exploration
3. **Focus effort** on parameters that need tuning
4. **Converge faster** to better solutions

---

## Advanced: Adding Custom Parameter Mappings

If you know specific parameters affect specific fitness components, add them to `src/adaptiveMutation.ts`:

```typescript
const PARAMETER_TO_COMPONENT: Record<string, string[]> = {
  // Your custom mappings
  'myNewParam': ['relationshipDiversity', 'connectivity'],

  // Existing mappings...
  'relationship': ['connectivity', 'relationshipDiversity'],
  // ...
};
```

This makes component-focused mutation target your parameters when those components are weak.

---

## Monitoring During Runs

**Watch for**:
1. **Violation rates decreasing** in output
2. **Impact scores stabilizing** after ~20 generations
3. **Mutation rates decreasing** over time (if using annealing)
4. **Weak components improving** as focused mutation kicks in

**Red flags**:
- All parameters have low impact (< 0.3) → fitness might not be sensitive enough
- No improvement for 20+ generations → try higher initial mutation rate
- Diversity dropping too fast → reduce elitism or increase mutation

---

## Summary

The optimizer now:
1. ✅ Penalizes protected relationship violations
2. ✅ Learns which parameters matter most (impact tracking)
3. ✅ Focuses on weak fitness components (component-focused)
4. ✅ Explores early, exploits late (simulated annealing)
5. ✅ Reports parameter influence every 10 generations

All strategies are configurable in `src/index.ts` and can be toggled independently.
