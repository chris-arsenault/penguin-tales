# Lore Weave

*The engine that makes worlds out of nothing but rules and randomness.*

---

## What It Does

Lore Weave is a **procedural world generator**. You give it a schema (what kinds of things can exist), some templates (how to create them), and some systems (how they evolve over time). Then you press go and it simulates history.

The output is a knowledge graph - entities connected by relationships, each with attributes, histories, and generated descriptions. The Berg you're exploring was created by Lore Weave.

---

## The Core Loop

Lore Weave alternates between two phases:

### Growth Phase
Templates fire, creating new entities. A character template might spawn a merchant. A faction template might create a guild. Templates can create batches of pre-connected entities - a family with relationships already defined, a guild with its founding members.

Growth is guided by "pressures" - the simulation's sense of what the world needs more of. Too few characters? Character templates fire more often. Too few conflicts? Templates that generate rivalries get priority.

### Simulation Phase
Systems run, modifying existing entities and creating relationships between them. A "catalyst" system might introduce a crisis that forces factions to respond. An "evolution" system might age characters, change their status, or kill them off. A "contagion" system might spread beliefs, diseases, or fashions through the population.

Systems don't create entities directly - they work with what exists, adding complexity and interconnection.

---

## Eras

The simulation runs through defined "eras" - periods of history with different themes and pressures. The Berg's history includes eras like:

- **The Founding** - Early settlement, establishment of cultures
- **The Trade Wars** - Economic competition between factions
- **The Long Peace** - Stability and cultural flourishing
- **The Breaking** - Conflict and collapse

Each era has different template weights (what kinds of entities get created), system configurations (what happens to existing entities), and pressures (what the simulation wants more or less of).

When an era ends, a new one begins. The simulation doesn't know where it's going - it discovers history as it generates it.

---

## The Graph

Everything Lore Weave creates lives in a knowledge graph. Entities are nodes; relationships are edges. The graph is the canonical source of truth about the world.

Relationships have types ("leads", "rivals", "member_of"), directions (who relates to whom), and metadata (when formed, how strong, etc.). The graph can be queried to answer questions like "who are all the rivals of this character?" or "what factions control this region?"

The graph grows over time. Early in a simulation, it's sparse. Later, it's dense with connections. The density itself tells a story - a heavily connected entity is important; an isolated one is marginal.

---

## Templates In Detail

Templates are declarative recipes for creating entities. A character template might specify:

- **Kind**: character
- **Culture**: aurora (determines naming rules)
- **Subtype weights**: 40% merchant, 30% artisan, 20% mystic, 10% warrior
- **Initial relationships**: member of a random faction, knows 1-3 other characters
- **Attribute ranges**: prominence between marginal and recognized

Templates can reference other templates, creating chains of generation. A "guild founding" template might create a guild, then invoke a "founder" template several times to create its initial members.

---

## Systems In Detail

Systems are declarative rules for what happens during simulation. A relationship-formation system might specify:

- **Selector**: find pairs of characters in the same faction
- **Condition**: they don't already have a relationship
- **Action**: 60% chance to form friendship, 20% chance rivalry, 20% chance nothing
- **Side effects**: update both characters' "updatedAt" timestamps

Systems can have complex selectors ("characters with prominence > recognized who belong to factions tagged 'militant'") and complex actions ("reduce prominence, add 'disgraced' tag, sever all leadership relationships").

---

## What Comes Out

After a simulation run, you have:

- A graph of entities and relationships
- A history of what happened (notable events, era transitions)
- Statistics (entity counts by kind, relationship densities)
- Raw entity data ready for enrichment

This is what feeds into Illuminator for AI enhancement and then into Chronicler for presentation.

---

## Narrative Loops

The difference between a simulation and a story is *closure*. A simulation can run forever, accumulating entities and relationships. A story has arcs - needs that arise, actions taken to address them, consequences that create new needs.

Lore Weave achieves narrative coherence through **loops** - cycles of interconnected mechanics that create story arcs through pure emergence.

### The Loop Pattern

Every narrative loop follows the same structure:

```
NEED → PROGRESSION → REWARD → LOOP
```

**Need:** An entity exists in a state that motivates action. A weapon without a wielder. A faction with enemies. A location with corruption.

**Progression:** The entity takes actions (via the catalyst system) or triggers systems that respond to its state. A weapon seeks a hero. A faction raids its enemy. A hero cleanses the corruption.

**Reward:** The action produces consequences - prominence changes, relationships form or break, tags get added or removed. The world state is different.

**Loop:** The reward creates new needs. The hero who gains a weapon becomes a target. The faction that wins a raid gains enemies. The cleansed location attracts settlers. The cycle continues.

### Loop Mechanics

Loops are implemented through the interplay of templates, systems, and actions:

- **Templates** create the initial conditions - entities in states that have needs
- **Systems** detect conditions and modify entity states, often creating new needs
- **Actions** let entities address their needs, producing consequences that feed back into the loop

The key insight: a well-designed loop is *self-sustaining*. Once seeded, it generates its own fuel. Each resolution creates the conditions for future activation.

Consider a simple combat loop: templates create warriors and enemies. The `enmity` system detects opposing factions and creates conflict relationships. The `combat` action resolves conflicts. Combat produces winners (who gain prominence and attract new challenges) and losers (who seek revenge or die, creating power vacuums). The loop feeds itself.

### Loop Closure

A critical property of loops is **closure** - every mechanic that creates a state must be balanced by mechanics that consume it.

- If corruption spreads, cleansing must be possible
- If wars start, peace negotiations must exist
- If artifacts degrade, restoration must be achievable

Without closure, states accumulate and the simulation stagnates. Wars that never end. Corruption that only spreads. Damaged artifacts with no path to repair. These are **dead ends** - states that consume without producing.

Loops create the opposite: **living cycles** where every state is both a consequence and an opportunity.

### Loop Interference

The most interesting narratives emerge when loops *interfere* with each other. A hero seeking a weapon (hero-weapon loop) might encounter corruption during the search (corruption loop). A faction war (war loop) might produce damaged artifacts (artifact degradation loop) that call to restorers (restoration loop).

This interference is not designed - it emerges from loops sharing the same entity pool. When a hero exists in multiple loops simultaneously, the loops interact through that shared entity. The hero's weapon search is complicated by their corruption. Their corruption is complicated by the war they're drawn into.

Design loops to operate on overlapping entity kinds, and interference happens naturally.

---

## Designing Effective Loops

Building loops that produce good stories requires attention to several principles.

### State Machines Over Binary Outcomes

Entities should progress through states rather than flip instantly:

```
Healthy → Wounded → Maimed → Dead
Clean → Corrupted → Cursed → Dead
Intact → Damaged → Destroyed
```

Each intermediate state is an opportunity - for intervention, for story, for other loops to interact. Binary outcomes (alive/dead) collapse these opportunities.

### Reversibility Where Meaningful

Some transitions should be reversible: damaged artifacts can be restored, corrupted heroes can be cleansed. This creates tension (will recovery happen in time?) and meaningful relationships (the restorer becomes connected to the restored).

Other transitions should be permanent: death, destruction, betrayal. These create consequences that matter. The balance between reversible and permanent states determines the simulation's emotional stakes.

### Prominence as Currency

Loops should trade in prominence. Actions that resolve needs should reward prominence. This creates a economy where:

- Entities gain prominence by participating in loops
- High-prominence entities activate more loops (catalyst threshold)
- The most-connected entities are the most prominent

Prominence becomes a measure of narrative importance, earned through participation rather than assigned by fiat.

### The Setting Acts

In traditional game design, player characters have agency and the world reacts. In Lore Weave, the *setting itself* can act. Artifacts choose wielders. Locations remember residents. Wars mark survivors.

This inverts the typical protagonist hierarchy. NPCs gain prominence not by acting, but by being acted upon by significant things. The legendary hero is legendary because the legendary weapon chose them - not the other way around.

Design loops where setting elements (artifacts, locations, events) have agency, and NPCs inherit significance through connection.

---

## Philosophy

Lore Weave is built on a belief that coherent worlds emerge from consistent rules applied over time. We don't hand-craft specific characters or plot beats. We define *kinds* of things and *patterns* of behavior, then let the simulation discover what happens.

This means accepting that some generated content will be boring, contradictory, or just wrong. That's the cost of emergence. The benefit is that sometimes the simulation surprises us - creates connections we didn't plan, narratives we didn't expect, a world that feels discovered rather than designed.

The ice doesn't care what we intended. It just remembers what happened.