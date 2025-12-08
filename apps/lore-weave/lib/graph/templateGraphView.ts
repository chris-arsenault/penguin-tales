import { Graph, DebugCategory, DebugConfig, DEFAULT_DEBUG_CONFIG } from '../engine/types';
import { HardState, Relationship, EntityTags } from '../core/worldTypes';
import { TargetSelector } from '../selection/targetSelector';
import { CoordinateContext, PlacementContext } from '../coordinates/coordinateContext';
import { coordinateStats } from '../coordinates/coordinateStatistics';
import { addEntity, mergeTags, hasTag, addRelationship, updateEntity as updateEntityUtil, getRelated as getRelatedUtil, areRelationshipsCompatible as areRelationshipsCompatibleUtil, recordRelationshipFormation as recordRelationshipFormationUtil } from '../utils';
import { archiveRelationship as archiveRel } from './relationshipMutation';
import { archiveEntities as archiveEnts, transferRelationships as transferRels, createPartOfRelationships as createPartOf } from './entityArchival';
import type {
  Point,
  Region,
  RegionLookupResult,
  EmergentRegionResult
} from '../coordinates/types';
import type { PressureModificationSource } from '../observer/types';

/**
 * Callback for tracking pressure modifications with source attribution
 */
export type PressureModificationCallback = (
  pressureId: string,
  delta: number,
  source: PressureModificationSource
) => void;

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

  // Shared coordinate context (REQUIRED - no internal instantiation)
  private readonly coordinateContext: CoordinateContext;

  // Optional callback for tracking pressure modifications with source
  private onPressureModify?: PressureModificationCallback;

  // Current source context for pressure modifications (set before template/system execution)
  private currentSource?: PressureModificationSource;

  constructor(graph: Graph, targetSelector: TargetSelector, coordinateContext: CoordinateContext) {
    if (!coordinateContext) {
      throw new Error(
        'TemplateGraphView: coordinateContext is required. ' +
        'Graph must provide a CoordinateContext instance.'
      );
    }

    this.graph = graph;
    this.targetSelector = targetSelector;
    this.coordinateContext = coordinateContext;

    // Wire up debug logging from coordinate context
    this.coordinateContext.debug = (category, msg, context) => {
      this.debug(category, msg, context);
    };
  }

  /**
   * Set the callback for tracking pressure modifications with source attribution
   */
  setPressureModificationCallback(callback: PressureModificationCallback): void {
    this.onPressureModify = callback;
  }

  /**
   * Set the current source context for pressure modifications
   * Call this before executing a template/system
   */
  setCurrentSource(source: PressureModificationSource): void {
    this.currentSource = source;
  }

  /**
   * Clear the current source context
   */
  clearCurrentSource(): void {
    this.currentSource = undefined;
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
    bias: import('../selection/targetSelector').SelectionBias
  ): import('../selection/targetSelector').SelectionResult {
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

  /**
   * Log a message via the emitter (if available).
   * Convenience method for systems to emit debug/info/warn messages.
   */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: Record<string, unknown>): void {
    this.config?.emitter?.log(level, message, context);
  }

  /**
   * Emit a categorized debug message.
   * Only emits if debug is enabled and the category is in the enabled list.
   *
   * @param category - Debug category (e.g., 'placement', 'coordinates', 'templates')
   * @param message - Debug message to emit
   * @param context - Optional additional context
   */
  debug(category: DebugCategory, message: string, context?: Record<string, unknown>): void {
    const debugConfig = this.config?.debugConfig;

    // If debug is disabled globally or no config, skip
    if (!debugConfig?.enabled) {
        return;
    }


    // If no categories specified, emit all; otherwise check if category is enabled
    if (debugConfig.enabledCategories.length > 0 && !debugConfig.enabledCategories.includes(category)) {
      return;
    }

    // Emit with category prefix
    this.config?.emitter?.log('debug', `[${category.toUpperCase()}] ${message}`, context);
  }

  /**
   * Check if a debug category is enabled.
   * Useful for avoiding expensive string formatting when debug is disabled.
   */
  isDebugEnabled(category: DebugCategory): boolean {
    const debugConfig = this.config?.debugConfig ?? DEFAULT_DEBUG_CONFIG;
    if (!debugConfig.enabled) return false;
    if (debugConfig.enabledCategories.length === 0) return true;
    return debugConfig.enabledCategories.includes(category);
  }

  /** Get rate limit state (for templates with creation rate limiting) */
  get rateLimitState() {
    return this.graph.rateLimitState;
  }

  /**
   * FRAMEWORK INTERNAL USE ONLY.
   *
   * Direct graph access is provided ONLY for framework systems that need
   * internal operations (era management, relationship culling, etc.).
   *
   * DOMAIN CODE MUST NOT USE THIS. Use TemplateGraphView methods instead.
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

      if (criteria.kind && criteria.kind !== 'any' && entity.kind !== criteria.kind) matches = false;
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
   * Determine the relationship between two sets of factions.
   * Returns 'allied', 'enemy', or 'neutral'.
   */
  getFactionRelationship(
    factions1: HardState[],
    factions2: HardState[]
  ): 'allied' | 'enemy' | 'neutral' {
    // Check for warfare/enmity
    const atWar = factions1.some(f1 =>
      factions2.some(f2 =>
        this.hasRelationship(f1.id, f2.id, 'at_war_with') ||
        this.hasRelationship(f1.id, f2.id, 'enemy_of')
      )
    );
    if (atWar) return 'enemy';

    // Check for alliances
    const allied = factions1.some(f1 =>
      factions2.some(f2 => this.hasRelationship(f1.id, f2.id, 'allied_with'))
    );
    if (allied) return 'allied';

    return 'neutral';
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
   * @param cooldown Optional cooldown period in ticks (defaults to 10)
   */
  canFormRelationship(entityId: string, relationshipType: string, cooldown?: number): boolean {
    const cooldownPeriod = cooldown ?? 10;
    const cooldownMap = this.graph.relationshipCooldowns.get(entityId);
    if (!cooldownMap) return true;

    const lastFormationTick = cooldownMap.get(relationshipType);
    if (lastFormationTick === undefined) return true;

    const ticksSinceFormation = this.graph.tick - lastFormationTick;
    return ticksSinceFormation >= cooldownPeriod;
  }

  // ============================================================================
  // GRAPH MUTATIONS
  // ============================================================================
  // These methods allow systems to modify the graph without direct Graph access.
  // All mutations should go through these methods.

  /**
   * Get all entities in the graph.
   * Use sparingly - prefer findEntities() with criteria for filtering.
   */
  getEntities(): HardState[] {
    return this.graph.getEntities();
  }

  /**
   * Iterate over all entities.
   */
  forEachEntity(callback: (entity: HardState) => void): void {
    for (const entity of this.graph.getEntities()) {
      callback(entity);
    }
  }

  /**
   * Get history events from the graph.
   */
  getHistory(): readonly import('../engine/types').HistoryEvent[] {
    return this.graph.history;
  }

  /**
   * Add an entity to the graph.
   * For coordinate-aware placement, use placeWithCulture() instead.
   */
  async createEntity(partial: Partial<HardState>): Promise<string> {
    return await addEntity(this.graph, partial);
  }

  /**
   * Add a relationship between two entities.
   * @param kind - Relationship kind
   * @param srcId - Source entity ID
   * @param dstId - Destination entity ID
   * @param strength - Optional strength override
   * Distance is computed from entity coordinates.
   */
  createRelationship(
    kind: string,
    srcId: string,
    dstId: string,
    strength?: number
  ): void {
    // Distance is computed from coordinates
    addRelationship(this.graph, kind, srcId, dstId, strength);
  }

  /**
   * Update an entity's properties.
   */
  updateEntity(entityId: string, changes: Partial<HardState>): void {
    updateEntityUtil(this.graph, entityId, changes);
  }

  /**
   * Get related entities with filtering options.
   * Equivalent to getRelated(graph, ...) utility function.
   */
  getRelated(
    entityId: string,
    relationshipKind: string,
    direction: 'src' | 'dst',
    options?: { minStrength?: number }
  ): HardState[] {
    return getRelatedUtil(this.graph, entityId, relationshipKind, direction, options);
  }

  // ============================================================================
  // FRAMEWORK SYSTEM OPERATIONS
  // ============================================================================
  // These methods support framework-level systems (era management, culling, etc.)
  // Domain code should NOT use these - use the standard mutations above.

  /**
   * Add a history event to the graph.
   * Used by framework systems to record significant events.
   */
  addHistoryEvent(event: import('../engine/types').HistoryEvent): void {
    this.graph.history.push(event);
  }

  /**
   * Set the current era (by config reference).
   * Used by era transition system.
   */
  setCurrentEra(era: import('../engine/types').Era): void {
    this.graph.currentEra = era;
  }

  /**
   * Load an entity directly into the graph (bypasses normal creation).
   * Used by era spawner for framework entity creation.
   */
  loadEntity(entity: HardState): void {
    this.graph._loadEntity(entity.id, entity);
  }

  /**
   * Get total relationship count.
   */
  getRelationshipCount(): number {
    return this.graph.getRelationshipCount();
  }

  /**
   * Replace all relationships in the graph.
   * Used by relationship culling system.
   */
  setRelationships(relationships: Relationship[]): void {
    this.graph._setRelationships(relationships);
  }

  /**
   * Get protected relationship violations (for diagnostics).
   */
  getProtectedRelationshipViolations(): Array<{ tick: number; violations: Array<{ kind: string; strength: number }> }> {
    return this.graph.protectedRelationshipViolations || [];
  }

  /**
   * Record a protected relationship violation.
   * Used by relationship culling system for diagnostics.
   */
  recordProtectedRelationshipViolation(tick: number, violations: Array<{ kind: string; strength: number }>): void {
    if (!this.graph.protectedRelationshipViolations) {
      this.graph.protectedRelationshipViolations = [];
    }
    this.graph.protectedRelationshipViolations.push({ tick, violations });
  }

  // ============================================================================
  // RELATIONSHIP UTILITY WRAPPERS
  // ============================================================================
  // Wrappers around common utility functions so domain code doesn't need Graph.

  /**
   * Check if a relationship would be compatible (no contradictions).
   */
  areRelationshipsCompatible(srcId: string, dstId: string, kind: string): boolean {
    return areRelationshipsCompatibleUtil(this.graph, srcId, dstId, kind);
  }

  /**
   * Record that a relationship was formed (for cooldown tracking).
   */
  recordRelationshipFormation(entityId: string, relationshipKind: string): void {
    recordRelationshipFormationUtil(this.graph, entityId, relationshipKind);
  }

  /**
   * Archive a relationship (mark as historical for temporal tracking).
   * Used when relationships end but should remain in history.
   */
  archiveRelationship(src: string, dst: string, kind: string): void {
    archiveRel(this.graph, src, dst, kind);
  }

  /**
   * Modify a pressure value by delta.
   * Used by templates and systems to affect world state.
   */
  modifyPressure(pressureId: string, delta: number): void {
    const current = this.graph.pressures.get(pressureId) || 0;
    this.graph.pressures.set(pressureId, Math.max(0, Math.min(100, current + delta)));

    // Track modification if callback and source are set
    if (delta !== 0 && this.onPressureModify && this.currentSource) {
      this.onPressureModify(pressureId, delta, this.currentSource);
    }
  }

  /**
   * Update an entity's status.
   * Used by templates and systems to change entity states.
   */
  updateEntityStatus(entityId: string, newStatus: string): void {
    this.graph.updateEntity(entityId, { status: newStatus });
  }

  // ============================================================================
  // META-ENTITY FORMATION UTILITIES
  // ============================================================================
  // Wrappers for meta-entity formation operations (clustering, archival, etc.)

  /**
   * Archive entities (mark as historical).
   * Used by meta-entity formation systems.
   */
  archiveEntities(
    entityIds: string[],
    options: { archiveRelationships?: boolean; excludeRelationshipKinds?: string[] } = {}
  ): void {
    archiveEnts(this.graph, entityIds, options);
  }

  /**
   * Transfer relationships from source entities to a target entity.
   * Used when forming meta-entities from clusters.
   */
  transferRelationships(
    sourceIds: string[],
    targetId: string,
    options: { excludeKinds?: string[]; archiveOriginals?: boolean } = {}
  ): number {
    return transferRels(this.graph, sourceIds, targetId, options);
  }

  /**
   * Create part_of relationships from members to a container.
   * Used when forming meta-entities.
   */
  createPartOfRelationships(memberIds: string[], containerId: string): number {
    return createPartOf(this.graph, memberIds, containerId);
  }

  /**
   * Add an entity to the graph (async).
   * Wrapper for addEntity utility - handles naming and ID generation.
   */
  async addEntity(partial: Partial<HardState>): Promise<string> {
    return await addEntity(this.graph, partial);
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
   * Get coordinates for a new entity using spatial placement algorithms.
   *
   * Placement strategy:
   * 1. Compute centroid of reference entities (or center if none)
   * 2. Use placement algorithms to find valid position near centroid
   * 3. Avoid overlapping with existing entities of the same kind
   *
   * Coordinates are purely spatial. Semantic meaning (what x/y/z represent)
   * can be derived FROM coordinates using the semantic axis system.
   *
   * @param referenceEntities - Entities to derive position from (can be empty)
   * @param entityKind - Entity kind (used to check existing entities for overlap)
   * @param options - Placement options (maxDistance, minDistance)
   * @returns Point coordinates
   */
  deriveCoordinates(
    referenceEntities: HardState[],
    entityKind?: string,
    options?: { maxDistance?: number; minDistance?: number }
  ): Point | undefined {
    const hadReferenceEntities = referenceEntities.length > 0;
    let usedFallback = false;

    // Warn: deriveCoordinates doesn't use culture context
    if (entityKind && entityKind !== 'location') {
      coordinateStats.warn(
        `deriveCoordinates called for '${entityKind}' - this method doesn't use culture context or semantic encoding. ` +
        `Consider using placeWithCulture() instead.`
      );
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

    // Compute centroid of all reference points (or center if none)
    let centroid: Point;
    if (points.length > 0) {
      centroid = {
        x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
        y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
        z: points.reduce((sum, p) => sum + p.z, 0) / points.length
      };
    } else {
      centroid = { x: 50, y: 50, z: 50 };
      usedFallback = true;
      coordinateStats.warn(
        `deriveCoordinates for '${entityKind ?? 'unknown'}': No reference entities with coordinates - falling back to center (50,50,50)`
      );
    }

    // Collect existing entity coordinates of the same kind to avoid overlap
    const existingPoints: Point[] = [];
    if (entityKind) {
      for (const entity of this.graph.getEntities()) {
        if (entity.kind === entityKind && entity.coordinates) {
          existingPoints.push(entity.coordinates);
        }
      }
    }

    let result: Point | undefined;

    // Find position near centroid avoiding existing entities
    const minDist = (options?.minDistance ?? 0.05) * 100;
    const maxDist = (options?.maxDistance ?? 0.3) * 100;

    // Try up to 50 random positions
    for (let attempt = 0; attempt < 50; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = minDist + Math.random() * (maxDist - minDist);

      const candidate: Point = {
        x: Math.max(0, Math.min(100, centroid.x + Math.cos(angle) * distance)),
        y: Math.max(0, Math.min(100, centroid.y + Math.sin(angle) * distance)),
        z: Math.max(0, Math.min(100, centroid.z + (Math.random() - 0.5) * 10))
      };

      // Check if this position is far enough from all existing entities
      let valid = true;
      for (const existing of existingPoints) {
        const dx = candidate.x - existing.x;
        const dy = candidate.y - existing.y;
        const dz = candidate.z - existing.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < minDist) {
          valid = false;
          break;
        }
      }

      if (valid) {
        result = candidate;
        break;
      }
    }

    if (!result) {
      throw new Error(
        `deriveCoordinates: Could not find valid placement for '${entityKind ?? 'unknown'}' ` +
        `after 50 attempts near centroid (${centroid.x.toFixed(1)}, ${centroid.y.toFixed(1)})`
      );
    }

    // Record statistics
    coordinateStats.recordPlacement({
      tick: this.graph.tick,
      entityKind: entityKind ?? 'unknown',
      method: 'deriveCoordinates',
      cultureId: undefined, // deriveCoordinates doesn't use culture
      regionId: undefined,
      hadReferenceEntities,
      usedFallback,
      coordinates: result
    });

    return result;
  }

  /**
   * Derive coordinates using culture-aware placement.
   *
   * Unlike deriveCoordinates(), this method uses the culture context to determine
   * appropriate placement based on the culture's regions and semantic encoding.
   *
   * Returns coordinates only - does NOT add the entity to the graph.
   * Use this in templates that need to return entity partials with coordinates.
   *
   * @param cultureId - Culture ID for placement context
   * @param entityKind - Entity kind for semantic placement
   * @param referenceEntities - Optional entities to place near
   * @returns Object with coordinates and optional derived info, or undefined if failed
   */
  async deriveCoordinatesWithCulture(
    cultureId: string,
    entityKind: string,
    referenceEntities?: HardState[]
  ): Promise<{ coordinates: Point; regionId?: string | null; derivedTags?: Record<string, string | boolean> } | undefined> {
    // Build context from culture and entity kind
    const context = this.coordinateContext.buildPlacementContext(cultureId, entityKind);

    // Collect existing points for collision avoidance
    const existingPoints = this.getAllRegionPoints();

    // If reference entities provided, bias toward their location
    if (referenceEntities && referenceEntities.length > 0) {
      const validRefs = referenceEntities.filter(e => e.coordinates);
      if (validRefs.length > 0) {
        const centroid = {
          x: validRefs.reduce((sum, e) => sum + (e.coordinates?.x ?? 50), 0) / validRefs.length,
          y: validRefs.reduce((sum, e) => sum + (e.coordinates?.y ?? 50), 0) / validRefs.length,
          z: validRefs.reduce((sum, e) => sum + (e.coordinates?.z ?? 50), 0) / validRefs.length
        };
        // Add reference point to context
        context.referenceEntity = {
          id: validRefs[0].id,
          coordinates: centroid
        };
      }
    }

    // Use culture-aware placement
    const placementResult = await this.coordinateContext.placeWithCulture(
      entityKind,
      'placement', // name placeholder
      this.graph.tick,
      context,
      existingPoints
    );

    if (!placementResult.success || !placementResult.coordinates) {
      coordinateStats.recordPlacement({
        tick: this.graph.tick,
        entityKind,
        method: 'deriveCoordinatesWithCulture',
        cultureId,
        regionId: undefined,
        hadReferenceEntities: (referenceEntities?.length ?? 0) > 0,
        usedFallback: true,
        coordinates: { x: 50, y: 50, z: 50 }
      });
      return undefined;
    }

    // Record successful placement
    coordinateStats.recordPlacement({
      tick: this.graph.tick,
      entityKind,
      method: 'deriveCoordinatesWithCulture',
      cultureId,
      regionId: placementResult.regionId,
      hadReferenceEntities: (referenceEntities?.length ?? 0) > 0,
      usedFallback: false,
      coordinates: placementResult.coordinates
    });

    return {
      coordinates: placementResult.coordinates,
      regionId: placementResult.regionId,
      derivedTags: placementResult.derivedTags
    };
  }

  /**
   * Get semantic properties of an entity based on its coordinates.
   *
   * Uses the semantic axis system to interpret what coordinates mean.
   * For example, an NPC at x=20 is more hostile (low alignment),
   * while an NPC at x=80 is more friendly (high alignment).
   *
   * @param entity - Entity with coordinates
   * @returns Semantic interpretation or undefined if no semantic config
   */
  getSemanticProperties(entity: HardState): Record<string, { value: number; concept: string }> | undefined {
    if (!entity.coordinates) {
      return undefined;
    }

    const semanticPlane = this.coordinateContext.getSemanticPlane(entity.kind);
    if (!semanticPlane) {
      return undefined;
    }

    const axes = semanticPlane.axes;
    const coords = entity.coordinates;
    const result: Record<string, { value: number; concept: string }> = {};

    // Interpret x-axis
    const xValue = coords.x;
    const xConcept = xValue < 33 ? axes.x.lowTag
                   : xValue > 66 ? axes.x.highTag
                   : 'neutral';
    result[axes.x.name] = { value: xValue, concept: xConcept };

    // Interpret y-axis
    const yValue = coords.y;
    const yConcept = yValue < 33 ? axes.y.lowTag
                   : yValue > 66 ? axes.y.highTag
                   : 'neutral';
    result[axes.y.name] = { value: yValue, concept: yConcept };

    // Interpret z-axis (optional in semantic plane)
    if (axes.z) {
      const zValue = coords.z ?? 50;
      const zConcept = zValue < 33 ? axes.z.lowTag
                     : zValue > 66 ? axes.z.highTag
                     : 'neutral';
      result[axes.z.name] = { value: zValue, concept: zConcept };
    }

    return result;
  }

  // ============================================================================
  // REGION-BASED PLACEMENT (Simplified Narrative Coordinates)
  // ============================================================================

  /**
   * Check if region system is available.
   * Always returns true since CoordinateContext is now required.
   */
  hasRegionSystem(): boolean {
    return true;
  }

  /**
   * Get the RegionMapper instance (for advanced region operations).
   * Uses the location kind's mapper by default.
   */
  /**
   * Get the CoordinateContext for direct access to coordinate services.
   */
  getCoordinateContext(): CoordinateContext {
    return this.coordinateContext;
  }

  /**
   * Get a region by ID within an entity kind.
   */
  getRegion(entityKind: string, regionId: string): Region | undefined {
    return this.coordinateContext.getRegion(entityKind, regionId);
  }

  /**
   * Get all registered regions for an entity kind.
   */
  getAllRegions(entityKind: string): Region[] {
    return this.coordinateContext.getRegions(entityKind);
  }

  /**
   * Look up which region(s) contain a point for an entity kind.
   */
  lookupRegion(entityKind: string, point: Point): RegionLookupResult {
    const regions = this.coordinateContext.getRegions(entityKind);
    const containing = regions.filter(r => this.pointInRegion(point, r));
    return {
      primary: containing[0] ?? null,
      all: containing
    };
  }

  /**
   * Get the region an entity is in based on its coordinates and kind.
   * Returns the primary (most specific) region, or null if not in any region.
   */
  getEntityRegion(entity: HardState): Region | null {
    if (!entity.coordinates || !entity.kind) {
      return null;
    }
    const result = this.lookupRegion(entity.kind, entity.coordinates);
    return result.primary;
  }

  /**
   * Find all entities within a specific region.
   * @param entityKind - Entity kind whose regions to search
   * @param regionId - Region ID to search within
   */
  findEntitiesInRegion(entityKind: string, regionId: string): HardState[] {
    const region = this.coordinateContext.getRegion(entityKind, regionId);
    if (!region) return [];

    const results: HardState[] = [];
    for (const entity of this.graph.getEntities()) {
      if (entity.kind !== entityKind) continue;

      if (entity.coordinates && this.pointInRegion(entity.coordinates, region)) {
        results.push(entity);
      }
    }
    return results;
  }

  /**
   * Get tags that should be applied to an entity at a point.
   * Includes region-specific auto-tags as key-value pairs.
   */
  getRegionTags(entityKind: string, point: Point): EntityTags {
    const regions = this.coordinateContext.getRegions(entityKind);
    const tags: EntityTags = {};

    for (const region of regions) {
      if (this.pointInRegion(point, region)) {
        tags.region = region.id;
        if (region.tags) {
          for (const tag of region.tags) {
            tags[tag] = true;
          }
        }
        if (region.culture) {
          tags.culture = region.culture;
        }
        break; // Use first matching region
      }
    }

    return tags;
  }

  /**
   * Check if a point is inside a region.
   */
  private pointInRegion(point: Point, region: Region): boolean {
    if (region.bounds.shape === 'circle') {
      const { center, radius } = region.bounds;
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      return Math.sqrt(dx * dx + dy * dy) <= radius;
    }
    return false; // Only circle supported for now
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
    entityKind: string,
    nearPoint: Point,
    label: string,
    description: string
  ): EmergentRegionResult {
    return this.coordinateContext.createEmergentRegion(
      entityKind,
      nearPoint,
      label,
      description,
      this.graph.tick
    );
  }

  /**
   * Create an emergent region with Name Forge generating the label.
   * Uses the culture's naming configuration to generate culturally-appropriate region names.
   */
  async createNamedEmergentRegion(
    entityKind: string,
    point: Point,
    cultureId: string
  ): Promise<EmergentRegionResult> {
    return this.coordinateContext.createNamedEmergentRegion(
      entityKind,
      point,
      cultureId,
      this.graph.tick
    );
  }

  /**
   * Find a sparse (unoccupied) area on the semantic plane for an entity kind.
   *
   * This is used for templates that need to place entities far from existing
   * same-kind entities, like colony founding where new colonies should spread
   * across the plane rather than cluster.
   *
   * @param entityKind - Entity kind to find sparse area for
   * @param options - Configuration for sparse area search
   * @returns Result with coordinates of the sparsest valid area found
   *
   * @example
   * ```typescript
   * const result = view.findSparseArea('location', {
   *   minDistanceFromEntities: 20,
   *   preferPeriphery: false
   * });
   *
   * if (result.success) {
   *   console.log(`Found sparse area at (${result.coordinates.x}, ${result.coordinates.y})`);
   * }
   * ```
   */
  findSparseArea(
    entityKind: string,
    options: {
      minDistanceFromEntities?: number;
      preferPeriphery?: boolean;
      maxAttempts?: number;
    }
  ): import('../coordinates/types').SparseAreaResult {
    // Gather existing entity positions for this kind
    const existingPositions: Point[] = [];
    for (const entity of this.graph.getEntities()) {
      if (entity.kind === entityKind && entity.coordinates) {
        existingPositions.push(entity.coordinates);
      }
    }

    return this.coordinateContext.findSparseArea({
      existingPositions,
      minDistanceFromEntities: options.minDistanceFromEntities ?? 15,
      preferPeriphery: options.preferPeriphery ?? false,
      maxAttempts: options.maxAttempts ?? 50
    });
  }

  /**
   * Get region statistics for diagnostics.
   */
  getRegionStats(): {
    cultures: number;
    kinds: number;
    totalRegions: number;
    emergentRegions: number;
  } {
    return this.coordinateContext.getStats();
  }

  // ============================================================================
  // CULTURE-AWARE PLACEMENT (New APIs)
  // ============================================================================

  /**
   * Place an entity within a region using culture context.
   *
   * @param entity - Entity data (coordinates will be generated)
   * @param regionId - Target region ID
   * @param context - Placement context with culture data
   * @returns Entity ID if successful, null if placement failed
   */
  async placeInRegion(
    entity: Omit<Partial<HardState>, 'coordinates'>,
    regionId: string,
    context: PlacementContext
  ): Promise<string | null> {
      const kind = entity.kind ?? 'npc';
    const existingPoints = this.getRegionPoints(kind, regionId);

    // Use CoordinateContext for culture-aware placement
    const placementResult = await this.coordinateContext.placeWithCulture(
      kind,
      entity.name ?? 'unknown',
      this.graph.tick,
      { ...context, seedRegionIds: [regionId] },
      existingPoints
    );

    if (!placementResult.success || !placementResult.coordinates) {
      return null;
    }

    // Merge entity tags with derived tags
    const mergedTags = mergeTags(entity.tags as EntityTags | undefined, placementResult.derivedTags);

    // DEBUG: Log tag merging
    this.debug('coordinates', `[placeInRegion] entity.tags=${JSON.stringify(entity.tags)} derivedTags=${JSON.stringify(placementResult.derivedTags)} mergedTags=${JSON.stringify(mergedTags)}`);

    const entityWithCoords: Partial<HardState> = {
      ...entity,
      tags: mergedTags,
      coordinates: placementResult.coordinates,
      regionId: placementResult.regionId,
      allRegionIds: placementResult.allRegionIds,
      culture: context.cultureId ?? entity.culture
    };

    return await addEntity(this.graph, entityWithCoords);
  }

  /**
   * Place an entity near a reference entity using culture context.
   *
   * @param entity - Entity data
   * @param referenceEntity - Entity to place near
   * @param context - Placement context with culture data
   * @returns Entity ID if successful, null if placement failed
   */
  async placeNearEntity(
    entity: Omit<Partial<HardState>, 'coordinates'>,
    referenceEntity: HardState,
    context: PlacementContext
  ): Promise<string | null> {
    if (!referenceEntity.coordinates) {
      throw new Error(
        `placeNearEntity: Reference entity "${referenceEntity.name}" has no coordinates.`
      );
    }

    const kind = entity.kind ?? 'npc';
    const existingPoints = this.getAllRegionPoints();

    // Build context with reference entity
    const fullContext: PlacementContext = {
      ...context,
      referenceEntity: {
        id: referenceEntity.id,
        coordinates: referenceEntity.coordinates
      }
    };

    const placementResult = await this.coordinateContext.placeWithCulture(
      kind,
      entity.name ?? 'unknown',
      this.graph.tick,
      fullContext,
      existingPoints
    );

    if (!placementResult.success || !placementResult.coordinates) {
      return null;
    }

    // Merge entity tags with derived tags
    const mergedTags = mergeTags(entity.tags as EntityTags | undefined, placementResult.derivedTags);

    const entityWithCoords: Partial<HardState> = {
      ...entity,
      tags: mergedTags,
      coordinates: placementResult.coordinates,
      regionId: placementResult.regionId,
      allRegionIds: placementResult.allRegionIds,
      culture: context.cultureId ?? referenceEntity.culture ?? entity.culture
    };

    return await addEntity(this.graph, entityWithCoords);
  }

  /**
   * Place an entity, optionally in a specific region.
   *
   * NOTE: Emergent region creation is paused pending emergentConfig implementation.
   * This method places the entity in an existing region or default location.
   *
   * @param _regionLabel - Ignored (was for emergent regions)
   * @param entity - Entity data
   * @param context - Placement context with culture data
   * @returns Entity ID and region info if successful
   */
  async spawnEmergentRegionAndPlace(
    _regionLabel: string,
    entity: Omit<Partial<HardState>, 'coordinates'>,
    context: PlacementContext
  ): Promise<{ entityId: string; regionId: string } | null> {
    const kind = entity.kind ?? 'npc';
    const existingPoints = this.getAllRegionPoints();

    // Uses culture-aware placement with emergent region creation
    const placementResult = await this.coordinateContext.placeWithCulture(
      kind,
      entity.name ?? 'unknown',
      this.graph.tick,
      context,
      existingPoints
    );

    if (!placementResult.success || !placementResult.coordinates) {
      return null;
    }

    // Merge entity tags with derived tags
    const mergedTags = mergeTags(entity.tags as EntityTags | undefined, placementResult.derivedTags);

    const entityWithCoords: Partial<HardState> = {
      ...entity,
      tags: mergedTags,
      coordinates: placementResult.coordinates,
      regionId: placementResult.regionId,
      allRegionIds: placementResult.allRegionIds,
      culture: context.cultureId ?? entity.culture
    };

    const entityId = await addEntity(this.graph, entityWithCoords);
    if (!entityId) return null;

    return {
      entityId,
      regionId: placementResult.regionId ?? 'unknown'
    };
  }

  /**
   * Place an entity using only culture ID (loads culture's context automatically).
   *
   * @param cultureId - Culture identifier
   * @param entity - Entity data
   * @returns Entity ID if successful, null if placement failed
   */
  async placeWithCulture(
    cultureId: string,
    entity: Omit<Partial<HardState>, 'coordinates'>
  ): Promise<string | null> {
    const kind = entity.kind ?? 'npc';
    // Build context from culture and entity kind
    const context = this.coordinateContext.buildPlacementContext(cultureId, kind);
    const existingPoints = this.getAllRegionPoints();

    const placementResult = await this.coordinateContext.placeWithCulture(
      kind,
      entity.name ?? 'unknown',
      this.graph.tick,
      context,
      existingPoints
    );

    if (!placementResult.success || !placementResult.coordinates) {
      coordinateStats.recordPlacement({
        tick: this.graph.tick,
        entityKind: kind,
        method: 'placeWithCulture',
        cultureId,
        regionId: undefined,
        hadReferenceEntities: false,
        usedFallback: true,
        coordinates: { x: 50, y: 50, z: 50 }
      });
      return null;
    }

    // Record statistics - this is the proper culture-aware path!
    coordinateStats.recordPlacement({
      tick: this.graph.tick,
      entityKind: kind,
      method: 'placeWithCulture',
      cultureId,
      regionId: placementResult.regionId,
      hadReferenceEntities: false,
      usedFallback: false,
      coordinates: placementResult.coordinates
    });

    // Merge entity tags with derived tags
    const mergedTags = mergeTags(entity.tags as EntityTags | undefined, placementResult.derivedTags);

    // DEBUG: Log tag merging
    this.debug('coordinates', `[placeWithCulture] entity.tags=${JSON.stringify(entity.tags)} derivedTags=${JSON.stringify(placementResult.derivedTags)} mergedTags=${JSON.stringify(mergedTags)}`);

    const entityWithCoords: Partial<HardState> = {
      ...entity,
      tags: mergedTags,
      coordinates: placementResult.coordinates,
      regionId: placementResult.regionId,
      allRegionIds: placementResult.allRegionIds,
      culture: cultureId
    };

    return await addEntity(this.graph, entityWithCoords);
  }

  // ============================================================================
  // REGION HELPERS (Private)
  // ============================================================================

  /**
   * Get all coordinates for entities in a specific region.
   */
  private getRegionPoints(entityKind: string, regionId: string): Point[] {
    const region = this.coordinateContext.getRegion(entityKind, regionId);
    if (!region) return [];

    const points: Point[] = [];
    for (const entity of this.graph.getEntities()) {
      if (entity.kind !== entityKind) continue;
      if (entity.coordinates && this.pointInRegion(entity.coordinates, region)) {
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
