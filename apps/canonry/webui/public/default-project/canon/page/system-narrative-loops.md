# Narrative Design Loops

*Every action should have consequences. Every consequence should create opportunities.*

---

## Design Philosophy

### Setting as Protagonist

Penguin Tales builds a **setting**, not a cast of characters. The knowledge graph's value lies in:
- **Places** with history and memory
- **Factions** with ideology and politics
- **Artifacts** with legend and will
- **Rules** that shape society
- **Events** that mark those who survive them

NPCs are supporting elements that give these things texture. The legendary weapon is interesting; the hero who wielded it is context. The faction's rise to power is the story; the merchant who profited is color.

End users bring themselves as the character. We provide the setting they inhabit.

### The Ice Remembers

This world's metaphysics shapes our systems. The ice is alive. It witnesses. It annotates existence.

**The setting itself has agency:**
- Weapons *choose* their wielders
- Colonies *remember* their residents
- Wars *mark* their survivors
- Instruments *bless* those who hear them
- Tomes *call* to restorers
- The ice *witnesses* significant deeds

NPCs don't gain prominence by acting. They gain prominence by **being acted upon by the world**. A hero becomes legendary not because they "did heroic things" but because a legendary weapon chose them, a renowned colony remembered them, a great war marked them.

This is literally Aurora culture's belief system - the parenthetical echoes in names ("Velmaek (twice-traded)") are the ice's annotations, not the penguin's achievements.

### Knowledge Graph, Not War Simulation

We're building a knowledge graph for downstream projects - chronicles, wiki exploration, story seeds. We're not simulating armies or economics. We're creating a web of memorable entities with meaningful relationships.

This means:
- **Fewer, more significant entities** - A world of 50 well-connected characters beats 500 isolated ones
- **Relationships over statistics** - Who knows whom matters more than population counts
- **Stories over simulations** - Events should be narratable, not just logged

### Titans, Not Infantry

Our conflicts should be clashes of titans, not infantry dying on beaches. When heroes fight orcas, when factions go to war, when artifacts change hands - these are *events*. Named characters with histories.

We avoid:
- Mass-spawning generic units
- Attrition-based gameplay
- Events that don't involve named entities

### Anti-Proliferation

Every system that creates entities must justify those entities' existence. Templates that spawn batches of characters need strong narrative hooks. Systems that kill entities should do so meaningfully, not as random attrition.

The goal is a dense graph of interconnected entities, not a sparse graph of isolated nodes.

---

## Prominence Philosophy

### Normal Distribution, Not a Ladder

Prominence follows a normal distribution. Entities start in the middle (marginal/recognized) and can move toward either extreme:

```
forgotten ← marginal ← RECOGNIZED → renowned → mythic
```

- **Forgotten** is earned through decay, isolation, or failure - never assigned at creation
- **Mythic** is earned through great deeds witnessed by the ice - never assigned at creation
- Most entities should cluster around recognized/marginal
- The extremes are rare and meaningful

### NPCs Are Marked, Not Actors

NPCs gain prominence through **affiliation**, not **agency**:

| Instead of... | We use... |
|--------------|----------|
| Hero seeks weapon | Weapon chooses hero |
| Mayor leads colony | Colony claims mayor |
| Merchant joins guild | Guild elevates merchant |
| Soldier survives war | War marks survivor |

The setting acts. NPCs are marked by their connection to significant things.

### Prominence Flows From Setting

NPCs inherit prominence from what they're connected to:
- Live in a renowned colony → the ice remembers you
- Wield a mythic weapon → the weapon's legend marks you
- Survive a great war → the war's memory elevates you
- Blessed by an instrument → the music changes you

This prevents character-centrism while still creating memorable NPCs. They're memorable because the *world* made them so.

### Prominence Must Oscillate

A healthy prominence system isn't one where entities climb to mythic and stay there. It's one where entities **rise and fall** throughout their existence. The ice remembers glory, but it also remembers fading.

Target metrics:
- ~76% of entities should experience both rises AND falls
- Rise:Fall event ratio should be ~1.5-2:1 (slight upward bias, not runaway inflation)
- Mythic should be ~20-25% of entities, not 35%+
- Forgotten should be ~15-20%, not 4%

We achieve this through two homeostatic systems:

1. `prominence_evolution` - Decay based on connection count. Isolated entities fade faster. Well-connected entities decay slower but still decay. Nobody stays prominent without ongoing relevance.

2. `reflected_glory` - Prominence flows through relationships. If your neighbors are prominent, you rise slightly. If they're forgotten, you fall. This creates **local equilibria** - clusters of entities that share similar prominence levels.

The balance matters. Too much decay and nothing feels permanent. Too little and every entity becomes mythic. The goal is a world where prominence is *earned and maintained*, not granted and kept.

### Setting Entities Can Act

The catalyst system controls which entities can take autonomous actions. Not just NPCs and factions - the *setting itself* can act:

- **Artifacts** with sufficient prominence can choose wielders, enshrine traditions, mark events
- **Rules** (ideologies, laws, traditions) can spread, convert believers, commemorate history
- **Occurrences** (wars, disasters, celebrations) can draw in participants, mark survivors, leave lasting impressions

This requires prominence >= recognized (2.0) to activate. The setting doesn't act until it's significant enough to *matter*. A forgotten artifact sits inert. A renowned one has agency.

---

## The Loop Structure

Every narrative loop follows the same pattern:

```
NEED → PROGRESSION → REWARD → LOOP
```

### NEED
An entity needs something - a weapon, an ally, redemption, victory. This need motivates action.

### PROGRESSION
The entity takes actions to address the need. These actions create events, form relationships, change the world state.

### REWARD
Success (or failure) has consequences. Prominence changes. Relationships form or break. Tags get added. The entity is different than before.

### LOOP
The reward creates new needs, or enables others' needs. The merchant who gains wealth becomes a target. The hero who defeats the orca gains a rival. The cycle continues.

---

## Implemented Loops

### The Hero-Weapon Loop

**Need:** Heroes need weapons to fight effectively. Weapons need wielders to have purpose.

**Progression:** `seek_weapon` action - heroes seek out unclaimed weapons. `weapon_selection_system` - matches heroes to appropriate weapons based on culture and fighting style.

**Reward:** Hero gains `owned_by` relationship with weapon. Both gain prominence. Hero becomes more effective in combat.

**Loop:** Armed heroes attract challenges. Weapons with legendary wielders become more desirable if the hero falls.

### The Hero-Orca Conflict Loop

**Need:** Orcas hunt. Heroes defend. Both need victories to maintain prominence.

**Progression:** `orca_raid_target_selection` - orcas target vulnerable settlements. `armed_hero_detector` - heroes with weapons can defend. Combat resolution via `orca_hero_clash`.

**Reward:** Victor gains prominence, loser loses it or dies. Relationships form (rival, nemesis). Weapons may change hands.

**Loop:** Defeated orcas seek revenge. Victorious heroes become targets. Weapons carried by legendary fighters become prizes.

### The Hero Corruption Loop

**Need:** Heroes face corruption through dark artifacts, cursed enemies, or fell bargains.

**Progression:** `corruption_harm` system tracks corruption state:
- Clean → Corrupted (tag added)
- Corrupted → Cursed (loses weapon, relationships severed)
- Cursed → Dead (if corruption strikes again)

**Cleansing Path:** `seek_cleansing` action - corrupted heroes seek instruments (penguins love music). Artifacts with `instrument` subtype can purify, forming `blessed_by` relationships.

**Reward:** Cleansed heroes gain the `cleansed` tag and prominence. Instruments that save heroes become legendary.

**Loop:** Survivors of corruption become wiser or warier. Instruments that cleanse legendary heroes gain renown.

### The Location Corruption Cycle

**Need:** Corruption spreads across the berg like a contagion. Cleansing pushes it back. The balance between these forces creates waves of corruption and purification - a pandemic pattern where corruption sweeps through regions, then recedes as heroes and artifacts sanctify the land.

**Corruption Sources:**
- `spread_corruption` action - Corrupted and mystical locations spread corruption to adjacent areas
- `corrupt_location` action - Magic abilities can corrupt uncorrupted locations
- `manifest_magic` action - Wild magic manifesting at anomaly sites

**Cleansing Sources:**
- `cleanse_corruption` action - Heroes with `practitioner_of` relationships can purify locations
- `tome_cleanses_corruption` action - Mystical tomes stored at locations can dispel corruption
- `seek_cleansing` action - Heroes seeking purification at instrument locations

**Protection Mechanic:** The `cleansed` tag provides **lasting protection**. Locations that have been purified cannot be immediately re-corrupted - the sanctification blocks `spread_corruption` and `corrupt_location` actions via `lacks_tag: cleansed` filters. This prevents the frustrating oscillation where a location is cleansed and corrupted again within a few ticks.

**Breaking Protection:**
- `dark_ritual` template - Cults can perform dark rituals at cleansed locations, removing the protection and adding corruption. This requires cult activity and creates a disaster occurrence. Cults are the *source* of corruption renewal; artifacts and heroes are the *sink*.
- `cleansed_isolation_decay` system - During the Innovation era, isolated cleansed locations (those without adjacent cleansed neighbors) lose their protection. The wards weaken when not reinforced by nearby sanctified ground. This creates a "connected component" dynamic where cleansing must spread in connected waves to be sustainable.

**Era Dynamics:**
- *The Great Thaw*: Low corruption activity (0.3 dark ritual weight)
- *The Faction Wars*: Moderate corruption (0.6 dark ritual weight)
- *The Clever Ice Age*: Peak corruption activity (1.2 dark ritual weight, isolation decay active at 2.0). The innovations of this era destabilize magical protections.
- *The Orca Incursion*: Moderate corruption continues (0.8 dark ritual weight)
- *The Frozen Peace*: Corruption subsides (0.4 dark ritual weight)

**Pressure Connection:** Corruption heavily impacts `magical_stability`:
- `spread_corruption`: -4 magical stability per spread
- `corrupt_location`: -5 magical stability
- `dark_ritual`: -15 magical stability (major destabilization)
- Cleansing actions: +5 magical stability recovery

**The Pandemic Pattern:** The system creates waves:
1. Corruption spreads from mystical/corrupted sources across the landscape
2. Heroes and artifacts cleanse regions, creating protected zones
3. Protected zones persist until cults perform dark rituals or Innovation-era instability breaks isolated sanctuaries
4. Corruption can then spread again into unprotected territory
5. The cycle creates geographic patterns - corruption strongholds, cleansed sanctuaries, and contested borders

**Loop:** Corruption spreads → heroes/artifacts cleanse → cleansed protection holds → cults break protection OR isolation decay weakens edges → corruption returns to unprotected areas → heroes respond. The balance between corruption sources (cults, mystical locations) and sinks (heroes, artifacts) determines whether the berg trends toward darkness or light.

### The War Lifecycle Loop

**Need:** Factions compete for territory, resources, or ideology.

**Progression:** `war_outbreak` creates conflicts. `war_escalation` intensifies them. `sue_for_peace` and `claim_victory` resolve them.

**Reward:** Winners gain territory/influence. Losers lose prominence. Relationships shift (former enemies become rivals, allies become suspicious).

**Loop:** Peace creates new tensions. Victory creates new enemies. The balance of power shifts, creating conditions for future conflict.

### The Alliance Formation and Obligation Loop

**Need:** Factions seek allies for mutual defense and cultural affinity. The world needs balanced power blocs, not hegemony.

**Formation:** `alliance_formation` (connectionEvolution) - Factions that share `practitioner_of` relationships (practicing the same mystical abilities) may form alliances. Shared traditions create common ground. Alliance formation is capped by `pairComponentSizeLimit: 6` - no alliance bloc can exceed 6 members. This prevents runaway mega-alliances and ensures multiple competing power centers.

**Progression:** When an ally goes to war, `alliance_defense_call` triggers - call for aid. Factions that honor the call join the war and gain the `honor_bound` tag. Factions that fail to respond are eventually marked `oath_breaker` via `oath_breaker_detector`.

**Dissolution:** `alliance_dissolution` - Oath breakers lose their alliances over time. Trust erodes, relationships are archived. The `oath_breaker` tag also triggers `oath_breaker_consequences`: prominence loss and weakened alliance bonds.

**Reward:** Honored alliances strengthen bonds. Alliance formation increases the `harmony` pressure (+5). Wars decrease harmony (-3 via conflict contagion). Betrayals create lasting reputation damage.

**War Resolution:** Wars end via `war_tie_cleanup` when no active war occurrence remains - archiving `at_war_with` relationships and removing conflict tags. Relationships decay naturally over time; weak relationships are archived (not deleted) to preserve history.

**Harmony Pressure Connection:** The harmony pressure oscillates based on alliance/conflict balance. During *The Faction Wars* era, harmony starts deeply negative (-50) and the era cannot exit until harmony recovers above -10. Alliance formation (+5) and conflict spread (-3) create a tug-of-war that drives the era's political dynamics.

**Loop:** Shared abilities → alliance formation → enemy attacks ally → honor call → join war OR become oath breaker → oath breakers lose alliances → isolated factions seek new allies with shared practices. The cycle creates shifting coalitions across generations.

### The Resource Availability Loop

**Need:** Colonies consume resources to grow. The berg has finite bounty. Expansion must balance against sustainability.

**Pressure Connection:** Tied to the `resource_availibility` pressure and *The Great Thaw* era. The era begins with resources at +15, enabling rapid expansion. As colonies and guilds form, resources deplete. When resources drop below -20, expansion halts until recovery.

**Sources (resource generation):**
- `krill_bloom_migration` (+5) - New krill blooms discovered near colonies
- `location_discovery` (+5) - Explorers find resource-rich sites
- `establish_trade` action (+2) - Trade routes generate wealth
- `economic_colony_recovery` (+5) - Waning colonies recover economically

**Sinks (resource consumption):**
- `colony_founding` (-25) - New colonies require massive investment
- `guild_establishment` (-15) - Trade guilds consume resources to organize
- `economic_colony_decline` (-8) - Economic crises drain resources

**Feedback System:** Homeostasis (0.10) gently pulls resources toward zero. Colony count creates negative pressure - more colonies, more drain. Resource nodes create positive pressure - discovered sites replenish the berg.

**Circuit Breaker:** Sink templates require `resource_availibility > -20` to fire. When resources crash, expansion stops. Sources continue firing, enabling recovery. This prevents death spirals while creating meaningful scarcity.

**Reward:** Colonies that form during abundance thrive. Those founded during scarcity struggle. The timing of expansion creates different colony personalities.

**Loop:** Thaw begins → resources abundant → colonies founded → resources deplete → expansion halts → krill blooms and trade recover resources → cycle repeats. The Great Thaw era sees 2-4 complete oscillations before transitioning to The Faction Wars.

### The Ideology-Belief Loop

**Need:** Ideologies need believers. Characters seek meaning.

**Progression:** `devout_believer_detector` - characters deeply invested in factions become devout. `belief_adoption` spreads ideologies through relationship networks.

**Reward:** Devout believers gain prominence and special status. Ideologies with more believers gain influence.

**Loop:** Competing ideologies create conflict. Devout believers become targets for conversion or elimination.

### The Cultural Memory Cycle

**Need:** The setting needs to remember itself. Events need to leave marks. Artifacts need meaning beyond their physical form. Traditions need roots in actual history.

**Progression:** A three-part cycle where setting elements annotate each other:

1. `occurrence_marks_artifact` - Wars, disasters, celebrations leave their memory upon artifacts. The siege-hammer that broke the gates. The treaty-scroll signed at the armistice.

2. `artifact_enshrines_tradition` - Historically significant artifacts become central to cultural practices. The war-hammer is now carried in memorial processions.

3. `tradition_commemorates_event` - Cultural traditions begin commemorating the original events. The memorial procession now honors the siege itself.

**Reward:** Each step increases prominence for both participants. Artifacts gain `participant_in` relationships with events. Artifacts gain `central_to` relationships with traditions. Traditions gain `commemorates` relationships with events.

**Loop:** The cycle creates **layered meaning**. An artifact touched by multiple events, enshrined in multiple traditions, becomes genuinely legendary - not because we declared it so, but because the simulation built up that meaning through repeated connection. This is the ice remembering. Literally.

### The Artifact Restoration Loop

**Need:** Damaged artifacts fade toward destruction. Their knowledge, power, or significance wants to survive.

**Progression:** `artifact_attracts_restorer` - a damaged artifact calls to someone capable of preservation. The artifact acts; the NPC responds. This follows the "setting as protagonist" principle - the relic chooses its savior, not the other way around.

**Reward:** Artifact status changes from `damaged` to `intact`. A new `owned_by` relationship forms. Both artifact and restorer gain prominence. The artifact can now participate in other loops (Cultural Memory Cycle, weapon selection, etc.).

**Loop:** Restored artifacts may degrade again via `artifact_degradation`. The cycle can repeat. But each restoration creates new relationships that slow future decay (more connections = slower prominence loss). An artifact restored multiple times accumulates a web of keepers.

### The Tome Knowledge Loop

**Need:** Tomes contain knowledge that wants to be known. Locations hide secrets that want to be revealed. The ice remembers, but sometimes it needs help.

**Progression:** Intact tomes with `stored_at` relationships can act upon the world:

1. `tome_reveals_resources` - The tome reveals hidden value at its storage location. Adds `resource` tag, which feeds into `resource_diffusion` (spreads `thriving`) and enables `establish_trade` actions.

2. `tome_dispels_danger` - The tome's knowledge reveals safe passage. Removes `dangerous` tag, adds `safe` tag, countering the spread from `thermal_diffusion`.

3. `tome_cleanses_corruption` - Mystical tomes can purify corrupted locations. Removes `corrupted` and `crisis` tags, preventing `corruption_crisis` cascade.

**Reward:** The tome gains prominence through use. Locations gain valuable tags that feed existing systems. The tome's storage location becomes more significant.

**Loop:** A tome that reveals resources makes its location valuable → attracts trade → attracts thieves (`steal_artifact`) → may change hands → new owner benefits. The knowledge spreads through the world not as abstract "lore" but as concrete mechanical effects.

**Integration:** These actions use *existing* tags (`resource`, `dangerous`, `safe`, `corrupted`, `crisis`) that are already consumed by existing systems. No orphaned mechanics - every tome action feeds into established diffusion systems.

---

## Minor Systems

Smaller systems that add texture without requiring full narrative loops:

### Anomaly Crystallization

Isolated mystical locations (The Still Pools, The Veil Vents, The Forgotten Shore) participate in an oscillating power cycle:

- `anomaly_mystical_gain` - Anomaly locations near other anomalies gain the `mystical` tag
- `mystical_decay` - Mystical energy fades over time from locations without neighbors
- `anomaly_activation` - When mystical energy accumulates sufficiently, the anomaly becomes `active`
- `depleted_recovery` - Depleted anomalies slowly regain potential

When an anomaly activates, the `crystallized_power` template may spawn an artifact tagged `anomaly_born` - power literally crystallizing from the location's stored energy. These artifacts bear the mark of their origin, connecting them narratively to the remote places that birthed them.

---

## State Machines as Anti-Proliferation

A key pattern for preventing entity loss: **state machines**.

Instead of: `event happens → entity dies`

We use: `event happens → entity changes state → repeated events → entity dies`

### Orca Wound Progression
```
Healthy → Wounded → Maimed → Dead
```
Orcas don't die from a single defeat. They accumulate injuries. This creates:
- Narrative tension (will they survive?)
- Revenge opportunities (wounded orca returns)
- Meaningful final deaths (they've earned their ending)

### Hero Corruption Progression
```
Clean → Corrupted → Cursed → Dead
```
Heroes don't die instantly from corruption. They:
1. Get corrupted (tag added)
2. Get cursed (lose weapon, break relationships)
3. Finally die (if corruption strikes again)

Each stage is an opportunity for intervention, story, redemption.

### Artifact Degradation Progression
```
Intact ←→ Damaged → Destroyed
```
Artifacts have a reversible middle state:
1. **Intact** - Fully functional, can participate in all artifact actions
2. **Damaged** - Fading, can be restored via `artifact_attracts_restorer` OR destroyed via `artifact_destruction`
3. **Destroyed** - Terminal state, no return

The key insight: damaged is not a death sentence. The artifact can call to a restorer and return to intact. This creates:
- Race against time (will restoration happen before destruction?)
- Meaningful relationships (the restorer becomes connected to the artifact)
- Repeatable cycles (an artifact may be damaged and restored multiple times)

Templates create artifacts as `intact`. The `artifact_degradation` system (10% chance after 40 ticks) transitions them to `damaged`. From there, it's a race between `artifact_attracts_restorer` and `artifact_destruction`.

---

## What We Don't Do

### No Prominence Inflation

We removed systems that just boosted prominence without narrative justification:
- ❌ `mythic_scholar_evolution` - scholars don't become mythic by existing
- ❌ `renowned_merchant_evolution` - wealth alone doesn't create legends
- ❌ `prominent_hero_emergence` - prominence must be *earned*

Prominence changes should come from *actions*, not timers.

### No Unconditional Death

Entities shouldn't die without:
- A clear cause (combat, corruption, age)
- A state progression (wounded → dead, not healthy → dead)
- A narrative purpose (their death matters to someone)

### No Orphaned Mechanics

Every mechanic should connect to other mechanics:
- ❌ Weapons that exist but are never sought
- ❌ Corruption that spreads but can't be cleansed
- ❌ Wars that start but never end

If a mechanic creates a state, another mechanic should respond to that state.

---

## The Goal

When you read a generated world, you should be able to trace cause and effect:

> "This hero became legendary because they cleansed their corruption with the Ice-Song Harp, then defeated the orca Kzul-threk-vor who had killed their mentor, wielding the very weapon their mentor once carried."

That's not random generation. That's emergent narrative. Every piece connects:
- Corruption → Cleansing (hero corruption loop)
- Mentor death → Revenge (hero-orca loop)
- Weapon inheritance → Meaning (hero-weapon loop)

The loops create these connections automatically. Our job is to design loops that produce stories worth telling.