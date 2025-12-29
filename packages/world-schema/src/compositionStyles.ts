/**
 * Composition Style Types and Defaults
 *
 * Defines framing and visual arrangement for image generation.
 */

import type { EntityCategory } from './entityKind.js';

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
  /**
   * Target entity category this composition is best suited for.
   * Used to filter/suggest compositions based on entity kind's category.
   * If undefined, composition is considered universal.
   */
  targetCategory?: EntityCategory;
}

export const DEFAULT_COMPOSITION_STYLES: CompositionStyle[] = [
  // ===========================
  // CHARACTER compositions
  // ===========================
  {
    id: 'portrait',
    name: 'Portrait',
    description: 'Head and shoulders portrait',
    promptFragment: 'portrait composition, head and shoulders, focused on face, eye contact',
    targetCategory: 'character',
  },
  {
    id: 'full-body',
    name: 'Full Body',
    description: 'Full figure standing pose',
    promptFragment: 'full body view, character standing, showing attire and posture, clear silhouette',
    targetCategory: 'character',
  },
  {
    id: 'bust',
    name: 'Bust',
    description: 'Upper body portrait with more context',
    promptFragment: 'bust composition, upper body visible, showing costume details, medium shot',
    targetCategory: 'character',
  },
  {
    id: 'action',
    name: 'Action Scene',
    description: 'Dynamic action moment',
    promptFragment: 'dynamic action pose, motion blur, dramatic angle, tension, movement',
    targetCategory: 'character',
  },
  {
    id: 'action-duel',
    name: 'Action: Duel',
    description: 'Focused one-on-one combat or standoff',
    promptFragment: 'dynamic duel, close-quarters combat, two figures in motion, dramatic tension, focused framing',
    targetCategory: 'character',
  },
  {
    id: 'action-chase',
    name: 'Action: Chase',
    description: 'High-speed pursuit with strong motion',
    promptFragment: 'high-speed chase, motion blur, strong leading lines, sense of pursuit, dynamic perspective',
    targetCategory: 'character',
  },

  // ===========================
  // COLLECTIVE compositions
  // ===========================
  {
    id: 'logo-mark',
    name: 'Logo Mark',
    description: 'Iconic emblem or brand mark for factions and organizations',
    promptFragment: 'logo design, iconic emblem, clean geometric shapes, centered composition, flat colors, negative space, scalable vector style, brand identity, minimal',
    targetCategory: 'collective',
  },
  {
    id: 'badge-crest',
    name: 'Badge Crest',
    description: 'Heraldic crest or insignia in a badge form',
    promptFragment: 'heraldic emblem, crest design, symmetrical composition, iconic symbol, shield or banner form, unified color palette, insignia',
    targetCategory: 'collective',
  },
  {
    id: 'group-scene',
    name: 'Group Scene',
    description: 'Multiple figures in composition',
    promptFragment: 'group composition, multiple figures, unified aesthetic, collective identity',
    targetCategory: 'collective',
  },
  {
    id: 'action-battle',
    name: 'Action: Battle',
    description: 'Large-scale clash with multiple combatants',
    promptFragment: 'chaotic battle scene, multiple figures, sweeping movement, dust and debris, wide dynamic composition',
    targetCategory: 'collective',
  },

  // ===========================
  // PLACE compositions
  // ===========================
  {
    id: 'establishing-shot',
    name: 'Establishing Shot',
    description: 'Wide environmental shot',
    promptFragment: 'wide establishing shot, environmental storytelling, sense of scale, cinematic',
    targetCategory: 'place',
  },
  {
    id: 'interior',
    name: 'Interior View',
    description: 'Interior space with atmosphere',
    promptFragment: 'interior view, atmospheric lighting, detailed environment, lived-in feeling',
    targetCategory: 'place',
  },
  {
    id: 'aerial',
    name: 'Aerial View',
    description: "Bird's eye view from above",
    promptFragment: "aerial view, bird's eye perspective, showing layout and scope",
    targetCategory: 'place',
  },
  {
    id: 'cityscape',
    name: 'Cityscape',
    description: 'Urban skyline with architectural silhouettes',
    promptFragment: 'cityscape view, urban skyline, layered architecture, rooftops and spires, atmospheric depth, twilight or dawn lighting, sense of settlement scale',
    targetCategory: 'place',
  },
  {
    id: 'map-view',
    name: 'Map View',
    description: 'Stylized cartographic perspective',
    promptFragment: 'illustrated map view, cartographic style, labeled landmarks, hand-drawn aesthetic, parchment or vellum texture, compass rose, decorative borders',
    targetCategory: 'place',
  },
  {
    id: 'bustling-streets',
    name: 'Bustling Streets',
    description: 'Street-level view with crowd activity',
    promptFragment: 'street level perspective, crowded thoroughfare, market activity, figures in motion, vendor stalls, hanging signs, lived-in atmosphere, dynamic street life',
    targetCategory: 'place',
  },
  {
    id: 'landmark-focus',
    name: 'Landmark Focus',
    description: 'Architectural focal point with dramatic framing',
    promptFragment: 'architectural focal point, monumental structure, low angle dramatic perspective, sky backdrop, sense of grandeur, iconic silhouette, pilgrimage destination',
    targetCategory: 'place',
  },
  {
    id: 'district-view',
    name: 'District View',
    description: 'Neighborhood or quarter perspective showing character',
    promptFragment: 'district overview, neighborhood character, mixed building heights, winding streets, local atmosphere, community feeling, distinct architectural style',
    targetCategory: 'place',
  },

  // ===========================
  // OBJECT compositions
  // ===========================
  {
    id: 'object-study',
    name: 'Object Study',
    description: 'Focused object with dramatic lighting',
    promptFragment: 'object study, dramatic lighting, showing scale and detail, museum quality',
    targetCategory: 'object',
  },
  {
    id: 'display-case',
    name: 'Display Case',
    description: 'Artifact presented in museum display case',
    promptFragment: 'museum display case presentation, glass enclosure, carefully lit from multiple angles, velvet or neutral pedestal, subtle reflections, archival preservation context, reverent display',
    targetCategory: 'object',
  },
  {
    id: 'artifact-diagram',
    name: 'Artifact Diagram',
    description: 'Technical diagram with annotations and cross-sections',
    promptFragment: 'technical artifact diagram, exploded view, cross-section annotations, measurement indicators, multiple angle views, scientific illustration style, detailed construction breakdown',
    targetCategory: 'object',
  },
  {
    id: 'relic-altar',
    name: 'Relic Altar',
    description: 'Sacred presentation on ceremonial altar or shrine',
    promptFragment: 'sacred altar presentation, ceremonial shrine setting, devotional lighting, candles or incense suggested, religious reverence, offering context, mystical atmosphere',
    targetCategory: 'object',
  },
  {
    id: 'treasure-hoard',
    name: 'Treasure Hoard',
    description: 'Artifact among treasures, showing context and wealth',
    promptFragment: 'treasure hoard context, surrounded by coins and jewels, discovery moment, dramatic cave or vault lighting, archaeological find, sense of abundance and value',
    targetCategory: 'object',
  },

  // ===========================
  // CONCEPT compositions
  // ===========================
  {
    id: 'symbolic',
    name: 'Symbolic',
    description: 'Allegorical or symbolic representation',
    promptFragment: 'symbolic representation, iconographic, allegorical, conceptual',
    targetCategory: 'concept',
  },

  // ===========================
  // EVENT compositions
  // ===========================
  {
    id: 'chronicle-panorama',
    name: 'Chronicle Panorama',
    description: 'Panoramic scene for chronicle headings',
    promptFragment: 'panoramic scene, sweeping vista, layered depth, cinematic horizon, spacious composition, chapter heading framing',
    targetCategory: 'event',
  },
];
