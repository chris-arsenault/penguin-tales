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
import { DEFAULT_PRESSURE_DOMAIN_MAPPINGS, type ExecutableActionDomain } from '../engine/actionInterpreter';

/**
 * Universal Catalyst System
 *
 * Framework-level system that enables agents to perform domain-defined actions.
 * This is domain-agnostic - all domain-specific logic lives in action handlers.
 *
 * Flow:
 * 1. Find all entities that can act (catalyst.canAct = true)
 * 2. For each agent, roll for action attempt based on influence/prominence
 * 3. Select action from available actions, weighted by era and pressures
 * 4. Execute action via domain-defined handler
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
      // Get action domain definitions from declarative config
      const actionDomains: ExecutableActionDomain[] = graphView.config.actionDomains || [];

      if (actionDomains.length === 0) {
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

        // Apply pressure multiplier - high pressures increase action rates
        const relevantPressures = getRelevantPressures(graphView, agent.catalyst.actionDomains);
        const pressureBonus = relevantPressures * (pressureMultiplier - 1.0);
        const finalAttemptChance = Math.min(1.0, (attemptChance + pressureBonus) * modifier);

        if (Math.random() > finalAttemptChance) return;

        actionsAttempted++;

        // Select action from agent's available domains
        const selectedAction = selectAction(agent, graphView, actionDomains);
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
 * Get average pressure for relevant domains
 */
function getRelevantPressures(graphView: TemplateGraphView, actionDomains: string[]): number {
  let totalPressure = 0;
  let count = 0;

  actionDomains.forEach(domain => {
    const pressureIds = DEFAULT_PRESSURE_DOMAIN_MAPPINGS[domain] || [];
    pressureIds.forEach(pressureId => {
      const pressure = graphView.getPressure(pressureId);
      totalPressure += pressure / 100; // Normalize to 0-1
      count++;
    });
  });

  return count > 0 ? totalPressure / count : 0;
}

/**
 * Select an action for the agent to attempt
 * Weighted by era modifiers and pressure levels
 */
function selectAction(
  agent: HardState,
  graphView: TemplateGraphView,
  actionDomains: any[]
): any | null {
  if (!agent.catalyst) return null;

  // Find actions available to this agent
  const availableActions: any[] = [];

  actionDomains.forEach(domain => {
    if (!agent.catalyst?.actionDomains.includes(domain.id)) return;

    domain.actions?.forEach((action: any) => {
      // Check if action requirements are met
      if (meetsRequirements(agent, action, graphView)) {
        availableActions.push({
          ...action,
          domain: domain.id,
          weight: calculateActionWeight(action, domain.id, graphView)
        });
      }
    });
  });

  if (availableActions.length === 0) return null;

  // Weighted random selection
  const totalWeight = availableActions.reduce((sum, a) => sum + a.weight, 0);
  let random = Math.random() * totalWeight;

  for (const action of availableActions) {
    random -= action.weight;
    if (random <= 0) {
      return action;
    }
  }

  return availableActions[0]; // Fallback
}

/**
 * Check if agent meets action requirements
 */
function meetsRequirements(agent: HardState, action: any, graphView: TemplateGraphView): boolean {
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
 * Calculate action weight based on era and pressures
 */
function calculateActionWeight(action: any, domain: string, graphView: TemplateGraphView): number {
  let weight = action.baseWeight || 1.0;

  // Apply era modifier if defined
  const eraModifier = graphView.currentEra.systemModifiers?.[domain] || 1.0;
  weight *= eraModifier;

  // Apply pressure boost
  const relevantPressures = DEFAULT_PRESSURE_DOMAIN_MAPPINGS[domain] || [];

  relevantPressures.forEach((pressureId: string) => {
    const pressure = graphView.getPressure(pressureId);
    if (pressure > 50) {
      weight *= (1 + (pressure - 50) / 100); // Up to 2x at 100 pressure
    }
  });

  return Math.max(0.1, weight);
}

/**
 * Execute an action via domain-defined handler
 */
function executeAction(
  agent: HardState,
  action: any,
  graphView: TemplateGraphView
): ActionOutcome {
  // Action handler is domain-defined
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
  const influence = getInfluence(agent, action.domain);
  const successChance = Math.min(0.95, baseChance * (1 + influence));

  const success = Math.random() < successChance;

  if (success) {
    // Execute domain handler - pass graphView instead of graph
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
