import React from 'react';
import ReactDOM from 'react-dom/client';
import IlluminatorRemote from './IlluminatorRemote';
import './App.css';

// Standalone entry point for development
// In production, this is loaded via Module Federation from The Canonry

const mockSchema = {
  entityKinds: [
    { kind: 'npc', description: 'Character', subtypes: [{ id: 'hero', name: 'Hero' }, { id: 'merchant', name: 'Merchant' }] },
    { kind: 'location', description: 'Location', subtypes: [{ id: 'settlement', name: 'Settlement' }, { id: 'landmark', name: 'Landmark' }] },
    { kind: 'faction', description: 'Faction', subtypes: [{ id: 'guild', name: 'Guild' }, { id: 'nation', name: 'Nation' }] },
  ],
  relationshipKinds: [
    { kind: 'leader_of', description: 'Leadership', srcKinds: ['npc'], dstKinds: ['faction'] },
    { kind: 'member_of', description: 'Membership', srcKinds: ['npc'], dstKinds: ['faction'] },
  ],
  cultures: [
    { id: 'northern', name: 'Northern Realm', description: 'Hardy folk from the frozen north', color: '#60a5fa' },
    { id: 'southern', name: 'Southern Empire', description: 'Sophisticated traders of the south', color: '#f59e0b' },
  ],
};

// Mock world data simulating lore-weave output
const mockWorldData = {
  metadata: {
    generatedAt: Date.now(),
    version: '1.0.0',
  },
  hardState: [
    { id: 'hero_001', kind: 'npc', subtype: 'hero', name: 'Grizzletooth the Bold', description: '', status: 'active', prominence: 'mythic', culture: 'northern', tags: {}, links: [], coordinates: { x: 50, y: 50 }, createdAt: 1, updatedAt: 10 },
    { id: 'hero_002', kind: 'npc', subtype: 'hero', name: 'Silverfin the Swift', description: '', status: 'active', prominence: 'renowned', culture: 'southern', tags: {}, links: [], coordinates: { x: 60, y: 40 }, createdAt: 2, updatedAt: 8 },
    { id: 'loc_001', kind: 'location', subtype: 'landmark', name: 'The Frozen Throne', description: '', status: 'active', prominence: 'mythic', culture: 'northern', tags: {}, links: [], coordinates: { x: 45, y: 55 }, createdAt: 1, updatedAt: 5 },
    { id: 'faction_001', kind: 'faction', subtype: 'nation', name: 'The Ice Confederacy', description: '', status: 'active', prominence: 'renowned', culture: 'northern', tags: {}, links: [], coordinates: { x: 40, y: 50 }, createdAt: 3, updatedAt: 12 },
  ],
  relationships: [],
  pressures: {},
  history: [],
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div style={{ height: '100vh', backgroundColor: '#1e1e2e' }}>
      <IlluminatorRemote
        projectId="mock-project"
        schema={mockSchema}
        worldData={mockWorldData}
        onEnrichmentComplete={(enrichedWorld) => console.log('Enrichment complete:', enrichedWorld)}
        activeSection="configure"
        onSectionChange={(section) => console.log('Section changed:', section)}
      />
    </div>
  </React.StrictMode>
);
