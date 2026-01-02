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

## Philosophy

Lore Weave is built on a belief that coherent worlds emerge from consistent rules applied over time. We don't hand-craft specific characters or plot beats. We define *kinds* of things and *patterns* of behavior, then let the simulation discover what happens.

This means accepting that some generated content will be boring, contradictory, or just wrong. That's the cost of emergence. The benefit is that sometimes the simulation surprises us - creates connections we didn't plan, narratives we didn't expect, a world that feels discovered rather than designed.

The ice doesn't care what we intended. It just remembers what happened.