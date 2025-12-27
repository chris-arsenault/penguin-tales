/**
 * Chronicle Types
 *
 * Data structures for the chronicle generation pipeline.
 * See CHRONICLE_DESIGN.md for full architecture documentation.
 */

// =============================================================================
// Chronicle Plan - Output of Step 1
// =============================================================================

export type ChronicleFormat = 'story' | 'document';

export interface ChronicleEntityRole {
  entityId: string;
  role: string; // Flexible role based on narrative style (e.g., 'protagonist', 'scribe', 'authority')
  contribution: string; // How this entity functions in the narrative or document
}

export type FocusMode = 'single' | 'ensemble';

export interface NarrativeFocus {
  mode: FocusMode;
  entrypointId: string;
  primaryEntityIds: string[];
  supportingEntityIds: string[];
  selectedEntityIds: string[];
  selectedEventIds: string[];
  notes?: string;
}

export interface DocumentOutline {
  purpose: string;
  keyPoints: string[];
  era: string;
  tone: string;
  veracity?: string;
  legitimacy?: string;
  audience?: string;
  authorProvenance?: string;
  biasAgenda?: string;
  intendedOutcome?: string;
}

export interface StoryOutline {
  purpose: string;
  keyPoints: string[];
  era: string;
  tone: string;
  theme: string;
  emotionalBeats: string[];
  stakes?: string;
  transformation?: string;
  intendedImpact?: string;
}

export interface PlotBeat {
  description: string;
  eventIds: string[]; // NarrativeEvent IDs that drive this beat
}

/**
 * Plot structure for any narrative style.
 * Raw contains the LLM-generated structure matching the style's schema.
 */
export interface ChroniclePlot {
  /** Plot structure type from NarrativeStyle (e.g., 'three-act', 'episodic', 'document') */
  type: string;
  /** Raw plot data as returned by LLM (varies by plot type) */
  raw: Record<string, unknown>;
  /** Normalized beats extracted from any plot type for section expansion */
  normalizedBeats: PlotBeat[];
}

export interface ChronicleSection {
  id: string;
  name: string;
  purpose: string; // Style-defined purpose of this section
  goal: string; // Plan-specific objective for this section
  entityIds: string[]; // Entity IDs involved
  eventIds: string[]; // NarrativeEvent IDs to incorporate
  wordCountTarget?: number;
  // Story format fields
  requiredElements?: string[];
  emotionalArc?: string; // tension, relief, revelation, etc.
  setting?: string;
  // Document format fields
  contentGuidance?: string;
  optional?: boolean;
  // Filled in Step 2
  generatedContent?: string;
}

export interface ChroniclePlan {
  id: string;
  title: string;
  format: ChronicleFormat;

  // Entity roles with narrative/document contribution
  entityRoles: ChronicleEntityRole[];

  // Focus decision and selected cast/event set
  focus: NarrativeFocus;

  // Plot structure (story formats)
  plot?: ChroniclePlot;

  // Document outline (document formats)
  documentOutline?: DocumentOutline;

  // Story outline (story formats)
  storyOutline?: StoryOutline;

  // Section breakdown
  sections: ChronicleSection[];

  // Generation metadata
  generatedAt?: number;
  model?: string;
}

// =============================================================================
// Cohesion Report - Output of Step 4
// =============================================================================

export interface CohesionCheck {
  pass: boolean;
  notes: string;
}

export interface SectionGoalCheck {
  sectionId: string;
  pass: boolean;
  notes: string;
}

export interface CohesionIssue {
  severity: 'critical' | 'minor';
  sectionId?: string;
  checkType: string;
  description: string;
  suggestion: string;
}

export interface CohesionReport {
  overallScore: number; // 0-100

  checks: {
    plotStructure: CohesionCheck;
    entityConsistency: CohesionCheck;
    sectionGoals: SectionGoalCheck[];
    resolution: CohesionCheck;
    factualAccuracy: CohesionCheck;
    themeExpression: CohesionCheck;
  };

  issues: CohesionIssue[];

  // Generation metadata
  generatedAt?: number;
  model?: string;
}

export type ChronicleStatus =
  | 'not_started'
  | 'generating' // Generation in progress
  | 'assembly_ready' // Generation complete, awaiting user review
  | 'editing' // Revision in progress
  | 'validating' // Validation in progress
  | 'validation_ready' // Validation complete, issues may exist
  | 'failed' // Generation failed; requires regeneration
  | 'complete'; // All steps done, accepted


// =============================================================================
// Chronicle Wizard Types - Role assignments from wizard flow
// =============================================================================

/**
 * A role assignment from the chronicle wizard.
 * Maps an entity to a role defined in the NarrativeStyle's entityRules.roles.
 */
export interface ChronicleRoleAssignment {
  /** Role ID from style's entityRules.roles (e.g., 'protagonist', 'antagonist') */
  role: string;
  /** Assigned entity ID */
  entityId: string;
  /** Entity name (denormalized for display) */
  entityName: string;
  /** Entity kind (denormalized for display) */
  entityKind: string;
  /** User toggle: primary emphasis vs supporting */
  isPrimary: boolean;
}

// =============================================================================
// Generation Context - Input to each generation step
// =============================================================================

export interface EntityContext {
  // Full entity object
  id: string;
  name: string;
  kind: string;
  subtype?: string;
  prominence: string;
  culture?: string;
  status: string;
  tags: Record<string, string>;
  summary?: string;
  description?: string;
  aliases?: string[];
  coordinates?: { x: number; y: number };
  createdAt: number;
  updatedAt: number;
}

export interface RelationshipContext {
  src: string;
  dst: string;
  kind: string;
  strength?: number;

  // Resolved entity info
  sourceName: string;
  sourceKind: string;
  targetName: string;
  targetKind: string;

  // Enriched content (from Layer 2)
  backstory?: string;
}

export interface EraContext {
  id: string;
  name: string;
  description?: string;
}

export interface NarrativeEventContext {
  id: string;
  tick: number;
  era: string;
  eventKind: string;
  significance: number;
  headline: string;
  description?: string;
  subjectId?: string;
  subjectName?: string;
  objectId?: string;
  objectName?: string;
  stateChanges?: {
    entityId: string;
    entityName: string;
    field: string;
    previousValue: unknown;
    newValue: unknown;
  }[];
  narrativeTags?: string[];
}

// =============================================================================
// Chronicle Focus - Defines what the chronicle is about (chronicle-first)
// =============================================================================

export type ChronicleFocusType = 'single' | 'ensemble' | 'relationship' | 'event';

export interface ChronicleFocus {
  /** What type of chronicle is this? */
  type: ChronicleFocusType;

  /** Role assignments define the cast - THIS IS THE PRIMARY IDENTITY */
  roleAssignments: ChronicleRoleAssignment[];

  /** Entity IDs of primary characters (derived from isPrimary=true) */
  primaryEntityIds: string[];

  /** Entity IDs of supporting characters (derived from isPrimary=false) */
  supportingEntityIds: string[];

  /** All selected entity IDs */
  selectedEntityIds: string[];

  /** All selected event IDs */
  selectedEventIds: string[];

  /** All selected relationship IDs */
  selectedRelationshipIds: string[];
}

export interface ChronicleGenerationContext {
  // World context (user-defined)
  worldName: string;
  worldDescription: string;
  canonFacts: string[];
  tone: string;

  // Chronicle focus (chronicle-first architecture)
  focus: ChronicleFocus;

  // Optional era context (legacy single era)
  era?: EraContext;

  // Full temporal context with all eras and chronicle timeline
  temporalContext?: ChronicleTemporalContext;

  // All selected entities (full context)
  entities: EntityContext[];

  // Selected relationships
  relationships: RelationshipContext[];

  // Selected events
  events: NarrativeEventContext[];
}

// =============================================================================
// Pipeline Step Results
// =============================================================================

export interface AssemblyResult {
  success: boolean;
  content?: string;
  error?: string;
}

// =============================================================================
// Chronicle Image References - Output of Image Refs Step
// =============================================================================

/** Display size hint for chronicle images */
export type ChronicleImageSize = 'small' | 'medium' | 'large' | 'full-width';

/** Base properties shared by all image reference types */
interface BaseChronicleImageRef {
  /** Unique ID for this image reference */
  refId: string;
  /** Section ID where image should appear */
  sectionId: string;
  /** Text phrase to anchor image near (for paragraph-level positioning) */
  anchorText: string;
  /** Character index where anchorText was found (fallback if text changes) */
  anchorIndex?: number;
  /** Display size hint */
  size: ChronicleImageSize;
  /** Optional caption for the image */
  caption?: string;
}

/** Reference to an existing entity image */
export interface EntityImageRef extends BaseChronicleImageRef {
  type: 'entity_ref';
  /** Entity ID whose image to use */
  entityId: string;
}

/** Request for a new prompt-generated image */
export interface PromptRequestRef extends BaseChronicleImageRef {
  type: 'prompt_request';
  /** LLM-generated scene description for image generation */
  sceneDescription: string;
  /** Generation state */
  status: 'pending' | 'generating' | 'complete' | 'failed';
  /** Generated imageId (after generation) */
  generatedImageId?: string;
  /** Error message if generation failed */
  error?: string;
}

/** Union type for all chronicle image references */
export type ChronicleImageRef = EntityImageRef | PromptRequestRef;

/** Structured image refs stored in ChronicleRecord */
export interface ChronicleImageRefs {
  refs: ChronicleImageRef[];
  generatedAt: number;
  model: string;
}

// =============================================================================
// Chronicle Temporal Context - Era and time anchoring for chronicles
// =============================================================================

/**
 * Temporal scope classification based on tick range covered.
 * - moment: 1-5 ticks (a single scene or interaction)
 * - episode: 5-20 ticks (a short adventure or incident)
 * - arc: 20-50 ticks (a major storyline or campaign)
 * - saga: 50+ ticks or multi-era (generational epic)
 */
export type TemporalScope = 'moment' | 'episode' | 'arc' | 'saga';

/**
 * Era info with tick range for temporal calculations.
 */
export interface EraTemporalInfo {
  id: string;
  name: string;
  description?: string;
  /** Order in the era sequence (0 = first era) */
  order: number;
  /** Starting tick of this era */
  startTick: number;
  /** Ending tick of this era (exclusive) */
  endTick: number;
  /** Duration in ticks */
  duration: number;
}

/**
 * Complete temporal context for a chronicle.
 * Computed from selected events and entities.
 */
export interface ChronicleTemporalContext {
  /** The primary era this chronicle takes place in */
  focalEra: EraTemporalInfo;

  /** All eras in the world (for context) */
  allEras: EraTemporalInfo[];

  /** Tick range covered by selected events [min, max] */
  chronicleTickRange: [number, number];

  /** Temporal scope classification */
  temporalScope: TemporalScope;

  /** Whether chronicle spans multiple eras */
  isMultiEra: boolean;

  /** Era IDs that the chronicle touches */
  touchedEraIds: string[];

  /** Human-readable temporal description */
  temporalDescription: string;
}
