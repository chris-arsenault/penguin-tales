import { useState, useRef } from 'react';
import type { WorldState, Filters, EntityKind, LoreData, ImageMetadata } from '../types/world.ts';
import { applyFilters, applyTemporalFilter } from '../utils/dataTransform.ts';
import GraphView from './GraphView.tsx';
import GraphView3D from './GraphView3D.tsx';
import CoordinateMapView from './CoordinateMapView.tsx';
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

export type EdgeMetric = 'strength' | 'distance' | 'none';
export type ViewMode = 'graph3d' | 'graph2d' | 'map';

export default function WorldExplorer({ worldData, loreData, imageData }: WorldExplorerProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(undefined);
  const [currentTick, setCurrentTick] = useState<number>(worldData.metadata.tick);
  const [isStatsPanelOpen, setIsStatsPanelOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('graph3d');
  const [edgeMetric, setEdgeMetric] = useState<EdgeMetric>('strength');
  const recalculateLayoutRef = useRef<(() => void) | null>(null);

  // Get UI configuration from schema (with fallbacks)
  const entityKinds = worldData.uiSchema?.entityKinds?.map(ek => ek.kind)
    ?? ['npc', 'faction', 'location', 'rules', 'abilities', 'era', 'occurrence'];
  const defaultMinProminence = worldData.uiSchema?.prominenceLevels?.[0] ?? 'forgotten';

  const [filters, setFilters] = useState<Filters>({
    kinds: entityKinds as EntityKind[],
    minProminence: defaultMinProminence,
    timeRange: [0, worldData.metadata.tick],
    tags: [],
    searchQuery: '',
    relationshipTypes: [],
    minStrength: 0.0,
    showCatalyzedBy: false,
    showHistoricalRelationships: false
  });

  // Apply temporal filter first, then regular filters
  const temporalData = applyTemporalFilter(worldData, currentTick);
  const filteredData = applyFilters(temporalData, filters);

  return (
    <div className="world-explorer">
      {/* Main Content */}
      <div className="world-main">
        {/* Filter Panel */}
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          worldData={worldData}
          viewMode={viewMode}
          edgeMetric={edgeMetric}
          onViewModeChange={setViewMode}
          onEdgeMetricChange={setEdgeMetric}
          onRecalculateLayout={() => recalculateLayoutRef.current?.()}
          onToggleStats={() => setIsStatsPanelOpen(!isStatsPanelOpen)}
        />

        {/* Graph View */}
        <main className="world-graph-container">
          {viewMode === 'graph3d' && (
            <GraphView3D
              key={`3d-view-${edgeMetric}`}
              data={filteredData}
              selectedNodeId={selectedEntityId}
              onNodeSelect={setSelectedEntityId}
              showCatalyzedBy={filters.showCatalyzedBy}
              edgeMetric={edgeMetric}
            />
          )}
          {viewMode === 'graph2d' && (
            <GraphView
              key="2d-view"
              data={filteredData}
              selectedNodeId={selectedEntityId}
              onNodeSelect={setSelectedEntityId}
              showCatalyzedBy={filters.showCatalyzedBy}
              onRecalculateLayoutRef={(handler) => { recalculateLayoutRef.current = handler; }}
            />
          )}
          {viewMode === 'map' && (
            <CoordinateMapView
              key="map-view"
              data={filteredData}
              selectedNodeId={selectedEntityId}
              onNodeSelect={setSelectedEntityId}
            />
          )}
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
    </div>
  );
}
