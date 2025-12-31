# Narrative Loop Fixes Implementation Plan

## Overview

This document tracks the implementation of narrative loop fixes for the default project.
Focus: Post-generation simulation loops with clear cause-and-effect.

## Design Constraints

- Modify existing components rather than creating new ones
- Use workarounds instead of framework modifications
- Reuse existing tags (especially narrative-only → system tags)
- No new entity kinds or subtypes

---

## Phase 1: Highest Impact, Lowest Risk

### 1.1 Artifact Effects - Armed Heroes
**Status:** COMPLETED

**Goal:** Heroes need weapons to hunt orcas effectively.

**Changes:**
- [x] Add system `armed_hero_detector` - tags heroes who own weapons as `armed`
- [x] Add system `unarmed_hero_detector` - removes `armed` tag when weapon lost
- [x] Modify `wound_orca` - require `armed` tag on actor
- [x] Modify `maim_orca` - require `armed` tag on actor
- [x] Modify `kill_orca` - require `armed` tag on actor
- [x] Add action `seek_artifact` - unarmed heroes seek weapons

**Tags Used:** `armed` (new system tag)

---

### 1.2 War Goals - Contested Locations
**Status:** COMPLETED

**Goal:** Wars are fought over territory. Winners gain control.

**Changes:**
- [x] Modify `war_outbreak` generator - add `$contested_location` variable, create `epicenter_of` relationship, set `contested` tag
- [x] Modify `sue_for_peace` action - transfer `controls` relationship to victor, remove `contested` tag
- [x] Add action `claim_victory` - alternative war end where stronger faction wins

**Tags Used:** `contested` (narrative → system)

---

### 1.3 Corruption Effects - Harm and Cleansing
**Status:** COMPLETED

**Goal:** Corruption harms residents and requires active cleansing.

**Changes:**
- [x] Add system `corruption_harm` - NPCs in corrupted locations get `corrupted` tag, then die
- [x] Add action `cleanse_corruption` - heroes can purify corrupted locations
- [x] Modify `hero_emergence` generator - also triggers when corruption is widespread

**Tags Used:** `corrupted` (contagion → harm trigger), `cleansed` (new)

---

## Phase 2: Medium Complexity

### 2.1 Alliance Obligations - Defense Pacts
**Status:** COMPLETED

**Goal:** When ally is attacked, other allies join the war.

**Changes:**
- [x] Add system `alliance_defense_call` - allies of attacked faction join war
- [x] Add system `oath_breaker_detector` - marks factions that fail to honor alliances
- [x] Add system `oath_breaker_consequences` - factions that don't honor alliances lose prominence

**Tags Used:** `honor_bound`, `oath_breaker` (new)

---

### 2.2 War Goals - Raid Damage
**Status:** COMPLETED

**Goal:** Raids weaken enemy control of territory.

**Changes:**
- [x] Modify `raid` action - reduce `controls` relationship strength (-0.2 delta)
- [x] Add system `control_collapse` - weak control leads to loss of territory

**Tags Used:** `contested` (reused from 1.2)

---

## Phase 3: Higher Complexity

### 3.1 Belief Consequences - Ideological Conflict
**Status:** COMPLETED

**Goal:** Factions with different beliefs are more likely to fight.

**Changes:**
- [x] Add system `devout_believer_detector` - set `devout` tag on believing factions
- [x] Modify `convert_faction` action - set `apostate` tag when changing beliefs
- [x] Add system `heresy_war_trigger` - devout factions attack apostates

**Tags Used:** `devout`, `apostate` (new)

---

### 3.2 Corruption Attracts Threats
**Status:** COMPLETED

**Goal:** Corruption draws orcas and spawns outlaws.

**Changes:**
- [x] Modify `orca_raider_arrival` generator - prefer corrupted locations (3x weight)
- [x] Add system `corruption_crisis` - severely corrupted locations trigger crisis

**Tags Used:** `corrupted`, `crisis` (existing)

---

## Implementation Progress

| Fix | Component | Status |
|-----|-----------|--------|
| 1.1 | armed_hero_detector | COMPLETED |
| 1.1 | unarmed_hero_detector | COMPLETED |
| 1.1 | wound_orca modification | COMPLETED |
| 1.1 | maim_orca modification | COMPLETED |
| 1.1 | kill_orca modification | COMPLETED |
| 1.1 | seek_artifact action | COMPLETED |
| 1.2 | war_outbreak modification | COMPLETED |
| 1.2 | sue_for_peace modification | COMPLETED |
| 1.2 | claim_victory action | COMPLETED |
| 1.3 | corruption_harm system | COMPLETED |
| 1.3 | cleanse_corruption action | COMPLETED |
| 1.3 | hero_emergence modification | COMPLETED |
| 2.1 | alliance_defense_call system | COMPLETED |
| 2.1 | oath_breaker_detector system | COMPLETED |
| 2.1 | oath_breaker_consequences system | COMPLETED |
| 2.2 | raid modification | COMPLETED |
| 2.2 | control_collapse system | COMPLETED |
| 3.1 | devout_believer_detector system | COMPLETED |
| 3.1 | convert_faction modification | COMPLETED |
| 3.1 | heresy_war_trigger system | COMPLETED |
| 3.2 | orca_raider_arrival modification | COMPLETED |
| 3.2 | corruption_crisis system | COMPLETED |

---

## Completed Loops After Implementation

Each loop will have: NEED → PROGRESSION → REWARD → LOOP

1. **Hero/Orca/Weapon:** Need weapon → Hunt orca → Get weapon → Hunt more
2. **War Lifecycle:** Contest territory → Fight → Win/Lose → Control changes
3. **Artifact Lifecycle:** Need power → Seek artifact → Gain empowerment → Become legendary
4. **Ideology Spread:** Believe → Convert others → Conflict with heretics → Dominance
5. **Alliance Networks:** Form pact → Ally attacked → Honor/Break oath → Reputation
6. **Magic/Corruption:** Corruption spreads → Harm residents → Hero cleanses → Stability
