import type { AssemblyResult, ChroniclePlan, ChronicleGenerationContext } from '../../chronicleTypes';
import type { DocumentNarrativeStyle } from '@canonry/world-schema';
import { assembleSections } from '../../shared/assembly';

export function assemble(plan: ChroniclePlan, context: ChronicleGenerationContext): AssemblyResult {
  return assembleSections(plan, context, {
    includeTitle: true,
    includeSectionTitles: true,
  });
}

export function buildStitchPrompt(
  content: string,
  plan: ChroniclePlan,
  context: ChronicleGenerationContext,
  style: DocumentNarrativeStyle
): string {
  const doc = style.documentConfig;
  const outline = plan.documentOutline;
  const outlineContext = outline
    ? [
        `Purpose: ${outline.purpose}`,
        `Era: ${outline.era}`,
        `Tone: ${outline.tone}`,
        outline.veracity ? `Veracity: ${outline.veracity}` : '',
        outline.legitimacy ? `Legitimacy: ${outline.legitimacy}` : '',
        outline.audience ? `Audience: ${outline.audience}` : '',
        outline.authorProvenance ? `Provenance: ${outline.authorProvenance}` : '',
        outline.biasAgenda ? `Bias/Agenda: ${outline.biasAgenda}` : '',
        outline.intendedOutcome ? `Intended Outcome: ${outline.intendedOutcome}` : '',
      ].filter(Boolean).join('\n')
    : '';

  return `# Stitching Task

You are an editor polishing an in-world document. Make minimal edits to improve flow and voice consistency.

Constraints:
- Preserve all headings and section breaks exactly as they appear (including \`#\`, \`##\`, and \`---\`).
- Do NOT add new facts, entities, or events not already present.
- Keep length and structure roughly the same.

Context:
Title: "${plan.title}"
World: ${context.worldName}
Document Type: ${doc.documentType}
Tone: ${doc.toneKeywords.join(', ')}
Include: ${doc.include.join(', ')}
Avoid: ${doc.avoid.join(', ')}
${outlineContext ? `${outlineContext}\n` : ''}

Assembled Content:
${content}

Return ONLY the revised content.`;
}
