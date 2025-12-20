# Schema Interpreter Dispatch Patterns

Complete inventory of dispatch patterns in `apps/lore-weave/lib/` that switch on schema keys and dispatch to concrete implementations.

## Category: SELECT ENTITY

Patterns that select/find entities from the graph.

| Location | Function | Dispatch Key | Cases |
|----------|----------|--------------|-------|
| `rules/selection/index.ts:257-383` | `selectEntities()` | `rule.strategy` | `by_kind`, `by_preference_order`, `by_relationship`, `by_proximity`, `by_prominence` |
| `rules/selection/index.ts:188-228` | `applyPickStrategy()` | `pickStrategy` | `random`, `first`, `all`, `weighted` |
| `rules/selection/index.ts:390-470` | `selectVariableEntities()` | `select.from` | `graph`, `related` |
| `thresholdTrigger.ts:272-338` | `clusterEntities()` | `config.clusterMode` | `individual`, `all_matching`, `by_relationship` |
| `rules/resolver.ts:25-69` | `ActionEntityResolver.resolveEntity()` | `$varName` | `actor`, `instigator`, `target`, `target2`, `self`, `source`, `contagion_source`, `member`, `member2` |
| `catalystHelpers.ts:25-35` | `getAgentsByCategory()` | `category` | `all`, `first-order`, `second-order` |

## Category: PLACE ENTITY

Patterns that choose placement strategy and coordinate resolution.

| Location | Function | Dispatch Key | Cases |
|----------|----------|--------------|-------|
| `engine/templateInterpreter.ts:672-739` | `getStrategyFromAnchor()/resolvePlacement()` | `anchor.type` | `entity`, `culture`, `refs_centroid`, `bounds`, `sparse` |
| `graph/templateGraphView.ts:1374-1466` | `resolvePlacement()` | `anchor.type` | `entity`, `culture`, `refs_centroid`, `bounds`, `sparse` |

## Category: CLUSTERING

Patterns that score or group entities into clusters.

| Location | Function | Dispatch Key | Cases |
|----------|----------|--------------|-------|
| `graph/clusteringUtils.ts:95-139` | `calculateSimilarity()` | `criterion.type` | `shared_relationship`, `shared_tags`, `temporal_proximity`, `same_subtype`, `same_culture`, `custom` |
| `graph/metaEntityFormation.ts:204-236` | `calculateSimilarity()` | `criterion.type` | `shares_related`, `shared_tags`, `temporal_proximity` |

## Category: CONTAGION MARKER

Patterns that interpret contagion marker schema fields.

| Location | Function | Dispatch Key | Cases |
|----------|----------|--------------|-------|
| `systems/graphContagion.ts:173-210` | `isInfected()/isInfectedWith()` | `config.type` | `tag`, `relationship` |

## Category: APPLY FILTER

Patterns that filter entity sets based on criteria.

| Location | Function | Dispatch Key | Cases |
|----------|----------|--------------|-------|
| `rules/filters/index.ts:38-177` | `applySelectionFilter()` | `filter.type` | `exclude`, `has_relationship`, `lacks_relationship`, `has_tag`, `has_tags`, `has_any_tag`, `lacks_tag`, `lacks_any_tag`, `has_culture`, `matches_culture`, `has_status`, `has_prominence`, `shares_related`, `graph_path` |
| `rules/graphPath.ts:92-135` | `evaluatePathConstraints()` | `constraint.type` | `not_in`, `in`, `not_self`, `lacks_relationship`, `has_relationship`, `kind_equals`, `subtype_equals` |
| `rules/types.ts:18-34` | direction normalization | `direction` | `out`, `in`, `any` → `src`, `dst`, `both` |

## Category: GRAPH PATH

Patterns that evaluate multi-hop path assertions.

| Location | Function | Dispatch Key | Cases |
|----------|----------|--------------|-------|
| `rules/graphPath.ts:33-62` | `evaluateGraphPath()` | `assertion.check` | `exists`, `not_exists`, `count_min`, `count_max` |

## Category: EVALUATE CONDITION

Patterns that evaluate boolean conditions.

| Location | Function | Dispatch Key | Cases |
|----------|----------|--------------|-------|
| `rules/conditions/index.ts:59-178` | `evaluateCondition()` | `condition.type` | `pressure`, `pressure_any_above`, `pressure_compare`, `entity_count`, `relationship_count`, `relationship_exists`, `tag_exists`, `tag_absent`, `status`, `prominence`, `time_elapsed`, `cooldown_elapsed`, `creations_per_epoch`, `era_match`, `random_chance`, `graph_path`, `entity_exists`, `entity_has_relationship`, `and`, `or`, `always` |
| `rules/graphPath.ts:33-62` | `evaluateGraphPath()` | `assertion.check` | `exists`, `not_exists`, `count_min`, `count_max` |
| `rules/types.ts:36-58` | operator normalization | `operator` | `above`, `below` → `>`, `<` |

## Category: CALCULATE METRIC

Patterns that compute numeric values.

| Location | Function | Dispatch Key | Cases |
|----------|----------|--------------|-------|
| `rules/metrics/index.ts:110-235` | `evaluateMetric()` | `metric.type` | `entity_count`, `relationship_count`, `tag_count`, `total_entities`, `constant`, `connection_count`, `ratio`, `status_ratio`, `cross_culture_ratio`, `shared_relationship`, `catalyzed_events`, `prominence_multiplier`, `decay_rate`, `falloff` |

## Category: MODIFY GRAPH

Patterns that change graph state (entities, relationships, tags).

| Location | Function | Dispatch Key | Cases |
|----------|----------|--------------|-------|
| `rules/mutations/index.ts:61-156` | `prepareMutation()` | `mutation.type` | `set_tag`, `remove_tag`, `create_relationship`, `archive_relationship`, `adjust_relationship_strength`, `change_status`, `adjust_prominence`, `modify_pressure`, `update_rate_limit` |

## Category: MODIFY OTHER

Patterns that change non-graph state (pressures, rate limits).

| Location | Function | Dispatch Key | Cases |
|----------|----------|--------------|-------|
| `rules/mutations/index.ts:61-156` | `prepareMutation()` | `mutation.type` | `modify_pressure`, `update_rate_limit` |

## Category: FACTORY

Patterns that create implementations or dispatch to handlers.

| Location | Function | Dispatch Key | Cases |
|----------|----------|--------------|-------|
| `systemInterpreter.ts:200-241` | `createSystemFromDeclarative()` | `systemType` | `connectionEvolution`, `graphContagion`, `thresholdTrigger`, `clusterFormation`, `tagDiffusion`, `planeDiffusion`, `eraSpawner`, `eraTransition`, `universalCatalyst`, `relationshipMaintenance`, `growth` |

## Category: DIAGNOSTIC

Patterns that generate human-readable descriptions (parallel to operational dispatches).

| Location | Function | Dispatch Key | Cases |
|----------|----------|--------------|-------|
| `rules/selection/index.ts:34-63` | `describeSelectionFilter()` | `filter.type` | mirrors `applySelectionFilter()` |
| `rules/metrics/index.ts:72-142` | `describeMetric()` | `metric.type` | mirrors `evaluateMetric()` |
| `rules/conditions/types.ts:329-346` | `ConditionResult` | `condition.type` | includes diagnostic strings per condition |

---

## Duplication Clusters (Status)

### Cluster 1: Condition Evaluation (RESOLVED)

Consolidated into `rules/conditions/index.ts:evaluateCondition()`.

### Cluster 2: Graph Modification Actions (RESOLVED)

Consolidated into `rules/mutations/index.ts:prepareMutation()`.

### Cluster 3: Metric/Factor Calculation (RESOLVED)

Consolidated into `rules/metrics/index.ts:evaluateMetric()`.

### Cluster 4: Prominence Multiplier (RESOLVED)

Consolidated into `rules/metrics/index.ts:getProminenceMultiplierValue()`.

### Cluster 5: Filter/Constraint Overlap (RESOLVED)

Consolidated into `rules/filters/index.ts` and `rules/filters/types.ts`.

### Cluster 6: Diagnostic Mirrors (PARTIAL)

Diagnostics are centralized in rules modules, but some legacy diagnostics in `templateInterpreter.ts` still mirror earlier dispatches.

### Cluster 7: Placement Anchor Resolution (PARTIAL)

`templateInterpreter.ts` and `templateGraphView.ts` both dispatch on `anchor.type` with overlapping logic.

### Cluster 8: Clustering Criteria (PARTIAL)

`clusteringUtils.ts` and `metaEntityFormation.ts` both dispatch on clustering criteria types with overlapping semantics.

---

## Statistics

| Category | Dispatch Points | Total Cases |
|----------|-----------------|-------------|
| SELECT ENTITY | 5 | ~20 |
| PLACE ENTITY | 2 | ~10 |
| CLUSTERING | 2 | ~9 |
| CONTAGION MARKER | 1 | 2 |
| APPLY FILTER | 3 | ~20 |
| GRAPH PATH | 1 | 4 |
| EVALUATE CONDITION | 3 | ~20 |
| CALCULATE METRIC | 1 | ~14 |
| MODIFY GRAPH | 1 | ~9 |
| MODIFY OTHER | 1 | 2 |
| FACTORY | 1 | 11 |
| DIAGNOSTIC | 3 | ~20 |
| **TOTAL** | **24** | **~141** |
