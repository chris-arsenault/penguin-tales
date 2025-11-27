import { Graph } from '../types/engine';
import { HardState, Relationship, EntityTags } from '../types/worldTypes';
import { TargetSelector } from './targetSelector';
import { RegionMapper } from './regionMapper';
import { RegionPlacementService } from './regionPlacement';
import { addEntity, mergeTags, hasTag } from '../utils/helpers';
import type {
  Point,
  Region,
  RegionMapperConfig,
  RegionLookupResult,
  EmergentRegionResult
} from '../types/regions';

/**
 * TemplateGraphView
 *
 * A restricted view of the Graph provided to templates during expansion.
 * This wrapper enforces correct entity selection patterns by:
 *
 * 1. Providing only read-only access to graph state
 * 2. Exposing targetSelector as the PRIMARY entity selection mechanism
 * 3. Hiding direct access to entities Map (preventing ad-hoc selection)
 * 4. Providing safe query methods for graph inspection
 *
 * Benefits:
 * - Compile-time guarantee that templates use targetSelector
 * - No more ad-hoc findEntities() calls that create super-hubs
 * - Clearer API surface for template authors
 * - Easier to maintain and refactor framework internals
 */
export class TemplateGraphView {
  private graph: Graph;
  public readonly targetSelector: TargetSelector;

  // Region-based coordinate system (initialized if domain provides regionConfig)
  private regionMapper: RegionMapper | null = null;
  private regionPlacement: RegionPlacementService | null = null;

  constructor(graph: Graph, targetSelector: TargetSelector) {
    this.graph = graph;
    this.targetSelector = targetSelector;

    // Initialize region system if domain provides configuration
    const regionConfig = (graph.config.domain as { regionConfig?: RegionMapperConfig }).regionConfig;
    if (regionConfig) {
      this.regionMapper = new RegionMapper(regionConfig);
      this.regionPlacement = new RegionPlacementService(this.regionMapper);
    }
  }

  // ============================================================================
  // TARGET SELECTION (PRIMARY INTERFACE)
  // ============================================================================

  /**
   * Select targets using intelligent hub-aware selection
   * This is the RECOMMENDED way to select entities for connections
   *
   * Wraps targetSelector.selectTargets() to hide internal graph access
   */
  selectTargets(
    kind: string,
    count: number,
    bias: import('./targetSelector').SelectionBias
  ): import('./targetSelector').SelectionResult {
    // Delegate to targetSelector with internal graph access
    return this.targetSelector.selectTargets(this.graph, kind, count, bias);
  }

  // ============================================================================
  // READ-ONLY GRAPH STATE
  // ============================================================================

  /** Current simulation tick */
  get tick(): number {
    return this.graph.tick;
  }

  /** Current era */
  get currentEra() {
    return this.graph.currentEra;
  }

  /** Current pressure values (read-only) */
  getPressure(pressureId: string): number {
    return this.graph.pressures.get(pressureId) || 0;
  }

  /** Get all pressure values as read-only map */
  getAllPressures(): ReadonlyMap<string, number> {
    return this.graph.pressures;
  }

  /** Get engine configuration (read-only) */
  get config() {
    return this.graph.config;
  }

  /** Get discovery state (for location templates) */
  get discoveryState() {
    return this.graph.discoveryState;
  }

  /**
   * Get direct access to the internal graph.
   * Use when you need full graph access beyond what TemplateGraphView provides.
   */
  getInternalGraph(): Graph {
    return this.graph;
  }

  // ============================================================================
  // SAFE ENTITY QUERIES (NO DIRECT MAP ACCESS)
  // ============================================================================

  /**
   * Get a specific entity by ID (returns undefined if not found)
   * Safe for templates to check specific entities they already know about
   */
  getEntity(id: string): HardState | undefined {
    return this.graph.getEntity(id);
  }

  /**
   * Check if an entity exists
   */
  hasEntity(id: string): boolean {
    return this.graph.getEntity(id) !== undefined;
  }

  /**
   * Get total entity count (useful for canApply checks)
   */
  getEntityCount(kind?: string, subtype?: string): number {
    if (!kind) {
      return this.graph.getEntityCount();
    }

    let count = 0;
    for (const entity of this.graph.getEntities()) {
      if (entity.kind === kind && (!subtype || entity.subtype === subtype)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Find entities matching criteria
   *
   * NOTE: Use sparingly for canApply() checks and validation logic.
   * For entity SELECTION, use targetSelector.selectTargets() instead
   * to ensure proper hub-aware distribution.
   */
  findEntities(criteria: {
    kind?: string;
    subtype?: string;
    status?: string;
    prominence?: string;
    tag?: string;
  }): HardState[] {
    const results: HardState[] = [];

    for (const entity of this.graph.getEntities()) {
      let matches = true;

      if (criteria.kind && entity.kind !== criteria.kind) matches = false;
      if (criteria.subtype && entity.subtype !== criteria.subtype) matches = false;
      if (criteria.status && entity.status !== criteria.status) matches = false;
      if (criteria.prominence && entity.prominence !== criteria.prominence) matches = false;
      if (criteria.tag && !hasTag(entity.tags, criteria.tag)) matches = false;

      if (matches) results.push(entity);
    }

    return results;
  }

  /**
   * Get all relationships in the graph (read-only)
   */
  getAllRelationships(): readonly Relationship[] {
    return this.graph.getRelationships();
  }

  /**
   * Get relationships for a specific entity
   */
  getRelationships(entityId: string, kind?: string): Relationship[] {
    const entity = this.graph.getEntity(entityId);
    if (!entity) return [];

    if (kind) {
      return entity.links.filter(link => link.kind === kind);
    }
    return [...entity.links];
  }

  /**
   * Get entities related to a specific entity
   */
  getRelatedEntities(entityId: string, relationshipKind?: string, direction?: 'src' | 'dst' | 'both'): HardState[] {
    const entity = this.graph.getEntity(entityId);
    if (!entity) return [];

    const related: HardState[] = [];
    const dir = direction || 'both';

    for (const link of entity.links) {
      if (relationshipKind && link.kind !== relationshipKind) continue;

      if ((dir === 'src' || dir === 'both') && link.src === entityId) {
        const target = this.graph.getEntity(link.dst);
        if (target) related.push(target);
      }
      if ((dir === 'dst' || dir === 'both') && link.dst === entityId) {
        const source = this.graph.getEntity(link.src);
        if (source) related.push(source);
      }
    }

    return related;
  }

  /**
   * Check if a relationship exists between two entities
   */
  hasRelationship(srcId: string, dstId: string, kind?: string): boolean {
    const src = this.graph.getEntity(srcId);
    if (!src) return false;

    return src.links.some(link => {
      const kindMatches = !kind || link.kind === kind;
      const targetMatches = link.dst === dstId || link.src === dstId;
      return kindMatches && targetMatches;
    });
  }

  /**
   * Get relationship cooldown remaining ticks
   * Returns 0 if no cooldown, otherwise ticks remaining
   */
  getRelationshipCooldown(entityId: string, relationshipType: string): number {
    const cooldownMap = this.graph.relationshipCooldowns.get(entityId);
    if (!cooldownMap) return 0;

    const lastFormationTick = cooldownMap.get(relationshipType);
    if (lastFormationTick === undefined) return 0;

    const cooldownPeriod = 10; // Same as defined in worldEngine
    const ticksSinceFormation = this.graph.tick - lastFormationTick;
    const ticksRemaining = cooldownPeriod - ticksSinceFormation;

    return Math.max(0, ticksRemaining);
  }

  /**
   * Check if an entity can form a new relationship of a given type
   * (respects cooldowns)
   */
  canFormRelationship(entityId: string, relationshipType: string): boolean {
    return this.getRelationshipCooldown(entityId, relationshipType) === 0;
  }

  // ============================================================================
  // HELPER METHODS (DOMAIN-AGNOSTIC)
  // ============================================================================

  /**
   * Get the location of an entity (follows 'resident_of' or 'located_at' links)
   */
  getLocation(entityId: string): HardState | undefined {
    const entity = this.graph.getEntity(entityId);
    if (!entity) return undefined;

    const locationLink = entity.links.find(
      link => link.kind === 'resident_of' || link.kind === 'located_at'
    );

    if (!locationLink) return undefined;

    const locationId = locationLink.src === entityId ? locationLink.dst : locationLink.src;
    return this.graph.getEntity(locationId);
  }

  /**
   * Get all members of a faction (follows 'member_of' links in reverse)
   */
  getFactionMembers(factionId: string): HardState[] {
    const members: HardState[] = [];

    for (const entity of this.graph.getEntities()) {
      if (entity.links.some(link => link.kind === 'member_of' && link.dst === factionId)) {
        members.push(entity);
      }
    }

    return members;
  }

  /**
   * Get the leader of a faction (follows 'leader_of' link in reverse)
   */
  getFactionLeader(factionId: string): HardState | undefined {
    for (const entity of this.graph.getEntities()) {
      if (entity.links.some(link => link.kind === 'leader_of' && link.dst === factionId)) {
        return entity;
      }
    }
    return undefined;
  }

  // ============================================================================
  // COORDINATE OPERATIONS (Simple Point-based)
  // ============================================================================

  /**
   * Calculate Euclidean distance between two entities.
   * Returns undefined if either entity lacks coordinates.
   */
  getDistance(entity1: HardState, entity2: HardState): number | undefined {
    const c1 = entity1.coordinates;
    const c2 = entity2.coordinates;
    if (!c1 || !c2 || typeof c1.x !== 'number' || typeof c2.x !== 'number') {
      return undefined;
    }
    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;
    const dz = (c1.z ?? 50) - (c2.z ?? 50);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Find entities nearest to a reference entity.
   * Filters by kind.
   */
  findNearestEntities(
    referenceEntity: HardState,
    targetKind: string,
    limit?: number
  ): Array<{ entity: HardState; distance: number }> {
    const refCoord = referenceEntity.coordinates;
    if (!refCoord || typeof refCoord.x !== 'number') return [];

    const results: Array<{ entity: HardState; distance: number }> = [];

    for (const entity of this.graph.getEntities()) {
      if (entity.kind !== targetKind) continue;
      if (entity.id === referenceEntity.id) continue;

      const dist = this.getDistance(referenceEntity, entity);
      if (dist !== undefined) {
        results.push({ entity, distance: dist });
      }
    }

    results.sort((a, b) => a.distance - b.distance);
    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Find all entities within a radius of a reference entity.
   */
  findEntitiesInRadius(
    referenceEntity: HardState,
    radius: number,
    targetKind?: string
  ): Array<{ entity: HardState; distance: number }> {
    const refCoord = referenceEntity.coordinates;
    if (!refCoord || typeof refCoord.x !== 'number') return [];

    const results: Array<{ entity: HardState; distance: number }> = [];

    for (const entity of this.graph.getEntities()) {
      if (targetKind && entity.kind !== targetKind) continue;
      if (entity.id === referenceEntity.id) continue;

      const dist = this.getDistance(referenceEntity, entity);
      if (dist !== undefined && dist <= radius) {
        results.push({ entity, distance: dist });
      }
    }

    results.sort((a, b) => a.distance - b.distance);
    return results;
  }

  /**
   * Get coordinates for a new entity based on related entities.
   * Computes centroid if multiple references, or places near if one.
   *
   * Each entity kind has its own 2D coordinate map. Coordinates are simple
   * Point {x, y, z} values within that kind's map.
   *
   * @param referenceEntities - Entities to derive position from
   * @param _newEntityKind - (deprecated, unused) Entity kind for the new entity
   * @param _spaceId - (deprecated, unused) Coordinate space ID
   * @param options - Placement options (maxDistance, minDistance)
   * @returns Point coordinates or undefined if placement fails
   */
  deriveCoordinates(
    referenceEntities: HardState[],
    _newEntityKind?: string,
    _spaceId?: string,
    options?: { maxDistance?: number; minDistance?: number }
  ): Point | undefined {
    // No references - return center of map
    if (referenceEntities.length === 0) {
      return { x: 50, y: 50, z: 50 };
    }

    // Collect coordinates from reference entities - only valid numeric coordinates
    const points: Point[] = [];
    for (const ref of referenceEntities) {
      const coords = ref.coordinates;
      if (coords && typeof coords.x === 'number' && typeof coords.y === 'number') {
        points.push({
          x: coords.x,
          y: coords.y,
          z: typeof coords.z === 'number' ? coords.z : 50
        });
      }
    }

    if (points.length === 0) {
      return { x: 50, y: 50, z: 50 };
    }

    // Compute centroid of all reference points
    const centroid: Point = {
      x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
      y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
      z: points.reduce((sum, p) => sum + p.z, 0) / points.length
    };

    // If regionPlacement is available, use it to place near centroid with spacing
    if (this.regionPlacement) {
      const maxDistance = (options?.maxDistance ?? 0.3) * 100; // Convert to coordinate units
      const minDistance = (options?.minDistance ?? 0.05) * 100;

      const result = this.regionPlacement.placeNear(
        centroid,
        [], // No existing points to avoid for now
        minDistance,
        maxDistance
      );

      if (result.success && result.point) {
        return result.point;
      }
    }

    // Fallback: add small random offset to centroid
    const offset = (options?.minDistance ?? 0.05) * 100;
    return {
      x: Math.max(0, Math.min(100, centroid.x + (Math.random() - 0.5) * offset * 2)),
      y: Math.max(0, Math.min(100, centroid.y + (Math.random() - 0.5) * offset * 2)),
      z: Math.max(0, Math.min(100, centroid.z + (Math.random() - 0.5) * offset * 2))
    };
  }

  // ============================================================================
  // REGION-BASED PLACEMENT (Simplified Narrative Coordinates)
  // ============================================================================

  /**
   * Check if region system is available.
   * Returns true if domain provided regionConfig.
   */
  hasRegionSystem(): boolean {
    return this.regionMapper !== null;
  }

  /**
   * Get the RegionMapper instance (for advanced region operations).
   * Returns null if region system is not configured.
   */
  getRegionMapper(): RegionMapper | null {
    return this.regionMapper;
  }

  /**
   * Get a region by ID.
   */
  getRegion(regionId: string): Region | undefined {
    return this.regionMapper?.getRegion(regionId);
  }

  /**
   * Get all registered regions.
   */
  getAllRegions(): Region[] {
    return this.regionMapper?.getAllRegions() ?? [];
  }

  /**
   * Look up which region(s) contain a point.
   */
  lookupRegion(point: Point): RegionLookupResult | null {
    return this.regionMapper?.lookup(point) ?? null;
  }

  /**
   * Get the region an entity is in based on its coordinates.
   * Returns the primary (most specific) region, or null if not in any region.
   */
  getEntityRegion(entity: HardState): Region | null {
    if (!this.regionMapper || !entity.coordinates) {
      return null;
    }
    // Coordinates are now simple Point
    const result = this.regionMapper.lookup(entity.coordinates);
    return result.primary;
  }

  /**
   * Find all entities within a specific region.
   */
  findEntitiesInRegion(regionId: string, kind?: string): HardState[] {
    if (!this.regionMapper) return [];

    const region = this.regionMapper.getRegion(regionId);
    if (!region) return [];

    const results: HardState[] = [];
    for (const entity of this.graph.getEntities()) {
      if (kind && entity.kind !== kind) continue;

      // Coordinates are now simple Point
      if (entity.coordinates && this.regionMapper.containsPoint(region, entity.coordinates)) {
        results.push(entity);
      }
    }
    return results;
  }

  /**
   * Get tags that should be applied to an entity at a point.
   * Includes region-specific auto-tags as key-value pairs.
   */
  getRegionTags(point: Point): EntityTags {
    return this.regionMapper?.getTagsForPoint(point) ?? {};
  }

  /**
   * Add an entity placed within a specific region.
   * Automatically applies region tags and emits placement event.
   *
   * @param entity - Entity data (region coordinates will be generated)
   * @param regionId - Target region ID
   * @param options - Placement options (minDistance, etc.)
   * @returns Entity ID if successful, null if placement failed
   *
   * @example
   * ```typescript
   * const npcId = view.addEntityInRegion(
   *   { kind: 'npc', subtype: 'merchant', name: 'Trader Piku' },
   *   'northern_ice',
   *   { minDistance: 3 }
   * );
   * ```
   */
  addEntityInRegion(
    entity: Omit<Partial<HardState>, 'coordinates'>,
    regionId: string,
    options?: { minDistance?: number; existingPoints?: Point[] }
  ): string | null {
    if (!this.regionMapper || !this.regionPlacement) {
      throw new Error(
        `addEntityInRegion: Region system not configured. ` +
        `Ensure domain provides regionConfig in the domain schema.`
      );
    }

    // Collect existing points in this region for spacing
    const existingPoints = options?.existingPoints ?? this.getRegionPoints(regionId);

    const result = this.regionPlacement.place({
      regionId,
      existingPoints,
      minDistance: options?.minDistance ?? 5
    });

    if (!result.success || !result.point) {
      return null;
    }

    // Get auto-tags from region (as EntityTags KVP)
    const regionTags = this.regionMapper.processEntityPlacement(
      entity.name ?? 'unknown',
      result.point
    );

    // Merge entity tags with region tags
    const mergedTags = mergeTags(entity.tags as EntityTags | undefined, regionTags);

    // Create entity with coordinates (simple Point)
    const entityWithCoords: Partial<HardState> = {
      ...entity,
      tags: mergedTags,
      coordinates: result.point
    };

    return addEntity(this.graph, entityWithCoords);
  }

  /**
   * Add an entity near a reference entity in the same region.
   *
   * @param entity - Entity data
   * @param referenceEntity - Entity to place near
   * @param options - Placement options
   * @returns Entity ID if successful, null if placement failed
   *
   * @example
   * ```typescript
   * const apprenticeId = view.addEntityNearEntity(
   *   { kind: 'npc', subtype: 'apprentice', name: 'Young Pip' },
   *   masterEntity,
   *   { minDistance: 2, maxSearchRadius: 10 }
   * );
   * ```
   */
  addEntityNearEntity(
    entity: Omit<Partial<HardState>, 'coordinates'>,
    referenceEntity: HardState,
    options?: { minDistance?: number; maxSearchRadius?: number }
  ): string | null {
    if (!this.regionMapper || !this.regionPlacement) {
      throw new Error(
        `addEntityNearEntity: Region system not configured. ` +
        `Ensure domain provides regionConfig in the domain schema.`
      );
    }

    if (!referenceEntity.coordinates) {
      throw new Error(
        `addEntityNearEntity: Reference entity "${referenceEntity.name}" has no coordinates. ` +
        `Entity kind: ${referenceEntity.kind}, id: ${referenceEntity.id}`
      );
    }

    // Collect existing points for spacing
    const existingPoints = this.getAllRegionPoints();

    const result = this.regionPlacement.placeNear(
      referenceEntity.coordinates,
      existingPoints,
      options?.minDistance ?? 5,
      options?.maxSearchRadius ?? 20
    );

    if (!result.success || !result.point) {
      return null;
    }

    // Get auto-tags from region (as EntityTags KVP)
    const regionTags = this.regionMapper.processEntityPlacement(
      entity.name ?? 'unknown',
      result.point
    );

    // Merge entity tags with region tags
    const mergedTags = mergeTags(entity.tags as EntityTags | undefined, regionTags);

    // Create entity with coordinates (simple Point)
    const entityWithCoords: Partial<HardState> = {
      ...entity,
      tags: mergedTags,
      coordinates: result.point
    };

    return addEntity(this.graph, entityWithCoords);
  }

  /**
   * Add multiple entities to a region with automatic spacing.
   *
   * @param entities - Array of entity data
   * @param regionId - Target region ID
   * @param options - Batch placement options
   * @returns Object with placed IDs and failure count
   *
   * @example
   * ```typescript
   * const colonists = Array(10).fill(null).map((_, i) => ({
   *   kind: 'npc' as const,
   *   subtype: 'colonist',
   *   name: `Colonist ${i + 1}`
   * }));
   *
   * const result = view.addEntitiesInRegion(colonists, 'southern_coast', {
   *   minDistance: 3,
   *   allowEmergentExpansion: true
   * });
   * ```
   */
  addEntitiesInRegion(
    entities: Array<Omit<Partial<HardState>, 'coordinates'>>,
    regionId: string,
    options?: {
      minDistance?: number;
      allowEmergentExpansion?: boolean;
      emergentRegionLabel?: string;
    }
  ): { placedIds: string[]; failed: number; emergentRegionsCreated: string[] } {
    if (!this.regionMapper || !this.regionPlacement) {
      throw new Error(
        `addEntitiesInRegion: Region system not configured. ` +
        `Ensure domain provides regionConfig in the domain schema.`
      );
    }

    const existingPoints = this.getRegionPoints(regionId);

    const batchResult = this.regionPlacement.placeBatch({
      count: entities.length,
      regionId,
      existingPoints,
      minDistance: options?.minDistance ?? 5,
      allowEmergentExpansion: options?.allowEmergentExpansion ?? false,
      emergentRegionLabel: options?.emergentRegionLabel,
      tick: this.graph.tick
    });

    const placedIds: string[] = [];

    for (let i = 0; i < batchResult.placed.length; i++) {
      const placement = batchResult.placed[i];
      const entity = entities[i];
      if (!entity) continue;

      // Get auto-tags from region (as EntityTags KVP)
      const regionTags = this.regionMapper.processEntityPlacement(
        entity.name ?? 'unknown',
        placement.point
      );

      // Merge entity tags with region tags
      const mergedTags = mergeTags(entity.tags as EntityTags | undefined, regionTags);

      // Create entity with coordinates (simple Point)
      const entityWithCoords: Partial<HardState> = {
        ...entity,
        tags: mergedTags,
        coordinates: placement.point
      };

      const id = addEntity(this.graph, entityWithCoords);
      placedIds.push(id);
    }

    return {
      placedIds,
      failed: batchResult.failed,
      emergentRegionsCreated: batchResult.emergentRegionsCreated
    };
  }

  /**
   * Create an emergent region near a reference point.
   * Useful when existing regions are saturated and expansion is needed.
   *
   * @param nearPoint - Reference point for new region placement
   * @param label - Human-readable name for the region
   * @param description - Narrative description
   * @returns Result with created region or failure reason
   *
   * @example
   * ```typescript
   * const result = view.createEmergentRegion(
   *   existingEntity.coordinates,
   *   'New Settlement',
   *   'A freshly established outpost on the ice'
   * );
   *
   * if (result.success) {
   *   console.log(`Created region: ${result.region.id}`);
   * }
   * ```
   */
  createEmergentRegion(
    nearPoint: Point,
    label: string,
    description: string
  ): EmergentRegionResult {
    if (!this.regionMapper) {
      return { success: false, failureReason: 'Region system not configured' };
    }

    return this.regionMapper.createEmergentRegion(
      nearPoint,
      label,
      description,
      this.graph.tick
    );
  }

  /**
   * Check if a region is saturated (density above threshold).
   */
  isRegionSaturated(regionId: string, threshold?: number): boolean {
    if (!this.regionPlacement) return false;

    const points = this.getRegionPoints(regionId);
    return this.regionPlacement.isRegionSaturated(regionId, points, threshold);
  }

  /**
   * Get density of entities in a region.
   */
  getRegionDensity(regionId: string): number {
    if (!this.regionPlacement) return 0;

    const points = this.getRegionPoints(regionId);
    return this.regionPlacement.getRegionDensity(regionId, points);
  }

  /**
   * Get region statistics for diagnostics.
   */
  getRegionStats(): {
    totalRegions: number;
    emergentRegions: number;
    predefinedRegions: number;
    totalArea: number;
  } | null {
    return this.regionMapper?.getStats() ?? null;
  }

  // ============================================================================
  // REGION HELPERS (Private)
  // ============================================================================

  /**
   * Get all region coordinates for entities in a specific region.
   */
  private getRegionPoints(regionId: string): Point[] {
    if (!this.regionMapper) return [];

    const region = this.regionMapper.getRegion(regionId);
    if (!region) return [];

    const points: Point[] = [];
    for (const entity of this.graph.getEntities()) {
      // Coordinates are now simple Point
      if (entity.coordinates && this.regionMapper.containsPoint(region, entity.coordinates)) {
        points.push(entity.coordinates);
      }
    }
    return points;
  }

  /**
   * Get all coordinates from all entities.
   */
  private getAllRegionPoints(): Point[] {
    const points: Point[] = [];
    for (const entity of this.graph.getEntities()) {
      // Coordinates are now simple Point
      if (entity.coordinates) {
        points.push(entity.coordinates);
      }
    }
    return points;
  }
}
