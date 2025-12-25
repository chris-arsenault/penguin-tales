/**
 * Chronicle Cohesion Validator
 *
 * Step 4 of the pipeline: Validate assembled chronicle against plan and context.
 * Checks for plot structure, entity consistency, section goals, and more.
 *
 * See CHRONICLE_DESIGN.md for architecture documentation.
 */

import type {
  ChroniclePlan,
  ChronicleGenerationContext,
  CohesionReport,
  CohesionCheck,
  SectionGoalCheck,
  CohesionIssue,
} from './chronicleTypes';
import type { NarrativeStyle } from '@canonry/world-schema';

/**
 * Format plot structure for the validation prompt
 */
function formatPlotStructure(plan: ChroniclePlan): string {
  if (plan.plot.type === 'document') {
    // Document format - show purpose and key points
    const raw = plan.plot.raw as Record<string, unknown>;
    const purpose = raw.documentPurpose as string;
    const keyPoints = raw.keyPoints as string[];
    if (!purpose || !Array.isArray(keyPoints)) {
      throw new Error('Document plot is missing documentPurpose or keyPoints');
    }
    return `Document Purpose: ${purpose}
Key Points:
${keyPoints.length > 0 ? keyPoints.map((p, i) => `  ${i + 1}. ${p}`).join('\n') : '  (none)'}`;
  }

  const beats = plan.plot.normalizedBeats || [];
  return `Plot Type: ${plan.plot.type}
Beats:
${beats.length > 0 ? beats.map((b, i) => `  ${i + 1}. ${b.description}`).join('\n') : '  (none)'}`;
}

/**
 * Build prompt for cohesion validation
 */
export function buildValidationPrompt(
  assembledContent: string,
  plan: ChroniclePlan,
  context: ChronicleGenerationContext,
  style: NarrativeStyle
): string {
  if (!style) {
    throw new Error('Narrative style is required for cohesion validation');
  }
  const sections: string[] = [];

  // Chronicle plan summary
  sections.push(`# Original Chronicle Plan

Title: "${plan.title}"
Theme: ${plan.theme}
Tone: ${plan.tone}

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

  if (style.format !== 'document') {
    if (!style.proseDirectives) {
      throw new Error(`Narrative style "${style.name}" is missing prose directives`);
    }
    sections.push(`# Style Expectations
    Tone: ${style.proseDirectives.toneKeywords.join(', ')}
    Dialogue: ${style.proseDirectives.dialogueStyle}
    Description: ${style.proseDirectives.descriptionStyle}
    Pacing: ${style.proseDirectives.pacingNotes}
    ${style.proseDirectives.avoid.length > 0 ? `Avoid: ${style.proseDirectives.avoid.join('; ')}` : ''}`);
  } else if (style.format === 'document') {
    if (!style.documentConfig) {
      throw new Error('Document narrative styles must include documentConfig');
    }
    sections.push(`# Document Expectations
    Type: ${style.documentConfig.documentType}
Tone: ${style.documentConfig.toneKeywords.join(', ')}
Include: ${style.documentConfig.include.join(', ')}
Avoid: ${style.documentConfig.avoid.join(', ')}
${style.documentConfig.structureSchema ? `Structure Schema:\n${style.documentConfig.structureSchema}` : ''}`);
  }

  if (context.targetType === 'entityStory' && context.entity) {
    sections.push(`# Entry Point Entity
${context.entity.name} (ID: ${context.entity.id}) must appear in the narrative and participate in interactions.`);
  }

  // Entity facts for accuracy checking
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

  // The assembled content
  sections.push(`# Assembled Content
${assembledContent}`);

  // Validation instructions - adapt based on format
  const isDocument = plan.format === 'document';

  const plotCheckDesc = isDocument
    ? 'Does the document follow its planned structure and cover all key points?'
    : 'Does the narrative follow the planned structure and beats?';

  const resolutionCheckDesc = isDocument
    ? 'Does the document conclude effectively and fulfill its stated purpose?'
    : 'Does the narrative conclude effectively and tie off the main arc?';

  const entityCheckDesc = isDocument
    ? 'Are entities referenced accurately and appropriately for their roles in the document?'
    : 'Do entities act according to their described traits, culture, and prominence? Are their roles coherent, and do multiple entities interact directly (not just appear)?';

  sections.push(`# Your Task

Evaluate the assembled ${isDocument ? 'document' : 'chronicle'} against the original plan and entity facts. Output a JSON cohesion report.

Check each of the following:

1. **Plot Structure**: ${plotCheckDesc}

2. **Entity Consistency**: ${entityCheckDesc}

3. **Section Goals**: For each section, was its stated goal achieved?

4. **Resolution**: ${resolutionCheckDesc}

5. **Factual Accuracy**: Are entity facts (kind, culture, status, etc.) consistent with the descriptions?

6. **Theme Expression**: Is the stated theme/purpose effectively conveyed?

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

/**
 * Parse validation response into CohesionReport
 */
export function parseValidationResponse(
  response: string,
  plan: ChroniclePlan
): CohesionReport {
  // Extract JSON from response
  let jsonStr = response;
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  const parsed = JSON.parse(jsonStr.trim());

  // Validate and transform
  const report: CohesionReport = {
    overallScore: typeof parsed.overallScore === 'number' ? parsed.overallScore : 50,

    checks: {
      plotStructure: normalizeCheck(parsed.checks?.plotStructure),
      entityConsistency: normalizeCheck(parsed.checks?.entityConsistency),
      sectionGoals: normalizeSectionGoals(parsed.checks?.sectionGoals, plan.sections),
      resolution: normalizeCheck(parsed.checks?.resolution),
      factualAccuracy: normalizeCheck(parsed.checks?.factualAccuracy),
      themeExpression: normalizeCheck(parsed.checks?.themeExpression),
    },

    issues: (parsed.issues || []).map(normalizeIssue),

    generatedAt: Date.now(),
  };

  return report;
}

function normalizeCheck(check: unknown): CohesionCheck {
  if (!check || typeof check !== 'object') {
    return { pass: false, notes: 'Not evaluated' };
  }
  const obj = check as Record<string, unknown>;
  return {
    pass: Boolean(obj.pass),
    notes: String(obj.notes || ''),
  };
}

function normalizeSectionGoals(
  goals: unknown,
  sections: { id: string }[]
): SectionGoalCheck[] {
  if (!Array.isArray(goals)) {
    // Return placeholder checks for all sections
    return sections.map((section) => ({
      sectionId: section.id,
      pass: false,
      notes: 'Not evaluated',
    }));
  }

  return goals.map((g: unknown) => {
    if (!g || typeof g !== 'object') {
      return { sectionId: 'unknown', pass: false, notes: 'Invalid' };
    }
    const obj = g as Record<string, unknown>;
    return {
      sectionId: String(obj.sectionId || 'unknown'),
      pass: Boolean(obj.pass),
      notes: String(obj.notes || ''),
    };
  });
}

function normalizeIssue(issue: unknown): CohesionIssue {
  if (!issue || typeof issue !== 'object') {
    return {
      severity: 'minor',
      checkType: 'unknown',
      description: 'Invalid issue',
      suggestion: '',
    };
  }
  const obj = issue as Record<string, unknown>;
  return {
    severity: obj.severity === 'critical' ? 'critical' : 'minor',
    sectionId: obj.sectionId ? String(obj.sectionId) : undefined,
    checkType: String(obj.checkType || 'unknown'),
    description: String(obj.description || ''),
    suggestion: String(obj.suggestion || ''),
  };
}

