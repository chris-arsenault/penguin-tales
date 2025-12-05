/**
 * GlobalTargets - Editor for global distribution targets
 */

import React from 'react';

export default function GlobalTargets({ global, updateTargets }) {
  return (
    <>
      {/* Total Entities */}
      <div className="lw-card">
        <div className="lw-card-title">Total Entities Target</div>
        <div className="lw-form-grid">
          <div className="lw-form-group">
            <label className="lw-label">Target Count</label>
            <input
              type="number"
              className="lw-input"
              value={global.totalEntities?.target || 150}
              onChange={(e) => updateTargets('global.totalEntities.target', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Tolerance (%)</label>
            <input
              type="number"
              step="0.01"
              className="lw-input"
              value={(global.totalEntities?.tolerance || 0.1) * 100}
              onChange={(e) => updateTargets('global.totalEntities.tolerance', (parseFloat(e.target.value) || 0) / 100)}
            />
          </div>
        </div>
      </div>

      {/* Entity Kind Distribution */}
      <div className="lw-card">
        <div className="lw-card-title">Entity Kind Distribution</div>
        <p className="lw-section-description">
          Target ratios for each entity kind (should sum to 1.0)
        </p>
        {Object.entries(global.entityKindDistribution?.targets || {}).map(([kind, ratio]) => (
          <div key={kind} className="lw-row">
            <span className="lw-row-label">{kind}</span>
            <div className="lw-percentage">
              <div className="lw-percentage-bar">
                <div className="lw-percentage-fill" style={{ width: `${ratio * 100}%` }} />
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                className="lw-input-small"
                value={ratio}
                onChange={(e) => {
                  const newTargets = { ...global.entityKindDistribution.targets, [kind]: parseFloat(e.target.value) || 0 };
                  updateTargets('global.entityKindDistribution.targets', newTargets);
                }}
              />
            </div>
          </div>
        ))}
        <div className="lw-info-box" style={{ marginTop: '12px' }}>
          Total: {Object.values(global.entityKindDistribution?.targets || {}).reduce((a, b) => a + b, 0).toFixed(2)}
        </div>
      </div>

      {/* Prominence Distribution */}
      <div className="lw-card">
        <div className="lw-card-title">Prominence Distribution</div>
        <p className="lw-section-description">
          Target ratios for prominence levels (should sum to 1.0)
        </p>
        {Object.entries(global.prominenceDistribution?.targets || {}).map(([level, ratio]) => (
          <div key={level} className="lw-row">
            <span className="lw-row-label">{level}</span>
            <div className="lw-percentage">
              <div className="lw-percentage-bar">
                <div className="lw-percentage-fill" style={{ width: `${ratio * 100}%` }} />
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                className="lw-input-small"
                value={ratio}
                onChange={(e) => {
                  const newTargets = { ...global.prominenceDistribution.targets, [level]: parseFloat(e.target.value) || 0 };
                  updateTargets('global.prominenceDistribution.targets', newTargets);
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Relationship Distribution */}
      <div className="lw-card">
        <div className="lw-card-title">Relationship Distribution</div>
        <div className="lw-form-grid">
          <div className="lw-form-group">
            <label className="lw-label">Max Single Type Ratio</label>
            <input
              type="number"
              step="0.01"
              className="lw-input"
              value={global.relationshipDistribution?.maxSingleTypeRatio || 0.15}
              onChange={(e) => updateTargets('global.relationshipDistribution.maxSingleTypeRatio', parseFloat(e.target.value) || 0)}
            />
            <div className="lw-comment">Prevents any one relationship type from dominating</div>
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Min Types Present</label>
            <input
              type="number"
              className="lw-input"
              value={global.relationshipDistribution?.minTypesPresent || 12}
              onChange={(e) => updateTargets('global.relationshipDistribution.minTypesPresent', parseInt(e.target.value) || 0)}
            />
            <div className="lw-comment">Minimum number of different relationship types</div>
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Min Type Ratio</label>
            <input
              type="number"
              step="0.01"
              className="lw-input"
              value={global.relationshipDistribution?.minTypeRatio || 0.02}
              onChange={(e) => updateTargets('global.relationshipDistribution.minTypeRatio', parseFloat(e.target.value) || 0)}
            />
            <div className="lw-comment">Minimum ratio for any present relationship type</div>
          </div>
        </div>
      </div>

      {/* Graph Connectivity */}
      <div className="lw-card">
        <div className="lw-card-title">Graph Connectivity</div>
        <div className="lw-form-grid">
          <div className="lw-form-group">
            <label className="lw-label">Target Clusters (Min)</label>
            <input
              type="number"
              className="lw-input"
              value={global.graphConnectivity?.targetClusters?.min || 3}
              onChange={(e) => updateTargets('global.graphConnectivity.targetClusters.min', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Target Clusters (Max)</label>
            <input
              type="number"
              className="lw-input"
              value={global.graphConnectivity?.targetClusters?.max || 8}
              onChange={(e) => updateTargets('global.graphConnectivity.targetClusters.max', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Target Clusters (Preferred)</label>
            <input
              type="number"
              className="lw-input"
              value={global.graphConnectivity?.targetClusters?.preferred || 5}
              onChange={(e) => updateTargets('global.graphConnectivity.targetClusters.preferred', parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Clustering Threshold</label>
            <input
              type="number"
              step="0.1"
              className="lw-input"
              value={global.graphConnectivity?.clusteringStrengthThreshold || 0.6}
              onChange={(e) => updateTargets('global.graphConnectivity.clusteringStrengthThreshold', parseFloat(e.target.value) || 0)}
            />
            <div className="lw-comment">Relationship strength needed to form clusters</div>
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Intra-Cluster Density</label>
            <input
              type="number"
              step="0.01"
              className="lw-input"
              value={global.graphConnectivity?.densityTargets?.intraCluster || 0.65}
              onChange={(e) => updateTargets('global.graphConnectivity.densityTargets.intraCluster', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Inter-Cluster Density</label>
            <input
              type="number"
              step="0.01"
              className="lw-input"
              value={global.graphConnectivity?.densityTargets?.interCluster || 0.12}
              onChange={(e) => updateTargets('global.graphConnectivity.densityTargets.interCluster', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="lw-form-group">
            <label className="lw-label">Max Isolated Node Ratio</label>
            <input
              type="number"
              step="0.01"
              className="lw-input"
              value={global.graphConnectivity?.isolatedNodeRatio?.max || 0.05}
              onChange={(e) => updateTargets('global.graphConnectivity.isolatedNodeRatio.max', parseFloat(e.target.value) || 0)}
            />
            <div className="lw-comment">Maximum percentage of unconnected nodes</div>
          </div>
        </div>
      </div>
    </>
  );
}
