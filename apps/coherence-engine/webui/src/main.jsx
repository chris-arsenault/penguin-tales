import React from 'react';
import ReactDOM from 'react-dom/client';
import CoherenceEngineRemote from './CoherenceEngineRemote';

// Standalone entry point for development
// In production, this is loaded via Module Federation from The Canonry

const mockSchema = {
  entityKinds: [],
  relationshipKinds: [],
  cultures: [],
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div style={{ height: '100vh', backgroundColor: '#1e1e2e' }}>
      <CoherenceEngineRemote
        schema={mockSchema}
        activeSection="pressures"
        onSectionChange={(section) => console.log('Section changed:', section)}
      />
    </div>
  </React.StrictMode>
);
