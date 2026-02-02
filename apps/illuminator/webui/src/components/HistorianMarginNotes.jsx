/**
 * HistorianMarginNotes - Renders text with inline historian margin callouts
 *
 * Takes source text and an array of HistorianNote objects.
 * Renders the text with brown-background margin callouts anchored to phrases.
 * Used for both entity descriptions and chronicle narratives.
 *
 * When `onToggleEnabled` is provided, each note gets a toggle control
 * that enables/disables the note. Disabled notes are functionally absent
 * from the Chronicler, exports, and voice continuity sampling.
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
// Margin Callout
// ============================================================================

function MarginCallout({ note, index, expanded, onToggle, onToggleEnabled }) {
  const meta = NOTE_TYPE_META[note.type] || NOTE_TYPE_META.commentary;
  const isEnabled = note.enabled !== false;

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        onToggle(note.noteId);
      }}
      style={{ position: 'relative', display: 'inline' }}
    >
      {/* Superscript marker — only for enabled notes with inline placement */}
      <sup
        title={`${meta.label}: ${note.text}`}
        style={{
          fontSize: '9px',
          fontWeight: 700,
          color: meta.color,
          cursor: 'pointer',
          marginLeft: '1px',
          userSelect: 'none',
        }}
      >
        {meta.icon}{index + 1}
      </sup>

      {/* Expanded callout box */}
      {expanded && (
        <span style={{
          display: 'block',
          margin: '6px 0 8px 0',
          padding: '8px 12px',
          background: isEnabled ? '#f5e6c8' : 'rgba(245, 230, 200, 0.4)',
          borderLeft: `3px solid ${isEnabled ? meta.color : 'var(--border-color)'}`,
          borderRadius: '0 4px 4px 0',
          fontSize: '11px',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontStyle: 'italic',
          color: isEnabled ? '#4a3c2a' : '#4a3c2a80',
          lineHeight: '1.6',
          maxWidth: '100%',
          opacity: isEnabled ? 1 : 0.6,
        }}>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '3px',
          }}>
            <span style={{
              fontSize: '9px',
              fontWeight: 700,
              color: meta.color,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontStyle: 'normal',
              fontFamily: 'inherit',
              opacity: isEnabled ? 1 : 0.5,
            }}>
              {meta.icon} {meta.label}
            </span>
            {onToggleEnabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleEnabled(note.noteId, !isEnabled);
                }}
                title={isEnabled ? 'Disable this note' : 'Enable this note'}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: '0 2px',
                  color: isEnabled ? '#8b7355' : '#8b735580',
                  lineHeight: 1,
                  fontStyle: 'normal',
                }}
              >
                {isEnabled ? '◉' : '○'}
              </button>
            )}
          </span>
          {note.text}
        </span>
      )}
    </span>
  );
}

// ============================================================================
// Disabled Note Summary (shown below text for notes that are toggled off)
// ============================================================================

function DisabledNoteSummary({ notes, expandedNotes, onToggle, onToggleEnabled }) {
  if (notes.length === 0) return null;

  return (
    <div style={{
      marginTop: '8px',
      padding: '6px 10px',
      background: 'rgba(139, 115, 85, 0.06)',
      borderRadius: '4px',
      border: '1px solid rgba(139, 115, 85, 0.15)',
    }}>
      <div style={{
        fontSize: '10px',
        color: 'var(--text-muted)',
        marginBottom: '4px',
      }}>
        {notes.length} disabled note{notes.length !== 1 ? 's' : ''}
      </div>
      {notes.map((note, i) => {
        const meta = NOTE_TYPE_META[note.type] || NOTE_TYPE_META.commentary;
        const expanded = !!expandedNotes[note.noteId];
        return (
          <div
            key={note.noteId}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              padding: '3px 0',
              opacity: 0.6,
            }}
          >
            <button
              onClick={() => onToggleEnabled(note.noteId, true)}
              title="Enable this note"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '11px',
                padding: 0,
                color: '#8b735580',
                lineHeight: 1,
                flexShrink: 0,
                marginTop: '1px',
              }}
            >
              ○
            </button>
            <span
              onClick={() => onToggle(note.noteId)}
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                flex: 1,
              }}
            >
              <span style={{ color: meta.color, fontWeight: 600 }}>{meta.icon}</span>{' '}
              {expanded ? note.text : (
                note.text.length > 80 ? note.text.slice(0, 80) + '…' : note.text
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function HistorianMarginNotes({ text, notes, style, onToggleEnabled }) {
  const [expandedNotes, setExpandedNotes] = useState({});

  const toggleNote = (noteId) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [noteId]: !prev[noteId],
    }));
  };

  // Split notes into enabled and disabled
  const enabledNotes = useMemo(() =>
    (notes || []).filter((n) => n.enabled !== false),
    [notes],
  );
  const disabledNotes = useMemo(() =>
    (notes || []).filter((n) => n.enabled === false),
    [notes],
  );

  // Build segments of text interspersed with note markers (enabled notes only)
  const segments = useMemo(() => {
    if (enabledNotes.length === 0) {
      return [{ type: 'text', content: text }];
    }

    // Find anchor positions
    const anchors = [];
    for (let i = 0; i < enabledNotes.length; i++) {
      const note = enabledNotes[i];
      const idx = text.indexOf(note.anchorPhrase);
      if (idx >= 0) {
        anchors.push({
          position: idx + note.anchorPhrase.length,
          note,
          index: i,
        });
      }
    }

    anchors.sort((a, b) => a.position - b.position);

    const segs = [];
    let cursor = 0;

    for (const anchor of anchors) {
      if (anchor.position > cursor) {
        segs.push({ type: 'text', content: text.slice(cursor, anchor.position) });
        cursor = anchor.position;
      }
      segs.push({
        type: 'note',
        note: anchor.note,
        index: anchor.index,
      });
    }

    if (cursor < text.length) {
      segs.push({ type: 'text', content: text.slice(cursor) });
    }

    // Unmatched enabled notes listed at the end
    const unmatchedNotes = enabledNotes.filter(
      (n) => !anchors.some((a) => a.note.noteId === n.noteId)
    );
    for (let i = 0; i < unmatchedNotes.length; i++) {
      segs.push({
        type: 'note',
        note: unmatchedNotes[i],
        index: enabledNotes.indexOf(unmatchedNotes[i]),
      });
    }

    return segs;
  }, [text, enabledNotes]);

  const hasNotes = notes && notes.length > 0;

  return (
    <div style={style}>
      <div style={{
        fontSize: '14px',
        color: 'var(--text-secondary)',
        lineHeight: '1.7',
        margin: 0,
        whiteSpace: 'pre-wrap',
      }}>
        {segments.map((seg, i) => {
          if (seg.type === 'text') {
            return <span key={i}>{seg.content}</span>;
          }
          return (
            <MarginCallout
              key={`note-${seg.note.noteId}`}
              note={seg.note}
              index={seg.index}
              expanded={!!expandedNotes[seg.note.noteId]}
              onToggle={toggleNote}
              onToggleEnabled={onToggleEnabled}
            />
          );
        })}
      </div>

      {/* Toggle all enabled notes */}
      {enabledNotes.length > 0 && (
        <div style={{
          marginTop: '8px',
          fontSize: '10px',
          color: 'var(--text-muted)',
        }}>
          <button
            onClick={() => {
              const allExpanded = enabledNotes.every((n) => expandedNotes[n.noteId]);
              const next = {};
              for (const n of enabledNotes) {
                next[n.noteId] = !allExpanded;
              }
              setExpandedNotes(next);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#8b7355',
              cursor: 'pointer',
              fontSize: '10px',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            {enabledNotes.every((n) => expandedNotes[n.noteId])
              ? `Hide all ${enabledNotes.length} historian notes`
              : `Show all ${enabledNotes.length} historian notes`}
          </button>
        </div>
      )}

      {/* Disabled notes summary */}
      {onToggleEnabled && disabledNotes.length > 0 && (
        <DisabledNoteSummary
          notes={disabledNotes}
          expandedNotes={expandedNotes}
          onToggle={toggleNote}
          onToggleEnabled={onToggleEnabled}
        />
      )}
    </div>
  );
}
