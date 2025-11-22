import { useState } from 'react';
import type { WorldState, Filters, EntityKind } from '../types/world.ts';
import { applyFilters } from '../utils/dataTransform.ts';
import GraphView from './GraphView.tsx';
import FilterPanel from './FilterPanel.tsx';
import EntityDetail from './EntityDetail.tsx';

interface WorldExplorerProps {
  worldData: WorldState;
}

export default function WorldExplorer({ worldData }: WorldExplorerProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string | undefined>(undefined);
  const [filters, setFilters] = useState<Filters>({
    kinds: ['npc', 'faction', 'location', 'rules', 'abilities'] as EntityKind[],
    minProminence: 'forgotten',
    timeRange: [0, worldData.metadata.tick],
    tags: [],
    searchQuery: ''
  });

  const filteredData = applyFilters(worldData, filters);

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">World History Explorer</h1>
            <p className="text-sm text-gray-400 mt-1">
              Procedurally Generated Super Penguin Colony History
            </p>
          </div>
          <div className="text-right text-sm text-gray-400">
            <div>Epoch: {worldData.metadata.epoch}</div>
            <div>Tick: {worldData.metadata.tick}</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Filter Panel */}
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          worldData={worldData}
        />

        {/* Graph View */}
        <main className="flex-1">
          <GraphView
            data={filteredData}
            selectedNodeId={selectedEntityId}
            onNodeSelect={setSelectedEntityId}
          />
        </main>

        {/* Entity Detail Panel */}
        <EntityDetail
          entityId={selectedEntityId}
          worldData={worldData}
          onRelatedClick={setSelectedEntityId}
        />
      </div>

      {/* Footer Status Bar */}
      <footer className="bg-gray-900 border-t border-gray-800 px-6 py-2 text-xs text-gray-400">
        <div className="flex items-center justify-between">
          <div>
            Showing {filteredData.metadata.entityCount} of {worldData.metadata.entityCount} entities
            {' • '}
            {filteredData.metadata.relationshipCount} of {worldData.metadata.relationshipCount} relationships
          </div>
          <div>
            {selectedEntityId ? `Selected: ${selectedEntityId}` : 'No selection'}
          </div>
        </div>
      </footer>
    </div>
  );
}
