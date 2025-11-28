/**
 * Region Mapper Service
 *
 * Maps coordinates to named regions. Supports:
 * - Pre-defined regions
 * - Emergent region creation
 * - Auto-tagging entities by region
 * - Nested regions (city within planet)
 */

import type {
  Point,
  Region,
  RegionBounds,
  CircleBounds,
  RectBounds,
  PolygonBounds,
  RegionMapperConfig,
  RegionLookupResult,
  SampleRegionOptions,
  EmergentRegionConfig,
  EmergentRegionResult,
  RegionCreatedEvent,
  EntityPlacedInRegionEvent
} from '../coordinates/types';

import { SPACE_BOUNDS } from '../coordinates/types';

import type { EntityTags } from '../core/worldTypes';
import { arrayToTags, mergeTags } from '../utils';

/**
 * Region Mapper - manages regions and coordinate-to-region mapping.
 */
export class RegionMapper {
  private regions: Map<string, Region> = new Map();
  private config: RegionMapperConfig;
  private eventListeners: {
    regionCreated: Array<(event: RegionCreatedEvent) => void>;
    entityPlaced: Array<(event: EntityPlacedInRegionEvent) => void>;
  } = {
    regionCreated: [],
    entityPlaced: []
  };

  constructor(config: RegionMapperConfig) {
    this.config = config;

    // Register initial regions
    for (const region of config.regions) {
      this.regions.set(region.id, region);
    }
  }

  // ==========================================================================
  // REGION QUERIES
  // ==========================================================================

  /**
   * Get all registered regions.
   */
  getAllRegions(): Region[] {
    return Array.from(this.regions.values());
  }

  /**
   * Get a region by ID.
   */
  getRegion(id: string): Region | undefined {
    return this.regions.get(id);
  }

  /**
   * Find which region(s) contain a point.
   */
  lookup(point: Point): RegionLookupResult {
    const containingRegions: Region[] = [];
    let nearestRegion: Region | null = null;
    let nearestDistance = Infinity;

    for (const region of this.regions.values()) {
      if (this.containsPoint(region, point)) {
        containingRegions.push(region);
      } else {
        const dist = this.distanceToRegion(region, point);
        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearestRegion = region;
        }
      }
    }

    // Sort by specificity (smaller regions = more specific)
    containingRegions.sort((a, b) =>
      this.getRegionArea(a) - this.getRegionArea(b)
    );

    return {
      primary: containingRegions[0] ?? null,
      all: containingRegions,
      nearest: nearestRegion ? { region: nearestRegion, distance: nearestDistance } : undefined
    };
  }

  /**
   * Get narrative description for a point.
   */
  describe(point: Point): string {
    const result = this.lookup(point);

    if (result.all.length === 0) {
      return this.config.defaultRegionLabel;
    }

    if (result.all.length === 1) {
      return result.primary!.label;
    }

    // Multiple regions - describe hierarchy
    // e.g., "Guild Hall in Nova City on Planet Alpha"
    const labels = result.all.map(r => r.label);
    return labels.join(' in ');
  }

  /**
   * Get tags that should be applied to an entity at this point.
   * Returns EntityTags (KVP format) with region info.
   */
  getTagsForPoint(point: Point): EntityTags {
    const result = this.lookup(point);
    let tags: EntityTags = {};

    if (result.all.length === 0) {
      // Not in any region - apply default tags
      if (this.config.defaultTags) {
        tags = mergeTags(tags, arrayToTags(this.config.defaultTags));
      }
      tags.region = 'unassigned';
    } else {
      // Apply tags from all containing regions
      // Primary region is the most specific one
      if (result.primary) {
        tags.region = result.primary.id;
      }

      // Collect all region IDs for hierarchical regions
      const regionIds = result.all.map(r => r.id);
      if (regionIds.length > 1) {
        tags.regions = regionIds.join(',');
      }

      // Merge autoTags from all regions (more specific regions override)
      for (const region of result.all) {
        if (region.autoTags) {
          tags = mergeTags(tags, arrayToTags(region.autoTags));
        }
      }
    }

    return tags;
  }

  // ==========================================================================
  // SAMPLING (get points within regions)
  // ==========================================================================

  /**
   * Sample a random point within a region.
   */
  sampleRegion(regionId: string, options: SampleRegionOptions = {}): Point | null {
    const region = this.regions.get(regionId);
    if (!region) return null;

    const maxAttempts = 100;

    for (let i = 0; i < maxAttempts; i++) {
      const point = this.sampleWithinBounds(region.bounds, region.zRange, options);

      // Check avoidance constraints
      if (options.avoid && options.minDistance) {
        const tooClose = options.avoid.some(p =>
          this.distance(point, p) < options.minDistance!
        );
        if (tooClose) continue;
      }

      return point;
    }

    // Fallback: return center of region
    return this.getRegionCenter(region);
  }

  /**
   * Sample a point within specific bounds.
   */
  private sampleWithinBounds(
    bounds: RegionBounds,
    zRange?: { min: number; max: number },
    options: SampleRegionOptions = {}
  ): Point {
    let x: number, y: number;

    switch (bounds.shape) {
      case 'circle': {
        const { center, radius } = bounds as CircleBounds;
        // Sample with optional center bias
        const r = radius * Math.sqrt(Math.random()) * (1 - (options.centerBias ?? 0) * 0.5);
        const theta = Math.random() * 2 * Math.PI;
        x = center.x + r * Math.cos(theta);
        y = center.y + r * Math.sin(theta);
        break;
      }

      case 'rect': {
        const { x1, y1, x2, y2 } = bounds as RectBounds;
        x = x1 + Math.random() * (x2 - x1);
        y = y1 + Math.random() * (y2 - y1);
        break;
      }

      case 'polygon': {
        // Simple bounding box sampling with rejection
        const poly = bounds as PolygonBounds;
        const bbox = this.getPolygonBBox(poly);
        do {
          x = bbox.x1 + Math.random() * (bbox.x2 - bbox.x1);
          y = bbox.y1 + Math.random() * (bbox.y2 - bbox.y1);
        } while (!this.pointInPolygon({ x, y, z: 0 }, poly));
        break;
      }
    }

    // Clamp to space bounds
    x = Math.max(SPACE_BOUNDS.min, Math.min(SPACE_BOUNDS.max, x));
    y = Math.max(SPACE_BOUNDS.min, Math.min(SPACE_BOUNDS.max, y));

    // Z coordinate
    let z: number;
    if (options.z !== undefined) {
      z = options.z;
    } else if (zRange) {
      z = zRange.min + Math.random() * (zRange.max - zRange.min);
    } else {
      z = 50; // Default middle
    }

    return { x, y, z };
  }

  // ==========================================================================
  // EMERGENT REGIONS
  // ==========================================================================

  /**
   * Find space for and create a new region near a reference point.
   */
  createEmergentRegion(
    nearPoint: Point,
    label: string,
    description: string,
    tick: number,
    createdBy?: string,
    customConfig?: Partial<EmergentRegionConfig>
  ): EmergentRegionResult {
    if (!this.config.allowEmergent) {
      return { success: false, failureReason: 'Emergent regions not allowed' };
    }

    const eConfig = { ...this.config.emergentConfig, ...customConfig } as EmergentRegionConfig;
    if (!eConfig) {
      return { success: false, failureReason: 'No emergent config provided' };
    }

    // Find valid position
    const position = this.findEmergentPosition(nearPoint, eConfig);
    if (!position) {
      return { success: false, failureReason: 'Could not find valid position' };
    }

    // Generate unique ID
    const id = this.generateRegionId(label);

    // Create region
    const region: Region = {
      id,
      label,
      description,
      bounds: {
        shape: 'circle',
        center: { x: position.x, y: position.y },
        radius: eConfig.defaultRadius
      },
      zRange: eConfig.defaultZRange,
      autoTags: [`emergent`, `created:tick-${tick}`],
      emergent: true,
      createdAt: tick,
      createdBy
    };

    this.regions.set(id, region);

    // Emit event
    this.emitRegionCreated({
      region,
      trigger: 'emergent',
      nearPoint,
      tick
    });

    return { success: true, region };
  }

  /**
   * Find a valid position for an emergent region.
   */
  private findEmergentPosition(
    nearPoint: Point,
    config: EmergentRegionConfig
  ): { x: number; y: number } | null {
    const { minDistanceFromExisting, defaultRadius, maxAttempts, preferredArea } = config;

    for (let i = 0; i < maxAttempts; i++) {
      // Generate candidate position
      // Start near the reference point, gradually expand search
      const searchRadius = 20 + (i / maxAttempts) * 50;
      const angle = Math.random() * 2 * Math.PI;
      const dist = Math.random() * searchRadius;

      let x = nearPoint.x + dist * Math.cos(angle);
      let y = nearPoint.y + dist * Math.sin(angle);

      // Apply preferred area bias
      if (preferredArea) {
        x = x * (1 - preferredArea.weight) + preferredArea.center.x * preferredArea.weight;
        y = y * (1 - preferredArea.weight) + preferredArea.center.y * preferredArea.weight;
      }

      // Clamp to bounds with margin for radius
      x = Math.max(defaultRadius, Math.min(SPACE_BOUNDS.max - defaultRadius, x));
      y = Math.max(defaultRadius, Math.min(SPACE_BOUNDS.max - defaultRadius, y));

      // Check distance from existing regions
      let valid = true;
      for (const region of this.regions.values()) {
        const regionCenter = this.getRegionCenter(region);
        const regionRadius = this.getRegionRadius(region);
        const requiredDist = regionRadius + defaultRadius + minDistanceFromExisting;

        if (this.distance({ x, y, z: 0 }, regionCenter) < requiredDist) {
          valid = false;
          break;
        }
      }

      if (valid) {
        return { x, y };
      }
    }

    return null;
  }

  /**
   * Manually add a region (for domain to register named regions).
   */
  addRegion(region: Region, tick?: number): void {
    this.regions.set(region.id, region);

    this.emitRegionCreated({
      region,
      trigger: 'manual',
      tick: tick ?? 0
    });
  }

  /**
   * Remove a region.
   */
  removeRegion(id: string): boolean {
    return this.regions.delete(id);
  }

  // ==========================================================================
  // ENTITY PLACEMENT INTEGRATION
  // ==========================================================================

  /**
   * Process entity placement - returns tags to apply.
   * Call this when an entity is created at a point.
   */
  processEntityPlacement(entityId: string, point: Point): EntityTags {
    const tags = this.getTagsForPoint(point);
    const result = this.lookup(point);

    // Convert tags to array for event (backward compat for listeners)
    const tagArray = Object.entries(tags).map(([k, v]) =>
      v === true ? k : `${k}:${v}`
    );

    this.emitEntityPlaced({
      entityId,
      point,
      region: result.primary,
      appliedTags: tagArray
    });

    return tags;
  }

  // ==========================================================================
  // GEOMETRY HELPERS
  // ==========================================================================

  /**
   * Check if a region contains a point.
   */
  containsPoint(region: Region, point: Point): boolean {
    // Check z-range first
    if (region.zRange) {
      if (point.z < region.zRange.min || point.z > region.zRange.max) {
        return false;
      }
    }

    const bounds = region.bounds;

    switch (bounds.shape) {
      case 'circle': {
        const { center, radius } = bounds as CircleBounds;
        const dx = point.x - center.x;
        const dy = point.y - center.y;
        return dx * dx + dy * dy <= radius * radius;
      }

      case 'rect': {
        const { x1, y1, x2, y2 } = bounds as RectBounds;
        return point.x >= x1 && point.x <= x2 && point.y >= y1 && point.y <= y2;
      }

      case 'polygon': {
        return this.pointInPolygon(point, bounds as PolygonBounds);
      }
    }
  }

  /**
   * Calculate distance from point to nearest edge of region.
   */
  distanceToRegion(region: Region, point: Point): number {
    const bounds = region.bounds;

    switch (bounds.shape) {
      case 'circle': {
        const { center, radius } = bounds as CircleBounds;
        const distToCenter = Math.sqrt(
          (point.x - center.x) ** 2 + (point.y - center.y) ** 2
        );
        return Math.max(0, distToCenter - radius);
      }

      case 'rect': {
        const { x1, y1, x2, y2 } = bounds as RectBounds;
        const dx = Math.max(x1 - point.x, 0, point.x - x2);
        const dy = Math.max(y1 - point.y, 0, point.y - y2);
        return Math.sqrt(dx * dx + dy * dy);
      }

      case 'polygon': {
        // Simplified: distance to centroid
        const centroid = this.getPolygonCentroid(bounds as PolygonBounds);
        return this.distance(point, { ...centroid, z: point.z });
      }
    }
  }

  /**
   * Get center point of a region.
   */
  getRegionCenter(region: Region): Point {
    const bounds = region.bounds;

    switch (bounds.shape) {
      case 'circle': {
        const { center } = bounds as CircleBounds;
        return { x: center.x, y: center.y, z: region.zRange ? (region.zRange.min + region.zRange.max) / 2 : 50 };
      }

      case 'rect': {
        const { x1, y1, x2, y2 } = bounds as RectBounds;
        return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, z: region.zRange ? (region.zRange.min + region.zRange.max) / 2 : 50 };
      }

      case 'polygon': {
        const centroid = this.getPolygonCentroid(bounds as PolygonBounds);
        return { ...centroid, z: region.zRange ? (region.zRange.min + region.zRange.max) / 2 : 50 };
      }
    }
  }

  /**
   * Get approximate radius of a region.
   */
  getRegionRadius(region: Region): number {
    const bounds = region.bounds;

    switch (bounds.shape) {
      case 'circle':
        return (bounds as CircleBounds).radius;

      case 'rect': {
        const { x1, y1, x2, y2 } = bounds as RectBounds;
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) / 2;
      }

      case 'polygon':
        return Math.sqrt(this.getRegionArea(region) / Math.PI);
    }
  }

  /**
   * Get area of a region.
   */
  private getRegionArea(region: Region): number {
    const bounds = region.bounds;

    switch (bounds.shape) {
      case 'circle': {
        const { radius } = bounds as CircleBounds;
        return Math.PI * radius * radius;
      }

      case 'rect': {
        const { x1, y1, x2, y2 } = bounds as RectBounds;
        return (x2 - x1) * (y2 - y1);
      }

      case 'polygon': {
        const poly = bounds as PolygonBounds;
        return this.polygonArea(poly.points);
      }
    }
  }

  /**
   * Euclidean distance between two points.
   */
  distance(a: Point, b: Point): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
  }

  /**
   * 2D distance (ignoring z).
   */
  distance2D(a: Point, b: Point): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  // ==========================================================================
  // POLYGON HELPERS
  // ==========================================================================

  private pointInPolygon(point: Point, poly: PolygonBounds): boolean {
    const { points } = poly;
    let inside = false;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y;
      const xj = points[j].x, yj = points[j].y;

      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }

  private getPolygonBBox(poly: PolygonBounds): { x1: number; y1: number; x2: number; y2: number } {
    const xs = poly.points.map(p => p.x);
    const ys = poly.points.map(p => p.y);
    return {
      x1: Math.min(...xs),
      y1: Math.min(...ys),
      x2: Math.max(...xs),
      y2: Math.max(...ys)
    };
  }

  private getPolygonCentroid(poly: PolygonBounds): { x: number; y: number } {
    const n = poly.points.length;
    const x = poly.points.reduce((sum, p) => sum + p.x, 0) / n;
    const y = poly.points.reduce((sum, p) => sum + p.y, 0) / n;
    return { x, y };
  }

  private polygonArea(points: Array<{ x: number; y: number }>): number {
    let area = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  }

  // ==========================================================================
  // EVENT SYSTEM
  // ==========================================================================

  /**
   * Subscribe to region created events.
   */
  onRegionCreated(handler: (e: RegionCreatedEvent) => void): void {
    this.eventListeners.regionCreated.push(handler);
  }

  /**
   * Subscribe to entity placed events.
   */
  onEntityPlaced(handler: (e: EntityPlacedInRegionEvent) => void): void {
    this.eventListeners.entityPlaced.push(handler);
  }

  private emitRegionCreated(data: RegionCreatedEvent): void {
    for (const handler of this.eventListeners.regionCreated) {
      handler(data);
    }
  }

  private emitEntityPlaced(data: EntityPlacedInRegionEvent): void {
    for (const handler of this.eventListeners.entityPlaced) {
      handler(data);
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private generateRegionId(label: string): string {
    const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    let id = base;
    let counter = 1;

    while (this.regions.has(id)) {
      id = `${base}_${counter}`;
      counter++;
    }

    return id;
  }

  /**
   * Export current state for serialization.
   */
  export(): { regions: Region[]; config: RegionMapperConfig } {
    return {
      regions: Array.from(this.regions.values()),
      config: this.config
    };
  }

  /**
   * Get stats about regions.
   */
  getStats(): {
    totalRegions: number;
    emergentRegions: number;
    predefinedRegions: number;
    totalArea: number;
  } {
    const regions = Array.from(this.regions.values());
    return {
      totalRegions: regions.length,
      emergentRegions: regions.filter(r => r.emergent).length,
      predefinedRegions: regions.filter(r => !r.emergent).length,
      totalArea: regions.reduce((sum, r) => sum + this.getRegionArea(r), 0)
    };
  }
}
