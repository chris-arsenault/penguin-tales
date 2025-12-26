import type { NarrativePipeline } from '../../pipelineTypes';
import type { DocumentNarrativeStyle } from '@canonry/world-schema';
import { buildPlanPrompt, parsePlanResponse } from './plan';
import { buildSectionPrompt, parseSectionResponse } from './expand';
import { assemble, buildStitchPrompt } from './assemble';
import { buildValidationPrompt, parseValidationResponse } from './validate';
import { buildEditPrompt } from './edit';

export const documentPipeline: NarrativePipeline = {
  format: 'document',
  getSystemPrompt: (step) => ({
    plan: 'You are an in-world document planner. Produce structured JSON plans that match the requested document format.',
    expand: 'You are an in-world document writer. Draft a single section consistent with the provided outline.',
    assemble: 'You are an editor polishing an in-world document. Make minimal edits and preserve structure.',
    validate: 'You are a critical editor validating an in-world document against its plan.',
    edit: 'You are an editor implementing revision feedback for an in-world document.',
  }[step]),
  buildPlanPrompt: (context, style, selection) =>
    buildPlanPrompt(context, style as DocumentNarrativeStyle, selection),
  parsePlanResponse: (response, context, style, selection) =>
    parsePlanResponse(response, context, style as DocumentNarrativeStyle, selection),
  buildSectionPrompt: (section, index, plan, context, previousSections, style) =>
    buildSectionPrompt(section, index, plan, context, previousSections, style as DocumentNarrativeStyle),
  parseSectionResponse,
  assemble,
  buildStitchPrompt: (content, plan, context, style) =>
    buildStitchPrompt(content, plan, context, style as DocumentNarrativeStyle),
  buildValidationPrompt: (assembledContent, plan, context, style) =>
    buildValidationPrompt(assembledContent, plan, context, style as DocumentNarrativeStyle),
  buildEditPrompt: (assembledContent, plan, context, style, report) =>
    buildEditPrompt(assembledContent, plan, context, style as DocumentNarrativeStyle, report),
  parseValidationResponse,
};
