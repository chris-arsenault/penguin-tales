/**
 * EntryPointStep - Step 2: Graph anchor entity selection
 *
 * Shows a searchable list of entities.
 */

import { useState, useMemo } from 'react';
import type { EntityContext, RelationshipContext, NarrativeEventContext } from '../../../lib/chronicleTypes';
import { useWizard } from '../WizardContext';

interface EntryPointStepProps {
  entities: EntityContext[];
  relationships: RelationshipContext[];
  events: NarrativeEventContext[];
}

export default function EntryPointStep({
  entities,
  relationships,
  events,
}: EntryPointStepProps) {
  const { state, selectEntryPoint } = useWizard();
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'connections'>('connections');

  // Count connections per entity
  const connectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const rel of relationships) {
      counts.set(rel.src, (counts.get(rel.src) || 0) + 1);
      counts.set(rel.dst, (counts.get(rel.dst) || 0) + 1);
    }
    return counts;
  }, [relationships]);

  // Filter entities based on search
  const filteredEntities = useMemo(() => {
    // Exclude era entities - they are time periods, not cast members
    let filtered = entities.filter(e => e.kind !== 'era');

    // Apply search filter
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(search) ||
        e.kind.toLowerCase().includes(search) ||
        e.subtype?.toLowerCase().includes(search)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'connections':
          return (connectionCounts.get(b.id) || 0) - (connectionCounts.get(a.id) || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [entities, searchText, sortBy, connectionCounts]);

  const handleSelect = (entity: EntityContext) => {
    selectEntryPoint(entity, entities, relationships, events);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Select Entry Point</h4>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
          Choose the central entity for your chronicle. The narrative will be built around this entity and its connections.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search entities..."
          className="illuminator-input"
          style={{ width: '200px' }}
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'name' | 'connections')}
          className="illuminator-select"
        >
          <option value="connections">Sort by Connections</option>
          <option value="name">Sort by Name</option>
        </select>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '12px', alignSelf: 'center' }}>
          {filteredEntities.length} entities
        </span>
      </div>

      {/* Entity List */}
      <div style={{
        maxHeight: '400px',
        overflowY: 'auto',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
      }}>
        {filteredEntities.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No entities found.
          </div>
        ) : (
          filteredEntities.map(entity => {
            const isSelected = state.entryPointId === entity.id;
            const connections = connectionCounts.get(entity.id) || 0;

            return (
              <div
                key={entity.id}
                onClick={() => handleSelect(entity)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  background: isSelected ? 'var(--accent-color)' : 'transparent',
                  color: isSelected ? 'white' : 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'background 0.2s ease',
                }}
              >
                {/* Selection indicator */}
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: isSelected ? '2px solid white' : '2px solid var(--border-color)',
                  background: isSelected ? 'white' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {isSelected && (
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: 'var(--accent-color)',
                    }} />
                  )}
                </div>

                {/* Entity info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '13px' }}>
                    {entity.name}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}>
                    <span>{entity.kind}</span>
                    {entity.subtype && <span>· {entity.subtype}</span>}
                    {entity.culture && <span>· {entity.culture}</span>}
                  </div>
                </div>

                {/* Metadata badges */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{
                    padding: '2px 6px',
                    background: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                    borderRadius: '4px',
                    fontSize: '10px',
                    color: isSelected ? 'white' : 'var(--text-muted)',
                  }}>
                    {connections} links
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selected Entity Preview */}
      {state.entryPoint && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'var(--bg-tertiary)',
          borderRadius: '8px',
          border: '1px solid var(--accent-color)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 500 }}>{state.entryPoint.name}</span>
              {state.entryPoint.summary && (
                <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {state.entryPoint.summary}
                </p>
              )}
            </div>
            <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)' }}>
              <div>{state.candidates.length} candidates</div>
              <div>in 2-hop neighborhood</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
