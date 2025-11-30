import { useEffect, useState } from 'react';
import WorldExplorer from './components/WorldExplorer.tsx';
import type { WorldState, LoreData, ImageMetadata } from './types/world.ts';

function App() {
  const [worldData, setWorldData] = useState<WorldState | null>(null);
  const [loreData, setLoreData] = useState<LoreData | null>(null);
  const [imageData, setImageData] = useState<ImageMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load world data, lore data, and image metadata
    // In production, these files should be in the public folder
    // Paths are relative to the root of the deployed site
    Promise.all([
      fetch('/generated_world.json').then(res => {
        if (!res.ok) throw new Error('Failed to load world data');
        return res.json();
      }),
      fetch('/lore.json')
        .then(res => {
          if (!res.ok) {
            console.warn('Lore data not found, continuing without it');
            return null;
          }
          return res.json();
        })
        .catch(() => {
          console.warn('Lore data not available');
          return null;
        }),
      fetch('/images/image_metadata.json')
        .then(res => {
          if (!res.ok) {
            console.warn('Image metadata not found, continuing without it');
            return null;
          }
          return res.json();
        })
        .catch(() => {
          console.warn('Image metadata not available');
          return null;
        })
    ])
      .then(([world, lore, images]) => {
        setWorldData(world);
        setLoreData(lore);
        setImageData(images);
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

  return <WorldExplorer worldData={worldData} loreData={loreData} imageData={imageData} />;
}

export default App;
