# NPC Dynamics Systems

**Status**: Design phase - Part of framework/domain refactor
**Date**: 2025-11-23
**Principle**: NPCs retain agency and dynamism AFTER creation, but actions must have world impact

## Core Question

Once we create 25 named NPCs as catalysts for world events, what keeps them dynamic?

**Bad answer**: NPC social drama (lover_of, friend_of, mentor_of)
**Good answer**: NPCs continue to affect the world, prominence evolves based on success/failure

## Design Principles

1. **Every NPC action must have world impact**
   - NOT: "Rukan befriends Nyla" (who cares?)
   - YES: "Rukan seizes control of Krill Shoals" (world changes!)

2. **Prominence is earned through catalyzed events**
   - Success → prominence increases
   - Failure → prominence can ALSO increase (infamy)
   - Inaction → prominence decays (forgotten)

3. **Conflicts only matter if they affect the world**
   - NOT: Personal rivalries for drama
   - YES: Rivalries that escalate to faction conflicts, assassinations, power struggles

4. **Lifecycle creates opportunities**
   - Death → succession crisis → power vacuum
   - Retirement → new leaders emerge
   - Ascension to legend → becomes immutable historical figure

5. **Relationships determine available actions**
   - leader_of Faction → can seize territory, broker alliances
   - practitioner_of Ability → can corrupt locations, monopolize tech
   - High prominence → unlock more impactful actions

## Systems to KEEP/MODIFY

### 1. NPC Agency & Actions System (NEW)

**Purpose**: NPCs continue to attempt world-affecting actions after creation

```typescript
const npc_agency_system: SimulationSystem = {
  id: 'npc_agency',
  name: 'NPC Actions & World Impact',

  metadata: {
    parameters: {
      actionAttemptRate: {
        value: 0.3,
        comment: 'Chance per tick that prominent NPCs attempt actions'
      },
      prominenceThreshold: {
        value: 'recognized',
        comment: 'Minimum prominence to attempt major actions'
      }
    }
  },

  apply: (graph: Graph) => {
    const activeNPCs = findEntities(graph, {
      kind: 'npc',
      status: 'alive',
      prominence: ['recognized', 'renowned', 'mythic']
    });

    activeNPCs.forEach(npc => {
      // 1. Check if NPC attempts action this tick
      if (Math.random() > actionAttemptRate) return;

      // 2. Find available actions based on NPC properties
      const availableActions = determineActions(npc, graph);

      // 3. Select action probabilistically (prominence-weighted)
      const action = selectAction(availableActions, npc.prominence);

      // 4. Attempt action (can succeed or fail)
      const outcome = attemptAction(npc, action, graph);

      // 5. Update world based on outcome
      if (outcome.success) {
        // Create world relationships
        outcome.relationships.forEach(rel => {
          rel.catalyzedBy = npc.id;
          graph.relationships.push(rel);
        });

        // Optionally increase prominence on success
        if (shouldIncreaseProminence(npc, outcome)) {
          npc.prominence = increaseProminence(npc.prominence);
        }

        // Record catalyzed event
        npc.agency.catalystFor.push({
          relationshipId: outcome.relationshipId,
          action: outcome.description,
          tick: graph.tick
        });
      } else {
        // Failed action - infamy can increase
        npc.tags.push(outcome.failureTag);  // e.g., 'failed_conqueror'
      }
    });

    return { /* results */ };
  }
};
```

**Example Actions NPCs Can Attempt**:

**Political Actions** (requires leader_of or high prominence):
- `seize_control`: Attempt to take control of location
- `spark_conflict`: Create faction rivalry
- `broker_alliance`: Create faction alliance
- `assassinate_leader`: Remove rival leader
- `defect`: Betray faction, join another

**Magical Actions** (requires practitioner_of):
- `corrupt_location`: Unleash magical corruption
- `protect_location`: Shield from magical threats
- `monopolize_ability`: Control access to magic/tech
- `discover_ability`: Find new magical technique

**Economic Actions** (requires relevant faction membership):
- `establish_trade`: Create trade routes
- `blockade`: Disrupt economic flow
- `monopolize_resource`: Control location resources

**Example Outcomes**:

```typescript
// SUCCESS: Cutthroat Dave expands Midnight Claws territory
{
  success: true,
  relationships: [
    {kind: 'controls', src: midnight_claws, dst: krill_shoals}
  ],
  description: 'seized control of Krill Shoals',
  history: 'Cutthroat Dave expanded The Midnight Claws\' criminal empire to Krill Shoals'
}

// FAILURE: Sage Bungus fails containment again
{
  success: false,
  failureTag: 'repeated_failure',
  description: 'failed to contain The Glow-Fissure again',
  history: 'Sage Bungus\' second attempt to contain The Glow-Fissure ended in disaster'
}
```

### 2. NPC Prominence Evolution (MODIFY EXISTING)

**Purpose**: NPC prominence rises/falls based on their world impact

Keep the existing `prominence_evolution` system but modify logic for NPCs:

```typescript
const prominence_evolution_npc: SimulationSystem = {
  apply: (graph: Graph) => {
    const npcs = findEntities(graph, { kind: 'npc', status: 'alive' });

    npcs.forEach(npc => {
      // Calculate prominence based on:
      // 1. Number of world events catalyzed
      const catalyzedCount = npc.agency?.catalystFor?.length || 0;

      // 2. Relationships to prominent entities
      const importantConnections = npc.links.filter(l =>
        l.kind === 'leader_of' ||
        l.kind === 'founded_by' ||
        (l.kind === 'practitioner_of' && graph.entities.get(l.dst)?.prominence >= 'renowned')
      );

      // 3. Recent activity (catalyzed event in last 20 ticks?)
      const recentActivity = npc.agency?.catalystFor?.some(c =>
        graph.tick - c.tick < 20
      );

      // Calculate target prominence
      let targetProminence = npc.prominence;

      if (catalyzedCount >= 5) {
        targetProminence = 'mythic';  // Legendary figure
      } else if (catalyzedCount >= 3) {
        targetProminence = 'renowned';
      } else if (catalyzedCount >= 1) {
        targetProminence = 'recognized';
      } else if (!recentActivity) {
        targetProminence = 'marginal';  // Waning influence
      }

      // Gradually shift towards target
      if (targetProminence !== npc.prominence) {
        // Prominence changes slowly (not instant)
        if (shouldChangeProminence(npc, targetProminence)) {
          npc.prominence = targetProminence;
        }
      }
    });

    return { /* results */ };
  }
};
```

**Key Dynamics**:
- Cutthroat Dave seizes 3 territories → mythic (legendary crime lord)
- Sage Bungus fails repeatedly → marginal (discredited sage)
- Penguin Bill starts war → mythic (infamous warmonger)
- Inactive NPC with no recent catalyzed events → marginal (forgotten)

### 3. NPC Conflict Escalation (MODIFY EXISTING)

**Purpose**: NPC rivalries can escalate to world-level conflicts

Modify `conflict_contagion` to check for high-prominence NPC conflicts:

```typescript
const npc_conflict_escalation: SimulationSystem = {
  id: 'npc_conflict_escalation',

  apply: (graph: Graph) => {
    // Find high-prominence NPC conflicts
    const npcConflicts = graph.relationships.filter(rel =>
      (rel.kind === 'enemy_of' || rel.kind === 'rival_of') &&
      graph.entities.get(rel.src)?.kind === 'npc' &&
      graph.entities.get(rel.dst)?.kind === 'npc'
    );

    npcConflicts.forEach(conflict => {
      const srcNPC = graph.entities.get(conflict.src);
      const dstNPC = graph.entities.get(conflict.dst);

      // Check if both are prominent
      if (srcNPC.prominence < 'recognized' || dstNPC.prominence < 'recognized') {
        return;  // Low-prominence NPCs don't escalate to world conflicts
      }

      // Check if they're in different factions
      const srcFaction = getRelated(graph, srcNPC.id, 'member_of', 'src')[0];
      const dstFaction = getRelated(graph, dstNPC.id, 'member_of', 'src')[0];

      if (!srcFaction || !dstFaction || srcFaction.id === dstFaction.id) {
        return;  // Same faction or no faction = no escalation
      }

      // Escalate to faction-level conflict
      const escalationChance = 0.1 * (prominence_to_number[srcNPC.prominence] + prominence_to_number[dstNPC.prominence]);

      if (Math.random() < escalationChance) {
        // Create faction rivalry
        graph.relationships.push({
          kind: 'rival_of',
          src: srcFaction.id,
          dst: dstFaction.id,
          strength: 0.6,
          catalyzedBy: [srcNPC.id, dstNPC.id],
          origin: 'personal_conflict_escalation',
          createdAt: graph.tick
        });

        graph.history.push({
          tick: graph.tick,
          type: 'conflict_escalation',
          description: `The rivalry between ${srcNPC.name} and ${dstNPC.name} escalated into conflict between ${srcFaction.name} and ${dstFaction.name}`,
          protagonists: [srcNPC.id, dstNPC.id],
          factions: [srcFaction.id, dstFaction.id],
          tags: ['escalation', 'war_origins']
        });

        // Both NPCs become historically significant
        srcNPC.prominence = increaseProminence(srcNPC.prominence);
        dstNPC.prominence = increaseProminence(dstNPC.prominence);
      }
    });

    return { /* results */ };
  }
};
```

**Key Point**: Personal conflicts only matter if:
1. Both NPCs are prominent (recognized+)
2. They belong to different factions
3. Conflict can escalate to faction-level

Otherwise, ignore low-level NPC drama.

### 4. NPC Lifecycle System (NEW)

**Purpose**: NPCs die, retire, ascend to legend - creating change

```typescript
const npc_lifecycle: SimulationSystem = {
  id: 'npc_lifecycle',

  metadata: {
    parameters: {
      deathChance: {
        value: 0.01,
        comment: 'Base chance per tick that NPC dies (modified by conflict)'
      },
      retirementAge: {
        value: 100,
        comment: 'Ticks after creation before retirement considered'
      },
      ascensionThreshold: {
        value: 5,
        comment: 'Number of catalyzed events needed for legendary ascension'
      }
    }
  },

  apply: (graph: Graph) => {
    const npcs = findEntities(graph, { kind: 'npc', status: 'alive' });

    npcs.forEach(npc => {
      const age = graph.tick - npc.createdAt;
      const conflicts = getRelated(graph, npc.id, 'enemy_of', 'src').length;
      const catalyzedCount = npc.agency?.catalystFor?.length || 0;

      // 1. DEATH (natural or conflict)
      const deathRisk = deathChance * (1 + conflicts * 0.5);  // More conflicts = higher risk

      if (Math.random() < deathRisk) {
        npc.status = 'dead';

        // Death creates consequences
        if (npc.links.some(l => l.kind === 'leader_of')) {
          // Leader death → succession crisis
          triggerTemplate(graph, 'succession_crisis', { deceased: npc.id });
        }

        graph.history.push({
          tick: graph.tick,
          type: 'npc_death',
          description: `${npc.name} has died`,
          protagonists: [npc.id],
          tags: conflicts > 0 ? ['violent_death'] : ['natural_death']
        });

        return;
      }

      // 2. RETIREMENT (old age, low influence)
      if (age > retirementAge && npc.agency.influence < 0.3) {
        npc.status = 'retired';
        npc.prominence = 'marginal';

        // Remove leadership roles
        npc.links = npc.links.filter(l => l.kind !== 'leader_of');

        graph.history.push({
          tick: graph.tick,
          type: 'npc_retirement',
          description: `${npc.name} has retired from public life`,
          protagonists: [npc.id]
        });

        return;
      }

      // 3. ASCENSION TO LEGEND (mythic status achieved)
      if (npc.prominence === 'mythic' && catalyzedCount >= ascensionThreshold) {
        npc.status = 'legendary';

        // Legendary NPCs become immutable (can't die, prominence locked)
        // But also stop taking actions (historical figures)

        graph.history.push({
          tick: graph.tick,
          type: 'legendary_ascension',
          description: `${npc.name} has become a legendary figure, their deeds immortalized in history`,
          protagonists: [npc.id],
          tags: ['legend', 'immortalized']
        });

        // Create commemorative rule or location
        triggerTemplate(graph, 'legend_crystallization', { legend: npc.id });

        return;
      }
    });

    return { /* results */ };
  }
};
```

**Lifecycle States**:
- `alive`: Active, can take actions, prominence can change
- `dead`: Removed from active pool, creates succession/power vacuum
- `retired`: Marginal prominence, removed from leadership
- `legendary`: Mythic status locked, becomes historical anchor (like locations/factions)

**Example Cascades**:

```typescript
// Cutthroat Dave dies in gang war
npc_lifecycle detects death
→ Dave status = 'dead'
→ Triggers succession_crisis template
→ Creates 2 NPC claimants to Midnight Claws leadership
→ Claimants have rival_of relationship
→ Can escalate to faction split

// Sage Bungus retires in disgrace
npc_lifecycle detects retirement (age + low influence)
→ Bungus status = 'retired'
→ Removes practitioner_of relationships (or weakens them)
→ No longer attempts magical actions
→ Becomes quest hook: "Help Bungus redeem himself"

// Penguin Bill ascends to legend
npc_lifecycle detects ascension (mythic + 5 catalyzed events)
→ Bill status = 'legendary'
→ legend_crystallization creates rule: "Bill's Law" (commemorates him)
→ Bill becomes immutable historical figure
→ Can still be referenced, but no longer takes actions
```

### 5. NPC Succession System (MODIFY EXISTING)

**Purpose**: When leaders die/retire, new leaders emerge

Modify `succession_vacuum` to create meaningful succession:

```typescript
const npc_succession: SimulationSystem = {
  id: 'npc_succession',

  apply: (graph: Graph) => {
    // Find factions that lost leaders (death/retirement)
    const leaderlessFactionsThisTick = findLeaderlessFactionsThisTick(graph);

    leaderlessFactionsThisTick.forEach(faction => {
      const deceased = faction.formerLeader;

      // Find potential successors (members of faction)
      const members = getRelated(graph, faction.id, 'member_of', 'dst')
        .filter(npc => npc.status === 'alive' && npc.prominence >= 'recognized');

      if (members.length === 0) {
        // No suitable successors → faction weakens or collapses
        faction.prominence = decreaseProminence(faction.prominence);
        return;
      }

      if (members.length === 1) {
        // Peaceful succession
        const successor = members[0];
        createRelationship(graph, {
          kind: 'leader_of',
          src: successor.id,
          dst: faction.id,
          catalyzedBy: deceased.id,  // Succession attributed to former leader
          note: 'peaceful_succession'
        });

        graph.history.push({
          description: `${successor.name} assumes leadership of ${faction.name} after ${deceased.name}'s death`,
          protagonists: [successor.id, deceased.id],
          factions: [faction.id]
        });
      } else {
        // SUCCESSION CRISIS: Multiple claimants
        // Create rival_of relationships between claimants
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            createRelationship(graph, {
              kind: 'rival_of',
              src: members[i].id,
              dst: members[j].id,
              strength: 0.7,
              origin: 'succession_dispute'
            });
          }
        }

        graph.history.push({
          description: `Power struggle erupts in ${faction.name} after ${deceased.name}'s death`,
          protagonists: members.map(m => m.id),
          factions: [faction.id],
          tags: ['succession_crisis']
        });

        // Can escalate to faction split if crisis not resolved
      }
    });

    return { /* results */ };
  }
};
```

**Key Dynamics**:
- Leader dies → peaceful succession if 1 candidate
- Leader dies → rivalry/crisis if multiple candidates
- Unresolved crisis → faction can split
- No successors → faction weakens/collapses

## Systems to REMOVE

### ❌ 1. relationship_formation (NPC social drama)

**Current**: Creates friend_of, lover_of, mentor_of, follower_of

**Why remove**: Pure NPC-to-NPC relationships with no world impact

**What replaces it**: Nothing! NPCs don't need social networks. They need world impact.

**Exception**: Keep NPC enemy_of/rival_of IF it can escalate to faction conflicts

### ❌ 2. familyExpansion, kinshipConstellation

**Already covered in template removal**

### ❌ 3. mysteriousVanishing

**Already covered in template removal**

## Systems to ADD

### ✅ 1. npc_agency (NEW)

NPCs attempt actions that affect the world

### ✅ 2. npc_conflict_escalation (NEW)

High-prominence NPC conflicts escalate to faction/location conflicts

### ✅ 3. npc_lifecycle (NEW)

Death, retirement, ascension to legend

### ✅ 4. npc_succession (MODIFY EXISTING)

Succession when leaders die/retire

## NPC Relationship Summary

**KEEP**:
- `member_of`: Determines political agency
- `leader_of`: Enables territorial/political actions
- `resident_of`: Determines location-affecting actions
- `practitioner_of`: Enables magical/tech actions
- `enemy_of`: Can escalate to faction conflicts (if prominent)
- `rival_of`: Can escalate to faction conflicts (if prominent)

**REMOVE**:
- `lover_of`: No world impact
- `friend_of`: No world impact
- `follower_of`: Redundant with prominence
- `mentor_of`: Redundant with practitioner_of hierarchy

**ADD**:
- `catalyzed_by`: World relationship → NPC (attribution)
- `succeeded_by`: NPC → NPC (leadership succession)
- `rival_claimant_of`: NPC → NPC (succession crisis)

## Expected NPC Dynamics

### Example: Cutthroat Dave's Career

**Tick 45**: Created as part of territorial_expansion
```
Status: alive
Prominence: recognized
Agency: {influence: 0.5, domains: ['political']}
Catalyzed: ['seized control of Nightfall Shelf']
```

**Tick 67**: Successful expansion to Krill Shoals
```
Status: alive
Prominence: renowned (increased due to multiple catalyzed events)
Agency: {influence: 0.7}
Catalyzed: ['seized Nightfall Shelf', 'seized Krill Shoals']
```

**Tick 89**: Failed assassination attempt on rival
```
Status: alive
Prominence: renowned (unchanged, but gained 'ruthless' tag)
Agency: {influence: 0.65} (slight decrease from failure)
Tags: ['ruthless', 'ambitious']
```

**Tick 102**: Escalates conflict with Penguin Bill
```
NPC enemy_of escalates to faction enemy_of
Aurora Stack enemy_of Midnight Claws
Both Dave and Bill → prominence: mythic
Catalyzed: [..., 'sparked war with Aurora Stack']
```

**Tick 134**: Dies in gang violence
```
Status: dead
Triggers succession_crisis
Creates 2 rival claimants to Midnight Claws
Power vacuum in Nightfall Shelf
Dave's legacy: 4 catalyzed events, mythic prominence
```

**Tick 145**: Ascends to legend posthumously
```
Status: legendary
legend_crystallization creates "Dave's Law" (rule commemorating him)
Becomes immutable historical figure
Quest hook: "Learn the secret of Cutthroat Dave's rise to power"
```

### Example: Sage Bungus's Tragedy

**Tick 23**: Created as part of magical_corruption_event
```
Status: alive
Prominence: recognized
Catalyzed: ['failed to contain The Glow-Fissure']
Tags: ['tragic', 'blamed']
```

**Tick 45**: Attempts redemption (protect_location action)
```
Action: protect_location (Nightfall Shelf from further corruption)
Outcome: FAILURE
Prominence: marginal (decreased)
Agency: {influence: 0.2}
Tags: ['tragic', 'blamed', 'repeated_failure']
```

**Tick 78**: Retires in disgrace
```
Status: retired
Prominence: marginal
No longer attempts actions
Quest hook: "Help Sage Bungus redeem his failure"
```

**Tick 156**: Player helps Bungus in quest
```
(Outside simulation scope, but Bungus is quest-relevant)
```

## Key Metrics

**NPC Count**: ~25 total
- ~15 leaders (leader_of factions)
- ~5 heroes/bosses (mythic prominence)
- ~3 practitioners (practitioner_of rare abilities)
- ~2 legendary (ascended to immortality)

**NPC Activity**:
- ~30% attempt actions each tick (based on prominence)
- ~20% success rate (creates world impact)
- ~5% die/retire each epoch (lifecycle churn)
- ~1-2% ascend to legend

**Prominence Distribution**:
- Marginal: 20% (inactive, waning influence)
- Recognized: 40% (minor figures)
- Renowned: 30% (major figures)
- Mythic: 10% (legendary)

**World Impact**:
- Each active NPC catalyzes ~0.5 world events per epoch
- ~25 NPCs × 0.5 = ~12 NPC-driven world events per epoch
- Complements ~30 template-driven world events
- Total: ~42 world events per epoch (good variety)

## Implementation Priority

**Phase 1** (Quick wins):
1. Remove relationship_formation system (eliminates NPC social drama)
2. Modify prominence_evolution for NPCs (add influence/catalyzed tracking)
3. Add lifecycle death/retirement (creates churn)

**Phase 2** (Post-refactor):
4. Implement npc_agency system (NPCs take actions)
5. Implement npc_conflict_escalation (personal → world conflicts)
6. Implement full lifecycle (ascension to legend)

**Phase 3** (Polish):
7. Fine-tune action success rates
8. Balance prominence evolution
9. Create rich history event descriptions

## Summary

**NPCs retain dynamism through**:
1. ✅ **Agency**: Continue attempting world-affecting actions
2. ✅ **Prominence Evolution**: Rise/fall based on success/failure
3. ✅ **Meaningful Conflicts**: Rivalries that escalate to faction wars
4. ✅ **Lifecycle**: Death, retirement, ascension create change
5. ✅ **Succession**: New leaders emerge when old ones fall

**But WITHOUT**:
- ❌ Social drama (lover_of, friend_of)
- ❌ Family trees (familyExpansion)
- ❌ Random NPC bloat (outlawRecruitment)

**Result**: 25 legendary NPCs who drive world change, not 96 random characters in soap operas.
