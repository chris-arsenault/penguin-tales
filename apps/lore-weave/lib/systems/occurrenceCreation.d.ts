import { SimulationSystem } from '../types/engine';
/**
 * Occurrence Creation System
 *
 * Framework-level system that creates occurrence entities when domain-defined
 * conditions are met. Occurrences are second-order agents - created by first-order
 * agents, then they act with their own momentum.
 *
 * Examples:
 * - War: Faction conflicts reach threshold → war occurrence created → war escalates
 * - Magical Disaster: Corruption spreads → disaster occurrence → disaster spreads
 * - Cultural Movement: Ideology spreads → movement occurrence → movement converts factions
 * - Economic Boom: Trade routes abundant → boom occurrence → boom drives expansion
 */
export declare const occurrenceCreation: SimulationSystem;
//# sourceMappingURL=occurrenceCreation.d.ts.map