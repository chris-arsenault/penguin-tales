# Framework/Domain Separation Analysis

**Date**: 2025-11-23
**Purpose**: Ensure clean separation between framework (domain-agnostic) and domain (penguin-specific) layers
**Goal**: Enable reuse of framework for other domains without modification

---

## Executive Summary

**Status**: ❌ **SIGNIFICANT VIOLATIONS FOUND**

The codebase has **substantial mixing** of framework and domain concerns. The core framework (engine, types, utilities) contains hardcoded penguin-specific knowledge that would prevent clean reuse for other domains (e.g., medieval fantasy, sci-fi, etc.).

**Critical Issues**:
1. Core type definitions hardcode entity kinds (`'npc' | 'location' | 'faction' | 'rules' | 'abilities'`)
2. Engine contains hardcoded relationship kinds and entity kind lists
3. Validators hardcode domain-specific rules (NPCs need `resident_of` relationships)
4. Utilities contain penguin-specific name generation
5. Systems (which should be domain) hardcode relationship kinds

---

## Layer Definitions

### Framework Layer (Should Be Domain-Agnostic)
**Purpose**: Generic world simulation engine that works for ANY domain

**Components**:
- Abstract types: `HardState`, `Relationship`, `Graph`
- Engine: `WorldEngine` - orchestrates growth/simulation cycles
- Interfaces: `GrowthTemplate`, `SimulationSystem`
- Services: Statistics, distribution tracking
- Utilities: Generic helpers for entity/relationship queries
- Validators: Generic structural validation

**Key Principle**: Framework should work with `string` types for `kind`, `subtype`, `status`. It should NOT know about specific entity kinds or relationship types.

### Domain Layer (Penguin-Specific)
**Purpose**: All penguin world knowledge

**Components**:
- Templates: `family_expansion`, `orca_raider_arrival`, etc.
- Systems: `conflict_contagion`, `thermal_cascade`, etc.
- Eras: `The Great Thaw`, `Faction Wars`, etc.
- Pressures: `resource_scarcity`, `magical_instability`, etc.
- Initial state: Aurora Berg, The Glow-Fissure, etc.
- Configuration: Entity kinds, relationship kinds, distribution targets

---

## Detailed Violations

### 🔴 CRITICAL: Core Type Definitions (`src/types/worldTypes.ts`)

**Lines 11, 42-53**: Hardcoded entity kinds and subtypes

```typescript
// ❌ VIOLATION: Framework type hardcodes domain entities
export interface HardState {
  kind: 'npc' | 'location' | 'faction' | 'rules' | 'abilities';  // Line 11
  // ...
}

// ❌ VIOLATION: Domain-specific subtypes in framework
export type NPCSubtype = 'merchant' | 'mayor' | 'hero' | 'outlaw';  // Line 42
export type LocationSubtype = 'iceberg' | 'colony' | 'igloo' | 'geographic_feature' | 'anomaly';  // Line 43
export type FactionSubtype = 'political' | 'criminal' | 'cult' | 'company';  // Line 44
export type RulesSubtype = 'edict' | 'taboo' | 'social' | 'natural';  // Line 45
export type AbilitiesSubtype = 'magic' | 'faith' | 'technology' | 'physical';  // Line 46

// ❌ VIOLATION: Domain-specific status values
export type NPCStatus = 'alive' | 'dead' | 'fictional' | 'missing';  // Line 49
export type FactionStatus = 'active' | 'disbanded' | 'waning';  // Line 50
export type LocationStatus = 'thriving' | 'waning' | 'abandoned';  // Line 51
```

**Impact**: Cannot use framework for any other domain without modifying core types.

**Recommendation**:
```typescript
// ✅ CORRECT: Generic types
export interface HardState {
  kind: string;  // Domain defines valid values
  subtype: string;
  status: string;
  // ...
}
```

---

### 🔴 CRITICAL: Engine Domain Logic (`src/engine/worldEngine.ts`)

**Lines 673, 714**: Hardcoded entity kinds list

```typescript
// ❌ VIOLATION: Framework hardcodes domain entity kinds
private calculateGrowthTarget(): number {
  const entityKinds = ['npc', 'faction', 'rules', 'abilities', 'location'];  // Line 673
  // ...
}

private calculateEntityDeficits(): Map<string, number> {
  const entityKinds = ['npc', 'faction', 'rules', 'abilities', 'location'];  // Line 714
  // ...
}
```

**Lines 752-768**: Template-to-entity-kind heuristics

```typescript
// ❌ VIOLATION: String matching on domain-specific names
if (templateId.includes('npc') || templateId.includes('family') || templateId.includes('hero') ||
    templateId.includes('outlaw') || templateId.includes('succession')) {
  deficitWeight = (deficits.get('npc') || 0) + 1;
} else if (templateId.includes('faction') || templateId.includes('guild') || templateId.includes('cult')) {
  deficitWeight = (deficits.get('faction') || 0) + 1;
}
// ... more hardcoded patterns
```

**Lines 70, 79, 112, 122, 134, 147, 190, 220, 230, 266**: Hardcoded relationship kinds

```typescript
// ❌ VIOLATION: Framework knows about specific relationship kinds
const currentResidents = graph.relationships.filter(r =>
  r.kind === 'resident_of' && r.dst === location.id  // Line 70
);

const currentController = graph.relationships.find(r =>
  (r.kind === 'stronghold_of' || r.kind === 'controls') && r.dst === location.id  // Line 79
);

const currentLeader = graph.relationships.find(r =>
  r.kind === 'leader_of' && r.dst === faction.id  // Line 112
);
// ... many more examples
```

**Line 980**: Hardcoded faction deficit check

```typescript
// ❌ VIOLATION: Framework checks specific entity kind deviation
const factionDeviation = deviation.entityKind.deviations['faction'] || 0;  // Line 980
```

**Impact**: Engine cannot work with any domain except penguins. Adding a new domain requires modifying 30+ lines of engine code.

**Recommendation**:
- Entity kinds should be provided via configuration
- Relationship kinds should be queried from domain schema
- Template-to-entity mapping should use metadata, not string matching

---

### 🔴 CRITICAL: Validators (`src/utils/validators.ts`)

**Lines 76-115**: `validateNPCStructure()` - Domain-specific validator

```typescript
// ❌ VIOLATION: Framework validator hardcodes domain rules
export function validateNPCStructure(graph: Graph): ValidationResult {
  const npcs = Array.from(graph.entities.values()).filter(e => e.kind === 'npc');  // Line 77
  // ...
  npcs.forEach(npc => {
    if (npc.status === 'alive') {  // Line 81 - hardcoded status
      const hasLocation = npc.links.some(l => l.kind === 'resident_of');  // Line 83 - hardcoded relationship
      if (!hasLocation) {
        invalidNPCs.push(npc);
      }
    }
  });
}
```

**Impact**: Validator assumes NPCs exist and must have `resident_of` relationships. Medieval fantasy domain might not have NPCs, or might call them 'characters', or might not require location relationships.

**Recommendation**: Validators should be configurable via domain schema:
```typescript
interface ValidationRule {
  entityKind: string;
  requiredRelationships: Array<{
    kind: string;
    condition?: (entity: HardState) => boolean;
  }>;
}
```

---

### 🟡 MODERATE: Utilities (`src/utils/helpers.ts`)

**Lines 7-36**: Penguin name generation

```typescript
// ❌ VIOLATION: Framework utility contains domain data
const penguinFirstNames = [
  'Frost', 'Ice', 'Snow', 'Crystal', 'Aurora', 'Storm', 'Tide', 'Wave',
  'Glacier', 'Floe', 'Drift', 'Chill', 'Blizzard', 'Shimmer', 'Glint'
];

const penguinLastNames = [
  'beak', 'wing', 'diver', 'slider', 'walker', 'swimmer', 'fisher',
  'hunter', 'watcher', 'keeper', 'breaker', 'caller', 'singer'
];

const titles = {
  hero: ['Brave', 'Bold', 'Swift', 'Mighty'],
  mayor: ['Elder', 'Wise', 'High', 'Chief'],
  merchant: ['Trader', 'Dealer', 'Master', 'Guild'],
  outlaw: ['Shadow', 'Silent', 'Quick', 'Sly'],
  // ...
};

export function generateName(type: string = 'default'): string {
  // Uses penguin names
}
```

**Impact**: Name generation is tied to penguins. Medieval domain would need completely different name generation.

**Recommendation**: Move to domain layer or make name generation a configurable service:
```typescript
interface NameGenerator {
  generate(type: string): string;
}
```

---

### 🟡 MODERATE: Systems (`src/systems/relationshipCulling.ts`)

**Lines 61-65**: Protected relationship kinds

```typescript
// ❌ BORDERLINE VIOLATION: System (domain) hardcodes relationship kinds
const protectedKinds = new Set([
  'member_of', 'leader_of', 'resident_of', 'practitioner_of', 'originated_in',
  'contains', 'contained_by', 'adjacent_to',  // Spatial relationships
  'manifests_at', 'slumbers_beneath', 'discoverer_of'  // Ability relationships
]);
```

**Assessment**: This is in `systems/` which is technically domain layer, BUT:
- The system is called `relationshipCulling` which sounds generic/framework-like
- The comment says "core narrative elements" suggesting framework intent
- Other domains would need to rewrite this system completely

**Question for Clarification**:
Should `relationshipCulling` be a framework system (generic, works for any domain) or a domain system (penguin-specific)?

If framework: Protected kinds should be configurable
If domain: This is acceptable as-is

**Current Assessment**: Seems like it's trying to be framework but has domain knowledge baked in.

---

### 🟢 ACCEPTABLE: Configuration (`config/distributionTargets.json`)

**Lines 16-20**: Entity kind targets

```json
"entityKindDistribution": {
  "targets": {
    "npc": 0.2,
    "location": 0.25,
    "faction": 0.20,
    "rules": 0.15,
    "abilities": 0.20
  }
}
```

**Assessment**: ✅ This is a domain configuration file, so domain-specific values are appropriate.

**Issue**: Framework code (engine, statistics) assumes these specific keys exist. If a new domain has `"characters"` instead of `"npc"`, the engine breaks.

**Recommendation**: Framework should iterate over whatever keys exist in config, not assume specific keys.

---

## Architectural Recommendations

### 1. Domain Schema/Registry (NEW)

Create a domain configuration that defines all domain-specific knowledge:

```typescript
// domain/penguinDomain.ts
export const penguinDomain: DomainSchema = {
  entityKinds: [
    {
      kind: 'npc',
      subtypes: ['merchant', 'mayor', 'hero', 'outlaw'],
      statusValues: ['alive', 'dead', 'fictional', 'missing'],
      requiredRelationships: [
        { kind: 'resident_of', when: (e) => e.status === 'alive' }
      ]
    },
    {
      kind: 'location',
      subtypes: ['iceberg', 'colony', 'igloo', 'geographic_feature', 'anomaly'],
      statusValues: ['thriving', 'waning', 'abandoned']
    },
    // ... more entity kinds
  ],

  relationshipKinds: [
    {
      kind: 'resident_of',
      srcKinds: ['npc'],
      dstKinds: ['location'],
      protected: true,  // Don't cull
      structural: true  // Required for entity validity
    },
    {
      kind: 'leader_of',
      srcKinds: ['npc'],
      dstKinds: ['faction'],
      protected: true
    },
    // ... more relationship kinds
  ],

  pressures: pressures,
  eras: penguinEras,

  nameGenerator: penguinNameGenerator,

  distributionTargets: distributionTargetsData
};
```

### 2. Generic Type Definitions

```typescript
// types/worldTypes.ts - FRAMEWORK
export interface HardState {
  id: string;
  kind: string;      // ✅ Generic string, not union type
  subtype: string;   // ✅ Generic string
  status: string;    // ✅ Generic string
  name: string;
  description: string;
  prominence: Prominence;
  tags: string[];
  links: Relationship[];
  createdAt: number;
  updatedAt: number;
}
```

### 3. Configurable Engine

```typescript
// engine/worldEngine.ts
export class WorldEngine {
  private domain: DomainSchema;

  constructor(
    config: EngineConfig,
    initialState: HardState[],
    domain: DomainSchema  // ✅ Inject domain knowledge
  ) {
    this.domain = domain;
  }

  private calculateGrowthTarget(): number {
    // ✅ Get entity kinds from domain, not hardcoded
    const entityKinds = this.domain.entityKinds.map(ek => ek.kind);
    // ...
  }

  private getProtectedRelationships(): Set<string> {
    // ✅ Query domain schema, not hardcoded
    return new Set(
      this.domain.relationshipKinds
        .filter(rk => rk.protected)
        .map(rk => rk.kind)
    );
  }
}
```

### 4. Configurable Validators

```typescript
// utils/validators.ts
export function validateEntityStructure(
  graph: Graph,
  domain: DomainSchema
): ValidationResult {
  const violations: HardState[] = [];

  graph.entities.forEach(entity => {
    // ✅ Get requirements from domain schema
    const kindSchema = domain.entityKinds.find(ek => ek.kind === entity.kind);
    if (!kindSchema) return;

    kindSchema.requiredRelationships?.forEach(req => {
      if (req.when && !req.when(entity)) return;

      const hasRelationship = entity.links.some(l => l.kind === req.kind);
      if (!hasRelationship) {
        violations.push(entity);
      }
    });
  });

  // ...
}
```

### 5. Domain-Specific Utilities

Move name generation to domain layer:

```typescript
// domain/penguin/nameGenerator.ts
export const penguinNameGenerator: NameGenerator = {
  generate(type: string): string {
    const first = pickRandom(penguinFirstNames);
    const last = pickRandom(penguinLastNames);
    // ...
  }
};

// Framework uses it via injection
const name = this.domain.nameGenerator.generate(type);
```

---

## Migration Strategy (For Future Refactoring)

**⚠️ DO NOT IMPLEMENT NOW - GA IS RUNNING**

When GA completes, refactor in this order:

### Phase 1: Extract Domain Schema
1. Create `src/domain/penguin/schema.ts`
2. Move all penguin-specific constants to schema
3. Keep framework and domain code in same files (no breaking changes)

### Phase 2: Make Types Generic
1. Change `HardState.kind` from union to `string`
2. Remove subtype/status union types
3. Add runtime validation using domain schema

### Phase 3: Inject Domain into Engine
1. Add `domain: DomainSchema` parameter to `WorldEngine`
2. Replace hardcoded entity kinds with `domain.entityKinds`
3. Replace hardcoded relationship kinds with `domain.relationshipKinds`

### Phase 4: Genericize Validators
1. Make validators query domain schema for rules
2. Remove hardcoded `validateNPCStructure()` etc.
3. Add generic `validateEntityStructure(domain)`

### Phase 5: Extract Utilities
1. Move name generation to domain
2. Make generic helpers truly generic

### Phase 6: Test with New Domain
1. Create `medievalDomain.ts` or `sciFiDomain.ts`
2. Verify framework works without modification
3. Only domain-specific code should change

---

## Questions for Clarification

### 1. Systems Classification
**Q**: Should `relationshipCulling` be framework or domain?

**Options**:
- **Framework**: Generic culling system, protected kinds configured by domain
- **Domain**: Penguin-specific culling logic, other domains write their own

**Current State**: Ambiguous - lives in `systems/` (domain) but has framework-like intent

### 2. Distribution Tracking
**Q**: How should framework handle unknown entity kinds in distribution targets?

**Current**: Framework assumes specific keys like `'npc'`, `'faction'` exist
**Option A**: Framework iterates over whatever keys exist (flexible)
**Option B**: Framework requires domain to declare all entity kinds upfront (strict)

### 3. Template Metadata
**Q**: How should templates declare what entity kinds they produce?

**Current**: Engine uses string matching (`templateId.includes('npc')`)
**Better**: Template metadata: `produces: { entityKinds: ['npc'] }`

---

## Summary of Violations

| Location | Violation | Severity | Lines |
|----------|-----------|----------|-------|
| `types/worldTypes.ts` | Hardcoded entity kinds in `HardState.kind` | 🔴 Critical | 11 |
| `types/worldTypes.ts` | Hardcoded subtype unions | 🔴 Critical | 42-46 |
| `types/worldTypes.ts` | Hardcoded status unions | 🔴 Critical | 49-53 |
| `engine/worldEngine.ts` | Hardcoded entity kinds list | 🔴 Critical | 673, 714 |
| `engine/worldEngine.ts` | Hardcoded relationship kinds | 🔴 Critical | 70, 79, 112, 122, 134, 147, 190, 220, 230, 266 |
| `engine/worldEngine.ts` | Template name string matching | 🔴 Critical | 752-768 |
| `engine/worldEngine.ts` | Hardcoded faction deviation check | 🔴 Critical | 980 |
| `utils/validators.ts` | Domain-specific `validateNPCStructure()` | 🔴 Critical | 76-115 |
| `utils/helpers.ts` | Penguin name generation | 🟡 Moderate | 7-36 |
| `systems/relationshipCulling.ts` | Protected kinds hardcoded | 🟡 Moderate | 61-65 |

**Total Critical Violations**: 9 locations
**Total Moderate Violations**: 2 locations

---

## Conclusion

**Current State**: Framework and domain are significantly intermingled. Approximately **30-40% of framework code** contains domain-specific knowledge.

**Impact**: Cannot cleanly reuse framework for other domains. Would require modifying:
- Core type definitions
- Engine logic (10+ methods)
- Validators
- Utilities

**Effort to Separate**: **Medium-High** (3-5 days of focused refactoring)

**Recommendation**:
1. **Acknowledge**: This is technical debt but system works well for penguins
2. **Plan**: Design domain schema interface before next big domain
3. **Refactor**: When GA completes and code can change safely
4. **Test**: Create second domain (medieval/sci-fi) to validate separation

**Blocker**: ❌ Cannot modify code while GA is running
**Next Step**: ✅ Design domain schema interface, prepare refactoring plan
