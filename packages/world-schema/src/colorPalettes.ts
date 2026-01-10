/**
 * Color Palette Types and Defaults
 *
 * Defines color direction for image generation.
 * Each palette uses soft hierarchy language (dominated by, supported by, accents)
 * to guide color distribution without being overly restrictive.
 */

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

export const DEFAULT_COLOR_PALETTES: ColorPalette[] = [
  // ==========================================================================
  // Hue-Anchored Palettes (8)
  // ==========================================================================
  {
    id: 'crimson-dynasty',
    name: 'Crimson Dynasty',
    description: 'Deep ceremonial reds with dramatic contrast',
    promptFragment:
      'COLOR PALETTE: dominated by deep crimsons and burgundy wine, ' +
      'grounded in charcoal black shadows, antique gold metallic accents sparingly placed, ' +
      'dramatic value contrast, no orange or brown tones',
  },
  {
    id: 'amber-blaze',
    name: 'Amber Blaze',
    description: 'Pure warm oranges with cream and espresso',
    promptFragment:
      'COLOR PALETTE: dominated by pure amber and tangerine orange, ' +
      'supported by warm cream and vanilla tones, espresso brown accents for depth, ' +
      'luminous warmth, no reds no browns in main areas',
  },
  {
    id: 'gilded-sunlight',
    name: 'Gilded Sunlight',
    description: 'Radiant golds and yellows, bright and optimistic',
    promptFragment:
      'COLOR PALETTE: dominated by radiant golden yellow and saffron, ' +
      'supported by ivory and champagne backgrounds, bronze metallic accents, ' +
      'bright and luminous, no orange, no brown',
  },
  {
    id: 'verdant-jungle',
    name: 'Verdant Jungle',
    description: 'Saturated tropical greens with coral pop',
    promptFragment:
      'COLOR PALETTE: dominated by saturated emerald and jungle green, ' +
      'supported by pale mint and seafoam, bright coral accents sparingly, ' +
      'lush tropical vibrancy, no brown no earth tones',
  },
  {
    id: 'arctic-cyan',
    name: 'Arctic Cyan',
    description: 'Cool teals and cyans with crystalline clarity',
    promptFragment:
      'COLOR PALETTE: dominated by cyan and teal, turquoise highlights, ' +
      'supported by ice white and pale aqua, deep navy accents for contrast, ' +
      'crystalline aquatic clarity, cool temperature throughout, no green',
  },
  {
    id: 'midnight-sapphire',
    name: 'Midnight Sapphire',
    description: 'Deep blues with silver accents',
    promptFragment:
      'COLOR PALETTE: dominated by deep sapphire and navy blue, cobalt tones, ' +
      'supported by steel gray and slate, metallic silver accents, ' +
      'nocturnal depth, no purple no cyan',
  },
  {
    id: 'electric-magenta',
    name: 'Electric Magenta',
    description: 'Bold magentas with electric teal contrast',
    promptFragment:
      'COLOR PALETTE: dominated by bold magenta and fuchsia, hot pink highlights, ' +
      'supported by pale pink and blush white, electric teal accents for contrast, ' +
      'vibrant high-energy, modern boldness, no purple no red',
  },
  {
    id: 'borealis',
    name: 'Borealis',
    description: 'Aurora lights glowing against dark polar sky',
    promptFragment:
      'COLOR PALETTE: electric green and cyan aurora ribbons, pink and violet wisps, ' +
      'against deep indigo and black polar sky, star white points, ' +
      'ethereal luminous glow, lights should pop against darkness',
  },

  // ==========================================================================
  // Special Character Palettes (3)
  // ==========================================================================
  {
    id: 'monochrome-noir',
    name: 'Monochrome Noir',
    description: 'Pure grayscale with extreme contrast',
    promptFragment:
      'COLOR PALETTE: pure grayscale only, dominated by charcoal and medium grays, ' +
      'stark white highlights, jet black shadows, extreme value contrast, ' +
      'no color saturation whatsoever, dramatic chiaroscuro',
  },
  {
    id: 'volcanic-obsidian',
    name: 'Volcanic Obsidian',
    description: 'Black dominant with rare molten glow',
    promptFragment:
      'COLOR PALETTE: dominated by obsidian black and volcanic dark tones, ' +
      'supported by ash gray and charcoal, rare molten orange-red glow accents only, ' +
      'primarily darkness with minimal fire, ember light should be scarce and precious',
  },
  {
    id: 'verdigris-patina',
    name: 'Verdigris Patina',
    description: 'Aged copper greens with rust accents',
    promptFragment:
      'COLOR PALETTE: dominated by verdigris teal-green and patina oxidation, ' +
      'supported by weathered bronze and aged copper brown, rust orange accents sparingly, ' +
      'teal-green should dominate not brown, aged metal character',
  },

  // ==========================================================================
  // High-Contrast Pairs (4)
  // ==========================================================================
  {
    id: 'blood-ivory',
    name: 'Blood & Ivory',
    description: 'Stark arterial red against bone white',
    promptFragment:
      'COLOR PALETTE: high contrast, arterial red and blood crimson ' +
      'against bone ivory and aged parchment white, absolute black accents only, ' +
      'stark two-color drama, visceral and bold, minimal color mixing',
  },
  {
    id: 'ink-gold',
    name: 'Ink & Gold',
    description: 'Jet black dominant with precious gold illumination',
    promptFragment:
      'COLOR PALETTE: high contrast, dominated by deep ink black and jet darkness, ' +
      'metallic gold and burnished gilt as primary accent, minimal other colors, ' +
      'luxurious darkness with precious metal light, graphic and bold, like gilt lettering on black lacquer',
  },
  {
    id: 'jade-obsidian',
    name: 'Jade & Obsidian',
    description: 'Precious jade green against volcanic black',
    promptFragment:
      'COLOR PALETTE: high contrast, rich jade green and celadon ' +
      'against obsidian black and deep shadow, ivory white accents sparingly, ' +
      'stark two-tone drama, like jade carvings on black silk, no other colors',
  },
  {
    id: 'azure-bone',
    name: 'Azure & Bone',
    description: 'Deep azure blue against stark ivory',
    promptFragment:
      'COLOR PALETTE: high contrast, deep azure and ultramarine blue ' +
      'against bone white and ivory, charcoal black accents sparingly, ' +
      'cool stark drama, like blue ink on parchment or Delft pottery, no other colors',
  },
];
