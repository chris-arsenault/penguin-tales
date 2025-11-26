# World-Gen Optimizer

Genetic algorithm optimizer for world generation parameters.

## Overview

This tool uses a genetic algorithm to optimize the parameters in `world-gen/config/templateSystemParameters.json` to produce better world generation results. It works by:

1. **Extracting parameters** from the config as a "genome"
2. **Running world-gen** with different parameter configurations
3. **Evaluating fitness** using statistics from `stats.json`
4. **Evolving** the population through selection, crossover, and mutation
5. **Tracking** the best configurations across all generations

## Installation

```bash
cd world-gen-optimizer
npm install
```

## Usage

Run the optimizer:

```bash
npm run dev
```

Or after building:

```bash
npm run build
npm start
```

## Configuration

The genetic algorithm is configured in `src/index.ts`:

- **Population size**: 30 individuals per generation
- **Max generations**: 100
- **Elitism**: Top 3 individuals preserved each generation
- **Mutation rate**: 10%
- **Tournament size**: 5 (for selection)
- **Parallel executions**: CPU cores (max 8)

## Fitness Function

The fitness function uses a weighted combination of metrics (configurable in `src/fitnessEvaluator.ts`):

- **Entity distribution** (15%): How balanced entity kinds are
- **Prominence distribution** (15%): How balanced prominence levels are
- **Relationship diversity** (20%): How diverse relationship types are
- **Connectivity** (15%): How well-connected the graph is
- **Overall fitness** (35%): Overall fitness from world-gen

## Output

All results are saved to `./output/`:

- **evolution_history.json**: Fitness progression across generations
- **top_configs/rank_N.json**: Top 5 configurations (N=1-5)
- **final_best.json**: Best configuration found

Each saved configuration includes:
- Fitness score and breakdown
- Generation discovered
- Complete parameter configuration ready to use

## How It Works

### 1. Parameter Extraction

The optimizer scans `templateSystemParameters.json` and extracts all numeric parameters. For each parameter, it infers:
- Type (integer or float)
- Reasonable min/max bounds based on naming patterns
- Default value

### 2. Initial Population

The optimizer creates 30 individuals by randomly mutating the base configuration parameters within their bounds.

### 3. Evaluation

For each individual:
1. Generate a config file in `world-gen/config/runs/gen{N}_ind{M}/templateSystemParameters.json`
2. Run `npm start -- --run-id gen{N}_ind{M}` in world-gen directory
3. World-gen outputs to `world-gen/output/runs/gen{N}_ind{M}/`
4. World-gen logs the run to `output/runs/manifest.jsonl`
5. Parse the resulting `stats.json`
6. Calculate weighted fitness score
7. Cleanup run directories (config and output)

Evaluations run in parallel (up to CPU count) for speed.

### 4. Evolution

Each generation:
1. **Selection**: Tournament selection picks parents
2. **Crossover**: Uniform crossover combines parent genes
3. **Mutation**: Gaussian mutation adjusts parameters
4. **Elitism**: Top 3 individuals pass unchanged

### 5. Tracking

The tracker maintains:
- Complete evolution history
- Top 5 configurations ever found (across all generations)
- Progress statistics

## Directory Structure

During optimization, the following directories are used:

```
world-gen/
├── config/
│   ├── templateSystemParameters.json          # Default config
│   └── runs/
│       ├── gen0_ind0/
│       │   └── templateSystemParameters.json  # GA-generated params
│       ├── gen0_ind1/
│       │   └── templateSystemParameters.json
│       └── ...
└── output/
    ├── generated_world.json                   # Manual runs (no --run-id)
    ├── stats.json
    └── runs/
        ├── manifest.jsonl                     # All GA runs tracked by world-gen
        ├── gen0_ind0/
        │   ├── generated_world.json
        │   ├── stats.json
        │   ├── graph_viz.json
        │   └── lore.json
        ├── gen0_ind1/
        │   └── ...
        └── ...
```

**Run ID Format**: `gen{generation}_ind{individual}` (e.g., `gen5_ind23`)

Run directories are automatically cleaned up after fitness evaluation to save disk space.

## Parameter Constraints

All parameters are automatically clamped to valid ranges:

- **Probabilities**: 0.0 - 1.0
- **Multipliers**: 0.0 - 5.0
- **Counts**: 1 - 20
- **Cooldowns**: 1 - 200
- **Model parameters** (alpha, beta, temperature, etc.): Appropriate ranges

Integers are automatically rounded.

## Example Output

```
Generation 10/100
Best fitness: 0.8234
Average fitness: 0.7821
Diversity: 0.1234

Fitness breakdown:
  Entity distribution: 0.8912
  Prominence distribution: 0.9012
  Relationship diversity: 0.7234
  Connectivity: 0.7123
  Overall: 0.8123
```

## Tips

- **Start small**: Test with fewer generations first
- **Monitor diversity**: Low diversity means convergence (good or bad)
- **Check top configs**: Sometimes earlier generations find good configs
- **Adjust weights**: Edit `src/fitnessEvaluator.ts` to prioritize different metrics

## Architecture

```
world-gen-optimizer/
├── src/
│   ├── index.ts                 # Main CLI entry point
│   ├── types.ts                 # Type definitions
│   ├── configLoader.ts          # Parameter extraction and config management
│   ├── fitnessEvaluator.ts      # Fitness calculation from stats.json
│   ├── geneticAlgorithm.ts      # GA core (selection, crossover, mutation)
│   ├── worldGenRunner.ts        # World-gen execution with parallelization
│   └── tracker.ts               # Evolution tracking and output
└── output/
    ├── evolution_history.json
    ├── top_configs/
    └── final_best.json
```

## Customization

### Change Fitness Weights

Edit `src/fitnessEvaluator.ts`:

```typescript
const DEFAULT_WEIGHTS: FitnessWeights = {
  entityDistribution: 0.15,
  prominenceDistribution: 0.15,
  relationshipDiversity: 0.2,
  connectivity: 0.15,
  overall: 0.35
};
```

### Change GA Parameters

Edit `src/index.ts`:

```typescript
const gaConfig: GAConfig = {
  populationSize: 30,      // More = better exploration
  maxGenerations: 100,     // More = more time
  elitismCount: 3,         // Preserve top N
  mutationRate: 0.1,       // Higher = more exploration
  tournamentSize: 5,       // Selection pressure
  parallelExecutions: 8    // Concurrent evaluations
};
```

## Requirements

- Node.js 20+
- TypeScript 5+
- Working `world-gen` installation

## License

Same as parent project
