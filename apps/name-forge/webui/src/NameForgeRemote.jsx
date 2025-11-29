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
import CultureSidebar from './components/CultureSidebar';
import EntityWorkspace from './components/EntityWorkspace';
import OptimizerWorkshop from './components/OptimizerWorkshop';
import GenerateTab from './components/GenerateTab';

/**
 * Convert Canonry schema format to Name Forge internal format
 */
function convertSchemaToInternal(schema) {
  if (!schema) return null;

  // Convert entityKinds array to hardState format
  const hardState = (schema.entityKinds || []).map((ek) => ({
    kind: ek.id,
    subtype: (ek.subtypes || []).map((s) => s.id),
    status: (ek.statuses || []).map((s) => s.id),
  }));

  return { hardState };
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
    grammars: culture.grammars || [],
    profiles: culture.profiles || [],
  };
}

const styles = {
  container: {
    display: 'flex',
    height: '100%',
    backgroundColor: 'var(--midnight-blue, #1a1a2e)',
  },
  sidebar: {
    width: '200px',
    backgroundColor: 'var(--deep-space, #0f0f1a)',
    borderRight: '1px solid var(--border-color, #2a2a4a)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  nav: {
    padding: '12px',
    borderBottom: '1px solid var(--border-color, #2a2a4a)',
  },
  navButton: {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    marginBottom: '4px',
    fontSize: '13px',
    fontWeight: 500,
    textAlign: 'left',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.15s, color 0.15s',
  },
  navButtonInactive: {
    backgroundColor: 'transparent',
    color: 'var(--arctic-frost, #888)',
  },
  navButtonActive: {
    backgroundColor: 'var(--gold-accent, #d4a574)',
    color: 'var(--deep-space, #0f0f1a)',
  },
  apiSection: {
    padding: '12px',
    borderBottom: '1px solid var(--border-color, #2a2a4a)',
  },
  apiButton: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '11px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  apiDropdown: {
    marginTop: '8px',
    padding: '12px',
    backgroundColor: 'var(--midnight-blue, #1a1a2e)',
    borderRadius: '6px',
  },
  cultureSection: {
    flex: 1,
    overflow: 'auto',
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
  noCultures: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    textAlign: 'center',
    color: 'var(--arctic-frost, #888)',
  },
};

const TABS = [
  { id: 'workshop', label: 'Workshop' },
  { id: 'optimizer', label: 'Optimizer' },
  { id: 'generate', label: 'Generate' },
];

export default function NameForgeRemote({ schema, namingData, onNamingDataChange }) {
  const [activeTab, setActiveTab] = useState('workshop');
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
      <div style={styles.noCultures}>
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>

        </div>
        <div style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>
          No Cultures Defined
        </div>
        <div style={{ fontSize: '14px', maxWidth: '400px' }}>
          Add cultures in the <strong>Enumerist</strong> tab first, then return here
          to configure naming domains, grammars, and profiles.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Left sidebar with nav and cultures */}
      <div style={styles.sidebar}>
        <nav style={styles.nav}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.navButton,
                ...(activeTab === tab.id
                  ? styles.navButtonActive
                  : styles.navButtonInactive),
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* API Key section */}
        <div style={styles.apiSection}>
          <button
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            style={{
              ...styles.apiButton,
              backgroundColor: apiKey
                ? 'var(--gold-accent, #d4a574)'
                : 'var(--midnight-blue, #1a1a2e)',
              color: apiKey
                ? 'var(--deep-space, #0f0f1a)'
                : 'var(--arctic-frost, #888)',
            }}
          >
            {apiKey ? '✓ API Key Set' : 'Set API Key'}
          </button>
          {showApiKeyInput && (
            <div style={styles.apiDropdown}>
              <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: '#ccc' }}>
                Anthropic API Key
              </div>
              <p style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                Required for LLM lexeme generation.
              </p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-..."
                style={{
                  width: '100%',
                  padding: '8px',
                  marginBottom: '8px',
                  fontSize: '12px',
                  backgroundColor: 'var(--deep-space, #0f0f1a)',
                  border: '1px solid var(--border-color, #2a2a4a)',
                  borderRadius: '4px',
                  color: '#ccc',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={() => setShowApiKeyInput(false)}
                style={{
                  ...styles.apiButton,
                  backgroundColor: 'var(--gold-accent, #d4a574)',
                  color: 'var(--deep-space, #0f0f1a)',
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Culture sidebar - always visible */}
        <div style={styles.cultureSection}>
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
      <div style={styles.main}>
        {activeTab === 'workshop' && (
          <div style={styles.content}>
            <EntityWorkspace
              worldSchema={worldSchema}
              cultureId={selectedCulture}
              cultureConfig={selectedCulture ? cultures[selectedCulture] : null}
              allCultures={cultures}
              activeTab={workspaceTab}
              onTabChange={setWorkspaceTab}
              onCultureChange={handleCultureChange}
              apiKey={apiKey}
            />
          </div>
        )}

        {activeTab === 'optimizer' && (
          <div style={styles.content}>
            <OptimizerWorkshop
              cultures={cultures}
              onCulturesChange={handleCulturesChange}
            />
          </div>
        )}

        {activeTab === 'generate' && (
          <div style={styles.content}>
            <GenerateTab
              worldSchema={worldSchema}
              cultures={cultures}
              formState={generateFormState}
              onFormStateChange={setGenerateFormState}
            />
          </div>
        )}
      </div>
    </div>
  );
}
