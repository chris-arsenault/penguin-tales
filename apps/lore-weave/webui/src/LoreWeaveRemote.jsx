/**
 * LoreWeaveRemote - Module Federation entry point for Lore Weave
 *
 * This component is loaded by The Canonry shell and receives:
 * - schema: Read-only world schema (entityKinds, relationshipKinds, cultures)
 * - eras: Array of era configurations
 * - pressures: Array of pressure configurations
 * - generators: Array of growth template configurations
 * - seedEntities: Initial entities for the world
 * - seedRelationships: Initial relationships for the world
 * - namingData: Name generation data per culture
 * - semanticData: Semantic plane data per entity kind
 * - cultureVisuals: Culture visual data (axis biases, home regions)
 * - activeSection: Current navigation section
 * - onSectionChange: Callback when navigation changes
 *
 * Lore Weave generates procedural world history by running growth templates
 * and simulation systems in alternating phases across multiple eras.
 */

import React, { useState, useMemo, useCallback } from 'react';
import ConfigurationSummary from './components/ConfigurationSummary';
import SimulationRunner from './components/SimulationRunner';
import ResultsViewer from './components/ResultsViewer';

const TABS = [
  { id: 'configure', label: 'Configure' },
  { id: 'run', label: 'Run' },
  { id: 'results', label: 'Results' },
];

// Lore Weave accent gradient (purple)
const ACCENT_GRADIENT = 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%)';
const ACCENT_COLOR = '#6d28d9';

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
    color: 'white',
    fontWeight: 600,
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
  },
};

export default function LoreWeaveRemote({
  schema = { entityKinds: [], relationshipKinds: [], cultures: [] },
  eras = [],
  pressures = [],
  generators = [],
  seedEntities = [],
  seedRelationships = [],
  namingData = {},
  semanticData = {},
  cultureVisuals = {},
  activeSection,
  onSectionChange,
}) {
  // Use passed-in section or default to 'configure'
  const activeTab = activeSection || 'configure';
  const setActiveTab = onSectionChange || (() => {});

  // Simulation state
  const [simulationResults, setSimulationResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  // Validate configuration completeness
  const configValidation = useMemo(() => {
    const issues = [];
    const warnings = [];

    // Required elements
    if (schema.entityKinds.length === 0) {
      issues.push('No entity kinds defined');
    }
    if (schema.relationshipKinds.length === 0) {
      issues.push('No relationship kinds defined');
    }
    if (schema.cultures.length === 0) {
      issues.push('No cultures defined');
    }
    if (eras.length === 0) {
      issues.push('No eras defined');
    }
    if (generators.length === 0) {
      issues.push('No generators (growth templates) defined');
    }

    // Warnings
    if (pressures.length === 0) {
      warnings.push('No pressures defined - simulation will have no dynamic feedback');
    }
    if (seedEntities.length === 0) {
      warnings.push('No seed entities - world will start empty');
    }
    if (Object.keys(namingData).length === 0) {
      warnings.push('No naming data - entities will need explicit names');
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings,
      stats: {
        entityKinds: schema.entityKinds.length,
        relationshipKinds: schema.relationshipKinds.length,
        cultures: schema.cultures.length,
        eras: eras.length,
        pressures: pressures.length,
        generators: generators.length,
        seedEntities: seedEntities.length,
        seedRelationships: seedRelationships.length,
      },
    };
  }, [schema, eras, pressures, generators, seedEntities, seedRelationships, namingData]);

  // Handle simulation completion
  const handleSimulationComplete = useCallback((results) => {
    setSimulationResults(results);
    setIsRunning(false);
    setActiveTab('results');
  }, [setActiveTab]);

  const renderContent = () => {
    switch (activeTab) {
      case 'configure':
        return (
          <ConfigurationSummary
            schema={schema}
            eras={eras}
            pressures={pressures}
            generators={generators}
            seedEntities={seedEntities}
            seedRelationships={seedRelationships}
            namingData={namingData}
            semanticData={semanticData}
            cultureVisuals={cultureVisuals}
            validation={configValidation}
            onNavigateToRun={() => setActiveTab('run')}
          />
        );
      case 'run':
        return (
          <SimulationRunner
            schema={schema}
            eras={eras}
            pressures={pressures}
            generators={generators}
            seedEntities={seedEntities}
            seedRelationships={seedRelationships}
            namingData={namingData}
            semanticData={semanticData}
            cultureVisuals={cultureVisuals}
            validation={configValidation}
            isRunning={isRunning}
            setIsRunning={setIsRunning}
            onComplete={handleSimulationComplete}
          />
        );
      case 'results':
        return (
          <ResultsViewer
            results={simulationResults}
            schema={schema}
            onNewRun={() => setActiveTab('run')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div style={styles.container}>
      {/* Left sidebar with nav */}
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
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.backgroundColor = 'rgba(109, 40, 217, 0.15)';
                  e.target.style.color = ACCENT_COLOR;
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#b0b0c0';
                }
              }}
            >
              {tab.label}
              {tab.id === 'results' && simulationResults && (
                <span style={{
                  marginLeft: '8px',
                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                  color: '#22c55e',
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}>
                  {simulationResults.metadata?.entityCount || 0}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content area */}
      <div style={styles.main}>
        <div style={styles.content}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
