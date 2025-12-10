import React from 'react';
import ReactDOM from 'react-dom/client';
import LoreWeaveRemote from './LoreWeaveRemote';
import './App.css';

// Standalone entry point for development
// In production, this is loaded via Module Federation from The Canonry

const mockSchema = {
  entityKinds: [
    { kind: 'npc', description: 'Character', subtypes: [{ id: 'hero', name: 'Hero' }, { id: 'merchant', name: 'Merchant' }, { id: 'ruler', name: 'Ruler' }], statuses: [{ id: 'active', name: 'Active', isTerminal: false }, { id: 'historical', name: 'Historical', isTerminal: true }] },
    { kind: 'location', description: 'Location', subtypes: [{ id: 'settlement', name: 'Settlement' }, { id: 'landmark', name: 'Landmark' }, { id: 'region', name: 'Region' }], statuses: [{ id: 'active', name: 'Active', isTerminal: false }, { id: 'ruined', name: 'Ruined', isTerminal: true }] },
    { kind: 'faction', description: 'Faction', subtypes: [{ id: 'guild', name: 'Guild' }, { id: 'nation', name: 'Nation' }, { id: 'cult', name: 'Cult' }], statuses: [{ id: 'active', name: 'Active', isTerminal: false }, { id: 'dissolved', name: 'Dissolved', isTerminal: true }] },
  ],
  relationshipKinds: [
    { kind: 'leader_of', description: 'Leadership relationship', srcKinds: ['npc'], dstKinds: ['faction'] },
    { kind: 'member_of', description: 'Membership relationship', srcKinds: ['npc'], dstKinds: ['faction'] },
    { kind: 'resident_of', description: 'Residency relationship', srcKinds: ['npc'], dstKinds: ['location'] },
  ],
  cultures: [
    { id: 'northern', name: 'Northern Realm', description: 'Hardy folk from the frozen north', color: '#60a5fa' },
    { id: 'southern', name: 'Southern Empire', description: 'Sophisticated traders of the south', color: '#f59e0b' },
  ],
};

const mockEras = [
  { id: 'founding', name: 'The Founding', description: 'The world takes shape', templateWeights: {}, systemModifiers: {} },
  { id: 'expansion', name: 'Age of Expansion', description: 'Nations grow and collide', templateWeights: {}, systemModifiers: {} },
];

const mockPressures = [
  { id: 'conflict', name: 'Conflict', initialValue: 30, homeostasis: 0.05, description: 'Positive = strife; negative = peace.' },
  { id: 'prosperity', name: 'Prosperity', initialValue: 60, homeostasis: 0.1, description: 'Positive = thriving; negative = recession.' },
];

const mockGenerators = [
  { id: 'spawn_hero', name: 'Spawn Hero', creation: [{ kind: 'npc', subtype: 'hero' }], relationships: [] },
  { id: 'spawn_settlement', name: 'Spawn Settlement', creation: [{ kind: 'location', subtype: 'settlement' }], relationships: [] },
];

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div style={{ height: '100vh', backgroundColor: '#1e1e2e' }}>
      <LoreWeaveRemote
        schema={mockSchema}
        eras={mockEras}
        pressures={mockPressures}
        generators={mockGenerators}
        seedEntities={[]}
        seedRelationships={[]}
        namingData={{}}
        semanticData={{}}
        cultureVisuals={{}}
        activeSection="configure"
        onSectionChange={(section) => console.log('Section changed:', section)}
      />
    </div>
  </React.StrictMode>
);
