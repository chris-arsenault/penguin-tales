/**
 * ChronicleSeedViewer - Displays chronicle generation context/seed data
 *
 * Shared component for displaying seed information.
 * Used in chronicler wiki pages via modal.
 */


export interface ChronicleRoleAssignment {
  role: string;
  entityId: string;
  entityName: string;
  entityKind: string;
  isPrimary: boolean;
}

export interface ChronicleSeedData {
  narrativeStyleId: string;
  narrativeStyleName?: string;
  entrypointId?: string;
  entrypointName?: string;
  roleAssignments: ChronicleRoleAssignment[];
  selectedEventIds: string[];
  selectedRelationshipIds: string[];
}

interface ChronicleSeedViewerProps {
  seed: ChronicleSeedData;
  eventNames?: Map<string, string>;
  relationshipLabels?: Map<string, string>;
}

const styles = {
  container: {
    fontSize: '13px',
    color: 'var(--text-secondary, #93c5fd)',
  },
  section: {
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-muted, #60a5fa)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '8px',
  },
  field: {
    display: 'flex',
    gap: '8px',
    marginBottom: '4px',
  },
  fieldLabel: {
    color: 'var(--text-muted, #60a5fa)',
    minWidth: '80px',
  },
  fieldValue: {
    color: 'var(--text-primary, #ffffff)',
  },
  roleList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  roleItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    background: 'var(--bg-tertiary, #2d4a6f)',
    borderRadius: '4px',
    fontSize: '12px',
  },
  roleBadge: {
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
  },
  primaryBadge: {
    background: 'var(--accent-color, #10b981)',
    color: 'white',
  },
  supportingBadge: {
    background: 'var(--bg-secondary, #1e3a5f)',
    color: 'var(--text-muted, #60a5fa)',
    border: '1px solid var(--border-color, rgba(59, 130, 246, 0.3))',
  },
  entityName: {
    fontWeight: 500,
  },
  entityKind: {
    color: 'var(--text-muted, #60a5fa)',
    fontSize: '11px',
  },
  idList: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
  },
  idTag: {
    padding: '2px 8px',
    background: 'var(--bg-tertiary, #2d4a6f)',
    borderRadius: '3px',
    fontSize: '11px',
    fontFamily: 'monospace',
  },
  emptyState: {
    color: 'var(--text-muted, #60a5fa)',
    fontStyle: 'italic',
  },
};

export default function ChronicleSeedViewer({
  seed,
  eventNames,
  relationshipLabels,
}: ChronicleSeedViewerProps) {
  const primaryRoles = seed.roleAssignments.filter(r => r.isPrimary);
  const supportingRoles = seed.roleAssignments.filter(r => !r.isPrimary);

  return (
    <div style={styles.container}>
      {/* Style & Entry Point */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Generation Settings</div>
        <div style={styles.field}>
          <span style={styles.fieldLabel}>Style:</span>
          <span style={styles.fieldValue}>
            {seed.narrativeStyleName || seed.narrativeStyleId}
          </span>
        </div>
        {seed.entrypointId && (
          <div style={styles.field}>
            <span style={styles.fieldLabel}>Entry Point:</span>
            <span style={styles.fieldValue}>
              {seed.entrypointName || seed.entrypointId}
            </span>
          </div>
        )}
      </div>

      {/* Role Assignments */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          Cast ({seed.roleAssignments.length} entities)
        </div>
        {seed.roleAssignments.length === 0 ? (
          <div style={styles.emptyState}>No roles assigned</div>
        ) : (
          <div style={styles.roleList}>
            {primaryRoles.map((role, i) => (
              <div key={`primary-${i}`} style={styles.roleItem}>
                <span style={{ ...styles.roleBadge, ...styles.primaryBadge }}>
                  {role.role}
                </span>
                <span style={styles.entityName}>{role.entityName}</span>
                <span style={styles.entityKind}>({role.entityKind})</span>
              </div>
            ))}
            {supportingRoles.map((role, i) => (
              <div key={`supporting-${i}`} style={styles.roleItem}>
                <span style={{ ...styles.roleBadge, ...styles.supportingBadge }}>
                  {role.role}
                </span>
                <span style={styles.entityName}>{role.entityName}</span>
                <span style={styles.entityKind}>({role.entityKind})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Events */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          Events ({seed.selectedEventIds.length})
        </div>
        {seed.selectedEventIds.length === 0 ? (
          <div style={styles.emptyState}>No events selected</div>
        ) : (
          <div style={styles.idList}>
            {seed.selectedEventIds.map((id, i) => (
              <span key={i} style={styles.idTag}>
                {eventNames?.get(id) || id}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Selected Relationships */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          Relationships ({seed.selectedRelationshipIds.length})
        </div>
        {seed.selectedRelationshipIds.length === 0 ? (
          <div style={styles.emptyState}>No relationships selected</div>
        ) : (
          <div style={styles.idList}>
            {seed.selectedRelationshipIds.map((id, i) => (
              <span key={i} style={styles.idTag}>
                {relationshipLabels?.get(id) || id}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Modal wrapper for use in chronicler wiki pages
 */
interface SeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  seed: ChronicleSeedData;
  eventNames?: Map<string, string>;
  relationshipLabels?: Map<string, string>;
  title?: string;
}

export function SeedModal({
  isOpen,
  onClose,
  seed,
  eventNames,
  relationshipLabels,
  title = 'Generation Context',
}: SeedModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-primary, #0a1929)',
          borderRadius: '12px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-color, rgba(59, 130, 246, 0.3))',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color, rgba(59, 130, 246, 0.3))',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary, #ffffff)' }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--text-muted, #60a5fa)',
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto' }}>
          <ChronicleSeedViewer
            seed={seed}
            eventNames={eventNames}
            relationshipLabels={relationshipLabels}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color, rgba(59, 130, 246, 0.3))',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'var(--bg-tertiary, #2d4a6f)',
              border: '1px solid var(--border-color, rgba(59, 130, 246, 0.3))',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              color: 'var(--text-primary, #ffffff)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
