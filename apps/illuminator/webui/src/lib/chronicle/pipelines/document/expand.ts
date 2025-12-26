import type {
  ChroniclePlan,
  ChronicleSection,
  ChronicleGenerationContext,
  RelationshipContext,
} from '../../chronicleTypes';
import type { DocumentNarrativeStyle } from '@canonry/world-schema';
import {
  buildEntityLookup,
  buildRelationshipPairSummaries,
} from '../../relationshipGraph';

function buildDocumentStyleSection(style: DocumentNarrativeStyle): string {
  const doc = style.documentConfig;
  const lines: string[] = ['# Document Style'];
  if (doc.documentType) lines.push(`Type: ${doc.documentType}`);
  if (doc.voice) lines.push(`Voice: ${doc.voice}`);
  if (doc.toneKeywords?.length) lines.push(`Tone: ${doc.toneKeywords.join(', ')}`);
  if (doc.include?.length) lines.push(`Include: ${doc.include.join(', ')}`);
  if (doc.avoid?.length) lines.push(`Avoid: ${doc.avoid.join(', ')}`);
  return lines.join('\n');
}

export function buildSectionPrompt(
  section: ChronicleSection,
  sectionIndex: number,
  plan: ChroniclePlan,
  context: ChronicleGenerationContext,
  previousSections: { id: string; content: string }[],
  style: DocumentNarrativeStyle
): string {
  if (!plan.documentOutline) {
    throw new Error('Document section expansion requires documentOutline');
  }

  const outline = plan.documentOutline;
  const entityLookup = buildEntityLookup(context.entities, context.relationships);
  const entityMap = new Map(context.entities.map((entity) => [entity.id, entity]));
  const roleMap = new Map(plan.entityRoles.map((role) => [role.entityId, role]));
  const sections: string[] = [];
  const formatTags = (tags?: Record<string, string>) => {
    if (!tags || Object.keys(tags).length === 0) return '(none)';
    return Object.entries(tags)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
  };

  sections.push(`# World Context\nWorld: ${context.worldName}\n${context.worldDescription ? `Description: ${context.worldDescription}` : ''}`);

  const overviewLines = [
    `Title: "${plan.title}"`,
    `Purpose: ${outline.purpose}`,
    `Era: ${outline.era}`,
    `Tone: ${outline.tone}`,
    `Focus Mode: ${plan.focus.mode}`,
    outline.keyPoints.length > 0
      ? `Key Points:\n${outline.keyPoints.map((p) => `- ${p}`).join('\n')}`
      : '',
    outline.veracity ? `Veracity: ${outline.veracity}` : '',
    outline.legitimacy ? `Legitimacy: ${outline.legitimacy}` : '',
    outline.audience ? `Audience: ${outline.audience}` : '',
    outline.authorProvenance ? `Provenance: ${outline.authorProvenance}` : '',
    outline.biasAgenda ? `Bias/Agenda: ${outline.biasAgenda}` : '',
    outline.intendedOutcome ? `Intended Outcome: ${outline.intendedOutcome}` : '',
  ].filter(Boolean);

  sections.push(`# Document Overview\n${overviewLines.join('\n')}`);

  sections.push(buildDocumentStyleSection(style));

  if (section.entityIds.length > 0) {
    const entityDetails = section.entityIds.map((entityId) => {
      const entity = entityMap.get(entityId);
      const role = roleMap.get(entityId);
      const label = entityLookup.get(entityId);
      if (!label) return `- ${entityId} (unknown)`;

      const description = entity?.enrichedDescription || entity?.description || 'No description';
      const subtype = entity?.subtype ? `/${entity.subtype}` : '';
      const lines = [
        `- ${label.name} (${label.kind || 'unknown'}${subtype})`,
        role ? `  Role: ${role.role}` : null,
        role ? `  Contribution: ${role.contribution}` : null,
        entity ? `  Tags: ${formatTags(entity.tags)}` : null,
        description ? `  Description: ${description}` : null,
      ].filter(Boolean);

      return lines.join('\n');
    });

    sections.push(`# Entities for This Section\n${entityDetails.join('\n')}`);
  }

  const sectionEvents = context.events.filter((e) =>
    section.eventIds.includes(e.id)
  );

  if (sectionEvents.length > 0) {
    sections.push(`# Events to Reference\n${sectionEvents.map((e) => `- ${e.headline}${e.description ? `: ${e.description}` : ''}`).join('\n')}`);
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
    sections.push(`# Previous Sections (for flow)\n${previousSections
      .map((ps, i) => `## Section ${i + 1}\n${ps.content.slice(0, 300)}${ps.content.length > 300 ? '...' : ''}`)
      .join('\n\n')}`);
  }

  sections.push(`# SECTION ${sectionIndex + 1}: ${section.name}

## Section Purpose (from outline)
${section.purpose}

## Section Goal
${section.goal}

## Content Guidance
${section.contentGuidance}

## Target Length
${section.wordCountTarget ? `${section.wordCountTarget} words` : 'Use the outline word count target'}

## Your Task
Write the content for this document section.

Guidelines:
- Achieve the stated section goal
- Write in a style appropriate for the document type
- Ensure the entrypoint entity appears, alongside at least one required neighbor
- Make the interplay between entities explicit (authority, testimony, consequence, or influence)
- Maintain consistency with previous sections
- Do NOT include the section heading - just the content

Write the section content directly. No meta-commentary or headers.`);

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
