# Template and Relationship Kind Redesign

**Status**: Design phase - Part of framework/domain refactor
**Date**: 2025-11-23
**Problem**: NPC-focus is baked into architecture at THREE levels

## The Three-Layer Problem

### Layer 1: Templates Create Too Many NPCs

**Current state** (173 total entities):
- NPCs: 96 (55.5%) ← MORE THAN HALF!
  - Outlaws: 39 (23% of all entities!)
  - Merchants: 24
  - Heroes: 16
  - Mayors: 10
  - Orcas: 7
- World entities: 77 (44.5%)
  - Abilities: 23
  - Factions: 20
  - Rules: 19
  - Locations: 15

**Ratio**: 1.25 NPCs per world entity (target: 0.25-0.4)

### Layer 2: Relationship Kinds Are NPC-Focused

**Current relationships** (1,118 total):
- **NPC Social Drama** (LOW game value): 337 (30%)
  - lover_of: 219 instances (20% of all relationships!)
  - follower_of: 108 instances (10%)
  - mentor_of: 10 instances
- **NPC Conflicts**: 430 (38%)
  - enemy_of: 377 (many NPC ↔ NPC, not faction-level)
  - rival_of: 53
- **NPC Affiliations** (KEEP these): 203 (18%)
  - resident_of: 89
  - member_of: 68
  - practitioner_of: 27
  - leader_of: 19

**World-level relationships**: Only 148 (13%)!
- Geographic facts: 29 (adjacent_to, contains)
- Historical facts: 20 (originated_in, discoverer_of)
- Supernatural: 16 (manifests_at, slumbers_beneath)
- **MISSING**: Faction ↔ Location, Faction ↔ Ability, Location ↔ Ability dynamics

### Layer 3: Systems Operate on NPC Relationships

See `WORLD_LEVEL_SYSTEMS_DESIGN.md` - most systems create/modify NPC relationships.

## Root Cause Analysis

**Why does the system create 96 NPCs?**

Looking at NPC subtypes:
1. **Outlaws (39)**: Created by `outlawRecruitment` template
   - Problem: Creates individual criminals instead of expanding criminal factions
   - Each criminal faction recruits 2-4 outlaws per application
   - No game value: Players don't care about individual thugs

2. **Merchants (24)**: Created by economy/trade templates
   - Problem: Individual merchants less interesting than merchant factions/guilds
   - Should be: Factions control trade routes, not individual NPCs

3. **Heroes (16)**: Created by `heroEmergence` template
   - Medium value: Heroes can be quest-relevant
   - But: 16 is too many - need 3-5 legendary figures, not a hero army

4. **Mayors (10)**: Created by colony templates
   - Medium value: Represent governance
   - But: Could be represented by faction control relationships

5. **Families**: Created by `familyExpansion` and `kinshipConstellation`
   - Problem: Creates family trees with zero game relevance
   - Pure NPC bloat

## Proposed Solution

### Templates to REMOVE

**1. familyExpansion**
- Creates: 1-3 children per family
- Why remove: Family trees have no game relevance
- Impact: Eliminates ~30-40 NPC entities

**2. kinshipConstellation**
- Creates: 3-6 family members with relationship network
- Why remove: Pure NPC social network generation
- Impact: Eliminates ~20-30 NPC entities

**3. outlawRecruitment**
- Creates: 2-4 outlaws per criminal faction
- Why remove: Individual criminals uninteresting
- Replace with: Faction expansion (criminal faction grows power/territory)
- Impact: Eliminates ~40 NPC entities

**4. mysteriousVanishing**
- Creates: Disappearance events involving NPCs
- Why remove: Too niche, creates event bloat
- Impact: Eliminates ~5-10 NPC entities

**Total NPC reduction**: ~100 NPCs → ~25 NPCs (75% reduction!)

### Templates to THROTTLE

**1. heroEmergence**
- Current: Creates heroes frequently
- Change: Only 3-5 heroes total across entire world
- Why: Heroes should be LEGENDARY, not common
- Parameters: Reduce frequency by 90%, require very high prominence threshold

**2. successionCrisis**
- Current: Creates NPC claimants to leadership
- Change: Only for major faction leaders, affects faction structure
- Replace with: `faction_leadership_crisis` that modifies faction relationships, not NPC count

### Templates to ADD (World-Level)

**Faction Expansion & Dynamics**:

**1. territorial_expansion**
- Creates: `controls` relationships (Faction ↔ Location)
- Trigger: Faction prominence high, adjacent location weak/unclaimed
- Impact: Power struggles over territory
- Example: "The Midnight Claws expand control to Krill Shoals"

**2. faction_merger**
- Creates: New faction entity, transfers relationships
- Trigger: Two allied factions under external threat
- Impact: Political consolidation
- Example: "East Perch Merchants merge with Aurora Traders"

**3. faction_collapse**
- Removes: Faction entity (status: 'dissolved')
- Creates: Power vacuum, contested control relationships
- Trigger: Low prominence + high conflict
- Impact: Creates crisis events
- Example: "Covenant of the Fissure collapses, territories contested"

**4. criminal_expansion**
- Creates: Faction grows power (NOT individual outlaws)
- Creates: `infiltrates`, `controls` relationships
- Replace: outlawRecruitment template
- Example: "The Midnight Claws infiltrate Aurora Stack governance"

**Magical/Tech Dynamics**:

**5. magical_site_discovery**
- Creates: New location entity with magical properties
- Creates: `manifests_at`, `discovered_at` relationships
- Trigger: Magical instability pressure high
- Example: "Shadow rift discovered beneath South Roost"

**6. technological_breakthrough**
- Creates: New ability entity (tech/magic)
- Creates: `developed_by` relationship (Faction ↔ Ability)
- Trigger: Innovation era + faction with high researcher count
- Example: "Aurora Scientists develop ice-shaping technology"

**7. magical_corruption_event**
- Creates: `corrupted_by` relationships (Location ↔ Ability)
- Modifies: Location status, prominence
- Trigger: Magical instability + manifests_at relationship
- Example: "The Glow-Fissure corrupts Nightfall Shelf"

**8. tech_monopoly_formation**
- Creates: `monopolizes` relationship (Faction ↔ Ability)
- Trigger: Faction controls majority of practitioner_of for an ability
- Impact: Power imbalance, conflict driver
- Example: "The Icebound Exchange monopolizes ice magic trade"

**Location Dynamics**:

**9. trade_route_establishment**
- Creates: `trade_routes` relationships (Location ↔ Location)
- Trigger: Adjacent locations, economic era
- Impact: Economic network formation
- Example: "Aurora Stack establishes trade route with East Perch"

**10. location_rivalry**
- Creates: `rival_of` relationships (Location ↔ Location)
- Trigger: Locations controlled by enemy factions
- Impact: Territorial conflicts
- Example: "Aurora Stack rivals East Perch for fishing territory"

**11. location_disaster**
- Modifies: Location status (threatened, corrupted, ruined)
- Creates: `scarred_by`, `refugee_flows_to` relationships
- Trigger: Magical instability, conflict pressure
- Example: "South Roost destroyed, refugees flee to Aurora Berg"

**Cultural/Political**:

**12. religious_schism**
- Creates: New rules entities (competing ideologies)
- Creates: `rival_of` (Rules ↔ Rules), faction splits
- Trigger: Cultural tension, conflicting beliefs
- Example: "Ice worship splits into orthodox and reformist traditions"

**13. magical_school_founding**
- Creates: Faction entity (magical institution)
- Creates: `studies`, `teaches` relationships with abilities
- Trigger: Innovation era, prominent ability
- Example: "Academy of the Depths founded to study shadow magic"

## Relationship Kinds to REMOVE

**Low/No Game Value**:

1. **lover_of** (219 instances, 20% of relationships!)
   - Why: Pure NPC drama
   - Impact: Eliminates largest relationship bloat

2. **follower_of** (108 instances, 10%)
   - Why: Redundant with member_of + prominence
   - Replace: Use member_of + NPC prominence to infer followers

3. **mentor_of** (10 instances)
   - Why: Niche NPC relationship
   - Replace: Use practitioner_of + prominence (masters teach apprentices)

**Total reduction**: ~337 relationships (30% of all relationships!)

## Relationship Kinds to ADD

**Faction ↔ Location** (Political/Territorial):
- `controls` - Governance authority
- `contests` - Attempting to seize control
- `sieges` - Active military conflict
- `trades_from` - Economic hub
- `refuges_in` - Displaced population
- `blockades` - Economic warfare

**Faction ↔ Ability** (Power/Technology):
- `weaponizes` - Military application
- `monopolizes` - Exclusive control
- `bans` - Prohibition/restriction
- `researches` - Active development
- `lost_knowledge_of` - Forgotten tech/magic

**Location ↔ Ability** (Environmental):
- `corrupted_by` - Environmental damage
- `blessed_by` - Environmental enhancement
- `scarred_by` - Permanent damage (historical)
- `amplifies` - Location boosts ability
- `nullifies` - Location suppresses ability
- `discovered_at` - Origin story

**Location ↔ Location** (Geographic/Political):
- `rival_of` - Competition for resources/influence
- `allied_with` - Cooperation pact
- `trade_routes` - Economic connection
- `refugee_flows_to` - Crisis migration
- `threatens` - Territorial expansion pressure

**Faction ↔ Faction** (Political/Economic):
- `trades_with` - Economic relationship
- `subsidizes` - Economic support
- `tributary_of` - Vassal relationship
- `contests_with` - Active competition

**Ability ↔ Ability** (Magical/Tech):
- `counters` - Opposing forces
- `amplifies` - Synergistic combination
- `corrupts` - Warps/transforms
- `derived_from` - Evolution/combination

**Total new kinds**: 30 world-level relationship kinds

## Expected Outcome

### Entity Distribution (Before → After)

```
Before:
  NPCs: 96 (55.5%)
  Locations: 15 (8.7%)
  Factions: 20 (11.6%)
  Abilities: 23 (13.3%)
  Rules: 19 (11.0%)
  Total: 173

After:
  NPCs: ~25 (20%)
    - Faction leaders: 15
    - Heroes/bosses: 5
    - Quest-critical: 5
  Locations: ~35 (28%)
    - Colonies: 8
    - Dungeons: 10
    - POIs: 12
    - Anomalies: 5
  Factions: ~20 (16%)
    - Political: 6
    - Economic: 5
    - Religious: 4
    - Criminal: 3
    - Cultural: 2
  Abilities: ~30 (24%)
    - Magic schools: 15
    - Technologies: 10
    - Special powers: 5
  Rules: ~15 (12%)
    - Laws: 6
    - Traditions: 5
    - Taboos: 4
  Total: ~125

NPC ratio: 1.25 → 0.25 (80% reduction!)
```

### Relationship Distribution (Before → After)

```
Before:
  NPC social drama: 337 (30%)
  NPC conflicts: 430 (38%)
  NPC affiliations: 203 (18%)
  World-level: 148 (13%)
  Total: 1,118

After:
  NPC affiliations: ~200 (20%)
    - member_of, leader_of, resident_of, practitioner_of
  World-level: ~800 (80%)
    - Faction ↔ Location: 250
    - Faction ↔ Ability: 150
    - Location ↔ Ability: 150
    - Location ↔ Location: 100
    - Faction ↔ Faction: 75
    - Ability ↔ Ability: 50
    - Historical/geographic: 25
  Total: ~1,000

World-level ratio: 13% → 80% (6x increase!)
```

## Implementation Strategy

### Phase 1: Remove NPC Bloat (Quick Win)

1. **Disable NPC templates**:
   ```typescript
   // In eras configuration
   templateWeights: {
     familyExpansion: 0,        // Disable
     kinshipConstellation: 0,   // Disable
     outlawRecruitment: 0,      // Disable
     mysteriousVanishing: 0,    // Disable
     heroEmergence: 0.1,        // Reduce by 90%
   }
   ```

2. **Remove NPC relationship kinds**:
   ```typescript
   // Mark as deprecated in systems
   const DEPRECATED_KINDS = ['lover_of', 'follower_of', 'mentor_of'];
   // Systems skip these
   ```

3. **Test**: Run world-gen, verify NPC count drops to ~25-30

### Phase 2: Add World-Level Templates (Post-Refactor)

1. Implement 3-5 high-priority templates:
   - `territorial_expansion`
   - `magical_corruption_event`
   - `tech_monopoly_formation`
   - `trade_route_establishment`
   - `faction_collapse`

2. Add corresponding relationship kinds to schema

3. Test: Run world-gen, verify world-level relationship ratio increases

### Phase 3: Add World-Level Systems

See `WORLD_LEVEL_SYSTEMS_DESIGN.md`

## Game Lore Quality Comparison

### Before (Current Output):

```
Sample relationships:
  - "Rukan lover_of Nyla" (who cares?)
  - "Frost follower_of Drift" (irrelevant)
  - "Wave mentor_of Tide" (no game impact)
  - "Quick enemy_of Silent" (personal drama)

Lore focus: NPC social networks, romance, family drama
Game utility: Low - players ignore most NPCs
```

### After (Proposed Output):

```
Sample relationships:
  - "The Midnight Claws control Nightfall Shelf" (power structure)
  - "Aurora Stack rival_of East Perch" (territorial conflict)
  - "The Glow-Fissure corrupts Nightfall Shelf" (environmental danger)
  - "The Icebound Exchange monopolizes ice magic" (economic power)
  - "Aurora Stack → East Perch trade route" (economic network)
  - "Shadow magic discovered_at The Glow-Fissure" (origin story)

Lore focus: Faction wars, magical corruption, territorial conflicts, power struggles
Game utility: High - every relationship is quest/gameplay relevant
```

## Key Metrics

**Entity Quality** (game-relevant entities):
- Before: 77/173 (44.5%)
- After: 100/125 (80%)
- Improvement: +35.5 percentage points

**Relationship Quality** (game-relevant relationships):
- Before: 148/1,118 (13%)
- After: 800/1,000 (80%)
- Improvement: +67 percentage points

**Lore Density** (game-relevant facts per entity):
- Before: 148 facts / 173 entities = 0.86 facts/entity
- After: 800 facts / 125 entities = 6.4 facts/entity
- Improvement: 7.4x increase in lore density

## Dependencies

This redesign requires:
1. Framework/domain refactor (decouple template/system logic)
2. Relationship category system (immutable, political, economic, etc.)
3. World-level systems implementation (see WORLD_LEVEL_SYSTEMS_DESIGN.md)
4. Schema updates (new relationship kinds, entity subtypes)

## References

- Analysis script: `scripts/analyze-template-output.ts`
- Analysis script: `scripts/analyze-relationship-kinds.ts`
- World-level systems design: `WORLD_LEVEL_SYSTEMS_DESIGN.md`
- Current status: `CURRENT_STATUS.md`
