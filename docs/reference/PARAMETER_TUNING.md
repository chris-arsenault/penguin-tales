# Parameter Tuning Guide

This document explains how to tune all 80+ extracted parameters from templates and systems via the centralized configuration file.

## Overview

All tunable parameters are controlled via `config/templateSystemParameters.json`. Changes to this file automatically affect template and system behavior without requiring code modifications.

## Configuration File Structure

```json
{
  "templates": {
    "templateId": {
      "metadata": {
        "parameters": {
          "parameterName": {
            "value": <number>,
            "comment": "Optional description"
          }
        },
        "effects": {
          "graphDensity": <number>,
          "clusterFormation": <number>,
          "diversityImpact": <number>
        }
      }
    }
  },
  "systems": {
    "system_id": {
      "metadata": {
        "parameters": {
          "parameterName": {
            "value": <number>
          }
        },
        "effects": {
          "graphDensity": <number>
        }
      }
    }
  }
}
```

## Available Parameters

### Template Parameters (21 templates, ~40 parameters)

**cultFormation**
- `numCultists`: Number of cultists created (default: 3)

**factionSplinter**
- `leaderHeroChance`: Probability splinter leader becomes hero (default: 0.3)

**familyExpansion**
- `numChildrenMin`: Minimum children (default: 1)
- `numChildrenMax`: Maximum children (default: 3)
- `inheritSubtypeChance`: Probability of inheriting parent subtype (default: 0.4)
- `joinParentFactionChance`: Probability of joining parent's faction (default: 0.6)

**kinshipConstellation**
- `familySizeMin`: Minimum family size (default: 3)
- `familySizeMax`: Maximum family size (default: 6)
- `rivalryChance`: Probability of rivalry (default: 0.15)
- `romanceChance`: Probability of romance (default: 0.1)
- `isingTemperature`: Ising model temperature (default: 1.5)
- `isingCouplingStrength`: Ising model coupling (default: 0.8)
- `isingExternalField`: Ising model external field (default: 0.2)

**mysteriousVanishing**
- `activationChance`: Base activation probability (default: 0.4)
- `mythicProximityMultiplier`: Multiplier for mythic entities (default: 2.0)
- `renownedProximityMultiplier`: Multiplier for renowned entities (default: 1.5)
- `maxSearchers`: Maximum search parties (default: 3)

**outlawRecruitment**
- `numOutlawsMin`: Minimum outlaws (default: 2)
- `numOutlawsMax`: Maximum outlaws (default: 4)

**anomalyManifestation**
- `activationChance`: Activation probability (default: 0.5)

**geographicExploration**
- `baseChance`: Base exploration chance (default: 0.4)

**krillBloomMigration**
- `activationChance`: Activation probability (default: 0.6)
- `bloomCountMin`: Minimum blooms (default: 1)
- `bloomCountMax`: Maximum blooms (default: 3)
- `techDiscoveryChance`: Tech discovery probability (default: 0.3)

**techInnovation**
- `maxPractitioners`: Max initial practitioners (default: 5)

**greatFestival**
- `stableActivationChance`: Activation during stability (default: 0.5)

**ideologyEmergence**
- `unstableActivationChance`: Activation during instability (default: 0.4)

### System Parameters (10 systems, ~50 parameters)

**relationship_formation**
- `throttleChance`: Probability of skipping tick (default: 0.7)
- `friendshipBaseChance`: Base friendship probability (default: 0.15)
- `romanceBaseChance`: Base romance probability (default: 0.08)
- `mentorshipBaseChance`: Base mentorship probability (default: 0.1)
- `sameColonyMultiplier`: Same colony bonus (default: 2.0)
- `sameFactionMultiplier`: Same faction bonus (default: 1.5)
- `friendshipCooldown`: Ticks before retry (default: 50)
- `romanceCooldown`: Ticks before retry (default: 100)
- `mentorshipCooldown`: Ticks before retry (default: 80)

**alliance_formation**
- `allianceBaseChance`: Base alliance probability (default: 0.12)
- **effects.graphDensity**: Graph density impact (default: 0.6)

**belief_contagion** (SIR epidemic model)
- `transmissionRate`: Belief transmission rate (default: 0.3)
- `recoveryRate`: Belief recovery rate (default: 0.1)
- `resistanceWeight`: Resistance weight (default: 0.4)
- `traditionWeight`: Tradition weight (default: 0.6)
- `enactmentThreshold`: Rule enactment threshold (default: 0.3)

**conflict_contagion**
- `baseSpreadChance`: Base conflict spread probability (default: 0.25)
- `allyMultiplier`: Ally spread multiplier (default: 2.0)
- `locationMultiplier`: Same location multiplier (default: 1.5)

**cultural_drift**
- `ruleRepealChance`: Rule repeal probability (default: 0.05)
- `factionWaningChance`: Faction waning probability (default: 0.08)

**legend_crystallization**
- `throttleChance`: Throttle probability (default: 0.8)
- `crystallizationThreshold`: References needed (default: 3)

**prominence_evolution**
- `npcGainChance`: NPC prominence gain (default: 0.1)
- `npcDecayChance`: NPC prominence loss (default: 0.15)
- `locationGainChance`: Location prominence gain (default: 0.08)
- `locationDecayChance`: Location prominence loss (default: 0.05)
- `abilityGainChance`: Ability prominence gain (default: 0.12)
- `abilityDecayChance`: Ability prominence loss (default: 0.03)
- `ruleGainChance`: Rule prominence gain (default: 0.1)
- `ruleDecayChance`: Rule prominence loss (default: 0.08)

**succession_vacuum**
- `throttleChance`: Throttle probability (default: 0.7)
- `rivalryCooldown`: Cooldown ticks (default: 30)
- `rivalryChance`: Rivalry probability (default: 0.4)
- `escalationChance`: Escalation probability (default: 0.3)
- `conflictChance`: Conflict probability (default: 0.2)
- `repealChance`: Repeal probability (default: 0.1)

**thermal_cascade** (Discrete Laplacian)
- `frequency`: Cascade frequency (default: 0.3)
- `alpha`: Laplacian alpha parameter (default: 0.5)
- `threshold`: Cascade threshold (default: 0.6)
- `migrationCooldown`: Migration cooldown (default: 40)
- `recoveryChance`: Recovery probability (default: 0.3)
- `migrationChance`: Migration probability (default: 0.4)
- `discoveryChance`: Discovery probability (default: 0.2)

## How to Tune

### Example 1: Increase Romance Probability

Edit `config/templateSystemParameters.json`:

```json
{
  "systems": {
    "relationship_formation": {
      "metadata": {
        "parameters": {
          "romanceBaseChance": {
            "value": 0.15,
            "comment": "Increased from 0.08 for more romantic relationships"
          }
        }
      }
    }
  }
}
```

### Example 2: Change Family Size

```json
{
  "templates": {
    "familyExpansion": {
      "metadata": {
        "parameters": {
          "numChildrenMin": {
            "value": 2
          },
          "numChildrenMax": {
            "value": 5,
            "comment": "Larger families for more dynastic play"
          }
        }
      }
    }
  }
}
```

### Example 3: Adjust Graph Density Effect

```json
{
  "systems": {
    "alliance_formation": {
      "metadata": {
        "effects": {
          "graphDensity": 0.8,
          "comment": "Increased to create more densely connected political networks"
        }
      }
    }
  }
}
```

## Effect Metadata

### graphDensity
- Range: -1 (reduces density) to +1 (increases density)
- Used by DistributionTracker to adjust system weights

### clusterFormation
- Range: -1 (disperses) to +1 (clusters)
- Used to balance cluster count toward target

### diversityImpact
- Range: -1 (homogenizes) to +1 (diversifies)
- Used to increase relationship type diversity

## Testing Changes

After modifying `config/templateSystemParameters.json`:

```bash
npm run build  # Rebuild with new parameters
npm start      # Run generation with updated config
```

Parameters are applied at engine initialization, so no code changes are needed.

## Tips for Tuning

1. **Small Changes**: Adjust values by 10-20% increments
2. **Test Isolated**: Change one parameter at a time to see effects
3. **Watch Metrics**: Monitor distribution statistics to see impact
4. **Balance**: Consider how parameters interact (e.g., high romance + low cooldown = spam)
5. **Comments**: Document why you changed values

## Architecture

The parameter override system uses deep merge to combine config values with code defaults:

1. Templates/systems define default metadata in code
2. `config/templateSystemParameters.json` defines overrides
3. `src/utils/parameterOverrides.ts` merges them at startup
4. Merged metadata drives template/system behavior

This allows:
- **Version control**: Track parameter tuning in git
- **No code changes**: Tune without recompiling
- **Documentation**: Comments explain tuning decisions
- **Easy reversion**: Restore defaults by removing overrides
