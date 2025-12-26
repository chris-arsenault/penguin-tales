/**
 * RoleAssignmentStep - Step 3: Assign entities to roles
 *
 * Two-column layout: available entities on left, roles on right.
 */

import { useState, useMemo } from 'react';
import { useWizard } from '../WizardContext';
import { validateRoleAssignments } from '../../../lib/chronicle/selectionWizard';

export default function RoleAssignmentStep() {
  const {
    state,
    autoFillRoles,
    addRoleAssignment,
    removeRoleAssignment,
    togglePrimary,
  } = useWizard();

  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');

  const style = state.narrativeStyle;
  const roles = style?.entityRules.roles || [];
  const maxCastSize = style?.entityRules.maxCastSize || 10;

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    if (!searchText.trim()) return state.candidates;
    const search = searchText.toLowerCase();
    return state.candidates.filter(e =>
      e.name.toLowerCase().includes(search) ||
      e.kind.toLowerCase().includes(search)
    );
  }, [state.candidates, searchText]);

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
          onClick={autoFillRoles}
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
          <div style={{
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  <div style={{
                    fontSize: '10px',
                    color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                  }}>
                    {entity.kind} · {entity.prominence}
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
