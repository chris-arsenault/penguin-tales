/**
 * WizardContext - Shared state management for the Chronicle Wizard
 *
 * Provides state and actions for all wizard steps.
 */

import { createContext, useContext, useReducer, ReactNode, useMemo, useCallback } from 'react';
import type { NarrativeStyle } from '@canonry/world-schema';
import type {
  ChronicleRoleAssignment,
  EntityContext,
  RelationshipContext,
  NarrativeEventContext,
} from '../../lib/chronicleTypes';
import {
  buildWizardSelectionContext,
  suggestRoleAssignments,
  getRelevantRelationships,
  getRelevantEvents,
} from '../../lib/chronicle/selectionWizard';

// =============================================================================
// Types
// =============================================================================

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface WizardState {
  step: WizardStep;

  // Step 1: Style selection
  narrativeStyleId: string | null;
  narrativeStyle: NarrativeStyle | null;
  acceptDefaults: boolean;

  // Step 2: Entry point selection
  entryPointId: string | null;
  entryPoint: EntityContext | null;

  // Step 3: Role assignment
  candidates: EntityContext[];
  roleAssignments: ChronicleRoleAssignment[];

  // Step 4: Event/relationship resolution
  candidateEvents: NarrativeEventContext[];
  candidateRelationships: RelationshipContext[];
  selectedEventIds: Set<string>;
  selectedRelationshipIds: Set<string>;

  // Validation
  isValid: boolean;
  validationErrors: string[];
}

type WizardAction =
  | { type: 'SET_STEP'; step: WizardStep }
  | { type: 'SELECT_STYLE'; style: NarrativeStyle; acceptDefaults: boolean }
  | { type: 'SET_ACCEPT_DEFAULTS'; acceptDefaults: boolean }
  | { type: 'SELECT_ENTRY_POINT'; entity: EntityContext }
  | { type: 'SET_CANDIDATES'; candidates: EntityContext[]; relationships: RelationshipContext[]; events: NarrativeEventContext[] }
  | { type: 'SET_ROLE_ASSIGNMENTS'; assignments: ChronicleRoleAssignment[] }
  | { type: 'ADD_ROLE_ASSIGNMENT'; assignment: ChronicleRoleAssignment }
  | { type: 'REMOVE_ROLE_ASSIGNMENT'; entityId: string; role: string }
  | { type: 'TOGGLE_PRIMARY'; entityId: string; role: string }
  | { type: 'TOGGLE_EVENT'; eventId: string }
  | { type: 'TOGGLE_RELATIONSHIP'; relationshipId: string }
  | { type: 'SELECT_ALL_EVENTS' }
  | { type: 'DESELECT_ALL_EVENTS' }
  | { type: 'SELECT_ALL_RELATIONSHIPS' }
  | { type: 'DESELECT_ALL_RELATIONSHIPS' }
  | { type: 'RESET' };

// =============================================================================
// Initial State
// =============================================================================

const initialState: WizardState = {
  step: 1,
  narrativeStyleId: null,
  narrativeStyle: null,
  acceptDefaults: false,
  entryPointId: null,
  entryPoint: null,
  candidates: [],
  roleAssignments: [],
  candidateEvents: [],
  candidateRelationships: [],
  selectedEventIds: new Set(),
  selectedRelationshipIds: new Set(),
  isValid: false,
  validationErrors: [],
};

// =============================================================================
// Reducer
// =============================================================================

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step };

    case 'SELECT_STYLE':
      return {
        ...state,
        narrativeStyleId: action.style.id,
        narrativeStyle: action.style,
        acceptDefaults: action.acceptDefaults,
        // Reset downstream selections when style changes
        entryPointId: null,
        entryPoint: null,
        candidates: [],
        roleAssignments: [],
        candidateEvents: [],
        candidateRelationships: [],
        selectedEventIds: new Set(),
        selectedRelationshipIds: new Set(),
      };

    case 'SET_ACCEPT_DEFAULTS':
      return {
        ...state,
        acceptDefaults: action.acceptDefaults,
      };

    case 'SELECT_ENTRY_POINT':
      return {
        ...state,
        entryPointId: action.entity.id,
        entryPoint: action.entity,
        // Reset downstream selections when entry point changes
        candidates: [],
        roleAssignments: [],
        candidateEvents: [],
        candidateRelationships: [],
        selectedEventIds: new Set(),
        selectedRelationshipIds: new Set(),
      };

    case 'SET_CANDIDATES':
      return {
        ...state,
        candidates: action.candidates,
        candidateRelationships: action.relationships,
        candidateEvents: action.events,
      };

    case 'SET_ROLE_ASSIGNMENTS':
      return {
        ...state,
        roleAssignments: action.assignments,
      };

    case 'ADD_ROLE_ASSIGNMENT':
      // Prevent duplicates
      if (state.roleAssignments.some(
        a => a.entityId === action.assignment.entityId && a.role === action.assignment.role
      )) {
        return state;
      }
      return {
        ...state,
        roleAssignments: [...state.roleAssignments, action.assignment],
      };

    case 'REMOVE_ROLE_ASSIGNMENT':
      return {
        ...state,
        roleAssignments: state.roleAssignments.filter(
          a => !(a.entityId === action.entityId && a.role === action.role)
        ),
      };

    case 'TOGGLE_PRIMARY': {
      return {
        ...state,
        roleAssignments: state.roleAssignments.map(a =>
          a.entityId === action.entityId && a.role === action.role
            ? { ...a, isPrimary: !a.isPrimary }
            : a
        ),
      };
    }

    case 'TOGGLE_EVENT': {
      const newSet = new Set(state.selectedEventIds);
      if (newSet.has(action.eventId)) {
        newSet.delete(action.eventId);
      } else {
        newSet.add(action.eventId);
      }
      return { ...state, selectedEventIds: newSet };
    }

    case 'TOGGLE_RELATIONSHIP': {
      const newSet = new Set(state.selectedRelationshipIds);
      if (newSet.has(action.relationshipId)) {
        newSet.delete(action.relationshipId);
      } else {
        newSet.add(action.relationshipId);
      }
      return { ...state, selectedRelationshipIds: newSet };
    }

    case 'SELECT_ALL_EVENTS':
      return {
        ...state,
        selectedEventIds: new Set(state.candidateEvents.map(e => e.id)),
      };

    case 'DESELECT_ALL_EVENTS':
      return { ...state, selectedEventIds: new Set() };

    case 'SELECT_ALL_RELATIONSHIPS':
      return {
        ...state,
        selectedRelationshipIds: new Set(
          state.candidateRelationships.map(r => `${r.src}:${r.dst}:${r.kind}`)
        ),
      };

    case 'DESELECT_ALL_RELATIONSHIPS':
      return { ...state, selectedRelationshipIds: new Set() };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// =============================================================================
// Context
// =============================================================================

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;

  // Navigation
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: WizardStep) => void;

  // Step 1 actions
  selectStyle: (style: NarrativeStyle, acceptDefaults: boolean) => void;
  setAcceptDefaults: (acceptDefaults: boolean) => void;

  // Step 2 actions
  selectEntryPoint: (entity: EntityContext, allEntities: EntityContext[], allRelationships: RelationshipContext[], allEvents: NarrativeEventContext[]) => void;

  // Step 3 actions
  autoFillRoles: () => void;
  addRoleAssignment: (assignment: ChronicleRoleAssignment) => void;
  removeRoleAssignment: (entityId: string, role: string) => void;
  togglePrimary: (entityId: string, role: string) => void;

  // Step 4 actions
  toggleEvent: (eventId: string) => void;
  toggleRelationship: (relationshipId: string) => void;
  selectAllEvents: () => void;
  deselectAllEvents: () => void;
  selectAllRelationships: () => void;
  deselectAllRelationships: () => void;

  // Reset
  reset: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  // Navigation
  const nextStep = useCallback(() => {
    if (state.step < 5) {
      dispatch({ type: 'SET_STEP', step: (state.step + 1) as WizardStep });
    }
  }, [state.step]);

  const prevStep = useCallback(() => {
    if (state.step > 1) {
      dispatch({ type: 'SET_STEP', step: (state.step - 1) as WizardStep });
    }
  }, [state.step]);

  const goToStep = useCallback((step: WizardStep) => {
    dispatch({ type: 'SET_STEP', step });
  }, []);

  // Step 1: Style selection
  const selectStyle = useCallback((style: NarrativeStyle, acceptDefaults: boolean) => {
    dispatch({ type: 'SELECT_STYLE', style, acceptDefaults });
  }, []);

  const setAcceptDefaults = useCallback((acceptDefaults: boolean) => {
    dispatch({ type: 'SET_ACCEPT_DEFAULTS', acceptDefaults });
  }, []);

  // Step 2: Entry point selection
  const selectEntryPoint = useCallback((
    entity: EntityContext,
    allEntities: EntityContext[],
    allRelationships: RelationshipContext[],
    allEvents: NarrativeEventContext[]
  ) => {
    dispatch({ type: 'SELECT_ENTRY_POINT', entity });

    // Build selection context for this entry point
    if (state.narrativeStyle) {
      const selectionContext = buildWizardSelectionContext(
        entity,
        allEntities,
        allRelationships,
        allEvents,
        state.narrativeStyle
      );

      dispatch({
        type: 'SET_CANDIDATES',
        candidates: selectionContext.candidates,
        relationships: selectionContext.candidateRelationships,
        events: selectionContext.candidateEvents,
      });

      // Auto-fill if accept defaults is checked
      if (state.acceptDefaults) {
        const suggested = suggestRoleAssignments(
          selectionContext.candidates,
          state.narrativeStyle.entityRules.roles,
          entity.id,
          state.narrativeStyle.entityRules,
          selectionContext.candidateRelationships
        );
        dispatch({ type: 'SET_ROLE_ASSIGNMENTS', assignments: suggested });
      }
    }
  }, [state.narrativeStyle, state.acceptDefaults]);

  // Step 3: Auto-fill roles
  const autoFillRoles = useCallback(() => {
    if (!state.narrativeStyle || !state.entryPoint) return;

    const suggested = suggestRoleAssignments(
      state.candidates,
      state.narrativeStyle.entityRules.roles,
      state.entryPoint.id,
      state.narrativeStyle.entityRules,
      state.candidateRelationships
    );
    dispatch({ type: 'SET_ROLE_ASSIGNMENTS', assignments: suggested });
  }, [state.narrativeStyle, state.entryPoint, state.candidates, state.candidateRelationships]);

  const addRoleAssignment = useCallback((assignment: ChronicleRoleAssignment) => {
    dispatch({ type: 'ADD_ROLE_ASSIGNMENT', assignment });
  }, []);

  const removeRoleAssignment = useCallback((entityId: string, role: string) => {
    dispatch({ type: 'REMOVE_ROLE_ASSIGNMENT', entityId, role });
  }, []);

  const togglePrimary = useCallback((entityId: string, role: string) => {
    dispatch({ type: 'TOGGLE_PRIMARY', entityId, role });
  }, []);

  // Step 4: Event/relationship selection
  const toggleEvent = useCallback((eventId: string) => {
    dispatch({ type: 'TOGGLE_EVENT', eventId });
  }, []);

  const toggleRelationship = useCallback((relationshipId: string) => {
    dispatch({ type: 'TOGGLE_RELATIONSHIP', relationshipId });
  }, []);

  const selectAllEvents = useCallback(() => {
    dispatch({ type: 'SELECT_ALL_EVENTS' });
  }, []);

  const deselectAllEvents = useCallback(() => {
    dispatch({ type: 'DESELECT_ALL_EVENTS' });
  }, []);

  const selectAllRelationships = useCallback(() => {
    dispatch({ type: 'SELECT_ALL_RELATIONSHIPS' });
  }, []);

  const deselectAllRelationships = useCallback(() => {
    dispatch({ type: 'DESELECT_ALL_RELATIONSHIPS' });
  }, []);

  // Reset
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const value = useMemo<WizardContextValue>(() => ({
    state,
    dispatch,
    nextStep,
    prevStep,
    goToStep,
    selectStyle,
    setAcceptDefaults,
    selectEntryPoint,
    autoFillRoles,
    addRoleAssignment,
    removeRoleAssignment,
    togglePrimary,
    toggleEvent,
    toggleRelationship,
    selectAllEvents,
    deselectAllEvents,
    selectAllRelationships,
    deselectAllRelationships,
    reset,
  }), [
    state,
    nextStep,
    prevStep,
    goToStep,
    selectStyle,
    setAcceptDefaults,
    selectEntryPoint,
    autoFillRoles,
    addRoleAssignment,
    removeRoleAssignment,
    togglePrimary,
    toggleEvent,
    toggleRelationship,
    selectAllEvents,
    deselectAllEvents,
    selectAllRelationships,
    deselectAllRelationships,
    reset,
  ]);

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a WizardProvider');
  }
  return context;
}
