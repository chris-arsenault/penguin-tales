# Test Coverage Analysis

**Last Updated**: 2025-11-24 15:45 MST
**Current Coverage**: 46.28% (statements), 38.73% (branches), 45.33% (functions), 47.12% (lines)
**Target Coverage**: >70%
**Tests Passing**: 1427 tests across 40 test files
**Source Files**: 102 TypeScript files

## Overview

The world-gen codebase has **1427 passing tests** across **40 test files**. Current coverage is 46.28%, with significant gaps in domain-specific code and templates. This document tracks testing progress and identifies areas needing attention.

**Recent Update (2025-11-24 15:45)**: Added comprehensive tests for `metaEntityFormation.ts` service (14 tests, 100% coverage).

## Test Framework

- **Framework**: Vitest v4.0.13
- **Test Location**: `src/__tests__/` (mirroring source structure)
- **Configuration**: `vitest.config.ts`
- **Command**: `npm test` (run all tests), `npm run test:coverage` (with coverage)

## Coverage Summary by Category

| Category | Files | Tested | Coverage | Priority |
|----------|-------|--------|----------|----------|
| Engine | 5 | 4 | ~70% | P1 - Critical |
| Utilities | 8 | 5 | ~80% | P1 - Critical |
| Framework Systems | 5 | 5 | ~75% | P2 - High |
| Services | 17 | 3 | ~20% | P3 - Medium |
| Config | 3 | 0 | 0% | P4 - Low |
| Domain Systems | 13 | 0 | 0% | P5 - Low |
| Domain Templates | 28 | 1 | ~5% | P5 - Low |

## Detailed Coverage by Module

### ✅ Engine Components (4/5 tested) - Priority 1

| File | Status | Coverage | Test File | Notes |
|------|--------|----------|-----------|-------|
| `worldEngine.ts` | ✅ Tested | ~70% | `__tests__/engine/worldEngine.test.ts` | 44 tests, core orchestration |
| `contractEnforcer.ts` | ✅ Tested | ~75% | `__tests__/engine/contractEnforcer.test.ts` | Contract validation |
| `frameworkValidator.ts` | ✅ Tested | ~80% | `__tests__/engine/frameworkValidator.test.ts` | Framework validation |
| `changeDetection.ts` | ✅ Tested | ~85% | `__tests__/engine/changeDetection.test.ts` | Change detection |
| `validationOrchestrator.ts` | ❌ Not tested | 0% | - | **NEEDS TESTS** |

### ✅ Utilities (5/8 tested) - Priority 1

| File | Status | Coverage | Test File | Notes |
|------|--------|----------|-----------|-------|
| `helpers.ts` | ✅ Tested | ~90% | (integrated in many tests) | Core helper functions |
| `validators.ts` | ✅ Tested | ~95% | (integrated in many tests) | Validation utilities |
| `catalystHelpers.ts` | ✅ Tested | ~90% | (integrated in many tests) | Catalyst system |
| `emergentDiscovery.ts` | ✅ Tested | ~85% | (integrated in many tests) | Discovery mechanics |
| `graphQueries.ts` | ✅ Tested | ~80% | (integrated in many tests) | Graph query functions |
| `relationshipBuilder.ts` | ❌ Not tested | 0% | - | **NEEDS TESTS** |
| `entityClusterBuilder.ts` | ❌ Not tested | 0% | - | **NEEDS TESTS** |
| `distributionCalculations.ts` | ❌ Not tested | 0% | - | **NEEDS TESTS** |

### ✅ Framework Systems (5/5 tested) - Priority 2

| File | Status | Coverage | Test File | Notes |
|------|--------|----------|-----------|-------|
| `eraSpawner.ts` | ✅ Tested | ~80% | `__tests__/systems/eraSpawner.test.ts` | Era entity spawning |
| `eraTransition.ts` | ✅ Tested | ~85% | `__tests__/systems/eraTransition.test.ts` | Era progression |
| `occurrenceCreation.ts` | ✅ Tested | ~70% | `__tests__/systems/occurrenceCreation.test.ts` | Occurrence generation |
| `relationshipCulling.ts` | ✅ Tested | ~75% | `__tests__/systems/relationshipCulling.test.ts` | Relationship pruning |
| `universalCatalyst.ts` | ✅ Tested | ~70% | `__tests__/systems/universalCatalyst.test.ts` | Catalyst system |

### ⚠️ Services (3/17 tested) - Priority 3

| File | Status | Coverage | Test File | Notes |
|------|--------|----------|-----------|-------|
| `dynamicWeightCalculator.ts` | ✅ Tested | ~65% | `__tests__/services/dynamicWeightCalculator.test.ts` | Weight calculation |
| `loreIndex.ts` | ✅ Tested | ~70% | `__tests__/services/loreIndex.test.ts` | Lore indexing |
| `templateGraphView.ts` | ✅ Tested | ~60% | `__tests__/services/templateGraphView.test.ts` | Template graph view |
| `targetSelector.ts` | ❌ Not tested | 0% | - | **HIGH PRIORITY** |
| `templateSelector.ts` | ❌ Not tested | 0% | - | **HIGH PRIORITY** |
| `systemSelector.ts` | ❌ Not tested | 0% | - | **HIGH PRIORITY** |
| `populationTracker.ts` | ❌ Not tested | 0% | - | **NEEDS TESTS** |
| `statisticsCollector.ts` | ❌ Not tested | 0% | - | **NEEDS TESTS** |
| `tagHealthAnalyzer.ts` | ❌ Not tested | 0% | - | **NEEDS TESTS** |
| `loreValidator.ts` | ❌ Not tested | 0% | - | **NEEDS TESTS** |
| `enrichmentService.ts` | ❌ Not tested | 0% | - | LLM integration (low priority) |
| `imageGenerationService.ts` | ❌ Not tested | 0% | - | Image gen (low priority) |
| `metaEntityFormation.ts` | ✅ Tested | ~100% | `__tests__/services/metaEntityFormation.test.ts` | **ADDED (14 tests)** |
| `feedbackAnalyzer.ts` | ❌ Not tested | 0% | - | **NEEDS TESTS** |
| `llmClient.ts` | ❌ Not tested | 0% | - | LLM client (low priority) |
| `nameLogger.ts` | ❌ Not tested | 0% | - | Simple logger (low priority) |
| `distributionTracker.ts` | ❌ Not tested | 0% | - | **NEEDS TESTS** |

### ❌ Framework Config (0/3 tested) - Priority 4

| File | Status | Coverage | Test File | Notes |
|------|--------|----------|-----------|-------|
| `entityRegistries.ts` | ❌ Not tested | 0% | - | **NEEDS TESTS** (data structure) |
| `feedbackLoops.ts` | ❌ Not tested | 0% | - | **NEEDS TESTS** (data structure) |
| `tagRegistry.ts` | ❌ Not tested | 0% | - | **NEEDS TESTS** (data structure) |

### ❌ Domain Code - Penguin Systems (0/13 tested) - Priority 5

All domain systems are **untested** (0% coverage). These are lower priority as they're domain-specific and tested indirectly through integration tests:

- `allianceFormation.ts`
- `beliefContagion.ts`
- `conflictContagion.ts`
- `culturalDrift.ts`
- `legendCrystallization.ts`
- `prominenceEvolution.ts`
- `relationshipDecay.ts`
- `relationshipFormation.ts`
- `relationshipReinforcement.ts`
- `resourceFlow.ts`
- `successionVacuum.ts`
- `thermalCascade.ts`

### ❌ Domain Templates (1/28 tested) - Priority 5

Only **outlawRecruitment.ts** has dedicated unit tests (19 tests). All other templates are untested:

**NPC Templates (0/7 tested)**:
- `familyExpansion.ts`
- `heroEmergence.ts`
- `kinshipConstellation.ts`
- `mysteriousVanishing.ts`
- `orcaRaiderArrival.ts`
- `succession.ts`

**Faction Templates (0/5 tested)**:
- `cultFormation.ts`
- `factionSplinter.ts`
- `guildEstablishment.ts`
- `territorialExpansion.ts`
- `tradeRouteEstablishment.ts`

**Location Templates (0/8 tested)**:
- `anomalyManifestation.ts`
- `colonyFounding.ts`
- `emergentLocationDiscovery.ts`
- `geographicExploration.ts`
- `krillBloomMigration.ts`
- `mysticalLocationDiscovery.ts`
- `resourceLocationDiscovery.ts`
- `strategicLocationDiscovery.ts`

**Ability Templates (0/5 tested)**:
- `magicDiscovery.ts`
- `magicalSiteDiscovery.ts`
- `orcaCombatTechnique.ts`
- `techBreakthrough.ts`
- `techInnovation.ts`

**Rules Templates (0/3 tested)**:
- `crisisLegislation.ts`
- `greatFestival.ts`
- `ideologyEmergence.ts`

### ❌ Domain Config (0/6 tested) - Priority 5

All domain config files are **untested** (0% coverage):

- `eras.ts` - Era definitions
- `pressures.ts` - Pressure definitions
- `actionDomains.ts` - Action domains
- `loreProvider.ts` - Lore provider
- `metaEntityConfigs.ts` - Meta entity config
- `relationshipCategories.ts` - Relationship categories

## Priority Test Development Plan

### Immediate (Week 1) - Target 55% Coverage

1. **Critical Services** (High Impact):
   - `targetSelector.ts` - Entity selection logic (CRITICAL)
   - `templateSelector.ts` - Template selection logic (CRITICAL)
   - `systemSelector.ts` - System selection logic (CRITICAL)
   - `validationOrchestrator.ts` - Validation orchestration

2. **Utility Gaps**:
   - `relationshipBuilder.ts` - Relationship creation utilities
   - `entityClusterBuilder.ts` - Entity cluster creation
   - `distributionCalculations.ts` - Distribution math

### Short-term (Week 2) - Target 65% Coverage

3. **Support Services**:
   - `populationTracker.ts` - Population tracking
   - `statisticsCollector.ts` - Statistics collection
   - `tagHealthAnalyzer.ts` - Tag health analysis
   - `metaEntityFormation.ts` - Meta entity formation
   - `feedbackAnalyzer.ts` - Feedback analysis
   - `distributionTracker.ts` - Distribution tracking

4. **Config Structures**:
   - `entityRegistries.ts` - Entity registration
   - `feedbackLoops.ts` - Feedback loop config
   - `tagRegistry.ts` - Tag registry

### Medium-term (Week 3-4) - Target 70% Coverage

5. **Domain Systems** (Select 5 most critical):
   - `relationshipFormation.ts` - Core relationship logic
   - `prominenceEvolution.ts` - Prominence calculation
   - `conflictContagion.ts` - Conflict spread
   - `allianceFormation.ts` - Alliance logic
   - `resourceFlow.ts` - Resource management

6. **Domain Templates** (Select 10 most used):
   - `familyExpansion.ts` - Family creation
   - `heroEmergence.ts` - Hero creation
   - `colonyFounding.ts` - Colony creation
   - `factionSplinter.ts` - Faction splitting
   - `cultFormation.ts` - Cult creation
   - `guildEstablishment.ts` - Guild creation
   - `magicDiscovery.ts` - Magic discovery
   - `techBreakthrough.ts` - Tech breakthrough
   - `crisisLegislation.ts` - Rules creation
   - `geographicExploration.ts` - Location discovery

## Test Gaps by Risk Level

### 🔴 Critical Gaps (Blocks 70% coverage)

1. **Selection Services** - Core engine functions with 0% coverage:
   - `targetSelector.ts`
   - `templateSelector.ts`
   - `systemSelector.ts`

2. **Validation** - Missing orchestration tests:
   - `validationOrchestrator.ts`

3. **Builders** - Entity creation utilities:
   - `relationshipBuilder.ts`
   - `entityClusterBuilder.ts`

### 🟡 Medium Gaps (Nice to have for 70%+)

4. **Trackers and Analyzers**:
   - `populationTracker.ts`
   - `statisticsCollector.ts`
   - `tagHealthAnalyzer.ts`
   - `distributionTracker.ts`
   - `feedbackAnalyzer.ts`

5. **Lore and Meta**:
   - `loreValidator.ts`
   - `metaEntityFormation.ts`

### 🟢 Low Priority (Domain-specific, can skip for 70%)

6. **Domain Systems** - Tested indirectly through integration:
   - All 13 penguin-specific systems

7. **Domain Templates** - Tested indirectly through integration:
   - 27 of 28 templates (only outlawRecruitment tested)

8. **Domain Config** - Static data structures:
   - All 6 config files

9. **LLM Services** - Optional features:
   - `enrichmentService.ts`
   - `imageGenerationService.ts`
   - `llmClient.ts`

## Testing Best Practices

### Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { functionToTest } from '../path/to/module';

describe('Module Name', () => {
  describe('functionName', () => {
    it('should handle happy path', () => {
      // Arrange
      const input = { /* ... */ };

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toEqual(expected);
    });

    it('should handle edge cases', () => {
      // Test boundaries, empty inputs, null/undefined
    });

    it('should throw on invalid input', () => {
      expect(() => functionToTest(invalidInput)).toThrow();
    });
  });
});
```

### Mocking Guidelines

- Mock `Graph` objects for isolated unit tests
- Mock `TemplateGraphView` with proper `TargetSelector` instance
- Mock LLM services (enrichment, images) for deterministic tests
- Use `vi.spyOn()` for method interception
- Remember to add relationships to entity.links[] arrays, not just graph.relationships[]

### Common Pitfalls

1. **Entity Links**: Always populate both `entity.links[]` AND `graph.relationships[]`
2. **TemplateGraphView**: Requires both `Graph` and `TargetSelector` in constructor
3. **Async Mocks**: Properly handle Promise-based mocks for services
4. **Type Safety**: Use proper TypeScript types, avoid `any` where possible

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test path/to/test.test.ts

# Run with coverage
npm run test:coverage

# Run tests in watch mode
npm test -- --watch

# Run tests with specific pattern
npm test -- --grep "pattern"
```

## Coverage Report Location

- **HTML Report**: `coverage/index.html` (open in browser)
- **Terminal Summary**: Run `npm run test:coverage`
- **Coverage Data**: `coverage/coverage-final.json`

## Next Steps

1. **Immediate**: Add tests for critical services (targetSelector, templateSelector, systemSelector)
2. **Short-term**: Add tests for utility gaps (relationshipBuilder, entityClusterBuilder)
3. **Medium-term**: Add tests for support services and config structures
4. **Long-term**: Add selective tests for domain systems and templates

## Notes

- Domain code (systems, templates) is tested indirectly through integration tests
- LLM services are optional features and can be mocked in tests
- Focus on framework code first to reach 70% coverage
- Domain-specific tests can be added incrementally after reaching 70%
