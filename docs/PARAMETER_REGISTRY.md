# Parameter Registry for Genetic Algorithm Tuning

This document catalogs all tunable parameters across templates and systems for GA optimization.

## Overview

Parameters are defined in `metadata.parameters` sections of templates and systems. The GA system can override these using `parameterOverrides.ts` utilities.

## System Parameters

### Framework Systems

#### universal_catalyst
Location: `src/systems/universalCatalyst.ts`

- **actionAttemptRate**: Base chance per tick that agents attempt actions
  - Default: 0.3, Range: [0.1, 0.8]
- **influenceGain**: Influence gain on successful action
  - Default: 0.1, Range: [0.05, 0.3]
- **influenceLoss**: Influence loss on failed action
  - Default: 0.05, Range: [0.01, 0.15]
- **pressureMultiplier**: How much pressures amplify action attempt rates
  - Default: 1.5, Range: [1.0, 3.0]

#### occurrence_creation
Location: `src/systems/occurrenceCreation.ts`

- **warThreshold**: Minimum at_war_with relationships to trigger war occurrence
  - Default: 2, Range: [1, 5]
- **disasterThreshold**: Minimum corruption events in one tick to trigger disaster
  - Default: 2, Range: [1, 4]
- **movementThreshold**: Minimum believer_of relationships to trigger cultural movement
  - Default: 3, Range: [2, 8]
- **boomThreshold**: Minimum trades_with relationships to trigger economic boom
  - Default: 4, Range: [2, 10]

#### era_transition
Location: `src/systems/eraTransition.ts`

Era transition timing is controlled per-era via `transitionConditions` in eras.json.
Use a `time` condition to control minimum era length:
```json
{ "type": "time", "minTicks": 25 }
```

No system-level parameters - all transition logic is per-era.

### Domain Systems

#### conflict_contagion
Location: `src/domain/penguin/systems/conflictContagion.ts`

- **throttleChance**: Probability system runs each tick (prevents conflict spam)
  - Default: 0.2, Range: [0.05, 0.5]
- **spreadChance**: Probability conflict spreads to an ally
  - Default: 0.15, Range: [0.05, 0.5]
- **cooldown**: Ticks before same NPC can form another enemy relationship
  - Default: 8, Range: [3, 20]

#### prominence_evolution
Location: `src/domain/penguin/systems/prominenceEvolution.ts`

- **npcGainChance**: Probability NPC gains prominence when connection threshold met
  - Default: 0.3, Range: [0.1, 0.7]
- **npcDecayChance**: Probability NPC loses prominence when under-connected
  - Default: 0.7, Range: [0.3, 0.95]
- **locationGainChance**: Probability location gains prominence
  - Default: 0.4, Range: [0.1, 0.8]
- **locationDecayChance**: Probability location loses prominence
  - Default: 0.5, Range: [0.2, 0.9]
- **factionGainChance**: Probability faction gains prominence
  - Default: 0.35, Range: [0.1, 0.8]
- **factionDecayChance**: Probability faction loses prominence
  - Default: 0.6, Range: [0.3, 0.95]
- **connectionThreshold**: Minimum connections for prominence gain
  - Default: 5, Range: [2, 15]
- **isolationThreshold**: Maximum connections before prominence decay
  - Default: 2, Range: [1, 5]

#### succession_vacuum
Location: `src/domain/penguin/systems/successionVacuum.ts`

- **throttleChance**: Probability system runs each tick
  - Default: 0.2, Range: [0.05, 0.5]
- **rivalryCooldown**: Ticks before same NPC can form another rivalry
  - Default: 8, Range: [3, 20]
- **escalationChance**: Probability supporters escalate to conflict
  - Default: 0.3, Range: [0.1, 0.7]

#### relationship_decay
Location: `src/domain/penguin/systems/relationshipDecay.ts`

- **throttleChance**: Probability system runs each tick
  - Default: 0.3, Range: [0.1, 0.6]
- **decayRate**: Probability a relationship decays
  - Default: 0.05, Range: [0.01, 0.2]

#### relationship_reinforcement
Location: `src/domain/penguin/systems/relationshipReinforcement.ts`

- **throttleChance**: Probability system runs each tick
  - Default: 0.2, Range: [0.05, 0.5]
- **reinforcementRate**: Probability a relationship strengthens
  - Default: 0.15, Range: [0.05, 0.4]

#### alliance_formation
Location: `src/domain/penguin/systems/allianceFormation.ts`

- **throttleChance**: Probability system runs each tick
  - Default: 0.15, Range: [0.05, 0.4]
- **formationChance**: Probability factions form alliance
  - Default: 0.2, Range: [0.05, 0.6]
- **cooldown**: Ticks before same faction can form another alliance
  - Default: 10, Range: [3, 25]

#### belief_contagion
Location: `src/domain/penguin/systems/beliefContagion.ts`

- **throttleChance**: Probability system runs each tick
  - Default: 0.25, Range: [0.1, 0.5]
- **spreadChance**: Probability belief spreads to connected NPC
  - Default: 0.2, Range: [0.05, 0.6]
- **immunityChance**: Probability NPC becomes immune instead of adopting
  - Default: 0.15, Range: [0.05, 0.4]
- **criticalMass**: Minimum believers for ideology to become enacted
  - Default: 8, Range: [3, 20]

## Template Parameters

### World-Level Templates (New)

#### territorial_expansion
Location: `src/domain/penguin/templates/faction/territorialExpansion.ts`

- **expansionAggressiveness**: How readily factions expand into adjacent territories
  - Default: 0.5, Range: [0.2, 1.0]
- **leaderProminenceBonus**: Prominence bonus for faction leaders on successful expansion
  - Default: 0.3, Range: [0.0, 0.6]

#### trade_route_establishment
Location: `src/domain/penguin/templates/faction/tradeRouteEstablishment.ts`

- **tradeFormationRate**: How readily factions establish trade relationships
  - Default: 0.6, Range: [0.2, 1.0]
- **merchantInfluence**: Influence gain for merchants facilitating trade
  - Default: 0.2, Range: [0.0, 0.5]

#### magical_site_discovery
Location: `src/domain/penguin/templates/abilities/magicalSiteDiscovery.ts`

- **discoveryRate**: How frequently practitioners discover new magical sites
  - Default: 0.4, Range: [0.1, 0.8]
- **anomalyProminence**: Starting prominence level for discovered anomalies
  - Default: 0.7, Range: [0.3, 1.0]
- **practitionerBonus**: Influence bonus for practitioner who discovers site
  - Default: 0.2, Range: [0.0, 0.5]

#### tech_breakthrough
Location: `src/domain/penguin/templates/abilities/techBreakthrough.ts`

- **innovationRate**: How frequently technological breakthroughs occur
  - Default: 0.5, Range: [0.2, 0.9]
- **factionAdoptionBonus**: Influence bonus for factions that develop new tech
  - Default: 0.15, Range: [0.0, 0.4]
- **spreadProbability**: Probability that allied factions also adopt the tech
  - Default: 0.3, Range: [0.1, 0.7]

### NPC Templates

#### ideology_emergence
Location: `src/domain/penguin/templates/rules/ideologyEmergence.ts`

- **unstableActivationChance**: Probability when stability is low
  - Default: 0.3, Range: [0.1, 0.7]

#### cult_formation
Location: `src/domain/penguin/templates/faction/cultFormation.ts`

- **numCultists**: Number of initial cultist followers
  - Default: 3, Range: [2, 8]

## Usage Example

```typescript
import { applyParameterOverrides } from './utils/parameterOverrides';

const overrides = {
  systems: {
    'universal_catalyst': {
      metadata: {
        parameters: {
          actionAttemptRate: { value: 0.45 },
          influenceGain: { value: 0.15 }
        }
      }
    }
  },
  templates: {
    'territorial_expansion': {
      metadata: {
        parameters: {
          expansionAggressiveness: { value: 0.8 }
        }
      }
    }
  }
};

const { templates, systems } = applyParameterOverrides(
  allTemplates,
  allSystems,
  overrides
);
```

## Fitness Metrics

The `StatisticsCollector` service tracks these metrics for GA evaluation:

### Distribution Fitness (0-1, higher is better)
- **entityDistributionFitness**: How closely entity kind ratios match targets
- **prominenceDistributionFitness**: How closely prominence ratios match targets
- **relationshipDiversityFitness**: Shannon entropy of relationship types
- **connectivityFitness**: Graph clustering and isolated node metrics

### Overall Metrics
- **overallFitness**: Weighted average of distribution fitness scores
- **constraintViolations**: Count of hard constraint violations (0 = valid)
- **convergenceRate**: How quickly distributions reached target
- **stabilityScore**: Variance in metrics over time (1 = stable)

### Performance Metrics
- **protectedRelationshipViolations**: Violations per tick (target: <3.0)
- **relationshipGrowthRate**: Relationships added per tick
- **templatesApplied**: Execution counts by template ID
- **systemsExecuted**: Execution counts by system ID

## Parameter Optimization Strategy

1. **Phase 1: Coarse Grid Search**
   - Test parameter values at min, mid, max points
   - Identify promising regions of parameter space

2. **Phase 2: Genetic Algorithm**
   - Population: 20-50 parameter configurations
   - Fitness: Weighted combination of distribution + performance metrics
   - Selection: Tournament selection (k=3)
   - Crossover: Uniform crossover for parameters
   - Mutation: Gaussian mutation within [min, max] bounds
   - Elitism: Keep top 10% of population

3. **Phase 3: Local Refinement**
   - Hill climbing around best GA solution
   - Fine-tune parameters with ±10% perturbations

## Notes

- All parameters have min/max bounds enforced by the override system
- Framework systems (universal_catalyst, occurrence_creation, era_transition) are domain-agnostic
- Domain systems and templates are penguin-specific but follow same parameter patterns
- The `metadata.parameters` structure is used by both templates and systems
- Parameters marked with "throttleChance" control execution frequency to prevent spam
