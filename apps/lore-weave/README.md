# 🐧 Penguin History Engine - World Generator

> *HONK!* Procedural world history generation for a thriving penguin civilization on Aurora Berg

A hybrid template + simulation system that generates rich, interconnected knowledge graphs starting from a minimal seed (~14 entities) and producing a dense world (~150-200 entities, ~300-500 relationships) suitable for game initialization.

---

## 🎯 Quick Start

```bash
# Install dependencies
npm install

# Generate a world (with LLM enrichment)
npm run dev

# Build TypeScript
npm run build

# Run compiled version
npm start

# Clean output
npm run clean
```

## 🐧 HONK! What You Get

Generated worlds are saved to `output/`:
- 📜 `generated_world.json` - Complete world state with all entities, relationships, and lore
- 🕸️ `graph_viz.json` - Visualization-ready graph format
- 📝 `llm_calls.log` - Detailed LLM enrichment logs (if enabled)
- 🎭 `lore.json` - All narrative enrichment records

## ⚙️ Configuration

### LLM Enrichment (Optional)

Set environment variables to enable narrative generation:

```bash
# Enable LLM enrichment
export LLM_ENABLED=true              # or 'full' or 'partial'
export ANTHROPIC_API_KEY=your_key_here
export LLM_MODEL=claude-3-5-haiku-20241022  # or other Claude model

# Adjust batch size (default: 2)
export LLM_BATCH_SIZE=3
```

**Enrichment Modes:**
- `off` - No LLM calls, procedural names only
- `partial` - Limited enrichment (1 entity, 1 relationship, 1 era narrative)
- `full` - Complete narrative generation (~100-200 LLM calls)

### Generation Parameters

Edit `src/main.ts` to adjust:

```typescript
const config: EngineConfig = {
  epochLength: 20,                    // Ticks per epoch (not currently used)
  simulationTicksPerGrowth: 15,       // Simulation ticks between growth phases
  targetEntitiesPerKind: 30,          // Target ~150 total entities (5 kinds)
  maxTicks: 500,                      // Maximum simulation ticks
  relationshipBudget: {
    maxPerSimulationTick: 50,         // Hard cap per tick
    maxPerGrowthPhase: 150            // Hard cap per growth
  }
};
```

---

## 🏗️ Architecture Overview

### The Hybrid Model

The engine alternates between two phases:

1. **🌱 Growth Phase**: Templates create **batches of pre-connected entities**
2. **⚙️ Simulation Phase**: Systems create **relationships between existing entities**

This achieves 80% of full simulation depth with 20% of the complexity.

📖 **See**: `docs/adr/001-hybrid-template-simulation-model.md` for detailed rationale

### 🛠️ Builder Utilities (NEW)

The framework provides reusable utilities to reduce boilerplate:

**RelationshipBuilder** (`src/utils/relationshipBuilder.ts`):
```typescript
const relationships = buildRelationships()
  .add('member_of', npc.id, faction.id)
  .addManyFrom('allied_with', faction1.id, [faction2.id, faction3.id])
  .addBidirectional('trades_with', colony1.id, colony2.id)
  .build();
```

**EntityClusterBuilder** (`src/utils/entityClusterBuilder.ts`):
```typescript
const cluster = buildCluster()
  .addEntity({ kind: 'faction', name: 'Traders Guild' })
  .addEntity({ kind: 'npc', name: 'Bob' })
  .relate(1, 0, 'member_of')  // Bob joins guild
  .buildWithDescription('Guild established');
```

📖 **See**: `AUTONOMOUS_SESSION_2025-11-24.md` for usage examples

### 🐧 Five Eras of Penguin History

1. **The Great Thaw** (Expansion) - Exploration and colony founding
2. **The Faction Wars** (Conflict) - Resource scarcity leads to conflict
3. **The Clever Ice Age** (Innovation) - Technology and magic flourish
4. **The Orca Incursion** (Invasion) - External threats unite colonies
5. **The Frozen Peace** (Reconstruction) - Rebuilding after the wars

### 📊 Pressure System

Six background forces that accumulate and trigger events:
- `resource_scarcity` - Krill shortages, ice coin melting
- `conflict` - Factional tensions, territorial disputes
- `magical_instability` - Glow-Fissure disturbances
- `cultural_tension` - Colony value conflicts
- `stability` - Peaceful periods enable growth
- `external_threat` - Orcas, leopard seals, environmental dangers

---

## 📁 Project Structure

```
world-gen/
├── src/
│   ├── engine/          # 🎮 Main orchestration (worldEngine.ts)
│   ├── templates/       # 🏭 Entity creation factories
│   │   ├── npc/         # Heroes, merchants, outlaws, families
│   │   ├── faction/     # Guilds, cults, criminal syndicates
│   │   ├── location/    # Colonies, geographic features, anomalies
│   │   ├── rules/       # Social norms, taboos, festivals
│   │   └── abilities/   # Magic and technology
│   ├── systems/         # ⚙️ Simulation rules (simulationSystems.ts)
│   ├── services/        # 🤖 LLM enrichment and validation
│   ├── config/          # 📜 Eras (eras.ts) and pressures (pressures.ts)
│   ├── types/           # 📐 TypeScript definitions
│   └── utils/           # 🛠️ Helper functions and validators
├── data/
│   ├── initialState.json      # 14 canonical seed entities
│   └── LORE_BIBLE.md          # Penguin world lore and canon
├── output/              # Generated worlds
└── worldSchema.json     # Entity/relationship schema (referenced in docs)
```

---

## 🎭 LLM Enrichment System

When enabled, the engine performs **multi-phase narrative generation**:

### 🌱 Creation Enrichment
- **Cluster-based batching**: Entities created together are enriched together
- **Relationship-aware**: Descriptions reference actual connections
- **Canon-compliant**: References LORE_BIBLE.md for consistency

### 🔄 Evolution Enrichment
- **Change tracking**: Monitors status, prominence, and relationship changes
- **Supplemental lore**: Adds narrative entries for significant events
- **Chronological records**: Multiple entries per entity showing their journey

### 📚 Enrichment Types
- `name` / `description` - Entity creation lore
- `entity_change` - Life events and transformations
- `era_narrative` - Pivotal events between eras
- `relationship_backstory` - How connections formed
- `discovery_event` - Location exploration narratives
- `chain_link` - Geographic discovery connections
- `tech_magic` - Ability flavor text

---

## 📖 Documentation

- **[../ARCHITECTURE.md](../ARCHITECTURE.md)** - Detailed system design
- **[SYSTEM_IMPLEMENTATION_GUIDE.md](SYSTEM_IMPLEMENTATION_GUIDE.md)** - Implementation patterns and best practices
- **[../CLAUDE.md](../CLAUDE.md)** - Development guide for Claude Code
- **[../LLM_INTEGRATION.md](../LLM_INTEGRATION.md)** - LLM enrichment details
- **[../NEW_MECHANICS.md](../NEW_MECHANICS.md)** - Advanced mechanics

---

## 🧪 Initial State

The seed world (`data/initialState.json`) contains **14 canonical entities**:

**Locations (6):**
- 🏔️ Aurora Berg (the iceberg itself)
- 🏛️ Aurora Stack (orderly trade colony)
- 🌙 Nightfall Shelf (shadow-side independent colony)
- ✨ The Glow-Fissure (mystical anomaly)
- 🌊 The Middle Pools (neutral fishing grounds)
- 👻 Echo Hollow (abandoned mystery site)

**Factions (2):**
- 💼 The Icebound Exchange (merchant guild)
- 🗡️ The Midnight Claws (criminal syndicate)

**NPCs (4):**
- 👑 Mayors of both colonies (Gleambeak, Wavekeeper)
- 🦸 Heroes (Crystalwatcher, Tidecaller)

**Abilities (2):**
- ✨ Ice Magic (frost shaping, deep sight)
- 🔧 Arctic Engineering (harmonic harpoons, ice augers)

These 14 entities serve as the foundation for all procedural generation.

---

## 🔧 Extending the System

### Adding New Templates

```typescript
// src/templates/npc/myTemplate.ts
export const myTemplate: GrowthTemplate = {
  id: 'my_template',
  name: 'My Template',

  canApply: (graph: Graph) => {
    // Return true if template can run
    return graph.entities.size > 10;
  },

  findTargets: (graph: Graph) => {
    // Return possible targets
    return findEntities(graph, { kind: 'npc' });
  },

  expand: (graph: Graph, target?: HardState): TemplateResult => {
    // Create entities and relationships
    return {
      entities: [{ kind: 'npc', subtype: 'hero', ... }],
      relationships: [{ kind: 'follower_of', src: '...', dst: '...' }],
      description: 'A hero emerged!'
    };
  }
};
```

### Adding New Systems

```typescript
// src/systems/simulationSystems.ts
export const mySystem: SimulationSystem = {
  id: 'my_system',
  apply: (graph: Graph, modifier: GraphModifier): SystemResult => {
    // Find patterns and create relationships
    const heroes = findEntities(graph, { kind: 'npc', subtype: 'hero' });
    // ...
    return {
      relationshipsCreated: [...],
      description: 'Heroes formed alliances'
    };
  }
};
```

---

## 🎨 Technologies

- **TypeScript** - Type-safe development
- **Node.js** - Runtime environment
- **Anthropic Claude API** - LLM narrative generation (optional)
- **JSON** - Data interchange format

---

## 🐧 HONK HONK!

*May your colonies prosper and your krill be plentiful!*

---

## 📜 License

See individual project directories for licensing information.
