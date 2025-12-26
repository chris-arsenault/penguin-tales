import type { ChronicleGenerationContext } from '../../chronicleTypes';
import type { StoryNarrativeStyle } from '@canonry/world-schema';

export function buildWorldDataFocusSections(
  context: ChronicleGenerationContext,
  style: StoryNarrativeStyle
): string[] {
  const sections: string[] = [];
  const focus = style.worldDataFocus;
  if (!focus) return sections;

  if (focus.includeLocations && focus.locationUsage) {
    const locations = context.entities.filter(
      (e) => e.kind === 'location' || e.kind === 'place' || e.kind === 'realm'
    );
    if (locations.length > 0) {
      sections.push(`# Locations
${focus.locationUsage}

${locations
  .slice(0, 5)
  .map((l) => `- ${l.name}: ${l.enrichedDescription || l.description || '(no description)'}`)
  .join('\n')}
`);
    }
  }

  if (focus.includeArtifacts && focus.artifactUsage) {
    const artifacts = context.entities.filter(
      (e) => e.kind === 'artifact' || e.kind === 'item' || e.kind === 'object'
    );
    if (artifacts.length > 0) {
      sections.push(`# Artifacts
${focus.artifactUsage}

${artifacts
  .slice(0, 5)
  .map((a) => `- ${a.name}: ${a.enrichedDescription || a.description || '(no description)'}`)
  .join('\n')}
`);
    }
  }

  if (focus.includeCulturalPractices && focus.culturalUsage) {
    const cultures = new Set(
      context.entities.filter((e) => e.culture).map((e) => e.culture)
    );
    if (cultures.size > 0) {
      sections.push(`# Cultural Context
${focus.culturalUsage}

Cultures present: ${Array.from(cultures).join(', ')}
`);
    }
  }

  if (focus.includeEraContext && focus.eraUsage && context.era) {
    sections.push(`# Era Context
${focus.eraUsage}

Era: ${context.era.name}
${context.era.description || ''}
`);
  }

  if (focus.customFocus && focus.customFocus.length > 0) {
    sections.push(`# Additional Focus
${focus.customFocus.join('\n')}
`);
  }

  return sections;
}

export function buildProseDirectivesSection(style: StoryNarrativeStyle): string {
  const pd = style.proseDirectives;
  const lines: string[] = ['# Writing Style Directives'];

  lines.push(`Tone: ${pd.toneKeywords.join(', ')}`);
  lines.push(`Dialogue: ${pd.dialogueStyle}`);
  lines.push(`Description: ${pd.descriptionStyle}`);
  lines.push(`Pacing: ${pd.pacingNotes}`);

  if (pd.avoid.length > 0) {
    lines.push(`Avoid: ${pd.avoid.join('; ')}`);
  }

  if (pd.exampleProse) {
    lines.push(`\nExample of desired prose style:\n"${pd.exampleProse}"`);
  }

  return lines.join('\n');
}

export function buildSceneTemplatesSection(style: StoryNarrativeStyle): string {
  const lines: string[] = ['# Available Scene Types'];

  for (const template of style.sceneTemplates) {
    lines.push(`## ${template.name}`);
    lines.push(`Purpose: ${template.purpose}`);
    lines.push(`Emotional arc: ${template.emotionalArc}`);
    lines.push(`Required elements: ${template.requiredElements.join(', ')}`);
    lines.push(`Target words: ${template.wordCountTarget}`);
    lines.push(`Notes: ${template.proseNotes}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function buildRolesSection(style: StoryNarrativeStyle): string {
  const lines: string[] = ['# Character Roles'];

  for (const role of style.entityRules.roles) {
    lines.push(
      `- ${role.role} (${role.count.min}-${role.count.max}): ${role.description}`
    );
    if (role.selectionCriteria) {
      lines.push(`  Prefer: ${role.selectionCriteria}`);
    }
  }

  return lines.join('\n');
}
