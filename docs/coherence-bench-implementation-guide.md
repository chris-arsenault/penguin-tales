# Coherence Bench Implementation Guide

## Executive Summary

This document outlines a high-level implementation plan for the **Coherence Bench** - a UI component that validates simulation system coherence and allows parameter tuning. The challenge is bridging the gap between static JSON schemas (current UI approach) and dynamic TypeScript code modules (templates/systems).

## Problem Statement

### Current Architecture

The existing UI (`apps/lore-weave/webui`) operates on JSON data:
- `generated_world.json` - Complete world graph output
- `lore.json` - LLM-enriched narratives
- `stats.json` - Simulation statistics

The UI treats domain configuration as data, loading `uiSchema` from generated output. This works because the schema is static - entity kinds, relationship kinds, and cultures don't change during a simulation run.

### The Coherence Challenge

Templates and systems are TypeScript modules with:
- **Dynamic `canApply()` functions** - Complex conditional logic
- **Runtime-computed behavior** - Results depend on graph state
- **Procedural `expand()`/`apply()` methods** - Side effects

You cannot fully represent `heroEmergence.canApply()` as JSON because it contains:
```typescript
if (conflictPressure < 5 && graphView.getEntityCount() <= 20) {
  return false;
}
if (conflictPressure > 80) {
  return Math.random() < 0.3;
}
```

### Coherence Issues to Detect

1. **Entity Coverage Gaps**: Entity types with no creators or too many creators
2. **Orphan Tags**: Tags set by templates but never acted on by systems
3. **Dead Relationships**: Relationship kinds created but never consumed
4. **Broken Feedback Loops**: Declared loops that don't activate
5. **Distribution Imbalances**: Entity/relationship ratios outside targets
6. **Pressure Disequilibrium**: Pressures without sources or sinks
7. **Parameter Misconfiguration**: Thresholds that can never be met

## Architecture Approach

### Key Insight: Static Metadata + Runtime Validation

The solution is a **two-tier architecture**:

1. **Static Introspection Layer** - Extract analyzable metadata from code
2. **Runtime Validation Layer** - Execute actual simulations to verify behavior

### Metadata Already Available

Templates and systems already declare rich metadata:

```typescript
// Template metadata (from heroEmergence.ts:33-55)
metadata: {
  produces: {
    entityKinds: [{ kind: 'npc', subtype: 'hero', count: {...}, prominence: [...] }],
    relationships: [{ kind: 'practitioner_of', probability: 0.8 }, ...]
  },
  effects: { graphDensity: 0.2, clusterFormation: 0.3, diversityImpact: 0.5 },
  tags: ['crisis-driven', 'individual']
}

// System metadata (from relationshipFormation.ts:34-188)
metadata: {
  produces: {
    relationships: [{ kind: 'follower_of', frequency: 'common' }, ...],
    modifications: [...]
  },
  parameters: {
    throttleChance: { value: 0.3, min: 0.1, max: 1.0, description: '...' },
    friendshipBaseChance: { value: 0.2, min: 0.05, max: 0.5, description: '...' },
    // ... many more tunable parameters
  }
}

// Component contracts (from engine/types.ts:270-305)
contract: {
  purpose: ComponentPurpose.ENTITY_CREATION,
  enabledBy: {
    pressures: [{ name: 'conflict', threshold: 5 }],
    entityCounts: [...]
  },
  affects: {
    entities: [...],
    relationships: [...],
    pressures: [...]
  }
}
```

### What's Missing for Full Analysis

1. **Aggregated Metadata Export** - No single JSON file with all template/system metadata
2. **Cross-Reference Analysis** - No automated detection of orphan tags/relationships
3. **Execution Metrics** - Statistics exist but aren't correlated to declarations
4. **Parameter Sensitivity** - No analysis of how parameters affect outcomes

## Implementation Plan

### Phase 1: Metadata Export Pipeline

Create a build-time extraction that produces `coherence_metadata.json`:

```typescript
// New file: apps/lore-weave/lib/coherence/metadataExporter.ts

interface CoherenceMetadata {
  templates: TemplateIntrospection[];
  systems: SystemIntrospection[];
  feedbackLoops: FeedbackLoop[];
  tagRegistry: TagMetadata[];
  pressures: PressureDefinition[];
  entityRegistries: EntityOperatorRegistry[];
}

interface TemplateIntrospection {
  id: string;
  name: string;
  metadata?: TemplateMetadata;
  contract?: ComponentContract;
  // Extracted from code analysis:
  pressureDependencies: { pressure: string; threshold: number; operator: 'lt' | 'gt' | 'eq' }[];
  entityDependencies: { kind: string; subtype?: string; min?: number }[];
  tagsProduced: string[];
  tagsConsumed: string[];  // From canApply/findTargets inspection
}

interface SystemIntrospection {
  id: string;
  name: string;
  metadata?: SystemMetadata;
  contract?: ComponentContract;
  relationshipsConsumed: string[];  // From apply() inspection
  tagsConsumed: string[];
  tagsProduced: string[];
}
```

**Implementation**:
- Add metadata export as part of domain build process
- Export happens at `npm run build` time, not simulation time
- Output goes to `penguin-tales/lore/output/coherence_metadata.json`

### Phase 2: Coherence Analyzer Service

Create an analysis service that processes metadata:

```typescript
// New file: apps/lore-weave/lib/coherence/coherenceAnalyzer.ts

interface CoherenceReport {
  entityCoverage: EntityCoverageReport;
  tagHealth: TagHealthReport;           // Already exists in engine/types.ts
  relationshipFlow: RelationshipFlowReport;
  feedbackLoopValidation: FeedbackValidationReport;
  pressureEquilibrium: PressureEquilibriumReport;
  parameterRecommendations: ParameterRecommendation[];
}

interface EntityCoverageReport {
  byKind: Record<string, {
    target: number;
    creators: { templateId: string; expectedCount: number; primary: boolean }[];
    modifiers: { systemId: string; operation: string }[];
    issues: string[];
  }>;
  uncreatedKinds: string[];
  overservedKinds: string[];
}

interface RelationshipFlowReport {
  byKind: Record<string, {
    creators: string[];      // Template/system IDs that create this relationship
    consumers: string[];     // System IDs that use this relationship
    balance: 'balanced' | 'overcreated' | 'underconsumed' | 'orphan';
  }>;
  orphanRelationships: string[];  // Created but never used
  missingRelationships: string[]; // Used but never created
}

interface ParameterRecommendation {
  componentId: string;
  parameter: string;
  currentValue: number;
  recommendedValue: number;
  reason: string;
  confidence: number;
}
```

**Analysis Algorithms**:

1. **Entity Coverage**: Cross-reference `entityRegistries` with `templates[].contract.affects.entities`
2. **Tag Flow**: Build tag producer/consumer graph from metadata, detect orphans
3. **Relationship Flow**: Build relationship producer/consumer graph, detect orphans
4. **Feedback Loops**: Validate declared loops against `pressures[].contract` flow
5. **Parameter Sensitivity**: Use gradient descent on mini-simulations (optional, advanced)

### Phase 3: Coherence Bench UI

Build a new UI view integrated into the existing webui:

```
apps/lore-weave/webui/src/components/
├── CoherenceBench/
│   ├── CoherenceBench.tsx        # Main container
│   ├── EntityCoverageView.tsx    # Entity kind coverage visualization
│   ├── TagFlowGraph.tsx          # Tag producer/consumer flow diagram
│   ├── RelationshipMatrix.tsx    # Relationship creation/consumption matrix
│   ├── FeedbackLoopDiagram.tsx   # Feedback loop visualization
│   ├── PressureEquilibrium.tsx   # Pressure balance visualization
│   ├── ParameterTuner.tsx        # Interactive parameter adjustment
│   └── CoherenceReportCard.tsx   # Summary report cards
```

#### UI Components

**1. Entity Coverage View**
- Grid showing each entity kind/subtype
- Color-coded: green (balanced), yellow (under-served), red (over-served/uncreated)
- Click to expand and see creator templates
- Show target count vs. creator capacity

**2. Tag Flow Graph**
- Sankey diagram: Templates → Tags → Systems
- Highlight orphan tags (no consumers) in red
- Show tag usage counts from actual simulation runs
- Filter by tag category (status, trait, affiliation, etc.)

**3. Relationship Matrix**
- Heatmap: rows = relationship kinds, columns = templates/systems
- Cell color = creation (green) / consumption (blue)
- Red highlights for orphan relationships
- Click to see exact relationship definitions

**4. Feedback Loop Diagram**
- Interactive node-link diagram
- Nodes = metrics (pressures, entity counts)
- Edges = feedback relationships with direction and strength
- Color by validation status: green (working), yellow (weak), red (broken)

**5. Pressure Equilibrium View**
- For each pressure:
  - Sources (green bars pointing up)
  - Sinks (red bars pointing down)
  - Current equilibrium prediction
  - Validation status

**6. Parameter Tuner**
- Expandable cards for each template/system
- Slider controls for each declared parameter
- Real-time preview of effects (requires simulation endpoint)
- "Reset to defaults" and "Apply" buttons
- Export modified parameters as JSON patch

### Phase 4: Runtime Validation API

Create an API endpoint for live simulation testing:

```typescript
// New file: apps/lore-weave/lib/coherence/coherenceServer.ts

interface CoherenceTestRequest {
  parameterOverrides: Record<string, Record<string, number>>;
  simulationTicks: number;
  seedState?: Partial<Graph>;
}

interface CoherenceTestResponse {
  success: boolean;
  metrics: {
    entityDistribution: Record<string, number>;
    relationshipDistribution: Record<string, number>;
    pressureHistory: Record<string, number[]>;
    tagUsage: Record<string, number>;
    feedbackLoopCorrelations: Record<string, number>;
  };
  warnings: string[];
  recommendations: ParameterRecommendation[];
}
```

This allows the UI to:
1. Modify parameters
2. Run mini-simulations (50-100 ticks)
3. See immediate effects
4. Get recommendations for fixes

### Phase 5: Integration Points

#### 5.1 Data Loading

Modify `App.tsx` to load coherence metadata:

```typescript
// Existing pattern
fetch('/generated_world.json')
fetch('/lore.json')
fetch('/images/image_metadata.json')

// Add new
fetch('/coherence_metadata.json')
```

#### 5.2 Navigation

Add "Coherence Bench" as a new view mode alongside "History Explorer":

```typescript
type ViewMode = 'explorer' | 'coherence';  // in WorldExplorer.tsx
```

#### 5.3 Build Pipeline

Update domain build to export coherence metadata:

```bash
# In penguin-tales/lore/package.json
"scripts": {
  "build": "npm run build:types && npm run build:metadata",
  "build:metadata": "ts-node scripts/exportCoherenceMetadata.ts"
}
```

## Technical Challenges & Mitigations

### Challenge 1: Code vs. Data

**Problem**: `canApply()` functions contain imperative logic that can't be serialized.

**Mitigation**:
- Extract what CAN be serialized (pressure thresholds from contracts)
- Accept that some analysis requires runtime validation
- Use mini-simulations for dynamic behavior testing

### Challenge 2: Framework/Domain Separation

**Problem**: Coherence UI needs to understand both framework and domain code.

**Mitigation**:
- Metadata export happens at domain level (knows both)
- UI only consumes the exported JSON
- Framework provides base types; domain provides concrete data

### Challenge 3: Parameter Interdependencies

**Problem**: Changing one parameter affects many others.

**Mitigation**:
- Show dependency graph in UI
- Run multiple mini-simulations to detect interactions
- Warn about cascading effects

### Challenge 4: Performance

**Problem**: Mini-simulations are expensive.

**Mitigation**:
- Use smaller world sizes for testing (scale factor = 0.1)
- Cache results for identical parameter sets
- Run simulations in web worker or backend

## File Structure Summary

```
apps/lore-weave/
├── lib/
│   ├── coherence/                    # NEW
│   │   ├── metadataExporter.ts       # Extracts metadata from templates/systems
│   │   ├── coherenceAnalyzer.ts      # Analyzes metadata for issues
│   │   ├── coherenceServer.ts        # API for runtime validation
│   │   └── types.ts                  # Coherence-specific types
│   ├── engine/
│   │   └── frameworkValidator.ts     # Existing - extend for coherence
│   └── feedback/
│       └── feedbackAnalyzer.ts       # Existing - integrate with coherence
│
├── webui/src/
│   ├── components/
│   │   ├── CoherenceBench/           # NEW
│   │   │   ├── CoherenceBench.tsx
│   │   │   ├── EntityCoverageView.tsx
│   │   │   ├── TagFlowGraph.tsx
│   │   │   ├── RelationshipMatrix.tsx
│   │   │   ├── FeedbackLoopDiagram.tsx
│   │   │   ├── PressureEquilibrium.tsx
│   │   │   ├── ParameterTuner.tsx
│   │   │   └── CoherenceReportCard.tsx
│   │   └── WorldExplorer.tsx         # Modified - add view toggle
│   └── types/
│       └── coherence.ts              # NEW - UI-side coherence types

penguin-tales/lore/
├── output/
│   └── coherence_metadata.json       # NEW - exported at build time
└── scripts/
    └── exportCoherenceMetadata.ts    # NEW - metadata export script
```

## Recommended Implementation Order

1. **Week 1**: Metadata Export Pipeline
   - Create `metadataExporter.ts`
   - Add build script to domain
   - Generate initial `coherence_metadata.json`

2. **Week 2**: Coherence Analyzer
   - Implement entity coverage analysis
   - Implement tag flow analysis
   - Implement relationship flow analysis

3. **Week 3**: Basic UI Components
   - Create `CoherenceBench.tsx` container
   - Implement `EntityCoverageView.tsx`
   - Implement `TagFlowGraph.tsx` (use D3 or Recharts)

4. **Week 4**: Advanced UI Components
   - Implement `RelationshipMatrix.tsx`
   - Implement `FeedbackLoopDiagram.tsx`
   - Implement `PressureEquilibrium.tsx`

5. **Week 5**: Parameter Tuning
   - Implement `ParameterTuner.tsx`
   - Create coherence server API
   - Add mini-simulation capability

6. **Week 6**: Polish & Integration
   - Connect all components
   - Add navigation
   - Performance optimization
   - Documentation

## Success Criteria

The Coherence Bench is successful when users can:

1. **Identify** entity types with no creators or too many creators
2. **Discover** tags that are set but never acted upon
3. **Find** relationship kinds that are orphaned
4. **Validate** feedback loops are functioning as declared
5. **Tune** simulation parameters with immediate feedback
6. **Export** parameter changes for integration into domain code

## Alternative Approaches Considered

### Alternative 1: Full Code Analysis (AST Parsing)

**Idea**: Parse TypeScript AST to extract all logic from `canApply()`/`expand()`.

**Rejected because**:
- Extremely complex for arbitrary TypeScript
- Would need to handle closures, external references
- Brittle to code changes
- Over-engineered for the value provided

### Alternative 2: DSL for Templates/Systems

**Idea**: Define templates/systems in a declarative DSL instead of TypeScript.

**Rejected because**:
- Major breaking change to existing code
- Limits expressiveness (complex conditions become awkward)
- Requires migration of 30+ templates, 15+ systems
- Could be a future evolution, not immediate solution

### Alternative 3: Pure Runtime Analysis

**Idea**: No static analysis, only run simulations and observe.

**Rejected because**:
- Can't explain WHY something is broken
- Expensive (many simulation runs)
- No guidance on how to fix issues
- Acceptable as supplement, not replacement

## Conclusion

The Coherence Bench bridges the gap between static configuration and dynamic behavior by:

1. **Extracting analyzable metadata** at build time
2. **Performing static analysis** on declared contracts and metadata
3. **Validating with mini-simulations** for dynamic behavior
4. **Providing interactive parameter tuning** with feedback

This approach respects the existing architecture while providing the introspection needed to ensure simulation coherence.
