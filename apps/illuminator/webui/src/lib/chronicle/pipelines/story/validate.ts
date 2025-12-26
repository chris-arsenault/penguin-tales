import type { ChroniclePlan, ChronicleGenerationContext } from '../../chronicleTypes';
import type { StoryNarrativeStyle } from '@canonry/world-schema';
import { parseValidationResponse } from '../../shared/validationParsing';

function formatPlotStructure(plan: ChroniclePlan): string {
  const beats = plan.plot?.normalizedBeats || [];
  return `Plot Type: ${plan.plot?.type}\nBeats:\n${beats.length > 0 ? beats.map((b, i) => `  ${i + 1}. ${b.description}`).join('\n') : '  (none)'}`;
}

export function buildValidationPrompt(
  assembledContent: string,
  plan: ChroniclePlan,
  context: ChronicleGenerationContext,
  style: StoryNarrativeStyle
): string {
  if (!plan.storyOutline) {
    throw new Error('Story validation requires storyOutline');
  }

  const outline = plan.storyOutline;
  const sections: string[] = [];

  sections.push(`# Original Chronicle Plan

Title: "${plan.title}"
Purpose: ${outline.purpose}
Theme: ${outline.theme}
Tone: ${outline.tone}
Era: ${outline.era}
Focus Mode: ${plan.focus.mode}
Entrypoint: ${plan.focus.entrypointId}
Required Neighbors: ${plan.focus.requiredNeighborIds.join(', ')}

## Story Outline
Key Points:
${outline.keyPoints.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}
Emotional Beats:
${outline.emotionalBeats.map((b, i) => `  ${i + 1}. ${b}`).join('\n')}
${outline.stakes ? `Stakes: ${outline.stakes}` : ''}
${outline.transformation ? `Transformation: ${outline.transformation}` : ''}
${outline.intendedImpact ? `Intended Impact: ${outline.intendedImpact}` : ''}

## Entities
${plan.entityRoles
  .map((role) => {
    const entity = context.entities.find((e) => e.id === role.entityId);
    return `- ${entity?.name || role.entityId} (${role.role}): ${role.contribution}`;
  })
  .join('\n')}

## Plot Structure
${formatPlotStructure(plan)}

## Section Goals
${plan.sections
  .map((s, i) => `${i + 1}. "${s.name}" - Goal: ${s.goal}${s.emotionalArc ? ` (${s.emotionalArc})` : ''}`)
  .join('\n')}`);

  sections.push(`# Style Expectations
Tone: ${style.proseDirectives.toneKeywords.join(', ')}
Dialogue: ${style.proseDirectives.dialogueStyle}
Description: ${style.proseDirectives.descriptionStyle}
Pacing: ${style.proseDirectives.pacingNotes}
${style.proseDirectives.avoid.length > 0 ? `Avoid: ${style.proseDirectives.avoid.join('; ')}` : ''}`);

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

Evaluate the assembled story against the original plan and entity facts. Output a JSON cohesion report.

Check each of the following:

1. **Plot Structure**: Does the narrative follow the planned structure and beats?

2. **Entity Consistency**: Do entities act according to their described traits, culture, and prominence? Are their roles coherent, and do multiple entities interact directly (not just appear)?

3. **Section Goals**: For each section, was its stated goal achieved?

4. **Resolution**: Does the narrative conclude effectively and tie off the main arc?

5. **Factual Accuracy**: Are entity facts (kind, culture, status, etc.) consistent with the descriptions?

6. **Theme Expression**: Is the stated theme effectively conveyed?

Output this exact JSON structure:

\`\`\`json
{
  "overallScore": 85,
  "checks": {
    "plotStructure": { "pass": true, "notes": "Clear narrative arc..." },
    "entityConsistency": { "pass": true, "notes": "Entities stay true to traits..." },
    "sectionGoals": [
      { "sectionId": "section_1", "pass": true, "notes": "Goal achieved..." },
      { "sectionId": "section_2", "pass": false, "notes": "Missing key element..." }
    ],
    "resolution": { "pass": true, "notes": "Satisfying conclusion..." },
    "factualAccuracy": { "pass": true, "notes": "Entity facts consistent..." },
    "themeExpression": { "pass": true, "notes": "Theme well conveyed..." }
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
