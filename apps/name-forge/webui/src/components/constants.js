export const API_URL = 'http://localhost:3001';

// Lexeme categories for name generation
export const LEXEME_CATEGORIES = {
  // Grammatical
  noun: { label: 'Noun', desc: 'Concrete nouns - objects, things' },
  verb: { label: 'Verb', desc: 'Action words' },
  adjective: { label: 'Adjective', desc: 'Descriptive words' },
  abstract: { label: 'Abstract', desc: 'Concepts, ideas, qualities' },

  // Name components
  title: { label: 'Title', desc: 'Honorifics before names' },
  epithet: { label: 'Epithet', desc: 'Descriptive phrases after names' },
  prefix: { label: 'Prefix', desc: 'Word beginnings that attach to roots' },
  suffix: { label: 'Suffix', desc: 'Word endings that attach to roots' },
  connector: { label: 'Connector', desc: 'Linking words (of, the, von)' },

  // Semantic categories
  place: { label: 'Place Word', desc: 'Geographic/location terms' },
  creature: { label: 'Creature', desc: 'Beasts, monsters, animals' },
  element: { label: 'Element', desc: 'Natural forces and phenomena' },
  material: { label: 'Material', desc: 'Substances and materials' },
  celestial: { label: 'Celestial', desc: 'Heavenly bodies, sky phenomena' },
  color: { label: 'Color', desc: 'Color words' },
  kinship: { label: 'Kinship', desc: 'Family and clan terms' },
  occupation: { label: 'Occupation', desc: 'Roles, jobs, callings' },
  virtue: { label: 'Virtue', desc: 'Positive traits and values' },
  vice: { label: 'Vice', desc: 'Negative traits and flaws' },
  number: { label: 'Number', desc: 'Numeric and ordinal words' },

  // Organization/Group
  collective: { label: 'Collective', desc: 'Group type words (guild, order, brotherhood, council, syndicate)' },
  organization: { label: 'Organization', desc: 'Formal group names (company, house, clan, legion)' },
};

// For backwards compatibility
export const POS_TAGS = Object.keys(LEXEME_CATEGORIES);

export const PROMINENCE_LEVELS = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

export const MARKOV_MODELS = [
  { id: 'norse', name: 'Norse', desc: 'Viking-era Scandinavian names' },
  { id: 'germanic', name: 'Germanic', desc: 'German/Swedish names' },
  { id: 'finnish', name: 'Finnish', desc: 'Uralic language names' },
  { id: 'arabic', name: 'Arabic', desc: 'Semitic language names' },
  { id: 'celtic', name: 'Celtic', desc: 'Irish/Welsh/Gaelic names' },
  { id: 'slavic', name: 'Slavic', desc: 'Russian/Polish/Czech names' },
  { id: 'latin', name: 'Latin/Romance', desc: 'Italian/Spanish/French names' },
  { id: 'japanese', name: 'Japanese', desc: 'Japanese names in romaji' },
  { id: 'african', name: 'African', desc: 'Pan-African names' },
];

export const CONTEXT_KEYS = {
  npcRelations: [
    { key: 'leader', desc: "leader_of relationship (NPC who leads this location/faction)" },
    { key: 'founder', desc: "founder_of relationship (NPC who founded this faction)" },
    { key: 'discoverer', desc: "discovered_by relationship (NPC who discovered this location)" },
    { key: 'mentor', desc: "mentor_of relationship (NPC's mentor)" },
    { key: 'resident', desc: "resident_of relationship (NPC who lives here)" }
  ],
  locationFactionRelations: [
    { key: 'location', desc: "Related location (resident_of, stronghold_of, etc.)" },
    { key: 'faction', desc: "Related faction (member_of, stronghold_of, etc.)" },
    { key: 'birthplace', desc: "birthplace_of relationship (location where NPC was born)" },
    { key: 'stronghold', desc: "stronghold_of relationship (faction's base location)" },
    { key: 'origin', desc: "origin_of relationship (where faction originated)" }
  ]
};

export const COMMON_LITERALS = ['-', "'", "'s", 'of', 'the', 'von', 'de', 'el', 'al'];
