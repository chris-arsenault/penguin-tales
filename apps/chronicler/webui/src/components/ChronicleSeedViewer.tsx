/**
 * ChronicleSeedViewer - Displays chronicle generation context/seed data
 *
 * Shared component for displaying seed information.
 * Used in chronicler wiki pages via modal.
 */

import styles from './ChronicleSeedViewer.module.css';

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

export default function ChronicleSeedViewer({
  seed,
  eventNames,
  relationshipLabels,
}: ChronicleSeedViewerProps) {
  const primaryRoles = seed.roleAssignments.filter(r => r.isPrimary);
  const supportingRoles = seed.roleAssignments.filter(r => !r.isPrimary);

  return (
    <div className={styles.container}>
      {/* Style & Entry Point */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Generation Settings</div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Style:</span>
          <span className={styles.fieldValue}>
            {seed.narrativeStyleName || seed.narrativeStyleId}
          </span>
        </div>
        {seed.entrypointId && (
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Entry Point:</span>
            <span className={styles.fieldValue}>
              {seed.entrypointName || seed.entrypointId}
            </span>
          </div>
        )}
      </div>

      {/* Role Assignments */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          Cast ({seed.roleAssignments.length} entities)
        </div>
        {seed.roleAssignments.length === 0 ? (
          <div className={styles.emptyState}>No roles assigned</div>
        ) : (
          <div className={styles.roleList}>
            {primaryRoles.map((role, i) => (
              <div key={`primary-${i}`} className={styles.roleItem}>
                <span className={styles.primaryBadge}>
                  {role.role}
                </span>
                <span className={styles.entityName}>{role.entityName}</span>
                <span className={styles.entityKind}>({role.entityKind})</span>
              </div>
            ))}
            {supportingRoles.map((role, i) => (
              <div key={`supporting-${i}`} className={styles.roleItem}>
                <span className={styles.supportingBadge}>
                  {role.role}
                </span>
                <span className={styles.entityName}>{role.entityName}</span>
                <span className={styles.entityKind}>({role.entityKind})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Events */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          Events ({seed.selectedEventIds.length})
        </div>
        {seed.selectedEventIds.length === 0 ? (
          <div className={styles.emptyState}>No events selected</div>
        ) : (
          <div className={styles.idList}>
            {seed.selectedEventIds.map((id, i) => (
              <span key={i} className={styles.idTag}>
                {eventNames?.get(id) || id}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Selected Relationships */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          Relationships ({seed.selectedRelationshipIds.length})
        </div>
        {seed.selectedRelationshipIds.length === 0 ? (
          <div className={styles.emptyState}>No relationships selected</div>
        ) : (
          <div className={styles.idList}>
            {seed.selectedRelationshipIds.map((id, i) => (
              <span key={i} className={styles.idTag}>
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
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{title}</h3>
          <button onClick={onClose} className={styles.modalClose}>
            ×
          </button>
        </div>

        {/* Content */}
        <div className={styles.modalBody}>
          <ChronicleSeedViewer
            seed={seed}
            eventNames={eventNames}
            relationshipLabels={relationshipLabels}
          />
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.closeButton}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
