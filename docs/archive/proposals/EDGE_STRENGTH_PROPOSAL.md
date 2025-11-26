# Edge Strength/Weight System - Proposal

## The Problem

**Current State**: Entities have `prominence` (forgotten → mythic) but relationships don't have strength/weight.

**Impact**: Graph algorithms must hard-code relationship type lists:
```typescript
// distributionTracker.ts line 241
const narrativeRelationships = new Set([
  'member_of', 'practitioner_of', 'originated_in', // ... hard-coded
]);
```

**Limitations**:
- ❌ Inflexible clustering (can't tune thresholds)
- ❌ Can't query "strongly connected entities"
- ❌ Can't weight paths by narrative importance
- ❌ Templates can't declare relationship strengths in metadata
- ❌ Hard to do sophisticated graph algorithms (PageRank, community detection)

---

## Proposed Solution

### Add `strength` field to relationships

```typescript
interface Relationship {
  kind: string;
  src: string;
  dst: string;
  strength?: number;  // 0.0 (weak) to 1.0 (strong) - NEW
}
```

### Default strength by relationship kind

**Strong (0.9-1.0)**: Narrative-defining
- `member_of`, `leader_of`, `follower_of`
- `practitioner_of`, `mastered_by`
- `originated_in`, `founded_by`

**Medium (0.5-0.8)**: Important but not defining
- `ally_of`, `enemy_of`, `rival_of`
- `friend_of`, `mentor_of`, `family_of`
- `controls`, `commemorates`

**Weak (0.1-0.4)**: Contextual/spatial
- `resident_of`, `located_at`
- `adjacent_to`, `discovered_by`

**Very Weak (0.0-0.1)**: Metadata/descriptive
- `tags`, `links` (if modeled as relationships)

---

## Implementation Options

### Option A: Quick Integration (1-2 hours)

**Scope**: Minimal changes, backward compatible

**Steps**:
1. Add `strength?: number` to Relationship type
2. Create `RELATIONSHIP_STRENGTHS` config (like RELATIONSHIP_WARNING_THRESHOLDS)
3. Update `addRelationship()` to auto-assign strength from config
4. Update clustering to use `strength >= threshold` instead of hard-coded set
5. Default to `1.0` if not specified (backward compatible)

**Files Changed**:
- `src/types/worldTypes.ts` - Add optional field
- `src/utils/helpers.ts` - Add config, update addRelationship
- `src/services/distributionTracker.ts` - Use strength instead of Set

**Code Example**:
```typescript
// helpers.ts
const RELATIONSHIP_STRENGTHS: Record<string, number> = {
  // Strong (narrative-defining)
  'member_of': 1.0,
  'leader_of': 1.0,
  'practitioner_of': 0.9,
  'originated_in': 0.9,

  // Medium (important)
  'ally_of': 0.7,
  'friend_of': 0.6,
  'rival_of': 0.6,

  // Weak (spatial)
  'resident_of': 0.3,
  'adjacent_to': 0.2,

  // Default
  'default': 0.5
};

export function addRelationship(graph, kind, srcId, dstId): void {
  const strength = RELATIONSHIP_STRENGTHS[kind] ?? RELATIONSHIP_STRENGTHS.default;
  graph.relationships.push({ kind, src: srcId, dst: dstId, strength });
  // ... rest of function
}

// distributionTracker.ts
graph.relationships.forEach((r) => {
  if (r.strength && r.strength >= 0.7) {  // Threshold for "strong"
    adjacency.get(r.src)?.add(r.dst);
    adjacency.get(r.dst)?.add(r.src);
  }
});
```

**Benefits**:
- ✅ Fast implementation
- ✅ Backward compatible (optional field)
- ✅ Immediate value (flexible clustering)
- ✅ Foundation for future work

**Limitations**:
- Static strengths (not dynamic/context-dependent)
- Single threshold for clustering (not weighted)
- Doesn't integrate with template metadata yet

---

### Option B: Comprehensive System (1-2 days)

**Scope**: Full edge weight architecture

**Additional Features**:
1. **Template Metadata**: Declare strengths in produces.relationships
   ```typescript
   metadata: {
     produces: {
       relationships: [
         { kind: 'member_of', strength: 1.0, category: 'political' }
       ]
     }
   }
   ```

2. **Weighted Clustering**: Use actual weights in algorithms
   ```typescript
   // Louvain modularity or weighted connected components
   const edgeWeight = (a, b) =>
     relationships.filter(r => connects(r, a, b))
       .reduce((sum, r) => sum + (r.strength || 0.5), 0);
   ```

3. **Dynamic Strengths**: Context-dependent weights
   ```typescript
   // member_of strength depends on entity prominence
   const strength = baseStrength * (1 + srcEntity.prominenceValue * 0.2);
   ```

4. **Validation**: Warn if template metadata strength doesn't match config default

5. **Export Metrics**: Include strength distribution in distributionMetrics

**Files Changed**:
- All Option A files +
- `src/types/distribution.ts` - Add strength to TemplateMetadata
- `src/services/templateSelector.ts` - Consider strength in selection
- `src/services/distributionTracker.ts` - Weighted clustering algorithm
- All templates - Add strength to metadata

**Benefits**:
- ✅ Full architectural solution
- ✅ Integrates with template metadata
- ✅ Enables sophisticated algorithms
- ✅ Future-proof

**Challenges**:
- ❌ Significant work (20-30 files to update)
- ❌ Requires testing all templates
- ❌ May reveal edge cases/bugs
- ❌ Delays current tuning work

---

### Option C: Design Document Only (30 min)

**Scope**: Comprehensive design for future implementation

**Document Sections**:
1. **Motivation**: Why edge strength matters
2. **Use Cases**: Clustering, querying, path-finding, PageRank
3. **Architecture**: Type changes, config, algorithms
4. **Migration Path**: How to add without breaking existing code
5. **Integration Points**: Template metadata, graph algorithms, exports
6. **Open Questions**: Dynamic vs static, bidirectional weights, validation

**Benefits**:
- ✅ Captures the insight now
- ✅ Informs future design decisions
- ✅ Doesn't block current work
- ✅ Can be refined iteratively

**Limitations**:
- ❌ No immediate functionality
- ❌ Risk of forgetting or deprioritizing

---

## Recommendation

**For Current State (Mid-Run Tuning Focus)**:

→ **Option A: Quick Integration**

**Rationale**:
1. **Fast** (1-2 hours) - won't derail tuning work
2. **High Value** - makes clustering flexible, removes hard-coded sets
3. **Foundation** - enables Option B later without rework
4. **Testable** - can verify immediately with current tuning tests

**Implementation Plan**:
```
1. Add strength?: number to Relationship type (5 min)
2. Create RELATIONSHIP_STRENGTHS config (15 min)
3. Update addRelationship() to assign strengths (10 min)
4. Update distributionTracker clustering (20 min)
5. Add strength threshold to distributionTargets.json (10 min)
6. Test with current generation (15 min)
7. Document in SYSTEM_ENABLED.md (10 min)
---
Total: ~90 minutes
```

**Defer to Later** (Post-Tuning):
- Option B features (template metadata integration)
- Weighted clustering algorithms
- Dynamic/context-dependent strengths
- Strength distribution validation

---

## Open Questions for Review

1. **Strength Scale**: 0.0-1.0 or 0-100? (Recommend 0.0-1.0 for consistency with probabilities)

2. **Threshold Tuning**: Should clustering threshold be in distributionTargets.json?
   ```json
   {
     "graphConnectivity": {
       "clusteringStrengthThreshold": 0.7  // Only edges >= 0.7 form clusters
     }
   }
   ```

3. **Backward Compatibility**: Missing strength defaults to 0.5 or 1.0?
   - 0.5 = "medium strength by default"
   - 1.0 = "assume important unless specified"

4. **Multiple Edges**: If A→B has multiple relationships, cluster on:
   - Max strength?
   - Sum of strengths?
   - Count of strong edges?

5. **Future Integration**: Should strength influence template selection?
   - Boost templates creating strong relationships during high deviation?
   - Penalize templates creating weak relationships?

---

## Decision: OPTION A COMPLETED ✅

**Implemented**: Option A - Quick integration (completed in ~90 min)

**Files Changed**:
1. `src/types/worldTypes.ts` - Added `strength?: number` to Relationship
2. `src/utils/helpers.ts` - Added RELATIONSHIP_STRENGTHS config, updated addRelationship()
3. `src/services/distributionTracker.ts` - Replaced hard-coded Set with strength threshold
4. `config/distributionTargets.json` - Added clusteringStrengthThreshold: 0.6
5. `src/types/distribution.ts` - Added clusteringStrengthThreshold field to GraphConnectivity
6. `SYSTEM_ENABLED.md` - Documented edge strength system

**Implementation Details**:
- Strength scale: 0.0-1.0 (consistent with probabilities)
- Clustering threshold: 0.6 (configurable in distributionTargets.json)
- Default strength for missing: 0.5 (medium)
- Multiple edges strategy: Each edge has independent strength
- Backward compatible: Optional field, defaults to 0.5

**What This Enables**:
- ✅ Flexible clustering (no hard-coded relationship type lists)
- ✅ Tunable threshold via JSON config
- ✅ Foundation for Option B features (future)
- ✅ Immediate value for current tuning work

## Original Options

**Which option**?
- [x] **Option A**: Quick integration now (90 min) - COMPLETED ✅
- [ ] **Option B**: Comprehensive system now (1-2 days) - DEFERRED
- [ ] **Option C**: Design doc only, implement later (30 min)
- [ ] **Option D**: Skip entirely, current hard-coded approach is fine

**If Option A, answer open questions**:
- Strength scale: _______
- Clustering threshold: _______
- Default strength for missing: _______
- Multiple edges strategy: _______

**If Option C, when to revisit**?
- After mid-run tuning tests complete?
- After cross-run learning implemented?
- When adding new graph algorithms?
