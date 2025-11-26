# Meta-Entity Formation & Temporal Tracking - Implementation Guide

## **Overview**
Implementing two complementary systems:
1. **Temporal Tracking**: Mark relationships as active/historical for day 0 coherence
2. **Meta-Entity Formation**: Cluster abilities→schools and rules→legal codes to prevent narrative target proliferation

## **Rationale**

### Problem 1: Temporal Incoherence
- Simulation runs 150+ ticks across multiple eras
- Current export shows ALL relationships ever created
- Result: "High-beak Auditor Selka is a member of 12 factions" (absurd for day 0)
- **Need**: Distinguish current state from historical accumulation

### Problem 2: Narrative Target Proliferation
- Anti-super-hub system successfully diffused NPC connections (good)
- But created atomized entity kinds: 10 NPCs × 5 spells = thin history per spell
- **Need**: Intentional clustering for abilities/rules to create narrative density
- 10 NPCs → 1 School = richer, denser narrative anchor

## **Solution Architecture**

### Temporal Tracking (Foundation)
```typescript
interface Relationship {
  kind: string;
  src: string;
  dst: string;
  status?: 'active' | 'historical';  // NEW
  archivedAt?: number;  // NEW
}

// Helper function
function archiveRelationship(graph: Graph, src: string, dst: string, kind: string): void;

// Export only active relationships for day 0
function exportGameState(graph: Graph): GameState {
  return {
    relationships: graph.relationships.filter(r => r.status !== 'historical')
  };
}
```

### Meta-Entity Formation (Clustering)
```typescript
interface MetaEntityConfig {
  sourceKind: string;       // 'abilities', 'rules'
  metaKind: string;         // 'school', 'legal_code'
  trigger: 'epoch_end';

  clustering: {
    minSize: number;
    criteria: Array<{
      type: 'same_creator' | 'same_location' | 'shared_tags' | 'temporal_proximity';
      weight: number;
    }>;
    minimumScore: number;
  };

  transformation: {
    markOriginalsHistorical: boolean;
    transferRelationships: boolean;
    redirectFutureRelationships: boolean;
    preserveOriginalLinks: boolean;
  };

  factory: (cluster: HardState[], graph: Graph) => Partial<HardState>;
}

class MetaEntityFormation {
  detectClusters(graphView: TemplateGraphView, kind: string): Cluster[];
  formMetaEntity(graph: Graph, cluster: HardState[], config: MetaEntityConfig): HardState;
}
```

## **Implementation Phases**

### Phase 1: Temporal Tracking (Foundation)
**Goal**: Enable relationship lifecycle management

**Tasks**:
1. Add `status` and `archivedAt` fields to Relationship type ✓
2. Create `archiveRelationship()` helper in helpers.ts
3. Update templates that replace entities:
   - succession.ts: Archive old leader_of
   - mysteriousVanishing.ts: Archive all relationships
   - factionSplinter.ts: Optionally archive old member_of
4. Update export logic to filter historical relationships

### Phase 2: Meta-Entity Framework
**Goal**: Create reusable clustering system

**Tasks**:
1. Create `/src/services/metaEntityFormation.ts`
2. Implement MetaEntityConfig interface
3. Implement MetaEntityFormation class:
   - `detectClusters()`: Find similar entities
   - `formMetaEntity()`: Create meta-entity from cluster
   - `transferRelationships()`: Move relationships to meta
4. Add to Graph type
5. Initialize in WorldEngine

### Phase 3: Magic School Formation
**Goal**: Cluster magic abilities into schools

**Tasks**:
1. Add 'school' entity kind to domain schema
2. Create magicSchoolFormation config:
   - Same creator (weight: 5.0)
   - Shared tags (weight: 3.0, threshold: 0.6)
   - Same location (weight: 2.0)
   - Temporal proximity (weight: 1.0, threshold: 30 ticks)
   - Minimum score: 6.0, min size: 3
3. Add to distribution targets
4. Integrate `checkMetaEntityFormation()` in WorldEngine
5. Test with abilities

### Phase 4: Legal Code Formation
**Goal**: Cluster rules into legal codes

**Tasks**:
1. Add 'legal_code' entity kind
2. Create legalCodeFormation config:
   - Same creator (faction/location) (weight: 4.0)
   - Temporal proximity (weight: 2.0, threshold: 40 ticks)
   - Minimum score: 5.0, min size: 4
3. Add to distribution targets
4. Test with rules

### Phase 5: Testing & Validation
**Goal**: Verify both systems work together

**Tasks**:
1. Build and verify compilation
2. Run test generation (150 ticks)
3. Validate meta-entity formation:
   - Check schools formed from magic abilities
   - Check legal codes formed from rules
4. Verify relationship transfer:
   - discoverer_of moved to school
   - enacted_by moved to legal_code
5. Verify day 0 export:
   - Only active relationships exported
   - Meta-entities have rich histories

## **Key Design Decisions**

### Why Epoch-End Timing?
- Predictable: Doesn't disrupt mid-epoch systems
- Complete: All growth and simulation for epoch finished
- Natural: Aligns with era transitions

### Why Mark Originals Historical?
- Preserves full graph for lore generation
- Prevents new relationships to outdated entities
- Uses temporal tracking system (complementary)
- Original entities still queryable for "school encompasses..."

### Why Transfer Relationships?
- Meta-entity inherits all interactions
- Creates narrative density (10 NPCs → 1 school)
- Prevents orphaned relationships

### Why Simple Clustering First?
- Same creator + 3+ entities = obvious cluster
- Can add sophisticated algorithms later if needed
- Fail gracefully (no clusters = no meta-entities)

## **Expected Outcomes**

### Temporal Tracking
- Day 0 export shows current state only
- Historical relationships preserved for lore
- Templates can manage entity lifecycles explicitly

### Meta-Entity Formation
- 20 individual spells → 3-4 schools with rich histories
- 15 scattered laws → 2-3 legal codes
- Schools/codes become "recognized" or "renowned" naturally
- Prevents narrative target proliferation

### Validation Metrics
- Average relationships per school vs per spell (expect 3-5x)
- Number of meta-entities formed per generation (expect 2-4 schools, 1-2 codes)
- Day 0 entity count reduction (expect 10-15% fewer top-level entities)
- Lore richness for meta-entities (expect longer, more detailed descriptions)

## **Future Enhancements**

### Possible Additions
- Technology traditions (cluster tech abilities)
- Combat styles (cluster combat abilities)
- Cultural movements (cluster social rules)
- Merchant guilds (already have factions, but could meta-cluster)

### Possible Refinements
- More sophisticated clustering (graph algorithms, tag embeddings)
- Strength-based clustering (strong relationships = tighter clusters)
- Meta-meta-entities (schools form into traditions)
- Temporal decay (schools lose relevance over time)

## **Anti-Patterns to Avoid**

### Don't Over-Cluster
- Keep minimum size thresholds (3-4 entities)
- Require strong similarity signals
- Single-entity "clusters" are pointless

### Don't Break Existing Systems
- All changes are additive (backward compatible)
- Templates work without meta-entities
- Export filtering is optional

### Don't Add Unnecessary Complexity
- Start with simple same-creator clustering
- Add sophistication only if simple approach fails
- Measure before optimizing

## **Files Modified**

### Core Types
- `/src/types/worldTypes.ts` - Add temporal fields to Relationship
- `/src/types/engine.ts` - Add MetaEntityFormation to Graph

### Services
- `/src/services/metaEntityFormation.ts` - NEW
- `/src/utils/helpers.ts` - Add archiveRelationship()

### Templates (Temporal Tracking)
- `/src/domain/penguin/templates/npc/succession.ts`
- `/src/domain/penguin/templates/npc/mysteriousVanishing.ts`
- `/src/domain/penguin/templates/faction/factionSplinter.ts`

### Engine
- `/src/engine/worldEngine.ts` - Add checkMetaEntityFormation()

### Configuration
- `/src/domain/penguin/config/metaEntityConfigs.ts` - NEW
- `/src/types/distribution.ts` - Add school/legal_code targets

## **Testing Checklist**

- [ ] Temporal tracking: Relationships marked historical
- [ ] Temporal tracking: Day 0 export excludes historical
- [ ] Meta-entity: Schools formed from 3+ magic abilities
- [ ] Meta-entity: Legal codes formed from 4+ rules
- [ ] Meta-entity: Relationships transferred to meta-entities
- [ ] Meta-entity: Original entities marked historical
- [ ] Meta-entity: part_of links created
- [ ] Integration: No breaking changes to existing templates
- [ ] Performance: No significant slowdown (<10% increase)
- [ ] Validation: All entity/relationship integrity checks pass
