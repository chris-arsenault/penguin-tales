# Test Coverage Analysis

**Generated**: 2025-11-24 04:01 MST
**Current Coverage**: 0%
**Target Coverage**: >70%

## Overview

The world-gen codebase currently has **zero test coverage**. This document tracks the testing progress for all 96 TypeScript files in the project.

## Test Framework

- **Framework**: Vitest (to be installed)
- **Test Location**: `src/__tests__/` (mirroring source structure)
- **Configuration**: vitest.config.ts (to be created)

## Coverage by Module

### ✅ Framework Core (Priority 1)

#### Engine Components (0/3 tested)
- [ ] `src/engine/worldEngine.ts` - Main orchestrator (0% coverage)
- [ ] `src/engine/contractEnforcer.ts` - Contract validation (0% coverage)
- [ ] `src/engine/frameworkValidator.ts` - Framework validation (0% coverage)

#### Utilities (0/5 tested)
- [ ] `src/utils/helpers.ts` - Core helper functions (0% coverage)
- [ ] `src/utils/validators.ts` - Validation utilities (0% coverage)
- [ ] `src/utils/catalystHelpers.ts` - Catalyst system helpers (0% coverage)
- [ ] `src/utils/emergentDiscovery.ts` - Discovery mechanics (0% coverage)
- [ ] `src/utils/parameterOverrides.ts` - Parameter overrides (0% coverage)

#### Types (0/7 tested)
- [ ] `src/types/worldTypes.ts` - Core type definitions (0% coverage)
- [ ] `src/types/engine.ts` - Engine interfaces (0% coverage)
- [ ] `src/types/domainSchema.ts` - Domain schema types (0% coverage)
- [ ] `src/types/domainLore.ts` - Lore types (0% coverage)
- [ ] `src/types/lore.ts` - Lore interfaces (0% coverage)
- [ ] `src/types/statistics.ts` - Statistics types (0% coverage)
- [ ] `src/types/distribution.ts` - Distribution types (0% coverage)

### ✅ Framework Systems (Priority 2)

#### Core Systems (0/5 tested)
- [ ] `src/systems/eraSpawner.ts` - Era entity spawning (0% coverage)
- [ ] `src/systems/eraTransition.ts` - Era progression (0% coverage)
- [ ] `src/systems/occurrenceCreation.ts` - Occurrence generation (0% coverage)
- [ ] `src/systems/relationshipCulling.ts` - Relationship management (0% coverage)
- [ ] `src/systems/universalCatalyst.ts` - Catalyst system (0% coverage)

### ✅ Services (Priority 3)

#### Support Services (0/15 tested)
- [ ] `src/services/dynamicWeightCalculator.ts` - Weight calculation (0% coverage)
- [ ] `src/services/populationTracker.ts` - Population tracking (0% coverage)
- [ ] `src/services/statisticsCollector.ts` - Statistics collection (0% coverage)
- [ ] `src/services/systemSelector.ts` - System selection (0% coverage)
- [ ] `src/services/targetSelector.ts` - Target selection (0% coverage)
- [ ] `src/services/templateSelector.ts` - Template selection (0% coverage)
- [ ] `src/services/templateGraphView.ts` - Graph visualization (0% coverage)
- [ ] `src/services/tagHealthAnalyzer.ts` - Tag health analysis (0% coverage)
- [ ] `src/services/loreIndex.ts` - Lore indexing (0% coverage)
- [ ] `src/services/loreValidator.ts` - Lore validation (0% coverage)
- [ ] `src/services/enrichmentService.ts` - LLM enrichment (0% coverage)
- [ ] `src/services/imageGenerationService.ts` - Image generation (0% coverage)
- [ ] `src/services/metaEntityFormation.ts` - Meta entity formation (0% coverage)
- [ ] `src/services/feedbackAnalyzer.ts` - Feedback analysis (0% coverage)
- [ ] `src/services/llmClient.ts` - LLM client wrapper (0% coverage)
- [ ] `src/services/nameLogger.ts` - Name logging (0% coverage)
- [ ] `src/services/distributionTracker.ts` - Distribution tracking (0% coverage)

### ✅ Framework Config (Priority 4)

#### Config Files (0/3 tested)
- [ ] `src/config/entityRegistries.ts` - Entity registration (0% coverage)
- [ ] `src/config/feedbackLoops.ts` - Feedback loop config (0% coverage)
- [ ] `src/config/tagRegistry.ts` - Tag registry (0% coverage)

### ✅ Domain Code - Penguin (Priority 5)

#### Domain Config (0/6 tested)
- [ ] `src/domain/penguin/config/eras.ts` - Era definitions (0% coverage)
- [ ] `src/domain/penguin/config/pressures.ts` - Pressure definitions (0% coverage)
- [ ] `src/domain/penguin/config/actionDomains.ts` - Action domains (0% coverage)
- [ ] `src/domain/penguin/config/loreProvider.ts` - Lore provider (0% coverage)
- [ ] `src/domain/penguin/config/metaEntityConfigs.ts` - Meta entity config (0% coverage)
- [ ] `src/domain/penguin/config/relationshipCategories.ts` - Relationship categories (0% coverage)

#### Domain Systems (0/13 tested)
- [ ] `src/domain/penguin/systems/allianceFormation.ts` (0% coverage)
- [ ] `src/domain/penguin/systems/beliefContagion.ts` (0% coverage)
- [ ] `src/domain/penguin/systems/conflictContagion.ts` (0% coverage)
- [ ] `src/domain/penguin/systems/culturalDrift.ts` (0% coverage)
- [ ] `src/domain/penguin/systems/legendCrystallization.ts` (0% coverage)
- [ ] `src/domain/penguin/systems/prominenceEvolution.ts` (0% coverage)
- [ ] `src/domain/penguin/systems/relationshipDecay.ts` (0% coverage)
- [ ] `src/domain/penguin/systems/relationshipFormation.ts` (0% coverage)
- [ ] `src/domain/penguin/systems/relationshipReinforcement.ts` (0% coverage)
- [ ] `src/domain/penguin/systems/resourceFlow.ts` (0% coverage)
- [ ] `src/domain/penguin/systems/successionVacuum.ts` (0% coverage)
- [ ] `src/domain/penguin/systems/thermalCascade.ts` (0% coverage)
- [ ] `src/domain/penguin/systems/index.ts` (0% coverage)

#### Domain Templates - NPC (0/8 tested)
- [ ] `src/domain/penguin/templates/npc/familyExpansion.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/npc/heroEmergence.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/npc/kinshipConstellation.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/npc/mysteriousVanishing.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/npc/orcaRaiderArrival.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/npc/outlawRecruitment.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/npc/succession.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/npc/index.ts` (0% coverage)

#### Domain Templates - Faction (0/5 tested)
- [ ] `src/domain/penguin/templates/faction/cultFormation.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/faction/factionSplinter.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/faction/guildEstablishment.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/faction/territorialExpansion.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/faction/tradeRouteEstablishment.ts` (0% coverage)

#### Domain Templates - Location (0/9 tested)
- [ ] `src/domain/penguin/templates/location/anomalyManifestation.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/location/colonyFounding.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/location/emergentLocationDiscovery.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/location/geographicExploration.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/location/krillBloomMigration.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/location/mysticalLocationDiscovery.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/location/resourceLocationDiscovery.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/location/strategicLocationDiscovery.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/location/index.ts` (0% coverage)

#### Domain Templates - Abilities (0/5 tested)
- [ ] `src/domain/penguin/templates/abilities/magicDiscovery.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/abilities/magicalSiteDiscovery.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/abilities/orcaCombatTechnique.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/abilities/techBreakthrough.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/abilities/techInnovation.ts` (0% coverage)

#### Domain Templates - Rules (0/3 tested)
- [ ] `src/domain/penguin/templates/rules/crisisLegislation.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/rules/greatFestival.ts` (0% coverage)
- [ ] `src/domain/penguin/templates/rules/ideologyEmergence.ts` (0% coverage)

#### Domain Schema & Index (0/2 tested)
- [ ] `src/domain/penguin/schema.ts` (0% coverage)
- [ ] `src/domain/penguin/index.ts` (0% coverage)

## Test Priority Order

1. **Utilities** (helpers, validators) - Most reused code
2. **Engine Core** (worldEngine, contractEnforcer) - Critical path
3. **Services** (selectors, trackers) - Business logic
4. **Framework Systems** (era, catalyst) - Core mechanics
5. **Domain Code** (templates, systems) - Domain logic

## Testing Strategy

### Phase 1: Utility Functions
- Test pure functions with clear inputs/outputs
- Edge cases: empty arrays, null/undefined, boundary values
- Error handling: invalid inputs should throw descriptive errors

### Phase 2: Engine Components
- Mock dependencies (Graph, config objects)
- Test orchestration flow
- Test contract enforcement

### Phase 3: Services
- Mock external dependencies (LLM clients, file I/O)
- Test business logic in isolation
- Test error recovery

### Phase 4: Systems & Templates
- Mock Graph state
- Test canApply conditions
- Test entity/relationship creation
- Validate contract compliance

### Phase 5: Integration Tests
- Full world generation test
- Era progression test
- Template application test
- System application test

## Coverage Milestones

- [ ] 10% - Utility functions tested
- [ ] 25% - Engine core tested
- [ ] 40% - Services tested
- [ ] 55% - Framework systems tested
- [ ] 70% - Domain code tested (TARGET)
- [ ] 85% - Integration tests added
- [ ] 95% - Edge cases covered

## Notes

- Type definition files don't require tests but should be validated through usage
- Index files (re-exports) don't require direct tests
- LLM integration services should have mocked tests only
- Image generation should be tested with mock clients
