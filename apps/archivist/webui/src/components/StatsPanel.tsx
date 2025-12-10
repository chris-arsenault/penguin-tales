import type { WorldState } from '../types/world.ts';
import './StatsPanel.css';

interface StatsPanelProps {
  worldData: WorldState;
  isOpen: boolean;
  onToggle: () => void;
}

export default function StatsPanel({ worldData, isOpen, onToggle }: StatsPanelProps) {
  const { pressures, distributionMetrics, validation } = worldData;

  // Get pressure entries and sort by value
  const pressureEntries = Object.entries(pressures).sort((a, b) => b[1] - a[1]);

  return (
    <>
      {/* Stats Panel */}
      {isOpen && (
        <div className="stats-panel">
          <div className="stats-panel-header">
            <h3 className="stats-panel-title">World Statistics</h3>
            <button onClick={onToggle} className="stats-panel-close">✕</button>
          </div>

          <div className="stats-panel-content">
            {/* Validation Status */}
            {validation && (
              <div className="stats-section">
                <h4 className="stats-section-title">Validation</h4>
                <div className="validation-summary">
                  <div className="validation-stat">
                    <span className="validation-label">Passed:</span>
                    <span className="validation-value passed">{validation.passed}/{validation.totalChecks}</span>
                  </div>
                  {validation.failed > 0 && (
                    <div className="validation-stat">
                      <span className="validation-label">Failed:</span>
                      <span className="validation-value failed">{validation.failed}</span>
                    </div>
                  )}
                </div>
                <div className="validation-results">
                  {validation.results.map((result, i) => (
                    <div key={i} className={`validation-result ${result.passed ? 'passed' : 'failed'}`}>
                      <div className="validation-result-header">
                        <span className="validation-result-icon">{result.passed ? '✓' : '✗'}</span>
                        <span className="validation-result-name">{result.name}</span>
                        {!result.passed && (
                          <span className="validation-result-count">({result.failureCount})</span>
                        )}
                      </div>
                      {!result.passed && (
                        <div className="validation-result-details">{result.details}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pressures */}
            <div className="stats-section">
              <h4 className="stats-section-title">World Pressures</h4>
              <div className="pressures-grid">
                {pressureEntries.map(([name, value]) => {
                  const clamped = Math.max(-100, Math.min(100, value));
                  const percentage = ((clamped + 100) / 2); // -100..100 → 0..100
                  const magnitude = Math.abs(clamped);
                  const intensity =
                    magnitude >= 75 ? 'high' :
                    magnitude >= 50 ? 'medium' :
                    magnitude >= 25 ? 'low' : 'minimal';
                  return (
                    <div key={name} className="pressure-item">
                      <div className="pressure-header">
                        <span className="pressure-name">{name.replace(/_/g, ' ')}</span>
                        <span className="pressure-value">{value.toFixed(1)}</span>
                      </div>
                      <div className="pressure-bar">
                        <div
                          className={`pressure-bar-fill ${intensity}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Distribution Metrics */}
            {distributionMetrics && distributionMetrics.graphMetrics && (
              <>
                {/* Graph Metrics */}
                <div className="stats-section">
                  <h4 className="stats-section-title">Graph Metrics</h4>
                  <div className="metrics-grid">
                    <div className="metric-card">
                      <div className="metric-label">Clusters</div>
                      <div className="metric-value">{distributionMetrics.graphMetrics.clusters}</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Avg Cluster Size</div>
                      <div className="metric-value">{distributionMetrics.graphMetrics.avgClusterSize.toFixed(2)}</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Isolated Nodes</div>
                      <div className="metric-value">{distributionMetrics.graphMetrics.isolatedNodes}</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Isolated Ratio</div>
                      <div className="metric-value">{(distributionMetrics.graphMetrics.isolatedNodeRatio * 100).toFixed(1)}%</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Intra-Cluster</div>
                      <div className="metric-value">{(distributionMetrics.graphMetrics.intraClusterDensity * 100).toFixed(1)}%</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Inter-Cluster</div>
                      <div className="metric-value">{(distributionMetrics.graphMetrics.interClusterDensity * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>

                {/* Entity Kind Distribution */}
                {distributionMetrics.entityKindRatios && (
                  <div className="stats-section">
                    <h4 className="stats-section-title">Entity Distribution</h4>
                    <div className="distribution-bars">
                      {Object.entries(distributionMetrics.entityKindRatios)
                        .sort((a, b) => b[1] - a[1])
                        .map(([kind, ratio]) => (
                          <div key={kind} className="distribution-item">
                            <div className="distribution-label">{kind}</div>
                            <div className="distribution-bar-container">
                              <div
                                className="distribution-bar-fill"
                                style={{ width: `${ratio * 100}%` }}
                              />
                              <span className="distribution-percentage">{(ratio * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Prominence Distribution */}
                {distributionMetrics.prominenceRatios && (
                  <div className="stats-section">
                    <h4 className="stats-section-title">Prominence Distribution</h4>
                    <div className="distribution-bars">
                      {Object.entries(distributionMetrics.prominenceRatios)
                        .sort((a, b) => {
                          const order = ['mythic', 'renowned', 'recognized', 'marginal', 'forgotten'];
                          return order.indexOf(a[0]) - order.indexOf(b[0]);
                        })
                        .map(([prominence, ratio]) => (
                          <div key={prominence} className="distribution-item">
                            <div className="distribution-label">{prominence}</div>
                            <div className="distribution-bar-container">
                              <div
                                className={`distribution-bar-fill prominence-${prominence}`}
                                style={{ width: `${ratio * 100}%` }}
                              />
                              <span className="distribution-percentage">{(ratio * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Top Relationship Types */}
                {distributionMetrics.relationshipTypeRatios && (
                  <div className="stats-section">
                    <h4 className="stats-section-title">Top Relationship Types</h4>
                    <div className="distribution-bars">
                      {Object.entries(distributionMetrics.relationshipTypeRatios)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([type, ratio]) => (
                          <div key={type} className="distribution-item">
                            <div className="distribution-label">{type.replace(/_/g, ' ')}</div>
                            <div className="distribution-bar-container">
                              <div
                                className="distribution-bar-fill"
                                style={{ width: `${ratio * 100}%` }}
                              />
                              <span className="distribution-percentage">{(ratio * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
