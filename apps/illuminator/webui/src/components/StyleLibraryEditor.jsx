/**
 * StyleLibraryEditor - Manage artistic, composition, and narrative styles
 *
 * Allows users to:
 * - View all styles in the library
 * - Add new artistic/composition/narrative styles
 * - Edit existing styles
 * - Delete styles
 * - Reset to defaults
 */

import { useState, useCallback } from 'react';
import { ENTITY_CATEGORIES } from '@canonry/world-schema';

// Category options (derived from ENTITY_CATEGORIES)
const CATEGORY_OPTIONS = Object.entries(ENTITY_CATEGORIES).map(([id, info]) => ({
  id,
  name: info.name,
  description: info.description,
}));

/**
 * Generate a unique ID for a new style
 */
function generateStyleId(prefix) {
  return `${prefix}-${Date.now().toString(36)}`;
}

/**
 * Style card component for displaying a single style
 */
function StyleCard({ style, type, onEdit, onDelete }) {
  return (
    <div className="illuminator-style-card">
      <div className="illuminator-style-card-header">
        <div className="illuminator-style-card-title">{style.name}</div>
        <div className="illuminator-style-card-actions">
          <button
            onClick={() => onEdit(style)}
            className="illuminator-btn-icon"
            title="Edit style"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(style.id)}
            className="illuminator-btn-icon illuminator-btn-danger"
            title="Delete style"
          >
            Delete
          </button>
        </div>
      </div>
      {style.description && (
        <div className="illuminator-style-card-description">{style.description}</div>
      )}
      <div className="illuminator-style-card-prompt">
        <strong>Prompt:</strong> {style.promptFragment}
      </div>
      {style.keywords?.length > 0 && (
        <div className="illuminator-style-card-keywords">
          {style.keywords.map((kw) => (
            <span key={kw} className="illuminator-style-keyword">{kw}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Modal for editing a style
 */
function StyleEditModal({ style, type, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    id: style?.id || '',
    name: style?.name || '',
    description: style?.description || '',
    promptFragment: style?.promptFragment || '',
    keywords: style?.keywords?.join(', ') || '',
  });

  const isNew = !style?.id;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const result = {
      id: isNew ? generateStyleId(type) : formData.id,
      name: formData.name.trim(),
      promptFragment: formData.promptFragment.trim(),
    };

    if (formData.description.trim()) {
      result.description = formData.description.trim();
    }

    if (type === 'artistic' && formData.keywords.trim()) {
      result.keywords = formData.keywords.split(',').map((k) => k.trim()).filter(Boolean);
    }

    onSave(result, isNew);
  };

  const isValid = formData.name.trim() && formData.promptFragment.trim();

  return (
    <div className="illuminator-modal-overlay" onClick={onCancel}>
      <div className="illuminator-modal" onClick={(e) => e.stopPropagation()}>
        <div className="illuminator-modal-header">
          <h3>{isNew ? 'Add' : 'Edit'} {type === 'artistic' ? 'Artistic' : 'Composition'} Style</h3>
          <button onClick={onCancel} className="illuminator-modal-close">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="illuminator-modal-body">
          <div className="illuminator-form-group">
            <label className="illuminator-label">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="illuminator-input"
              placeholder="e.g., Oil Painting"
              autoFocus
            />
          </div>

          <div className="illuminator-form-group">
            <label className="illuminator-label">Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="illuminator-input"
              placeholder="Brief description of the style"
            />
          </div>

          <div className="illuminator-form-group">
            <label className="illuminator-label">Prompt Fragment *</label>
            <textarea
              value={formData.promptFragment}
              onChange={(e) => handleChange('promptFragment', e.target.value)}
              className="illuminator-textarea"
              rows={3}
              placeholder="e.g., oil painting style, rich textures, visible brushstrokes"
            />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              This text will be injected into the image generation prompt.
            </p>
          </div>

          {type === 'artistic' && (
            <div className="illuminator-form-group">
              <label className="illuminator-label">Keywords</label>
              <input
                type="text"
                value={formData.keywords}
                onChange={(e) => handleChange('keywords', e.target.value)}
                className="illuminator-input"
                placeholder="e.g., traditional, classical, painterly"
              />
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Comma-separated keywords for categorization.
              </p>
            </div>
          )}

          <div className="illuminator-modal-footer">
            <button type="button" onClick={onCancel} className="illuminator-btn">
              Cancel
            </button>
            <button type="submit" disabled={!isValid} className="illuminator-btn illuminator-btn-primary">
              {isNew ? 'Add Style' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Narrative style card component
 */
function NarrativeStyleCard({ style, onEdit, onDelete }) {
  const isDocument = style.format === 'document';
  const docConfig = style.documentConfig;

  return (
    <div className="illuminator-style-card">
      <div className="illuminator-style-card-header">
        <div className="illuminator-style-card-title">{style.name}</div>
        <div className="illuminator-style-card-actions">
          <button
            onClick={() => onEdit(style)}
            className="illuminator-btn-icon"
            title="Edit style"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(style.id)}
            className="illuminator-btn-icon illuminator-btn-danger"
            title="Delete style"
          >
            Delete
          </button>
        </div>
      </div>
      {style.description && (
        <div className="illuminator-style-card-description">{style.description}</div>
      )}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
        {/* Type badge */}
        <span
          style={{
            fontSize: '10px',
            padding: '2px 6px',
            background: isDocument ? '#059669' : 'var(--accent-primary)',
            color: 'white',
            borderRadius: '4px',
          }}
        >
          {isDocument ? (docConfig?.documentType || 'document') : (style.plotStructure?.type || 'three-act')}
        </span>
        {/* Word count badge */}
        <span
          style={{
            fontSize: '10px',
            padding: '2px 6px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
          }}
        >
          {isDocument
            ? `${docConfig?.wordCount?.min || 300}-${docConfig?.wordCount?.max || 800} words`
            : `${style.pacing?.totalWordCount?.min || 1000}-${style.pacing?.totalWordCount?.max || 2000} words`}
        </span>
        {/* Scenes/sections badge */}
        <span
          style={{
            fontSize: '10px',
            padding: '2px 6px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
          }}
        >
          {isDocument
            ? `${docConfig?.sections?.length || 0} sections`
            : `${style.pacing?.sceneCount?.min || 3}-${style.pacing?.sceneCount?.max || 5} scenes`}
        </span>
      </div>
      {/* Tone keywords */}
      {isDocument ? (
        docConfig?.toneKeywords?.length > 0 && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <strong>Tone:</strong> {docConfig.toneKeywords.slice(0, 3).join(', ')}
          </div>
        )
      ) : (
        style.proseDirectives?.toneKeywords?.length > 0 && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <strong>Tone:</strong> {style.proseDirectives.toneKeywords.slice(0, 3).join(', ')}
          </div>
        )
      )}
      {style.tags?.length > 0 && (
        <div className="illuminator-style-card-keywords" style={{ marginTop: '8px' }}>
          {style.tags.map((tag) => (
            <span key={tag} className="illuminator-style-keyword">{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Modal for viewing/editing a document-format narrative style (read-only for now)
 */
function DocumentStyleViewModal({ style, onCancel }) {
  const docConfig = style.documentConfig || {};

  return (
    <div className="illuminator-modal-overlay" onClick={onCancel}>
      <div
        className="illuminator-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div className="illuminator-modal-header">
          <h3>Document Style: {style.name}</h3>
          <button onClick={onCancel} className="illuminator-modal-close">&times;</button>
        </div>

        <div className="illuminator-modal-body" style={{ flex: 1, overflow: 'auto' }}>
          {/* Basic info */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Description</div>
            <div>{style.description || '(none)'}</div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Document Type</div>
            <div style={{ fontWeight: 500 }}>{docConfig.documentType || '(not specified)'}</div>
          </div>

          {docConfig.voice && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Voice</div>
              <div>{docConfig.voice}</div>
            </div>
          )}

          {/* Word count */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Word Count</div>
            <div>{docConfig.wordCount?.min || 300} - {docConfig.wordCount?.max || 800} words</div>
          </div>

          {/* Subject categories */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            {style.entityRules?.primarySubjectCategories?.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Primary Subject Categories</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {style.entityRules.primarySubjectCategories.map((cat) => {
                    const info = ENTITY_CATEGORIES[cat];
                    return (
                      <span
                        key={cat}
                        style={{
                          padding: '2px 8px',
                          background: '#10b981',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '11px',
                        }}
                      >
                        {info?.name || cat}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {style.entityRules?.supportingSubjectCategories?.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Supporting Subject Categories</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {style.entityRules.supportingSubjectCategories.map((cat) => {
                    const info = ENTITY_CATEGORIES[cat];
                    return (
                      <span
                        key={cat}
                        style={{
                          padding: '2px 8px',
                          background: 'var(--bg-tertiary)',
                          borderRadius: '4px',
                          fontSize: '11px',
                        }}
                      >
                        {info?.name || cat}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Content instructions */}
          {docConfig.contentInstructions && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Content Instructions</div>
              <div style={{ fontSize: '13px', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
                {docConfig.contentInstructions}
              </div>
            </div>
          )}

          {/* Sections */}
          {docConfig.sections?.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Sections ({docConfig.sections.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {docConfig.sections.map((section, i) => (
                  <div
                    key={section.id || i}
                    style={{
                      padding: '12px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ fontWeight: 500 }}>{section.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        ~{section.wordCountTarget || 100} words
                        {section.optional && ' (optional)'}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{section.purpose}</div>
                    {section.contentGuidance && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                        {section.contentGuidance}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tone & style */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            {docConfig.toneKeywords?.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Tone</div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {docConfig.toneKeywords.map((kw) => (
                    <span key={kw} className="illuminator-style-keyword">{kw}</span>
                  ))}
                </div>
              </div>
            )}
            {docConfig.include?.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Include</div>
                <div style={{ fontSize: '12px' }}>{docConfig.include.join(', ')}</div>
              </div>
            )}
          </div>

          {docConfig.avoid?.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Avoid</div>
              <div style={{ fontSize: '12px' }}>{docConfig.avoid.join(', ')}</div>
            </div>
          )}

          {/* Tags */}
          {style.tags?.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Tags</div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {style.tags.map((tag) => (
                  <span key={tag} className="illuminator-style-keyword">{tag}</span>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: '24px',
              padding: '12px',
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: '6px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            Document styles are pre-defined and cannot be edited in the UI. To customize, create a new story-format style or edit the style library JSON directly.
          </div>
        </div>

        <div className="illuminator-modal-footer">
          <button onClick={onCancel} className="illuminator-btn illuminator-btn-primary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal for editing a narrative style
 */
function NarrativeStyleEditModal({ style, onSave, onCancel }) {
  const isNew = !style?.id;

  // If this is a document format, show view-only modal
  if (style?.format === 'document') {
    return <DocumentStyleViewModal style={style} onCancel={onCancel} />;
  }

  const [formData, setFormData] = useState({
    id: style?.id || '',
    name: style?.name || '',
    description: style?.description || '',
    tags: style?.tags?.join(', ') || '',
    // Plot structure - just instructions, no type dropdown
    plotInstructions: style?.plotStructure?.instructions || '',
    // Entity rules - category-based
    primarySubjectCategories: style?.entityRules?.primarySubjectCategories || ['character'],
    supportingSubjectCategories: style?.entityRules?.supportingSubjectCategories || ['character', 'collective'],
    // Event rules
    significanceMin: style?.eventRules?.significanceRange?.min ?? 0.5,
    significanceMax: style?.eventRules?.significanceRange?.max ?? 1.0,
    maxEvents: style?.eventRules?.maxEvents ?? 10,
    priorityKinds: style?.eventRules?.priorityKinds?.join(', ') || '',
    eventUsageInstructions: style?.eventRules?.usageInstructions || '',
    // Pacing
    wordCountMin: style?.pacing?.totalWordCount?.min ?? 1500,
    wordCountMax: style?.pacing?.totalWordCount?.max ?? 2500,
    sceneCountMin: style?.pacing?.sceneCount?.min ?? 3,
    sceneCountMax: style?.pacing?.sceneCount?.max ?? 5,
    // Prose directives
    toneKeywords: style?.proseDirectives?.toneKeywords?.join(', ') || '',
    dialogueStyle: style?.proseDirectives?.dialogueStyle || '',
    descriptionStyle: style?.proseDirectives?.descriptionStyle || '',
    pacingNotes: style?.proseDirectives?.pacingNotes || '',
    avoid: style?.proseDirectives?.avoid?.join(', ') || '',
    // World data focus
    includeLocations: style?.worldDataFocus?.includeLocations ?? true,
    includeArtifacts: style?.worldDataFocus?.includeArtifacts ?? false,
    includeCulturalPractices: style?.worldDataFocus?.includeCulturalPractices ?? false,
    includeEraContext: style?.worldDataFocus?.includeEraContext ?? true,
  });

  const [activeTab, setActiveTab] = useState('basic');

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const parseCommaSeparated = (str) => str.split(',').map((s) => s.trim()).filter(Boolean);

  const handleSubmit = (e) => {
    e.preventDefault();

    // Preserve existing roles/scene templates, or use defaults for new styles
    const roles = style?.entityRules?.roles || [
      { role: 'protagonist', count: { min: 1, max: 1 }, description: 'Main character driving the story' },
      { role: 'supporting', count: { min: 1, max: 4 }, description: 'Supporting characters' },
    ];
    const maxCastSize = style?.entityRules?.maxCastSize || 5;

    // Preserve existing scene templates, or use defaults for new styles
    const sceneTemplates = style?.sceneTemplates || [
      { name: 'Opening', purpose: 'Establish world and character', requiredElements: ['setting', 'protagonist'], emotionalArc: 'anticipation' },
      { name: 'Development', purpose: 'Build tension and stakes', requiredElements: ['conflict', 'stakes'], emotionalArc: 'tension' },
      { name: 'Climax', purpose: 'Peak confrontation', requiredElements: ['confrontation', 'decision'], emotionalArc: 'intensity' },
      { name: 'Resolution', purpose: 'Show aftermath', requiredElements: ['consequence', 'meaning'], emotionalArc: 'catharsis' },
    ];

    const result = {
      id: isNew ? `narrative-${Date.now().toString(36)}` : formData.id,
      name: formData.name.trim(),
      description: formData.description.trim(),
      tags: parseCommaSeparated(formData.tags),
      format: 'story',

      // Preserve existing plot structure type if present, just update instructions
      plotStructure: {
        ...(style?.plotStructure?.type && { type: style.plotStructure.type }),
        instructions: formData.plotInstructions.trim(),
      },

      entityRules: {
        primarySubjectCategories: formData.primarySubjectCategories,
        supportingSubjectCategories: formData.supportingSubjectCategories,
        roles,
        maxCastSize,
      },

      eventRules: {
        significanceRange: {
          min: parseFloat(formData.significanceMin),
          max: parseFloat(formData.significanceMax),
        },
        maxEvents: parseInt(formData.maxEvents, 10),
        priorityKinds: parseCommaSeparated(formData.priorityKinds),
        usageInstructions: formData.eventUsageInstructions.trim(),
      },

      sceneTemplates,

      pacing: {
        totalWordCount: {
          min: parseInt(formData.wordCountMin, 10),
          max: parseInt(formData.wordCountMax, 10),
        },
        sceneCount: {
          min: parseInt(formData.sceneCountMin, 10),
          max: parseInt(formData.sceneCountMax, 10),
        },
      },

      proseDirectives: {
        toneKeywords: parseCommaSeparated(formData.toneKeywords),
        dialogueStyle: formData.dialogueStyle.trim(),
        descriptionStyle: formData.descriptionStyle.trim(),
        pacingNotes: formData.pacingNotes.trim(),
        avoid: parseCommaSeparated(formData.avoid),
      },

      worldDataFocus: {
        includeLocations: formData.includeLocations,
        includeArtifacts: formData.includeArtifacts,
        includeCulturalPractices: formData.includeCulturalPractices,
        includeEraContext: formData.includeEraContext,
      },
    };

    onSave(result, isNew);
  };

  const isValid = formData.name.trim() && formData.toneKeywords.trim();

  const tabs = [
    { id: 'basic', label: 'Basic' },
    { id: 'plot', label: 'Plot' },
    { id: 'entities', label: 'Entities' },
    { id: 'events', label: 'Events' },
    { id: 'pacing', label: 'Pacing' },
    { id: 'prose', label: 'Prose' },
  ];

  return (
    <div className="illuminator-modal-overlay" onClick={onCancel}>
      <div
        className="illuminator-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div className="illuminator-modal-header">
          <h3>{isNew ? 'Add' : 'Edit'} Narrative Style</h3>
          <button onClick={onCancel} className="illuminator-modal-close">&times;</button>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                border: 'none',
                background: activeTab === tab.id ? 'var(--bg-primary)' : 'transparent',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: activeTab === tab.id ? 600 : 400,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div className="illuminator-modal-body" style={{ flex: 1, overflow: 'auto' }}>
            {/* Basic Tab */}
            {activeTab === 'basic' && (
              <>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="illuminator-input"
                    placeholder="e.g., Epic Drama"
                    autoFocus
                  />
                </div>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className="illuminator-textarea"
                    rows={2}
                    placeholder="Brief description of this narrative style"
                  />
                </div>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Tags</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => handleChange('tags', e.target.value)}
                    className="illuminator-input"
                    placeholder="e.g., dramatic, conflict, emotional"
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Comma-separated tags for categorization.
                  </p>
                </div>
              </>
            )}

            {/* Plot Tab */}
            {activeTab === 'plot' && (
              <>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Narrative Structure Instructions</label>
                  <textarea
                    value={formData.plotInstructions}
                    onChange={(e) => handleChange('plotInstructions', e.target.value)}
                    className="illuminator-textarea"
                    rows={6}
                    placeholder="Describe the narrative structure for this style. For example: 'Build tension through a three-act structure with clear rising action, climax, and resolution. Focus on character transformation...'"
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Freeform instructions for how to structure the narrative. This guides the AI in building plot, pacing, and dramatic beats.
                  </p>
                </div>
              </>
            )}

            {/* Entities Tab */}
            {activeTab === 'entities' && (
              <>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Primary Subject Categories</label>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Recommended entity categories for primary/protagonist roles.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {CATEGORY_OPTIONS.filter(c => c.id !== 'era' && c.id !== 'event').map((cat) => (
                      <label
                        key={cat.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 10px',
                          background: formData.primarySubjectCategories.includes(cat.id)
                            ? '#10b981'
                            : 'var(--bg-tertiary)',
                          color: formData.primarySubjectCategories.includes(cat.id)
                            ? 'white'
                            : 'var(--text-secondary)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'all 0.2s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData.primarySubjectCategories.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleChange('primarySubjectCategories', [...formData.primarySubjectCategories, cat.id]);
                            } else {
                              handleChange('primarySubjectCategories', formData.primarySubjectCategories.filter(c => c !== cat.id));
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                        {cat.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Supporting Subject Categories</label>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Recommended entity categories for supporting/secondary roles.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {CATEGORY_OPTIONS.filter(c => c.id !== 'era' && c.id !== 'event').map((cat) => (
                      <label
                        key={cat.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 10px',
                          background: formData.supportingSubjectCategories.includes(cat.id)
                            ? '#10b981'
                            : 'var(--bg-tertiary)',
                          color: formData.supportingSubjectCategories.includes(cat.id)
                            ? 'white'
                            : 'var(--text-secondary)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          transition: 'all 0.2s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData.supportingSubjectCategories.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleChange('supportingSubjectCategories', [...formData.supportingSubjectCategories, cat.id]);
                            } else {
                              handleChange('supportingSubjectCategories', formData.supportingSubjectCategories.filter(c => c !== cat.id));
                            }
                          }}
                          style={{ display: 'none' }}
                        />
                        {cat.name}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Events Tab */}
            {activeTab === 'events' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="illuminator-form-group">
                    <label className="illuminator-label">Min Significance</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={formData.significanceMin}
                      onChange={(e) => handleChange('significanceMin', e.target.value)}
                      className="illuminator-input"
                    />
                  </div>
                  <div className="illuminator-form-group">
                    <label className="illuminator-label">Max Significance</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={formData.significanceMax}
                      onChange={(e) => handleChange('significanceMax', e.target.value)}
                      className="illuminator-input"
                    />
                  </div>
                  <div className="illuminator-form-group">
                    <label className="illuminator-label">Max Events</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={formData.maxEvents}
                      onChange={(e) => handleChange('maxEvents', e.target.value)}
                      className="illuminator-input"
                    />
                  </div>
                </div>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Priority Event Kinds</label>
                  <input
                    type="text"
                    value={formData.priorityKinds}
                    onChange={(e) => handleChange('priorityKinds', e.target.value)}
                    className="illuminator-input"
                    placeholder="conflict, alliance, death"
                  />
                </div>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Event Usage Instructions</label>
                  <textarea
                    value={formData.eventUsageInstructions}
                    onChange={(e) => handleChange('eventUsageInstructions', e.target.value)}
                    className="illuminator-textarea"
                    rows={2}
                    placeholder="How to incorporate events into the narrative..."
                  />
                </div>
              </>
            )}

            {/* Pacing Tab */}
            {activeTab === 'pacing' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="illuminator-form-group">
                    <label className="illuminator-label">Min Word Count</label>
                    <input
                      type="number"
                      min="100"
                      step="100"
                      value={formData.wordCountMin}
                      onChange={(e) => handleChange('wordCountMin', e.target.value)}
                      className="illuminator-input"
                    />
                  </div>
                  <div className="illuminator-form-group">
                    <label className="illuminator-label">Max Word Count</label>
                    <input
                      type="number"
                      min="100"
                      step="100"
                      value={formData.wordCountMax}
                      onChange={(e) => handleChange('wordCountMax', e.target.value)}
                      className="illuminator-input"
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="illuminator-form-group">
                    <label className="illuminator-label">Min Scenes</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={formData.sceneCountMin}
                      onChange={(e) => handleChange('sceneCountMin', e.target.value)}
                      className="illuminator-input"
                    />
                  </div>
                  <div className="illuminator-form-group">
                    <label className="illuminator-label">Max Scenes</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={formData.sceneCountMax}
                      onChange={(e) => handleChange('sceneCountMax', e.target.value)}
                      className="illuminator-input"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Prose Tab */}
            {activeTab === 'prose' && (
              <>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Tone Keywords *</label>
                  <input
                    type="text"
                    value={formData.toneKeywords}
                    onChange={(e) => handleChange('toneKeywords', e.target.value)}
                    className="illuminator-input"
                    placeholder="epic, dramatic, tense, emotional"
                  />
                </div>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Dialogue Style</label>
                  <input
                    type="text"
                    value={formData.dialogueStyle}
                    onChange={(e) => handleChange('dialogueStyle', e.target.value)}
                    className="illuminator-input"
                    placeholder="e.g., Formal and weighty, characters speak with purpose"
                  />
                </div>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Description Style</label>
                  <input
                    type="text"
                    value={formData.descriptionStyle}
                    onChange={(e) => handleChange('descriptionStyle', e.target.value)}
                    className="illuminator-input"
                    placeholder="e.g., Rich sensory detail, focus on atmosphere and emotion"
                  />
                </div>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Pacing Notes</label>
                  <input
                    type="text"
                    value={formData.pacingNotes}
                    onChange={(e) => handleChange('pacingNotes', e.target.value)}
                    className="illuminator-input"
                    placeholder="e.g., Build tension steadily, breathe in quiet moments"
                  />
                </div>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">Avoid</label>
                  <input
                    type="text"
                    value={formData.avoid}
                    onChange={(e) => handleChange('avoid', e.target.value)}
                    className="illuminator-input"
                    placeholder="e.g., modern slang, breaking fourth wall"
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Comma-separated list of things to avoid in the prose.
                  </p>
                </div>
                <div className="illuminator-form-group">
                  <label className="illuminator-label">World Data Focus</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={formData.includeLocations}
                        onChange={(e) => handleChange('includeLocations', e.target.checked)}
                      />
                      Locations
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={formData.includeArtifacts}
                        onChange={(e) => handleChange('includeArtifacts', e.target.checked)}
                      />
                      Artifacts
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={formData.includeCulturalPractices}
                        onChange={(e) => handleChange('includeCulturalPractices', e.target.checked)}
                      />
                      Cultural Practices
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={formData.includeEraContext}
                        onChange={(e) => handleChange('includeEraContext', e.target.checked)}
                      />
                      Era Context
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="illuminator-modal-footer">
            <button type="button" onClick={onCancel} className="illuminator-btn">
              Cancel
            </button>
            <button type="submit" disabled={!isValid} className="illuminator-btn illuminator-btn-primary">
              {isNew ? 'Add Style' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Main StyleLibraryEditor component
 */
export default function StyleLibraryEditor({
  styleLibrary,
  loading,
  isCustom,
  onAddArtisticStyle,
  onUpdateArtisticStyle,
  onDeleteArtisticStyle,
  onAddCompositionStyle,
  onUpdateCompositionStyle,
  onDeleteCompositionStyle,
  onAddNarrativeStyle,
  onUpdateNarrativeStyle,
  onDeleteNarrativeStyle,
  onReset,
}) {
  const [editingStyle, setEditingStyle] = useState(null);
  const [editingType, setEditingType] = useState(null); // 'artistic' | 'composition' | 'narrative'
  const [confirmReset, setConfirmReset] = useState(false);

  const handleEditArtistic = useCallback((style) => {
    setEditingStyle(style);
    setEditingType('artistic');
  }, []);

  const handleEditComposition = useCallback((style) => {
    setEditingStyle(style);
    setEditingType('composition');
  }, []);

  const handleAddArtistic = useCallback(() => {
    setEditingStyle({});
    setEditingType('artistic');
  }, []);

  const handleAddComposition = useCallback(() => {
    setEditingStyle({});
    setEditingType('composition');
  }, []);

  const handleEditNarrative = useCallback((style) => {
    setEditingStyle(style);
    setEditingType('narrative');
  }, []);

  const handleAddNarrative = useCallback(() => {
    setEditingStyle({});
    setEditingType('narrative');
  }, []);

  const handleSaveStyle = useCallback(async (styleData, isNew) => {
    if (editingType === 'artistic') {
      if (isNew) {
        await onAddArtisticStyle(styleData);
      } else {
        await onUpdateArtisticStyle(styleData.id, styleData);
      }
    } else if (editingType === 'composition') {
      if (isNew) {
        await onAddCompositionStyle(styleData);
      } else {
        await onUpdateCompositionStyle(styleData.id, styleData);
      }
    } else if (editingType === 'narrative') {
      if (isNew) {
        await onAddNarrativeStyle(styleData);
      } else {
        await onUpdateNarrativeStyle(styleData.id, styleData);
      }
    }
    setEditingStyle(null);
    setEditingType(null);
  }, [editingType, onAddArtisticStyle, onUpdateArtisticStyle, onAddCompositionStyle, onUpdateCompositionStyle, onAddNarrativeStyle, onUpdateNarrativeStyle]);

  const handleDeleteArtistic = useCallback(async (id) => {
    if (window.confirm('Delete this artistic style?')) {
      await onDeleteArtisticStyle(id);
    }
  }, [onDeleteArtisticStyle]);

  const handleDeleteComposition = useCallback(async (id) => {
    if (window.confirm('Delete this composition style?')) {
      await onDeleteCompositionStyle(id);
    }
  }, [onDeleteCompositionStyle]);

  const handleDeleteNarrative = useCallback(async (id) => {
    if (window.confirm('Delete this narrative style?')) {
      await onDeleteNarrativeStyle(id);
    }
  }, [onDeleteNarrativeStyle]);

  const handleReset = useCallback(async () => {
    await onReset();
    setConfirmReset(false);
  }, [onReset]);

  const handleCloseModal = useCallback(() => {
    setEditingStyle(null);
    setEditingType(null);
  }, []);

  if (loading) {
    return (
      <div className="illuminator-card">
        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading style library...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Status bar */}
      <div className="illuminator-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 500 }}>Style Library</span>
            <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              {isCustom ? '(customized)' : '(defaults)'}
            </span>
          </div>
          <div>
            {isCustom && !confirmReset && (
              <button
                onClick={() => setConfirmReset(true)}
                className="illuminator-btn"
                style={{ fontSize: '12px' }}
              >
                Reset to Defaults
              </button>
            )}
            {confirmReset && (
              <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Reset all styles?</span>
                <button onClick={handleReset} className="illuminator-btn illuminator-btn-danger" style={{ fontSize: '12px' }}>
                  Yes, Reset
                </button>
                <button onClick={() => setConfirmReset(false)} className="illuminator-btn" style={{ fontSize: '12px' }}>
                  Cancel
                </button>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Artistic Styles */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">
            Artistic Styles
            <span style={{ fontWeight: 400, fontSize: '14px', color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({styleLibrary.artisticStyles.length})
            </span>
          </h2>
          <button onClick={handleAddArtistic} className="illuminator-btn illuminator-btn-primary" style={{ fontSize: '12px' }}>
            + Add Style
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Artistic styles define the visual rendering approach (e.g., oil painting, watercolor, digital art).
        </p>

        <div className="illuminator-style-grid">
          {styleLibrary.artisticStyles.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              type="artistic"
              onEdit={handleEditArtistic}
              onDelete={handleDeleteArtistic}
            />
          ))}
        </div>

        {styleLibrary.artisticStyles.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
            No artistic styles defined. Add one to get started.
          </p>
        )}
      </div>

      {/* Composition Styles */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">
            Composition Styles
            <span style={{ fontWeight: 400, fontSize: '14px', color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({styleLibrary.compositionStyles.length})
            </span>
          </h2>
          <button onClick={handleAddComposition} className="illuminator-btn illuminator-btn-primary" style={{ fontSize: '12px' }}>
            + Add Style
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Composition styles define framing and visual arrangement (e.g., portrait, establishing shot, action scene).
        </p>

        <div className="illuminator-style-grid">
          {styleLibrary.compositionStyles.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              type="composition"
              onEdit={handleEditComposition}
              onDelete={handleDeleteComposition}
            />
          ))}
        </div>

        {styleLibrary.compositionStyles.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
            No composition styles defined. Add one to get started.
          </p>
        )}
      </div>

      {/* Narrative Styles */}
      <div className="illuminator-card">
        <div className="illuminator-card-header">
          <h2 className="illuminator-card-title">
            Narrative Styles
            <span style={{ fontWeight: 400, fontSize: '14px', color: 'var(--text-muted)', marginLeft: '8px' }}>
              ({styleLibrary.narrativeStyles.length})
            </span>
          </h2>
          <button onClick={handleAddNarrative} className="illuminator-btn illuminator-btn-primary" style={{ fontSize: '12px' }}>
            + Add Style
          </button>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Narrative styles define story structure, character selection, and prose tone for chronicle generation.
        </p>

        <div className="illuminator-style-grid">
          {styleLibrary.narrativeStyles.map((style) => (
            <NarrativeStyleCard
              key={style.id}
              style={style}
              onEdit={handleEditNarrative}
              onDelete={handleDeleteNarrative}
            />
          ))}
        </div>

        {styleLibrary.narrativeStyles.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
            No narrative styles defined. Add one to get started.
          </p>
        )}
      </div>

      {/* Edit Modal for Artistic/Composition */}
      {editingStyle && (editingType === 'artistic' || editingType === 'composition') && (
        <StyleEditModal
          style={editingStyle}
          type={editingType}
          onSave={handleSaveStyle}
          onCancel={handleCloseModal}
        />
      )}

      {/* Edit Modal for Narrative */}
      {editingStyle && editingType === 'narrative' && (
        <NarrativeStyleEditModal
          style={editingStyle}
          onSave={handleSaveStyle}
          onCancel={handleCloseModal}
        />
      )}
    </div>
  );
}
