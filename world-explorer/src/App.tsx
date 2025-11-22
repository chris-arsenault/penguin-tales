import { useEffect, useState } from 'react';
import WorldExplorer from './components/WorldExplorer.tsx';
import type { WorldState } from './types/world.ts';

function App() {
  const [worldData, setWorldData] = useState<WorldState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/src/data/worldData.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load world data');
        return res.json();
      })
      .then(data => {
        setWorldData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">🐧</div>
          <div className="text-xl">Loading world history...</div>
        </div>
      </div>
    );
  }

  if (error || !worldData) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="text-center text-red-400">
          <div className="text-4xl mb-4">❌</div>
          <div className="text-xl mb-2">Failed to load world data</div>
          <div className="text-sm text-gray-400">{error || 'Unknown error'}</div>
        </div>
      </div>
    );
  }

  return <WorldExplorer worldData={worldData} />;
}

export default App;
