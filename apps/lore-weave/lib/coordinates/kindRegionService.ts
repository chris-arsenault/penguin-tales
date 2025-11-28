/**
 * Kind Region Service
 *
 * Manages per-entity-kind coordinate maps and regions.
 * Each entity kind has its own independent 2D coordinate space with its own regions.
 *
 * This supports:
 * - Physical entities (locations, NPCs) with geographic regions
 * - Conceptual entities (rules, abilities) with abstract coordinate spaces
 *
 * Regions are mostly emergent - created when entities are placed - with
 * optional seed regions in the initial state.
 */

import type {
  Point,
  Region,
  EntityKindMapConfig,
  EntityKindMapState,
  EntityKindMaps,
  EntityKindMapsState,
  RegionMapperConfig,
  EmergentRegionConfig,
  EmergentRegionResult,
  RegionLookupResult
} from '../coordinates/types';
import type { EntityTags } from '../core/worldTypes';
import { RegionMapper } from './regionMapper';

/**
 * Configuration for the KindRegionService.
 */
export interface KindRegionServiceConfig {
  /** Per-kind map configurations */
  kindMaps: EntityKindMaps;

  /** Default emergent region config (used if kind doesn't specify one) */
  defaultEmergentConfig: EmergentRegionConfig;
}

/**
 * KindRegionService - manages separate coordinate maps per entity kind.
 *
 * Each entity kind has its own RegionMapper with its own set of regions.
 * This allows locations to have geographic regions while abilities have
 * conceptual regions like "combat" or "utility".
 */
export class KindRegionService {
  private mappers: Map<string, RegionMapper> = new Map();
  private states: EntityKindMapsState = {};
  private config: KindRegionServiceConfig;

  constructor(config: KindRegionServiceConfig) {
    this.config = config;

    // Initialize a RegionMapper for each configured entity kind
    for (const [kind, mapConfig] of Object.entries(config.kindMaps)) {
      this.initializeKind(kind, mapConfig);
    }
  }

  /**
   * Initialize a RegionMapper for an entity kind.
   */
  private initializeKind(kind: string, mapConfig: EntityKindMapConfig): void {
    // Build RegionMapperConfig from EntityKindMapConfig
    const regionMapperConfig: RegionMapperConfig = {
      regions: mapConfig.seedRegions ?? [],
      defaultRegionLabel: `Unknown ${kind} region`,
      defaultTags: [],
      allowEmergent: true,
      emergentConfig: mapConfig.emergentConfig ?? this.config.defaultEmergentConfig
    };

    const mapper = new RegionMapper(regionMapperConfig);
    this.mappers.set(kind, mapper);

    // Initialize state
    this.states[kind] = {
      config: mapConfig,
      regions: mapConfig.seedRegions ? [...mapConfig.seedRegions] : []
    };
  }

  // ==========================================================================
  // KIND QUERIES
  // ==========================================================================

  /**
   * Get all configured entity kinds.
   */
  getConfiguredKinds(): string[] {
    return Object.keys(this.config.kindMaps);
  }

  /**
   * Check if a kind has a configured map.
   */
  hasKindMap(kind: string): boolean {
    return this.mappers.has(kind);
  }

  /**
   * Get the RegionMapper for a kind.
   * Creates a default mapper if the kind isn't configured.
   */
  getMapper(kind: string): RegionMapper {
    let mapper = this.mappers.get(kind);

    if (!mapper) {
      // Create a default mapper for unconfigured kinds
      const defaultConfig: RegionMapperConfig = {
        regions: [],
        defaultRegionLabel: `Unknown ${kind} region`,
        defaultTags: [],
        allowEmergent: true,
        emergentConfig: this.config.defaultEmergentConfig
      };
      mapper = new RegionMapper(defaultConfig);
      this.mappers.set(kind, mapper);

      this.states[kind] = {
        config: {
          entityKind: kind,
          name: `${kind} Map`,
          description: `Auto-created coordinate space for ${kind} entities`,
          bounds: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
          hasZAxis: true,
          emergentConfig: this.config.defaultEmergentConfig
        },
        regions: []
      };
    }

    return mapper;
  }

  /**
   * Get state for a kind.
   */
  getKindState(kind: string): EntityKindMapState | undefined {
    return this.states[kind];
  }

  /**
   * Get all states (for serialization).
   */
  getAllStates(): EntityKindMapsState {
    return this.states;
  }

  // ==========================================================================
  // REGION QUERIES
  // ==========================================================================

  /**
   * Get all regions for a kind.
   */
  getRegions(kind: string): Region[] {
    const mapper = this.mappers.get(kind);
    return mapper?.getAllRegions() ?? [];
  }

  /**
   * Get a specific region by ID within a kind.
   */
  getRegion(kind: string, regionId: string): Region | undefined {
    return this.mappers.get(kind)?.getRegion(regionId);
  }

  /**
   * Look up which region(s) contain a point for a kind.
   */
  lookupRegion(kind: string, point: Point): RegionLookupResult {
    const mapper = this.getMapper(kind);
    return mapper.lookup(point);
  }

  /**
   * Get tags for a point in a kind's space.
   */
  getTagsForPoint(kind: string, point: Point): EntityTags {
    const mapper = this.getMapper(kind);
    return mapper.getTagsForPoint(point);
  }

  // ==========================================================================
  // EMERGENT REGIONS
  // ==========================================================================

  /**
   * Create an emergent region for a kind.
   */
  createEmergentRegion(
    kind: string,
    nearPoint: Point,
    label: string,
    description: string,
    tick: number,
    createdBy?: string
  ): EmergentRegionResult {
    const mapper = this.getMapper(kind);
    const result = mapper.createEmergentRegion(nearPoint, label, description, tick, createdBy);

    if (result.success && result.region) {
      // Update state
      const state = this.states[kind];
      if (state) {
        state.regions.push(result.region);
        state.lastRegionCreatedAt = tick;
      }
    }

    return result;
  }

  /**
   * Add a region manually (for seed regions loaded from state).
   */
  addRegion(kind: string, region: Region, tick?: number): void {
    const mapper = this.getMapper(kind);
    mapper.addRegion(region, tick);

    const state = this.states[kind];
    if (state) {
      state.regions.push(region);
    }
  }

  // ==========================================================================
  // ENTITY PLACEMENT
  // ==========================================================================

  /**
   * Process entity placement - returns tags to apply.
   * Also triggers emergent region creation if needed.
   */
  processEntityPlacement(
    kind: string,
    entityId: string,
    point: Point,
    tick: number,
    options?: {
      createEmergentRegion?: boolean;
      emergentLabel?: string;
      emergentDescription?: string;
    }
  ): { tags: EntityTags; region: Region | null; emergentRegionCreated?: Region } {
    const mapper = this.getMapper(kind);
    const lookupResult = mapper.lookup(point);

    let emergentRegionCreated: Region | undefined;

    // Create emergent region if requested and not in any region
    if (options?.createEmergentRegion && !lookupResult.primary) {
      const label = options.emergentLabel ?? `${kind} Zone ${this.states[kind]?.regions.length ?? 0 + 1}`;
      const description = options.emergentDescription ?? `Emergent region discovered at tick ${tick}`;

      const emergentResult = this.createEmergentRegion(
        kind,
        point,
        label,
        description,
        tick,
        entityId
      );

      if (emergentResult.success && emergentResult.region) {
        emergentRegionCreated = emergentResult.region;
      }
    }

    const tags = mapper.processEntityPlacement(entityId, point);

    return {
      tags,
      region: lookupResult.primary,
      emergentRegionCreated
    };
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  /**
   * Get region statistics for a kind.
   */
  getKindStats(kind: string): {
    totalRegions: number;
    emergentRegions: number;
    predefinedRegions: number;
    totalArea: number;
  } | null {
    const mapper = this.mappers.get(kind);
    return mapper?.getStats() ?? null;
  }

  /**
   * Get summary statistics across all kinds.
   */
  getAllStats(): {
    kinds: number;
    totalRegions: number;
    emergentRegions: number;
    predefinedRegions: number;
  } {
    let totalRegions = 0;
    let emergentRegions = 0;
    let predefinedRegions = 0;

    for (const mapper of this.mappers.values()) {
      const stats = mapper.getStats();
      totalRegions += stats.totalRegions;
      emergentRegions += stats.emergentRegions;
      predefinedRegions += stats.predefinedRegions;
    }

    return {
      kinds: this.mappers.size,
      totalRegions,
      emergentRegions,
      predefinedRegions
    };
  }

  // ==========================================================================
  // SERIALIZATION
  // ==========================================================================

  /**
   * Export state for serialization (to save with world state).
   */
  export(): {
    states: EntityKindMapsState;
    config: KindRegionServiceConfig;
  } {
    // Update states with current regions from mappers
    for (const [kind, mapper] of this.mappers.entries()) {
      if (this.states[kind]) {
        this.states[kind].regions = mapper.getAllRegions();
      }
    }

    return {
      states: this.states,
      config: this.config
    };
  }

  /**
   * Import saved state (to restore regions after loading world).
   */
  import(savedStates: EntityKindMapsState): void {
    for (const [kind, state] of Object.entries(savedStates)) {
      // Add all regions from saved state
      for (const region of state.regions) {
        this.addRegion(kind, region);
      }
    }
  }
}

/**
 * Create default emergent config.
 */
export function createDefaultEmergentConfig(): EmergentRegionConfig {
  return {
    minDistanceFromExisting: 5,
    defaultRadius: 10,
    defaultZRange: { min: 0, max: 100 },
    maxAttempts: 50
  };
}

/**
 * Create a simple kind map config.
 */
export function createKindMapConfig(
  entityKind: string,
  name: string,
  description: string,
  seedRegions?: Region[]
): EntityKindMapConfig {
  return {
    entityKind,
    name,
    description,
    bounds: { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } },
    hasZAxis: true,
    emergentConfig: createDefaultEmergentConfig(),
    seedRegions
  };
}
