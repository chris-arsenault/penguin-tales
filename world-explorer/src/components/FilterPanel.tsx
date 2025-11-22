import type { EntityKind, Filters, Prominence, WorldState } from '../types/world.ts';
import { getAllTags } from '../utils/dataTransform.ts';

interface FilterPanelProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  worldData: WorldState;
}

export default function FilterPanel({ filters, onChange, worldData }: FilterPanelProps) {
  const allTags = getAllTags(worldData);
  const maxTick = worldData.metadata.tick;

  const toggleKind = (kind: EntityKind) => {
    const kinds = filters.kinds.includes(kind)
      ? filters.kinds.filter(k => k !== kind)
      : [...filters.kinds, kind];
    onChange({ ...filters, kinds });
  };

  const toggleTag = (tag: string) => {
    const tags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    onChange({ ...filters, tags });
  };

  const entityKinds: EntityKind[] = ['npc', 'faction', 'location', 'rules', 'abilities'];
  const prominenceLevels: Prominence[] = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

  return (
    <div className="w-64 h-full bg-gray-900 text-white p-4 overflow-y-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-4">Filters</h2>
      </div>

      {/* Search */}
      <div>
        <label className="block text-sm font-medium mb-2">Search</label>
        <input
          type="text"
          value={filters.searchQuery}
          onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
          placeholder="Search entities..."
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Entity Types */}
      <div>
        <label className="block text-sm font-medium mb-2">Entity Types</label>
        <div className="space-y-2">
          {entityKinds.map(kind => (
            <label key={kind} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.kinds.includes(kind)}
                onChange={() => toggleKind(kind)}
                className="rounded"
              />
              <span className="text-sm capitalize">{kind}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Minimum Prominence */}
      <div>
        <label className="block text-sm font-medium mb-2">Minimum Prominence</label>
        <select
          value={filters.minProminence}
          onChange={(e) => onChange({ ...filters, minProminence: e.target.value as Prominence })}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {prominenceLevels.map(level => (
            <option key={level} value={level} className="capitalize">
              {level}
            </option>
          ))}
        </select>
      </div>

      {/* Time Range */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Time Range: {filters.timeRange[0]} - {filters.timeRange[1]}
        </label>
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={maxTick}
            value={filters.timeRange[0]}
            onChange={(e) => onChange({
              ...filters,
              timeRange: [parseInt(e.target.value), filters.timeRange[1]]
            })}
            className="w-full"
          />
          <input
            type="range"
            min={0}
            max={maxTick}
            value={filters.timeRange[1]}
            onChange={(e) => onChange({
              ...filters,
              timeRange: [filters.timeRange[0], parseInt(e.target.value)]
            })}
            className="w-full"
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Tags ({filters.tags.length} selected)
        </label>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {allTags.map(tag => (
            <label key={tag} className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={filters.tags.includes(tag)}
                onChange={() => toggleTag(tag)}
                className="rounded"
              />
              <span>{tag}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => onChange({
          kinds: entityKinds,
          minProminence: 'forgotten',
          timeRange: [0, maxTick],
          tags: [],
          searchQuery: ''
        })}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
      >
        Reset Filters
      </button>

      {/* Stats */}
      <div className="pt-4 border-t border-gray-700 text-xs text-gray-400 space-y-1">
        <div>Entities: {worldData.metadata.entityCount}</div>
        <div>Relationships: {worldData.metadata.relationshipCount}</div>
        <div>Epoch: {worldData.metadata.epoch}</div>
        <div>Tick: {worldData.metadata.tick}</div>
      </div>
    </div>
  );
}
