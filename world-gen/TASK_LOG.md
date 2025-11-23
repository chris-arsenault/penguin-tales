# Catalyst Model Refactor - Task Log

**Started**: 2025-11-23
**Status**: Phase 1 & 2 Complete, Phase 3 In Progress
**Last Updated**: 2025-11-23

## Phase 1: Framework Core (Catalyst Interface)

### Type System
- [x] Add `CatalystProperties` interface to `src/types/worldTypes.ts`
- [x] Add optional `catalyst` field to `HardState`
- [x] Add optional `catalyzedBy` field to `Relationship`
- [x] Add optional `category` field to `Relationship`
- [x] Add `EntityKind` types for 'era' and 'occurrence'

### Catalyst Helpers
- [x] Create `src/utils/catalystHelpers.ts`
- [x] Implement `getAgentsByCategory(graph, category)`
- [x] Implement `canPerformAction(entity, actionDomain)`
- [x] Implement `recordCatalyst(relationship, catalystId)`
- [x] Implement `getCatalyzedEvents(graph, entityId)`

## Phase 2: Framework Systems

### Universal Catalyst System
- [x] Create `src/systems/universalCatalyst.ts`
- [x] Implement core catalyst system logic
- [x] Implement `selectAction(agent, graph)` with pressure weighting
- [x] Implement `attemptAction(agent, action, graph)`
- [x] Implement `calculateAttemptChance(agent, baseRate)`
- [ ] Add to systems export (pending integration phase)

### Occurrence Creation System
- [x] Create `src/systems/occurrenceCreation.ts`
- [x] Implement war occurrence detection and creation
- [x] Implement magical disaster detection and creation
- [x] Implement cultural movement detection and creation
- [x] Implement economic boom detection and creation
- [ ] Add to systems export (pending integration phase)

### Era Transition System
- [x] Create `src/systems/eraTransition.ts`
- [x] Implement era transition condition checks
- [x] Implement `createNextEra(currentEra, graph)`
- [ ] Add to systems export (pending integration phase)

## Phase 3: Domain Schema Updates

### Entity Kinds
- [x] Add `era` entity kind to `src/domain/penguin/schema.ts`
- [x] Add `occurrence` entity kind to schema
- [ ] Add catalyst properties to `npc` kind definition
- [ ] Add catalyst properties to `faction` kind definition
- [ ] Add catalyst properties to `abilities` kind definition
- [ ] Add catalyst properties to `location` kind definition (rare actors)

### Relationship Kinds
- [x] Remove `lover_of` from relationship kinds
- [x] Remove `follower_of` from relationship kinds
- [ ] Remove `mentor_of` from relationship kinds (not found in schema)
- [x] Add `active_during` (entity → era)
- [x] Add `participant_in` (entity → occurrence)
- [x] Add `epicenter_of` (occurrence → location)
- [x] Add `triggered_by` (occurrence → agent)
- [x] Add `escalated_by` (occurrence → agent)
- [x] Add `ended_by` (occurrence → agent)
- [x] Add `spawned` (occurrence → occurrence)
- [x] Add `concurrent_with` (occurrence → occurrence)

### Action Domains
- [ ] Create `src/domain/penguin/config/actionDomains.ts`
- [ ] Define political domain (seize_control, form_alliance, declare_war)
- [ ] Define military domain (raid, defend, siege)
- [ ] Define economic domain (establish_trade, monopolize, blockade)
- [ ] Define magical domain (corrupt_location, manifest, discover_ability)
- [ ] Define technological domain (invent, weaponize, spread_innovation)
- [ ] Define environmental domain (ice_drift, krill_migration)
- [ ] Define cultural domain (convert_faction, inspire_hero)
- [ ] Define conflict_escalation domain (escalate_war, draw_in_faction)
- [ ] Define disaster_spread domain (spread_corruption, spawn_threat)
- [ ] Implement action handlers for each action

### Relationship Categories
- [ ] Create `src/domain/penguin/config/relationshipCategories.ts`
- [ ] Define `immutable_fact` category
- [ ] Define `structural` category
- [ ] Define `political` category
- [ ] Define `attribution` category
- [ ] Define `temporal` category
- [ ] Implement `getCategoryForRelationship(kind)` helper

## Phase 4: Domain Templates

### Remove NPC-Bloat Templates
- [ ] Remove `familyExpansion` from `src/domain/penguin/templates/npc/index.ts`
- [ ] Remove `kinshipConstellation` from NPC templates
- [ ] Remove `outlawRecruitment` from NPC templates
- [ ] Remove `mysteriousVanishing` from NPC templates
- [ ] Remove from era templateWeights in `eras.ts`
- [ ] Remove from allTemplates export

### Add World-Level Templates
- [ ] Create `territorialExpansion` template
- [ ] Create `magicalSiteDiscovery` template
- [ ] Create `techBreakthrough` template
- [ ] Create `tradeRouteEstablishment` template
- [ ] Add to appropriate template exports
- [ ] Add to era templateWeights

### Occurrence Templates
- [ ] Create `src/domain/penguin/templates/occurrence/index.ts`
- [ ] Implement `warOccurrence` template
- [ ] Implement `magicalDisasterOccurrence` template
- [ ] Implement `culturalMovementOccurrence` template
- [ ] Implement `economicBoomOccurrence` template
- [ ] Add to allTemplates export
- [ ] Add to era templateWeights

## Phase 5: Domain Systems

### Modify Existing Systems
- [ ] Modify `conflictContagionSystem` to record catalyzedBy
- [ ] Modify `prominenceEvolutionSystem` to use catalyst.catalyzedEvents
- [ ] Modify `successionVacuumSystem` to prefer existing NPCs
- [ ] Remove `relationshipFormationSystem` (social drama)
- [ ] Update systems export

### Add New Domain Systems
- [ ] Create `occurrenceLifecycleSystem`
- [ ] Create `npcLifecycleSystem`
- [ ] Create `abilitySpreadSystem`
- [ ] Add to allSystems export

## Phase 6: Domain Configuration

### Update Eras
- [ ] Remove weights for deleted templates in `src/domain/penguin/config/eras.ts`
- [ ] Add weights for new templates
- [ ] Verify all 5 eras have updated weights

### Update Pressures
- [ ] Update `conflict` pressure growth function in `src/domain/penguin/config/pressures.ts`
- [ ] Update `magical_instability` pressure growth function
- [ ] Update `resource_scarcity` pressure growth function
- [ ] Add `cultural_tension` pressure if needed
- [ ] Verify pressure-domain relevance

### Initial State
- [ ] Add era entity: The Great Thaw (expansion, status: current)
- [ ] Add era entity: The Faction Wars (conflict, status: future)
- [ ] Add era entity: The Clever Ice Age (innovation, status: future)
- [ ] Add era entity: The Orca Incursion (invasion, status: future)
- [ ] Add era entity: The Frozen Peace (reconstruction, status: future)
- [ ] Update `src/domain/penguin/data/initialState.json`

## Phase 7: Integration & Testing

### Wire Up Systems
- [ ] Update `src/engine/worldEngine.ts` to get current era entity
- [ ] Add framework systems to execution flow
- [ ] Update template selection to use era entity weights
- [ ] Verify systems execute in correct order

### Testing
- [ ] Smoke test: Run with targetEntitiesPerKind: 5
- [ ] Verify no TypeScript errors
- [ ] Verify entity distribution (~20% NPCs)
- [ ] Verify relationship distribution (~80% world)
- [ ] Verify catalyst attribution (>70% coverage)
- [ ] Verify occurrence creation
- [ ] Verify era transitions
- [ ] Full test: Run with normal parameters
- [ ] Analyze output for success criteria

### Output Validation
- [ ] Check entity counts by kind
- [ ] Check relationship category distribution
- [ ] Check catalyzedBy coverage
- [ ] Review notable occurrences
- [ ] Review era transition history
- [ ] Verify narrative quality in history events

## Notes

- Keep protected relationship violations <3.0/tick
- Maintain total relationship count ~300-500
- Eras should be pre-seeded in initialState.json
- Domain/framework separation is strict
- Action handlers defined in domain, called by framework

## Blockers

_None currently_

## Completed

- [x] Created IMPLEMENTATION_PLAN.md
- [x] Created TASK_LOG.md
- [x] Reviewed existing schema.ts
- [x] Reviewed existing eras.ts
- [x] Reviewed existing domain structure
