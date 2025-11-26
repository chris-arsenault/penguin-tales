# Architecture Improvement Guide for Penguin History World Generator

**Target Directory**: `world-gen/` only (do NOT modify `world-explorer/` or `world-gen-optimizer/`)

**Tech Stack**: TypeScript, Node.js, Vitest for testing

**Architecture Pattern**: Domain/Framework separation
- Framework code: `src/engine/`, `src/systems/`, `src/types/`, `src/utils/`, `src/services/`
- Domain code: `src/domain/penguin/` (penguin-specific templates, systems, config, data)

---

## ⚠️ CRITICAL: Work-First Methodology

**DO NOT** create progress reports, analysis documents, or documentation until the very end.
**DO NOT** write PROGRESS.log entries or TEST_COVERAGE.md updates during work.
**DO** write tests, refactor code, and make actual improvements continuously.

Your time breakdown should be:
- **95% actual coding**: Writing tests, refactoring, improving code
- **5% documentation**: Only at the very end, summarize what you did

---

## Quick Start (Do This First)

1. Read `world-gen/CLAUDE.md` and `world-gen/ARCHITECTURE.md` (5 min max)
2. Run `npm run test:coverage` to see current coverage
3. Start writing tests immediately

---

## Phase 1: Write Tests (Primary Focus - 70% of your time)

**Goal**: Get to >70% test coverage by writing tests continuously.

**Test Location**: `world-gen/src/__tests__/` (mirror source structure)

**Work in batches of 10-15 tests before any pause.** Do not stop to document or report after each test.

**Priority Order** (work through ALL of these):
1. `src/utils/helpers.ts` - all utility functions
2. `src/utils/validators.ts` - all validators
3. `src/engine/worldEngine.ts` - core engine logic
4. `src/engine/contractEnforcer.ts` - contract enforcement
5. `src/systems/*.ts` - each simulation system
6. `src/domain/penguin/templates/*.ts` - each template
7. `src/domain/penguin/systems/*.ts` - domain systems

**For each file, write tests for ALL exported functions before moving to the next file.**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { functionToTest } from '../path/to/module';

describe('functionToTest', () => {
  it('handles normal input', () => { /* test */ });
  it('handles empty input', () => { /* test */ });
  it('handles edge cases', () => { /* test */ });
  it('throws on invalid input', () => { /* test */ });
});
```

**Run tests frequently**: `npm test` after every 3-5 tests to catch issues early.

---

## Phase 2: Refactoring (25% of your time)

**Only start this after you have >50% test coverage.**

Do refactoring in focused batches. Complete 5-10 related refactors before running regression check.

### Refactoring Targets (work through all):

**Extract Common Patterns**:
- Relationship creation → builder utilities
- Entity filtering → query helpers
- Graph traversal → reusable functions

**Clean Up Code**:
- Remove duplication
- Improve naming
- Add type safety where missing
- Split files >400 lines

**Strengthen Boundaries**:
- Move penguin-specific code to `domain/penguin/`
- Keep `engine/` domain-agnostic

### Regression Check (Once per phase, not per pass)

Run ONE regression check after completing all refactoring:

```bash
cd world-gen && npm run build && npm start
```

Must pass: No crashes, all 5 eras reached, entities generated each epoch.

If it fails, fix immediately then continue.

---

## Phase 3: Final Validation and Documentation (5% of your time)

**Only do this at the very end after all tests and refactoring are complete.**

1. Run final test suite: `npm test && npm run test:coverage`
2. Run final regression: `npm run build && npm start`
3. Create ONE summary file `IMPROVEMENTS.md` listing what you accomplished
4. Update `CLAUDE.md` only if architecture changed significantly

---

## Work Rules

1. **Minimize overhead**: No progress logs, no interim reports, no analysis documents
2. **Batch your work**: Write 10+ tests before pausing, do 5+ refactors before checking
3. **Stay in code**: Your output should be test files and improved source files
4. **One regression check per phase**: Not after every change
5. **Document at end only**: Create IMPROVEMENTS.md as final step

## Success Criteria

- ✅ >70% test coverage
- ✅ All tests passing
- ✅ Regression check passes (runs, 5 eras, entities each epoch)
- ✅ TypeScript compiles without errors
- ✅ One IMPROVEMENTS.md summarizing changes

---

## Reference: Test Writing Targets

Write tests for ALL exports in these files (in order):

### Utils (do all of these first)
- `helpers.ts`: generateName, generateId, pickRandom, pickMultiple, findEntities, getRelated, getLocation, getFactionMembers, hasRelationship
- `validators.ts`: all validation functions

### Engine (critical path)
- `worldEngine.ts`: runGrowthPhase, runSimulationPhase, selectTemplates, applyTemplate
- `contractEnforcer.ts`: validateEntity, validateRelationship, enforceContracts

### Systems
- Test each system's `apply()` method with mock graphs
- Test edge cases: empty graph, no matching entities, max capacity

### Templates
- Test each template's `canApply()` and `expand()` methods
- Test with various graph states and pressure levels

---

## Reference: Refactoring Checklist

Work through these quickly without documenting each one:

- [ ] Extract repeated relationship creation to helper
- [ ] Extract repeated entity queries to helper
- [ ] Split any file >400 lines
- [ ] Move hardcoded penguin strings to config
- [ ] Add missing TypeScript types
- [ ] Remove dead code
- [ ] Rename unclear variables/functions

---

## Scope

- **ONLY WORK IN**: `world-gen/` directory
- **DO NOT MODIFY**: `world-explorer/`, `world-gen-optimizer/`
- **PRESERVE**: Domain/framework separation pattern

---

## Git Workflow

Commit after completing each file's tests (not after each test):

```bash
git add . && git commit -m "test: add tests for helpers.ts"
```

---

## Final Checklist (only check at the very end)

- [ ] `npm test` passes
- [ ] `npm run test:coverage` shows >70%
- [ ] `npm run build && npm start` completes without error
- [ ] Created `IMPROVEMENTS.md` with summary of changes
