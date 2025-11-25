import { useState } from 'react';

const API_URL = 'http://localhost:3001';

/**
 * Migrate legacy flat strategies to strategy groups
 */
function migrateToGroups(strategies) {
  if (!strategies || strategies.length === 0) return [];

  // All strategies go into a single "Default" group
  return [{
    name: 'Default',
    priority: 0,
    conditions: null,
    strategies: strategies.map(s => {
      const { conditions, ...rest } = s;
      return rest;
    })
  }];
}

/**
 * Get effective groups from a profile (handles legacy format)
 */
function getEffectiveGroups(profile) {
  if (profile.strategyGroups && profile.strategyGroups.length > 0) {
    return profile.strategyGroups;
  }
  if (profile.strategies && profile.strategies.length > 0) {
    return migrateToGroups(profile.strategies);
  }
  return [];
}

function ProfileEditor({ metaDomain, profiles, onProfilesChange, domains, grammars, generatedContent }) {
  const [editingProfile, setEditingProfile] = useState(null);
  const [formData, setFormData] = useState({
    id: '',
    cultureId: '',
    type: 'npc',
    strategyGroups: []
  });
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupForm, setGroupForm] = useState({
    name: '',
    priority: 0,
    conditions: null,
    strategies: []
  });
  const [editingStrategy, setEditingStrategy] = useState(null);
  const [strategyForm, setStrategyForm] = useState({
    id: '',
    kind: 'templated',
    weight: 1.0,
    templateIds: [],  // Changed from single template to array of IDs
    grammarId: '',
    domainId: '',
    pattern: '',
    start: 1,
    format: 'numeric'
  });

  const handleAddNewProfile = () => {
    setEditingProfile('new');
    setFormData({
      id: `${metaDomain}:npc`,
      cultureId: metaDomain,
      type: 'npc',
      strategyGroups: []
    });
  };

  const saveToDisk = async (updatedProfiles) => {
    try {
      const response = await fetch(`${API_URL}/api/meta-domains/${metaDomain}/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profiles: updatedProfiles })
      });

      if (!response.ok) {
        console.error('Failed to save profiles to disk');
      } else {
        console.log('✅ Profiles saved to disk');
      }
    } catch (error) {
      console.error('Error saving profiles:', error);
    }
  };

  const handleSaveProfile = () => {
    const newProfiles = editingProfile === 'new'
      ? [...profiles, formData]
      : profiles.map(p => p.id === formData.id ? formData : p);
    onProfilesChange(newProfiles);
    saveToDisk(newProfiles);
    setEditingProfile(null);
  };

  const handleDeleteProfile = (id) => {
    const newProfiles = profiles.filter(p => p.id !== id);
    onProfilesChange(newProfiles);
    saveToDisk(newProfiles);
  };

  // Group handling functions
  const handleAddGroup = () => {
    setEditingGroup('new');
    setGroupForm({
      name: `Group ${formData.strategyGroups.length + 1}`,
      priority: formData.strategyGroups.length === 0 ? 0 : 10,
      conditions: null,
      strategies: []
    });
  };

  const handleSaveGroup = () => {
    const group = { ...groupForm };

    // Clean up empty conditions
    if (group.conditions) {
      const { tags, prominence, subtype } = group.conditions;
      const hasConditions =
        (tags && tags.length > 0) ||
        (prominence && prominence.length > 0) ||
        (subtype && subtype.length > 0);
      if (!hasConditions) {
        group.conditions = null;
      }
    }

    const newGroups = editingGroup === 'new'
      ? [...formData.strategyGroups, group]
      : formData.strategyGroups.map((g, idx) =>
          (typeof editingGroup === 'number' && idx === editingGroup) ? group : g
        );

    setFormData({ ...formData, strategyGroups: newGroups });
    setEditingGroup(null);
  };

  const handleDeleteGroup = (idx) => {
    setFormData({
      ...formData,
      strategyGroups: formData.strategyGroups.filter((_, i) => i !== idx)
    });
  };

  const handleEditGroup = (idx) => {
    const group = formData.strategyGroups[idx];
    setEditingGroup(idx);
    setGroupForm({
      name: group.name || `Group ${idx + 1}`,
      priority: group.priority || 0,
      conditions: group.conditions || null,
      strategies: group.strategies || []
    });
  };

  // Strategy handling functions (work within current group)
  const handleAddStrategy = () => {
    const totalStrategies = groupForm.strategies.length;
    setEditingStrategy('new');
    setStrategyForm({
      id: `${formData.cultureId}_strategy_${totalStrategies + 1}`,
      kind: 'templated',
      weight: 1.0,
      templateIds: [],
      grammarId: '',
      domainId: '',
      pattern: '',
      start: 1,
      format: 'numeric'
    });
  };

  const handleSaveStrategy = () => {
    const strategy = { ...strategyForm };

    // Clean up unused fields based on kind
    if (strategy.kind === 'templated') {
      delete strategy.grammarId;
      delete strategy.domainId;
      delete strategy.pattern;
      delete strategy.start;
      delete strategy.format;
    } else if (strategy.kind === 'grammar') {
      delete strategy.templateIds;
      delete strategy.domainId;
      delete strategy.pattern;
      delete strategy.start;
      delete strategy.format;
    } else if (strategy.kind === 'phonotactic') {
      delete strategy.templateIds;
      delete strategy.grammarId;
      delete strategy.pattern;
      delete strategy.start;
      delete strategy.format;
    } else if (strategy.kind === 'serial') {
      delete strategy.templateIds;
      delete strategy.grammarId;
      delete strategy.domainId;
    }

    const newStrategies = editingStrategy === 'new'
      ? [...groupForm.strategies, strategy]
      : groupForm.strategies.map(s => s.id === strategy.id ? strategy : s);

    setGroupForm({ ...groupForm, strategies: newStrategies });
    setEditingStrategy(null);
  };

  const handleDeleteStrategy = (id) => {
    setGroupForm({
      ...groupForm,
      strategies: groupForm.strategies.filter(s => s.id !== id)
    });
  };

  const handleAddSlot = (slotName) => {
    if (!slotName.trim()) return;
    setStrategyForm({
      ...strategyForm,
      slots: {
        ...strategyForm.slots,
        [slotName]: { kind: 'lexemeList', listId: '' }
      }
    });
  };

  const handleUpdateSlot = (slotName, field, value) => {
    setStrategyForm({
      ...strategyForm,
      slots: {
        ...strategyForm.slots,
        [slotName]: {
          ...strategyForm.slots[slotName],
          [field]: value
        }
      }
    });
  };

  const handleDeleteSlot = (slotName) => {
    const newSlots = { ...strategyForm.slots };
    delete newSlots[slotName];
    setStrategyForm({ ...strategyForm, slots: newSlots });
  };

  const availableLexemes = Object.keys(generatedContent || {});
  const availableDomains = (domains || []).map(d => d.id);
  const availableGrammars = (grammars || []).map(g => g.id);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2>Naming Profiles</h2>
          <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Combine domains, grammars, and lexemes into naming strategies
          </p>
        </div>
        <button className="primary" onClick={handleAddNewProfile}>+ New Profile</button>
      </div>

      {editingProfile ? (
        <div className="card" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <h3>{editingProfile === 'new' ? 'New Profile' : 'Edit Profile'}</h3>

          <div className="form-group">
            <label>Profile ID</label>
            <input
              value={formData.id}
              onChange={(e) => setFormData({...formData, id: e.target.value})}
              placeholder="e.g., elven:npc"
            />
          </div>

          <div className="form-group">
            <label>Culture ID</label>
            <input
              value={formData.cultureId}
              onChange={(e) => setFormData({...formData, cultureId: e.target.value})}
              placeholder="e.g., elven"
            />
          </div>

          <div className="form-group">
            <label>Entity Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
            >
              <option value="npc">NPC</option>
              <option value="location">Location</option>
              <option value="faction">Faction</option>
              <option value="item">Item</option>
              <option value="event">Event</option>
            </select>
          </div>

          <h4 style={{ marginTop: '1.5rem' }}>Strategy Groups ({formData.strategyGroups.length})</h4>
          <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
            Groups are evaluated by priority (highest first). The first group whose conditions match is used.
          </p>

          {editingGroup !== null ? (
            <div style={{ background: '#1a2a3a', padding: '1rem', borderRadius: '4px', marginBottom: '1rem', border: '1px solid #3b5068' }}>
              <h5 style={{ marginBottom: '1rem' }}>Group Editor</h5>

              <div className="form-group">
                <label>Group Name</label>
                <input
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({...groupForm, name: e.target.value})}
                  placeholder="e.g., Noble Names, Common Names"
                />
              </div>

              <div className="form-group">
                <label>Priority (higher = checked first)</label>
                <input
                  type="number"
                  value={groupForm.priority}
                  onChange={(e) => setGroupForm({...groupForm, priority: parseInt(e.target.value) || 0})}
                />
                <small className="text-muted">Default: 0. Groups with higher priority are checked first.</small>
              </div>

              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#0d1b2a', borderRadius: '4px' }}>
                <strong>Conditions</strong>
                <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                  Optional. If set, this group only applies when the entity matches these conditions.
                </p>

                <div className="form-group">
                  <label>Required Tags (comma-separated)</label>
                  <input
                    value={groupForm.conditions?.tags?.join(', ') || ''}
                    onChange={(e) => {
                      const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                      setGroupForm({
                        ...groupForm,
                        conditions: {
                          ...groupForm.conditions,
                          tags: tags.length > 0 ? tags : undefined
                        }
                      });
                    }}
                    placeholder="e.g., noble, royal"
                  />
                </div>

                <div className="form-group">
                  <label>Prominence Levels</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'].map(level => (
                      <label key={level} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <input
                          type="checkbox"
                          checked={groupForm.conditions?.prominence?.includes(level) || false}
                          onChange={(e) => {
                            const current = groupForm.conditions?.prominence || [];
                            const newProminence = e.target.checked
                              ? [...current, level]
                              : current.filter(p => p !== level);
                            setGroupForm({
                              ...groupForm,
                              conditions: {
                                ...groupForm.conditions,
                                prominence: newProminence.length > 0 ? newProminence : undefined
                              }
                            });
                          }}
                        />
                        {level}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Subtypes (comma-separated)</label>
                  <input
                    value={groupForm.conditions?.subtype?.join(', ') || ''}
                    onChange={(e) => {
                      const subtypes = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                      setGroupForm({
                        ...groupForm,
                        conditions: {
                          ...groupForm.conditions,
                          subtype: subtypes.length > 0 ? subtypes : undefined
                        }
                      });
                    }}
                    placeholder="e.g., warrior, mage"
                  />
                </div>
              </div>

              <h5 style={{ marginTop: '1.5rem' }}>Strategies in Group ({groupForm.strategies.length})</h5>
              <p className="text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                Strategies are selected by weighted random within this group.
              </p>

              {editingStrategy ? (
                <div style={{ background: '#0d1b2a', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
                  <h6>Strategy Editor</h6>

              <div className="form-group">
                <label>Strategy ID</label>
                <input
                  value={strategyForm.id}
                  onChange={(e) => setStrategyForm({...strategyForm, id: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Kind</label>
                <select
                  value={strategyForm.kind}
                  onChange={(e) => setStrategyForm({...strategyForm, kind: e.target.value})}
                >
                  <option value="templated">Templated (Handlebars)</option>
                  <option value="grammar">Grammar (CFG)</option>
                  <option value="phonotactic">Phonotactic (Domain)</option>
                  <option value="serial">Serial (Numeric/Pattern)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Weight (relative probability)</label>
                <input
                  type="number"
                  step="0.1"
                  value={strategyForm.weight}
                  onChange={(e) => setStrategyForm({...strategyForm, weight: parseFloat(e.target.value)})}
                />
              </div>

              {strategyForm.kind === 'templated' && (
                <>
                  <div className="form-group">
                    <label>Handlebars Template</label>
                    <input
                      value={strategyForm.template}
                      onChange={(e) => setStrategyForm({...strategyForm, template: e.target.value})}
                      placeholder="e.g., {{adj}} {{noun}}"
                    />
                    <small className="text-muted">Use double-brace syntax: adj, noun, etc.</small>
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <strong>Slots</strong>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <input
                        id="newSlotName"
                        placeholder="Slot name"
                        style={{ flex: 1 }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleAddSlot(e.target.value);
                            e.target.value = '';
                          }
                        }}
                      />
                      <button
                        className="primary"
                        onClick={() => {
                          const input = document.getElementById('newSlotName');
                          handleAddSlot(input.value);
                          input.value = '';
                        }}
                      >
                        Add Slot
                      </button>
                    </div>

                    {Object.keys(strategyForm.slots).length > 0 && (
                      <div style={{ marginTop: '0.5rem' }}>
                        {Object.entries(strategyForm.slots).map(([slotName, slotConfig]) => (
                          <div key={slotName} style={{
                            padding: '0.5rem',
                            background: 'white',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            marginBottom: '0.5rem'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <strong>{slotName}</strong>
                              <button
                                className="danger"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                onClick={() => handleDeleteSlot(slotName)}
                              >
                                ×
                              </button>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <select
                                value={slotConfig.kind}
                                onChange={(e) => handleUpdateSlot(slotName, 'kind', e.target.value)}
                                style={{ flex: 1 }}
                              >
                                <option value="lexemeList">Lexeme List</option>
                                <option value="phonotactic">Phonotactic</option>
                                <option value="literal">Literal</option>
                              </select>
                              {slotConfig.kind === 'lexemeList' && (
                                <select
                                  value={slotConfig.listId || ''}
                                  onChange={(e) => handleUpdateSlot(slotName, 'listId', e.target.value)}
                                  style={{ flex: 2 }}
                                >
                                  <option value="">Select lexeme list...</option>
                                  {availableLexemes.map(id => (
                                    <option key={id} value={id}>{id}</option>
                                  ))}
                                </select>
                              )}
                              {slotConfig.kind === 'phonotactic' && (
                                <select
                                  value={slotConfig.domainId || ''}
                                  onChange={(e) => handleUpdateSlot(slotName, 'domainId', e.target.value)}
                                  style={{ flex: 2 }}
                                >
                                  <option value="">Select domain...</option>
                                  {availableDomains.map(id => (
                                    <option key={id} value={id}>{id}</option>
                                  ))}
                                </select>
                              )}
                              {slotConfig.kind === 'literal' && (
                                <input
                                  value={slotConfig.value || ''}
                                  onChange={(e) => handleUpdateSlot(slotName, 'value', e.target.value)}
                                  placeholder="Literal value"
                                  style={{ flex: 2 }}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {strategyForm.kind === 'grammar' && (
                <div className="form-group">
                  <label>Grammar ID</label>
                  <select
                    value={strategyForm.grammarId}
                    onChange={(e) => setStrategyForm({...strategyForm, grammarId: e.target.value})}
                  >
                    <option value="">Select grammar...</option>
                    {availableGrammars.map(id => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                </div>
              )}

              {strategyForm.kind === 'phonotactic' && (
                <div className="form-group">
                  <label>Domain ID</label>
                  <select
                    value={strategyForm.domainId}
                    onChange={(e) => setStrategyForm({...strategyForm, domainId: e.target.value})}
                  >
                    <option value="">Select domain...</option>
                    {availableDomains.map(id => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                </div>
              )}

              {strategyForm.kind === 'serial' && (
                <>
                  <div className="form-group">
                    <label>Pattern</label>
                    <input
                      value={strategyForm.pattern}
                      onChange={(e) => setStrategyForm({...strategyForm, pattern: e.target.value})}
                      placeholder="e.g., Outpost-{N}"
                    />
                    <small className="text-muted">Use {"{N}"} for number placeholder</small>
                  </div>
                  <div className="form-group">
                    <label>Start Number</label>
                    <input
                      type="number"
                      value={strategyForm.start}
                      onChange={(e) => setStrategyForm({...strategyForm, start: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Format</label>
                    <select
                      value={strategyForm.format}
                      onChange={(e) => setStrategyForm({...strategyForm, format: e.target.value})}
                    >
                      <option value="numeric">Numeric (1, 2, 3)</option>
                      <option value="padded">Padded (001, 002, 003)</option>
                      <option value="alpha">Alpha (A, B, C)</option>
                      <option value="roman">Roman (I, II, III)</option>
                    </select>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="primary" onClick={handleSaveStrategy}>Save Strategy</button>
                <button className="secondary" onClick={() => setEditingStrategy(null)}>Cancel</button>
              </div>
                </div>
              ) : (
                <>
                  <button className="secondary" onClick={handleAddStrategy} style={{ marginBottom: '0.5rem' }}>
                    + Add Strategy
                  </button>

                  {groupForm.strategies.length > 0 && (
                    <div>
                      {groupForm.strategies.map((strategy, idx) => (
                        <div key={strategy.id} style={{
                          padding: '0.75rem',
                          background: '#0d1b2a',
                          border: '1px solid #2a3f5f',
                          borderRadius: '4px',
                          marginBottom: '0.5rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong>{strategy.id}</strong>
                              <span className="text-muted" style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>
                                ({strategy.kind}, weight: {strategy.weight})
                              </span>
                              {strategy.kind === 'templated' && strategy.template && (
                                <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                                  {strategy.template}
                                </p>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                className="secondary"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                onClick={() => { setEditingStrategy(strategy.id); setStrategyForm({...strategy, slots: strategy.slots || {}}); }}
                              >
                                Edit
                              </button>
                              <button
                                className="danger"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                                onClick={() => handleDeleteStrategy(strategy.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #2a3f5f' }}>
                <button className="primary" onClick={handleSaveGroup}>Save Group</button>
                <button className="secondary" onClick={() => setEditingGroup(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <button className="secondary" onClick={handleAddGroup} style={{ marginBottom: '0.5rem' }}>
                + Add Strategy Group
              </button>

              {formData.strategyGroups.length > 0 && (
                <div>
                  {formData.strategyGroups.map((group, idx) => (
                    <div key={idx} style={{
                      padding: '0.75rem',
                      background: '#1a2a3a',
                      border: '1px solid #3b5068',
                      borderRadius: '4px',
                      marginBottom: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{group.name || `Group ${idx + 1}`}</strong>
                          <span className="text-muted" style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>
                            (priority: {group.priority}, strategies: {group.strategies.length})
                          </span>
                          {group.conditions && (
                            <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem' }}>
                              Conditions: {
                                [
                                  group.conditions.tags?.length && `tags: ${group.conditions.tags.join(', ')}`,
                                  group.conditions.prominence?.length && `prominence: ${group.conditions.prominence.join(', ')}`,
                                  group.conditions.subtype?.length && `subtype: ${group.conditions.subtype.join(', ')}`
                                ].filter(Boolean).join(' | ') || 'none'
                              }
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                            onClick={() => handleEditGroup(idx)}
                          >
                            Edit
                          </button>
                          <button
                            className="danger"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
                            onClick={() => handleDeleteGroup(idx)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #3b5068' }}>
            <button className="primary" onClick={handleSaveProfile}>Save Profile</button>
            <button className="secondary" onClick={() => setEditingProfile(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="item-list">
          {profiles.length === 0 ? (
            <p className="text-muted">No profiles yet. Click "+ New Profile" to create one.</p>
          ) : (
            profiles.map(profile => {
              const groups = getEffectiveGroups(profile);
              const totalStrategies = groups.reduce((sum, g) => sum + g.strategies.length, 0);
              return (
                <div key={profile.id} className="list-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <strong>{profile.id}</strong>
                      <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
                        Type: {profile.type} | Groups: {groups.length} | Total Strategies: {totalStrategies}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="secondary" onClick={() => {
                        setEditingProfile(profile.id);
                        // Convert legacy profiles to use strategyGroups
                        setFormData({
                          ...profile,
                          strategyGroups: getEffectiveGroups(profile),
                          strategies: undefined  // Clear legacy field
                        });
                      }}>
                        Edit
                      </button>
                      <button className="danger" onClick={() => handleDeleteProfile(profile.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default ProfileEditor;
