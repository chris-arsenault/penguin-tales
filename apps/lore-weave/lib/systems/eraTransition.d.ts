import { SimulationSystem } from '../types/engine';
/**
 * Era Transition System
 *
 * Framework-level system that transitions between era entities based on
 * world state and domain-defined transition conditions.
 *
 * Eras are HardState entities (not just config objects) that exist in the graph.
 * They have status: 'past' | 'current' | 'future' and can be referenced in relationships.
 *
 * Transition Logic:
 * 1. Get current era entity (status: 'current')
 * 2. Check domain-defined transition conditions
 * 3. If met, update current era status to 'past', next era to 'current'
 * 4. Create historical event for era transition
 * 5. Apply era-specific effects (optional)
 */
export declare const eraTransition: SimulationSystem;
//# sourceMappingURL=eraTransition.d.ts.map