import { useState } from 'react';
import { DomainTab, LexemesTab, GrammarsTab, ProfileTab } from './tabs';

function EntityWorkspace({
  worldSchema,
  cultureId,
  cultureConfig,
  allCultures,
  activeTab = 'domain',
  onTabChange,
  onCultureChange,
  apiKey
}) {
  const [error, setError] = useState(null);

  // Use prop or fallback to local handling
  const setActiveTab = onTabChange || (() => {});

  if (!cultureId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        <p>Select a culture from the sidebar to begin</p>
      </div>
    );
  }

  // Handle domains change at culture level
  const handleDomainsChange = (newDomains) => {
    if (onCultureChange) {
      onCultureChange({
        ...cultureConfig,
        domains: newDomains
      });
    }
  };

  // Handle lexemes change at culture level
  const handleLexemesChange = (newLexemeLists, newLexemeSpecs) => {
    if (onCultureChange) {
      const updates = { ...cultureConfig };
      if (newLexemeLists !== undefined) updates.lexemeLists = newLexemeLists;
      if (newLexemeSpecs !== undefined) updates.lexemeSpecs = newLexemeSpecs;
      onCultureChange(updates);
    }
  };

  // Handle grammars change at culture level
  const handleGrammarsChange = (newGrammars) => {
    if (onCultureChange) {
      onCultureChange({
        ...cultureConfig,
        grammars: newGrammars
      });
    }
  };

  // Handle profiles change at culture level
  const handleProfilesChange = (newProfiles) => {
    if (onCultureChange) {
      onCultureChange({
        ...cultureConfig,
        profiles: newProfiles
      });
    }
  };

  const getCompletionBadge = (key) => {
    // Compute counts from culture-level data
    if (key === 'domain') {
      const count = cultureConfig?.domains?.length || 0;
      return count > 0 ? `(${count})` : '';
    } else if (key === 'lexemes') {
      const count = Object.keys(cultureConfig?.lexemeLists || {}).length;
      return count > 0 ? `(${count})` : '';
    } else if (key === 'grammars') {
      const count = (cultureConfig?.grammars || []).length;
      return count > 0 ? `(${count})` : '';
    } else if (key === 'profiles') {
      const count = (cultureConfig?.profiles || []).length;
      return count > 0 ? `(${count})` : '';
    }

    return '';
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
                {cultureConfig?.name || cultureId}
              </span>
              <span style={{ fontWeight: 'normal', fontSize: '0.9rem', color: 'var(--arctic-frost)', marginLeft: '0.5rem' }}>
                Culture
              </span>
            </h2>
            <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)' }}>
              Configure naming resources shared across all entity types
            </div>
          </div>

          <div style={{
            fontSize: '0.75rem',
            color: 'var(--arctic-frost)',
            opacity: 0.6
          }}>
            Auto-saved locally
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
        {['domain', 'lexemes', 'grammars', 'profiles'].map((tab) => (
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
            key={cultureId}
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
            onDomainsChange={handleDomainsChange}
          />
        )}

        {activeTab === 'lexemes' && (
          <LexemesTab
            key={cultureId}
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            onLexemesChange={handleLexemesChange}
            apiKey={apiKey}
          />
        )}

        {activeTab === 'grammars' && (
          <GrammarsTab
            key={cultureId}
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            onGrammarsChange={handleGrammarsChange}
          />
        )}

        {activeTab === 'profiles' && (
          <ProfileTab
            key={cultureId}
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            onProfilesChange={handleProfilesChange}
            worldSchema={worldSchema}
          />
        )}
      </div>
    </div>
  );
}

export default EntityWorkspace;
