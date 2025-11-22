# Penguin History Engine - World Generator

Procedural world history generation system using a hybrid template + simulation approach.

## Quick Start

```bash
# Install dependencies
npm install

# Generate a world
npm run dev

# Build TypeScript
npm run build

# Run compiled version
npm start

# Clean output
npm run clean
```

## Output

Generated worlds are saved to `output/`:
- `generated_world.json` - Complete world state with all entities and relationships
- `graph_viz.json` - Visualization-ready graph format

## Configuration

Edit `src/main.ts` to adjust generation parameters:
- `epochLength`: Ticks per epoch (default: 20)
- `simulationTicksPerGrowth`: Balance between growth and simulation (default: 10)
- `targetEntitiesPerKind`: Target final size (default: 30, ~150 total)
- `maxTicks`: Maximum simulation ticks (default: 500)

## Architecture

See `../ARCHITECTURE.md` for detailed system design documentation.

### Project Structure

```
world-gen/
├── src/
│   ├── engine/          # Main orchestration
│   ├── templates/       # Entity creation templates
│   ├── systems/         # Simulation systems
│   ├── config/          # Eras and pressures
│   ├── types/           # TypeScript definitions
│   └── utils/           # Helper functions
├── data/                # Initial state
├── output/              # Generated worlds
└── worldSchema.json     # Entity/relationship schema
```

## Initial State

The seed world is defined in `data/initialState.json` and contains 14 pre-configured entities forming the starting point for generation.

## Extending

- Add templates in `src/templates/` to create new entity types
- Add systems in `src/systems/` to introduce new dynamics
- Modify eras in `src/config/eras.ts` to change historical progression
- Adjust pressures in `src/config/pressures.ts` to modify world forces
