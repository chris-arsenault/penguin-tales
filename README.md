# Lore Weave - Procedural World Generation Framework

A complete framework for generating and visualizing rich, interconnected world histories through procedural templates, simulation systems, and interactive graph exploration.

Generate complex narrative-driven worlds through a hybrid approach of growth templates and simulation systems, configured entirely in JSON.

---

## Projects

This monorepo contains the following applications:

### [apps/lore-weave/](./apps/lore-weave/) - World Generation Framework

Core procedural generation engine that creates knowledge graphs of entities with complex relationships. Domains are defined entirely in JSON configuration files.

**Features:**
- Template-based entity creation with cluster batching
- Simulation systems for emergent relationships
- Declarative JSON configuration for domains
- Historical eras with pressure dynamics
- Culture-aware entity placement and naming

### [apps/name-forge/](./apps/name-forge/) - Procedural Name Generation

Domain-aware name generation system with phonological rules, grammars, and Markov chains.
The current naming system shows significant structural homogeneity across cultures that undermines cultural distinctiveness. While lexeme differentiation exists, the grammatical patterns are nearly identical, creating what linguists call "lexical substitution without morphosyntactic variation" - the hallmark of artificially generated names.

### [apps/canonry/](./apps/canonry/) - Shell Application

Module Federation shell that hosts all web UIs as micro-frontends.

### [apps/cosmographer/](./apps/cosmographer/) - World Building Tool

Visual editor for creating world seeds and semantic plane configurations.

### [apps/coherence-engine/](./apps/coherence-engine/) - Narrative Coherence

Ensures narrative consistency across generated content.

### [apps/archivist/](./apps/archivist/) - History Browser

Interface for exploring generated world histories.

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Installation
```bash
# Install all dependencies
npm run install:all

# Or install canonry stack specifically
npm run install:canonry
```

### Run the Web UI
```bash
# Start all micro-frontends with dev proxy
npm run canonry
```

Then open http://localhost:5176/ to access the shell.

### Individual Commands
```bash
# Build framework library
npm run build:framework

# Run framework tests
npm run test:framework

# Build world-schema package
npm run build:world-schema
```

---

## Key Concepts

- **Entities**: NPCs, Locations, Factions, Rules, Abilities, and more
- **Templates**: JSON-defined generators that create batches of related entities
- **Systems**: Simulation rules that create relationships and modify entities
- **Eras**: Time periods with different template weights and pressures
- **Pressures**: Background forces that build up and trigger events
- **Cultures**: Groups with distinct naming conventions and placement biases

---

## Architecture

```
penguin-tales/                    # Repository root
├── apps/
│   ├── lore-weave/              # World generation framework
│   │   ├── lib/                 # Core library
│   │   └── webui/               # World explorer UI
│   │
│   ├── name-forge/              # Name generation framework
│   │   ├── lib/                 # Core library
│   │   └── webui/               # Name generation UI
│   │
│   ├── canonry/                 # Shell application
│   │   └── webui/               # Module federation shell
│   │
│   ├── cosmographer/            # World building tool
│   │   └── webui/               # Semantic plane editor
│   │
│   ├── coherence-engine/        # Narrative coherence
│   │   └── webui/               # Coherence checker UI
│   │
│   └── archivist/               # History browser
│       └── webui/               # Archive explorer UI
│
├── packages/
│   ├── world-schema/            # Shared schema types
│   └── shared-components/       # Shared UI components
│
└── infrastructure/              # Deployment configuration
    └── terraform/               # AWS infrastructure
```

---

## Domain Configuration

Worlds are defined through JSON configuration files:

- **schema.json** - Entity kinds, relationship types, cultures
- **templates.json** - Entity generation templates
- **systems.json** - Simulation system configurations
- **eras.json** - Historical era definitions
- **pressures.json** - Dynamic pressure configurations
- **actions.json** - Agent action definitions

See the [Lore Weave documentation](./apps/lore-weave/README.md) for detailed configuration guides.

---

## Coordinate Placement System

Entities exist in a **region-based coordinate space** that supports both physical locations and abstract concepts. The framework provides culture-aware placement algorithms.

See [COORDINATE_GRIDS.md](./COORDINATE_GRIDS.md) for detailed documentation.

---

## Documentation

- **[apps/lore-weave/README.md](./apps/lore-weave/README.md)** - Framework documentation
- **[apps/name-forge/README.md](./apps/name-forge/README.md)** - Name generation guide
- **[COORDINATE_GRIDS.md](./COORDINATE_GRIDS.md)** - Coordinate system reference
- **[CLAUDE.md](./CLAUDE.md)** - Guide for Claude Code

---

## Technologies

- **TypeScript** - Type-safe development
- **Node.js** - Runtime environment
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Module Federation** - Micro-frontend architecture
- **Cytoscape.js** - Graph visualization

---

## License

[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) - Free for non-commercial use.
