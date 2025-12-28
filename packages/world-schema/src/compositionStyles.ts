/**
 * Composition Style Types and Defaults
 *
 * Defines framing and visual arrangement for image generation.
 */

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
    description: "Bird's eye view from above",
    promptFragment: "aerial view, bird's eye perspective, showing layout and scope",
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
