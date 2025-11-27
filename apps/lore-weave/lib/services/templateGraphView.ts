import { Graph } from '../types/engine';
import { HardState, Relationship, EntityTags } from '../types/worldTypes';
import { TargetSelector } from './targetSelector';
import { CoordinateService } from './coordinateService';
import { CoordinatePlacementService } from './coordinatePlacementService';
import { PlacementAlgorithms } from './placementAlgorithms';
import { RegionMapper } from './regionMapper';
import { RegionPlacementService } from './regionPlacement';
import { addEntity, mergeTags, hasTag } from '../utils/helpers';
import type {
  Coordinate,
  CoordinateSpaceId,
  EntityCoordinates,
  PlaceNearOptions,
  FindNearestOptions,
  NearestResult,
  PlacementResult,
  EntityPlacementOptions,
  BatchPlacementOptions,
  BatchPlacementResult,
  AnyPlacementScheme,
  CrossPlanePoissonPlacement,
  SaturationCascadePlacement,
  CascadeEvent,
  CrossPlaneBatchPlacementResult,
  ManifoldConfig
} from '../types/coordinates';
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
  public readonly coordinateService: CoordinateService;
  public readonly placementService: CoordinatePlacementService;
  private readonly placementAlgorithms: PlacementAlgorithms;

  // Region-based coordinate system (optional - initialized if domain provides regionConfig)
  private regionMapper: RegionMapper | null = null;
  private regionPlacement: RegionPlacementService | null = null;

  constructor(graph: Graph, targetSelector: TargetSelector) {
    this.graph = graph;
    this.targetSelector = targetSelector;
    // Initialize coordinate services using domain from config
    this.coordinateService = new CoordinateService(graph.config.domain);
    this.placementService = new CoordinatePlacementService(graph.config.domain);
    this.placementAlgorithms = new PlacementAlgorithms(
      graph,
      graph.config.domain,
      this.coordinateService,
      this.placementService
    );

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
  // COORDINATE OPERATIONS
  // ============================================================================

  /**
   * Calculate distance between two entities in a coordinate space.
   * Returns undefined if either entity lacks coordinates in that space.
   */
  getDistance(entity1: HardState, entity2: HardState, spaceId: CoordinateSpaceId): number | undefined {
    return this.coordinateService.calculateDistance(entity1, entity2, spaceId);
  }

  /**
   * Place a new entity near a reference entity's coordinates.
   * Useful for spawning entities near existing ones.
   */
  placeNearEntity(
    referenceEntity: HardState,
    newEntityKind: string,
    spaceId: CoordinateSpaceId,
    options?: PlaceNearOptions
  ): PlacementResult | null {
    const refCoord = referenceEntity.coordinates?.[spaceId];
    if (!refCoord) return null;

    return this.placementService.placeNear(refCoord, newEntityKind, spaceId, options);
  }

  /**
   * Find entities nearest to a reference entity.
   * Filters by kind, status, and other criteria.
   */
  findNearestEntities(
    referenceEntity: HardState,
    targetKind: string,
    spaceId: CoordinateSpaceId,
    options?: FindNearestOptions
  ): NearestResult[] {
    const refCoord = referenceEntity.coordinates?.[spaceId];
    if (!refCoord) return [];

    return this.placementService.findNearest(this.graph, refCoord, targetKind, spaceId, options);
  }

  /**
   * Find all entities within a radius of a reference entity.
   */
  findEntitiesInRadius(
    referenceEntity: HardState,
    radius: number,
    targetKind: string,
    spaceId: CoordinateSpaceId,
    filter?: FindNearestOptions['filter']
  ): NearestResult[] {
    const refCoord = referenceEntity.coordinates?.[spaceId];
    if (!refCoord) return [];

    return this.placementService.findWithinRadius(this.graph, refCoord, radius, targetKind, spaceId, filter);
  }

  /**
   * Get coordinates for a new entity based on related entities.
   * Computes centroid if multiple references, or places near if one.
   */
  deriveCoordinates(
    referenceEntities: HardState[],
    newEntityKind: string,
    spaceId: CoordinateSpaceId,
    options?: PlaceNearOptions
  ): Coordinate | undefined {
    if (referenceEntities.length === 0) {
      return this.coordinateService.getDefaultCoordinates(newEntityKind, spaceId);
    }

    // Collect coordinates from reference entities
    const coords: Coordinate[] = [];
    for (const ref of referenceEntities) {
      const coord = ref.coordinates?.[spaceId];
      if (coord) coords.push(coord);
    }

    if (coords.length === 0) {
      return this.coordinateService.getDefaultCoordinates(newEntityKind, spaceId);
    }

    if (coords.length === 1) {
      // Place near the single reference
      const result = this.placementService.placeNear(coords[0], newEntityKind, spaceId, options);
      return result?.coordinates;
    }

    // Multiple references - compute centroid
    return this.placementService.computeCentroid(coords, newEntityKind, spaceId) ?? undefined;
  }

  // ============================================================================
  // PLACEMENT-BASED ENTITY CREATION
  // ============================================================================

  /**
   * Add an entity to the graph using a placement scheme to generate coordinates.
   *
   * This is the recommended way to create entities when you need automatic
   * coordinate placement using mathematically sound algorithms.
   *
   * @param entity - Entity data (coordinates will be generated, don't provide them)
   * @param placement - Placement options with scheme configuration
   * @returns Entity ID if successful, null if placement failed
   *
   * @example
   * ```typescript
   * // Place a new colony using Poisson disk sampling
   * const colonyId = graphView.addEntityWithPlacement(
   *   { kind: 'location', subtype: 'colony', name: 'New Colony' },
   *   {
   *     scheme: {
   *       kind: 'poisson_disk',
   *       spaceId: 'physical',
   *       allowCoLocation: false,
   *       minDistance: 0.2
   *     }
   *   }
   * );
   *
   * // Place an ability co-located with its origin location
   * const abilityId = graphView.addEntityWithPlacement(
   *   { kind: 'abilities', subtype: 'magic', name: 'Frost Runes' },
   *   {
   *     scheme: {
   *       kind: 'anchor_colocated',
   *       spaceId: 'physical',
   *       allowCoLocation: true,
   *       anchorEntityId: 'loc_glow_fissure'
   *     }
   *   }
   * );
   * ```
   */
  addEntityWithPlacement(
    entity: Omit<Partial<HardState>, 'coordinates'>,
    placement: EntityPlacementOptions
  ): string | null {
    const entityKind = entity.kind ?? 'npc';

    // Try primary scheme
    let result = this.placementAlgorithms.execute(placement.scheme, entityKind, []);

    // Try fallback if primary failed
    if (!result && placement.fallbackScheme) {
      result = this.placementAlgorithms.execute(placement.fallbackScheme, entityKind, []);
    }

    if (!result) {
      return null; // Placement failed
    }

    // Validate placement if custom validator provided
    if (placement.validatePlacement && !placement.validatePlacement(result.coordinates)) {
      return null; // Validation failed
    }

    // Create entity with generated coordinates
    const entityWithCoords: Partial<HardState> = {
      ...entity,
      coordinates: { [placement.scheme.spaceId]: result.coordinates }
    };

    return addEntity(this.graph, entityWithCoords);
  }

  /**
   * Add multiple entities using a placement scheme.
   *
   * Entities are placed sequentially with each placement respecting
   * previously placed entities (incremental exclusion). This ensures
   * batch placements don't overlap when using non-co-located schemes.
   *
   * @param entities - Array of entity data (coordinates will be generated)
   * @param placement - Placement options (same scheme used for all entities)
   * @returns BatchPlacementResult with placed IDs and any failures
   *
   * @example
   * ```typescript
   * // Place 5 NPCs around a colony using Gaussian clustering
   * const npcs = Array(5).fill(null).map((_, i) => ({
   *   kind: 'npc' as const,
   *   subtype: 'merchant',
   *   name: `Merchant ${i + 1}`
   * }));
   *
   * const result = graphView.addEntitiesWithPlacement(npcs, {
   *   scheme: {
   *     kind: 'gaussian_cluster',
   *     spaceId: 'physical',
   *     allowCoLocation: false,
   *     center: 'aurora_stack_id',
   *     sigma: 0.1
   *   }
   * });
   *
   * console.log(`Placed ${result.placedEntityIds.length} NPCs`);
   * ```
   */
  addEntitiesWithPlacement(
    entities: Array<Omit<Partial<HardState>, 'coordinates'>>,
    placement: BatchPlacementOptions
  ): BatchPlacementResult {
    const placedEntityIds: string[] = [];
    const failures: Array<{ entityIndex: number; reason: string }> = [];
    const batchCoordinates: Coordinate[] = [];
    let totalAttempts = 0;

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const entityKind = entity.kind ?? 'npc';

      // Try primary scheme with incremental exclusion
      let result = this.placementAlgorithms.execute(
        placement.scheme,
        entityKind,
        batchCoordinates // Pass already-placed coordinates for exclusion
      );
      totalAttempts += result?.diagnostics?.attemptsUsed ?? 1;

      // Try fallback if primary failed
      if (!result && placement.fallbackScheme) {
        result = this.placementAlgorithms.execute(
          placement.fallbackScheme,
          entityKind,
          batchCoordinates
        );
        totalAttempts += result?.diagnostics?.attemptsUsed ?? 1;
      }

      if (!result) {
        failures.push({ entityIndex: i, reason: 'Placement algorithm failed to find valid position' });
        continue;
      }

      // Validate placement if custom validator provided
      if (placement.validatePlacement && !placement.validatePlacement(result.coordinates)) {
        failures.push({ entityIndex: i, reason: 'Custom validation rejected placement' });
        continue;
      }

      // Create entity with generated coordinates
      const entityWithCoords: Partial<HardState> = {
        ...entity,
        coordinates: { [placement.scheme.spaceId]: result.coordinates }
      };

      const id = addEntity(this.graph, entityWithCoords);
      placedEntityIds.push(id);

      // Track placed coordinates for incremental exclusion
      batchCoordinates.push(result.coordinates);
    }

    return {
      placedEntityIds,
      failures,
      diagnostics: {
        totalAttempts,
        successCount: placedEntityIds.length,
        failureCount: failures.length
      }
    };
  }

  /**
   * Get the default placement scheme for an entity kind from the domain schema.
   * Returns undefined if no default is configured.
   */
  getDefaultPlacementScheme(entityKind: string): AnyPlacementScheme | undefined {
    return this.graph.config.domain.defaultPlacementSchemes?.[entityKind];
  }

  // ============================================================================
  // CROSS-PLANE PLACEMENT (6D)
  // ============================================================================

  /**
   * Add an entity with automatic cross-plane cascade when planes become saturated.
   *
   * Uses 6D placement algorithms that can place entities on different planes
   * when the preferred plane is saturated. The domain's manifold configuration
   * defines the plane hierarchy and saturation thresholds.
   *
   * @param entity - Entity data (coordinates will be generated)
   * @param placement - Placement options with cross-plane scheme
   * @returns Object with entity ID and coordinate, plus cascade info if applicable
   *
   * @example
   * ```typescript
   * // Place colony with cross-plane support
   * const result = graphView.addEntityWithCrossPlane(
   *   { kind: 'location', subtype: 'colony', name: 'New Colony' },
   *   {
   *     scheme: {
   *       kind: 'cross_plane_poisson',
   *       spaceId: 'physical',
   *       allowCoLocation: false,
   *       allowCrossPlane: true,
   *       minDistance: 0.15,
   *       preferredPlane: 'surface'
   *     }
   *   }
   * );
   *
   * if (result?.cascadedToPlane) {
   *   console.log(`Colony placed on ${result.cascadedToPlane} due to saturation`);
   * }
   * ```
   */
  addEntityWithCrossPlane(
    entity: Omit<Partial<HardState>, 'coordinates'>,
    placement: EntityPlacementOptions & { scheme: CrossPlanePoissonPlacement | SaturationCascadePlacement }
  ): { id: string; coordinate: Coordinate; cascadedToPlane?: string } | null {
    const entityKind = entity.kind ?? 'npc';

    // Execute cross-plane placement
    const result = this.placementAlgorithms.execute(placement.scheme, entityKind, []);

    if (!result) {
      return null;
    }

    // Validate placement if custom validator provided
    if (placement.validatePlacement && !placement.validatePlacement(result.coordinates)) {
      return null;
    }

    // Create entity with generated coordinates
    const entityWithCoords: Partial<HardState> = {
      ...entity,
      coordinates: { [placement.scheme.spaceId]: result.coordinates }
    };

    const id = addEntity(this.graph, entityWithCoords);

    // Extract cascade info from diagnostics
    const cascadedToPlane = (result.diagnostics as { cascadedFrom?: string })?.cascadedFrom
      ? result.coordinates.plane as string
      : undefined;

    return {
      id,
      coordinate: result.coordinates,
      cascadedToPlane
    };
  }

  /**
   * Add multiple entities with automatic cross-plane cascade.
   *
   * Entities are placed sequentially with incremental exclusion.
   * When a plane becomes saturated, subsequent entities cascade to child planes.
   *
   * @param entities - Array of entity data
   * @param placement - Placement options with cross-plane scheme
   * @returns Extended BatchPlacementResult with cascade events
   *
   * @example
   * ```typescript
   * // Place 20 colonies with automatic cross-plane distribution
   * const colonies = Array(20).fill(null).map((_, i) => ({
   *   kind: 'location' as const,
   *   subtype: 'colony',
   *   name: `Colony ${i + 1}`
   * }));
   *
   * const result = graphView.addEntitiesWithCrossPlane(colonies, {
   *   scheme: {
   *     kind: 'saturation_cascade',
   *     spaceId: 'physical',
   *     allowCoLocation: false,
   *     allowCrossPlane: true,
   *     basePlacementScheme: {
   *       kind: 'poisson_disk',
   *       spaceId: 'physical',
   *       allowCoLocation: false,
   *       minDistance: 0.1
   *     },
   *     preferredPlane: 'surface'
   *   }
   * });
   *
   * console.log(`Placed ${result.successCount} colonies`);
   * console.log(`Cascade events: ${result.cascadeEvents.length}`);
   * ```
   */
  addEntitiesWithCrossPlane(
    entities: Array<Omit<Partial<HardState>, 'coordinates'>>,
    placement: BatchPlacementOptions & { scheme: CrossPlanePoissonPlacement | SaturationCascadePlacement }
  ): CrossPlaneBatchPlacementResult {
    const placedEntityIds: string[] = [];
    const failures: Array<{ entityIndex: number; reason: string }> = [];
    const cascadeEvents: CascadeEvent[] = [];
    const batchCoordinates: Coordinate[] = [];
    let totalAttempts = 0;

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const entityKind = entity.kind ?? 'npc';

      // Execute with incremental exclusion
      const result = this.placementAlgorithms.execute(
        placement.scheme,
        entityKind,
        batchCoordinates
      );
      totalAttempts += result?.diagnostics?.attemptsUsed ?? 1;

      if (!result) {
        failures.push({ entityIndex: i, reason: 'Placement algorithm failed to find valid position' });
        continue;
      }

      // Validate placement if custom validator provided
      if (placement.validatePlacement && !placement.validatePlacement(result.coordinates)) {
        failures.push({ entityIndex: i, reason: 'Custom validation rejected placement' });
        continue;
      }

      // Create entity with generated coordinates
      const entityWithCoords: Partial<HardState> = {
        ...entity,
        coordinates: { [placement.scheme.spaceId]: result.coordinates }
      };

      const id = addEntity(this.graph, entityWithCoords);
      placedEntityIds.push(id);

      // Track cascade events
      const diagnostics = result.diagnostics as { cascadedFrom?: string };
      if (diagnostics?.cascadedFrom) {
        cascadeEvents.push({
          entityId: id,
          fromPlane: diagnostics.cascadedFrom,
          toPlane: result.coordinates.plane as string,
          reason: 'saturation'
        });
      }

      // Track placed coordinates for incremental exclusion
      batchCoordinates.push(result.coordinates);
    }

    return {
      placedEntityIds,
      failures,
      diagnostics: {
        totalAttempts,
        successCount: placedEntityIds.length,
        failureCount: failures.length
      },
      cascadeEvents
    };
  }

  /**
   * Get the manifold configuration for cross-plane placement.
   * Returns undefined if not configured in the domain.
   */
  getManifoldConfig(): ManifoldConfig | undefined {
    return (this.graph.config.domain as unknown as { manifoldConfig?: ManifoldConfig }).manifoldConfig;
  }

  /**
   * Check if a plane is saturated based on the manifold configuration.
   */
  isPlaneSaturated(plane: string, spaceId: CoordinateSpaceId): boolean {
    const manifoldConfig = this.getManifoldConfig();
    if (!manifoldConfig) return false;

    const entities = this.graph.getEntities();
    return this.coordinateService.isPlaneSaturated(plane, entities, manifoldConfig, spaceId);
  }

  /**
   * Get the next available plane when the current plane is saturated.
   */
  getNextAvailablePlane(currentPlane: string, spaceId: CoordinateSpaceId): string | null {
    const manifoldConfig = this.getManifoldConfig();
    if (!manifoldConfig) return null;

    const entities = this.graph.getEntities();
    return this.coordinateService.getNextAvailablePlane(currentPlane, entities, manifoldConfig, spaceId);
  }

  /**
   * Get entity count by plane for diagnostics.
   */
  getEntityCountByPlane(spaceId: CoordinateSpaceId): Map<string, number> {
    const counts = new Map<string, number>();

    for (const entity of this.graph.getEntities()) {
      const coord = entity.coordinates?.[spaceId];
      if (coord) {
        const plane = coord.plane as string;
        counts.set(plane, (counts.get(plane) ?? 0) + 1);
      }
    }

    return counts;
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
    if (!this.regionMapper || !entity.coordinates?.region) {
      return null;
    }
    // Type assertion needed since EntityCoordinates uses Coordinate type for all keys
    const point = entity.coordinates.region as unknown as Point;
    const result = this.regionMapper.lookup(point);
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

      const point = entity.coordinates?.region as Point | undefined;
      if (point && this.regionMapper.containsPoint(region, point)) {
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

    // Create entity with region coordinates
    // Use type assertion since region coordinates use Point, not Coordinate
    const entityWithCoords: Partial<HardState> = {
      ...entity,
      tags: mergedTags,
      coordinates: { region: result.point } as unknown as EntityCoordinates
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

    const refPoint = referenceEntity.coordinates?.region as Point | undefined;
    if (!refPoint) {
      throw new Error(
        `addEntityNearEntity: Reference entity "${referenceEntity.name}" has no region coordinates. ` +
        `Entity kind: ${referenceEntity.kind}, id: ${referenceEntity.id}`
      );
    }

    // Collect existing points for spacing
    const existingPoints = this.getAllRegionPoints();

    const result = this.regionPlacement.placeNear(
      refPoint,
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

    // Use type assertion since region coordinates use Point, not Coordinate
    const entityWithCoords: Partial<HardState> = {
      ...entity,
      tags: mergedTags,
      coordinates: { region: result.point } as unknown as EntityCoordinates
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

      // Use type assertion since region coordinates use Point, not Coordinate
      const entityWithCoords: Partial<HardState> = {
        ...entity,
        tags: mergedTags,
        coordinates: { region: placement.point } as unknown as EntityCoordinates
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
   *   existingEntity.coordinates.region,
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
      const point = entity.coordinates?.region as Point | undefined;
      if (point && this.regionMapper.containsPoint(region, point)) {
        points.push(point);
      }
    }
    return points;
  }

  /**
   * Get all region coordinates from all entities.
   */
  private getAllRegionPoints(): Point[] {
    const points: Point[] = [];
    for (const entity of this.graph.getEntities()) {
      const point = entity.coordinates?.region as Point | undefined;
      if (point) {
        points.push(point);
      }
    }
    return points;
  }
}
