# True Locations Recovery Plan (framework vs domain separation)

This plan replaces the earlier generic proposal with a repo-aware path to repair the failed **true-locations** implementation while keeping framework responsibilities isolated from domain (penguin) specifics. Framework code must stay generic; domain configuration and orchestration should consume it without leaking penguin knowledge into the shared libraries.

## 1) What already exists in the repo
### Framework (keep generic)
- **RegionMapper** manages region lookup, emergent region creation, and tag application for a single coordinate map. It is currently instantiated per `TemplateGraphView`, which makes emergent regions ephemeral. `apps/lore-weave/lib/coordinates/regionMapper.ts`
- **RegionPlacementService** samples points within regions or global space and can trigger emergent expansion. `apps/lore-weave/lib/coordinates/regionPlacement.ts`
- **SemanticEncoder** projects tags onto semantic axes to derive coordinates with jitter. `apps/lore-weave/lib/coordinates/semanticEncoder.ts`
- **KindRegionService** is a per-kind wrapper around RegionMapper that supports seeding, emergent creation, and serialization, but it is not wired into engine/graph yet. `apps/lore-weave/lib/coordinates/kindRegionService.ts`

### Domain (penguin-only consumption of the framework)
- Per-kind map configs, emergent defaults, and semantic axes/weights live under `penguin-tales/lore/config/` with schema exposure in `penguin-tales/lore/schema.ts`. These must remain consumers of the framework APIs rather than drivers of framework logic.

## 2) Failures on the true-locations branch
1. Region state is not shared: `TemplateGraphView` constructs a fresh `RegionMapper` per view, so emergent regions created during placement are lost and never exported.
2. Per-kind region configuration and the `KindRegionService` wrapper are unused; everything runs through a single map, so NPC/faction/rules/ability placements cannot have independent regions.
3. Placement/tagging order does not support the new requirement for strategies to create/update regions around placed entities; tags are derived before any persistent region mutation.
4. Region/semantic state is not persisted in world exports or reloaded, so coordinates reset across runs and tests cannot validate stability.

## 3) Updated implementation plan

### A. Framework: centralize coordinate services (no domain knowledge)
- Add a **CoordinateContext** owned by the `Graph` (or a sibling service) that holds:
  - A single `KindRegionService` instance built from injected **kind configs** (shape/weights/placement defaults) with a fallback to a simple `regionConfig` for backward compatibility. The context should accept opaque config blobs so it never references penguin lore directly.
  - A shared `SemanticEncoder` built from injected **semantic axis definitions**.
- Pass this context into `TemplateGraphView` so templates reuse the same mappers/encoder instead of instantiating new ones.

### B. Framework: per-kind region plumbing and persistence
- Wire `KindRegionService` into graph initialization using the provided kind configs. Seed regions per kind and expose helpers to fetch/update region state; the API surface should remain neutral (no penguin tags/IDs baked in).
- Extend `Graph` entity records to store `coordinates` and the region lookup result (primary/all IDs) when placement occurs. Ensure `KindRegionService.processEntityPlacement` is the single entry point so tags and emergent region creation stay in sync.
- Persist per-kind region state in `worldEngine.exportState()`/import so emergent regions survive exports and UI previews.

### C. Framework: placement flow that can mutate regions
- Update placement helpers (used by templates and systems) to accept a `regionMutation` option that can **create or update** a region after a coordinate is chosen. Use `RegionPlacementService` for sampling and delegate persistence to `KindRegionService`.
- Call order: sample point → apply requested region creation/update via `KindRegionService` → re-run tag derivation with the updated mapper so new region tags are included → attach tags/region IDs to the entity before insertion.
- Provide convenience APIs on `TemplateGraphView` (or a dedicated placement helper) for common strategies: `placeInRegion`, `placeNearEntity`, `spawnEmergentRegionAndPlace`, each internally using the shared services.

### D. Domain: plug configuration into the framework
- Keep penguin-specific configs (regions, semantic axes, emergent defaults) under `penguin-tales/lore/config/` and feed them into the framework constructors without altering framework code.
- Domain templates should consume the framework placement helpers and `CoordinateContext`, supplying only domain data (kinds, tags, region IDs) through the provided APIs.

### E. Semantic coordinate defaults
- Ensure `SemanticEncoder` is used when a template supplies tags but no explicit coordinates. When reference coordinates exist (e.g., for “influence near X”), blend semantic encoding with reference centroids via `encodeWithReference` to avoid stacking.
- Validate that tag/axis coverage uses the injected semantic weights; add warnings/metrics for unconfigured tags to guide future weighting updates.

### F. Testing and migration checkpoints
- Unit tests: extend `apps/lore-weave/lib/__tests__/coordinates/regionMapper.test.ts` and add new suites for `KindRegionService` to cover emergent creation, serialization, and per-kind separation.
- Integration tests: add a small generator run that places entities of multiple kinds, then asserts that emergent regions and tags survive an export/import cycle.
- Migration: ensure existing consumers of `regionConfig` remain supported (fallback RegionMapper) while templates gradually move to the new per-kind placement helpers.

## 4) Deliverables for the fix
- Shared coordinate context with persisted per-kind RegionMapper state (framework responsibility, domain-agnostic).
- Region-aware placement APIs that can create/update regions and re-derive tags after mutations (framework responsibility).
- Domain wiring that injects penguin configs into the framework and regression tests that demonstrate stability across runs (domain responsibility).
