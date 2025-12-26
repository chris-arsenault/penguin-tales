import type { NarrativePipeline } from '../../pipelineTypes';
import type { StoryNarrativeStyle } from '@canonry/world-schema';
import { buildPlanPrompt, parsePlanResponse } from './plan';
import { buildSectionPrompt, parseSectionResponse } from './expand';
import { assemble, buildStitchPrompt } from './assemble';
import { buildValidationPrompt, parseValidationResponse } from './validate';
import { buildEditPrompt } from './edit';

export const storyPipeline: NarrativePipeline = {
  format: 'story',
  getSystemPrompt: (step) => ({
    plan: 'You are a narrative planner. Produce structured JSON plans for multi-entity stories.',
    expand: 'You are a narrative prose writer. Draft a single section consistent with the provided outline and style.',
    assemble: 'You are a narrative editor. Make minimal edits to improve flow while preserving structure.',
    validate: 'You are a critical editor validating narrative coherence against the plan.',
    edit: 'You are a narrative editor implementing revision feedback.',
  }[step]),
  buildPlanPrompt: (context, style, selection) =>
    buildPlanPrompt(context, style as StoryNarrativeStyle, selection),
  parsePlanResponse: (response, context, style, selection) =>
    parsePlanResponse(response, context, style as StoryNarrativeStyle, selection),
  buildSectionPrompt: (section, index, plan, context, previousSections, style) =>
    buildSectionPrompt(section, index, plan, context, previousSections, style as StoryNarrativeStyle),
  parseSectionResponse,
  assemble,
  buildStitchPrompt: (content, plan, context, style) =>
    buildStitchPrompt(content, plan, context, style as StoryNarrativeStyle),
  buildValidationPrompt: (assembledContent, plan, context, style) =>
    buildValidationPrompt(assembledContent, plan, context, style as StoryNarrativeStyle),
  buildEditPrompt: (assembledContent, plan, context, style, report) =>
    buildEditPrompt(assembledContent, plan, context, style as StoryNarrativeStyle, report),
  parseValidationResponse,
};
