/**
 * Chronicle Cohesion Validator
 *
 * Step 4 of the pipeline: Validate assembled story against plan and context.
 * Checks for plot structure, character consistency, scene goals, and more.
 *
 * See CHRONICLE_DESIGN.md for architecture documentation.
 */

import type {
  StoryPlan,
  ChronicleGenerationContext,
  CohesionReport,
  CohesionCheck,
  SceneGoalCheck,
  CohesionIssue,
  ValidationResult,
} from './chronicleTypes';
import { isThreeActPlot, isFlexiblePlot } from './chronicleTypes';
import type { NarrativeStyle } from '@canonry/world-schema';

/**
 * Format plot structure for the validation prompt
 */
function formatPlotStructure(plan: StoryPlan): string {
  if (isThreeActPlot(plan.plot)) {
    return `Inciting Incident: ${plan.plot.incitingIncident?.description || '(not specified)'}
Rising Action:
${(plan.plot.risingAction || []).map((ra, i) => `  ${i + 1}. ${ra.description}`).join('\n') || '  (none)'}
Climax: ${plan.plot.climax?.description || '(not specified)'}
Resolution: ${plan.plot.resolution?.description || '(not specified)'}`;
  }

  if (isFlexiblePlot(plan.plot)) {
    const beats = plan.plot.normalizedBeats || [];
    if (plan.plot.type === 'document') {
      // Document format - show purpose and key points
      const raw = plan.plot.raw as Record<string, unknown>;
      const purpose = raw?.documentPurpose || '(not specified)';
      const keyPoints = Array.isArray(raw?.keyPoints) ? raw.keyPoints : [];
      return `Document Purpose: ${purpose}
Key Points:
${keyPoints.length > 0 ? keyPoints.map((p, i) => `  ${i + 1}. ${p}`).join('\n') : '  (none)'}`;
    }
    // Other flexible plot types
    return `Plot Type: ${plan.plot.type}
Beats:
${beats.length > 0 ? beats.map((b, i) => `  ${i + 1}. ${b.description}`).join('\n') : '  (none)'}`;
  }

  return '(unknown plot structure)';
}

/**
 * Build prompt for cohesion validation
 */
export function buildValidationPrompt(
  assembledContent: string,
  plan: StoryPlan,
  context: ChronicleGenerationContext,
  style?: NarrativeStyle
): string {
  const sections: string[] = [];

  // Story plan summary
  sections.push(`# Original Story Plan

Title: "${plan.title}"
Theme: ${plan.theme}
Tone: ${plan.tone}

## Entities
${plan.characters
  .map((c) => {
    const entity = context.entities.find((e) => e.id === c.entityId);
    return `- ${entity?.name || c.entityId} (${c.role}): ${c.arc}`;
  })
  .join('\n')}

## Plot Structure
${formatPlotStructure(plan)}

## Scene Goals
${plan.scenes.map((s, i) => `${i + 1}. "${s.title}" - Goal: ${s.goal} (${s.emotionalBeat})`).join('\n')}`);

  if (style && style.format !== 'document' && style.proseDirectives) {
    sections.push(`# Style Expectations
Tone: ${style.proseDirectives.toneKeywords.join(', ')}
Dialogue: ${style.proseDirectives.dialogueStyle}
Description: ${style.proseDirectives.descriptionStyle}
Pacing: ${style.proseDirectives.pacingNotes}
${style.proseDirectives.avoid.length > 0 ? `Avoid: ${style.proseDirectives.avoid.join('; ')}` : ''}`);
  } else if (style?.format === 'document' && style.documentConfig) {
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
    plan.characters.some((c) => c.entityId === e.id)
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

  // The assembled story
  sections.push(`# Assembled Story
${assembledContent}`);

  // Validation instructions - adapt based on format
  const isDocument = isFlexiblePlot(plan.plot) && plan.plot.type === 'document';

  const plotCheckDesc = isDocument
    ? 'Does the document follow its planned structure and cover all key points?'
    : 'Does the story have a clear narrative arc as planned (inciting incident, rising action, climax, resolution)?';

  const resolutionCheckDesc = isDocument
    ? 'Does the document conclude effectively and fulfill its stated purpose?'
    : 'Is the ending satisfying? Does it tie up the main conflict?';

  const characterCheckDesc = isDocument
    ? 'Are entities referenced accurately and appropriately for their roles in the document?'
    : 'Do entities act according to their described traits, culture, and prominence? Are their roles coherent, and do multiple entities interact directly (not just appear)?';

  sections.push(`# Your Task

Evaluate the assembled ${isDocument ? 'document' : 'story'} against the original plan and entity facts. Output a JSON cohesion report.

Check each of the following:

1. **Plot Structure**: ${plotCheckDesc}

2. **Character Consistency**: ${characterCheckDesc}

3. **Scene Goals**: For each ${isDocument ? 'section' : 'scene'}, was its stated goal achieved?

4. **Resolution**: ${resolutionCheckDesc}

5. **Factual Accuracy**: Are entity facts (kind, culture, status, etc.) consistent with the descriptions?

6. **Theme Expression**: Is the stated theme/purpose effectively conveyed?

Output this exact JSON structure:

\`\`\`json
{
  "overallScore": 85,
  "checks": {
    "plotStructure": { "pass": true, "notes": "Clear narrative arc..." },
    "characterConsistency": { "pass": true, "notes": "Characters stay true to traits..." },
    "sceneGoals": [
      { "sceneId": "scene_1", "pass": true, "notes": "Goal achieved..." },
      { "sceneId": "scene_2", "pass": false, "notes": "Missing key element..." }
    ],
    "resolution": { "pass": true, "notes": "Satisfying conclusion..." },
    "factualAccuracy": { "pass": true, "notes": "Entity facts consistent..." },
    "themeExpression": { "pass": true, "notes": "Theme well conveyed..." }
  },
  "issues": [
    {
      "severity": "critical",
      "sceneId": "scene_2",
      "checkType": "sceneGoals",
      "description": "Scene goal not achieved: ...",
      "suggestion": "Consider adding..."
    },
    {
      "severity": "minor",
      "checkType": "characterConsistency",
      "description": "Character X acts slightly out of character when...",
      "suggestion": "Adjust dialogue to..."
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
  plan: StoryPlan
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
      characterConsistency: normalizeCheck(parsed.checks?.characterConsistency),
      sceneGoals: normalizeSceneGoals(parsed.checks?.sceneGoals, plan.scenes),
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

function normalizeSceneGoals(
  goals: unknown,
  scenes: { id: string }[]
): SceneGoalCheck[] {
  if (!Array.isArray(goals)) {
    // Return placeholder checks for all scenes
    return scenes.map((s) => ({
      sceneId: s.id,
      pass: false,
      notes: 'Not evaluated',
    }));
  }

  return goals.map((g: unknown) => {
    if (!g || typeof g !== 'object') {
      return { sceneId: 'unknown', pass: false, notes: 'Invalid' };
    }
    const obj = g as Record<string, unknown>;
    return {
      sceneId: String(obj.sceneId || 'unknown'),
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
    sceneId: obj.sceneId ? String(obj.sceneId) : undefined,
    checkType: String(obj.checkType || 'unknown'),
    description: String(obj.description || ''),
    suggestion: String(obj.suggestion || ''),
  };
}

/**
 * Run cohesion validation
 */
export async function validateCohesion(
  assembledContent: string,
  plan: StoryPlan,
  context: ChronicleGenerationContext,
  callLLM: (prompt: string) => Promise<string>
): Promise<ValidationResult> {
  try {
    const prompt = buildValidationPrompt(assembledContent, plan, context);
    const response = await callLLM(prompt);
    const report = parseValidationResponse(response, plan);

    return {
      success: true,
      report,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get a quick assessment from the report
 */
export function assessReport(report: CohesionReport): {
  status: 'excellent' | 'good' | 'acceptable' | 'needs_revision';
  criticalIssueCount: number;
  minorIssueCount: number;
  failedChecks: string[];
} {
  const criticalIssues = report.issues.filter((i) => i.severity === 'critical');
  const minorIssues = report.issues.filter((i) => i.severity === 'minor');

  const failedChecks: string[] = [];
  if (!report.checks.plotStructure.pass) failedChecks.push('Plot Structure');
  if (!report.checks.characterConsistency.pass) failedChecks.push('Character Consistency');
  if (!report.checks.resolution.pass) failedChecks.push('Resolution');
  if (!report.checks.factualAccuracy.pass) failedChecks.push('Factual Accuracy');
  if (!report.checks.themeExpression.pass) failedChecks.push('Theme Expression');

  const failedSceneGoals = report.checks.sceneGoals.filter((sg) => !sg.pass);
  if (failedSceneGoals.length > 0) {
    failedChecks.push(`Scene Goals (${failedSceneGoals.length})`);
  }

  let status: 'excellent' | 'good' | 'acceptable' | 'needs_revision';
  if (report.overallScore >= 90) {
    status = 'excellent';
  } else if (report.overallScore >= 75) {
    status = 'good';
  } else if (report.overallScore >= 60) {
    status = 'acceptable';
  } else {
    status = 'needs_revision';
  }

  return {
    status,
    criticalIssueCount: criticalIssues.length,
    minorIssueCount: minorIssues.length,
    failedChecks,
  };
}

/**
 * Generate suggestions for addressing issues
 */
export function generateRevisionSuggestions(report: CohesionReport): string[] {
  const suggestions: string[] = [];

  // Critical issues first
  for (const issue of report.issues.filter((i) => i.severity === 'critical')) {
    if (issue.suggestion) {
      suggestions.push(`[Critical] ${issue.suggestion}`);
    } else {
      suggestions.push(`[Critical] Fix: ${issue.description}`);
    }
  }

  // Then minor issues
  for (const issue of report.issues.filter((i) => i.severity === 'minor')) {
    if (issue.suggestion) {
      suggestions.push(`[Minor] ${issue.suggestion}`);
    }
  }

  // Failed scene goals
  for (const sg of report.checks.sceneGoals.filter((sg) => !sg.pass)) {
    suggestions.push(`[Scene] Review ${sg.sceneId}: ${sg.notes}`);
  }

  return suggestions;
}
