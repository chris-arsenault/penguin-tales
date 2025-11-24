# Architecture Improvement Guide for Penguin History World Generator

**Target Directory**: `world-gen/` only (do NOT modify `world-explorer/` or `world-gen-optimizer/`)

**Tech Stack**: TypeScript, Node.js, Vitest for testing

**Architecture Pattern**: Domain/Framework separation
- Framework code: `src/engine/`, `src/systems/`, `src/types/`, `src/utils/`, `src/services/`
- Domain code: `src/domain/penguin/` (penguin-specific templates, systems, config, data)

You are an expert software architect and test engineer tasked with comprehensively improving the world-gen codebase. Work methodically through multiple passes, continuing until you've addressed all areas. DO NOT stop early - this is an overnight task and thoroughness is more important than speed.

## Phase 1: Discovery and Planning (First 30 minutes)

1. **Analyze Repository Structure**
   - Focus on `world-gen/src/` directory structure
   - Map out framework vs domain separation
   - Identify dependencies between framework and domain code
   - Document template/system registration flow

2. **Understand Current Architecture**
   - Read existing `world-gen/ARCHITECTURE.md` and `world-gen/CLAUDE.md`
   - Understand the hybrid template + simulation model
   - Map entity types, relationship kinds, and graph operations
   - Identify core abstractions: Graph, HardState, Relationship, GrowthTemplate, SimulationSystem

3. **Create Analysis Documents** in `world-gen/`:
   - `TEST_COVERAGE.md` - Current test coverage status by module
   - `REFACTORING_TODO.md` - Organized list of improvements needed:
     - Missing tests (list every untested function/class)
     - Code duplication instances
     - Violated SOLID principles
     - Tightly coupled components
     - Missing abstractions
     - Poor naming conventions
     - Missing documentation
     - Framework/domain boundary violations

## Phase 2: Test Coverage (Iterate until >70% coverage)

**Test Framework**: Vitest (already configured in `world-gen/vitest.config.ts`)

**Test Location**: `world-gen/src/__tests__/` (mirror source structure)

**Priority Order**:
1. Core framework utilities (`src/utils/helpers.ts`, `src/utils/validators.ts`)
2. Engine components (`src/engine/worldEngine.ts`, `src/engine/contractEnforcer.ts`)
3. Framework systems (`src/systems/*.ts`)
4. Domain-specific code (`src/domain/penguin/**`)

**For EACH module without tests**:
1. Create test file: `src/__tests__/[module-path]/[filename].test.ts`
2. Write comprehensive unit tests:
   - Happy path scenarios
   - Edge cases (empty inputs, boundary values, null/undefined)
   - Error conditions
   - Type safety checks
3. Mock external dependencies (Graph, config objects, etc.)
4. Run tests: `npm test [pattern]`
5. Measure coverage: `npm run test:coverage`
6. Document coverage in `TEST_COVERAGE.md`

**Testing Patterns**:
```typescript
// Example test structure
import { describe, it, expect, beforeEach } from 'vitest';
import { functionToTest } from '../utils/helpers';

describe('functionToTest', () => {
  it('should handle happy path', () => {
    // Test normal operation
  });

  it('should handle edge cases', () => {
    // Test boundaries, empty inputs, etc.
  });

  it('should throw on invalid input', () => {
    expect(() => functionToTest(invalidInput)).toThrow();
  });
});
```

**DO NOT** move to next phase until you've attempted tests for EVERY untested function.

## Phase 3: Refactoring Iterations (Repeat 5+ times)

Perform multiple refactoring passes. In each pass, run tests after changes to ensure nothing breaks.

### Pass A: Extract Abstractions

**Focus Areas**:
- Template/system metadata boilerplate → shared factory functions
- Relationship creation patterns → builder utilities
- Entity finding/filtering → query DSL or helper methods
- Repeated graph traversal logic → graph query utilities
- Configuration validation → schema validators

**Example Patterns**:
```typescript
// Before: Repeated relationship creation
graph.relationships.push({ kind: 'trades_with', src: a, dst: b, strength: 0.5 });

// After: Helper function
addRelationship(graph, { kind: 'trades_with', from: a, to: b, strength: 0.5 });
```

### Pass B: Separation of Concerns

**Framework/Domain Boundaries**:
- Ensure `src/engine/` only contains domain-agnostic code
- Move penguin-specific logic from framework to `src/domain/penguin/`
- Extract hardcoded penguin data to configuration files
- Create clear interfaces between framework and domain

**File Structure Guidelines**:
- If a file has >400 lines, consider splitting by responsibility
- If a class has >5 public methods, evaluate if it does multiple things
- Separate data transformation from business logic
- Isolate I/O operations (file reads, JSON parsing) from core logic

**Example Refactorings**:
```typescript
// Split large files
worldEngine.ts (800 lines) →
  - worldEngine.ts (core orchestration)
  - growthPhase.ts (template execution)
  - simulationPhase.ts (system execution)
  - graphBuilder.ts (graph construction)
```

### Pass C: SOLID Principles

**Single Responsibility**:
- Each template should create ONE type of entity cluster
- Each system should modify ONE aspect of world state
- Each helper function should do ONE thing

**Open/Closed**:
- Use strategy pattern for template selection algorithms
- Plugin architecture for new entity kinds
- Extensible pressure/system/template registries

**Dependency Inversion**:
- Inject domain schema into framework engine (already done via `domain` property)
- Pass dependencies through constructors, not global imports
- Use interfaces for external services (enrichment, image generation)

**Interface Segregation**:
- Split large contracts into focused interfaces
- Don't require templates to implement unused metadata fields

### Pass D: Code Quality

**Naming Improvements**:
- Use domain terminology consistently (entity vs node, relationship vs edge)
- Avoid abbreviations unless standard (npc → keep, ent → entity)
- Method names should be verbs (getEntity, createRelationship, applySystem)
- Boolean variables should be predicates (isActive, hasChildren, canApply)

**Documentation Standards**:
- Every template/system should have JSDoc with:
  - Purpose and behavior
  - Example usage
  - Contract violations to avoid
- Complex algorithms should have inline comments explaining WHY
- Type definitions should have descriptive comments

**Error Handling**:
- Use typed error classes for different failure modes
- Validate inputs at public API boundaries
- Fail fast with descriptive error messages
- Add context to re-thrown errors

## Phase 4: Architecture Improvements

### Existing Architecture (Preserve)
The codebase already has good separation:
- **Engine Layer**: Framework orchestration (`worldEngine.ts`, `contractEnforcer.ts`)
- **Domain Layer**: Penguin-specific content (`domain/penguin/`)
- **Data Layer**: JSON config files, initial state

**DO NOT** drastically restructure this - it works well.

### Targeted Improvements

1. **Strengthen Type Safety**:
   - Add strict TypeScript checks where missing
   - Use discriminated unions for entity subtypes
   - Type-safe relationship kind validation

2. **Improve Observability**:
   - Add structured logging with log levels
   - Emit events for major state transitions
   - Performance instrumentation for bottlenecks

3. **Configuration Validation**:
   - JSON schema validation for config files
   - Startup validation of template/system contracts
   - Better error messages for invalid config

4. **Design Patterns to Consider**:
   - **Builder Pattern**: For complex Graph construction
   - **Strategy Pattern**: For template selection algorithms (already partially present)
   - **Observer Pattern**: For system notifications
   - **Factory Pattern**: For entity/relationship creation with validation

5. **Architectural Decision Records (ADRs)**:
   - Create `world-gen/docs/adr/` directory
   - Document major architectural decisions:
     - Why hybrid template+simulation model?
     - Why domain/framework separation?
     - Why pressure-based template triggering?
     - Why relationship culling system?

## Phase 5: Validation and Documentation

1. **Run Full Test Suite**:
   ```bash
   cd world-gen
   npm test
   npm run test:coverage
   ```
   - Fix any broken tests
   - Ensure coverage >70%

2. **Update Documentation**:
   - Update `world-gen/CLAUDE.md` with:
     - New test running instructions
     - Any architectural changes
     - New utility functions available
   - Update `world-gen/README.md` (create if missing)
   - Generate `IMPROVEMENTS.md` listing all changes

3. **Code Quality**:
   ```bash
   npm run lint
   npm run build
   ```
   - Fix any linting errors
   - Ensure TypeScript compilation succeeds
   - Clean up unused imports

4. **Verification**:
   - Run a full world generation: `npm start`
   - Verify output is valid
   - Check performance hasn't regressed

## Phase 6: Advanced Improvements (If Time Permits)

1. **Performance Optimization**:
   - Profile world generation: identify bottlenecks
   - Optimize hot paths (relationship lookups, entity filtering)
   - Consider caching frequently accessed data
   - Benchmark before/after improvements

2. **Integration Tests**:
   - Full world generation test (seed → valid output)
   - Template application tests (canApply → expand → validate)
   - System application tests (graph state → modifications)
   - Era progression test (spawn → transitions)

3. **Developer Experience**:
   - Add debug mode with verbose logging
   - Create example templates/systems as guides
   - Add validation tools for custom templates
   - Generate API documentation from JSDoc

4. **CI/CD Setup** (if not present):
   - GitHub Actions workflow for tests
   - Automated test coverage reporting
   - TypeScript compilation check
   - Linting enforcement

## Critical Instructions

### Scope Limitations
- **ONLY WORK IN**: `world-gen/` directory
- **DO NOT MODIFY**: `world-explorer/`, `world-gen-optimizer/`, or root-level files (except this file)
- **PRESERVE**: Existing architectural patterns (domain/framework separation)

### Work Methodology
- CONTINUE WORKING through all phases even if it takes hours
- After completing Phase 5, return to Phase 2 for any remaining untested code
- Use frequent, small commits with clear messages
- Run tests after each refactoring to catch regressions
- Document decisions in ADRs for major changes

### Progress Tracking
- Create `world-gen/PROGRESS.log` file
- Every 30 minutes, append entry with:
  - Timestamp
  - Current phase
  - Files modified
  - Tests added
  - Coverage percentage
  - Next steps

### Git Workflow
```bash
cd world-gen
git checkout -b autonomous-improvements
# ... make changes ...
git add .
git commit -m "feat: add tests for helpers.ts utility functions"
# Repeat frequently
```

## Success Criteria

By completion, the world-gen codebase should have:

- ✅ >70% test coverage (measured by Vitest)
- ✅ All critical paths tested (worldEngine, contractEnforcer, helpers)
- ✅ Zero TypeScript compilation errors
- ✅ Zero linting errors
- ✅ Clean separation of framework and domain concerns
- ✅ Comprehensive documentation for all public APIs
- ✅ IMPROVEMENTS.md summarizing all changes
- ✅ Updated CLAUDE.md with new information
- ✅ All tests passing (`npm test`)
- ✅ Successful world generation (`npm start`)

## Reference Files

Before starting, review these key files:
- `world-gen/CLAUDE.md` - Project overview and domain knowledge
- `world-gen/ARCHITECTURE.md` - Current architecture documentation
- `world-gen/src/types/worldTypes.ts` - Core type definitions
- `world-gen/src/types/engine.ts` - Engine and contract types
- `world-gen/src/engine/worldEngine.ts` - Main orchestration logic

Remember: The goal is to wake up to a significantly improved codebase with excellent test coverage, clean architecture, and well-documented code. Be thorough rather than quick. If you complete everything, find more improvements to make. Keep working.
