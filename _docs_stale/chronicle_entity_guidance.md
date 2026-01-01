# Chronicle Entity Guidance: Analysis and Proposal

## Problem Statement

Per-entity prompt templates contain rich guidance for writing about NPCs, locations, factions, etc. However, chronicles involve multiple entity types and can only access world-level context. This means chronicle generation lacks guidance on:
- How to voice NPCs when they appear as characters
- How to describe locations when they're settings
- How artifacts, events, eras should be referenced

## Current Structure Analysis

### What's Duplicated Across Templates (Should Be World-Level)

| Element | Where It Appears | Notes |
|---------|------------------|-------|
| **BITTER CAMARADERIE** | NPC, location, faction, occurrence, era | Core concept is world-level; each has slight entity-variant |
| **SYNTACTIC POETRY** | All templates | Almost identical every time |
| **Avoid lists** | Several templates | Entity-specific AI tells, but could be consolidated |

### What's Truly Entity-Specific (Belongs in Per-Entity Templates)

| Template | Entity-Specific Content |
|----------|------------------------|
| **NPC** | Reveal personality through objects/habits/scars; how others react to them |
| **Location** | "Stand here" sensory framing; what HAPPENED here; who controls vs built |
| **Faction** | Founding wound; internal tensions; what they've DONE |
| **Occurrence** | What was LOST/BROKEN/CHANGED; visceral details |
| **Era** | What the era cost; central unresolved tension |
| **Artifact** | Physical detail that tells a story; what it DID; cost of wielding |

## Detailed Template Breakdown

### NPC Template

**Entity-specific (belongs here):**
- "Focus on what makes them distinctive as a person"
- "Reveal personality through concrete details: What they carry, wear, or refuse to touch"
- Physical tics, scars, habits
- How others react to them
- Subtype role shapes worldview, prominence affects how others see them

**Potentially world-level (could be elevated):**
- CHARACTER VOICE section - applies to ALL character writing
- BITTER CAMARADERIE section - specifically for NPCs but core concept is world-level
- SYNTACTIC POETRY section - world-level style

### Location Template

**Entity-specific:**
- "Evoke what it's like to STAND here"
- Sensory anchoring
- Show what HAPPENED here
- Who controls vs who built

**Potentially world-level:**
- BITTER CAMARADERIE section (location-specific variant)
- SYNTACTIC POETRY section
- Avoid list for location-specific AI tells

### Faction Template

**Entity-specific:**
- Focus on what holds them together/tears apart
- Founding wound
- Internal tensions
- What they've DONE vs what they believe

**Potentially world-level:**
- BITTER CAMARADERIE section (faction-specific variant)
- SYNTACTIC POETRY section
- Avoid list

### Occurrence Template

**Entity-specific:**
- Event-specific framing
- What was LOST/BROKEN/CHANGED

**Potentially world-level:**
- EVENT VOICE (somewhat entity-specific but principles apply broadly)
- BITTER CAMARADERIE section
- SYNTACTIC POETRY section

### Era Template

**Entity-specific:**
- Era-specific framing
- What the era cost
- Central unresolved tension

**Potentially world-level:**
- ERA VOICE
- BITTER CAMARADERIE
- SYNTACTIC POETRY

### Artifact Template

**Entity-specific:**
- Physical detail that tells a story
- What the artifact DID
- Cost of wielding

**Potentially world-level:**
- Avoid list for artifact AI tells

## Proposed Solution

### 1. Create `entityVoices` Section at World Level

Concise guidance for how to write about each entity type when it appears in ANY context (chronicles, relationships, cross-entity references):

```json
"entityVoices": {
  "npc": "Characters reveal themselves through what they carry, avoid, and refuse to touch. Show how others react to them - fear, respect, pity. Include one unglamorous detail.",
  "location": "Anchor in one specific sensory detail first. Show what HAPPENED here - scars, stains, repairs. Layer who controls it NOW vs who BUILT it.",
  "faction": "Reference the founding wound. Show internal tensions and what they've DONE, not what they believe. Outsiders view them with fear, contempt, or grudging respect.",
  "occurrence": "Focus on what was LOST or BROKEN. Name the cost. Capture one visceral detail. Don't explain significance.",
  "era": "Defined by what it cost, not achieved. Name the unresolved tension. Golden ages have rot; dark ages have stubborn hope.",
  "artifact": "Start with a physical detail that tells a story. What did it DO that made it famous? Include the cost of wielding it."
}
```

### 2. Consolidate Common Elements

Move these to world-level `tone` (mostly already done):
- BITTER CAMARADERIE core principles
- SYNTACTIC POETRY
- Consolidated avoid lists into main AVOID AI TELLS section

### 3. Streamline Per-Entity Templates

Keep per-entity templates focused on:
- Entity-specific framing and focus areas
- Entity-specific avoid lists (if any remain)
- Reference world tone for style principles

### 4. Chronicle Prompt Injection

Chronicle generation would inject:
- World tone (already has)
- `entityVoices` for each entity type appearing in the chronicle
- Culture descriptive identities for cultures involved
- Culture visual identities if relevant

## Benefits

1. **Chronicles get entity guidance** without verbose full templates
2. **Single source of truth** for style principles (world tone)
3. **Per-entity templates stay focused** on what's truly entity-specific
4. **Easier maintenance** - update style once, applies everywhere

## Implementation Steps

1. Add `entityVoices` section to `illuminatorConfig.json` under `worldContext`
2. Update chronicle prompt builder to inject relevant entity voices based on entities in the chronicle
3. Optionally: Trim per-entity templates to remove duplicated BITTER CAMARADERIE/SYNTACTIC POETRY sections (they inherit from world tone)

## Open Questions

- Should `entityVoices` be even more concise (1 sentence each)?
- Should chronicles get ALL entity voices or only those for entity types present?
- Do we need culture-specific entity voice variants? (e.g., how to write an Aurora Stack NPC vs Nightshelf NPC)
