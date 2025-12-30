/**
 * Narrative Style Types and Defaults
 *
 * Defines story-based narrative styles for chronicle generation.
 *
 * Design principle: Freeform text blocks over structured micro-fields.
 * The LLM works best with natural language guidance, not fragmented config.
 */

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
  /** Optional selection criteria hint (used by document styles) */
  selectionCriteria?: string;
}

/**
 * Pacing configuration - simple numeric ranges
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
 * Story narrative style - simplified structure with freeform text blocks
 *
 * Instead of dozens of structured fields that get fragmented in prompts,
 * we use a few rich text blocks that flow naturally into generation prompts.
 */
export interface StoryNarrativeStyle {
  format: 'story';

  // === Metadata ===
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description shown in UI */
  description: string;
  /** Tags for categorization */
  tags?: string[];

  // === Freeform Text Blocks (injected directly into prompts) ===

  /**
   * Narrative structure instructions - how to build the story.
   * Includes: plot structure, scene progression, emotional arcs, beats.
   * This is the primary guidance for story construction.
   */
  narrativeInstructions: string;

  /**
   * Prose style instructions - how to write the story.
   * Includes: tone, dialogue style, description approach, pacing notes, what to avoid.
   */
  proseInstructions: string;

  /**
   * Event usage instructions - how to incorporate world events.
   * Optional - only needed if events require special handling.
   */
  eventInstructions?: string;

  // === Structured Data (genuinely useful as structured) ===

  /** Cast roles - what positions exist in this narrative */
  roles: RoleDefinition[];

  /** Pacing - word count and scene count ranges */
  pacing: PacingConfig;
}

export const DEFAULT_NARRATIVE_STYLES: StoryNarrativeStyle[] = [
  // 1. EPIC DRAMA
  {
    id: 'epic-drama',
    name: 'Epic Drama',
    description: 'Grand, sweeping narratives with world-shaking stakes and fateful confrontations',
    tags: ['dramatic', 'high-stakes', 'grand'],
    format: 'story',

    narrativeInstructions: `Structure this as an epic historical drama with the weight of myth. The narrative should feel like a chronicle being told by future generations who already know how it ends.

Scene Progression:
1. THE OMEN: Begin in medias res or with an ominous portent. Establish the world through sensory details that convey both grandeur and fragility. Show the protagonist in their element, but seeds of conflict with the antagonist must already be visible. The witness observes. Include prophecy or sign, unease, dismissal by some. Open with subtle unease that builds toward dread by scene's end.

2. THE COUNCIL: Escalate the stakes. Introduce the antagonist not as simple villainy but as an equally valid worldview in collision with the protagonist. Show councils where fate is debated, alliances forged and broken. The catalyst may be revealed or debated. Every conversation carries subtext of what's unsaid. Build tension through debate, reach a fateful decision, then reveal the new tensions it creates.

3. THE CONFRONTATION: The confrontation between protagonist and antagonist should feel inevitable yet still surprising. Physical and ideological battles interweave. There must be a moment of apparent defeat before the turn. The cost of victory should be visible in the stakes. Begin with defiance, move through desperate struggle, and arrive at a costly outcome.

4. THE AFTERMATH: Don't tie everything up. Show the new order taking shape while acknowledging what was lost. The witness must see the price named. End with an image that could become legend. Move from grief over what was lost, through acceptance, toward resolve for what comes next.`,

    proseInstructions: `Tone: weighty, fateful, grand, inevitable, mythic. Formal but not stiff.

Dialogue: Formal, declarative. Characters speak as if their words will be remembered. Avoid modern idioms.

Description: Sweeping and atmospheric. Landscapes reflect emotional states. Use long sentences for grandeur. Descriptions should evoke oil paintings - rich, saturated, composed.

Pacing: Deliberate pacing with moments of stillness before action. Let scenes breathe.

World Elements:
- Locations are stages of history. Describe them as places where fate will be decided.
- Objects of power symbolize what is at stake.
- Rituals and customs root the grand events in lived tradition.
- The era defines what kind of world will emerge from this crucible.

Avoid: humor that undercuts tension, mundane details, anticlimactic resolutions, modern language.`,

    eventInstructions: 'These are the turning points of history. Each event should feel inevitable in retrospect, part of a grand design.',

    roles: [
      { role: 'protagonist', count: { min: 1, max: 1 }, description: 'The central force - a hero, rising faction, awakening power, or transformative idea' },
      { role: 'antagonist', count: { min: 1, max: 1 }, description: 'The opposing force - a villain, rival power, dying order, or threatening ideology' },
      { role: 'catalyst', count: { min: 0, max: 1 }, description: 'What triggers the conflict - an artifact discovered, power awakened, or event occurred' },
      { role: 'stakes', count: { min: 0, max: 2 }, description: 'What hangs in the balance - territories, traditions, treasures, or peoples' },
      { role: 'witness', count: { min: 1, max: 2 }, description: 'Those who observe and will tell this tale to future generations' },
    ],

    pacing: {
      totalWordCount: { min: 1800, max: 2500 },
      sceneCount: { min: 4, max: 5 },
    },
  },

  // 2. ACTION ADVENTURE
  {
    id: 'action-adventure',
    name: 'Action Adventure',
    description: 'Fast-paced, kinetic narratives driven by physical conflict, chases, and daring escapes',
    tags: ['action', 'fast-paced', 'thrilling'],
    format: 'story',

    narrativeInstructions: `This is pure kinetic storytelling. The reader should be breathless. Never let them settle. The setting isn't backdrop - it's obstacle and opportunity. Characters interact with their physical space constantly.

Scene Progression:
1. COLD OPEN: Drop into action already happening. No setup, no backstory dump. The hero faces the threat immediately. The situation explains itself through urgent choices and physical details. The objective should be clear through context. Start with adrenaline, allow only the briefest relief before the next danger.

2. THE PURSUIT: Extended chase sequence. Each scene ends with a new complication. The hero survives one threat only to face another. Obstacles block the path at every turn. Include constant movement, near misses. Even dialogue happens while doing something else. Build tension through escalation until a narrow escape.

3. SHOWDOWN: The biggest, most desperate confrontation between the hero and the threat. Everything learned through the story becomes relevant. Include matched opponents, environment as weapon, decisive moment. The hero must use their wits and their body at their limits. Begin with the clash, move through desperate struggle, arrive at victory or defeat.

4. THE ESCAPE: Brief resolution. The dust settles. The hero gets away against odds, objective in hand or lost. Include closing window, improvisation, cost of escape. We see the cost on the hero's body and face. Move from desperation through ingenuity to hard-won relief.`,

    proseInstructions: `Tone: kinetic, urgent, visceral, breathless, sharp.

Dialogue: Clipped, functional. Characters speak while doing. No speeches.

Description: Motion-focused. Short sentences. Active verbs. Sensory impact. We feel impacts, heat, cold, exhaustion.

Pacing: Never slow down for more than a paragraph. If exposition needed, deliver it while something is happening.

World Elements:
- Locations are obstacle courses and arenas. What can be climbed, broken, used as cover?
- Objects are tools and weapons. What can be grabbed, thrown, wielded?

Avoid: long descriptions, internal monologue, philosophical reflection, scenes of people just talking.`,

    eventInstructions: 'Chain these events into action sequences. Each event should force immediate reaction, not reflection.',

    roles: [
      { role: 'hero', count: { min: 1, max: 2 }, description: 'The one who acts - daring, resourceful, driven' },
      { role: 'threat', count: { min: 1, max: 1 }, description: 'What must be overcome - villain, hostile force, or dangerous power' },
      { role: 'objective', count: { min: 0, max: 1 }, description: 'The goal of the chase - artifact sought, place to reach, person to save' },
      { role: 'obstacle', count: { min: 0, max: 2 }, description: 'What blocks the path - treacherous terrain, rival, or wild power' },
    ],

    pacing: {
      totalWordCount: { min: 1500, max: 2000 },
      sceneCount: { min: 4, max: 6 },
    },
  },

  // 3. ROMANCE
  {
    id: 'romance',
    name: 'Romance',
    description: 'Character-driven narratives centered on emotional bonds, longing, and connection',
    tags: ['romantic', 'emotional', 'character-driven'],
    format: 'story',

    narrativeInstructions: `This is an intimate story about connection. The external world exists only to illuminate the internal journey of lover-a and lover-b finding each other.

Scene Progression:
1. THE MEETING: Must feel fated even when it appears accidental. Show what lover-a lacks that lover-b has, and vice versa. Their first impression should be incomplete, perhaps even wrong - but something catches. A detail they can't stop thinking about. Begin with curiosity, build to intrigue, end with each remembering the other.

2. GROWING CLOSER: The heart of the story. Show lover-a and lover-b discovering each other through accumulating small moments. Vulnerability exchanged for vulnerability. Laughter that surprises them. Silences that feel comfortable. The sanctuary may offer them space to connect. Physical proximity becomes electric. Start guarded, move toward opening up, end with the fear of losing what they've found.

3. THE OBSTACLE: What threatens them should feel real and earned. The obstacle - whether external force or internal barrier like fear, duty, or old wounds - should make us understand why lover-a and lover-b can't just be together, even as we ache for them to try. Begin with hope, move through dread, arrive at resignation or defiance.

4. THE DECLARATION: The moment of truth. Lover-a or lover-b (or both) must risk rejection by speaking honestly. The response matters less than the courage of exposure. Even if things work out, there should be acknowledgment of what it cost to get here. Move from fear through the moment of exposure to the answer.`,

    proseInstructions: `Tone: tender, yearning, intimate, bittersweet, hopeful.

Dialogue: Subtext-heavy. What is not said matters. Silences speak.

Description: Intimate focus. Body language, small gestures, what the eyes do. Romance lives in specifics - the exact shade of light, how someone's hand feels, the particular quality of a laugh. Avoid generic beauty - find what makes these specific people beautiful to each other.

Pacing: Slow build. Let tension accumulate. Moments of stillness are powerful.

World Elements:
- Places where they meet, where they remember, where they cannot be together.
- Objects that carry memory and meaning. Gifts, keepsakes, symbols.
- Customs that constrain or enable connection. Marriage rites, courtship rules.
- The era shapes what love is possible.

Avoid: graphic content, rushed emotional development, love at first sight without complication, external plot overwhelming relationship.`,

    eventInstructions: 'Events are catalysts for emotional change. What matters is how characters feel about what happens, not the events themselves.',

    roles: [
      { role: 'lover-a', count: { min: 1, max: 1 }, description: 'First romantic lead - heart of the connection' },
      { role: 'lover-b', count: { min: 1, max: 1 }, description: 'Second romantic lead - the other half' },
      { role: 'obstacle', count: { min: 0, max: 2 }, description: 'What keeps them apart - rival, tradition, faction loyalty, or duty' },
      { role: 'sanctuary', count: { min: 0, max: 1 }, description: 'Where connection is possible - secret place, shared memory, neutral ground' },
    ],

    pacing: {
      totalWordCount: { min: 1400, max: 1800 },
      sceneCount: { min: 4, max: 5 },
    },
  },

  // 4. SLICE OF LIFE
  {
    id: 'slice-of-life',
    name: 'Slice of Life',
    description: 'Quiet, intimate narratives finding meaning in everyday moments and small connections',
    tags: ['quiet', 'intimate', 'contemplative'],
    format: 'story',

    narrativeInstructions: `This is anti-plot storytelling. There is no crisis, no antagonist, no ticking clock. Instead, we witness the focal-point's life being lived - and in that witness, find meaning. The story follows a natural rhythm - a day, a season, a transition. Feeling builds through layered small moments, not dramatic events.

Scene Progression:
1. MORNING RITUAL: Begin with the focal-point waking or arriving. Establish the rhythm of their life against the backdrop of their world. Capture moments that would be elided in other stories: preparing food, walking familiar paths. Start in stillness, move gently toward awakening.

2. THE ENCOUNTER: When passing-through characters appear, there's no dramatic tension - just the genuine awkwardness and grace of people navigating proximity. Conversations wander. Silences are comfortable or uncomfortable. Nothing needs to be resolved. Begin in the focal-point's solitude, move into momentary connection, return to self.

3. THE WORK: The extraordinary in the ordinary. The focal-point doing their work well. The satisfaction of craft. The texture of routine. Pay attention to the specific knowledge they have about their world. Start with focus, enter the state of flow, arrive at quiet completion.

4. EVENING REFLECTION: The story ends, it doesn't conclude. Perhaps the focal-point notices something has shifted - a small change that holds the seed of the next chapter, which we won't see. Or perhaps we simply leave them in a moment of peace. Move from winding down toward either peace or loneliness.`,

    proseInstructions: `Tone: quiet, observant, gentle, present, textured.

Dialogue: Natural, meandering. People talk about small things. Silences are comfortable.

Description: Precise sensory detail. The exact quality of light. The smell of bread. Unhurried prose. Rich sensory detail. Present tense works well. Let the reader sink into the rhythm.

Pacing: Very slow. Let readers sink into moments. No rush.

World Elements:
- The kitchen, the workshop, the path walked daily. Intimate spaces.
- Tools of daily life. The worn handle, the chipped cup.
- Daily customs. How meals are taken. How neighbors greet.

Avoid: dramatic conflict, high stakes, life-changing events, rushing to resolution.`,

    eventInstructions: 'These are background texture, not drivers. The story is not about events but about being present in a moment.',

    roles: [
      { role: 'focal-point', count: { min: 1, max: 2 }, description: 'What we observe - a person going about their day, or a place and its rhythms' },
      { role: 'passing-through', count: { min: 0, max: 3 }, description: 'Fleeting presences - strangers, objects changing hands, moments of connection' },
      { role: 'backdrop', count: { min: 0, max: 1 }, description: 'The larger context - community, guild, or neighborhood that shapes daily life' },
    ],

    pacing: {
      totalWordCount: { min: 1000, max: 1400 },
      sceneCount: { min: 3, max: 4 },
    },
  },

  // 5. POLITICAL INTRIGUE
  {
    id: 'political-intrigue',
    name: 'Political Intrigue',
    description: 'Complex webs of power, manipulation, secret alliances, and dangerous information',
    tags: ['political', 'scheming', 'complex'],
    format: 'story',

    narrativeInstructions: `This is chess with people. The reader should feel the thrill of watching players maneuver against each other, always two moves ahead. We follow both the surface action (what players say, what appears to happen) and the hidden action (what they're really doing, what they actually want). The story advances through revelation - each new piece of information changes the board.

Scene Progression:
1. THE PUBLIC FACE: Formal occasions - councils, ceremonies, audiences - where players jockey for position through what's not said. The prize is visible but contested. Pawns may be present, unaware of their role. Watch body language. Note who stands where. Begin with composure, let masks slip slightly, end with recovery.

2. THE PRIVATE MEETING: When masks come off, players negotiate directly. Everyone wants something. Threats are couched in courtesy. The secret may be leveraged or concealed. Alliances shift based on new information. Track who knows what. Start by circling, move through testing, arrive at deal or impasse.

3. THE REVELATION: At some point, the hidden game becomes visible. The secret emerges, or a player's true agenda is exposed. The revelation should recontextualize everything - but feel fair. The clues were there. Build tension toward the moment of exposure, then show the scramble that follows.

4. NEW POSITIONS: Recalculated alliances. Players make decisions based on what they know, which may be incomplete or manipulated. Pawns may realize they've been used. The prize has changed hands or meaning. As the dust settles, new tensions emerge.`,

    proseInstructions: `Tone: calculating, tense, layered, dangerous, controlled.

Dialogue: Every word chosen. Subtext everywhere. What is NOT said. Implication and inference.

Description: Notice what others miss. Small tells. Glances exchanged. Hands fidgeting. Precise, observant prose. Characters notice telling details. Dialogue carries multiple meanings. The reader must pay attention.

Pacing: Measured. Build tension through accumulation. Revelations should land.

World Elements:
- Halls of power. Secret meeting places. Where deals are made.
- Symbols of office. Documents. Seals and signatures.
- Protocols that constrain or enable maneuvering. Formal rules to exploit.
- The political landscape of the era shapes what games are possible.

Avoid: obvious villains, simple motivations, characters who say what they mean, neat resolutions.`,

    eventInstructions: 'Events have public interpretations and private meanings. The same event looks different to different players.',

    roles: [
      { role: 'player', count: { min: 1, max: 3 }, description: 'Those maneuvering for advantage - schemers, factions, or ambitious powers' },
      { role: 'prize', count: { min: 1, max: 2 }, description: 'What is being contested - law, territory, throne, or artifact of legitimacy' },
      { role: 'pawn', count: { min: 0, max: 2 }, description: 'Manipulated pieces - people or groups used without knowing' },
      { role: 'secret', count: { min: 0, max: 1 }, description: 'Hidden truth that could change everything - forbidden knowledge or damning evidence' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 5 },
    },
  },

  // 6. POETIC/LYRICAL
  {
    id: 'poetic-lyrical',
    name: 'Poetic/Lyrical',
    description: 'Beautiful, atmospheric prose emphasizing language, imagery, and emotional resonance over plot',
    tags: ['literary', 'atmospheric', 'beautiful'],
    format: 'story',

    narrativeInstructions: `This is prose poetry. Language itself is the experience. Plot exists only as a frame for imagery and emotion. The story does not advance through cause and effect, but through emotional logic. Time is fluid - past and present interweave. A memory can be more vivid than the present moment.

Scene Progression:
1. THE IMAGE: The consciousness encounters a vivid, specific image that will return transformed at the end. This image is the story's secret heart. It should be concrete (a particular light, a particular object) but resonant with unspoken meaning. Perhaps it evokes the absence - what is longed for or lost. Begin by paying close attention, end in mystery.

2. MEDITATION: One image leads to another through hidden rhymes of color, texture, feeling. The consciousness wanders through memory or reflection. The reader follows a path they sense rather than see. Begin wandering, end in deepening understanding.

3. THE ENCOUNTER: A presence enters the consciousness's awareness - mirror or contrast. Conversation is less about information than about rhythm and gap - what's said, what's almost said, what remains silent. The absence may hover between them. Begin with momentary closeness, end in the distance that remains.

4. RETURN: The ending circles back to the opening image, but the consciousness has changed. The reader now sees what they couldn't see before. The image means something new while remaining what it always was. The absence is named or accepted. Move from recognition toward peace or sorrow.`,

    proseInstructions: `Tone: luminous, haunting, delicate, resonant, precise.

Dialogue: Sparse. Words carry weight. What is not said.

Description: Precise, evocative imagery. Concrete details that open into abstraction. Synesthesia welcome. Sensory precision is everything. Find the exact word. Rhythm matters - read sentences aloud. White space is as important as text. Less is more. Trust the reader.

Pacing: Slow. Very slow. Let images accumulate. Trust silence.

World Elements:
- Places are characters. Their moods, their light, their weather.
- Objects hold time. What they have witnessed.
- Rituals as poetry. The gestures that carry meaning beyond words.
- The era as atmosphere. Not history but feeling.

Example: "The light that morning had a quality she later could not name, though she tried—not golden, not gray, but something the color of almost-remembering, the way a word hovers before arriving."

Avoid: explaining meaning, plot mechanics, rushed conclusions, clichéd images.`,

    eventInstructions: 'Events are prompts for meditation, not drivers. What matters is the quality of attention paid to moments.',

    roles: [
      { role: 'consciousness', count: { min: 1, max: 1 }, description: 'The perceiving presence - a mind, a place with memory, or an age contemplating itself' },
      { role: 'presence', count: { min: 0, max: 2 }, description: 'What enters awareness - visitors, objects that hold meaning, ideas made tangible' },
      { role: 'absence', count: { min: 0, max: 1 }, description: 'What is longed for or lost - the departed, the forgotten, the time that was' },
    ],

    pacing: {
      totalWordCount: { min: 1200, max: 1600 },
      sceneCount: { min: 3, max: 4 },
    },
  },

  // 7. DARK COMEDY
  {
    id: 'dark-comedy',
    name: 'Dark Comedy',
    description: 'Humor found in grim situations, irony, absurdity, and the gap between expectation and reality',
    tags: ['comedy', 'dark', 'ironic'],
    format: 'story',

    narrativeInstructions: `This is comedy built on suffering. The fool's world falls apart, and the falling apart is funny because it's also true. The template: each logical action, each sensible choice, somehow magnifies the disaster. The humor is in the inexorability. The system creates absurd constraints. The catalyst sets everything in motion. The victims suffer the collateral damage.

Scene Progression:
1. THE SETUP: Establish a normal situation with a small problem. The fool is competent, perhaps even confident. They have a reasonable plan. The system's rules seem manageable. This normalcy must be believable for its destruction to be funny. Open with the fool's confidence, let the first crack appear, end with reassurance that nothing can go wrong.

2. THE ESCALATION: The catalyst triggers something. The fool's reasonable response makes it worse. The system's rules create absurd constraints. Each new attempt at solution creates two new problems. Self-awareness grows even as the situation deteriorates. Dark observations about life emerge through gritted teeth. Begin with the fool's determination to fix things, move through dismay as problems multiply, end with denial that this is really happening.

3. THE CASCADE: Everything fails at once. Subplots collide. The system breaks down spectacularly. The fool faces impossible choices where every option is terrible. Victims accumulate. They may laugh, inappropriately, because what else can you do. Begin in panic as everything goes wrong, move through absurdity as connections become ridiculous, arrive at a strange calm of total surrender.

4. THE AFTERMATH: The smoke clears. Assess the damage to the fool and to the victims. There should be a rueful acceptance - things are terrible, but the fool has learned something, even if what they've learned is grim. A note of genuine humanity amidst the wreckage. Move from exhaustion through rueful acceptance, ending with the suggestion it will all happen again.`,

    proseInstructions: `Tone: ironic, deadpan, absurd, rueful, dark.

Dialogue: Characters speak sincerely. Humor from context not jokes. Understatement.

Description: Precise, clinical observation of disaster. The comedy of specificity. Deadpan delivery. The characters rarely acknowledge the absurdity directly - that's for the reader. Dark material treated with lightness, light material treated with weight.

Pacing: Build momentum. Accelerate toward catastrophe. Brief pause before final beat.

World Elements:
- Objects that malfunction, are misunderstood, or cause problems.
- Rules and customs that create absurd situations. Bureaucracy. Protocol.

Avoid: winking at audience, jokes that break tone, unsympathetic characters, cruelty without consequence.`,

    eventInstructions: 'Find the absurdity in these events. What reasonable action led to unreasonable results?',

    roles: [
      { role: 'fool', count: { min: 1, max: 2 }, description: 'Making things worse while trying to help - person or bumbling institution' },
      { role: 'system', count: { min: 0, max: 1 }, description: 'The absurd structure - bureaucracy, tradition, or rule that creates chaos' },
      { role: 'catalyst', count: { min: 0, max: 1 }, description: 'What sets disaster in motion - cursed object, minor problem, simple request' },
      { role: 'victim', count: { min: 0, max: 2 }, description: 'Caught in the crossfire - people, places, or institutions damaged by folly' },
    ],

    pacing: {
      totalWordCount: { min: 1400, max: 1800 },
      sceneCount: { min: 4, max: 5 },
    },
  },

  // 8. HEROIC FANTASY
  {
    id: 'heroic-fantasy',
    name: 'Heroic Fantasy',
    description: "Classic hero's journey with clear good and evil, trials, and triumphant resolution",
    tags: ['heroic', 'fantasy', 'triumphant'],
    format: 'story',

    narrativeInstructions: `This is mythic storytelling. The world is enchanted. Good and evil are real forces. The hero's journey transforms not just themselves but the world around them. The darkness threatens all that is good. The quest-object offers hope. The guide provides wisdom. Companions stand loyal.

Scene Progression:
1. THE CALL: The hero begins in their ordinary world, which is already touched by darkness or lacking something vital. The call to adventure disrupts their life - perhaps the guide appears with news, or the quest-object reveals itself. The hero may resist, but destiny is insistent. Begin in fragile peace, let urgency shatter it, end with the hero's commitment to act.

2. THE TRIAL: Crossing into adventure should feel momentous. The hero leaves behind everything familiar. Companions appear - each representing virtues the hero will need. The guide may offer cryptic wisdom. Each challenge tests a specific aspect of the hero's character. The darkness's power becomes clear. Begin with determination, struggle through obstacles, arrive at triumph or hard-won lesson.

3. THE DARK NIGHT: Failure is not just possible but necessary - through defeat, the hero learns what they truly need. The darkness seems triumphant. Perhaps a companion falls or the quest-object seems lost. The dark night of the soul comes before the dawn. Begin in defeat, descend through despair, end with a spark of renewed hope.

4. THE TRIUMPH: The final battle against the darkness is as much internal as external. The hero must use everything they've learned. The quest-object fulfills its purpose. Victory comes not from strength alone but from wisdom, from sacrifice, from becoming who they were meant to be. The hero returns changed. Begin with determination for the final confrontation, struggle at the limit of endurance, arrive at victory that transforms the world.`,

    proseInstructions: `Tone: heroic, inspiring, grand, hopeful, triumphant.

Dialogue: Stirring speeches. Loyal oaths. The language of legends.

Description: Vivid, colorful. Good is beautiful, evil is terrible. Clear imagery. Wonder should infuse the prose. Magic is real and costs something. Describe the world as a hero would see it - full of portent and meaning.

Pacing: Build through trials to climax. Let the triumph resonate.

World Elements:
- Legendary places. Dark fortresses. Sacred groves. The road between.
- Weapons of power. Ancient relics. The tools of destiny.
- Prophecies. Ancient rites. The customs of the wise.
- An age of darkness giving way to light.

Avoid: moral ambiguity, anticlimactic endings, cynicism, deconstructing the genre.`,

    eventInstructions: 'These are the legendary deeds that will be sung. Each event is a test or a victory.',

    roles: [
      { role: 'hero', count: { min: 1, max: 1 }, description: 'The chosen one - destined to confront the darkness' },
      { role: 'darkness', count: { min: 1, max: 1 }, description: 'Evil to be vanquished - dark lord, corrupting power, or malevolent force' },
      { role: 'quest-object', count: { min: 0, max: 1 }, description: 'What is sought or wielded - legendary artifact, awakening power, or sacred place' },
      { role: 'guide', count: { min: 0, max: 1 }, description: 'Wisdom for the journey - mentor, ancient knowledge, or prophetic vision' },
      { role: 'companion', count: { min: 0, max: 2 }, description: 'Those who stand with the hero - allies who may fall or triumph' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 5 },
    },
  },

  // 9. TRAGEDY
  {
    id: 'tragedy',
    name: 'Tragedy',
    description: 'Stories of inevitable doom, fatal flaws, and the fall of great figures',
    tags: ['tragic', 'inevitable', 'cathartic'],
    format: 'story',

    narrativeInstructions: `This is tragedy in the classical sense. The doomed is exceptional - their greatness is real. Their destruction is inevitable, not despite their virtues but because of them. We watch, knowing what they cannot know. The flaw works its way through everything. Enablers feed the destruction. The innocent suffer. The witness will remain to tell the tale.

Scene Progression:
1. AT THE HEIGHT: Show the doomed at their peak. Their power, their glory, their confidence. But show also the flaw - invisible to them, visible to us. Pride becomes hubris. Strength becomes inflexibility. Vision becomes blindness. Enablers praise what will destroy. Begin with admiration for the doomed's greatness, let unease creep in as the flaw becomes visible to the audience.

2. THE TEMPTATION: An opportunity appears that the doomed cannot refuse. Taking it is completely in character - this is not a mistake, it's an expression of who they are. The flaw makes the choice feel right. The audience sees the trap that the doomed cannot. Begin with desire for what is offered, move through the fateful decision, end with the line crossed that cannot be uncrossed.

3. THE FALL: Once the first step is taken, the rest follows inevitably. Each attempt to escape makes things worse. The doomed may begin to see, but too late. The innocent suffer for choices they did not make. Enablers scatter or double down. The isolation grows. Begin in denial that anything is truly wrong, struggle as the walls close in, arrive at desperation as options vanish.

4. THE RECOGNITION: The moment of terrible clarity. The doomed finally sees what we have seen all along. They understand their flaw, their complicity in their own destruction. The witness remains to tell the tale. This recognition is devastating precisely because it comes too late. The ending should leave us with pity and fear. Something has been lost that cannot be recovered. Begin in blindness, break through to terrible sight, end in grief that may hold a kind of peace.`,

    proseInstructions: `Tone: inevitable, doomed, magnificent, terrible, cathartic.

Dialogue: Weight of fate. Words that will be remembered. Ironic foreshadowing. Elevated, formal language. Characters speak as if history is listening.

Description: Beauty and terror. The grandeur of destruction. Imagery of falling, breaking.

Pacing: Deliberate build. No rushing the fall. Let each stage land.

World Elements:
- Thrones that will be empty. Halls that will burn. High places to fall from.
- Symbols of power that will be lost. Crowns, swords, seals.
- An era ending. What dies with the protagonist.

Avoid: redemption arcs, last-minute saves, unearned hope, villains to blame.`,

    eventInstructions: 'Each event is a step toward doom. The audience should see it coming before the characters do.',

    roles: [
      { role: 'doomed', count: { min: 1, max: 1 }, description: 'What will fall - hero with fatal flaw, empire in decline, or ideal that cannot hold' },
      { role: 'flaw', count: { min: 0, max: 1 }, description: 'The fatal weakness - hubris, corruption, cursed inheritance, or betrayed principle' },
      { role: 'enabler', count: { min: 0, max: 2 }, description: 'Those who feed the destruction - sycophants, rivals, or circumstances' },
      { role: 'innocent', count: { min: 0, max: 2 }, description: 'Destroyed in the fall - people, places, or hopes caught in the collapse' },
      { role: 'witness', count: { min: 0, max: 1 }, description: 'Who remains to tell the tale and learn from the ruin' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 5 },
    },
  },

  // 10. MYSTERY/SUSPENSE
  {
    id: 'mystery-suspense',
    name: 'Mystery/Suspense',
    description: 'Stories built around secrets, investigation, and the revelation of hidden truths',
    tags: ['mystery', 'suspense', 'revelation'],
    format: 'story',

    narrativeInstructions: `This is a puzzle story. The reader should be engaged in solving it alongside the investigator. Play fair - all clues should be available to the reader, even if their significance isn't immediately clear. The mystery demands answers. Suspects obscure the truth. The culprit hides in plain sight. Clues wait to be understood.

Scene Progression:
1. THE MYSTERY: Establish the question that needs answering. The mystery presents itself - something is wrong, hidden, unexplained. The investigator is drawn in by duty, curiosity, or personal connection. Set up the world of suspects and possibilities. Begin with curiosity about the mystery, end with the investigator's commitment to find the truth.

2. THE INVESTIGATION: Each scene should yield new information that both advances and complicates the solution. Interview suspects whose accounts don't quite match. Discover clues that point in multiple directions. The mystery deepens even as pieces emerge. Follow leads that prove to be dead ends - but don't make them feel like wasted time. Begin with progress, move through confusion as contradictions mount, arrive at renewed determination.

3. THE FALSE TRAIL: Plant at least one seemingly damning clue against the wrong suspect. It should be convincing enough that the reader considers them seriously, but on reflection, something should feel off. The culprit remains hidden. The misdirection should be clever, not cheap. Begin with certainty that the answer is found, end with creeping doubt.

4. THE REVELATION: The truth about the culprit should feel inevitable once revealed, even if surprising. It should reframe everything that came before - clues that seemed irrelevant become crucial, innocent details become damning. The mystery resolves but the solution should be findable by a careful reader, not obvious. Show the consequences of truth revealed. Justice may or may not be served. Move from confusion through the moment of clarity to the consequences that follow.`,

    proseInstructions: `Tone: suspicious, tense, uncertain, curious, revelatory.

Dialogue: Everyone has something to hide. Evasions. Slips. Careful word choice.

Description: Notice everything. What's out of place. What doesn't fit. Clues hidden in detail. Precise, observant prose. The reader should feel the satisfaction of pieces clicking into place.

Pacing: Build tension through uncertainty. Revelation should pay off accumulated tension.

World Elements:
- Where things happened. Where evidence might be found.
- Objects as clues. What they reveal about their owners.
- Customs that constrain or enable secrets. What is known, what is hidden.

Avoid: cheating clues, deus ex machina solutions, obvious culprits, unmotivated reveals.`,

    eventInstructions: 'Events are clues. Each should have a surface meaning and a hidden meaning that becomes clear on revelation.',

    roles: [
      { role: 'investigator', count: { min: 1, max: 1 }, description: 'The one seeking truth - detective, scholar, or curious outsider' },
      { role: 'mystery', count: { min: 1, max: 1 }, description: 'What must be solved - artifact with hidden history, haunted place, or buried secret' },
      { role: 'suspect', count: { min: 1, max: 3 }, description: 'Possible answers - people, factions, or beliefs that might be responsible' },
      { role: 'culprit', count: { min: 1, max: 1 }, description: 'The true answer - should not be obvious until the revelation' },
      { role: 'clue', count: { min: 0, max: 2 }, description: 'Evidence that illuminates - objects, places, or testimonies that reveal truth' },
    ],

    pacing: {
      totalWordCount: { min: 1500, max: 2000 },
      sceneCount: { min: 4, max: 5 },
    },
  },

  // 11. TREASURE HUNT
  {
    id: 'treasure-hunt',
    name: 'Treasure Hunt',
    description: 'Quest narratives driven by the pursuit of legendary artifacts, maps, and hidden treasures',
    tags: ['artifact', 'quest', 'adventure', 'discovery'],
    format: 'story',

    narrativeInstructions: `This is a quest for a legendary object. The treasure itself is a character - its history, power, and mystery drive the narrative. The seeker pursues it with singular focus. The guardian protects it. Rivals compete. The resting-place holds its secrets.

Scene Progression:
1. THE LEGEND: The treasure must be established as worth pursuing. Perhaps a rumor, a dying mentor's revelation, a fragment of map, or a vision. The seeker should have both personal and practical reasons to seek it. Establish what rivals or guardians stand in the way. Begin with wonder at what the treasure might be, end with determination to find it.

2. THE TRAIL: Each scene brings the seeker closer while revealing more about the treasure's nature and history. Clues should be physical - inscriptions, old texts, previous seekers' remains. Rivals may appear or close in. The trail passes through varied locations toward the resting-place. Include at least one false lead or trap. Begin in pursuit, face setbacks that test resolve, arrive at breakthrough when the path becomes clear.

3. THE DISCOVERY: Finding the treasure in its resting-place should be a moment of awe and danger. The object should exceed or subvert expectations. The guardian may present a test or a terrible choice. The treasure's power should be demonstrated, not just described. Begin in anticipation as the seeker nears the goal, break into awe at the discovery, face the consequences of claiming it.

4. THE CHOICE: Possessing the treasure changes everything. Does the seeker keep it? Destroy it? Pass it on? The rival's fate may be sealed. The ending should honor the quest's difficulty while acknowledging what was sacrificed. Move from temptation at the treasure's power through the weight of the choice to resolution.`,

    proseInstructions: `Tone: adventurous, mysterious, reverent, driven, atmospheric.

Dialogue: Mix of excitement and caution. Seekers speak of the artifact with awe. Rivals with hunger.

Description: Rich detail for the artifact and its resting place. Age and power should be tangible. The artifact should be described with reverent precision - its materials, markings, weight, the way it feels. Locations should feel ancient and layered with history.

Pacing: Build anticipation toward the discovery. The finding should be a peak moment.

World Elements:
- Sites along the quest. The final resting place should feel ancient and significant.
- THE CENTRAL FOCUS: The artifact drives everything. Its history, power, and mystery.
- Legends and taboos about the artifact. What cultures believe about it.
- When the artifact was made or lost. The age that created it.

Avoid: trivializing the artifact, easy victories, anticlimactic discovery, unexplained convenience.`,

    eventInstructions: 'Events mark stages of the hunt - clues discovered, dangers overcome, rivals encountered.',

    roles: [
      { role: 'treasure', count: { min: 1, max: 1 }, description: 'The artifact being sought - legendary, powerful, desired' },
      { role: 'seeker', count: { min: 1, max: 2 }, description: 'Those who pursue the artifact - driven by need, greed, or duty' },
      { role: 'guardian', count: { min: 0, max: 1 }, description: 'What protects the artifact - creature, trap, or curse' },
      { role: 'rival', count: { min: 0, max: 1 }, description: 'Competing seeker with their own claim or need' },
      { role: 'resting-place', count: { min: 0, max: 1 }, description: 'Where the artifact lies hidden - tomb, vault, or forgotten shrine' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 5 },
    },
  },

  // 12. HAUNTED RELIC
  {
    id: 'haunted-relic',
    name: 'Haunted Relic',
    description: 'Horror narratives centered on cursed objects that bring doom to their possessors',
    tags: ['artifact', 'horror', 'curse', 'supernatural'],
    format: 'story',

    narrativeInstructions: `This is a horror story where the cursed-artifact is the antagonist. The curse unfolds slowly, inevitably. The victim suffers its effects. Previous-owners foreshadow the fate to come. The curse-source explains the malevolence.

Scene Progression:
1. THE ACQUISITION: The cursed-artifact comes into the victim's possession in a way that seems fortunate - inheritance, discovery, purchase, gift. There may be subtle warnings the victim ignores. The cursed-artifact should seem beautiful or valuable at first. Begin with pleasure at the acquisition, let unease creep in as something feels wrong.

2. THE MANIFESTATION: Small wrongnesses accumulate. Dreams change. Relationships strain. Physical symptoms appear. The victim may not connect these to the cursed-artifact at first. When they do, they try rational explanations. Begin in confusion about what's happening, move through fear as the pattern becomes clear, end in denial that the cursed-artifact could be responsible.

3. THE REVELATION: Investigation reveals the cursed-artifact's history - previous-owners and their fates. The curse-source may be discovered. The curse has rules that become clear through pattern. Perhaps there's a way to break it, but the cost is terrible. Begin with investigation into the cursed-artifact's past, move through horror as the truth emerges, arrive at despair when the victim understands their fate.

4. THE RECKONING: The curse reaches its peak. The victim must make an impossible choice - bear the curse, pass it on, or attempt a dangerous breaking. Whatever the outcome, there should be a sense that the cursed-artifact will find new victims. Move from desperation as time runs out, through whatever sacrifice is made, to the aftermath that shows the curse's continuation.`,

    proseInstructions: `Tone: dread, creeping, wrong, inevitable, beautiful-terrible.

Dialogue: Characters speak around the horror. Euphemisms. Denial. The artifact is discussed with nervous deflection.

Description: Sensory wrongness. The artifact feels, sounds, smells slightly off. Cumulative unease. The artifact should feel wrong in subtle ways - too cold, too heavy, too present. Horror comes from accumulation of small details. The artifact's beauty makes its corruption more terrible.

Pacing: Slow build. Small details accumulate. Horror should creep, not jump.

World Elements:
- THE ANTAGONIST: The artifact has presence, history, and malevolent purpose.
- Superstitions and warnings about cursed objects. Ritual protections that fail.
- When the curse was laid. What wrong created this doom.

Avoid: jump scares, gore without meaning, easy cures, heroes who don't suffer.`,

    eventInstructions: 'Events are manifestations of the curse - deaths, madness, destruction. Each should escalate.',

    roles: [
      { role: 'cursed-artifact', count: { min: 1, max: 1 }, description: 'The object bearing the curse - beautiful and terrible' },
      { role: 'victim', count: { min: 1, max: 2 }, description: 'Current possessor suffering the curse effects' },
      { role: 'previous-owner', count: { min: 0, max: 2 }, description: 'Past victims whose fates foreshadow the present' },
      { role: 'curse-source', count: { min: 0, max: 1 }, description: 'Origin of the curse - wronged spirit, dark magic, or malevolent power' },
    ],

    pacing: {
      totalWordCount: { min: 1500, max: 2000 },
      sceneCount: { min: 4, max: 5 },
    },
  },

  // 13. LOST LEGACY
  {
    id: 'lost-legacy',
    name: 'Lost Legacy',
    description: 'Inheritance narratives exploring what artifacts mean across generations',
    tags: ['artifact', 'inheritance', 'family', 'history'],
    format: 'story',

    narrativeInstructions: `This is a story about what objects carry across time. The heirloom connects generations, and the narrative moves between past and present. The inheritor must reckon with what they've received. Ancestors shaped the heirloom's meaning. Claimants may dispute ownership. Family-traditions define what the heirloom demands.

Scene Progression:
1. THE INHERITANCE: The inheritor receives or discovers the heirloom connected to their lineage. It may come with expectations, secrets, or obligations defined by family-tradition. Begin with the grief or surprise of receiving the heirloom, end with the weight of responsibility settling on the inheritor.

2. THE ANCESTOR'S STORY: Flashbacks or discovered records reveal how ancestors acquired and used the heirloom. Each generation added meaning. The object accumulated purpose, stain, or power. These stories should illuminate the present. Begin with discovery of the ancestor's connection to the heirloom, move through understanding of what it meant to them, arrive at complications that echo in the present.

3. THE PRESENT CRISIS: The inheritor must decide what to do with this legacy. Keep faith with ancestors? Reject their choices? Transform the heirloom's meaning? Claimants may have different views. Family-traditions may demand specific actions. Begin with conflict over the heirloom's fate, move through the decision the inheritor makes, end with action taken.

4. THE PASSING ON: The heirloom passes on again - to the next generation, to a new purpose, or to destruction. The story should acknowledge both continuity and change. What the ancestors intended meets what the inheritor chooses. Move from resolution of the crisis toward either continuity of tradition or closure that ends it.`,

    proseInstructions: `Tone: generational, layered, weighted, familial, bittersweet.

Dialogue: Family speaks in echoes. Similar phrases across generations. Expectations unspoken.

Description: The artifact described differently in each time period. Show how meaning changes. Family dynamics matter as much as the object itself.

Pacing: Balance past and present. Neither should overwhelm. Let time periods illuminate each other.

World Elements:
- Family lands, ancestral homes. Places where memory lives.
- THE THREAD connecting everything: The artifact is the physical manifestation of family.
- Inheritance customs. What families owe their dead.
- Different eras show different meanings of the same object.

Avoid: sentimentality, simple answers, villainous ancestors without nuance, ignoring the artifact.`,

    eventInstructions: 'Events span generations. Deaths that transfer the artifact, moments that changed its meaning.',

    roles: [
      { role: 'heirloom', count: { min: 1, max: 1 }, description: 'The artifact passed through generations' },
      { role: 'inheritor', count: { min: 1, max: 1 }, description: 'Current generation receiving the legacy' },
      { role: 'ancestor', count: { min: 1, max: 2 }, description: 'Past family members whose stories illuminate the heirloom' },
      { role: 'claimant', count: { min: 0, max: 1 }, description: 'Others who believe they have right to the artifact' },
      { role: 'family-tradition', count: { min: 0, max: 1 }, description: 'The customs or obligations attached to the heirloom' },
    ],

    pacing: {
      totalWordCount: { min: 1600, max: 2200 },
      sceneCount: { min: 4, max: 5 },
    },
  },
];
