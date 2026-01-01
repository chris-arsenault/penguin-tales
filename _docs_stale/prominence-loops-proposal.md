# Prominence Loops for Underutilized Entity Types

This document outlines two narrative loops designed to increase event volume for artifacts, rules, and occurrences without inflating faction/NPC events.

## Problem Summary

Current event distribution is severely imbalanced:
- Factions: median 34 events, max 75 (overutilized)
- NPCs: median 15 events (overutilized)
- Artifacts: median 2 events, max 7 (underutilized)
- Rules: median 2 events, max 2 (underutilized)
- Occurrences: median 2 events, max 15 (underutilized)

## Design Principles

From staticPages.json "Narrative Design Loops":
- Setting as protagonist, not NPCs
- Artifacts/rules/occurrences should have AGENCY
- "The setting acts. NPCs are marked by their connection to significant things."

These loops follow that philosophy by making underutilized entity types the actors.

---

## Loop 1: The Cultural Memory Cycle

**Theme:** The ice remembers. Events mark objects. Objects spawn traditions. Traditions mark future events.

```
OCCURRENCE (active war/disaster/celebration)
    │
    ↓ "Occurrence Marks Artifact"
    │   - Actor: occurrence (prominent, active)
    │   - Target: artifact (in affected area or owned by participant)
    │   - Result: creates "witnessed" relationship, artifact gains prominence
    │   - Narrative: "The Siege of Frost Harbor left its memory upon the Ice-Song Harp"
    │
ARTIFACT (now historically significant)
    │
    ↓ "Artifact Embodies Rule"
    │   - Actor: artifact (prominent, has "witnessed" relationship)
    │   - Target: rules (custom/tradition of matching culture)
    │   - Result: creates "embodies" relationship, rule gains prominence
    │   - Narrative: "The Ice-Song Harp became the sacred vessel of the Thaw-Song tradition"
    │
RULES (tradition/custom, now prominent)
    │
    ↓ "Custom Consecrates Artifact"
    │   - Actor: rules (custom, prominent)
    │   - Target: artifact (of matching culture, not yet consecrated)
    │   - Result: creates "consecrated_by" relationship, artifact gains prominence
    │   - Narrative: "The rite of Ancestor-Calling now requires the Hollow Bone Flute"
    │
    └──→ Loop continues as consecrated artifacts attract more occurrences
```

### Actions for Cultural Memory Cycle

1. **occurrence_marks_artifact**
   - Actor: occurrence (war, disaster, celebration) - active, prominent
   - Target: artifact - filters for artifacts stored_at locations connected to occurrence participants
   - Outcome: creates "witnessed" relationship, both gain prominence

2. **artifact_embodies_rule**
   - Actor: artifact - has "witnessed" relationship, prominent
   - Target: rules (custom, tradition) - matching culture
   - Outcome: creates "embodies" relationship, rule gains prominence

3. **custom_consecrates_artifact** (already proposed, confirmed good)
   - Actor: rules (custom)
   - Target: artifact - matching culture
   - Outcome: creates "consecrated_by" relationship, artifact gains prominence

---

## Loop 2: The Forbidden Knowledge Cycle

**Theme:** Taboos corrupt relics. Cursed relics cause disasters. Disasters spawn new prohibitions.

**Interaction with existing systems:** Hooks into corruption contagion - corrupted artifacts can spread corruption to adjacent locations via existing `spread_corruption` action.

```
RULES (taboo/forbidden_knowledge, prominent)
    │
    ↓ "Taboo Corrupts Relic"
    │   - Actor: rules (ideology with "forbidden" or "dark" tags)
    │   - Target: artifact (near believers of that ideology)
    │   - Result: artifact gains "cursed" tag, creates "corrupted_by" relationship
    │   - Narrative: "The whispered secrets of the Void-Speakers seeped into the Extinction Node"
    │
ARTIFACT (now cursed)
    │
    ↓ "Cursed Relic Triggers Catastrophe"
    │   - Actor: artifact (has "cursed" tag)
    │   - Target: occurrence (disaster subtype) - creates or intensifies
    │   - Result: creates "caused_by" relationship, occurrence gains prominence
    │   - Narrative: "The Extinction Node's awakening triggered the Collapse of the Lower Galleries"
    │   - Side effect: artifact can now spread corruption via existing spread_corruption system
    │
OCCURRENCE (disaster, prominent)
    │
    ↓ "Disaster Spawns Prohibition"
    │   - Actor: occurrence (disaster, historical or fading)
    │   - Target: rules - creates new taboo OR strengthens existing law
    │   - Result: creates "inspired_by" relationship, rule gains prominence
    │   - Narrative: "After the Collapse, the Unspoken decreed the Deep Galleries forever sealed"
    │
    └──→ Loop continues as new prohibitions can corrupt new artifacts
```

### Actions for Forbidden Knowledge Cycle

1. **taboo_corrupts_relic**
   - Actor: rules (ideology, with forbidden/dark/mystical tags)
   - Target: artifact - graph path to believers of that ideology
   - Outcome: artifact gains "cursed" tag, creates "corrupted_by" relationship

2. **cursed_relic_triggers_catastrophe**
   - Actor: artifact (has "cursed" tag)
   - Target: occurrence (disaster subtype, active or creates new one)
   - Outcome: creates "caused_by" relationship, occurrence gains prominence
   - Note: May need to handle occurrence creation vs. intensification

3. **disaster_spawns_prohibition**
   - Actor: occurrence (disaster, historical status preferred)
   - Target: rules (law/taboo of affected culture)
   - Outcome: creates "inspired_by" relationship, rule gains prominence

---

## Implementation Priority

1. **Phase 1: Cultural Memory Cycle**
   - Lower risk, purely additive
   - Fits cleanly with ice-memory theme
   - Three new actions, no system changes

2. **Phase 2: Forbidden Knowledge Cycle**
   - Higher narrative payoff
   - Hooks into existing corruption mechanics
   - May need occurrence creation logic

---

## Expected Impact

Each loop creates ~3 additional event opportunities per entity type per cycle:
- Artifacts: +2 events/cycle (as actor and target)
- Rules: +2 events/cycle (as actor and target)
- Occurrences: +2 events/cycle (as actor and target)

With multiple instances of each loop running, this should significantly improve distribution without touching faction/NPC counts.

---

## Existing Actions to Invert (Lower Priority)

These inversions help because underutilized entities become targets, receiving failure-based prominence bumps:

| Current | Inverted |
|---------|----------|
| claim_artifact (faction→artifact) | artifact_selects_custodian (artifact→faction) |
| convert_faction (faction→faction, rules instigator) | ideology_conquers (rules→faction) |

Note: These still target factions, so lower priority than pure artifact/rules/occurrence loops.
