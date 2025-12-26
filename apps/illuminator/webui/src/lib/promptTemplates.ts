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
    description: string;        // Existing description (if any)
    tags: Record<string, string | number | boolean>;
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
  /** Mood guidance based on entity status and relationships */
  mood: string;
  /** Elements to avoid in the image */
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

Work WITH the existing description if present, expanding rather than replacing.
Don't invent major relationships not implied by the data - the relationships provided are canonical.`,

  outputFormat: `2-3 sentences. Dense with meaning, grounded in specifics. Name at least one relationship or cultural detail when relevant.`,
};

export const DEFAULT_IMAGE_TEMPLATE: ImageTemplate = {
  mood: `Reflect the entity's current status ({{entity.status}}) and relationships. If they have rivals, perhaps tension in posture. If allied with a powerful faction, confidence. If ancient, gravitas.`,

  avoidElements: `Generic fantasy tropes unless they fit {{world.name}}. No modern elements. No contradicting the entity's established cultural identity.`,
};


// =============================================================================
// Kind-Specific Overrides
// =============================================================================

export const DEFAULT_KIND_OVERRIDES: PromptTemplates['byKind'] = {
  npc: {
    description: {
      instructions: `This is a character in {{world.name}}. Focus on what makes them distinctive as a person.

Their relationships define them:
{{#relationships}}
- {{kind}} {{targetName}} ({{targetKind}})
{{/relationships}}

Show personality through specifics - how they move, speak, what they care about. Their {{entity.subtype}} role shapes their worldview. Their {{entity.prominence}} status affects how others see them.

{{#culturalPeers.length}}They exist alongside other {{entity.culture}} figures like {{culturalPeers}}.{{/culturalPeers.length}}`,
    },
  },

  location: {
    description: {
      instructions: `This is a place in {{world.name}}. Evoke the sensory experience of being here.

What entities are connected to this location?
{{#relationships}}
- {{kind}}: {{targetName}}
{{/relationships}}

Consider: What activities happen here? Who controls or claims it? What's the atmosphere - welcoming, dangerous, sacred, mundane? The {{entity.prominence}} level suggests how well-known or hidden it is.`,
    },
  },

  faction: {
    description: {
      instructions: `This is an organization/group in {{world.name}}. Focus on collective identity and purpose.

Key relationships:
{{#relationships}}
- {{kind}}: {{targetName}} ({{targetKind}})
{{/relationships}}

What unites members? What do outsiders think of them? Their {{entity.prominence}} reflects their influence. Their {{entity.status}} shows their current state.

{{#factionMembers.length}}Notable members include: {{factionMembers}}{{/factionMembers.length}}`,
    },
  },

  occurrence: {
    description: {
      instructions: `This is an event in {{world.name}}. Capture the pivotal moment and its impact.

Entities involved:
{{#relationships}}
- {{kind}}: {{targetName}}
{{/relationships}}

What happened? Who was changed by it? The {{entity.prominence}} indicates historical significance. As an {{entityAge}} event, how present is it in memory?`,
    },
    image: {
      mood: `Match the nature of the event - triumphant, tragic, mysterious, transformative. The viewer should feel like they're witnessing history.`,
    },
  },

  era: {
    description: {
      instructions: `This is a period of time in {{world.name}}. Convey the spirit of the age.

What defined this era? What tensions or transformations characterized it? The {{entity.subtype}} tells us what kind of period this was.

Key elements of this era:
{{#relationships}}
- {{kind}}: {{targetName}}
{{/relationships}}`,
    },
  },

  artifact: {
    description: {
      instructions: `This is an object/item in {{world.name}}. Focus on presence and significance.

Who or what is connected to this artifact?
{{#relationships}}
- {{kind}}: {{targetName}}
{{/relationships}}

What does it look like? How does it feel to encounter? What's its history, purpose, cost? The {{entity.prominence}} suggests how famous or obscure it is.`,
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
  if (template.fullTemplate) {
    return expandTemplate(template.fullTemplate, context);
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
    e.description ? `- Existing description: ${e.description}` : '',
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
  ];

  return parts.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Build an image prompt from template + context
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
  // Use enriched description if available (from multishot prompting), fall back to original
  const enrichedDesc = (context.entity as { enrichedDescription?: string }).enrichedDescription;
  const descriptionText = enrichedDesc || e.description;

  // Build sections
  const styleSection = styleInfo?.artisticPromptFragment
    ? `STYLE: ${styleInfo.artisticPromptFragment}`
    : '';

  const compositionSection = styleInfo?.compositionPromptFragment
    ? `COMPOSITION: ${styleInfo.compositionPromptFragment}`
    : '';

  const visualIdentitySection = buildVisualIdentitySection(styleInfo?.visualIdentity, e.culture);
  const tagsSection = formatTags(e.tags);

  const parts = [
    styleSection,
    '',
    `SUBJECT: ${e.name}, a ${e.subtype} ${e.kind}`,
    descriptionText ? `DESCRIPTION: ${descriptionText}` : '',
    '',
    `WORLD: ${context.world.name} - ${context.world.description}`,
    context.world.tone ? `TONE: ${context.world.tone}` : '',
    '',
    visualIdentitySection,
    tagsSection,
    styleInfo?.cultureKeywords?.length ? `CULTURAL NOTES: ${styleInfo.cultureKeywords.join(', ')}` : '',
    `STATUS: ${e.status} | PROMINENCE: ${e.prominence}`,
    context.entity.relationships.length ? `KEY RELATIONSHIPS: ${context.entity.relationships.slice(0, 3).map(r => `${r.kind} ${r.targetName}`).join(', ')}` : '',
    '',
    compositionSection,
    '',
    `MOOD: ${expandTemplate(template.mood, context)}`,
    '',
    `AVOID: ${expandTemplate(template.avoidElements, context)}`,
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

function formatRelationships(relationships: ResolvedRelationship[]): string {
  if (!relationships.length) return '(No established relationships)';

  return relationships
    .slice(0, 8) // Limit to avoid prompt bloat
    .map(r => {
      let line = `- ${r.kind}: ${r.targetName} (${r.targetKind}`;
      if (r.targetSubtype) line += `/${r.targetSubtype}`;
      line += ')';
      if (r.strength !== undefined) line += ` [strength: ${r.strength.toFixed(2)}]`;
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
    byKind: {
      ...defaults.byKind,
      ...saved.byKind,
    },
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

