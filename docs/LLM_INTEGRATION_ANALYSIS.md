# LLM Integration Analysis & Abstraction Plan
**Date**: 2025-11-23
**Status**: Analysis Only - No Code Changes Made

## Executive Summary

The LLM enrichment system **will have issues** with the new catalyst model implementation. It currently:
1. Lacks awareness of new entity kinds (`era`, `occurrence`)
2. Has hardcoded penguin-specific lore embedded in framework code
3. Doesn't support catalyst model concepts (agent actions, action domains, influence)
4. Violates domain/framework separation principles

**Recommendation**: Implement domain abstraction layer before running LLM enrichment with new catalyst model.

---

## Current Architecture

### Components

#### 1. **LLMClient** (`src/services/llmClient.ts`)
- **Status**: ✅ Framework-level, domain-agnostic
- **Purpose**: Anthropic API wrapper with caching and retry logic
- **No changes needed**

#### 2. **EnrichmentService** (`src/services/enrichmentService.ts`)
- **Status**: ⚠️ Mixed framework/domain concerns
- **Issues**:
  - Methods are generic but prompts are penguin-specific
  - References "Aurora Stack", "Nightfall Shelf", "ice magic" in prompts (lines 126, 139)
  - Uses hardcoded LoreIndex structure
  - No support for occurrences or eras
  - No catalyst model awareness (actions, influence, catalyzedBy)

**Key Methods**:
```typescript
enrichEntities(entities, context)          // Names + descriptions
generateEraNarrative(fromEra, toEra)       // Era transitions
enrichRelationships(relationships)         // Relationship backstories
enrichAbility(ability)                     // Tech/magic abilities
enrichDiscoveryEvent(location, explorer)   // Discovery narratives
```

#### 3. **LoreIndex** (`src/services/loreIndex.ts`)
- **Status**: ❌ Hardcoded penguin domain data in framework location
- **Issues**:
  - Contains penguin colonies, factions, magic notes (lines 17-136)
  - Lives in `src/services/` (framework) not `src/domain/penguin/`
  - Loaded by main.ts as singleton
  - Structure is penguin-specific but used by framework code

**Current Structure**:
```typescript
interface LoreIndex {
  colonies: Array<{ name, values, style }>;  // Penguin-specific
  factions: string[];                        // Penguin-specific
  techNotes: string[];                       // "Glow Stones, Message Ice"
  magicNotes: string[];                      // "Ice Magic (Old Flows)"
  tensions: string[];                        // "Fissure rights"
  canon: string[];                           // Penguin world facts
  geography: { ... };                        // Penguin geography
}
```

#### 4. **Integration Points** (`src/engine/worldEngine.ts`)
- **Status**: ⚠️ Missing new entity kinds
- **Issues**:
  - Enrichment analytics only tracks 5 kinds (lines 309-314):
    - location, faction, rules, abilities, npc
    - **Missing: era, occurrence**
  - Analytics switch statement (lines 1307-1323) doesn't handle new kinds
  - No enrichment queue logic for occurrences created by systems
  - No era narrative hooks for catalyst-driven transitions

---

## Catalyst Model Integration Gaps

### 1. **New Entity Kinds Not Supported**

**Occurrences** (`kind: 'occurrence'`):
- Created by `occurrenceCreation` system
- Subtypes: war, magical_disaster, cultural_movement, economic_boom
- **Issue**: No enrichment analytics tracking
- **Issue**: No LLM prompt templates
- **Need**: Occurrence names and descriptions should reflect catalyzing events
  - "The Circle of Depths Purists-Circle of Depths War" needs narrative context
  - Should reference triggering factions, locations (epicenter), catalyzed actions

**Eras** (`kind: 'era'`):
- Pre-seeded in initial state, transitions via eraTransition system
- Subtypes: expansion, conflict, innovation, invasion, reconstruction
- **Issue**: Not enriched (names/descriptions are placeholders)
- **Issue**: Era transitions call `generateEraNarrative` but don't update era entity descriptions
- **Need**: Era descriptions should reflect world state at transition

### 2. **Catalyst Attribution Not Captured**

**catalyzedBy Field**:
- Relationships now have `catalyzedBy: string` field (agent ID)
- Enrichment service doesn't use this in prompts
- **Need**: Relationship backstories should credit catalyzing agents
  - "Through Frostbite Nova's diplomatic initiative, the Icebound Exchange allied with..."

**Catalyst Properties**:
- Entities have `catalyst.catalyzedEvents[]` tracking their impact
- Enrichment service doesn't use this for entity descriptions
- **Need**: High-influence agents should have descriptions reflecting their impact
  - NPC with 12 catalyzed events should be described as influential leader

### 3. **Action Domains Not Referenced**

**9 Action Domains** (in `src/domain/penguin/config/actionDomains.ts`):
- political, military, economic, magical, technological, environmental, cultural, conflict_escalation, disaster_spread
- **Issue**: Lore prompts don't know about these domains
- **Issue**: Entity descriptions don't reflect which domains they act in
- **Need**: NPC with `actionDomains: ['military', 'political']` should be described as military-political actor

### 4. **Temporal Entities Not Handled**

**Temporal Properties**:
- Entities have `temporal: { startTick, endTick }` for occurrences and eras
- **Issue**: Enrichment context doesn't include temporal relationships
- **Issue**: Prompts don't describe "when" events occurred
- **Need**: "The war that began at tick 45 during the Faction Wars era..."

---

## Domain/Framework Separation Violations

### Violation 1: Hardcoded Penguin Lore in Framework

**Location**: `src/services/loreIndex.ts` (framework location)
**Content**: Penguin colonies, ice magic, factions

**Problem**:
- If we wanted to generate dragon history or robot history, we'd have to fork EnrichmentService
- LoreIndex structure assumes penguin world structure (colonies, ice magic)

**Desired State**:
- Domain provides lore data via interface
- Framework enrichment service is domain-agnostic

### Violation 2: Penguin References in EnrichmentService Prompts

**Location**: `enrichmentService.ts` lines 126, 139
```typescript
`Use colony tone differences:`,
`Aurora Stack practical; Nightfall Shelf poetic; two-part names with earned names.`
```

**Problem**:
- Hard-codes penguin-specific rules
- Can't reuse service for other domains

**Desired State**:
- Domain provides prompt templates or lore context
- Service assembles prompts from domain-provided data

### Violation 3: Entity Kind Assumptions

**Location**: `worldEngine.ts` lines 1307-1323
**Content**: Switch statement assumes 5 entity kinds

**Problem**:
- Adding new entity kinds requires engine changes
- Not extensible for domains with different entity structures

**Desired State**:
- Domain schema defines which kinds need enrichment
- Engine iterates dynamically based on schema

---

## Proposed Abstraction Plan

### Phase 1: Domain Lore Interface (High Priority)

**Goal**: Move penguin lore from framework to domain, define interface.

#### Step 1.1: Create Domain Lore Provider Interface

**New File**: `src/types/domainLore.ts`
```typescript
/**
 * Framework-level interface for domain-specific lore.
 * Domains implement this to provide LLM enrichment context.
 */
export interface DomainLoreProvider {
  // Core world facts
  getWorldName(): string;
  getCanonFacts(): string[];
  getCulturalGroups(): Array<{
    name: string;
    values: string[];
    style: string;
  }>;

  // Naming and tone guidance
  getNamingRules(): {
    patterns: string[];
    toneGuidance: Record<string, string>;
  };

  // Domain-specific mechanics
  getTechnologyNotes(): string[];
  getMagicSystemNotes(): string[];
  getConflictPatterns(): string[];

  // Geography and setting
  getGeographyConstraints(): {
    scale: string;
    characteristics: string[];
  };

  // Enrichment templates (NEW)
  getEntityEnrichmentPrompt(kind: string, subtype: string): string | null;
  getRelationshipEnrichmentPrompt(kind: string): string | null;
  getOccurrenceEnrichmentPrompt(subtype: string): string | null;
  getEraEnrichmentPrompt(subtype: string): string | null;
}
```

#### Step 1.2: Implement Penguin Lore Provider

**New File**: `src/domain/penguin/config/loreProvider.ts`
```typescript
import { DomainLoreProvider } from '../../../types/domainLore';

export const penguinLoreProvider: DomainLoreProvider = {
  getWorldName: () => "Super Penguin Colonies of Aurora Berg",

  getCanonFacts: () => [
    'Two main colonies with trade and communication',
    'Ice magic exists but has costs',
    'Pre-penguin artifacts are in the berg',
    // ... existing canon from loreIndex
  ],

  getCulturalGroups: () => [
    {
      name: 'Aurora Stack',
      values: ['commerce', 'tradition'],
      style: 'practical, orderly terraces'
    },
    // ... existing colonies from loreIndex
  ],

  getEntityEnrichmentPrompt: (kind, subtype) => {
    if (kind === 'occurrence' && subtype === 'war') {
      return `This is a military conflict between penguin factions. Describe the war's strategic objectives, territorial stakes, and impact on ice colonies. Keep it grounded in ice warfare (fishing grounds, berg positions, frozen defenses).`;
    }
    if (kind === 'era') {
      return `This is a historical era for the penguin colonies. Describe the era's defining characteristics, major pressures, and what penguins will remember about this time.`;
    }
    // ... other prompts
    return null;
  },

  // ... other methods
};
```

#### Step 1.3: Update EnrichmentService to Use Provider

**Modify**: `src/services/enrichmentService.ts`
```typescript
export class EnrichmentService {
  private llm: LLMClient;
  private loreProvider: DomainLoreProvider;  // Changed from LoreIndex
  private validator: LoreValidator;

  constructor(
    llmConfig: LLMConfig,
    loreProvider: DomainLoreProvider,  // Interface instead of concrete type
    config?: Partial<EnrichmentConfig>
  ) {
    this.loreProvider = loreProvider;
    // ...
  }

  private buildLoreContext(): string {
    const worldName = this.loreProvider.getWorldName();
    const canon = this.loreProvider.getCanonFacts().join('; ');
    const culturalGroups = this.loreProvider.getCulturalGroups()
      .map(g => `${g.name}: ${g.style}`)
      .join(' | ');

    return `World: ${worldName} | Canon: ${canon} | Cultures: ${culturalGroups}`;
  }

  public async enrichEntities(entities, context) {
    // Remove hardcoded "Aurora Stack practical; Nightfall Shelf poetic"
    // Replace with:
    const toneGuidance = this.loreProvider.getNamingRules().toneGuidance;
    const toneInstructions = Object.entries(toneGuidance)
      .map(([group, tone]) => `${group}: ${tone}`)
      .join('; ');

    const prompt = [
      `You are enriching a history simulation.`,
      this.buildLoreContext(),
      `Tone guidance: ${toneInstructions}`,
      // ... rest of prompt
    ].join('\n');
  }
}
```

**Impact**:
- ✅ No penguin references in framework code
- ✅ Other domains can provide their own lore
- ✅ LoreIndex becomes internal to penguin domain

---

### Phase 2: Catalyst Model Enrichment (High Priority)

**Goal**: Enrich occurrences and eras, use catalyst attribution.

#### Step 2.1: Add Occurrence Enrichment Method

**Add to**: `src/services/enrichmentService.ts`
```typescript
public async enrichOccurrence(
  occurrence: HardState,
  context: EnrichmentContext
): Promise<LoreRecord | null> {
  if (!this.isEnabled()) return null;

  // Get catalyst-specific data
  const catalyzedBy = context.catalystInfo?.entityId || 'unknown forces';
  const catalystEntity = catalyzedBy !== 'unknown forces'
    ? context.graphSnapshot.entities.get(catalyzedBy)
    : null;

  // Get participants
  const participants = context.graphSnapshot.relationships
    .filter(r => r.kind === 'participant_in' && r.dst === occurrence.id)
    .map(r => context.graphSnapshot.entities.get(r.src)?.name)
    .filter(Boolean);

  // Get epicenter
  const epicenterRel = context.graphSnapshot.relationships
    .find(r => r.kind === 'epicenter_of' && r.src === occurrence.id);
  const epicenter = epicenterRel
    ? context.graphSnapshot.entities.get(epicenterRel.dst)?.name
    : null;

  // Get domain-specific prompt template
  const domainPromptHint = this.loreProvider.getOccurrenceEnrichmentPrompt(occurrence.subtype);

  const prompt = [
    `Create a lore-consistent name and description for an occurrence (${occurrence.subtype}).`,
    `Catalyst: ${catalystEntity?.name || catalyzedBy} triggered this event.`,
    `Participants: ${participants.join(', ')}`,
    epicenter ? `Epicenter: ${epicenter}` : '',
    `Current era: ${context.graphSnapshot.era} at tick ${context.graphSnapshot.tick}.`,
    domainPromptHint || '',
    `Stay within canon: ${this.loreProvider.getCanonFacts().join('; ')}.`,
    `IMPORTANT: Keep description under 100 words.`,
    `Return JSON: { "name": string, "description": string, "stakes": string }.`
  ].join('\n');

  // ... rest of implementation
}
```

#### Step 2.2: Add Era Enrichment Method

**Add to**: `src/services/enrichmentService.ts`
```typescript
public async enrichEra(
  era: HardState,
  context: EnrichmentContext
): Promise<LoreRecord | null> {
  if (!this.isEnabled()) return null;

  // Get era-specific data
  const pressures = Object.entries(context.graphSnapshot.pressures || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  // Get major occurrences during this era
  const eraOccurrences = Array.from(context.graphSnapshot.entities.values())
    .filter(e => e.kind === 'occurrence' &&
      context.graphSnapshot.relationships.some(r =>
        r.kind === 'active_during' && r.src === e.id && r.dst === era.id
      ))
    .map(e => e.name);

  // Get domain-specific prompt template
  const domainPromptHint = this.loreProvider.getEraEnrichmentPrompt(era.subtype);

  const prompt = [
    `Create a lore-consistent description for a historical era (${era.subtype}).`,
    `Era name: ${era.name}`,
    `Pressures: ${pressures}`,
    `Major occurrences: ${eraOccurrences.join(', ') || 'peaceful times'}`,
    domainPromptHint || '',
    `What defined this era? What will be remembered?`,
    `Return JSON: { "description": string, "definingEvents": string[], "legacy": string }.`
  ].join('\n');

  // ... rest of implementation
}
```

#### Step 2.3: Update Engine Integration

**Modify**: `src/engine/worldEngine.ts`
```typescript
// Add to enrichmentAnalytics (line 309)
private enrichmentAnalytics = {
  locationEnrichments: 0,
  factionEnrichments: 0,
  ruleEnrichments: 0,
  abilityEnrichments: 0,
  npcEnrichments: 0,
  occurrenceEnrichments: 0,  // NEW
  eraEnrichments: 0          // NEW
};

// Update queueEntityEnrichment to handle new kinds (line 1307)
private trackEnrichmentAnalytics(entity: HardState): void {
  switch (entity.kind) {
    case 'location':
      this.enrichmentAnalytics.locationEnrichments++;
      break;
    case 'faction':
      this.enrichmentAnalytics.factionEnrichments++;
      break;
    case 'rules':
      this.enrichmentAnalytics.ruleEnrichments++;
      break;
    case 'abilities':
      this.enrichmentAnalytics.abilityEnrichments++;
      break;
    case 'npc':
      this.enrichmentAnalytics.npcEnrichments++;
      break;
    case 'occurrence':  // NEW
      this.enrichmentAnalytics.occurrenceEnrichments++;
      break;
    case 'era':  // NEW
      this.enrichmentAnalytics.eraEnrichments++;
      break;
  }
}

// Add occurrence enrichment after occurrenceCreation system runs
private async runSimulationPhase() {
  // ... existing code

  // After occurrenceCreation system
  const newOccurrences = result.entitiesCreated
    ?.filter(id => {
      const e = this.graph.entities.get(id);
      return e?.kind === 'occurrence';
    })
    .map(id => this.graph.entities.get(id)!)
    .filter(Boolean);

  if (newOccurrences && newOccurrences.length > 0) {
    this.queueOccurrenceEnrichment(newOccurrences);
  }
}

private queueOccurrenceEnrichment(occurrences: HardState[]): void {
  if (!this.enrichmentService?.isEnabled()) return;

  occurrences.forEach(occurrence => {
    const context = this.buildEnrichmentContext();

    // Add catalyst information to context
    const triggeredByRel = this.graph.relationships.find(r =>
      r.kind === 'triggered_by' && r.src === occurrence.id
    );

    const enrichmentPromise = (async () => {
      const record = await this.enrichmentService!.enrichOccurrence(occurrence, {
        ...context,
        catalystInfo: triggeredByRel ? {
          entityId: triggeredByRel.dst,
          relationshipKind: 'triggered_by'
        } : undefined
      });
      if (record) this.graph.loreRecords.push(record);
    })();

    this.pendingEnrichments.push(enrichmentPromise.then(() => undefined));
  });
}
```

**Impact**:
- ✅ Occurrences get narrative descriptions
- ✅ Wars have contextual names beyond "Faction A - Faction B War"
- ✅ Eras describe world state
- ✅ Catalyst attribution captured in lore

---

### Phase 3: Catalyst-Aware Entity Descriptions (Medium Priority)

**Goal**: Entity descriptions reflect their catalyst properties.

#### Step 3.1: Add Catalyst Context to Prompts

**Modify**: `enrichEntities()` in `enrichmentService.ts`
```typescript
const promptEntities = batch.map(e => {
  // ... existing code

  // Add catalyst information
  const catalystInfo: any = {};
  if (e.catalyst) {
    catalystInfo.canAct = e.catalyst.canAct;
    catalystInfo.actionDomains = e.catalyst.actionDomains;
    catalystInfo.influence = e.catalyst.influence;
    catalystInfo.eventsTriggered = e.catalyst.catalyzedEvents?.length || 0;
  }

  return {
    id: e.id,
    kind: e.kind,
    subtype: e.subtype,
    prominence: e.prominence,
    relationships: relationships,
    catalyst: catalystInfo,  // NEW
    placeholders: {
      name: e.name,
      description: e.description
    }
  };
});

const prompt = [
  // ... existing prompt lines
  `CATALYST AWARENESS: Some entities have agency and trigger events.`,
  `If entity.catalyst.eventsTriggered > 5, describe them as influential/impactful.`,
  `If entity.catalyst.actionDomains includes "military", mention military capability.`,
  `If entity.catalyst.actionDomains includes "magical", mention mystical power.`,
  `Use catalyst.influence to determine tone (high influence = respected/feared).`,
  // ... rest of prompt
].join('\n');
```

#### Step 3.2: Add Action Domain Lore Context

**Modify**: `penguinLoreProvider` (from Phase 1.2)
```typescript
getActionDomainDescriptions: () => ({
  political: 'governance, alliances, territorial claims',
  military: 'warfare, raids, defense',
  economic: 'trade, resource control, blockades',
  magical: 'ice magic, mystical manipulation',
  technological: 'innovation, tool development',
  environmental: 'natural forces, ice drift',
  cultural: 'ideology, conversion, inspiration',
  conflict_escalation: 'war intensification, faction recruitment',
  disaster_spread: 'catastrophe expansion, corruption'
})
```

**Impact**:
- ✅ High-influence NPCs described as powerful leaders
- ✅ Factions with military domain described as martial organizations
- ✅ Entities reflect their role in world dynamics

---

### Phase 4: Relationship Backstories with Catalyst Attribution (Low Priority)

**Goal**: Relationship enrichment credits catalyzing agents.

#### Step 4.1: Update enrichRelationships Method

**Modify**: `enrichRelationships()` in `enrichmentService.ts`
```typescript
public async enrichRelationships(
  relationships: Relationship[],
  actors: Record<string, HardState>,
  context: EnrichmentContext
): Promise<LoreRecord[]> {
  // ... existing code

  for (const rel of relationships) {
    // ... existing code

    // NEW: Get catalyst information
    const catalystId = rel.catalyzedBy;
    const catalyst = catalystId ? context.graphSnapshot.entities.get(catalystId) : null;
    const catalystDesc = catalyst
      ? `through the actions of ${catalyst.name}`
      : 'through circumstance';

    const prompt = [
      `Generate a brief backstory for relationship ${rel.kind}.`,
      `Actor 1: ${actor1.name} (${actor1.description})`,
      `Actor 2: ${actor2.name} (${actor2.description})`,
      `Catalyst: This relationship formed ${catalystDesc}.`,  // NEW
      `Recent history: ${(context.relatedHistory || []).join('; ')}`,
      // ... rest of prompt
    ].join('\n');

    // ... rest of implementation
  }
}
```

**Impact**:
- ✅ Relationship backstories credit the agents who created them
- ✅ More coherent narrative: "When Frostbite Nova brokered the alliance..."

---

## Implementation Priority

### Must Do Before LLM Enrichment (High Priority)
1. **Phase 1**: Domain Lore Interface
   - Prevents penguin references in framework code
   - Required for domain extensibility

2. **Phase 2**: Catalyst Model Enrichment
   - Occurrences and eras need enrichment or they'll have placeholder names
   - Analytics will break without occurrence/era tracking

### Nice to Have (Medium Priority)
3. **Phase 3**: Catalyst-Aware Entity Descriptions
   - Improves narrative quality
   - Not strictly required for system to function

### Optional Enhancement (Low Priority)
4. **Phase 4**: Catalyst Attribution in Relationships
   - Minor narrative improvement
   - Existing relationship enrichment works without it

---

## Effort Estimates

| Phase | Files Modified | New Files | Estimated LOC | Risk Level |
|-------|---------------|-----------|---------------|------------|
| Phase 1 | 3 | 2 | ~400 | Medium (API changes) |
| Phase 2 | 2 | 0 | ~250 | Low (additive) |
| Phase 3 | 1 | 0 | ~80 | Low (additive) |
| Phase 4 | 1 | 0 | ~30 | Very Low (additive) |

**Total Effort**: ~760 lines, 4 hours of careful implementation.

---

## Testing Strategy

After implementation:

1. **Dry Run (LLM disabled)**:
   - Verify enrichment analytics tracks all 7 entity kinds
   - Verify no TypeScript errors
   - Verify domain lore provider loads correctly

2. **Partial Mode Test (LLM_ENABLED=partial)**:
   - Generate 1 occurrence, verify enrichment is queued
   - Generate 1 era transition, verify enrichment is queued
   - Check that prompts don't contain "Aurora Stack" or "Nightfall Shelf"

3. **Full Mode Test (LLM_ENABLED=full)**:
   - Run complete generation
   - Verify occurrence names are narrative (not "Faction A-Faction B War")
   - Verify era descriptions reflect world state
   - Verify entity descriptions mention action domains for high-influence agents

---

## Backward Compatibility

**Phases 1-2 are breaking changes**:
- LoreIndex moved from framework to domain
- EnrichmentService constructor changes (takes DomainLoreProvider instead of LoreIndex)
- main.ts must be updated to instantiate penguinLoreProvider

**Migration Path**:
1. Create penguinLoreProvider in domain
2. Update main.ts to use provider
3. Move loreIndex.ts to domain
4. Update imports

**No impact on**:
- Existing saved worlds (JSON format unchanged)
- Template/system definitions
- Non-LLM code paths

---

## Alternative: Minimal Patch Approach

If full abstraction is too much work right now, a **minimal patch** could:

1. Add occurrence/era to analytics tracking (10 lines)
2. Add occurrence enrichment to queueEntityEnrichment (30 lines)
3. Add penguin-specific occurrence prompts to enrichmentService (50 lines)

**Pros**: Quick fix, system works
**Cons**: Doesn't solve domain separation, accumulates technical debt

---

## Recommendation

**Do Phase 1 + Phase 2** before running LLM enrichment with catalyst model.

**Rationale**:
- Phase 1 is inevitable - we'll need domain abstraction eventually
- Phase 2 is required - occurrences will have bad names without it
- Combined effort is ~4 hours for clean, maintainable solution
- Alternative is adding technical debt we'll have to fix later

**Defer Phase 3 + 4** until after first successful LLM run with new model.

**Rationale**:
- Nice to have, not required
- Can be added incrementally
- Better to validate core integration first
