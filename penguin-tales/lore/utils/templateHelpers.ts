/**
 * Template Helpers
 *
 * Domain-agnostic helper functions for common template patterns.
 * These eliminate repetitive code across templates and can be
 * configured via parameters for UI-based DSL generation.
 *
 * NOTE: These are currently in the penguin domain but are designed
 * to be domain-agnostic. They will be promoted to the framework
 * once validated.
 */

import { TemplateGraphView, HardState, Relationship, pickRandom } from '@lore-weave/core';
import type { Point } from '@lore-weave/core';

// =============================================================================
// SATURATION CHECKING
// =============================================================================

/**
 * Configuration for saturation checking
 */
export interface SaturationConfig {
  /** Default target count if not found in distributionTargets */
  defaultTarget?: number;
  /** Multiplier for target to get saturation threshold (default: 1.5 = 50% overshoot) */
  overshootFactor?: number;
}

/**
 * Check if an entity type has reached saturation (too many exist).
 *
 * Pattern extracted from: heroEmergence, orcaRaiderArrival, magicDiscovery, cultFormation
 *
 * @param graphView - Template graph view
 * @param kind - Entity kind (e.g., 'npc')
 * @param subtype - Entity subtype (e.g., 'hero')
 * @param config - Optional configuration
 * @returns true if saturated (should suppress creation), false if can create more
 *
 * @example
 * ```typescript
 * if (isSaturated(graphView, 'npc', 'hero')) {
 *   return false; // Too many heroes, suppress creation
 * }
 * ```
 */
export function isSaturated(
  graphView: TemplateGraphView,
  kind: string,
  subtype: string,
  config?: SaturationConfig
): boolean {
  const defaultTarget = config?.defaultTarget ?? 20;
  const overshootFactor = config?.overshootFactor ?? 1.5;

  const existingCount = graphView.getEntityCount(kind, subtype);
  const targets = graphView.config.distributionTargets as Record<string, any> | undefined;

  // Navigate nested structure: targets.entities.kind.subtype.target
  const target = targets?.entities?.[kind]?.[subtype]?.target ?? defaultTarget;
  const saturationThreshold = target * overshootFactor;

  return existingCount >= saturationThreshold;
}

/**
 * Get the saturation ratio (current count / target).
 *
 * @param graphView - Template graph view
 * @param kind - Entity kind
 * @param subtype - Entity subtype
 * @param config - Optional configuration
 * @returns Ratio where 1.0 = at target, >1.0 = over target
 */
export function getSaturationRatio(
  graphView: TemplateGraphView,
  kind: string,
  subtype: string,
  config?: SaturationConfig
): number {
  const defaultTarget = config?.defaultTarget ?? 20;
  const existingCount = graphView.getEntityCount(kind, subtype);
  const targets = graphView.config.distributionTargets as Record<string, any> | undefined;
  const target = targets?.entities?.[kind]?.[subtype]?.target ?? defaultTarget;

  return target > 0 ? existingCount / target : existingCount;
}

// =============================================================================
// COORDINATE PLACEMENT
// =============================================================================

/**
 * Configuration for coordinate derivation
 */
export interface CoordinatePlacementConfig {
  /** Culture override (otherwise derived from reference entities) */
  cultureOverride?: string;
  /** Whether to throw on failure (default: true) */
  throwOnFailure?: boolean;
}

/**
 * Derive coordinates for a new entity with proper error handling.
 *
 * Pattern extracted from: heroEmergence, succession, cultFormation, guildEstablishment, etc.
 *
 * @param graphView - Template graph view
 * @param entityKind - Kind of entity being placed
 * @param referenceEntities - Entities to derive position from
 * @param templateId - Template ID for error messages
 * @param config - Optional configuration
 * @returns Coordinates object or throws/returns fallback if placement failed
 *
 * @example
 * ```typescript
 * const coords = requireCoordinates(
 *   graphView, 'npc', [colony], 'hero_emergence'
 * );
 * ```
 */
export function requireCoordinates(
  graphView: TemplateGraphView,
  entityKind: string,
  referenceEntities: HardState[],
  templateId: string,
  config?: CoordinatePlacementConfig
): Point {
  // Derive culture from reference entities or use override
  const cultureId = config?.cultureOverride
    ?? referenceEntities.find(e => e.culture)?.culture
    ?? 'default';

  const placementResult = graphView.deriveCoordinatesWithCulture(
    cultureId,
    entityKind,
    referenceEntities
  );

  if (!placementResult) {
    const refNames = referenceEntities.map(e => e.name).join(', ');
    const errorMsg = `${templateId}: Failed to derive coordinates for ${entityKind} ` +
      `near [${refNames}]. Ensure coordinate system is properly configured.`;

    if (config?.throwOnFailure !== false) {
      throw new Error(errorMsg);
    }
    // Return center as fallback
    return { x: 50, y: 50, z: 50 };
  }

  return placementResult.coordinates;
}

/**
 * Try to derive coordinates, returning undefined on failure (no throw).
 *
 * @param graphView - Template graph view
 * @param entityKind - Kind of entity being placed
 * @param referenceEntities - Entities to derive position from
 * @param cultureId - Culture ID for placement
 * @returns Coordinates object or undefined
 */
export function tryDeriveCoordinates(
  graphView: TemplateGraphView,
  entityKind: string,
  referenceEntities: HardState[],
  cultureId?: string
): Point | undefined {
  const culture = cultureId ?? referenceEntities.find(e => e.culture)?.culture ?? 'default';

  const placementResult = graphView.deriveCoordinatesWithCulture(
    culture,
    entityKind,
    referenceEntities
  );

  return placementResult?.coordinates;
}

// =============================================================================
// BIDIRECTIONAL RELATIONSHIPS
// =============================================================================

/**
 * Create a bidirectional relationship pair.
 *
 * Pattern extracted from: geographicExploration, resourceLocationDiscovery,
 * emergentLocationDiscovery, anomalyManifestation
 *
 * @param kind - Relationship kind (e.g., 'adjacent_to')
 * @param entity1Id - First entity ID (can be 'will-be-assigned-N')
 * @param entity2Id - Second entity ID
 * @returns Array of two relationships forming the bidirectional link
 *
 * @example
 * ```typescript
 * const adjacency = bidirectionalRelationship('adjacent_to', 'will-be-assigned-0', location.id);
 * relationships.push(...adjacency);
 * ```
 */
export function bidirectionalRelationship(
  kind: string,
  entity1Id: string,
  entity2Id: string
): [Relationship, Relationship] {
  return [
    { kind, src: entity1Id, dst: entity2Id },
    { kind, src: entity2Id, dst: entity1Id }
  ];
}

// =============================================================================
// ENTITY SELECTION
// =============================================================================

/**
 * Select entities by subtype preference order.
 *
 * Pattern extracted from: geographicExploration, resourceLocationDiscovery,
 * emergentLocationDiscovery
 *
 * @param graphView - Template graph view
 * @param kind - Entity kind to search
 * @param subtypePreferences - Ordered list of preferred subtypes
 * @param filter - Optional filter function
 * @returns Array of entities (first matching preference group, or all if none match)
 *
 * @example
 * ```typescript
 * // Prefer heroes, then merchants, then any alive NPC
 * const explorers = selectByPreference(
 *   graphView, 'npc', ['hero', 'merchant'],
 *   e => e.status === 'alive'
 * );
 * ```
 */
export function selectByPreference(
  graphView: TemplateGraphView,
  kind: string,
  subtypePreferences: string[],
  filter?: (entity: HardState) => boolean
): HardState[] {
  let entities = graphView.findEntities({ kind });

  // Apply filter if provided
  if (filter) {
    entities = entities.filter(filter);
  }

  // Try each subtype in preference order
  for (const subtype of subtypePreferences) {
    const matches = entities.filter(e => e.subtype === subtype);
    if (matches.length > 0) {
      return matches;
    }
  }

  // Return all matching entities if no preference matched
  return entities;
}

/**
 * Pick a single entity by preference order.
 *
 * @param graphView - Template graph view
 * @param kind - Entity kind to search
 * @param subtypePreferences - Ordered list of preferred subtypes
 * @param filter - Optional filter function
 * @returns Single entity or undefined
 */
export function pickByPreference(
  graphView: TemplateGraphView,
  kind: string,
  subtypePreferences: string[],
  filter?: (entity: HardState) => boolean
): HardState | undefined {
  const candidates = selectByPreference(graphView, kind, subtypePreferences, filter);
  return candidates.length > 0 ? pickRandom(candidates) : undefined;
}

// =============================================================================
// LINEAGE ESTABLISHMENT
// =============================================================================

/**
 * Configuration for lineage establishment
 */
export interface LineageConfig {
  /** Minimum distance for the relationship (0-1) */
  minDistance?: number;
  /** Maximum distance for the relationship (0-1) */
  maxDistance?: number;
  /** Relationship strength (0-1) */
  strength?: number;
  /** Filter to exclude certain entities from lineage pool */
  excludeFilter?: (entity: HardState) => boolean;
  /** Prefer entities from same location */
  preferSameLocation?: HardState;
}

/**
 * Establish lineage relationship to existing entities of the same type.
 *
 * Pattern extracted from: heroEmergence, magicDiscovery, orcaCombatTechnique, factionSplinter
 *
 * @param graphView - Template graph view
 * @param newEntityPlaceholder - Placeholder ID (e.g., 'will-be-assigned-0')
 * @param kind - Entity kind to link to
 * @param subtype - Entity subtype to link to
 * @param relationshipKind - Relationship kind (e.g., 'related_to', 'inspired_by')
 * @param config - Optional configuration
 * @returns Lineage relationship or null if no candidates found
 *
 * @example
 * ```typescript
 * const lineage = establishLineage(
 *   graphView,
 *   'will-be-assigned-0',
 *   'abilities', 'magic',
 *   'related_to',
 *   { minDistance: 0.5, maxDistance: 0.9, excludeFilter: e => e.status === 'lost' }
 * );
 * if (lineage) relationships.push(lineage);
 * ```
 */
export function establishLineage(
  graphView: TemplateGraphView,
  newEntityPlaceholder: string,
  kind: string,
  subtype: string,
  relationshipKind: string,
  config?: LineageConfig
): Relationship | null {
  const minDist = config?.minDistance ?? 0.3;
  const maxDist = config?.maxDistance ?? 0.7;
  const strength = config?.strength ?? 0.5;

  // Find existing entities of the same type
  let candidates = graphView.findEntities({ kind, subtype });

  // Apply exclusion filter
  if (config?.excludeFilter) {
    candidates = candidates.filter(e => !config.excludeFilter!(e));
  }

  if (candidates.length === 0) {
    return null;
  }

  // Prefer same-location entities if specified
  let selectedEntity: HardState | undefined;

  if (config?.preferSameLocation) {
    const refLocation = graphView.getLocation(config.preferSameLocation.id);
    if (refLocation) {
      const sameLocation = candidates.filter(c => {
        const loc = graphView.getLocation(c.id);
        return loc?.id === refLocation.id;
      });
      if (sameLocation.length > 0) {
        selectedEntity = pickRandom(sameLocation);
      }
    }
  }

  if (!selectedEntity) {
    selectedEntity = pickRandom(candidates);
  }

  const distance = minDist + Math.random() * (maxDist - minDist);

  return {
    kind: relationshipKind,
    src: newEntityPlaceholder,
    dst: selectedEntity.id,
    distance,
    strength
  };
}

// =============================================================================
// SPATIAL DISTANCE CALCULATIONS
// =============================================================================

/**
 * Calculate Euclidean distance between two points.
 *
 * @param p1 - First point
 * @param p2 - Second point
 * @returns Distance
 */
export function pointDistance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Check if a point is far enough from all existing points.
 *
 * Pattern extracted from: colonyFounding, anomalyManifestation
 *
 * @param point - Point to check
 * @param existingPoints - Array of existing points
 * @param minDistance - Minimum required distance
 * @returns true if point is far enough from all existing points
 */
export function isPointFarEnough(
  point: Point,
  existingPoints: Point[],
  minDistance: number
): boolean {
  return existingPoints.every(p => pointDistance(point, p) >= minDistance);
}

/**
 * Find entities within a distance of a reference entity.
 *
 * @param graphView - Template graph view
 * @param reference - Reference entity
 * @param maxDistance - Maximum distance
 * @param kind - Optional kind filter
 * @returns Entities within the distance
 */
export function findEntitiesWithinDistance(
  graphView: TemplateGraphView,
  reference: HardState,
  maxDistance: number,
  kind?: string
): HardState[] {
  if (!reference.coordinates) return [];

  const refPoint = reference.coordinates;
  const results: HardState[] = [];

  for (const entity of graphView.getEntities()) {
    if (entity.id === reference.id) continue;
    if (kind && entity.kind !== kind) continue;
    if (!entity.coordinates) continue;

    if (pointDistance(refPoint, entity.coordinates) <= maxDistance) {
      results.push(entity);
    }
  }

  return results;
}

// =============================================================================
// PRESSURE-BASED TRIGGERS
// =============================================================================

/**
 * Check if a pressure is within bounds (bidirectional threshold).
 *
 * Pattern extracted from: heroEmergence, magicDiscovery
 *
 * @param graphView - Template graph view
 * @param pressureId - Pressure ID to check
 * @param min - Minimum threshold (below this, returns false)
 * @param max - Maximum threshold (above this, reduced probability)
 * @param extremeChance - Probability to return true when above max (default: 0.3)
 * @returns true if pressure allows action
 *
 * @example
 * ```typescript
 * // Heroes emerge when conflict is 5-80, with 30% chance above 80
 * if (!isPressureInBounds(graphView, 'conflict', 5, 80, 0.3)) {
 *   return false;
 * }
 * ```
 */
export function isPressureInBounds(
  graphView: TemplateGraphView,
  pressureId: string,
  min: number,
  max: number,
  extremeChance?: number
): boolean {
  const pressure = graphView.getPressure(pressureId);

  if (pressure < min) {
    return false;
  }

  if (pressure > max) {
    const chance = extremeChance ?? 0.3;
    return Math.random() < chance;
  }

  return true;
}

// =============================================================================
// TEMPLATE RESULT HELPERS
// =============================================================================

/**
 * Create a failed template result (no entities or relationships created).
 *
 * @param description - Reason for failure
 * @returns Empty template result with description
 */
export function failedResult(description: string): {
  entities: never[];
  relationships: never[];
  description: string;
} {
  return {
    entities: [],
    relationships: [],
    description
  };
}

/**
 * Check if a template's region system is available and throw if not.
 *
 * @param graphView - Template graph view
 * @param templateId - Template ID for error messages
 * @throws Error if region system is not configured
 */
export function requireRegionSystem(
  graphView: TemplateGraphView,
  templateId: string
): void {
  if (!graphView.hasRegionSystem()) {
    throw new Error(
      `${templateId}: Region system is not configured. ` +
      `Cannot place entities without spatial coordinates.`
    );
  }
}
