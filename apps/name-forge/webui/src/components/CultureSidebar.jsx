import { useState } from 'react';

function CultureSidebar({
  cultures,
  selectedCulture,
  onSelectCulture,
  onCulturesChange
}) {
  const [creatingCulture, setCreatingCulture] = useState(false);
  const [newCultureId, setNewCultureId] = useState('');
  const [newCultureName, setNewCultureName] = useState('');
  const [error, setError] = useState(null);

  const handleCreateCulture = () => {
    if (!newCultureId.trim()) {
      setError('Culture ID is required');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(newCultureId)) {
      setError('Culture ID must be lowercase letters, numbers, and underscores only (no hyphens)');
      return;
    }

    if (cultures[newCultureId]) {
      setError('Culture ID already exists');
      return;
    }

    const cultureName = newCultureName || newCultureId;

    // Create new culture with culture-level resources
    const newCulture = {
      id: newCultureId,
      name: cultureName,
      domains: [],
      lexemeLists: {},
      lexemeSpecs: {},
      grammars: [],
      profiles: []
    };

    const updatedCultures = { ...cultures, [newCultureId]: newCulture };
    onCulturesChange(updatedCultures);

    // Select the new culture
    onSelectCulture(newCultureId);

    // Reset form
    setNewCultureId('');
    setNewCultureName('');
    setCreatingCulture(false);
    setError(null);
  };

  // Get resource counts for a culture
  const getResourceCounts = (culture) => {
    return {
      domains: culture?.domains?.length || 0,
      lexemes: Object.keys(culture?.lexemeLists || {}).length,
      grammars: culture?.grammars?.length || 0,
      profiles: culture?.profiles?.length || 0
    };
  };

  // Calculate completion based on having at least one of each resource
  const calculateCompletion = (culture) => {
    const counts = getResourceCounts(culture);
    let completed = 0;
    if (counts.domains > 0) completed++;
    if (counts.lexemes > 0) completed++;
    if (counts.grammars > 0) completed++;
    if (counts.profiles > 0) completed++;
    return Math.round((completed / 4) * 100);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ borderBottom: '1px solid var(--border-color)', padding: '1rem' }}>
        <h3 style={{ margin: 0, marginBottom: '1rem' }}>Cultures</h3>

        {!creatingCulture ? (
          <button
            className="primary"
            onClick={() => setCreatingCulture(true)}
            style={{ width: '100%' }}
          >
            + New Culture
          </button>
        ) : (
          <div style={{
            background: 'rgba(30, 58, 95, 0.3)',
            padding: '1rem',
            borderRadius: '6px',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            <div className="form-group">
              <label>Culture ID</label>
              <input
                type="text"
                value={newCultureId}
                onChange={(e) => setNewCultureId(e.target.value)}
                placeholder="elven"
              />
            </div>
            <div className="form-group">
              <label>Display Name</label>
              <input
                type="text"
                value={newCultureName}
                onChange={(e) => setNewCultureName(e.target.value)}
                placeholder="Elven"
              />
            </div>

            {error && (
              <div className="error" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                className="primary"
                onClick={handleCreateCulture}
                style={{ flex: 1 }}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setCreatingCulture(false);
                  setError(null);
                  setNewCultureId('');
                  setNewCultureName('');
                }}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        {Object.keys(cultures).length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#666', fontSize: '0.875rem' }}>
            No cultures yet. Create one to get started.
          </div>
        ) : (
          Object.values(cultures).map((culture) => {
            const completion = calculateCompletion(culture);
            const counts = getResourceCounts(culture);
            const isSelected = selectedCulture === culture.id;

            return (
              <div
                key={culture.id}
                onClick={() => onSelectCulture(culture.id)}
                style={{
                  marginBottom: '0.5rem',
                  border: isSelected
                    ? '2px solid var(--gold-accent)'
                    : '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px',
                  background: isSelected
                    ? 'rgba(255, 215, 0, 0.1)'
                    : 'rgba(30, 58, 95, 0.3)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(30, 58, 95, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'rgba(30, 58, 95, 0.3)';
                  }
                }}
              >
                <div style={{ padding: '0.75rem' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    {culture.name || culture.id}
                  </div>

                  {/* Resource counts */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.25rem',
                    fontSize: '0.7rem',
                    color: 'var(--arctic-frost)',
                    marginBottom: '0.5rem'
                  }}>
                    <span style={{
                      padding: '0.15rem 0.35rem',
                      background: counts.domains > 0 ? 'rgba(147, 51, 234, 0.2)' : 'rgba(0,0,0,0.2)',
                      borderRadius: '3px'
                    }}>
                      {counts.domains} domains
                    </span>
                    <span style={{
                      padding: '0.15rem 0.35rem',
                      background: counts.lexemes > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0,0,0,0.2)',
                      borderRadius: '3px'
                    }}>
                      {counts.lexemes} lexemes
                    </span>
                    <span style={{
                      padding: '0.15rem 0.35rem',
                      background: counts.grammars > 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(0,0,0,0.2)',
                      borderRadius: '3px'
                    }}>
                      {counts.grammars} grammars
                    </span>
                    <span style={{
                      padding: '0.15rem 0.35rem',
                      background: counts.profiles > 0 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(0,0,0,0.2)',
                      borderRadius: '3px'
                    }}>
                      {counts.profiles} profiles
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div style={{
                    width: '100%',
                    height: '4px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${completion}%`,
                      height: '100%',
                      background: completion === 100
                        ? 'var(--gold-accent)'
                        : 'linear-gradient(90deg, #3b82f6, #06b6d4)',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default CultureSidebar;
