# GA Bug Fixes

## Issues Found and Fixed

### ✅ Issue 1: Fitness Function (VERIFIED CORRECT)

**Test Result**: Fitness function is working correctly ✓

```
Low violations (1.0/tick):  Fitness = 0.7966
High violations (15.0/tick): Fitness = 0.5127

✅ Lower violations = HIGHER fitness (35.6% difference)
```

The GA is correctly optimizing for lower violations.

---

### 🐛 Issue 2: Mutation Rate TOO Aggressive

**Problem**: Initial mutation rate of 40% was changing **24 parameters at once**

**Impact**:
- Destroying good parameter combinations
- Population thrashing instead of converging
- Violations potentially INCREASING due to chaotic mutations

**Fix**: Reduced to more conservative rates
```typescript
// Before
initialMutationRate: 0.40  // ~24 params changed
finalMutationRate: 0.08    // ~5 params changed

// After
initialMutationRate: 0.15  // ~9 params changed
finalMutationRate: 0.05    // ~3 params changed
```

**Expected Impact**: More stable convergence, better preservation of good solutions

---

### 🐛 Issue 3: Population Too Small

**Problem**: 30 individuals for 60+ parameters

**Analysis**:
```
Population 30: Diversity factor = 0.55
Population 50: Diversity factor = 0.71 (+29% genetic diversity)
```

With 60+ parameters, we need more individuals to explore the space effectively.

**Fix**: Increased population
```typescript
// Before
populationSize: 30
elitismCount: 3

// After
populationSize: 50  (+67% more individuals)
elitismCount: 5     (keep 10% elitism)
```

**Expected Impact**:
- Better exploration of parameter space
- More diverse solutions each generation
- Higher chance of finding optimal combinations

---

## New Diagnostic Features

### Every 5 Generations

```
--- GA DIAGNOSTICS ---
Last 5 gen fitness trend: +0.0234
Last 5 gen violation trend: -0.87/tick

✓ GA sanity checks passed

Current population:
  Best violations: 7.2/tick
  Avg violations:  8.1/tick
  Worst violations: 9.3/tick
  Spread: 2.1/tick
```

### Warning Flags

Will detect and warn about:
- ❌ Best fitness DECREASED (elitism bug)
- ❌ Best = Average (selection not working)
- ⚠️ STAGNATION (no improvement in 20 generations)
- 🔴 VIOLATIONS INCREASING (fitness function bug)

---

## What to Watch For

### Good Signs ✅

After 20-30 generations, you should see:
```
--- GA DIAGNOSTICS ---
Last 5 gen fitness trend: +0.0423
Last 5 gen violation trend: -1.24/tick  ← Violations going DOWN

Current population:
  Best violations: 5.8/tick   ← Lower than baseline 8.2
  Avg violations:  6.9/tick
  Spread: 2.3/tick  ← Population exploring
```

### Bad Signs ❌

If you see:
```
--- GA DIAGNOSTICS ---
Last 5 gen fitness trend: +0.0012  ← Tiny improvement
Last 5 gen violation trend: +0.34/tick  ← Violations going UP!

ISSUES DETECTED:
  🔴 VIOLATIONS INCREASING (fitness function bug?)
  ⚠️ STAGNATION: No improvement in 20 generations
```

This means violations are NOT optimizable via parameters.

---

## Summary of Changes

| Setting | Before | After | Reason |
|---------|--------|-------|--------|
| Population | 30 | 50 | Better diversity for 60+ params |
| Elitism | 3 | 5 | Keep 10% elitism |
| Initial mutation | 40% | 15% | Too aggressive, destroying solutions |
| Final mutation | 8% | 5% | More stable convergence |
| Impact boost | 5x | 3x | Less extreme |

**Net Effect**: More conservative, stable optimization with better exploration.

---

## Next Steps

1. **Run with fixes**: `npm run build && npm run dev`

2. **Monitor diagnostics** every 5 generations

3. **Check at generation 30**:
   - Are violations trending down?
   - Is fitness improving steadily?
   - Are diagnostics passing?

4. **If violations still increasing at gen 30**:
   - Parameters can't fix violations
   - Need to modify world-gen systems
   - Focus on relationship decay/culling logic

---

## Quick Test

Want to verify the fix immediately? Run:

```bash
npx ts-node src/test-fitness.ts
```

Should show:
```
✅ PASSED: Low violations = HIGHER fitness
   Fitness gap: 0.2839
   35.6% difference
```
