/**
 * Style Library Types
 *
 * Defines artistic and composition styles for image generation.
 * Styles are stored in project config and referenced by cultures for defaults.
 */

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
  /** Entity kinds this composition is suitable for (empty = all) */
  suitableForKinds?: string[];
}

/**
 * Style library - collection of available styles
 */
export interface StyleLibrary {
  artisticStyles: ArtisticStyle[];
  compositionStyles: CompositionStyle[];
}

/**
 * Style selection for image generation
 */
export interface StyleSelection {
  /** Selected artistic style ID, or 'culture-default' to use culture's default */
  artisticStyleId?: string;
  /** Selected composition style ID, or 'culture-default' to use culture's default */
  compositionStyleId?: string;
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
    suitableForKinds: ['npc'],
  },
  {
    id: 'full-body',
    name: 'Full Body',
    description: 'Full figure standing pose',
    promptFragment: 'full body view, character standing, showing attire and posture, clear silhouette',
    suitableForKinds: ['npc'],
  },
  {
    id: 'bust',
    name: 'Bust',
    description: 'Upper body portrait with more context',
    promptFragment: 'bust composition, upper body visible, showing costume details, medium shot',
    suitableForKinds: ['npc'],
  },
  {
    id: 'establishing-shot',
    name: 'Establishing Shot',
    description: 'Wide environmental shot',
    promptFragment: 'wide establishing shot, environmental storytelling, sense of scale, cinematic',
    suitableForKinds: ['location'],
  },
  {
    id: 'interior',
    name: 'Interior View',
    description: 'Interior space with atmosphere',
    promptFragment: 'interior view, atmospheric lighting, detailed environment, lived-in feeling',
    suitableForKinds: ['location'],
  },
  {
    id: 'aerial',
    name: 'Aerial View',
    description: 'Bird\'s eye view from above',
    promptFragment: 'aerial view, bird\'s eye perspective, showing layout and scope',
    suitableForKinds: ['location'],
  },
  {
    id: 'group-scene',
    name: 'Group Scene',
    description: 'Multiple figures in composition',
    promptFragment: 'group composition, multiple figures, unified aesthetic, collective identity',
    suitableForKinds: ['faction'],
  },
  {
    id: 'symbolic',
    name: 'Symbolic',
    description: 'Allegorical or symbolic representation',
    promptFragment: 'symbolic representation, iconographic, allegorical, conceptual',
    suitableForKinds: ['faction', 'era'],
  },
  {
    id: 'action',
    name: 'Action Scene',
    description: 'Dynamic action moment',
    promptFragment: 'dynamic action pose, motion blur, dramatic angle, tension, movement',
    suitableForKinds: ['npc', 'occurrence'],
  },
  {
    id: 'object-study',
    name: 'Object Study',
    description: 'Focused object with dramatic lighting',
    promptFragment: 'object study, dramatic lighting, showing scale and detail, museum quality',
    suitableForKinds: ['artifact'],
  },
];

/**
 * Create a default style library
 */
export function createDefaultStyleLibrary(): StyleLibrary {
  return {
    artisticStyles: [...DEFAULT_ARTISTIC_STYLES],
    compositionStyles: [...DEFAULT_COMPOSITION_STYLES],
  };
}

/**
 * Find an artistic style by ID
 */
export function findArtisticStyle(library: StyleLibrary, id: string): ArtisticStyle | undefined {
  return library.artisticStyles.find(s => s.id === id);
}

/**
 * Find a composition style by ID
 */
export function findCompositionStyle(library: StyleLibrary, id: string): CompositionStyle | undefined {
  return library.compositionStyles.find(s => s.id === id);
}

/**
 * Get composition styles suitable for an entity kind
 */
export function getCompositionStylesForKind(library: StyleLibrary, kind: string): CompositionStyle[] {
  return library.compositionStyles.filter(s =>
    !s.suitableForKinds || s.suitableForKinds.length === 0 || s.suitableForKinds.includes(kind)
  );
}
