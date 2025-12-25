/**
 * Chronicle Types
 *
 * Data structures for the multi-step story generation pipeline.
 * See CHRONICLE_DESIGN.md for full architecture documentation.
 */

// =============================================================================
// Story Plan - Output of Step 1
// =============================================================================

export interface StoryCharacter {
  entityId: string;
  role: string; // Flexible role based on narrative style (e.g., 'protagonist', 'hero', 'lover-a')
  arc: string; // What change does this character undergo?
}

export interface StorySetting {
  eraId: string;
  locations: string[];
  timespan: string; // e.g., "Three days", "A single night"
}

export interface PlotBeat {
  description: string;
  eventIds: string[]; // NarrativeEvent IDs that drive this beat
}

/**
 * Legacy plot structure (three-act)
 */
export interface ThreeActPlotStructure {
  incitingIncident: PlotBeat;
  risingAction: PlotBeat[];
  climax: PlotBeat;
  resolution: PlotBeat;
}

/**
 * Flexible plot structure that can hold any plot type
 * The raw field contains the LLM-generated structure matching the style's schema
 */
export interface FlexiblePlotStructure {
  /** Plot structure type from NarrativeStyle */
  type: string;
  /** Raw plot data as returned by LLM (varies by plot type) */
  raw: Record<string, unknown>;
  /** Normalized beats extracted from any plot type for scene expansion */
  normalizedBeats: PlotBeat[];
}

/** Either legacy three-act or flexible style-based plot */
export type PlotStructure = ThreeActPlotStructure | FlexiblePlotStructure;

/** Type guard for flexible plot structure */
export function isFlexiblePlot(plot: PlotStructure): plot is FlexiblePlotStructure {
  return 'type' in plot && 'raw' in plot;
}

/** Type guard for three-act plot structure */
export function isThreeActPlot(plot: PlotStructure): plot is ThreeActPlotStructure {
  return 'incitingIncident' in plot && 'climax' in plot;
}

export interface StoryScene {
  id: string;
  title: string;
  goal: string; // What this scene MUST accomplish
  characterIds: string[]; // Entity IDs involved
  eventIds: string[]; // NarrativeEvent IDs to incorporate
  setting: string;
  emotionalBeat: string; // tension, relief, revelation, etc.
  generatedContent?: string; // Filled in Step 2
}

export interface StoryPlan {
  id: string;
  title: string;

  // Characters with full entity references
  characters: StoryCharacter[];

  // Setting
  setting: StorySetting;

  // Plot structure
  plot: PlotStructure;

  // Scene breakdown
  scenes: StoryScene[];

  // Thematic elements
  theme: string;
  tone: string;

  // All NarrativeEvents selected for this story
  keyEventIds: string[];

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

export interface SceneGoalCheck {
  sceneId: string;
  pass: boolean;
  notes: string;
}

export interface CohesionIssue {
  severity: 'critical' | 'minor';
  sceneId?: string;
  checkType: string;
  description: string;
  suggestion: string;
}

export interface CohesionReport {
  overallScore: number; // 0-100

  checks: {
    plotStructure: CohesionCheck;
    characterConsistency: CohesionCheck;
    sceneGoals: SceneGoalCheck[];
    resolution: CohesionCheck;
    factualAccuracy: CohesionCheck;
    themeExpression: CohesionCheck;
  };

  issues: CohesionIssue[];

  // Generation metadata
  generatedAt?: number;
  model?: string;
}

// =============================================================================
// Chronicle Content - Full pipeline state for an item
// =============================================================================

export type ChronicleStatus =
  | 'not_started'
  | 'planning' // Step 1 in progress
  | 'plan_ready' // Step 1 complete, awaiting user review
  | 'expanding' // Step 2 in progress
  | 'scenes_ready' // Step 2 complete, awaiting user review
  | 'assembling' // Step 3 in progress
  | 'assembly_ready' // Step 3 complete, awaiting user review
  | 'validating' // Step 4 in progress
  | 'validation_ready' // Step 4 complete, issues may exist
  | 'complete'; // All steps done, accepted

export type ChronicleType = 'eraChronicle' | 'entityStory' | 'relationshipTale';

export interface ChronicleContent {
  id: string;
  type: ChronicleType;
  targetId: string; // era ID, entity ID, or "srcId-dstId" for relationships

  status: ChronicleStatus;

  // Step 1 output
  plan?: StoryPlan;

  // Step 2 output (scene content stored in plan.scenes[].generatedContent)
  scenesCompleted?: number;
  scenesTotal?: number;

  // Step 3 output
  assembledContent?: string;

  // Step 4 output
  cohesionReport?: CohesionReport;

  // Final accepted content
  finalContent?: string;

  // Metadata
  generatedAt?: number;
  lastUpdatedAt?: number;
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

  // Enriched content (from Layer 2)
  summary?: string;
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

  // Narrative style for this generation
  narrativeStyleId?: string;

  // Target of generation
  targetType: ChronicleType;
  targetId: string;

  // For era chronicles
  era?: EraContext;

  // For entity stories
  entity?: EntityContext;

  // For relationship tales
  relationship?: RelationshipContext;

  // All entities (for cross-referencing)
  entities: EntityContext[];

  // Relationships involving target
  relationships: RelationshipContext[];

  // NarrativeEvents (filtered by relevance)
  events: NarrativeEventContext[];

  // Previously generated content for context
  existingDescriptions: Map<string, string>;
  existingBackstories: Map<string, string>;
}

// =============================================================================
// Pipeline Step Results
// =============================================================================

export interface PlanGenerationResult {
  success: boolean;
  plan?: StoryPlan;
  error?: string;
}

export interface SceneExpansionResult {
  success: boolean;
  sceneId: string;
  content?: string;
  error?: string;
}

export interface AssemblyResult {
  success: boolean;
  content?: string;
  wikiLinks: { entityId: string; name: string; count: number }[];
  error?: string;
}

export interface ValidationResult {
  success: boolean;
  report?: CohesionReport;
  error?: string;
}
