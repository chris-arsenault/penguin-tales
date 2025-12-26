import type {
  ChronicleGenerationContext,
  ChroniclePlan,
  ChronicleSection,
  AssemblyResult,
  CohesionReport,
  NarrativeFocus,
} from '../chronicleTypes';
import type { NarrativeStyle } from '@canonry/world-schema';
import type { SelectionContext } from './selection';

export type PipelineStep = 'plan' | 'expand' | 'assemble' | 'validate' | 'edit';

export interface NarrativePipeline {
  format: NarrativeStyle['format'];
  getSystemPrompt: (step: PipelineStep, style: NarrativeStyle, plan?: ChroniclePlan) => string;
  buildPlanPrompt: (
    context: ChronicleGenerationContext,
    style: NarrativeStyle,
    selection: SelectionContext
  ) => string;
  parsePlanResponse: (
    response: string,
    context: ChronicleGenerationContext,
    style: NarrativeStyle,
    selection: SelectionContext
  ) => ChroniclePlan;
  buildSectionPrompt: (
    section: ChronicleSection,
    sectionIndex: number,
    plan: ChroniclePlan,
    context: ChronicleGenerationContext,
    previousSections: { id: string; content: string }[],
    style: NarrativeStyle
  ) => string;
  parseSectionResponse: (response: string) => string;
  assemble: (
    plan: ChroniclePlan,
    context: ChronicleGenerationContext
  ) => AssemblyResult;
  buildStitchPrompt: (
    content: string,
    plan: ChroniclePlan,
    context: ChronicleGenerationContext,
    style: NarrativeStyle
  ) => string;
  buildValidationPrompt: (
    assembledContent: string,
    plan: ChroniclePlan,
    context: ChronicleGenerationContext,
    style: NarrativeStyle
  ) => string;
  buildEditPrompt: (
    assembledContent: string,
    plan: ChroniclePlan,
    context: ChronicleGenerationContext,
    style: NarrativeStyle,
    cohesionReport: CohesionReport
  ) => string;
  parseValidationResponse: (response: string, plan: ChroniclePlan) => CohesionReport;
}

export interface FocusValidationOptions {
  entrypointId: string;
  requiredNeighborIds: string[];
  candidateEntityIds: Set<string>;
  candidateEventIds: Set<string>;
}

export function validateFocus(
  focus: NarrativeFocus,
  options: FocusValidationOptions
): void {
  const {
    entrypointId,
    requiredNeighborIds,
    candidateEntityIds,
    candidateEventIds,
  } = options;

  if (focus.entrypointId !== entrypointId) {
    throw new Error('Focus entrypoint does not match context entrypoint');
  }

  const selectedEntityIds = new Set(focus.selectedEntityIds);
  if (!selectedEntityIds.has(entrypointId)) {
    throw new Error('Focus selectedEntityIds must include entrypoint');
  }

  for (const neighborId of requiredNeighborIds) {
    if (!selectedEntityIds.has(neighborId)) {
      throw new Error(`Focus must include required neighbor: ${neighborId}`);
    }
  }

  for (const entityId of selectedEntityIds) {
    if (!candidateEntityIds.has(entityId)) {
      throw new Error(`Focus references unknown entity: ${entityId}`);
    }
  }

  const selectedEventIds = new Set(focus.selectedEventIds);
  for (const eventId of selectedEventIds) {
    if (!candidateEventIds.has(eventId)) {
      throw new Error(`Focus references unknown event: ${eventId}`);
    }
  }

  const primaryIds = new Set(focus.primaryEntityIds);
  for (const primaryId of primaryIds) {
    if (!selectedEntityIds.has(primaryId)) {
      throw new Error(`Focus primaryEntityIds must be subset of selectedEntityIds: ${primaryId}`);
    }
  }

  const supportingIds = new Set(focus.supportingEntityIds);
  for (const supportingId of supportingIds) {
    if (!selectedEntityIds.has(supportingId)) {
      throw new Error(`Focus supportingEntityIds must be subset of selectedEntityIds: ${supportingId}`);
    }
  }

  if (selectedEntityIds.size < 2) {
    throw new Error('Focus must include at least two distinct entities');
  }
}
