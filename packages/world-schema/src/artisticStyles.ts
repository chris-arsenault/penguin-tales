/**
 * Artistic Style Types and Defaults
 *
 * Defines visual rendering approaches for image generation.
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
  // New styles
  {
    id: 'hyperdetailed-charcoal',
    name: 'Hyperdetailed Charcoal with Color',
    description: 'Intricate charcoal drawing with vivid color accents',
    promptFragment: 'hyperdetailed charcoal drawing, intricate textures, deep blacks, dramatic shading, splashes of bright saturated color breaking through the monochrome, selective color highlights, fine art quality',
    keywords: ['charcoal', 'hyperdetailed', 'selective-color', 'dramatic'],
  },
  {
    id: 'hdr-nature-photography',
    name: '4K HDR Nature Photography',
    description: 'Ultra-realistic nature photography with HDR processing',
    promptFragment: '4K HDR nature photography, ultra high resolution, stunning dynamic range, vivid natural colors, professional wildlife or landscape shot, National Geographic quality, sharp focus, natural lighting',
    keywords: ['photography', 'HDR', 'nature', 'realistic'],
  },
  {
    id: 'cinematic-still',
    name: 'Cinematic Film Still',
    description: 'Dramatic movie scene with cinematic color grading',
    promptFragment: 'cinematic film still, anamorphic lens, dramatic lighting, film grain, professional cinematography, color graded, 35mm film aesthetic, atmospheric depth',
    keywords: ['cinematic', 'film', 'dramatic', 'atmospheric'],
  },
  {
    id: 'ukiyo-e',
    name: 'Ukiyo-e Woodblock',
    description: 'Traditional Japanese woodblock print style',
    promptFragment: 'ukiyo-e style, Japanese woodblock print, flat color areas, bold outlines, traditional Edo period aesthetic, waves and nature motifs, organic flowing lines, limited color palette',
    keywords: ['japanese', 'traditional', 'woodblock', 'flat-color'],
  },
  {
    id: 'baroque-chiaroscuro',
    name: 'Baroque Chiaroscuro',
    description: 'Dramatic contrast in the style of Caravaggio',
    promptFragment: 'baroque chiaroscuro, dramatic tenebrism, deep shadows against illuminated subjects, Caravaggio style, rich oil pigments, theatrical lighting, Renaissance master painting technique',
    keywords: ['baroque', 'dramatic', 'contrast', 'classical'],
  },
  // Artifact-focused styles
  {
    id: 'manuscript-page',
    name: 'Illuminated Manuscript',
    description: 'Medieval illuminated manuscript with gold leaf and intricate borders',
    promptFragment: 'illuminated manuscript page, medieval codex style, gold leaf details, intricate decorative borders, calligraphic text suggestions, vellum texture, ornamental initial letters, monastic scriptorium quality, rich pigments on parchment',
    keywords: ['manuscript', 'medieval', 'illuminated', 'artifact'],
  },
  {
    id: 'encyclopedia-plate',
    name: 'Encyclopedia Illustration',
    description: 'Scientific encyclopedia plate with detailed technical rendering',
    promptFragment: 'encyclopedia illustration plate, detailed technical drawing, scientific accuracy, annotated diagram style, naturalist illustration, cross-section views, precise linework, educational illustration, Victorian-era scientific plate aesthetic',
    keywords: ['encyclopedia', 'scientific', 'technical', 'detailed'],
  },
  {
    id: 'museum-catalog',
    name: 'Museum Catalog',
    description: 'High-quality museum photography with neutral background',
    promptFragment: 'museum artifact photography, neutral gray background, professional studio lighting, archival documentation quality, multiple angle consideration, scale reference implied, pristine preservation, academic catalog standard',
    keywords: ['museum', 'catalog', 'artifact', 'archival'],
  },
];
