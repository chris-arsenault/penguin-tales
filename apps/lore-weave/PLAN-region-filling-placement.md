# Implementation Plan: Region-Filling Placement Strategy

## Problem Statement

Currently, entity placement on semantic planes supports:
1. **near_entity** - Place near a reference entity (with optional min/max distance)
2. **in_culture_region** - Place within a culture's seed region
3. **derived_from_references** - Average position from multiple same-kind references
4. **random_in_bounds** - Random position within specified bounds

**Missing capability**: Place an entity in an *unoccupied* or *sparse* area of the semantic plane. This is needed for templates like `colony_founding` where new colonies should spread out across the plane rather than cluster near existing ones.

**Disconnected subsystem**: `createEmergentRegion()` exists in both `RegionMapper` and `CoordinateContext` but is never called from templates. This subsystem can dynamically create named regions, but there's no way for templates to trigger it.

## Proposed Solution

### 1. New Placement Strategy: `in_sparse_area`

Add a new placement type that finds an unoccupied or low-density area on the semantic plane.

```typescript
// In declarativeTypes.ts - add to PlacementSpec union
| {
    type: 'in_sparse_area';
    minDistanceFromEntities?: number;  // Min distance from existing same-kind entities (default: 15)
    preferEdges?: boolean;              // Bias toward plane edges (default: false)
    createRegion?: {                    // Optionally create an emergent region at the placement
      label: string;                    // Region label (can use template vars like "{$entity.name} Territory")
      description?: string;             // Region description
    };
  }
```

### 2. Implementation in `templateInterpreter.ts`

Add a new case in `resolvePlacement()`:

```typescript
case 'in_sparse_area': {
  const spec = placement as {
    type: 'in_sparse_area';
    minDistanceFromEntities?: number;
    preferEdges?: boolean;
    createRegion?: { label: string; description?: string };
  };

  // Use coordinateContext to find sparse area
  const result = graphView.findSparseArea(entityKind, {
    minDistanceFromEntities: spec.minDistanceFromEntities ?? 15,
    preferEdges: spec.preferEdges ?? false
  });

  if (!result.success) {
    // Fall back to random placement
    return {
      coordinates: { x: Math.random() * 100, y: Math.random() * 100, z: 50 },
      strategy: 'in_sparse_area_fallback'
    };
  }

  // Optionally create emergent region
  if (spec.createRegion) {
    graphView.createEmergentRegion(
      entityKind,
      result.coordinates,
      resolveTemplate(spec.createRegion.label, context),
      spec.createRegion.description || `Emergent region at tick ${graphView.tick}`,
      graphView.tick,
      creatingEntityId
    );
  }

  return { coordinates: result.coordinates, strategy: 'in_sparse_area' };
}
```

### 3. New Method in `CoordinateContext`: `findSparseArea()`

```typescript
// In coordinateContext.ts
findSparseArea(
  entityKind: string,
  options: {
    minDistanceFromEntities: number;
    preferEdges: boolean;
    maxAttempts?: number;
  }
): { success: boolean; coordinates?: Point; failureReason?: string } {
  const existingEntities = this.getEntitiesOfKind(entityKind);  // Need graph access
  const regions = this.getRegions(entityKind);

  // Strategy: Sample candidate points and score them by distance from existing entities
  const candidates: Array<{ point: Point; score: number }> = [];
  const attempts = options.maxAttempts ?? 50;

  for (let i = 0; i < attempts; i++) {
    // Generate candidate point
    let point: Point;
    if (options.preferEdges) {
      // Bias toward edges of 0-100 space
      point = this.generateEdgeBiasedPoint();
    } else {
      point = { x: Math.random() * 100, y: Math.random() * 100, z: 50 };
    }

    // Calculate minimum distance to any existing entity
    const minDist = this.calculateMinDistanceToEntities(point, existingEntities);

    if (minDist >= options.minDistanceFromEntities) {
      candidates.push({ point, score: minDist });
    }
  }

  if (candidates.length === 0) {
    return { success: false, failureReason: 'No sparse area found after max attempts' };
  }

  // Return the point with highest score (furthest from existing entities)
  candidates.sort((a, b) => b.score - a.score);
  return { success: true, coordinates: candidates[0].point };
}
```

### 4. Expose in `TemplateGraphView`

```typescript
// In templateGraphView.ts
findSparseArea(
  entityKind: string,
  options: { minDistanceFromEntities: number; preferEdges: boolean }
): { success: boolean; coordinates?: Point; failureReason?: string } {
  // Gather existing entity positions for this kind
  const existingPositions = this.findEntities({ kind: entityKind })
    .map(e => e.coordinates)
    .filter((c): c is Point => c !== undefined);

  return this.coordinateContext.findSparseArea(entityKind, {
    ...options,
    existingPositions  // Pass entity positions to CoordinateContext
  });
}
```

### 5. Wire Up Emergent Region Creation

The existing `createEmergentRegion()` is already exposed on `TemplateGraphView`. The new `in_sparse_area` placement with `createRegion` option will automatically call it.

For explicit region creation from templates (without placement), we could add:

```typescript
// In CreationRule - optional region creation
export interface CreationRule {
  // ... existing fields ...
  createRegion?: {
    label: string;
    description?: string;
    atPlacement?: boolean;  // Create region at entity's placement coordinates
  };
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `lib/engine/declarativeTypes.ts` | Add `in_sparse_area` to `PlacementSpec` union |
| `lib/engine/templateInterpreter.ts` | Add `in_sparse_area` case in `resolvePlacement()` |
| `lib/coordinates/coordinateContext.ts` | Add `findSparseArea()` method |
| `lib/graph/templateGraphView.ts` | Add `findSparseArea()` wrapper method |
| `lib/__tests__/coordinates/coordinateContext.test.ts` | Tests for `findSparseArea()` |
| `lib/__tests__/engine/templateInterpreter.test.ts` | Tests for new placement strategy |

## Example Usage

### Colony Founding Template (updated)

```json
{
  "id": "colony_founding",
  "creation": [{
    "entityRef": "$colony",
    "kind": "location",
    "subtype": "colony",
    "placement": {
      "type": "in_sparse_area",
      "minDistanceFromEntities": 20,
      "preferEdges": false,
      "createRegion": {
        "label": "{$colony.name} Territory",
        "description": "Settled region around the new colony"
      }
    }
  }]
}
```

### Anomaly Manifestation Template

```json
{
  "id": "anomaly_manifestation",
  "creation": [{
    "entityRef": "$anomaly",
    "kind": "location",
    "subtype": "anomaly",
    "placement": {
      "type": "in_sparse_area",
      "minDistanceFromEntities": 30,
      "preferEdges": true
    }
  }]
}
```

## Testing Strategy

1. **Unit tests for `findSparseArea()`**:
   - Empty plane returns any point
   - Single entity avoids that area
   - Multiple entities finds gaps
   - `preferEdges` biases toward boundaries
   - Failure case when plane is too crowded

2. **Integration tests for `in_sparse_area` placement**:
   - Template with new placement type resolves correctly
   - Region creation triggers when specified
   - Fallback works when no sparse area found

3. **Visual verification**:
   - Run simulation with colony_founding using new placement
   - Verify colonies spread across plane instead of clustering

## Migration

Existing templates using `near_entity` with high `minDistance` can optionally migrate to `in_sparse_area` for better semantic fit, but no breaking changes required.

## Open Questions

1. **Should `findSparseArea` consider existing regions as obstacles?** Currently only considers entity positions. Could add option to also avoid existing region bounds.

2. **Z-axis handling**: Should sparse area search also consider z-coordinate, or just x/y plane? Proposal: x/y only for simplicity, z defaults to 50 or culture-derived.

3. **Performance**: With many entities, calculating distances to all could be slow. Consider spatial indexing if this becomes a bottleneck.
