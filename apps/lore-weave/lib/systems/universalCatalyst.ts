import { SimulationSystem, SystemResult } from '../engine/types';
import { HardState, Relationship, Prominence } from '../core/worldTypes';
import {
  calculateAttemptChance,
  addCatalyzedEvent
} from '../systems/catalystHelpers';
import { TemplateGraphView } from '../graph/templateGraphView';
import type { UniversalCatalystConfig } from '../engine/systemInterpreter';
import type { ExecutableAction } from '../engine/actionInterpreter';
import { matchesActorConfig } from '../selection';
import { adjustProminence } from '../utils';
import type { ActionApplicationPayload } from '../observer/types';

// =============================================================================
// INSTRUMENTATION TYPES
// =============================================================================

interface PressureInfluence {
  pressureId: string;
  value: number;
  multiplier: number;
  contribution: number;
}

interface ActionWeightBreakdown {
  weight: number;
  pressureInfluences: PressureInfluence[];
}

interface SelectionContext {
  availableActionCount: number;
  selectedWeight: number;
  totalWeight: number;
  pressureInfluences: PressureInfluence[];
  attemptChance: number;
  prominenceBonus: number;
}

interface ActionSelectionResult {
  action: ExecutableAction | null;
  context: SelectionContext;
}

type ActionOutcomeStatus = 'success' | 'failed_roll' | 'failed_no_target' | 'failed_no_instigator';

interface ExtendedActionOutcome {
  status: ActionOutcomeStatus;
  success: boolean;
  relationships: Relationship[];
  description: string;
  entitiesCreated?: string[];
  entitiesModified?: string[];
  instigatorId?: string;
  instigatorName?: string;
  targetId?: string;
  targetName?: string;
  targetKind?: string;
  target2Id?: string;
  target2Name?: string;
  successChance: number;
  prominenceMultiplier: number;
}

/**
 * Universal Catalyst System
 *
 * Framework-level system that enables agents to perform actions.
 * This is domain-agnostic - all domain-specific logic lives in action handlers.
 *
 * Flow:
 * 1. Find all entities that can act (catalyst.canAct = true)
 * 2. For each agent, roll for action attempt based on prominence
 * 3. Select action from available actions, weighted by pressures
 * 4. Execute action via declarative handler (success chance based on prominence)
 * 5. Record catalyzedBy attribution
 */

/**
 * Create a Universal Catalyst system with the given configuration.
 */
export function createUniversalCatalystSystem(config: UniversalCatalystConfig): SimulationSystem {
  // Extract config with defaults
  const actionAttemptRate = config.actionAttemptRate ?? 0.3;
  const pressureMultiplier = config.pressureMultiplier ?? 1.5;
  const prominenceUpChance = config.prominenceUpChanceOnSuccess ?? 0.1;
  const prominenceDownChance = config.prominenceDownChanceOnFailure ?? 0.05;

  return {
    id: config.id || 'universal_catalyst',
    name: config.name || 'Agent Actions',

    apply: (graphView: TemplateGraphView, modifier: number = 1.0): SystemResult => {
      // Get executable actions from declarative config
      const actions: ExecutableAction[] = graphView.config.executableActions || [];

      if (actions.length === 0) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: 'Catalyst system dormant (no actions configured in actions.json)'
        };
      }

      // Find all agents (entities that can act)
      const allAgents = graphView.getEntities().filter(e => e.catalyst?.canAct === true);

      const relationshipsAdded: Relationship[] = [];
      const entitiesModified: Array<{ id: string; changes: Partial<HardState> }> = [];
      let actionsAttempted = 0;
      let actionsSucceeded = 0;

      // Get emitter from graphView config if available
      const emitter = graphView.config.emitter;

      allAgents.forEach(agent => {
        if (!agent.catalyst?.canAct) return;

        // Calculate action attempt chance
        const baseAttemptChance = calculateAttemptChance(agent, actionAttemptRate);

        // Apply pressure multiplier based on available actions for this agent
        const availableActions = getAvailableActions(agent, actions, graphView);
        const relevantPressures = getRelevantPressuresFromActions(graphView, availableActions);
        const prominenceBonus = relevantPressures * (pressureMultiplier - 1.0);
        const finalAttemptChance = Math.min(1.0, (baseAttemptChance + prominenceBonus) * modifier);

        if (Math.random() > finalAttemptChance) return;

        actionsAttempted++;

        // Select action from available actions with context
        const { action: selectedAction, context: selectionContext } = selectActionWithContext(
          agent,
          availableActions,
          graphView,
          finalAttemptChance,
          prominenceBonus
        );
        if (!selectedAction) return;

        // Attempt to execute action with extended outcome
        const outcome = executeActionWithContext(agent, selectedAction, graphView);

        // Track prominence changes for instrumentation
        const prominenceChanges: Array<{ entityId: string; entityName: string; direction: 'up' | 'down' }> = [];

        if (outcome.success) {
          actionsSucceeded++;

          // Add created relationships with catalyst attribution
          outcome.relationships.forEach(rel => {
            rel.catalyzedBy = agent.id;
            rel.createdAt = graphView.tick;
            relationshipsAdded.push(rel);
          });

          // Record catalyzed event
          addCatalyzedEvent(agent, {
            relationshipId: outcome.relationships[0]?.kind || undefined,
            action: outcome.description,
            tick: graphView.tick
          });

          entitiesModified.push({
            id: agent.id,
            changes: {
              catalyst: agent.catalyst,
              updatedAt: graphView.tick
            }
          });

          // Apply prominence increase on success (if action opts in)
          if (selectedAction.applyProminenceToActor && Math.random() < prominenceUpChance) {
            agent.prominence = adjustProminence(agent.prominence, 1);
            entitiesModified.push({
              id: agent.id,
              changes: { prominence: agent.prominence }
            });
            prominenceChanges.push({ entityId: agent.id, entityName: agent.name, direction: 'up' });
          }
          if (selectedAction.applyProminenceToInstigator && outcome.instigatorId && Math.random() < prominenceUpChance) {
            const instigator = graphView.getEntity(outcome.instigatorId);
            if (instigator) {
              instigator.prominence = adjustProminence(instigator.prominence, 1);
              entitiesModified.push({
                id: instigator.id,
                changes: { prominence: instigator.prominence }
              });
              prominenceChanges.push({ entityId: instigator.id, entityName: instigator.name, direction: 'up' });
            }
          }

          // Create history event
          graphView.addHistoryEvent({
            tick: graphView.tick,
            era: graphView.currentEra.id,
            type: 'simulation',
            description: `${agent.name} ${outcome.description}`,
            entitiesCreated: outcome.entitiesCreated || [],
            relationshipsCreated: outcome.relationships,
            entitiesModified: outcome.entitiesModified || [agent.id]
          });
        } else {
          // Apply prominence decrease on failure (if action opts in)
          if (selectedAction.applyProminenceToActor && Math.random() < prominenceDownChance) {
            agent.prominence = adjustProminence(agent.prominence, -1);
            entitiesModified.push({
              id: agent.id,
              changes: { prominence: agent.prominence }
            });
            prominenceChanges.push({ entityId: agent.id, entityName: agent.name, direction: 'down' });
          }
        }

        // Emit action application event for instrumentation
        if (emitter) {
          // Calculate epoch from tick (approximate)
          const ticksPerEpoch = graphView.config.ticksPerEpoch || 20;
          const epoch = Math.floor(graphView.tick / ticksPerEpoch);

          const payload: ActionApplicationPayload = {
            tick: graphView.tick,
            epoch,
            actionId: selectedAction.type,
            actionName: selectedAction.name,
            actorId: agent.id,
            actorName: agent.name,
            actorKind: agent.kind,
            actorProminence: agent.prominence,
            instigatorId: outcome.instigatorId,
            instigatorName: outcome.instigatorName,
            targetId: outcome.targetId,
            targetName: outcome.targetName,
            targetKind: outcome.targetKind,
            target2Id: outcome.target2Id,
            target2Name: outcome.target2Name,
            selectionContext: {
              availableActionCount: selectionContext.availableActionCount,
              selectedWeight: selectionContext.selectedWeight,
              totalWeight: selectionContext.totalWeight,
              pressureInfluences: selectionContext.pressureInfluences,
              attemptChance: selectionContext.attemptChance,
              prominenceBonus: selectionContext.prominenceBonus
            },
            outcome: {
              status: outcome.status,
              successChance: outcome.successChance,
              prominenceMultiplier: outcome.prominenceMultiplier,
              description: outcome.description,
              relationshipsCreated: outcome.relationships.map(rel => ({
                kind: rel.kind,
                srcId: rel.src,
                dstId: rel.dst,
                srcName: graphView.getEntity(rel.src)?.name || rel.src,
                dstName: graphView.getEntity(rel.dst)?.name || rel.dst,
                strength: rel.strength
              })),
              relationshipsStrengthened: [], // TODO: Track if needed
              prominenceChanges
            }
          };
          emitter.actionApplication(payload);
        }
      });

      return {
        relationshipsAdded,
        entitiesModified,
        pressureChanges: {},
        description: actionsSucceeded > 0
          ? `Agents shape the world (${actionsSucceeded}/${actionsAttempted} actions succeeded)`
          : actionsAttempted > 0
          ? `Agents attempt to act (all ${actionsAttempted} failed)`
          : 'Agents dormant this cycle'
      };
    }
  };
}

/**
 * Get available actions for an agent based on requirements
 */
function getAvailableActions(
  agent: HardState,
  actions: ExecutableAction[],
  graphView: TemplateGraphView
): ExecutableAction[] {
  return actions.filter(action => meetsRequirements(agent, action, graphView));
}

/**
 * Calculate pressure contribution for attempt chance from available actions.
 * Uses the same multiplier-based approach as weight calculation.
 * Returns a value that can be added to the base attempt chance.
 */
function getRelevantPressuresFromActions(graphView: TemplateGraphView, actions: ExecutableAction[]): number {
  if (actions.length === 0) return 0;

  // Collect all unique pressure modifiers across actions
  const pressureContributions: Map<string, number[]> = new Map();

  for (const action of actions) {
    if (!action.pressureModifiers) continue;
    for (const mod of action.pressureModifiers) {
      if (!pressureContributions.has(mod.pressure)) {
        pressureContributions.set(mod.pressure, []);
      }
      pressureContributions.get(mod.pressure)!.push(mod.multiplier);
    }
  }

  if (pressureContributions.size === 0) return 0;

  // Calculate weighted contribution: average multiplier * pressure for each unique pressure
  let totalContribution = 0;
  for (const [pressureId, multipliers] of pressureContributions) {
    const avgMultiplier = multipliers.reduce((a, b) => a + b, 0) / multipliers.length;
    const pressure = graphView.getPressure(pressureId);
    totalContribution += (pressure / 100) * avgMultiplier;
  }

  // Normalize by number of unique pressures to keep contribution reasonable
  return totalContribution / pressureContributions.size;
}

/**
 * Select an action for the agent to attempt with full context for instrumentation
 * Weighted by pressure levels
 */
function selectActionWithContext(
  agent: HardState,
  availableActions: ExecutableAction[],
  graphView: TemplateGraphView,
  attemptChance: number,
  prominenceBonus: number
): ActionSelectionResult {
  const emptyContext: SelectionContext = {
    availableActionCount: availableActions.length,
    selectedWeight: 0,
    totalWeight: 0,
    pressureInfluences: [],
    attemptChance,
    prominenceBonus
  };

  if (!agent.catalyst || availableActions.length === 0) {
    return { action: null, context: emptyContext };
  }

  // Calculate weights for each action with breakdown
  const weightedActions = availableActions.map(action => {
    const breakdown = calculateActionWeightWithBreakdown(action, graphView);
    return {
      action,
      weight: breakdown.weight,
      pressureInfluences: breakdown.pressureInfluences
    };
  });

  // Weighted random selection
  const totalWeight = weightedActions.reduce((sum, a) => sum + a.weight, 0);
  let random = Math.random() * totalWeight;

  for (const wa of weightedActions) {
    random -= wa.weight;
    if (random <= 0) {
      return {
        action: wa.action,
        context: {
          availableActionCount: availableActions.length,
          selectedWeight: wa.weight,
          totalWeight,
          pressureInfluences: wa.pressureInfluences,
          attemptChance,
          prominenceBonus
        }
      };
    }
  }

  // Fallback to first action
  const fallback = weightedActions[0];
  return {
    action: fallback?.action || null,
    context: {
      availableActionCount: availableActions.length,
      selectedWeight: fallback?.weight || 0,
      totalWeight,
      pressureInfluences: fallback?.pressureInfluences || [],
      attemptChance,
      prominenceBonus
    }
  };
}

/**
 * Check if agent meets action requirements.
 * Delegates to matchesActorConfig for consistent actor filtering.
 */
function meetsRequirements(agent: HardState, action: ExecutableAction, graphView: TemplateGraphView): boolean {
  return matchesActorConfig(agent, action.actorConfig, graphView);
}

/**
 * Calculate action weight based on pressures with full breakdown for instrumentation.
 * Uses multiplier-based calculation supporting both positive and negative (inverse) relationships.
 *
 * Formula: weight = baseWeight * (1 + sum of (pressure/100 * multiplier))
 *
 * Examples with pressure at 80:
 *   multiplier 1.0  → contribution = 0.8, weight *= 1.8
 *   multiplier -1.0 → contribution = -0.8, weight *= 0.2 (inverse)
 *   multiplier 0.5  → contribution = 0.4, weight *= 1.4
 */
function calculateActionWeightWithBreakdown(action: ExecutableAction, graphView: TemplateGraphView): ActionWeightBreakdown {
  const baseWeight = action.baseWeight || 1.0;
  const pressureInfluences: PressureInfluence[] = [];

  if (!action.pressureModifiers || action.pressureModifiers.length === 0) {
    return { weight: baseWeight, pressureInfluences };
  }

  // Calculate total pressure contribution with breakdown
  let pressureContribution = 0;
  for (const mod of action.pressureModifiers) {
    const pressure = graphView.getPressure(mod.pressure);
    const contribution = (pressure / 100) * mod.multiplier;
    pressureContribution += contribution;

    pressureInfluences.push({
      pressureId: mod.pressure,
      value: pressure,
      multiplier: mod.multiplier,
      contribution
    });
  }

  // Apply contribution to base weight
  const weight = Math.max(0.1, baseWeight * (1 + pressureContribution));

  return { weight, pressureInfluences };
}

/**
 * Get prominence multiplier for success chance calculation.
 * More prominent entities have higher success rates.
 */
function getProminenceMultiplier(prominence: Prominence): number {
  const multipliers: Record<Prominence, number> = {
    'forgotten': 0.6,
    'marginal': 0.8,
    'recognized': 1.0,
    'renowned': 1.2,
    'mythic': 1.5
  };
  return multipliers[prominence] || 1.0;
}

/**
 * Execute an action via declarative handler with extended outcome for instrumentation
 */
function executeActionWithContext(
  agent: HardState,
  action: ExecutableAction,
  graphView: TemplateGraphView
): ExtendedActionOutcome {
  // Calculate success chance based on prominence
  const baseChance = action.baseSuccessChance || 0.5;
  const prominenceMultiplier = getProminenceMultiplier(agent.prominence);
  const successChance = Math.min(0.95, baseChance * prominenceMultiplier);

  // Action handler is created from declarative config
  if (!action.handler) {
    return {
      status: 'failed_roll',
      success: false,
      relationships: [],
      description: 'Action has no handler',
      entitiesCreated: [],
      entitiesModified: [],
      successChance,
      prominenceMultiplier
    };
  }

  const success = Math.random() < successChance;

  if (success) {
    // Execute declarative handler
    const handlerResult = action.handler(graphView, agent);

    // Determine status based on handler result
    let status: ActionOutcomeStatus = 'success';
    if (!handlerResult.success) {
      // Handler returned failure - check description for reason
      if (handlerResult.description.includes('no valid') || handlerResult.description.includes('found no')) {
        status = 'failed_no_target';
      } else if (handlerResult.description.includes('no instigator')) {
        status = 'failed_no_instigator';
      } else {
        status = 'failed_roll';
      }
    }

    // Look up instigator name if present
    let instigatorName: string | undefined;
    if (handlerResult.instigatorId) {
      const instigator = graphView.getEntity(handlerResult.instigatorId);
      instigatorName = instigator?.name;
    }

    // Extract target info from entitiesModified (first non-actor entity is the target)
    let targetId: string | undefined;
    let targetName: string | undefined;
    let targetKind: string | undefined;
    let target2Id: string | undefined;
    let target2Name: string | undefined;

    if (handlerResult.entitiesModified) {
      const targets = handlerResult.entitiesModified.filter(id => id !== agent.id);
      if (targets.length > 0) {
        const target = graphView.getEntity(targets[0]);
        if (target) {
          targetId = target.id;
          targetName = target.name;
          targetKind = target.kind;
        }
      }
      if (targets.length > 1) {
        const target2 = graphView.getEntity(targets[1]);
        if (target2) {
          target2Id = target2.id;
          target2Name = target2.name;
        }
      }
    }

    return {
      status,
      success: handlerResult.success,
      relationships: handlerResult.relationships,
      description: handlerResult.description,
      entitiesCreated: handlerResult.entitiesCreated,
      entitiesModified: handlerResult.entitiesModified,
      instigatorId: handlerResult.instigatorId,
      instigatorName,
      targetId,
      targetName,
      targetKind,
      target2Id,
      target2Name,
      successChance,
      prominenceMultiplier
    };
  } else {
    return {
      status: 'failed_roll',
      success: false,
      relationships: [],
      description: `failed to ${action.type}`,
      entitiesCreated: [],
      entitiesModified: [],
      successChance,
      prominenceMultiplier
    };
  }
}

