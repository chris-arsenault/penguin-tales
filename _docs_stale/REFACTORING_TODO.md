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
- [x] Set up Vitest
- [x] Write utility tests (262 tests, ~25-30% coverage)
- [x] Complete comprehensive codebase analysis

### Current Focus
- Writing engine component tests
- Documenting code duplication patterns
- Planning service layer refactoring

### Blockers
- worldEngine.ts (2452 lines) needs refactoring before comprehensive testing
- Some templates have circular dependencies that complicate testing

---

## Detailed Analysis

### Code Duplication Patterns (EXPANDED)

#### Template Boilerplate (43 templates with 70-80% identical code)

All templates follow this pattern:
```typescript
export const templateName: GrowthTemplate = {
  id: 'template_id',
  name: 'Display Name',
  metadata: { /* 50+ lines of metadata */ },
  contract: { /* 30+ lines of contract */ },
  canApply: (graphView) => { /* preconditions */ },
  findTargets: (graphView) => { /* target finding */ },
  expand: (graphView, target) => { /* entity creation */ }
};
```

**Duplication Score**: ~70% of code is boilerplate
**Affected Files**: All 43 template files
**Solution**: Create template builder DSL or factory functions

**Examples of Repeated Patterns**:

1. **Target Finding Pattern** (repeated 35+ times):
```typescript
findTargets: (graphView: TemplateGraphView) => {
  const entities = graphView.findEntities({ kind: 'X', subtype: 'Y' });
  return entities.filter(e => /* additional criteria */);
}
```

2. **Entity Creation Pattern** (repeated 40+ times):
```typescript
const entity: Partial<HardState> = {
  kind: 'kind',
  subtype: 'subtype',
  name: generateName(),
  description: `placeholder`,
  status: 'status',
  prominence: 'marginal',
  tags: ['tag1', 'tag2']
};
entities.push(entity);
```

3. **Relationship Creation Pattern** (repeated 100+ times):
```typescript
relationships.push({
  kind: 'relationship_kind',
  src: 'will-be-assigned-0',
  dst: target.id,
  strength: 0.7
});
```

4. **Contract Declaration Pattern** (repeated 30+ times):
```typescript
contract: {
  purpose: ComponentPurpose.ENTITY_CREATION,
  enabledBy: {
    pressures: [{ name: 'pressure', threshold: 10 }],
    entityCounts: [{ kind: 'kind', min: 1 }]
  },
  affects: {
    entities: [{ kind: 'kind', operation: 'create', count: { min: 1, max: 1 } }],
    relationships: [/* ... */]
  }
}
```

#### System Boilerplate (18 systems with 60% identical code)

All systems follow this pattern:
```typescript
export const systemName: SimulationSystem = {
  id: 'system_id',
  name: 'Display Name',
  metadata: { /* metadata */ },
  contract: { /* contract */ },
  apply: (graph, modifier) => {
    const relationshipsAdded: Relationship[] = [];
    const entitiesModified: Array<{ id: string; changes: Partial<HardState> }> = [];
    const pressureChanges: Record<string, number> = {};

    // System logic

    return {
      relationshipsAdded,
      entitiesModified,
      pressureChanges,
      description: 'what happened'
    };
  }
};
```

**Duplication Score**: ~60% of code is boilerplate
**Affected Files**: All 18 system files

#### Helper Function Duplication (15+ instances)

**Entity Finding Patterns**:
```typescript
// Pattern 1: Find entities by criteria (repeated 50+ times)
const entities = Array.from(graph.entities.values()).filter(e =>
  e.kind === 'kind' && e.status === 'active'
);

// Pattern 2: Find related entities (repeated 40+ times)
const related = graph.relationships
  .filter(r => r.src === entityId && r.kind === 'relationship_kind')
  .map(r => graph.entities.get(r.dst))
  .filter(Boolean);

// Pattern 3: Check relationship exists (repeated 30+ times)
const hasRel = graph.relationships.some(r =>
  r.src === src && r.dst === dst && r.kind === kind
);
```

### SOLID Violations (DETAILED)

#### Single Responsibility Principle Violations

**1. worldEngine.ts (2452 lines) - THE BIG ONE**

This file does at least 10 different things:
- Generation orchestration
- Growth phase management
- Simulation phase execution
- Template selection and execution
- System selection and execution
- Pressure accumulation and decay
- Era progression logic
- Entity snapshot management (8 different snapshot functions)
- Change detection (5 different detection functions)
- LLM enrichment batching and filtering
- Statistics collection
- Output file writing
- Stop condition evaluation

**Recommended Split**:
```
engine/
  worldEngine.ts (200 lines) - Main orchestrator only
  growthPhase.ts (300 lines) - Template execution
  simulationPhase.ts (300 lines) - System execution
  pressureManager.ts (200 lines) - Pressure logic
  eraManager.ts (200 lines) - Era progression
  changeDetector.ts (400 lines) - Already exists! Move functions there
  snapshotManager.ts (300 lines) - Snapshot logic
  enrichmentQueue.ts (300 lines) - Enrichment batching
  stopConditionEvaluator.ts (150 lines) - Stop logic
```

**2. enrichmentService.ts (813 lines)**

Does:
- LLM API calls
- Batch management
- Name generation
- Description generation
- Relationship enrichment
- Ability enrichment
- Discovery enrichment
- Occurrence enrichment
- Era enrichment
- JSON parsing and error recovery
- Name uniqueness tracking

**Recommended Split**:
```
services/enrichment/
  enrichmentService.ts (150 lines) - Orchestrator
  nameGenerator.ts (200 lines) - Name generation
  descriptionGenerator.ts (200 lines) - Description generation
  relationshipEnricher.ts (100 lines) - Relationship enrichment
  specializedEnrichers.ts (163 lines) - Ability, discovery, etc.
```

**3. helpers.ts (820 lines)**

Does:
- Name generation
- ID generation
- Random selection
- Entity finding
- Relationship queries
- Graph mutations
- Prominence calculations
- Name slugification
- Initial state normalization
- Relationship strength lookup
- Lineage relationship identification
- Distance range calculation
- Relationship categories
- Faction relationship determination

**Recommended Split**:
```
utils/
  nameHelpers.ts (100 lines)
  idHelpers.ts (50 lines)
  randomHelpers.ts (100 lines)
  entityQueries.ts (200 lines)
  relationshipQueries.ts (200 lines)
  graphMutations.ts (170 lines)
```

#### Open/Closed Principle Violations

**1. Template Selection Algorithm** (worldEngine.ts:1200-1400)
- Hardcoded diversity pressure formula
- Cannot plug in alternative selection strategies
- Cannot A/B test different approaches

**Solution**: Strategy Pattern
```typescript
interface TemplateSelectionStrategy {
  select(
    candidates: GrowthTemplate[],
    weights: Record<string, number>,
    count: number
  ): GrowthTemplate[];
}

class DiversityPressureStrategy implements TemplateSelectionStrategy { /* ... */ }
class RandomStrategy implements TemplateSelectionStrategy { /* ... */ }
class WeightedStrategy implements TemplateSelectionStrategy { /* ... */ }
```

**2. Era Progression** (worldEngine.ts:800-900)
- Linear era progression hardcoded
- Cannot customize era transitions
- Cannot add dynamic era conditions

**Solution**: State Machine Pattern
```typescript
interface EraTransitionStrategy {
  shouldTransition(graph: Graph, currentEra: Era): boolean;
  selectNextEra(graph: Graph, currentEra: Era): Era;
}
```

**3. Pressure Growth Functions** (config/pressures.ts)
- Each pressure has hardcoded growth function
- Cannot dynamically adjust pressure formulas
- Cannot add pressure modifiers at runtime

**Solution**: Function Composition
```typescript
interface PressureModifier {
  apply(base: number, graph: Graph): number;
}

class MultiplicativePressureModifier implements PressureModifier { /* ... */ }
class AdditivePressureModifier implements PressureModifier { /* ... */ }
```

#### Liskov Substitution Principle Violations

**1. GrowthTemplate Interface** (types/engine.ts:88-106)
- `findTargets()` is optional but treated as required in many places
- Some templates return empty arrays from `canApply()` making it meaningless
- `metadata` is optional but framework expects it

**Solution**: Split interfaces
```typescript
interface BaseTemplate {
  id: string;
  name: string;
  canApply(graphView: TemplateGraphView): boolean;
  expand(graphView: TemplateGraphView): TemplateResult;
}

interface TargetedTemplate extends BaseTemplate {
  findTargets(graphView: TemplateGraphView): HardState[];
}

interface MetadataTemplate extends BaseTemplate {
  metadata: TemplateMetadata;
}
```

#### Interface Segregation Principle Violations

**1. Graph Interface** (types/engine.ts:36-68)
- Monolithic interface with 15+ fields
- Most consumers only need 2-3 fields
- Forces unnecessary dependencies

**Solution**: Split into focused interfaces
```typescript
interface EntityGraph {
  entities: Map<string, HardState>;
}

interface RelationshipGraph {
  relationships: Relationship[];
}

interface TemporalGraph {
  tick: number;
  currentEra: Era;
  history: HistoryEvent[];
}

interface PressureGraph {
  pressures: Map<string, number>;
}

interface MetadataGraph {
  config: EngineConfig;
  relationshipCooldowns: Map<string, Map<string, number>>;
  loreIndex?: LoreIndex;
  discoveryState: DiscoveryState;
}

// Compose as needed
type FullGraph = EntityGraph & RelationshipGraph & TemporalGraph & PressureGraph & MetadataGraph;
```

**2. TemplateGraphView** (services/templateGraphView.ts)
- Provides 20+ methods but templates only use 5-6
- Mixes entity queries, relationship queries, and metadata access

**Solution**: Split into focused views
```typescript
interface EntityView {
  findEntities(criteria: Partial<HardState>): HardState[];
  getEntityCount(kind?: string, subtype?: string): number;
}

interface RelationshipView {
  getRelated(entityId: string, kind?: string): HardState[];
  hasRelationship(srcId: string, dstId: string, kind?: string): boolean;
}

interface MetadataView {
  getPressure(name: string): number;
  getCurrentEra(): Era;
}
```

#### Dependency Inversion Principle Violations

**1. Framework Depends on Domain** (utils/helpers.ts:9-13)
```typescript
// VIOLATION: Framework code importing domain code
import { penguinDomain } from '../domain/penguin/schema';

export function generateName(type: string = 'default'): string {
  return penguinDomain.nameGenerator.generate(type);
}
```

**Solution**: Inject domain via config
```typescript
// Framework defines interface
interface NameGenerator {
  generate(type: string): string;
}

// Domain implements
class PenguinNameGenerator implements NameGenerator { /* ... */ }

// Engine receives via config
const engine = new WorldEngine({
  nameGenerator: new PenguinNameGenerator()
});
```

**2. Services Import Concrete Implementations**
- `enrichmentService.ts` imports concrete `LLMClient`
- `imageGenerationService.ts` imports concrete image APIs
- `metaEntityFormation.ts` imports concrete clustering algorithms

**Solution**: Define interfaces
```typescript
interface LLMProvider {
  complete(prompt: string, options: CompletionOptions): Promise<string>;
}

class AnthropicProvider implements LLMProvider { /* ... */ }
class OpenAIProvider implements LLMProvider { /* ... */ }
class MockProvider implements LLMProvider { /* ... */ }
```

### Files Over 400 Lines (Need Splitting)

| File | Lines | Complexity | Recommended Action |
|------|-------|------------|-------------------|
| worldEngine.ts | 2452 | CRITICAL | Split into 8-10 files |
| tagRegistry.ts | 1013 | HIGH | Split tag definitions into categories |
| helpers.ts | 820 | HIGH | Split by concern (names, IDs, queries, mutations) |
| enrichmentService.ts | 813 | HIGH | Split by enrichment type |
| entityRegistries.ts | 801 | MEDIUM | Acceptable (mostly data) |
| occurrenceCreation.ts | 630 | MEDIUM | Extract occurrence types |
| tagHealthAnalyzer.ts | 490 | MEDIUM | Extract analyzers by concern |
| contractEnforcer.ts | 475 | MEDIUM | Split by validation type |
| statisticsCollector.ts | 463 | MEDIUM | Split by stat category |
| universalCatalyst.ts | 423 | MEDIUM | Extract action executors |
| targetSelector.ts | 406 | MEDIUM | Acceptable (cohesive) |
| feedbackLoops.ts | 403 | MEDIUM | Acceptable (mostly data) |

### Missing Abstractions (CRITICAL)

#### 1. Entity Cluster Creation Pattern
**Problem**: Every template manually creates related entities and relationships
**Occurrences**: 35+ templates
**Solution**:
```typescript
class EntityCluster {
  private entities: Partial<HardState>[] = [];
  private relationships: Relationship[] = [];

  addEntity(template: Partial<HardState>): string {
    const placeholder = `will-be-assigned-${this.entities.length}`;
    this.entities.push({ ...template, id: placeholder });
    return placeholder;
  }

  relate(from: string, to: string, kind: string, strength?: number): void {
    this.relationships.push({ kind, src: from, dst: to, strength });
  }

  build(): TemplateResult {
    return {
      entities: this.entities,
      relationships: this.relationships,
      description: this.generateDescription()
    };
  }
}
```

#### 2. Relationship Pattern Matching
**Problem**: Systems manually traverse relationships to find patterns
**Occurrences**: 18 systems
**Solution**:
```typescript
interface RelationshipPattern {
  match(graph: Graph): Array<{ entities: HardState[], relationships: Relationship[] }>;
}

class TriadPattern implements RelationshipPattern {
  constructor(
    private center: Partial<HardState>,
    private spoke1: string, // relationship kind
    private spoke2: string
  ) {}

  match(graph: Graph): Array<{ entities: HardState[], relationships: Relationship[] }> {
    // Find all A -> B -> C patterns
  }
}
```

#### 3. Weighted Selection with Constraints
**Problem**: Every selector reimplements weighted random with different constraints
**Occurrences**: 5+ places
**Solution**:
```typescript
class ConstrainedSelector<T> {
  constructor(
    private items: T[],
    private weights: (item: T) => number,
    private constraints: Array<(item: T) => boolean>
  ) {}

  select(count: number): T[] {
    const eligible = this.items.filter(item =>
      this.constraints.every(c => c(item))
    );
    return this.weightedSample(eligible, count);
  }
}
```

#### 4. Entity Lifecycle Management
**Problem**: No clear lifecycle for entities (create, activate, deactivate, archive)
**Occurrences**: Scattered throughout codebase
**Solution**:
```typescript
interface EntityLifecycle {
  onCreate(entity: HardState, graph: Graph): void;
  onUpdate(entity: HardState, changes: Partial<HardState>, graph: Graph): void;
  onArchive(entity: HardState, graph: Graph): void;
  onDelete(entity: HardState, graph: Graph): void;
}

class EntityManager {
  constructor(private lifecycle: EntityLifecycle) {}

  create(template: Partial<HardState>, graph: Graph): HardState {
    const entity = this.initializeEntity(template, graph);
    this.lifecycle.onCreate(entity, graph);
    return entity;
  }
}
```

### Framework/Domain Boundary Violations (DETAILED)

#### Framework → Domain Dependencies (BAD)

**1. utils/helpers.ts (lines 9-13)**
```typescript
import { penguinDomain } from '../domain/penguin/schema';
```
**Impact**: Cannot reuse framework for other domains
**Fix**: Inject name generator via config

**2. engine/worldEngine.ts (lines 1-50)**
```typescript
import { penguinEras } from '../domain/penguin/config/eras';
import { penguinTemplates } from '../domain/penguin/templates';
```
**Impact**: Engine hardcoded to penguin domain
**Fix**: Pass via EngineConfig

**3. Multiple test files**
```typescript
// Hard-coded penguin names in test data
const testNpc = { name: 'Skipper', kind: 'npc' };
```
**Impact**: Tests assume penguin domain
**Fix**: Use domain-agnostic test data

#### Domain → Framework Internals (BAD)

**1. All templates directly access graph internals**
```typescript
// templates/npc/familyExpansion.ts:85
const parent = graph.entities.get(parentId);
parent.links.push(relationship);
```
**Impact**: Domain bypasses framework invariants
**Fix**: Use graph mutation API

**2. Systems directly modify entity state**
```typescript
// systems/prominenceEvolution.ts:120
entity.prominence = 'renowned';
entity.updatedAt = graph.tick;
```
**Impact**: Bypasses change tracking
**Fix**: Use updateEntity() helper

### Circular Dependencies

**1. services/templateGraphView.ts ↔ services/targetSelector.ts**
- TemplateGraphView uses TargetSelector
- TargetSelector uses TemplateGraphView for queries
**Fix**: Extract shared query interface

**2. engine/worldEngine.ts ↔ services/enrichmentService.ts**
- WorldEngine creates EnrichmentService
- EnrichmentService needs Graph from WorldEngine
**Fix**: Pass Graph explicitly, not via closure

**3. types/engine.ts ↔ services/templateGraphView.ts**
- Types import TemplateGraphView for type annotations
- TemplateGraphView imports types
**Fix**: Move TemplateGraphView type to types/

### Configuration Validation Missing

**1. Template/System ID Validation**
- Era weights reference template IDs as strings
- No validation that IDs exist until runtime
- Typos cause silent failures
**Fix**: Validate all ID references at startup

**2. Entity Registry Validation**
- Registries reference creator/modifier IDs
- No validation of lineage functions
- Invalid registries cause crashes
**Fix**: Add registry validator

**3. Pressure Contract Validation**
- Sources/sinks reference components by string
- No validation of component existence
- Invalid references fail at runtime
**Fix**: Validate all component references

**4. Distribution Target Validation**
- Distribution targets can sum to >1.0 or <1.0
- No validation of target counts vs registry counts
- Invalid targets cause incorrect distributions
**Fix**: Validate target consistency

### Magic Numbers (Extract to Constants)

**worldEngine.ts**:
- `5-15` (template selection count range) - line 450
- `10` (simulation ticks per growth) - line 380
- `0.1` (diversity pressure decay) - line 890
- `100` (max entities per kind) - line 210
- `500` (max total ticks) - line 180

**contractEnforcer.ts**:
- `2.0` (saturation threshold multiplier) - line 203
- `0.2` (minimum template weight) - line 191
- `5` (max tags per entity) - line 388

**helpers.ts**:
- `0.3` (weak relationship threshold) - line 148
- `1000` (ID counter start) - line 17
- `5` (connection weight threshold) - line 786

### Type Safety Issues (DETAILED)

#### Excessive `any` Types

**Found in**:
- `services/enrichmentService.ts:323` - LLM response parsing
- `services/llmClient.ts:89` - API response handling
- `utils/helpers.ts:59` - Entity criteria matching
- `config/entityRegistries.ts:45` - Dynamic registry lookup

**Fix**: Replace with proper types or unknown + type guards

#### Missing Runtime Validation

**1. External JSON Data**
- `data/initialState.json` loaded without validation
- Could contain invalid entity kinds, subtypes, relationships
**Fix**: Use Zod or similar for runtime validation

**2. LLM Responses**
- JSON parsed from LLM without schema validation
- Invalid responses cause crashes
**Fix**: Validate against expected schema

**3. Config Files**
- No validation of era definitions
- No validation of template metadata
**Fix**: Validate on load

### Performance Issues (DETAILED)

#### O(n²) Operations in Hot Paths

**1. Relationship Lookup** (helpers.ts:65-100)
```typescript
// Called in every system tick
graph.relationships.forEach(rel => {
  if (rel.src === entityId) { /* ... */ }
});
```
**Impact**: 10 systems × 10 ticks × 500 entities = 50,000 iterations
**Fix**: Index relationships by src/dst

**2. Entity Finding** (helpers.ts:33-55)
```typescript
// Called by every template
graph.entities.forEach(entity => {
  if (matches(entity, criteria)) results.push(entity);
});
```
**Impact**: 15 templates × 500 entities = 7,500 iterations
**Fix**: Index entities by kind/subtype

**3. Pressure Calculation** (config/pressures.ts)
```typescript
// Full graph scan for each pressure
growth: (graph) => {
  let total = 0;
  for (const entity of graph.entities.values()) {
    if (matches(entity)) total++;
  }
  return total;
}
```
**Impact**: 6 pressures × 500 entities × 500 ticks = 1.5M iterations
**Fix**: Cache counts, invalidate on change

#### Memory Leaks

**1. History Array** (types/engine.ts:42)
```typescript
history: HistoryEvent[]; // Grows unbounded
```
**Impact**: 500 ticks × 20 events = 10,000 history entries
**Fix**: Circular buffer or periodic trimming

**2. Relationship Cooldowns** (types/engine.ts:44)
```typescript
relationshipCooldowns: Map<string, Map<string, number>>; // Never cleared
```
**Impact**: 500 entities × 10 relationships = 5,000 entries
**Fix**: Periodic cleanup of expired cooldowns

**3. Entity Snapshots** (worldEngine.ts:1500-1800)
```typescript
private entitySnapshots: Map<string, EntitySnapshot> = new Map();
// Snapshots never removed
```
**Impact**: 500 entities × snapshot size
**Fix**: Clear snapshots after enrichment

### Recommended Refactoring Order

#### Phase 1: Extract Abstractions (Weeks 1-2)
1. EntityCluster builder
2. Relationship pattern matcher
3. ConstrainedSelector utility
4. Entity lifecycle manager

#### Phase 2: Split Large Files (Weeks 3-5)
1. worldEngine.ts → 8 files
2. helpers.ts → 6 files
3. enrichmentService.ts → 5 files
4. contractEnforcer.ts → 4 files

#### Phase 3: Fix Boundaries (Weeks 6-7)
1. Remove framework → domain dependencies
2. Add domain injection points
3. Create interface adapters
4. Update tests

#### Phase 4: Improve Type Safety (Week 8)
1. Remove `any` types
2. Add runtime validation
3. Add type guards
4. Use discriminated unions

#### Phase 5: Performance (Week 9)
1. Add relationship indexes
2. Add entity indexes
3. Implement caching
4. Fix memory leaks

### Impact Analysis

**High Impact, Low Effort**:
- Extract EntityCluster builder (affects 35 files, 2 days)
- Add relationship indexes (affects 18 files, 1 day)
- Fix framework → domain dependencies (affects 3 files, 1 day)

**High Impact, High Effort**:
- Split worldEngine.ts (affects entire codebase, 2 weeks)
- Add runtime validation (affects 50+ files, 1 week)

**Low Impact, Low Effort**:
- Rename variables (affects 97 files, 1 week)
- Add JSDoc (affects 97 files, 1 week)

**Low Impact, High Effort**:
- Split all templates into factories (affects 43 files, 2 weeks)

### Metrics to Track

**Before Refactoring**:
- Average file size: 200 lines
- Largest file: 2452 lines
- Cyclomatic complexity: TBD
- Test coverage: 25-30%
- Code duplication: ~45%
- Type safety: ~75%

**After Refactoring Goals**:
- Average file size: <150 lines
- Largest file: <400 lines
- Cyclomatic complexity: <10 per function
- Test coverage: >70%
- Code duplication: <15%
- Type safety: >95%
