/**
 * EntityTargets - Per-subtype population targets editor
 */

import React from 'react';

export default function EntityTargets({ entities, updateTargets, distributionTargets }) {
  // Group by entity kind
  const kindGroups = {};
  Object.entries(entities).forEach(([key, value]) => {
    if (key === 'comment') return;
    if (typeof value === 'object') {
      kindGroups[key] = value;
    }
  });

  return (
    <>
      <p className="lw-section-description">
        Per-subtype population targets for homeostatic control
      </p>
      {Object.entries(kindGroups).map(([kind, subtypes]) => (
        <div key={kind} className="lw-card">
          <div className="lw-card-title">{kind}</div>
          {Object.entries(subtypes).map(([subtype, config]) => (
            <div key={subtype} className="lw-row">
              <span className="lw-row-label">{subtype}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label className="lw-label" style={{ marginBottom: 0 }}>Target:</label>
                <input
                  type="number"
                  className="lw-input-small"
                  value={config.target || 0}
                  onChange={(e) => {
                    const newEntities = JSON.parse(JSON.stringify(distributionTargets.entities));
                    if (!newEntities[0][kind]) newEntities[0][kind] = {};
                    newEntities[0][kind][subtype] = { ...config, target: parseInt(e.target.value) || 0 };
                    updateTargets('entities', newEntities);
                  }}
                />
              </div>
              {config.comment && (
                <span className="lw-comment" style={{ marginTop: 0, marginLeft: '8px' }}>
                  {config.comment}
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
