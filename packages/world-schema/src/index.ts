/**
 * @canonry/world-schema
 *
 * Shared types for The Canonry world-building suite.
 * This package contains ONLY types - no runtime code, no dependencies.
 */

// Entity Kind types
export type {
  Subtype,
  Status,
  SemanticAxis,
  CircleBounds,
  RectBounds,
  PolygonBounds,
  RegionBounds,
  SemanticRegion,
  SemanticPlane,
  EntityKindStyle,
  EntityKindDefinition,
} from './entityKind.js';

// Relationship types
export type { RelationshipKindDefinition } from './relationship.js';

// Culture types
export type {
  AxisBias,
  CultureVisualData,
  CultureDefinition,
} from './culture.js';

// Naming types (Name-Forge)
export type {
  PhonologyProfile,
  MorphologyProfile,
  Capitalization,
  RhythmBias,
  StyleRules,
  NamingDomain,
  LexemeList,
  LexemeSpec,
  Grammar,
  NamingStrategy,
  StrategyGroupConditions,
  StrategyGroup,
  NamingProfile,
  CultureNamingData,
} from './naming.js';

// Seed data types
export type {
  Prominence,
  SemanticCoordinates,
  SeedEntity,
  SeedRelationship,
} from './seed.js';

// Project types
export type { WorldSeedProject, ProjectMetadata } from './project.js';

// Canonry MFE contracts
export type {
  TagDefinition,
  AxisDefinition,
  CanonrySchemaSlice,
  CanonryProject,
  CanonryConfigItem,
  CanonryEraConfig,
  CanonryPressureConfig,
  CanonryGeneratorConfig,
  CanonrySystemConfig,
  CanonryActionConfig,
  CanonryDistributionTargets,
  CanonrySimulationResults,
  CanonrySimulationState,
  MfeNavProps,
  NameForgeRemoteProps,
  CosmographerRemoteProps,
  CoherenceEngineRemoteProps,
  LoreWeaveRemoteProps,
  ArchivistRemoteProps,
} from './mfeContracts.js';
