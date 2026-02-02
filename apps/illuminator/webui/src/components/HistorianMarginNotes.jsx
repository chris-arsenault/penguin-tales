/**
 * HistorianMarginNotes - Renders a list of historian notes with enable/disable toggles
 *
 * Displays notes as a compact list grouped by enabled/disabled state.
 * Each note shows its type, anchor phrase, and text with toggle controls.
 * Used below entity descriptions and chronicle content in the Illuminator MFE.
 */

import { useMemo, useState } from 'react';

// ============================================================================
// Note Type Metadata
// ============================================================================

const NOTE_TYPE_META = {
  commentary: { icon: '✦', color: '#8b7355', label: 'Commentary' },
  correction: { icon: '!', color: '#c0392b', label: 'Correction' },
  tangent: { icon: '~', color: '#7d6b91', label: 'Tangent' },
  skepticism: { icon: '?', color: '#d4a017', label: 'Skepticism' },
  pedantic: { icon: '#', color: '#5b7a5e', label: 'Pedantic' },
};

// ============================================================================
// Note Item
// ============================================================================

function NoteItem({ note, onToggleEnabled }) {
  const meta = NOTE_TYPE_META[note.type] || NOTE_TYPE_META.commentary;
  const isEnabled = note.enabled !== false;
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '6px 10px',
        background: isEnabled ? 'rgba(139, 115, 85, 0.08)' : 'rgba(139, 115, 85, 0.03)',
        borderLeft: `3px solid ${isEnabled ? meta.color : 'var(--border-color)'}`,
        borderRadius: '0 4px 4px 0',
        opacity: isEnabled ? 1 : 0.5,
        marginBottom: '4px',
        transition: 'opacity 0.15s',
      }}
    >
      {/* Toggle button */}
      {onToggleEnabled && (
        <button
          onClick={() => onToggleEnabled(note.noteId, !isEnabled)}
          title={isEnabled ? 'Disable this note' : 'Enable this note'}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            padding: 0,
            color: isEnabled ? meta.color : '#8b735560',
            lineHeight: 1,
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          {isEnabled ? '◉' : '○'}
        </button>
      )}

      {/* Note content */}
      <div
        style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Type label + anchor */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '6px',
          marginBottom: '2px',
        }}>
          <span style={{
            fontSize: '9px',
            fontWeight: 700,
            color: meta.color,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            flexShrink: 0,
          }}>
            {meta.icon} {meta.label}
          </span>
          <span style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
            title={note.anchorPhrase}
          >
            "{note.anchorPhrase}"
          </span>
        </div>

        {/* Note text */}
        <div style={{
          fontSize: '12px',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontStyle: 'italic',
          color: isEnabled ? 'var(--text-secondary)' : 'var(--text-muted)',
          lineHeight: '1.5',
        }}>
          {expanded || note.text.length <= 120
            ? note.text
            : note.text.slice(0, 120) + '…'}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function HistorianMarginNotes({ notes, style, onToggleEnabled }) {
  // Split notes into enabled and disabled
  const enabledNotes = useMemo(() =>
    (notes || []).filter((n) => n.enabled !== false),
    [notes],
  );
  const disabledNotes = useMemo(() =>
    (notes || []).filter((n) => n.enabled === false),
    [notes],
  );

  if (!notes || notes.length === 0) return null;

  return (
    <div style={style}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '6px',
      }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          color: '#8b7355',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Historian Notes
        </span>
        <span style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
        }}>
          {enabledNotes.length} active{disabledNotes.length > 0 ? `, ${disabledNotes.length} disabled` : ''}
        </span>
      </div>

      {/* Enabled notes */}
      {enabledNotes.map((note) => (
        <NoteItem
          key={note.noteId}
          note={note}
          onToggleEnabled={onToggleEnabled}
        />
      ))}

      {/* Disabled notes */}
      {disabledNotes.length > 0 && (
        <>
          {enabledNotes.length > 0 && (
            <div style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              margin: '8px 0 4px 0',
            }}>
              Disabled
            </div>
          )}
          {disabledNotes.map((note) => (
            <NoteItem
              key={note.noteId}
              note={note}
              onToggleEnabled={onToggleEnabled}
            />
          ))}
        </>
      )}
    </div>
  );
}
