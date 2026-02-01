/**
 * HistorianMarginNotes - Renders text with inline historian margin callouts
 *
 * Takes source text and an array of HistorianNote objects.
 * Renders the text with brown-background margin callouts anchored to phrases.
 * Used for both entity descriptions and chronicle narratives.
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

function MarginCallout({ note, index, expanded, onToggle }) {
  const meta = NOTE_TYPE_META[note.type] || NOTE_TYPE_META.commentary;

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        onToggle(note.noteId);
      }}
      style={{ position: 'relative', display: 'inline' }}
    >
      {/* Superscript marker */}
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
          background: '#f5e6c8',
          borderLeft: `3px solid ${meta.color}`,
          borderRadius: '0 4px 4px 0',
          fontSize: '11px',
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontStyle: 'italic',
          color: '#4a3c2a',
          lineHeight: '1.6',
          maxWidth: '100%',
        }}>
          <span style={{
            display: 'block',
            fontSize: '9px',
            fontWeight: 700,
            color: meta.color,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '3px',
            fontStyle: 'normal',
            fontFamily: 'inherit',
          }}>
            {meta.icon} {meta.label}
          </span>
          {note.text}
        </span>
      )}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function HistorianMarginNotes({ text, notes, style }) {
  const [expandedNotes, setExpandedNotes] = useState({});

  const toggleNote = (noteId) => {
    setExpandedNotes((prev) => ({
      ...prev,
      [noteId]: !prev[noteId],
    }));
  };

  // Build segments of text interspersed with note markers
  const segments = useMemo(() => {
    if (!notes || notes.length === 0) {
      return [{ type: 'text', content: text }];
    }

    // Find anchor positions
    const anchors = [];
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const idx = text.indexOf(note.anchorPhrase);
      if (idx >= 0) {
        anchors.push({
          // Place marker at end of anchor phrase
          position: idx + note.anchorPhrase.length,
          note,
          index: i,
        });
      }
    }

    // Sort by position
    anchors.sort((a, b) => a.position - b.position);

    // Build segments
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

    // If some notes had no anchor match, list them at the end
    const unmatchedNotes = notes.filter(
      (n, i) => !anchors.some((a) => a.note.noteId === n.noteId)
    );
    if (unmatchedNotes.length > 0) {
      for (let i = 0; i < unmatchedNotes.length; i++) {
        segs.push({
          type: 'note',
          note: unmatchedNotes[i],
          index: notes.indexOf(unmatchedNotes[i]),
        });
      }
    }

    return segs;
  }, [text, notes]);

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
            />
          );
        })}
      </div>

      {/* Toggle all notes */}
      {hasNotes && (
        <div style={{
          marginTop: '8px',
          fontSize: '10px',
          color: 'var(--text-muted)',
        }}>
          <button
            onClick={() => {
              const allExpanded = notes.every((n) => expandedNotes[n.noteId]);
              const next = {};
              for (const n of notes) {
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
            {notes.every((n) => expandedNotes[n.noteId])
              ? `Hide all ${notes.length} historian notes`
              : `Show all ${notes.length} historian notes`}
          </button>
        </div>
      )}
    </div>
  );
}
