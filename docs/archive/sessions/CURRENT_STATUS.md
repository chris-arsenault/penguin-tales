# Current Status - Before Framework Refactor

**Date**: 2025-11-23
**Next Major Task**: Framework/domain decoupling refactor
**After That**: Implement world-level systems (see WORLD_LEVEL_SYSTEMS_DESIGN.md)

## What We Just Completed

### 1. Genetic Algorithm Optimizer (world-gen-optimizer/)

**Status**: ✅ Built and tested, but not fully optimized yet

**Components**:
- `ConfigLoader`: Extracts 87 tunable parameters from templateSystemParameters.json
- `FitnessEvaluator`: Weighted fitness function (entity distribution, prominence, diversity, connectivity, violations)
- `GeneticAlgorithm`: Population-based optimization with adaptive mutation
- `WorldGenRunner`: Parallel execution of world-gen with isolated configs
- `EvolutionTracker`: Tracks best genomes across generations
- `Diagnostics`: Detects GA bugs (stagnation, violations increasing, etc.)

**Key Findings**:
- Fitness function verified correct ✓
- Fixed: Mutation too aggressive (40% → 15%)
- Fixed: Population too small (30 → 50)
- **Problem discovered**: Violations couldn't be solved by parameters alone

### 2. Protected Relationship Violations Investigation

**Root Cause Found**: Structural relationships (member_of, resident_of, etc.) had:
- ✓ Decay (0.01-0.05 per tick)
- ❌ NO guaranteed reinforcement (proximity/faction bonuses were conditional)
- Net effect: Slow decay to floor, causing violations

**Band-Aid Fix Applied** (will be replaced after refactor):
- Added `structuralBonus` parameter to relationship_reinforcement system
- Value: 0.02/tick, Range: 0-0.1
- Applies to ALL structural relationships (narrative + spatial)
- This was a **heavy-handed fix** - better than blanket culling prevention, but not ideal

**Current Violations**: 774 total (6.45/tick) - improved from ~985 baseline, but still above target <360

**Why It's Not Ideal**:
- Treats geographic facts (adjacent_to) same as social affiliations (member_of)
- Doesn't differentiate between immutable facts and dynamic relationships
- Semantic mismatch

### 3. Design Insight: Wrong Entity Focus

**Discovery**: Systems are 69% NPC-focused, but output is for a game where factions/locations/magic matter more

**Current Breakdown**:
```
NPC relationships: 774 (69%)
  - NPC ↔ NPC social: 592 (lover_of, enemy_of, etc.)
  - NPC ↔ Faction: 66
  - NPC ↔ Location: 79
  - NPC ↔ Ability: 37

World-level: 344 (31%)
  - Faction ↔ Faction: 300 (mostly enemy_of)
  - Location ↔ Location: 25 (geographic facts)
  - Faction ↔ Location: 7 (only originated_in!)
  - Location ↔ Ability: 12
```

**Goal**: Invert to 30% NPC, 70% world-level

**Solution**: See WORLD_LEVEL_SYSTEMS_DESIGN.md

## Current Architecture Issues

### Problem 1: Immutability Semantics

**Geographic facts** (adjacent_to, contains) should NEVER decay/reinforce/cull
**Historical facts** (originated_in, discoverer_of) should be immutable
**Supernatural facts** (slumbers_beneath, manifests_at) should be permanent

But currently ALL relationships go through decay/reinforcement/culling systems.

**Proposed Fix** (post-refactor):
```typescript
const IMMUTABLE_KINDS = [
  'adjacent_to', 'contains', 'contained_by',
  'originated_in', 'founded_by', 'discoverer_of',
  'slumbers_beneath', 'manifests_at'
];
// Skip all system processing for these
```

### Problem 2: Missing World-Level Systems

Need systems that create:
- Faction ↔ Location: `controls`, `contests`, `sieges`
- Faction ↔ Ability: `weaponizes`, `monopolizes`, `bans`
- Location ↔ Ability: `corrupted_by`, `blessed_by`, `scarred_by`
- Location ↔ Location: `rival_of`, `trade_routes`

See WORLD_LEVEL_SYSTEMS_DESIGN.md for full design.

### Problem 3: Framework/Domain Coupling

Current systems mix:
- Framework concerns (how to apply systems)
- Domain concerns (what relationships mean)
- Parameter management (hardcoded vs configurable)

**Planned Refactor**: Decouple these for cleaner system composition

## Files Modified in This Session

### world-gen/
- `src/systems/relationshipReinforcement.ts` - Added structuralBonus parameter
- `config/templateSystemParameters.json` - Added structuralBonus config

### world-gen-optimizer/
- `src/types.ts` - Added violationMetrics to Individual type
- `src/configLoader.ts` - Parameter extraction and bounds inference
- `src/fitnessEvaluator.ts` - Weighted fitness with violation penalties
- `src/geneticAlgorithm.ts` - Fixed individual ID format, integrated adaptive mutation
- `src/adaptiveMutation.ts` - Impact-based, component-focused, annealing strategies
- `src/worldGenRunner.ts` - Parallel execution, run-id segregation
- `src/diagnostics.ts` - GA health checks (stagnation, violations, fitness bugs)
- `src/index.ts` - Main GA loop with diagnostics

### Analysis Scripts (world-gen-optimizer/scripts/)
- `analyze-violations.ts` - Which relationship kinds cause violations
- `check-bounds.ts` - Which parameters stuck at min/max
- `analyze-relationship-semantics.ts` - Semantic categorization of relationships
- `analyze-coverage.ts` - System coverage gaps, emergence vs coverage question
- `analyze-system-focus.ts` - NPC vs world-level relationship analysis

### Documentation
- `BUG_FIXES.md` - GA bug investigation and fixes
- `WORLD_LEVEL_SYSTEMS_DESIGN.md` - Future world-level systems design
- `CURRENT_STATUS.md` - This file

## What to Do When You Return

### Option A: Proceed with GA Optimization (Current State)

If you want to test the current system:
```bash
cd world-gen-optimizer
npm run dev
```

The GA will now optimize with the structuralBonus parameter. It should find values that reduce violations below target, but the semantic issues remain.

### Option B: Framework Refactor (Recommended)

Before adding world-level systems:
1. Decouple framework from domain concerns
2. Create relationship category system (immutable, political, economic, social)
3. Make systems check category metadata before applying
4. Clean up parameter management

Then implement world-level systems per WORLD_LEVEL_SYSTEMS_DESIGN.md.

### Option C: Quick Fix First, Refactor Later

1. Add IMMUTABLE_KINDS exemption to decay/reinforcement/culling
2. Remove structuralBonus (no longer needed)
3. Run GA to optimize remaining parameters
4. Then do framework refactor + world systems

## Key Insights to Remember

1. **Emergence vs Coverage**: We chose emergence (simple systems, accept gaps) but discovered we need world-level systems for game lore

2. **Entity Focus Matters**: NPCs are least important for game lore, but systems focus 69% on them

3. **Semantic Categories**: Not all relationships should behave the same (facts vs bonds vs politics)

4. **Power Laws Need Hubs**: Currently only NPCs create hubs; need faction/location hubs via world systems

5. **Parameters Can't Fix Semantic Problems**: No amount of tuning makes geographic facts not decay - need architecture changes

## Parameters Added This Session

```json
{
  "relationship_reinforcement": {
    "structuralBonus": {
      "value": 0.02,
      "comment": "Per-tick reinforcement for structural relationships"
    }
  }
}
```

Total tunable parameters: 87 (was 86)

## Unresolved Questions

1. Should we keep structuralBonus after refactor, or replace with category-based logic?
2. What's the right ratio of world/NPC relationships for game lore? (Currently targeting 70/30)
3. Should world-level systems have cascading effects (e.g., territorial control → weaponization)?
4. How do we prevent world-level systems from creating too much chaos (same problem as NPC systems)?
5. What role should NPCs play post-refactor? Quest givers? Flavor? Remove entirely?

## References

- GA optimizer code: `/world-gen-optimizer/`
- Analysis scripts: `/world-gen-optimizer/scripts/`
- Bug fixes log: `/world-gen-optimizer/BUG_FIXES.md`
- Future design: `/WORLD_LEVEL_SYSTEMS_DESIGN.md`
- Original architecture: `/world-gen/ARCHITECTURE.md`
- Project instructions: `/CLAUDE.md`
