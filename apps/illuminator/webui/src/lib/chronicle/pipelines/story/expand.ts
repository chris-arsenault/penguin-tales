import type {
  ChroniclePlan,
  ChronicleSection,
  ChronicleGenerationContext,
  RelationshipContext,
} from '../../chronicleTypes';
import type { StoryNarrativeStyle } from '@canonry/world-schema';
import {
  buildEntityLookup,
  buildRelationshipPairSummaries,
} from '../../relationshipGraph';

function buildStyleSection(style: StoryNarrativeStyle): string {
  const pd = style.proseDirectives;
  const lines: string[] = ['# Style Directives'];
  if (pd.toneKeywords?.length) lines.push(`Tone: ${pd.toneKeywords.join(', ')}`);
  if (pd.dialogueStyle) lines.push(`Dialogue: ${pd.dialogueStyle}`);
  if (pd.descriptionStyle) lines.push(`Description: ${pd.descriptionStyle}`);
  if (pd.pacingNotes) lines.push(`Pacing: ${pd.pacingNotes}`);
  if (style.pacing?.dialogueRatio) {
    lines.push(
      `Dialogue ratio: ${(style.pacing.dialogueRatio.min * 100).toFixed(0)}%-${(style.pacing.dialogueRatio.max * 100).toFixed(0)}%`
    );
  }
  if (pd.avoid?.length) lines.push(`Avoid: ${pd.avoid.join('; ')}`);
  return lines.join('\n');
}

function buildPlotStructureSection(plan: ChroniclePlan): string | null {
  const beats = plan.plot?.normalizedBeats || [];
  if (beats.length === 0) return null;

  return `# Plot Structure (${plan.plot?.type})\n${beats.map((b, i) => `${i + 1}. ${b.description}`).join('\n')}`;
}

export function buildSectionPrompt(
  section: ChronicleSection,
  sectionIndex: number,
  plan: ChroniclePlan,
  context: ChronicleGenerationContext,
  previousSections: { id: string; content: string }[],
  style: StoryNarrativeStyle
): string {
  const sections: string[] = [];
  if (!plan.storyOutline) {
    throw new Error('Story section expansion requires storyOutline');
  }
  const outline = plan.storyOutline;
  const entityLookup = buildEntityLookup(context.entities, context.relationships);
  const entityMap = new Map(context.entities.map((entity) => [entity.id, entity]));
  const roleMap = new Map(plan.entityRoles.map((role) => [role.entityId, role]));
  const formatTags = (tags?: Record<string, string>) => {
    if (!tags || Object.keys(tags).length === 0) return '(none)';
    return Object.entries(tags)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
  };

  sections.push(`# World Context\nWorld: ${context.worldName}\n${context.worldDescription ? `Description: ${context.worldDescription}` : ''}\n${context.tone ? `Tone: ${context.tone}` : ''}`);

  const overviewLines = [
    `Title: "${plan.title}"`,
    outline?.theme ? `Theme: ${outline.theme}` : '',
    outline?.tone ? `Tone: ${outline.tone}` : '',
    outline?.era ? `Era: ${outline.era}` : '',
    `Focus Mode: ${plan.focus.mode}`,
  ].filter(Boolean);

  sections.push(`# Chronicle Overview\n${overviewLines.join('\n')}`);

  if (outline) {
    const outlineLines = [
      `Purpose: ${outline.purpose}`,
      outline.keyPoints?.length ? `Key Points:\n${outline.keyPoints.map((p) => `- ${p}`).join('\n')}` : '',
      outline.emotionalBeats?.length ? `Emotional Beats:\n${outline.emotionalBeats.map((b) => `- ${b}`).join('\n')}` : '',
      outline.stakes ? `Stakes: ${outline.stakes}` : '',
      outline.transformation ? `Transformation: ${outline.transformation}` : '',
      outline.intendedImpact ? `Intended Impact: ${outline.intendedImpact}` : '',
    ].filter(Boolean);
    sections.push(`# Story Outline\n${outlineLines.join('\n')}`);
  }
  sections.push(buildStyleSection(style));

  const plotSection = buildPlotStructureSection(plan);
  if (plotSection) sections.push(plotSection);

  if (section.entityIds.length > 0) {
    const roleDetails = section.entityIds.map((entityId) => {
      const entity = entityMap.get(entityId);
      const role = roleMap.get(entityId);
      const label = entityLookup.get(entityId);
      if (!label) return `## ${entityId}\n- Role: (unknown)\n- Contribution: (unknown)`;

      const description = entity?.enrichedDescription || entity?.description;
      const lines = [
        `## ${label.name}`,
        role ? `- Role: ${role.role}` : '- Role: (unspecified)',
        role ? `- Contribution: ${role.contribution}` : '- Contribution: (unspecified)',
        `- Kind: ${label.kind || entity?.kind || 'unknown'}${entity?.subtype ? ` (${entity.subtype})` : ''}`,
        entity?.prominence ? `- Prominence: ${entity.prominence}` : null,
        `- Culture: ${entity?.culture || '(none)'}`,
        entity?.status ? `- Status: ${entity.status}` : null,
        entity ? `- Tags: ${formatTags(entity.tags)}` : null,
        description ? `- Description: ${description}` : null,
      ].filter(Boolean);

      return lines.join('\n');
    });

    sections.push(`# Entities in This Section\n${roleDetails.join('\n\n')}`);
  }

  const sectionEvents = context.events.filter((e) =>
    section.eventIds.includes(e.id)
  );

  if (sectionEvents.length > 0) {
    sections.push(`# Events to Incorporate\n${sectionEvents
      .map(
        (e) => `- ${e.headline}${e.description ? `: ${e.description}` : ''}
  Type: ${e.eventKind}, Significance: ${(e.significance * 100).toFixed(0)}%
  ${e.subjectName ? `Subject: ${e.subjectName}` : ''}${e.objectName ? `, Object: ${e.objectName}` : ''}`
      )
      .join('\n')}`);
  }

  const relationshipPairs = buildRelationshipPairSummaries(section.entityIds, context.relationships);
  if (relationshipPairs.length > 0) {
    const formatEntity = (entityId: string) => {
      const info = entityLookup.get(entityId);
      return info ? info.name : entityId;
    };
    const formatRelationship = (rel: RelationshipContext) => {
      const source = entityLookup.get(rel.src);
      const target = entityLookup.get(rel.dst);
      const sourceName = source?.name || rel.sourceName || rel.src;
      const targetName = target?.name || rel.targetName || rel.dst;
      return `${sourceName} --[${rel.kind}]--> ${targetName}`;
    };
    const pairLines = relationshipPairs.map((pair) => {
      const lines = [`- ${formatEntity(pair.entityAId)} <-> ${formatEntity(pair.entityBId)}`];
      const direct = pair.direct.map(formatRelationship);
      if (direct.length > 0) {
        lines.push(`  Direct: ${direct.join('; ')}`);
      }
      const shared = pair.sharedNeighbors.map((sharedNeighbor) => {
        const neighborLabel = formatEntity(sharedNeighbor.neighborId);
        const links = [...sharedNeighbor.linksFromA, ...sharedNeighbor.linksFromB]
          .map(formatRelationship)
          .join('; ');
        return `${neighborLabel}: ${links}`;
      });
      if (shared.length > 0) {
        lines.push(`  Shared neighbors: ${shared.join(' | ')}`);
      }
      if (direct.length === 0 && shared.length === 0) {
        lines.push('  No known relationships in provided graph.');
      }
      return lines.join('\n');
    });

    sections.push(`# Relationships Among Section Entities\n${pairLines.join('\n')}`);
  }

  if (previousSections.length > 0) {
    sections.push(`# Previous Sections (for continuity)\n${previousSections
      .map((ps, i) => `## Section ${i + 1}\n${ps.content.slice(0, 500)}${ps.content.length > 500 ? '...' : ''}`)
      .join('\n\n')}`);
  }

  const requiredElements = section.requiredElements && section.requiredElements.length > 0
    ? section.requiredElements.map((el) => `- ${el}`).join('\n')
    : '(none)';

  sections.push(`# SECTION ${sectionIndex + 1}: ${section.name}

## Section Purpose (from style)
${section.purpose}

## Section Goal (MUST be achieved)
${section.goal}

## Required Elements
${requiredElements}

## Emotional Arc
This section should build toward/express: ${section.emotionalArc}

${section.proseNotes ? `## Prose Notes\n${section.proseNotes}\n` : ''}## Your Task
Write ${section.wordCountTarget ? `about ${section.wordCountTarget}` : '300-500'} words of narrative prose for this section.

Guidelines:
- Achieve the stated section goal - this is your PRIMARY objective
- Honor the emotional arc (${section.emotionalArc})
- Include the required elements listed above
- Ensure the entrypoint entity appears, alongside at least one required neighbor
- Make the interaction between entities explicit (dialogue, action, influence)
- Incorporate the events listed above as natural plot elements
- Maintain continuity with previous sections
- Use vivid, immersive prose befitting the world's tone
- Include dialogue where appropriate

Write the section prose directly. Do not include meta-commentary, section numbers, or headers.`);

  return sections.join('\n\n');
}

export function parseSectionResponse(response: string): string {
  let content = response.trim();

  content = content.replace(/^(Section\s+\d+[:\s]*|#{1,3}\s*Section\s+\d+[:\s]*)/i, '');
  content = content.replace(
    /^(Here\s+is|Here's|Below\s+is|The\s+following\s+is)[^.]*\.\s*/i,
    ''
  );

  return content.trim();
}
