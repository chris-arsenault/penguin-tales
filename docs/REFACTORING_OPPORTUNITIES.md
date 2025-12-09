# Refactoring Opportunities Analysis

**Generated:** 2025-11-24
**Target:** world-gen codebase
**Focus:** Extract abstractions (high-impact, low-risk)

---

## Executive Summary

Analyzed 2,452 lines in `worldEngine.ts`, 34 template files, 13 system files, and 9 utility files. Identified 10 high-impact refactoring opportunities that would reduce code by ~800-1000 lines and significantly improve maintainability.

**Key Findings:**
- worldEngine.ts contains 5+ extractable subsystems (change detection, enrichment queue, analytics)
- Template/system parameter extraction follows identical pattern across 28+ files (105 occurrences)
- Change detection logic duplicated across 5 entity kinds (450 LOC)
- Enrichment queueing logic repeated 6 times (300 LOC)
- Analytics tracking duplicated in 3 places (120 LOC)

---

## Top 10 Refactoring Opportunities

### 1. Extract Change Detection System
**Priority: HIGH** | **Risk: LOW** | **LOC Reduction: ~450**

**Current State:**
- 5 standalone functions in `worldEngine.ts` (lines 72-293):
  - `detectLocationChanges()` - 37 lines
  - `detectFactionChanges()` - 64 lines
  - `detectRuleChanges()` - 35 lines
  - `detectAbilityChanges()` - 36 lines
  - `detectNPCChanges()` - 30 lines
- `snapshotEntity()` method - 90 lines (lines 2047-2137)
- `queueChangeEnrichments()` method - 87 lines (lines 1959-2045)
- Total: ~450 lines of highly structured, repetitive code

**Proposed Abstraction:**
```typescript
// src/services/changeDetector.ts
export class ChangeDetector {
  private snapshots: Map<string, EntitySnapshot>;

  snapshot(entity: HardState, graph: Graph): void;
  detectChanges(entity: HardState, graph: Graph): string[];
  hasSignificantChanges(entity: HardState): boolean;
}

// Strategy pattern for entity-specific detection
interface EntityChangeStrategy {
  detect(entity: HardState, snapshot: EntitySnapshot, graph: Graph): string[];
  createSnapshot(entity: HardState, graph: Graph): EntitySnapshot;
}

// Implementations: LocationChangeStrategy, FactionChangeStrategy, etc.
```

**Benefits:**
- Single responsibility: change detection logic isolated
- Testable: each strategy can be unit tested independently
- Extensible: new entity kinds just add a strategy
- Reusable: could be used by other systems beyond enrichment

**Files Affected:**
- `src/engine/worldEngine.ts` (remove 450 lines)
- `src/services/changeDetector.ts` (new, ~200 lines)
- `src/services/changeDetection/strategies/*.ts` (new, 5 files × ~40 lines)

**Migration Path:**
1. Create `ChangeDetector` service with snapshot management
2. Implement strategy pattern for each entity kind
3. Replace worldEngine methods with service calls
4. Move EntitySnapshot interface to service

---

### 2. Extract Parameter Extraction Utility
**Priority: HIGH** | **Risk: LOW** | **LOC Reduction: ~200**

**Current State:**
- Pattern appears 105 times across 28 files:
```typescript
const params = templateName.metadata?.parameters || {};
const someValue = params.someParam?.value ?? defaultValue;
```
- Every template/system extracts 1-17 parameters individually
- Example: `relationshipFormation.ts` extracts 17 parameters (lines 154-190)
- Total overhead: ~3-8 lines per file × 28 files = 84-224 lines

**Proposed Abstraction:**
```typescript
// src/utils/parameterExtractor.ts
export class ParameterExtractor {
  constructor(private metadata?: ComponentMetadata) {}

  get<T>(key: string, defaultValue: T): T {
    return (this.metadata?.parameters?.[key]?.value as T) ?? defaultValue;
  }

  getAll<T extends Record<string, any>>(defaults: T): T {
    const result = { ...defaults };
    for (const [key, defaultValue] of Object.entries(defaults)) {
      result[key] = this.get(key, defaultValue);
    }
    return result;
  }
}

// Usage in templates/systems:
const params = new ParameterExtractor(template.metadata);
const { throttleChance, friendshipBaseChance, ... } = params.getAll({
  throttleChance: 0.3,
  friendshipBaseChance: 0.2,
  // ... all defaults
});
```

**Benefits:**
- DRY: eliminates repetitive optional chaining and null coalescing
- Type-safe: can provide typed parameter objects
- Centralized: parameter extraction logic in one place
- Validation: could add parameter validation/bounds checking

**Files Affected:**
- 28 template/system files (reduce 3-8 lines each)
- `src/utils/parameterExtractor.ts` (new, ~50 lines)

**Alternative Approach:**
Create parameter config objects per template/system with typed defaults:
```typescript
const PARAMS = {
  throttleChance: { default: 0.3, min: 0.1, max: 1.0 },
  // ...
} as const;

const params = extractParams(template.metadata, PARAMS);
```

---

### 3. Extract Enrichment Queue Manager
**Priority: HIGH** | **Risk: MEDIUM** | **LOC Reduction: ~300**

**Current State:**
- 6 enrichment queueing methods in `worldEngine.ts`:
  - `enrichInitialEntities()` - 25 lines
  - `queueEntityEnrichment()` - 38 lines
  - `flushEntityEnrichmentQueue()` - 47 lines
  - `queueRelationshipEnrichment()` - 42 lines
  - `queueOccurrenceEnrichment()` - 21 lines
  - `queueEraEnrichment()` - 17 lines
- Shared patterns: promise tracking, analytics, batching, budget enforcement
- Total: ~300 lines

**Proposed Abstraction:**
```typescript
// src/services/enrichmentQueueManager.ts
export class EnrichmentQueueManager {
  private entityQueue: HardState[] = [];
  private pendingEnrichments: Promise<void>[] = [];
  private pendingNameEnrichments: Promise<void>[] = [];

  constructor(
    private enrichmentService: EnrichmentService,
    private analytics: EnrichmentAnalytics,
    private config: EnrichmentConfig
  ) {}

  queueEntities(entities: HardState[], options?: QueueOptions): void;
  queueRelationships(rels: Relationship[], actors: Record<string, HardState>): void;
  queueOccurrence(occurrence: HardState, catalystId?: string): void;
  queueEra(era: HardState): void;

  flush(force?: boolean): Promise<void>;
  waitForPending(): Promise<void>;

  getAnalytics(): EnrichmentAnalytics;
}
```

**Benefits:**
- Single responsibility: enrichment queueing isolated
- Testable: can mock EnrichmentService
- Configurable: batching, budgets, analytics in one place
- Reusable: could support multiple enrichment modes

**Files Affected:**
- `src/engine/worldEngine.ts` (remove ~300 lines)
- `src/services/enrichmentQueueManager.ts` (new, ~250 lines)

**Risk Factors:**
- Medium risk due to complex promise tracking logic
- Careful migration needed to preserve promise ordering
- Analytics integration needs verification

---

### 4. Extract Analytics Tracker
**Priority: MEDIUM** | **Risk: LOW** | **LOC Reduction: ~120**

**Current State:**
- Enrichment analytics duplicated in 3 places in `worldEngine.ts`:
  - `queueEntityEnrichment()` - lines 1788-1812 (7-case switch)
  - `queueChangeEnrichments()` - lines 1994-2017 (7-case switch)
  - Analytics reporting - lines 596-608 (summary)
- Same switch statement pattern repeated identically
- Total: ~120 lines

**Proposed Abstraction:**
```typescript
// src/services/analyticsTracker.ts
export class AnalyticsTracker {
  private counters = new Map<string, number>();

  track(entity: HardState, category?: string): void {
    const key = category || entity.kind;
    this.counters.set(key, (this.counters.get(key) || 0) + 1);
  }

  trackBatch(entities: HardState[], category?: string): void {
    entities.forEach(e => this.track(e, category));
  }

  get(key: string): number {
    return this.counters.get(key) || 0;
  }

  getAll(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  getSummary(): string {
    // Format analytics report
  }
}
```

**Benefits:**
- DRY: eliminates switch statement duplication
- Extensible: easy to add new categories
- Decoupled: analytics logic separate from business logic
- Flexible: could track any metric, not just entity kinds

**Files Affected:**
- `src/engine/worldEngine.ts` (remove ~120 lines, replace with tracker calls)
- `src/services/analyticsTracker.ts` (new, ~80 lines)

---

### 5. Extract Template/System Metadata Builder
**Priority: MEDIUM** | **Risk: LOW** | **LOC Reduction: ~150**

**Current State:**
- Every template/system defines metadata object manually
- Metadata structure is consistent but verbose:
  - `produces` section (~20-40 lines)
  - `effects` section (~5 lines)
  - `parameters` section (~10-60 lines)
  - `tags` section (1 line)
- 34 templates + 13 systems = 47 metadata definitions
- Average ~50 lines each = 2,350 lines total

**Proposed Abstraction:**
```typescript
// src/utils/metadataBuilder.ts
export class MetadataBuilder {
  private data: Partial<ComponentMetadata> = {
    produces: { entityKinds: [], relationships: [], modifications: [] },
    effects: { graphDensity: 0, clusterFormation: 0, diversityImpact: 0 },
    parameters: {},
    tags: []
  };

  producesEntity(kind: string, config: EntityProduction): this;
  producesRelationship(kind: string, config: RelationshipProduction): this;

  setEffects(density: number, cluster: number, diversity: number, comment?: string): this;

  addParameter(name: string, value: number, config: ParameterConfig): this;

  addTags(...tags: string[]): this;

  build(): ComponentMetadata;
}

// Usage:
const metadata = new MetadataBuilder()
  .producesEntity('faction', { subtype: 'various', count: [1, 1] })
  .producesRelationship('split_from', { category: 'lineage', probability: 1.0 })
  .setEffects(0.4, 0.6, 0.7, 'Creates faction clusters')
  .addParameter('leaderHeroChance', 0.5, { min: 0, max: 1 })
  .addTags('conflict', 'faction-diversity')
  .build();
```

**Benefits:**
- Fluent API: easier to read and write
- Type-safe: builder enforces structure
- Validation: can validate parameters at build time
- Default handling: reduces boilerplate for common cases

**Files Affected:**
- 47 template/system files (reduce ~5-10 lines each = 235-470 LOC)
- `src/utils/metadataBuilder.ts` (new, ~200 lines)

**Note:** This is more refactoring than extraction, but high value

---

### 6. Extract Graph Query DSL
**Priority: MEDIUM** | **Risk: LOW** | **LOC Reduction: ~200**

**Current State:**
- `graphQueries.ts` exists (122 lines) but underutilized
- Templates still use verbose inline queries:
```typescript
const residents = graph.relationships
  .filter(r => r.kind === 'resident_of' && r.dst === locationId)
  .map(r => graph.entities.get(r.src))
  .filter((e): e is HardState => e !== undefined);
```
- Pattern repeated 50+ times across templates/systems
- `helpers.ts` has some query functions but not comprehensive

**Proposed Abstraction:**
```typescript
// Enhanced graphQueries.ts with fluent DSL
export class GraphQuery {
  constructor(private graph: Graph) {}

  // Fluent relationship queries
  from(entityId: string): RelationshipQuery;
  to(entityId: string): RelationshipQuery;
  between(id1: string, id2: string): RelationshipQuery;

  // Fluent entity queries
  entities(): EntityQuery;
}

class RelationshipQuery {
  ofKind(kind: string): this;
  withStrength(min?: number, max?: number): this;
  getEntities(): HardState[];
  getRelationships(): Relationship[];
  count(): number;
}

class EntityQuery {
  ofKind(kind: string): this;
  withSubtype(subtype: string): this;
  withStatus(status: string): this;
  withProminence(level: string): this;
  inLocation(locationId: string): this;
  inFaction(factionId: string): this;
  get(): HardState[];
  first(): HardState | undefined;
  count(): number;
}

// Usage:
const residents = new GraphQuery(graph)
  .to(locationId)
  .ofKind('resident_of')
  .getEntities();

const heroes = new GraphQuery(graph)
  .entities()
  .ofKind('npc')
  .withSubtype('hero')
  .withProminence('renowned')
  .get();
```

**Benefits:**
- Readable: queries read like English
- Type-safe: fluent API provides IntelliSense
- DRY: eliminates repetitive filter/map chains
- Optimizable: could add query optimization later

**Files Affected:**
- 50+ template/system files (reduce ~3-5 lines per query)
- `src/utils/graphQueries.ts` (expand from 122 to ~300 lines)

---

### 7. Extract Relationship Building DSL (Already Started)
**Priority: LOW** | **Risk: LOW** | **LOC Reduction: ~100**

**Current State:**
- `relationshipBuilder.ts` exists (138 lines) but rarely used
- `entityClusterBuilder.ts` exists (213 lines) but rarely used
- Templates still manually construct relationship arrays:
```typescript
const relationships: Relationship[] = [
  { kind: 'split_from', src: 'will-be-assigned-0', dst: parentFaction.id },
  { kind: 'at_war_with', src: 'will-be-assigned-0', dst: parentFaction.id },
  { kind: 'occupies', src: 'will-be-assigned-0', dst: location.id }
];
```
- Pattern repeated in every template

**Proposed Action:**
- Promote existing builders in templates
- Add usage examples to CLAUDE.md
- Create template refactoring guide

**Benefits:**
- Existing utilities get utilized
- Reduces array construction boilerplate
- More readable relationship creation

**Files Affected:**
- 34 template files (refactor to use builders)
- `CLAUDE.md` (add builder usage guide)

**Note:** This is more adoption than extraction

---

### 8. Extract worldEngine Report Generators
**Priority: MEDIUM** | **Risk: LOW** | **LOC Reduction: ~300**

**Current State:**
- `worldEngine.ts` contains multiple large reporting methods:
  - `printFinalFeedbackReport()` - 138 lines (lines 807-944)
  - `reportEpochStats()` - 23 lines (lines 1663-1685)
  - `reportDistributionStats()` - 61 lines (lines 1686-1746)
- Reporting logic mixed with business logic
- Hard to test, hard to customize output format

**Proposed Abstraction:**
```typescript
// src/services/reportGenerator.ts
export class ReportGenerator {
  constructor(
    private graph: Graph,
    private populationTracker: PopulationTracker,
    private feedbackAnalyzer: FeedbackAnalyzer,
    private contractEnforcer: ContractEnforcer
  ) {}

  generateFinalReport(): string;
  generateEpochReport(epoch: number, metrics: EpochMetrics): string;
  generateDistributionReport(): string;

  // Format sections
  private formatFeedbackLoopHealth(): string;
  private formatPopulationMetrics(): string;
  private formatEntityPopulations(): string;
  private formatPressureEquilibrium(): string;
  private formatTemplateUsage(): string;
  private formatTagHealth(): string;
}
```

**Benefits:**
- Separation of concerns: reporting separate from engine logic
- Testable: can test report generation independently
- Customizable: easy to add new report formats (JSON, CSV, etc.)
- Reusable: reports could be generated on-demand

**Files Affected:**
- `src/engine/worldEngine.ts` (remove ~300 lines)
- `src/services/reportGenerator.ts` (new, ~350 lines with better structure)

---

### 9. Extract worldEngine Stop Condition Checker
**Priority: LOW** | **Risk: LOW** | **LOC Reduction: ~50**

**Current State:**
- `shouldContinue()` method in `worldEngine.ts` - 30 lines (lines 629-659)
- Stop condition logic could be reusable/configurable
- Multiple stop conditions hardcoded

**Proposed Abstraction:**
```typescript
// src/services/stopConditionChecker.ts
export interface StopCondition {
  id: string;
  check(graph: Graph, config: EngineConfig, currentEpoch: number): boolean;
  getReason(): string;
}

export class StopConditionChecker {
  private conditions: StopCondition[] = [];

  addCondition(condition: StopCondition): this;
  shouldStop(graph: Graph, config: EngineConfig, currentEpoch: number): { stop: boolean; reason?: string };
}

// Built-in conditions
export const tickLimitCondition: StopCondition = { ... };
export const eraCompletionCondition: StopCondition = { ... };
export const excessiveGrowthCondition: StopCondition = { ... };
```

**Benefits:**
- Configurable: can add/remove conditions without editing engine
- Testable: each condition can be tested independently
- Extensible: easy to add custom stop conditions
- Composable: can combine conditions with AND/OR logic

**Files Affected:**
- `src/engine/worldEngine.ts` (remove ~30 lines, replace with checker)
- `src/services/stopConditionChecker.ts` (new, ~100 lines)

---

### 10. Extract Template Contract Validation
**Priority: LOW** | **Risk: MEDIUM** | **LOC Reduction: ~100**

**Current State:**
- Template filtering logic in growth system application (`worldEngine.ts` + `systems/growthSystem.ts`)
- Multiple contract checks inline:
  - `contractEnforcer.checkContractEnabledBy()`
  - `contractEnforcer.checkSaturation()`
  - `template.canApply()`
  - Template run count checks
- Logic duplicated for validation and filtering

**Proposed Abstraction:**
```typescript
// src/services/templateFilter.ts
export class TemplateFilter {
  constructor(
    private contractEnforcer: ContractEnforcer,
    private templateRunCounts: Map<string, number>,
    private maxRunsPerTemplate: number
  ) {}

  filterApplicable(
    templates: GrowthTemplate[],
    graph: Graph,
    graphView: TemplateGraphView
  ): ApplicableTemplate[] {
    // Returns templates with reasons for inclusion/exclusion
  }

  diagnoseTemplate(
    template: GrowthTemplate,
    graph: Graph,
    graphView: TemplateGraphView
  ): TemplateDiagnostic {
    // Returns detailed diagnostic why template can/cannot apply
  }
}

interface ApplicableTemplate {
  template: GrowthTemplate;
  reason: string;
  priority: number;
}
```

**Benefits:**
- Centralized: all template filtering logic in one place
- Diagnostic: can explain why templates don't apply
- Testable: filtering logic isolated
- Extensible: easy to add new filtering criteria

**Files Affected:**
- `src/engine/worldEngine.ts` (distributed growth system already extracted)
- `src/services/templateFilter.ts` (new, ~200 lines)

**Risk Factors:**
- Medium risk: filtering logic is critical to engine operation
- Must preserve exact filtering behavior during migration
- Integration with contractEnforcer needs careful testing

---

## Implementation Priority Matrix

| Opportunity | Impact | Risk | ROI | Order |
|-------------|--------|------|-----|-------|
| 1. Change Detection System | HIGH | LOW | 🟢 | 1 |
| 2. Parameter Extraction | HIGH | LOW | 🟢 | 2 |
| 3. Enrichment Queue Manager | HIGH | MED | 🟡 | 4 |
| 4. Analytics Tracker | MED | LOW | 🟢 | 3 |
| 8. Report Generators | MED | LOW | 🟢 | 5 |
| 5. Metadata Builder | MED | LOW | 🟡 | 6 |
| 6. Graph Query DSL | MED | LOW | 🟡 | 7 |
| 9. Stop Condition Checker | LOW | LOW | 🟡 | 9 |
| 7. Relationship Builder Adoption | LOW | LOW | 🟡 | 10 |
| 10. Template Filter | LOW | MED | 🔴 | 8 |

**ROI Legend:**
- 🟢 High ROI: High impact, low risk
- 🟡 Medium ROI: Medium impact or medium risk
- 🔴 Lower ROI: Lower impact or higher risk

---

## Estimated Impact Summary

### Code Reduction
- **Total LOC Removed:** ~1,570 lines
- **Total LOC Added:** ~1,650 lines (new services)
- **Net Change:** +80 lines (but much better organized)

**Breaking Down by File:**
- `worldEngine.ts`: -1,350 lines (55% reduction from 2,452 to ~1,100)
- Templates/Systems: -220 lines (parameter extraction, builder adoption)
- New Services: +1,650 lines (10 new files averaging 165 lines)

### Maintainability Improvements
1. **Single Responsibility:** Each service has one clear purpose
2. **Testability:** Services can be unit tested independently
3. **Extensibility:** New behaviors = new strategies/conditions, not code edits
4. **Readability:** worldEngine.ts becomes high-level orchestration

### Migration Strategy
**Phase 1 (Low-hanging fruit):**
1. Parameter Extraction Utility (affects all templates)
2. Analytics Tracker (simple, isolated)
3. Report Generators (pure output, no side effects)

**Phase 2 (Core systems):**
4. Change Detection System (complex but isolated)
5. Enrichment Queue Manager (careful promise handling)

**Phase 3 (Framework improvements):**
6. Metadata Builder (improves developer experience)
7. Graph Query DSL (enhances template authoring)

**Phase 4 (Optional polish):**
8. Stop Condition Checker
9. Template Filter
10. Relationship Builder Adoption

---

## Anti-Patterns Identified

### 1. God Object (WorldEngine)
**Problem:** worldEngine.ts does too much (2,452 lines)
- Engine orchestration
- Change detection
- Enrichment queueing
- Analytics tracking
- Report generation
- Template filtering
- Pressure updates
- Meta-entity formation

**Solution:** Apply opportunities 1, 3, 4, 8, 9, 10

### 2. Repeated Switch Statements
**Problem:** Same switch on entity.kind appears 3+ times
**Solution:** Strategy pattern (opportunity 1) or polymorphic dispatch

### 3. Magic Numbers
**Problem:** Hardcoded thresholds scattered throughout
**Examples:**
- `if (Math.abs(residentDelta) >= 3)` (change detection)
- `notable.slice(0, 3)` (enrichment batching)
- `if (prominenceValue >= 2)` (tier thresholds)

**Solution:** Extract to config/constants

### 4. Long Parameter Lists
**Problem:** Some functions take 5-7 parameters
**Solution:** Parameter objects or builder pattern

### 5. Inline Feature Detection
**Problem:** Feature checks mixed with business logic
```typescript
if (!this.enrichmentService?.isEnabled()) return;
```
**Solution:** Null Object pattern or feature flags service

---

## Testing Recommendations

### Unit Tests (Add After Refactoring)
- `ChangeDetector`: Test each strategy independently
- `ParameterExtractor`: Test default fallbacks, type coercion
- `AnalyticsTracker`: Test counter increment, summary formatting
- `ReportGenerator`: Test report formatting with mock data

### Integration Tests (Verify After Refactoring)
- `worldEngine.test.ts`: Verify stop conditions still work
- Template tests: Verify parameter extraction doesn't break behavior
- System tests: Verify enrichment queueing preserves order

### Regression Tests (Critical)
- Run full generation with refactored code
- Compare output graphs (entity count, relationship count)
- Verify enrichment artifacts match
- Check performance metrics (should be similar or better)

---

## References

**Files Analyzed:**
- `src/engine/worldEngine.ts` (2,452 lines)
- `src/utils/helpers.ts` (857 lines)
- `src/utils/graphQueries.ts` (122 lines)
- `src/utils/relationshipBuilder.ts` (138 lines)
- `src/utils/entityClusterBuilder.ts` (213 lines)
- 34 template files in `src/domain/penguin/templates/`
- 13 system files in `src/domain/penguin/systems/`
- 14 service files in `src/services/`

**Patterns Identified:**
- Parameter extraction: 105 occurrences across 28 files
- Change detection: 5 entity-specific functions
- Enrichment queueing: 6 methods
- Switch on entity.kind: 3 occurrences
- Template metadata: 47 definitions

---

## Next Steps

1. **Review with team:** Prioritize opportunities based on current pain points
2. **Create feature branch:** `refactor/extract-abstractions`
3. **Start with Phase 1:** Low-risk, high-impact utilities
4. **Test thoroughly:** Add unit tests for new services
5. **Migrate incrementally:** One opportunity at a time
6. **Document patterns:** Update CLAUDE.md with new abstractions

**Estimated Effort:**
- Phase 1: 2-3 days
- Phase 2: 3-4 days
- Phase 3: 2-3 days
- Phase 4: 1-2 days
- **Total: 8-12 days** (with testing and documentation)
