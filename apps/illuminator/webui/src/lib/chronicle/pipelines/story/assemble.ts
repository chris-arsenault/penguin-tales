import type { AssemblyResult, ChroniclePlan, ChronicleGenerationContext } from '../../chronicleTypes';
import type { StoryNarrativeStyle } from '@canonry/world-schema';
import { assembleSections } from '../../shared/assembly';

export function assemble(plan: ChroniclePlan, context: ChronicleGenerationContext): AssemblyResult {
  return assembleSections(plan, context, {
    includeTitle: true,
    includeSectionTitles: false,
  });
}

export function buildStitchPrompt(
  content: string,
  plan: ChroniclePlan,
  context: ChronicleGenerationContext,
  style: StoryNarrativeStyle
): string {
  if (!plan.storyOutline) {
    throw new Error('Story assembly requires storyOutline');
  }
  const outline = plan.storyOutline;
  const pd = style.proseDirectives;
  const styleLines = [
    `Tone: ${pd.toneKeywords.join(', ')}`,
    `Dialogue: ${pd.dialogueStyle}`,
    `Description: ${pd.descriptionStyle}`,
    `Pacing: ${pd.pacingNotes}`,
    pd.avoid.length > 0 ? `Avoid: ${pd.avoid.join('; ')}` : '',
  ].filter(Boolean);

  return `# Stitching Task

You are a narrative editor. Lightly stitch the assembled story to improve flow and voice consistency.
Make minimal edits: add subtle transitions, remove obvious repetition, and smooth phrasing.

Constraints:
- Preserve all headings and section breaks exactly as they appear (including \`#\`, \`##\`, and \`---\`).
- Do NOT add new facts, entities, or events not already present.
- Keep length and structure roughly the same.

Context:
Title: "${plan.title}"
Purpose: ${outline?.purpose || '(none)'}
Theme: ${outline?.theme || '(none)'}
Tone: ${outline?.tone || '(none)'}
Era: ${outline?.era || '(none)'}
World: ${context.worldName}

Style:
${styleLines.join('\n')}

Assembled Content:
${content}

Return ONLY the revised content.`;
}
