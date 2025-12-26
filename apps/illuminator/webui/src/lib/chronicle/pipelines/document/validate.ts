import type { ChroniclePlan, ChronicleGenerationContext } from '../../chronicleTypes';
import type { DocumentNarrativeStyle } from '@canonry/world-schema';
import { parseValidationResponse } from '../../shared/validationParsing';

function formatOutline(plan: ChroniclePlan): string {
  if (!plan.documentOutline) {
    return 'Document outline missing.';
  }
  const outline = plan.documentOutline;
  const optional = [
    outline.veracity ? `Veracity: ${outline.veracity}` : '',
    outline.legitimacy ? `Legitimacy: ${outline.legitimacy}` : '',
    outline.audience ? `Audience: ${outline.audience}` : '',
    outline.authorProvenance ? `Provenance: ${outline.authorProvenance}` : '',
    outline.biasAgenda ? `Bias/Agenda: ${outline.biasAgenda}` : '',
    outline.intendedOutcome ? `Intended Outcome: ${outline.intendedOutcome}` : '',
  ].filter(Boolean);
  return `Purpose: ${outline.purpose}\nEra: ${outline.era}\nTone: ${outline.tone}\nKey Points:\n${outline.keyPoints.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}${optional.length ? `\n${optional.join('\n')}` : ''}`;
}

export function buildValidationPrompt(
  assembledContent: string,
  plan: ChroniclePlan,
  context: ChronicleGenerationContext,
  style: DocumentNarrativeStyle
): string {
  if (!plan.documentOutline) {
    throw new Error('Document validation requires documentOutline');
  }

  const sections: string[] = [];

  sections.push(`# Original Document Plan

Title: "${plan.title}"
Focus Mode: ${plan.focus.mode}
Entrypoint: ${plan.focus.entrypointId}
Required Neighbors: ${plan.focus.requiredNeighborIds.join(', ')}

## Document Outline
${formatOutline(plan)}

## Section Goals
${plan.sections
  .map((s, i) => `${i + 1}. "${s.name}" - Goal: ${s.goal}`)
  .join('\n')}`);

  sections.push(`# Document Expectations
Type: ${style.documentConfig.documentType}
Tone: ${style.documentConfig.toneKeywords.join(', ')}
Include: ${style.documentConfig.include.join(', ')}
Avoid: ${style.documentConfig.avoid.join(', ')}
${style.documentConfig.structureSchema ? `Structure Schema:\n${style.documentConfig.structureSchema}` : ''}`);

  sections.push(`# Focus Constraints
The entrypoint entity must appear in every section, alongside at least one required neighbor. Every section should show multi-entity interaction.`);

  const relevantEntities = context.entities.filter((e) =>
    plan.entityRoles.some((role) => role.entityId === e.id)
  );

  if (relevantEntities.length > 0) {
    sections.push(`# Entity Facts (for accuracy checking)
${relevantEntities
  .map(
    (e) => `## ${e.name}
- Kind: ${e.kind}${e.subtype ? ` (${e.subtype})` : ''}
- Prominence: ${e.prominence}
- Culture: ${e.culture || '(none)'}
- Status: ${e.status}
- Tags: ${Object.entries(e.tags).map(([k, v]) => `${k}=${v}`).join(', ') || '(none)'}
${e.description ? `- Description: ${e.description}` : ''}`
  )
  .join('\n\n')}`);
  }

  sections.push(`# Assembled Content
${assembledContent}`);

  sections.push(`# Your Task

Evaluate the assembled document against the original plan and entity facts. Output a JSON cohesion report.

Check each of the following:

1. **Structure**: Does the document follow its planned structure and cover all key points?

2. **Entity Consistency**: Are entities referenced accurately and appropriately for their roles in the document? Do multiple entities interact directly?

3. **Section Goals**: For each section, was its stated goal achieved?

4. **Resolution**: Does the document conclude effectively and fulfill its stated purpose?

5. **Factual Accuracy**: Are entity facts (kind, culture, status, etc.) consistent with the descriptions?

6. **Theme Expression**: Is the stated purpose/tone effectively conveyed?

Output this exact JSON structure:

\`\`\`json
{
  "overallScore": 85,
  "checks": {
    "plotStructure": { "pass": true, "notes": "Structure matches outline..." },
    "entityConsistency": { "pass": true, "notes": "Entities stay true to roles..." },
    "sectionGoals": [
      { "sectionId": "section_1", "pass": true, "notes": "Goal achieved..." },
      { "sectionId": "section_2", "pass": false, "notes": "Missing key element..." }
    ],
    "resolution": { "pass": true, "notes": "Purpose fulfilled..." },
    "factualAccuracy": { "pass": true, "notes": "Entity facts consistent..." },
    "themeExpression": { "pass": true, "notes": "Purpose well conveyed..." }
  },
  "issues": [
    {
      "severity": "critical",
      "sectionId": "section_2",
      "checkType": "sectionGoals",
      "description": "Section goal not achieved: ...",
      "suggestion": "Consider adding..."
    },
    {
      "severity": "minor",
      "checkType": "entityConsistency",
      "description": "Entity X behaves out of role when...",
      "suggestion": "Adjust actions or framing to match the plan..."
    }
  ]
}
\`\`\`

Score guidelines:
- 90-100: Excellent, minimal issues
- 75-89: Good, minor issues only
- 60-74: Acceptable, some issues to address
- Below 60: Needs significant revision

Output ONLY the JSON, no other text.`);

  return sections.join('\n\n');
}

export { parseValidationResponse };
