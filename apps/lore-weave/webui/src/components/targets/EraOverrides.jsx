/**
 * EraOverrides - Per-era distribution override viewer
 */

import React from 'react';

export default function EraOverrides({ perEra }) {
  return (
    <>
      <p className="lw-section-description">
        Per-era overrides adjust global targets for specific eras
      </p>
      {Object.entries(perEra).map(([eraName, overrides]) => (
        <div key={eraName} className="lw-card">
          <div className="lw-card-title">{eraName}</div>
          {overrides.comment && (
            <div className="lw-comment">{overrides.comment}</div>
          )}
          {overrides.entityKindDistribution && (
            <div style={{ marginTop: '12px' }}>
              <label className="lw-label">Entity Kind Overrides</label>
              {Object.entries(overrides.entityKindDistribution).map(([kind, ratio]) => (
                <div key={kind} className="lw-row">
                  <span className="lw-row-label">{kind}</span>
                  <span className="lw-row-value">{typeof ratio === 'number' ? ratio.toFixed(2) : ratio}</span>
                </div>
              ))}
            </div>
          )}
          {overrides.prominenceDistribution && (
            <div style={{ marginTop: '12px' }}>
              <label className="lw-label">Prominence Overrides</label>
              {Object.entries(overrides.prominenceDistribution).map(([level, ratio]) => (
                level !== 'comment' && (
                  <div key={level} className="lw-row">
                    <span className="lw-row-label">{level}</span>
                    <span className="lw-row-value">{typeof ratio === 'number' ? ratio.toFixed(2) : ratio}</span>
                  </div>
                )
              ))}
            </div>
          )}
          {overrides.relationshipDistribution && (
            <div style={{ marginTop: '12px' }}>
              <label className="lw-label">Preferred Relationships</label>
              <div style={{ fontSize: '13px', color: 'var(--lw-text-secondary)' }}>
                {overrides.relationshipDistribution.preferredTypes?.join(', ')}
              </div>
            </div>
          )}
        </div>
      ))}
      {Object.keys(perEra).length === 0 && (
        <div className="lw-empty-state" style={{ height: 'auto', padding: '20px' }}>
          No era-specific overrides configured
        </div>
      )}
    </>
  );
}
