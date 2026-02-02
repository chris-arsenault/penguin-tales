/**
 * Historian Reviewer Types
 *
 * Data structures for the historian annotation system.
 * The historian is a persistent scholarly voice that annotates entity
 * descriptions and chronicle narratives with marginal notes — resigned
 * commentary, factual corrections, weary observations, and dry asides.
 */

// =============================================================================
// Note Types
// =============================================================================

export type HistorianNoteType =
  | 'commentary'    // Resigned observation, weary admiration, black humor
  | 'correction'    // Factual inconsistency or inaccuracy callout
  | 'tangent'       // Personal digression, tired aside, memory surfacing unbidden
  | 'skepticism'    // Disputes or questions the account with quiet exasperation
  | 'pedantic';     // Scholarly pedantic correction (names, dates, terminology)

export interface HistorianNote {
  /** Unique note ID */
  noteId: string;
  /** Exact substring in source text this note anchors to */
  anchorPhrase: string;
  /** The historian's annotation text */
  text: string;
  /** Note type for styling and filtering */
  type: HistorianNoteType;
}

// =============================================================================
// Historian Configuration (project-level persona definition)
// =============================================================================

export interface HistorianConfig {
  /** Historian's name and title (e.g., "Aldric Fenworth, Third Archivist of the Pale Library") */
  name: string;
  /** Background, credentials, institutional affiliation, era they're writing from */
  background: string;
  /** Personality traits (e.g., "world-weary", "quietly compassionate", "resigned to repetition") */
  personalityTraits: string[];
  /** Known biases or blind spots (e.g., "distrusts nightshelf accounts", "overvalues written sources") */
  biases: string[];
  /** Relationship to the source material (e.g., "has outlived most of the people described here", "exhausted custodian of difficult truths") */
  stance: string;
  /** Things the historian knows that aren't in the canon facts */
  privateFacts: string[];
  /** Recurring preoccupations, refrains, or motifs to weave in */
  runningGags: string[];
}

export const DEFAULT_HISTORIAN_CONFIG: HistorianConfig = {
  name: '',
  background: '',
  personalityTraits: [],
  biases: [],
  stance: '',
  privateFacts: [],
  runningGags: [],
};

/** Check whether a historian config has been meaningfully configured */
export function isHistorianConfigured(config: HistorianConfig): boolean {
  return config.name.trim().length > 0 && config.background.trim().length > 0;
}

// =============================================================================
// Historian Run (IndexedDB record for review workflow)
// =============================================================================

export type HistorianTargetType = 'entity' | 'chronicle';

export type HistorianRunStatus =
  | 'pending'
  | 'generating'
  | 'reviewing'    // Notes generated, user reviewing
  | 'complete'
  | 'cancelled'
  | 'failed';

export interface HistorianRun {
  runId: string;
  projectId: string;
  simulationRunId: string;
  status: HistorianRunStatus;
  error?: string;

  /** What kind of content is being annotated */
  targetType: HistorianTargetType;
  /** Entity ID or chronicle ID */
  targetId: string;
  /** Display name of the target */
  targetName: string;

  /** The source text that was annotated */
  sourceText: string;
  /** Generated notes (populated by worker) */
  notes: HistorianNote[];
  /** Per-note accept/reject decisions (noteId → boolean) */
  noteDecisions: Record<string, boolean>;

  /** Serialized context: entity/chronicle metadata + neighbor summaries */
  contextJson: string;
  /** Serialized sample of the historian's prior annotations (for voice continuity) */
  previousNotesJson: string;
  /** Serialized historian config (persona definition) */
  historianConfigJson: string;

  // Cost tracking
  inputTokens: number;
  outputTokens: number;
  actualCost: number;

  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// LLM Response Shape
// =============================================================================

export interface HistorianLLMResponse {
  notes: Array<{
    anchorPhrase: string;
    text: string;
    type: HistorianNoteType;
  }>;
}
