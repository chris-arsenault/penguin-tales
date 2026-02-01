/**
 * EntityRenameModal - Three-phase entity rename with full propagation
 *
 * Phase 1: Name input (roll from name-forge or free text)
 * Phase 2: Preview all matches with per-match accept/reject/edit
 * Phase 3: Apply changes
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { generate } from 'name-forge';
import { toCulture } from '../lib/chronicle/nameBank';
import {
  scanForReferences,
  buildRenamePatches,
  applyEntityPatches,
  applyChroniclePatches,
  type RenameMatch,
  type MatchDecision,
  type RenameScanResult,
} from '../lib/entityRename';
import {
  getChroniclesForSimulation,
  getChronicle,
  putChronicle,
  type ChronicleRecord,
} from '../lib/chronicleStorage';
import type { CultureDefinition } from '@canonry/world-schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Entity {
  id: string;
  name: string;
  kind: string;
  subtype?: string;
  culture?: string;
  summary?: string;
  description?: string;
}

interface Relationship {
  kind: string;
  src: string;
  dst: string;
  status?: string;
}

interface EntityRenameModalProps {
  entityId: string;
  entities: Entity[];
  cultures: CultureDefinition[];
  simulationRunId: string;
  relationships?: Relationship[];
  onApply: (patchedEntities: Entity[]) => void;
  onClose: () => void;
}

type Phase = 'input' | 'scanning' | 'preview' | 'applying' | 'done';

type DecisionAction = 'accept' | 'reject' | 'edit';

interface DecisionState {
  action: DecisionAction;
  editText: string;
}

// ---------------------------------------------------------------------------
// Match Row Component
// ---------------------------------------------------------------------------

function MatchRow({
  match,
  decision,
  newName,
  onChangeAction,
  onChangeEditText,
}: {
  match: RenameMatch;
  decision: DecisionState;
  newName: string;
  onChangeAction: (action: DecisionAction) => void;
  onChangeEditText: (text: string) => void;
}) {
  const replacementText =
    decision.action === 'edit' ? decision.editText : newName;

  const typeColors: Record<string, string> = {
    full: '#22c55e',
    partial: '#f59e0b',
    metadata: '#6366f1',
    id_slug: '#06b6d4',
  };
  const typeLabels: Record<string, string> = {
    full: 'full',
    partial: 'partial',
    metadata: 'metadata',
    id_slug: 'id ref',
  };

  return (
    <div
      style={{
        padding: '8px 12px',
        background:
          decision.action === 'reject'
            ? 'var(--bg-secondary)'
            : 'var(--bg-tertiary)',
        borderRadius: '4px',
        border: '1px solid var(--border-color)',
        opacity: decision.action === 'reject' ? 0.5 : 1,
        marginBottom: '4px',
      }}
    >
      {/* Source label + type badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '4px',
          fontSize: '10px',
          color: 'var(--text-muted)',
        }}
      >
        <span
          style={{
            background: typeColors[match.matchType] || '#666',
            color: '#fff',
            padding: '0 4px',
            borderRadius: '2px',
            fontSize: '9px',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {typeLabels[match.matchType] || match.matchType}
        </span>
        <span>{match.sourceName}</span>
        <span style={{ opacity: 0.6 }}>{match.field}</span>
        {match.partialFragment && (
          <span style={{ fontStyle: 'italic' }}>
            fragment: &ldquo;{match.partialFragment}&rdquo;
          </span>
        )}
      </div>

      {/* Context snippet */}
      <div
        style={{
          fontSize: '11px',
          lineHeight: '1.7',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          marginBottom: '6px',
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>
          {match.contextBefore}
        </span>
        <span
          style={{
            background: 'rgba(239, 68, 68, 0.2)',
            textDecoration: 'line-through',
            padding: '0 1px',
            borderRadius: '2px',
          }}
        >
          {match.matchedText}
        </span>
        {decision.action !== 'reject' && (
          <span
            style={{
              background: 'rgba(34, 197, 94, 0.2)',
              padding: '0 1px',
              borderRadius: '2px',
            }}
          >
            {replacementText}
          </span>
        )}
        <span style={{ color: 'var(--text-muted)' }}>
          {match.contextAfter}
        </span>
      </div>

      {/* Action controls */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {(['accept', 'reject', 'edit'] as DecisionAction[]).map((action) => (
          <button
            key={action}
            onClick={() => onChangeAction(action)}
            style={{
              background:
                decision.action === action
                  ? action === 'accept'
                    ? 'rgba(34, 197, 94, 0.3)'
                    : action === 'reject'
                      ? 'rgba(239, 68, 68, 0.3)'
                      : 'rgba(99, 102, 241, 0.3)'
                  : 'var(--bg-secondary)',
              border:
                decision.action === action
                  ? `1px solid ${action === 'accept' ? '#22c55e' : action === 'reject' ? '#ef4444' : '#6366f1'}`
                  : '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '3px',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {action}
          </button>
        ))}

        {decision.action === 'edit' && (
          <input
            type="text"
            value={decision.editText}
            onChange={(e) => onChangeEditText(e.target.value)}
            placeholder="Custom replacement..."
            style={{
              flex: 1,
              background: 'var(--bg-primary)',
              border: '1px solid #6366f1',
              color: 'var(--text-primary)',
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '3px',
              outline: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Modal
// ---------------------------------------------------------------------------

export default function EntityRenameModal({
  entityId,
  entities,
  cultures,
  simulationRunId,
  relationships,
  onApply,
  onClose,
}: EntityRenameModalProps) {
  const entity = useMemo(
    () => entities.find((e) => e.id === entityId),
    [entities, entityId],
  );

  const [phase, setPhase] = useState<Phase>('input');
  const [newName, setNewName] = useState('');
  const [scanResult, setScanResult] = useState<RenameScanResult | null>(null);
  const [decisions, setDecisions] = useState<Map<string, DecisionState>>(
    new Map(),
  );
  const [applyProgress, setApplyProgress] = useState('');
  const [applyResult, setApplyResult] = useState('');
  const [isRolling, setIsRolling] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === 'input' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase]);

  if (!entity) return null;

  // --- Name rolling ---
  const handleRollName = useCallback(async () => {
    if (!entity.culture) return;
    const cultureDef = cultures.find((c) => c.id === entity.culture);
    if (!cultureDef) return;
    const culture = toCulture(cultureDef);
    if (!culture) return;

    setIsRolling(true);
    try {
      const result = await generate(culture, {
        kind: entity.kind,
        subtype: entity.subtype,
        count: 1,
        seed: `rename-${Date.now()}`,
      });
      if (result.names.length > 0) {
        setNewName(result.names[0]);
      }
    } catch (err) {
      console.warn('[EntityRename] Name generation failed:', err);
    } finally {
      setIsRolling(false);
    }
  }, [entity, cultures]);

  // --- Scanning ---
  const handleScan = useCallback(async () => {
    if (!newName.trim()) return;
    setPhase('scanning');

    try {
      const chronicles = await getChroniclesForSimulation(simulationRunId);
      const result = await scanForReferences(
        entityId,
        entity.name,
        entities,
        chronicles,
        relationships,
      );
      setScanResult(result);

      // Initialize decisions: accept for full+metadata, reject for partial
      const initial = new Map<string, DecisionState>();
      for (const match of result.matches) {
        initial.set(match.id, {
          action: (match.matchType === 'partial' || match.matchType === 'id_slug') ? 'reject' : 'accept',
          editText: newName,
        });
      }
      setDecisions(initial);
      setPhase('preview');
    } catch (err) {
      console.error('[EntityRename] Scan failed:', err);
      setPhase('input');
    }
  }, [newName, entityId, entity.name, entities, simulationRunId, relationships]);

  // --- Decision handling ---
  const handleChangeAction = useCallback(
    (matchId: string, action: DecisionAction) => {
      setDecisions((prev) => {
        const next = new Map(prev);
        const current = next.get(matchId) || {
          action: 'reject',
          editText: newName,
        };
        next.set(matchId, { ...current, action });
        return next;
      });
    },
    [newName],
  );

  const handleChangeEditText = useCallback(
    (matchId: string, text: string) => {
      setDecisions((prev) => {
        const next = new Map(prev);
        const current = next.get(matchId) || {
          action: 'edit',
          editText: newName,
        };
        next.set(matchId, { ...current, editText: text });
        return next;
      });
    },
    [newName],
  );

  // --- Bulk actions ---
  const handleAcceptAll = useCallback(() => {
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const [id, state] of next) {
        next.set(id, { ...state, action: 'accept' });
      }
      return next;
    });
  }, []);

  const handleRejectAllPartials = useCallback(() => {
    if (!scanResult) return;
    setDecisions((prev) => {
      const next = new Map(prev);
      for (const match of scanResult.matches) {
        if (match.matchType === 'partial') {
          const current = next.get(match.id);
          if (current) {
            next.set(match.id, { ...current, action: 'reject' });
          }
        }
      }
      return next;
    });
  }, [scanResult]);

  // --- Apply ---
  const handleApply = useCallback(async () => {
    if (!scanResult) return;
    setPhase('applying');

    try {
      // Build decisions array
      const decisionArray: MatchDecision[] = [];
      for (const [matchId, state] of decisions) {
        decisionArray.push({
          matchId,
          action: state.action,
          editText: state.action === 'edit' ? state.editText : undefined,
        });
      }

      setApplyProgress('Building patches...');
      const patches = buildRenamePatches(scanResult, newName, decisionArray);

      // Apply entity patches
      setApplyProgress(
        `Updating ${patches.entityPatches.length} entities...`,
      );
      const patchedEntities = applyEntityPatches(
        entities,
        patches.entityPatches,
        entityId,
        newName,
      );

      // Apply chronicle patches
      if (patches.chroniclePatches.length > 0) {
        setApplyProgress(
          `Updating ${patches.chroniclePatches.length} chronicles...`,
        );
        const successCount = await applyChroniclePatches(
          patches.chroniclePatches,
          getChronicle,
          putChronicle,
        );
        setApplyResult(
          `Updated ${patches.entityPatches.length} entities, ${successCount} chronicles.`,
        );
      } else {
        setApplyResult(
          `Updated ${patches.entityPatches.length} entities, 0 chronicles.`,
        );
      }

      // Notify parent
      onApply(patchedEntities);
      setPhase('done');
    } catch (err) {
      console.error('[EntityRename] Apply failed:', err);
      setApplyProgress(`Error: ${err}`);
    }
  }, [scanResult, decisions, newName, entities, entityId, onApply]);

  // --- Stats ---
  const stats = useMemo(() => {
    if (!scanResult) return { accepts: 0, rejects: 0, edits: 0, total: 0 };
    let accepts = 0,
      rejects = 0,
      edits = 0;
    for (const [, state] of decisions) {
      if (state.action === 'accept') accepts++;
      else if (state.action === 'reject') rejects++;
      else if (state.action === 'edit') edits++;
    }
    return { accepts, rejects, edits, total: scanResult.matches.length };
  }, [scanResult, decisions]);

  // --- Grouped matches ---
  const groupedMatches = useMemo(() => {
    if (!scanResult) return [];

    const groups: Array<{
      label: string;
      matches: RenameMatch[];
    }> = [];

    // Group: self entity (name + description + summary), excluding id_slug
    const selfMatches = scanResult.matches.filter(
      (m) => m.sourceType === 'entity' && m.sourceId === entityId && m.matchType !== 'id_slug',
    );
    if (selfMatches.length > 0) {
      groups.push({ label: 'This Entity', matches: selfMatches });
    }

    // Group: other entities, excluding id_slug
    const otherEntityMatches = scanResult.matches.filter(
      (m) => m.sourceType === 'entity' && m.sourceId !== entityId && m.matchType !== 'id_slug',
    );
    if (otherEntityMatches.length > 0) {
      groups.push({
        label: `Other Entities (${new Set(otherEntityMatches.map((m) => m.sourceId)).size})`,
        matches: otherEntityMatches,
      });
    }

    // Group: chronicle metadata
    const chronicleMetaMatches = scanResult.matches.filter(
      (m) => m.sourceType === 'chronicle' && m.matchType === 'metadata',
    );
    if (chronicleMetaMatches.length > 0) {
      groups.push({
        label: `Chronicle Metadata (${new Set(chronicleMetaMatches.map((m) => m.sourceId)).size})`,
        matches: chronicleMetaMatches,
      });
    }

    // Group: chronicle text
    const chronicleTextMatches = scanResult.matches.filter(
      (m) =>
        m.sourceType === 'chronicle' &&
        (m.matchType === 'full' || m.matchType === 'partial'),
    );
    if (chronicleTextMatches.length > 0) {
      groups.push({
        label: `Chronicle Text (${new Set(chronicleTextMatches.map((m) => m.sourceId)).size})`,
        matches: chronicleTextMatches,
      });
    }

    // Group: Foreign key references (relationships, chronicle cast, etc.)
    // These are informational - show everywhere the entity ID is used as a
    // foreign key so the user can verify all text references are covered.
    const idSlugMatches = scanResult.matches.filter(
      (m) => m.matchType === 'id_slug',
    );
    if (idSlugMatches.length > 0) {
      groups.push({
        label: `ID References (${idSlugMatches.length} - relationships, chronicle cast)`,
        matches: idSlugMatches,
      });
    }

    return groups;
  }, [scanResult, entityId]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== 'applying') onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-primary)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          width: '900px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '16px' }}>
              Rename Entity
            </h2>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}
            >
              {entity.kind}
              {entity.subtype ? ` / ${entity.subtype}` : ''}
              {entity.culture ? ` / ${entity.culture}` : ''}
            </p>
          </div>
          {phase !== 'applying' && (
            <button
              onClick={onClose}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 12px', fontSize: '12px' }}
            >
              Cancel
            </button>
          )}
        </div>

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '16px 20px',
            minHeight: 0,
          }}
        >
          {/* Phase 1: Name Input */}
          {phase === 'input' && (
            <div>
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px',
                  }}
                >
                  Current Name
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                  }}
                >
                  {entity.name}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newName.trim()) handleScan();
                  }}
                  placeholder="Enter new name..."
                  style={{
                    flex: 1,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                />
                {entity.culture && (
                  <button
                    onClick={handleRollName}
                    disabled={isRolling}
                    className="illuminator-button illuminator-button-secondary"
                    style={{
                      padding: '8px 16px',
                      fontSize: '12px',
                      whiteSpace: 'nowrap',
                    }}
                    title="Generate a culture-appropriate name using Name Forge"
                  >
                    {isRolling ? 'Rolling...' : 'Roll Name'}
                  </button>
                )}
              </div>

              <p
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  lineHeight: '1.6',
                }}
              >
                Enter a new name or use Roll Name to generate one from Name
                Forge. The scan will find all references to &ldquo;
                {entity.name}&rdquo; across entities and chronicles, including
                partial name matches.
              </p>
            </div>
          )}

          {/* Phase: Scanning */}
          {phase === 'scanning' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div
                style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                }}
              >
                Scanning entities and chronicles...
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                }}
              >
                Looking for references to &ldquo;{entity.name}&rdquo;
              </div>
            </div>
          )}

          {/* Phase 2: Preview */}
          {phase === 'preview' && scanResult && (
            <div>
              {/* Summary stats */}
              <div
                style={{
                  marginBottom: '12px',
                  padding: '10px 14px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'center',
                  fontSize: '12px',
                }}
              >
                <span>
                  <strong>{entity.name}</strong> &rarr;{' '}
                  <strong>{newName}</strong>
                </span>
                <span style={{ color: 'var(--text-muted)' }}>|</span>
                <span style={{ color: '#22c55e' }}>
                  {stats.accepts} accept
                </span>
                <span style={{ color: '#ef4444' }}>
                  {stats.rejects} reject
                </span>
                <span style={{ color: '#6366f1' }}>{stats.edits} edit</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  / {stats.total} total
                </span>
                <div style={{ flex: 1 }} />
                <button
                  onClick={handleAcceptAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#22c55e',
                    fontSize: '10px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Accept All
                </button>
                <button
                  onClick={handleRejectAllPartials}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f59e0b',
                    fontSize: '10px',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Reject All Partials
                </button>
              </div>

              {/* Grouped matches */}
              {groupedMatches.map((group) => (
                <div key={group.label} style={{ marginBottom: '16px' }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '6px',
                      padding: '0 2px',
                    }}
                  >
                    {group.label}
                  </div>
                  {group.matches.map((match) => {
                    const decision = decisions.get(match.id) || {
                      action: 'reject' as DecisionAction,
                      editText: newName,
                    };
                    return (
                      <MatchRow
                        key={match.id}
                        match={match}
                        decision={decision}
                        newName={newName}
                        onChangeAction={(action) =>
                          handleChangeAction(match.id, action)
                        }
                        onChangeEditText={(text) =>
                          handleChangeEditText(match.id, text)
                        }
                      />
                    );
                  })}
                </div>
              ))}

              {scanResult.matches.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                  }}
                >
                  No references found. The entity name will still be updated.
                </div>
              )}
            </div>
          )}

          {/* Phase 3: Applying / Done */}
          {(phase === 'applying' || phase === 'done') && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div
                style={{
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                }}
              >
                {phase === 'applying' ? applyProgress : 'Rename Complete'}
              </div>
              {phase === 'done' && applyResult && (
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    marginTop: '8px',
                  }}
                >
                  {applyResult}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          {phase === 'input' && (
            <button
              onClick={handleScan}
              disabled={!newName.trim()}
              className="illuminator-button"
              style={{
                padding: '6px 20px',
                fontSize: '12px',
                opacity: newName.trim() ? 1 : 0.5,
              }}
            >
              Scan References
            </button>
          )}
          {phase === 'preview' && (
            <>
              <button
                onClick={() => setPhase('input')}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                Back
              </button>
              <button
                onClick={handleApply}
                disabled={stats.accepts === 0 && stats.edits === 0}
                className="illuminator-button"
                style={{
                  padding: '6px 20px',
                  fontSize: '12px',
                  opacity:
                    stats.accepts === 0 && stats.edits === 0 ? 0.5 : 1,
                }}
              >
                Apply Rename ({stats.accepts + stats.edits} changes)
              </button>
            </>
          )}
          {phase === 'done' && (
            <button
              onClick={onClose}
              className="illuminator-button"
              style={{ padding: '6px 20px', fontSize: '12px' }}
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
