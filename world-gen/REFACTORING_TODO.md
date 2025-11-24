# Refactoring TODO

**Generated**: 2025-11-24 04:10 MST
**Status**: Planning Phase
**Priority**: High → Low (top to bottom)

## 1. Missing Tests (CRITICAL - 0% coverage currently)

### Priority 1: Core Utilities (Must test first)
- [ ] `src/utils/helpers.ts` (820 lines) - Core helper functions
  - [ ] `generateName()` - Name generation
  - [ ] `generateId()` - ID generation with counter
  - [ ] `pickRandom()` / `pickMultiple()` - Random selection
  - [ ] `findEntities()` - Entity querying
  - [ ] `getRelated()` - Relationship queries
  - [ ] `getLocation()` / `getFactionMembers()` - Specific queries
  - [ ] `hasRelationship()` - Relationship existence check
  - [ ] `addEntity()` / `addRelationship()` / `updateEntity()` - Graph mutations
  - [ ] `weightedRandom()` - Weighted selection
  - [ ] `getProminenceValue()` - Prominence calculation

- [ ] `src/utils/validators.ts` - Validation utilities
  - [ ] All validation functions

- [ ] `src/utils/catalystHelpers.ts` (369 lines) - Catalyst system
  - [ ] `initializeCatalystSmart()` - Catalyst initialization
  - [ ] Action domain helpers

- [ ] `src/utils/emergentDiscovery.ts` (373 lines) - Discovery mechanics
  - [ ] Discovery state management
  - [ ] Site tracking

- [ ] `src/utils/parameterOverrides.ts` - Parameter override system

### Priority 2: Engine Core
- [ ] `src/engine/worldEngine.ts` (2,452 lines) - **LARGEST FILE, needs splitting**
  - [ ] `runGeneration()` - Main orchestration
  - [ ] Growth phase logic
  - [ ] Simulation phase logic
  - [ ] Pressure update logic
  - [ ] Era progression
  - [ ] Change detection logic (detectLocationChanges, etc.)
  - [ ] Entity snapshot system

- [ ] `src/engine/contractEnforcer.ts` (475 lines) - Contract validation
  - [ ] Template contract enforcement
  - [ ] System contract enforcement
  - [ ] Entity validation
  - [ ] Relationship validation

- [ ] `src/engine/frameworkValidator.ts` (336 lines) - Framework validation
  - [ ] Domain schema validation
  - [ ] Config validation

### Priority 3: Services (Business Logic)
- [ ] `src/services/enrichmentService.ts` (813 lines) - LLM enrichment
  - [ ] Mock LLM client for tests
  - [ ] Test enrichment logic
  - [ ] Test batching logic

- [ ] `src/services/statisticsCollector.ts` (463 lines) - Statistics
  - [ ] Statistics gathering
  - [ ] Metrics calculation

- [ ] `src/services/populationTracker.ts` (341 lines) - Population tracking
  - [ ] Population metrics
  - [ ] Growth tracking

- [ ] `src/services/tagHealthAnalyzer.ts` (490 lines) - Tag health
  - [ ] Tag distribution analysis
  - [ ] Health metrics

- [ ] `src/services/targetSelector.ts` (406 lines) - Target selection
  - [ ] Target finding logic
  - [ ] Eligibility checks

- [ ] `src/services/distributionTracker.ts` (375 lines) - Distribution tracking
  - [ ] Distribution metrics
  - [ ] Balance tracking

- [ ] `src/services/feedbackAnalyzer.ts` (358 lines) - Feedback analysis
  - [ ] Feedback loop evaluation
  - [ ] Metric calculation

- [ ] `src/services/metaEntityFormation.ts` (358 lines) - Meta entities
  - [ ] Meta entity creation
  - [ ] Clustering logic

- [ ] `src/services/dynamicWeightCalculator.ts` - Weight calculation
- [ ] `src/services/systemSelector.ts` - System selection
- [ ] `src/services/templateSelector.ts` - Template selection
- [ ] `src/services/templateGraphView.ts` - Graph visualization
- [ ] `src/services/loreIndex.ts` - Lore indexing
- [ ] `src/services/loreValidator.ts` - Lore validation
- [ ] `src/services/imageGenerationService.ts` - Image generation (mock)
- [ ] `src/services/llmClient.ts` - LLM client (mock)
- [ ] `src/services/nameLogger.ts` - Name logging

### Priority 4: Framework Systems
- [ ] `src/systems/eraSpawner.ts` - Era entity spawning
- [ ] `src/systems/eraTransition.ts` - Era progression
- [ ] `src/systems/occurrenceCreation.ts` - Occurrence generation
- [ ] `src/systems/relationshipCulling.ts` - Relationship management
- [ ] `src/systems/universalCatalyst.ts` - Catalyst system

### Priority 5: Domain Code (Penguin-specific)
- [ ] All 13 domain systems in `src/domain/penguin/systems/`
- [ ] All 35 domain templates in `src/domain/penguin/templates/`
- [ ] Domain config files

## 2. Code Duplication

### Repeated Patterns
- [ ] **Relationship creation boilerplate** - Extract to builder utility
  ```typescript
  // Pattern repeated in 30+ templates:
  relationships.push({ kind: 'X', src: 'A', dst: 'B', strength: 0.5 });
  // Should be: addRelationship(graph, { kind: 'X', from: 'A', to: 'B', strength: 0.5 });
  ```

- [ ] **Entity finding patterns** - Create query DSL
  ```typescript
  // Pattern repeated everywhere:
  const locations = Array.from(graph.entities.values()).filter(e =>
    e.kind === 'location' && e.subtype === 'colony' && e.status === 'active'
  );
  // Should be: findEntities(graph, { kind: 'location', subtype: 'colony', status: 'active' })
  ```

- [ ] **Template metadata boilerplate** - Create factory function
  ```typescript
  // Every template repeats: id, category, distributionTarget, etc.
  // Extract to createTemplate() factory
  ```

- [ ] **Graph traversal patterns** - Create graph query utilities
  ```typescript
  // Finding neighbors, paths, clusters - extract common patterns
  ```

## 3. Violated SOLID Principles

### Single Responsibility Violations
- [ ] **worldEngine.ts** - Does EVERYTHING (orchestration, change detection, snapshot management, enrichment filtering)
  - Split into: `WorldEngine`, `GrowthPhase`, `SimulationPhase`, `ChangeDetector`, `EntitySnapshotter`

- [ ] **enrichmentService.ts** - LLM calls + batch management + filtering
  - Split into: `LLMClient`, `EnrichmentBatcher`, `ChangeFilter`

- [ ] **contractEnforcer.ts** - Validates templates + systems + entities + relationships
  - Split into: `TemplateValidator`, `SystemValidator`, `EntityValidator`, `RelationshipValidator`

### Open/Closed Violations
- [ ] Template selection algorithm is hardcoded in engine
  - Use strategy pattern for pluggable selection algorithms

- [ ] Era progression is linear and hardcoded
  - Support custom era progression strategies

- [ ] Pressure growth functions are tightly coupled
  - Support pluggable pressure calculators

### Dependency Inversion Violations
- [ ] `helpers.ts` directly imports `penguinDomain` (framework depends on domain)
  - Should inject domain via config

- [ ] Services import concrete implementations instead of interfaces
  - Define interfaces for all services

- [ ] Hard dependency on specific LLM providers (Anthropic, OpenAI)
  - Define LLM provider interface

### Interface Segregation Violations
- [ ] `GrowthTemplate` interface forces templates to implement unused fields
  - Split into smaller, focused interfaces

- [ ] `Graph` interface is monolithic
  - Extract into: `EntityGraph`, `RelationshipGraph`, `MetadataGraph`

## 4. Tightly Coupled Components

### Coupling Issues
- [ ] Templates directly manipulate graph state
  - Provide graph mutation API layer

- [ ] Systems directly access entity internals
  - Use entity accessor methods

- [ ] Services depend on specific graph structure
  - Define graph query interface

- [ ] Hard coupling between framework and penguin domain
  - Use dependency injection for domain

### Missing Abstractions
- [ ] No abstraction for "entity cluster creation" (all templates repeat this)
- [ ] No abstraction for "relationship pattern matching" (all systems repeat this)
- [ ] No abstraction for "weighted selection with constraints"
- [ ] No abstraction for "entity lifecycle management"

## 5. Poor Naming Conventions

### Abbreviations to Fix
- [ ] `ent` → `entity` (in variable names)
- [ ] `rel` → `relationship` (in variable names)
- [ ] `src/dst` → `source/destination` (consider in comments)

### Inconsistent Terminology
- [ ] `entity` vs `node` - Pick one
- [ ] `relationship` vs `edge` vs `link` - Pick one
- [ ] `kind` vs `type` - Pick one
- [ ] `apply` vs `execute` vs `run` - Pick one for methods

### Non-descriptive Names
- [ ] `doThing()` patterns - Make names descriptive
- [ ] Single-letter variables outside loops
- [ ] Magic numbers without constants

### Boolean Naming
- [ ] `active` → `isActive`
- [ ] `valid` → `isValid`
- [ ] `enabled` → `isEnabled`

## 6. Missing Documentation

### Missing JSDoc
- [ ] All public functions in `src/utils/helpers.ts`
- [ ] All service classes
- [ ] All template functions
- [ ] All system functions
- [ ] Complex algorithms need "WHY" comments

### Missing Architecture Docs
- [ ] Decision records for major choices (ADRs)
  - [ ] Why hybrid template+simulation?
  - [ ] Why pressure-based triggering?
  - [ ] Why relationship culling?
  - [ ] Why era-based progression?

### Missing Type Documentation
- [ ] All exported types need descriptions
- [ ] Relationship kinds need documentation
- [ ] Status values need documentation per entity kind

## 7. Framework/Domain Boundary Violations

### Framework Code Using Domain Specifics
- [ ] `helpers.ts` imports `penguinDomain` directly
- [ ] `worldEngine.ts` imports penguin-specific eras
- [ ] Hard-coded penguin names in test data

### Domain Code Using Framework Internals
- [ ] Templates accessing graph internals directly
- [ ] Systems bypassing graph mutation API

## 8. Error Handling Issues

### Missing Error Handling
- [ ] File I/O operations lack try/catch
- [ ] No validation of user input in main.ts
- [ ] Graph mutations can create invalid state

### Poor Error Messages
- [ ] Generic "Invalid entity" messages
- [ ] No context in thrown errors
- [ ] Stack traces lost in re-throws

### Error Recovery
- [ ] No graceful degradation when LLM fails
- [ ] No rollback on template application failure
- [ ] No recovery from invalid relationships

## 9. Performance Issues (Minor)

### Potential Bottlenecks
- [ ] O(n²) relationship lookups in hot paths
- [ ] Repeated array filtering instead of indexing
- [ ] No caching of frequently accessed entities
- [ ] Full graph traversal for each system

### Memory Issues
- [ ] Large history arrays grow unbounded
- [ ] Entity snapshots not garbage collected
- [ ] Relationship cooldowns map grows unbounded

## 10. Type Safety Issues

### Any Types
- [ ] Search for `any` types and replace with proper types
- [ ] Add strict null checks where missing
- [ ] Use discriminated unions for entity subtypes

### Missing Type Guards
- [ ] Add type guards for entity kind checks
- [ ] Add type guards for relationship kind checks
- [ ] Validate external JSON data at runtime

## 11. Configuration Issues

### Hard-coded Values
- [ ] Magic numbers for thresholds
- [ ] Hard-coded template weights
- [ ] Hard-coded pressure values

### Missing Validation
- [ ] Config files not validated at startup
- [ ] Invalid template/system IDs fail at runtime
- [ ] No schema validation for JSON files

## Progress Tracking

Last updated: 2025-11-24 04:10 MST

### Completed Items
- [x] Create REFACTORING_TODO.md
- [ ] (Nothing else yet)

### Current Focus
- Setting up Vitest
- Writing first utility tests

### Blockers
- None currently
