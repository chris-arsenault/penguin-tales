# Feedback Loop Architecture Design

## Current State Analysis

### Existing Feedback Loops (Good!)
1. **Relationship Strength** - Decay/reinforcement creates natural churn
2. **Era Progression** - Time-based transitions
3. **Cult Formation** - Hard cap at 15 (manually added)
4. **War Occurrences** - Faction cooldown prevents spam
5. **Pressures** - All pressures have decay, some have growth from entity counts

### Critical Gaps (Bad!)
1. **No entity count → pressure feedback** for most entity types
2. **No pressure → creation rate feedback** (pressures trigger templates but don't slow them)
3. **No saturation limits** on most templates
4. **No bidirectional feedback** (creation drives pressure up, but high pressure doesn't slow creation)

---

## Proposed Architecture: Homeostatic Control System

### Layer 1: Entity Population Tracker
**Purpose**: Real-time monitoring of all entity/relationship counts

```typescript
interface PopulationMetrics {
  entities: Map<string, {
    kind: string;
    subtype: string;
    count: number;
    target: number;        // From distribution targets
    deviation: number;     // (count - target) / target
    trend: number;         // Rate of change (delta per tick)
  }>;

  relationships: Map<string, {
    kind: string;
    count: number;
    target: number;
    deviation: number;
    trend: number;
  }>;

  pressures: Map<string, {
    value: number;
    target: number;       // Ideal equilibrium
    deviation: number;
    trend: number;
  }>;
}
```

### Layer 2: Feedback Coefficient Calculator
**Purpose**: Calculate how much entity counts affect pressures

```typescript
interface FeedbackCoefficients {
  // Entity count → Pressure
  entityToPressure: Map<string, Map<string, number>>;
  // Example: npc:hero count affects conflict pressure with coefficient -0.5
  // (more heroes = less conflict)

  // Pressure → Template weight
  pressureToTemplate: Map<string, Map<string, number>>;
  // Example: high conflict increases hero_emergence weight

  // Pressure → System modifier
  pressureToSystem: Map<string, Map<string, number>>;
  // Example: high conflict increases conflict_contagion intensity
}
```

### Layer 3: Dynamic Weight Adjuster
**Purpose**: Modify template weights based on population deviation

```typescript
function calculateDynamicWeight(
  template: GrowthTemplate,
  baseWeight: number,
  metrics: PopulationMetrics
): number {
  let adjustedWeight = baseWeight;

  // For each entity kind the template creates
  for (const entityKind of template.metadata.produces.entityKinds) {
    const key = `${entityKind.kind}:${entityKind.subtype}`;
    const metric = metrics.entities.get(key);

    if (metric && metric.deviation > 0.2) {
      // Over target by 20%+ → reduce weight
      const suppressionFactor = 1 - Math.min(metric.deviation, 0.8);
      adjustedWeight *= suppressionFactor;
    } else if (metric && metric.deviation < -0.2) {
      // Under target by 20%+ → increase weight
      const boostFactor = 1 + Math.abs(metric.deviation);
      adjustedWeight *= boostFactor;
    }
  }

  return adjustedWeight;
}
```

### Layer 4: Pressure-Based System Modifiers
**Purpose**: Modify system intensity based on pressure levels

```typescript
function calculateDynamicSystemModifier(
  system: SimulationSystem,
  baseModifier: number,
  pressures: Map<string, number>
): number {
  let adjustedModifier = baseModifier;

  // Example: conflict_contagion should slow when conflict is high
  if (system.id === 'conflict_contagion') {
    const conflict = pressures.get('conflict') || 0;
    if (conflict > 70) {
      // Damping: reduce contagion when conflict is very high
      adjustedModifier *= (1 - (conflict - 70) / 30);
    }
  }

  // Example: alliance_formation should speed up when conflict is high
  if (system.id === 'alliance_formation') {
    const conflict = pressures.get('conflict') || 0;
    if (conflict > 50) {
      // Acceleration: increase alliance formation under stress
      adjustedModifier *= (1 + (conflict - 50) / 50);
    }
  }

  return adjustedModifier;
}
```

### Layer 5: Feedback Loop Registry
**Purpose**: Explicit declaration of all feedback loops

```typescript
interface FeedbackLoop {
  id: string;
  type: 'negative' | 'positive';  // negative = stabilizing, positive = amplifying

  // The chain
  source: string;        // What starts it (e.g., "npc:hero count")
  mechanism: string[];   // How it propagates (e.g., ["reduces conflict", "reduces hero_emergence trigger"])
  target: string;        // What it affects (e.g., "npc:hero creation rate")

  // Coefficients
  strength: number;      // How strong is the feedback
  delay: number;         // Ticks before it takes effect

  // Validation
  active: boolean;       // Is this loop currently functioning?
  lastChecked: number;   // Tick of last validation
}
```

---

## Implementation Plan

### Phase 1: Measurement Infrastructure (Week 1)
**Goal**: Know what's happening before we control it

1. **Create PopulationTracker service** (`src/services/populationTracker.ts`)
   - Tracks entity/relationship counts per tick
   - Calculates deviations from targets
   - Tracks trends (moving average)

2. **Create FeedbackAnalyzer service** (`src/services/feedbackAnalyzer.ts`)
   - Loads feedback loop registry from config
   - Validates loops are functioning (checks coefficients against actual behavior)
   - Reports broken loops

3. **Add tracking to worldEngine**
   - After each tick: update population metrics
   - After each epoch: validate feedback loops
   - Log warnings when loops are broken

### Phase 2: Feedback Coefficient Configuration (Week 1-2)
**Goal**: Explicit declaration of all feedback relationships

4. **Create feedback config** (`src/config/feedbackLoops.ts`)
   ```typescript
   export const feedbackLoops: FeedbackLoop[] = [
     {
       id: 'hero_reduces_conflict',
       type: 'negative',
       source: 'npc:hero.count',
       mechanism: ['conflict_pressure', 'hero_emergence_trigger'],
       target: 'npc:hero.creation_rate',
       strength: -0.5,
       delay: 5
     },
     {
       id: 'magic_drives_instability',
       type: 'positive',
       source: 'abilities:magic.count',
       mechanism: ['magical_instability_pressure'],
       target: 'magical_instability.value',
       strength: 0.3,
       delay: 0
     },
     {
       id: 'instability_reduces_magic',
       type: 'negative',
       source: 'magical_instability.value',
       mechanism: ['magic_discovery_weight'],
       target: 'abilities:magic.creation_rate',
       strength: -0.4,
       delay: 10
     }
     // ... 50+ more
   ];
   ```

5. **Update pressure growth functions** to use entity counts
   ```typescript
   // In pressures.ts
   magical_instability: {
     value: 10,
     decay: 3,
     growth: (graph: Graph) => {
       const anomalyCount = findEntities(graph, { kind: 'location', subtype: 'anomaly' }).length;
       const magicCount = findEntities(graph, { kind: 'abilities', subtype: 'magic' }).length;
       const techCount = findEntities(graph, { kind: 'abilities', subtype: 'technology' }).length;

       const anomalyPressure = anomalyCount * 2.5;
       const magicPressure = (magicCount / (techCount + 1)) * 5;

       return anomalyPressure + magicPressure;
     }
   }
   ```

### Phase 3: Dynamic Weight System (Week 2)
**Goal**: Template weights auto-adjust based on population

6. **Modify template selection** in worldEngine
   ```typescript
   private selectTemplates(era: Era, targetCount: number): GrowthTemplate[] {
     const metrics = this.populationTracker.getMetrics();

     const templateWeights = this.config.templates.map(template => {
       const eraWeight = getTemplateWeight(era, template.id);
       const dynamicWeight = this.calculateDynamicWeight(template, eraWeight, metrics);

       return { template, weight: dynamicWeight };
     });

     // ... rest of selection logic
   }
   ```

7. **Add saturation limits** to all templates
   ```typescript
   // In each template's canApply
   canApply: (graph: Graph) => {
     const existingCount = findEntities(graph, {
       kind: this.metadata.produces.entityKinds[0].kind,
       subtype: this.metadata.produces.entityKinds[0].subtype
     }).length;

     const target = graph.config.distributionTargets?.entities?.[kind]?.[subtype]?.target || Infinity;
     const saturationThreshold = target * 1.5; // Allow 50% overshoot

     if (existingCount >= saturationThreshold) return false;

     // ... rest of conditions
   }
   ```

### Phase 4: Bidirectional Pressure Feedback (Week 3)
**Goal**: Pressures both trigger AND suppress creation

8. **Add pressure thresholds** to templates
   ```typescript
   // In hero_emergence
   canApply: (graph: Graph) => {
     const conflict = graph.pressures.get('conflict') || 0;

     // Need conflict to trigger heroes
     if (conflict < 30) return false;

     // But TOO much conflict should slow hero creation
     // (heroes getting killed, chaos prevents training)
     if (conflict > 80) {
       return Math.random() < 0.3; // Only 30% chance when chaos is extreme
     }

     return true;
   }
   ```

9. **Update pressure decay** to be entity-aware
   ```typescript
   // In pressures.ts
   conflict: {
     decay: (graph: Graph) => {
       const allianceCount = graph.relationships.filter(r => r.kind === 'allied_with').length;
       const factionCount = findEntities(graph, { kind: 'faction' }).length;

       // More alliances = faster conflict decay
       const baseDecay = 5;
       const allianceBonus = (allianceCount / factionCount) * 3;

       return baseDecay + allianceBonus;
     }
   }
   ```

### Phase 5: Monitoring & Alerts (Week 3-4)
**Goal**: Detect when feedback loops are broken

10. **Create FeedbackValidator**
    ```typescript
    class FeedbackValidator {
      validate(loop: FeedbackLoop, graph: Graph, history: HistoryWindow): ValidationResult {
        // Check if source is changing
        const sourceTrend = this.getTrend(loop.source, history);

        // Check if target responds appropriately
        const targetTrend = this.getTrend(loop.target, history);

        // For negative feedback: source up should cause target down
        if (loop.type === 'negative') {
          const correlation = this.calculateCorrelation(sourceTrend, targetTrend);
          if (correlation > -0.3) {
            return {
              valid: false,
              reason: `Expected negative correlation, got ${correlation}`,
              recommendation: `Increase ${loop.id} strength from ${loop.strength} to ${loop.strength * 1.5}`
            };
          }
        }

        return { valid: true };
      }
    }
    ```

11. **Add console reporting**
    ```typescript
    // At end of each epoch
    console.log('\n=== Feedback Loop Health ===');
    const brokenLoops = this.feedbackAnalyzer.validate();

    if (brokenLoops.length > 0) {
      console.warn(`⚠️  ${brokenLoops.length} feedback loops are broken:`);
      brokenLoops.forEach(loop => {
        console.warn(`  - ${loop.id}: ${loop.reason}`);
        console.warn(`    ${loop.recommendation}`);
      });
    } else {
      console.log('✓ All feedback loops functioning correctly');
    }
    ```

### Phase 6: Auto-Tuning (Week 4+)
**Goal**: System auto-corrects broken feedback loops

12. **Implement gradient descent tuner**
    ```typescript
    class FeedbackTuner {
      tune(loop: FeedbackLoop, validationResult: ValidationResult): FeedbackLoop {
        if (validationResult.valid) return loop;

        // Adjust strength in direction that would fix correlation
        const adjustment = validationResult.suggestedStrength - loop.strength;
        const newStrength = loop.strength + (adjustment * 0.1); // Conservative step

        return { ...loop, strength: newStrength };
      }
    }
    ```

---

## Example: Complete Hero Feedback Loop

**Before (No Feedback)**:
```
Conflict rises → Heroes spawn → Heroes keep spawning → 50 heroes → Still spawning
```

**After (Full Feedback)**:
```
1. Conflict rises to 40
   → Triggers hero_emergence (pressure-based trigger)

2. Heroes spawn (5 heroes created)
   → npc:hero count increases
   → Drives conflict pressure DOWN (-0.5 per hero)

3. Conflict drops to 35
   → hero_emergence trigger weakens
   → Fewer heroes spawn (2 heroes created)

4. npc:hero count approaches target (20)
   → Dynamic weight suppression kicks in
   → hero_emergence weight drops to 30% of base

5. npc:hero count exceeds target (25)
   → Saturation limit hits
   → hero_emergence.canApply returns false
   → No more heroes spawn

6. Heroes start dying (natural attrition)
   → npc:hero count drops to 18
   → Below target, dynamic weight boost kicks in
   → hero_emergence weight rises to 150% of base
   → Cycle repeats
```

**Result**: Hero population oscillates around target (20 ± 5) instead of unbounded growth.

---

## Metrics for Success

### Before Implementation
- Entity counts drift unbounded (20-60 of same type)
- Manual tuning required per run
- No visibility into what's broken
- Ad-hoc fixes (hard caps, per-entity limits)

### After Implementation
- Entity counts stabilize around targets (target ± 20%)
- Self-correcting when populations drift
- Automatic alerts for broken loops
- Systematic, mathematically rigorous

### Key Indicators
1. **Coefficient of Variation** < 0.3 for all entity types (after warmup period)
2. **Correlation Strength** > 0.5 for all declared feedback loops
3. **Auto-tuning Success Rate** > 80% (loops fix themselves without manual intervention)
4. **Population Stability** achieved within 100 ticks (not 500)

---

## Next Steps

1. **Review this design** - Does the architecture make sense?
2. **Prioritize gaps** - Which missing feedbacks are most critical?
3. **Define coefficients** - Start with hero/conflict loop, validate empirically
4. **Implement Phase 1** - Measurement first, control second
5. **Iterate** - Start with 5 feedback loops, prove concept, expand to 50+
