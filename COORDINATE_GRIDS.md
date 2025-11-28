Here is the updated implementation plan including the new requirement: **placement strategies can create (and optionally update) regions, based on parameters passed to `placeEntity`.**

---

# Semantic Grid Engine – Implementation Plan (with Dynamic Regions)

Implement a generic framework for placing entities of arbitrary kinds onto **semantic 3D grids** (per kind), querying regions, computing distances, deriving tags based on coordinates, and dynamically creating/updating regions when requested.

Important: **All grids are purely semantic.** Even “location” grids do not map to real-world coordinates; they only encode conceptual relationships.

---

## 0. Design goals

1. Support any number of **entity kinds** (`"location"`, `"magic"`, `"faction"`, etc.).
2. Each entity kind has its own **independent 3D grid**.
3. Grids define:

    * Axes with semantic meaning (`x`, `y` required, `z` optional).
    * Regions (static from config, and dynamic at runtime) as circles (2D) / spheres (3D).
    * Built-in **placement strategies** (configurable per entity kind).
    * **Distance metric** and tag derivation rules.
4. Domain-specific code:

    * Chooses which grid and which placement strategy to use.
    * Defines axis semantics and static region templates via config files.
    * Optionally requests **creation/update of regions** as part of a placement request.
    * Does **not** implement placement algorithms.
5. Engine:

    * Implements all placement algorithms.
    * Manages static + dynamic regions.
    * Derives tags from coordinates and regions.
    * Provides consistent distance and region queries.

---

## 1. Core domain model

### 1.1. Basic primitives

```ts
export type EntityKindId = string; // e.g. "location", "magic", "faction"

export interface GridCoordinate {
  x: number;
  y: number;
  z?: number;
}
```

### 1.2. Axis definition

```ts
export interface AxisDefinition {
  id: "x" | "y" | "z";
  name: string;          // semantic label
  description?: string;
  min: number;
  max: number;
  buckets?: AxisBucketDefinition[];
}

export interface AxisBucketDefinition {
  id: string;            // e.g. "ice", "fire", "high_stability"
  label: string;
  min: number;           // inclusive
  max: number;           // inclusive
  tags: string[];        // tags to add if coord falls in this bucket
}
```

### 1.3. Region definitions (static + dynamic)

Regions are semantic zones, now with **static** (from config) and **dynamic** (runtime-created) variants.

```ts
export type RegionShape = "circle2d" | "sphere3d";

export interface RegionDefinition {
  id: string;
  name: string;
  description?: string;
  shape: RegionShape;
  center: GridCoordinate;
  radius: number;
  tags: string[];          // tags applied when an entity lies inside
  // true for regions created at runtime by strategies
  isDynamic?: boolean;
}
```

We treat static/dynamic regions with the same interface; the difference is only in where they come from and whether they can be modified.

---

### 1.4. Distance definition

```ts
export type DistanceMetricKind = "euclidean" | "manhattan" | "weighted_euclidean";

export interface DistanceMetricDefinition {
  kind: DistanceMetricKind;
  weights?: { x?: number; y?: number; z?: number }; // for weighted
}
```

### 1.5. Placement strategy definition

```ts
export type PlacementStrategyId =
  | "far_from_existing"
  | "offset_from_reference"
  | "nearest_free_in_region"
  | "random_in_region";

export interface PlacementStrategyConfig {
  id: PlacementStrategyId;
  params: Record<string, unknown>; // validated per strategy
}
```

### 1.6. Tag derivation rules

```ts
export interface TagRule {
  id: string;
  description?: string;
  apply: (coord: GridCoordinate, ctx: TagContext) => string[];
}

export interface TagContext {
  matchedAxisBuckets: AxisBucketDefinition[];
  matchedRegions: RegionDefinition[];
}
```

### 1.7. Grid definition per entity kind

```ts
export interface GridDefinition {
  entityKind: EntityKindId;
  axes: AxisDefinition[];         // must include x and y
  // static regions from config; dynamic regions are loaded separately
  staticRegions: RegionDefinition[];
  distanceMetric: DistanceMetricDefinition;
  placementStrategies: PlacementStrategyConfig[];
  tagRules?: TagRule[];
}
```

Note: The engine will build an **effective region set** per kind as:
`effectiveRegions = staticRegions + dynamicRegionsFromStore`.

### 1.8. Entity + region storage interfaces

The engine is storage-agnostic; it relies on two interfaces.

```ts
export interface PlacedEntityRecord {
  id: string;
  kind: EntityKindId;
  coordinate: GridCoordinate;
  tags: string[];
}

export interface EntityStore {
  listByKind(kind: EntityKindId): Promise<PlacedEntityRecord[]>;
  savePlacement(record: PlacedEntityRecord): Promise<void>;
}
```

Dynamic regions:

```ts
export interface RegionRecord extends RegionDefinition {
  kind: EntityKindId;
}

export interface RegionStore {
  listRegionsForKind(kind: EntityKindId): Promise<RegionRecord[]>;
  getRegion(kind: EntityKindId, regionId: string): Promise<RegionRecord | undefined>;
  createRegion(region: RegionRecord): Promise<void>;
  updateRegion(region: RegionRecord): Promise<void>;
}
```

The engine will use:

* `GridDefinition.staticRegions` for static config-defined regions.
* `RegionStore` for dynamic regions.

---

## 2. Configuration loading

Static grid config: axes, static regions, metrics, strategies.

Example (magic grid):

```jsonc
{
  "entityKind": "magic",
  "axes": [ /* as before */ ],
  "staticRegions": [
    {
      "id": "high_stability_ice",
      "name": "High stability ice magics",
      "shape": "circle2d",
      "center": { "x": -0.8, "y": 0.8 },
      "radius": 0.3,
      "tags": ["zone:defensive_ice"]
    }
  ],
  "distanceMetric": {
    "kind": "weighted_euclidean",
    "weights": { "x": 1.0, "y": 2.0 }
  },
  "placementStrategies": [
    { "id": "far_from_existing", "params": { "minDistance": 0.4 } },
    { "id": "offset_from_reference", "params": { "defaultDeltaY": 0.1 } },
    { "id": "random_in_region", "params": {} }
  ]
}
```

Loader:

```ts
export interface GridConfigLoader {
  loadAll(): Promise<GridDefinition[]>;
  getGridForKind(kind: EntityKindId): Promise<GridDefinition | undefined>;
}
```

---

## 3. Engine public API (with region creation/update)

### 3.1. Region mutation requests

Domain code can request creation or update of regions as part of `placeEntity`.

```ts
export interface CreateRegionRequest {
  kind?: EntityKindId;       // defaults to req.kind
  name?: string;             // if omitted, engine may auto-name
  description?: string;
  shape?: RegionShape;       // default: "circle2d" for 2D grids
  radius: number;            // required for creation
  tags?: string[];           // extra tags specific to this region
  // optional template id from config for inheriting defaults
  templateRegionId?: string; // from staticRegions if needed
}

export interface UpdateRegionRequest {
  regionId: string;
  // currently support radius and tags; extensions possible later
  newRadius?: number;
  addTags?: string[];
  removeTags?: string[];
}

export interface RegionMutationRequest {
  createRegion?: CreateRegionRequest;
  updateRegion?: UpdateRegionRequest;
}
```

### 3.2. Placement request / result

```ts
export interface PlacementRequest {
  kind: EntityKindId;
  strategyId: PlacementStrategyId;
  args?: Record<string, unknown>;
  regionMutation?: RegionMutationRequest; // NEW
}

export interface PlacementResult {
  coordinate: GridCoordinate;
  tags: string[];
  distanceToNearest?: number;
  createdRegionId?: string; // if region created
  updatedRegionId?: string; // if region updated
}
```

### 3.3. Queries

```ts
export interface RegionQuery {
  kind: EntityKindId;
  regionId: string;
}

export interface DistanceQuery {
  kind: EntityKindId;
  a: GridCoordinate;
  b: GridCoordinate;
}

export interface SemanticGridEngine {
  placeEntity(req: PlacementRequest): Promise<PlacementResult>;

  computeDistance(query: DistanceQuery): Promise<number>;

  listEntitiesInRegion(query: RegionQuery): Promise<PlacedEntityRecord[]>;
}
```

The engine will be constructed with:

* `GridConfigLoader`
* `EntityStore`
* `RegionStore`

---

## 4. Placement strategies (unchanged conceptually, now region-aware)

All strategies operate within a single `kind`/grid. Dynamic region creation is handled in a **post-placement step** driven by `regionMutation`.

### 4.1. `far_from_existing`

Params: `minDistance`, `maxAttempts`, optional `regionId` to constrain search.

Behavior: same as before, but candidate region constraint uses **effective regions** (static + dynamic).

### 4.2. `offset_from_reference`

Params via `req.args`: `referenceEntityId`, `delta`, and config defaults.

Behavior: same as before; no direct region creation logic inside the strategy.

### 4.3. `nearest_free_in_region`

Params: `regionId`, `gridResolution`, `minDistance`.

Behavior: same; uses region from **effective** region set.

### 4.4. `random_in_region`

Params: `regionId`.

Behavior: same.

---

## 5. Region membership, effective regions, and queries

### 5.1. Region math

```ts
function isInRegion(coord: GridCoordinate, region: RegionDefinition): boolean {
  if (region.shape === "circle2d") {
    const dx = coord.x - region.center.x;
    const dy = coord.y - region.center.y;
    return dx*dx + dy*dy <= region.radius * region.radius;
  }

  if (region.shape === "sphere3d") {
    const dx = coord.x - region.center.x;
    const dy = coord.y - region.center.y;
    const dz = (coord.z ?? 0) - (region.center.z ?? 0);
    return dx*dx + dy*dy + dz*dz <= region.radius * region.radius;
  }

  return false;
}
```

### 5.2. Effective regions per kind

Engine helper:

```ts
async function getEffectiveRegions(
  kind: EntityKindId,
  grid: GridDefinition,
  regionStore: RegionStore
): Promise<RegionDefinition[]> {
  const dynamic = await regionStore.listRegionsForKind(kind);
  return [...grid.staticRegions, ...dynamic];
}
```

`listEntitiesInRegion`:

1. Get grid.
2. Get effective regions for that kind.
3. Find region by `regionId`.
4. Fetch all entities of kind.
5. Filter using `isInRegion`.

---

## 6. Distance metrics

Same as before; no changes needed.

```ts
function computeDistance(
  coordA: GridCoordinate,
  coordB: GridCoordinate,
  metric: DistanceMetricDefinition
): number {
  const dx = coordA.x - coordB.x;
  const dy = coordA.y - coordB.y;
  const dz = (coordA.z ?? 0) - (coordB.z ?? 0);

  switch (metric.kind) {
    case "euclidean":
      return Math.sqrt(dx*dx + dy*dy + dz*dz);
    case "manhattan":
      return Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
    case "weighted_euclidean": {
      const wx = metric.weights?.x ?? 1;
      const wy = metric.weights?.y ?? 1;
      const wz = metric.weights?.z ?? 1;
      return Math.sqrt(wx*dx*dx + wy*dy*dy + wz*dz*dz);
    }
    default:
      throw new Error(`Unknown distance metric: ${metric.kind}`);
  }
}
```

---

## 7. Tag derivation (now includes dynamic regions)

Tag derivation must consider **all effective regions**, including those just created/updated in this placement.

```ts
async function deriveTags(
  coord: GridCoordinate,
  grid: GridDefinition,
  regionStore: RegionStore
): Promise<string[]> {
  const axisBuckets: AxisBucketDefinition[] = [];
  const regionMatches: RegionDefinition[] = [];
  const tags: string[] = [];

  // axis buckets
  for (const axis of grid.axes) {
    if (!axis.buckets) continue;
    const value = axis.id === "x" ? coord.x : axis.id === "y" ? coord.y : coord.z ?? 0;
    for (const bucket of axis.buckets) {
      if (value >= bucket.min && value <= bucket.max) {
        axisBuckets.push(bucket);
        tags.push(...bucket.tags);
      }
    }
  }

  // effective regions
  const effectiveRegions = await getEffectiveRegions(grid.entityKind, grid, regionStore);

  for (const region of effectiveRegions) {
    if (isInRegion(coord, region)) {
      regionMatches.push(region);
      tags.push(...region.tags);
    }
  }

  // global rules
  if (grid.tagRules) {
    const ctx: TagContext = { matchedAxisBuckets: axisBuckets, matchedRegions: regionMatches };
    for (const rule of grid.tagRules) {
      tags.push(...rule.apply(coord, ctx));
    }
  }

  return [...new Set(tags)];
}
```

Note: For a **newly created region** centered on the placed entity, the engine must:

1. Place coordinate.
2. Apply region mutation (create/update).
3. Then call `deriveTags`, so the new region’s tags are included.

---

## 8. Region mutation behavior in `placeEntity`

`SemanticGridEngine.placeEntity` workflow:

1. Load `GridDefinition` for `req.kind`.

2. Run placement strategy to compute `coordinate`.

3. Handle `regionMutation` if present:

   ```ts
   let createdRegionId: string | undefined;
   let updatedRegionId: string | undefined;

   if (req.regionMutation?.createRegion) {
     const r = req.regionMutation.createRegion;
     const regionId = generateRegionId(); // engine-defined
     const shape = r.shape ?? "circle2d";

     const region: RegionRecord = {
       id: regionId,
       kind: r.kind ?? req.kind,
       name: r.name ?? `Region:${req.kind}:${regionId}`,
       description: r.description,
       shape,
       center: coordinate,            // region centered on the new entity
       radius: r.radius,
       tags: r.tags ?? [],
       isDynamic: true
     };

     // optional: if templateRegionId provided, merge template tags/description
     if (r.templateRegionId) {
       const template = grid.staticRegions.find(s => s.id === r.templateRegionId);
       if (template) {
         region.tags = [...new Set([...template.tags, ...region.tags])];
         region.description = region.description ?? template.description;
         if (!r.shape) region.shape = template.shape;
       }
     }

     await regionStore.createRegion(region);
     createdRegionId = regionId;
   }

   if (req.regionMutation?.updateRegion) {
     const u = req.regionMutation.updateRegion;
     const existing = await regionStore.getRegion(req.kind, u.regionId);
     if (!existing) {
       throw new Error(`Region ${u.regionId} not found for kind ${req.kind}`);
     }

     if (u.newRadius !== undefined) existing.radius = u.newRadius;
     if (u.addTags?.length) existing.tags = [...new Set([...existing.tags, ...u.addTags])];
     if (u.removeTags?.length) {
       existing.tags = existing.tags.filter(t => !u.removeTags!.includes(t));
     }

     await regionStore.updateRegion(existing);
     updatedRegionId = existing.id;
   }
   ```

4. After region mutation is applied, call `deriveTags`:

   ```ts
   const tags = await deriveTags(coordinate, grid, regionStore);
   ```

5. Return `PlacementResult`:

   ```ts
   return { coordinate, tags, distanceToNearest, createdRegionId, updatedRegionId };
   ```

**Example use case:**

* Domain decides to found a new colony (new political entity) and wants its own semantic “influence region”:

    * Calls `placeEntity` with:

        * `kind: "location"`, `strategyId: "far_from_existing"`.
        * `regionMutation.createRegion = { radius: 0.25, tags: ["region:colony_a_influence"] }`.
    * Engine places the colony coordinate, creates a dynamic region centered on it, with the given radius and tags, and returns `createdRegionId`.
    * Future entities (locations, events) can be placed with strategies that refer to this new regionId.

---

## 9. Placement workflow end-to-end (with dynamic regions)

1. Domain chooses `kind`, `strategyId`, and any strategy `args`.
2. If this action should define a new semantic region (e.g. new colony, new political center of gravity), domain also sets `regionMutation.createRegion`.
3. Domain calls `engine.placeEntity(req)`.
4. Engine:

    * Loads grid config.
    * Fetches existing entities and dynamic regions as needed.
    * Runs placement strategy to compute `coordinate`.
    * Applies `regionMutation`:

        * Create a new region around this coordinate, or
        * Update an existing region.
    * Derives tags using axis semantics + static and dynamic regions.
5. Engine returns `PlacementResult` with coordinate, tags, and any `createdRegionId` / `updatedRegionId`.
6. Domain:

    * Creates/persists the actual domain entity (spell, location, faction, etc.).
    * Persists placement via `EntityStore.savePlacement`.
    * Feeds `tags` into the name generator, which might output “Ice Wall of Protection”, “First City of the Glass Frontier”, etc.
    * Optionally stores `createdRegionId`/`updatedRegionId` as references on the entity.

No grid ever corresponds to real spatial coordinates; all x/y(/z) axes and regions are semantic.

---

## 10. Implementation order checklist (updated)

1. Define core types (`GridCoordinate`, `AxisDefinition`, `RegionDefinition`, `DistanceMetricDefinition`, `PlacementStrategyId`, `GridDefinition`).
2. Implement `EntityStore` and `RegionStore` interfaces (no concrete DB yet).
3. Implement `GridConfigLoader` (loading static grids).
4. Implement helpers:

    * `computeDistance`
    * `isInRegion`
    * `getEffectiveRegions`
5. Implement tag derivation (`deriveTags`) using axis buckets + effective regions + tag rules.
6. Implement placement strategies:

    * `far_from_existing`
    * `offset_from_reference`
    * `nearest_free_in_region`
    * `random_in_region`
7. Implement `SemanticGridEngine`:

    * Wire strategies with `PlacementStrategyConfig`.
    * Implement `placeEntity` including:

        * Strategy execution.
        * Region mutation (`createRegion` / `updateRegion`).
        * Tag derivation.
    * Implement `computeDistance`.
    * Implement `listEntitiesInRegion` using effective regions.
8. Add thin domain adapters per entity kind that:

    * Construct appropriate `PlacementRequest` (including optional `regionMutation`).
    * Persist entities and placements.
    * Call name generation with derived tags.

This satisfies the new requirement: **domain code can request new regions or updates as part of a placement**, while the engine owns all the mechanics of region creation, tagging, and distance semantics on each kind-specific semantic grid.
