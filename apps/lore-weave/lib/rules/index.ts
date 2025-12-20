/**
 * Rules Library
 *
 * Unified dispatch library for all schema interpreters.
 * Consolidates conditions, metrics, mutations, filters, and selections
 * into a single library with consistent interfaces.
 *
 * Usage:
 * ```typescript
 * import { evaluateCondition, evaluateMetric, applyMutation } from '../rules';
 * import { createRuleContext, createSystemContext } from '../rules';
 *
 * const ctx = createSystemContext(graphView);
 * const result = evaluateCondition({ type: 'pressure', pressureId: 'growth', min: 0 }, ctx);
 * ```
 */

// Context
export {
  createRuleContext,
  createSystemContext,
  createActionContext,
  withSelf,
} from './context';
export type { RuleContext } from './context';

// Shared types
export {
  normalizeDirection,
  normalizeOperator,
  applyOperator,
  prominenceIndex,
  compareProminence,
  PROMINENCE_ORDER,
} from './types';
export type { ComparisonOperator, Direction, Prominence } from './types';

// Conditions
export { evaluateCondition } from './conditions';
export type {
  Condition,
  ConditionResult,
  PressureCondition,
  PressureCompareCondition,
  PressureAnyAboveCondition,
  EntityCountCondition,
  RelationshipCountCondition,
  RelationshipExistsCondition,
  TagExistsCondition,
  TagAbsentCondition,
  StatusCondition,
  ProminenceCondition,
  TimeElapsedCondition,
  CooldownElapsedCondition,
  CreationsPerEpochCondition,
  EraMatchCondition,
  RandomChanceCondition,
  GraphPathCondition,
  EntityExistsCondition,
  EntityHasRelationshipCondition,
  AndCondition,
  OrCondition,
  AlwaysCondition,
} from './conditions';

// Metrics
export {
  evaluateMetric,
  evaluateSimpleCount,
  describeMetric,
  getProminenceMultiplierValue,
} from './metrics';
export type {
  MetricContext,
  MetricGraph,
  Metric,
  MetricResult,
  SimpleCountMetric,
  EntityCountMetric,
  RelationshipCountMetric,
  TagCountMetric,
  TotalEntitiesMetric,
  ConstantMetric,
  ConnectionCountMetric,
  RatioMetric,
  StatusRatioMetric,
  CrossCultureRatioMetric,
  SharedRelationshipMetric,
  CatalyzedEventsMetric,
  ProminenceMultiplierMetric,
  DecayRateMetric,
  FalloffMetric,
} from './metrics';

// Mutations
export {
  prepareMutation,
  applyMutation,
  applyMutationResult,
} from './mutations';
export type {
  Mutation,
  MutationResult,
  EntityModification,
  RelationshipToCreate,
  RelationshipStrengthChange,
  SetTagMutation,
  RemoveTagMutation,
  CreateRelationshipMutation,
  ArchiveRelationshipMutation,
  AdjustRelationshipStrengthMutation,
  ChangeStatusMutation,
  AdjustProminenceMutation,
  ModifyPressureMutation,
  UpdateRateLimitMutation,
} from './mutations';

// Filters
export {
  applySelectionFilter,
  applySelectionFilters,
  entityPassesFilter,
  entityPassesAllFilters,
} from './filters';

export type {
  SelectionFilter,
  ExcludeEntitiesFilter,
  HasRelationshipFilter,
  LacksRelationshipFilter,
  HasTagSelectionFilter,
  HasTagsSelectionFilter,
  HasAnyTagSelectionFilter,
  LacksTagSelectionFilter,
  LacksAnyTagSelectionFilter,
  HasCultureFilter,
  MatchesCultureFilter,
  HasStatusFilter,
  HasProminenceFilter,
  SharesRelatedFilter,
  GraphPathSelectionFilter,
  GraphPathAssertion,
  PathStep,
  PathConstraint,
} from './filters';

// Selection
export {
  selectEntities,
  selectVariableEntities,
  applyEntityCriteria,
  applyPreferFilters,
  applyPickStrategy,
  applySaturationLimits,
  describeSelectionFilter,
} from './selection';

export type {
  SelectionRule,
  VariableSelectionRule,
  RelatedEntitiesSpec,
  SaturationLimit,
  SelectionPickStrategy,
  EntitySelectionCriteria,
  SelectionTrace,
  SelectionTraceStep,
} from './selection';

// Graph path
export { evaluateGraphPath } from './graphPath';

// Entity resolver
export {
  ActionEntityResolver,
  SimpleEntityResolver,
} from './resolver';
export type { EntityResolver } from './resolver';

// Actor matching
export { matchesActorConfig } from './actorMatcher';
