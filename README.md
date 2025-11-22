# Penguin History Engine

A procedural world history generator that creates rich, interconnected knowledge graphs through a hybrid approach of growth templates and simulation systems.

## Overview

This engine generates a lived-in world history by:
1. Starting with a minimal seed state (14 entities)
2. Running alternating phases of:
   - **Growth Phase**: Rapidly populate the graph using templates
   - **Simulation Phase**: Let entities interact and form relationships
3. Progressing through different **Eras** that modify template weights and system behaviors
4. Ending with a rich knowledge graph of ~150+ entities with complex relationships

## Key Concepts

- **Entities**: NPCs, Locations, Factions, Rules, and Abilities
- **Templates**: Procedural generators that create batches of related entities
- **Systems**: Simulation rules that create relationships and modify the world
- **Eras**: Time periods that influence what happens (expansion, conflict, innovation, etc.)
- **Pressures**: Background forces that build up and trigger events

## Setup

```bash
# Install dependencies
npm install

# Create data directory and add initial state
mkdir data
cp /path/to/initialState.json data/
```

## Running

```bash
# Development (with TypeScript)
npm run dev

# Or build and run
npm run build
npm start
```

## Output

The engine generates:
- `output/generated_world.json` - Complete world state with all entities and relationships
- `output/graph_viz.json` - Visualization-ready graph format

## Architecture

```
src/
├── engine/           # Main orchestration
│   └── worldEngine.ts
├── templates/        # Entity creation templates
│   ├── npc/
│   ├── faction/
│   └── additionalTemplates.ts
├── systems/          # Simulation systems
│   └── simulationSystems.ts
├── config/           # Eras and pressures
│   ├── eras.ts
│   └── pressures.ts
├── types/            # TypeScript definitions
└── utils/            # Helper functions
```

## Customization

### Adding New Templates
Create new templates in `src/templates/` that implement the `GrowthTemplate` interface.

### Adding New Systems
Create new systems in `src/systems/` that implement the `SimulationSystem` interface.

### Modifying Eras
Edit `src/config/eras.ts` to change the progression of history.

### Tuning Parameters
Adjust parameters in `src/main.ts`:
- `epochLength`: How long each era lasts
- `simulationTicksPerGrowth`: Balance between growth and simulation
- `targetEntitiesPerKind`: Final world size
- `maxTicks`: Maximum simulation length

## Schema Coverage

The engine generates all entity types and relationship types defined in the world schema:
- **NPCs**: merchants, mayors, heroes, outlaws
- **Locations**: icebergs, colonies, igloos, geographic features, anomalies
- **Factions**: political, criminal, cult, company
- **Rules**: edicts, taboos, social, natural
- **Abilities**: magic, faith, technology, physical

## Example Output Stats

A typical run generates:
- ~150-200 entities
- ~300-500 relationships
- 5 distinct eras of history
- Rich interconnected narrative elements
