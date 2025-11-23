# Mid-Run Statistical Tuning - ENABLED ✅

## Status: Ready for Testing

The statistical distribution system is now **ENABLED** and wired up for mid-run tuning.

---

## What's Active

### ✅ Edge Strength System (NEW)

**Location**: Implemented across multiple files

**What Changed**:
1. Relationships now have optional `strength` field (0.0-1.0)
2. Auto-assigned based on relationship kind via `RELATIONSHIP_STRENGTHS` config
3. Clustering uses strength threshold instead of hard-coded relationship list

**Strength Categories** (`src/utils/helpers.ts:205-235`):
```typescript
Strong (1.0-0.8): Narrative-defining
  - member_of, leader_of, practitioner_of, originated_in, founded_by

Medium (0.7-0.4): Important narrative
  - controls, ally_of, enemy_of, friend_of, rival_of

Weak (0.3-0.1): Spatial/contextual
  - resident_of, adjacent_to, discovered_by
```

**Clustering Threshold** (`config/distributionTargets.json:61`):
```json
{
  "graphConnectivity": {
    "clusteringStrengthThreshold": 0.6,
    "clusteringComment": "Only relationships with strength >= 0.6 form clusters"
  }
}
```

**How It Works**:
- `addRelationship()` auto-assigns strength from config
- Clustering algorithm filters by `strength >= 0.6` instead of hard-coded Set
- Strong relationships (factions, abilities, laws) form narrative clusters
- Weak spatial relationships (geography) don't create clusters

**Benefits**:
- ✅ Flexible clustering threshold (tunable via JSON)
- ✅ No hard-coded relationship type lists in algorithms
- ✅ Foundation for weighted graph algorithms (PageRank, community detection)
- ✅ Templates can declare relationship strengths in metadata (future)

### ✅ Template Selection Influenced by Distribution Analysis

**Location**: `src/engine/worldEngine.ts:210-232`

```typescript
if (this.templateSelector) {
  // Statistical template selection based on distribution targets
  const applicableTemplates = this.config.templates.filter(t => t.canApply(this.graph));

  // Build era weights map
  const eraWeights: Record<string, number> = {};
  applicableTemplates.forEach(t => {
    eraWeights[t.id] = getTemplateWeight(era, t.id);
  });

  // TemplateSelector applies statistical adjustments
  weightedTemplates = this.templateSelector.selectTemplates(
    this.graph,
    applicableTemplates,
    eraWeights,
    growthTargets * 3
  );
}
```

**How It Works**:
1. **Every growth phase** (every epoch), TemplateSelector is called
2. Measures current distribution state (entity kinds, prominence, relationships, clusters)
3. Calculates deviation from targets (defined in `distributionTargets.json`)
4. Adjusts template weights:
   - **Boost** templates that create underrepresented entity kinds
   - **Boost** templates with target prominence levels
   - **Penalize** templates creating over-represented relationship types
   - **Boost** cluster-forming templates if clusters < target
   - **Boost** dispersing templates if clusters > target

5. Selects templates using adjusted weights

### ✅ Graph Connectivity Analysis

**Location**: `src/services/distributionTracker.ts:223-316`

**Metrics Measured**:
- **Cluster Count**: Number of disconnected components
- **Average Cluster Size**: Mean entities per cluster
- **Intra-Cluster Density**: Edge density within clusters
- **Inter-Cluster Density**: Edge density between clusters
- **Isolated Nodes**: Entities with no connections

**Targets** (from `config/distributionTargets.json`):
```json
{
  "targetClusters": {
    "min": 3,
    "max": 8,
    "preferred": 5
  },
  "clusterSizeDistribution": {
    "type": "powerlaw",
    "alpha": 2.5,
    "comment": "Few large clusters, many small ones"
  },
  "densityTargets": {
    "intraCluster": 0.65,  // Dense within clusters
    "interCluster": 0.12,  // Sparse between clusters
  },
  "isolatedNodeRatio": {
    "max": 0.05  // Max 5% isolated
  }
}
```

**Note on Power Law**: The system aims for power law distribution (few large clusters, many small ones) through template selection, but does NOT statistically validate the distribution yet. This is a target/goal, not a constraint.

### ✅ Distribution Monitoring

**Location**: `src/engine/worldEngine.ts:620-673`

Every epoch displays:
```
=== Distribution Statistics ===
Entity Kinds (current vs target):
  ✓ npc: 28.5% (target: 30.0%, -1.5%)
  ⚠️ location: 18.2% (target: 25.0%, -6.8%)

Prominence (current vs target):
  ✓ marginal: 26.3% (target: 25.0%, +1.3%)
  ⚠️ mythic: 5.1% (target: 10.0%, -4.9%)

Top relationship types:
  ✓ member_of: 12.3%
  ⚠️ resident_of: 18.7%

Graph Connectivity:
  Clusters: 4 (target: 5)
  Avg cluster size: 28.5
  Avg connections/entity: 3.7
  Isolated nodes: 3 (2.1%)

Overall Deviation Score: 0.087
✓ CONVERGED - template selection is lightly guided
```

### ✅ Era-Specific Target Overrides

**Enabled**: Yes, fully implemented

**How It Works**: `DistributionTracker.calculateDeviation()` merges era overrides with global targets

**Example** (The Faction Wars):
```json
{
  "entityKindDistribution": {
    "npc": 0.35,      // More NPCs during conflict
    "faction": 0.25   // More factions during conflict
  },
  "prominenceDistribution": {
    "renowned": 0.30,  // Heroes rise
    "mythic": 0.15     // Legendary defenders
  }
}
```

During "The Faction Wars" era:
- Templates creating NPCs get boosted
- Templates creating high-prominence entities get boosted
- Templates creating locations get penalized (vs global targets)

### ✅ Export Metrics

**Location**: `src/engine/worldEngine.ts:1090-1109`

Final world state includes:
```json
{
  "metadata": { ... },
  "hardState": [ ... ],
  "distributionMetrics": {
    "entityKindRatios": { "npc": 0.285, "location": 0.182, ... },
    "prominenceRatios": { "marginal": 0.263, "mythic": 0.051, ... },
    "relationshipTypeRatios": { "member_of": 0.123, ... },
    "graphMetrics": {
      "clusters": 4,
      "avgClusterSize": 28.5,
      "intraClusterDensity": 0.68,
      "interClusterDensity": 0.11,
      "isolatedNodes": 3
    },
    "deviation": {
      "overall": 0.087,
      "entityKind": 0.042,
      "prominence": 0.053,
      "relationship": 0.012,
      "connectivity": 0.031
    },
    "targets": { ... }
  }
}
```

---

## Verification Checklist

When you run `npm start`, you should see:

### At Startup:
```
✓ Statistical template selection enabled
Starting world generation...
```

### During Each Epoch:
```
=== Epoch X: Era Name ===
  Growth: +12 entities (target: 15)
  Entities by kind: { npc: 45, location: 32, faction: 28, rules: 18, abilities: 12 }
  Relationships: 234

  === Distribution Statistics ===
  Entity Kinds (current vs target):
    [List of kinds with ✓ or ⚠️]

  Prominence (current vs target):
    [List of levels with ✓ or ⚠️]

  Top relationship types:
    [List of top 5 types]

  Graph Connectivity:
    Clusters: X (target: 5)
    ...

  Overall Deviation Score: X.XXX
  [CONVERGED / HIGH DEVIATION message]
```

### At End:
```
Generation complete!
Final state: 152 entities, 387 relationships
⚠️ Warnings logged to: output/warnings.log  (if any warnings)
```

### In Output Files:
- `output/generated_world.json` - Should contain `distributionMetrics` section
- `output/warnings.log` - Should contain relationship warnings (not console spam)

---

## Configuration Active

**File**: `config/distributionTargets.json`

**Global Targets**:
- Total entities: 150 ± 10%
- Entity kinds: npc 30%, location 25%, faction 20%, rules 15%, abilities 10%
- Prominence: Normal distribution centered on "recognized"
- Relationships: Max 15% in any single type, min 12 types present
- Graph: 5 clusters preferred, power law sizes, 65% intra-cluster density

**Era-Specific Overrides**: 5 eras with custom targets

**Tuning Parameters**:
- Convergence threshold: 0.08
- Correction strengths: entityKind 1.2, prominence 0.8, relationship 1.5, connectivity 1.0
- Min template weight: 0.05
- Max template weight: 3.0

---

## What's NOT Implemented (Future Work)

### Power Law Validation ❌
- System **aims for** power law cluster distribution
- Does NOT statistically validate α = 2.5
- Templates boosted/penalized to achieve "few large, many small" pattern
- Could add validation: fit power law, measure goodness of fit

### Era-Specific Relationship Preferences ⚠️ Partial
- Defined in config but not used yet
- Example: "The Faction Wars" prefers `rival_of`, `enemy_of`, `ally_of`
- TemplateSelector doesn't boost these specific relationship types
- Could add: boost templates creating preferred types during specific eras

### Template Effectiveness Tracking ❌
- No measurement of which templates achieve targets best
- No historical data on template performance
- Future: track actual vs predicted distributions per template

### Adaptive Parameters ❌
- Parameters static throughout run
- Future: adjust probabilities mid-run if deviating too much

### Cross-Run Optimization ❌
- No multi-run parameter learning
- Future: Bayesian optimization, gradient descent, evolutionary algorithms

---

## Testing Recommendations

### Baseline Test (No Distribution)
1. Comment out `distributionTargets` in `main.ts`
2. Run: `npm start`
3. Record final metrics (entity counts, relationship counts, cluster count)
4. Save output to `baseline_output.json`

### Statistical Test (With Distribution)
1. Uncomment `distributionTargets` in `main.ts`
2. Run: `npm start`
3. Compare final metrics to baseline
4. Check if distribution metrics show convergence (deviation < 0.15)
5. Save output to `statistical_output.json`

### Key Metrics to Compare:
- **Entity kind ratios**: Closer to 30/25/20/15/10?
- **Prominence distribution**: More normal curve?
- **Relationship diversity**: No type > 15%?
- **Cluster count**: Closer to 5?
- **Isolated nodes**: < 5%?

### Expected Improvements:
- ✅ More balanced entity kind distribution
- ✅ Better prominence curve (fewer extremes)
- ✅ Higher relationship diversity (less concentration)
- ✅ More stable cluster count (fewer isolated components)

---

## Troubleshooting

### "Statistical template selection enabled" not showing
- Check `main.ts` line 74: `distributionTargets` is set
- Check build succeeded: `npm run build`

### Distribution Statistics not showing
- Only shows when `templateSelector` exists
- Check console for initialization message

### Deviation score always high (> 0.15)
- Early epochs expected to have high deviation
- Should converge by epoch 5-10
- If not converging: targets may be unrealistic or conflicting

### Warnings still on console
- Should be in `output/warnings.log`
- Check file exists and has content
- If still on console: relationship warnings from before build

---

## Ready to Test! 🚀

Run: `npm start`

The system will:
1. Initialize with statistical selection
2. Measure distribution every epoch
3. Adjust template weights toward targets
4. Display deviation scores
5. Export final metrics

Watch for convergence toward targets over ~10-20 epochs.
