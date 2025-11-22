# World History Explorer

Interactive visualization tool for exploring procedurally generated world histories using React, Cytoscape.js, and Vite.

## Features

- **Interactive Graph Visualization** - Cytoscape.js-powered network graph with physics-based layout
- **Advanced Filtering** - Filter by entity type, prominence, time range, tags, and search
- **Entity Details** - Detailed information panel for selected entities
- **Relationship Explorer** - Navigate through entity connections
- **Responsive UI** - Dark theme with Tailwind CSS

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The application will be available at `http://localhost:5173/`

## Project Structure

```
world-explorer/
├── src/
│   ├── components/
│   │   ├── WorldExplorer.tsx    # Main dashboard component
│   │   ├── GraphView.tsx        # Cytoscape graph visualization
│   │   ├── FilterPanel.tsx      # Filter controls
│   │   └── EntityDetail.tsx     # Entity information panel
│   ├── types/
│   │   └── world.ts             # TypeScript type definitions
│   ├── utils/
│   │   └── dataTransform.ts     # Data transformation utilities
│   ├── data/
│   │   └── worldData.json       # Generated world data
│   ├── App.tsx                  # Application entry point
│   └── main.tsx                 # React DOM mount point
├── tailwind.config.js
├── postcss.config.js
└── vite.config.ts
```

## Components

### WorldExplorer
Main dashboard that coordinates all other components. Manages state for filters and selected entities.

### GraphView
Cytoscape.js visualization with:
- Color-coded nodes by entity type (NPCs, Factions, Locations, Rules, Abilities)
- Node size based on prominence
- Interactive selection and navigation
- Zoom and pan controls

### FilterPanel
Sidebar with filtering options:
- Entity type checkboxes
- Prominence level selector
- Time range sliders
- Tag selection
- Search functionality

### EntityDetail
Right sidebar showing:
- Entity metadata
- Description and status
- Tags
- Outgoing and incoming relationships
- Click to navigate between connected entities

## Data Format

The application expects world data in the following format:

```json
{
  "metadata": {
    "tick": 100,
    "epoch": 10,
    "entityCount": 124,
    "relationshipCount": 700
  },
  "hardState": [
    {
      "id": "entity_id",
      "kind": "npc",
      "subtype": "hero",
      "name": "Entity Name",
      "description": "Description text",
      "status": "alive",
      "prominence": "renowned",
      "tags": ["tag1", "tag2"],
      "links": [],
      "createdAt": 0,
      "updatedAt": 50
    }
  ],
  "relationships": [
    {
      "kind": "follower_of",
      "src": "entity_id_1",
      "dst": "entity_id_2"
    }
  ],
  "pressures": {},
  "history": []
}
```

## Updating World Data

To visualize a different generated world:

1. Generate new world data using the history engine:
   ```bash
   cd ../world-gen
   npm run dev
   ```

2. Copy the output to the explorer:
   ```bash
   cd ../world-explorer
   cp ../world-gen/output/generated_world.json src/data/worldData.json
   ```

3. Refresh the browser or restart the dev server

## Controls

- **Click** on a node to view details
- **Scroll** to zoom in/out
- **Drag** the canvas to pan
- **Click** on relationships in the detail panel to navigate between entities

## Customization

### Colors
Entity colors are defined in `src/utils/dataTransform.ts`:
```typescript
const colors = {
  npc: '#6FB1FC',
  faction: '#FC6B6B',
  location: '#6BFC9C',
  rules: '#FCA86B',
  abilities: '#C76BFC'
};
```

### Layout
Cytoscape layout options in `src/components/GraphView.tsx`:
```typescript
layout: {
  name: 'cose-bilkent',
  idealEdgeLength: 100,
  nodeRepulsion: 100000,
  gravity: 0.25
}
```

## Technologies Used

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Cytoscape.js** - Graph visualization
- **Cytoscape-cose-bilkent** - Layout algorithm
- **Tailwind CSS** - Styling
- **Fuse.js** - Fuzzy search (ready to integrate)

## Performance Notes

- Handles graphs up to ~1000 nodes smoothly
- Layout calculation runs on main thread (can be moved to Web Worker for larger graphs)
- Filtering is done client-side for instant results
- Graph re-renders when filters change

## Future Enhancements

- Timeline view for history events
- Graph mode switching (radial, temporal, faction-focused)
- Export functionality (PNG, SVG, filtered subgraphs)
- Community detection visualization
- Narrative extraction from patterns
- Search with fuzzy matching
- Level-of-detail rendering for large graphs
