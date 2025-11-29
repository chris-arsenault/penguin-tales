/**
 * Coordinate Context
 *
 * Centralized coordinate services with culture as first-class input.
 * Holds a single KindRegionService and SemanticEncoder, shared across all
 * templates and systems to ensure region state persists.
 *
 * CRITICAL: This replaces per-view instantiation of RegionMapper/SemanticEncoder.
 * All coordinate operations must go through this context.
 */

import type { Point } from './types';
import type { KindRegionServiceConfig } from './kindRegionService';
import type { SemanticEncoderConfig, SemanticEncodingResult } from './types';
import { KindRegionService } from './kindRegionService';
import { SemanticEncoder } from './semanticEncoder';

// =============================================================================
// CULTURE CONFIGURATION TYPES
// =============================================================================

/**
 * Culture-specific coordinate configuration.
 * Defines how a culture influences placement and semantic encoding.
 */
export interface CultureCoordinateConfig {
  /** Culture identifier (matches entity.culture field) */
  cultureId: string;

  /**
   * Seed region IDs where this culture originates.
   *
   * IMPORTANT: Regions are per-entity-kind. Each entity kind has its own
   * region map with its own region IDs. For seed regions to work for a given
   * entity kind, that kind's region configuration must define regions with
   * these IDs.
   *
   * Example: If seedRegionIds = ['aurora_stack'], then:
   * - kindRegionConfig['location'].regions must include 'aurora_stack'
   * - kindRegionConfig['npc'].regions must include 'aurora_stack'
   * - kindRegionConfig['faction'].regions must include 'aurora_stack'
   * - etc.
   *
   * If a seed region ID doesn't exist for a particular kind, placement
   * falls back to reference entity proximity or random region sampling.
   */
  seedRegionIds: string[];

  /** Preferred semantic axes with bias values (0-100) */
  preferredAxes?: {
    [axisName: string]: number;
  };

  /** Emergent region defaults for this culture */
  emergentDefaults?: {
    /** Label prefix for emergent regions */
    labelPrefix?: string;
    /** Default tags applied to emergent regions */
    tags?: string[];
    /** Preferred placement area bias */
    preferredArea?: {
      center: { x: number; y: number };
      weight: number;
    };
  };
}

/**
 * Context passed to placement operations.
 * Culture data flows through this object to bias sampling and encoding.
 */
export interface PlacementContext {
  /** Culture driving placement biases (required for culture-aware placement) */
  cultureId?: string;

  /** Culture's founding/seed regions to bias placement toward */
  seedRegionIds?: string[];

  /** Culture-specific axis weight overrides */
  preferredAxes?: {
    [axisName: string]: number;
  };

  /** Reference entity for proximity-based placement */
  referenceEntity?: {
    id: string;
    coordinates: Point;
  };

  /** Whether to create emergent region if placement falls outside existing regions */
  createEmergentRegion?: boolean;

  /** Label for emergent region if created */
  emergentRegionLabel?: string;
}

/**
 * Result of a culture-aware placement operation.
 */
export interface PlacementResult {
  /** Whether placement succeeded */
  success: boolean;

  /** Placed coordinates (if successful) */
  coordinates?: Point;

  /** Region ID entity was placed in (null if not in any region) */
  regionId?: string | null;

  /** All region IDs containing the point */
  allRegionIds?: string[];

  /** Tags derived from region + culture */
  derivedTags?: Record<string, string | boolean>;

  /** Culture ID used for placement */
  cultureId?: string;

  /** Whether an emergent region was created */
  emergentRegionCreated?: {
    id: string;
    label: string;
  };

  /** Failure reason if unsuccessful */
  failureReason?: string;
}

// =============================================================================
// COORDINATE CONTEXT CONFIGURATION
// =============================================================================

/**
 * Configuration for CoordinateContext.
 * All fields are REQUIRED - no fallbacks.
 */
export interface CoordinateContextConfig {
  /** Per-kind region service configuration */
  kindRegionConfig: KindRegionServiceConfig;

  /** Semantic encoder configuration */
  semanticConfig: SemanticEncoderConfig;

  /** Culture coordinate configurations (keyed by cultureId) */
  cultures: CultureCoordinateConfig[];
}

// =============================================================================
// COORDINATE CONTEXT
// =============================================================================

/**
 * CoordinateContext - Centralized coordinate services with culture support.
 *
 * This context is owned by the Graph and injected into TemplateGraphView.
 * It ensures that:
 * 1. Region state is shared and persists across all operations
 * 2. Culture biases are consistently applied to placement
 * 3. Semantic encoding uses culture-specific axis weights
 */
export class CoordinateContext {
  private readonly kindRegionService: KindRegionService;
  private readonly semanticEncoder: SemanticEncoder;
  private readonly cultureConfigs: Map<string, CultureCoordinateConfig>;

  constructor(config: CoordinateContextConfig) {
    // Validate required config
    if (!config.kindRegionConfig) {
      throw new Error(
        'CoordinateContext: kindRegionConfig is required. ' +
        'Domain must provide per-kind map configurations.'
      );
    }
    if (!config.semanticConfig) {
      throw new Error(
        'CoordinateContext: semanticConfig is required. ' +
        'Domain must provide semantic axis configurations.'
      );
    }
    if (!config.cultures || config.cultures.length === 0) {
      throw new Error(
        'CoordinateContext: at least one culture configuration is required. ' +
        'Domain must define cultures with seed regions and axis preferences.'
      );
    }

    this.kindRegionService = new KindRegionService(config.kindRegionConfig);
    this.semanticEncoder = new SemanticEncoder(config.semanticConfig);

    // Index cultures by ID
    this.cultureConfigs = new Map();
    for (const culture of config.cultures) {
      if (!culture.cultureId) {
        throw new Error(
          'CoordinateContext: culture configuration missing cultureId.'
        );
      }
      if (!culture.seedRegionIds || culture.seedRegionIds.length === 0) {
        throw new Error(
          `CoordinateContext: culture "${culture.cultureId}" must have at least one seedRegionId.`
        );
      }
      this.cultureConfigs.set(culture.cultureId, culture);
    }
  }

  // ===========================================================================
  // CULTURE QUERIES
  // ===========================================================================

  /**
   * Get culture configuration by ID.
   * Throws if culture not found (no fallbacks).
   */
  getCultureConfig(cultureId: string): CultureCoordinateConfig {
    const config = this.cultureConfigs.get(cultureId);
    if (!config) {
      throw new Error(
        `CoordinateContext: culture "${cultureId}" not found. ` +
        `Available cultures: ${Array.from(this.cultureConfigs.keys()).join(', ')}`
      );
    }
    return config;
  }

  /**
   * Check if a culture is configured.
   */
  hasCulture(cultureId: string): boolean {
    return this.cultureConfigs.has(cultureId);
  }

  /**
   * Get all configured culture IDs.
   */
  getCultureIds(): string[] {
    return Array.from(this.cultureConfigs.keys());
  }

  /**
   * Build PlacementContext from culture ID.
   * Loads culture's seed regions and axis preferences.
   */
  buildPlacementContext(cultureId: string): PlacementContext {
    const cultureConfig = this.getCultureConfig(cultureId);
    return {
      cultureId,
      seedRegionIds: cultureConfig.seedRegionIds,
      preferredAxes: cultureConfig.preferredAxes
    };
  }

  // ===========================================================================
  // REGION SERVICE ACCESS
  // ===========================================================================

  /**
   * Get the shared KindRegionService instance.
   */
  getKindRegionService(): KindRegionService {
    return this.kindRegionService;
  }

  /**
   * Check if a kind has configured regions.
   */
  hasKindMap(kind: string): boolean {
    return this.kindRegionService.hasKindMap(kind);
  }

  /**
   * Get all configured entity kinds.
   */
  getConfiguredKinds(): string[] {
    return this.kindRegionService.getConfiguredKinds();
  }

  // ===========================================================================
  // SEMANTIC ENCODER ACCESS
  // ===========================================================================

  /**
   * Get the shared SemanticEncoder instance.
   */
  getSemanticEncoder(): SemanticEncoder {
    return this.semanticEncoder;
  }

  /**
   * Encode tags into coordinates with optional culture bias.
   *
   * @param entityKind - Entity kind for axis selection
   * @param tags - Tags to encode
   * @param context - Optional placement context with culture biases
   */
  encodeWithCulture(
    entityKind: string,
    tags: Record<string, boolean> | string[],
    context?: PlacementContext
  ): SemanticEncodingResult {
    // Base encoding
    let result = this.semanticEncoder.encode(entityKind, tags);

    // Apply culture axis biases if provided
    if (context?.preferredAxes) {
      const axes = this.semanticEncoder.getAxes(entityKind);
      if (axes) {
        const coords = { ...result.coordinates };

        // Blend culture preferences with semantic encoding
        for (const [axisName, bias] of Object.entries(context.preferredAxes)) {
          // Find which coordinate this axis maps to
          if (axes.x.name === axisName) {
            coords.x = coords.x * 0.7 + bias * 0.3; // 70% semantic, 30% culture
          } else if (axes.y.name === axisName) {
            coords.y = coords.y * 0.7 + bias * 0.3;
          } else if (axes.z.name === axisName) {
            coords.z = coords.z * 0.7 + bias * 0.3;
          }
        }

        result = {
          ...result,
          coordinates: coords
        };
      }
    }

    return result;
  }

  // ===========================================================================
  // CULTURE-AWARE PLACEMENT
  // ===========================================================================

  /**
   * Sample a point biased toward culture's seed regions.
   *
   * Flow:
   * 1. Load culture's seed regions
   * 2. Randomly pick a seed region (weighted by size or uniform)
   * 3. Sample within that region with slight jitter
   * 4. Fall back to semantic encoding if no seed regions have space
   *
   * @param kind - Entity kind for region mapper selection
   * @param context - Placement context with culture and options
   * @param existingPoints - Points to avoid
   * @param minDistance - Minimum distance from existing points
   */
  sampleWithCulture(
    kind: string,
    context: PlacementContext,
    existingPoints: Point[] = [],
    minDistance: number = 5,
    options: { enableNonRegionPlacement?: boolean } = {}
  ): Point | null {
    const { enableNonRegionPlacement = false } = options;
    const mapper = this.kindRegionService.getMapper(kind);

    // Try to sample from seed regions
    if (context.cultureId && context.seedRegionIds && context.seedRegionIds.length > 0) {
      const shuffledSeeds = [...context.seedRegionIds].sort(() => Math.random() - 0.5);

      for (const seedRegionId of shuffledSeeds) {
        const region = mapper.getRegion(seedRegionId);
        if (!region) continue;

        const point = mapper.sampleRegion(seedRegionId, {
          avoid: existingPoints,
          minDistance,
          centerBias: 0.3
        });

        if (point && this.isValidPlacement(point, existingPoints, minDistance, mapper)) {
          return point;
        }
      }
    }

    // Try any region of this kind
    const allRegions = mapper.getAllRegions();
    for (const region of allRegions.sort(() => Math.random() - 0.5)) {
      const point = mapper.sampleRegion(region.id, {
        avoid: existingPoints,
        minDistance
      });

      if (point && this.isValidPlacement(point, existingPoints, minDistance, mapper)) {
        return point;
      }
    }

    // No region placement available - fail unless fallback explicitly enabled
    if (!enableNonRegionPlacement) {
      throw new Error(
        `[CoordinateContext] No regions configured for kind '${kind}'. ` +
        `Culture '${context.cultureId ?? 'none'}' seed regions: [${context.seedRegionIds?.join(', ') ?? 'none'}]. ` +
        `Configure regions in kindRegionConfig['${kind}'] or set enableNonRegionPlacement=true.`
      );
    }

    // FALLBACK (explicitly enabled): Reference entity proximity
    console.warn(
      `[CoordinateContext] FALLBACK (enableNonRegionPlacement=true): ` +
      `Using non-region placement for '${kind}'. This is likely a contract violation.`
    );

    if (context.referenceEntity?.coordinates) {
      const ref = context.referenceEntity.coordinates;
      const maxAttempts = 50;

      for (let i = 0; i < maxAttempts; i++) {
        const searchRadius = minDistance + i * 0.5;
        const angle = Math.random() * 2 * Math.PI;

        const point: Point = {
          x: Math.max(0, Math.min(100, ref.x + searchRadius * Math.cos(angle))),
          y: Math.max(0, Math.min(100, ref.y + searchRadius * Math.sin(angle))),
          z: ref.z
        };

        if (this.isValidPlacement(point, existingPoints, minDistance, mapper)) {
          return point;
        }
      }
    }

    // Ultimate fallback: random coordinates
    return {
      x: 10 + Math.random() * 80,
      y: 10 + Math.random() * 80,
      z: 30 + Math.random() * 40
    };
  }

  /**
   * Place an entity with full culture context.
   *
   * Complete flow:
   * 1. Sample point biased by culture
   * 2. Apply region mutations (create emergent if needed)
   * 3. Derive tags from placement + culture
   * 4. Return complete placement result
   */
  placeWithCulture(
    kind: string,
    entityId: string,
    tick: number,
    context: PlacementContext,
    existingPoints: Point[] = [],
    minDistance: number = 5
  ): PlacementResult {
    // 1. Sample point with culture bias
    const point = this.sampleWithCulture(kind, context, existingPoints, minDistance);
    if (!point) {
      return {
        success: false,
        failureReason: 'Could not find valid placement point'
      };
    }

    // 2. Process placement through KindRegionService (may create emergent region)
    const placementResult = this.kindRegionService.processEntityPlacement(
      kind,
      entityId,
      point,
      tick,
      context
    );

    // 3. Merge culture into derived tags
    const derivedTags = { ...placementResult.tags };
    if (context.cultureId) {
      derivedTags.culture = context.cultureId;
    }

    return {
      success: true,
      coordinates: point,
      regionId: placementResult.region?.id ?? null,
      allRegionIds: placementResult.allRegions.map(r => r.id),
      derivedTags,
      cultureId: context.cultureId,
      emergentRegionCreated: placementResult.emergentRegionCreated
        ? { id: placementResult.emergentRegionCreated.id, label: placementResult.emergentRegionCreated.label }
        : undefined
    };
  }

  /**
   * Check if a point is valid (maintains minimum distance from existing).
   */
  private isValidPlacement(
    point: Point,
    existing: Point[],
    minDistance: number,
    mapper: import('./regionMapper').RegionMapper
  ): boolean {
    for (const other of existing) {
      if (mapper.distance(point, other) < minDistance) {
        return false;
      }
    }
    return true;
  }

  // ===========================================================================
  // SERIALIZATION
  // ===========================================================================

  /**
   * Export coordinate state for world persistence.
   */
  export(): {
    kindRegionState: ReturnType<KindRegionService['export']>;
  } {
    return {
      kindRegionState: this.kindRegionService.export()
    };
  }

  /**
   * Import coordinate state from world persistence.
   */
  import(state: {
    kindRegionState?: { states: import('./types').EntityKindMapsState };
  }): void {
    if (state.kindRegionState?.states) {
      this.kindRegionService.import(state.kindRegionState.states);
    }
  }

  // ===========================================================================
  // STATISTICS
  // ===========================================================================

  /**
   * Get statistics about coordinate system state.
   */
  getStats(): {
    cultures: number;
    kinds: number;
    regions: ReturnType<KindRegionService['getAllStats']>;
  } {
    return {
      cultures: this.cultureConfigs.size,
      kinds: this.kindRegionService.getConfiguredKinds().length,
      regions: this.kindRegionService.getAllStats()
    };
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a CoordinateContext from configuration.
 * Validates all required configuration is provided.
 */
export function createCoordinateContext(
  config: CoordinateContextConfig
): CoordinateContext {
  return new CoordinateContext(config);
}
