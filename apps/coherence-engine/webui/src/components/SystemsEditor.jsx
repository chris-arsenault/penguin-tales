/**
 * SystemsEditor - UI for viewing and editing simulation system configurations
 *
 * Systems run during the simulation phase and modify entity states and relationships.
 * Each system has:
 * - systemType: The type of system (connectionEvolution, graphContagion, thresholdTrigger)
 * - config: The configuration specific to that system type
 *
 * System types:
 * - connectionEvolution: Handles relationship strength changes over time
 * - graphContagion: Spreads states/relationships through network connections
 * - thresholdTrigger: Detects conditions and sets tags/pressures for templates
 */

import React, { useState, useCallback } from 'react';

// Arctic Blue base theme with amber accent
const ACCENT_COLOR = '#f59e0b';

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1200px',
  },
  header: {
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#93c5fd',
  },
  systemList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  systemCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    overflow: 'hidden',
  },
  systemHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  systemHeaderHover: {
    backgroundColor: '#2d4a6f',
  },
  systemTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  systemName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
  },
  systemId: {
    fontSize: '12px',
    color: '#60a5fa',
    backgroundColor: '#0c1f2e',
    padding: '2px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
  },
  systemType: {
    fontSize: '11px',
    padding: '2px 10px',
    borderRadius: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  typeConnectionEvolution: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
  },
  typeGraphContagion: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: '#f87171',
  },
  typeThresholdTrigger: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#4ade80',
  },
  typeClusterFormation: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    color: '#c084fc',
  },
  typeTagDiffusion: {
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    color: '#f472b6',
  },
  typePlaneDiffusion: {
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    color: '#38bdf8',
  },
  typeFramework: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    color: '#fbbf24',
  },
  badges: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  badge: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: 500,
  },
  badgeEntity: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
  },
  badgeRelationship: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    color: '#c084fc',
  },
  badgePressure: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#fbbf24',
  },
  badgeTag: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#4ade80',
  },
  badgeDisabled: {
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    color: '#9ca3af',
  },
  toggle: {
    position: 'relative',
    width: '40px',
    height: '22px',
    backgroundColor: '#374151',
    borderRadius: '11px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  toggleEnabled: {
    backgroundColor: '#22c55e',
  },
  toggleKnob: {
    position: 'absolute',
    top: '2px',
    left: '2px',
    width: '18px',
    height: '18px',
    backgroundColor: '#ffffff',
    borderRadius: '50%',
    transition: 'transform 0.2s',
  },
  toggleKnobEnabled: {
    transform: 'translateX(18px)',
  },
  disabledOverlay: {
    opacity: 0.5,
  },
  expandIcon: {
    fontSize: '18px',
    color: '#60a5fa',
    transition: 'transform 0.2s',
  },
  expandIconOpen: {
    transform: 'rotate(180deg)',
  },
  systemContent: {
    padding: '0 20px 20px',
    borderTop: '1px solid rgba(59, 130, 246, 0.3)',
  },
  section: {
    marginTop: '20px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#93c5fd',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionIcon: {
    fontSize: '14px',
  },
  codeBlock: {
    backgroundColor: '#0c1f2e',
    borderRadius: '6px',
    padding: '12px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#93c5fd',
    overflow: 'auto',
    maxHeight: '400px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  infoCard: {
    backgroundColor: '#0a1929',
    borderRadius: '6px',
    padding: '12px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  infoLabel: {
    fontSize: '11px',
    color: '#60a5fa',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  infoValue: {
    fontSize: '14px',
    color: '#ffffff',
    fontWeight: 500,
  },
  description: {
    fontSize: '13px',
    color: '#93c5fd',
    marginTop: '4px',
    lineHeight: 1.4,
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    border: '2px dashed rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    color: '#60a5fa',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  addButtonHover: {
    borderColor: ACCENT_COLOR,
    color: ACCENT_COLOR,
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
    color: '#60a5fa',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  ruleItem: {
    backgroundColor: '#0a1929',
    borderRadius: '6px',
    padding: '10px 12px',
    marginBottom: '6px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    fontSize: '13px',
    color: '#ffffff',
  },
  conditionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  actionItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
};

// Get type-specific style
function getTypeStyle(systemType) {
  switch (systemType) {
    case 'connectionEvolution':
      return styles.typeConnectionEvolution;
    case 'graphContagion':
      return styles.typeGraphContagion;
    case 'thresholdTrigger':
      return styles.typeThresholdTrigger;
    case 'eraSpawner':
    case 'eraTransition':
    case 'universalCatalyst':
      return styles.typeFramework;
    case 'clusterFormation':
      return styles.typeClusterFormation;
    case 'tagDiffusion':
      return styles.typeTagDiffusion;
    case 'planeDiffusion':
      return styles.typePlaneDiffusion;
    default:
      return {};
  }
}

// Get type display name
function getTypeName(systemType) {
  switch (systemType) {
    case 'connectionEvolution':
      return 'Connection Evolution';
    case 'graphContagion':
      return 'Graph Contagion';
    case 'thresholdTrigger':
      return 'Threshold Trigger';
    case 'clusterFormation':
      return 'Cluster Formation';
    case 'tagDiffusion':
      return 'Tag Diffusion';
    case 'planeDiffusion':
      return 'Plane Diffusion';
    case 'eraSpawner':
      return 'Era Spawner';
    case 'eraTransition':
      return 'Era Transition';
    case 'universalCatalyst':
      return 'Agent Actions';
    default:
      return systemType;
  }
}

// Extract summary info from a system
function getSystemSummary(system) {
  const summary = {
    entityKind: null,
    relationships: [],
    pressureEffects: [],
    tags: [],
  };

  const config = system.config;
  if (!config) return summary;

  // Entity kind
  summary.entityKind = config.entityKind;

  // Pressure effects
  if (config.pressureChanges) {
    for (const [pressure, delta] of Object.entries(config.pressureChanges)) {
      const sign = delta >= 0 ? '+' : '';
      summary.pressureEffects.push(`${pressure} ${sign}${delta}`);
    }
  }

  // System-specific summaries
  switch (system.systemType) {
    case 'connectionEvolution':
      // Extract relationship kinds from rules
      if (config.rules) {
        for (const rule of config.rules) {
          if (rule.action?.relationshipKind && !summary.relationships.includes(rule.action.relationshipKind)) {
            summary.relationships.push(rule.action.relationshipKind);
          }
        }
      }
      break;

    case 'graphContagion':
      // Contagion relationship
      if (config.contagion?.relationshipKind) {
        summary.relationships.push(config.contagion.relationshipKind);
      }
      // Infection action
      if (config.infectionAction?.relationshipKind && !summary.relationships.includes(config.infectionAction.relationshipKind)) {
        summary.relationships.push(config.infectionAction.relationshipKind);
      }
      break;

    case 'thresholdTrigger':
      // Tags set by actions
      if (config.actions) {
        for (const action of config.actions) {
          if ((action.type === 'set_tag' || action.type === 'set_cluster_tag') && action.tag) {
            summary.tags.push(action.tag);
          }
        }
      }
      break;
  }

  return summary;
}

// Render connectionEvolution-specific details
function ConnectionEvolutionDetails({ config }) {
  return (
    <>
      {/* Metrics */}
      {config.metrics && config.metrics.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>📊</span>
            Metrics ({config.metrics.length})
          </div>
          {config.metrics.map((metric, index) => (
            <div key={index} style={styles.ruleItem}>
              <strong>{metric.id}</strong>: {metric.type}
              {metric.relationshipKind && ` (${metric.relationshipKind})`}
              {metric.weight && ` weight: ${metric.weight}`}
            </div>
          ))}
        </div>
      )}

      {/* Rules */}
      {config.rules && config.rules.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>📜</span>
            Rules ({config.rules.length})
          </div>
          {config.rules.map((rule, index) => (
            <div key={index} style={styles.ruleItem}>
              <div><strong>{rule.id}</strong></div>
              <div style={{ color: '#93c5fd', fontSize: '12px', marginTop: '4px' }}>
                Conditions: {rule.conditions?.map(c => `${c.metric} ${c.operator} ${c.value}`).join(', ')}
              </div>
              <div style={{ color: '#4ade80', fontSize: '12px', marginTop: '4px' }}>
                Action: {rule.action?.type}
                {rule.action?.relationshipKind && ` → ${rule.action.relationshipKind}`}
              </div>
              {rule.probability && (
                <div style={{ color: '#fbbf24', fontSize: '12px', marginTop: '4px' }}>
                  Probability: {(rule.probability * 100).toFixed(0)}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// Render graphContagion-specific details
function GraphContagionDetails({ config }) {
  return (
    <>
      {/* Contagion */}
      {config.contagion && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>🦠</span>
            Contagion
          </div>
          <div style={styles.infoGrid}>
            <div style={styles.infoCard}>
              <div style={styles.infoLabel}>Type</div>
              <div style={styles.infoValue}>{config.contagion.type}</div>
            </div>
            {config.contagion.relationshipKind && (
              <div style={styles.infoCard}>
                <div style={styles.infoLabel}>Relationship</div>
                <div style={styles.infoValue}>{config.contagion.relationshipKind}</div>
              </div>
            )}
            {config.contagion.tag && (
              <div style={styles.infoCard}>
                <div style={styles.infoLabel}>Tag</div>
                <div style={styles.infoValue}>{config.contagion.tag}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vectors */}
      {config.vectors && config.vectors.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>↔️</span>
            Transmission Vectors ({config.vectors.length})
          </div>
          {config.vectors.map((vector, index) => (
            <div key={index} style={styles.ruleItem}>
              <strong>{vector.relationshipKind}</strong>
              <span style={{ color: '#93c5fd' }}> ({vector.direction})</span>
              {vector.minStrength && <span style={{ color: '#fbbf24' }}> min: {vector.minStrength}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Transmission */}
      {config.transmission && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>📡</span>
            Transmission
          </div>
          <div style={styles.infoGrid}>
            <div style={styles.infoCard}>
              <div style={styles.infoLabel}>Base Rate</div>
              <div style={styles.infoValue}>{(config.transmission.baseRate * 100).toFixed(0)}%</div>
            </div>
            {config.transmission.contactMultiplier && (
              <div style={styles.infoCard}>
                <div style={styles.infoLabel}>Contact Multiplier</div>
                <div style={styles.infoValue}>+{(config.transmission.contactMultiplier * 100).toFixed(0)}%</div>
              </div>
            )}
            {config.transmission.maxProbability && (
              <div style={styles.infoCard}>
                <div style={styles.infoLabel}>Max Probability</div>
                <div style={styles.infoValue}>{(config.transmission.maxProbability * 100).toFixed(0)}%</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Infection Action */}
      {config.infectionAction && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>⚡</span>
            Infection Action
          </div>
          <div style={styles.infoGrid}>
            <div style={styles.infoCard}>
              <div style={styles.infoLabel}>Type</div>
              <div style={styles.infoValue}>{config.infectionAction.type}</div>
            </div>
            {config.infectionAction.relationshipKind && (
              <div style={styles.infoCard}>
                <div style={styles.infoLabel}>Relationship</div>
                <div style={styles.infoValue}>{config.infectionAction.relationshipKind}</div>
              </div>
            )}
            {config.infectionAction.strength && (
              <div style={styles.infoCard}>
                <div style={styles.infoLabel}>Strength</div>
                <div style={styles.infoValue}>{config.infectionAction.strength}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Render thresholdTrigger-specific details
function ThresholdTriggerDetails({ config }) {
  return (
    <>
      {/* Entity Filter */}
      {config.entityFilter && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>🎯</span>
            Entity Filter
          </div>
          <div style={styles.infoGrid}>
            {config.entityFilter.kind && (
              <div style={styles.infoCard}>
                <div style={styles.infoLabel}>Kind</div>
                <div style={styles.infoValue}>{config.entityFilter.kind}</div>
              </div>
            )}
            {config.entityFilter.status && (
              <div style={styles.infoCard}>
                <div style={styles.infoLabel}>Status</div>
                <div style={styles.infoValue}>{config.entityFilter.status}</div>
              </div>
            )}
            {config.entityFilter.notHasTag && (
              <div style={styles.infoCard}>
                <div style={styles.infoLabel}>Not Has Tag</div>
                <div style={styles.infoValue}>{config.entityFilter.notHasTag}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conditions */}
      {config.conditions && config.conditions.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>✓</span>
            Conditions ({config.conditions.length})
          </div>
          {config.conditions.map((cond, index) => (
            <div key={index} style={styles.ruleItem}>
              <div style={styles.conditionItem}>
                <strong>{cond.type}</strong>
                {cond.relationshipKind && <span style={{ color: '#c084fc' }}>{cond.relationshipKind}</span>}
                {cond.minCount !== undefined && <span style={{ color: '#4ade80' }}>min: {cond.minCount}</span>}
                {cond.maxCount !== undefined && <span style={{ color: '#f87171' }}>max: {cond.maxCount}</span>}
                {cond.minTicks !== undefined && <span style={{ color: '#fbbf24' }}>{cond.minTicks} ticks</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {config.actions && config.actions.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>⚡</span>
            Actions ({config.actions.length})
          </div>
          {config.actions.map((action, index) => (
            <div key={index} style={styles.ruleItem}>
              <div style={styles.actionItem}>
                <strong>{action.type}</strong>
                {action.tag && <span style={{ color: '#4ade80' }}>{action.tag}</span>}
                {action.relationshipKind && <span style={{ color: '#c084fc' }}>{action.relationshipKind}</span>}
                {action.tagValue !== undefined && <span style={{ color: '#fbbf24' }}>= {String(action.tagValue)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clustering */}
      {config.clusterMode && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span style={styles.sectionIcon}>🔗</span>
            Clustering
          </div>
          <div style={styles.infoGrid}>
            <div style={styles.infoCard}>
              <div style={styles.infoLabel}>Mode</div>
              <div style={styles.infoValue}>{config.clusterMode}</div>
            </div>
            {config.clusterRelationshipKind && (
              <div style={styles.infoCard}>
                <div style={styles.infoLabel}>Cluster Relationship</div>
                <div style={styles.infoValue}>{config.clusterRelationshipKind}</div>
              </div>
            )}
            {config.minClusterSize && (
              <div style={styles.infoCard}>
                <div style={styles.infoLabel}>Min Size</div>
                <div style={styles.infoValue}>{config.minClusterSize}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function SystemCard({ system, expanded, onToggle, onChange }) {
  const [hovering, setHovering] = useState(false);
  const summary = getSystemSummary(system);
  const config = system.config || {};
  const isEnabled = system.enabled !== false; // Default to enabled

  const handleToggleEnabled = useCallback((e) => {
    e.stopPropagation();
    onChange({
      ...system,
      enabled: !isEnabled,
    });
  }, [system, isEnabled, onChange]);

  return (
    <div style={styles.systemCard}>
      <div
        style={{
          ...styles.systemHeader,
          ...(hovering ? styles.systemHeaderHover : {}),
        }}
        onClick={onToggle}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div style={isEnabled ? {} : styles.disabledOverlay}>
          <div style={styles.systemTitle}>
            <span style={styles.systemName}>{config.name || config.id}</span>
            <span style={styles.systemId}>{config.id}</span>
            <span style={{ ...styles.systemType, ...getTypeStyle(system.systemType) }}>
              {getTypeName(system.systemType)}
            </span>
            {!isEnabled && (
              <span style={{ ...styles.badge, ...styles.badgeDisabled }}>
                disabled
              </span>
            )}
          </div>
          {config.description && (
            <div style={styles.description}>{config.description}</div>
          )}
          <div style={{ ...styles.badges, marginTop: '8px' }}>
            {summary.entityKind && (
              <span style={{ ...styles.badge, ...styles.badgeEntity }}>
                {summary.entityKind}
              </span>
            )}
            {summary.relationships.slice(0, 3).map(rel => (
              <span key={rel} style={{ ...styles.badge, ...styles.badgeRelationship }}>
                {rel}
              </span>
            ))}
            {summary.tags.map(tag => (
              <span key={tag} style={{ ...styles.badge, ...styles.badgeTag }}>
                {tag}
              </span>
            ))}
            {summary.pressureEffects.map(effect => (
              <span key={effect} style={{ ...styles.badge, ...styles.badgePressure }}>
                {effect}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              ...styles.toggle,
              ...(isEnabled ? styles.toggleEnabled : {}),
            }}
            onClick={handleToggleEnabled}
            title={isEnabled ? 'Click to disable' : 'Click to enable'}
          >
            <div style={{
              ...styles.toggleKnob,
              ...(isEnabled ? styles.toggleKnobEnabled : {}),
            }} />
          </div>
          <span style={{
            ...styles.expandIcon,
            ...(expanded ? styles.expandIconOpen : {}),
          }}>
            ▼
          </span>
        </div>
      </div>

      {expanded && (
        <div style={styles.systemContent}>
          {/* Common Info */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>⚙️</span>
              Common Settings
            </div>
            <div style={styles.infoGrid}>
              {config.entityKind && (
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Entity Kind</div>
                  <div style={styles.infoValue}>{config.entityKind}</div>
                </div>
              )}
              {config.throttleChance !== undefined && (
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Throttle Chance</div>
                  <div style={styles.infoValue}>{(config.throttleChance * 100).toFixed(0)}%</div>
                </div>
              )}
              {config.cooldown !== undefined && (
                <div style={styles.infoCard}>
                  <div style={styles.infoLabel}>Cooldown</div>
                  <div style={styles.infoValue}>{config.cooldown} ticks</div>
                </div>
              )}
            </div>
          </div>

          {/* Pressure Changes */}
          {config.pressureChanges && Object.keys(config.pressureChanges).length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                <span style={styles.sectionIcon}>📈</span>
                Pressure Changes
              </div>
              <div style={styles.infoGrid}>
                {Object.entries(config.pressureChanges).map(([pressure, delta]) => (
                  <div key={pressure} style={styles.infoCard}>
                    <div style={styles.infoLabel}>{pressure}</div>
                    <div style={styles.infoValue}>{delta >= 0 ? '+' : ''}{delta}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Type-specific details */}
          {system.systemType === 'connectionEvolution' && (
            <ConnectionEvolutionDetails config={config} />
          )}
          {system.systemType === 'graphContagion' && (
            <GraphContagionDetails config={config} />
          )}
          {system.systemType === 'thresholdTrigger' && (
            <ThresholdTriggerDetails config={config} />
          )}

          {/* Full Config (JSON view) */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <span style={styles.sectionIcon}>📋</span>
              Full Configuration
            </div>
            <div style={styles.codeBlock}>
              {JSON.stringify(system, null, 2)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SystemsEditor({ systems = [], onChange }) {
  const [expandedSystem, setExpandedSystem] = useState(null);
  const [addHovering, setAddHovering] = useState(false);

  const handleSystemChange = useCallback((index, updatedSystem) => {
    const newSystems = [...systems];
    newSystems[index] = updatedSystem;
    onChange(newSystems);
  }, [systems, onChange]);

  const handleAddSystem = useCallback(() => {
    const newSystem = {
      systemType: 'thresholdTrigger',
      config: {
        id: `system_${Date.now()}`,
        name: 'New System',
        description: 'A new threshold trigger system',
        entityFilter: {
          kind: 'npc',
          status: 'alive',
        },
        conditions: [],
        actions: [],
        clusterMode: 'individual',
        throttleChance: 0.2,
      },
    };
    onChange([...systems, newSystem]);
    setExpandedSystem(systems.length);
  }, [systems, onChange]);

  if (systems.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Systems</h1>
          <p style={styles.subtitle}>
            Configure simulation systems that run during the simulation phase.
            Systems modify entity states and relationships based on world conditions.
          </p>
        </div>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>⚙️</div>
          <div>No systems defined yet</div>
          <button
            style={{
              ...styles.addButton,
              marginTop: '16px',
              width: 'auto',
              padding: '12px 24px',
              ...(addHovering ? styles.addButtonHover : {}),
            }}
            onClick={handleAddSystem}
            onMouseEnter={() => setAddHovering(true)}
            onMouseLeave={() => setAddHovering(false)}
          >
            + Add First System
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Systems</h1>
        <p style={styles.subtitle}>
          Configure simulation systems that run during the simulation phase.
          Systems modify entity states and relationships based on world conditions.
        </p>
      </div>

      <div style={styles.systemList}>
        {systems.map((system, index) => (
          <SystemCard
            key={system.config?.id || index}
            system={system}
            expanded={expandedSystem === index}
            onToggle={() => setExpandedSystem(expandedSystem === index ? null : index)}
            onChange={(updated) => handleSystemChange(index, updated)}
          />
        ))}

        <button
          style={{
            ...styles.addButton,
            ...(addHovering ? styles.addButtonHover : {}),
          }}
          onClick={handleAddSystem}
          onMouseEnter={() => setAddHovering(true)}
          onMouseLeave={() => setAddHovering(false)}
        >
          + Add System
        </button>
      </div>
    </div>
  );
}
