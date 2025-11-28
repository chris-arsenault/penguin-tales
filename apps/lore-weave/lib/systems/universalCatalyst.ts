import { SimulationSystem, SystemResult, Graph, ComponentPurpose } from '../engine/types';
import { HardState, Relationship } from '../core/worldTypes';
import {
  getAgentsByCategory,
  calculateAttemptChance,
  addCatalyzedEvent,
  updateInfluence,
  getInfluence
} from '../systems/catalystHelpers';
import { FRAMEWORK_ENTITY_KINDS } from '../core/frameworkPrimitives';

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
export const universalCatalyst: SimulationSystem = {
  id: 'universal_catalyst',
  name: 'Agent Actions',

  contract: {
    purpose: ComponentPurpose.STATE_MODIFICATION,
    enabledBy: {
      entityCounts: [
        { kind: 'npc', min: 1 }
      ]
    },
    affects: {
      relationships: [
        {
          kind: 'various',
          operation: 'create',
          count: { min: 0, max: 50 }
        }
      ],
      entities: [
        {
          kind: 'npc',
          operation: 'modify',
          count: { min: 0, max: 20 }
        },
        {
          kind: 'faction',
          operation: 'modify',
          count: { min: 0, max: 10 }
        },
        {
          kind: FRAMEWORK_ENTITY_KINDS.OCCURRENCE,
          operation: 'modify',
          count: { min: 0, max: 5 }
        }
      ]
    }
  },

  metadata: {
    produces: {
      relationships: [
        { kind: 'various', frequency: 'common', comment: 'Agents create world relationships via actions' }
      ],
      modifications: [
        { type: 'prominence', frequency: 'common', comment: 'Agent influence and catalyzedEvents updated' }
      ]
    },
    effects: {
      graphDensity: 0.8,
      clusterFormation: 0.6,
      diversityImpact: 0.4,
      comment: 'Agents shape the world through political, military, magical, and other actions'
    },
    parameters: {
      actionAttemptRate: {
        value: 0.3,
        min: 0.1,
        max: 0.8,
        description: 'Base chance per tick that agents attempt actions'
      },
      influenceGain: {
        value: 0.1,
        min: 0.05,
        max: 0.3,
        description: 'Influence gain on successful action'
      },
      influenceLoss: {
        value: 0.05,
        min: 0.01,
        max: 0.15,
        description: 'Influence loss on failed action'
      },
      pressureMultiplier: {
        value: 1.5,
        min: 1.0,
        max: 3.0,
        description: 'How much pressures amplify action attempt rates'
      }
    },
    triggers: {
      graphConditions: ['Entities with catalyst.canAct = true'],
      comment: 'Runs every tick, agents attempt actions probabilistically'
    }
  },

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const params = universalCatalyst.metadata?.parameters || {};
    const actionAttemptRate = params.actionAttemptRate?.value ?? 0.3;
    const influenceGain = params.influenceGain?.value ?? 0.1;
    const influenceLoss = params.influenceLoss?.value ?? 0.05;
    const pressureMultiplier = params.pressureMultiplier?.value ?? 1.5;

    // Get action domain definitions from domain config
    // These define what actions are available and how to execute them
    const actionDomains = graph.config.domain.getActionDomains?.() || [];

    if (actionDomains.length === 0) {
      // No action domains defined - catalyst system not configured yet
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'Catalyst system dormant (no action domains configured)'
      };
    }

    // Find all agents (entities that can act)
    const firstOrderAgents = getAgentsByCategory(graph, 'first-order');
    const secondOrderAgents = getAgentsByCategory(graph, 'second-order');
    const allAgents = [...firstOrderAgents, ...secondOrderAgents];

    const relationshipsAdded: Relationship[] = [];
    const entitiesModified: Array<{ id: string; changes: Partial<HardState> }> = [];
    let actionsAttempted = 0;
    let actionsSucceeded = 0;

    allAgents.forEach(agent => {
      if (!agent.catalyst?.canAct) return;

      // Calculate action attempt chance
      const attemptChance = calculateAttemptChance(agent, actionAttemptRate);

      // Apply pressure multiplier - high pressures increase action rates
      const relevantPressures = getRelevantPressures(graph, agent.catalyst.actionDomains);
      const pressureBonus = relevantPressures * (pressureMultiplier - 1.0);
      const finalAttemptChance = Math.min(1.0, (attemptChance + pressureBonus) * modifier);

      if (Math.random() > finalAttemptChance) return;

      actionsAttempted++;

      // Select action from agent's available domains
      const selectedAction = selectAction(agent, graph, actionDomains);
      if (!selectedAction) return;

      // Attempt to execute action
      const outcome = executeAction(agent, selectedAction, graph);

      if (outcome.success) {
        actionsSucceeded++;

        // Add created relationships with catalyst attribution
        outcome.relationships.forEach(rel => {
          rel.catalyzedBy = agent.id;
          rel.createdAt = graph.tick;
          relationshipsAdded.push(rel);
        });

        // Update agent influence (success)
        updateInfluence(agent, true, influenceGain);

        // Record catalyzed event
        addCatalyzedEvent(agent, {
          relationshipId: outcome.relationships[0]?.kind || undefined,
          action: outcome.description,
          tick: graph.tick
        });

        entitiesModified.push({
          id: agent.id,
          changes: {
            catalyst: agent.catalyst,
            updatedAt: graph.tick
          }
        });

        // Create history event
        graph.history.push({
          tick: graph.tick,
          era: graph.currentEra.id,
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
            updatedAt: graph.tick
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

/**
 * Get average pressure for relevant domains
 * @param graph - The world graph
 * @param actionDomains - Domains the agent can act in
 * @returns Average pressure (0-1)
 */
function getRelevantPressures(graph: Graph, actionDomains: string[]): number {
  // Domain can define pressure mappings (e.g., 'conflict' pressure → 'military' domain)
  const pressureMappings = graph.config.domain.getPressureDomainMappings?.() || {};

  let totalPressure = 0;
  let count = 0;

  actionDomains.forEach(domain => {
    const pressureIds = pressureMappings[domain] || [];
    pressureIds.forEach(pressureId => {
      const pressure = graph.pressures.get(pressureId) || 0;
      totalPressure += pressure / 100; // Normalize to 0-1
      count++;
    });
  });

  return count > 0 ? totalPressure / count : 0;
}

/**
 * Select an action for the agent to attempt
 * Weighted by era modifiers and pressure levels
 * @param agent - The acting agent
 * @param graph - The world graph
 * @param actionDomains - Available action domain definitions
 * @returns Selected action or null
 */
function selectAction(
  agent: HardState,
  graph: Graph,
  actionDomains: any[]
): any | null {
  if (!agent.catalyst) return null;

  // Find actions available to this agent
  const availableActions: any[] = [];

  actionDomains.forEach(domain => {
    if (!agent.catalyst?.actionDomains.includes(domain.id)) return;

    domain.actions?.forEach((action: any) => {
      // Check if action requirements are met
      if (meetsRequirements(agent, action, graph)) {
        availableActions.push({
          ...action,
          domain: domain.id,
          weight: calculateActionWeight(action, domain.id, graph)
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
 * @param agent - The acting agent
 * @param action - The action definition
 * @param graph - The world graph
 * @returns True if requirements met
 */
function meetsRequirements(agent: HardState, action: any, graph: Graph): boolean {
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
      const pressure = graph.pressures.get(pressureId) || 0;
      return pressure >= (threshold as number);
    });
    if (!meetsAll) return false;
  }

  return true;
}

/**
 * Calculate action weight based on era and pressures
 * @param action - The action definition
 * @param domain - The action domain ID
 * @param graph - The world graph
 * @returns Weight for selection
 */
function calculateActionWeight(action: any, domain: string, graph: Graph): number {
  let weight = action.baseWeight || 1.0;

  // Apply era modifier if defined
  const eraModifier = graph.currentEra.systemModifiers?.[domain] || 1.0;
  weight *= eraModifier;

  // Apply pressure boost
  const pressureMappings = graph.config.domain.getPressureDomainMappings?.() || {};
  const relevantPressures = pressureMappings[domain] || [];

  relevantPressures.forEach((pressureId: string) => {
    const pressure = graph.pressures.get(pressureId) || 0;
    if (pressure > 50) {
      weight *= (1 + (pressure - 50) / 100); // Up to 2x at 100 pressure
    }
  });

  return Math.max(0.1, weight);
}

/**
 * Execute an action via domain-defined handler
 * @param agent - The acting agent
 * @param action - The action definition
 * @param graph - The world graph
 * @returns Action outcome
 */
function executeAction(
  agent: HardState,
  action: any,
  graph: Graph
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
    // Execute domain handler
    return action.handler(graph, agent);
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
