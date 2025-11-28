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

## 5) Culture-first paradigm impacts
The repo is moving to **culture as a first-class attribute for all entities** (beyond the initial Name Forge driver). The coordinate work needs to support that without leaking penguin specifics into the framework.

### Framework expectations (remain generic)
- Treat `culture` as **just another tag/axis input** for placement and semantic encoding. The framework should not hard-code cultures, but it must:
  - Allow semantic axes/weights to include culture-based buckets (e.g., “protective”, “ice-aligned”, “expansionist”) provided by configuration.
  - Support culture-specific region defaults supplied via injected kind configs (e.g., emergent regions seeded from a culture’s founding colony) without naming the cultures in code.
- Ensure `KindRegionService` can parameterize emergent region creation by **caller-supplied context** (e.g., culture ID) so placements can cluster around cultural seeds and expand outward using strategies (far/near/region-bound) that consume those contexts.
- Preserve per-kind separation: cultures might influence multiple kinds (location, magic, law) but the framework should treat them as independent grids that can be **correlated by shared tags/context** rather than shared state.
- Keep persistence agnostic: exported region/entity records should carry opaque culture tags/IDs; the framework only serializes what it was given.

### Domain responsibilities (penguin-specific wiring)
- Define culture taxonomies, their preferred semantic axes, and initial seeds in `penguin-tales/lore/config/` (e.g., culture Y favors protective ice magic and spawns from colony Y’s coordinates). Inject these into the generic services during graph construction.
- Provide **placement intents** that pass culture context into the framework helpers, selecting strategies that bias toward culture-owned regions (e.g., “spawn location within culture Y influence region” or “select magic tags that align with culture Y’s defensive bent”).
- Configure Name Forge and other systems to consume the culture tags emitted by placement so naming, law generation, and magic affinity all align with the spatial/cultural layout.
- Add tests or fixtures that exercise cross-kind cultural coherence: a culture seed should influence nearby locations, adjacent magical regions, and generated laws after export/import.

### Resulting guide adjustments
- When defining new semantic axes or regions, **include culture-driven buckets and region templates in config**, not code. The framework only sees opaque tags/weights.
- Placement helpers should accept a `context` object (culture ID, seed region IDs, preferred axes) that flows through `KindRegionService` and `RegionPlacementService` to bias sampling and emergent creation.
- Migration path: retrofit existing templates to pass culture context; culture-neutral templates continue to work because the framework treats culture data as optional metadata.

## 6) Cosmographer UI builder intent (domain-facing)
To reduce reliance on hand-edited JSON and make domain wiring auditable, add a **Cosmographer** UI builder as the canonical entry point for Lore Weave domain data. The UI should:
- Let domain authors construct and edit plane/semantic mappings (axes, weights, buckets) and seed regions visually, persisting to the same configs consumed by the framework.
- Manage region/culture mappings and per-kind emergent defaults, emitting configuration artifacts rather than embedding logic in UI code.
- Provide affordances to create and update culture-aligned regions (including the culture-first flows above) and export/import them through the existing persistence paths.
- Keep framework code untouched: the UI outputs domain-specific config/state that flows into the generic coordinate services.
