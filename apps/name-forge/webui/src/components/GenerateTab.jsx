import { useState, useMemo } from 'react';
import { generateTestNames } from '../lib/browser-generator.js';

/**
 * Generate Tab - Full control over name generation
 */
function GenerateTab({ worldSchema, cultures }) {
  // Generation parameters
  const [selectedCulture, setSelectedCulture] = useState('');
  const [selectedKind, setSelectedKind] = useState('');
  const [selectedSubKind, setSelectedSubKind] = useState('');
  const [tags, setTags] = useState('');
  const [prominence, setProminence] = useState('');
  const [count, setCount] = useState(20);

  // Results
  const [generatedNames, setGeneratedNames] = useState([]);
  const [strategyUsage, setStrategyUsage] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  // Get available options from schema
  const cultureIds = Object.keys(cultures || {});
  const entityKinds = worldSchema?.hardState?.map(e => e.kind) || [];

  // Get subkinds for selected entity kind
  const subKinds = useMemo(() => {
    if (!selectedKind || !worldSchema?.hardState) return [];
    const entity = worldSchema.hardState.find(e => e.kind === selectedKind);
    return entity?.subtype || [];
  }, [selectedKind, worldSchema]);

  // Prominence levels
  const prominenceLevels = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

  // Get the profile and resources for generation
  const getGenerationContext = () => {
    if (!selectedCulture || !selectedKind) return null;

    const culture = cultures[selectedCulture];
    if (!culture) return null;

    const entityConfig = culture.entityConfigs?.[selectedKind];
    const profile = entityConfig?.profile;

    if (!profile) return null;

    // Collect domains from culture
    const domains = culture.domains || [];

    // Collect grammars from entity config
    const grammars = entityConfig?.grammars || [];

    // Collect lexemes - merge culture-wide and entity-specific
    const lexemes = {};

    // Add lexemes from this entity config
    if (entityConfig?.lexemeLists) {
      Object.entries(entityConfig.lexemeLists).forEach(([id, list]) => {
        lexemes[id] = list;
      });
    }

    // Add shared lexemes from other cultures/entities that apply here
    Object.values(cultures).forEach(cult => {
      Object.entries(cult.entityConfigs || {}).forEach(([kind, config]) => {
        Object.entries(config.lexemeLists || {}).forEach(([id, list]) => {
          if (lexemes[id]) return; // Don't override local

          const appliesTo = list.appliesTo || {};
          const cultureMatch = !appliesTo.cultures ||
            appliesTo.cultures.includes('*') ||
            appliesTo.cultures.includes(selectedCulture);
          const kindMatch = !appliesTo.entityKinds ||
            appliesTo.entityKinds.includes('*') ||
            appliesTo.entityKinds.includes(selectedKind);

          if (cultureMatch && kindMatch) {
            lexemes[id] = list;
          }
        });
      });
    });

    return { profile, domains, grammars, lexemes };
  };

  const handleGenerate = () => {
    setError(null);
    setGenerating(true);

    try {
      const context = getGenerationContext();

      if (!context) {
        throw new Error('No profile configured for this culture/entity combination');
      }

      const { profile, domains, grammars, lexemes } = context;

      // Parse tags
      const tagList = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t);

      // Generate names
      const result = generateTestNames({
        profile,
        domains,
        grammars,
        lexemes,
        count,
        seed: `generate-${Date.now()}`
      });

      setGeneratedNames(result.names || []);
      setStrategyUsage(result.strategyUsage || null);
    } catch (err) {
      setError(err.message);
      setGeneratedNames([]);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedNames.join('\n'));
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(generatedNames, null, 2));
  };

  // Check if we can generate
  const canGenerate = selectedCulture && selectedKind;
  const context = canGenerate ? getGenerationContext() : null;
  const hasProfile = !!context?.profile;

  return (
    <div style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Name Generator</h2>
      <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
        Generate names using configured profiles, domains, grammars, and lexemes.
      </p>

      <div style={{ display: 'flex', gap: '1.5rem', flex: 1, minHeight: 0 }}>
        {/* Left: Controls */}
        <div style={{ width: '350px', flexShrink: 0 }}>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Generation Settings</h3>

            {/* Culture Selection */}
            <div className="form-group">
              <label>Culture *</label>
              <select
                value={selectedCulture}
                onChange={(e) => setSelectedCulture(e.target.value)}
              >
                <option value="">Select a culture...</option>
                {cultureIds.map(id => (
                  <option key={id} value={id}>
                    {cultures[id]?.name || id}
                  </option>
                ))}
              </select>
            </div>

            {/* Entity Kind */}
            <div className="form-group">
              <label>Entity Kind *</label>
              <select
                value={selectedKind}
                onChange={(e) => {
                  setSelectedKind(e.target.value);
                  setSelectedSubKind('');
                }}
              >
                <option value="">Select entity type...</option>
                {entityKinds.map(kind => (
                  <option key={kind} value={kind}>{kind}</option>
                ))}
              </select>
            </div>

            {/* SubKind */}
            <div className="form-group">
              <label>Subtype</label>
              <select
                value={selectedSubKind}
                onChange={(e) => setSelectedSubKind(e.target.value)}
                disabled={subKinds.length === 0}
              >
                <option value="">Any subtype</option>
                {subKinds.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div className="form-group">
              <label>Tags</label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="noble, ancient, warrior"
              />
              <small className="text-muted">Comma-separated tags for conditional strategies</small>
            </div>

            {/* Prominence */}
            <div className="form-group">
              <label>Prominence</label>
              <select
                value={prominence}
                onChange={(e) => setProminence(e.target.value)}
              >
                <option value="">Any prominence</option>
                {prominenceLevels.map(level => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>

            {/* Count */}
            <div className="form-group">
              <label>Number of Names</label>
              <input
                type="number"
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                min={1}
                max={100}
              />
            </div>

            {/* Generate Button */}
            <button
              className="primary"
              onClick={handleGenerate}
              disabled={!canGenerate || !hasProfile || generating}
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {generating ? 'Generating...' : `Generate ${count} Names`}
            </button>

            {/* Status Messages */}
            {canGenerate && !hasProfile && (
              <div className="warning" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
                No profile configured for {selectedCulture}/{selectedKind}.
                Go to Workshop → Profile to create one.
              </div>
            )}

            {error && (
              <div className="error" style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
                {error}
              </div>
            )}
          </div>

          {/* Strategy Usage */}
          {strategyUsage && (
            <div className="card">
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>Strategy Usage</h4>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {Object.entries(strategyUsage)
                  .filter(([, count]) => count > 0)
                  .map(([strategy, stratCount]) => (
                    <span
                      key={strategy}
                      style={{
                        background: strategy === 'phonotactic' ? 'rgba(96, 165, 250, 0.2)' :
                                   strategy === 'grammar' ? 'rgba(167, 139, 250, 0.2)' :
                                   'rgba(74, 222, 128, 0.2)',
                        border: `1px solid ${
                          strategy === 'phonotactic' ? 'rgba(96, 165, 250, 0.4)' :
                          strategy === 'grammar' ? 'rgba(167, 139, 250, 0.4)' :
                          'rgba(74, 222, 128, 0.4)'
                        }`,
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}
                    >
                      {strategy}: {stratCount}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Profile Preview */}
          {context?.profile && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Active Profile</h4>
              <div style={{ fontSize: '0.8rem', color: 'var(--arctic-frost)' }}>
                <div><strong>ID:</strong> {context.profile.id}</div>
                <div><strong>Groups:</strong> {context.profile.strategyGroups?.length || 0}</div>
                <div><strong>Domains:</strong> {context.domains?.length || 0}</div>
                <div><strong>Grammars:</strong> {context.grammars?.length || 0}</div>
                <div><strong>Lexeme Lists:</strong> {Object.keys(context.lexemes || {}).length}</div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>
                Generated Names
                {generatedNames.length > 0 && (
                  <span style={{ fontWeight: 'normal', fontSize: '0.9rem', marginLeft: '0.5rem', color: 'var(--arctic-frost)' }}>
                    ({generatedNames.length})
                  </span>
                )}
              </h3>
              {generatedNames.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="secondary" style={{ fontSize: '0.8rem' }} onClick={handleCopy}>
                    Copy Text
                  </button>
                  <button className="secondary" style={{ fontSize: '0.8rem' }} onClick={handleCopyJson}>
                    Copy JSON
                  </button>
                </div>
              )}
            </div>

            {generatedNames.length === 0 ? (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--arctic-frost)',
                textAlign: 'center'
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: '1.1rem' }}>No names generated yet</p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                    Select a culture and entity type, then click Generate
                  </p>
                </div>
              </div>
            ) : (
              <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '0.5rem',
                alignContent: 'start'
              }}>
                {generatedNames.map((name, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(20, 45, 75, 0.5)',
                      padding: '0.75rem 1rem',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontSize: '1rem',
                      color: 'var(--gold-accent)',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onClick={() => navigator.clipboard.writeText(name)}
                    title="Click to copy"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(30, 58, 95, 0.7)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(20, 45, 75, 0.5)'}
                  >
                    {name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GenerateTab;
