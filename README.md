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

## 🗺️ Coordinate Placement System

Entities exist in a **6-axis coordinate space** that supports both physical locations and abstract concepts. The framework provides mathematically sound placement algorithms for procedural entity distribution.

### Coordinate Axes

| Axis | Physical Meaning | Example Values |
|------|-----------------|----------------|
| `plane` | Which "map" layer | `surface`, `underwater`, `ice_caverns` |
| `sector_x` | Coarse longitude (0-100) | `60` (eastern region) |
| `sector_y` | Coarse latitude (0-100) | `40` (southern region) |
| `cell_x` | Fine position within sector (0-10) | `5.2` |
| `cell_y` | Fine position within sector (0-10) | `7.8` |
| `z_band` | Vertical layer | `sky`, `surface`, `shallow_water`, `deep_water` |

### Placement Algorithms

| Algorithm | Use Case | Properties |
|-----------|----------|------------|
| `poisson_disk` | Location distribution | Blue noise, guaranteed minimum spacing |
| `gaussian_cluster` | NPCs around settlements | Natural density falloff |
| `anchor_colocated` | Abilities at locations | Perfect co-location |
| `halton_sequence` | Deterministic coverage | Reproducible quasi-random |
| `exclusion_aware` | Avoiding sacred zones | Respects forbidden regions |

### Example: Placing Non-Spatial Entities

Rules and magic systems don't have traditional "locations" but still exist in coordinate space for spatial queries (e.g., "find all magic near the Glow-Fissure"):

```typescript
// Place a magic system co-located with its origin anomaly
const magicId = graphView.addEntityWithPlacement(
  {
    kind: 'abilities',
    subtype: 'magic',
    name: 'Fissure-Drawn Runes',
    description: 'Ice-magic drawn from the Glow-Fissure'
  },
  {
    scheme: {
      kind: 'anchor_colocated',
      spaceId: 'physical',
      allowCoLocation: true,
      anchorEntityId: 'glow_fissure_id'  // Copies anomaly's coordinates
    }
  }
);

// Place a cultural rule with wide geographic influence
const ruleId = graphView.addEntityWithPlacement(
  {
    kind: 'rules',
    subtype: 'taboo',
    name: 'The Silence of the Deep',
    description: 'Ancient taboo against speaking in ice caverns'
  },
  {
    scheme: {
      kind: 'gaussian_cluster',
      spaceId: 'physical',
      allowCoLocation: true,
      center: nightfallShelfCoords,
      sigma: 0.3  // Wide spread - rule applies broadly
    }
  }
);
```

### Example: Cluster of Locations (Full 6-Axis Output)

Using Poisson disk sampling to place 5 colonies with natural spacing:

```typescript
const result = graphView.addEntitiesWithPlacement(
  [
    { kind: 'location', subtype: 'colony', name: 'Frostpeak Hold' },
    { kind: 'location', subtype: 'colony', name: 'Shimmer Bay' },
    { kind: 'location', subtype: 'colony', name: 'Glacier Point' },
    { kind: 'location', subtype: 'colony', name: 'Icewind Perch' },
    { kind: 'location', subtype: 'colony', name: 'Deepchill Warren' }
  ],
  {
    scheme: {
      kind: 'poisson_disk',
      spaceId: 'physical',
      allowCoLocation: false,
      minDistance: 0.15,  // 15% of map minimum separation
      constrainPlane: 'surface'
    }
  }
);

// Result coordinates (all 6 axes):
// ┌─────────────────┬─────────┬──────────┬──────────┬────────┬────────┬─────────┐
// │ Entity          │ plane   │ sector_x │ sector_y │ cell_x │ cell_y │ z_band  │
// ├─────────────────┼─────────┼──────────┼──────────┼────────┼────────┼─────────┤
// │ Frostpeak Hold  │ surface │    23.4  │    67.2  │   4.1  │   8.3  │ surface │
// │ Shimmer Bay     │ surface │    71.8  │    45.6  │   7.2  │   2.9  │ surface │
// │ Glacier Point   │ surface │    48.2  │    12.9  │   1.8  │   5.4  │ surface │
// │ Icewind Perch   │ surface │    89.1  │    78.4  │   9.0  │   6.1  │ surface │
// │ Deepchill Warren│ surface │    15.7  │    31.5  │   3.3  │   0.7  │ surface │
// └─────────────────┴─────────┴──────────┴──────────┴────────┴────────┴─────────┘
//
// Note: Poisson disk guarantees minimum 15% separation between any two colonies.
// Batch placement uses incremental exclusion - each new placement respects prior ones.
```

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
