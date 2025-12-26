/**
 * Chronicle Types
 *
 * Data structures for the multi-step story generation pipeline.
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
  requiredNeighborIds: string[];
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
  proseNotes?: string;
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
  | 'planning' // Step 1 in progress
  | 'plan_ready' // Step 1 complete, awaiting user review
  | 'expanding' // Step 2 in progress
  | 'sections_ready' // Step 2 complete, awaiting user review
  | 'assembling' // Step 3 in progress
  | 'assembly_ready' // Step 3 complete, awaiting user review
  | 'editing' // Revision in progress
  | 'validating' // Step 4 in progress
  | 'validation_ready' // Step 4 complete, issues may exist
  | 'failed' // Generation failed; requires regeneration
  | 'complete'; // All steps done, accepted

export type ChronicleType = 'entityStory';

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
  description?: string;
  coordinates?: { x: number; y: number };
  createdAt: number;
  updatedAt: number;

  // Enriched content (from Layer 1)
  enrichedDescription?: string;
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

export interface ChronicleGenerationContext {
  // World context (user-defined)
  worldName: string;
  worldDescription: string;
  canonFacts: string[];
  tone: string;

  // Target of generation
  targetType: ChronicleType;
  targetId: string;

  // Optional era context (derived from entrypoint activity)
  era?: EraContext;

  // For entity stories
  entity?: EntityContext;

  // All entities (for cross-referencing)
  entities: EntityContext[];

  // Relationships involving target
  relationships: RelationshipContext[];

  // NarrativeEvents (filtered by relevance)
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
