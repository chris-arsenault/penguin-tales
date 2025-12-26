import type {
  ChroniclePlan,
  ChronicleGenerationContext,
  CohesionReport,
} from '../../chronicleTypes';
import type { DocumentNarrativeStyle } from '@canonry/world-schema';
import {
  formatEntityRoster,
  formatFocusSummary,
  formatIssueList,
} from '../../shared/editing';

export function buildEditPrompt(
  assembledContent: string,
  plan: ChroniclePlan,
  context: ChronicleGenerationContext,
  style: DocumentNarrativeStyle,
  report: CohesionReport
): string {
  if (!plan.documentOutline) {
    throw new Error('Document edit requires documentOutline');
  }

  const outline = plan.documentOutline;
  const doc = style.documentConfig;
  const outlineLines = [
    `Purpose: ${outline.purpose}`,
    `Era: ${outline.era}`,
    `Tone: ${outline.tone}`,
    outline.keyPoints?.length ? `Key Points:\n${outline.keyPoints.map((p) => `- ${p}`).join('\n')}` : '',
    outline.veracity ? `Veracity: ${outline.veracity}` : '',
    outline.legitimacy ? `Legitimacy: ${outline.legitimacy}` : '',
    outline.audience ? `Audience: ${outline.audience}` : '',
    outline.authorProvenance ? `Provenance: ${outline.authorProvenance}` : '',
    outline.biasAgenda ? `Bias/Agenda: ${outline.biasAgenda}` : '',
    outline.intendedOutcome ? `Intended Outcome: ${outline.intendedOutcome}` : '',
  ].filter(Boolean);

  const sectionGoals = plan.sections
    .map((s, i) => `${i + 1}. "${s.name}" - Goal: ${s.goal}`)
    .join('\n');

  return `# Revision Task

Revise the document to resolve the validation issues below. Apply the remediation suggestions directly.

Constraints:
- Preserve headings and section breaks exactly as they appear (including \`#\`, \`##\`, and \`---\`).
- Keep the section order and overall structure.
- Do NOT invent new entities beyond the roster below.
- Maintain the document's tone, format, and plan goals.

# Plan Context
Title: "${plan.title}"
${formatFocusSummary(plan, context)}

## Document Outline
${outlineLines.join('\n')}

## Section Goals
${sectionGoals}

## Document Expectations
Type: ${doc.documentType}
Tone: ${doc.toneKeywords.join(', ')}
Include: ${doc.include.join(', ')}
Avoid: ${doc.avoid.join(', ')}
${doc.structureSchema ? `Structure Schema:\n${doc.structureSchema}` : ''}

## Entity Roster (non-detailed)
${formatEntityRoster(plan, context)}

# Validation Issues & Suggestions
${formatIssueList(report, plan)}

# Current Document
${assembledContent}

Return ONLY the revised document content.`;
}
