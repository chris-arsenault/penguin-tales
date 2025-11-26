import { SimulationSystem } from '../types/engine';
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
export declare const universalCatalyst: SimulationSystem;
//# sourceMappingURL=universalCatalyst.d.ts.map