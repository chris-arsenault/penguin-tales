import { SimulationSystem, SystemResult, Graph } from '../types/engine';
import { HardState, Relationship } from '../types/worldTypes';
import {
  findEntities,
  getRelated,
  rollProbability,
  canFormRelationship,
  recordRelationshipFormation,
  areRelationshipsCompatible,
  hasRelationship,
  pickRandom,
  pickMultiple
} from '../utils/helpers';

/**
 * Thermal Cascade System
 *
 * Models heat diffusion through the iceberg's location graph using a discrete Laplacian.
 * Temperature changes propagate through adjacent_to relationships, triggering:
 * - Colony status changes (thriving→waning when too warm/cold)
 * - NPC migrations (resident_of changes)
 * - Ability discoveries (ice memory thaw reveals lost magic)
 *
 * Mathematical Foundation:
 * T_i(t+1) = T_i(t) + α * Σ_neighbors(T_j(t) - T_i(t)) / degree(i)
 *
 * Where:
 * - T is normalized temperature (0 = cold, 1 = warm)
 * - α = 0.1 (thermal diffusivity constant)
 * - neighbors = locations connected via adjacent_to
 *
 * SYSTEM_IMPLEMENTATION_GUIDE compliance:
 * - Throttled to run every 5 ticks (per spec)
 * - Uses cooldown checks for resident_of changes
 * - Caps probabilities at 0.95 for event triggers
 * - Tracks entity modifications properly
 */

// Extend Location entities with temperature state (stored in tags for persistence)
function getTemperature(location: HardState): number {
  const tempTag = location.tags.find(t => t.startsWith('temp:'));
  return tempTag ? parseFloat(tempTag.split(':')[1]) : 0.5; // Default to moderate
}

function setTemperature(location: HardState, temp: number): void {
  // Remove old temp tag and add new one
  location.tags = location.tags.filter(t => !t.startsWith('temp:'));
  location.tags.push(`temp:${temp.toFixed(3)}`);
  // Ensure tags stay <= 10
  if (location.tags.length > 10) {
    location.tags = location.tags.slice(-10);
  }
}

export const thermalCascade: SimulationSystem = {
  id: 'thermal_cascade',
  name: 'Thermal Dynamics',

  apply: (graph: Graph, modifier: number = 1.0): SystemResult => {
    const FREQUENCY = 5; // Run every 5 ticks
    const ALPHA = 0.1;   // Thermal diffusivity
    const THRESHOLD = 0.3; // Temperature change threshold for events

    // Throttle: Only run every 5 ticks
    if (graph.tick % FREQUENCY !== 0) {
      return {
        relationshipsAdded: [],
        entitiesModified: [],
        pressureChanges: {},
        description: 'Thermal cascade dormant'
      };
    }

    const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];
    const relationships: Relationship[] = [];
    const MIGRATION_COOLDOWN = 10; // Ticks between migrations

    // === STEP 1: Heat Diffusion ===
    const locations = findEntities(graph, { kind: 'location' });
    const temperatureUpdates = new Map<string, number>();

    // Calculate new temperatures using graph Laplacian
    locations.forEach(location => {
      const currentTemp = getTemperature(location);
      const neighbors = getRelated(graph, location.id, 'adjacent_to');

      if (neighbors.length === 0) {
        // Isolated locations maintain temperature
        temperatureUpdates.set(location.id, currentTemp);
        return;
      }

      // Calculate Laplacian: Σ_neighbors(T_j - T_i) / degree
      let laplacian = 0;
      neighbors.forEach(neighbor => {
        const neighborTemp = getTemperature(neighbor);
        laplacian += (neighborTemp - currentTemp);
      });
      laplacian /= neighbors.length;

      // Update temperature: T_new = T_old + α * Laplacian
      const newTemp = Math.max(0, Math.min(1, currentTemp + ALPHA * laplacian));
      temperatureUpdates.set(location.id, newTemp);
    });

    // Apply temperature updates and detect threshold crossings
    const significantChanges: Array<{ location: HardState; oldTemp: number; newTemp: number }> = [];

    temperatureUpdates.forEach((newTemp, locationId) => {
      const location = graph.entities.get(locationId);
      if (!location) return;

      const oldTemp = getTemperature(location);
      const tempChange = Math.abs(newTemp - oldTemp);

      // Only update temperature tag if it deviates significantly from default (0.5)
      // This prevents cluttering tags with temp:0.500 on unchanged locations
      if (Math.abs(newTemp - 0.5) > 0.05) {
        setTemperature(location, newTemp);
        modifications.push({
          id: location.id,
          changes: { tags: location.tags }
        });
      }

      // Track significant changes for event triggering
      if (tempChange >= THRESHOLD) {
        significantChanges.push({ location, oldTemp, newTemp });
      }
    });

    // === STEP 2: Trigger Thermal Events ===
    significantChanges.forEach(({ location, oldTemp, newTemp }) => {
      const warming = newTemp > oldTemp;

      // === EVENT A: Colony Status Changes ===
      if (location.subtype === 'colony') {
        // Extreme temperatures cause colonies to wane
        if ((newTemp > 0.8 || newTemp < 0.2) && location.status === 'thriving') {
          modifications.push({
            id: location.id,
            changes: {
              status: 'waning',
              description: `${location.description} ${warming ? 'Warming ice threatens the colony\'s foundations.' : 'Extreme cold makes survival difficult.'}`
            }
          });
        }
        // Moderate temperatures allow recovery
        else if (newTemp >= 0.3 && newTemp <= 0.7 && location.status === 'waning') {
          const recoveryChance = Math.min(0.95, 0.3 * modifier);
          if (rollProbability(recoveryChance, modifier)) {
            modifications.push({
              id: location.id,
              changes: {
                status: 'thriving',
                description: `${location.description} Stabilizing temperatures allow the colony to recover.`
              }
            });
          }
        }
      }

      // === EVENT B: NPC Migrations ===
      // NPCs flee extreme temperatures, seek moderate zones
      const residents = getRelated(graph, location.id, 'resident_of', 'dst');
      const extremeTemp = newTemp > 0.85 || newTemp < 0.15;

      if (extremeTemp && residents.length > 0) {
        // Find moderate temperature refuges
        const allLocations = findEntities(graph, { kind: 'location' });
        const refuges = allLocations.filter(loc => {
          const temp = getTemperature(loc);
          return temp >= 0.3 && temp <= 0.7 && loc.id !== location.id;
        });

        if (refuges.length > 0) {
          // Migrate 1-2 NPCs
          const migrantCount = Math.min(2, residents.length);
          const migrants = pickMultiple(residents.filter(npc => npc.status === 'alive'), migrantCount);

          migrants.forEach(migrant => {
            // Check cooldown before migrating
            if (!canFormRelationship(graph, migrant.id, 'resident_of', MIGRATION_COOLDOWN)) {
              return;
            }

            const refuge = pickRandom(refuges);

            // Remove old resident_of, add new one
            // Note: This creates a new relationship; old one removed by graph normalization
            const migrationChance = Math.min(0.95, 0.5 * modifier);
            if (rollProbability(migrationChance, modifier)) {
              relationships.push({
                kind: 'resident_of',
                src: migrant.id,
                dst: refuge.id
              });

              recordRelationshipFormation(graph, migrant.id, 'resident_of');
            }
          });
        }
      }

      // === EVENT C: Ability Discoveries (Ice Memory Thaw) ===
      // Warming reveals frozen artifacts/abilities
      if (warming && newTemp > 0.6) {
        const discoveries = Math.floor(Math.random() * 2); // 0-1 discoveries

        for (let i = 0; i < discoveries; i++) {
          const discoveryChance = Math.min(0.95, 0.1 * modifier);
          if (rollProbability(discoveryChance, modifier)) {
            // Find existing abilities that could manifest here
            const abilities = findEntities(graph, { kind: 'abilities', status: 'active' });
            if (abilities.length > 0) {
              const ability = pickRandom(abilities);

              // Check if ability already manifests here
              if (!hasRelationship(graph, ability.id, location.id, 'manifests_at')) {
                relationships.push({
                  kind: 'manifests_at',
                  src: ability.id,
                  dst: location.id
                });
              }
            }
          }
        }
      }
    });

    // === STEP 3: Pressure Changes ===
    // Extreme thermal events increase conflict and instability
    const pressureChanges: Record<string, number> = {};
    if (significantChanges.length > 2) {
      pressureChanges['conflict'] = 5; // Displacement increases conflict
      pressureChanges['stability'] = -10; // Instability rises
    }

    return {
      relationshipsAdded: relationships,
      entitiesModified: modifications,
      pressureChanges,
      description: significantChanges.length > 0
        ? `Thermal cascade: ${significantChanges.length} locations experience significant temperature shifts`
        : 'Iceberg temperatures stabilizing'
    };
  }
};
