/**
 * Style Library Types
 *
 * Defines artistic styles, composition styles for image generation,
 * and narrative styles for chronicle generation.
 * Styles are stored in project config and referenced by cultures for defaults.
 */

import type { EntityCategory } from './entityKind.js';

/**
 * Artistic style - defines the visual rendering approach
 */
export interface ArtisticStyle {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Prompt fragment for artistic direction (injected into image prompt) */
  promptFragment: string;
  /** Additional keywords for the style */
  keywords?: string[];
}

/**
 * Composition style - defines framing and visual arrangement
 */
export interface CompositionStyle {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Prompt fragment for composition (injected into image prompt) */
  promptFragment: string;
}

/**
 * Color palette - defines color direction for image generation
 */
export interface ColorPalette {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Prompt fragment for color direction (injected into image prompt) */
  promptFragment: string;
}

// =============================================================================
// Narrative Style Types (for chronicle generation)
// =============================================================================

/**
 * Plot structure types - different narrative frameworks
 */
export type PlotStructureType =
  | 'three-act'        // Classic: inciting → rising → climax → resolution
  | 'episodic'         // Vignettes loosely connected by theme/character
  | 'mystery-reveal'   // Question → clues → false leads → revelation
  | 'rise-and-fall'    // Ascent → hubris → downfall → aftermath
  | 'circular'         // Ends where it began, transformed understanding
  | 'parallel'         // Two storylines that intersect
  | 'in-medias-res'    // Start at climax, flashback, return to present
  | 'accumulating';    // Small events build to inevitable conclusion

/**
 * Plot structure definition - replaces hardcoded 3-act structure
 */
export interface PlotStructure {
  /** Structure type identifier */
  type: PlotStructureType;
  /** Instructions for LLM on how to use this structure */
  instructions: string;
}

/**
 * Role definition for entity casting
 */
export interface RoleDefinition {
  /** Role identifier (e.g., 'protagonist', 'love-interest', 'schemer') */
  role: string;
  /** How many entities can fill this role */
  count: { min: number; max: number };
  /** Description of this role for the LLM */
  description: string;
  /** Optional criteria for selecting entities */
  selectionCriteria?: string;
}

/**
 * Entity selection rules - who gets featured in the story
 */
export interface EntitySelectionRules {
  /**
   * Recommended entity categories for primary subjects (main characters).
   * At runtime, resolved to entity kinds via domain schema category mappings.
   */
  primarySubjectCategories?: EntityCategory[];
  /**
   * Recommended entity categories for supporting subjects (secondary characters).
   * At runtime, resolved to entity kinds via domain schema category mappings.
   */
  supportingSubjectCategories?: EntityCategory[];
  /** Roles available in this narrative style */
  roles: RoleDefinition[];
  /** Maximum cast size */
  maxCastSize: number;
}

/**
 * Event selection rules - what events to include
 */
export interface EventSelectionRules {
  /** Significance range (0.0-1.0) */
  significanceRange: { min: number; max: number };
  /** Event kinds to prioritize */
  priorityKinds?: string[];
  /** Event kinds to exclude */
  excludeKinds?: string[];
  /** Tags to filter for */
  priorityTags?: string[];
  /** Maximum events to include */
  maxEvents: number;
  /** Instructions for how to use events */
  usageInstructions: string;
}

/**
 * Scene template - defines a type of scene
 */
export interface SceneTemplate {
  /** Template identifier */
  id: string;
  /** Display name */
  name: string;
  /** When this scene type is appropriate */
  purpose: string;
  /** Elements that must appear */
  requiredElements: string[];
  /** Emotional direction */
  emotionalArc: string;
}

/**
 * World data focus - what non-entity data to include
 */
export interface WorldDataFocus {
  /** Include location descriptions */
  includeLocations: boolean;
  locationUsage?: string;
  /** Include artifacts/objects */
  includeArtifacts: boolean;
  artifactUsage?: string;
  /** Include cultural practices */
  includeCulturalPractices: boolean;
  culturalUsage?: string;
  /** Include era atmosphere */
  includeEraContext: boolean;
  eraUsage?: string;
}

/**
 * Prose directives - writing style guidance
 */
export interface ProseDirectives {
  /** Tone keywords */
  toneKeywords: string[];
  /** Dialogue style guidance */
  dialogueStyle: string;
  /** Description style guidance */
  descriptionStyle: string;
  /** Pacing notes */
  pacingNotes: string;
  /** Things to avoid */
  avoid: string[];
  /** Example prose snippet */
  exampleProse?: string;
}

/**
 * Pacing configuration
 */
export interface PacingConfig {
  /** Target total word count */
  totalWordCount: { min: number; max: number };
  /** Number of scenes */
  sceneCount: { min: number; max: number };
}

// =============================================================================
// Document Format Types (for non-story narrative styles)
// =============================================================================

/**
 * Section template for document-based styles
 */
export interface DocumentSection {
  /** Section identifier */
  id: string;
  /** Section name/heading */
  name: string;
  /** Purpose of this section */
  purpose: string;
  /** Target word count for this section */
  wordCountTarget?: number;
  /** Content guidance for LLM */
  contentGuidance: string;
  /** Whether this section is optional */
  optional?: boolean;
}

/**
 * Configuration for document-based narrative styles
 * Used for in-universe documents like news articles, treaties, letters, etc.
 */
export interface DocumentConfig {
  /** Type of document (shown to LLM for context) */
  documentType: string;
  /** High-level instructions for content generation */
  contentInstructions: string;
  /** Section templates */
  sections: DocumentSection[];
  /** Target word count */
  wordCount: { min: number; max: number };
  /** Tone and style keywords */
  toneKeywords: string[];
  /** Elements to include */
  include: string[];
  /** Things to avoid */
  avoid: string[];
  /** How to use entity data */
  entityUsage?: string;
  /** How to use event data */
  eventUsage?: string;
  /** Voice/perspective guidance */
  voice?: string;
}

/**
 * Narrative format type - distinguishes stories from documents
 */
export type NarrativeFormat = 'story' | 'document';

/**
 * Narrative style - comprehensive configuration for chronicle generation
 * Supports both traditional stories and in-universe document formats
 */
export interface BaseNarrativeStyle {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description shown in UI */
  description: string;
  /** Tags for categorization */
  tags?: string[];
  /** Entity selection rules */
  entityRules: EntitySelectionRules;
  /** Event selection rules */
  eventRules: EventSelectionRules;
}

export interface StoryNarrativeStyle extends BaseNarrativeStyle {
  format: 'story';
  /** Plot structure configuration */
  plotStructure: PlotStructure;
  /** Available scene templates */
  sceneTemplates: SceneTemplate[];
  /** Pacing configuration */
  pacing: PacingConfig;
  /** Prose writing directives */
  proseDirectives: ProseDirectives;
  /** World data focus */
  worldDataFocus?: WorldDataFocus;
}

export interface DocumentNarrativeStyle extends BaseNarrativeStyle {
  format: 'document';
  /** Document-based generation config */
  documentConfig: DocumentConfig;
}

export type NarrativeStyle = StoryNarrativeStyle | DocumentNarrativeStyle;

/**
 * Style library - collection of available styles
 */
export interface StyleLibrary {
  artisticStyles: ArtisticStyle[];
  compositionStyles: CompositionStyle[];
  colorPalettes: ColorPalette[];
  narrativeStyles: NarrativeStyle[];
}

/**
 * Style selection for image generation
 */
export interface StyleSelection {
  /** Selected artistic style ID, 'random' for random selection, or 'culture-default' to use culture's default */
  artisticStyleId?: string;
  /** Selected composition style ID, 'random' for random selection, or 'culture-default' to use culture's default */
  compositionStyleId?: string;
  /** Selected color palette ID, or 'random' for random selection */
  colorPaletteId?: string;
}

// =============================================================================
// Default Styles (built-in)
// =============================================================================

export const DEFAULT_ARTISTIC_STYLES: ArtisticStyle[] = [
  {
    id: 'oil-painting',
    name: 'Oil Painting',
    description: 'Classical oil painting with rich textures',
    promptFragment: 'oil painting style, rich textures, visible brushstrokes, painterly, classical technique',
    keywords: ['traditional', 'classical', 'painterly'],
  },
  {
    id: 'watercolor',
    name: 'Watercolor',
    description: 'Soft watercolor with fluid washes',
    promptFragment: 'watercolor style, soft edges, fluid washes, delicate, translucent layers',
    keywords: ['soft', 'fluid', 'delicate'],
  },
  {
    id: 'digital-art',
    name: 'Digital Art',
    description: 'Modern digital concept art',
    promptFragment: 'digital concept art, clean lines, vibrant colors, polished, professional illustration',
    keywords: ['modern', 'clean', 'polished'],
  },
  {
    id: 'sketch',
    name: 'Pencil Sketch',
    description: 'Detailed pencil or charcoal sketch',
    promptFragment: 'pencil sketch, detailed linework, crosshatching, graphite, artistic study',
    keywords: ['linework', 'sketch', 'monochrome'],
  },
  {
    id: 'fantasy-illustration',
    name: 'Fantasy Illustration',
    description: 'Classic fantasy book illustration style',
    promptFragment: 'fantasy book illustration, detailed, dramatic lighting, rich colors, epic scope',
    keywords: ['fantasy', 'dramatic', 'detailed'],
  },
  {
    id: 'pixel-art',
    name: 'Pixel Art',
    description: 'Retro pixel art style',
    promptFragment: 'pixel art style, retro, limited palette, 16-bit aesthetic, crisp pixels',
    keywords: ['retro', 'pixel', '16-bit'],
  },
  {
    id: 'art-nouveau',
    name: 'Art Nouveau',
    description: 'Elegant Art Nouveau decorative style',
    promptFragment: 'art nouveau style, elegant flowing lines, decorative, organic forms, ornamental',
    keywords: ['decorative', 'elegant', 'ornamental'],
  },
  {
    id: 'impressionist',
    name: 'Impressionist',
    description: 'Light-focused impressionist style',
    promptFragment: 'impressionist style, visible brushstrokes, light and color emphasis, atmospheric',
    keywords: ['atmospheric', 'light', 'expressive'],
  },
];

export const DEFAULT_COMPOSITION_STYLES: CompositionStyle[] = [
  {
    id: 'portrait',
    name: 'Portrait',
    description: 'Head and shoulders portrait',
    promptFragment: 'portrait composition, head and shoulders, focused on face, eye contact',
  },
  {
    id: 'full-body',
    name: 'Full Body',
    description: 'Full figure standing pose',
    promptFragment: 'full body view, character standing, showing attire and posture, clear silhouette',
  },
  {
    id: 'bust',
    name: 'Bust',
    description: 'Upper body portrait with more context',
    promptFragment: 'bust composition, upper body visible, showing costume details, medium shot',
  },
  {
    id: 'establishing-shot',
    name: 'Establishing Shot',
    description: 'Wide environmental shot',
    promptFragment: 'wide establishing shot, environmental storytelling, sense of scale, cinematic',
  },
  {
    id: 'logo-mark',
    name: 'Logo Mark',
    description: 'Iconic emblem or brand mark for factions and organizations',
    promptFragment: 'logo design, iconic emblem, clean geometric shapes, centered composition, flat colors, negative space, scalable vector style, brand identity, minimal',
  },
  {
    id: 'badge-crest',
    name: 'Badge Crest',
    description: 'Heraldic crest or insignia in a badge form',
    promptFragment: 'heraldic emblem, crest design, symmetrical composition, iconic symbol, shield or banner form, unified color palette, insignia',
  },
  {
    id: 'chronicle-panorama',
    name: 'Chronicle Panorama',
    description: 'Panoramic scene for chronicle headings',
    promptFragment: 'panoramic scene, sweeping vista, layered depth, cinematic horizon, spacious composition, chapter heading framing',
  },
  {
    id: 'interior',
    name: 'Interior View',
    description: 'Interior space with atmosphere',
    promptFragment: 'interior view, atmospheric lighting, detailed environment, lived-in feeling',
  },
  {
    id: 'aerial',
    name: 'Aerial View',
    description: 'Bird\'s eye view from above',
    promptFragment: 'aerial view, bird\'s eye perspective, showing layout and scope',
  },
  {
    id: 'group-scene',
    name: 'Group Scene',
    description: 'Multiple figures in composition',
    promptFragment: 'group composition, multiple figures, unified aesthetic, collective identity',
  },
  {
    id: 'symbolic',
    name: 'Symbolic',
    description: 'Allegorical or symbolic representation',
    promptFragment: 'symbolic representation, iconographic, allegorical, conceptual',
  },
  {
    id: 'action',
    name: 'Action Scene',
    description: 'Dynamic action moment',
    promptFragment: 'dynamic action pose, motion blur, dramatic angle, tension, movement',
  },
  {
    id: 'action-duel',
    name: 'Action: Duel',
    description: 'Focused one-on-one combat or standoff',
    promptFragment: 'dynamic duel, close-quarters combat, two figures in motion, dramatic tension, focused framing',
  },
  {
    id: 'action-chase',
    name: 'Action: Chase',
    description: 'High-speed pursuit with strong motion',
    promptFragment: 'high-speed chase, motion blur, strong leading lines, sense of pursuit, dynamic perspective',
  },
  {
    id: 'action-battle',
    name: 'Action: Battle',
    description: 'Large-scale clash with multiple combatants',
    promptFragment: 'chaotic battle scene, multiple figures, sweeping movement, dust and debris, wide dynamic composition',
  },
  {
    id: 'object-study',
    name: 'Object Study',
    description: 'Focused object with dramatic lighting',
    promptFragment: 'object study, dramatic lighting, showing scale and detail, museum quality',
  },
];

export const DEFAULT_COLOR_PALETTES: ColorPalette[] = [
  {
    id: 'warm-earth',
    name: 'Warm Earth',
    description: 'Rich browns, terracotta, amber, and gold',
    promptFragment: 'COLOR PALETTE: warm earth tones, rich browns, terracotta orange, amber gold, ochre yellow, sienna accents',
  },
  {
    id: 'jewel-tones',
    name: 'Jewel Tones',
    description: 'Deep saturated colors like ruby, emerald, sapphire',
    promptFragment: 'COLOR PALETTE: jewel tones, deep ruby red, emerald green, sapphire blue, amethyst purple, rich saturated colors',
  },
  {
    id: 'sunset-fire',
    name: 'Sunset Fire',
    description: 'Fiery oranges, reds, and magentas',
    promptFragment: 'COLOR PALETTE: sunset colors, fiery orange, crimson red, magenta pink, golden yellow, warm gradients',
  },
  {
    id: 'forest-moss',
    name: 'Forest Moss',
    description: 'Deep greens, browns, and golden highlights',
    promptFragment: 'COLOR PALETTE: forest tones, deep moss green, olive, warm brown, golden highlights, natural woodland colors',
  },
  {
    id: 'ocean-depths',
    name: 'Ocean Depths',
    description: 'Teals, navy blues, and bioluminescent accents',
    promptFragment: 'COLOR PALETTE: ocean depths, teal blue, deep navy, bioluminescent cyan, coral pink accents, aquatic colors',
  },
  {
    id: 'desert-sand',
    name: 'Desert Sand',
    description: 'Warm beiges, dusty rose, and copper accents',
    promptFragment: 'COLOR PALETTE: desert tones, warm sand beige, dusty rose, copper accents, burnt orange, sun-bleached colors',
  },
  {
    id: 'autumn-harvest',
    name: 'Autumn Harvest',
    description: 'Rich reds, burnt oranges, and golden yellows',
    promptFragment: 'COLOR PALETTE: autumn colors, burnt orange, russet red, golden yellow, deep burgundy, harvest tones',
  },
  {
    id: 'twilight-purple',
    name: 'Twilight Purple',
    description: 'Deep purples, magentas, and pink highlights',
    promptFragment: 'COLOR PALETTE: twilight colors, deep purple, magenta, lavender, pink highlights, dusky violet tones',
  },
  {
    id: 'spring-bloom',
    name: 'Spring Bloom',
    description: 'Fresh greens, soft pinks, and pale yellows',
    promptFragment: 'COLOR PALETTE: spring colors, fresh green, soft pink, pale yellow, white blossoms, pastel accents',
  },
  {
    id: 'volcanic',
    name: 'Volcanic',
    description: 'Black rock, molten orange, and red ember glows',
    promptFragment: 'COLOR PALETTE: volcanic colors, black basalt, molten orange, ember red, ash gray, lava glow accents',
  },
  {
    id: 'royal-gold',
    name: 'Royal Gold',
    description: 'Rich golds, deep reds, and royal purple',
    promptFragment: 'COLOR PALETTE: royal colors, rich gold, deep crimson, royal purple, bronze accents, regal tones',
  },
  {
    id: 'storm-gray',
    name: 'Storm Gray',
    description: 'Dramatic grays with electric blue and silver accents',
    promptFragment: 'COLOR PALETTE: storm colors, slate gray, charcoal, electric blue accents, silver highlights, dramatic contrast',
  },
  {
    id: 'copper-verdigris',
    name: 'Copper Verdigris',
    description: 'Oxidized copper greens with warm copper tones',
    promptFragment: 'COLOR PALETTE: patina colors, verdigris green, oxidized copper, warm bronze, teal accents, aged metal tones',
  },
  {
    id: 'blood-and-bone',
    name: 'Blood and Bone',
    description: 'Deep reds, ivory whites, and black accents',
    promptFragment: 'COLOR PALETTE: stark contrast, deep blood red, ivory bone white, onyx black, crimson accents',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Shimmering greens, purples, and cyan against dark sky',
    promptFragment: 'COLOR PALETTE: aurora borealis, shimmering green, purple, cyan, pink ribbons against deep blue-black sky',
  },
];

// =============================================================================
// Default Narrative Styles (for chronicle generation)
// =============================================================================

export const DEFAULT_NARRATIVE_STYLES: NarrativeStyle[] = [
  // 1. EPIC DRAMA
  {
    id: 'epic-drama',
    name: 'Epic Drama',
    description: 'Grand, sweeping narratives with world-shaking stakes and fateful confrontations',
    tags: ['dramatic', 'high-stakes', 'grand'],
    format: 'story',
    plotStructure: {
      type: 'three-act',
      instructions: `Structure this as an epic historical drama with the weight of myth. The narrative should feel like a chronicle being told by future generations who already know how it ends.

Opening: Begin in medias res or with an ominous portent. Establish the world through sensory details that convey both grandeur and fragility. The protagonist should be shown in their element, but seeds of the coming conflict must already be visible.

Rising Action: Each scene escalates the stakes. Introduce the opposing force not as simple villainy but as an equally valid worldview in collision. Show councils where fate is debated, alliances forged and broken. Every conversation should carry subtext of what's unsaid.

Climax: The confrontation should feel inevitable yet still surprising. Physical and ideological battles interweave. There must be a moment of apparent defeat before the turn. The cost of victory should be visible.

Resolution: Don't tie everything up. Show the new order taking shape while acknowledging what was lost. End with an image that could become legend.

Tone: Formal but not stiff. Characters speak with weight because they know they're living in consequential times. Descriptions should evoke oil paintings - rich, saturated, composed.`,
    },
    entityRules: {
      primarySubjectCategories: ['character', 'collective', 'power', 'concept'],
      supportingSubjectCategories: ['character', 'collective', 'place', 'object'],
      roles: [
        { role: 'protagonist', count: { min: 1, max: 1 }, description: 'The central force - a hero, rising faction, awakening power, or transformative idea' },
        { role: 'antagonist', count: { min: 1, max: 1 }, description: 'The opposing force - a villain, rival power, dying order, or threatening ideology' },
        { role: 'catalyst', count: { min: 0, max: 1 }, description: 'What triggers the conflict - an artifact discovered, power awakened, or event occurred' },
        { role: 'stakes', count: { min: 0, max: 2 }, description: 'What hangs in the balance - territories, traditions, treasures, or peoples' },
        { role: 'witness', count: { min: 1, max: 2 }, description: 'Those who observe and will tell this tale to future generations' },
      ],
      maxCastSize: 7,
    },
    eventRules: {
      significanceRange: { min: 0.7, max: 1.0 },
      priorityKinds: ['era_transition', 'entity_lifecycle', 'succession'],
      priorityTags: ['war', 'death', 'coronation', 'betrayal', 'alliance'],
      maxEvents: 12,
      usageInstructions: 'These are the turning points of history. Each event should feel inevitable in retrospect, part of a grand design.',
    },
    sceneTemplates: [
      { id: 'omen', name: 'The Omen', purpose: 'Foreshadow what is to come', requiredElements: ['prophecy or sign', 'unease', 'dismissal by some'], emotionalArc: 'unease → dread' },
      { id: 'council', name: 'The Council', purpose: 'Forces align and plans are made', requiredElements: ['multiple powers', 'conflicting agendas', 'fateful decision'], emotionalArc: 'tension → resolution → new tension' },
      { id: 'confrontation', name: 'The Confrontation', purpose: 'Direct clash of opposing forces', requiredElements: ['physical or ideological battle', 'cost', 'transformation'], emotionalArc: 'defiance → struggle → outcome' },
      { id: 'aftermath', name: 'The Aftermath', purpose: 'Reckon with what has changed', requiredElements: ['loss acknowledged', 'new order glimpsed', 'price named'], emotionalArc: 'grief → acceptance → resolve' },
    ],
    pacing: {
      totalWordCount: { min: 1800, max: 2500 },
      sceneCount: { min: 4, max: 5 },
    },
    proseDirectives: {
      toneKeywords: ['weighty', 'fateful', 'grand', 'inevitable', 'mythic'],
      dialogueStyle: 'Formal, declarative. Characters speak as if their words will be remembered. Avoid modern idioms.',
      descriptionStyle: 'Sweeping and atmospheric. Landscapes reflect emotional states. Use long sentences for grandeur.',
      pacingNotes: 'Deliberate pacing with moments of stillness before action. Let scenes breathe.',
      avoid: ['humor that undercuts tension', 'mundane details', 'anticlimactic resolutions', 'modern language'],
    },
    worldDataFocus: {
      includeLocations: true,
      locationUsage: 'Locations are stages of history. Describe them as places where fate will be decided.',
      includeArtifacts: true,
      artifactUsage: 'Objects of power that symbolize what is at stake.',
      includeCulturalPractices: true,
      culturalUsage: 'Rituals and customs that root the grand events in lived tradition.',
      includeEraContext: true,
      eraUsage: 'The era defines what kind of world will emerge from this crucible.',
    },
  },

  // 2. ACTION ADVENTURE
  {
    id: 'action-adventure',
    name: 'Action Adventure',
    description: 'Fast-paced, kinetic narratives driven by physical conflict, chases, and daring escapes',
    tags: ['action', 'fast-paced', 'thrilling'],
    format: 'story',
    plotStructure: {
      type: 'in-medias-res',
      instructions: `This is pure kinetic storytelling. The reader should be breathless.

Opening: Drop into action already happening. No setup, no backstory dump. The situation explains itself through urgent choices and physical details. A chase, a fight, a desperate escape - the reader figures out why as they go.

Momentum: Never let the reader settle. Each scene ends with a new complication. The protagonist survives one threat only to face another. Quiet moments are brief - a breath before the next wave. Even dialogue happens while doing something else.

Environment as Character: The setting isn't backdrop - it's obstacle and opportunity. Characters interact with their physical space constantly: using terrain, improvising weapons, exploiting weaknesses in architecture.

Climax: The biggest, most desperate confrontation. Everything learned through the story becomes relevant. The protagonist must use their wits and their body at their limits.

Resolution: Brief. The dust settles. We see the cost on the protagonist's body and face. Maybe a hint of what comes next, but the immediate crisis is resolved.

Style: Short sentences during action. Visceral, physical language. We feel impacts, heat, cold, exhaustion. No time for reflection - only reaction.`,
    },
    entityRules: {
      primarySubjectCategories: ['character', 'object'],
      supportingSubjectCategories: ['character', 'place', 'power'],
      roles: [
        { role: 'hero', count: { min: 1, max: 2 }, description: 'The one who acts - daring, resourceful, driven' },
        { role: 'threat', count: { min: 1, max: 1 }, description: 'What must be overcome - villain, hostile force, or dangerous power' },
        { role: 'objective', count: { min: 0, max: 1 }, description: 'The goal of the chase - artifact sought, place to reach, person to save' },
        { role: 'obstacle', count: { min: 0, max: 2 }, description: 'What blocks the path - treacherous terrain, rival, or wild power' },
      ],
      maxCastSize: 6,
    },
    eventRules: {
      significanceRange: { min: 0.5, max: 1.0 },
      priorityKinds: ['entity_lifecycle', 'succession', 'coalescence'],
      priorityTags: ['combat', 'chase', 'escape', 'confrontation', 'pursuit'],
      maxEvents: 15,
      usageInstructions: 'Chain these events into action sequences. Each event should force immediate reaction, not reflection.',
    },
    sceneTemplates: [
      { id: 'cold-open', name: 'Cold Open', purpose: 'Immediate danger, no setup', requiredElements: ['action in progress', 'stakes clear through context', 'physical threat'], emotionalArc: 'adrenaline → brief relief' },
      { id: 'pursuit', name: 'The Pursuit', purpose: 'Extended chase sequence', requiredElements: ['constant movement', 'obstacles', 'near misses'], emotionalArc: 'tension → escalation → narrow escape' },
      { id: 'confrontation', name: 'Showdown', purpose: 'Direct physical conflict', requiredElements: ['matched opponents', 'environment as weapon', 'decisive moment'], emotionalArc: 'clash → struggle → victory or defeat' },
      { id: 'escape', name: 'The Escape', purpose: 'Getting away against odds', requiredElements: ['closing window', 'improvisation', 'cost of escape'], emotionalArc: 'desperation → ingenuity → relief' },
    ],
    pacing: {
      totalWordCount: { min: 1500, max: 2000 },
      sceneCount: { min: 4, max: 6 },
    },
    proseDirectives: {
      toneKeywords: ['kinetic', 'urgent', 'visceral', 'breathless', 'sharp'],
      dialogueStyle: 'Clipped, functional. Characters speak while doing. No speeches.',
      descriptionStyle: 'Motion-focused. Short sentences. Active verbs. Sensory impact.',
      pacingNotes: 'Never slow down for more than a paragraph. If exposition needed, deliver it while something is happening.',
      avoid: ['long descriptions', 'internal monologue', 'philosophical reflection', 'scenes of people just talking'],
    },
    worldDataFocus: {
      includeLocations: true,
      locationUsage: 'Locations are obstacle courses and arenas. What can be climbed, broken, used as cover?',
      includeArtifacts: true,
      artifactUsage: 'Objects are tools and weapons. What can be grabbed, thrown, wielded?',
      includeCulturalPractices: false,
      includeEraContext: false,
    },
  },

  // 3. ROMANCE
  {
    id: 'romance',
    name: 'Romance',
    description: 'Character-driven narratives centered on emotional bonds, longing, and connection',
    tags: ['romantic', 'emotional', 'character-driven'],
    format: 'story',
    plotStructure: {
      type: 'three-act',
      instructions: `This is an intimate story about connection. The external world exists only to illuminate the internal journey of two people finding each other.

The Meeting: This must feel fated even when it appears accidental. Show what each character lacks that the other has. Their first impression should be incomplete, perhaps even wrong - but something catches. A detail they can't stop thinking about.

Growing Close: This is the heart of the story. Show them discovering each other through accumulating small moments. Vulnerability exchanged for vulnerability. Laughter that surprises them. Silences that feel comfortable. Physical proximity that becomes electric.

The Obstacle: What threatens them should feel real and earned. Internal barriers (fear, duty, old wounds) are often more powerful than external ones. The obstacle should make us understand why they can't just be together, even as we ache for them to try.

Declaration: The moment of truth. One or both must risk rejection by speaking honestly. The response matters less than the courage of exposure. Even if things work out, there should be acknowledgment of what it cost to get here.

Sensory Details: Romance lives in specifics. The exact shade of light. How someone's hand feels. The particular quality of a laugh. Avoid generic beauty - find what makes these specific people beautiful to each other.`,
    },
    entityRules: {
      primarySubjectCategories: ['character', 'collective'],
      supportingSubjectCategories: ['character', 'collective', 'place', 'concept'],
      roles: [
        { role: 'lover-a', count: { min: 1, max: 1 }, description: 'First romantic lead - heart of the connection' },
        { role: 'lover-b', count: { min: 1, max: 1 }, description: 'Second romantic lead - the other half' },
        { role: 'obstacle', count: { min: 0, max: 2 }, description: 'What keeps them apart - rival, tradition, faction loyalty, or duty' },
        { role: 'sanctuary', count: { min: 0, max: 1 }, description: 'Where connection is possible - secret place, shared memory, neutral ground' },
      ],
      maxCastSize: 5,
    },
    eventRules: {
      significanceRange: { min: 0.3, max: 0.8 },
      priorityKinds: ['relationship_dissolved', 'state_change'],
      priorityTags: ['romance', 'betrayal', 'alliance', 'family', 'marriage'],
      excludeKinds: ['era_transition'],
      maxEvents: 10,
      usageInstructions: 'Events are catalysts for emotional change. What matters is how characters feel about what happens, not the events themselves.',
    },
    sceneTemplates: [
      { id: 'meeting', name: 'The Meeting', purpose: 'Establish the spark', requiredElements: ['first impression', 'unexpected connection', 'lingering thought'], emotionalArc: 'curiosity → intrigue → remembering' },
      { id: 'growing-close', name: 'Growing Closer', purpose: 'Deepen the bond', requiredElements: ['vulnerability shared', 'laughter or tears', 'physical proximity'], emotionalArc: 'guardedness → opening up → fear of loss' },
      { id: 'obstacle', name: 'The Obstacle', purpose: 'Threaten the connection', requiredElements: ['external force or internal flaw', 'misunderstanding or duty', 'painful choice'], emotionalArc: 'hope → dread → resignation or defiance' },
      { id: 'declaration', name: 'The Declaration', purpose: 'Truth spoken aloud', requiredElements: ['risk of rejection', 'honesty', 'response'], emotionalArc: 'fear → exposure → answer' },
    ],
    pacing: {
      totalWordCount: { min: 1400, max: 1800 },
      sceneCount: { min: 4, max: 5 },
    },
    proseDirectives: {
      toneKeywords: ['tender', 'yearning', 'intimate', 'bittersweet', 'hopeful'],
      dialogueStyle: 'Subtext-heavy. What is not said matters. Silences speak.',
      descriptionStyle: 'Intimate focus. Body language, small gestures, what the eyes do.',
      pacingNotes: 'Slow build. Let tension accumulate. Moments of stillness are powerful.',
      avoid: ['graphic content', 'rushed emotional development', 'love at first sight without complication', 'external plot overwhelming relationship'],
    },
    worldDataFocus: {
      includeLocations: true,
      locationUsage: 'Places where they meet, where they remember, where they cannot be together.',
      includeArtifacts: true,
      artifactUsage: 'Objects that carry memory and meaning. Gifts, keepsakes, symbols.',
      includeCulturalPractices: true,
      culturalUsage: 'Customs that constrain or enable connection. Marriage rites, courtship rules.',
      includeEraContext: true,
      eraUsage: 'The era shapes what love is possible.',
    },
  },

  // 4. SLICE OF LIFE
  {
    id: 'slice-of-life',
    name: 'Slice of Life',
    description: 'Quiet, intimate narratives finding meaning in everyday moments and small connections',
    tags: ['quiet', 'intimate', 'contemplative'],
    format: 'story',
    plotStructure: {
      type: 'episodic',
      instructions: `This is anti-plot storytelling. There is no crisis, no antagonist, no ticking clock. Instead, we witness life being lived - and in that witness, find meaning.

Structure: The story follows a natural rhythm - a day, a season, a transition. Begin with waking or arriving. End with rest or departure. Between, capture moments that would be elided in other stories: preparing food, walking familiar paths, small talk that reveals character.

The Extraordinary in the Ordinary: A story can be built from someone simply doing their work well. The satisfaction of craft. The texture of routine. Pay attention to the specific knowledge a character has about their world.

Encounters: When others appear, there's no dramatic tension - just the genuine awkwardness and grace of people navigating proximity. Conversations wander. Silences are comfortable or uncomfortable. Nothing needs to be resolved.

Emotion Through Accumulation: Feeling builds through layered small moments, not dramatic events. Melancholy might come from noticing that a tree has grown, or that a face has aged. Joy might come from the exact rightness of an afternoon.

Ending: The story ends, it doesn't conclude. Perhaps the character notices something has shifted - a small change that holds the seed of the next chapter, which we won't see. Or perhaps we simply leave them in a moment of peace.

Style: Unhurried prose. Rich sensory detail. Present tense works well. Let the reader sink into the rhythm.`,
    },
    entityRules: {
      primarySubjectCategories: ['character', 'place'],
      supportingSubjectCategories: ['character', 'place', 'object', 'collective'],
      roles: [
        { role: 'focal-point', count: { min: 1, max: 2 }, description: 'What we observe - a person going about their day, or a place and its rhythms' },
        { role: 'passing-through', count: { min: 0, max: 3 }, description: 'Fleeting presences - strangers, objects changing hands, moments of connection' },
        { role: 'backdrop', count: { min: 0, max: 1 }, description: 'The larger context - community, guild, or neighborhood that shapes daily life' },
      ],
      maxCastSize: 5,
    },
    eventRules: {
      significanceRange: { min: 0.0, max: 0.4 },
      excludeKinds: ['era_transition', 'entity_lifecycle', 'succession'],
      priorityTags: ['daily', 'craft', 'family', 'friendship', 'labor'],
      maxEvents: 6,
      usageInstructions: 'These are background texture, not drivers. The story is not about events but about being present in a moment.',
    },
    sceneTemplates: [
      { id: 'morning', name: 'Morning Ritual', purpose: 'Establish the rhythm of life', requiredElements: ['routine action', 'sensory grounding', 'small anticipation'], emotionalArc: 'stillness → awakening' },
      { id: 'encounter', name: 'The Encounter', purpose: 'A moment of connection', requiredElements: ['another person', 'exchange', 'something learned or shared'], emotionalArc: 'solitude → connection → return to self' },
      { id: 'work', name: 'The Work', purpose: 'Dignity of labor or craft', requiredElements: ['skilled action', 'competence', 'quiet satisfaction'], emotionalArc: 'focus → flow → completion' },
      { id: 'evening', name: 'Evening Reflection', purpose: 'Day ending, meaning emerging', requiredElements: ['transition to rest', 'review of day', 'small gratitude or melancholy'], emotionalArc: 'winding down → peace or loneliness' },
    ],
    pacing: {
      totalWordCount: { min: 1000, max: 1400 },
      sceneCount: { min: 3, max: 4 },
    },
    proseDirectives: {
      toneKeywords: ['quiet', 'observant', 'gentle', 'present', 'textured'],
      dialogueStyle: 'Natural, meandering. People talk about small things. Silences are comfortable.',
      descriptionStyle: 'Precise sensory detail. The exact quality of light. The smell of bread.',
      pacingNotes: 'Very slow. Let readers sink into moments. No rush.',
      avoid: ['dramatic conflict', 'high stakes', 'life-changing events', 'rushing to resolution'],
    },
    worldDataFocus: {
      includeLocations: true,
      locationUsage: 'The kitchen, the workshop, the path walked daily. Intimate spaces.',
      includeArtifacts: true,
      artifactUsage: 'Tools of daily life. The worn handle, the chipped cup.',
      includeCulturalPractices: true,
      culturalUsage: 'Daily customs. How meals are taken. How neighbors greet.',
      includeEraContext: false,
    },
  },

  // 5. POLITICAL INTRIGUE
  {
    id: 'political-intrigue',
    name: 'Political Intrigue',
    description: 'Complex webs of power, manipulation, secret alliances, and dangerous information',
    tags: ['political', 'scheming', 'complex'],
    format: 'story',
    plotStructure: {
      type: 'parallel',
      instructions: `This is chess with people. The reader should feel the thrill of watching brilliant minds maneuver against each other, always two moves ahead.

Dual Narratives: We follow both the surface action (what characters say, what appears to happen) and the hidden action (what they're really doing, what they actually want). The reader should frequently realize that a scene they just read meant something different than they thought.

The Public Face: Formal occasions - councils, ceremonies, audiences - are where the real work happens through what's not said. Watch body language. Note who stands where. The most important communication happens in glances.

The Private Meeting: When masks come off, conversations become transactions. Everyone wants something. Threats are couched in courtesy. Alliances shift based on new information. The reader should track who knows what.

Information as Plot: The story advances through revelation. Each new piece of information changes the board. Characters make decisions based on what they know, which may be incomplete or manipulated.

The Turn: At some point, the hidden game becomes visible. The revelation should recontextualize everything - but feel fair. The clues were there.

Style: Precise, observant prose. Characters notice telling details. Dialogue carries multiple meanings. The reader must pay attention.`,
    },
    entityRules: {
      primarySubjectCategories: ['character', 'collective', 'concept'],
      supportingSubjectCategories: ['collective', 'place', 'object', 'power'],
      roles: [
        { role: 'player', count: { min: 1, max: 3 }, description: 'Those maneuvering for advantage - schemers, factions, or ambitious powers' },
        { role: 'prize', count: { min: 1, max: 2 }, description: 'What is being contested - law, territory, throne, or artifact of legitimacy' },
        { role: 'pawn', count: { min: 0, max: 2 }, description: 'Manipulated pieces - people or groups used without knowing' },
        { role: 'secret', count: { min: 0, max: 1 }, description: 'Hidden truth that could change everything - forbidden knowledge or damning evidence' },
      ],
      maxCastSize: 8,
    },
    eventRules: {
      significanceRange: { min: 0.4, max: 1.0 },
      priorityKinds: ['relationship_dissolved', 'state_change', 'succession'],
      priorityTags: ['alliance', 'betrayal', 'negotiation', 'secret', 'power'],
      maxEvents: 12,
      usageInstructions: 'Events have public interpretations and private meanings. The same event looks different to different players.',
    },
    sceneTemplates: [
      { id: 'public-face', name: 'The Public Face', purpose: 'Show the official version', requiredElements: ['formal setting', 'performance', 'hidden reactions'], emotionalArc: 'composure → mask slipping → recovery' },
      { id: 'private-meeting', name: 'The Private Meeting', purpose: 'Real negotiations', requiredElements: ['secrecy', 'leverage', 'bargain or threat'], emotionalArc: 'circling → testing → deal or impasse' },
      { id: 'revelation', name: 'The Revelation', purpose: 'Hidden truth exposed', requiredElements: ['proof', 'reaction', 'consequence'], emotionalArc: 'tension → exposure → scramble' },
      { id: 'aftermath', name: 'New Positions', purpose: 'Recalculated alliances', requiredElements: ['new power balance', 'next move hinted', 'cost tallied'], emotionalArc: 'dust settling → new tension' },
    ],
    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 5 },
    },
    proseDirectives: {
      toneKeywords: ['calculating', 'tense', 'layered', 'dangerous', 'controlled'],
      dialogueStyle: 'Every word chosen. Subtext everywhere. What is NOT said. Implication and inference.',
      descriptionStyle: 'Notice what others miss. Small tells. Glances exchanged. Hands fidgeting.',
      pacingNotes: 'Measured. Build tension through accumulation. Revelations should land.',
      avoid: ['obvious villains', 'simple motivations', 'characters who say what they mean', 'neat resolutions'],
    },
    worldDataFocus: {
      includeLocations: true,
      locationUsage: 'Halls of power. Secret meeting places. Where deals are made.',
      includeArtifacts: true,
      artifactUsage: 'Symbols of office. Documents. Seals and signatures.',
      includeCulturalPractices: true,
      culturalUsage: 'Protocols that constrain or enable maneuvering. Formal rules to exploit.',
      includeEraContext: true,
      eraUsage: 'The political landscape of the era shapes what games are possible.',
    },
  },

  // 6. POETIC/LYRICAL
  {
    id: 'poetic-lyrical',
    name: 'Poetic/Lyrical',
    description: 'Beautiful, atmospheric prose emphasizing language, imagery, and emotional resonance over plot',
    tags: ['literary', 'atmospheric', 'beautiful'],
    format: 'story',
    plotStructure: {
      type: 'circular',
      instructions: `This is prose poetry. Language itself is the experience. Plot exists only as a frame for imagery and emotion.

Opening Image: Begin with a vivid, specific image that will return transformed at the end. This image is the story's secret heart - choose it with care. It should be concrete (a particular light, a particular object) but resonant with unspoken meaning.

Movement Through Association: The story does not advance through cause and effect, but through emotional logic. One image leads to another through hidden rhymes of color, texture, feeling. The reader follows a path they sense rather than see.

Encounters: When other characters appear, they are mirrors or contrasts. Conversation is less about information than about rhythm and gap - what's said, what's almost said, what remains silent.

Time: Time is fluid. Past and present interweave. A memory can be more vivid than the present moment. The story exists in a kind of eternal now.

Return: The ending circles back to the opening image, but everything has changed. The reader now sees what they couldn't see before. The image means something new while remaining what it always was.

Style: Sensory precision is everything. Find the exact word. Rhythm matters - read sentences aloud. White space is as important as text. Less is more. Trust the reader.`,
    },
    entityRules: {
      primarySubjectCategories: ['character', 'place', 'era'],
      supportingSubjectCategories: ['place', 'concept', 'object', 'character'],
      roles: [
        { role: 'consciousness', count: { min: 1, max: 1 }, description: 'The perceiving presence - a mind, a place with memory, or an age contemplating itself' },
        { role: 'presence', count: { min: 0, max: 2 }, description: 'What enters awareness - visitors, objects that hold meaning, ideas made tangible' },
        { role: 'absence', count: { min: 0, max: 1 }, description: 'What is longed for or lost - the departed, the forgotten, the time that was' },
      ],
      maxCastSize: 4,
    },
    eventRules: {
      significanceRange: { min: 0.0, max: 0.6 },
      priorityTags: ['season', 'memory', 'change', 'loss', 'beauty'],
      maxEvents: 8,
      usageInstructions: 'Events are prompts for meditation, not drivers. What matters is the quality of attention paid to moments.',
    },
    sceneTemplates: [
      { id: 'opening-image', name: 'The Image', purpose: 'Establish the central metaphor', requiredElements: ['vivid sensory scene', 'unstated meaning', 'beauty or strangeness'], emotionalArc: 'attention → mystery' },
      { id: 'meditation', name: 'Meditation', purpose: 'Explore through association', requiredElements: ['memory or reflection', 'imagery that echoes', 'emotional undercurrent'], emotionalArc: 'wandering → deepening' },
      { id: 'encounter', name: 'The Encounter', purpose: 'Another presence enters', requiredElements: ['moment of connection', 'gap between people', 'something unsaid'], emotionalArc: 'closeness → distance' },
      { id: 'return', name: 'Return', purpose: 'The opening transformed', requiredElements: ['same image', 'new understanding', 'closure without explanation'], emotionalArc: 'recognition → peace or sorrow' },
    ],
    pacing: {
      totalWordCount: { min: 1200, max: 1600 },
      sceneCount: { min: 3, max: 4 },
    },
    proseDirectives: {
      toneKeywords: ['luminous', 'haunting', 'delicate', 'resonant', 'precise'],
      dialogueStyle: 'Sparse. Words carry weight. What is not said.',
      descriptionStyle: 'Precise, evocative imagery. Concrete details that open into abstraction. Synesthesia welcome.',
      pacingNotes: 'Slow. Very slow. Let images accumulate. Trust silence.',
      avoid: ['explaining meaning', 'plot mechanics', 'rushed conclusions', 'clichéd images'],
      exampleProse: 'The light that morning had a quality she later could not name, though she tried—not golden, not gray, but something the color of almost-remembering, the way a word hovers before arriving.',
    },
    worldDataFocus: {
      includeLocations: true,
      locationUsage: 'Places are characters. Their moods, their light, their weather.',
      includeArtifacts: true,
      artifactUsage: 'Objects hold time. What they have witnessed.',
      includeCulturalPractices: true,
      culturalUsage: 'Rituals as poetry. The gestures that carry meaning beyond words.',
      includeEraContext: true,
      eraUsage: 'The era as atmosphere. Not history but feeling.',
    },
  },

  // 7. DARK COMEDY
  {
    id: 'dark-comedy',
    name: 'Dark Comedy',
    description: 'Humor found in grim situations, irony, absurdity, and the gap between expectation and reality',
    tags: ['comedy', 'dark', 'ironic'],
    format: 'story',
    plotStructure: {
      type: 'accumulating',
      instructions: `This is comedy built on suffering. The protagonist's world falls apart, and the falling apart is funny because it's also true.

The Setup: Establish a normal situation with a small problem. The protagonist is competent, perhaps even confident. They have a reasonable plan. This normalcy must be believable for its destruction to be funny.

The First Crack: Something goes wrong. The protagonist's reasonable response makes it worse. This is the template: each logical action, each sensible choice, somehow magnifies the disaster. The humor is in the inexorability.

Escalation: Problems multiply. Each new attempt at solution creates two new problems. The protagonist's self-awareness grows even as their situation deteriorates. Dark observations about life emerge through gritted teeth.

The Cascade: Everything fails at once. Subplots collide. Characters' worst traits are exposed. The protagonist faces impossible choices where every option is terrible. They may laugh, inappropriately, because what else can you do.

Aftermath: The smoke clears. Assess the damage. There should be a rueful acceptance - things are terrible, but the protagonist has learned something, even if what they've learned is grim. A note of genuine humanity amidst the wreckage.

Style: Deadpan delivery. The characters rarely acknowledge the absurdity directly - that's for the reader. Dark material treated with lightness, light material treated with weight.`,
    },
    entityRules: {
      primarySubjectCategories: ['character', 'collective', 'concept'],
      supportingSubjectCategories: ['character', 'collective', 'object'],
      roles: [
        { role: 'fool', count: { min: 1, max: 2 }, description: 'Making things worse while trying to help - person or bumbling institution' },
        { role: 'system', count: { min: 0, max: 1 }, description: 'The absurd structure - bureaucracy, tradition, or rule that creates chaos' },
        { role: 'catalyst', count: { min: 0, max: 1 }, description: 'What sets disaster in motion - cursed object, minor problem, simple request' },
        { role: 'victim', count: { min: 0, max: 2 }, description: 'Caught in the crossfire - people, places, or institutions damaged by folly' },
      ],
      maxCastSize: 6,
    },
    eventRules: {
      significanceRange: { min: 0.3, max: 0.8 },
      priorityTags: ['failure', 'accident', 'misunderstanding', 'bureaucracy'],
      excludeKinds: ['era_transition'],
      maxEvents: 10,
      usageInstructions: 'Find the absurdity in these events. What reasonable action led to unreasonable results?',
    },
    sceneTemplates: [
      { id: 'setup', name: 'The Setup', purpose: 'Establish normalcy about to shatter', requiredElements: ['routine situation', 'small problem', 'confident protagonist'], emotionalArc: 'confidence → first crack' },
      { id: 'escalation', name: 'The Escalation', purpose: 'Solution makes things worse', requiredElements: ['logical action', 'unexpected consequence', 'doubling down'], emotionalArc: 'determination → dismay → denial' },
      { id: 'cascade', name: 'The Cascade', purpose: 'Everything fails at once', requiredElements: ['multiple disasters', 'ironic connections', 'impossible choices'], emotionalArc: 'panic → absurdity → strange calm' },
      { id: 'aftermath', name: 'The Aftermath', purpose: 'Surveying the damage', requiredElements: ['consequences named', 'ironic observation', 'suggestion it will happen again'], emotionalArc: 'exhaustion → rueful acceptance' },
    ],
    pacing: {
      totalWordCount: { min: 1400, max: 1800 },
      sceneCount: { min: 4, max: 5 },
    },
    proseDirectives: {
      toneKeywords: ['ironic', 'deadpan', 'absurd', 'rueful', 'dark'],
      dialogueStyle: 'Characters speak sincerely. Humor from context not jokes. Understatement.',
      descriptionStyle: 'Precise, clinical observation of disaster. The comedy of specificity.',
      pacingNotes: 'Build momentum. Accelerate toward catastrophe. Brief pause before final beat.',
      avoid: ['winking at audience', 'jokes that break tone', 'unsympathetic characters', 'cruelty without consequence'],
    },
    worldDataFocus: {
      includeLocations: false,
      includeArtifacts: true,
      artifactUsage: 'Objects that malfunction, are misunderstood, or cause problems.',
      includeCulturalPractices: true,
      culturalUsage: 'Rules and customs that create absurd situations. Bureaucracy. Protocol.',
      includeEraContext: false,
    },
  },

  // 8. HEROIC FANTASY
  {
    id: 'heroic-fantasy',
    name: 'Heroic Fantasy',
    description: 'Classic hero\'s journey with clear good and evil, trials, and triumphant resolution',
    tags: ['heroic', 'fantasy', 'triumphant'],
    format: 'story',
    plotStructure: {
      type: 'three-act',
      instructions: `This is mythic storytelling. The world is enchanted. Good and evil are real forces. The hero's journey transforms not just themselves but the world around them.

The Call: The hero begins in their ordinary world, which is already touched by darkness or lacking something vital. The call to adventure disrupts their life. They may resist, but destiny is insistent.

The Threshold: Crossing into the adventure should feel momentous. The hero leaves behind everything familiar. New allies appear - each representing virtues the hero will need. Mentors offer wisdom that will prove essential.

Trials: Each challenge tests a specific aspect of the hero's character. Failure is not just possible but necessary - through defeat, the hero learns what they truly need. The dark night of the soul comes before the dawn.

The Confrontation: The final battle is as much internal as external. The hero must use everything they've learned. Victory comes not from strength alone but from wisdom, from sacrifice, from becoming who they were meant to be.

Return: The hero returns changed. The ordinary world is renewed by their transformation. We glimpse the future they've made possible.

Style: Wonder should infuse the prose. Magic is real and costs something. Describe the world as a hero would see it - full of portent and meaning.`,
    },
    entityRules: {
      primarySubjectCategories: ['character', 'object', 'power'],
      supportingSubjectCategories: ['character', 'collective', 'place', 'power'],
      roles: [
        { role: 'hero', count: { min: 1, max: 1 }, description: 'The chosen one - destined to confront the darkness' },
        { role: 'darkness', count: { min: 1, max: 1 }, description: 'Evil to be vanquished - dark lord, corrupting power, or malevolent force' },
        { role: 'quest-object', count: { min: 0, max: 1 }, description: 'What is sought or wielded - legendary artifact, awakening power, or sacred place' },
        { role: 'guide', count: { min: 0, max: 1 }, description: 'Wisdom for the journey - mentor, ancient knowledge, or prophetic vision' },
        { role: 'companion', count: { min: 0, max: 2 }, description: 'Those who stand with the hero - allies who may fall or triumph' },
      ],
      maxCastSize: 6,
    },
    eventRules: {
      significanceRange: { min: 0.5, max: 1.0 },
      priorityKinds: ['entity_lifecycle', 'succession', 'coalescence', 'state_change'],
      priorityTags: ['combat', 'quest', 'magic', 'prophecy', 'triumph'],
      maxEvents: 12,
      usageInstructions: 'These are the legendary deeds that will be sung. Each event is a test or a victory.',
    },
    sceneTemplates: [
      { id: 'call', name: 'The Call', purpose: 'Summon the hero to adventure', requiredElements: ['disruption of normal', 'stakes established', 'choice to act'], emotionalArc: 'peace → urgency → commitment' },
      { id: 'trial', name: 'The Trial', purpose: 'Test and forge the hero', requiredElements: ['obstacle', 'struggle', 'growth'], emotionalArc: 'determination → struggle → triumph or lesson' },
      { id: 'dark-night', name: 'The Dark Night', purpose: 'All seems lost', requiredElements: ['failure or loss', 'despair', 'spark of hope'], emotionalArc: 'defeat → despair → renewal' },
      { id: 'triumph', name: 'The Triumph', purpose: 'Victory over evil', requiredElements: ['final confrontation', 'use of what was learned', 'evil defeated'], emotionalArc: 'determination → struggle → victory' },
    ],
    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 5 },
    },
    proseDirectives: {
      toneKeywords: ['heroic', 'inspiring', 'grand', 'hopeful', 'triumphant'],
      dialogueStyle: 'Stirring speeches. Loyal oaths. The language of legends.',
      descriptionStyle: 'Vivid, colorful. Good is beautiful, evil is terrible. Clear imagery.',
      pacingNotes: 'Build through trials to climax. Let the triumph resonate.',
      avoid: ['moral ambiguity', 'anticlimactic endings', 'cynicism', 'deconstructing the genre'],
    },
    worldDataFocus: {
      includeLocations: true,
      locationUsage: 'Legendary places. Dark fortresses. Sacred groves. The road between.',
      includeArtifacts: true,
      artifactUsage: 'Weapons of power. Ancient relics. The tools of destiny.',
      includeCulturalPractices: true,
      culturalUsage: 'Prophecies. Ancient rites. The customs of the wise.',
      includeEraContext: true,
      eraUsage: 'An age of darkness giving way to light.',
    },
  },

  // 9. TRAGEDY
  {
    id: 'tragedy',
    name: 'Tragedy',
    description: 'Stories of inevitable doom, fatal flaws, and the fall of great figures',
    tags: ['tragic', 'inevitable', 'cathartic'],
    format: 'story',
    plotStructure: {
      type: 'rise-and-fall',
      instructions: `This is tragedy in the classical sense. The protagonist is exceptional - their greatness is real. Their destruction is inevitable, not despite their virtues but because of them. We watch, knowing what they cannot know.

At the Height: Show the protagonist at their peak. Their power, their glory, their confidence. But show also the flaw - invisible to them, visible to us. Pride becomes hubris. Strength becomes inflexibility. Vision becomes blindness.

The Temptation: An opportunity appears that the protagonist cannot refuse. Taking it is completely in character - this is not a mistake, it's an expression of who they are. The audience sees the trap that the protagonist cannot.

The Fall: Once the first step is taken, the rest follows inevitably. Each attempt to escape makes things worse. The protagonist may begin to see, but too late. Others suffer for their choices. The isolation grows.

Recognition: The moment of terrible clarity. The protagonist finally sees what we have seen all along. They understand their flaw, their complicity in their own destruction. This recognition is devastating precisely because it comes too late.

Catharsis: The ending should leave us with pity and fear - pity for the protagonist, fear that we might share their blindness. Something has been lost that cannot be recovered. But there may be a kind of peace in acceptance.

Style: Elevated, formal language. The weight of fate in every word. Characters speak as if history is listening.`,
    },
    entityRules: {
      primarySubjectCategories: ['character', 'collective', 'place', 'concept'],
      supportingSubjectCategories: ['character', 'collective', 'place', 'object'],
      roles: [
        { role: 'doomed', count: { min: 1, max: 1 }, description: 'What will fall - hero with fatal flaw, empire in decline, or ideal that cannot hold' },
        { role: 'flaw', count: { min: 0, max: 1 }, description: 'The fatal weakness - hubris, corruption, cursed inheritance, or betrayed principle' },
        { role: 'enabler', count: { min: 0, max: 2 }, description: 'Those who feed the destruction - sycophants, rivals, or circumstances' },
        { role: 'innocent', count: { min: 0, max: 2 }, description: 'Destroyed in the fall - people, places, or hopes caught in the collapse' },
        { role: 'witness', count: { min: 0, max: 1 }, description: 'Who remains to tell the tale and learn from the ruin' },
      ],
      maxCastSize: 7,
    },
    eventRules: {
      significanceRange: { min: 0.6, max: 1.0 },
      priorityKinds: ['entity_lifecycle', 'state_change', 'relationship_dissolved'],
      priorityTags: ['death', 'betrayal', 'hubris', 'fall', 'ruin'],
      maxEvents: 10,
      usageInstructions: 'Each event is a step toward doom. The audience should see it coming before the characters do.',
    },
    sceneTemplates: [
      { id: 'height', name: 'At the Height', purpose: 'Show what will be lost', requiredElements: ['greatness displayed', 'flaw visible to reader', 'confidence'], emotionalArc: 'admiration → unease' },
      { id: 'temptation', name: 'The Temptation', purpose: 'The flaw takes hold', requiredElements: ['opportunity', 'choice that seems right', 'first step down'], emotionalArc: 'desire → decision → crossing the line' },
      { id: 'fall', name: 'The Fall', purpose: 'Consequences unfold', requiredElements: ['things falling apart', 'protagonist\s blindness', 'cost to others'], emotionalArc: 'denial → struggle → desperation' },
      { id: 'recognition', name: 'The Recognition', purpose: 'Seeing the truth too late', requiredElements: ['clarity', 'horror', 'acceptance'], emotionalArc: 'blindness → sight → grief' },
    ],
    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 5 },
    },
    proseDirectives: {
      toneKeywords: ['inevitable', 'doomed', 'magnificent', 'terrible', 'cathartic'],
      dialogueStyle: 'Weight of fate. Words that will be remembered. Ironic foreshadowing.',
      descriptionStyle: 'Beauty and terror. The grandeur of destruction. Imagery of falling, breaking.',
      pacingNotes: 'Deliberate build. No rushing the fall. Let each stage land.',
      avoid: ['redemption arcs', 'last-minute saves', 'unearned hope', 'villains to blame'],
    },
    worldDataFocus: {
      includeLocations: true,
      locationUsage: 'Thrones that will be empty. Halls that will burn. High places to fall from.',
      includeArtifacts: true,
      artifactUsage: 'Symbols of power that will be lost. Crowns, swords, seals.',
      includeCulturalPractices: false,
      includeEraContext: true,
      eraUsage: 'An era ending. What dies with the protagonist.',
    },
  },

  // 10. MYSTERY/SUSPENSE
  {
    id: 'mystery-suspense',
    name: 'Mystery/Suspense',
    description: 'Stories built around secrets, investigation, and the revelation of hidden truths',
    tags: ['mystery', 'suspense', 'revelation'],
    format: 'story',
    plotStructure: {
      type: 'mystery-reveal',
      instructions: `This is a puzzle story. The reader should be engaged in solving it alongside the investigator. Play fair - all clues should be available to the reader, even if their significance isn't immediately clear.

The Mystery: Establish the question that needs answering. Something is wrong, hidden, unexplained. The investigator is drawn in by duty, curiosity, or personal connection. Set up the world of suspects and possibilities.

Investigation: Each scene should yield new information that both advances and complicates the solution. Interview witnesses whose accounts don't quite match. Discover evidence that points in multiple directions. Follow leads that prove to be dead ends - but don't make them feel like wasted time.

The Red Herring: Plant at least one seemingly damning piece of evidence against the wrong suspect. It should be convincing enough that the reader considers it seriously, but on reflection, something should feel off. The misdirection should be clever, not cheap.

The Revelation: The truth should feel inevitable once revealed, even if surprising. It should reframe everything that came before - scenes that seemed irrelevant become crucial, innocent details become damning. The solution should be findable by a careful reader, but not obvious.

Resolution: Show the consequences of truth revealed. Justice may or may not be served. The investigator may be changed by what they've learned. Close the mystery while acknowledging its costs.

Style: Precise, observant prose. Notice what's out of place. Dialogue should reveal character while potentially hiding or revealing information. The reader should feel the satisfaction of pieces clicking into place.`,
    },
    entityRules: {
      primarySubjectCategories: ['character', 'object', 'place'],
      supportingSubjectCategories: ['character', 'place', 'collective', 'concept'],
      roles: [
        { role: 'investigator', count: { min: 1, max: 1 }, description: 'The one seeking truth - detective, scholar, or curious outsider' },
        { role: 'mystery', count: { min: 1, max: 1 }, description: 'What must be solved - artifact with hidden history, haunted place, or buried secret' },
        { role: 'suspect', count: { min: 1, max: 3 }, description: 'Possible answers - people, factions, or beliefs that might be responsible' },
        { role: 'culprit', count: { min: 1, max: 1 }, description: 'The true answer - should not be obvious until the revelation' },
        { role: 'clue', count: { min: 0, max: 2 }, description: 'Evidence that illuminates - objects, places, or testimonies that reveal truth' },
      ],
      maxCastSize: 8,
    },
    eventRules: {
      significanceRange: { min: 0.3, max: 0.9 },
      priorityKinds: ['state_change', 'relationship_dissolved'],
      priorityTags: ['secret', 'discovery', 'hidden', 'betrayal', 'reveal'],
      maxEvents: 12,
      usageInstructions: 'Events are clues. Each should have a surface meaning and a hidden meaning that becomes clear on revelation.',
    },
    sceneTemplates: [
      { id: 'mystery', name: 'The Mystery', purpose: 'Establish what needs solving', requiredElements: ['question posed', 'stakes clear', 'investigator engaged'], emotionalArc: 'curiosity → commitment' },
      { id: 'investigation', name: 'The Investigation', purpose: 'Gather clues and suspects', requiredElements: ['discovery', 'interview or observation', 'new question raised'], emotionalArc: 'progress → confusion → determination' },
      { id: 'false-trail', name: 'The False Trail', purpose: 'Mislead toward wrong conclusion', requiredElements: ['apparently damning evidence', 'almost-solution', 'something doesn\'t fit'], emotionalArc: 'certainty → doubt' },
      { id: 'revelation', name: 'The Revelation', purpose: 'True answer revealed', requiredElements: ['the missing piece', 'recontextualization', 'confrontation'], emotionalArc: 'confusion → clarity → consequence' },
    ],
    pacing: {
      totalWordCount: { min: 1500, max: 2000 },
      sceneCount: { min: 4, max: 5 },
    },
    proseDirectives: {
      toneKeywords: ['suspicious', 'tense', 'uncertain', 'curious', 'revelatory'],
      dialogueStyle: 'Everyone has something to hide. Evasions. Slips. Careful word choice.',
      descriptionStyle: 'Notice everything. What\'s out of place. What doesn\'t fit. Clues hidden in detail.',
      pacingNotes: 'Build tension through uncertainty. Revelation should pay off accumulated tension.',
      avoid: ['cheating clues', 'deus ex machina solutions', 'obvious culprits', 'unmotivated reveals'],
    },
    worldDataFocus: {
      includeLocations: true,
      locationUsage: 'Where things happened. Where evidence might be found.',
      includeArtifacts: true,
      artifactUsage: 'Objects as clues. What they reveal about their owners.',
      includeCulturalPractices: true,
      culturalUsage: 'Customs that constrain or enable secrets. What is known, what is hidden.',
      includeEraContext: false,
    },
  },
];

// =============================================================================
// Default Document Styles (for in-universe documents)
// =============================================================================

const DEFAULT_DOCUMENT_ENTITY_RULES: EntitySelectionRules = {
  primarySubjectCategories: ['character', 'collective', 'place', 'object', 'concept'],
  supportingSubjectCategories: ['character', 'collective', 'place', 'object', 'concept', 'power'],
  roles: [
    { role: 'subject', count: { min: 1, max: 2 }, description: 'Primary focus of the document' },
    { role: 'authority', count: { min: 0, max: 2 }, description: 'Official or institutional voice' },
    { role: 'witness', count: { min: 0, max: 3 }, description: 'Witnesses or participants with direct knowledge' },
    { role: 'mentioned', count: { min: 0, max: 4 }, description: 'Referenced entities that provide context' },
  ],
  maxCastSize: 8,
};

const DEFAULT_DOCUMENT_EVENT_RULES: EventSelectionRules = {
  significanceRange: { min: 0.3, max: 1.0 },
  maxEvents: 12,
  usageInstructions: 'Events are cited facts that ground the document in history. Use them as evidence, context, or justification.',
};

function cloneDocumentEntityRules(): EntitySelectionRules {
  return {
    ...DEFAULT_DOCUMENT_ENTITY_RULES,
    primarySubjectCategories: DEFAULT_DOCUMENT_ENTITY_RULES.primarySubjectCategories
      ? [...DEFAULT_DOCUMENT_ENTITY_RULES.primarySubjectCategories]
      : undefined,
    supportingSubjectCategories: DEFAULT_DOCUMENT_ENTITY_RULES.supportingSubjectCategories
      ? [...DEFAULT_DOCUMENT_ENTITY_RULES.supportingSubjectCategories]
      : undefined,
    roles: DEFAULT_DOCUMENT_ENTITY_RULES.roles.map((role) => ({
      ...role,
      count: { ...role.count },
    })),
  };
}

function cloneDocumentEventRules(): EventSelectionRules {
  return {
    ...DEFAULT_DOCUMENT_EVENT_RULES,
    significanceRange: { ...DEFAULT_DOCUMENT_EVENT_RULES.significanceRange },
    priorityKinds: DEFAULT_DOCUMENT_EVENT_RULES.priorityKinds
      ? [...DEFAULT_DOCUMENT_EVENT_RULES.priorityKinds]
      : undefined,
    excludeKinds: DEFAULT_DOCUMENT_EVENT_RULES.excludeKinds
      ? [...DEFAULT_DOCUMENT_EVENT_RULES.excludeKinds]
      : undefined,
    priorityTags: DEFAULT_DOCUMENT_EVENT_RULES.priorityTags
      ? [...DEFAULT_DOCUMENT_EVENT_RULES.priorityTags]
      : undefined,
  };
}

export const DEFAULT_DOCUMENT_STYLES: NarrativeStyle[] = [
  // 1. HERALD'S DISPATCH
  {
    id: 'heralds-dispatch',
    name: "Herald's Dispatch",
    description: 'Official news proclamation or town crier announcement about recent events',
    tags: ['document', 'news', 'official', 'proclamation'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['collective', 'place', 'event', 'character'],
      supportingSubjectCategories: ['character', 'concept', 'object'],
      roles: [
        { role: 'newsworthy-event', count: { min: 1, max: 2 }, description: 'The occurrence being announced', selectionCriteria: 'Prefer entities from event category' },
        { role: 'affected-territory', count: { min: 0, max: 2 }, description: 'Locations impacted by the news', selectionCriteria: 'Prefer entities from place category' },
        { role: 'faction-involved', count: { min: 0, max: 2 }, description: 'Organizations, kingdoms, or groups in the news', selectionCriteria: 'Prefer entities from collective category' },
        { role: 'notable-figure', count: { min: 0, max: 2 }, description: 'Persons of importance mentioned' },
        { role: 'decree-or-law', count: { min: 0, max: 1 }, description: 'New regulation or proclamation being announced', selectionCriteria: 'Prefer entities from concept category' },
      ],
      maxCastSize: 8,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'official news dispatch',
      contentInstructions: 'Write as if this will be read aloud in the town square. Lead with the most dramatic or important information. Include official-sounding language but remain accessible. Reference specific entities and events from the world data.',
      sections: [
        { id: 'headline', name: 'Headline', purpose: 'Grab attention immediately', wordCountTarget: 15, contentGuidance: 'Punchy, declarative. Start with action verb or dramatic noun.' },
        { id: 'lead', name: 'Lead Paragraph', purpose: 'Essential facts', wordCountTarget: 60, contentGuidance: 'Who did what, where, and why it matters to the common folk.' },
        { id: 'body', name: 'Full Account', purpose: 'Details and context', wordCountTarget: 200, contentGuidance: 'Expand on events, include witness accounts or official statements.' },
        { id: 'implications', name: 'What This Means', purpose: 'Consequences', wordCountTarget: 80, contentGuidance: 'How this affects trade, safety, daily life. What might happen next.' },
      ],
      wordCount: { min: 300, max: 500 },
      toneKeywords: ['authoritative', 'urgent', 'public', 'formal-but-accessible'],
      include: ['specific names', 'locations', 'dates/times', 'official titles', 'direct quotes'],
      avoid: ['modern journalism terms', 'passive voice in headlines', 'speculation presented as fact'],
      entityUsage: 'Reference entities by full title and name. Important figures should be quoted or mentioned.',
      eventUsage: 'Events are the news. Present them as recent occurrences with immediate relevance.',
      voice: 'Third person, present tense for immediacy. The voice of an official announcer.',
    },
  },

  // 2. TREATISE ON POWERS
  {
    id: 'treatise-powers',
    name: 'Treatise on Powers',
    description: 'Scholarly analysis of abilities, magic, or supernatural phenomena',
    tags: ['document', 'scholarly', 'abilities', 'academic'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['power', 'character'],
      supportingSubjectCategories: ['character', 'object', 'concept', 'collective'],
      roles: [
        { role: 'studied-power', count: { min: 1, max: 2 }, description: 'The ability, magic, or phenomenon being analyzed', selectionCriteria: 'Prefer entities from power category' },
        { role: 'documented-practitioner', count: { min: 0, max: 2 }, description: 'Those who wield or manifest the power' },
        { role: 'scholarly-authority', count: { min: 0, max: 1 }, description: 'Expert or institution lending credibility' },
        { role: 'related-artifact', count: { min: 0, max: 2 }, description: 'Objects associated with the power', selectionCriteria: 'Prefer entities from object category' },
      ],
      maxCastSize: 6,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'academic treatise',
      contentInstructions: 'Write as a scholar presenting findings to peers. Balance technical precision with readable prose. Include both empirical observations and theoretical speculation. Reference the ability/power/phenomenon in question using proper terminology.',
      sections: [
        { id: 'abstract', name: 'Abstract', purpose: 'Summarize findings', wordCountTarget: 80, contentGuidance: 'Concise overview of what was studied and concluded.' },
        { id: 'introduction', name: 'Introduction', purpose: 'Establish importance', wordCountTarget: 100, contentGuidance: 'Why this ability matters. Historical context. What questions this treatise addresses.' },
        { id: 'observations', name: 'Observations', purpose: 'Present evidence', wordCountTarget: 200, contentGuidance: 'Documented instances, effects observed, conditions required. Be specific.' },
        { id: 'analysis', name: 'Theoretical Analysis', purpose: 'Interpret findings', wordCountTarget: 150, contentGuidance: 'What the observations suggest. How this connects to known principles.' },
        { id: 'warnings', name: 'Caveats', purpose: 'Note dangers', wordCountTarget: 80, contentGuidance: 'Risks of misuse, limitations, ethical considerations.' },
        { id: 'conclusion', name: 'Conclusion', purpose: 'Summarize', wordCountTarget: 60, contentGuidance: 'Key takeaways, questions for future study.' },
      ],
      wordCount: { min: 600, max: 900 },
      toneKeywords: ['scholarly', 'precise', 'analytical', 'measured', 'authoritative'],
      include: ['technical terminology', 'specific examples', 'qualifications', 'citations to authorities'],
      avoid: ['casual language', 'unsubstantiated claims', 'sensationalism', 'first person singular'],
      entityUsage: 'Entities with abilities are subjects of study. Reference their documented capabilities.',
      eventUsage: 'Events serve as case studies or evidence. Cite specific instances where powers manifested.',
      voice: 'Third person academic. First person plural ("we observe") for analysis. Formal register.',
    },
  },

  // 3. MERCHANT'S BROADSHEET
  {
    id: 'merchants-broadsheet',
    name: "Merchant's Broadsheet",
    description: 'Commercial advertisement, trade announcement, or market bulletin',
    tags: ['document', 'commercial', 'trade', 'advertisement'],
    format: 'document',
    entityRules: cloneDocumentEntityRules(),
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'commercial advertisement',
      contentInstructions: 'Write as a merchant trying to attract customers. Be enthusiastic but not absurdly so. Include specific products or services with enticing descriptions. Reference the culture and location to make it feel grounded.',
      sections: [
        { id: 'hook', name: 'Attention Grabber', purpose: 'Stop the reader', wordCountTarget: 30, contentGuidance: 'Bold claim, question, or announcement. Make them curious.' },
        { id: 'offerings', name: 'What We Offer', purpose: 'List goods/services', wordCountTarget: 150, contentGuidance: 'Describe items with appeal. Focus on benefits, not just features.' },
        { id: 'credibility', name: 'Why Trust Us', purpose: 'Build confidence', wordCountTarget: 80, contentGuidance: 'Years of experience, famous customers, quality guarantees.' },
        { id: 'testimonial', name: 'Satisfied Customers', purpose: 'Social proof', wordCountTarget: 60, contentGuidance: 'Quote from a satisfied buyer. Name and location add authenticity.', optional: true },
        { id: 'call-to-action', name: 'Visit Us', purpose: 'Close the sale', wordCountTarget: 40, contentGuidance: 'Where to find them, when open, special current deals.' },
      ],
      wordCount: { min: 300, max: 450 },
      toneKeywords: ['enthusiastic', 'persuasive', 'confident', 'welcoming', 'urgent'],
      include: ['specific products', 'prices or barter terms', 'location details', 'merchant personality'],
      avoid: ['modern marketing jargon', 'obvious lies', 'threatening language', 'desperation'],
      entityUsage: 'Merchants are individuals with personality. Items might reference artifacts or abilities.',
      eventUsage: 'Recent events create opportunities. "After the siege, rebuilding supplies in high demand!"',
      voice: 'First person from merchant, or third person promotional. Enthusiastic but genuine.',
    },
  },

  // 4. COLLECTED CORRESPONDENCE
  {
    id: 'collected-letters',
    name: 'Collected Correspondence',
    description: 'Exchange of letters between entities revealing relationships and events',
    tags: ['document', 'letters', 'personal', 'epistolary'],
    format: 'document',
    entityRules: cloneDocumentEntityRules(),
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'letter collection',
      contentInstructions: 'Write authentic personal letters between entities. Each letter should have distinct voice matching the sender. Letters should reveal character, advance a narrative through correspondence, and reference shared history. Include mundane details alongside important matters.',
      sections: [
        { id: 'context', name: "Editor's Note", purpose: 'Frame the collection', wordCountTarget: 60, contentGuidance: 'Why these letters were preserved. Who the correspondents were.' },
        { id: 'letter1', name: 'First Letter', purpose: 'Establish situation', wordCountTarget: 200, contentGuidance: 'Initial communication. Raises questions, shares news, makes a request.' },
        { id: 'letter2', name: 'Reply', purpose: 'Response and development', wordCountTarget: 200, contentGuidance: 'Addresses the first letter. Reveals the other perspective. Deepens the situation.' },
        { id: 'letter3', name: 'Final Letter', purpose: 'Resolution or cliffhanger', wordCountTarget: 180, contentGuidance: 'Concludes the exchange or leaves tantalizing loose ends.', optional: true },
      ],
      wordCount: { min: 500, max: 800 },
      toneKeywords: ['personal', 'intimate', 'revealing', 'period-appropriate', 'distinctive-voices'],
      include: ['personal details', 'emotional subtext', 'period greetings/closings', 'references to shared history'],
      avoid: ['identical voices', 'exposition dumps', 'modern idioms', 'perfect information'],
      entityUsage: 'Correspondents are entities with relationship. Their bond should be evident in how they write.',
      eventUsage: 'Events are what they write about. News, reactions, consequences discussed in personal terms.',
      voice: 'First person from each writer. Each letter has distinct voice matching the entity.',
    },
  },

  // 5. CHRONICLE ENTRY
  {
    id: 'chronicle-entry',
    name: 'Chronicle Entry',
    description: 'Official historical record or archive entry documenting events',
    tags: ['document', 'historical', 'official', 'archive'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['era', 'event', 'collective', 'character'],
      supportingSubjectCategories: ['character', 'place', 'concept', 'collective'],
      roles: [
        { role: 'era-documented', count: { min: 0, max: 1 }, description: 'The age or period being recorded', selectionCriteria: 'Prefer entities from era category' },
        { role: 'pivotal-event', count: { min: 0, max: 2 }, description: 'Key occurrence being chronicled', selectionCriteria: 'Prefer entities from event category' },
        { role: 'historical-figure', count: { min: 0, max: 3 }, description: 'Notable persons documented' },
        { role: 'faction-recorded', count: { min: 0, max: 2 }, description: 'Organizations or powers mentioned', selectionCriteria: 'Prefer entities from collective category' },
        { role: 'chronicler', count: { min: 0, max: 1 }, description: 'The voice recording history' },
      ],
      maxCastSize: 8,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'historical chronicle entry',
      contentInstructions: 'Write as an official record-keeper documenting events for posterity. Maintain objectivity while acknowledging sources. Include specific dates and names. Note uncertainties honestly. The chronicler may occasionally reveal opinions through careful word choice.',
      sections: [
        { id: 'header', name: 'Entry Header', purpose: 'Identify the record', wordCountTarget: 40, contentGuidance: 'Date, period, chronicler identification.' },
        { id: 'events', name: 'Events Recorded', purpose: 'Document what happened', wordCountTarget: 250, contentGuidance: 'Chronological account. Specific details. Who did what.' },
        { id: 'analysis', name: 'Significance', purpose: 'Explain importance', wordCountTarget: 100, contentGuidance: 'Why this matters. How it connects to other events. Precedents.' },
        { id: 'figures', name: 'Notable Figures', purpose: 'Document participants', wordCountTarget: 80, contentGuidance: 'List key entities and their roles. Titles and affiliations.' },
        { id: 'notes', name: "Chronicler's Notes", purpose: 'Personal observations', wordCountTarget: 60, contentGuidance: 'Uncertainties, conflicting accounts, personal reflections.', optional: true },
      ],
      wordCount: { min: 450, max: 650 },
      toneKeywords: ['objective', 'formal', 'precise', 'archival', 'measured'],
      include: ['specific dates', 'full titles', 'source attribution', 'cross-references'],
      avoid: ['emotional language', 'speculation as fact', 'modern historical terms', 'bias without acknowledgment'],
      entityUsage: 'Entities are historical figures. Use full titles and note their roles.',
      eventUsage: 'Events are the primary content. Document them with precision and context.',
      voice: 'Third person objective. The chronicler may intrude briefly in notes sections.',
    },
  },

  // 6. WANTED NOTICE
  {
    id: 'wanted-notice',
    name: 'Wanted Notice',
    description: 'Bounty poster, warning notice, or official alert about a person or threat',
    tags: ['document', 'warning', 'bounty', 'official'],
    format: 'document',
    entityRules: cloneDocumentEntityRules(),
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'wanted poster or warning notice',
      contentInstructions: 'Write as an official notice meant to be posted publicly. Be direct and clear. Include specific identifying details. The tone should match the urgency - wanted criminals are described differently than missing children.',
      sections: [
        { id: 'header', name: 'Alert Header', purpose: 'Immediate classification', wordCountTarget: 20, contentGuidance: 'WANTED, REWARD OFFERED, or WARNING. Large and clear.' },
        { id: 'subject', name: 'Subject Description', purpose: 'Identification', wordCountTarget: 100, contentGuidance: 'Name, aliases, physical description, distinguishing marks, known abilities.' },
        { id: 'charges', name: 'Crimes/Reason', purpose: 'Why they are wanted', wordCountTarget: 80, contentGuidance: 'List of offenses or reason for the notice. Specific incidents.' },
        { id: 'reward', name: 'Reward & Contact', purpose: 'Motivate action', wordCountTarget: 60, contentGuidance: 'What is offered. Where to report. Conditions.' },
        { id: 'warnings', name: 'Cautions', purpose: 'Safety information', wordCountTarget: 40, contentGuidance: 'Danger level. Do not approach. Special abilities to watch for.' },
      ],
      wordCount: { min: 250, max: 400 },
      toneKeywords: ['urgent', 'official', 'direct', 'warning', 'authoritative'],
      include: ['specific physical details', 'last known location', 'bounty amount', 'authority seal'],
      avoid: ['ambiguity', 'lengthy prose', 'humor', 'speculation'],
      entityUsage: 'The subject is an entity. Describe them as someone might identify them on sight.',
      eventUsage: 'Events are the crimes or incidents. Reference specific acts.',
      voice: 'Official third person. Terse, declarative sentences. Commands where appropriate.',
    },
  },

  // 7. DIPLOMATIC ACCORD
  {
    id: 'diplomatic-accord',
    name: 'Diplomatic Accord',
    description: 'Treaty, alliance agreement, or formal pact between factions',
    tags: ['document', 'diplomatic', 'treaty', 'formal'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['collective', 'concept'],
      supportingSubjectCategories: ['character', 'place', 'object'],
      roles: [
        { role: 'signatory-faction', count: { min: 2, max: 4 }, description: 'Party to the accord', selectionCriteria: 'Prefer entities from collective category' },
        { role: 'binding-principle', count: { min: 0, max: 2 }, description: 'Law, tradition, or doctrine being established or invoked', selectionCriteria: 'Prefer entities from concept category' },
        { role: 'territorial-subject', count: { min: 0, max: 2 }, description: 'Land or region covered by the accord', selectionCriteria: 'Prefer entities from place category' },
        { role: 'signatory-leader', count: { min: 0, max: 2 }, description: 'Representative who signs on behalf of faction' },
        { role: 'treaty-artifact', count: { min: 0, max: 1 }, description: 'Object exchanged or invoked as guarantee', selectionCriteria: 'Prefer entities from object category' },
      ],
      maxCastSize: 8,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'diplomatic treaty or accord',
      contentInstructions: 'Write as a formal legal document between powers. Use precise diplomatic language. Each article should be clear and enforceable. Include both rights and obligations for all parties. The preamble may be more flowery; the articles must be precise.',
      sections: [
        { id: 'title', name: 'Treaty Title', purpose: 'Name the accord', wordCountTarget: 20, contentGuidance: 'Formal name including parties and purpose.' },
        { id: 'preamble', name: 'Preamble', purpose: 'Establish context', wordCountTarget: 100, contentGuidance: 'Why the parties come together. Shared interests. Diplomatic language.' },
        { id: 'articles', name: 'Articles', purpose: 'Specific terms', wordCountTarget: 300, contentGuidance: 'Numbered articles with clear terms. Rights, obligations, conditions.' },
        { id: 'enforcement', name: 'Enforcement & Duration', purpose: 'Implementation', wordCountTarget: 80, contentGuidance: 'How violations are handled. How long this lasts. Renewal terms.' },
        { id: 'signatures', name: 'Signatures', purpose: 'Formalize agreement', wordCountTarget: 60, contentGuidance: 'Who signs, their titles, date, location of signing.' },
      ],
      wordCount: { min: 500, max: 750 },
      toneKeywords: ['formal', 'precise', 'diplomatic', 'binding', 'ceremonial'],
      include: ['specific obligations', 'mutual commitments', 'enforcement mechanisms', 'formal titles'],
      avoid: ['ambiguous terms', 'one-sided benefits', 'informal language', 'unenforceable clauses'],
      entityUsage: 'Parties are factions or leaders. Use full titles and formal names.',
      eventUsage: 'Events may be what led to the treaty - referenced in preamble as context.',
      voice: 'Third person formal. Legal register. "The parties hereby agree..." style.',
    },
  },

  // 8. TAVERN NOTICE BOARD
  {
    id: 'tavern-notices',
    name: 'Tavern Notice Board',
    description: 'Collection of community postings: jobs, rumors, announcements, personal ads',
    tags: ['document', 'community', 'rumors', 'informal'],
    format: 'document',
    entityRules: cloneDocumentEntityRules(),
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'community notice board collection',
      contentInstructions: 'Write a variety of notices as they would appear on a public board. Each notice has its own voice - from illiterate farmers to pompous nobles to mysterious strangers. Mix mundane (lost cat) with intriguing (strange lights seen). Some notices may reference the same events from different perspectives.',
      sections: [
        { id: 'header', name: 'Board Location', purpose: 'Set the scene', wordCountTarget: 30, contentGuidance: 'Name of establishment. Brief atmosphere.' },
        { id: 'job', name: 'Help Wanted', purpose: 'Work opportunities', wordCountTarget: 80, contentGuidance: 'Someone needs something done. Clear task and payment.' },
        { id: 'rumor', name: 'Local Talk', purpose: 'Gossip and rumors', wordCountTarget: 100, contentGuidance: 'What people are whispering about. May or may not be true.' },
        { id: 'announcement', name: 'Announcements', purpose: 'Public information', wordCountTarget: 80, contentGuidance: 'Upcoming events, changes, official notices.' },
        { id: 'personal', name: 'Personal Notices', purpose: 'Individual needs', wordCountTarget: 80, contentGuidance: 'Seeking companions, lost items, looking for relatives.' },
        { id: 'mysterious', name: 'Curious Posting', purpose: 'Hook for adventure', wordCountTarget: 60, contentGuidance: 'Something intriguing or ominous. Questions unanswered.', optional: true },
      ],
      wordCount: { min: 350, max: 550 },
      toneKeywords: ['varied', 'authentic', 'community', 'informal', 'diverse-voices'],
      include: ['spelling quirks for some posters', 'local slang', 'specific locations', 'realistic requests'],
      avoid: ['modern references', 'all notices sounding the same', 'only dramatic content'],
      entityUsage: 'Entities may post notices or be subjects of rumors. Different social classes write differently.',
      eventUsage: 'Events become rumors and gossip. Different takes on the same events add texture.',
      voice: 'Multiple first-person voices. Each notice reflects its poster - educated or not, local or foreign.',
    },
  },

  // 9. FIELD REPORT
  {
    id: 'field-report',
    name: 'Field Report',
    description: 'Military scout report, expedition log, or reconnaissance document',
    tags: ['document', 'military', 'reconnaissance', 'tactical'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['collective', 'place'],
      supportingSubjectCategories: ['character', 'power', 'object'],
      roles: [
        { role: 'enemy-force', count: { min: 0, max: 2 }, description: 'Hostile faction or army being observed', selectionCriteria: 'Prefer entities from collective category' },
        { role: 'terrain-assessed', count: { min: 0, max: 2 }, description: 'Territory, fortification, or location being reported on', selectionCriteria: 'Prefer entities from place category' },
        { role: 'capability-observed', count: { min: 0, max: 2 }, description: 'Enemy abilities, magic, or weapons noted', selectionCriteria: 'Prefer entities from power category' },
        { role: 'reporting-unit', count: { min: 0, max: 1 }, description: 'Scout or reconnaissance party submitting report' },
        { role: 'strategic-asset', count: { min: 0, max: 1 }, description: 'Resource, weapon, or item of tactical importance', selectionCriteria: 'Prefer entities from object category' },
      ],
      maxCastSize: 6,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'military or expedition field report',
      contentInstructions: 'Write as a professional military or expedition report. Be concise and factual. Focus on tactically relevant information. Include honest assessment of situation. Recommend actions based on observations.',
      sections: [
        { id: 'header', name: 'Report Header', purpose: 'Identify document', wordCountTarget: 50, contentGuidance: 'Classification, date, unit, commander addressed.' },
        { id: 'objective', name: 'Mission & Status', purpose: 'Context', wordCountTarget: 60, contentGuidance: 'What the mission was. Current status of unit.' },
        { id: 'observations', name: 'Observations', purpose: 'Intelligence gathered', wordCountTarget: 200, contentGuidance: 'What was seen, heard, learned. Numbers, positions, movements.' },
        { id: 'encounters', name: 'Encounters', purpose: 'Contacts made', wordCountTarget: 100, contentGuidance: 'Any interactions with hostiles, locals, or allies. Outcomes.' },
        { id: 'assessment', name: 'Tactical Assessment', purpose: 'Analysis', wordCountTarget: 80, contentGuidance: 'What this means. Threats, opportunities, unknowns.' },
        { id: 'recommendations', name: 'Recommendations', purpose: 'Proposed actions', wordCountTarget: 60, contentGuidance: 'What the reporting officer suggests. Specific and actionable.' },
      ],
      wordCount: { min: 450, max: 650 },
      toneKeywords: ['professional', 'concise', 'tactical', 'factual', 'urgent'],
      include: ['numbers and quantities', 'directions and distances', 'time references', 'unit designations'],
      avoid: ['emotional language', 'speculation without marking it', 'irrelevant details', 'casual tone'],
      entityUsage: 'Entities are assets, hostiles, or contacts. Describe tactically - capabilities, positions.',
      eventUsage: 'Events are mission-relevant occurrences. Report with tactical implications.',
      voice: 'First person plural for unit actions. Third person for observations. Military register.',
    },
  },

  // 10. ARTISAN'S CATALOGUE
  {
    id: 'artisans-catalogue',
    name: "Artisan's Catalogue",
    description: 'Detailed catalog of items, artifacts, or creations with descriptions and provenance',
    tags: ['document', 'catalog', 'items', 'artifacts'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['object'],
      supportingSubjectCategories: ['character', 'place', 'power', 'collective'],
      roles: [
        { role: 'catalogued-item', count: { min: 1, max: 3 }, description: 'Artifact, creation, or treasure being documented', selectionCriteria: 'Prefer entities from object category' },
        { role: 'creator-or-owner', count: { min: 0, max: 2 }, description: 'Artisan who made it or notable previous owners' },
        { role: 'provenance-place', count: { min: 0, max: 2 }, description: 'Locations significant to the item history', selectionCriteria: 'Prefer entities from place category' },
        { role: 'associated-power', count: { min: 0, max: 1 }, description: 'Ability or enchantment the item possesses', selectionCriteria: 'Prefer entities from power category' },
      ],
      maxCastSize: 6,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'item catalog or collection inventory',
      contentInstructions: 'Write as a knowledgeable collector or artisan documenting items. Balance technical description with evocative detail. Include provenance where known. Note special properties without being overly clinical. Each item should feel unique and desirable.',
      sections: [
        { id: 'introduction', name: 'Introduction', purpose: 'Frame the catalog', wordCountTarget: 80, contentGuidance: 'What this catalog covers. Notable inclusions. Curator credentials.' },
        { id: 'entry1', name: 'Catalog Entry', purpose: 'Document an item', wordCountTarget: 150, contentGuidance: 'Full description of one significant item. History, properties, significance.' },
        { id: 'entry2', name: 'Second Entry', purpose: 'Another item', wordCountTarget: 150, contentGuidance: 'Different type of item. Contrast with first entry.' },
        { id: 'entry3', name: 'Third Entry', purpose: 'Third item', wordCountTarget: 120, contentGuidance: 'Perhaps a more mysterious or less documented piece.', optional: true },
        { id: 'notes', name: "Curator's Notes", purpose: 'Additional context', wordCountTarget: 60, contentGuidance: 'Patterns observed, items sought, authentication concerns.', optional: true },
      ],
      wordCount: { min: 450, max: 700 },
      toneKeywords: ['knowledgeable', 'appreciative', 'detailed', 'authoritative', 'collector'],
      include: ['physical details', 'provenance', 'special properties', 'comparative value'],
      avoid: ['generic descriptions', 'identical formats for each item', 'excessive jargon'],
      entityUsage: 'Items may be associated with entities as creators or former owners.',
      eventUsage: 'Events give items history - "used in the Battle of X" or "created during the Y crisis."',
      voice: 'First person curatorial. Knowledgeable but accessible. Pride in the collection.',
    },
  },

  // 11. SACRED TEXT
  {
    id: 'sacred-text',
    name: 'Sacred Text',
    description: 'Religious scripture, prophecy, or spiritual teaching from a culture or faith tradition',
    tags: ['document', 'religious', 'spiritual', 'sacred'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['concept', 'power', 'character'],
      supportingSubjectCategories: ['character', 'era', 'place', 'collective'],
      roles: [
        { role: 'divine-teaching', count: { min: 1, max: 2 }, description: 'Doctrine, law, or spiritual truth being revealed', selectionCriteria: 'Prefer entities from concept category' },
        { role: 'sacred-power', count: { min: 0, max: 1 }, description: 'Divine ability, blessing, or cosmic force', selectionCriteria: 'Prefer entities from power category' },
        { role: 'prophesied-era', count: { min: 0, max: 1 }, description: 'Age that was, is, or will be', selectionCriteria: 'Prefer entities from era category' },
        { role: 'divine-figure', count: { min: 0, max: 2 }, description: 'God, prophet, or holy person' },
        { role: 'sacred-place', count: { min: 0, max: 1 }, description: 'Holy site or realm', selectionCriteria: 'Prefer entities from place category' },
      ],
      maxCastSize: 6,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'religious or sacred text',
      contentInstructions: 'Write with reverence and weight appropriate to sacred literature. Use elevated language without being incomprehensible. Include cosmological claims, moral teachings, or prophetic visions. The text should feel ancient and authoritative. May include creation myths, commandments, prophecies, or wisdom teachings.',
      sections: [
        { id: 'invocation', name: 'Invocation', purpose: 'Opening sacred formula', wordCountTarget: 40, contentGuidance: 'Traditional opening. Names of the divine. Blessing on the reader.' },
        { id: 'teaching', name: 'Core Teaching', purpose: 'Central message', wordCountTarget: 200, contentGuidance: 'The main spiritual or moral content. Poetic structure. Memorable phrases.' },
        { id: 'parable', name: 'Parable or Vision', purpose: 'Illustrative story', wordCountTarget: 150, contentGuidance: 'A teaching story, prophetic vision, or divine encounter.', optional: true },
        { id: 'commandments', name: 'Precepts', purpose: 'Moral directives', wordCountTarget: 100, contentGuidance: 'What followers must do or avoid. Stated with authority.' },
        { id: 'blessing', name: 'Closing Blessing', purpose: 'Benediction', wordCountTarget: 50, contentGuidance: 'Final blessing, promise, or warning. Memorable closing.' },
      ],
      wordCount: { min: 400, max: 650 },
      toneKeywords: ['reverent', 'elevated', 'ancient', 'authoritative', 'poetic'],
      include: ['repetition for emphasis', 'metaphor and symbol', 'direct address to faithful', 'cosmic scope'],
      avoid: ['casual language', 'modern idioms', 'uncertainty or hedging', 'irony'],
      entityUsage: 'Divine beings, prophets, or founders may be named. Entities might be subjects of prophecy.',
      eventUsage: 'Mythic events, creation stories, or prophesied future events. Frame as eternal truths.',
      voice: 'Divine voice, prophetic utterance, or ancient sage. Second person for commandments. Third person for narrative.',
    },
  },

  // 12. PROVERBS & SAYINGS
  {
    id: 'proverbs-sayings',
    name: 'Proverbs & Sayings',
    description: 'Collection of folk wisdom, traditional sayings, and cultural aphorisms',
    tags: ['document', 'wisdom', 'folklore', 'cultural'],
    format: 'document',
    entityRules: {
      primarySubjectCategories: ['concept', 'collective'],
      supportingSubjectCategories: ['character', 'place', 'object'],
      roles: [
        { role: 'cultural-value', count: { min: 1, max: 3 }, description: 'Tradition, belief, or principle expressed in the sayings', selectionCriteria: 'Prefer entities from concept category' },
        { role: 'folk-hero', count: { min: 0, max: 2 }, description: 'Legendary figure referenced in proverbs' },
        { role: 'cultural-institution', count: { min: 0, max: 1 }, description: 'Guild, temple, or social group whose wisdom is cited', selectionCriteria: 'Prefer entities from collective category' },
        { role: 'proverbial-place', count: { min: 0, max: 1 }, description: 'Location referenced in cautionary tales', selectionCriteria: 'Prefer entities from place category' },
      ],
      maxCastSize: 6,
    },
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'collection of proverbs and sayings',
      contentInstructions: 'Create authentic-feeling folk wisdom. Proverbs should be pithy, memorable, and reveal cultural values. Use concrete imagery from the world (local animals, weather, trades). Some should be obvious in meaning, others more cryptic. Include contradictory proverbs - real cultures have these.',
      sections: [
        { id: 'introduction', name: 'Introduction', purpose: 'Frame the collection', wordCountTarget: 60, contentGuidance: 'Who uses these sayings. What they reveal about the culture.' },
        { id: 'common', name: 'Common Sayings', purpose: 'Everyday wisdom', wordCountTarget: 120, contentGuidance: '4-6 proverbs about daily life, work, family. Practical wisdom.' },
        { id: 'warnings', name: 'Cautionary Sayings', purpose: 'Warnings and taboos', wordCountTarget: 100, contentGuidance: '3-4 proverbs warning against folly, danger, or moral failure.' },
        { id: 'virtues', name: 'Virtue Sayings', purpose: 'Moral ideals', wordCountTarget: 100, contentGuidance: '3-4 proverbs praising positive qualities valued by the culture.' },
        { id: 'cryptic', name: 'Old Sayings', purpose: 'Ancient wisdom', wordCountTarget: 80, contentGuidance: '2-3 more mysterious proverbs. Meaning debated or lost.', optional: true },
      ],
      wordCount: { min: 350, max: 550 },
      toneKeywords: ['pithy', 'memorable', 'earthy', 'wise', 'traditional'],
      include: ['local imagery', 'rhythm and rhyme where natural', 'concrete metaphors', 'occasional contradictions'],
      avoid: ['modern concepts', 'abstract language', 'lengthy explanations within proverbs', 'forced rhymes'],
      entityUsage: 'Legendary figures might appear in sayings. "As [famous person] learned..." Cultural heroes and fools.',
      eventUsage: 'Historical events become cautionary tales. "Remember the [disaster]" type sayings.',
      voice: 'Collective wisdom. Third person observations. Some in imperative mood.',
    },
  },

  // 13. PRODUCT REVIEWS
  {
    id: 'product-reviews',
    name: 'Product Reviews',
    description: 'Customer testimonials and critiques of goods, services, or establishments',
    tags: ['document', 'commercial', 'reviews', 'informal'],
    format: 'document',
    entityRules: cloneDocumentEntityRules(),
    eventRules: cloneDocumentEventRules(),
    documentConfig: {
      documentType: 'collection of customer reviews',
      contentInstructions: 'Write authentic-feeling reviews with varied voices and opinions. Include glowing reviews, complaints, and nuanced takes. Reviewers have different priorities and writing abilities. Some reviews are helpful, others rambling or petty. Reference specific features, experiences, and comparisons. Use period-appropriate rating systems.',
      sections: [
        { id: 'header', name: 'Subject Header', purpose: 'Identify what is reviewed', wordCountTarget: 30, contentGuidance: 'Name of product/service/place. Vendor. Basic info.' },
        { id: 'positive', name: 'Satisfied Customer', purpose: 'Positive review', wordCountTarget: 100, contentGuidance: 'Enthusiastic review. Specific praise. Would recommend.' },
        { id: 'negative', name: 'Disappointed Customer', purpose: 'Negative review', wordCountTarget: 100, contentGuidance: 'Complaint with specifics. What went wrong. Warning to others.' },
        { id: 'nuanced', name: 'Balanced Review', purpose: 'Mixed opinion', wordCountTarget: 100, contentGuidance: 'Pros and cons. Specific use cases. Qualified recommendation.' },
        { id: 'brief', name: 'Quick Takes', purpose: 'Short reviews', wordCountTarget: 80, contentGuidance: '2-3 very brief reviews. Different perspectives. Varied literacy levels.' },
      ],
      wordCount: { min: 350, max: 500 },
      toneKeywords: ['varied', 'authentic', 'opinionated', 'specific', 'personal'],
      include: ['specific details', 'comparisons to alternatives', 'usage context', 'personality quirks'],
      avoid: ['identical voices', 'all positive or all negative', 'generic praise', 'modern review site language'],
      entityUsage: 'Reviewers are ordinary people. Vendor might be a known entity. Famous customers add credibility.',
      eventUsage: 'Reviews reference occasions. "Bought for the festival" or "Needed after the flood."',
      voice: 'Multiple first-person voices. Varied education levels and personalities. Some formal, some casual.',
    },
  },
];

/**
 * Create a default style library
 */
export function createDefaultStyleLibrary(): StyleLibrary {
  return {
    artisticStyles: [...DEFAULT_ARTISTIC_STYLES],
    compositionStyles: [...DEFAULT_COMPOSITION_STYLES],
    colorPalettes: [...DEFAULT_COLOR_PALETTES],
    narrativeStyles: [...DEFAULT_NARRATIVE_STYLES, ...DEFAULT_DOCUMENT_STYLES],
  };
}

/**
 * Find an artistic style by ID
 */
export function findArtisticStyle(library: StyleLibrary, id: string): ArtisticStyle | undefined {
  return library.artisticStyles.find(s => s.id === id);
}

/**
 * Find a color palette by ID
 */
export function findColorPalette(library: StyleLibrary, id: string): ColorPalette | undefined {
  return library.colorPalettes.find(s => s.id === id);
}

/**
 * Find a composition style by ID
 */
export function findCompositionStyle(library: StyleLibrary, id: string): CompositionStyle | undefined {
  return library.compositionStyles.find(s => s.id === id);
}

/**
 * Find a narrative style by ID
 */
export function findNarrativeStyle(library: StyleLibrary, id: string): NarrativeStyle | undefined {
  return library.narrativeStyles.find(s => s.id === id);
}
