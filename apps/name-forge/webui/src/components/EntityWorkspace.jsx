import { useState } from 'react';
import { DomainTab, LexemesTab, GrammarsTab, ProfileTab } from './tabs';

function EntityWorkspace({
  worldSchema,
  cultureId,
  entityKind,
  entityConfig,
  cultureConfig,
  allCultures,
  activeTab = 'domain',
  onTabChange,
  onConfigChange,
  onCultureChange,
  apiKey
}) {
  const [error, setError] = useState(null);

  // Use prop or fallback to local handling
  const setActiveTab = onTabChange || (() => {});

  if (!cultureId || !entityKind) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        <p>Select a culture and entity type from the sidebar to begin</p>
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

  // Auto-generate profile from existing domains and grammars
  const handleAutoGenerateProfile = () => {
    const strategies = [];
    const cultureDomains = cultureConfig?.domains || [];
    const grammars = entityConfig?.grammars || [];

    // Add grammar strategies for each grammar
    grammars.forEach((grammar, idx) => {
      strategies.push({
        type: 'grammar',
        weight: 0.5 / Math.max(grammars.length, 1),
        grammarId: grammar.id
      });
    });

    // Add phonotactic strategy if culture has domains
    if (cultureDomains.length > 0) {
      strategies.push({
        type: 'phonotactic',
        weight: 0.5,
        domainId: cultureDomains[0].id
      });
    }

    // Normalize weights
    const totalWeight = strategies.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight > 0) {
      strategies.forEach(s => {
        s.weight = s.weight / totalWeight;
      });
    }

    // Create profile with strategyGroups format
    const profile = {
      id: `${cultureId}_${entityKind}_profile`,
      strategyGroups: [
        {
          name: 'Default',
          priority: 0,
          conditions: null,
          strategies: strategies
        }
      ]
    };

    // Update entity config with new profile
    const updatedConfig = {
      ...entityConfig,
      profile,
      completionStatus: {
        ...entityConfig?.completionStatus,
        profile: true
      }
    };

    onConfigChange(updatedConfig);
  };

  // Check if culture has any domains (domains are now culture-level)
  const hasCultureDomains = () => {
    return (cultureConfig?.domains?.length || 0) > 0;
  };

  const getCompletionBadge = (key) => {
    // Compute status directly from data rather than stored completionStatus
    if (key === 'domain') {
      // Domains are now at culture level
      return hasCultureDomains() ? `(${cultureConfig.domains.length})` : '';
    } else if (key === 'lexemes') {
      const count = Object.keys(entityConfig?.lexemeLists || {}).length;
      return count > 0 ? `(${count})` : '';
    } else if (key === 'grammars') {
      const count = (entityConfig?.grammars || []).length;
      return count > 0 ? `(${count})` : '';
    } else if (key === 'profile') {
      return entityConfig?.profile ? '' : '';
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
            cultureId={cultureId}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
            onDomainsChange={handleDomainsChange}
          />
        )}

        {activeTab === 'lexemes' && (
          <LexemesTab
            cultureId={cultureId}
            entityKind={entityKind}
            entityConfig={entityConfig}
            onConfigChange={onConfigChange}
            worldSchema={worldSchema}
            cultureConfig={cultureConfig}
            allCultures={allCultures}
            apiKey={apiKey}
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

export default EntityWorkspace;
