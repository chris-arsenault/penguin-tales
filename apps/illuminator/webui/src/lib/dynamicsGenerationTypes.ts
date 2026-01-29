/**
 * Dynamics Generation Types
 *
 * Multi-turn, human-steered LLM flow for generating world dynamics.
 * Uses IndexedDB as a shared mailbox between the worker (LLM calls)
 * and the main thread (search execution, user feedback).
 */

// =============================================================================
// Run Status Machine
// =============================================================================

export type DynamicsRunStatus =
  | 'pending'                // Created, waiting for first LLM turn
  | 'generating'             // LLM call in progress (worker is running)
  | 'awaiting_searches'      // LLM returned search requests, UI needs to execute
  | 'awaiting_review'        // LLM returned proposed dynamics, user needs to review
  | 'complete'               // User accepted final dynamics
  | 'failed';                // Error occurred

// =============================================================================
// Search Types
// =============================================================================

export interface DynamicsSearchRequest {
  id: string;
  /** Human-readable intent (shown to user) */
  intent: string;
  /** Full-text search on entity summaries/descriptions/names */
  textQuery?: string;
  /** Filter by entity kind */
  kinds?: string[];
  /** Filter by culture */
  cultures?: string[];
  /** Filter by tag key/value */
  tags?: Record<string, string>;
  /** Filter entities active during this era */
  eraId?: string;
  /** Find entities connected to this entity ID */
  connectedTo?: string;
  /** Max results to return (default 10) */
  maxResults?: number;
}

export interface DynamicsSearchResultEntry {
  id: string;
  name: string;
  kind: string;
  subtype?: string;
  culture?: string;
  summary: string;
}

export interface DynamicsSearchResult {
  searchId: string;
  intent: string;
  results: DynamicsSearchResultEntry[];
}

// =============================================================================
// Conversation Messages
// =============================================================================

export type DynamicsMessageRole = 'system' | 'assistant' | 'user' | 'search_results';

export interface DynamicsMessage {
  role: DynamicsMessageRole;
  content: string;
  timestamp: number;
}

// =============================================================================
// LLM Response Shape
// =============================================================================

export interface ProposedDynamic {
  text: string;
  cultures?: string[];
  kinds?: string[];
}

export interface DynamicsLLMResponse {
  /** Current proposed dynamics */
  dynamics: ProposedDynamic[];
  /** Reasoning shown to user */
  reasoning: string;
  /** Search requests for next turn (if any) */
  searches?: DynamicsSearchRequest[];
  /** Whether the LLM considers this complete */
  complete: boolean;
}

// =============================================================================
// Run Record (stored in IndexedDB)
// =============================================================================

export interface DynamicsRun {
  runId: string;
  projectId: string;
  simulationRunId: string;

  status: DynamicsRunStatus;

  /** Full conversation history */
  messages: DynamicsMessage[];

  /** Pending search requests (set by worker, consumed by UI) */
  pendingSearches?: DynamicsSearchRequest[];

  /** Most recent search results (set by UI, consumed by worker) */
  searchResults?: DynamicsSearchResult[];

  /** Current proposed dynamics from the LLM */
  proposedDynamics?: ProposedDynamic[];

  /** User feedback text (set by UI before triggering next turn) */
  userFeedback?: string;

  /** Error message if status=failed */
  error?: string;

  /** Cost tracking */
  totalInputTokens: number;
  totalOutputTokens: number;
  totalActualCost: number;

  createdAt: number;
  updatedAt: number;
}
