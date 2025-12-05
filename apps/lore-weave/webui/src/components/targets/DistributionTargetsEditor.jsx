/**
 * DistributionTargetsEditor - Editor for statistical distribution targets
 *
 * Allows editing of distribution targets that guide the simulation toward
 * desired statistical outcomes for entity kinds, prominence, relationships,
 * and graph connectivity.
 */

import React, { useState, useCallback } from 'react';
import { SUBTABS } from './constants';
import GlobalTargets from './GlobalTargets';
import EntityTargets from './EntityTargets';
import EraOverrides from './EraOverrides';
import TuningParameters from './TuningParameters';

export default function DistributionTargetsEditor({
  distributionTargets,
  schema,
  onDistributionTargetsChange,
}) {
  const [activeSubtab, setActiveSubtab] = useState('global');

  // Create default targets if none exist
  const createDefaultTargets = useCallback(() => {
    const defaultTargets = {
      $schema: 'Distribution targets for statistical world generation tuning',
      version: '1.0.0',
      global: {
        totalEntities: { target: 150, tolerance: 0.1 },
        entityKindDistribution: {
          type: 'uniform',
          targets: {},
          tolerance: 0.05,
        },
        prominenceDistribution: {
          type: 'normal',
          mean: 'recognized',
          stdDev: 1.0,
          targets: {
            forgotten: 0.10,
            marginal: 0.25,
            recognized: 0.30,
            renowned: 0.25,
            mythic: 0.10,
          },
        },
        relationshipDistribution: {
          type: 'diverse',
          maxSingleTypeRatio: 0.15,
          minTypesPresent: 12,
          minTypeRatio: 0.02,
        },
        graphConnectivity: {
          type: 'clustered',
          clusteringStrengthThreshold: 0.6,
          targetClusters: { min: 3, max: 8, preferred: 5 },
          clusterSizeDistribution: { type: 'powerlaw', alpha: 2.5 },
          densityTargets: { intraCluster: 0.65, interCluster: 0.12 },
          isolatedNodeRatio: { max: 0.05 },
        },
      },
      perEra: {},
      entities: [{}],
      tuning: {
        adjustmentSpeed: 0.3,
        deviationSensitivity: 1.5,
        minTemplateWeight: 0.05,
        maxTemplateWeight: 3.0,
        convergenceThreshold: 0.08,
        measurementInterval: 5,
        correctionStrength: {
          entityKind: 1.2,
          prominence: 0.8,
          relationship: 1.5,
          connectivity: 1.0,
        },
      },
      relationshipCategories: {},
    };

    // Populate entity kind targets from schema
    if (schema?.entityKinds) {
      const count = schema.entityKinds.length;
      const ratio = count > 0 ? 1.0 / count : 0;
      schema.entityKinds.forEach((ek) => {
        defaultTargets.global.entityKindDistribution.targets[ek.kind] = parseFloat(ratio.toFixed(2));
      });
    }

    onDistributionTargetsChange(defaultTargets);
  }, [schema, onDistributionTargetsChange]);

  // Update a nested path in the targets
  const updateTargets = useCallback((path, value) => {
    if (!distributionTargets) return;

    const newTargets = JSON.parse(JSON.stringify(distributionTargets));
    const parts = path.split('.');
    let current = newTargets;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;
    onDistributionTargetsChange(newTargets);
  }, [distributionTargets, onDistributionTargetsChange]);

  // If no targets exist, show empty state
  if (!distributionTargets) {
    return (
      <div className="lw-container">
        <div className="lw-header">
          <h1 className="lw-title">Distribution Targets</h1>
          <p className="lw-subtitle">
            Configure statistical targets to guide world generation
          </p>
        </div>
        <div className="lw-empty-state" style={{ height: 'auto', padding: '40px 20px' }}>
          <div className="lw-empty-title">No Distribution Targets Configured</div>
          <div className="lw-empty-text">
            Distribution targets guide the simulation toward desired statistical outcomes.
            They control entity kind ratios, prominence distribution, relationship diversity,
            and graph connectivity.
          </div>
          <button className="lw-btn lw-btn-primary" onClick={createDefaultTargets}>
            Create Default Targets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lw-container">
      <div className="lw-header">
        <h1 className="lw-title">Distribution Targets</h1>
        <p className="lw-subtitle">
          Configure statistical targets to guide world generation toward desired outcomes
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="lw-tabs">
        {SUBTABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubtab(tab.id)}
            className={`lw-tab ${activeSubtab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="lw-section">
        {activeSubtab === 'global' && (
          <GlobalTargets
            global={distributionTargets.global || {}}
            updateTargets={updateTargets}
          />
        )}
        {activeSubtab === 'entities' && (
          <EntityTargets
            entities={distributionTargets.entities?.[0] || {}}
            updateTargets={updateTargets}
            distributionTargets={distributionTargets}
          />
        )}
        {activeSubtab === 'eras' && (
          <EraOverrides perEra={distributionTargets.perEra || {}} />
        )}
        {activeSubtab === 'tuning' && (
          <TuningParameters
            tuning={distributionTargets.tuning || {}}
            updateTargets={updateTargets}
          />
        )}
      </div>
    </div>
  );
}
