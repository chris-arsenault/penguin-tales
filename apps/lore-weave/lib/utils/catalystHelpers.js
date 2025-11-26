/**
 * Catalyst Helper Utilities
 *
 * Framework-level helpers for working with the catalyst system.
 * These are domain-agnostic and work with any entity type.
 */
/**
 * Get all entities that can act (have catalyst.canAct = true)
 * @param graph - The world graph
 * @param category - Filter by agent category
 * @returns Array of agent entities
 */
export function getAgentsByCategory(graph, category = 'all') {
    const agents = Array.from(graph.entities.values())
        .filter(e => e.catalyst?.canAct === true);
    if (category === 'all') {
        return agents;
    }
    // First-order agents: npc, faction, abilities, location (rare)
    // Second-order agents: occurrence
    if (category === 'first-order') {
        return agents.filter(e => e.kind !== 'occurrence');
    }
    else {
        return agents.filter(e => e.kind === 'occurrence');
    }
}
/**
 * Check if an entity can perform an action in a specific domain
 * @param entity - The entity to check
 * @param actionDomain - The action domain (e.g., 'political', 'magical')
 * @returns True if entity can act in this domain
 */
export function canPerformAction(entity, actionDomain) {
    if (!entity.catalyst?.canAct) {
        return false;
    }
    return entity.catalyst.actionDomains.includes(actionDomain);
}
/**
 * Get entity's influence in a specific domain
 * Default implementation returns base influence.
 * Domains can override to provide domain-specific influence calculations.
 * @param entity - The entity
 * @param actionDomain - The action domain
 * @returns Influence score (0-1)
 */
export function getInfluence(entity, actionDomain) {
    if (!entity.catalyst) {
        return 0;
    }
    // Base influence from catalyst properties
    let influence = entity.catalyst.influence;
    // Prominence bonus: renowned/mythic entities have more influence
    const prominenceBonus = {
        'forgotten': -0.2,
        'marginal': -0.1,
        'recognized': 0,
        'renowned': 0.15,
        'mythic': 0.3
    };
    influence += prominenceBonus[entity.prominence] || 0;
    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, influence));
}
/**
 * Record catalyst attribution on a relationship
 * @param relationship - The relationship to attribute
 * @param catalystId - ID of the agent that caused this
 * @returns The relationship with attribution added
 */
export function recordCatalyst(relationship, catalystId) {
    return {
        ...relationship,
        catalyzedBy: catalystId
    };
}
/**
 * Get all events (relationships/entities) catalyzed by an entity
 * @param graph - The world graph
 * @param entityId - ID of the catalyst entity
 * @returns Array of relationships and entities caused by this catalyst
 */
export function getCatalyzedEvents(graph, entityId) {
    const results = [];
    // Find relationships catalyzed by this entity
    graph.relationships.forEach(rel => {
        if (rel.catalyzedBy === entityId) {
            results.push(rel);
        }
    });
    // Find entities catalyzed by this entity (e.g., occurrences triggered by NPCs)
    graph.entities.forEach(entity => {
        const triggeredByRel = entity.links.find(link => link.kind === 'triggered_by' && link.dst === entityId);
        if (triggeredByRel) {
            results.push(entity);
        }
    });
    return results;
}
/**
 * Get count of events catalyzed by entity
 * Used for prominence evolution and influence calculations
 * @param graph - The world graph
 * @param entityId - ID of the catalyst entity
 * @returns Number of events catalyzed
 */
export function getCatalyzedEventCount(graph, entityId) {
    const entity = graph.entities.get(entityId);
    if (!entity?.catalyst) {
        return 0;
    }
    return entity.catalyst.catalyzedEvents.length;
}
/**
 * Add a catalyzed event to an entity's record
 * @param entity - The catalyst entity
 * @param event - The event to record
 */
export function addCatalyzedEvent(entity, event) {
    if (!entity.catalyst) {
        return;
    }
    entity.catalyst.catalyzedEvents.push(event);
}
/**
 * Check if entity has a specific relationship
 * @param entity - The entity to check
 * @param relationshipKind - The relationship kind to look for
 * @param direction - Check as 'src' or 'dst' or 'both'
 * @returns True if relationship exists
 */
export function hasRelationship(entity, relationshipKind, direction = 'both') {
    return entity.links.some(link => {
        if (link.kind !== relationshipKind) {
            return false;
        }
        if (direction === 'both') {
            return true;
        }
        // For 'src', entity is the source (link shows dst)
        // For 'dst', entity is the destination (link shows src)
        // This depends on how links are stored - assuming bidirectional
        return true; // Simplified for now
    });
}
/**
 * Calculate action attempt chance based on entity properties
 * @param entity - The entity attempting action
 * @param baseRate - Base action attempt rate (from system parameters)
 * @returns Probability of action attempt this tick
 */
export function calculateAttemptChance(entity, baseRate) {
    if (!entity.catalyst?.canAct) {
        return 0;
    }
    // More prominent entities act more frequently
    const prominenceMultipliers = {
        'forgotten': 0.3,
        'marginal': 0.6,
        'recognized': 1.0,
        'renowned': 1.5,
        'mythic': 2.0
    };
    const multiplier = prominenceMultipliers[entity.prominence] || 1.0;
    const chance = baseRate * multiplier * entity.catalyst.influence;
    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, chance));
}
/**
 * Initialize or update catalyst properties for an entity
 * This is a helper for domain code to set up catalyst properties
 * @param entity - The entity to initialize
 * @param canAct - Can this entity perform actions?
 * @param actionDomains - Which domains can it act in?
 * @param initialInfluence - Starting influence (default 0.5)
 */
export function initializeCatalyst(entity, canAct, actionDomains = [], initialInfluence = 0.5) {
    entity.catalyst = {
        canAct,
        actionDomains,
        influence: initialInfluence,
        catalyzedEvents: []
    };
}
/**
 * Smart catalyst initialization based on entity type and prominence.
 * Automatically determines action domains and influence based on entity properties.
 * Requires graph with domain schema for action domain mapping.
 *
 * @param entity - The entity to initialize
 * @param graph - Graph with domain schema
 */
export function initializeCatalystSmart(entity, graph) {
    // Only prominent entities can act
    if (!['recognized', 'renowned', 'mythic'].includes(entity.prominence)) {
        return;
    }
    // Determine which action domains this entity can use from domain schema
    const actionDomains = graph.config?.domain?.getActionDomainsForEntity?.(entity) ?? [];
    if (actionDomains.length === 0) {
        return;
    }
    entity.catalyst = {
        canAct: true,
        actionDomains,
        influence: prominenceToInfluence(entity.prominence),
        catalyzedEvents: []
    };
}
/**
 * Convert prominence level to influence score
 * @param prominence - Prominence level
 * @returns Influence score (0-1)
 */
function prominenceToInfluence(prominence) {
    switch (prominence) {
        case 'mythic': return 0.9;
        case 'renowned': return 0.7;
        case 'recognized': return 0.5;
        default: return 0.3;
    }
}
/**
 * Update entity influence based on action outcome
 * @param entity - The entity whose influence to update
 * @param success - Whether the action succeeded
 * @param magnitude - How impactful was the action (0-1)
 */
export function updateInfluence(entity, success, magnitude = 0.1) {
    if (!entity.catalyst) {
        return;
    }
    if (success) {
        // Success increases influence
        entity.catalyst.influence = Math.min(1.0, entity.catalyst.influence + magnitude);
    }
    else {
        // Failure decreases influence slightly
        entity.catalyst.influence = Math.max(0, entity.catalyst.influence - (magnitude * 0.5));
    }
}
//# sourceMappingURL=catalystHelpers.js.map