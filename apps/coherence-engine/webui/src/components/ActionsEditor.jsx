/**
 * ActionsEditor - UI for viewing and editing declarative action configurations
 *
 * Actions define what agents can do during the simulation via the universalCatalyst system.
 * Each action has:
 * - id: Unique identifier
 * - name: Display name
 * - domain: Action domain (political, military, economic, etc.)
 * - actor: Who can perform this action
 * - targeting: How to find valid targets
 * - outcome: What happens on success
 * - probability: Success chance and selection weight
 */

import React, { useState, useCallback } from 'react';

// Arctic Blue base theme with amber accent
const ACCENT_COLOR = '#f59e0b';

// Domain colors for visual distinction
const DOMAIN_COLORS = {
  political: { bg: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa' },
  military: { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171' },
  economic: { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ade80' },
  magical: { bg: 'rgba(168, 85, 247, 0.2)', text: '#c084fc' },
  technological: { bg: 'rgba(14, 165, 233, 0.2)', text: '#38bdf8' },
  environmental: { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ade80' },
  cultural: { bg: 'rgba(236, 72, 153, 0.2)', text: '#f472b6' },
  conflict_escalation: { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171' },
  disaster_spread: { bg: 'rgba(251, 146, 60, 0.2)', text: '#fb923c' },
};

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
  stats: {
    display: 'flex',
    gap: '24px',
    marginTop: '16px',
    padding: '12px 16px',
    backgroundColor: '#0c1f2e',
    borderRadius: '8px',
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  statLabel: {
    fontSize: '11px',
    color: '#60a5fa',
    textTransform: 'uppercase',
    fontWeight: 600,
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#ffffff',
  },
  domainSection: {
    marginBottom: '24px',
  },
  domainHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
    padding: '8px 0',
    borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
  },
  domainName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
    textTransform: 'capitalize',
  },
  domainBadge: {
    fontSize: '11px',
    padding: '2px 10px',
    borderRadius: '12px',
    fontWeight: 600,
  },
  actionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  actionCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    overflow: 'hidden',
  },
  actionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  actionHeaderHover: {
    backgroundColor: '#2d4a6f',
  },
  actionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  actionName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
  },
  actionId: {
    fontSize: '11px',
    color: '#60a5fa',
    backgroundColor: '#0c1f2e',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'monospace',
  },
  actionMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  badge: {
    fontSize: '10px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: 500,
  },
  badgeActor: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
  },
  badgeTarget: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    color: '#c084fc',
  },
  expandIcon: {
    fontSize: '12px',
    color: '#60a5fa',
    transition: 'transform 0.15s',
  },
  actionBody: {
    padding: '16px',
    borderTop: '1px solid rgba(59, 130, 246, 0.2)',
    backgroundColor: '#0c1f2e',
  },
  description: {
    fontSize: '13px',
    color: '#93c5fd',
    marginBottom: '16px',
    lineHeight: 1.5,
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  detailSection: {
    backgroundColor: '#1e3a5f',
    padding: '12px',
    borderRadius: '6px',
  },
  detailTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#60a5fa',
    textTransform: 'uppercase',
    marginBottom: '8px',
  },
  detailContent: {
    fontSize: '12px',
    color: '#ffffff',
  },
  detailList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  detailItem: {
    marginBottom: '4px',
    color: '#93c5fd',
  },
  probability: {
    display: 'flex',
    gap: '16px',
    marginTop: '8px',
  },
  probValue: {
    fontSize: '12px',
    color: '#ffffff',
  },
  probLabel: {
    fontSize: '10px',
    color: '#60a5fa',
    marginLeft: '4px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
    color: '#60a5fa',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 500,
    marginBottom: '8px',
    color: '#ffffff',
  },
  emptyDesc: {
    fontSize: '14px',
    color: '#93c5fd',
    maxWidth: '400px',
  },
};

export default function ActionsEditor({ actions = [], onChange, schema }) {
  const [expandedActions, setExpandedActions] = useState(new Set());
  const [hoveredAction, setHoveredAction] = useState(null);

  // Group actions by domain
  const actionsByDomain = actions.reduce((acc, action) => {
    const domain = action.domain || 'other';
    if (!acc[domain]) {
      acc[domain] = [];
    }
    acc[domain].push(action);
    return acc;
  }, {});

  const domains = Object.keys(actionsByDomain).sort();

  const toggleExpand = useCallback((actionId) => {
    setExpandedActions(prev => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  }, []);

  const getDomainColor = (domain) => {
    return DOMAIN_COLORS[domain] || { bg: 'rgba(107, 114, 128, 0.2)', text: '#9ca3af' };
  };

  const formatActorKinds = (actor) => {
    if (!actor?.kinds) return 'any';
    return actor.kinds.join(', ');
  };

  const formatTargetKind = (targeting) => {
    if (!targeting?.kind) return 'none';
    return targeting.kind;
  };

  if (actions.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Actions</h1>
          <p style={styles.subtitle}>
            Actions define what agents can do during the simulation via the universal catalyst system.
          </p>
        </div>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}></div>
          <div style={styles.emptyTitle}>No Actions Defined</div>
          <div style={styles.emptyDesc}>
            Actions enable agents to perform domain-specific behaviors like forming alliances,
            declaring wars, or spreading influence. Add actions to your actions.json file.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Actions</h1>
        <p style={styles.subtitle}>
          Actions define what agents can do during the simulation via the universal catalyst system.
        </p>
        <div style={styles.stats}>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Total Actions</span>
            <span style={styles.statValue}>{actions.length}</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statLabel}>Domains</span>
            <span style={styles.statValue}>{domains.length}</span>
          </div>
        </div>
      </div>

      {domains.map(domain => {
        const domainActions = actionsByDomain[domain];
        const domainColor = getDomainColor(domain);

        return (
          <div key={domain} style={styles.domainSection}>
            <div style={styles.domainHeader}>
              <span style={styles.domainName}>{domain.replace(/_/g, ' ')}</span>
              <span style={{
                ...styles.domainBadge,
                backgroundColor: domainColor.bg,
                color: domainColor.text,
              }}>
                {domainActions.length} action{domainActions.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div style={styles.actionList}>
              {domainActions.map(action => {
                const isExpanded = expandedActions.has(action.id);
                const isHovered = hoveredAction === action.id;

                return (
                  <div key={action.id} style={styles.actionCard}>
                    <div
                      style={{
                        ...styles.actionHeader,
                        ...(isHovered ? styles.actionHeaderHover : {}),
                      }}
                      onClick={() => toggleExpand(action.id)}
                      onMouseEnter={() => setHoveredAction(action.id)}
                      onMouseLeave={() => setHoveredAction(null)}
                    >
                      <div style={styles.actionTitle}>
                        <span style={styles.actionName}>{action.name}</span>
                        <span style={styles.actionId}>{action.id}</span>
                      </div>
                      <div style={styles.actionMeta}>
                        <span style={{ ...styles.badge, ...styles.badgeActor }}>
                          {formatActorKinds(action.actor)}
                        </span>
                        <span style={{ ...styles.badge, ...styles.badgeTarget }}>
                          → {formatTargetKind(action.targeting)}
                        </span>
                        <span style={{
                          ...styles.expandIcon,
                          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        }}>
                          ▶
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={styles.actionBody}>
                        <div style={styles.description}>
                          {action.description || 'No description provided.'}
                        </div>

                        <div style={styles.detailsGrid}>
                          {/* Actor Details */}
                          <div style={styles.detailSection}>
                            <div style={styles.detailTitle}>Actor Requirements</div>
                            <div style={styles.detailContent}>
                              <ul style={styles.detailList}>
                                <li style={styles.detailItem}>
                                  <strong>Kinds:</strong> {action.actor?.kinds?.join(', ') || 'any'}
                                </li>
                                {action.actor?.subtypes && (
                                  <li style={styles.detailItem}>
                                    <strong>Subtypes:</strong> {action.actor.subtypes.join(', ')}
                                  </li>
                                )}
                                {action.actor?.minProminence && (
                                  <li style={styles.detailItem}>
                                    <strong>Min Prominence:</strong> {action.actor.minProminence}
                                  </li>
                                )}
                                {action.actor?.requiredRelationships?.length > 0 && (
                                  <li style={styles.detailItem}>
                                    <strong>Required Rels:</strong> {action.actor.requiredRelationships.join(', ')}
                                  </li>
                                )}
                              </ul>
                            </div>
                          </div>

                          {/* Targeting Details */}
                          <div style={styles.detailSection}>
                            <div style={styles.detailTitle}>Target Selection</div>
                            <div style={styles.detailContent}>
                              <ul style={styles.detailList}>
                                <li style={styles.detailItem}>
                                  <strong>Kind:</strong> {action.targeting?.kind || 'none'}
                                </li>
                                {action.targeting?.subtypes && (
                                  <li style={styles.detailItem}>
                                    <strong>Subtypes:</strong> {action.targeting.subtypes.join(', ')}
                                  </li>
                                )}
                                {action.targeting?.statuses && (
                                  <li style={styles.detailItem}>
                                    <strong>Statuses:</strong> {action.targeting.statuses.join(', ')}
                                  </li>
                                )}
                                {action.targeting?.selectTwo && (
                                  <li style={styles.detailItem}>
                                    <strong>Select Two:</strong> Yes
                                  </li>
                                )}
                              </ul>
                            </div>
                          </div>

                          {/* Outcome Details */}
                          <div style={styles.detailSection}>
                            <div style={styles.detailTitle}>Outcome</div>
                            <div style={styles.detailContent}>
                              {action.outcome?.relationships?.length > 0 && (
                                <ul style={styles.detailList}>
                                  {action.outcome.relationships.map((rel, i) => (
                                    <li key={i} style={styles.detailItem}>
                                      <strong>{rel.kind}:</strong> {rel.src} → {rel.dst}
                                      {rel.bidirectional && ' (bidirectional)'}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {action.outcome?.pressureChanges && Object.keys(action.outcome.pressureChanges).length > 0 && (
                                <div style={{ marginTop: '8px' }}>
                                  <strong>Pressure Changes:</strong>
                                  <ul style={styles.detailList}>
                                    {Object.entries(action.outcome.pressureChanges).map(([pressure, delta]) => (
                                      <li key={pressure} style={styles.detailItem}>
                                        {pressure}: {delta > 0 ? '+' : ''}{delta}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Probability Details */}
                          <div style={styles.detailSection}>
                            <div style={styles.detailTitle}>Probability</div>
                            <div style={styles.detailContent}>
                              <div style={styles.probability}>
                                <span style={styles.probValue}>
                                  {((action.probability?.baseSuccessChance || 0.5) * 100).toFixed(0)}%
                                  <span style={styles.probLabel}>success</span>
                                </span>
                                <span style={styles.probValue}>
                                  {action.probability?.baseWeight || 1.0}x
                                  <span style={styles.probLabel}>weight</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
