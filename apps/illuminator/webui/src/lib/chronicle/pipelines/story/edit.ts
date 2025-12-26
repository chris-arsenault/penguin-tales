import type {
  ChroniclePlan,
  ChronicleGenerationContext,
  CohesionReport,
} from '../../chronicleTypes';
import type { StoryNarrativeStyle } from '@canonry/world-schema';
import {
  formatEntityRoster,
  formatFocusSummary,
  formatIssueList,
} from '../../shared/editing';

export function buildEditPrompt(
  assembledContent: string,
  plan: ChroniclePlan,
  context: ChronicleGenerationContext,
  style: StoryNarrativeStyle,
  report: CohesionReport
): string {
  if (!plan.storyOutline) {
    throw new Error('Story edit requires storyOutline');
  }

  const outline = plan.storyOutline;
  const pd = style.proseDirectives;
  const plotBeats = plan.plot?.normalizedBeats || [];

  const outlineLines = [
    `Purpose: ${outline.purpose}`,
    `Theme: ${outline.theme}`,
    `Tone: ${outline.tone}`,
    `Era: ${outline.era}`,
    outline.keyPoints?.length ? `Key Points:\n${outline.keyPoints.map((p) => `- ${p}`).join('\n')}` : '',
    outline.emotionalBeats?.length ? `Emotional Beats:\n${outline.emotionalBeats.map((b) => `- ${b}`).join('\n')}` : '',
    outline.stakes ? `Stakes: ${outline.stakes}` : '',
    outline.transformation ? `Transformation: ${outline.transformation}` : '',
    outline.intendedImpact ? `Intended Impact: ${outline.intendedImpact}` : '',
  ].filter(Boolean);

  const styleLines = [
    pd.toneKeywords?.length ? `Tone: ${pd.toneKeywords.join(', ')}` : '',
    pd.dialogueStyle ? `Dialogue: ${pd.dialogueStyle}` : '',
    pd.descriptionStyle ? `Description: ${pd.descriptionStyle}` : '',
    pd.pacingNotes ? `Pacing: ${pd.pacingNotes}` : '',
    pd.avoid?.length ? `Avoid: ${pd.avoid.join('; ')}` : '',
  ].filter(Boolean);

  const sectionGoals = plan.sections
    .map((s, i) => `${i + 1}. "${s.name}" - Goal: ${s.goal}`)
    .join('\n');

  return `# Revision Task

Revise the chronicle to resolve the validation issues below. Apply the remediation suggestions directly.

Constraints:
- Preserve headings and section breaks exactly as they appear (including \`#\`, \`##\`, and \`---\`).
- Keep the section order and overall structure.
- Do NOT invent new entities beyond the roster below.
- Maintain the story's tone, theme, and plan goals.

# Plan Context
Title: "${plan.title}"
${formatFocusSummary(plan, context)}

## Story Outline
${outlineLines.join('\n')}

## Section Goals
${sectionGoals}

${plotBeats.length > 0 ? `## Plot Beats\n${plotBeats.map((b, i) => `${i + 1}. ${b.description}`).join('\n')}` : ''}

## Style Directives
${styleLines.join('\n')}

## Entity Roster (non-detailed)
${formatEntityRoster(plan, context)}

# Validation Issues & Suggestions
${formatIssueList(report, plan)}

# Current Chronicle
${assembledContent}

Return ONLY the revised chronicle content.`;
}
