# 🕸️ Penguin History Explorer - Interactive Visualization

> *HONK!* Explore the rich tapestry of penguin civilization through an interactive knowledge graph

A React-based visualization tool for exploring procedurally generated world histories. Navigate through ~150-200 interconnected entities, discover LLM-enriched narratives, and trace the evolution of penguin societies across five historical eras.

---

## 🎯 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Sync latest generated world
npm run sync

# Build for production
npm run build
```

**Access**: http://localhost:5173/

---

## 🐧 Features

### 🔍 Interactive Graph Exploration
- **Network Visualization** - Cytoscape.js-powered graph with physics-based layout
- **Color-Coded Entities** - Visual distinction by type and prominence
- **Pan & Zoom Controls** - Navigate graphs of 150-200 entities smoothly
- **Focus Mode** - Explore entity connections interactively

### 📖 Rich Narrative Integration
- **LLM-Generated Lore** - View cluster-enriched entity descriptions
- **Relationship Backstories** - Discover how connections formed
- **Era Narratives** - Read pivotal events between historical periods
- **Discovery Events** - Explore location finding stories
- **Evolution Tracking** - See supplemental lore for entity changes over time
- **Chain Discovery** - Follow geographic exploration sequences

### 🎛️ Advanced Filtering
- **Entity Type** - Filter by NPCs, Factions, Locations, Rules, Abilities
- **Prominence Level** - Focus on forgotten, marginal, recognized, renowned, or mythic entities
- **Time Range** - View entities from specific epochs or eras
- **Tag Search** - Find entities by tags and keywords
- **Fuzzy Search** - Quick entity lookup with Fuse.js

### 📋 Entity Details
- **Complete Metadata** - Kind, subtype, status, prominence, creation time
- **Full Descriptions** - LLM-enriched narrative context
- **Relationship Explorer** - Navigate incoming and outgoing connections
- **Timeline Integration** - See when entities emerged and evolved
- **Multiple Lore Entries** - Creation lore + evolutionary changes

---

## 🏗️ Project Structure

```
world-explorer/
├── src/
│   ├── components/
│   │   ├── WorldExplorer.tsx           # Main dashboard orchestrator
│   │   ├── GraphView.tsx               # Cytoscape graph visualization
│   │   ├── FilterPanel.tsx             # Advanced filtering controls
│   │   ├── EntityDetail.tsx            # Entity information panel
│   │   ├── LoreSection.tsx             # LLM-generated narratives
│   │   ├── EraNarrative.tsx            # Historical era transitions
│   │   ├── DiscoveryStory.tsx          # Location discovery events
│   │   ├── ChainLinkSection.tsx        # Geographic exploration chains
│   │   ├── RelationshipStoryModal.tsx  # Relationship backstories
│   │   └── TimelineControl.tsx         # Temporal navigation
│   ├── types/
│   │   └── world.ts                    # TypeScript definitions
│   ├── utils/
│   │   └── dataTransform.ts            # Graph data transformation
│   ├── data/
│   │   └── worldData.json              # Generated world state
│   ├── App.tsx                         # Application entry
│   └── main.tsx                        # React mount point
├── public/
│   ├── generated_world.json            # Synced world data
│   └── lore.json                       # LLM enrichment records
└── vite.config.ts
```

---

## 📊 Data Format

The application expects world data from the generation engine:

### World State (`generated_world.json`)

```json
{
  "metadata": {
    "tick": 135,
    "epoch": 9,
    "entityCount": 187,
    "relationshipCount": 453,
    "currentEra": "The Frozen Peace"
  },
  "hardState": [
    {
      "id": "npc_001",
      "kind": "npc",
      "subtype": "hero",
      "name": "Frostbeak the Valiant",
      "description": "A renowned hero of Sunbreak Outpost...",
      "status": "alive",
      "prominence": "renowned",
      "tags": ["warrior", "ice_magic", "faction_wars_veteran"],
      "links": [...],
      "createdAt": 23,
      "updatedAt": 89
    }
  ],
  "relationships": [
    {
      "kind": "member_of",
      "src": "npc_001",
      "dst": "faction_005"
    }
  ],
  "pressures": {
    "resource_scarcity": 45,
    "conflict": 12,
    "stability": 78
  },
  "history": [...]
}
```

### Lore Records (`lore.json`)

```json
[
  {
    "id": "lore_001",
    "type": "description",
    "targetId": "npc_001",
    "text": "Frostbeak emerged during the Faction Wars...",
    "metadata": { "tick": 23, "era": "The Faction Wars" }
  },
  {
    "id": "lore_045",
    "type": "entity_change",
    "targetId": "npc_001",
    "text": "After the Orca Incursion, Frostbeak's prominence rose...",
    "metadata": { "changes": ["prominence: recognized → renowned"] }
  },
  {
    "id": "lore_089",
    "type": "relationship_backstory",
    "relationship": { "kind": "ally_of", "src": "npc_001", "dst": "npc_012" },
    "text": "Frostbeak and Tidecaller formed an alliance during..."
  }
]
```

**Lore Types**:
- `name` / `description` - Entity creation narratives
- `entity_change` - Evolution and transformation stories
- `era_narrative` - Historical transitions between eras
- `relationship_backstory` - How connections formed
- `discovery_event` - Location exploration stories
- `chain_link` - Geographic discovery sequences
- `tech_magic` - Ability flavor text

---

## 🔄 Workflow

### 1. Generate a World

```bash
cd ../world-gen
npm run dev  # or npm run build && npm start
```

This creates:
- `output/generated_world.json` - Complete world state
- `output/lore.json` - LLM enrichment records
- `output/graph_viz.json` - Visualization format

### 2. Sync to Explorer

```bash
cd ../world-explorer
npm run sync
```

Copies generated files to `public/` directory.

### 3. Launch Visualization

```bash
npm run dev
```

Open http://localhost:5173/ and explore!

### 4. Iterate

Modify generation parameters in `world-gen/src/main.ts`, regenerate, and sync again.

---

## 🎮 Controls

### Graph Navigation
- **Click** a node to view entity details
- **Scroll** to zoom in/out
- **Drag** the canvas to pan around
- **Click** relationship names in detail panel to navigate between entities

### Filtering
- **Toggle entity types** to show/hide NPCs, Factions, Locations, etc.
- **Adjust prominence** slider to focus on notable entities
- **Set time range** to view entities from specific epochs
- **Search by name or tags** for quick lookup

### Lore Exploration
- **Entity Details** show creation lore and evolution entries
- **Relationship Backstories** reveal connection formation stories
- **Era Narratives** display historical transition events
- **Discovery Events** tell location exploration tales

---

## 🎨 Customization

### Entity Colors

Edit `src/utils/dataTransform.ts`:

```typescript
const colors = {
  npc: '#6FB1FC',       // NPCs: Blue
  faction: '#FC6B6B',   // Factions: Red
  location: '#6BFC9C',  // Locations: Green
  rules: '#FCA86B',     // Rules: Orange
  abilities: '#C76BFC'  // Abilities: Purple
};
```

### Graph Layout

Modify Cytoscape options in `src/components/GraphView.tsx`:

```typescript
layout: {
  name: 'cose-bilkent',
  idealEdgeLength: 100,
  nodeRepulsion: 100000,
  gravity: 0.25,
  numIter: 2500
}
```

### Node Sizing

Prominence levels affect node size:

```typescript
const sizeMap = {
  forgotten: 20,
  marginal: 30,
  recognized: 40,
  renowned: 55,
  mythic: 70
};
```

---

## 🛠️ Technologies

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Cytoscape.js** - Graph visualization library
- **Cytoscape-cose-bilkent** - Physics-based layout algorithm
- **Fuse.js** - Fuzzy search functionality
- **CSS** - Component styling

---

## 📖 Documentation

- **[../ARCHITECTURE.md](../ARCHITECTURE.md)** - Complete system design
- **[../world-gen/README.md](../world-gen/README.md)** - Generation engine documentation
- **[../CLAUDE.md](../CLAUDE.md)** - Development guide for Claude Code
- **[../LLM_INTEGRATION.md](../LLM_INTEGRATION.md)** - LLM enrichment system details
- **[../UI.md](../UI.md)** - Visualization strategies and implementation

---

## ⚡ Performance

### Current Capabilities
- Handles graphs of **~200 entities** and **~500 relationships** smoothly
- Layout calculation runs on main thread in ~1-2 seconds
- Filtering is **instant** (client-side processing)
- Graph re-renders when filters change (minimal overhead)

### For Larger Graphs (500+ entities)
- Consider moving layout calculation to **Web Worker**
- Implement **level-of-detail rendering** (hide edges at certain zoom levels)
- Add **progressive loading** for entity details
- Use **virtualized lists** for filter panels

---

## 🎯 Future Enhancements

### Timeline Features
- ⏱️ Temporal graph animation (watch world evolve over epochs)
- 📜 History event timeline with narrative integration
- 🕰️ Era transition visualization

### Graph Modes
- 🎯 Radial layout (entity-centric view)
- 📊 Faction hierarchy trees
- 🗺️ Geographic layout (locations as spatial nodes)
- 🧬 Community detection visualization

### Export & Sharing
- 🖼️ Export PNG/SVG snapshots
- 📤 Export filtered subgraphs as JSON
- 🔗 Shareable URLs with filter state
- 📝 Narrative extraction from patterns

### Advanced Analysis
- 📈 Prominence evolution tracking
- 🔍 Relationship pattern mining
- 🎭 Story arc detection
- 🌊 Pressure influence visualization

---

## 🐧 HONK HONK!

*May your explorations be fruitful and your krill be plentiful!*

**The interconnected history of Aurora Berg awaits your discovery!** 🎉

---

## 📜 License

See individual project directories for licensing information.
