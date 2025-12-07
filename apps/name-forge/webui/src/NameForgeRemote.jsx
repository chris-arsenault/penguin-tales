/**
 * NameForgeRemote - Module Federation entry point for Name Forge
 *
 * This component is loaded by The Canonry shell and receives:
 * - schema: Read-only world schema (entityKinds, cultures identity)
 * - namingData: Writable naming data keyed by culture ID
 * - onNamingDataChange: Callback when naming data changes
 *
 * It focuses on the Workshop/Optimizer/Generate functionality
 * without the project management or schema editing overhead.
 */

import { useState, useCallback, useMemo } from 'react';
import './App.css';
import { CultureSidebar } from './components/sidebar';
import { EntityWorkspace } from './components/workspace';
import { OptimizerWorkshop } from './components/optimizer';
import { GenerateTab } from './components/generator';
import ProfileCoverageMatrix from './components/coverage/ProfileCoverageMatrix';

/**
 * Convert Canonry schema format to Name Forge internal format
 */
function convertSchemaToInternal(schema) {
  if (!schema) return null;

  // Convert entityKinds array to hardState format
  // Schema uses 'kind' as ID field and 'description' as display name
  const hardState = (schema.entityKinds || []).map((ek) => ({
    kind: ek.kind,
    subtype: (ek.subtypes || []).map((s) => s.id),
    status: (ek.statuses || []).map((s) => s.id),
  }));

  return {
    hardState,
    tagRegistry: schema.tagRegistry || [],
  };
}

/**
 * Convert Canonry cultures + namingData to Name Forge cultures format
 */
function convertCulturesToInternal(schemaCultures, namingData) {
  const cultures = {};

  (schemaCultures || []).forEach((culture) => {
    const naming = namingData?.[culture.id];
    cultures[culture.id] = {
      id: culture.id,
      name: culture.name,
      description: culture.description || '',
      domains: naming?.domains || [],
      lexemeLists: naming?.lexemeLists || {},
      lexemeSpecs: naming?.lexemeSpecs || [],
      grammars: naming?.grammars || [],
      profiles: naming?.profiles || [],
    };
  });

  return cultures;
}

/**
 * Extract naming data from internal culture format
 */
function extractNamingData(culture) {
  return {
    domains: culture.domains || [],
    lexemeLists: culture.lexemeLists || {},
    lexemeSpecs: culture.lexemeSpecs || [],
    grammars: culture.grammars || [],
    profiles: culture.profiles || [],
  };
}

const TABS = [
  { id: 'workshop', label: 'Workshop' },
  { id: 'optimizer', label: 'Optimizer' },
  { id: 'generate', label: 'Generate' },
  { id: 'coverage', label: 'Coverage' },
];

export default function NameForgeRemote({
  schema,
  namingData,
  onNamingDataChange,
  onAddTag,
  activeSection,
  onSectionChange,
  generators = [],
}) {
  // Use passed-in section or default to 'workshop'
  const activeTab = activeSection || 'workshop';
  const setActiveTab = onSectionChange || (() => {});
  const [selectedCulture, setSelectedCulture] = useState(null);
  const [workspaceTab, setWorkspaceTab] = useState('domain');

  // Session-only API key (not persisted)
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // GenerateTab form state
  const [generateFormState, setGenerateFormState] = useState({
    selectedCulture: '',
    selectedProfile: '',
    selectedKind: '',
    selectedSubKind: '',
    tags: '',
    prominence: '',
    count: 20,
    contextPairs: [{ key: '', value: '' }],
  });

  // Convert schema to internal format
  const worldSchema = useMemo(
    () => convertSchemaToInternal(schema),
    [schema]
  );

  // Convert cultures to internal format
  const cultures = useMemo(
    () => convertCulturesToInternal(schema?.cultures, namingData),
    [schema?.cultures, namingData]
  );

  // Handle culture updates from the workspace
  const handleCultureChange = useCallback(
    (updatedCulture) => {
      if (!selectedCulture || !onNamingDataChange) return;

      // Extract naming data and send to host
      const newNamingData = extractNamingData(updatedCulture);
      onNamingDataChange(selectedCulture, newNamingData);
    },
    [selectedCulture, onNamingDataChange]
  );

  // Handle cultures change (for optimizer updates)
  const handleCulturesChange = useCallback(
    (newCultures) => {
      if (!onNamingDataChange) return;

      // Update naming data for all cultures
      Object.entries(newCultures).forEach(([cultureId, culture]) => {
        const newNamingData = extractNamingData(culture);
        onNamingDataChange(cultureId, newNamingData);
      });
    },
    [onNamingDataChange]
  );

  // Auto-select first culture if none selected
  const cultureIds = Object.keys(cultures);
  if (!selectedCulture && cultureIds.length > 0) {
    setSelectedCulture(cultureIds[0]);
  }

  const hasCultures = cultureIds.length > 0;

  if (!hasCultures) {
    return (
      <div className="nf-empty-state">
        <div className="nf-empty-state-icon"></div>
        <div className="nf-empty-state-title">No Cultures Defined</div>
        <div className="nf-empty-state-desc">
          Add cultures in the <strong>Enumerist</strong> tab first, then return here
          to configure naming domains, grammars, and profiles.
        </div>
      </div>
    );
  }

  return (
    <div className="nf-container">
      {/* Left sidebar with nav and cultures */}
      <div className="nf-sidebar">
        <nav className="nf-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nf-nav-button ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* API Key section */}
        <div className="nf-api-section">
          <button
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className={`nf-api-button ${apiKey ? 'active' : ''}`}
          >
            {apiKey ? '✓ API Key Set' : 'Set API Key'}
          </button>
          {showApiKeyInput && (
            <div className="nf-api-dropdown">
              <div className="nf-api-dropdown-title">Anthropic API Key</div>
              <p className="nf-api-dropdown-hint">
                Required for LLM lexeme generation.
              </p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="nf-api-input"
              />
              <button
                onClick={() => setShowApiKeyInput(false)}
                className="nf-api-button active"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Culture sidebar - always visible */}
        <div className="nf-culture-section">
          <CultureSidebar
            cultures={cultures}
            selectedCulture={selectedCulture}
            onSelectCulture={setSelectedCulture}
            onCulturesChange={handleCulturesChange}
            readOnly={true}
          />
        </div>
      </div>

      {/* Main content area */}
      <div className="nf-main">
        {activeTab === 'workshop' && (
          <div className="nf-content">
            <EntityWorkspace
              worldSchema={worldSchema}
              cultureId={selectedCulture}
              cultureConfig={selectedCulture ? cultures[selectedCulture] : null}
              allCultures={cultures}
              activeTab={workspaceTab}
              onTabChange={setWorkspaceTab}
              onCultureChange={handleCultureChange}
              onAddTag={onAddTag}
              apiKey={apiKey}
              generators={generators}
            />
          </div>
        )}

        {activeTab === 'optimizer' && (
          <div className="nf-content">
            <OptimizerWorkshop
              cultures={cultures}
              onCulturesChange={handleCulturesChange}
            />
          </div>
        )}

        {activeTab === 'generate' && (
          <div className="nf-content">
            <GenerateTab
              worldSchema={worldSchema}
              cultures={cultures}
              formState={generateFormState}
              onFormStateChange={setGenerateFormState}
            />
          </div>
        )}

        {activeTab === 'coverage' && (
          <div className="nf-content">
            <ProfileCoverageMatrix
              cultures={cultures}
              worldSchema={worldSchema}
              onNavigateToProfile={(cultureId, profileId) => {
                setSelectedCulture(cultureId);
                setWorkspaceTab('profiles');
                setActiveTab('workshop');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
