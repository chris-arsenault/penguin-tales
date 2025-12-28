/**
 * Prompt Templates System - Redesigned
 *
 * Simplified approach:
 * - WorldContext: Just essentials (name, description, canon facts, tone)
 * - EntityContext: Built dynamically from actual graph data (relationships, peers, era)
 * - Prompts that USE this data effectively
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Style information for image generation
 */
export interface StyleInfo {
  /** Artistic style prompt fragment (e.g., "oil painting style, rich textures...") */
  artisticPromptFragment?: string;
  /** Composition style prompt fragment (e.g., "portrait composition, head and shoulders...") */
  compositionPromptFragment?: string;
  /** Color palette prompt fragment (e.g., "warm earth tones: terracotta, amber, ochre...") */
  colorPalettePromptFragment?: string;
  /** Additional culture-specific style keywords */
  cultureKeywords?: string[];
  /**
   * Visual identity entries from culture, filtered by entity kind's visualIdentityKeys.
   * e.g., { "ATTIRE": "fur parkas with bone jewelry", "SPECIES": "emperor penguins" }
   */
  visualIdentity?: Record<string, string>;
}

/**
 * Descriptive information for text generation
 */
export interface DescriptiveInfo {
  /**
   * Descriptive identity entries from culture, filtered by entity kind's descriptiveIdentityKeys.
   * e.g., { "CUSTOMS": "elaborate greeting rituals", "SPEECH": "formal, archaic dialect" }
   */
  descriptiveIdentity?: Record<string, string>;
}

/**
 * World-level context - minimal, essential information
 */
export interface WorldContext {
  name: string;                 // World name
  description: string;          // Genre/setting brief (1-2 sentences)
  canonFacts: string[];         // Facts that must not be contradicted
  tone?: string;                // "dark fantasy", "whimsical", "gritty realism"
}

/**
 * Resolved relationship with target entity info
 */
export interface ResolvedRelationship {
  kind: string;                 // "allies_with", "member_of", "rivals"
  targetName: string;           // Resolved entity name
  targetKind: string;           // "faction", "npc", "location"
  targetSubtype?: string;       // "guild", "hero", "fortress"
  strength?: number;            // 0-1 relationship strength
  mutual?: boolean;             // Is this bidirectional?
}

/**
 * Entity-specific context built from graph data
 */
export interface EntityContext {
  // Core entity data
  entity: {
    id: string;
    name: string;
    kind: string;
    subtype: string;
    prominence: string;
    culture: string;
    status: string;
    /** Short summary of the entity (1-2 sentences) */
    summary?: string;
    /** Full description (if any) - used for text prompts */
    description: string;
    tags: Record<string, string | number | boolean>;
    /** One-sentence visual thesis - the primary visual signal for this entity */
    visualThesis?: string;
    /** Distinctive visual traits for image generation (support the thesis) */
    visualTraits?: string[];
  };

  // Resolved relationships (not just IDs)
  relationships: ResolvedRelationship[];

  // Temporal context
  era: {
    name: string;
    description?: string;
  };
  entityAge: 'ancient' | 'established' | 'mature' | 'recent' | 'new';

  // Related entities (names, not IDs)
  culturalPeers?: string[];     // Other notable entities of same culture
  factionMembers?: string[];    // If entity belongs to a faction
  locationEntities?: string[];  // Entities at same location (if applicable)
}

/**
 * Full context for prompt building
 */
export interface PromptContext {
  world: WorldContext;
  entity: EntityContext;
}

// =============================================================================
// Template Definitions
// =============================================================================

export interface DescriptionTemplate {
  instructions: string;
  tone: string;
  constraints: string;
  outputFormat: string;
  fullTemplate?: string;        // Advanced mode override
}

export interface ImageTemplate {
  /** Instructions for Claude on how to build the image prompt based on entity type */
  imageInstructions: string;
  /** Elements to avoid in the generated image */
  avoidElements: string;
  /** Advanced mode: full template override */
  fullTemplate?: string;
}

export interface PromptTemplates {
  defaults: {
    description: DescriptionTemplate;
    image: ImageTemplate;
  };
  byKind: {
    [entityKind: string]: {
      description?: Partial<DescriptionTemplate>;
      image?: Partial<ImageTemplate>;
    };
  };
  /**
   * Which visual identity keys to include in image prompts, per entity kind.
   * Keys come from cultureVisualIdentities (e.g., "ATTIRE", "SPECIES", "ARCHITECTURE").
   */
  visualIdentityKeysByKind?: {
    [entityKind: string]: string[];
  };
  /**
   * Visual identity KVPs for each culture (used in image prompts).
   * Keys are category names (e.g., "ATTIRE", "SPECIES", "ARCHITECTURE").
   * Values are descriptive text for image generation.
   */
  cultureVisualIdentities?: {
    [cultureId: string]: Record<string, string>;
  };
  /**
   * Which descriptive identity keys to include in text prompts, per entity kind.
   * Keys come from cultureDescriptiveIdentities (e.g., "CUSTOMS", "SPEECH", "VALUES").
   */
  descriptiveIdentityKeysByKind?: {
    [entityKind: string]: string[];
  };
  /**
   * Descriptive identity KVPs for each culture (used in text prompts).
   * Keys are category names (e.g., "CUSTOMS", "SPEECH", "VALUES").
   * Values are descriptive text for description generation.
   */
  cultureDescriptiveIdentities?: {
    [cultureId: string]: Record<string, string>;
  };
}

// =============================================================================
// Default Templates - Actually Use the Context
// =============================================================================

export const DEFAULT_DESCRIPTION_TEMPLATE: DescriptionTemplate = {
  instructions: `Write a description that emerges from who this entity IS and what they're CONNECTED to.

Use the provided relationships to ground the description - if they're allied with a faction, that shapes who they are. If they have rivals, hint at tension. If they're a member of something, show belonging.

The entity's prominence ({{entity.prominence}}) should calibrate the scope:
- mythic/renowned: World-shaping, widely known, legendary qualities
- recognized: Notable within their sphere, respected or feared
- marginal/forgotten: Intimate scale, personal details, local significance

Consider their age in the world ({{entityAge}}) - ancient entities carry history, new ones have fresh energy.`,

  tone: `Match the world's tone ({{world.tone}}) but let the entity's nature lead. A grim warlord in a whimsical world creates interesting contrast. Write with specificity - name actual connections, reference the culture, ground details in the world of {{world.name}}.`,

  constraints: `Never contradict these facts: {{world.canonFacts}}

Don't invent major relationships not implied by the data - the relationships provided are canonical.`,

  outputFormat: `Return JSON only with keys summary, description, aliases, visualThesis, visualTraits.

summary: 1-2 sentences, compressed and faithful to the description.
description: 2-4 sentences, vivid and specific.
aliases: array of alternate names or titles (can be empty).
visualThesis: ONE sentence - the dominant visual signal (must pass silhouette test).
visualTraits: array of 2-4 traits that support and reinforce the thesis.

Summary and description must not contradict; the summary should not add new facts.`,
};

// Minimal code fallbacks - project config should provide actual values
export const DEFAULT_IMAGE_TEMPLATE: ImageTemplate = {
  imageInstructions: `Create concept art that captures this entity's essence.`,
  avoidElements: `Text, labels, watermarks, UI elements.`,
};


// =============================================================================
// Kind-Specific Overrides
// =============================================================================

// Minimal code fallbacks for kind-specific templates
// Project config should provide actual values via illuminatorConfig.json
export const DEFAULT_KIND_OVERRIDES: PromptTemplates['byKind'] = {
  npc: {
    description: {
      instructions: `This is a character. Focus on what makes them distinctive as a person.`,
    },
  },
  location: {
    description: {
      instructions: `This is a place. Evoke the sensory experience of being here.`,
    },
  },
  faction: {
    description: {
      instructions: `This is an organization. Focus on collective identity and purpose.`,
    },
  },
  occurrence: {
    description: {
      instructions: `This is an event. Capture the pivotal moment and its impact.`,
    },
  },
  era: {
    description: {
      instructions: `This is a period of time. Convey the spirit of the age.`,
    },
  },
  artifact: {
    description: {
      instructions: `This is an object. Focus on presence and significance.`,
    },
  },
};

// =============================================================================
// Template Building
// =============================================================================

/**
 * Expand a template string with context
 * Supports: {{field}}, {{nested.field}}, {{#array}}...{{/array}}, {{^array}}...{{/array}}
 */
export function expandTemplate(template: string, context: PromptContext): string {
  let result = template;

  // Handle conditionals: {{#field}}content{{/field}} (renders if field is truthy/non-empty)
  result = result.replace(/\{\{#(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, path, content) => {
    const value = getNestedValue(context, path);
    if (value && (!Array.isArray(value) || value.length > 0)) {
      return content;
    }
    return '';
  });

  // Handle inverse conditionals: {{^field}}content{{/field}} (renders if field is falsy/empty)
  result = result.replace(/\{\{\^(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, path, content) => {
    const value = getNestedValue(context, path);
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return content;
    }
    return '';
  });

  // Handle simple variables: {{field}} or {{nested.field}}
  result = result.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = getNestedValue(context, path);
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') {
      return Object.entries(value).map(([k, v]) => `${k}: ${v}`).join(', ');
    }
    return String(value);
  });

  return result.trim();
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let value: unknown = obj;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Format entity tags for prompt inclusion
 */
function formatTags(tags: Record<string, string | number | boolean> | undefined): string {
  if (!tags || Object.keys(tags).length === 0) {
    return '';
  }
  const lines = Object.entries(tags).map(([key, value]) => `- ${key}: ${value}`);
  return `TAGS:\n${lines.join('\n')}`;
}

/**
 * Build the descriptive identity section from culture's descriptiveIdentity
 */
function buildDescriptiveIdentitySection(descriptiveIdentity: Record<string, string> | undefined, culture: string): string {
  if (!descriptiveIdentity || Object.keys(descriptiveIdentity).length === 0) {
    return '';
  }

  const lines = Object.entries(descriptiveIdentity).map(([key, value]) => `- ${key}: ${value}`);
  return `CULTURAL IDENTITY (${culture}):\n${lines.join('\n')}`;
}

/**
 * Build a description prompt from template + context
 */
export function buildDescriptionPrompt(
  template: DescriptionTemplate,
  context: PromptContext,
  descriptiveInfo?: DescriptiveInfo
): string {
  const requiredOutput = `OUTPUT FORMAT (required):
Return JSON only with keys summary, description, aliases, visualThesis, visualTraits.

summary: 1-2 sentences, compressed and faithful to the description.
description: 2-4 sentences, vivid and specific.
aliases: array of alternate names or titles (can be empty).
visualThesis: ONE sentence - the dominant visual signal (must pass silhouette test).
visualTraits: array of 2-4 traits that support and reinforce the thesis.

Summary and description must not contradict; the summary should not add new facts.`;

  if (template.fullTemplate) {
    return [
      expandTemplate(template.fullTemplate, context),
      '',
      requiredOutput,
    ]
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  const e = context.entity.entity;
  const tagsSection = formatTags(e.tags);
  const descriptiveIdentitySection = buildDescriptiveIdentitySection(
    descriptiveInfo?.descriptiveIdentity,
    e.culture
  );

  const parts = [
    `Write a description for ${e.name}, a ${e.subtype} ${e.kind} in ${context.world.name}.`,
    '',
    `WORLD: ${context.world.description}`,
    '',
    'ENTITY:',
    `- Kind: ${e.kind}`,
    `- Subtype: ${e.subtype}`,
    `- Prominence: ${e.prominence}`,
    `- Status: ${e.status}`,
    `- Culture: ${e.culture || 'unaffiliated'}`,
    `- Age in world: ${context.entity.entityAge}`,
    '',
    tagsSection,
    descriptiveIdentitySection,
    '',
    'RELATIONSHIPS:',
    formatRelationships(context.entity.relationships),
    '',
    context.entity.culturalPeers?.length ? `CULTURAL PEERS: ${context.entity.culturalPeers.join(', ')}` : '',
    context.entity.factionMembers?.length ? `FACTION MEMBERS: ${context.entity.factionMembers.join(', ')}` : '',
    '',
    `ERA: ${context.entity.era.name}${context.entity.era.description ? ` - ${context.entity.era.description}` : ''}`,
    '',
    '---',
    '',
    'INSTRUCTIONS:',
    expandTemplate(template.instructions, context),
    '',
    'TONE:',
    expandTemplate(template.tone, context),
    '',
    'CONSTRAINTS:',
    expandTemplate(template.constraints, context),
    '',
    'FORMAT:',
    expandTemplate(template.outputFormat, context),
    '',
    requiredOutput,
  ];

  return parts.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Build the individual traits section from entity's visual traits
 */
function buildIndividualTraitsSection(visualTraits: string[] | undefined): string {
  if (!visualTraits || visualTraits.length === 0) {
    return '';
  }

  const lines = visualTraits.map(trait => `- ${trait}`);
  return `INDIVIDUAL TRAITS (PRIORITY - these define this specific entity):
${lines.join('\n')}`;
}

/**
 * Build the visual thesis section - the PRIMARY visual signal
 */
function buildVisualThesisSection(visualThesis: string | undefined): string {
  if (!visualThesis) {
    return '';
  }
  return `VISUAL THESIS (PRIMARY - this is the dominant visual signal):
${visualThesis}`;
}

/**
 * Build an image prompt from template + context
 *
 * This prompt is sent to Claude for refinement before being sent to an image model.
 * It focuses on visual elements only - narrative context is handled elsewhere.
 *
 * HIERARCHY: Visual Thesis → Supporting Traits → Cultural Identity → Style
 * The thesis is THE identifying feature; everything else supports it.
 */
export function buildImagePrompt(
  template: ImageTemplate,
  context: PromptContext,
  styleInfo?: StyleInfo
): string {
  if (template.fullTemplate) {
    return expandTemplate(template.fullTemplate, context);
  }

  const e = context.entity.entity;
  // Use summary for image prompts (shorter), fall back to description
  const summaryText = e.summary || e.description;

  // Visual thesis - THE primary visual signal (silhouette-testable)
  const visualThesisSection = buildVisualThesisSection(e.visualThesis);

  // Build style sections
  const styleSection = styleInfo?.artisticPromptFragment
    ? `STYLE: ${styleInfo.artisticPromptFragment}`
    : '';

  const colorPaletteSection = styleInfo?.colorPalettePromptFragment
    ? `COLOR PALETTE: ${styleInfo.colorPalettePromptFragment}`
    : '';

  const compositionSection = styleInfo?.compositionPromptFragment
    ? `COMPOSITION: ${styleInfo.compositionPromptFragment}`
    : '';

  // Supporting traits - reinforce the thesis, don't compete with it
  const supportingTraitsSection = e.visualTraits?.length
    ? `SUPPORTING TRAITS (reinforce the thesis):\n${e.visualTraits.map(t => `- ${t}`).join('\n')}`
    : '';

  // Cultural visual identity - shared visual elements
  const visualIdentitySection = buildVisualIdentitySection(styleInfo?.visualIdentity, e.culture);

  // Stylization mandate
  const stylizationSection = 'RENDER: Favor stylized exaggeration over anatomical realism. Push proportions to emphasize the thesis.';

  const parts = [
    // Instructions for Claude (how to build the image prompt)
    `IMAGE INSTRUCTIONS: ${expandTemplate(template.imageInstructions, context)}`,
    '',
    // Subject identification
    `SUBJECT: ${e.name}, a ${e.subtype} ${e.kind}`,
    summaryText ? `CONTEXT: ${summaryText}` : '',
    '',
    // VISUAL HIERARCHY (in priority order)
    visualThesisSection,
    supportingTraitsSection,
    visualIdentitySection,
    '',
    // Visual style settings
    styleSection,
    colorPaletteSection,
    compositionSection,
    stylizationSection,
    '',
    // World context (brief)
    `SETTING: ${context.world.name}`,
    '',
    `AVOID: ${expandTemplate(template.avoidElements, context)}`,
  ];

  return parts.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Chronicle image size to composition hint mapping
 */
const SIZE_COMPOSITION_HINTS: Record<string, string> = {
  small: 'compact vignette, focused detail shot, thumbnail-friendly',
  medium: 'balanced composition, scene establishing shot',
  large: 'dramatic wide shot, environmental storytelling',
  'full-width': 'panoramic vista, epic landscape, sweeping scene',
};

/**
 * Context for building chronicle image prompts
 */
export interface ChronicleImageContext {
  /** LLM-generated scene description */
  sceneDescription: string;
  /** Size hint for composition */
  size: 'small' | 'medium' | 'large' | 'full-width';
  /** Chronicle title for context */
  chronicleTitle?: string;
  /** Primary culture for visual identity */
  culture?: string;
  /** World context */
  world?: {
    name: string;
    description?: string;
    tone?: string;
  };
}

/**
 * Build an image prompt for chronicle scene images
 * Combines scene description with style library and cultural theming
 */
export function buildChronicleImagePrompt(
  context: ChronicleImageContext,
  styleInfo?: StyleInfo
): string {
  const { sceneDescription, size, chronicleTitle, culture, world } = context;

  // Build style section from artistic style
  const styleSection = styleInfo?.artisticPromptFragment
    ? `STYLE: ${styleInfo.artisticPromptFragment}`
    : '';

  // Build color palette section
  const colorPaletteSection = styleInfo?.colorPalettePromptFragment
    ? `COLOR PALETTE: ${styleInfo.colorPalettePromptFragment}`
    : '';

  // Build composition section - prefer explicit style, fall back to size-based hint
  const compositionHint = SIZE_COMPOSITION_HINTS[size] || SIZE_COMPOSITION_HINTS.medium;
  const compositionSection = styleInfo?.compositionPromptFragment
    ? `COMPOSITION: ${styleInfo.compositionPromptFragment}\nSIZE HINT: ${compositionHint}`
    : `COMPOSITION: ${compositionHint}`;

  // Visual identity from culture
  const visualIdentitySection = culture
    ? buildVisualIdentitySection(styleInfo?.visualIdentity, culture)
    : '';

  // Culture keywords
  const cultureSection = styleInfo?.cultureKeywords?.length
    ? `CULTURAL NOTES: ${styleInfo.cultureKeywords.join(', ')}`
    : '';

  // World context
  const worldSection = world
    ? `WORLD: ${world.name}${world.description ? ` - ${world.description}` : ''}${world.tone ? `\nTONE: ${world.tone}` : ''}`
    : '';

  const parts = [
    styleSection,
    colorPaletteSection,
    '',
    `SCENE: ${sceneDescription}`,
    chronicleTitle ? `FROM: "${chronicleTitle}"` : '',
    '',
    worldSection,
    '',
    visualIdentitySection,
    cultureSection,
    '',
    compositionSection,
    '',
    'AVOID: Modern elements, anachronistic technology, text overlays, watermarks',
  ];

  return parts.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Build the visual identity section from culture's visualIdentity
 */
function buildVisualIdentitySection(visualIdentity: Record<string, string> | undefined, culture: string): string {
  if (!visualIdentity || Object.keys(visualIdentity).length === 0) {
    return '';
  }

  const lines = Object.entries(visualIdentity).map(([key, value]) => `- ${key}: ${value}`);
  return `VISUAL IDENTITY (${culture}):\n${lines.join('\n')}`;
}

/**
 * Humanize relationship strength for natural prompt text
 */
function humanizeStrength(strength: number | undefined): 'strong' | 'moderate' | 'weak' {
  if (strength === undefined) return 'moderate';
  if (strength >= 0.7) return 'strong';
  if (strength >= 0.4) return 'moderate';
  return 'weak';
}

function formatRelationships(relationships: ResolvedRelationship[]): string {
  if (!relationships.length) return '(No established relationships)';

  // Categorize by strength
  const strongOrModerate = relationships.filter(r => {
    const strength = humanizeStrength(r.strength);
    return strength === 'strong' || strength === 'moderate';
  });

  // Filter out weak relationships if entity has 5+ strong/moderate ones
  // (keep weak relationships if that's all they have)
  const filtered = strongOrModerate.length >= 5
    ? strongOrModerate
    : relationships;

  return filtered
    .slice(0, 8) // Limit to avoid prompt bloat
    .map(r => {
      let line = `- ${r.kind}: ${r.targetName} (${r.targetKind}`;
      if (r.targetSubtype) line += `/${r.targetSubtype}`;
      line += ')';
      // Use humanized strength instead of raw number
      const strength = humanizeStrength(r.strength);
      line += ` [${strength}]`;
      return line;
    })
    .join('\n');
}

/**
 * Get effective template for an entity kind and culture
 * Merge order: defaults → kind override → culture override
 * (culture overrides are most specific)
 */
export function getEffectiveTemplate(
  templates: PromptTemplates,
  kind: string,
  taskType: 'description' | 'image'
): DescriptionTemplate | ImageTemplate {
  const defaultTemplate = templates.defaults[taskType];
  const kindOverride = templates.byKind[kind]?.[taskType];

  return {
    ...defaultTemplate,
    ...kindOverride,
  } as DescriptionTemplate | ImageTemplate;
}

/**
 * Create default prompt templates
 */
export function createDefaultPromptTemplates(): PromptTemplates {
  return {
    defaults: {
      description: { ...DEFAULT_DESCRIPTION_TEMPLATE },
      image: { ...DEFAULT_IMAGE_TEMPLATE },
    },
    byKind: { ...DEFAULT_KIND_OVERRIDES },
    visualIdentityKeysByKind: {},
    cultureVisualIdentities: {},
    descriptiveIdentityKeysByKind: {},
    cultureDescriptiveIdentities: {},
  };
}

/**
 * Deep merge byKind templates - ensures both description and image sections are preserved
 */
function mergeByKind(
  defaultsByKind: PromptTemplates['byKind'],
  savedByKind: PromptTemplates['byKind'] | undefined
): PromptTemplates['byKind'] {
  if (!savedByKind) return { ...defaultsByKind };

  const result: PromptTemplates['byKind'] = { ...defaultsByKind };

  for (const kind of Object.keys(savedByKind)) {
    const defaultKind = defaultsByKind[kind] || {};
    const savedKind = savedByKind[kind] || {};

    result[kind] = {
      description: { ...defaultKind.description, ...savedKind.description },
      image: { ...defaultKind.image, ...savedKind.image },
    };
  }

  return result;
}

/**
 * Merge saved templates with defaults
 */
export function mergeWithDefaults(
  saved: Partial<PromptTemplates> | null
): PromptTemplates {
  const defaults = createDefaultPromptTemplates();

  if (!saved) {
    return defaults;
  }

  return {
    defaults: {
      description: { ...defaults.defaults.description, ...saved.defaults?.description },
      image: { ...defaults.defaults.image, ...saved.defaults?.image },
    },
    byKind: mergeByKind(defaults.byKind, saved.byKind),
    visualIdentityKeysByKind: {
      ...saved.visualIdentityKeysByKind,
    },
    cultureVisualIdentities: {
      ...saved.cultureVisualIdentities,
    },
    descriptiveIdentityKeysByKind: {
      ...saved.descriptiveIdentityKeysByKind,
    },
    cultureDescriptiveIdentities: {
      ...saved.cultureDescriptiveIdentities,
    },
  };
}

// =============================================================================
// Default World Context (fallback)
// =============================================================================

export const DEFAULT_WORLD_CONTEXT: WorldContext = {
  name: '',
  description: '',
  canonFacts: [],
  tone: undefined,
};

