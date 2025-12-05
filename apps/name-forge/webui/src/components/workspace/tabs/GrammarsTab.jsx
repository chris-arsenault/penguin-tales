import { useState, useEffect, useRef } from 'react';
import { MARKOV_MODELS, CONTEXT_KEYS, COMMON_LITERALS } from '../../constants';
import { getEffectiveDomain } from '../../utils';

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
        <div className="tab-header">
          <h3 className="mt-0">Context-Free Grammars</h3>
          <div className="flex gap-sm">
            <button className="secondary" onClick={() => setShowHelp(true)}>? Help</button>
            <button className="primary" onClick={handleAddNew}>+ New Grammar</button>
          </div>
        </div>

        <p className="text-muted mb-md">
          Grammars define structured name patterns shared across all entity types in this culture.
          Use <code>slot:lexeme_id</code> to reference lexeme lists.
        </p>

        {grammars.length === 0 ? (
          <div className="empty-state-card">
            <p className="mt-0 mb-0">No grammars yet.</p>
            <p className="text-muted mt-sm mb-0">
              Create lexeme lists first, then define grammars to structure names.
            </p>
          </div>
        ) : (
          <div className="grid gap-sm">
            {grammars.map((grammar) => (
              <div key={grammar.id} className="grammar-card">
                <div className="flex justify-between align-start">
                  <div>
                    <strong>{grammar.id}</strong>
                    <div className="text-small text-muted mt-xs">
                      Start: <code>{grammar.start}</code> • {Object.keys(grammar.rules || {}).length} rules
                      {grammar.capitalization && <> • Case: <code>{grammar.capitalization}</code></>}
                    </div>
                  </div>
                  <div className="flex gap-sm">
                    <button className="secondary text-small" onClick={() => handleEdit(grammar)}>
                      Edit
                    </button>
                    <button className="danger text-small" onClick={() => handleDelete(grammar.id)}>
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
      <div className="tab-header">
        <h3 className="mt-0">{editingGrammar === 'new' ? 'New Grammar' : 'Edit Grammar'}</h3>
        <div className="flex gap-sm">
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

      <h4 className="mt-lg mb-md">Production Rules</h4>

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
            variant="gold"
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
          variant="purple"
        />

        {/* Entity Linkage */}
        <EntityLinkageSection onInsert={insertIntoRule} />

        {/* Common literals */}
        <ClickToInsertSection
          title="Common Literals"
          items={COMMON_LITERALS.map(lit => ({ code: lit, title: lit }))}
          onInsert={insertIntoRule}
          variant="muted"
        />
      </CollapsiblePanel>

      {/* Add rule form */}
      <div className="rule-form">
        <div className="flex gap-sm mb-sm">
          <input
            className="rule-key-input"
            value={newRuleKey}
            onChange={(e) => setNewRuleKey(e.target.value)}
            placeholder="Non-terminal"
          />
          <span className="rule-arrow">→</span>
          <input
            className="flex-1"
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
        <div className="mb-lg">
          <h4 className="mb-sm">Current Rules</h4>
          {Object.entries(formData.rules).map(([key, productions]) => (
            <div key={key} className="rule-card">
              <div className="font-mono text-small">
                <strong className="text-gold">{key}</strong>
                <span className="text-muted"> → </span>
                {productions.map((prod, i) => (
                  <span key={i}>
                    <span className="text-light">{prod.join(' ')}</span>
                    {i < productions.length - 1 && <span className="text-muted"> | </span>}
                  </span>
                ))}
              </div>
              <button
                className="danger btn-xs"
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
    <div className="collapsible-panel">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`collapsible-header ${expanded ? 'expanded' : ''}`}
      >
        <span>{title}</span>
        <span className={`collapsible-arrow ${expanded ? 'expanded' : ''}`}>▼</span>
      </button>
      {expanded && (
        <div className="collapsible-content">
          {children}
        </div>
      )}
    </div>
  );
}

function ClickToInsertSection({ title, subtitle, items, onInsert, variant = 'blue' }) {
  return (
    <div className={`insert-panel ${variant}`}>
      <div className="insert-panel-title">
        <strong>{title}</strong> {subtitle && <span className="text-muted">{subtitle}</span>}
      </div>
      <div className="flex flex-wrap gap-sm">
        {items.map(({ code, title: itemTitle }) => (
          <code
            key={code}
            className={`insert-chip ${variant}`}
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
    <div className="insert-panel domain">
      <div className="insert-panel-title text-purple">
        <strong>Domain: {effectiveDomain.id}</strong>
      </div>

      <div className="mb-sm">
        <code
          className="insert-chip gold domain-chip"
          onClick={() => onInsert(`domain:${effectiveDomain.id}`)}
          title="Generate phonotactic name from this domain"
        >
          domain:{effectiveDomain.id}
        </code>
        <span className="text-xs text-muted ml-sm">
          (generates phonotactic names)
        </span>
      </div>

      {effectiveDomain.morphology?.prefixes?.length > 0 && (
        <div className="mb-sm">
          <span className="text-xs text-muted">Prefixes: </span>
          {effectiveDomain.morphology.prefixes.slice(0, 8).map((p, i) => (
            <code
              key={i}
              className="morph-chip"
              onClick={() => onInsert(p)}
            >
              {p}
            </code>
          ))}
        </div>
      )}

      {effectiveDomain.morphology?.suffixes?.length > 0 && (
        <div>
          <span className="text-xs text-muted">Suffixes: </span>
          {effectiveDomain.morphology.suffixes.slice(0, 8).map((s, i) => (
            <code
              key={i}
              className="morph-chip"
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
    <div className="insert-panel green">
      <div className="insert-panel-title text-green">
        <strong>Entity Linkage</strong> (uses related entity names from KG)
      </div>
      <div className="flex flex-wrap gap-sm mb-sm">
        {CONTEXT_KEYS.npcRelations.map(({ key, desc }) => (
          <code
            key={key}
            className="insert-chip green"
            onClick={() => onInsert(`context:${key}`)}
            title={desc}
          >
            context:{key}
          </code>
        ))}
      </div>
      <div className="flex flex-wrap gap-sm">
        {CONTEXT_KEYS.locationFactionRelations.map(({ key, desc }) => (
          <code
            key={key}
            className="insert-chip green"
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tab-header mb-md">
          <h3 className="mt-0">Context-Free Grammars</h3>
          <button className="secondary" onClick={onClose}>Close</button>
        </div>

        <div className="help-content">
          <p>CFGs define structured patterns for name generation.</p>

          <h4>Example</h4>
          <div className="code-block">
            <div>name → adj - noun</div>
            <div>adj → slot:adjectives</div>
            <div>noun → slot:nouns</div>
          </div>
          <p className="text-small">→ "Swift-Scale", "Dark-Fang"</p>

          <h4>Syntax</h4>
          <ul className="text-small">
            <li><code>slot:id</code> - Lexeme list</li>
            <li><code>domain:id</code> - Phonotactic name</li>
            <li><code>markov:id</code> - Markov chain name</li>
            <li><code>context:key</code> - Related entity name</li>
            <li><code>^suffix</code> - Attach suffix (e.g., <code>^'s</code>)</li>
            <li><code>|</code> - Alternatives</li>
          </ul>

          <h4>Capitalization</h4>
          <p className="text-small">
            Controls how the final generated name is formatted:
          </p>
          <ul className="text-small">
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
