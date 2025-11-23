# 🐧 Penguin History - Procedural World Generation & Visualization

> *HONK! HONK!* A complete system for generating and visualizing rich, interconnected world histories for a thriving penguin civilization on Aurora Berg

Generate complex narrative-driven worlds through a hybrid approach of growth templates and simulation systems, then explore them through an interactive graph visualization.

---

## 🌊 Projects

This repository contains two sub-projects that work together:

### 🎮 [world-gen/](./world-gen/) - History Generation Engine

Procedural world generation system that creates knowledge graphs of ~150-200 entities with complex relationships and LLM-enriched narratives.

```bash
cd world-gen
npm install
npm run dev
```

**Output**: `world-gen/output/generated_world.json` (+ lore, logs, visualization data)

**Features:**
- 🏭 Template-based entity creation with cluster batching
- ⚙️ Simulation systems for emergent relationships
- 🎭 Optional LLM narrative enrichment (Claude API)
- 📊 Five historical eras with pressure dynamics
- 🔄 Evolutionary change tracking with supplemental lore

---

### 🕸️ [world-explorer/](./world-explorer/) - Interactive Visualization

React + Cytoscape.js application for exploring generated worlds through an interactive graph interface.

```bash
cd world-explorer
npm install
npm run dev
```

**Access**: http://localhost:5173/

**Features:**
- 🔍 Interactive graph exploration with pan/zoom
- 🎨 Color-coded entities by type and prominence
- 📋 Entity detail panels with full lore
- 🔗 Relationship visualization with labels
- 🎯 Focus mode for exploring entity connections

---

## 🚀 Quick Start

### Initial Setup
```bash
# Install dependencies for both projects
npm run install:all
```

### Generate & Visualize (All-in-One)
```bash
# Generate world and launch visualization
npm run dev
```

Then open http://localhost:5173/ to explore the generated world!

### Individual Commands
```bash
# Generate a world
npm run generate

# Sync generated world to visualization
npm run sync

# Generate and sync in one command
npm run generate:sync

# Launch visualization only
npm run viz
```

---

## 🐧 Key Concepts

- **📦 Entities**: NPCs, Locations, Factions, Rules, and Abilities
- **🏭 Templates**: Procedural generators that create batches of related entities
- **⚙️ Systems**: Simulation rules that create relationships and modify the world
- **📜 Eras**: Time periods that influence what happens (expansion, conflict, innovation, etc.)
- **🌊 Pressures**: Background forces that build up and trigger events
- **🎭 Lore**: LLM-enriched narratives tracking entity creation and evolution

---

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Detailed system design and implementation guide
- **[world-gen/SYSTEM_IMPLEMENTATION_GUIDE.md](./world-gen/SYSTEM_IMPLEMENTATION_GUIDE.md)** - Implementation patterns and best practices
- **[CLAUDE.md](./CLAUDE.md)** - Guide for Claude Code when working in this repository
- **[UI.md](./UI.md)** - Visualization strategies and implementation options
- **[LLM_INTEGRATION.md](./LLM_INTEGRATION.md)** - LLM-based narrative generation
- **[NEW_MECHANICS.md](./NEW_MECHANICS.md)** - Advanced mechanics and extensions

---

## 📁 Project Structure

```
penguin-history/
├── 🎮 world-gen/              # History generation engine
│   ├── src/
│   │   ├── engine/           # Main orchestration
│   │   ├── templates/        # Entity creation factories
│   │   ├── systems/          # Simulation rules
│   │   ├── services/         # LLM enrichment & validation
│   │   ├── config/           # Eras and pressures
│   │   └── types/            # TypeScript definitions
│   ├── data/
│   │   ├── initialState.json # 14 canonical seed entities
│   │   └── LORE_BIBLE.md     # Penguin world lore
│   └── output/               # Generated worlds
│
├── 🕸️ world-explorer/         # Interactive visualization
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── types/            # TypeScript definitions
│   │   ├── utils/            # Data transformation
│   │   └── data/             # World data (JSON)
│   └── public/
│
├── 📖 ARCHITECTURE.md         # Technical documentation
├── 📘 CLAUDE.md              # Development guide
└── 🎨 UI.md                  # Visualization guide
```

---

## 🔄 Workflow

1. **🌱 Generate**: Run `world-gen` to create a procedural history
   - Templates create entity clusters
   - Systems form relationships
   - LLM enriches with narratives (optional)

2. **🕸️ Explore**: Copy output to `world-explorer` and visualize
   - Interactive graph visualization
   - Entity detail panels
   - Relationship exploration

3. **🔧 Iterate**: Adjust templates/systems and regenerate
   - Modify era weights
   - Tune pressure dynamics
   - Add new mechanics

4. **🎭 Customize**: Modify eras, pressures, and initial state
   - Edit `data/initialState.json` for different starting conditions
   - Adjust `config/eras.ts` for different historical arcs

---

## 🐧 Example Output

A typical generation produces:

**📊 Scale:**
- **~150-200 entities** across 5 types
- **~300-500 relationships** forming a dense graph
- **10 epochs** spanning 5 historical eras (2 epochs per era)
- **~100-200 LLM calls** for narrative enrichment (if enabled)

**🎭 Entity Distribution:**
- **NPCs**: heroes, mayors, merchants, outlaws, scholars
- **Locations**: icebergs, colonies, anomalies, geographic features
- **Factions**: political, criminal, cults, merchant guilds
- **Rules**: edicts, taboos, social norms, festivals
- **Abilities**: ice magic, arctic engineering, combat techniques

**📜 Narrative Layers:**
- **Creation lore**: Initial entity descriptions with cluster context
- **Evolution lore**: Supplemental entries tracking significant changes
- **Era narratives**: Pivotal events between historical periods
- **Relationship backstories**: How connections formed
- **Discovery events**: Location exploration narratives

---

## 🛠️ Technologies

### Generation Engine
- **TypeScript** - Type-safe development
- **Node.js** - Runtime environment
- **Anthropic Claude API** - LLM narrative generation (optional)
- **JSON** - Data interchange format

### Visualization
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Cytoscape.js** - Graph visualization library
- **Vite** - Build tool and dev server
- **CSS Modules** - Component styling

---

## 🎯 Design Philosophy

### Hybrid Approach
The system combines **template-based generation** (fast, controlled) with **simulation-based dynamics** (emergent, organic) to achieve **80% of simulation depth with 20% of the complexity**.

### Narrative Coherence
- **Cluster batching**: Entities created together are enriched together
- **Relationship awareness**: Descriptions reference actual graph connections
- **Canon compliance**: All narratives validated against LORE_BIBLE.md
- **Evolution tracking**: Supplemental lore captures entity journeys over time

### Performance
- **Snapshot-based enrichment**: Avoids race conditions
- **Dynamic token allocation**: Scales with cluster size
- **Concurrent LLM calls**: Batched requests execute in parallel
- **Progress monitoring**: Live updates show enrichment progress

---

## 🐧 HONK HONK HONK!

*May your colonies prosper, your krill be plentiful, and your ice coins never melt!*

**The penguins of Aurora Berg await your worldbuilding prowess!** 🎉

---

## 📜 License

See individual project directories for licensing information.
