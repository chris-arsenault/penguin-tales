/**
 * Chronicle Assembler
 *
 * Step 3 of the pipeline: Assemble expanded scenes into final story.
 * - Combines scenes with transitions
 * - Injects [[Entity Name]] wiki links
 * - Formats for wiki display
 *
 * See CHRONICLE_DESIGN.md for architecture documentation.
 */

import type {
  StoryPlan,
  ChronicleGenerationContext,
  AssemblyResult,
  EntityContext,
} from './chronicleTypes';
import { isFlexiblePlot } from './chronicleTypes';
import type { NarrativeStyle } from '@canonry/world-schema';

interface WikiLink {
  entityId: string;
  name: string;
  count: number;
}

/**
 * Find and validate entity references in text
 * Returns entities that were mentioned but not already linked
 */
function findEntityMentions(
  text: string,
  entities: EntityContext[]
): Map<string, EntityContext> {
  const mentions = new Map<string, EntityContext>();

  // Sort entities by name length (longest first) to avoid partial matches
  const sortedEntities = [...entities].sort(
    (a, b) => b.name.length - a.name.length
  );

  for (const entity of sortedEntities) {
    // Skip entities already in wiki link format
    const linkedPattern = new RegExp(`\\[\\[${escapeRegex(entity.name)}\\]\\]`, 'gi');
    if (linkedPattern.test(text)) continue;

    // Check if entity name appears (case-insensitive)
    const pattern = new RegExp(`\\b${escapeRegex(entity.name)}\\b`, 'gi');
    if (pattern.test(text)) {
      mentions.set(entity.id, entity);
    }
  }

  return mentions;
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
 * Generate a scene break marker
 */
function getSceneBreak(index: number, total: number): string {
  // No break before first scene
  if (index === 0) return '';

  // Use a subtle scene break marker
  return '\n\n---\n\n';
}

/**
 * Add section headers for longer stories
 */
function formatWithHeaders(
  plan: StoryPlan,
  includeSceneTitles: boolean
): string {
  const parts: string[] = [];

  // Title
  parts.push(`# ${plan.title}\n`);

  // Optional epigraph/theme hint
  if (plan.theme) {
    parts.push(`*${plan.theme}*\n`);
  }

  // Scenes
  for (let i = 0; i < plan.scenes.length; i++) {
    const scene = plan.scenes[i];
    const content = scene.generatedContent;

    if (!content) continue;

    // Scene break
    parts.push(getSceneBreak(i, plan.scenes.length));

    // Optional scene title (for longer stories)
    if (includeSceneTitles && scene.title) {
      parts.push(`## ${scene.title}\n\n`);
    }

    // Scene content
    parts.push(content);
  }

  return parts.join('');
}

/**
 * Assemble the final story from expanded scenes
 */
export function assembleStory(
  plan: StoryPlan,
  context: ChronicleGenerationContext,
  options: {
    includeTitle?: boolean;
    includeSceneTitles?: boolean;
    injectLinks?: boolean;
  } = {}
): AssemblyResult {
  const {
    includeTitle = true,
    includeSceneTitles = false,
    injectLinks = true,
  } = options;

  try {
    // Check that all scenes have content
    const missingScenes = plan.scenes.filter((s) => !s.generatedContent);
    if (missingScenes.length > 0) {
      return {
        success: false,
        wikiLinks: [],
        error: `Missing content for ${missingScenes.length} scene(s): ${missingScenes.map((s) => s.title).join(', ')}`,
      };
    }

    // Build the raw assembled content
    let content: string;
    const parts: string[] = [];

    if (includeTitle) {
      parts.push(`# ${plan.title}\n\n`);
    }

    for (let i = 0; i < plan.scenes.length; i++) {
      const scene = plan.scenes[i];

      // Add scene break (except before first scene)
      if (i > 0) {
        parts.push('\n\n---\n\n');
      }

      // Optional scene title
      if (includeSceneTitles && scene.title) {
        parts.push(`## ${scene.title}\n\n`);
      }

      // Scene content
      parts.push(scene.generatedContent || '');
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
 * Get a summary of the assembled content
 */
export function getAssemblySummary(content: string): {
  wordCount: number;
  paragraphCount: number;
  sceneCount: number;
  linkCount: number;
} {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const paragraphCount = content.split(/\n\n+/).filter((p) => p.trim()).length;
  const sceneCount = (content.match(/\n---\n/g) || []).length + 1;
  const linkCount = (content.match(/\[\[[^\]]+\]\]/g) || []).length;

  return {
    wordCount,
    paragraphCount,
    sceneCount,
    linkCount,
  };
}

/**
 * Format content for display in the wiki
 */
export function formatForWiki(
  content: string,
  plan: StoryPlan,
  context: ChronicleGenerationContext
): string {
  // Add metadata header
  const meta = [
    `<!-- Chronicle: ${plan.title} -->`,
    `<!-- Type: ${context.targetType} -->`,
    `<!-- Target: ${context.targetId} -->`,
    `<!-- Generated: ${new Date().toISOString()} -->`,
  ].join('\n');

  return `${meta}\n\n${content}`;
}

/**
 * Extract all entity references from assembled content
 */
export function extractEntityReferences(
  content: string,
  entities: EntityContext[]
): WikiLink[] {
  const linkPattern = /\[\[([^\]]+)\]\]/g;
  const linkCounts = new Map<string, { entityId: string; name: string; count: number }>();

  let match;
  while ((match = linkPattern.exec(content)) !== null) {
    const linkedName = match[1];
    const entity = entities.find(
      (e) => e.name.toLowerCase() === linkedName.toLowerCase()
    );

    if (entity) {
      const existing = linkCounts.get(entity.id);
      if (existing) {
        existing.count++;
      } else {
        linkCounts.set(entity.id, {
          entityId: entity.id,
          name: entity.name,
          count: 1,
        });
      }
    }
  }

  return Array.from(linkCounts.values()).sort((a, b) => b.count - a.count);
}

/**
 * Build prompt for light narrative stitching in assembly step.
 */
export function buildStitchPrompt(
  content: string,
  plan: StoryPlan,
  context: ChronicleGenerationContext,
  style?: NarrativeStyle
): string {
  const isDocument = isFlexiblePlot(plan.plot) && plan.plot.type === 'document';
  const formatLabel = isDocument ? 'document' : 'story';
  const styleLines: string[] = [];

  if (style && style.format !== 'document' && style.proseDirectives) {
    const pd = style.proseDirectives;
    styleLines.push(`Tone: ${pd.toneKeywords.join(', ')}`);
    styleLines.push(`Dialogue: ${pd.dialogueStyle}`);
    styleLines.push(`Description: ${pd.descriptionStyle}`);
    styleLines.push(`Pacing: ${pd.pacingNotes}`);
    if (pd.avoid.length > 0) {
      styleLines.push(`Avoid: ${pd.avoid.join('; ')}`);
    }
  } else if (style?.format === 'document' && style.documentConfig) {
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
