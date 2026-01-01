# Prominence Loop Fixes

## High-Level Loops That Solve Multiple Issues

### Loop Fix A: "Reflected Glory" System (NEW)

**Concept:** Entities connected to high-prominence entities should gradually gain prominence themselves.

**Narrative Justification:**
- A sword wielded by a legendary hero becomes legendary itself
- A colony controlled by a mythic faction becomes renowned
- An NPC serving in a famous company gains notoriety

**Implementation:** New `connectionEvolution` system that:
- Metric: `connected_prominence` (average prominence of connected entities)
- Rule: If connected to entities with avg prominence ≥ 3.5, gain +0.15
- Selection: All entity kinds

**Problems Solved:**
- Artifacts owned by mythic NPCs/factions gain prominence
- NPCs in mythic factions gain prominence
- Creates upward mobility for entities that lack their own actions
- Provides incoming "prestige flow" to counter the outgoing connection bias

**Estimated Impact:** High - creates entirely new prominence source for passive entities

---

### Loop Fix B: "Involvement = Notoriety" (targetProminenceDelta)

**Concept:** Being the target of significant actions grants prominence, regardless of outcome.

**Narrative Justification:**
- An artifact famous enough to be stolen becomes more famous from the theft
- An NPC attacked by enemies gains respect for surviving (or infamy for being targeted)
- Being the subject of action = being part of the story = fame

**Implementation:** Add `targetProminenceDelta` to existing actions:

| Action | Target Kind | Proposed targetProminenceDelta |
|--------|-------------|-------------------------------|
| claim_artifact | artifact | +0.2 / 0 |
| steal_artifact | artifact | +0.3 / 0 |
| seek_artifact | artifact | +0.15 / 0 |
| seek_cleansing | artifact | +0.15 / 0 |
| wound_orca | npc | +0.1 / 0 (surviving combat) |
| maim_orca | npc | +0.15 / 0 |
| kill_orca | npc | +0.2 / 0 (dying gloriously) |
| declare_war | faction | +0.2 / 0 (important enough to fight) |

**Problems Solved:**
- Artifacts gain prominence from being involved in actions
- NPCs gain prominence from combat (even if they lose)
- Creates positive feedback for "interesting" entities

**Estimated Impact:** Medium-High - directly addresses the "0 target prominence" gap

---

### Loop Fix C: "Deed Echoes to Tools" (Artifact-Action Coupling)

**Concept:** When an NPC performs a major deed, artifacts they wield share in the glory.

**Narrative Justification:**
- Excalibur became legendary through Arthur's deeds
- The One Ring's fame came from the events around it
- Artifacts are conduits for heroic (or villainous) actions

**Implementation Options:**

**Option 1: Mutation in existing actions**
Add to NPC actions like `kill_orca`, `cleanse_corruption`:
```json
{
  "type": "for_each_related",
  "relationship": "owns",
  "direction": "src",
  "targetKind": "artifact",
  "actions": [
    { "type": "adjust_prominence", "entity": "$related", "delta": 0.25 }
  ]
}
```

**Option 2: New "deed_echoes" thresholdTrigger system**
- Conditions: NPC gained prominence this tick (tag: `prominence_gained`)
- Variables: Find artifacts owned by this NPC
- Action: Boost artifact prominence proportional to NPC's gain

**Problems Solved:**
- Artifacts benefit from their wielder's actions
- Creates artifact-NPC symbiosis
- Most impactful artifacts become famous through use

**Estimated Impact:** Medium - requires artifacts to have owners who act

---

## Recommended Priority Order

### Phase 1: Quick Wins (JSON-only changes)
1. **Loop Fix B** - Add `targetProminenceDelta` to existing actions
   - Immediate effect, no new systems needed
   - Directly addresses the "targets gain nothing" problem

### Phase 2: New System (requires connectionEvolution config)
2. **Loop Fix A** - "Reflected Glory" system
   - Creates sustained upward pressure for connected entities
   - Addresses structural connection bias

### Phase 3: Enhanced Coupling
3. **Loop Fix C** - Artifact-action coupling
   - More complex, may require system changes
   - Could start with adding mutations to high-impact NPC actions

---

## Secondary Fixes (Lower Priority)

### Fix D: Adjust NPC Action Success Rates
**Problem:** `seek_artifact` and `cleanse_corruption` show 0% success rate in data.
**Investigation Needed:** Are these actions firing but failing, or not firing at all?
**Possible Fix:** Increase `baseSuccessChance` or reduce penalty pressure modifiers.

### Fix E: Create "Wielded By" Relationship
**Problem:** Artifacts are only connected via `owned_by` which is outgoing.
**Fix:** Add bidirectional `wielded_by` relationship or change `owns` to be bidirectional for prominence counting.

### Fix F: Adjust prominence_evolution Thresholds for Artifacts
**Problem:** Artifacts have 3-5 connections, threshold is ≥5 to gain.
**Fix:** Lower threshold for artifacts to ≥2, or create artifact-specific prominence_evolution variant.
