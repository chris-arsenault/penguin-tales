import { useState } from 'react';

/**
 * SchemaLoader component
 *
 * Displays and allows editing of the world schema (cultures and entity types).
 * No longer loads from API - receives data from parent via props.
 */
function SchemaLoader({ worldSchema, cultures, onSchemaLoaded, onCulturesChange }) {
  const [newCultureId, setNewCultureId] = useState('');
  const [newCultureName, setNewCultureName] = useState('');
  const [newCultureDesc, setNewCultureDesc] = useState('');
  const [showAddCulture, setShowAddCulture] = useState(false);

  // Entity type editing state
  const [showAddEntity, setShowAddEntity] = useState(false);
  const [editingEntity, setEditingEntity] = useState(null);
  const [entityForm, setEntityForm] = useState({
    kind: '',
    subtype: '',
    status: ''
  });

  if (!worldSchema) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        <p>No schema loaded. Create a project to begin.</p>
      </div>
    );
  }

  const handleAddCulture = () => {
    if (!newCultureId.trim() || !newCultureName.trim()) return;

    const id = newCultureId.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (cultures[id]) {
      return; // Culture already exists
    }

    // Add to cultures object (single source of truth)
    const newCultures = {
      ...cultures,
      [id]: {
        id,
        name: newCultureName.trim(),
        description: newCultureDesc.trim() || undefined,
        domains: [],
        entityConfigs: {}
      }
    };

    onCulturesChange(newCultures);

    // Reset form
    setNewCultureId('');
    setNewCultureName('');
    setNewCultureDesc('');
    setShowAddCulture(false);
  };

  const handleDeleteCulture = (cultureId) => {
    if (!confirm(`Delete culture "${cultureId}"? This will remove all its configurations.`)) {
      return;
    }

    // Remove from cultures object
    const newCultures = { ...cultures };
    delete newCultures[cultureId];

    onCulturesChange(newCultures);
  };

  // Entity type handlers
  const handleAddEntity = () => {
    if (!entityForm.kind.trim()) return;

    const kind = entityForm.kind.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    // Check if kind already exists
    if (worldSchema.hardState?.some(e => e.kind === kind)) {
      return;
    }

    const subtypes = entityForm.subtype.split(',').map(s => s.trim()).filter(s => s);
    const statuses = entityForm.status.split(',').map(s => s.trim()).filter(s => s);

    const newWorldSchema = {
      ...worldSchema,
      hardState: [
        ...(worldSchema.hardState || []),
        {
          kind,
          subtype: subtypes.length > 0 ? subtypes : ['default'],
          status: statuses.length > 0 ? statuses : ['active']
        }
      ]
    };

    onSchemaLoaded(newWorldSchema);
    setEntityForm({ kind: '', subtype: '', status: '' });
    setShowAddEntity(false);
  };

  const handleEditEntity = (entityKind) => {
    setEditingEntity(entityKind.kind);
    setEntityForm({
      kind: entityKind.kind,
      subtype: entityKind.subtype.join(', '),
      status: entityKind.status.join(', ')
    });
  };

  const handleSaveEntity = () => {
    const subtypes = entityForm.subtype.split(',').map(s => s.trim()).filter(s => s);
    const statuses = entityForm.status.split(',').map(s => s.trim()).filter(s => s);

    const newWorldSchema = {
      ...worldSchema,
      hardState: worldSchema.hardState.map(e =>
        e.kind === editingEntity
          ? { ...e, subtype: subtypes.length > 0 ? subtypes : ['default'], status: statuses.length > 0 ? statuses : ['active'] }
          : e
      )
    };

    onSchemaLoaded(newWorldSchema);
    setEditingEntity(null);
    setEntityForm({ kind: '', subtype: '', status: '' });
  };

  const handleDeleteEntity = (kind) => {
    if (!confirm(`Delete entity type "${kind}"? This cannot be undone.`)) {
      return;
    }

    const newWorldSchema = {
      ...worldSchema,
      hardState: worldSchema.hardState.filter(e => e.kind !== kind)
    };

    onSchemaLoaded(newWorldSchema);
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <h2>World Schema</h2>

      {/* Cultures Section */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Cultures</h3>
          <button className="primary" onClick={() => setShowAddCulture(true)}>
            + Add Culture
          </button>
        </div>

        {Object.keys(cultures).length === 0 ? (
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '6px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0 }}>No cultures defined yet.</p>
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>
              Add a culture to start defining naming conventions.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {Object.values(cultures).map((culture) => {
              const domainCount = culture.domains?.length || 0;
              const entityCount = Object.keys(culture.entityConfigs || {}).length;

              return (
                <div
                  key={culture.id}
                  style={{
                    background: 'rgba(30, 58, 95, 0.4)',
                    padding: '1rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', color: 'var(--gold-accent)' }}>
                      {culture.name || culture.id}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--arctic-frost)' }}>
                      <code>{culture.id}</code>
                      {culture.description && ` • ${culture.description}`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)', marginTop: '0.25rem' }}>
                      {domainCount} domains • {entityCount} entity configs
                    </div>
                  </div>
                  <button
                    className="danger"
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                    onClick={() => handleDeleteCulture(culture.id)}
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Culture Dialog */}
        {showAddCulture && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(34, 197, 94, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(34, 197, 94, 0.3)'
          }}>
            <h4 style={{ margin: '0 0 1rem 0' }}>New Culture</h4>
            <div className="form-group">
              <label>ID (lowercase, no spaces)</label>
              <input
                type="text"
                value={newCultureId}
                onChange={(e) => setNewCultureId(e.target.value)}
                placeholder="e.g., dwarf, elf, human"
              />
            </div>
            <div className="form-group">
              <label>Display Name</label>
              <input
                type="text"
                value={newCultureName}
                onChange={(e) => setNewCultureName(e.target.value)}
                placeholder="e.g., Mountain Dwarves"
              />
            </div>
            <div className="form-group">
              <label>Description (optional)</label>
              <input
                type="text"
                value={newCultureDesc}
                onChange={(e) => setNewCultureDesc(e.target.value)}
                placeholder="Brief description of this culture"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="primary" onClick={handleAddCulture}>Add Culture</button>
              <button className="secondary" onClick={() => setShowAddCulture(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Entity Types Section */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Entity Types</h3>
          <button className="primary" onClick={() => setShowAddEntity(true)}>
            + Add Entity Type
          </button>
        </div>
        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Entity types that can have naming conventions configured per culture.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem'
        }}>
          {(worldSchema.hardState || []).map((entityKind) => (
            <div
              key={entityKind.kind}
              style={{
                background: editingEntity === entityKind.kind ? 'rgba(212, 175, 55, 0.15)' : 'rgba(30, 58, 95, 0.4)',
                padding: '1rem',
                borderRadius: '6px',
                border: editingEntity === entityKind.kind ? '1px solid var(--gold-accent)' : '1px solid rgba(59, 130, 246, 0.3)'
              }}
            >
              {editingEntity === entityKind.kind ? (
                /* Edit mode */
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.75rem', textTransform: 'capitalize', color: 'var(--gold-accent)' }}>
                    Editing: {entityKind.kind}
                  </div>
                  <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem' }}>Subtypes (comma-separated)</label>
                    <input
                      type="text"
                      value={entityForm.subtype}
                      onChange={(e) => setEntityForm({ ...entityForm, subtype: e.target.value })}
                      placeholder="warrior, mage, merchant"
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.75rem' }}>Statuses (comma-separated)</label>
                    <input
                      type="text"
                      value={entityForm.status}
                      onChange={(e) => setEntityForm({ ...entityForm, status: e.target.value })}
                      placeholder="alive, dead, missing"
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="primary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={handleSaveEntity}>Save</button>
                    <button className="secondary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={() => { setEditingEntity(null); setEntityForm({ kind: '', subtype: '', status: '' }); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: 'bold', textTransform: 'capitalize', color: 'var(--arctic-light)' }}>
                      {entityKind.kind}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        className="secondary"
                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                        onClick={() => handleEditEntity(entityKind)}
                      >
                        Edit
                      </button>
                      <button
                        className="danger"
                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                        onClick={() => handleDeleteEntity(entityKind.kind)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--arctic-frost)' }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Subtypes:</strong>
                      <div style={{ marginLeft: '0.5rem', marginTop: '0.25rem' }}>
                        {entityKind.subtype.map((st) => (
                          <span key={st} style={{
                            display: 'inline-block',
                            background: 'rgba(59, 130, 246, 0.2)',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '4px',
                            marginRight: '0.25rem',
                            marginBottom: '0.25rem',
                            fontSize: '0.75rem'
                          }}>
                            {st}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <strong>Status:</strong>
                      <div style={{ marginLeft: '0.5rem', marginTop: '0.25rem' }}>
                        {entityKind.status.map((s) => (
                          <span key={s} style={{
                            display: 'inline-block',
                            background: 'rgba(34, 197, 94, 0.2)',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '4px',
                            marginRight: '0.25rem',
                            marginBottom: '0.25rem',
                            fontSize: '0.75rem'
                          }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add Entity Type Dialog */}
        {showAddEntity && (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(34, 197, 94, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(34, 197, 94, 0.3)'
          }}>
            <h4 style={{ margin: '0 0 1rem 0' }}>New Entity Type</h4>
            <div className="form-group">
              <label>Kind (lowercase, no spaces)</label>
              <input
                type="text"
                value={entityForm.kind}
                onChange={(e) => setEntityForm({ ...entityForm, kind: e.target.value })}
                placeholder="e.g., artifact, creature, vehicle"
              />
            </div>
            <div className="form-group">
              <label>Subtypes (comma-separated)</label>
              <input
                type="text"
                value={entityForm.subtype}
                onChange={(e) => setEntityForm({ ...entityForm, subtype: e.target.value })}
                placeholder="e.g., weapon, armor, potion"
              />
            </div>
            <div className="form-group">
              <label>Statuses (comma-separated)</label>
              <input
                type="text"
                value={entityForm.status}
                onChange={(e) => setEntityForm({ ...entityForm, status: e.target.value })}
                placeholder="e.g., active, broken, lost"
              />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="primary" onClick={handleAddEntity}>Add Entity Type</button>
              <button className="secondary" onClick={() => { setShowAddEntity(false); setEntityForm({ kind: '', subtype: '', status: '' }); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '6px',
        border: '1px solid rgba(59, 130, 246, 0.2)'
      }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--arctic-light)' }}>
          💡 <strong>Next Step:</strong> Switch to the "Workshop" tab to configure naming for each culture and entity type.
        </p>
      </div>
    </div>
  );
}

export default SchemaLoader;
