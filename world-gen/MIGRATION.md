# Statistical Metadata Migration Tracker

This document tracks the progress of adding statistical metadata to all templates and systems.

## Templates (21 total)

| Status | Category | File | Parameters Extracted | Notes |
|--------|----------|------|---------------------|-------|
| ✅ | faction | guildEstablishment.ts | None | Example template |
| ✅ | faction | cultFormation.ts | numCultists (1 total) | COMPLETE |
| ✅ | faction | factionSplinter.ts | leaderHeroChance (1 total) | COMPLETE |
| ✅ | npc | familyExpansion.ts | numChildrenMin/Max, inheritSubtypeChance, joinParentFactionChance (4 total) | COMPLETE |
| ✅ | npc | heroEmergence.ts | None | No tunable parameters |\n| ✅ | npc | kinshipConstellation.ts | familySizeMin/Max, rivalryChance, romanceChance, isingTemperature, isingCouplingStrength, isingExternalField (7 total) | COMPLETE |
| ✅ | npc | mysteriousVanishing.ts | activationChance, mythicProximityMultiplier, renownedProximityMultiplier, maxSearchers (4 total) | COMPLETE |
| ✅ | npc | outlawRecruitment.ts | numOutlawsMin/Max (2 total) | COMPLETE |
| ✅ | npc | succession.ts | None | No tunable parameters |
| ✅ | location | anomalyManifestation.ts | activationChance (1 total) | COMPLETE |
| ✅ | location | colonyFounding.ts | None | No tunable parameters |
| ✅ | location | geographicExploration.ts | baseChance (1 total) | COMPLETE |
| ✅ | location | krillBloomMigration.ts | activationChance, bloomCountMin/Max, techDiscoveryChance (4 total) | COMPLETE |
| ✅ | location | mysticalLocationDiscovery.ts | None | Emergent discovery |
| ✅ | location | resourceLocationDiscovery.ts | None | Emergent discovery |
| ✅ | location | strategicLocationDiscovery.ts | None | Emergent discovery |
| ✅ | abilities | magicDiscovery.ts | None | No tunable parameters |
| ✅ | abilities | techInnovation.ts | maxPractitioners (1 total) | COMPLETE |
| ✅ | rules | crisisLegislation.ts | None | No tunable parameters |
| ✅ | rules | greatFestival.ts | stableActivationChance (1 total) | COMPLETE |
| ✅ | rules | ideologyEmergence.ts | unstableActivationChance (1 total) | COMPLETE |

**Progress: 21/21 (100%) - ALL TEMPLATES COMPLETE**

## Systems (10 total)

| Status | File | Parameters Extracted | Notes |
|--------|------|---------------------|-------|
| ✅ | relationshipFormation.ts | throttleChance, friendshipBaseChance, romanceBaseChance, all multipliers, all cooldowns (18 total) | HIGH PRIORITY - COMPLETE |
| ✅ | allianceFormation.ts | allianceBaseChance (1 total) | COMPLETE |
| ✅ | beliefContagion.ts | transmissionRate, recoveryRate, resistanceWeight, traditionWeight, enactmentThreshold (5 total) | SIR epidemic model - COMPLETE |
| ✅ | conflictContagion.ts | baseSpreadChance, allyMultiplier, locationMultiplier (3 total) | COMPLETE |
| ✅ | culturalDrift.ts | ruleRepealChance, factionWaningChance (2 total) | COMPLETE |
| ✅ | legendCrystallization.ts | throttleChance, crystallizationThreshold (2 total) | COMPLETE |
| ✅ | prominenceEvolution.ts | npcGainChance, npcDecayChance, locationGainChance, locationDecayChance, abilityGainChance, abilityDecayChance, ruleGainChance, ruleDecayChance (8 total) | COMPLETE |
| ✅ | resourceFlow.ts | None | No tunable parameters |
| ✅ | successionVacuum.ts | throttleChance, rivalryCooldown, rivalryChance, escalationChance, conflictChance, repealChance (6 total) | COMPLETE |
| ✅ | thermalCascade.ts | frequency, alpha, threshold, migrationCooldown, recoveryChance, migrationChance, discoveryChance (7 total) | Discrete Laplacian - COMPLETE |

**Progress: 10/10 (100%) - ALL SYSTEMS COMPLETE**

## Common Parameters to Extract

When adding metadata, look for these patterns and extract as tunable parameters:

- **Probability rolls**: `Math.random() < 0.X` → extract as `probability` parameter
- **Chance variables**: `romanceChance`, `friendChance`, etc.
- **Count ranges**: `Math.floor(Math.random() * X) + Y` → extract min/max
- **Thresholds**: Hardcoded comparison values
- **Multipliers**: Any numeric constants that affect calculations
- **Cooldowns**: Time-based restrictions

## Metadata Template

```typescript
metadata: {
  produces: {
    entityKinds: [
      {
        kind: 'kind_name',
        subtype: 'subtype_name',
        count: { min: X, max: Y },
        prominence: [
          { level: 'level_name', probability: Z }
        ]
      }
    ],
    relationships: [
      {
        kind: 'relationship_kind',
        category: 'social|political|economic|spatial|cultural',
        probability: X,
        comment: 'Description'
      }
    ]
  },
  effects: {
    graphDensity: -1 to +1,
    clusterFormation: -1 to +1,
    diversityImpact: -1 to +1,
    comment: 'Overall effect description'
  },
  parameters: {
    parameterName: {
      value: default_value,
      min: minimum_value,
      max: maximum_value,
      description: 'What this parameter controls'
    }
  },
  tags: ['tag1', 'tag2']
}
```

## Update Instructions

When migrating a template/system:

1. Read the implementation carefully
2. Identify all entities created and their prominence
3. Identify all relationships created
4. Categorize relationships (social/political/economic/spatial/cultural)
5. Extract any hardcoded probabilities, counts, or thresholds
6. Calculate effect scores:
   - **graphDensity**: How many connections per entity?
   - **clusterFormation**: Creates tight groups vs dispersed?
   - **diversityImpact**: Increases variety vs homogenizes?
7. Update this tracker
8. Test that template still works

## Notes

- Parameters should use the actual variable name from code when possible
- Document what changed when extracting hardcoded values
- Mark parameters that are particularly impactful with comments
- Some templates may have 0 parameters (that's okay!)

---

## Final Statistics Summary

### ✅ METADATA EXTRACTION COMPLETE (100%)

**Total Files Processed**: 31/31
- **Templates**: 21/21 (100%)
- **Systems**: 10/10 (100%)

**Total Parameters Extracted**: 80

### Parameter Breakdown

**Templates** (28 parameters total):
- Faction templates: 2 parameters
- NPC templates: 17 parameters
- Location templates: 6 parameters
- Abilities templates: 1 parameter
- Rules templates: 2 parameters

**Systems** (52 parameters total):
- relationshipFormation: 18 parameters (most complex)
- prominenceEvolution: 8 parameters
- thermalCascade: 7 parameters
- successionVacuum: 6 parameters
- beliefContagion: 5 parameters (SIR epidemic model)
- conflictContagion: 3 parameters
- culturalDrift: 2 parameters
- legendCrystallization: 2 parameters
- allianceFormation: 1 parameter
- resourceFlow: 0 parameters

### Parameter Categories

1. **Probabilities** (~40 params): Activation chances, event triggers, stochastic decisions
2. **Counts** (~15 params): Min/max ranges for entity creation
3. **Multipliers** (~10 params): Proximity bonuses, relationship weights
4. **Cooldowns** (~8 params): Temporal restrictions between events
5. **Model Parameters** (~7 params): Physics simulation constants (Ising model, thermal diffusion, SIR model)

### Complex Systems with Advanced Models

1. **kinshipConstellation** (Ising Model): Statistical physics for family trait assignment
2. **beliefContagion** (SIR Epidemic Model): Mathematical disease model for ideological spread
3. **thermalCascade** (Discrete Laplacian): Heat diffusion through location graph
4. **successionVacuum** (Cascade System): Multi-stage leadership crisis dynamics

### Metadata Features Added

Every template/system now declares:
- **produces**: What entities and relationships it creates (with counts, probabilities, prominence levels)
- **effects**: Impact scores for graphDensity, clusterFormation, diversityImpact (-1 to +1 scale)
- **parameters**: All tunable values with min/max ranges and descriptions
- **tags/triggers**: Context about when and how the template/system operates

### Next Steps

1. ✅ Extract metadata for all templates (COMPLETE)
2. ✅ Extract metadata for all systems (COMPLETE)
3. ✅ Update MIGRATION.md with final stats (COMPLETE)
4. ⏳ Integrate TemplateSelector into worldEngine
5. ⏳ Add distribution monitoring and logging
6. ⏳ Create cross-run learning system for parameter optimization

---

**Completion Date**: Session completed with 100% metadata extraction across all 31 files.
**Total Parameters**: 80 tunable values now available for meta-generation optimization.
**Backward Compatibility**: All parameters use `??` fallback operators to maintain existing behavior.

---

## Integration Status

✅ **INTEGRATION COMPLETE**

The statistical distribution system has been fully integrated into the world generation engine:

1. ✅ Metadata extraction complete (31/31 files)
2. ✅ TemplateSelector integrated into worldEngine
3. ✅ Distribution monitoring and logging implemented
4. ✅ Export state includes distribution metrics
5. ✅ All TypeScript compilation errors resolved
6. ✅ Backward compatibility maintained

See **[INTEGRATION_SUMMARY.md](./INTEGRATION_SUMMARY.md)** for complete integration documentation, architecture details, and usage instructions.
