/**
 * Penguin Domain Lore Provider
 *
 * Domain-specific implementation of the DomainLoreProvider interface.
 * Contains all penguin-specific lore, naming rules, and enrichment prompts.
 */

import {
  DomainLoreProvider,
  CulturalGroup,
  NamingRules,
  GeographyConstraints
} from './llm/types';

export const penguinLoreProvider: DomainLoreProvider = {
  getWorldName: () => "Super Penguin Colonies of Aurora Berg",

  getCanonFacts: () => [
    'Two main colonies with trade and communication',
    'Ice magic exists but has costs',
    'Pre-penguin artifacts are in the berg',
    'Glow-Fissure is recent',
    'Frost Guard neutrality, Deep Singers knowledge'
  ],

  getCulturalGroups: (): CulturalGroup[] => [
    {
      name: 'Aurora Stack',
      values: ['commerce', 'tradition', 'recorded history'],
      style: 'orderly terraces, trade banners, sunlit face',
      notes: ['practical names', 'mayors serve until igloo melts', 'slogan: The tide lifts all boats']
    },
    {
      name: 'Nightfall Shelf',
      values: ['independence', 'innovation', 'ancestral memory'],
      style: 'shadow-side ledges, bioluminescent ice, rope bridges',
      notes: ['poetic names', 'elder council', 'slogan: The depths remember what the surface forgets']
    },
    {
      name: 'Windward Ridge',
      values: ['scouting', 'weather watch'],
      style: 'watchtower settlement'
    },
    {
      name: 'The Middle Pools',
      values: ['neutrality', 'shared fishing'],
      style: 'neutral fishing grounds'
    },
    {
      name: 'Echo Hollow',
      values: ['mystery'],
      style: 'abandoned, echoes of the past'
    }
  ],

  getNamingRules: (): NamingRules => ({
    patterns: [
      'Two-part names: ice name (birth) + earned name (First Dive deed)',
      'Aurora Stack names are shorter and practical',
      'Nightfall Shelf names are more poetic or descriptive'
    ],
    toneGuidance: {
      'Aurora Stack': 'practical, trade-focused, concise',
      'Nightfall Shelf': 'poetic, mysterious, innovative'
    },
    earnedNameRules: 'Earned names reflect memorable deeds (the Steady, Quick-Current, Deep-Seeker)'
  }),

  getRelationshipPatterns: () => [
    'Cross-colony relationships are rare but significant',
    'Mentor-apprentice bonds cross family lines but rarely colony lines',
    'Frost Guard recruits from both colonies to stay neutral',
    'Deep Singers often abandon colony identity'
  ],

  getTechnologyNotes: () => [
    'Technology is communal and reliable (harmonic harpoons, krill nets, ice augers)',
    'Glow Stones, Message Ice, and Slide Wax are daily tools',
    'Ice coins melt on schedule to keep trade flowing'
  ],

  getMagicSystemNotes: () => [
    'Ice Magic (Old Flows): frost shaping, deep sight, ice memory, aurora calling',
    'Magic has costs (ice fever) and requires cold meditation',
    'Magic is personal/old; technology is new/communal'
  ],

  getConflictPatterns: () => [
    'Fissure rights and artifact control',
    'Krill scarcity and fishing territory',
    'Trade imbalance and melting ice coins',
    'Lost expeditions near Starfall Reach'
  ],

  getGeographyConstraints: (): GeographyConstraints => ({
    scale: '10 sq km of surface',
    characteristics: ['vertical depth matters', 'secret passages exist', 'ice berg environment']
  }),

  getActionDomainDescriptions: () => ({
    political: 'governance, alliances, territorial claims',
    military: 'warfare, raids, defense, sieges',
    economic: 'trade, resource control, blockades',
    magical: 'ice magic manipulation, mystical forces',
    technological: 'innovation, tool development, weaponization',
    environmental: 'natural forces, ice drift, krill migration',
    cultural: 'ideology spread, conversion, inspiration',
    conflict_escalation: 'war intensification, faction recruitment',
    disaster_spread: 'catastrophe expansion, corruption spreading'
  }),

  getEntityEnrichmentPrompt: (kind: string, subtype: string): string | null => {
    if (kind === 'occurrence') {
      if (subtype === 'war') {
        return 'This is a military conflict between penguin factions. Describe the war\'s strategic objectives (fishing grounds, berg positions, artifact control), territorial stakes, and impact on ice colonies. Keep it grounded in ice warfare with frozen defenses and naval tactics. Focus on what makes this conflict unique.';
      }
      if (subtype === 'magical_disaster') {
        return 'This is a magical catastrophe caused by ice magic instability. Describe the mystical manifestation (aurora storms, ice fever spread, frozen time anomalies), the danger to penguins, and what ancient forces might be awakening. Stay within Old Flows magic system.';
      }
      if (subtype === 'cultural_movement') {
        return 'This is a cultural or ideological movement spreading through penguin society. Describe the core belief, why it resonates with certain colonies, and the social changes it demands. Reference the tension between Aurora Stack tradition and Nightfall Shelf innovation.';
      }
      if (subtype === 'economic_boom') {
        return 'This is a period of economic prosperity driven by trade or resource discovery. Describe the new economic opportunities (krill blooms, ice coin circulation, trade routes), which factions benefit, and the social changes wealth brings.';
      }
    }

    if (kind === 'era') {
      if (subtype === 'expansion') {
        return 'This is an era of territorial expansion and discovery. Describe the driving forces pushing penguins to explore new parts of the berg, what resources or territory they seek, and the pioneering spirit or desperation motivating exploration.';
      }
      if (subtype === 'conflict') {
        return 'This is an era of widespread conflict between factions. Describe the root causes of war (resource scarcity, ideological splits, territorial disputes), major battlefronts, and how constant warfare shapes penguin society.';
      }
      if (subtype === 'innovation') {
        return 'This is an era of technological and cultural innovation. Describe the breakthroughs being made (new tools, techniques, social structures), which colonies lead innovation, and how tradition clashes with progress.';
      }
      if (subtype === 'invasion') {
        return 'This is an era of external threat to penguin civilization. Describe the nature of the threat (orcas, environmental catastrophe, ancient forces), how penguins respond, and the desperate alliances formed for survival.';
      }
      if (subtype === 'reconstruction') {
        return 'This is an era of rebuilding after major conflict or disaster. Describe the damage being repaired (physical, social, cultural), new power structures emerging, and how penguins reimagine their society.';
      }
    }

    if (kind === 'npc' && subtype === 'hero') {
      return 'This is a renowned penguin hero. Use two-part naming (birth name + earned title). Earned titles should reflect their greatest deed. Keep descriptions under 50 words.';
    }

    if (kind === 'location' && subtype === 'anomaly') {
      return 'This is a mystical or unusual location with strange properties. Describe the anomaly (glowing ice, time distortions, singing caves) and its danger or value to penguins. Stay within Old Flows magic canon.';
    }

    return null;
  },

  getRelationshipEnrichmentPrompt: (kind: string): string | null => {
    if (kind === 'allied_with') {
      return 'Alliances between penguin factions are pragmatic (shared enemies, trade benefits) or ideological (shared beliefs). Describe what brought them together and what keeps the alliance stable or fragile.';
    }
    if (kind === 'enemy_of' || kind === 'rival_of') {
      return 'Rivalries stem from resource competition, ideological differences, or past betrayals. Describe the inciting incident and current stakes. Penguin conflicts often involve fishing rights, territory, or artifact control.';
    }
    if (kind === 'at_war_with') {
      return 'War between penguin factions is serious - fought over vital resources (krill, territory, Glow-Fissure access) or irreconcilable beliefs. Describe the casus belli and what victory means for each side.';
    }
    return null;
  },

  getOccurrenceEnrichmentPrompt: (subtype: string): string | null => {
    // Same as getEntityEnrichmentPrompt for occurrence
    return penguinLoreProvider.getEntityEnrichmentPrompt('occurrence', subtype);
  },

  getEraEnrichmentPrompt: (subtype: string): string | null => {
    // Same as getEntityEnrichmentPrompt for era
    return penguinLoreProvider.getEntityEnrichmentPrompt('era', subtype);
  },

  // Validation terms for LLM output quality checking
  getGeographicTerms: (): string[] => [
    'shelf', 'ridge', 'hollow', 'stack', 'pools', 'reach', 'pass',
    'peak', 'bridge', 'valley', 'cavern', 'grotto', 'ledge', 'terrace'
  ],

  getMysticalTerms: (): string[] => [
    'glow', 'aurora', 'singing', 'echo', 'frozen', 'ancient',
    'crystal', 'mirror', 'shadow', 'lost'
  ],

  getLoreCues: (): string[] => [
    'aurora', 'ice', 'berg', 'fissure', 'current', 'frost',
    'glow', 'krill', 'coin', 'sing'
  ]
};
