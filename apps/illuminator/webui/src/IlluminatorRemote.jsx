/**
 * IlluminatorRemote - Module Federation entry point for Illuminator
 *
 * This component is loaded by The Canonry shell and receives:
 * - projectId: Current project ID
 * - schema: Read-only world schema (entityKinds, cultures)
 * - worldData: Simulation results from lore-weave
 * - onEnrichmentComplete: Callback when enrichment is done
 *
 * Enriches lore-weave output with LLM-generated descriptions and images.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import './App.css';
import ConfigPanel from './components/ConfigPanel';
import DomainContextEditor from './components/DomainContextEditor';
import PromptPreviewPanel from './components/PromptPreviewPanel';
import EnrichmentQueue from './components/EnrichmentQueue';
import ProgressPanel from './components/ProgressPanel';
import ResultsPanel from './components/ResultsPanel';
import { useEnrichmentWorker } from './hooks/useEnrichmentWorker';

const TABS = [
  { id: 'configure', label: 'Configure' },
  { id: 'context', label: 'Context' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'queue', label: 'Queue' },
  { id: 'run', label: 'Run' },
  { id: 'results', label: 'Results' },
];

// Default enrichment config
const DEFAULT_CONFIG = {
  enrichDescriptions: true,
  enrichRelationships: false,
  enrichEraNarratives: true,
  generateImages: true,
  minProminenceForDescription: 'recognized',
  minProminenceForImage: 'mythic',
  batchSize: 6,
  delayBetweenBatches: 1000,
  textModel: 'claude-sonnet-4-20250514',
  imageModel: 'dall-e-3',
  imageSize: '1024x1024',
  imageQuality: 'standard',
};

// Default domain context
const DEFAULT_DOMAIN_CONTEXT = {
  worldName: '',
  worldDescription: '',
  canonFacts: [],
  cultureNotes: {},
  relationshipPatterns: [],
  conflictPatterns: [],
  technologyNotes: [],
  magicNotes: [],
  geographyScale: '',
  geographyTraits: [],
  entityPromptHints: {},
  relationshipPromptHints: {},
};

export default function IlluminatorRemote({
  projectId,
  schema,
  worldData,
  onEnrichmentComplete,
  domainContext: externalDomainContext,
  onDomainContextChange,
  activeSection,
  onSectionChange,
  activeSlotIndex = 0,
}) {
  // Show warning when enriching data in temporary slot
  const isTemporarySlot = activeSlotIndex === 0;
  // Use passed-in section or default to 'configure'
  const activeTab = activeSection || 'configure';
  const setActiveTab = onSectionChange || (() => {});

  // API Keys (session-only, not persisted)
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Enrichment config (persisted per project)
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  // Domain context - use external if provided, otherwise local state
  const [localDomainContext, setLocalDomainContext] = useState(DEFAULT_DOMAIN_CONTEXT);
  const domainContext = externalDomainContext || localDomainContext;
  const setDomainContext = onDomainContextChange || setLocalDomainContext;

  // Worker for enrichment
  const {
    state: workerState,
    initialize: initializeWorker,
    runAll,
    runFiltered,
    runEntity,
    runTask,
    runTasks: runWorkerTasks,
    pause,
    resume,
    abort,
    reset,
    isRunning,
    isPaused,
  } = useEnrichmentWorker();

  // Map worker state to component state
  const tasks = workerState.tasks;
  const enrichmentStatus = workerState.status;
  const progress = { completed: workerState.completedCount, total: workerState.totalCount };

  // Build world schema from props
  const worldSchema = useMemo(
    () => schema || { entityKinds: [], relationshipKinds: [], cultures: [], tagRegistry: [] },
    [schema]
  );

  // Check if we have world data
  const hasWorldData = worldData?.hardState?.length > 0;

  // Check if API keys are set
  const hasAnthropicKey = anthropicApiKey.length > 0;
  const hasOpenaiKey = openaiApiKey.length > 0;
  const hasRequiredKeys = hasAnthropicKey && (config.generateImages ? hasOpenaiKey : true);

  // Initialize worker when world data or config changes
  // Note: API keys are NOT required to build the task queue - only to run tasks
  useEffect(() => {
    if (!worldData?.hardState) {
      return;
    }

    // Build full config for worker (keys may be empty for preview)
    const workerConfig = {
      anthropicApiKey,
      openaiApiKey,
      mode: 'full',
      ...config,
    };

    initializeWorker(workerConfig, worldData.hardState, domainContext);
  }, [worldData, config, domainContext, anthropicApiKey, openaiApiKey, initializeWorker]);

  // Update config
  const updateConfig = useCallback((updates) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  // Update domain context - merge updates with current context
  const updateDomainContext = useCallback((updates) => {
    const merged = { ...domainContext, ...updates };
    setDomainContext(merged);
  }, [domainContext, setDomainContext]);

  // Run selected tasks using worker
  const runTasks = useCallback((taskIds) => {
    runWorkerTasks(taskIds);
  }, [runWorkerTasks]);

  // Run all pending tasks using worker
  const runAllTasks = useCallback(() => {
    runAll();
  }, [runAll]);

  // Pause enrichment using worker
  const pauseEnrichment = useCallback(() => {
    pause();
  }, [pause]);

  // Resume enrichment using worker
  const resumeEnrichment = useCallback(() => {
    resume();
  }, [resume]);

  // Abort enrichment using worker
  const abortEnrichment = useCallback(() => {
    abort();
  }, [abort]);

  if (!hasWorldData) {
    return (
      <div className="illuminator-empty-state">
        <div className="illuminator-empty-state-icon">&#x2728;</div>
        <div className="illuminator-empty-state-title">No World Data</div>
        <div className="illuminator-empty-state-desc">
          Run a simulation in <strong>Lore Weave</strong> first, then return here
          to enrich your world with LLM-generated descriptions and images.
        </div>
      </div>
    );
  }

  return (
    <div className="illuminator-container">
      {/* Left sidebar with nav and API keys */}
      <div className="illuminator-sidebar">
        <nav className="illuminator-nav">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`illuminator-nav-button ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
              {tab.id === 'queue' && tasks.length > 0 && (
                <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
                  {tasks.filter((t) => t.status === 'pending').length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* API Key section */}
        <div className="illuminator-api-section">
          <button
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className={`illuminator-api-button ${hasRequiredKeys ? 'active' : ''}`}
          >
            {hasRequiredKeys ? 'API Keys Set' : 'Set API Keys'}
          </button>
          {showApiKeyInput && (
            <div className="illuminator-api-dropdown">
              <div className="illuminator-api-dropdown-title">Anthropic API Key</div>
              <p className="illuminator-api-dropdown-hint">
                Required for text enrichment.
              </p>
              <input
                type="password"
                value={anthropicApiKey}
                onChange={(e) => setAnthropicApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="illuminator-api-input"
              />
              <div className="illuminator-api-dropdown-title">OpenAI API Key</div>
              <p className="illuminator-api-dropdown-hint">
                Required for image generation.
              </p>
              <input
                type="password"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-..."
                className="illuminator-api-input"
              />
              <button
                onClick={() => setShowApiKeyInput(false)}
                className="illuminator-api-button active"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="illuminator-main">
        {/* Temporary slot warning */}
        {isTemporarySlot && (
          <div className="illuminator-temp-slot-warning">
            <span className="illuminator-temp-slot-warning-icon">⚠</span>
            <span>
              You are enriching data in a <strong>temporary slot</strong>, which will be
              automatically deleted when a new Lore Weave simulation is run. Consider saving
              to a permanent slot before enrichment.
            </span>
          </div>
        )}

        {activeTab === 'configure' && (
          <div className="illuminator-content">
            <ConfigPanel
              config={config}
              onConfigChange={updateConfig}
              worldSchema={worldSchema}
            />
          </div>
        )}

        {activeTab === 'context' && (
          <div className="illuminator-content">
            <DomainContextEditor
              domainContext={domainContext}
              onDomainContextChange={updateDomainContext}
              worldSchema={worldSchema}
            />
          </div>
        )}

        {activeTab === 'prompts' && (
          <div className="illuminator-content">
            <PromptPreviewPanel
              domainContext={domainContext}
              worldData={worldData?.hardState}
              worldSchema={worldSchema}
            />
          </div>
        )}

        {activeTab === 'queue' && (
          <div className="illuminator-content">
            <EnrichmentQueue
              tasks={tasks}
              onRunTasks={runTasks}
              onRunAll={runAllTasks}
              worldSchema={worldSchema}
              hasRequiredKeys={hasRequiredKeys}
            />
          </div>
        )}

        {activeTab === 'run' && (
          <div className="illuminator-content">
            <ProgressPanel
              status={enrichmentStatus}
              progress={progress}
              tasks={tasks}
              onPause={pauseEnrichment}
              onResume={resumeEnrichment}
              onAbort={abortEnrichment}
              onRunAll={runAllTasks}
              hasRequiredKeys={hasRequiredKeys}
            />
          </div>
        )}

        {activeTab === 'results' && (
          <div className="illuminator-content">
            <ResultsPanel
              tasks={tasks}
              worldData={worldData}
              onRegenerateTask={(taskId) => runTasks([taskId])}
              onExportToArchivist={() => {
                if (onEnrichmentComplete && workerState.enrichedEntities) {
                  // Mark as enriched with timestamp and count completed tasks
                  const completedTasks = tasks.filter((t) => t.status === 'complete');
                  const enrichedWorld = {
                    ...worldData,
                    hardState: workerState.enrichedEntities,
                    metadata: {
                      ...worldData.metadata,
                      enriched: true,
                      enrichedAt: Date.now(),
                      enrichmentStats: {
                        descriptions: completedTasks.filter((t) => t.type === 'description').length,
                        images: completedTasks.filter((t) => t.type === 'image').length,
                      },
                    },
                  };
                  onEnrichmentComplete(enrichedWorld);
                } else if (onEnrichmentComplete && worldData) {
                  onEnrichmentComplete(worldData);
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
