import { useState, useEffect, useRef } from 'react';
import { MARKOV_MODELS, CONTEXT_KEYS, COMMON_LITERALS } from '../constants';
import { getEffectiveDomain } from '../utils';

function GrammarsTab({ cultureId, cultureConfig, onGrammarsChange }) {
  const [mode, setMode] = useState('view');
  const [editingGrammar, setEditingGrammar] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [formData, setFormData] = useState({
    id: `${cultureId}_grammar`,
    start: 'name',
    capitalization: '',
    rules: {}
  });
  const [newRuleKey, setNewRuleKey] = useState('');
  const [newRuleValue, setNewRuleValue] = useState('');

  // Autosave refs
  const autosaveTimeoutRef = useRef(null);
  const lastSavedFormDataRef = useRef(null);

  const grammars = cultureConfig?.grammars || [];
  const lexemeLists = cultureConfig?.lexemeLists || {};
  const effectiveDomain = getEffectiveDomain(cultureConfig);

  // Autosave effect
  useEffect(() => {
    if (mode !== 'edit' || !editingGrammar) return;

    const formDataStr = JSON.stringify(formData);
    if (formDataStr === lastSavedFormDataRef.current) return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      if (!formData.id.trim()) return;

      const newGrammars = editingGrammar === 'new'
        ? [...grammars.filter(g => g.id !== formData.id), formData]
        : grammars.map(g => g.id === editingGrammar ? formData : g);

      onGrammarsChange(newGrammars);
      lastSavedFormDataRef.current = formDataStr;
    }, 1000);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [formData, mode, editingGrammar]);

  useEffect(() => {
    if (mode === 'view') {
      lastSavedFormDataRef.current = null;
    }
  }, [mode]);

  const handleAddRule = () => {
    if (!newRuleKey.trim() || !newRuleValue.trim()) return;

    const newProductions = newRuleValue.split('|').map(p =>
      p.trim().split(/\s+/).filter(s => s)
    ).filter(p => p.length > 0);

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
      ? [...grammars.filter(g => g.id !== formData.id), formData]
      : grammars.map(g => g.id === editingGrammar ? formData : g);

    onGrammarsChange(newGrammars);
    setMode('view');
    setEditingGrammar(null);
  };

  const handleDelete = (id) => {
    const newGrammars = grammars.filter(g => g.id !== id);
    onGrammarsChange(newGrammars);
  };

  const handleEdit = (grammar) => {
    setEditingGrammar(grammar.id);
    setFormData(grammar);
    setMode('edit');
  };

  const handleAddNew = () => {
    setEditingGrammar('new');
    setFormData({
      id: `${cultureId}_grammar`,
      start: 'name',
      capitalization: '',
      rules: {}
    });
    setMode('edit');
  };

  const insertIntoRule = (text) => {
    setNewRuleValue(prev => prev ? `${prev} ${text}` : text);
  };

  // Get available lexeme lists
  const availableLexemeLists = Object.keys(lexemeLists).map(id => ({ id, source: 'local' }));

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
          Grammars define structured name patterns shared across all entity types in this culture.
          Use <code>slot:lexeme_id</code> to reference lexeme lists.
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
            {grammars.map((grammar) => (
              <div
                key={grammar.id}
                style={{
                  background: 'rgba(30, 58, 95, 0.3)',
                  padding: '0.75rem 1rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong>{grammar.id}</strong>
                    <div style={{ fontSize: '0.875rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                      Start: <code>{grammar.start}</code> • {Object.keys(grammar.rules || {}).length} rules
                      {grammar.capitalization && <> • Case: <code>{grammar.capitalization}</code></>}
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
            ))}
          </div>
        )}

        {showHelp && <GrammarHelpModal onClose={() => setShowHelp(false)} />}
      </div>
    );
  }

  // Edit mode
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>{editingGrammar === 'new' ? 'New Grammar' : 'Edit Grammar'}</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="primary" onClick={handleSave}>Save</button>
          <button className="secondary" onClick={() => { setMode('view'); setEditingGrammar(null); }}>Cancel</button>
        </div>
      </div>

      <div className="form-group">
        <label>Grammar ID</label>
        <input
          value={formData.id}
          onChange={(e) => setFormData({ ...formData, id: e.target.value })}
          placeholder={`${cultureId}_grammar`}
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

      <div className="form-group">
        <label>Capitalization</label>
        <select
          value={formData.capitalization || ''}
          onChange={(e) => setFormData({ ...formData, capitalization: e.target.value || undefined })}
        >
          <option value="">None</option>
          <option value="titleWords">Each Word Capitalized</option>
          <option value="title">First Letter Only</option>
          <option value="allcaps">ALL CAPS</option>
          <option value="lowercase">lowercase</option>
          <option value="mixed">MiXeD (alternating)</option>
        </select>
        <small className="text-muted">
          e.g., "king of north" → {formData.capitalization === 'titleWords' ? '"King Of North"' :
            formData.capitalization === 'title' ? '"King of north"' :
            formData.capitalization === 'allcaps' ? '"KING OF NORTH"' :
            formData.capitalization === 'lowercase' ? '"king of north"' :
            formData.capitalization === 'mixed' ? '"KiNg Of NoRtH"' : 'unchanged'}
        </small>
      </div>

      <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Production Rules</h4>

      {/* Collapsible Click-to-Insert Panel */}
      <CollapsiblePanel title="Click to Insert" defaultExpanded={true}>
        {/* Click-to-insert: Lexeme Lists */}
        {availableLexemeLists.length > 0 && (
          <ClickToInsertSection
            title="Lexeme Lists"
            items={availableLexemeLists.map(({ id }) => ({
              code: `slot:${id}`,
              title: 'Lexeme list'
            }))}
            onInsert={insertIntoRule}
            background="rgba(59, 130, 246, 0.15)"
            borderColor="rgba(59, 130, 246, 0.3)"
            textColor="var(--gold-accent)"
          />
        )}

        {/* Click-to-insert: Domain Phonology */}
        {effectiveDomain && (
          <DomainInsertSection
            effectiveDomain={effectiveDomain}
            onInsert={insertIntoRule}
          />
        )}

        {/* Click-to-insert: Markov Chain Models */}
        <ClickToInsertSection
          title="Markov Chain Models"
          subtitle="(statistically-generated names)"
          items={MARKOV_MODELS.map(({ id, name, desc }) => ({
            code: `markov:${id}`,
            title: `${name}: ${desc}`
          }))}
          onInsert={insertIntoRule}
          background="rgba(168, 85, 247, 0.15)"
          borderColor="rgba(168, 85, 247, 0.4)"
          textColor="#c084fc"
        />

        {/* Entity Linkage */}
        <EntityLinkageSection onInsert={insertIntoRule} />

        {/* Common literals */}
        <ClickToInsertSection
          title="Common Literals"
          items={COMMON_LITERALS.map(lit => ({ code: lit, title: lit }))}
          onInsert={insertIntoRule}
          background="rgba(30, 58, 95, 0.3)"
          borderColor="rgba(59, 130, 246, 0.2)"
          textColor="var(--arctic-frost)"
        />
      </CollapsiblePanel>

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

    </div>
  );
}

// Helper components
function CollapsiblePanel({ title, defaultExpanded = true, children }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div style={{
      background: 'rgba(30, 58, 95, 0.2)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      borderRadius: '8px',
      marginBottom: '1rem',
      overflow: 'hidden'
    }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          background: 'rgba(30, 58, 95, 0.4)',
          border: 'none',
          borderBottom: expanded ? '1px solid rgba(59, 130, 246, 0.3)' : 'none',
          color: 'var(--text-color)',
          cursor: 'pointer',
          fontSize: '0.85rem',
          fontWeight: 'bold'
        }}
      >
        <span>{title}</span>
        <span style={{
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          fontSize: '0.75rem'
        }}>
          ▼
        </span>
      </button>
      {expanded && (
        <div style={{ padding: '0.75rem' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ClickToInsertSection({ title, subtitle, items, onInsert, background, borderColor, textColor }) {
  return (
    <div style={{
      background,
      padding: '0.75rem',
      borderRadius: '6px',
      marginBottom: '1rem',
      border: `1px solid ${borderColor}`
    }}>
      <div style={{ fontSize: '0.75rem', color: textColor, marginBottom: '0.5rem' }}>
        <strong>{title}</strong> {subtitle && <span style={{ color: 'var(--arctic-frost)' }}>{subtitle}</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {items.map(({ code, title: itemTitle }) => (
          <code
            key={code}
            style={{
              background: 'rgba(10, 25, 41, 0.8)',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              color: textColor,
              cursor: 'pointer',
              fontSize: '0.75rem',
              border: `1px solid ${borderColor}`
            }}
            onClick={() => onInsert(code)}
            title={itemTitle}
          >
            {code}
          </code>
        ))}
      </div>
    </div>
  );
}

function DomainInsertSection({ effectiveDomain, onInsert }) {
  return (
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
          onClick={() => onInsert(`domain:${effectiveDomain.id}`)}
          title="Generate phonotactic name from this domain"
        >
          domain:{effectiveDomain.id}
        </code>
        <span style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)', marginLeft: '0.5rem' }}>
          (generates phonotactic names)
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
              onClick={() => onInsert(p)}
            >
              {p}
            </code>
          ))}
        </div>
      )}

      {effectiveDomain.morphology?.suffixes?.length > 0 && (
        <div>
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
              onClick={() => onInsert(s)}
            >
              {s}
            </code>
          ))}
        </div>
      )}
    </div>
  );
}

function EntityLinkageSection({ onInsert }) {
  return (
    <div style={{
      background: 'rgba(34, 197, 94, 0.15)',
      padding: '0.75rem',
      borderRadius: '6px',
      marginBottom: '1rem',
      border: '1px solid rgba(34, 197, 94, 0.3)'
    }}>
      <div style={{ fontSize: '0.75rem', color: 'rgb(134, 239, 172)', marginBottom: '0.5rem' }}>
        <strong>Entity Linkage</strong> (uses related entity names from KG)
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {CONTEXT_KEYS.npcRelations.map(({ key, desc }) => (
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
            onClick={() => onInsert(`context:${key}`)}
            title={desc}
          >
            context:{key}
          </code>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {CONTEXT_KEYS.locationFactionRelations.map(({ key, desc }) => (
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
            onClick={() => onInsert(`context:${key}`)}
            title={desc}
          >
            context:{key}
          </code>
        ))}
      </div>
    </div>
  );
}

function GrammarHelpModal({ onClose }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem'
    }} onClick={onClose}>
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
          <button className="secondary" onClick={onClose}>Close</button>
        </div>

        <div style={{ lineHeight: '1.6' }}>
          <p>CFGs define structured patterns for name generation.</p>

          <h4>Example</h4>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.875rem' }}>
            <div>name → adj - noun</div>
            <div>adj → slot:adjectives</div>
            <div>noun → slot:nouns</div>
          </div>
          <p style={{ fontSize: '0.875rem' }}>→ "Swift-Scale", "Dark-Fang"</p>

          <h4>Syntax</h4>
          <ul style={{ fontSize: '0.875rem' }}>
            <li><code>slot:id</code> - Lexeme list</li>
            <li><code>domain:id</code> - Phonotactic name</li>
            <li><code>markov:id</code> - Markov chain name</li>
            <li><code>context:key</code> - Related entity name</li>
            <li><code>^suffix</code> - Attach suffix (e.g., <code>^'s</code>)</li>
            <li><code>|</code> - Alternatives</li>
          </ul>

          <h4>Capitalization</h4>
          <p style={{ fontSize: '0.875rem' }}>
            Controls how the final generated name is formatted:
          </p>
          <ul style={{ fontSize: '0.875rem' }}>
            <li><strong>Each Word Capitalized</strong> - "king of north" → "King Of North"</li>
            <li><strong>First Letter Only</strong> - "king of north" → "King of north"</li>
            <li><strong>ALL CAPS / lowercase</strong> - Force case</li>
            <li><strong>MiXeD</strong> - "king of north" → "KiNg Of NoRtH"</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default GrammarsTab;
