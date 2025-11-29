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

// Name Forge accent gradient
const ACCENT_GRADIENT = 'linear-gradient(135deg, #ffb366 0%, #ffc080 100%)';
const HOVER_BG = 'rgba(255, 179, 102, 0.15)';
const ACCENT_COLOR = '#ffb366';

const styles = {
  container: {
    display: 'flex',
    height: '100%',
    backgroundColor: '#1e1e2e',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  sidebar: {
    width: '200px',
    backgroundColor: '#1a1a28',
    borderRight: '1px solid #3d3d4d',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  nav: {
    padding: '12px',
    borderBottom: '1px solid #3d3d4d',
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
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  navButtonInactive: {
    backgroundColor: 'transparent',
    color: '#b0b0c0',
  },
  navButtonActive: {
    background: ACCENT_GRADIENT,
    color: '#1a1a28',
    fontWeight: 600,
  },
  apiSection: {
    padding: '12px',
    borderBottom: '1px solid #3d3d4d',
  },
  apiButton: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '11px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  apiDropdown: {
    marginTop: '8px',
    padding: '12px',
    backgroundColor: '#252535',
    borderRadius: '6px',
    border: '1px solid #3d3d4d',
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
    color: '#707080',
  },
};

const TABS = [
  { id: 'workshop', label: 'Workshop' },
  { id: 'optimizer', label: 'Optimizer' },
  { id: 'generate', label: 'Generate' },
];

export default function NameForgeRemote({
  schema,
  namingData,
  onNamingDataChange,
  activeSection,
  onSectionChange,
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
              backgroundColor: apiKey ? '#ffb366' : '#2d2d3d',
              color: apiKey ? '#1a1a28' : '#a0a0b0',
            }}
          >
            {apiKey ? '✓ API Key Set' : 'Set API Key'}
          </button>
          {showApiKeyInput && (
            <div style={styles.apiDropdown}>
              <div style={{ marginBottom: '8px', fontSize: '12px', fontWeight: 600, color: '#f0f0f0' }}>
                Anthropic API Key
              </div>
              <p style={{ fontSize: '11px', color: '#a0a0b0', marginBottom: '8px' }}>
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
                  backgroundColor: '#2d2d3d',
                  border: '1px solid #3d3d4d',
                  borderRadius: '4px',
                  color: '#f0f0f0',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={() => setShowApiKeyInput(false)}
                style={{
                  ...styles.apiButton,
                  backgroundColor: '#ffb366',
                  color: '#1a1a28',
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
