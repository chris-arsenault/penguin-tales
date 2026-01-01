# Prominence Distribution Analysis

Analysis of simulation run: `run-dec-31-5-40-pm-200-entities.canonry-slot.json`

## Summary Metrics

| Kind | Mythic (4+) | Max Prom | Avg Conns | Actions as Actor | Actions as Target |
|------|-------------|----------|-----------|------------------|-------------------|
| Abilities | 18 | 4.90 | 11.5 | spread_innovation, manifest_magic | - |
| Faction | 3 | 4.60 | 18.3 | 11 different actions | 4 actions |
| Location | 6 | 4.50 | 5.0 | spread_corruption | seize_control, establish_trade |
| NPC | **0** | 3.90 | 6.6 | 6 actions | No +prominence as target |
| Artifact | **0** | 3.15 | 3.7 | 3 actions (rare) | No +prominence as target |

## Prominence Distribution by Kind

```
ARTIFACT:   12 forgotten, 18 marginal, 12 recognized, 12 renowned, 0 mythic
NPC:        30 forgotten, 45 marginal, 54 recognized, 39 renowned, 0 mythic
FACTION:     0 forgotten, 12 marginal, 15 recognized, 30 renowned, 3 mythic
LOCATION:    3 forgotten, 30 marginal, 15 recognized, 42 renowned, 6 mythic
ABILITIES:   0 forgotten,  6 marginal, 30 recognized, 24 renowned, 18 mythic
```

## Root Cause Analysis

### 1. Artifacts: Structurally Passive

**Connection Problem:**
- Artifacts have **only outgoing relationships** (stored_at, owned_by, created_during)
- **Nothing points TO artifacts** - 66 relationships as src, **0 as dst**
- `prominence_evolution` requires ≥5 connections to gain prominence
- Most artifacts have 3-5 connections → barely eligible or ineligible

**Action Problem:**
- Artifacts are **targets** in 5 actions (claim, steal, seek, seek_cleansing, gift)
- **None of these give the artifact prominence** - only the actor gains/loses
- Artifacts as **actors** in only 2 actions (weapon_chooses_wielder, instrument_blesses_listener)
- These artifact-actor actions appear to be **very rare** (didn't appear in narrative events)

**Result:** Artifacts only change via `prominence_evolution`, which is a slow drift based on connections they don't have.

### 2. NPCs: Asymmetric Risk/Reward

**Action outcomes are skewed negative:**
```
seek_artifact:      22 losses,  0 gains  (100% failure!)
master_ability:     29 losses, 20 gains  (59% failure)
cleanse_corruption: 14 losses,  0 gains  (100% failure!)
```

**Targets never gain prominence:**
- `wound_orca`, `maim_orca`, `kill_orca` - the ACTOR gains, the defeated NPC gets nothing
- `war_marks_survivor` gives target +0.25 (only positive target action for NPCs)
- `colony_elevates_resident` gives +0.2 (location→npc)
- `weapon_chooses_wielder` gives +0.6 (artifact→npc, but artifacts rarely act)

**Connection structure:**
- NPCs have 242 outgoing relationships (member_of, resident_of, practitioner_of)
- Only 51 incoming relationships
- They "belong to" things, but few things "point to" them

### 3. Why Abilities & Factions Succeed

**Abilities:**
- `spread_innovation`: 38 gains, 46 losses → slight net negative BUT high frequency (84 total events)
- `manifest_magic`: 18 gains, 24 losses
- High connection count (many practitioners point TO them)
- `practitioner_of (npc→abilities)`: 55 relationships → abilities are DESTINATIONS

**Factions:**
- 11 different actions where factions are actors
- High-value actions: `seize_control` (+0.40), `declare_war` (+0.40), `claim_victory` (+0.60)
- 241 outgoing + 155 incoming = most connected entity type
- Actions involving factions have **better success rates**

## Feedback Loops Identified

### Positive Loops (working well):
1. **Faction territorial expansion**: seize_control → more connections → more prominence_evolution gains → higher success at future actions
2. **Ability propagation**: spread_innovation → more practitioners → more incoming connections → prominence_evolution boost

### Negative Loops (causing problems):
1. **Artifact isolation**: Artifacts don't act → no prominence gains → drift downward → become "forgotten" → even less likely to be involved in stories
2. **NPC failure spiral**: NPC tries action → fails → loses prominence → has less "narrative weight" → less likely to be selected for important actions

### Missing Loops:
1. **No artifact glory**: When an artifact is used in a legendary deed, the artifact gains nothing
2. **No NPC target recognition**: When an NPC is attacked/targeted, they gain no prominence (even surviving or being involved in drama)
3. **No artifact-NPC symbiosis**: An NPC wielding a famous artifact doesn't elevate the artifact; an artifact owned by a mythic NPC doesn't become more famous

## Key Insight

The current system rewards **entities that DO things** (actors) and **entities that are CONNECTED TO** (prominence_evolution).

Artifacts are passive by nature and are pointed FROM, not TO.
NPCs take risks and often fail, with no compensation for being targets.

## Data Sources

### Prominence Changes by Kind (from narrative events)
```
KIND            GAINS   LOSSES    NET
abilities         140       91    +49
artifact           32       42    -10
faction           189      157    +32
location          190      137    +53
npc               226      173    +53
occurrence         11       39    -28
rules              99        0    +99
```

### Top Sources of Prominence Changes
```
spread_corruption:       6 gains,  99 losses  (locations losing)
spread_innovation:      38 gains,  46 losses
ice_memory_witness:     72 gains,   0 losses  (pure positive)
master_ability:         20 gains,  29 losses
seize_control:          21 gains,  28 losses
prominence_evolution:  ~800 gains, ~400 losses (estimated from event count)
```

### Relationship Distribution
```
KIND            AS SRC    AS DST     TOTAL
abilities          126       167       293
artifact            66         0        66  <- PROBLEM: never a destination
era                  4       230       234
faction            241       155       396
location            97       222       319
npc                242        51       293  <- Low incoming
occurrence          56        21        77
rules               68        54       122
```
