import { useState, useEffect, useRef } from 'react';

const API_URL = 'http://localhost:3001';

// ============================================
// Accordion Component - Collapsible sections
// ============================================
function Accordion({ title, badge, badgeColor, defaultOpen = false, children, headerRight }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={{
      borderRadius: '6px',
      overflow: 'hidden',
      marginBottom: '0.5rem'
    }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: 'rgba(30, 58, 95, 0.4)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: isOpen ? '6px 6px 0 0' : '6px',
          cursor: 'pointer',
          color: 'var(--text-color)',
          textAlign: 'left',
          fontSize: '0.95rem',
          fontWeight: 500
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            display: 'inline-block',
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            fontSize: '0.75rem'
          }}>▶</span>
          <span>{title}</span>
          {badge && (
            <span style={{
              background: badgeColor || 'rgba(212, 175, 55, 0.3)',
              padding: '0.15rem 0.5rem',
              borderRadius: '10px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: 'var(--gold-accent)'
            }}>{badge}</span>
          )}
        </div>
        {headerRight}
      </button>
      {isOpen && (
        <div style={{
          padding: '1rem',
          background: 'rgba(20, 45, 75, 0.3)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderTop: 'none',
          borderRadius: '0 0 6px 6px'
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================
// Modal Component - Generic modal wrapper
// ============================================
function Modal({ isOpen, onClose, title, children, width = '500px' }) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1a2a3a',
          border: '1px solid #3b5068',
          borderRadius: '8px',
          width,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid #3b5068',
          background: '#1e3a5f'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-color)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1
            }}
          >×</button>
        </div>
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, background: '#1a2a3a' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================
// ConditionsModal - Edit strategy conditions
// ============================================
function ConditionsModal({ isOpen, onClose, conditions, onChange }) {
  const [localConditions, setLocalConditions] = useState(conditions || {});

  useEffect(() => {
    setLocalConditions(conditions || {});
  }, [conditions, isOpen]);

  const handleSave = () => {
    // Clean up empty values
    const cleaned = {};
    if (localConditions.tags?.length > 0) cleaned.tags = localConditions.tags;
    if (localConditions.requireAllTags) cleaned.requireAllTags = true;
    if (localConditions.prominence?.length > 0) cleaned.prominence = localConditions.prominence;
    if (localConditions.subtype?.length > 0) cleaned.subtype = localConditions.subtype;

    onChange(Object.keys(cleaned).length > 0 ? cleaned : undefined);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Strategy Conditions" width="480px">
      <p className="text-muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
        Define when this strategy should be used. Leave empty for unconditional use.
      </p>

      {/* Tags */}
      <div className="form-group">
        <label>Entity Tags</label>
        <input
          value={(localConditions.tags || []).join(', ')}
          onChange={(e) => {
            const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
            setLocalConditions({ ...localConditions, tags: tags.length > 0 ? tags : undefined });
          }}
          placeholder="e.g., royal, noble, legendary"
        />
        <small className="text-muted">Comma-separated list of tags to match</small>
        <div style={{ marginTop: '0.5rem' }}>
          <label style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={localConditions.requireAllTags || false}
              onChange={(e) => setLocalConditions({
                ...localConditions,
                requireAllTags: e.target.checked || undefined
              })}
            />
            Require ALL tags (default: match any tag)
          </label>
        </div>
      </div>

      {/* Prominence */}
      <div className="form-group">
        <label>Prominence Levels</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
          {['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'].map(level => {
            const isSelected = (localConditions.prominence || []).includes(level);
            return (
              <button
                key={level}
                type="button"
                onClick={() => {
                  const current = localConditions.prominence || [];
                  const updated = isSelected
                    ? current.filter(l => l !== level)
                    : [...current, level];
                  setLocalConditions({
                    ...localConditions,
                    prominence: updated.length > 0 ? updated : undefined
                  });
                }}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.85rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: isSelected ? 'var(--gold-accent)' : 'var(--border-color)',
                  background: isSelected ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                  color: isSelected ? 'var(--gold-accent)' : 'var(--text-color)',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {level}
              </button>
            );
          })}
        </div>
        <small className="text-muted" style={{ marginTop: '0.5rem', display: 'block' }}>
          Only use this strategy for entities with selected prominence levels
        </small>
      </div>

      {/* Subtype */}
      <div className="form-group">
        <label>Entity Subtypes</label>
        <input
          value={(localConditions.subtype || []).join(', ')}
          onChange={(e) => {
            const subtypes = e.target.value.split(',').map(t => t.trim()).filter(t => t);
            setLocalConditions({ ...localConditions, subtype: subtypes.length > 0 ? subtypes : undefined });
          }}
          placeholder="e.g., merchant, artisan, warrior"
        />
        <small className="text-muted">Comma-separated list of subtypes to match</small>
      </div>

      {/* Summary */}
      {(localConditions.tags?.length > 0 || localConditions.prominence?.length > 0 || localConditions.subtype?.length > 0) && (
        <div style={{
          background: 'rgba(212, 175, 55, 0.1)',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          borderRadius: '6px',
          padding: '0.75rem',
          marginTop: '1rem',
          fontSize: '0.875rem'
        }}>
          <strong style={{ color: 'var(--gold-accent)' }}>Preview:</strong> This strategy will be used when entity has{' '}
          {[
            localConditions.tags?.length > 0 && `${localConditions.requireAllTags ? 'ALL' : 'any'} tags: ${localConditions.tags.join(', ')}`,
            localConditions.prominence?.length > 0 && `prominence: ${localConditions.prominence.join(' or ')}`,
            localConditions.subtype?.length > 0 && `subtype: ${localConditions.subtype.join(' or ')}`
          ].filter(Boolean).join(' AND ')}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
        <button className="secondary" onClick={onClose}>Cancel</button>
        <button className="primary" onClick={handleSave}>Save Conditions</button>
      </div>
    </Modal>
  );
}

function EntityWorkspace({
  metaDomain,
  worldSchema,
  cultureId,
  entityKind,
  entityConfig,
  cultureConfig,
  allCultures,
  activeTab = 'domain',
  onTabChange,
  onConfigChange
}) {
  const [error, setError] = useState(null);

  // Use prop or fallback to local handling
  const setActiveTab = onTabChange || (() => {});
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error'
  const saveTimeoutRef = useRef(null);
  const lastSavedConfigRef = useRef(null);
  const isInitialMount = useRef(true);

  // Autosave effect - debounced save when entityConfig changes
  useEffect(() => {
    // Skip if no valid selection
    if (!cultureId || !entityKind || !entityConfig) return;

    // Skip initial mount to avoid saving on load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedConfigRef.current = JSON.stringify(entityConfig);
      return;
    }

    // Check if config actually changed
    const configStr = JSON.stringify(entityConfig);
    if (configStr === lastSavedConfigRef.current) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounced save after 1.5 seconds of no changes
    saveTimeoutRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const response = await fetch(
          `${API_URL}/api/v2/entity-config/${metaDomain}/${cultureId}/${entityKind}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: entityConfig })
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to save');
        }

        lastSavedConfigRef.current = configStr;
        setSaveStatus('saved');
        console.log(`✅ Autosaved ${entityKind} config for ${cultureId}`);

        // Clear "saved" status after 2 seconds
        setTimeout(() => setSaveStatus(null), 2000);
      } catch (err) {
        setSaveStatus('error');
        setError(err.message);
      }
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [entityConfig, cultureId, entityKind, metaDomain]);

  // Reset initial mount flag when culture/entity changes
  useEffect(() => {
    isInitialMount.current = true;
    lastSavedConfigRef.current = null;
    setSaveStatus(null);
  }, [cultureId, entityKind]);

  if (!cultureId || !entityKind) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        <p>Select a culture and entity type from the sidebar to begin</p>
      </div>
    );
  }

  const handleAutoGenerateProfile = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/v2/auto-profile/${metaDomain}/${cultureId}/${entityKind}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: entityConfig,
            cultureDomains: cultureConfig?.domains || []  // Pass culture-level domains
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate profile');
      }

      const data = await response.json();

      // Update entity config with new profile
      const updatedConfig = {
        ...entityConfig,
        profile: data.profile,
        completionStatus: {
          ...entityConfig.completionStatus,
          profile: true
        }
      };

      onConfigChange(updatedConfig);

      console.log(`✅ Auto-generated profile for ${cultureId}:${entityKind}`);
    } catch (err) {
      setError(err.message);
    }
  };

  // Check if culture has any domains (domains are now culture-level)
  const hasCultureDomains = () => {
    return (cultureConfig?.domains?.length || 0) > 0;
  };

  const getCompletionBadge = (key) => {
    // Compute status directly from data rather than stored completionStatus
    if (key === 'domain') {
      // Domains are now at culture level
      return hasCultureDomains() ? `✅ (${cultureConfig.domains.length})` : '⭕';
    } else if (key === 'lexemes') {
      const count = Object.keys(entityConfig?.lexemeLists || {}).length;
      return count > 0 ? `✅ (${count})` : '⭕';
    } else if (key === 'grammars') {
      const count = (entityConfig?.grammars || []).length;
      return count > 0 ? `✅ (${count})` : '⭕';
    } else if (key === 'profile') {
      return entityConfig?.profile ? '✅' : '⭕';
    }

    return '⭕';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--border-color)',
        padding: '1rem 1.5rem',
        background: 'rgba(30, 58, 95, 0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, marginBottom: '0.25rem' }}>
              <span style={{ textTransform: 'capitalize', color: 'var(--gold-accent)' }}>
                {cultureId}
              </span>
              {' '}/{' '}
              <span style={{ textTransform: 'capitalize' }}>
                {entityKind}
              </span>
            </h2>
            <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)' }}>
              Configure naming components for this entity type
            </div>
          </div>

          {/* Autosave status indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.875rem',
            color: saveStatus === 'error' ? 'var(--error-color)' : 'var(--arctic-frost)'
          }}>
            {saveStatus === 'saving' && (
              <>
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--gold-accent)',
                  animation: 'pulse 1s infinite'
                }} />
                Saving...
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <span style={{ color: '#22c55e' }}>✓</span>
                Saved
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <span style={{ color: 'var(--error-color)' }}>✗</span>
                Save failed
              </>
            )}
            {!saveStatus && (
              <span style={{ opacity: 0.6 }}>Autosave enabled</span>
            )}
          </div>
        </div>

        {error && (
          <div className="error" style={{ marginTop: '1rem' }}>
            {error}
            <button
              onClick={() => setError(null)}
              style={{ marginLeft: '1rem', padding: '0.25rem 0.5rem' }}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        borderBottom: '1px solid var(--border-color)',
        padding: '0 1.5rem',
        background: 'rgba(30, 58, 95, 0.1)',
        display: 'flex',
        gap: '0.5rem'
      }}>
        {['domain', 'lexemes', 'grammars', 'profile'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: activeTab === tab ? 'var(--card-bg)' : 'transparent',
              color: activeTab === tab ? 'var(--gold-accent)' : 'var(--text-color)',
              borderBottom: activeTab === tab ? '2px solid var(--gold-accent)' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              textTransform: 'capitalize',
              transition: 'all 0.2s'
            }}
          >
            {tab} {getCompletionBadge(tab)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        {activeTab === 'domain' && (
          <DomainTab
            metaDomain={metaDomain}
            cultureId={cultureId}
            entityKind={entityKind}
            entityConfig={entityConfig}
            onConfigChange={onConfigChange}
            worldSchema={worldSchema}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
          />
        )}

        {activeTab === 'lexemes' && (
          <LexemesTab
            metaDomain={metaDomain}
            cultureId={cultureId}
            entityKind={entityKind}
            entityConfig={entityConfig}
            onConfigChange={onConfigChange}
            worldSchema={worldSchema}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
          />
        )}

        {activeTab === 'grammars' && (
          <GrammarsTab
            entityConfig={entityConfig}
            onConfigChange={onConfigChange}
            cultureId={cultureId}
            entityKind={entityKind}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
            worldSchema={worldSchema}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileTab
            cultureId={cultureId}
            entityKind={entityKind}
            entityConfig={entityConfig}
            onConfigChange={onConfigChange}
            onAutoGenerate={handleAutoGenerateProfile}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
          />
        )}
      </div>
    </div>
  );
}

// Domain Tab Component
function DomainTab({ metaDomain, cultureId, entityKind, entityConfig, onConfigChange, worldSchema, cultureConfig, allCultures }) {
  const [editing, setEditing] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1); // -1 = new domain, >= 0 = editing existing
  const [expandedSections, setExpandedSections] = useState({
    phonology: true,
    morphology: false,
    style: false
  });

  // Culture-level domains (new structure)
  const cultureDomains = cultureConfig?.domains || [];

  // Collect ALL domains from ALL cultures for "copy from other cultures" feature
  const allDomains = [];
  if (allCultures) {
    Object.entries(allCultures).forEach(([cultId, cultConfig]) => {
      if (cultConfig?.domains) {
        cultConfig.domains.forEach((domain) => {
          allDomains.push({
            ...domain,
            sourceCulture: cultId
          });
        });
      }
    });
  }

  const defaultDomain = {
    id: `${cultureId}_domain_${cultureDomains.length + 1}`,
    cultureId: cultureId,
    phonology: {
      consonants: [], vowels: [], syllableTemplates: ['CV', 'CVC'], lengthRange: [2, 4],
      favoredClusters: [], forbiddenClusters: [], favoredClusterBoost: 1.0
    },
    morphology: { prefixes: [], suffixes: [], structure: ['root', 'root-suffix'], structureWeights: [0.5, 0.5] },
    style: {
      capitalization: 'title', apostropheRate: 0, hyphenRate: 0,
      preferredEndings: [], preferredEndingBoost: 1.0, rhythmBias: 'neutral'
    }
  };

  const [formData, setFormData] = useState(defaultDomain);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({...prev, [section]: !prev[section]}));
  };

  // Save domain to culture-level domains array
  const handleSave = async () => {
    let newDomains;
    if (editingIndex >= 0) {
      // Update existing domain
      newDomains = [...cultureDomains];
      newDomains[editingIndex] = formData;
    } else {
      // Add new domain
      newDomains = [...cultureDomains, formData];
    }

    // Save via API
    try {
      const response = await fetch(
        `${API_URL}/api/v2/cultures/${metaDomain}/${cultureId}/domains`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domains: newDomains })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save domains');
      }

      // Update local state via parent callback
      // Note: Parent needs to reload culture to get updated domains
      if (onConfigChange && cultureConfig) {
        // Trigger a refresh - this is a bit hacky, parent should handle domain updates
        console.log(`✅ Saved ${newDomains.length} domains for culture '${cultureId}'`);
      }

      setEditing(false);
      setEditingIndex(-1);

      // Force page refresh to reload culture data
      window.location.reload();
    } catch (err) {
      console.error('Save domains error:', err);
      alert(`Failed to save: ${err.message}`);
    }
  };

  const handleCreateNew = () => {
    setFormData({
      ...defaultDomain,
      id: `${cultureId}_domain_${cultureDomains.length + 1}`
    });
    setEditingIndex(-1);
    setEditing(true);
  };

  const handleEditDomain = (domain, index) => {
    setFormData({ ...domain });
    setEditingIndex(index);
    setEditing(true);
  };

  const handleDeleteDomain = async (index) => {
    if (!window.confirm('Delete this domain? This cannot be undone.')) return;

    const newDomains = cultureDomains.filter((_, i) => i !== index);

    try {
      const response = await fetch(
        `${API_URL}/api/v2/cultures/${metaDomain}/${cultureId}/domains`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domains: newDomains })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete domain');
      }

      // Force page refresh to reload culture data
      window.location.reload();
    } catch (err) {
      console.error('Delete domain error:', err);
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleCopyDomain = (domain) => {
    // Create a copy with new ID
    setFormData({
      ...domain,
      id: `${domain.id}_copy`
    });
    setEditingIndex(-1);
    setEditing(true);
  };

  // View mode - show list of culture-level domains
  if (!editing && cultureDomains.length > 0) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Phonological Domains ({cultureDomains.length})</h3>
          <button className="primary" onClick={handleCreateNew}>
            + Add Domain
          </button>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
          Domains define the sound patterns for <strong>{cultureId}</strong> names.
          Reference them in grammars using <code>domain:domain_id</code>.
          Use the <strong>Optimizer</strong> tab to tune domain parameters.
        </p>

        {/* Domain List */}
        <div style={{ display: 'grid', gap: '1rem' }}>
          {cultureDomains.map((domain, index) => (
            <div
              key={domain.id}
              style={{
                background: 'rgba(30, 58, 95, 0.3)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '6px',
                padding: '1rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <strong style={{ color: 'rgb(134, 239, 172)' }}>{domain.id}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                    Use in grammars: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>domain:{domain.id}</code>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => handleCopyDomain(domain)}>
                    📋
                  </button>
                  <button className="secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => handleEditDomain(domain, index)}>
                    ✏️
                  </button>
                  <button className="secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#ef4444' }} onClick={() => handleDeleteDomain(index)}>
                    🗑️
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', fontSize: '0.8rem' }}>
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Phonology</div>
                  <div style={{ color: 'var(--arctic-frost)' }}>
                    <div>C: {domain.phonology?.consonants?.slice(0, 5).join(' ') || 'None'}{domain.phonology?.consonants?.length > 5 ? '...' : ''}</div>
                    <div>V: {domain.phonology?.vowels?.join(' ') || 'None'}</div>
                    <div>Syl: {domain.phonology?.syllableTemplates?.join(', ') || 'CV, CVC'}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Morphology</div>
                  <div style={{ color: 'var(--arctic-frost)' }}>
                    <div>Pre: {domain.morphology?.prefixes?.slice(0, 3).join(', ') || 'None'}</div>
                    <div>Suf: {domain.morphology?.suffixes?.slice(0, 3).join(', ') || 'None'}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Style</div>
                  <div style={{ color: 'var(--arctic-frost)' }}>
                    <div>Cap: {domain.style?.capitalization || 'title'}</div>
                    <div>Rhythm: {domain.style?.rhythmBias || 'neutral'}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // No domains yet - show create prompt
  if (!editing && cultureDomains.length === 0) {
    return (
      <div>
        <h3>Phonological Domains</h3>
        <p className="text-muted">
          Define the sound patterns and morphology for <strong>{cultureId}</strong> names.
        </p>

        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '6px',
          padding: '1.5rem',
          textAlign: 'center',
          marginTop: '1rem'
        }}>
          <p style={{ margin: '0 0 1rem 0' }}>
            No domains configured for this culture yet.
          </p>
          <button className="primary" onClick={handleCreateNew}>
            + Create First Domain
          </button>
        </div>

        {/* Show domains from other cultures as inspiration */}
        {allDomains.filter(d => d.sourceCulture !== cultureId).length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Copy from other cultures</h4>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {allDomains.filter(d => d.sourceCulture !== cultureId).slice(0, 5).map((domain) => (
                <div
                  key={`${domain.sourceCulture}_${domain.id}`}
                  style={{
                    background: 'rgba(30, 58, 95, 0.3)',
                    padding: '0.75rem 1rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <strong>{domain.id}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)' }}>
                      From culture: {domain.sourceCulture}
                    </div>
                  </div>
                  <button
                    className="secondary"
                    style={{ fontSize: '0.875rem' }}
                    onClick={() => handleCopyDomain(domain)}
                  >
                    Copy & Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Editing mode - full form
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>{editingIndex >= 0 ? 'Edit Domain' : 'Create Domain'}</h3>
        <button className="secondary" onClick={() => { setEditing(false); setEditingIndex(-1); }}>
          Cancel
        </button>
      </div>

      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label>Domain ID</label>
        <input
          value={formData.id}
          onChange={(e) => setFormData({...formData, id: e.target.value})}
          placeholder={`${cultureId}_domain`}
        />
        <small className="text-muted">Unique identifier for this domain. Use in grammars as <code>domain:{formData.id || 'domain_id'}</code></small>
      </div>

      {/* Phonology Section */}
      <div className="collapsible-section">
        <div className="collapsible-header" onClick={() => toggleSection('phonology')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(30, 58, 95, 0.3)', borderRadius: '6px', marginBottom: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Phonology</h4>
          <span>{expandedSections.phonology ? '▼' : '▶'}</span>
        </div>
        {expandedSections.phonology && (
          <div style={{ padding: '1rem', background: 'rgba(30, 58, 95, 0.1)', borderRadius: '6px', marginBottom: '1rem' }}>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Consonants (space-separated)</label>
                <input
                  defaultValue={formData.phonology?.consonants?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    phonology: {...formData.phonology, consonants: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="l r th f n m v s"
                />
              </div>
              <div className="form-group">
                <label>Vowels (space-separated)</label>
                <input
                  defaultValue={formData.phonology?.vowels?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    phonology: {...formData.phonology, vowels: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="a e i o u ae"
                />
              </div>
              <div className="form-group">
                <label>Syllable Templates</label>
                <input
                  defaultValue={formData.phonology?.syllableTemplates?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    phonology: {...formData.phonology, syllableTemplates: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="CV CVC CVV"
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Min Length</label>
                  <input
                    type="number"
                    value={formData.phonology?.lengthRange?.[0] || 2}
                    onChange={(e) => setFormData({
                      ...formData,
                      phonology: {...formData.phonology, lengthRange: [parseInt(e.target.value) || 2, formData.phonology?.lengthRange?.[1] || 4]}
                    })}
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Max Length</label>
                  <input
                    type="number"
                    value={formData.phonology?.lengthRange?.[1] || 4}
                    onChange={(e) => setFormData({
                      ...formData,
                      phonology: {...formData.phonology, lengthRange: [formData.phonology?.lengthRange?.[0] || 2, parseInt(e.target.value) || 4]}
                    })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Favored Clusters (optional)</label>
                <input
                  defaultValue={formData.phonology?.favoredClusters?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    phonology: {...formData.phonology, favoredClusters: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="th ae gr"
                />
              </div>
              <div className="form-group">
                <label>Forbidden Clusters (optional)</label>
                <input
                  defaultValue={formData.phonology?.forbiddenClusters?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    phonology: {...formData.phonology, forbiddenClusters: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="ii uu xx"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Morphology Section */}
      <div className="collapsible-section">
        <div className="collapsible-header" onClick={() => toggleSection('morphology')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(30, 58, 95, 0.3)', borderRadius: '6px', marginBottom: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Morphology</h4>
          <span>{expandedSections.morphology ? '▼' : '▶'}</span>
        </div>
        {expandedSections.morphology && (
          <div style={{ padding: '1rem', background: 'rgba(30, 58, 95, 0.1)', borderRadius: '6px', marginBottom: '1rem' }}>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Prefixes (space-separated)</label>
                <input
                  defaultValue={formData.morphology?.prefixes?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    morphology: {...formData.morphology, prefixes: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="Ael Ith Vor"
                />
              </div>
              <div className="form-group">
                <label>Suffixes (space-separated)</label>
                <input
                  defaultValue={formData.morphology?.suffixes?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    morphology: {...formData.morphology, suffixes: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="riel ion aen"
                />
              </div>
              <div className="form-group">
                <label>Structure (comma-separated)</label>
                <input
                  defaultValue={formData.morphology?.structure?.join(', ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    morphology: {...formData.morphology, structure: e.target.value.split(',').map(s => s.trim()).filter(s => s)}
                  })}
                  placeholder="root, root-suffix, prefix-root"
                />
              </div>
              <div className="form-group">
                <label>Structure Weights (comma-separated)</label>
                <input
                  defaultValue={formData.morphology?.structureWeights?.join(', ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    morphology: {...formData.morphology, structureWeights: e.target.value.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))}
                  })}
                  placeholder="0.5, 0.3, 0.2"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Style Section */}
      <div className="collapsible-section">
        <div className="collapsible-header" onClick={() => toggleSection('style')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(30, 58, 95, 0.3)', borderRadius: '6px', marginBottom: '0.5rem' }}>
          <h4 style={{ margin: 0 }}>Style</h4>
          <span>{expandedSections.style ? '▼' : '▶'}</span>
        </div>
        {expandedSections.style && (
          <div style={{ padding: '1rem', background: 'rgba(30, 58, 95, 0.1)', borderRadius: '6px', marginBottom: '1rem' }}>
            <div className="form-grid-3">
              <div className="form-group">
                <label>Capitalization</label>
                <select
                  value={formData.style?.capitalization || 'title'}
                  onChange={(e) => setFormData({
                    ...formData,
                    style: {...formData.style, capitalization: e.target.value}
                  })}
                >
                  <option value="title">Title Case</option>
                  <option value="lower">lowercase</option>
                  <option value="upper">UPPERCASE</option>
                  <option value="mixed">MiXeD</option>
                </select>
              </div>
              <div className="form-group">
                <label>Rhythm Bias</label>
                <select
                  value={formData.style?.rhythmBias || 'neutral'}
                  onChange={(e) => setFormData({
                    ...formData,
                    style: {...formData.style, rhythmBias: e.target.value}
                  })}
                >
                  <option value="neutral">Neutral</option>
                  <option value="flowing">Flowing</option>
                  <option value="harsh">Harsh</option>
                  <option value="staccato">Staccato</option>
                </select>
              </div>
              <div className="form-group">
                <label>Apostrophe Rate</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={formData.style?.apostropheRate || 0}
                  onChange={(e) => setFormData({
                    ...formData,
                    style: {...formData.style, apostropheRate: parseFloat(e.target.value) || 0}
                  })}
                />
              </div>
              <div className="form-group">
                <label>Hyphen Rate</label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={formData.style?.hyphenRate || 0}
                  onChange={(e) => setFormData({
                    ...formData,
                    style: {...formData.style, hyphenRate: parseFloat(e.target.value) || 0}
                  })}
                />
              </div>
              <div className="form-group">
                <label>Preferred Endings</label>
                <input
                  defaultValue={formData.style?.preferredEndings?.join(' ') || ''}
                  onBlur={(e) => setFormData({
                    ...formData,
                    style: {...formData.style, preferredEndings: e.target.value.split(/\s+/).filter(s => s)}
                  })}
                  placeholder="iel ion riel"
                />
              </div>
              <div className="form-group">
                <label>Ending Boost</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.style?.preferredEndingBoost || 1.0}
                  onChange={(e) => setFormData({
                    ...formData,
                    style: {...formData.style, preferredEndingBoost: parseFloat(e.target.value) || 1.0}
                  })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <button className="primary" onClick={handleSave}>Save Domain</button>
        <button className="secondary" onClick={() => { setEditing(false); setEditingIndex(-1); }}>Cancel</button>
      </div>
    </div>
  );
}

// Lexemes Tab Component
const POS_TAGS = ['noun', 'verb_3sg', 'adj', 'noun_abstract', 'prep', 'ordinal'];

function LexemesTab({ metaDomain, cultureId, entityKind, entityConfig, onConfigChange, worldSchema, cultureConfig, allCultures }) {
  const [mode, setMode] = useState('view'); // 'view', 'create-spec', 'create-manual', 'generate'
  const [selectedList, setSelectedList] = useState(null);
  const [selectedListSource, setSelectedListSource] = useState(null); // { cultureId, entityKind } or null for local
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState('');

  // Get all cultures and entity kinds for sharing options
  const allCultureIds = Object.keys(allCultures || {});
  const allEntityKinds = worldSchema?.hardState?.map(e => e.kind) || [];

  // Form state for spec creation
  const [specForm, setSpecForm] = useState({
    id: `${cultureId}_${entityKind}_nouns`,
    pos: 'noun',
    style: '',
    targetCount: 30,
    qualityFilter: { minLength: 3, maxLength: 15 },
    appliesTo: {
      cultures: [cultureId],
      entityKinds: [entityKind]
    }
  });

  // Form state for manual list creation
  const [manualForm, setManualForm] = useState({
    id: `${cultureId}_${entityKind}_manual`,
    description: '',
    entries: '',
    appliesTo: {
      cultures: [cultureId],
      entityKinds: [entityKind]
    }
  });

  // Get entity subtypes from schema for style hints
  const entitySchema = worldSchema?.hardState?.find(e => e.kind === entityKind);
  const subtypes = entitySchema?.subtype || [];

  // Get existing lexeme lists from entity config
  const lexemeLists = entityConfig?.lexemeLists || {};
  const lexemeSpecs = entityConfig?.lexemeSpecs || [];

  // Get domains from culture level (domains are now culture-level, not entity-level)
  const getCultureDomains = () => {
    return cultureConfig?.domains || [];
  };
  const cultureDomains = getCultureDomains();
  // For backward compatibility, effectiveDomain returns first culture domain
  const getEffectiveDomain = () => {
    // Domains are now at culture level
    if (cultureConfig?.domains && cultureConfig.domains.length > 0) {
      return cultureConfig.domains[0];
    }
    // Legacy: check if old entity-level domains exist
    if (entityConfig?.domain) return entityConfig.domain;
    if (cultureConfig?.entityConfigs) {
      for (const [kind, config] of Object.entries(cultureConfig.entityConfigs)) {
        if (config?.domain) {
          const appliesTo = config.domain.appliesTo?.kind || [];
          if (appliesTo.includes(entityKind)) return config.domain;
        }
      }
    }
    return null;
  };
  const effectiveDomain = getEffectiveDomain();

  // Find shared lexeme lists from other cultures/entity types
  const getSharedLists = () => {
    const shared = [];

    // Helper to check if list applies to current culture/entity
    const listAppliesHere = (list) => {
      const appliesTo = list.appliesTo || {};
      const cultures = appliesTo.cultures || [];
      const entityKinds = appliesTo.entityKinds || [];

      // Check culture match (empty array or '*' means all)
      const cultureMatch = cultures.length === 0 ||
        cultures.includes('*') ||
        cultures.includes(cultureId);

      // Check entity kind match
      const entityMatch = entityKinds.length === 0 ||
        entityKinds.includes('*') ||
        entityKinds.includes(entityKind);

      return cultureMatch && entityMatch;
    };

    // Search all cultures and their entity configs
    if (allCultures) {
      Object.entries(allCultures).forEach(([cultId, cultConfig]) => {
        if (cultConfig?.entityConfigs) {
          Object.entries(cultConfig.entityConfigs).forEach(([entKind, entConfig]) => {
            // Skip current culture/entity - those are local, not shared
            if (cultId === cultureId && entKind === entityKind) return;

            const lists = entConfig?.lexemeLists || {};
            Object.entries(lists).forEach(([listId, list]) => {
              if (listAppliesHere(list)) {
                shared.push({
                  ...list,
                  id: listId,
                  sourceCulture: cultId,
                  sourceEntity: entKind,
                  isShared: true
                });
              }
            });
          });
        }
      });
    }

    return shared;
  };

  const sharedLists = getSharedLists();

  const handleSaveSpec = () => {
    const newSpec = {
      ...specForm,
      cultureId,
      entityKind
    };

    const updatedSpecs = [...lexemeSpecs.filter(s => s.id !== newSpec.id), newSpec];
    const updatedConfig = {
      ...entityConfig,
      lexemeSpecs: updatedSpecs
    };
    onConfigChange(updatedConfig);
    setMode('view');
    setSpecForm({
      id: `${cultureId}_${entityKind}_nouns`,
      pos: 'noun',
      style: '',
      targetCount: 30,
      qualityFilter: { minLength: 3, maxLength: 15 }
    });
  };

  const handleDeleteSpec = (specId) => {
    const updatedSpecs = lexemeSpecs.filter(s => s.id !== specId);
    const updatedConfig = {
      ...entityConfig,
      lexemeSpecs: updatedSpecs
    };
    onConfigChange(updatedConfig);
  };

  const handleSaveManualList = async () => {
    if (!manualForm.id.trim()) {
      setError('Please enter a list ID');
      return;
    }

    const entries = manualForm.entries
      .split(/[\n,]/)
      .map(e => e.trim())
      .filter(e => e);

    if (entries.length === 0) {
      setError('Please enter at least one entry');
      return;
    }

    const newList = {
      id: manualForm.id,
      description: manualForm.description || 'Manual list',
      entries: entries,
      source: 'manual',
      appliesTo: manualForm.appliesTo
    };

    const updatedLists = {
      ...lexemeLists,
      [manualForm.id]: newList
    };

    const updatedConfig = {
      ...entityConfig,
      lexemeLists: updatedLists,
      completionStatus: {
        ...entityConfig?.completionStatus,
        lexemes: Object.keys(updatedLists).length
      }
    };

    onConfigChange(updatedConfig);
    setMode('view');
    setManualForm({
      id: `${cultureId}_${entityKind}_manual`,
      description: '',
      entries: '',
      appliesTo: {
        cultures: [cultureId],
        entityKinds: [entityKind]
      }
    });
    setError(null);
  };

  const handleGenerate = async (spec) => {
    setLoading(true);
    setError(null);

    try {
      const requestBody = {
        spec: {
          ...spec,
          cultureId,
          domain: effectiveDomain
        },
        metaDomain: metaDomain
      };

      // Only include apiKey if user provided one (otherwise server uses env var)
      if (apiKey && apiKey.trim()) {
        requestBody.apiKey = apiKey.trim();
      }

      console.log('[LexemesTab] Generate request:', {
        specId: spec.id,
        hasApiKey: !!requestBody.apiKey,
        metaDomain
      });

      const response = await fetch(`${API_URL}/api/generate/lexeme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const data = await response.json();

      const newList = {
        id: spec.id,
        description: `Generated ${spec.pos} list: ${spec.style}`,
        entries: data.result.entries,
        source: 'llm',
        filtered: data.result.filtered,
        tokensUsed: data.result.tokensUsed,
        appliesTo: spec.appliesTo || { cultures: [cultureId], entityKinds: [entityKind] }
      };

      const updatedLists = {
        ...lexemeLists,
        [spec.id]: newList
      };

      const updatedConfig = {
        ...entityConfig,
        lexemeLists: updatedLists,
        completionStatus: {
          ...entityConfig?.completionStatus,
          lexemes: Object.keys(updatedLists).length
        }
      };

      onConfigChange(updatedConfig);
      setSelectedList(spec.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteList = (listId) => {
    const updatedLists = { ...lexemeLists };
    delete updatedLists[listId];

    const updatedConfig = {
      ...entityConfig,
      lexemeLists: updatedLists,
      completionStatus: {
        ...entityConfig?.completionStatus,
        lexemes: Object.keys(updatedLists).length
      }
    };

    onConfigChange(updatedConfig);
    if (selectedList === listId) setSelectedList(null);
  };

  // View mode - show existing lists and specs
  if (mode === 'view') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Lexeme Lists</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="primary" onClick={() => setMode('create-spec')}>
              + New Spec
            </button>
            <button className="secondary" onClick={() => setMode('create-manual')}>
              + Manual List
            </button>
          </div>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Create lexeme specs to generate word lists via LLM, or add manual lists for function words.
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {/* Lexeme Specs Section */}
        {lexemeSpecs.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Generation Specs ({lexemeSpecs.length})</h4>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {lexemeSpecs.map(spec => {
                const hasGenerated = lexemeLists[spec.id];
                return (
                  <div
                    key={spec.id}
                    style={{
                      background: 'rgba(30, 58, 95, 0.3)',
                      padding: '0.75rem 1rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong>{spec.id}</strong>
                      {hasGenerated && (
                        <span style={{
                          marginLeft: '0.5rem',
                          padding: '0.125rem 0.5rem',
                          background: 'rgba(34, 197, 94, 0.2)',
                          border: '1px solid rgba(34, 197, 94, 0.4)',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          color: 'rgb(134, 239, 172)'
                        }}>
                          Generated ({lexemeLists[spec.id]?.entries?.length || 0})
                        </span>
                      )}
                      <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                        {spec.pos} • {spec.targetCount} words
                        {spec.style && ` • ${spec.style.substring(0, 50)}${spec.style.length > 50 ? '...' : ''}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {hasGenerated && (
                        <button
                          className="secondary"
                          style={{ fontSize: '0.875rem' }}
                          onClick={() => setSelectedList(spec.id)}
                        >
                          View
                        </button>
                      )}
                      <button
                        className="primary"
                        style={{ fontSize: '0.875rem' }}
                        onClick={() => handleGenerate(spec)}
                        disabled={loading}
                      >
                        {loading ? '...' : hasGenerated ? 'Regenerate' : 'Generate'}
                      </button>
                      <button
                        className="danger"
                        style={{ fontSize: '0.875rem' }}
                        onClick={() => handleDeleteSpec(spec.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Generated & Manual Lists Section */}
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div style={{ flex: selectedList ? '0 0 50%' : '1' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>
              Local Lists ({Object.keys(lexemeLists).length})
            </h4>

            {Object.keys(lexemeLists).length === 0 ? (
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '6px',
                padding: '1.5rem',
                textAlign: 'center'
              }}>
                <p style={{ margin: 0 }}>No local lexeme lists yet.</p>
                <p className="text-muted" style={{ marginTop: '0.5rem' }}>
                  Create a spec and generate via LLM, or add a manual list.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {Object.entries(lexemeLists).map(([listId, list]) => {
                  const isSelected = selectedList === listId && !selectedListSource;
                  const sharingInfo = list.appliesTo || {};
                  const sharesWithOthers = (sharingInfo.cultures?.length > 1 || sharingInfo.cultures?.includes('*')) ||
                    (sharingInfo.entityKinds?.length > 1 || sharingInfo.entityKinds?.includes('*'));

                  return (
                    <div
                      key={listId}
                      style={{
                        background: isSelected ? 'rgba(212, 175, 55, 0.1)' : 'rgba(30, 58, 95, 0.3)',
                        padding: '0.75rem 1rem',
                        borderRadius: '6px',
                        border: isSelected ? '1px solid var(--gold-accent)' : '1px solid rgba(59, 130, 246, 0.3)',
                        cursor: 'pointer'
                      }}
                      onClick={() => { setSelectedList(listId); setSelectedListSource(null); }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{listId}</strong>
                          <span style={{
                            marginLeft: '0.5rem',
                            padding: '0.125rem 0.5rem',
                            background: list.source === 'manual' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                            border: `1px solid ${list.source === 'manual' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: list.source === 'manual' ? 'rgb(253, 224, 71)' : 'rgb(134, 239, 172)'
                          }}>
                            {list.source === 'manual' ? 'Manual' : 'LLM'}
                          </span>
                          {sharesWithOthers && (
                            <span style={{
                              marginLeft: '0.25rem',
                              padding: '0.125rem 0.5rem',
                              background: 'rgba(147, 51, 234, 0.2)',
                              border: '1px solid rgba(147, 51, 234, 0.4)',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              color: 'rgb(192, 132, 252)'
                            }}>
                              Shared
                            </span>
                          )}
                          <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                            {list.entries?.length || 0} entries
                            {list.tokensUsed > 0 && ` • ${list.tokensUsed} tokens`}
                          </div>
                        </div>
                        <button
                          className="danger"
                          style={{ fontSize: '0.75rem' }}
                          onClick={(e) => { e.stopPropagation(); handleDeleteList(listId); }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Shared Lists Section */}
            {sharedLists.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>
                  Shared Lists ({sharedLists.length})
                </h4>
                <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                  Lists from other cultures/entity types that apply here
                </p>
                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  {sharedLists.map((list) => {
                    const isSelected = selectedList === list.id &&
                      selectedListSource?.cultureId === list.sourceCulture &&
                      selectedListSource?.entityKind === list.sourceEntity;

                    return (
                      <div
                        key={`${list.sourceCulture}-${list.sourceEntity}-${list.id}`}
                        style={{
                          background: isSelected ? 'rgba(147, 51, 234, 0.1)' : 'rgba(30, 58, 95, 0.2)',
                          padding: '0.75rem 1rem',
                          borderRadius: '6px',
                          border: isSelected ? '1px solid rgba(147, 51, 234, 0.6)' : '1px solid rgba(147, 51, 234, 0.3)',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          setSelectedList(list.id);
                          setSelectedListSource({ cultureId: list.sourceCulture, entityKind: list.sourceEntity });
                        }}
                      >
                        <div>
                          <strong>{list.id}</strong>
                          <span style={{
                            marginLeft: '0.5rem',
                            padding: '0.125rem 0.5rem',
                            background: 'rgba(147, 51, 234, 0.2)',
                            border: '1px solid rgba(147, 51, 234, 0.4)',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: 'rgb(192, 132, 252)'
                          }}>
                            from {list.sourceCulture}/{list.sourceEntity}
                          </span>
                          <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                            {list.entries?.length || 0} entries
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Selected List Viewer */}
          {selectedList && (
            <div style={{
              flex: '0 0 45%',
              background: selectedListSource ? 'rgba(147, 51, 234, 0.1)' : 'rgba(30, 58, 95, 0.2)',
              borderRadius: '6px',
              padding: '1rem',
              border: selectedListSource ? '1px solid rgba(147, 51, 234, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)',
              maxHeight: '500px',
              overflowY: 'auto'
            }}>
              {(() => {
                const list = selectedListSource
                  ? sharedLists.find(l => l.id === selectedList && l.sourceCulture === selectedListSource.cultureId && l.sourceEntity === selectedListSource.entityKind)
                  : lexemeLists[selectedList];

                if (!list) return null;

                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h4 style={{ margin: 0 }}>{selectedList}</h4>
                      <button className="secondary" style={{ fontSize: '0.75rem' }} onClick={() => { setSelectedList(null); setSelectedListSource(null); }}>
                        Close
                      </button>
                    </div>

                    {selectedListSource && (
                      <div style={{
                        background: 'rgba(147, 51, 234, 0.2)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '4px',
                        marginBottom: '1rem',
                        fontSize: '0.75rem',
                        color: 'rgb(192, 132, 252)'
                      }}>
                        Shared from: {selectedListSource.cultureId} / {selectedListSource.entityKind}
                      </div>
                    )}

                    {list.description && (
                      <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                        {list.description}
                      </p>
                    )}

                    {/* Sharing info */}
                    {list.appliesTo && (
                      <div style={{ marginBottom: '1rem', fontSize: '0.75rem', color: 'var(--arctic-frost)' }}>
                        <div>Cultures: {list.appliesTo.cultures?.includes('*') ? 'All' : list.appliesTo.cultures?.join(', ') || 'This only'}</div>
                        <div>Entities: {list.appliesTo.entityKinds?.includes('*') ? 'All' : list.appliesTo.entityKinds?.join(', ') || 'This only'}</div>
                      </div>
                    )}

                    <div style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      padding: '0.75rem',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }}>
                      {JSON.stringify(list.entries, null, 2)}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        {/* API Key Section (collapsed by default) */}
        {lexemeSpecs.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <details>
              <summary style={{ cursor: 'pointer', color: 'var(--arctic-frost)' }}>
                API Key Settings
              </summary>
              <div style={{ marginTop: '0.5rem' }}>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-... (required if not set in server environment)"
                  style={{ width: '100%' }}
                />
              </div>
            </details>
          </div>
        )}
      </div>
    );
  }

  // Create Spec Mode
  if (mode === 'create-spec') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>New Lexeme Spec</h3>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Define what kind of words to generate. The LLM will create words matching your domain's phonology.
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="form-group">
          <label>Spec ID</label>
          <input
            value={specForm.id}
            onChange={(e) => setSpecForm({ ...specForm, id: e.target.value })}
            placeholder={`${cultureId}_${entityKind}_nouns`}
          />
          <small className="text-muted">Unique identifier for this spec</small>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Part of Speech</label>
            <select
              value={specForm.pos}
              onChange={(e) => setSpecForm({ ...specForm, pos: e.target.value })}
            >
              {POS_TAGS.map(tag => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Target Count</label>
            <input
              type="number"
              value={specForm.targetCount}
              onChange={(e) => setSpecForm({ ...specForm, targetCount: parseInt(e.target.value) || 30 })}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Style Description</label>
          <textarea
            value={specForm.style}
            onChange={(e) => setSpecForm({ ...specForm, style: e.target.value })}
            placeholder={`e.g., ${entityKind === 'npc' ? 'heroic, noble-sounding personal names' : entityKind === 'location' ? 'mystical, ancient place names' : 'powerful, evocative names'}`}
            rows={3}
          />
          <small className="text-muted">
            Describe the feel/theme for these words.
            {subtypes.length > 0 && (
              <span> Subtypes for {entityKind}: <em>{subtypes.join(', ')}</em></span>
            )}
          </small>
        </div>

        {effectiveDomain && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '6px',
            padding: '0.75rem',
            marginBottom: '1rem',
            fontSize: '0.875rem'
          }}>
            Using domain: <strong>{effectiveDomain.id}</strong>
            <span className="text-muted" style={{ marginLeft: '0.5rem' }}>
              (consonants: {effectiveDomain.phonology?.consonants?.length || 0},
              vowels: {effectiveDomain.phonology?.vowels?.length || 0})
            </span>
          </div>
        )}

        {!effectiveDomain && (
          <div style={{
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '6px',
            padding: '0.75rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            color: 'rgb(253, 224, 71)'
          }}>
            No domain configured. Create a domain first for better phonology-guided generation.
          </div>
        )}

        <div className="form-grid-2">
          <div className="form-group">
            <label>Min Length</label>
            <input
              type="number"
              value={specForm.qualityFilter.minLength}
              onChange={(e) => setSpecForm({
                ...specForm,
                qualityFilter: { ...specForm.qualityFilter, minLength: parseInt(e.target.value) || 3 }
              })}
            />
          </div>
          <div className="form-group">
            <label>Max Length</label>
            <input
              type="number"
              value={specForm.qualityFilter.maxLength}
              onChange={(e) => setSpecForm({
                ...specForm,
                qualityFilter: { ...specForm.qualityFilter, maxLength: parseInt(e.target.value) || 15 }
              })}
            />
          </div>
        </div>

        {/* Sharing Options */}
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(147, 51, 234, 0.1)', borderRadius: '6px', border: '1px solid rgba(147, 51, 234, 0.3)' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', color: 'rgb(192, 132, 252)' }}>Sharing Options</h4>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.875rem' }}>Share with Cultures</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setSpecForm({
                  ...specForm,
                  appliesTo: { ...specForm.appliesTo, cultures: ['*'] }
                })}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: specForm.appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
                  background: specForm.appliesTo?.cultures?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
                  color: specForm.appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                All Cultures
              </button>
              {allCultureIds.map(cultId => (
                <button
                  key={cultId}
                  type="button"
                  onClick={() => {
                    const current = specForm.appliesTo?.cultures || [];
                    const filtered = current.filter(c => c !== '*');
                    const newCultures = filtered.includes(cultId)
                      ? filtered.filter(c => c !== cultId)
                      : [...filtered, cultId];
                    setSpecForm({
                      ...specForm,
                      appliesTo: { ...specForm.appliesTo, cultures: newCultures.length ? newCultures : [cultureId] }
                    });
                  }}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: specForm.appliesTo?.cultures?.includes(cultId) && !specForm.appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                    background: specForm.appliesTo?.cultures?.includes(cultId) && !specForm.appliesTo?.cultures?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                    color: specForm.appliesTo?.cultures?.includes(cultId) && !specForm.appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textTransform: 'capitalize'
                  }}
                >
                  {cultId}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.875rem' }}>Share with Entity Types</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setSpecForm({
                  ...specForm,
                  appliesTo: { ...specForm.appliesTo, entityKinds: ['*'] }
                })}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: specForm.appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
                  background: specForm.appliesTo?.entityKinds?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
                  color: specForm.appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                All Types
              </button>
              {allEntityKinds.map(kind => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    const current = specForm.appliesTo?.entityKinds || [];
                    const filtered = current.filter(k => k !== '*');
                    const newKinds = filtered.includes(kind)
                      ? filtered.filter(k => k !== kind)
                      : [...filtered, kind];
                    setSpecForm({
                      ...specForm,
                      appliesTo: { ...specForm.appliesTo, entityKinds: newKinds.length ? newKinds : [entityKind] }
                    });
                  }}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: specForm.appliesTo?.entityKinds?.includes(kind) && !specForm.appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                    background: specForm.appliesTo?.entityKinds?.includes(kind) && !specForm.appliesTo?.entityKinds?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                    color: specForm.appliesTo?.entityKinds?.includes(kind) && !specForm.appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textTransform: 'capitalize'
                  }}
                >
                  {kind}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="primary" onClick={handleSaveSpec}>Save Spec</button>
          <button className="secondary" onClick={() => setMode('view')}>Cancel</button>
        </div>
      </div>
    );
  }

  // Create Manual List Mode
  if (mode === 'create-manual') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Create Manual List</h3>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Manually create a lexeme list without LLM generation. Perfect for function words like prepositions, articles, connectors, titles, etc.
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="form-group">
          <label>List ID</label>
          <input
            value={manualForm.id}
            onChange={(e) => setManualForm({ ...manualForm, id: e.target.value })}
            placeholder={`${cultureId}_${entityKind}_titles`}
          />
          <small className="text-muted">Use this ID with slot:list_id syntax in templates</small>
        </div>

        <div className="form-group">
          <label>Description (optional)</label>
          <input
            value={manualForm.description}
            onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
            placeholder="e.g., Common titles and honorifics"
          />
        </div>

        <div className="form-group">
          <label>Entries</label>
          <textarea
            value={manualForm.entries}
            onChange={(e) => setManualForm({ ...manualForm, entries: e.target.value })}
            placeholder={`Enter one per line or comma-separated:\nLord\nLady\nSir\nMaster\nElder`}
            rows={10}
            style={{ fontFamily: 'monospace' }}
          />
          <small className="text-muted">
            Enter one entry per line, or use commas to separate. Empty lines will be ignored.
          </small>
        </div>

        {/* Sharing Options */}
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(147, 51, 234, 0.1)', borderRadius: '6px', border: '1px solid rgba(147, 51, 234, 0.3)' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', color: 'rgb(192, 132, 252)' }}>Sharing Options</h4>

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.875rem' }}>Share with Cultures</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setManualForm({
                  ...manualForm,
                  appliesTo: { ...manualForm.appliesTo, cultures: ['*'] }
                })}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: manualForm.appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
                  background: manualForm.appliesTo?.cultures?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
                  color: manualForm.appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                All Cultures
              </button>
              {allCultureIds.map(cultId => (
                <button
                  key={cultId}
                  type="button"
                  onClick={() => {
                    const current = manualForm.appliesTo?.cultures || [];
                    const filtered = current.filter(c => c !== '*');
                    const newCultures = filtered.includes(cultId)
                      ? filtered.filter(c => c !== cultId)
                      : [...filtered, cultId];
                    setManualForm({
                      ...manualForm,
                      appliesTo: { ...manualForm.appliesTo, cultures: newCultures.length ? newCultures : [cultureId] }
                    });
                  }}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: manualForm.appliesTo?.cultures?.includes(cultId) && !manualForm.appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                    background: manualForm.appliesTo?.cultures?.includes(cultId) && !manualForm.appliesTo?.cultures?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                    color: manualForm.appliesTo?.cultures?.includes(cultId) && !manualForm.appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textTransform: 'capitalize'
                  }}
                >
                  {cultId}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.875rem' }}>Share with Entity Types</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setManualForm({
                  ...manualForm,
                  appliesTo: { ...manualForm.appliesTo, entityKinds: ['*'] }
                })}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: manualForm.appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
                  background: manualForm.appliesTo?.entityKinds?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
                  color: manualForm.appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                All Types
              </button>
              {allEntityKinds.map(kind => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    const current = manualForm.appliesTo?.entityKinds || [];
                    const filtered = current.filter(k => k !== '*');
                    const newKinds = filtered.includes(kind)
                      ? filtered.filter(k => k !== kind)
                      : [...filtered, kind];
                    setManualForm({
                      ...manualForm,
                      appliesTo: { ...manualForm.appliesTo, entityKinds: newKinds.length ? newKinds : [entityKind] }
                    });
                  }}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: manualForm.appliesTo?.entityKinds?.includes(kind) && !manualForm.appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                    background: manualForm.appliesTo?.entityKinds?.includes(kind) && !manualForm.appliesTo?.entityKinds?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                    color: manualForm.appliesTo?.entityKinds?.includes(kind) && !manualForm.appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    textTransform: 'capitalize'
                  }}
                >
                  {kind}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button className="primary" onClick={handleSaveManualList}>Save List</button>
          <button className="secondary" onClick={() => setMode('view')}>Cancel</button>
        </div>
      </div>
    );
  }

  return null;
}

// TemplatesTab removed - use CFG/grammar-based generation instead
// Grammars Tab Component
function GrammarsTab({ entityConfig, onConfigChange, cultureId, entityKind, cultureConfig, allCultures, worldSchema }) {
  const [mode, setMode] = useState('view');
  const [editingGrammar, setEditingGrammar] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [formData, setFormData] = useState({
    id: `${cultureId}_${entityKind}_grammar`,
    start: 'name',
    rules: {},
    appliesTo: { cultures: [cultureId], entityKinds: [entityKind] }
  });
  const [newRuleKey, setNewRuleKey] = useState('');
  const [newRuleValue, setNewRuleValue] = useState('');

  const grammars = entityConfig?.grammars || [];

  // Get all cultures and entity kinds for sharing options
  const allCultureIds = Object.keys(allCultures || {});
  const allEntityKinds = worldSchema?.hardState?.map(e => e.kind) || [];

  // Get culture-level domains
  const cultureDomains = cultureConfig?.domains || [];
  // Get effective domain for phonology hints
  const getEffectiveDomain = () => {
    // Domains are now at culture level
    if (cultureConfig?.domains && cultureConfig.domains.length > 0) {
      return cultureConfig.domains[0];
    }
    // Legacy: check if old entity-level domains exist
    if (entityConfig?.domain) return entityConfig.domain;
    if (cultureConfig?.entityConfigs) {
      for (const [kind, config] of Object.entries(cultureConfig.entityConfigs)) {
        if (config?.domain) {
          const appliesTo = config.domain.appliesTo?.kind || [];
          if (appliesTo.includes(entityKind)) return config.domain;
        }
      }
    }
    return null;
  };
  const effectiveDomain = getEffectiveDomain();

  // Get available lexeme lists (local and shared)
  const getAvailableLexemeLists = () => {
    const lists = [];
    // Local lists
    if (entityConfig?.lexemeLists) {
      Object.keys(entityConfig.lexemeLists).forEach(id => {
        lists.push({ id, source: 'local' });
      });
    }
    // Shared lists from same culture
    if (cultureConfig?.entityConfigs) {
      Object.entries(cultureConfig.entityConfigs).forEach(([kind, config]) => {
        if (kind !== entityKind && config?.lexemeLists) {
          Object.entries(config.lexemeLists).forEach(([id, list]) => {
            const appliesTo = list.appliesTo || {};
            const cultureMatch = !appliesTo.cultures?.length || appliesTo.cultures.includes('*') || appliesTo.cultures.includes(cultureId);
            const entityMatch = !appliesTo.entityKinds?.length || appliesTo.entityKinds.includes('*') || appliesTo.entityKinds.includes(entityKind);
            if (cultureMatch && entityMatch) {
              lists.push({ id, source: `${kind}` });
            }
          });
        }
      });
    }
    return lists;
  };
  const availableLexemeLists = getAvailableLexemeLists();

  const handleAddRule = () => {
    if (!newRuleKey.trim() || !newRuleValue.trim()) return;

    const newProductions = newRuleValue.split('|').map(p =>
      p.trim().split(/\s+/).filter(s => s)
    ).filter(p => p.length > 0);

    // If rule already exists, merge productions (add as alternatives)
    const existingProductions = formData.rules[newRuleKey] || [];
    const mergedProductions = [...existingProductions, ...newProductions];

    setFormData({
      ...formData,
      rules: {
        ...formData.rules,
        [newRuleKey]: mergedProductions
      }
    });
    setNewRuleKey('');
    setNewRuleValue('');
  };

  const handleDeleteRule = (key) => {
    const newRules = { ...formData.rules };
    delete newRules[key];
    setFormData({ ...formData, rules: newRules });
  };

  const handleSave = () => {
    if (!formData.id.trim()) return;

    const newGrammars = editingGrammar === 'new'
      ? [...grammars, formData]
      : grammars.map(g => g.id === formData.id ? formData : g);

    onConfigChange({
      ...entityConfig,
      grammars: newGrammars,
      completionStatus: {
        ...entityConfig?.completionStatus,
        grammars: newGrammars.length
      }
    });

    setMode('view');
    setEditingGrammar(null);
  };

  const handleDelete = (id) => {
    const newGrammars = grammars.filter(g => g.id !== id);
    onConfigChange({
      ...entityConfig,
      grammars: newGrammars,
      completionStatus: {
        ...entityConfig?.completionStatus,
        grammars: newGrammars.length
      }
    });
  };

  const handleEdit = (grammar) => {
    setEditingGrammar(grammar.id);
    setFormData(grammar);
    setMode('edit');
  };

  const handleAddNew = () => {
    setEditingGrammar('new');
    setFormData({
      id: `${cultureId}_${entityKind}_grammar`,
      start: 'name',
      rules: {},
      appliesTo: { cultures: [cultureId], entityKinds: [entityKind] }
    });
    setMode('edit');
  };

  const insertIntoRule = (text) => {
    setNewRuleValue(prev => prev ? `${prev} ${text}` : text);
  };

  // View mode
  if (mode === 'view') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Context-Free Grammars</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="secondary" onClick={() => setShowHelp(true)}>? Help</button>
            <button className="primary" onClick={handleAddNew}>+ New Grammar</button>
          </div>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Define grammar rules that reference lexeme lists using <code>slot:lexeme_id</code> syntax.
          Grammars provide structured name patterns with variable content.
        </p>

        {grammars.length === 0 ? (
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '6px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0 }}>No grammars yet.</p>
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>
              Create lexeme lists first, then define grammars to structure names.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {grammars.map((grammar) => {
              const isShared = grammar.appliesTo?.cultures?.includes('*') ||
                grammar.appliesTo?.entityKinds?.includes('*') ||
                (grammar.appliesTo?.cultures?.length > 1) ||
                (grammar.appliesTo?.entityKinds?.length > 1);

              return (
                <div
                  key={grammar.id}
                  style={{
                    background: isShared ? 'rgba(147, 51, 234, 0.15)' : 'rgba(30, 58, 95, 0.3)',
                    padding: '0.75rem 1rem',
                    borderRadius: '6px',
                    border: isShared ? '1px solid rgba(147, 51, 234, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong>{grammar.id}</strong>
                      {isShared && (
                        <span style={{
                          marginLeft: '0.5rem',
                          padding: '0.125rem 0.5rem',
                          background: 'rgba(147, 51, 234, 0.3)',
                          color: 'rgb(192, 132, 252)',
                          borderRadius: '4px',
                          fontSize: '0.7rem'
                        }}>
                          SHARED
                        </span>
                      )}
                      <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                        Start: <code>{grammar.start}</code> • {Object.keys(grammar.rules || {}).length} rules
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="secondary" style={{ fontSize: '0.875rem' }} onClick={() => handleEdit(grammar)}>
                        Edit
                      </button>
                      <button className="danger" style={{ fontSize: '0.875rem' }} onClick={() => handleDelete(grammar.id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Help Modal */}
        {showHelp && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }} onClick={() => setShowHelp(false)}>
            <div style={{
              background: 'var(--arctic-dark)',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '700px',
              maxHeight: '80vh',
              overflowY: 'auto',
              border: '2px solid var(--arctic-ice)'
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Context-Free Grammars</h3>
                <button className="secondary" onClick={() => setShowHelp(false)}>Close</button>
              </div>

              <div style={{ lineHeight: '1.6' }}>
                <p>CFGs define structured patterns for name generation. They combine fixed structure with variable content from lexeme lists.</p>

                <h4>Example Grammar</h4>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  <div>Start: <strong>name</strong></div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <div>name → adj - noun</div>
                    <div>adj → slot:adjectives</div>
                    <div>noun → slot:nouns</div>
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  Generates names like: "Swift-Scale", "Dark-Fang", "Silent-Shadow"
                </p>

                <h4>Syntax</h4>
                <ul style={{ fontSize: '0.875rem' }}>
                  <li><code>slot:lexeme_id</code> - Pull from a lexeme list</li>
                  <li><code>domain:domain_id</code> - Generate phonotactic name from a domain</li>
                  <li><code>context:key</code> - Use a related entity's name (owner, founder, ruler, etc.)</li>
                  <li><code>^suffix</code> - Terminator with literal suffix (e.g., <code>domain:id^'s</code> → "Zixtrex's")</li>
                  <li><code>|</code> - Alternatives (random choice)</li>
                  <li><code>space</code> - Sequence (concatenate with space)</li>
                  <li>Literal text - Use as-is (e.g., "of", "the", "-")</li>
                </ul>

                <h4>Entity Linkage (Named Entity Propagation)</h4>
                <div style={{ background: 'rgba(34, 197, 94, 0.2)', padding: '1rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  <div style={{ color: 'var(--arctic-frost)' }}>// Location named after leader:</div>
                  <div>name → context:leader^'s slot:location_types</div>
                  <div style={{ marginTop: '0.5rem', color: 'var(--arctic-frost)' }}>// Faction HQ named after origin:</div>
                  <div>name → slot:titles of context:origin</div>
                </div>
                <p style={{ fontSize: '0.875rem' }}>
                  Generates: "Zixtrex's Fortress", "Guild of Aurora Stack"
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--arctic-frost)' }}>
                  Context keys map to KG relationships: <code>leader</code>, <code>founder</code>, <code>discoverer</code>, <code>mentor</code>, <code>location</code>, <code>faction</code>, <code>birthplace</code>, <code>stronghold</code>
                </p>

                <h4>Mixing Lexemes with Phonotactic</h4>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  <div>name → slot:titles domain:elven_domain</div>
                  <div style={{ marginTop: '0.5rem', color: 'var(--arctic-frost)' }}>// With suffix:</div>
                  <div>possessive → domain:tech_domain^'s slot:nouns</div>
                </div>
                <p style={{ fontSize: '0.875rem' }}>
                  Generates: "Duke Zixtrexrtra", "Valamorn's fortress"
                </p>

                <h4>Tips</h4>
                <ul style={{ fontSize: '0.875rem' }}>
                  <li>Start simple: adj-noun patterns work well</li>
                  <li>Use descriptive rule names (adj, noun, title)</li>
                  <li>Mix <code>slot:</code> and <code>domain:</code> for "Duke Zixtrexrtra" style names</li>
                  <li>Use <code>context:</code> for entity-linked names like "Zixtrex's Oasis"</li>
                  <li>Use <code>^</code> to attach suffixes: <code>context:owner^'s</code> → "Zixtrex's"</li>
                  <li>Create focused lexeme lists for each role</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>{editingGrammar === 'new' ? 'New Grammar' : 'Edit Grammar'}</h3>
      </div>

      <div className="form-group">
        <label>Grammar ID</label>
        <input
          value={formData.id}
          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          placeholder={`${cultureId}_${entityKind}_grammar`}
        />
      </div>

      <div className="form-group">
        <label>Start Symbol</label>
        <input
          value={formData.start}
          onChange={(e) => setFormData({ ...formData, start: e.target.value })}
          placeholder="e.g., name, phrase, title"
        />
        <small className="text-muted">The entry point for name generation</small>
      </div>

      <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Production Rules</h4>

      {/* Click-to-insert: Lexeme Lists */}
      {availableLexemeLists.length > 0 && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.15)',
          padding: '0.75rem',
          borderRadius: '6px',
          marginBottom: '1rem',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)', marginBottom: '0.5rem' }}>
            <strong>Lexeme Lists</strong> (click to insert)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {availableLexemeLists.map(({ id, source }) => (
              <code
                key={`${source}-${id}`}
                style={{
                  background: 'rgba(10, 25, 41, 0.8)',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  color: 'var(--gold-accent)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}
                onClick={() => insertIntoRule(`slot:${id}`)}
                title={source !== 'local' ? `From ${source}` : 'Local list'}
              >
                slot:{id}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Click-to-insert: Domain Phonology */}
      {effectiveDomain && (
        <div style={{
          background: 'rgba(147, 51, 234, 0.15)',
          padding: '0.75rem',
          borderRadius: '6px',
          marginBottom: '1rem',
          border: '1px solid rgba(147, 51, 234, 0.3)'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'rgb(192, 132, 252)', marginBottom: '0.5rem' }}>
            <strong>Domain: {effectiveDomain.id}</strong>
          </div>

          {/* Phonotactic generation */}
          <div style={{ marginBottom: '0.5rem' }}>
            <code
              style={{
                background: 'rgba(10, 25, 41, 0.8)',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                color: 'var(--gold-accent)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                border: '1px solid rgba(147, 51, 234, 0.5)'
              }}
              onClick={() => insertIntoRule(`domain:${effectiveDomain.id}`)}
              title="Generate phonotactic name from this domain"
            >
              domain:{effectiveDomain.id}
            </code>
            <span style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)', marginLeft: '0.5rem' }}>
              (generates names like "Zixtrexrtra")
            </span>
          </div>

          {effectiveDomain.morphology?.prefixes?.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)' }}>Prefixes: </span>
              {effectiveDomain.morphology.prefixes.slice(0, 8).map((p, i) => (
                <code
                  key={i}
                  style={{
                    background: 'rgba(10, 25, 41, 0.8)',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '3px',
                    color: 'rgb(192, 132, 252)',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    marginRight: '0.25rem'
                  }}
                  onClick={() => insertIntoRule(p)}
                >
                  {p}
                </code>
              ))}
            </div>
          )}

          {effectiveDomain.morphology?.suffixes?.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)' }}>Suffixes: </span>
              {effectiveDomain.morphology.suffixes.slice(0, 8).map((s, i) => (
                <code
                  key={i}
                  style={{
                    background: 'rgba(10, 25, 41, 0.8)',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '3px',
                    color: 'rgb(192, 132, 252)',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    marginRight: '0.25rem'
                  }}
                  onClick={() => insertIntoRule(s)}
                >
                  {s}
                </code>
              ))}
            </div>
          )}

          {effectiveDomain.style?.preferredEndings?.length > 0 && (
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)' }}>Endings: </span>
              {effectiveDomain.style.preferredEndings.slice(0, 8).map((e, i) => (
                <code
                  key={i}
                  style={{
                    background: 'rgba(10, 25, 41, 0.8)',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '3px',
                    color: 'rgb(192, 132, 252)',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    marginRight: '0.25rem'
                  }}
                  onClick={() => insertIntoRule(e)}
                >
                  {e}
                </code>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Click-to-insert: Markov Chain Models */}
      <div style={{
        background: 'rgba(168, 85, 247, 0.15)',
        padding: '0.75rem',
        borderRadius: '6px',
        marginBottom: '1rem',
        border: '1px solid rgba(168, 85, 247, 0.4)'
      }}>
        <div style={{ fontSize: '0.75rem', color: '#c084fc', marginBottom: '0.5rem' }}>
          <strong>Markov Chain Models</strong> (click to insert - statistically-generated names)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {[
            { id: 'norse', name: 'Norse', desc: 'Viking-era Scandinavian names' },
            { id: 'germanic', name: 'Germanic', desc: 'German/Swedish names' },
            { id: 'finnish', name: 'Finnish', desc: 'Uralic language names' },
            { id: 'arabic', name: 'Arabic', desc: 'Semitic language names' },
            { id: 'celtic', name: 'Celtic', desc: 'Irish/Welsh/Gaelic names' },
            { id: 'slavic', name: 'Slavic', desc: 'Russian/Polish/Czech names' },
            { id: 'latin', name: 'Latin/Romance', desc: 'Italian/Spanish/French names' },
            { id: 'japanese', name: 'Japanese', desc: 'Japanese names in romaji' },
            { id: 'african', name: 'African', desc: 'Pan-African names' },
          ].map(({ id, name, desc }) => (
            <code
              key={id}
              style={{
                background: 'rgba(10, 25, 41, 0.8)',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                color: '#c084fc',
                cursor: 'pointer',
                fontSize: '0.75rem',
                border: '1px solid rgba(168, 85, 247, 0.3)'
              }}
              onClick={() => insertIntoRule(`markov:${id}`)}
              title={`${name}: ${desc}`}
            >
              markov:{id}
            </code>
          ))}
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--arctic-frost)', marginTop: '0.5rem' }}>
          Generates names trained on real-world language patterns
        </div>
      </div>

      {/* Entity Linkage - Context References */}
      <div style={{
        background: 'rgba(34, 197, 94, 0.15)',
        padding: '0.75rem',
        borderRadius: '6px',
        marginBottom: '1rem',
        border: '1px solid rgba(34, 197, 94, 0.3)'
      }}>
        <div style={{ fontSize: '0.75rem', color: 'rgb(134, 239, 172)', marginBottom: '0.5rem' }}>
          <strong>Entity Linkage</strong> (click to insert - uses related entity names from KG relationships)
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--arctic-frost)', marginBottom: '0.5rem' }}>
          NPC Relations:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {[
            { key: 'leader', desc: "leader_of relationship (NPC who leads this location/faction)" },
            { key: 'founder', desc: "founder_of relationship (NPC who founded this faction)" },
            { key: 'discoverer', desc: "discovered_by relationship (NPC who discovered this location)" },
            { key: 'mentor', desc: "mentor_of relationship (NPC's mentor)" },
            { key: 'resident', desc: "resident_of relationship (NPC who lives here)" }
          ].map(({ key, desc }) => (
            <code
              key={key}
              style={{
                background: 'rgba(10, 25, 41, 0.8)',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                color: 'rgb(134, 239, 172)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                border: '1px solid rgba(34, 197, 94, 0.4)'
              }}
              onClick={() => insertIntoRule(`context:${key}`)}
              title={desc}
            >
              context:{key}
            </code>
          ))}
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--arctic-frost)', marginBottom: '0.5rem' }}>
          Location/Faction Relations:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {[
            { key: 'location', desc: "Related location (resident_of, stronghold_of, etc.)" },
            { key: 'faction', desc: "Related faction (member_of, stronghold_of, etc.)" },
            { key: 'birthplace', desc: "birthplace_of relationship (location where NPC was born)" },
            { key: 'stronghold', desc: "stronghold_of relationship (faction's base location)" },
            { key: 'origin', desc: "origin_of relationship (where faction originated)" }
          ].map(({ key, desc }) => (
            <code
              key={key}
              style={{
                background: 'rgba(10, 25, 41, 0.8)',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                color: 'rgb(134, 239, 172)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                border: '1px solid rgba(34, 197, 94, 0.4)'
              }}
              onClick={() => insertIntoRule(`context:${key}`)}
              title={desc}
            >
              context:{key}
            </code>
          ))}
        </div>
        <div style={{ fontSize: '0.65rem', color: 'var(--arctic-frost)', marginTop: '0.5rem' }}>
          Use with possessives: <code style={{ color: 'rgb(134, 239, 172)' }}>context:leader^'s slot:nouns</code> → "Zixtrex's Fortress"
        </div>
      </div>

      {/* Common literals */}
      <div style={{
        background: 'rgba(30, 58, 95, 0.3)',
        padding: '0.75rem',
        borderRadius: '6px',
        marginBottom: '1rem',
        border: '1px solid rgba(59, 130, 246, 0.2)'
      }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)', marginBottom: '0.5rem' }}>
          <strong>Common Literals</strong> (click to insert)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {['-', "'", "'s", 'of', 'the', 'von', 'de', 'el', 'al'].map((lit) => (
            <code
              key={lit}
              style={{
                background: 'rgba(10, 25, 41, 0.8)',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                color: 'var(--arctic-frost)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                border: '1px solid rgba(59, 130, 246, 0.2)'
              }}
              onClick={() => insertIntoRule(lit)}
            >
              {lit}
            </code>
          ))}
        </div>
      </div>

      {/* Add rule form */}
      <div style={{
        background: 'rgba(30, 58, 95, 0.4)',
        padding: '1rem',
        borderRadius: '6px',
        marginBottom: '1rem',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            style={{ flex: '0 0 120px' }}
            value={newRuleKey}
            onChange={(e) => setNewRuleKey(e.target.value)}
            placeholder="Non-terminal"
          />
          <span style={{ alignSelf: 'center', color: 'var(--arctic-frost)' }}>→</span>
          <input
            style={{ flex: 1 }}
            value={newRuleValue}
            onChange={(e) => setNewRuleValue(e.target.value)}
            placeholder="slot:lexeme_id | literal | other_nonterminal"
          />
          <button className="primary" onClick={handleAddRule}>Add</button>
        </div>
        <small className="text-muted">
          Use <code>|</code> for alternatives, <code>space</code> for sequence
        </small>
      </div>

      {/* Current rules */}
      {Object.keys(formData.rules).length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Current Rules</h4>
          {Object.entries(formData.rules).map(([key, productions]) => (
            <div
              key={key}
              style={{
                padding: '0.75rem',
                background: 'rgba(30, 58, 95, 0.4)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '4px',
                marginBottom: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                <strong style={{ color: 'var(--gold-accent)' }}>{key}</strong>
                <span style={{ color: 'var(--arctic-frost)' }}> → </span>
                {productions.map((prod, i) => (
                  <span key={i}>
                    <span style={{ color: 'var(--arctic-light)' }}>{prod.join(' ')}</span>
                    {i < productions.length - 1 && <span style={{ color: 'var(--arctic-frost)' }}> | </span>}
                  </span>
                ))}
              </div>
              <button
                className="danger"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                onClick={() => handleDeleteRule(key)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sharing Options */}
      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(147, 51, 234, 0.1)', borderRadius: '6px', border: '1px solid rgba(147, 51, 234, 0.3)' }}>
        <h4 style={{ margin: '0 0 0.75rem 0', color: 'rgb(192, 132, 252)' }}>Sharing Options</h4>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.875rem' }}>Share with Cultures</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              onClick={() => setFormData({
                ...formData,
                appliesTo: { ...formData.appliesTo, cultures: ['*'] }
              })}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: formData.appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
                background: formData.appliesTo?.cultures?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
                color: formData.appliesTo?.cultures?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              All Cultures
            </button>
            {allCultureIds.map(cultId => (
              <button
                key={cultId}
                type="button"
                onClick={() => {
                  const current = formData.appliesTo?.cultures || [];
                  const filtered = current.filter(c => c !== '*');
                  const newCultures = filtered.includes(cultId)
                    ? filtered.filter(c => c !== cultId)
                    : [...filtered, cultId];
                  setFormData({
                    ...formData,
                    appliesTo: { ...formData.appliesTo, cultures: newCultures.length ? newCultures : [cultureId] }
                  });
                }}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: formData.appliesTo?.cultures?.includes(cultId) && !formData.appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                  background: formData.appliesTo?.cultures?.includes(cultId) && !formData.appliesTo?.cultures?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                  color: formData.appliesTo?.cultures?.includes(cultId) && !formData.appliesTo?.cultures?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  textTransform: 'capitalize'
                }}
              >
                {cultId}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: '0.875rem' }}>Share with Entity Types</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              onClick={() => setFormData({
                ...formData,
                appliesTo: { ...formData.appliesTo, entityKinds: ['*'] }
              })}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '4px',
                border: '1px solid',
                borderColor: formData.appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--border-color)',
                background: formData.appliesTo?.entityKinds?.includes('*') ? 'rgba(147, 51, 234, 0.2)' : 'transparent',
                color: formData.appliesTo?.entityKinds?.includes('*') ? 'rgb(192, 132, 252)' : 'var(--text-color)',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              All Types
            </button>
            {allEntityKinds.map(kind => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  const current = formData.appliesTo?.entityKinds || [];
                  const filtered = current.filter(k => k !== '*');
                  const newKinds = filtered.includes(kind)
                    ? filtered.filter(k => k !== kind)
                    : [...filtered, kind];
                  setFormData({
                    ...formData,
                    appliesTo: { ...formData.appliesTo, entityKinds: newKinds.length ? newKinds : [entityKind] }
                  });
                }}
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: formData.appliesTo?.entityKinds?.includes(kind) && !formData.appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--border-color)',
                  background: formData.appliesTo?.entityKinds?.includes(kind) && !formData.appliesTo?.entityKinds?.includes('*') ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                  color: formData.appliesTo?.entityKinds?.includes(kind) && !formData.appliesTo?.entityKinds?.includes('*') ? 'var(--gold-accent)' : 'var(--text-color)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  textTransform: 'capitalize'
                }}
              >
                {kind}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
        <button className="primary" onClick={handleSave}>Save Grammar</button>
        <button className="secondary" onClick={() => { setMode('view'); setEditingGrammar(null); }}>Cancel</button>
      </div>
    </div>
  );
}

// Profile Tab Component
function ProfileTab({ cultureId, entityKind, entityConfig, onConfigChange, onAutoGenerate, cultureConfig, allCultures }) {
  const [editing, setEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(null);
  const [testNames, setTestNames] = useState([]);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState(null);

  // Collect ALL domains from ALL cultures for domain dropdown
  const allDomains = [];
  if (allCultures) {
    Object.entries(allCultures).forEach(([cultId, cultConfig]) => {
      if (cultConfig?.domains) {
        cultConfig.domains.forEach((domain) => {
          allDomains.push({
            ...domain,
            sourceCulture: cultId
          });
        });
      }
    });
  }
  const [strategyUsage, setStrategyUsage] = useState(null);
  // Modal state for conditions editing
  const [conditionsModalOpen, setConditionsModalOpen] = useState(false);
  const [editingGroupIdx, setEditingGroupIdx] = useState(null);

  const profile = entityConfig?.profile;

  // Get culture-level domains
  const cultureDomains = cultureConfig?.domains || [];
  // Get effective domain (local or shared)
  const getEffectiveDomain = () => {
    // Domains are now at culture level
    if (cultureConfig?.domains && cultureConfig.domains.length > 0) {
      return cultureConfig.domains[0];
    }
    // Legacy: check if old entity-level domains exist
    if (entityConfig?.domain) return entityConfig.domain;
    if (cultureConfig?.entityConfigs) {
      for (const [kind, config] of Object.entries(cultureConfig.entityConfigs)) {
        if (config?.domain) {
          const appliesTo = config.domain.appliesTo?.kind || [];
          if (appliesTo.includes(entityKind)) return config.domain;
        }
      }
    }
    return null;
  };
  const effectiveDomain = getEffectiveDomain();

  // Get shared lexeme lists that apply to this culture/entity
  const getSharedLexemeLists = () => {
    const shared = {};
    const listAppliesHere = (list) => {
      const appliesTo = list.appliesTo || {};
      const cultures = appliesTo.cultures || [];
      const entityKinds = appliesTo.entityKinds || [];
      const cultureMatch = cultures.length === 0 || cultures.includes('*') || cultures.includes(cultureId);
      const entityMatch = entityKinds.length === 0 || entityKinds.includes('*') || entityKinds.includes(entityKind);
      return cultureMatch && entityMatch;
    };

    if (allCultures) {
      Object.entries(allCultures).forEach(([cultId, cultConfig]) => {
        if (cultConfig?.entityConfigs) {
          Object.entries(cultConfig.entityConfigs).forEach(([entKind, entConfig]) => {
            if (cultId === cultureId && entKind === entityKind) return;
            if (entConfig?.lexemeLists) {
              Object.entries(entConfig.lexemeLists).forEach(([listId, list]) => {
                if (listAppliesHere(list) && !shared[listId]) {
                  shared[listId] = list;
                }
              });
            }
          });
        }
      });
    }
    return shared;
  };
  const sharedLexemeLists = getSharedLexemeLists();

  const handleStartEdit = () => {
    const profileCopy = JSON.parse(JSON.stringify(profile));
    // Ensure strategyGroups exists
    if (!profileCopy.strategyGroups) {
      profileCopy.strategyGroups = [];
    }
    setEditedProfile(profileCopy);
    setEditing(true);
  };

  const handleSave = () => {
    // Normalize weights within each group
    const normalizedGroups = editedProfile.strategyGroups.map(group => {
      const totalWeight = group.strategies.reduce((sum, s) => sum + s.weight, 0);
      return {
        ...group,
        strategies: group.strategies.map(s => ({
          ...s,
          weight: totalWeight > 0 ? s.weight / totalWeight : 1 / group.strategies.length
        }))
      };
    });

    const updatedProfile = {
      ...editedProfile,
      strategyGroups: normalizedGroups
    };
    // Remove legacy strategies field
    delete updatedProfile.strategies;

    onConfigChange({
      ...entityConfig,
      profile: updatedProfile
    });
    setEditing(false);
    setEditedProfile(null);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditedProfile(null);
  };

  // Strategy weight change within a group
  const handleWeightChange = (groupIdx, stratIdx, newWeight) => {
    const groups = [...editedProfile.strategyGroups];
    const strategies = [...groups[groupIdx].strategies];
    strategies[stratIdx] = { ...strategies[stratIdx], weight: parseFloat(newWeight) || 0 };
    groups[groupIdx] = { ...groups[groupIdx], strategies };
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  };

  // Delete a strategy from a group
  const handleDeleteStrategy = (groupIdx, stratIdx) => {
    const groups = [...editedProfile.strategyGroups];
    const strategies = groups[groupIdx].strategies.filter((_, i) => i !== stratIdx);
    if (strategies.length === 0) {
      // Remove the entire group if no strategies left
      setEditedProfile({
        ...editedProfile,
        strategyGroups: groups.filter((_, i) => i !== groupIdx)
      });
    } else {
      groups[groupIdx] = { ...groups[groupIdx], strategies };
      setEditedProfile({ ...editedProfile, strategyGroups: groups });
    }
  };

  // Add strategy to a group
  const handleAddStrategy = (groupIdx, type) => {
    const newStrategy = { type, weight: 0.25 };

    if (type === 'phonotactic') {
      newStrategy.domainId = entityConfig?.domain?.id || `${cultureId}_${entityKind}_domain`;
    } else if (type === 'grammar') {
      newStrategy.grammarId = entityConfig?.grammars?.[0]?.id || '';
    }

    const groups = [...editedProfile.strategyGroups];
    groups[groupIdx] = {
      ...groups[groupIdx],
      strategies: [...groups[groupIdx].strategies, newStrategy]
    };
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  };

  // Add a new group
  const handleAddGroup = (withConditions = false) => {
    const newGroup = {
      name: withConditions ? 'New Conditional Group' : 'New Group',
      priority: withConditions ? 50 : 0,
      conditions: withConditions ? { tags: [], prominence: [] } : null,
      strategies: []
    };
    setEditedProfile({
      ...editedProfile,
      strategyGroups: [...editedProfile.strategyGroups, newGroup]
    });
  };

  // Delete a group
  const handleDeleteGroup = (groupIdx) => {
    setEditedProfile({
      ...editedProfile,
      strategyGroups: editedProfile.strategyGroups.filter((_, i) => i !== groupIdx)
    });
  };

  // Update group priority
  const handlePriorityChange = (groupIdx, newPriority) => {
    const groups = [...editedProfile.strategyGroups];
    groups[groupIdx] = { ...groups[groupIdx], priority: parseInt(newPriority) || 0 };
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  };

  // Update group name
  const handleGroupNameChange = (groupIdx, newName) => {
    const groups = [...editedProfile.strategyGroups];
    groups[groupIdx] = { ...groups[groupIdx], name: newName };
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  };

  const getStrategyColor = (type) => {
    switch (type) {
      case 'phonotactic': return 'rgba(59, 130, 246, 0.3)';
      case 'grammar': return 'rgba(147, 51, 234, 0.3)';
      default: return 'rgba(100, 100, 100, 0.3)';
    }
  };

  const getStrategyBorder = (type) => {
    switch (type) {
      case 'phonotactic': return 'rgba(59, 130, 246, 0.5)';
      case 'grammar': return 'rgba(147, 51, 234, 0.5)';
      default: return 'rgba(100, 100, 100, 0.5)';
    }
  };

  const handleTestNames = async (count = 10) => {
    if (!profile) return;

    setTestLoading(true);
    setTestError(null);
    setTestNames([]);
    setStrategyUsage(null);

    try {
      // Merge local + shared lexeme lists
      const localLexemes = entityConfig?.lexemeLists || {};
      const lexemes = { ...sharedLexemeLists, ...localLexemes };

      // Debug: log what we're sending
      console.log('🔍 Test Names - sending:', {
        hasProfile: !!profile,
        strategyGroups: profile?.strategyGroups?.length,
        localLexemeIds: Object.keys(localLexemes),
        sharedLexemeIds: Object.keys(sharedLexemeLists),
        mergedLexemeIds: Object.keys(lexemes),
        grammarIds: (entityConfig?.grammars || []).map(g => g.id),
        cultureDomainCount: cultureDomains.length,
        cultureDomainIds: cultureDomains.map(d => d.id)
      });

      const response = await fetch(`${API_URL}/api/test-names`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: profile.id,
          count,
          profile,
          domains: cultureDomains.length > 0 ? cultureDomains : (effectiveDomain ? [effectiveDomain] : []),
          grammars: entityConfig?.grammars || [],
          lexemes
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate test names');
      }

      const data = await response.json();
      setTestNames(data.names || []);
      setStrategyUsage(data.strategyUsage || null);
    } catch (err) {
      setTestError(err.message);
    } finally {
      setTestLoading(false);
    }
  };

  // Get sorted groups by priority for display
  const getSortedGroups = (groups) => {
    if (!groups) return [];
    return [...groups].sort((a, b) => b.priority - a.priority);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Naming Profile</h3>
        {profile && !editing && (
          <button className="secondary" onClick={handleStartEdit}>Edit Profile</button>
        )}
      </div>

      <p className="text-muted">
        Profile uses priority-based groups. Higher priority groups are evaluated first.
        Within a group, strategies are selected by weighted random.
      </p>

      {/* Auto-generate section */}
      <div style={{
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '6px',
        padding: '1rem',
        marginTop: '1rem'
      }}>
        <p style={{ margin: 0, marginBottom: '1rem' }}>
          <strong>Auto-Generate Profile:</strong> Create a profile from your domain, lexemes, templates, and grammars.
        </p>
        <button className="primary" onClick={onAutoGenerate}>
          ⚡ {profile ? 'Re-Generate Profile' : 'Auto-Generate Profile'}
        </button>
      </div>

      {/* Editing mode */}
      {editing && editedProfile && (
        <div style={{ marginTop: '1.5rem' }}>
          <h4>Edit Profile</h4>

          <div className="form-group">
            <label>Profile ID</label>
            <input
              value={editedProfile.id}
              onChange={(e) => setEditedProfile({ ...editedProfile, id: e.target.value })}
            />
          </div>

          <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>
            Strategy Groups
            <span style={{ fontWeight: 'normal', fontSize: '0.875rem', marginLeft: '0.5rem', color: 'var(--arctic-frost)' }}>
              (evaluated by priority, highest first)
            </span>
          </h4>

          {editedProfile.strategyGroups?.length === 0 && (
            <div className="info" style={{ marginBottom: '1rem' }}>
              No groups yet. Add a group to define naming strategies.
            </div>
          )}

          {getSortedGroups(editedProfile.strategyGroups)?.map((group, displayIdx) => {
            // Find the actual index in the unsorted array for handlers
            const groupIdx = editedProfile.strategyGroups.findIndex(g => g === group);
            const groupTotalWeight = group.strategies.reduce((sum, s) => sum + s.weight, 0);

            return (
              <div
                key={groupIdx}
                style={{
                  background: group.conditions ? 'rgba(147, 51, 234, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  border: `1px solid ${group.conditions ? 'rgba(147, 51, 234, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '1rem'
                }}
              >
                {/* Group Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                    <input
                      value={group.name || ''}
                      onChange={(e) => handleGroupNameChange(groupIdx, e.target.value)}
                      placeholder="Group name..."
                      style={{ width: '150px', fontSize: '0.9rem', fontWeight: 'bold' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)' }}>Priority:</label>
                      <input
                        type="number"
                        value={group.priority}
                        onChange={(e) => handlePriorityChange(groupIdx, e.target.value)}
                        style={{ width: '60px', fontSize: '0.85rem', textAlign: 'center' }}
                      />
                    </div>
                  </div>
                  <button
                    className="danger"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => handleDeleteGroup(groupIdx)}
                  >
                    Delete Group
                  </button>
                </div>

                {/* Group Conditions */}
                <div style={{
                  background: 'rgba(0,0,0,0.2)',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '4px',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--arctic-frost)' }}>Conditions:</span>
                  {!group.conditions ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--gold-accent)' }}>None (default fallback)</span>
                  ) : (
                    <>
                      {group.conditions.tags?.length > 0 && (
                        <span style={{
                          background: 'rgba(59, 130, 246, 0.3)',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '3px',
                          fontSize: '0.7rem'
                        }}>
                          tags: {group.conditions.requireAllTags ? 'ALL' : 'any'}({group.conditions.tags.join(', ')})
                        </span>
                      )}
                      {group.conditions.prominence?.length > 0 && (
                        <span style={{
                          background: 'rgba(147, 51, 234, 0.3)',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '3px',
                          fontSize: '0.7rem'
                        }}>
                          prominence: {group.conditions.prominence.join(', ')}
                        </span>
                      )}
                      {group.conditions.subtype?.length > 0 && (
                        <span style={{
                          background: 'rgba(34, 197, 94, 0.3)',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '3px',
                          fontSize: '0.7rem'
                        }}>
                          subtype: {group.conditions.subtype.join(', ')}
                        </span>
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.2rem 0.4rem',
                      background: 'transparent',
                      border: '1px solid var(--border-color)',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      color: 'var(--text-color)',
                      marginLeft: 'auto'
                    }}
                    onClick={() => {
                      setEditingGroupIdx(groupIdx);
                      setConditionsModalOpen(true);
                    }}
                  >
                    {group.conditions ? 'Edit' : '+ Add'}
                  </button>
                  {group.conditions && (
                    <button
                      type="button"
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.2rem 0.4rem',
                        background: 'transparent',
                        border: '1px solid rgba(239, 68, 68, 0.5)',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        color: 'rgba(239, 68, 68, 0.8)'
                      }}
                      onClick={() => {
                        const groups = [...editedProfile.strategyGroups];
                        groups[groupIdx] = { ...groups[groupIdx], conditions: null };
                        setEditedProfile({ ...editedProfile, strategyGroups: groups });
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Strategies in this group */}
                <div style={{ marginLeft: '0.5rem' }}>
                  {group.strategies.length === 0 && (
                    <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      No strategies in this group. Add one below.
                    </div>
                  )}

                  {group.strategies.map((strategy, stratIdx) => (
                    <div
                      key={stratIdx}
                      style={{
                        background: getStrategyColor(strategy.type),
                        border: `1px solid ${getStrategyBorder(strategy.type)}`,
                        borderRadius: '6px',
                        padding: '0.75rem',
                        marginBottom: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong style={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>{strategy.type}</strong>
                          <span style={{
                            background: 'rgba(0,0,0,0.3)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: 'var(--gold-accent)'
                          }}>
                            {groupTotalWeight > 0 ? ((strategy.weight / groupTotalWeight) * 100).toFixed(0) : 0}%
                          </span>
                        </div>
                        <button
                          className="danger"
                          style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                          onClick={() => handleDeleteStrategy(groupIdx, stratIdx)}
                        >
                          Remove
                        </button>
                      </div>

                      {/* Weight slider */}
                      <div style={{ marginBottom: '0.5rem' }}>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={strategy.weight}
                          onChange={(e) => handleWeightChange(groupIdx, stratIdx, e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </div>

                      {/* Strategy-specific fields */}
                      {strategy.type === 'phonotactic' && (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.8rem' }}>Domain</label>
                          <select
                            value={strategy.domainId || ''}
                            onChange={(e) => {
                              const groups = [...editedProfile.strategyGroups];
                              const strategies = [...groups[groupIdx].strategies];
                              strategies[stratIdx] = { ...strategies[stratIdx], domainId: e.target.value };
                              groups[groupIdx] = { ...groups[groupIdx], strategies };
                              setEditedProfile({ ...editedProfile, strategyGroups: groups });
                            }}
                            style={{ width: '100%', fontSize: '0.85rem' }}
                          >
                            <option value="">Select a domain...</option>
                            {allDomains.map(d => (
                              <option key={`${d.sourceCulture}_${d.id}`} value={d.id}>
                                {d.id} ({d.sourceCulture})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {strategy.type === 'grammar' && (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: '0.8rem' }}>Grammar ID</label>
                          <select
                            value={strategy.grammarId || ''}
                            onChange={(e) => {
                              const groups = [...editedProfile.strategyGroups];
                              const strategies = [...groups[groupIdx].strategies];
                              strategies[stratIdx] = { ...strategies[stratIdx], grammarId: e.target.value };
                              groups[groupIdx] = { ...groups[groupIdx], strategies };
                              setEditedProfile({ ...editedProfile, strategyGroups: groups });
                            }}
                            style={{ width: '100%', fontSize: '0.85rem' }}
                          >
                            <option value="">Select a grammar...</option>
                            {(entityConfig?.grammars || []).map(g => (
                              <option key={g.id} value={g.id}>{g.id}</option>
                            ))}
                          </select>
                        </div>
                      )}

                    </div>
                  ))}

                  {/* Add strategy to group */}
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
                    <button
                      className="secondary"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => handleAddStrategy(groupIdx, 'phonotactic')}
                    >
                      + Phonotactic
                    </button>
                    <button
                      className="secondary"
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      onClick={() => handleAddStrategy(groupIdx, 'grammar')}
                    >
                      + Grammar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add group buttons */}
          <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.875rem', marginRight: '0.75rem' }}>Add group:</span>
            <button
              className="secondary"
              style={{ marginRight: '0.5rem', fontSize: '0.875rem' }}
              onClick={() => handleAddGroup(false)}
            >
              + Default Group
            </button>
            <button
              className="secondary"
              style={{ fontSize: '0.875rem' }}
              onClick={() => handleAddGroup(true)}
            >
              + Conditional Group
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="primary" onClick={handleSave}>Save Profile</button>
            <button className="secondary" onClick={handleCancel}>Cancel</button>
          </div>
        </div>
      )}

      {/* View mode - 2 column layout */}
      {!editing && profile && (
        <div style={{
          marginTop: '1.5rem',
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: '1.5rem',
          alignItems: 'start'
        }}>
          {/* Left column - Profile strategy groups */}
          <div>
            <h4 style={{ marginTop: 0, marginBottom: '0.75rem' }}>
              Strategy Groups
              <code style={{ marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 'normal' }}>{profile.id}</code>
            </h4>

            {profile.strategyGroups?.length > 0 ? (
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {getSortedGroups(profile.strategyGroups).map((group, idx) => {
                  const groupTotalWeight = group.strategies.reduce((sum, s) => sum + s.weight, 0);
                  return (
                    <div
                      key={idx}
                      style={{
                        background: group.conditions ? 'rgba(147, 51, 234, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                        border: `1px solid ${group.conditions ? 'rgba(147, 51, 234, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                        borderRadius: '6px',
                        padding: '0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <strong style={{ fontSize: '0.85rem' }}>{group.name || 'Unnamed Group'}</strong>
                          <span style={{
                            background: 'rgba(0,0,0,0.3)',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            color: 'var(--arctic-frost)'
                          }}>
                            priority: {group.priority}
                          </span>
                        </div>
                        {!group.conditions && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--gold-accent)' }}>fallback</span>
                        )}
                      </div>

                      {/* Group conditions */}
                      {group.conditions && (
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                          {group.conditions.tags?.length > 0 && (
                            <span style={{
                              background: 'rgba(59, 130, 246, 0.3)',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '3px',
                              fontSize: '0.65rem'
                            }}>
                              tags: {group.conditions.tags.join(', ')}
                            </span>
                          )}
                          {group.conditions.prominence?.length > 0 && (
                            <span style={{
                              background: 'rgba(147, 51, 234, 0.3)',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '3px',
                              fontSize: '0.65rem'
                            }}>
                              {group.conditions.prominence.join(', ')}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Strategies in group */}
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {group.strategies.map((strategy, sIdx) => (
                          <span
                            key={sIdx}
                            style={{
                              background: getStrategyColor(strategy.type),
                              border: `1px solid ${getStrategyBorder(strategy.type)}`,
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <span style={{ textTransform: 'capitalize' }}>{strategy.type}</span>
                            <span style={{ color: 'var(--gold-accent)', fontWeight: 'bold' }}>
                              {groupTotalWeight > 0 ? ((strategy.weight / groupTotalWeight) * 100).toFixed(0) : 0}%
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="info">No strategy groups configured.</div>
            )}
          </div>

          {/* Right column - Test Panel */}
          <div style={{
            background: 'rgba(30, 58, 95, 0.3)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            padding: '1rem',
            position: 'sticky',
            top: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Test Names</h4>
              <button
                className="primary"
                onClick={() => handleTestNames(10)}
                disabled={testLoading}
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              >
                {testLoading ? '...' : 'Generate'}
              </button>
            </div>

            {testError && (
              <div className="error" style={{ marginBottom: '0.75rem', fontSize: '0.8rem', padding: '0.5rem' }}>
                {testError}
              </div>
            )}

            {strategyUsage && (
              <div style={{
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '4px',
                padding: '0.5rem',
                marginBottom: '0.75rem',
                fontSize: '0.75rem'
              }}>
                {Object.entries(strategyUsage)
                  .filter(([, count]) => count > 0)
                  .map(([strategy, count]) => (
                    <span key={strategy} style={{
                      display: 'inline-block',
                      marginRight: '0.5rem',
                      color: strategy === 'phonotactic' ? 'rgba(96, 165, 250, 1)' :
                             strategy === 'grammar' ? 'rgba(167, 139, 250, 1)' :
                             'rgba(74, 222, 128, 1)'
                    }}>
                      {strategy}: {count}
                    </span>
                  ))}
              </div>
            )}

            {testNames.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '400px', overflowY: 'auto' }}>
                {testNames.map((name, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(20, 45, 75, 0.5)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      color: 'var(--gold-accent)'
                    }}
                  >
                    {name}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
                Click Generate to test your profile
              </p>
            )}
          </div>
        </div>
      )}

      {/* No profile yet */}
      {!editing && !profile && (
        <div className="info" style={{ marginTop: '1.5rem' }}>
          No profile configured yet. Click "Auto-Generate Profile" above to create one automatically.
        </div>
      )}

      {/* Conditions Modal - for editing group conditions */}
      {editing && editedProfile && (
        <ConditionsModal
          isOpen={conditionsModalOpen}
          onClose={() => {
            setConditionsModalOpen(false);
            setEditingGroupIdx(null);
          }}
          conditions={editingGroupIdx !== null ? editedProfile.strategyGroups[editingGroupIdx]?.conditions : undefined}
          onChange={(newConditions) => {
            if (editingGroupIdx !== null) {
              const groups = [...editedProfile.strategyGroups];
              groups[editingGroupIdx] = { ...groups[editingGroupIdx], conditions: newConditions || null };
              setEditedProfile({ ...editedProfile, strategyGroups: groups });
            }
          }}
        />
      )}
    </div>
  );
}

export default EntityWorkspace;
