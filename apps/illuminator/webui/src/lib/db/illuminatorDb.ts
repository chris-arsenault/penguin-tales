/**
 * Illuminator Database — Dexie schema
 *
 * Single canonical store for entity and narrative event data.
 * Entities are full records (simulation fields + enrichment) that evolve
 * through the pipeline: simulation creates → Illuminator enriches/renames → viewers display.
 */

import Dexie, { type Table } from 'dexie';
import type { WorldEntity, NarrativeEvent } from '@canonry/world-schema';
import type { EntityEnrichment } from '../enrichmentTypes';

// ---------------------------------------------------------------------------
// Types
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
// Database
// ---------------------------------------------------------------------------

class IlluminatorDatabase extends Dexie {
  entities!: Table<PersistedEntity, string>;
  narrativeEvents!: Table<PersistedNarrativeEvent, string>;

  constructor() {
    super('illuminator');
    this.version(1).stores({
      // Primary key: id. Indexes for bulk queries by run and filtered queries.
      entities: 'id, simulationRunId, kind, [simulationRunId+kind]',
      // Primary key: id. Index for bulk load by run.
      narrativeEvents: 'id, simulationRunId',
    });
  }
}

export const db = new IlluminatorDatabase();
