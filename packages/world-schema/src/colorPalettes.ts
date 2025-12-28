/**
 * Color Palette Types and Defaults
 *
 * Defines color direction for image generation.
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
