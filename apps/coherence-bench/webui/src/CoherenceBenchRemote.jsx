/**
 * CoherenceBenchRemote - Module Federation entry point for Coherence Bench
 *
 * This component is loaded by The Canonry shell and receives:
 * - project: The full WorldSeedProject including simulation config
 * - activeSection: Current navigation section
 * - onSectionChange: Callback when section changes
 * - onUpdateSimulation: Callback to update simulation config
 *
 * It provides simulation configuration editing and execution.
 */

import React, { useState } from 'react';
import SettingsEditor from './components/SettingsEditor.jsx';
import PressureEditor from './components/PressureEditor.jsx';
import RuleEditor from './components/RuleEditor.jsx';
import DistributionTargetsEditor from './components/DistributionTargetsEditor.jsx';
import EraEditor from './components/EraEditor.jsx';
import EraWeightsEditor from './components/EraWeightsEditor.jsx';
import SimulationRunner from './components/SimulationRunner.jsx';
import StaticAnalysisPanel from './components/StaticAnalysisPanel.jsx';

// Coherence Bench accent gradient (purple theme for simulation)
const ACCENT_GRADIENT = 'linear-gradient(135deg, #a78bfa 0%, #c4b5fd 100%)';
const ACCENT_COLOR = '#a78bfa';

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
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  sidebarTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#808090',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px',
  },
  navButton: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
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
  navCount: {
    float: 'right',
    fontSize: '11px',
    opacity: 0.8,
  },
  main: {
    flex: 1,
    padding: '24px',
    overflow: 'auto',
    backgroundColor: '#1e1e2e',
  },
  noProject: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#707080',
    textAlign: 'center',
    padding: '40px',
  },
  noProjectTitle: {
    fontSize: '18px',
    fontWeight: 500,
    marginBottom: '8px',
    color: '#f0f0f0',
  },
};

const SECTIONS = [
  { id: 'settings', label: 'Settings', countKey: null },
  { id: 'eras', label: 'Eras', countKey: 'eras' },
  { id: 'pressures', label: 'Pressures', countKey: 'pressures' },
  { id: 'generationRules', label: 'Generation Rules', countKey: 'generationRules' },
  { id: 'simulationRules', label: 'Simulation Rules', countKey: 'simulationRules' },
  { id: 'distributionTargets', label: 'Distribution', countKey: null },
  { id: 'eraWeights', label: 'Era Weights', countKey: 'eraWeights' },
  { id: 'runner', label: 'Run', countKey: null },
];

/**
 * Create default empty simulation config
 */
function createDefaultSimulation() {
  return {
    settings: {
      ticksPerEra: 50,
      growthSimulationRatio: 2,
      maxEntities: 500,
      randomSeed: undefined,
    },
    pressures: [],
    generationRules: [],
    simulationRules: [],
    eraRuleWeights: {},
    distributionTargets: {
      entities: {},
      relationships: {
        coverage: {},
        connectivity: {
          minPerEntity: 1,
          maxHubSize: 20,
        },
      },
      cultures: {
        minEntitiesPerCulture: 5,
        maxVariance: 0.3,
      },
      temporal: {
        minEntitiesPerEra: 10,
        occurrencesPerEra: { min: 3, max: 10 },
      },
    },
    feedbackLoops: [],
  };
}

export default function CoherenceBenchRemote({
  project,
  activeSection,
  onSectionChange,
  onUpdateSimulation,
  onUpdateEras,
}) {
  const [analysisCollapsed, setAnalysisCollapsed] = useState(true);

  // Use passed-in activeSection, fallback to settings
  const currentSection = activeSection || 'settings';
  const setActiveSection = onSectionChange || (() => {});

  // If no project, show placeholder
  if (!project) {
    return (
      <div style={styles.container}>
        <div style={styles.noProject}>
          <div style={styles.noProjectTitle}>No Project Selected</div>
          <div>
            Select or create a project in The Canonry to configure simulation settings.
          </div>
        </div>
      </div>
    );
  }

  // Get or create simulation config
  const simulation = project.simulation || createDefaultSimulation();

  // Initialize simulation if not exists
  React.useEffect(() => {
    if (!project.simulation && onUpdateSimulation) {
      onUpdateSimulation(createDefaultSimulation());
    }
  }, [project.simulation, onUpdateSimulation]);

  const counts = {
    eras: project.eras?.length || 0,
    pressures: simulation.pressures?.length || 0,
    generationRules: simulation.generationRules?.length || 0,
    simulationRules: simulation.simulationRules?.length || 0,
    eraWeights: Object.keys(simulation.eraRuleWeights || {}).length,
  };

  // Update helper that preserves other fields
  const updateSimulation = (updates) => {
    if (onUpdateSimulation) {
      onUpdateSimulation({
        ...simulation,
        ...updates,
      });
    }
  };

  const renderEditor = () => {
    switch (currentSection) {
      case 'settings':
        return (
          <SettingsEditor
            settings={simulation.settings}
            onChange={(settings) => updateSimulation({ settings })}
          />
        );

      case 'eras':
        return (
          <EraEditor
            eras={project.eras || []}
            onChange={(eras) => onUpdateEras && onUpdateEras(eras)}
          />
        );

      case 'pressures':
        return (
          <PressureEditor
            pressures={simulation.pressures}
            onChange={(pressures) => updateSimulation({ pressures })}
          />
        );

      case 'generationRules':
        return (
          <RuleEditor
            rules={simulation.generationRules}
            ruleType="generation"
            schema={project}
            pressures={simulation.pressures}
            onChange={(generationRules) => updateSimulation({ generationRules })}
          />
        );

      case 'simulationRules':
        return (
          <RuleEditor
            rules={simulation.simulationRules}
            ruleType="simulation"
            schema={project}
            pressures={simulation.pressures}
            onChange={(simulationRules) => updateSimulation({ simulationRules })}
          />
        );

      case 'distributionTargets':
        return (
          <DistributionTargetsEditor
            targets={simulation.distributionTargets}
            schema={project}
            onChange={(distributionTargets) => updateSimulation({ distributionTargets })}
          />
        );

      case 'eraWeights':
        return (
          <EraWeightsEditor
            eraRuleWeights={simulation.eraRuleWeights}
            eras={project.eras || []}
            generationRules={simulation.generationRules}
            simulationRules={simulation.simulationRules}
            pressures={simulation.pressures}
            onChange={(eraRuleWeights) => updateSimulation({ eraRuleWeights })}
          />
        );

      case 'runner':
        return (
          <SimulationRunner
            project={project}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarTitle}>Simulation</div>
        <StaticAnalysisPanel
          simulation={simulation}
          schema={project}
          collapsed={analysisCollapsed}
          onToggle={() => setAnalysisCollapsed(!analysisCollapsed)}
        />
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            style={{
              ...styles.navButton,
              ...(section.id === currentSection
                ? styles.navButtonActive
                : styles.navButtonInactive),
            }}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
            {section.countKey && (
              <span style={styles.navCount}>{counts[section.countKey]}</span>
            )}
          </button>
        ))}
      </div>
      <div style={styles.main}>{renderEditor()}</div>
    </div>
  );
}

export { createDefaultSimulation };
