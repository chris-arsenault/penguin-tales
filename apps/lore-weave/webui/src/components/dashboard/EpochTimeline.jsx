/**
 * EpochTimeline - Shows recent epochs and pressure gauges
 */

import React from 'react';

export default function EpochTimeline({ epochStats, currentEpoch, pressures }) {
  const recentEpochs = epochStats.slice(-5).reverse();

  return (
    <div className="lw-panel">
      <div className="lw-panel-header">
        <div className="lw-panel-title">
          <span>⏱</span>
          Epoch Timeline
        </div>
        {currentEpoch && (
          <span style={{ fontSize: '12px', color: 'var(--lw-text-muted)' }}>
            Era: {currentEpoch.era.name}
          </span>
        )}
      </div>
      <div className="lw-panel-content">
        {recentEpochs.length === 0 ? (
          <div className="lw-empty-state">
            <span className="lw-empty-icon">⏳</span>
            <span>No epochs completed yet</span>
          </div>
        ) : (
          <>
            <div className="lw-timeline">
              {recentEpochs.map((epoch, i) => (
                <div
                  key={epoch.epoch}
                  className={`lw-timeline-item ${i === 0 ? 'active' : ''}`}
                  style={{ opacity: i === 0 ? 1 : 0.7 }}
                >
                  <div className={`lw-timeline-icon ${i === 0 ? 'active' : ''}`}>
                    {epoch.epoch}
                  </div>
                  <div className="lw-timeline-content">
                    <div className="lw-timeline-title">{epoch.era}</div>
                    <div className="lw-timeline-subtitle">
                      +{epoch.entitiesCreated} entities • +{epoch.relationshipsCreated} relations
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pressure Gauges */}
            {pressures && Object.keys(pressures).length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--lw-text-muted)', marginBottom: '8px' }}>
                  Current Pressures
                </div>
                <div className="lw-flex-col lw-gap-sm">
                  {Object.entries(pressures).slice(0, 5).map(([name, value]) => (
                    <div key={name} className="lw-pressure-gauge">
                      <span className="lw-pressure-name">{name}</span>
                      <div className="lw-pressure-bar">
                        <div
                          className="lw-pressure-fill"
                          style={{
                            width: `${Math.min(100, value)}%`,
                            backgroundColor: value > 70 ? 'var(--lw-danger)' : value > 40 ? 'var(--lw-warning)' : 'var(--lw-success)'
                          }}
                        />
                      </div>
                      <span className="lw-pressure-value">{value.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
