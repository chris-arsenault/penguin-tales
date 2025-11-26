# Meta-Entity Formation & Temporal Tracking - Task Log

**Started**: 2025-11-23
**Target Completion**: Legal codes working
**Status**: IN PROGRESS

---

## **Phase 1: Temporal Tracking** [IN PROGRESS]

### ✅ Task 1.1: Add temporal fields to Relationship type
**Status**: COMPLETED
**File**: `/src/types/worldTypes.ts`
**Changes**:
- Added `status?: 'active' | 'historical'` field
- Added `archivedAt?: number` field
**Verification**: Type compiles, backward compatible (optional fields)

### ⏳ Task 1.2: Create archiveRelationship() helper
**Status**: IN PROGRESS
**File**: `/src/utils/helpers.ts`
**Requirements**:
- Function signature: `archiveRelationship(graph: Graph, src: string, dst: string, kind: string): void`
- Find matching active relationship
- Set status = 'historical'
- Set archivedAt = graph.tick
- Update entity links arrays if needed

### ⬜ Task 1.3: Update succession template
**Status**: PENDING
**File**: `/src/domain/penguin/templates/npc/succession.ts`
**Changes**:
- When new leader chosen, archive old `leader_of` relationship
- Use `archiveRelationship(graph, oldLeader.id, faction.id, 'leader_of')`

### ⬜ Task 1.4: Update mysteriousVanishing template
**Status**: PENDING
**File**: `/src/domain/penguin/templates/npc/mysteriousVanishing.ts`
**Changes**:
- Archive all relationships of vanishing NPC
- `resident_of`, `member_of`, `leader_of`, etc.

### ⬜ Task 1.5: Update factionSplinter template
**Status**: PENDING
**File**: `/src/domain/penguin/templates/faction/factionSplinter.ts`
**Changes**:
- Optionally archive old `member_of` if NPC fully defects
- Keep both if partial defection (with different strengths)

### ⬜ Task 1.6: Update export logic
**Status**: PENDING
**File**: `/src/engine/worldEngine.ts` (or export function)
**Changes**:
- Filter relationships: `relationships.filter(r => r.status !== 'historical')`
- Add comment explaining day 0 coherence

---

## **Phase 2: Meta-Entity Framework** [PENDING]

### ⬜ Task 2.1: Create MetaEntityConfig interface
**Status**: PENDING
**File**: `/src/types/engine.ts` or `/src/types/metaEntity.ts` (new)
**Definition**:
```typescript
interface MetaEntityConfig {
  sourceKind: string;
  metaKind: string;
  trigger: 'epoch_end';
  clustering: {
    minSize: number;
    maxSize?: number;
    criteria: Array<{
      type: 'same_creator' | 'same_location' | 'shared_tags' | 'temporal_proximity';
      weight: number;
      threshold?: number;
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

interface Cluster {
  entities: HardState[];
  score: number;
  matchedCriteria: string[];
}
```

### ⬜ Task 2.2: Create MetaEntityFormation service
**Status**: PENDING
**File**: `/src/services/metaEntityFormation.ts` (new)
**Class Structure**:
```typescript
export class MetaEntityFormation {
  private configs: Map<string, MetaEntityConfig>;

  constructor();
  registerConfig(config: MetaEntityConfig): void;
  detectClusters(graphView: TemplateGraphView, kind: string): Cluster[];
  formMetaEntity(graph: Graph, cluster: HardState[], config: MetaEntityConfig): HardState;
  private transferRelationships(graph: Graph, cluster: HardState[], metaId: string): void;
  private calculateSimilarity(e1: HardState, e2: HardState, criteria): number;
}
```

### ⬜ Task 2.3: Implement clustering algorithm
**Status**: PENDING
**Method**: `detectClusters()`
**Algorithm**: Greedy clustering
1. Sort entities by creation time
2. For each entity, check similarity with existing clusters
3. If similarity > threshold, add to cluster
4. If no match, start new cluster
5. Return clusters with size >= minSize

### ⬜ Task 2.4: Implement formMetaEntity()
**Status**: PENDING
**Steps**:
1. Call config.factory() to create meta-entity
2. Add meta-entity to graph
3. Mark originals as historical (if configured)
4. Transfer relationships (if configured)
5. Create part_of links (if configured)
6. Return created entity

### ⬜ Task 2.5: Implement relationship transfer
**Status**: PENDING
**Method**: `transferRelationships()`
**Logic**:
1. Find all relationships involving cluster entities
2. For each relationship:
   - If src in cluster: update src to metaId
   - If dst in cluster: update dst to metaId
   - Mark original as historical
   - Create new relationship with updated endpoints

### ⬜ Task 2.6: Add to Graph type
**Status**: PENDING
**File**: `/src/types/engine.ts`
**Changes**:
```typescript
export interface Graph {
  // ... existing fields
  metaEntityFormation?: MetaEntityFormation;
}
```

### ⬜ Task 2.7: Initialize in WorldEngine
**Status**: PENDING
**File**: `/src/engine/worldEngine.ts`
**Changes**:
1. Import MetaEntityFormation
2. Create instance in constructor
3. Assign to this.graph.metaEntityFormation
4. Register configs

---

## **Phase 3: Magic School Formation** [PENDING]

### ⬜ Task 3.1: Add school entity kind
**Status**: PENDING
**Files**:
- `/src/types/domainSchema.ts` (if exists) OR
- Update wherever entity kinds are defined
**Changes**:
- Add 'school' as valid entity kind
- Add subtypes: 'magic', 'technology', 'combat'
- Add valid statuses: 'nascent', 'established', 'renowned', 'forgotten'

### ⬜ Task 3.2: Create magicSchoolFormation config
**Status**: PENDING
**File**: `/src/domain/penguin/config/metaEntityConfigs.ts` (new)
**Configuration**:
```typescript
export const magicSchoolFormation: MetaEntityConfig = {
  sourceKind: 'abilities',
  metaKind: 'school',
  trigger: 'epoch_end',

  clustering: {
    minSize: 3,
    maxSize: 8,
    criteria: [
      { type: 'same_creator', weight: 5.0 },
      { type: 'shared_tags', weight: 3.0, threshold: 0.6 },
      { type: 'same_location', weight: 2.0 },
      { type: 'temporal_proximity', weight: 1.0, threshold: 30 }
    ],
    minimumScore: 6.0
  },

  transformation: {
    markOriginalsHistorical: true,
    transferRelationships: true,
    redirectFutureRelationships: true,
    preserveOriginalLinks: true
  },

  factory: (cluster, graph) => {
    // Implementation in config file
  }
};
```

### ⬜ Task 3.3: Add school to distribution targets
**Status**: PENDING
**File**: `/src/types/distribution.ts` or wherever targets defined
**Changes**:
```typescript
entities: {
  school: {
    magic: { target: 0.02, tolerance: 0.01 },  // Expect 2-4 per 200 entities
    technology: { target: 0.01, tolerance: 0.01 },
    combat: { target: 0.01, tolerance: 0.01 }
  }
}
```

### ⬜ Task 3.4: Integrate checkMetaEntityFormation()
**Status**: PENDING
**File**: `/src/engine/worldEngine.ts`
**Method**:
```typescript
private checkMetaEntityFormation(): void {
  if (!this.graph.metaEntityFormation) return;

  const graphView = new TemplateGraphView(this.graph, this.targetSelector);
  const configs = Array.from(this.graph.metaEntityFormation.configs.values());

  let formed = 0;
  for (const config of configs) {
    const clusters = this.graph.metaEntityFormation.detectClusters(graphView, config.sourceKind);

    for (const cluster of clusters) {
      if (cluster.score >= config.clustering.minimumScore) {
        const meta = this.graph.metaEntityFormation.formMetaEntity(this.graph, cluster.entities, config);
        formed++;

        // Log to history
        this.graph.history.push({
          tick: this.graph.tick,
          era: this.graph.currentEra.id,
          type: 'special',
          description: `${meta.name} emerged from ${cluster.entities.length} ${config.sourceKind}`,
          entitiesCreated: [meta.id],
          relationshipsCreated: [],
          entitiesModified: cluster.entities.map(e => e.id)
        });
      }
    }
  }

  if (formed > 0) {
    console.log(`  ✨ ${formed} meta-entities formed`);
  }
}
```

**Call site**:
```typescript
async run(): Promise<Graph> {
  for (let epoch = 0; epoch < maxEpochs; epoch++) {
    // Growth phase
    // Simulation phase
    // Check meta-entity formation (NEW)
    this.checkMetaEntityFormation();
    // Update pressures
  }
}
```

### ⬜ Task 3.5: Test with abilities
**Status**: PENDING
**Actions**:
1. Build project
2. Run generation
3. Check console for "meta-entities formed"
4. Verify schools created in output
5. Verify relationships transferred

---

## **Phase 4: Legal Code Formation** [PENDING]

### ⬜ Task 4.1: Add legal_code entity kind
**Status**: PENDING
**Changes**:
- Add 'legal_code' as valid entity kind
- Add subtypes: 'institutional', 'religious', 'martial'
- Add valid statuses: 'proposed', 'enacted', 'enforced', 'obsolete'

### ⬜ Task 4.2: Create legalCodeFormation config
**Status**: PENDING
**File**: `/src/domain/penguin/config/metaEntityConfigs.ts`
**Configuration**:
```typescript
export const legalCodeFormation: MetaEntityConfig = {
  sourceKind: 'rules',
  metaKind: 'legal_code',
  trigger: 'epoch_end',

  clustering: {
    minSize: 4,
    criteria: [
      { type: 'same_creator', weight: 4.0 },
      { type: 'temporal_proximity', weight: 2.0, threshold: 40 }
    ],
    minimumScore: 5.0
  },

  transformation: {
    markOriginalsHistorical: false,  // Laws stay active
    transferRelationships: true,
    redirectFutureRelationships: true,
    preserveOriginalLinks: true
  },

  factory: (cluster, graph) => {
    // Implementation
  }
};
```

### ⬜ Task 4.3: Add legal_code to distribution targets
**Status**: PENDING
**Changes**:
```typescript
entities: {
  legal_code: {
    institutional: { target: 0.01, tolerance: 0.005 }
  }
}
```

### ⬜ Task 4.4: Test with rules
**Status**: PENDING
**Actions**:
1. Register legalCodeFormation config
2. Run generation
3. Verify legal codes created
4. Verify rules are part_of codes

---

## **Phase 5: Testing & Validation** [PENDING]

### ⬜ Task 5.1: Build and compile
**Status**: PENDING
**Command**: `npm run build`
**Expected**: Zero errors

### ⬜ Task 5.2: Run test generation
**Status**: PENDING
**Command**: `npm run dev`
**Expected**:
- Generation completes
- Console shows meta-entity formation
- No crashes

### ⬜ Task 5.3: Validate meta-entity formation
**Status**: PENDING
**Checks**:
- Schools formed: 2-4 expected
- Legal codes formed: 1-2 expected
- Meta-entities have kind 'school' or 'legal_code'
- Meta-entities have prominence 'recognized' or higher

### ⬜ Task 5.4: Check relationship transfer
**Status**: PENDING
**Checks**:
- Count discoverer_of relationships to schools
- Count enacted_by relationships to legal_codes
- Verify original entities have status 'historical'
- Verify part_of relationships created

### ⬜ Task 5.5: Verify day 0 export
**Status**: PENDING
**Checks**:
- Load output/generated_world.json
- Count total relationships
- Count relationships with status='historical'
- Verify export excludes historical (if filter implemented)
- Verify High-beak Auditor Selka has reasonable faction count

---

## **Progress Summary**

**Completed**: 1/22 tasks (5%)
**In Progress**: 1/22 tasks (5%)
**Pending**: 20/22 tasks (90%)

**Current Phase**: Phase 1 (Temporal Tracking)
**Current Task**: 1.2 (archiveRelationship helper)

---

## **Blockers & Issues**

None currently.

---

## **Notes & Decisions**

1. **Temporal tracking first**: Foundation for meta-entity marking originals historical
2. **Simple clustering**: Same creator + size threshold initially
3. **Epoch-end timing**: Clean, predictable, doesn't disrupt systems
4. **Backward compatible**: All changes additive, optional fields
5. **Test incrementally**: Validate each phase before moving to next

---

## **Next Session Checklist**

When resuming work:
1. Read this file to see current status
2. Check last completed task
3. Continue with next pending task
4. Update task status as you work
5. Add notes about any issues or decisions
