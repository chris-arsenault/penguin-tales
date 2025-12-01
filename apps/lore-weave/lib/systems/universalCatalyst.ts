import { SimulationSystem, SystemResult } from '../engine/types';
import { HardState, Relationship } from '../core/worldTypes';
import {
  calculateAttemptChance,
  addCatalyzedEvent,
  updateInfluence,
  getInfluence
} from '../systems/catalystHelpers';
import { TemplateGraphView } from '../graph/templateGraphView';
import type { UniversalCatalystConfig } from '../engine/systemInterpreter';
import type { ExecutableAction } from '../engine/actionInterpreter';

/**
 * Universal Catalyst System
 *
 * Framework-level system that enables agents to perform actions.
 * This is domain-agnostic - all domain-specific logic lives in action handlers.
 *
 * Flow:
 * 1. Find all entities that can act (catalyst.canAct = true)
 * 2. For each agent, roll for action attempt based on influence/prominence
 * 3. Select action from available actions, weighted by pressures
 * 4. Execute action via declarative handler
 * 5. Record catalyzedBy attribution and update influence
 */

/**
 * Create a Universal Catalyst system with the given configuration.
 */
export function createUniversalCatalystSystem(config: UniversalCatalystConfig): SimulationSystem {
  // Extract config with defaults
  const actionAttemptRate = config.actionAttemptRate ?? 0.3;
  const influenceGain = config.influenceGain ?? 0.1;
  const influenceLoss = config.influenceLoss ?? 0.05;
  const pressureMultiplier = config.pressureMultiplier ?? 1.5;

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

      allAgents.forEach(agent => {
        if (!agent.catalyst?.canAct) return;

        // Calculate action attempt chance
        const attemptChance = calculateAttemptChance(agent, actionAttemptRate);

        // Apply pressure multiplier based on available actions for this agent
        const availableActions = getAvailableActions(agent, actions, graphView);
        const relevantPressures = getRelevantPressuresFromActions(graphView, availableActions);
        const pressureBonus = relevantPressures * (pressureMultiplier - 1.0);
        const finalAttemptChance = Math.min(1.0, (attemptChance + pressureBonus) * modifier);

        if (Math.random() > finalAttemptChance) return;

        actionsAttempted++;

        // Select action from available actions
        const selectedAction = selectAction(agent, availableActions, graphView);
        if (!selectedAction) return;

        // Attempt to execute action
        const outcome = executeAction(agent, selectedAction, graphView);

        if (outcome.success) {
          actionsSucceeded++;

          // Add created relationships with catalyst attribution
          outcome.relationships.forEach(rel => {
            rel.catalyzedBy = agent.id;
            rel.createdAt = graphView.tick;
            relationshipsAdded.push(rel);
          });

          // Update agent influence (success)
          updateInfluence(agent, true, influenceGain);

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
          // Failed action - influence decreases
          updateInfluence(agent, false, influenceLoss);

          entitiesModified.push({
            id: agent.id,
            changes: {
              catalyst: agent.catalyst,
              updatedAt: graphView.tick
            }
          });
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
 * Get average pressure from actions' pressureModifiers
 */
function getRelevantPressuresFromActions(graphView: TemplateGraphView, actions: ExecutableAction[]): number {
  const allPressureIds = new Set<string>();

  actions.forEach(action => {
    action.pressureModifiers.forEach(p => allPressureIds.add(p));
  });

  if (allPressureIds.size === 0) return 0;

  let totalPressure = 0;
  allPressureIds.forEach(pressureId => {
    const pressure = graphView.getPressure(pressureId);
    totalPressure += pressure / 100; // Normalize to 0-1
  });

  return totalPressure / allPressureIds.size;
}

/**
 * Select an action for the agent to attempt
 * Weighted by pressure levels
 */
function selectAction(
  agent: HardState,
  availableActions: ExecutableAction[],
  graphView: TemplateGraphView
): ExecutableAction | null {
  if (!agent.catalyst || availableActions.length === 0) return null;

  // Calculate weights for each action
  const weightedActions = availableActions.map(action => ({
    action,
    weight: calculateActionWeight(action, graphView)
  }));

  // Weighted random selection
  const totalWeight = weightedActions.reduce((sum, a) => sum + a.weight, 0);
  let random = Math.random() * totalWeight;

  for (const { action, weight } of weightedActions) {
    random -= weight;
    if (random <= 0) {
      return action;
    }
  }

  return weightedActions[0]?.action || null; // Fallback
}

/**
 * Check if agent meets action requirements
 */
function meetsRequirements(agent: HardState, action: ExecutableAction, graphView: TemplateGraphView): boolean {
  if (!action.requirements) return true;

  const reqs = action.requirements;

  // Check prominence requirement
  if (reqs.minProminence) {
    const prominenceOrder = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];
    const agentLevel = prominenceOrder.indexOf(agent.prominence);
    const requiredLevel = prominenceOrder.indexOf(reqs.minProminence);
    if (agentLevel < requiredLevel) return false;
  }

  // Check required relationships
  if (reqs.requiredRelationships) {
    const hasAll = reqs.requiredRelationships.every((relKind: string) =>
      agent.links.some(link => link.kind === relKind)
    );
    if (!hasAll) return false;
  }

  // Check required pressures
  if (reqs.requiredPressures) {
    const meetsAll = Object.entries(reqs.requiredPressures).every(([pressureId, threshold]) => {
      const pressure = graphView.getPressure(pressureId);
      return pressure >= (threshold as number);
    });
    if (!meetsAll) return false;
  }

  return true;
}

/**
 * Calculate action weight based on pressures
 */
function calculateActionWeight(action: ExecutableAction, graphView: TemplateGraphView): number {
  let weight = action.baseWeight || 1.0;

  // Apply pressure boost from action's direct pressureModifiers
  action.pressureModifiers.forEach((pressureId: string) => {
    const pressure = graphView.getPressure(pressureId);
    if (pressure > 50) {
      weight *= (1 + (pressure - 50) / 100); // Up to 2x at 100 pressure
    }
  });

  return Math.max(0.1, weight);
}

/**
 * Execute an action via declarative handler
 */
function executeAction(
  agent: HardState,
  action: ExecutableAction,
  graphView: TemplateGraphView
): ActionOutcome {
  // Action handler is created from declarative config
  if (!action.handler) {
    return {
      success: false,
      relationships: [],
      description: 'Action has no handler',
      entitiesCreated: [],
      entitiesModified: []
    };
  }

  // Calculate success chance
  const baseChance = action.baseSuccessChance || 0.5;
  const influence = getInfluence(agent);
  const successChance = Math.min(0.95, baseChance * (1 + influence));

  const success = Math.random() < successChance;

  if (success) {
    // Execute declarative handler
    return action.handler(graphView, agent);
  } else {
    return {
      success: false,
      relationships: [],
      description: `failed to ${action.type}`,
      entitiesCreated: [],
      entitiesModified: []
    };
  }
}

/**
 * Action outcome interface
 */
interface ActionOutcome {
  success: boolean;
  relationships: Relationship[];
  description: string;
  entitiesCreated?: string[];
  entitiesModified?: string[];
}

/**
 * Default Universal Catalyst instance (for backwards compatibility).
 * @deprecated Use createUniversalCatalystSystem() instead.
 */
export const universalCatalyst = createUniversalCatalystSystem({
  id: 'universal_catalyst',
  name: 'Agent Actions'
});
