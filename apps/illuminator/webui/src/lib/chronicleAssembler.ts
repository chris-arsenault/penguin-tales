/**
 * Chronicle Assembler
 *
 * Step 3 of the pipeline: Assemble expanded sections into final chronicle.
 * - Combines sections with transitions
 * - Injects [[Entity Name]] wiki links
 * - Formats for wiki display
 *
 * See CHRONICLE_DESIGN.md for architecture documentation.
 */

import type {
  ChroniclePlan,
  ChronicleGenerationContext,
  AssemblyResult,
  EntityContext,
} from './chronicleTypes';
import type { NarrativeStyle } from '@canonry/world-schema';

interface WikiLink {
  entityId: string;
  name: string;
  count: number;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Inject wiki links for entity mentions
 * Only links the first occurrence of each entity to avoid over-linking
 */
function injectWikiLinks(
  text: string,
  entities: EntityContext[]
): { text: string; links: WikiLink[] } {
  const links: WikiLink[] = [];
  let result = text;

  // Track which entities have already been linked
  const alreadyLinked = new Set<string>();

  // Extract already-existing links
  const existingLinkPattern = /\[\[([^\]]+)\]\]/g;
  let match;
  while ((match = existingLinkPattern.exec(text)) !== null) {
    const linkedName = match[1];
    const entity = entities.find(
      (e) => e.name.toLowerCase() === linkedName.toLowerCase()
    );
    if (entity) {
      alreadyLinked.add(entity.id);
      const existing = links.find((l) => l.entityId === entity.id);
      if (existing) {
        existing.count++;
      } else {
        links.push({ entityId: entity.id, name: entity.name, count: 1 });
      }
    }
  }

  // Sort entities by name length (longest first) for accurate matching
  const sortedEntities = [...entities].sort(
    (a, b) => b.name.length - a.name.length
  );

  // Link unlinked mentions
  for (const entity of sortedEntities) {
    if (alreadyLinked.has(entity.id)) continue;

    // Match whole word only, case-insensitive
    const pattern = new RegExp(`\\b(${escapeRegex(entity.name)})\\b`, 'i');
    const matchResult = result.match(pattern);

    if (matchResult) {
      // Only link the first occurrence
      result = result.replace(pattern, `[[${matchResult[1]}]]`);
      links.push({ entityId: entity.id, name: entity.name, count: 1 });
      alreadyLinked.add(entity.id);
    }
  }

  return { text: result, links };
}

/**
 * Assemble the final chronicle from expanded sections
 */
export function assembleStory(
  plan: ChroniclePlan,
  context: ChronicleGenerationContext,
  options: {
    includeTitle?: boolean;
    includeSectionTitles?: boolean;
    injectLinks?: boolean;
  } = {}
): AssemblyResult {
  const {
    includeTitle = true,
    includeSectionTitles = false,
    injectLinks = true,
  } = options;

  try {
    // Check that all sections have content
    const missingSections = plan.sections.filter((s) => !s.generatedContent);
    if (missingSections.length > 0) {
      return {
        success: false,
        wikiLinks: [],
        error: `Missing content for ${missingSections.length} section(s): ${missingSections.map((s) => s.name).join(', ')}`,
      };
    }

    // Build the raw assembled content
    let content: string;
    const parts: string[] = [];

    if (includeTitle) {
      parts.push(`# ${plan.title}\n\n`);
    }

    for (let i = 0; i < plan.sections.length; i++) {
      const section = plan.sections[i];

      // Add section break (except before first section)
      if (i > 0) {
        parts.push('\n\n---\n\n');
      }

      // Optional section title
      if (includeSectionTitles && section.name) {
        parts.push(`## ${section.name}\n\n`);
      }

      // Section content
      parts.push(section.generatedContent || '');
    }

    content = parts.join('');

    // Inject wiki links if enabled
    let wikiLinks: WikiLink[] = [];
    if (injectLinks) {
      const linkResult = injectWikiLinks(content, context.entities);
      content = linkResult.text;
      wikiLinks = linkResult.links;
    }

    return {
      success: true,
      content,
      wikiLinks,
    };
  } catch (error) {
    return {
      success: false,
      wikiLinks: [],
      error: error instanceof Error ? error.message : 'Unknown error during assembly',
    };
  }
}

/**
 * Build prompt for light narrative stitching in assembly step.
 */
export function buildStitchPrompt(
  content: string,
  plan: ChroniclePlan,
  context: ChronicleGenerationContext,
  style: NarrativeStyle
): string {
  const isDocument = plan.format === 'document';
  const formatLabel = isDocument ? 'document' : 'story';
  const styleLines: string[] = [];

  if (style.format !== 'document') {
    if (!style.proseDirectives) {
      throw new Error(`Narrative style "${style.name}" is missing prose directives`);
    }
    const pd = style.proseDirectives;
    styleLines.push(`Tone: ${pd.toneKeywords.join(', ')}`);
    styleLines.push(`Dialogue: ${pd.dialogueStyle}`);
    styleLines.push(`Description: ${pd.descriptionStyle}`);
    styleLines.push(`Pacing: ${pd.pacingNotes}`);
    if (pd.avoid.length > 0) {
      styleLines.push(`Avoid: ${pd.avoid.join('; ')}`);
    }
  } else if (style.format === 'document') {
    if (!style.documentConfig) {
      throw new Error('Document narrative styles must include documentConfig');
    }
    const doc = style.documentConfig;
    styleLines.push(`Document Type: ${doc.documentType}`);
    styleLines.push(`Tone: ${doc.toneKeywords.join(', ')}`);
    styleLines.push(`Include: ${doc.include.join(', ')}`);
    if (doc.avoid.length > 0) {
      styleLines.push(`Avoid: ${doc.avoid.join(', ')}`);
    }
  }

  return `# Stitching Task

You are a narrative editor. Lightly stitch the assembled ${formatLabel} to improve flow and voice consistency.
Make minimal edits: add subtle transitions, remove obvious repetition, and smooth phrasing.

Constraints:
- Preserve all headings and section breaks exactly as they appear (including \`#\`, \`##\`, and \`---\`).
- Preserve all wiki links in \`[[Entity Name]]\` format.
- Do NOT add new facts, entities, or events not already present.
- Keep length and structure roughly the same.

Context:
Title: "${plan.title}"
Theme: ${plan.theme}
Tone: ${plan.tone}
World: ${context.worldName}
${styleLines.length > 0 ? `\nStyle:\n${styleLines.join('\n')}\n` : ''}

Assembled Content:
${content}

Return ONLY the revised content.`;
}
