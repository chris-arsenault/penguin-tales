/**
 * Narrative Style Types and Defaults
 *
 * Defines story-based narrative styles for chronicle generation.
 */

import type { EntityCategory } from './entityKind.js';

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

/**
 * Narrative format type - distinguishes stories from documents
 */
export type NarrativeFormat = 'story' | 'document';

/**
 * Base narrative style - common fields for all narrative types
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

/**
 * Story narrative style - for traditional narrative stories
 */
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

export const DEFAULT_NARRATIVE_STYLES: StoryNarrativeStyle[] = [
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
    description: "Classic hero's journey with clear good and evil, trials, and triumphant resolution",
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
      { id: 'fall', name: 'The Fall', purpose: 'Consequences unfold', requiredElements: ['things falling apart', "protagonist's blindness", 'cost to others'], emotionalArc: 'denial → struggle → desperation' },
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
      { id: 'false-trail', name: 'The False Trail', purpose: 'Mislead toward wrong conclusion', requiredElements: ['apparently damning evidence', 'almost-solution', "something doesn't fit"], emotionalArc: 'certainty → doubt' },
      { id: 'revelation', name: 'The Revelation', purpose: 'True answer revealed', requiredElements: ['the missing piece', 'recontextualization', 'confrontation'], emotionalArc: 'confusion → clarity → consequence' },
    ],
    pacing: {
      totalWordCount: { min: 1500, max: 2000 },
      sceneCount: { min: 4, max: 5 },
    },
    proseDirectives: {
      toneKeywords: ['suspicious', 'tense', 'uncertain', 'curious', 'revelatory'],
      dialogueStyle: 'Everyone has something to hide. Evasions. Slips. Careful word choice.',
      descriptionStyle: "Notice everything. What's out of place. What doesn't fit. Clues hidden in detail.",
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
