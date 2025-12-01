import { useState, useEffect, useRef } from 'react';
import { getEffectiveDomain, getStrategyColor, getStrategyBorder } from '../utils';
import { generateTestNames } from '../../lib/browser-generator.js';
import { TagSelector } from '@lore-weave/shared-components';

function ProfileTab({ cultureId, cultureConfig, onProfilesChange, worldSchema, onAddTag }) {
  // Extract tag registry from world schema
  const tagRegistry = worldSchema?.tagRegistry || [];
  const [mode, setMode] = useState('view'); // 'view', 'edit'
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editedProfile, setEditedProfile] = useState(null);
  const [testNames, setTestNames] = useState([]);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState(null);
  const [strategyUsage, setStrategyUsage] = useState(null);
  const [selectedProfileId, setSelectedProfileId] = useState(null);

  // Autosave refs
  const autosaveTimeoutRef = useRef(null);
  const lastSavedProfileRef = useRef(null);

  const profiles = cultureConfig?.profiles || [];
  const domains = cultureConfig?.domains || [];
  const grammars = cultureConfig?.grammars || [];
  const lexemeLists = cultureConfig?.lexemeLists || {};
  const effectiveDomain = getEffectiveDomain(cultureConfig);

  // Get entity kinds from schema - extract just the kind IDs for MultiSelectPills
  const entityKinds = worldSchema?.hardState?.map(e => e.kind) || [];

  // Prominence levels
  const prominenceLevels = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

  // Autosave effect
  useEffect(() => {
    if (mode !== 'edit' || !editedProfile) return;

    const profileStr = JSON.stringify(editedProfile);
    if (profileStr === lastSavedProfileRef.current) return;

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      saveProfile(editedProfile);
      lastSavedProfileRef.current = profileStr;
    }, 1000);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [editedProfile, mode]);

  useEffect(() => {
    if (mode === 'view') {
      lastSavedProfileRef.current = null;
    }
  }, [mode]);

  const saveProfile = (profile) => {
    // Normalize weights within each group
    const normalizedGroups = (profile.strategyGroups || []).map(group => {
      const totalWeight = group.strategies.reduce((sum, s) => sum + s.weight, 0);
      return {
        ...group,
        strategies: group.strategies.map(s => ({
          ...s,
          weight: totalWeight > 0 ? s.weight / totalWeight : 1 / Math.max(group.strategies.length, 1)
        }))
      };
    });

    const updatedProfile = {
      ...profile,
      strategyGroups: normalizedGroups
    };

    // Update or add profile
    const existingIdx = profiles.findIndex(p => p.id === editingProfileId);
    let newProfiles;
    if (existingIdx >= 0) {
      newProfiles = profiles.map((p, i) => i === existingIdx ? updatedProfile : p);
    } else {
      newProfiles = [...profiles.filter(p => p.id !== updatedProfile.id), updatedProfile];
    }

    onProfilesChange(newProfiles);
  };

  const handleCreateProfile = () => {
    const newProfile = {
      id: `${cultureId}_profile_${profiles.length + 1}`,
      strategyGroups: [
        {
          name: 'Default',
          priority: 0,
          conditions: null,
          strategies: []
        }
      ]
    };
    setEditingProfileId('new');
    setEditedProfile(newProfile);
    setMode('edit');
  };

  const handleEditProfile = (profile) => {
    setEditingProfileId(profile.id);
    setEditedProfile(JSON.parse(JSON.stringify(profile)));
    setMode('edit');
  };

  const handleDeleteProfile = (profileId) => {
    const newProfiles = profiles.filter(p => p.id !== profileId);
    onProfilesChange(newProfiles);
    if (selectedProfileId === profileId) setSelectedProfileId(null);
  };

  const handleSave = () => {
    saveProfile(editedProfile);
    setMode('view');
    setEditingProfileId(null);
    setEditedProfile(null);
  };

  const handleCancel = () => {
    setMode('view');
    setEditingProfileId(null);
    setEditedProfile(null);
  };

  // Strategy group handlers
  const handleAddGroup = (withConditions = false) => {
    const newGroup = {
      name: withConditions ? 'Conditional Group' : 'Default',
      priority: withConditions ? 50 : 0,
      conditions: withConditions ? {
        entityKinds: [],
        prominence: [],
        subtypes: [],
        subtypeMatchAll: false,
        tags: [],
        tagMatchAll: false
      } : null,
      strategies: []
    };
    setEditedProfile({
      ...editedProfile,
      strategyGroups: [...(editedProfile.strategyGroups || []), newGroup]
    });
  };

  const handleDeleteGroup = (groupIdx) => {
    setEditedProfile({
      ...editedProfile,
      strategyGroups: editedProfile.strategyGroups.filter((_, i) => i !== groupIdx)
    });
  };

  const handleAddStrategy = (groupIdx, type) => {
    const newStrategy = { type, weight: 0.25 };
    if (type === 'phonotactic') {
      newStrategy.domainId = domains[0]?.id || '';
    } else if (type === 'grammar') {
      newStrategy.grammarId = grammars[0]?.id || '';
    }

    const groups = [...editedProfile.strategyGroups];
    groups[groupIdx] = {
      ...groups[groupIdx],
      strategies: [...groups[groupIdx].strategies, newStrategy]
    };
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  };

  const handleDeleteStrategy = (groupIdx, stratIdx) => {
    const groups = [...editedProfile.strategyGroups];
    groups[groupIdx] = {
      ...groups[groupIdx],
      strategies: groups[groupIdx].strategies.filter((_, i) => i !== stratIdx)
    };
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  };

  const handleWeightChange = (groupIdx, stratIdx, newWeight) => {
    const groups = [...editedProfile.strategyGroups];
    const strategies = [...groups[groupIdx].strategies];
    strategies[stratIdx] = { ...strategies[stratIdx], weight: parseFloat(newWeight) || 0 };
    groups[groupIdx] = { ...groups[groupIdx], strategies };
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  };

  const handleGroupConditionChange = (groupIdx, field, value) => {
    const groups = [...editedProfile.strategyGroups];
    const currentConditions = groups[groupIdx].conditions || {
      entityKind: '*',
      subtype: '',
      tags: [],
      prominence: []
    };
    groups[groupIdx] = {
      ...groups[groupIdx],
      conditions: { ...currentConditions, [field]: value }
    };
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  };

  const handleTestNames = async (profile, count = 10) => {
    if (!profile || !cultureConfig) return;

    setTestLoading(true);
    setTestError(null);
    setTestNames([]);
    setStrategyUsage(null);

    try {
      const result = await generateTestNames({
        culture: cultureConfig,
        profileId: profile.id,
        count,
        seed: `test-${Date.now()}`
      });

      setTestNames(result.names || []);
      setStrategyUsage(result.strategyUsage || null);
    } catch (err) {
      setTestError(err.message);
    } finally {
      setTestLoading(false);
    }
  };

  // Count conditional groups in a profile
  const countConditionalGroups = (profile) => {
    return (profile.strategyGroups || []).filter(g => g.conditions).length;
  };

  // View mode
  if (mode === 'view') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Naming Profiles</h3>
          <button className="primary" onClick={handleCreateProfile}>+ New Profile</button>
        </div>

        <p className="text-muted" style={{ marginBottom: '1rem' }}>
          Profiles contain strategy groups. Each group can have conditions (entity type, subtype, tags, prominence)
          that determine when its strategies are used during name generation.
        </p>

        {profiles.length === 0 ? (
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '6px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <p style={{ margin: 0 }}>No profiles yet.</p>
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>
              Create a profile to define how names are generated.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {/* Profile list */}
            <div style={{ flex: selectedProfileId ? '0 0 55%' : '1' }}>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    onClick={() => setSelectedProfileId(profile.id)}
                    style={{
                      background: selectedProfileId === profile.id ? 'rgba(212, 175, 55, 0.1)' : 'rgba(30, 58, 95, 0.3)',
                      padding: '0.75rem 1rem',
                      borderRadius: '6px',
                      border: selectedProfileId === profile.id ? '1px solid var(--gold-accent)' : '1px solid rgba(59, 130, 246, 0.3)',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <strong>{profile.id}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)', marginTop: '0.35rem' }}>
                          {profile.strategyGroups?.length || 0} groups
                          ({countConditionalGroups(profile)} conditional),
                          {' '}{profile.strategyGroups?.reduce((sum, g) => sum + g.strategies.length, 0) || 0} strategies
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="secondary" style={{ fontSize: '0.75rem' }} onClick={(e) => { e.stopPropagation(); handleEditProfile(profile); }}>
                          Edit
                        </button>
                        <button className="danger" style={{ fontSize: '0.75rem' }} onClick={(e) => { e.stopPropagation(); handleDeleteProfile(profile.id); }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Test panel */}
            {selectedProfileId && profiles.find(p => p.id === selectedProfileId) && (
              <TestPanel
                profile={profiles.find(p => p.id === selectedProfileId)}
                testNames={testNames}
                testLoading={testLoading}
                testError={testError}
                strategyUsage={strategyUsage}
                onTest={handleTestNames}
                onClose={() => setSelectedProfileId(null)}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // Edit mode
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>{editingProfileId === 'new' ? 'New Profile' : 'Edit Profile'}</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="primary" onClick={handleSave}>Save</button>
          <button className="secondary" onClick={handleCancel}>Cancel</button>
        </div>
      </div>

      <div className="form-group">
        <label>Profile ID</label>
        <input
          value={editedProfile.id}
          onChange={(e) => setEditedProfile({ ...editedProfile, id: e.target.value })}
          placeholder={`${cultureId}_profile`}
        />
      </div>

      {/* Strategy Groups */}
      <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>
        Strategy Groups
        <span style={{ fontWeight: 'normal', fontSize: '0.8rem', marginLeft: '0.5rem', color: 'var(--arctic-frost)' }}>
          (evaluated by priority, highest first)
        </span>
      </h4>

      {(editedProfile.strategyGroups || []).map((group, groupIdx) => (
        <StrategyGroupEditor
          key={groupIdx}
          group={group}
          groupIdx={groupIdx}
          domains={domains}
          grammars={grammars}
          entityKinds={entityKinds}
          prominenceLevels={prominenceLevels}
          tagRegistry={tagRegistry}
          editedProfile={editedProfile}
          setEditedProfile={setEditedProfile}
          onDeleteGroup={handleDeleteGroup}
          onAddStrategy={handleAddStrategy}
          onDeleteStrategy={handleDeleteStrategy}
          onWeightChange={handleWeightChange}
          onConditionChange={handleGroupConditionChange}
          onAddTag={onAddTag}
        />
      ))}

      <div style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
        <button className="secondary" style={{ marginRight: '0.5rem' }} onClick={() => handleAddGroup(false)}>
          + Default Group
        </button>
        <button className="secondary" onClick={() => handleAddGroup(true)}>
          + Conditional Group
        </button>
      </div>
    </div>
  );
}

// Multi-select pills component
function MultiSelectPills({ options, selected, onChange, allLabel = 'All' }) {
  const isAllSelected = selected.length === 0 || (selected.length === 1 && selected[0] === '*');

  const handleToggle = (value) => {
    if (value === '*') {
      onChange([]);
    } else {
      const newSelected = selected.filter(s => s !== '*');
      if (newSelected.includes(value)) {
        const filtered = newSelected.filter(s => s !== value);
        onChange(filtered.length === 0 ? [] : filtered);
      } else {
        onChange([...newSelected, value]);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
      <button
        type="button"
        onClick={() => handleToggle('*')}
        style={{
          padding: '0.2rem 0.5rem',
          fontSize: '0.7rem',
          border: '1px solid',
          borderColor: isAllSelected ? 'var(--gold-accent)' : 'rgba(59, 130, 246, 0.4)',
          background: isAllSelected ? 'rgba(212, 175, 55, 0.3)' : 'transparent',
          color: isAllSelected ? 'var(--gold-accent)' : 'var(--text-color)',
          borderRadius: '12px',
          cursor: 'pointer'
        }}
      >
        {allLabel}
      </button>
      {options.map(opt => {
        const isSelected = !isAllSelected && selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => handleToggle(opt)}
            style={{
              padding: '0.2rem 0.5rem',
              fontSize: '0.7rem',
              border: '1px solid',
              borderColor: isSelected ? 'rgba(34, 197, 94, 0.6)' : 'rgba(59, 130, 246, 0.4)',
              background: isSelected ? 'rgba(34, 197, 94, 0.3)' : 'transparent',
              color: isSelected ? 'rgb(134, 239, 172)' : 'var(--text-color)',
              borderRadius: '12px',
              cursor: 'pointer',
              textTransform: 'capitalize'
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// Tags input with auto-split on space/comma
function TagsInput({ value, onChange, placeholder }) {
  const tags = Array.isArray(value) ? value : [];

  const handleKeyDown = (e) => {
    if (e.key === ' ' || e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      const input = e.target.value.trim();
      if (input && !tags.includes(input)) {
        onChange([...tags, input]);
      }
      e.target.value = '';
    } else if (e.key === 'Backspace' && e.target.value === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const handleRemove = (tag) => {
    onChange(tags.filter(t => t !== tag));
  };

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.25rem',
      padding: '0.35rem',
      background: 'rgba(0, 0, 0, 0.2)',
      borderRadius: '4px',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      minHeight: '32px',
      alignItems: 'center'
    }}>
      {tags.map(tag => (
        <span
          key={tag}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.15rem 0.4rem',
            background: 'rgba(59, 130, 246, 0.3)',
            border: '1px solid rgba(59, 130, 246, 0.5)',
            borderRadius: '10px',
            fontSize: '0.7rem'
          }}
        >
          {tag}
          <button
            type="button"
            onClick={() => handleRemove(tag)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--arctic-frost)',
              cursor: 'pointer',
              padding: '0 0.1rem',
              fontSize: '0.8rem',
              lineHeight: 1
            }}
          >
            x
          </button>
        </span>
      ))}
      <input
        type="text"
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
        style={{
          flex: 1,
          minWidth: '60px',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize: '0.75rem',
          color: 'var(--text-color)',
          padding: '0.1rem'
        }}
      />
    </div>
  );
}

// Strategy group editor
function StrategyGroupEditor({
  group,
  groupIdx,
  domains,
  grammars,
  entityKinds,
  prominenceLevels,
  tagRegistry,
  editedProfile,
  setEditedProfile,
  onDeleteGroup,
  onAddStrategy,
  onDeleteStrategy,
  onWeightChange,
  onConditionChange,
  onAddTag
}) {
  const groupTotalWeight = group.strategies.reduce((sum, s) => sum + s.weight, 0);
  const hasConditions = !!group.conditions;

  const toggleConditions = () => {
    const groups = [...editedProfile.strategyGroups];
    if (hasConditions) {
      groups[groupIdx] = { ...groups[groupIdx], conditions: null };
    } else {
      groups[groupIdx] = {
        ...groups[groupIdx],
        conditions: {
          entityKinds: [],
          prominence: [],
          subtypes: [],
          subtypeMatchAll: false,
          tags: [],
          tagMatchAll: false
        }
      };
    }
    setEditedProfile({ ...editedProfile, strategyGroups: groups });
  };

  return (
    <div style={{
      background: hasConditions ? 'rgba(147, 51, 234, 0.15)' : 'rgba(59, 130, 246, 0.15)',
      border: `1px solid ${hasConditions ? 'rgba(147, 51, 234, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
      borderRadius: '8px',
      padding: '1rem',
      marginBottom: '1rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <input
            value={group.name || ''}
            onChange={(e) => {
              const groups = [...editedProfile.strategyGroups];
              groups[groupIdx] = { ...groups[groupIdx], name: e.target.value };
              setEditedProfile({ ...editedProfile, strategyGroups: groups });
            }}
            placeholder="Group name"
            style={{ width: '150px', fontWeight: 'bold' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--arctic-frost)' }}>Priority:</label>
            <input
              type="number"
              value={group.priority || 0}
              onChange={(e) => {
                const groups = [...editedProfile.strategyGroups];
                groups[groupIdx] = { ...groups[groupIdx], priority: parseInt(e.target.value) || 0 };
                setEditedProfile({ ...editedProfile, strategyGroups: groups });
              }}
              style={{ width: '60px', textAlign: 'center' }}
            />
          </div>
          <button
            className="secondary"
            style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
            onClick={toggleConditions}
          >
            {hasConditions ? 'Remove Conditions' : 'Add Conditions'}
          </button>
        </div>
        <button className="danger" style={{ fontSize: '0.75rem' }} onClick={() => onDeleteGroup(groupIdx)}>
          Delete Group
        </button>
      </div>

      {/* Group Conditions */}
      {hasConditions && (
        <div style={{
          background: 'rgba(147, 51, 234, 0.1)',
          border: '1px solid rgba(147, 51, 234, 0.3)',
          borderRadius: '6px',
          padding: '0.75rem',
          marginBottom: '0.75rem'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'rgb(192, 132, 252)', marginBottom: '0.75rem' }}>
            Group Conditions
          </div>

          {/* Row 1: Entity Types and Prominence */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
            {/* Entity Types */}
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)', marginBottom: '0.25rem', display: 'block' }}>
                Entity Types
              </label>
              <MultiSelectPills
                options={entityKinds}
                selected={group.conditions?.entityKinds || []}
                onChange={(val) => onConditionChange(groupIdx, 'entityKinds', val)}
                allLabel="All"
              />
            </div>

            {/* Prominence */}
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)', marginBottom: '0.25rem', display: 'block' }}>
                Prominence
              </label>
              <MultiSelectPills
                options={prominenceLevels}
                selected={group.conditions?.prominence || []}
                onChange={(val) => onConditionChange(groupIdx, 'prominence', val)}
                allLabel="Any"
              />
            </div>
          </div>

          {/* Row 2: Subtypes and Tags */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            {/* Subtypes */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)' }}>Subtypes</label>
                <label style={{ fontSize: '0.65rem', color: 'var(--arctic-frost)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="checkbox"
                    checked={group.conditions?.subtypeMatchAll || false}
                    onChange={(e) => onConditionChange(groupIdx, 'subtypeMatchAll', e.target.checked)}
                    style={{ width: '12px', height: '12px' }}
                  />
                  Match all
                </label>
              </div>
              <TagsInput
                value={group.conditions?.subtypes || []}
                onChange={(val) => onConditionChange(groupIdx, 'subtypes', val)}
                placeholder="Type and press space..."
              />
            </div>

            {/* Tags */}
            <div>
              <label style={{ fontSize: '0.7rem', color: 'var(--arctic-frost)', marginBottom: '0.25rem', display: 'block' }}>
                Tags
              </label>
              <TagSelector
                value={group.conditions?.tags || []}
                onChange={(val) => onConditionChange(groupIdx, 'tags', val)}
                tagRegistry={tagRegistry}
                placeholder="Select tags..."
                matchAllEnabled={true}
                matchAll={group.conditions?.tagMatchAll || false}
                onMatchAllChange={(val) => onConditionChange(groupIdx, 'tagMatchAll', val)}
                onAddToRegistry={onAddTag}
              />
            </div>
          </div>
        </div>
      )}

      {/* Strategies */}
      {group.strategies.length === 0 && (
        <div className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          No strategies. Add one below.
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
            <button className="danger" style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }} onClick={() => onDeleteStrategy(groupIdx, stratIdx)}>
              Remove
            </button>
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={strategy.weight}
            onChange={(e) => onWeightChange(groupIdx, stratIdx, e.target.value)}
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />

          {strategy.type === 'phonotactic' && (
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
              <option value="">Select domain...</option>
              {domains.map(d => (
                <option key={d.id} value={d.id}>{d.id}</option>
              ))}
            </select>
          )}

          {strategy.type === 'grammar' && (
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
              <option value="">Select grammar...</option>
              {grammars.map(g => (
                <option key={g.id} value={g.id}>{g.id}</option>
              ))}
            </select>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
        <button className="secondary" style={{ fontSize: '0.75rem' }} onClick={() => onAddStrategy(groupIdx, 'phonotactic')}>
          + Phonotactic
        </button>
        <button className="secondary" style={{ fontSize: '0.75rem' }} onClick={() => onAddStrategy(groupIdx, 'grammar')}>
          + Grammar
        </button>
      </div>
    </div>
  );
}

// Test panel
function TestPanel({ profile, testNames, testLoading, testError, strategyUsage, onTest, onClose }) {
  return (
    <div style={{
      flex: '0 0 40%',
      background: 'rgba(30, 58, 95, 0.3)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      borderRadius: '8px',
      padding: '1rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ margin: 0 }}>Test: {profile.id}</h4>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="primary" onClick={() => onTest(profile, 10)} disabled={testLoading} style={{ fontSize: '0.8rem' }}>
            {testLoading ? '...' : 'Generate'}
          </button>
          <button className="secondary" onClick={onClose} style={{ fontSize: '0.8rem' }}>
            Close
          </button>
        </div>
      </div>

      {testError && (
        <div className="error" style={{ marginBottom: '0.75rem', fontSize: '0.8rem' }}>{testError}</div>
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
              <span key={strategy} style={{ marginRight: '0.5rem' }}>
                {strategy}: {count}
              </span>
            ))}
        </div>
      )}

      {testNames.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '350px', overflowY: 'auto' }}>
          {testNames.map((name, i) => (
            <div key={i} style={{
              background: 'rgba(20, 45, 75, 0.5)',
              padding: '0.5rem 0.75rem',
              borderRadius: '4px',
              fontFamily: 'monospace',
              color: 'var(--gold-accent)'
            }}>
              {name}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>
          Click Generate to test this profile
        </p>
      )}
    </div>
  );
}

export default ProfileTab;
