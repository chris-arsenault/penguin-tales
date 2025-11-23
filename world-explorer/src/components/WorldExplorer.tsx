import { useState } from 'react';
import type { WorldState, Filters, EntityKind, LoreData, ImageMetadata } from '../types/world.ts';
import { applyFilters, applyTemporalFilter } from '../utils/dataTransform.ts';
import GraphView from './GraphView.tsx';
import FilterPanel from './FilterPanel.tsx';
import EntityDetail from './EntityDetail.tsx';
import TimelineControl from './TimelineControl.tsx';
import StatsPanel from './StatsPanel.tsx';
import './WorldExplorer.css';

interface WorldExplorerProps {
  worldData: WorldState;
  loreData: LoreData | null;
  imageData: ImageMetadata | null;
}

export default function WorldExplorer({ worldData, loreData, imageData }: WorldExplorerProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(undefined);
  const [currentTick, setCurrentTick] = useState<number>(worldData.metadata.tick);
  const [isStatsPanelOpen, setIsStatsPanelOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    kinds: ['npc', 'faction', 'location', 'rules', 'abilities', 'era', 'occurrence'] as EntityKind[],
    minProminence: 'forgotten',
    timeRange: [0, worldData.metadata.tick],
    tags: [],
    searchQuery: '',
    relationshipTypes: [],
    minStrength: 0.0,
    showCatalyzedBy: false
  });

  // Apply temporal filter first, then regular filters
  const temporalData = applyTemporalFilter(worldData, currentTick);
  const filteredData = applyFilters(temporalData, filters);

  return (
    <div className="world-explorer">
      {/* Header */}
      <header className="world-header">
        <div className="world-header-content">
          <div className="world-header-left">
            <div className="world-penguin">🐧</div>
            <div className="world-title-container">
              <h1 className="world-title">PENGUIN TALES</h1>
              <p className="world-subtitle">History Explorer</p>
            </div>
          </div>
          <div className="world-header-right">
            <div className="world-header-stats">
              <div className="world-header-stat">
                <div className="world-header-stat-label">Era</div>
                <div className="world-header-stat-value" style={{ fontSize: '0.85rem' }}>{worldData.metadata.era}</div>
              </div>
              <div className="world-header-stat">
                <div className="world-header-stat-label">Epoch</div>
                <div className="world-header-stat-value">{worldData.metadata.epoch}</div>
              </div>
              <div className="world-header-stat">
                <div className="world-header-stat-label">Tick</div>
                <div className="world-header-stat-value">{worldData.metadata.tick}</div>
              </div>
              <div className="world-header-stat">
                <div className="world-header-stat-label">History</div>
                <div className="world-header-stat-value">{worldData.metadata.historyEventCount}</div>
              </div>
              <div className="world-header-stat">
                <div className="world-header-stat-label">Enriched</div>
                <div className="world-header-stat-value">{worldData.metadata.enrichmentTriggers.total}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="world-main">
        {/* Filter Panel */}
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          worldData={worldData}
        />

        {/* Graph View */}
        <main className="world-graph-container">
          <GraphView
            data={filteredData}
            selectedNodeId={selectedEntityId}
            onNodeSelect={setSelectedEntityId}
            showCatalyzedBy={filters.showCatalyzedBy}
          />
        </main>

        {/* Entity Detail Panel */}
        <EntityDetail
          entityId={selectedEntityId}
          worldData={worldData}
          loreData={loreData}
          imageData={imageData}
          onRelatedClick={setSelectedEntityId}
        />
      </div>

      {/* Timeline Control */}
      <TimelineControl
        worldData={worldData}
        loreData={loreData}
        currentTick={currentTick}
        onTickChange={setCurrentTick}
      />

      {/* Stats Panel */}
      <StatsPanel
        worldData={worldData}
        isOpen={isStatsPanelOpen}
        onToggle={() => setIsStatsPanelOpen(!isStatsPanelOpen)}
      />

      {/* Footer Status Bar */}
      <footer className="world-footer">
        <div className="world-footer-content">
          <div className="world-footer-left">
            <div className="world-footer-stat">
              <span className="world-footer-stat-label">Showing:</span>
              <span className="world-footer-stat-value">{filteredData.metadata.entityCount}</span>
              <span className="world-footer-stat-separator">/</span>
              <span className="world-footer-stat-total">{temporalData.metadata.entityCount}</span>
              <span className="world-footer-stat-label"> entities</span>
            </div>
            <div className="world-footer-stat">
              <span className="world-footer-stat-value">{filteredData.metadata.relationshipCount}</span>
              <span className="world-footer-stat-separator">/</span>
              <span className="world-footer-stat-total">{temporalData.metadata.relationshipCount}</span>
              <span className="world-footer-stat-label"> links</span>
            </div>
          </div>
          <div className="world-footer-right">
            {selectedEntityId ? (
              <span>
                <span className="world-footer-selected-label">Selected:</span>
                <span className="world-footer-selected-value">{selectedEntityId}</span>
              </span>
            ) : (
              <span className="world-footer-no-selection">No selection</span>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
