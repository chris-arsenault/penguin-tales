import { SimulationSystem } from '../types/engine';
/**
 * Era Spawner System
 *
 * Framework-level system that ensures era entities exist in the graph.
 * Creates era entities from the config and establishes lineage relationships.
 *
 * Era Lifecycle:
 * 1. All eras are spawned at initialization with status='future'
 * 2. First era is immediately activated to status='current'
 * 3. Eras are connected via 'supersedes' lineage with distance=(tick difference / total ticks)
 * 4. eraTransition system handles transitions from current→next based on conditions
 *
 * This system only runs once to spawn eras if they don't exist.
 */
export declare const eraSpawner: SimulationSystem;
//# sourceMappingURL=eraSpawner.d.ts.map