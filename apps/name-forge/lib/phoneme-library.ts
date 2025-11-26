/**
 * Universal Phoneme Library
 *
 * Provides a comprehensive set of phonemes that can be sampled from
 * during optimization. Organized by phonetic categories.
 */

/**
 * Consonant categories based on manner/place of articulation
 */
export const CONSONANT_LIBRARY = {
  // Plosives
  plosives: {
    voiceless: ['p', 't', 'k', 'q'],
    voiced: ['b', 'd', 'g'],
  },

  // Nasals
  nasals: ['m', 'n', 'ŋ', 'ɲ'],

  // Fricatives
  fricatives: {
    voiceless: ['f', 's', 'ʃ', 'x', 'h', 'θ'],
    voiced: ['v', 'z', 'ʒ', 'ð'],
  },

  // Affricates
  affricates: ['tʃ', 'dʒ', 'ts', 'dz'],

  // Approximants
  approximants: ['w', 'j', 'l', 'r', 'ɹ'],

  // Trills/Taps
  trills: ['r', 'ɾ'],

  // Fantasy-friendly additions
  fantasy: ['kh', 'gh', 'th', 'zh', 'ch', 'sh', 'ph'],
};

/**
 * Get all consonants as flat array
 */
export function getAllConsonants(): string[] {
  const all: string[] = [];
  all.push(...CONSONANT_LIBRARY.plosives.voiceless);
  all.push(...CONSONANT_LIBRARY.plosives.voiced);
  all.push(...CONSONANT_LIBRARY.nasals);
  all.push(...CONSONANT_LIBRARY.fricatives.voiceless);
  all.push(...CONSONANT_LIBRARY.fricatives.voiced);
  all.push(...CONSONANT_LIBRARY.affricates);
  all.push(...CONSONANT_LIBRARY.approximants);
  all.push(...CONSONANT_LIBRARY.trills);
  all.push(...CONSONANT_LIBRARY.fantasy);
  return [...new Set(all)]; // Remove duplicates
}

/**
 * Vowel categories
 */
export const VOWEL_LIBRARY = {
  // Basic vowels
  basic: ['a', 'e', 'i', 'o', 'u'],

  // Front vowels
  front: ['i', 'e', 'æ', 'y', 'ø'],

  // Central vowels
  central: ['ə', 'ɨ', 'ʉ'],

  // Back vowels
  back: ['u', 'o', 'ɔ', 'ɑ'],

  // Long vowels (marked with macron or doubled)
  long: ['ā', 'ē', 'ī', 'ō', 'ū', 'aa', 'ee', 'ii', 'oo', 'uu'],

  // Umlauts (common in fantasy)
  umlauts: ['ä', 'ö', 'ü'],

  // Diphthongs
  diphthongs: ['ai', 'au', 'ei', 'oi', 'ou', 'ae', 'oe'],
};

/**
 * Get all vowels as flat array
 */
export function getAllVowels(): string[] {
  const all: string[] = [];
  all.push(...VOWEL_LIBRARY.basic);
  all.push(...VOWEL_LIBRARY.front);
  all.push(...VOWEL_LIBRARY.central);
  all.push(...VOWEL_LIBRARY.back);
  all.push(...VOWEL_LIBRARY.long);
  all.push(...VOWEL_LIBRARY.umlauts);
  all.push(...VOWEL_LIBRARY.diphthongs);
  return [...new Set(all)];
}

/**
 * Common syllable templates
 */
export const TEMPLATE_LIBRARY = {
  // Simple structures
  simple: ['V', 'CV', 'VC', 'CVC'],

  // Complex onsets
  complexOnset: ['CCV', 'CCVC', 'CCCV', 'CCCVC'],

  // Complex codas
  complexCoda: ['CVCC', 'CVCCC', 'VCC'],

  // Both complex
  complex: ['CCVCC', 'CCVCCC', 'CCCVCC'],

  // Vowel-heavy
  vowelHeavy: ['VV', 'CVV', 'VCV', 'CVCV'],
};

/**
 * Get all templates as flat array
 */
export function getAllTemplates(): string[] {
  const all: string[] = [];
  all.push(...TEMPLATE_LIBRARY.simple);
  all.push(...TEMPLATE_LIBRARY.complexOnset);
  all.push(...TEMPLATE_LIBRARY.complexCoda);
  all.push(...TEMPLATE_LIBRARY.complex);
  all.push(...TEMPLATE_LIBRARY.vowelHeavy);
  return [...new Set(all)];
}

/**
 * Common consonant clusters (for cluster mutation)
 */
export const CLUSTER_LIBRARY = {
  // Onset clusters (beginning of syllable)
  onsets: {
    // Stop + liquid
    stopLiquid: ['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'tr'],
    // S + stop
    sStop: ['sp', 'st', 'sk', 'sc'],
    // S + stop + liquid
    sStopLiquid: ['spl', 'spr', 'str', 'scr', 'skr'],
    // Other
    other: ['tw', 'dw', 'kw', 'gw', 'sw', 'thr', 'shr'],
  },

  // Coda clusters (end of syllable)
  codas: {
    // Liquid + stop
    liquidStop: ['lb', 'ld', 'lk', 'lp', 'lt', 'rb', 'rd', 'rk', 'rp', 'rt'],
    // Nasal + stop
    nasalStop: ['mp', 'mb', 'nt', 'nd', 'nk', 'ng'],
    // Stop + s
    stopS: ['ps', 'ts', 'ks'],
    // Other
    other: ['st', 'sk', 'sp', 'ft', 'lf', 'rf', 'rm', 'rn'],
  },
};

/**
 * Get all clusters as flat array
 */
export function getAllClusters(): string[] {
  const all: string[] = [];
  all.push(...CLUSTER_LIBRARY.onsets.stopLiquid);
  all.push(...CLUSTER_LIBRARY.onsets.sStop);
  all.push(...CLUSTER_LIBRARY.onsets.sStopLiquid);
  all.push(...CLUSTER_LIBRARY.onsets.other);
  all.push(...CLUSTER_LIBRARY.codas.liquidStop);
  all.push(...CLUSTER_LIBRARY.codas.nasalStop);
  all.push(...CLUSTER_LIBRARY.codas.stopS);
  all.push(...CLUSTER_LIBRARY.codas.other);
  return [...new Set(all)];
}

/**
 * Morphological structure patterns
 */
export const STRUCTURE_LIBRARY = {
  simple: ['root'],
  prefixed: ['prefix-root', 'prefix-prefix-root'],
  suffixed: ['root-suffix', 'root-suffix-suffix'],
  compound: ['root-root', 'prefix-root-suffix'],
  complex: ['prefix-root-root', 'root-suffix-root'],
};

/**
 * Get all structures as flat array
 */
export function getAllStructures(): string[] {
  const all: string[] = [];
  all.push(...STRUCTURE_LIBRARY.simple);
  all.push(...STRUCTURE_LIBRARY.prefixed);
  all.push(...STRUCTURE_LIBRARY.suffixed);
  all.push(...STRUCTURE_LIBRARY.compound);
  all.push(...STRUCTURE_LIBRARY.complex);
  return [...new Set(all)];
}

/**
 * Style presets for different language "feels"
 */
export const STYLE_PRESETS = {
  harsh: {
    consonants: ['k', 'g', 'x', 'kh', 'gh', 'r', 'z', 'ʒ'],
    vowels: ['a', 'u', 'o', 'ɔ'],
    templates: ['CVC', 'CVCC', 'CCVC'],
    description: 'Guttural, harsh sounds (Orcish, Klingon)',
  },

  flowing: {
    consonants: ['l', 'r', 'n', 'm', 's', 'v', 'th'],
    vowels: ['a', 'e', 'i', 'ā', 'ē', 'ī', 'ai', 'ei'],
    templates: ['CV', 'CVV', 'CVCV', 'VCV'],
    description: 'Smooth, flowing sounds (Elvish, Sindarin)',
  },

  clipped: {
    consonants: ['t', 'k', 'p', 's', 'n', 'r'],
    vowels: ['a', 'e', 'i', 'o', 'u'],
    templates: ['CV', 'CVC', 'VC'],
    description: 'Short, precise sounds (Japanese-inspired)',
  },

  exotic: {
    consonants: ['q', 'x', 'ʃ', 'ʒ', 'tʃ', 'dʒ', 'ŋ'],
    vowels: ['ä', 'ö', 'ü', 'æ', 'ø', 'y'],
    templates: ['CVC', 'CVCC', 'CCV'],
    description: 'Unusual sounds (alien languages)',
  },

  ancient: {
    consonants: ['th', 'kh', 'ph', 'sh', 'n', 'm', 'r', 's'],
    vowels: ['a', 'e', 'i', 'o', 'u', 'ā', 'ē', 'ī', 'ō', 'ū'],
    templates: ['CV', 'CVC', 'CVCV', 'CVCCV'],
    description: 'Classical feel (Greek, Latin inspired)',
  },
};

export type StylePreset = keyof typeof STYLE_PRESETS;

/**
 * Get phonemes not currently in a domain
 */
export function getAvailableConsonants(currentConsonants: string[]): string[] {
  const all = getAllConsonants();
  return all.filter(c => !currentConsonants.includes(c));
}

export function getAvailableVowels(currentVowels: string[]): string[] {
  const all = getAllVowels();
  return all.filter(v => !currentVowels.includes(v));
}

export function getAvailableTemplates(currentTemplates: string[]): string[] {
  const all = getAllTemplates();
  return all.filter(t => !currentTemplates.includes(t));
}

export function getAvailableClusters(currentClusters: string[]): string[] {
  const all = getAllClusters();
  return all.filter(c => !currentClusters.includes(c));
}
