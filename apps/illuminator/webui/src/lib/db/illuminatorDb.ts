/**
 * Illuminator Database — Dexie schema
 *
 * Single canonical store for ALL Illuminator persistence.
 * v1: entities + narrativeEvents (entity enrichment DAL)
 * v2: chronicles, images, costs, traits, run stores, static pages, styles
 */

import Dexie, { type Table } from 'dexie';
import type { WorldEntity, NarrativeEvent } from '@canonry/world-schema';
import type { EntityEnrichment } from '../enrichmentTypes';
import type { ChronicleRecord } from '../chronicleTypes';
import type { ImageRecord, ImageType, ImageAspect } from '../imageTypes';
import type { CostRecord, CostType, CostRecordInput, CostSummary } from '../costTypes';
import type { TraitPalette, UsedTraitRecord, PaletteItem, TraitGuidance } from '../traitTypes';
import type { HistorianRun } from '../historianTypes';
import type { SummaryRevisionRun } from '../summaryRevisionTypes';
import type { DynamicsRun } from '../dynamicsGenerationTypes';
import type { StaticPage, StaticPageStatus } from '../staticPageTypes';
import type { StyleLibrary } from '@canonry/world-schema';

// ---------------------------------------------------------------------------
// Types — entities + events (v1)
// ---------------------------------------------------------------------------

/**
 * Full entity record stored in Dexie.
 * Extends WorldEntity with the enrichment sub-object that Illuminator manages.
 */
export interface PersistedEntity extends WorldEntity {
  /** Scoped to simulation run — entities are meaningless across runs */
  simulationRunId: string;
  /** Illuminator-managed enrichment data */
  enrichment?: EntityEnrichment;
}

/**
 * Full narrative event record stored in Dexie.
 * Extends NarrativeEvent with simulationRunId for scoping.
 */
export interface PersistedNarrativeEvent extends NarrativeEvent {
  simulationRunId: string;
}

// ---------------------------------------------------------------------------
// Types — style library (v2)
// ---------------------------------------------------------------------------

export interface StyleLibraryRecord {
  id: string;
  library: StyleLibrary;
  savedAt: number;
}

// ---------------------------------------------------------------------------
// Re-exports for repository consumers
// ---------------------------------------------------------------------------

export type {
  ChronicleRecord,
  ImageRecord, ImageType, ImageAspect,
  CostRecord, CostType, CostRecordInput, CostSummary,
  TraitPalette, UsedTraitRecord, PaletteItem, TraitGuidance,
  HistorianRun,
  SummaryRevisionRun,
  DynamicsRun,
  StaticPage, StaticPageStatus,
  StyleLibrary,
  StyleLibraryRecord,
};

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

class IlluminatorDatabase extends Dexie {
  entities!: Table<PersistedEntity, string>;
  narrativeEvents!: Table<PersistedNarrativeEvent, string>;
  chronicles!: Table<ChronicleRecord, string>;
  images!: Table<ImageRecord, string>;
  costs!: Table<CostRecord, string>;
  traitPalettes!: Table<TraitPalette, string>;
  usedTraits!: Table<UsedTraitRecord, string>;
  historianRuns!: Table<HistorianRun, string>;
  summaryRevisionRuns!: Table<SummaryRevisionRun, string>;
  dynamicsRuns!: Table<DynamicsRun, string>;
  staticPages!: Table<StaticPage, string>;
  styleLibrary!: Table<StyleLibraryRecord, string>;

  constructor() {
    super('illuminator');

    // v1 — entity enrichment DAL
    this.version(1).stores({
      entities: 'id, simulationRunId, kind, [simulationRunId+kind]',
      narrativeEvents: 'id, simulationRunId',
    });

    // v2 — consolidate all remaining IndexedDB stores
    this.version(2).stores({
      // Existing (unchanged — Dexie requires re-declaring them)
      entities: 'id, simulationRunId, kind, [simulationRunId+kind]',
      narrativeEvents: 'id, simulationRunId',

      // Chronicles (from canonry-chronicles)
      chronicles: 'chronicleId, simulationRunId, projectId',

      // Images (from canonry-images)
      images: 'imageId, projectId, entityId, chronicleId, entityKind, entityCulture, model, imageType, generatedAt',

      // Costs (from canonry-costs)
      costs: 'id, projectId, simulationRunId, entityId, chronicleId, type, model, timestamp',

      // Trait palettes + usage (from canonry-traits)
      traitPalettes: 'id, projectId, entityKind',
      usedTraits: 'id, projectId, simulationRunId, entityKind, entityId',

      // Run stores (from canonry-historian, canonry-summary-revision, canonry-dynamics-generation)
      historianRuns: 'runId, projectId, status, createdAt',
      summaryRevisionRuns: 'runId, projectId, status, createdAt',
      dynamicsRuns: 'runId, projectId, status, createdAt',

      // Static pages (from canonry-static-pages)
      staticPages: 'pageId, projectId, slug, status, updatedAt',

      // Style library (from illuminator-styles)
      styleLibrary: 'id',
    });
  }
}

export const db = new IlluminatorDatabase();
