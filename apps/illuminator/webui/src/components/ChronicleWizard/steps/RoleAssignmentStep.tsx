/**
 * RoleAssignmentStep - Step 3: Assign entities to roles
 *
 * Two-column layout: available entities on left, roles on right.
 * Features metrics display, sort/filter controls for diversity.
 */

import { useState, useMemo, useEffect } from 'react';
import type { StoryNarrativeStyle, DocumentNarrativeStyle, RoleDefinition } from '@canonry/world-schema';
import { useWizard } from '../WizardContext';
import {
  validateRoleAssignments,
  type EntitySelectionMetrics,
} from '../../../lib/chronicle/selectionWizard';
import { getEntityUsageStats } from '../../../lib/chronicleStorage';

type SortOption = 'recommended' | 'distance' | 'least-used' | 'strength';

/** Get roles from either story or document style */
function getRoles(style: { format: string } | null | undefined): RoleDefinition[] {
  if (!style) return [];
  if (style.format === 'story') {
    return (style as StoryNarrativeStyle).roles || [];
  }
  // Document styles have roles directly on the style object
  const docStyle = style as DocumentNarrativeStyle;
  return docStyle.roles || [];
}

export default function RoleAssignmentStep() {
  const {
    state,
    autoFillRoles,
    addRoleAssignment,
    removeRoleAssignment,
    togglePrimary,
    computeMetrics,
  } = useWizard();

  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [hideOverused, setHideOverused] = useState(false);
  const [directOnly, setDirectOnly] = useState(false);
  const [usageStats, setUsageStats] = useState<Map<string, { usageCount: number }>>(new Map());
  const [metricsMap, setMetricsMap] = useState<Map<string, EntitySelectionMetrics>>(new Map());

  const style = state.narrativeStyle;
  const roles = getRoles(style);
  const maxCastSize = 10;

  // Load usage stats on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const simId = urlParams.get('simulationRunId') || urlParams.get('runId');
    if (simId) {
      getEntityUsageStats(simId).then(stats => {
        setUsageStats(stats);
      }).catch(() => {
        // Silently fail - just use empty stats
      });
    }
  }, []);

  // Compute metrics when candidates or usage stats change
  useEffect(() => {
    if (state.candidates.length > 0 && state.entryPointId) {
      const metrics = computeMetrics(usageStats);
      setMetricsMap(metrics);
    }
  }, [state.candidates, state.entryPointId, usageStats, state.roleAssignments, computeMetrics]);

  // Filter and sort candidates
  const filteredCandidates = useMemo(() => {
    let filtered = state.candidates;

    // Apply search filter
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(search) ||
        e.kind.toLowerCase().includes(search)
      );
    }

    // Apply overused filter
    if (hideOverused) {
      filtered = filtered.filter(e => {
        const metrics = metricsMap.get(e.id);
        return !metrics || metrics.usageCount < 5;
      });
    }

    // Apply direct-only filter
    if (directOnly) {
      filtered = filtered.filter(e => {
        const metrics = metricsMap.get(e.id);
        return metrics && metrics.distance <= 1;
      });
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      const metricsA = metricsMap.get(a.id);
      const metricsB = metricsMap.get(b.id);

      switch (sortBy) {
        case 'distance':
          return (metricsA?.distance ?? 99) - (metricsB?.distance ?? 99);
        case 'least-used':
          return (metricsA?.usageCount ?? 0) - (metricsB?.usageCount ?? 0);
        case 'strength':
          return (metricsB?.avgStrength ?? 0) - (metricsA?.avgStrength ?? 0);
        case 'recommended':
        default:
          // By category novelty first, then by least used
          const noveltyA = metricsA?.addsNewCategory ? 1 : 0;
          const noveltyB = metricsB?.addsNewCategory ? 1 : 0;
          if (noveltyA !== noveltyB) return noveltyB - noveltyA;
          return (metricsA?.usageCount ?? 0) - (metricsB?.usageCount ?? 0);
      }
    });

    return filtered;
  }, [state.candidates, searchText, hideOverused, directOnly, sortBy, metricsMap]);

  // Get assigned entity IDs
  const assignedEntityIds = useMemo(() => {
    return new Set(state.roleAssignments.map(a => a.entityId));
  }, [state.roleAssignments]);

  // Validation
  const validation = useMemo(() => {
    if (!roles.length) return { valid: true, errors: [], warnings: [] };
    return validateRoleAssignments(state.roleAssignments, roles, maxCastSize);
  }, [state.roleAssignments, roles, maxCastSize]);

  // Handle entity click - toggle selection
  const handleEntityClick = (entityId: string) => {
    setSelectedEntityId(prev => prev === entityId ? null : entityId);
  };

  // Handle role click - assign selected entity to role
  const handleRoleClick = (roleId: string) => {
    if (!selectedEntityId) return;

    const entity = state.candidates.find(e => e.id === selectedEntityId);
    if (!entity) return;

    // Check if already assigned to this role
    const existing = state.roleAssignments.find(
      a => a.entityId === selectedEntityId && a.role === roleId
    );
    if (existing) {
      removeRoleAssignment(selectedEntityId, roleId);
    } else {
      addRoleAssignment({
        role: roleId,
        entityId: entity.id,
        entityName: entity.name,
        entityKind: entity.kind,
        isPrimary: false,
      });
    }

    setSelectedEntityId(null);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h4 style={{ margin: '0 0 8px 0' }}>Assign Roles</h4>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
            Select an entity, then click a role to assign it. Toggle "Primary" for key characters.
          </p>
        </div>
        <button
          onClick={() => autoFillRoles(metricsMap)}
          className="illuminator-btn"
          style={{ fontSize: '12px' }}
        >
          Auto-fill Roles
        </button>
      </div>

      {/* Validation Messages */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div style={{ marginBottom: '16px' }}>
          {validation.errors.map((error, i) => (
            <div key={i} style={{
              padding: '8px 12px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderLeft: '3px solid var(--error)',
              marginBottom: '4px',
              fontSize: '12px',
              color: 'var(--error)',
            }}>
              {error}
            </div>
          ))}
          {validation.warnings.map((warning, i) => (
            <div key={i} style={{
              padding: '8px 12px',
              background: 'rgba(245, 158, 11, 0.1)',
              borderLeft: '3px solid var(--warning)',
              marginBottom: '4px',
              fontSize: '12px',
              color: 'var(--warning)',
            }}>
              {warning}
            </div>
          ))}
        </div>
      )}

      {/* Two Column Layout */}
      <div style={{ display: 'flex', gap: '20px', height: '400px' }}>
        {/* Left: Available Entities */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header and filters */}
          <div style={{
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Available Entities ({filteredCandidates.length})
            </span>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search..."
              className="illuminator-input"
              style={{ width: '120px', padding: '4px 8px', fontSize: '11px' }}
            />
          </div>
          {/* Sort and diversity filters */}
          <div style={{
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '10px',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
              Sort:
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="illuminator-select"
                style={{ padding: '2px 6px', fontSize: '10px' }}
              >
                <option value="recommended">Recommended</option>
                <option value="distance">Closest</option>
                <option value="least-used">Least Used</option>
                <option value="strength">Strongest Link</option>
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={directOnly}
                onChange={(e) => setDirectOnly(e.target.checked)}
                style={{ margin: 0 }}
              />
              Direct links only
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hideOverused}
                onChange={(e) => setHideOverused(e.target.checked)}
                style={{ margin: 0 }}
              />
              Hide overused (5+)
            </label>
          </div>

          <div style={{
            flex: 1,
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            overflow: 'auto',
          }}>
            {filteredCandidates.map(entity => {
              const isAssigned = assignedEntityIds.has(entity.id);
              const isSelected = selectedEntityId === entity.id;
              const isEntryPoint = entity.id === state.entryPointId;
              const metrics = metricsMap.get(entity.id);

              return (
                <div
                  key={entity.id}
                  onClick={() => handleEntityClick(entity.id)}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    background: isSelected
                      ? 'var(--accent-color)'
                      : isAssigned
                      ? 'var(--bg-tertiary)'
                      : 'transparent',
                    color: isSelected ? 'white' : 'inherit',
                    opacity: isAssigned && !isSelected ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 500, fontSize: '12px' }}>
                      {entity.name}
                    </span>
                    {isEntryPoint && (
                      <span style={{
                        padding: '1px 4px',
                        background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--accent-color)',
                        color: 'white',
                        borderRadius: '3px',
                        fontSize: '8px',
                        textTransform: 'uppercase',
                      }}>
                        Entry
                      </span>
                    )}
                    {isAssigned && !isSelected && (
                      <span style={{
                        padding: '1px 4px',
                        background: 'var(--success)',
                        color: 'white',
                        borderRadius: '3px',
                        fontSize: '8px',
                      }}>
                        Assigned
                      </span>
                    )}
                  </div>
                  {/* Entity kind and metrics row */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '10px',
                    color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                    marginTop: '2px',
                  }}>
                    <span>{entity.kind}</span>
                    {metrics && (
                      <>
                        {/* Distance indicator */}
                        <span
                          title={`${metrics.distance === 0 ? 'Entry point' : metrics.distance === 1 ? 'Direct link (1 hop)' : `${metrics.distance} hops away`}`}
                          style={{
                            padding: '0 3px',
                            background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                            borderRadius: '2px',
                            fontSize: '9px',
                          }}
                        >
                          {metrics.distance === 0 ? '★' : `${metrics.distance}h`}
                        </span>
                        {/* Usage count */}
                        {metrics.usageCount > 0 && (
                          <span
                            title={`Used in ${metrics.usageCount} chronicle${metrics.usageCount > 1 ? 's' : ''}`}
                            style={{
                              padding: '0 3px',
                              background: metrics.usageCount >= 5
                                ? (isSelected ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.2)')
                                : metrics.usageCount >= 2
                                ? (isSelected ? 'rgba(245,158,11,0.4)' : 'rgba(245,158,11,0.2)')
                                : (isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)'),
                              color: metrics.usageCount >= 5 ? 'var(--error)' : metrics.usageCount >= 2 ? 'var(--warning)' : 'inherit',
                              borderRadius: '2px',
                              fontSize: '9px',
                            }}
                          >
                            {metrics.usageCount}×
                          </span>
                        )}
                        {/* Relationship strength */}
                        {metrics.avgStrength > 0 && (
                          <span
                            title={`Link strength: ${(metrics.avgStrength * 100).toFixed(0)}%`}
                            style={{
                              padding: '0 3px',
                              background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                              borderRadius: '2px',
                              fontSize: '9px',
                            }}
                          >
                            {'●'.repeat(Math.min(3, Math.ceil(metrics.avgStrength * 3)))}
                          </span>
                        )}
                        {/* Era aligned indicator */}
                        {metrics.eraAligned && (
                          <span
                            title="Active in same era"
                            style={{
                              padding: '0 3px',
                              background: isSelected ? 'rgba(34,197,94,0.4)' : 'rgba(34,197,94,0.2)',
                              color: isSelected ? 'white' : 'var(--success)',
                              borderRadius: '2px',
                              fontSize: '9px',
                            }}
                          >
                            ⏰
                          </span>
                        )}
                        {/* Category novelty indicator */}
                        {metrics.addsNewCategory && (
                          <span
                            title="Adds a new entity category to the cast"
                            style={{
                              padding: '0 3px',
                              background: isSelected ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.2)',
                              color: isSelected ? 'white' : 'var(--accent-color)',
                              borderRadius: '2px',
                              fontSize: '9px',
                            }}
                          >
                            +cat
                          </span>
                        )}
                        {/* New relationship types */}
                        {metrics.newRelTypes > 0 && (
                          <span
                            title={`Adds ${metrics.newRelTypes} new relationship type${metrics.newRelTypes > 1 ? 's' : ''} to the narrative`}
                            style={{
                              padding: '0 3px',
                              background: isSelected ? 'rgba(139,92,246,0.4)' : 'rgba(139,92,246,0.2)',
                              borderRadius: '2px',
                              fontSize: '9px',
                            }}
                          >
                            +{metrics.newRelTypes}rel
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Roles */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Roles
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {state.roleAssignments.length} / {maxCastSize} max
            </span>
          </div>

          <div style={{
            flex: 1,
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            overflow: 'auto',
            padding: '12px',
          }}>
            {roles.map(role => {
              const assignments = state.roleAssignments.filter(a => a.role === role.role);
              const count = assignments.length;
              const isUnderMin = count < role.count.min;
              const isAtMax = count >= role.count.max;

              return (
                <div
                  key={role.role}
                  style={{
                    marginBottom: '16px',
                    padding: '12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: isUnderMin ? '1px solid var(--error)' : '1px solid transparent',
                  }}
                >
                  {/* Role Header */}
                  <div
                    onClick={() => !isAtMax && handleRoleClick(role.role)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: assignments.length > 0 ? '8px' : 0,
                      cursor: selectedEntityId && !isAtMax ? 'pointer' : 'default',
                      padding: '4px',
                      borderRadius: '4px',
                      background: selectedEntityId && !isAtMax ? 'var(--bg-tertiary)' : 'transparent',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 500, fontSize: '12px' }}>{role.role}</span>
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '10px',
                        color: isUnderMin ? 'var(--error)' : 'var(--text-muted)',
                      }}>
                        {count}/{role.count.min}-{role.count.max}
                      </span>
                    </div>
                    {selectedEntityId && !isAtMax && (
                      <span style={{
                        padding: '2px 6px',
                        background: 'var(--accent-color)',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '9px',
                      }}>
                        Click to assign
                      </span>
                    )}
                  </div>

                  {/* Role Description */}
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    {role.description}
                  </div>

                  {/* Assigned Entities */}
                  {assignments.map(assignment => (
                    <div
                      key={assignment.entityId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '4px',
                        marginTop: '4px',
                      }}
                    >
                      <span style={{ flex: 1, fontSize: '11px' }}>
                        {assignment.entityName}
                        <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>
                          ({assignment.entityKind})
                        </span>
                      </span>

                      {/* Primary Toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePrimary(assignment.entityId, assignment.role);
                        }}
                        style={{
                          padding: '2px 6px',
                          background: assignment.isPrimary ? 'var(--accent-color)' : 'var(--bg-secondary)',
                          color: assignment.isPrimary ? 'white' : 'var(--text-muted)',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '9px',
                          cursor: 'pointer',
                        }}
                      >
                        {assignment.isPrimary ? 'PRIMARY' : 'Supporting'}
                      </button>

                      {/* Remove Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRoleAssignment(assignment.entityId, assignment.role);
                        }}
                        style={{
                          padding: '2px 6px',
                          background: 'transparent',
                          color: 'var(--error)',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
