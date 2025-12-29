/**
 * @canonry/world-schema
 *
 * Shared types and canonical framework primitives for The Canonry.
 */

// Entity Kind types
export type {
  EntityCategory,
  Subtype,
  Status,
  RequiredRelationshipRule,
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

export { ENTITY_CATEGORIES } from './entityKind.js';

// Relationship types
export type { RelationshipKindDefinition, Polarity } from './relationship.js';

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

// UI configuration types
export type { DomainUIConfig } from './ui.js';

// Style library types
export type {
  ArtisticStyle,
  CompositionStyle,
  ColorPalette,
  BaseNarrativeStyle,
  StoryNarrativeStyle,
  DocumentNarrativeStyle,
  NarrativeStyle,
  NarrativeFormat,
  PlotStructureType,
  PlotStructure,
  RoleDefinition,
  EntitySelectionRules,
  EventSelectionRules,
  SceneTemplate,
  WorldDataFocus,
  ProseDirectives,
  PacingConfig,
  DocumentSection,
  DocumentConfig,
  StyleLibrary,
  StyleSelection,
} from './style.js';

export {
  DEFAULT_ARTISTIC_STYLES,
  DEFAULT_COMPOSITION_STYLES,
  DEFAULT_COLOR_PALETTES,
  DEFAULT_NARRATIVE_STYLES,
  DEFAULT_DOCUMENT_STYLES,
  createDefaultStyleLibrary,
  findArtisticStyle,
  findCompositionStyle,
  findColorPalette,
  findNarrativeStyle,
} from './style.js';

// Seed data types
export type {
  Prominence,
  SemanticCoordinates,
  SeedEntity,
  SeedRelationship,
} from './seed.js';

// World output types
export type {
  WorldOutput,
  WorldMetadata,
  WorldEntity,
  WorldRelationship,
  HistoryEvent,
  NarrativeEvent,
  NarrativeEventKind,
  NarrativeEntityRef,
  NarrativeStateChange,
  CoordinateState,
  DistributionMetrics,
  GraphMetrics,
  Validation,
  ValidationResult,
  EntityTags,
} from './world.js';

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

// Framework primitives and schema helpers
export {
  FRAMEWORK_ENTITY_KINDS,
  FRAMEWORK_ENTITY_KIND_VALUES,
  FRAMEWORK_RELATIONSHIP_KINDS,
  FRAMEWORK_RELATIONSHIP_KIND_VALUES,
  FRAMEWORK_STATUS,
  FRAMEWORK_STATUS_VALUES,
  FRAMEWORK_SUBTYPES,
  FRAMEWORK_SUBTYPE_VALUES,
  FRAMEWORK_CULTURES,
  FRAMEWORK_TAGS,
  FRAMEWORK_TAG_VALUES,
  FRAMEWORK_ERA_STATUS_VALUES,
  FRAMEWORK_OCCURRENCE_STATUS_VALUES,
  FRAMEWORK_RELATIONSHIP_PROPERTIES,
  FRAMEWORK_ENTITY_KIND_DEFINITIONS,
  FRAMEWORK_RELATIONSHIP_KIND_DEFINITIONS,
  FRAMEWORK_CULTURE_DEFINITIONS,
  FRAMEWORK_TAG_DEFINITIONS,
  isFrameworkEntityKind,
  isFrameworkRelationshipKind,
  isFrameworkStatus,
  isFrameworkSubtype,
  isFrameworkTag,
  getFrameworkRelationshipStrength,
  mergeFrameworkSchemaSlice,
} from './frameworkPrimitives.js';

export type {
  FrameworkEntityKind,
  FrameworkRelationshipKind,
  FrameworkStatus,
  FrameworkSubtype,
  FrameworkCultureId,
  FrameworkTag,
} from './frameworkPrimitives.js';
