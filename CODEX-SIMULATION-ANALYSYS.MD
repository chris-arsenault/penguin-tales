# CODEX Simulation Analysis

This document reviews every system, action, and generator in `apps/canonry/webui/public/default-project`. It summarizes what each component does, how it interacts, and whether it is semantically coherent and useful.

## Systems

### era_spawner (Era Initialization)
- Description: Creates era entities and the supersedes chain at simulation start. It establishes the timeline structure and ticks per era.
- Influenced by: Era definitions in `eras.json` (not other systems/actions/generators).
- Influences: `era_transition`, `orca_raider_arrival` (via era matching), and all systems gated by era modifiers.
- Semantic sense: Yes; it cleanly models a world timeline with ordered eras.
- Useful: Yes; without it there is no era structure for later systems to reference.

### era_transition (Era Progression)
- Description: Advances eras from future to current to historical based on exit conditions and time elapsed. It drives phase changes that gate which systems run.
- Influenced by: `era_spawner`, pressure-changing components (for example `conflict_contagion`, `economic_stress_detector`, `universal_catalyst` actions), and entity-creating generators such as `colony_founding` or `tech_breakthrough`.
- Influences: All systems with era modifiers in `eras.json` and the `orca_raider_arrival` generator via its `era_match` condition.
- Semantic sense: Yes; the transition logic matches the era model defined in the project.
- Useful: Yes; it is the sole mechanism for temporal progression and era gating.

### universal_catalyst (Agent Actions)
- Description: Selects and executes configured actions for NPCs and factions each tick. It tracks success, prominence changes, and pressure impacts from those actions.
- Influenced by: All actions in `actions.json` plus any components that create eligible actors/targets (notably `hero_emergence`, `faction_splinter`, `war_outbreak`).
- Influences: Every action component, and downstream systems that react to new relationships or pressures (for example `conflict_contagion`, `belief_contagion`, `resource_diffusion`).
- Semantic sense: Yes; it is the central behavior engine for agent-driven change.
- Useful: Yes; it provides interactions that no other system generates.

### relationship_maintenance (Relationship Maintenance)
- Description: Decays, reinforces, and culls relationships to keep the graph healthy over time. It prevents relationship buildup from overwhelming later systems.
- Influenced by: All relationship-creating components, especially `universal_catalyst` actions, `conflict_contagion`, and major generators like `guild_establishment` and `faction_splinter`.
- Influences: Components that rely on relationship existence or strength, including `alliance_formation`, `conflict_contagion`, `prominence_evolution`, and action targeting such as `raid`.
- Semantic sense: Yes; relationship decay is consistent with a living social graph.
- Useful: Yes; it is the only long-term stabilizer for relationship density.

### conflict_contagion (Conflict Spread)
- Description: Spreads war through alliance and splinter networks by creating new `at_war_with` relationships. It models escalation and applies harmony pressure penalties.
- Influenced by: `declare_war`, `war_outbreak`, `faction_splinter`, and `alliance_formation` which supply `at_war_with` and `allied_with` links.
- Influences: `war_brewing_detector`, `war_outbreak`, the `raid` action, and harmony-dependent generators like `faction_splinter`.
- Semantic sense: Yes; conflict propagation through alliances is coherent in this setting.
- Useful: Yes; it creates emergent wars beyond direct agent actions.

### alliance_formation (Alliance Formation)
- Description: Forms alliances between factions that share enemies by adding `allied_with` edges. It represents coalition building and raises harmony pressure.
- Influenced by: `declare_war`, `conflict_contagion`, `war_outbreak`, and `faction_splinter` which create shared enemies.
- Influences: `conflict_contagion` and `belief_contagion` (both use `allied_with` vectors), and pressure thresholds that affect era progression.
- Semantic sense: Yes; alliances emerging from common enemies is consistent.
- Useful: Yes; it provides a non-agent path to alliance networks, though it overlaps with `form_alliance`.

### prominence_evolution (Prominence Evolution)
- Description: Adjusts entity prominence based on connection counts, promoting well-connected entities and demoting isolated ones. It keeps narrative importance aligned with social centrality.
- Influenced by: Relationship density created by `universal_catalyst` actions, `conflict_contagion`, and generators such as `guild_establishment`.
- Influences: `ideology_emergence` (requires renowned champions) and any selection that depends on prominence.
- Semantic sense: Yes; prominence following connectivity fits the simulation.
- Useful: Yes; it is the only systematic promoter of fame and obscurity.

### war_brewing_detector (Conflict Escalation)
- Description: Detects factions engaged in warfare and tags them `conflict` and `hostile`. It clusters `at_war_with` networks and applies harmony penalties.
- Influenced by: `declare_war`, `war_outbreak`, `conflict_contagion`, and `faction_splinter` which create `at_war_with` edges.
- Influences: Harmony pressure used by `era_transition`, plus narrative or UI uses of conflict/hostile tags.
- Semantic sense: Yes; marking warring factions as hostile is coherent.
- Useful: Yes; it bridges wars into the tagging system used by other mechanics.

### power_vacuum_detector (Leadership Crisis)
- Description: Flags factions with dead or missing leaders as `power_vacuum`, `crisis`, and `political`. It models leadership breakdown and applies security and harmony penalties.
- Influenced by: `succession` (archives leader links), `relationship_maintenance` culling, and seed or external data that marks leaders as dead.
- Influences: `succession_crisis` and any crisis-driven generators or actions that respond to low security or political tags.
- Semantic sense: Yes; leaderless factions logically enter crisis.
- Useful: Yes; it creates a clear trigger for succession and political instability.

### legend_ripe_detector (Legend Formation)
- Description: Marks dead NPCs as legendary after sufficient time has passed. It converts long-dead heroes into cultural touchstones.
- Influenced by: Dead NPCs from seed data or external events, and time progression from `era_transition`.
- Influences: `legend_crystallization` and any narrative systems that look for the `legendary` tag.
- Semantic sense: Yes; it matches the idea of legends forming over time.
- Useful: Moderate; it mainly adds tags ahead of `legend_crystallization` without many other consumers.

### magic_school_formation (Magic School Formation)
- Description: Clusters related magic abilities into a single school entity to increase narrative density. It also applies a small security pressure bonus at epoch end.
- Influenced by: Magic abilities and practitioner links from `magic_discovery`, `wild_magic_discover`, `hero_emergence`, and `cult_formation`.
- Influences: The abilities graph used by `manifest_magic` and `corrupt_location`, plus any future generators that reference magic schools.
- Semantic sense: Yes; schools of magic are a coherent aggregation of abilities.
- Useful: Yes; it creates a higher-level abstraction that no other component provides.

### combat_technique_formation (Combat Technique Formation)
- Description: Groups combat abilities into named fighting styles and creates a new abilities entity. It mirrors the magic school system for martial traditions.
- Influenced by: Combat abilities from `orca_combat_technique` and practitioner links created by `orca_raider_arrival`.
- Influences: The abilities graph and any future systems that might use combat-style tags.
- Semantic sense: Yes; aggregating techniques into styles is consistent.
- Useful: Moderate; it adds flavor but currently has few downstream consumers.

### legal_code_formation (Legal Code Formation)
- Description: Clusters related laws into unified legal codes and can spawn governance factions. It adds governance structure and boosts security pressure.
- Influenced by: Law creation from `crisis_legislation` and `guild_establishment`, plus existing rule relationships.
- Influences: New governance factions (affecting `universal_catalyst` actions), and `convert_faction` which can use law rules as instigators.
- Semantic sense: Yes; codifying laws and creating governance factions fits the world logic.
- Useful: Yes; it is the only mechanism that creates governing factions from rules.

### belief_contagion (Ideological Spread)
- Description: Spreads beliefs across the relationship graph using a contagion model. It can upgrade proposed ideologies to enacted rules once adoption is high.
- Influenced by: `ideology_emergence` and `cult_formation` (proposed rules), `convert_faction` (believer links), and network edges from `alliance_formation`, `declare_war`, and `conflict_contagion`.
- Influences: Rule statuses, `convert_faction` targeting (by adding believer_of links), and pressures that gate `era_transition`.
- Semantic sense: Yes; ideological diffusion and adoption thresholds are coherent.
- Useful: Yes; it creates belief dynamics that no other component handles.

### cultural_drift (Cultural Evolution)
- Description: Diffuses cultural tags across adjacent colonies, causing convergence or divergence based on connectivity. It is the main driver of location tag evolution over time.
- Influenced by: `adjacent_to` links from generators like `guild_establishment`, `location_discovery`, and `krill_bloom_migration`.
- Influences: Tag-based components such as `economic_prosperity_detector`, `guild_trade_expansion`, and `discovery_candidate_detector`.
- Semantic sense: Yes; cultural traits spreading through adjacency is logical.
- Useful: Yes; it is the only system that evolves location tags continuously.

### thermal_diffusion (Thermal Diffusion)
- Description: Diffuses a temperature value from anomaly sources across locations and tags them as safe or dangerous. It provides the environmental backdrop for thermal crises and recovery.
- Influenced by: Anomaly tags on locations (seed data) and central location tags used as sinks.
- Influences: `thermal_stress_detector`, `thermal_recovery_detector`, `thermal_colony_decline`, and `thermal_colony_recovery`.
- Semantic sense: Yes; heat spreading from anomalies is consistent with the world model.
- Useful: Yes; it is the only producer of safe/dangerous thermal tags.

### thermal_stress_detector (Environmental Stress)
- Description: Marks thriving colonies in dangerous zones as stressed and in crisis. It converts environmental danger into social strain.
- Influenced by: `thermal_diffusion` (dangerous tags) and colony status from recovery/decline generators.
- Influences: `economic_stress_detector` and `economic_colony_decline` via the stressed tag.
- Semantic sense: Yes; dangerous environments should stress colonies.
- Useful: Yes; it bridges thermal state to economic and social effects.

### thermal_recovery_detector (Recovery Opportunity)
- Description: Marks waning colonies in safe zones with thriving and emergent tags. It provides a gate for recovery when environmental danger subsides.
- Influenced by: `thermal_diffusion` (safe tags) and decline generators that set colonies to waning.
- Influences: `thermal_colony_recovery` by tagging recovery candidates, and narrative or UI uses of thriving/emergent tags.
- Semantic sense: Yes; safe environments enabling recovery is coherent.
- Useful: Moderate; it mainly sets tags that are also set by recovery generators.

### discovery_candidate_detector (Discovery Opportunity)
- Description: Tags hidden locations as discovered and emergent when they have few manifestations. It signals that a place is ready to enter the known world.
- Influenced by: `cultural_drift` (hidden tags), `manifest_magic` and `magic_discovery` (manifests_at links).
- Influences: `ice_memory_thaw` and other discovery-related generators by removing the hidden tag, and any narrative that surfaces discovered sites.
- Semantic sense: Yes; discovery gating by hidden status and activity is sensible.
- Useful: Moderate; it mainly toggles tags without creating entities.

### resource_diffusion (Resource & Trade Flow)
- Description: Spreads resource value across locations and tags them as thriving or stressed based on the plane value. It models economic flow from resource sources and conflict sinks.
- Influenced by: Resource tags from generators like `location_discovery`, `krill_bloom_migration`, and `guild_establishment`, plus conflict tags from `economic_stress_detector`.
- Influences: `economic_stress_detector`, `economic_prosperity_detector`, `economic_colony_decline`, and `economic_colony_recovery`.
- Semantic sense: Yes; resource diffusion and conflict sinks align with the described economy.
- Useful: Yes; it is the primary driver of economic state across locations.

### economic_stress_detector (Resource Scarcity Crisis)
- Description: Flags crowded thriving colonies as crisis/conflict when they are stressed. It reduces harmony and resource availability pressures to reflect scarcity.
- Influenced by: Stressed tags from `resource_diffusion` or `thermal_stress_detector`, and resident counts created by generators like `hero_emergence` and `succession`.
- Influences: `economic_colony_decline`, `resource_diffusion` (conflict sinks), and pressure-gated generators like `colony_founding`.
- Semantic sense: Yes; crowding and stress causing scarcity is coherent.
- Useful: Yes; it provides the only explicit crowding trigger in the economy loop.

### economic_prosperity_detector (Economic Recovery)
- Description: Marks thriving colonies with trade or resource tags as influential and central. It boosts resource availability and security pressures when prosperity is detected.
- Influenced by: Trade/resource tags from `guild_establishment`, `krill_bloom_migration`, `location_discovery`, and `cultural_drift`, and the absence of stressed tags.
- Influences: `thermal_diffusion` (uses central locations as sinks) and pressure-gated generators such as `colony_founding`.
- Semantic sense: Yes; prosperous trade centers becoming influential makes sense.
- Useful: Yes; it is the only automatic upgrade to central/influential tags.

### merchant_prosperity (Trade Network Growth)
- Description: Adjusts company faction prominence based on how many locations they control. It models trade power translating into political influence.
- Influenced by: `guild_establishment`, `krill_bloom_migration`, and `seize_control` which create `controls` relationships for company factions.
- Influences: No direct system/action/generator dependencies; it only changes company faction prominence for narration or manual review.
- Semantic sense: Mostly; the description mentions thriving colonies but the metric only counts controls without a thriving filter.
- Useful: Moderate; it is the only prominence driver specific to company factions.

### guild_trade_expansion (Guild Trade Expansion)
- Description: Tags company factions as trade and influential when they have `originated_in` ties to locations. It represents formalizing trade power through expansion.
- Influenced by: `guild_establishment` and `krill_bloom_migration` which create company factions with `originated_in` links.
- Influences: `convert_faction` (targets trade-tagged factions) and tag-based narrative or UI grouping of guilds.
- Semantic sense: Yes; trade-oriented factions gaining trade influence is consistent.
- Useful: Moderate; it mainly adds tags but enables other behaviors.

### cult_mystical_influence (Cult Mystical Influence)
- Description: Tags cult factions as mystical and influential once they control locations. It converts territorial control into spiritual authority.
- Influenced by: `cult_formation` (creates cults) and `seize_control` (gives them control links).
- Influences: `convert_faction` and `belief_contagion` via mystical tags, and any narrative filters keyed to mystical influence.
- Semantic sense: Yes; cults gaining influence through control is logical.
- Useful: Moderate; it depends on cults acquiring control but adds a distinct influence path.

### orca_raider_hostility (Orca Raider Aggression)
- Description: Tags orca NPCs as hostile raiders and external threats while lowering security pressure. It ensures external raiders remain a persistent danger.
- Influenced by: `orca_raider_arrival` (creates orca NPCs) and `kill_orca` (reduces their count).
- Influences: `kill_orca`, security-gated generators like `hero_emergence` and `crisis_legislation`, and era transitions that depend on security.
- Semantic sense: Yes; orca raiders being hostile and lowering security fits the premise.
- Useful: Moderate; it mainly adds tags and pressure changes with limited direct consumers.

## Actions

### seize_control (Seize Control)
- Description: A faction takes control of a nearby location not already under its rule. It creates a `controls` relationship and decreases security pressure.
- Influenced by: `universal_catalyst` plus existing `controls` networks from `guild_establishment`, `colony_founding`, `krill_bloom_migration`, and prior `seize_control` actions.
- Influences: `merchant_prosperity`, `cult_mystical_influence`, and any system that counts controlled locations, as well as security-based era transitions.
- Semantic sense: Yes; territorial expansion is consistent with faction behavior.
- Useful: Yes; it is the main way factions expand control after generation.

### form_alliance (Form Alliance)
- Description: A faction forges an alliance with another faction not already allied or at war. It creates a bidirectional `allied_with` relationship and raises harmony.
- Influenced by: `universal_catalyst` and the existing war/alliance graph created by `declare_war`, `conflict_contagion`, and `alliance_formation`.
- Influences: `conflict_contagion` and `belief_contagion`, both of which use alliance networks.
- Semantic sense: Yes; alliances formed by factions are coherent.
- Useful: Moderate; it overlaps with `alliance_formation` but provides an agent-driven path.

### declare_war (Declare War)
- Description: A faction declares war on another faction, creating an `at_war_with` relationship. It reduces harmony pressure to reflect open conflict.
- Influenced by: `universal_catalyst` and the absence of existing war links maintained by `conflict_contagion` and `war_outbreak`.
- Influences: `conflict_contagion`, `war_brewing_detector`, `war_outbreak`, and the `raid` action.
- Semantic sense: Yes; open war declarations align with faction dynamics.
- Useful: Yes; it is the primary direct ignition of wars.

### raid (Raid)
- Description: A faction attacks an enemy faction and creates an `enemy_of` relationship. It decreases harmony to represent ongoing hostility.
- Influenced by: `universal_catalyst` and existing `at_war_with` links from `declare_war` or `conflict_contagion`.
- Influences: `relationship_maintenance` (new enemy edges) and narrative conflict context.
- Semantic sense: Yes; raids between enemies make sense.
- Useful: Moderate; `enemy_of` is not widely consumed by other systems.

### establish_trade (Establish Trade Route)
- Description: Connects two thriving locations with a `trades_with` relationship. It increases resource availability to reflect economic growth.
- Influenced by: `universal_catalyst`, thriving locations from `resource_diffusion` or recovery generators, and trade/resource tags from `guild_establishment` or `krill_bloom_migration`.
- Influences: `era_transition` and pressure-gated generators like `colony_founding` through its resource_availibility boost, plus any narrative that uses trade links.
- Semantic sense: Yes; trade routes and resource boosts fit the world model.
- Useful: Yes; it is the only action that explicitly creates trade links.

### corrupt_location (Corrupt Location)
- Description: A magic ability corrupts a location, linking the two with `related_to`. It reduces magical stability to represent growing corruption.
- Influenced by: `universal_catalyst`, magic abilities from `magic_discovery` or `wild_magic_discover`, and practitioners from `hero_emergence` or `cult_formation`.
- Influences: Magical stability dependent generators (`cult_formation`, `wild_magic_discover`, `magic_discovery`) and corruption-related narratives.
- Semantic sense: Yes; magical corruption spreading to places is coherent.
- Useful: Yes; it is the primary action that drives magical instability downward.

### manifest_magic (Manifest Magic)
- Description: A magic ability manifests at a location, creating a `manifests_at` relationship. It lowers magical stability and raises the prominence of the ability and its practitioner.
- Influenced by: `universal_catalyst`, magic abilities from `magic_discovery` or `wild_magic_discover`, and practitioners from `hero_emergence` or `cult_formation`.
- Influences: `discovery_candidate_detector` and `wild_magic_discover` (both track manifestation counts), and magical stability driven generators.
- Semantic sense: Yes; tying magic to locations is consistent.
- Useful: Yes; it is the main way abilities become location-bound.

### spread_innovation (Spread Innovation)
- Description: Spreads a technology ability to a new faction by creating a `practitioner_of` relationship. It raises resource availability to reflect improved productivity.
- Influenced by: `universal_catalyst`, technology abilities from `tech_breakthrough` or `krill_bloom_migration`, and target faction tags from `guild_establishment` or `cultural_drift`.
- Influences: `resource_availibility` pressure used by `colony_founding` and `era_transition`, and the tech practice network for future innovations.
- Semantic sense: Yes; technology diffusion to organized factions fits the simulation.
- Useful: Moderate; it mainly modifies pressure and practitioner links without many direct consumers.

### convert_faction (Convert Faction)
- Description: Converts a faction to an ideology or law by creating a `believer_of` relationship. It increases harmony and security to reflect social cohesion.
- Influenced by: `universal_catalyst`, rules from `ideology_emergence`, `cult_formation`, or `crisis_legislation`, and faction tags from `guild_trade_expansion` or `cult_mystical_influence`.
- Influences: `belief_contagion` (expanded believer network) and pressure-driven era transitions.
- Semantic sense: Yes; conversion to a belief system is coherent.
- Useful: Yes; it is the only direct conversion action for factions.

### draw_in_faction (Draw In Faction)
- Description: Pulls a faction into a war occurrence by creating a `participant_in` relationship. It lowers harmony to represent widening conflict.
- Influenced by: `universal_catalyst` and war occurrences created by `war_outbreak`.
- Influences: `escalate_war` (requires participants) and war narrative intensity through additional participants.
- Semantic sense: Yes; wars expanding to new factions is consistent.
- Useful: Yes; it is the only action that expands war participation.

### escalate_war (Escalate War)
- Description: Increases the strength of `participant_in` relationships for an ongoing war. It reduces harmony to signal escalation.
- Influenced by: `universal_catalyst`, war occurrences from `war_outbreak`, and participant links from `draw_in_faction`.
- Influences: War relationship strength used by `relationship_maintenance` and narrative outputs.
- Semantic sense: Yes; escalation should intensify participant ties.
- Useful: Moderate; few systems respond to participant strength.

### spread_corruption (Spread Corruption)
- Description: Spreads corruption from a mystical or dangerous location to adjacent locations by creating `related_to` links. It reduces magical stability as corruption grows.
- Influenced by: `universal_catalyst`, location tags from `thermal_diffusion` and `cultural_drift`, and adjacency links from `location_discovery` or `guild_establishment`.
- Influences: Magical stability dependent generators (`cult_formation`, `magic_discovery`, `wild_magic_discover`) and corruption-themed narratives.
- Semantic sense: Yes; corruption spreading along adjacency is coherent.
- Useful: Yes; it is the only action that propagates corruption spatially.

### kill_orca (Kill Orca)
- Description: A hero kills an orca NPC, changing its status to dead and increasing security. It resolves external threats through direct action.
- Influenced by: `universal_catalyst`, hero NPCs from `hero_emergence`, and orca NPCs from `orca_raider_arrival`.
- Influences: `orca_raider_arrival` and `orca_combat_technique` (by reducing orca counts) plus security-gated generators and era transitions.
- Semantic sense: Yes; heroes killing orcas fits the setting, though the action text has a minor typo.
- Useful: Moderate; it is the only action that removes orca threats and boosts security.

## Generators

### hero_emergence (Hero Emergence)
- Description: Spawns a new hero NPC in a colony during troubled times. It assigns culture, relationships, and a boost to security with a small magical stability cost.
- Influenced by: Low `security`, `harmony`, or `resource_availibility` pressures from conflict and economy systems, plus colony availability from `colony_founding`.
- Influences: `universal_catalyst` (new actor), `legend_ripe_detector` and `legend_crystallization` (future hero legends), and `magic_school_formation` via practitioner links.
- Semantic sense: Yes; heroes emerging during crisis is consistent.
- Useful: Yes; it introduces heroic agents and relationships not created elsewhere.

### succession (Leadership Succession)
- Description: Creates a successor mayor for an existing leader and transfers leadership roles. It archives the old leader's `leader_of` relationships to formalize the transition.
- Influenced by: Pressure dips from `conflict_contagion` or `economic_stress_detector`, and the presence of mayor leaders from seeds or earlier `succession` runs.
- Influences: `power_vacuum_detector` and `succession_crisis` by updating leadership links, plus `universal_catalyst` via a new leader NPC.
- Semantic sense: Yes; leadership transitions and mentor links are coherent.
- Useful: Yes; it is the only mechanism that refreshes leadership without outright death.

### orca_raider_arrival (Orca Raiders Arrive)
- Description: Spawns an orca raider NPC at a colony and links it to defenders and combat abilities. It lowers security to represent a new external threat.
- Influenced by: `era_transition` (era match for invasion), low security pressure, and orca population limits affected by `kill_orca`.
- Influences: `orca_raider_hostility`, `orca_combat_technique`, and the `kill_orca` action through new orca targets.
- Semantic sense: Yes; raiders arriving during insecure eras fits the setting.
- Useful: Yes; it is the primary external threat generator.

### faction_splinter (Faction Splinter)
- Description: Creates a splinter faction that immediately opposes its parent and occupies territory. It models political fragmentation by adding `splinter_of` and `at_war_with` relationships.
- Influenced by: Low harmony pressure from `conflict_contagion` or `declare_war`, and the existence of faction members and controlled locations.
- Influences: `conflict_contagion`, `war_brewing_detector`, `war_outbreak`, and `alliance_formation` via new war and splinter links.
- Semantic sense: Yes; splinter groups forming during unrest is coherent.
- Useful: Yes; it introduces factional schisms that no other generator creates.

### guild_establishment (Guild Formation)
- Description: Creates a merchant guild faction, a trade hub location, and a charter law tied to a colony. It seeds the trade economy with new entities and relationships.
- Influenced by: Colony availability from seeds or `colony_founding` and the lack of other gating rules in this generator.
- Influences: `guild_trade_expansion`, `merchant_prosperity`, `economic_prosperity_detector`, and the `establish_trade` action through new trade tags and controls.
- Semantic sense: Yes; guilds, hubs, and charters fit the world model.
- Useful: Yes; it bootstraps the trade system and related entities.

### cult_formation (Cult Awakening)
- Description: Spawns a mystical cult faction and its doctrine near anomalies or points of interest. It adds believer and practitioner relationships and lowers security and magical stability.
- Influenced by: Low magical stability from `corrupt_location`, `manifest_magic`, or `spread_corruption`, plus available magic abilities from `magic_discovery` or `wild_magic_discover`.
- Influences: `belief_contagion`, `cult_mystical_influence`, and `convert_faction` via new rules and mystical tags.
- Semantic sense: Yes; cults arising around anomalies is consistent.
- Useful: Yes; it creates a distinct religious/mystical faction loop.

### colony_founding (Colony Foundation)
- Description: Creates a new colony location and a political council faction that controls it. It links the new colony to the source colony through trade and alliance ties.
- Influenced by: Positive pressure levels from `resource_diffusion`, `economic_prosperity_detector`, and recovery generators, plus the availability of thriving colonies.
- Influences: `merchant_prosperity`, `guild_trade_expansion`, `seize_control`, and era transitions through increased location counts.
- Semantic sense: Mostly; the `allied_with` relationship is defined for factions/NPCs but is created here between locations.
- Useful: Yes; it is the primary expansion mechanism for colonies.

### location_discovery (Location Discovery)
- Description: Creates a new resource node location discovered by an explorer NPC. It increases resource availability and adds adjacency links to existing locations.
- Influenced by: Explorer NPCs from `hero_emergence` or `succession` and the availability of undiscovered spaces.
- Influences: `resource_diffusion`, `economic_prosperity_detector`, and `establish_trade` through new resource tags and adjacency.
- Semantic sense: Yes; discovery by explorers is coherent.
- Useful: Yes; it is a key source of new resource locations.

### krill_bloom_migration (Krill Bloom Discovery)
- Description: Creates a resource bloom location, a harvesting technology, and a new company faction. It boosts resource availability but reduces harmony to represent competition.
- Influenced by: `resource_availibility` pressure and colonies without existing company origins, as shaped by `resource_diffusion`.
- Influences: `merchant_prosperity`, `guild_trade_expansion`, `spread_innovation`, and `resource_diffusion` through new resources and companies.
- Semantic sense: Yes; a resource boom causing new tech and companies is consistent.
- Useful: Yes; it seeds the economic and tech loops in one event.

### war_outbreak (War Outbreak)
- Description: Creates a war occurrence between factions already at war and marks the conflict. It adds participants and reduces harmony and security pressures.
- Influenced by: `declare_war`, `conflict_contagion`, and `faction_splinter` which create `at_war_with` links.
- Influences: `draw_in_faction` and `escalate_war` actions by providing war occurrences, plus conflict-tag narratives.
- Semantic sense: Yes; war occurrences emerging from war relationships is logical.
- Useful: Yes; it is the only generator that creates war occurrences.

### succession_crisis (Succession Crisis)
- Description: Creates a succession crisis occurrence for leaderless factions and marks them as waning. It reduces security and harmony to reflect instability.
- Influenced by: Missing leader links from `succession`, `relationship_maintenance` culling, or seed/external data that leaves factions leaderless.
- Influences: `crisis_legislation` (via lowered security), and future leadership recovery via `succession`.
- Semantic sense: Yes; leaderless factions falling into crisis is coherent.
- Useful: Yes; it is the only explicit political crisis generator.

### legend_crystallization (Legend Crystallization)
- Description: Creates a memorial rule for a dead hero and marks them as legendary and fictional. It formalizes legend status into the rules layer.
- Influenced by: Dead heroes from seed data or external events, and time-based tagging from `legend_ripe_detector`.
- Influences: `legend_ripe_detector` (prevents repeat tagging) and narrative emphasis on the deceased hero.
- Semantic sense: Yes; memorializing heroes into lore is consistent.
- Useful: Moderate; it adds cultural artifacts but has limited mechanical consumers.

### crisis_legislation (Crisis Law)
- Description: Creates an emergency law in a colony when security or harmony is very low. It boosts security pressure and links the law to a main threat.
- Influenced by: Pressure drops from `conflict_contagion`, `orca_raider_hostility`, `economic_stress_detector`, and the presence of orca/outlaw NPCs from `orca_raider_arrival`.
- Influences: `legal_code_formation` and `convert_faction` via new law rules, plus security-based era transitions.
- Semantic sense: Yes; emergency laws tied to threats are coherent.
- Useful: Yes; it is the only generator that creates crisis laws.

### great_festival (Great Festival)
- Description: Creates a social rule representing a major festival and links it to factions. It increases harmony and can form new alliances between those factions.
- Influenced by: Colony availability and existing factions; it also avoids overusing celebrations via its count limit.
- Influences: `alliance_formation` and `conflict_contagion` through new alliances, plus harmony-driven era transitions.
- Semantic sense: Yes; festivals fostering alliances fits the setting.
- Useful: Yes; it is the main positive cultural event generator.

### tech_breakthrough (Technological Breakthrough)
- Description: Creates a new technology ability for a faction at one of its origin locations. It raises resource availability to reflect increased productivity.
- Influenced by: Factions with `originated_in` ties created by `guild_establishment`, `krill_bloom_migration`, or `colony_founding`, and existing technology abilities.
- Influences: `spread_innovation`, company prominence through new practitioner links, and resource-based era transitions.
- Semantic sense: Yes; tech emerging from established factions and locales is consistent.
- Useful: Yes; it is the main source of new technology abilities.

### orca_combat_technique (Orca Combat Technique)
- Description: Creates a combat ability associated with orca raiders and links it to orca practitioners. It expands the combat ability pool for external threats.
- Influenced by: Orca NPCs from `orca_raider_arrival` and existing combat abilities for derivation.
- Influences: `combat_technique_formation` and the strength of orca-related conflicts.
- Semantic sense: Yes; specialized orca techniques fit the world.
- Useful: Moderate; it adds flavor and feeds clustering but has limited direct consumers.

### magic_discovery (Magical Discovery)
- Description: Creates a new magic ability discovered by an NPC and links it to an anomaly. It increases magical stability to reflect controlled discovery.
- Influenced by: `magical_stability` pressure, available anomalies, and explorer NPCs from `hero_emergence` or `succession`.
- Influences: `manifest_magic`, `corrupt_location`, `magic_school_formation`, and `cult_formation` by expanding the magic pool.
- Semantic sense: Yes; magic discoveries emerging from explorers and anomalies is coherent.
- Useful: Yes; it is a core source of magic abilities.

### ideology_emergence (Ideological Movement)
- Description: Creates a proposed ideology rule championed by a renowned hero. It links the ideology to the champion, their faction, and related beliefs.
- Influenced by: `prominence_evolution` (creates renowned heroes) and faction membership from `hero_emergence` or `guild_establishment`.
- Influences: `belief_contagion` and `convert_faction` through new ideology rules and believer links.
- Semantic sense: Yes; influential heroes founding ideologies is consistent.
- Useful: Yes; it is the only generator that seeds new ideologies.

### thermal_colony_decline (Colony Thermal Decline)
- Description: Creates a thermal disaster occurrence at a dangerous colony and marks it waning and stressed. It externalizes environmental danger into a crisis event.
- Influenced by: `thermal_diffusion` (dangerous tags) and thriving colony status from recovery systems.
- Influences: `thermal_recovery_detector`, `economic_colony_decline`, and `economic_stress_detector` via stressed/waning status.
- Semantic sense: Yes; dangerous conditions causing decline fits the model.
- Useful: Yes; it is the main thermal decline event generator.

### thermal_colony_recovery (Colony Thermal Recovery)
- Description: Creates a celebration occurrence at a safe, waning colony and restores it to thriving status. It represents recovery after environmental hardship.
- Influenced by: `thermal_diffusion` (safe tags) and prior decline from `thermal_colony_decline` or `economic_colony_decline`.
- Influences: `economic_prosperity_detector`, `colony_founding`, and other growth mechanics that require thriving colonies.
- Semantic sense: Yes; safe conditions leading to recovery is coherent.
- Useful: Yes; it is the primary thermal recovery event.

### thermal_migration (Thermal Migration)
- Description: Creates a refugee camp location tied to a source and refuge colony. It marks a migrant NPC as emergent and models displacement.
- Influenced by: Fire/ice tagged locations and resident NPCs, which currently come from seed data more than other systems.
- Influences: `economic_stress_detector` by changing resident distributions, and narrative migration arcs.
- Semantic sense: Yes; thermal hardship causing migration is consistent.
- Useful: Moderate; it adds population movement but has limited mechanical follow-through.

### ice_memory_thaw (Ice Memory Thaw)
- Description: Creates a discovered point of interest that contains a thawed memory cache. It can associate a hidden ability with that location and removes the hidden tag from the source.
- Influenced by: Hidden tags from `cultural_drift` or seeds and available abilities from `magic_discovery` or `wild_magic_discover`.
- Influences: `discovery_candidate_detector` (by removing hidden) and future exploration narratives around the new location.
- Semantic sense: Yes; thawed memories as discoveries fit the setting.
- Useful: Moderate; it adds flavor and a discovered location without many mechanical dependencies.

### economic_colony_decline (Colony Economic Decline)
- Description: Creates an economic disaster occurrence at a stressed, thriving colony and sets it to waning. It formalizes economic collapse as a world event.
- Influenced by: Stressed tags from `resource_diffusion` or `thermal_stress_detector` and thriving status from recovery systems.
- Influences: `economic_colony_recovery`, `colony_founding`, and `economic_prosperity_detector` by flipping colony status and tags.
- Semantic sense: Yes; economic stress leading to decline is coherent.
- Useful: Yes; it is the main economic decline event.

### economic_colony_recovery (Colony Economic Recovery)
- Description: Creates a trade revival celebration at a waning colony and restores it to thriving status. It represents economic rebound driven by trade or resources.
- Influenced by: Trade/resource tags from `guild_establishment`, `krill_bloom_migration`, or `resource_diffusion`, and waning status from decline generators.
- Influences: `economic_prosperity_detector`, `colony_founding`, and `establish_trade` by creating thriving targets.
- Semantic sense: Yes; recovery celebrations from trade booms are consistent.
- Useful: Yes; it is the primary economic recovery event.

### wild_magic_discover (Wild Magical Discovery)
- Description: Creates a secret, wild magic ability at an anomaly and links it to a discoverer. It raises magical stability while expanding the magic pool.
- Influenced by: Low magical stability from `corrupt_location` or `spread_corruption`, anomaly locations, and hero/merchant NPCs from `hero_emergence` or `guild_establishment`.
- Influences: `manifest_magic`, `corrupt_location`, `magic_school_formation`, and `cult_formation` via new magic abilities.
- Semantic sense: Yes; unstable conditions revealing wild magic is coherent.
- Useful: Yes; it adds a distinct type of magic discovery.

## Summary Actions / Recommendations
- Verify generator activation: `eras.json` has no `generatorModifiers`, so confirm whether generators are meant to run without weights or add per-era weights if they are currently inert.
- Resolve relationship schema mismatch: `colony_founding` creates `allied_with` between locations, but `relationshipKinds.json` only allows factions/NPCs; update the relationship kind or use a location-safe alternative (for example `adjacent_to` or `related_to`).
- Decide on tag-only systems: `guild_trade_expansion`, `cult_mystical_influence`, and `orca_raider_hostility` mainly add tags; either add downstream consumers or mark them as narrative-only to avoid dead-end mechanics.
- Align prominence and selection logic: `merchant_prosperity` only changes prominence; if prominence is meant to drive behavior, add consumers beyond narrative display.
- Add a consistent death pipeline if legends are desired: `legend_ripe_detector` and `legend_crystallization` currently rely on dead NPCs from seeds or external events; consider adding explicit death actions/events to keep that loop active.
