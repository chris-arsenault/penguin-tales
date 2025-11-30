/**
 * Strategy Executors
 *
 * Executable implementations of template strategies.
 * These functions implement the strategy interfaces defined in templateStrategies.ts
 */

import {
  TemplateGraphView,
  HardState,
  Relationship,
  pickRandom,
  extractParams,
  Prominence
} from '@lore-weave/core';
import type { Point } from '@lore-weave/core';
import type { GrowthTemplate } from '@lore-weave/core';

// =============================================================================
// STEP 1: APPLICABILITY EXECUTORS
// =============================================================================

/**
 * Check if pressure is within specified bounds.
 * Returns false if below min, probabilistic if above max.
 */
export function checkPressureThreshold(
  graphView: TemplateGraphView,
  pressureId: string,
  min: number,
  max: number,
  extremeChance: number = 0.3
): boolean {
  const pressure = graphView.getPressure(pressureId) || 0;

  if (pressure < min) {
    return false;
  }

  if (pressure > max) {
    return Math.random() < extremeChance;
  }

  return true;
}

/**
 * Check if any of the specified pressures exceeds threshold.
 */
export function checkAnyPressureAbove(
  graphView: TemplateGraphView,
  pressureIds: string[],
  threshold: number
): boolean {
  return pressureIds.some(id => (graphView.getPressure(id) || 0) > threshold);
}

/**
 * Check if entity count is at or below saturation threshold.
 */
export function checkNotSaturated(
  graphView: TemplateGraphView,
  kind: string,
  subtype?: string,
  defaultTarget: number = 20,
  overshootFactor: number = 1.5
): boolean {
  const existingCount = graphView.getEntityCount(kind, subtype);
  const targets = graphView.config.distributionTargets as Record<string, any> | undefined;

  let target = defaultTarget;
  if (subtype) {
    target = targets?.entities?.[kind]?.[subtype]?.target ?? defaultTarget;
  } else {
    target = targets?.entities?.[kind]?.target ?? defaultTarget;
  }

  const saturationThreshold = target * overshootFactor;
  return existingCount < saturationThreshold;
}

/**
 * Check if entity count meets minimum requirement.
 * If kind is undefined, checks total entity count.
 */
export function checkEntityCountMin(
  graphView: TemplateGraphView,
  kind: string | undefined,
  subtype: string | undefined,
  min: number
): boolean {
  if (kind === undefined) {
    return graphView.getEntityCount() >= min;
  }
  return graphView.getEntityCount(kind, subtype) >= min;
}

/**
 * Check if current era matches one of the allowed eras.
 */
export function checkEraMatch(
  graphView: TemplateGraphView,
  allowedEras: string[]
): boolean {
  return allowedEras.includes(graphView.currentEra.id);
}

/**
 * Check if enough time has passed since last discovery.
 */
export function checkDiscoveryCooldown(
  graphView: TemplateGraphView,
  cooldownTicks: number
): boolean {
  const ticksSince = graphView.tick - graphView.discoveryState.lastDiscoveryTick;
  return ticksSince >= cooldownTicks;
}

/**
 * Check discoveries per epoch limit.
 */
export function checkDiscoveriesPerEpoch(
  graphView: TemplateGraphView,
  maxPerEpoch: number
): boolean {
  return graphView.discoveryState.discoveriesThisEpoch < maxPerEpoch;
}

/**
 * Random chance check.
 */
export function checkRandomChance(chance: number): boolean {
  return Math.random() < chance;
}

// =============================================================================
// STEP 2: SELECTION EXECUTORS
// =============================================================================

/**
 * Select entities by kind and optional subtype filter.
 */
export function selectByKind(
  graphView: TemplateGraphView,
  kind: string,
  subtypes?: string[],
  statusFilter?: string
): HardState[] {
  let entities = graphView.findEntities({ kind });

  if (statusFilter) {
    entities = entities.filter(e => e.status === statusFilter);
  }

  if (subtypes && subtypes.length > 0) {
    entities = entities.filter(e => subtypes.includes(e.subtype));
  }

  return entities;
}

/**
 * Select entities by subtype preference order.
 * Returns first non-empty group matching preference order.
 */
export function selectByPreferenceOrder(
  graphView: TemplateGraphView,
  kind: string,
  subtypePreferences: string[],
  statusFilter?: string
): HardState[] {
  let entities = graphView.findEntities({ kind });

  if (statusFilter) {
    entities = entities.filter(e => e.status === statusFilter);
  }

  for (const subtype of subtypePreferences) {
    const matches = entities.filter(e => e.subtype === subtype);
    if (matches.length > 0) {
      return matches;
    }
  }

  return entities;
}

/**
 * Select entities that have (or lack) a specific relationship.
 */
export function selectByRelationship(
  graphView: TemplateGraphView,
  kind: string,
  relationshipKind: string,
  mustHave: boolean,
  direction: 'src' | 'dst' | 'any' = 'any'
): HardState[] {
  const entities = graphView.findEntities({ kind });

  return entities.filter(entity => {
    const hasRel = entity.links.some(link => {
      if (link.kind !== relationshipKind) return false;
      if (direction === 'src') return link.src === entity.id;
      if (direction === 'dst') return link.dst === entity.id;
      return true;
    });

    return mustHave ? hasRel : !hasRel;
  });
}

/**
 * Select entities within distance of a reference entity.
 */
export function selectByProximity(
  graphView: TemplateGraphView,
  kind: string,
  referenceEntity: HardState,
  maxDistance: number
): HardState[] {
  if (!referenceEntity.coordinates) return [];

  const results: HardState[] = [];
  const refCoords = referenceEntity.coordinates;

  for (const entity of graphView.findEntities({ kind })) {
    if (entity.id === referenceEntity.id) continue;
    if (!entity.coordinates) continue;

    const dx = entity.coordinates.x - refCoords.x;
    const dy = entity.coordinates.y - refCoords.y;
    const dz = entity.coordinates.z - refCoords.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist <= maxDistance) {
      results.push(entity);
    }
  }

  return results;
}

/**
 * Select entities by prominence level.
 */
export function selectByProminence(
  graphView: TemplateGraphView,
  kind: string,
  minProminence: string
): HardState[] {
  const prominenceOrder = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];
  const minIndex = prominenceOrder.indexOf(minProminence);

  if (minIndex === -1) {
    return graphView.findEntities({ kind });
  }

  return graphView.findEntities({ kind }).filter(entity => {
    const entityIndex = prominenceOrder.indexOf(entity.prominence);
    return entityIndex >= minIndex;
  });
}

/**
 * Pick single entity using preference order.
 */
export function pickByPreferenceOrder(
  graphView: TemplateGraphView,
  kind: string,
  subtypePreferences: string[],
  statusFilter?: string
): HardState | undefined {
  const candidates = selectByPreferenceOrder(graphView, kind, subtypePreferences, statusFilter);
  return candidates.length > 0 ? pickRandom(candidates) : undefined;
}

// =============================================================================
// STEP 3: CREATION EXECUTORS
// =============================================================================

/**
 * Derive coordinates for a new entity near reference entities.
 */
export function deriveCoordinatesNearReference(
  graphView: TemplateGraphView,
  entityKind: string,
  referenceEntities: HardState[],
  cultureOverride?: string
): Point {
  const cultureId = cultureOverride
    ?? referenceEntities.find(e => e.culture)?.culture
    ?? 'default';

  const placementResult = graphView.deriveCoordinatesWithCulture(
    cultureId,
    entityKind,
    referenceEntities
  );

  if (!placementResult) {
    // Fallback to center with jitter
    return {
      x: 50 + (Math.random() - 0.5) * 20,
      y: 50 + (Math.random() - 0.5) * 20,
      z: 50
    };
  }

  return placementResult.coordinates;
}

/**
 * Apply z-axis adjustment (e.g., underwater placement).
 */
export function applyZAdjustment(
  coords: Point,
  zRange: { min: number; max: number }
): Point {
  return {
    ...coords,
    z: zRange.min + Math.random() * (zRange.max - zRange.min)
  };
}

/**
 * Create entity partial with standard attributes.
 */
export function createEntityPartial(
  kind: string,
  subtype: string,
  options: {
    status?: string;
    prominence?: Prominence;
    culture?: string;
    description?: string;
    tags?: Record<string, boolean>;
    coordinates?: Point;
  }
): Partial<HardState> {
  return {
    kind,
    subtype,
    status: options.status ?? 'active',
    prominence: options.prominence ?? 'marginal',
    culture: options.culture,
    description: options.description ?? '',
    tags: options.tags ?? {},
    coordinates: options.coordinates,
    links: []
  };
}

/**
 * Find existing entities for lineage, optionally preferring same location.
 */
export function findLineageCandidates(
  graphView: TemplateGraphView,
  kind: string,
  subtype: string,
  excludeStatuses?: string[],
  preferLocation?: HardState
): HardState[] {
  let candidates = graphView.findEntities({ kind, subtype });

  if (excludeStatuses && excludeStatuses.length > 0) {
    candidates = candidates.filter(e => !excludeStatuses.includes(e.status));
  }

  if (preferLocation && candidates.length > 0) {
    const refLocation = graphView.getLocation(preferLocation.id);
    if (refLocation) {
      const sameLocation = candidates.filter(c => {
        const loc = graphView.getLocation(c.id);
        return loc?.id === refLocation.id;
      });
      if (sameLocation.length > 0) {
        return sameLocation;
      }
    }
  }

  return candidates;
}

/**
 * Generate random count within range.
 */
export function randomCount(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// =============================================================================
// STEP 4: RELATIONSHIP EXECUTORS
// =============================================================================

/**
 * Create a single relationship.
 */
export function createRelationship(
  kind: string,
  src: string,
  dst: string,
  options?: {
    distance?: number;
    strength?: number;
  }
): Relationship {
  const rel: Relationship = { kind, src, dst };

  if (options?.distance !== undefined) {
    rel.distance = options.distance;
  }
  if (options?.strength !== undefined) {
    rel.strength = options.strength;
  }

  return rel;
}

/**
 * Create bidirectional relationship pair.
 */
export function createBidirectionalRelationship(
  kind: string,
  entity1Id: string,
  entity2Id: string
): [Relationship, Relationship] {
  return [
    { kind, src: entity1Id, dst: entity2Id },
    { kind, src: entity2Id, dst: entity1Id }
  ];
}

/**
 * Create lineage relationship with random distance in range.
 */
export function createLineageRelationship(
  kind: string,
  newEntityPlaceholder: string,
  existingEntityId: string,
  distanceRange: { min: number; max: number },
  strength?: number
): Relationship {
  const distance = distanceRange.min + Math.random() * (distanceRange.max - distanceRange.min);

  return {
    kind,
    src: newEntityPlaceholder,
    dst: existingEntityId,
    distance,
    strength: strength ?? 0.5
  };
}

/**
 * Find nearby locations for adjacency relationships.
 */
export function findNearbyLocationsForAdjacency(
  graphView: TemplateGraphView,
  referenceEntity: HardState
): HardState[] {
  // Check for residence relationship
  const residenceRel = referenceEntity.links.find(
    l => l.kind === 'resident_of' || l.kind === 'leader_of'
  );

  if (!residenceRel) {
    return graphView.findEntities({ kind: 'location' });
  }

  const residence = graphView.getEntity(residenceRel.dst);
  if (!residence) {
    return graphView.findEntities({ kind: 'location' });
  }

  // Find adjacent locations
  const adjacentLocations = residence.links
    .filter(l => l.kind === 'adjacent_to')
    .map(l => graphView.getEntity(l.dst))
    .filter((loc): loc is HardState => !!loc && loc.kind === 'location');

  if (adjacentLocations.length > 0) {
    return adjacentLocations;
  }

  return graphView.findEntities({ kind: 'location' });
}

// =============================================================================
// STEP 5: STATE UPDATE EXECUTORS
// =============================================================================

/**
 * Update discovery state after location creation.
 */
export function updateDiscoveryState(graphView: TemplateGraphView): void {
  graphView.discoveryState.lastDiscoveryTick = graphView.tick;
  graphView.discoveryState.discoveriesThisEpoch += 1;
}

// =============================================================================
// TEMPLATE RESULT HELPERS
// =============================================================================

/**
 * Create a failed/empty template result.
 */
export function emptyResult(description: string): {
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
 * Create a successful template result.
 */
export function templateResult(
  entities: Partial<HardState>[],
  relationships: Relationship[],
  description: string
): {
  entities: Partial<HardState>[];
  relationships: Relationship[];
  description: string;
} {
  return { entities, relationships, description };
}

// =============================================================================
// PROCEDURAL THEME GENERATION
// =============================================================================

export interface ThemeOption {
  subtype: string;
  themes: string[];
  tags: Record<string, boolean>;
  descriptionTemplate: string;
}

/**
 * Select theme based on pressure dominance.
 */
export function selectThemeByPressure(
  graphView: TemplateGraphView,
  pressureThemes: Record<string, ThemeOption>
): ThemeOption | undefined {
  const pressures = Object.keys(pressureThemes).map(id => ({
    id,
    value: graphView.getPressure(id) || 0
  }));

  pressures.sort((a, b) => b.value - a.value);

  const dominant = pressures[0];
  if (dominant && dominant.value > 0) {
    return pressureThemes[dominant.id];
  }

  // Random fallback
  const keys = Object.keys(pressureThemes);
  if (keys.length > 0) {
    return pressureThemes[pickRandom(keys)];
  }

  return undefined;
}

/**
 * Generate description from template with entity names.
 */
export function generateDescription(
  template: string,
  replacements: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

// =============================================================================
// DISTANCE/SPATIAL EXECUTORS
// =============================================================================

/**
 * Calculate Euclidean distance between two points.
 */
export function pointDistance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Check if a point is far enough from all reference points.
 */
export function isPointFarEnough(
  point: Point,
  referencePoints: Point[],
  minDistance: number
): boolean {
  return referencePoints.every(refPoint => {
    const dx = point.x - refPoint.x;
    const dy = point.y - refPoint.y;
    return Math.sqrt(dx * dx + dy * dy) >= minDistance;
  });
}

/**
 * Find entities within distance of a reference point.
 */
export function findEntitiesWithinDistance(
  graphView: TemplateGraphView,
  kind: string,
  referencePoint: Point,
  maxDistance: number
): HardState[] {
  return graphView.findEntities({ kind }).filter(entity => {
    if (!entity.coordinates) return false;
    return pointDistance(entity.coordinates, referencePoint) <= maxDistance;
  });
}
