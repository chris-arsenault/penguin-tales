import { useState, useEffect, useRef, useMemo } from 'react';
import { getEffectiveDomain } from '../../../utils';
import { generateTestNames } from '../../../../lib/browser-generator.js';
import { computeProfileGeneratorUsage } from './utils';
import StrategyGroupEditor from './StrategyGroupEditor';
import TestPanel from './TestPanel';

/**
 * ProfileTab - Main profile management component
 */
export default function ProfileTab({ cultureId, cultureConfig, onProfilesChange, worldSchema, onAddTag, generators = [] }) {
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

  // Local state for Profile ID input to prevent cursor jumping
  const [localProfileId, setLocalProfileId] = useState('');

  // Sync local profile ID when editedProfile changes
  useEffect(() => {
    setLocalProfileId(editedProfile?.id || '');
  }, [editedProfile?.id]);

  // Autosave refs
  const autosaveTimeoutRef = useRef(null);
  const lastSavedProfileRef = useRef(null);

  const profiles = cultureConfig?.profiles || [];
  const domains = cultureConfig?.domains || [];
  const grammars = cultureConfig?.grammars || [];
  const effectiveDomain = getEffectiveDomain(cultureConfig);

  // Compute generator usage for each profile
  const generatorUsage = useMemo(
    () => computeProfileGeneratorUsage(profiles, generators, cultureId),
    [profiles, generators, cultureId]
  );

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
        <div className="tab-header">
          <h3 className="mt-0">Naming Profiles</h3>
          <button className="primary" onClick={handleCreateProfile}>+ New Profile</button>
        </div>

        <p className="text-muted mb-md">
          Profiles contain strategy groups. Each group can have conditions (entity type, subtype, tags, prominence)
          that determine when its strategies are used during name generation.
        </p>

        {profiles.length === 0 ? (
          <div className="empty-state-card">
            <p className="mt-0 mb-0">No profiles yet.</p>
            <p className="text-muted mt-sm mb-0">
              Create a profile to define how names are generated.
            </p>
          </div>
        ) : (
          <div className="flex gap-lg">
            {/* Profile list */}
            <div className={selectedProfileId ? 'profile-list-narrow' : 'flex-1'}>
              <div className="grid gap-sm">
                {profiles.map((profile) => {
                  const usage = generatorUsage[profile.id];
                  const matchCount = usage?.totalMatches || 0;
                  return (
                    <div
                      key={profile.id}
                      onClick={() => setSelectedProfileId(profile.id)}
                      className={`profile-card ${selectedProfileId === profile.id ? 'selected' : ''}`}
                    >
                      <div className="flex justify-between align-start">
                        <div>
                          <strong>{profile.id}</strong>
                          <div className="text-xs text-muted mt-xs">
                            {profile.strategyGroups?.length || 0} groups
                            ({countConditionalGroups(profile)} conditional),
                            {' '}{profile.strategyGroups?.reduce((sum, g) => sum + g.strategies.length, 0) || 0} strategies
                          </div>
                          {generators.length > 0 && (
                            <div className="flex align-center gap-sm mt-xs text-xs">
                              <span className={`generator-match-badge ${matchCount > 0 ? 'active' : 'inactive'}`}>
                                <span className="text-xs">⚙</span>
                                <span>{matchCount} generator match{matchCount !== 1 ? 'es' : ''}</span>
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-sm">
                          <button className="secondary text-xs" onClick={(e) => { e.stopPropagation(); handleEditProfile(profile); }}>
                            Edit
                          </button>
                          <button className="danger text-xs" onClick={(e) => { e.stopPropagation(); handleDeleteProfile(profile.id); }}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
      <div className="tab-header">
        <h3 className="mt-0">{editingProfileId === 'new' ? 'New Profile' : 'Edit Profile'}</h3>
        <div className="flex gap-sm">
          <button className="primary" onClick={handleSave}>Save</button>
          <button className="secondary" onClick={handleCancel}>Cancel</button>
        </div>
      </div>

      <div className="form-group">
        <label>Profile ID</label>
        <input
          value={localProfileId}
          onChange={(e) => setLocalProfileId(e.target.value)}
          onBlur={() => {
            if (localProfileId !== editedProfile.id) {
              setEditedProfile({ ...editedProfile, id: localProfileId });
            }
          }}
          placeholder={`${cultureId}_profile`}
        />
      </div>

      {/* Strategy Groups */}
      <h4 className="mt-lg mb-md">
        Strategy Groups
        <span className="font-normal text-small ml-sm text-muted">
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

      <div className="mt-md mb-lg">
        <button className="secondary mr-sm" onClick={() => handleAddGroup(false)}>
          + Default Group
        </button>
        <button className="secondary" onClick={() => handleAddGroup(true)}>
          + Conditional Group
        </button>
      </div>
    </div>
  );
}
