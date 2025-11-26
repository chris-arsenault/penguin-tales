import { useState } from 'react';
import { LEXEME_CATEGORIES } from '../constants';

function LexemesTab({ cultureId, cultureConfig, onLexemesChange, apiKey }) {
  const [mode, setMode] = useState('view'); // 'view', 'create-spec', 'create-manual', 'edit-list'
  const [selectedList, setSelectedList] = useState(null);
  const [editingListId, setEditingListId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form state for spec creation
  const [specForm, setSpecForm] = useState({
    id: `${cultureId}_nouns`,
    pos: 'noun',
    style: '',
    targetCount: 30,
    qualityFilter: { minLength: 3, maxLength: 15 }
  });

  // Form state for manual/edit list
  const [listForm, setListForm] = useState({
    id: '',
    description: '',
    entries: '',
    source: 'manual'
  });

  // Get culture-level lexeme data
  const lexemeLists = cultureConfig?.lexemeLists || {};
  const lexemeSpecs = cultureConfig?.lexemeSpecs || [];

  const handleSaveSpec = () => {
    const newSpec = {
      ...specForm,
      cultureId
    };

    const updatedSpecs = [...lexemeSpecs.filter(s => s.id !== newSpec.id), newSpec];
    onLexemesChange(undefined, updatedSpecs);
    setMode('view');
    setSpecForm({
      id: `${cultureId}_nouns`,
      pos: 'noun',
      style: '',
      targetCount: 30,
      qualityFilter: { minLength: 3, maxLength: 15 }
    });
  };

  const handleDeleteSpec = (specId) => {
    const updatedSpecs = lexemeSpecs.filter(s => s.id !== specId);
    onLexemesChange(undefined, updatedSpecs);
  };

  const handleSaveList = () => {
    if (!listForm.id.trim()) {
      setError('Please enter a list ID');
      return;
    }

    const entries = listForm.entries
      .split(/[\n,]/)
      .map(e => e.trim())
      .filter(e => e);

    if (entries.length === 0) {
      setError('Please enter at least one entry');
      return;
    }

    const newList = {
      id: listForm.id,
      description: listForm.description || (listForm.source === 'manual' ? 'Manual list' : 'Generated list'),
      entries: entries,
      source: listForm.source
    };

    const updatedLists = {
      ...lexemeLists,
      [listForm.id]: newList
    };

    onLexemesChange(updatedLists, undefined);
    setMode('view');
    setEditingListId(null);
    setListForm({ id: '', description: '', entries: '', source: 'manual' });
    setError(null);
  };

  const handleEditList = (listId) => {
    const list = lexemeLists[listId];
    if (list) {
      setListForm({
        id: list.id,
        description: list.description || '',
        entries: list.entries?.join('\n') || '',
        source: list.source || 'manual'
      });
      setEditingListId(listId);
      setMode('edit-list');
    }
  };

  const handleCreateManual = () => {
    setListForm({
      id: `${cultureId}_manual`,
      description: '',
      entries: '',
      source: 'manual'
    });
    setEditingListId(null);
    setMode('create-manual');
  };

  const handleGenerate = async (spec) => {
    if (!apiKey) {
      setError('API key required. Click "Set API Key" in the header to enter your Anthropic API key.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const entries = await generateLexemesWithAnthropic(spec, apiKey);

      const newList = {
        id: spec.id,
        description: `Generated ${spec.pos} list: ${spec.style || 'classic fantasy'}`,
        entries: entries,
        source: 'llm'
      };

      const updatedLists = {
        ...lexemeLists,
        [spec.id]: newList
      };

      onLexemesChange(updatedLists, undefined);
      setSelectedList(spec.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate lexemes by calling Anthropic API directly
  async function generateLexemesWithAnthropic(spec, key) {
    const categoryExamples = {
      // Grammatical
      noun: 'stone, river, blade, crown, throne, gate, tower, shield, helm, banner',
      verb: 'forge, shatter, bind, reign, wander, smite, kindle, quell, rend, wield',
      adjective: 'ancient, dark, swift, noble, fierce, silent, golden, cursed, eternal, fell',
      abstract: 'fate, doom, glory, honor, wrath, sorrow, valor, wisdom, dread, hope',

      // Name components
      title: 'Lord, Lady, King, Queen, Duke, Baron, Count, Knight, Magister, Archon',
      epithet: 'the Bold, the Wise, the Grim, the Fair, the Silent, the Undying, the Accursed',
      prefix: 'Arch-, High-, Dark-, Ever-, All-, Half-, Blood-, Storm-, Iron-, Shadow-',
      suffix: '-born, -bane, -heart, -ward, -kin, -fall, -hold, -song, -sworn, -slayer',
      connector: 'of, the, von, de, el, al-, ibn, mac, van, zur',

      // Semantic categories
      place: 'vale, mount, hold, haven, ford, dell, tor, mere, fen, citadel',
      creature: 'wolf, raven, wyrm, drake, stag, serpent, hawk, bear, lion, phoenix',
      element: 'fire, storm, shadow, frost, thunder, flame, wind, ash, lightning, void',
      material: 'iron, gold, stone, bone, silver, bronze, obsidian, crystal, mithril, oak',
      celestial: 'star, moon, sun, dawn, dusk, comet, eclipse, aurora, zenith, constellation',
      color: 'black, silver, crimson, pale, azure, golden, scarlet, ivory, obsidian, amber',
      kinship: 'son, daughter, heir, scion, blood, kin, child, father, mother, ancestor',
      occupation: 'smith, hunter, keeper, warden, seeker, herald, sentinel, scribe, reaver, sage',
      virtue: 'valor, honor, wisdom, justice, mercy, courage, faith, hope, truth, grace',
      vice: 'wrath, greed, pride, envy, sloth, malice, treachery, cruelty, deceit, corruption',
      number: 'first, second, third, twin, seven, hundred, thousand, prime, last, eternal',
    };

    const category = LEXEME_CATEGORIES[spec.pos];
    const examples = categoryExamples[spec.pos] || categoryExamples.noun;
    const categoryDesc = category?.desc || 'words';

    const prompt = `Generate ${spec.targetCount || 30} unique ${spec.pos || 'noun'} lexemes for a fantasy name generator.

Category: ${category?.label || spec.pos} - ${categoryDesc}
Style/theme: ${spec.style || 'classic fantasy'}

Examples of what I need: ${examples}

These are SEMANTIC BUILDING BLOCKS that will be combined into names via grammar rules like:
- "[title] [name] [epithet]" → "Lord Ashford the Grim"
- "[prefix][noun][suffix]" → "Stormborn"
- "[adj] [place]" → "Fell Hold"

Requirements:
- Each entry should be ${spec.qualityFilter?.minLength || 3}-${spec.qualityFilter?.maxLength || 15} characters
- Words must have clear meaning or evocative associations
- Match the style/theme if provided
- Variety is important - avoid repetitive patterns
- For prefixes/suffixes, include the hyphen (e.g., "Storm-", "-born")

Return ONLY a JSON array of strings, nothing else.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '[]';

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const entries = JSON.parse(jsonMatch[0]);
        return entries.filter(e =>
          typeof e === 'string' &&
          e.length >= (spec.qualityFilter?.minLength || 3) &&
          e.length <= (spec.qualityFilter?.maxLength || 15)
        );
      }
      throw new Error('No valid JSON array in response');
    } catch (parseErr) {
      throw new Error(`Failed to parse response: ${parseErr.message}`);
    }
  }

  const handleDeleteList = (listId) => {
    const updatedLists = { ...lexemeLists };
    delete updatedLists[listId];
    onLexemesChange(updatedLists, undefined);
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
            <button className="secondary" onClick={handleCreateManual}>
              + Manual List
            </button>
          </div>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Lexeme lists are semantic building blocks shared across all entity types in this culture.
          {!apiKey && (
            <span style={{ display: 'block', marginTop: '0.5rem', color: 'rgb(251, 191, 36)' }}>
              Set your API key in the header to enable LLM generation.
            </span>
          )}
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {/* Lexeme Specs Section */}
        {lexemeSpecs.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ marginBottom: '0.5rem' }}>Generation Specs ({lexemeSpecs.length})</h4>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {lexemeSpecs.map(spec => {
                const hasGenerated = lexemeLists[spec.id];
                const category = LEXEME_CATEGORIES[spec.pos];
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
                        {category?.label || spec.pos} • {spec.targetCount} words
                        {spec.style && ` • ${spec.style.substring(0, 40)}${spec.style.length > 40 ? '...' : ''}`}
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
              Lexeme Lists ({Object.keys(lexemeLists).length})
            </h4>

            {Object.keys(lexemeLists).length === 0 ? (
              <div style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '6px',
                padding: '1.5rem',
                textAlign: 'center'
              }}>
                <p style={{ margin: 0 }}>No lexeme lists yet.</p>
                <p className="text-muted" style={{ marginTop: '0.5rem' }}>
                  Create a spec and generate via LLM, or add a manual list.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {Object.entries(lexemeLists).map(([listId, list]) => {
                  const isSelected = selectedList === listId;

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
                      onClick={() => setSelectedList(listId)}
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
                          <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                            {list.entries?.length || 0} entries
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="secondary"
                            style={{ fontSize: '0.75rem' }}
                            onClick={(e) => { e.stopPropagation(); handleEditList(listId); }}
                          >
                            Edit
                          </button>
                          <button
                            className="danger"
                            style={{ fontSize: '0.75rem' }}
                            onClick={(e) => { e.stopPropagation(); handleDeleteList(listId); }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected List Viewer */}
          {selectedList && lexemeLists[selectedList] && (
            <div style={{
              flex: '0 0 45%',
              background: 'rgba(30, 58, 95, 0.2)',
              borderRadius: '6px',
              padding: '1rem',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              maxHeight: '500px',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0 }}>{selectedList}</h4>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="secondary" style={{ fontSize: '0.75rem' }} onClick={() => handleEditList(selectedList)}>
                    Edit
                  </button>
                  <button className="secondary" style={{ fontSize: '0.75rem' }} onClick={() => setSelectedList(null)}>
                    Close
                  </button>
                </div>
              </div>

              {lexemeLists[selectedList].description && (
                <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                  {lexemeLists[selectedList].description}
                </p>
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
                {lexemeLists[selectedList].entries?.join('\n')}
              </div>
            </div>
          )}
        </div>

      </div>
    );
  }

  // Create Spec Mode
  if (mode === 'create-spec') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>New Lexeme Spec</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="primary" onClick={handleSaveSpec}>Save</button>
            <button className="secondary" onClick={() => setMode('view')}>Cancel</button>
          </div>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Define what kind of semantic building blocks to generate. These will be combined via grammar rules into names.
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="form-group">
          <label>Spec ID</label>
          <input
            value={specForm.id}
            onChange={(e) => setSpecForm({ ...specForm, id: e.target.value })}
            placeholder={`${cultureId}_nouns`}
          />
          <small className="text-muted">Unique identifier for this spec. Use with <code>slot:{specForm.id || 'id'}</code> in grammars.</small>
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label>Category</label>
            <select
              value={specForm.pos}
              onChange={(e) => setSpecForm({ ...specForm, pos: e.target.value })}
            >
              <optgroup label="Grammatical">
                {['noun', 'verb', 'adjective', 'abstract'].map(key => (
                  <option key={key} value={key}>{LEXEME_CATEGORIES[key].label}</option>
                ))}
              </optgroup>
              <optgroup label="Name Components">
                {['title', 'epithet', 'prefix', 'suffix', 'connector'].map(key => (
                  <option key={key} value={key}>{LEXEME_CATEGORIES[key].label}</option>
                ))}
              </optgroup>
              <optgroup label="Semantic">
                {['place', 'creature', 'element', 'material', 'celestial', 'color', 'kinship', 'occupation', 'virtue', 'vice', 'number'].map(key => (
                  <option key={key} value={key}>{LEXEME_CATEGORIES[key].label}</option>
                ))}
              </optgroup>
            </select>
            <small className="text-muted">{LEXEME_CATEGORIES[specForm.pos]?.desc}</small>
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
            placeholder="e.g., Norse-inspired, dark and brooding, elegant elvish, gritty medieval"
            rows={3}
          />
          <small className="text-muted">
            Describe the feel/theme. This guides the LLM to generate culturally appropriate words.
          </small>
        </div>

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

      </div>
    );
  }

  // Create Manual / Edit List Mode
  if (mode === 'create-manual' || mode === 'edit-list') {
    const isEditing = mode === 'edit-list';
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>{isEditing ? 'Edit List' : 'Create Manual List'}</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="primary" onClick={handleSaveList}>Save</button>
            <button className="secondary" onClick={() => { setMode('view'); setEditingListId(null); }}>Cancel</button>
          </div>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          {isEditing
            ? 'Edit the entries in this lexeme list. One entry per line.'
            : 'Manually create a lexeme list. Perfect for titles, connectors, and culture-specific terms.'}
        </p>

        {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="form-group">
          <label>List ID</label>
          <input
            value={listForm.id}
            onChange={(e) => setListForm({ ...listForm, id: e.target.value })}
            placeholder={`${cultureId}_titles`}
            disabled={isEditing}
          />
          <small className="text-muted">Use this ID with <code>slot:{listForm.id || 'list_id'}</code> in grammars</small>
        </div>

        <div className="form-group">
          <label>Description (optional)</label>
          <input
            value={listForm.description}
            onChange={(e) => setListForm({ ...listForm, description: e.target.value })}
            placeholder="e.g., Noble titles and honorifics"
          />
        </div>

        <div className="form-group">
          <label>Entries ({listForm.entries.split(/[\n,]/).filter(e => e.trim()).length} items)</label>
          <textarea
            value={listForm.entries}
            onChange={(e) => setListForm({ ...listForm, entries: e.target.value })}
            placeholder={`Enter one per line:\nLord\nLady\nSir\nMaster\nElder`}
            rows={12}
            style={{ fontFamily: 'monospace' }}
          />
          <small className="text-muted">
            One entry per line, or comma-separated. Empty lines are ignored.
          </small>
        </div>
      </div>
    );
  }

  return null;
}

export default LexemesTab;
