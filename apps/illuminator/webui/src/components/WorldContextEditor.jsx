/**
 * WorldContextEditor - Configure world context for LLM prompts
 *
 * Exposes:
 * - World name and description
 * - Canon facts with metadata (for perspective synthesis)
 * - Tone fragments (core + culture/kind overlays)
 * - Legacy: simple canon facts and tone (for backwards compatibility)
 */

import { useState, useCallback } from 'react';
import { LocalTextArea } from '@penguin-tales/shared-components';

const DESCRIPTION_TEXTAREA_STYLE = Object.freeze({ minHeight: '100px', resize: 'vertical' });
const TONE_TEXTAREA_STYLE = Object.freeze({ minHeight: '80px', resize: 'vertical' });
const COMPACT_TEXTAREA_STYLE = Object.freeze({ minHeight: '60px', resize: 'vertical', fontSize: '12px' });

// ============================================================================
// Fact with Metadata Viewer/Editor
// ============================================================================

function FactMetadataCard({ fact, onUpdate, onRemove }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateField = (field, value) => {
    onUpdate({ ...fact, [field]: value });
  };

  const formatArray = (arr) => (arr || []).join(', ');
  const parseArray = (str) => str.split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <div
      style={{
        background: 'var(--bg-tertiary)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        marginBottom: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 12px',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'monospace',
            color: 'var(--accent-color)',
            minWidth: '120px',
          }}
        >
          {fact.id}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: '12px',
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {fact.text}
        </span>
        <span
          style={{
            fontSize: '10px',
            padding: '2px 6px',
            background: 'var(--bg-secondary)',
            borderRadius: '4px',
            color: 'var(--text-muted)',
          }}
        >
          pri: {(fact.basePriority || 0).toFixed(1)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--danger)',
            cursor: 'pointer',
            padding: '2px 6px',
            fontSize: '14px',
          }}
        >
          ×
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div
          style={{
            padding: '12px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Text
            </label>
            <LocalTextArea
              value={fact.text || ''}
              onChange={(value) => updateField('text', value)}
              className="illuminator-input"
              style={COMPACT_TEXTAREA_STYLE}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Relevant Cultures (comma-separated, * for all)
              </label>
              <input
                type="text"
                value={formatArray(fact.relevantCultures)}
                onChange={(e) => updateField('relevantCultures', parseArray(e.target.value))}
                className="illuminator-input"
                style={{ fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Relevant Kinds (comma-separated, * for all)
              </label>
              <input
                type="text"
                value={formatArray(fact.relevantKinds)}
                onChange={(e) => updateField('relevantKinds', parseArray(e.target.value))}
                className="illuminator-input"
                style={{ fontSize: '12px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Relevant Tags (comma-separated)
              </label>
              <input
                type="text"
                value={formatArray(fact.relevantTags)}
                onChange={(e) => updateField('relevantTags', parseArray(e.target.value))}
                className="illuminator-input"
                style={{ fontSize: '12px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Relevant Relationships (comma-separated)
              </label>
              <input
                type="text"
                value={formatArray(fact.relevantRelationships)}
                onChange={(e) => updateField('relevantRelationships', parseArray(e.target.value))}
                className="illuminator-input"
                style={{ fontSize: '12px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Base Priority (0-1)
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={fact.basePriority || 0.5}
                onChange={(e) => updateField('basePriority', parseFloat(e.target.value) || 0.5)}
                className="illuminator-input"
                style={{ fontSize: '12px' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FactsWithMetadataEditor({ facts, onChange }) {
  const [newFactId, setNewFactId] = useState('');

  const handleAddFact = () => {
    if (!newFactId.trim()) return;
    const newFact = {
      id: newFactId.trim().toLowerCase().replace(/\s+/g, '-'),
      text: '',
      relevantCultures: ['*'],
      relevantKinds: ['*'],
      relevantTags: [],
      relevantRelationships: [],
      basePriority: 0.5,
    };
    onChange([...facts, newFact]);
    setNewFactId('');
  };

  const handleUpdateFact = (index, updatedFact) => {
    const newFacts = [...facts];
    newFacts[index] = updatedFact;
    onChange(newFacts);
  };

  const handleRemoveFact = (index) => {
    onChange(facts.filter((_, i) => i !== index));
  };

  return (
    <div>
      {facts.map((fact, index) => (
        <FactMetadataCard
          key={fact.id || index}
          fact={fact}
          onUpdate={(updated) => handleUpdateFact(index, updated)}
          onRemove={() => handleRemoveFact(index)}
        />
      ))}
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <input
          type="text"
          value={newFactId}
          onChange={(e) => setNewFactId(e.target.value)}
          placeholder="new-fact-id"
          className="illuminator-input"
          style={{ flex: 1, fontSize: '12px' }}
          onKeyDown={(e) => e.key === 'Enter' && handleAddFact()}
        />
        <button
          onClick={handleAddFact}
          className="illuminator-button illuminator-button-secondary"
          disabled={!newFactId.trim()}
        >
          Add Fact
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Tone Fragments Editor
// ============================================================================

function ToneFragmentsEditor({ fragments, onChange }) {
  const updateField = (field, value) => {
    onChange({ ...fragments, [field]: value });
  };

  const updateOverlay = (type, key, value) => {
    const overlays = { ...(fragments[type] || {}) };
    if (value.trim()) {
      overlays[key] = value;
    } else {
      delete overlays[key];
    }
    updateField(type, overlays);
  };

  const cultureOverlays = fragments?.cultureOverlays || {};
  const kindOverlays = fragments?.kindOverlays || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Core Tone */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
          Core Tone (always included)
        </label>
        <LocalTextArea
          value={fragments?.core || ''}
          onChange={(value) => updateField('core', value)}
          placeholder="Core style principles that apply to all chronicles..."
          className="illuminator-input"
          style={{ minHeight: '120px', resize: 'vertical', fontSize: '12px' }}
        />
      </div>

      {/* Culture Overlays */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
          Culture Overlays (added when culture dominates)
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {['nightshelf', 'aurora_stack', 'orca', 'mixed'].map((culture) => (
            <div key={culture}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                {culture}
              </label>
              <LocalTextArea
                value={cultureOverlays[culture] || ''}
                onChange={(value) => updateOverlay('cultureOverlays', culture, value)}
                placeholder={`Tone adjustments for ${culture}-focused chronicles...`}
                className="illuminator-input"
                style={COMPACT_TEXTAREA_STYLE}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Kind Overlays */}
      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, display: 'block', marginBottom: '6px' }}>
          Kind Overlays (added based on entity focus)
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {['character', 'place', 'object', 'event', 'mixed'].map((kind) => (
            <div key={kind}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>
                {kind}
              </label>
              <LocalTextArea
                value={kindOverlays[kind] || ''}
                onChange={(value) => updateOverlay('kindOverlays', kind, value)}
                placeholder={`Tone adjustments for ${kind}-focused chronicles...`}
                className="illuminator-input"
                style={COMPACT_TEXTAREA_STYLE}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditableList({ items, onChange, placeholder }) {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    if (newItem.trim()) {
      onChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemove = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="illuminator-input"
          style={{ flex: 1 }}
        />
        <button
          onClick={handleAdd}
          className="illuminator-button illuminator-button-secondary"
          disabled={!newItem.trim()}
        >
          Add
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {items.map((item, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 10px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          >
            <span style={{ flex: 1 }}>{item}</span>
            <button
              onClick={() => handleRemove(index)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--danger)',
                cursor: 'pointer',
                padding: '2px 6px',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WorldContextEditor({ worldContext, onWorldContextChange }) {
  const updateField = useCallback(
    (field, value) => {
      onWorldContextChange({ [field]: value });
    },
    [onWorldContextChange]
  );

  return (
    <div>
      {/* Info Banner */}
      <div
        style={{
          padding: '12px 16px',
          marginBottom: '16px',
          background: 'var(--bg-tertiary)',
          borderRadius: '6px',
          borderLeft: '3px solid var(--accent-color)',
        }}
      >
        <div style={{ fontWeight: 500, marginBottom: '4px' }}>
          Entity context is built automatically
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Relationships, cultural peers, faction members, and entity age are extracted from the
          simulation data. This panel only configures world-level context that applies to all
          entities.
        </div>
      </div>

      {/* World Identity */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">World Identity</h2>
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">World Name</label>
          <input
            type="text"
            value={worldContext.name || ''}
            onChange={(e) => updateField('name', e.target.value)}
            placeholder="e.g., The Frozen Realms of Aurora Berg"
            className="illuminator-input"
          />
        </div>

        <div className="illuminator-form-group">
          <label className="illuminator-label">World Description</label>
          <LocalTextArea
            value={worldContext.description || ''}
            onChange={(value) => updateField('description', value)}
            placeholder="Brief description of your world's setting, themes, and what makes it unique..."
            className="illuminator-input"
            style={DESCRIPTION_TEXTAREA_STYLE}
          />
        </div>
      </div>

      {/* Species Constraint */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Species Constraint</h2>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Rule for what species can appear in generated images. This is added as a SPECIES REQUIREMENT
          at the top of image prompts to ensure all depicted figures match your world's inhabitants.
        </p>
        <div className="illuminator-form-group">
          <LocalTextArea
            value={worldContext.speciesConstraint || ''}
            onChange={(value) => updateField('speciesConstraint', value)}
            placeholder="e.g., All depicted figures must be penguins or orcas. No humans exist in this world."
            className="illuminator-input"
            style={TONE_TEXTAREA_STYLE}
          />
        </div>
      </div>

      {/* Canon Facts */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Canon Facts</h2>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Established facts about your world that must not be contradicted in generated content.
          These help ensure consistency across all enriched entities.
        </p>
        <EditableList
          items={worldContext.canonFacts || []}
          onChange={(items) => updateField('canonFacts', items)}
          placeholder="Add a canon fact..."
        />
      </div>

      {/* Tone */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">Tone & Style (Legacy)</h2>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Flat tone string used when perspective synthesis is disabled.
        </p>
        <div className="illuminator-form-group">
          <LocalTextArea
            value={worldContext.tone || ''}
            onChange={(value) => updateField('tone', value)}
            placeholder="e.g., Evocative and mythic, with hints of mystery. Focus on sensory details and emotional weight rather than dry facts..."
            className="illuminator-input"
            style={TONE_TEXTAREA_STYLE}
          />
        </div>
      </div>

      {/* Perspective Synthesis Section */}
      <div
        style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '2px solid var(--accent-color)',
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
            Perspective Synthesis Configuration
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            When both tone fragments and facts with metadata are configured, chronicles
            use LLM-assisted perspective synthesis to create focused, faceted views of the world.
          </p>
        </div>

        {/* Facts with Metadata */}
        <div className="illuminator-card">
          <div className="illuminator-card-header">
            <h2 className="illuminator-card-title">Facts with Metadata</h2>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            World facts with relevance metadata. Higher priority facts and those matching the
            chronicle's constellation are more likely to be foregrounded. The LLM synthesizer
            provides faceted interpretations for selected facts.
          </p>
          <FactsWithMetadataEditor
            facts={worldContext.canonFactsWithMetadata || []}
            onChange={(facts) => updateField('canonFactsWithMetadata', facts)}
          />
        </div>

        {/* Tone Fragments */}
        <div className="illuminator-card">
          <div className="illuminator-card-header">
            <h2 className="illuminator-card-title">Tone Fragments</h2>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Composable tone guidance. Core is always included; culture and kind overlays
            are added based on the chronicle's entity constellation.
          </p>
          <ToneFragmentsEditor
            fragments={worldContext.toneFragments || {}}
            onChange={(fragments) => updateField('toneFragments', fragments)}
          />
        </div>
      </div>
    </div>
  );
}
