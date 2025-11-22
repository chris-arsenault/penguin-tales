import { useState, useEffect, useRef } from 'react';
import type { WorldState, LoreData, EraNarrativeLore, DiscoveryEventLore } from '../types/world.ts';
import EraNarrative from './EraNarrative.tsx';
import DiscoveryStory from './DiscoveryStory.tsx';
import './TimelineControl.css';

interface TimelineControlProps {
  worldData: WorldState;
  loreData: LoreData | null;
  currentTick: number;
  onTickChange: (tick: number) => void;
}

export default function TimelineControl({ worldData, loreData, currentTick, onTickChange }: TimelineControlProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [selectedEraNarrative, setSelectedEraNarrative] = useState<EraNarrativeLore | null>(null);
  const [selectedDiscovery, setSelectedDiscovery] = useState<DiscoveryEventLore | null>(null);
  const previousTickRef = useRef(currentTick);

  const maxTick = worldData.metadata.tick;
  const minTick = 0;

  // Get all era narratives from lore
  const eraNarratives = (loreData?.records.filter(
    record => record.type === 'era_narrative'
  ) as EraNarrativeLore[]) || [];

  // Get all discovery events from lore
  const discoveryEvents = (loreData?.records.filter(
    record => record.type === 'discovery_event'
  ) as DiscoveryEventLore[]) || [];

  // Detect when crossing era transition ticks
  useEffect(() => {
    const previousTick = previousTickRef.current;
    previousTickRef.current = currentTick;

    // Check if we crossed an era transition
    const crossedNarrative = eraNarratives.find(
      narrative => {
        const tick = narrative.metadata.tick;
        return (previousTick < tick && currentTick >= tick) ||
               (previousTick > tick && currentTick <= tick);
      }
    );

    if (crossedNarrative && isPlaying) {
      // Auto-show narrative when playing through
      setSelectedEraNarrative(crossedNarrative);
      setIsPlaying(false);
    }
  }, [currentTick, eraNarratives, isPlaying]);

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const nextTick = currentTick + playSpeed;
      if (nextTick >= maxTick) {
        setIsPlaying(false);
        onTickChange(maxTick);
      } else {
        onTickChange(nextTick);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isPlaying, playSpeed, maxTick, currentTick, onTickChange]);

  // Get events for current tick, sorted with simulation events first
  const currentEvents = worldData.history
    .filter(e => e.tick === currentTick)
    .sort((a, b) => {
      // Simulation events first, then growth, then special
      const order = { simulation: 0, growth: 1, special: 2 };
      return order[a.type] - order[b.type];
    });

  // Get current era
  const currentEvent = worldData.history.find(e => e.tick <= currentTick);
  const currentEra = currentEvent?.era || 'unknown';

  // Count entities and relationships at current tick
  const entitiesAtTick = worldData.hardState.filter(e => e.createdAt <= currentTick).length;
  const relationshipsAtTick = worldData.relationships.filter(r => {
    const srcEntity = worldData.hardState.find(e => e.id === r.src);
    const dstEntity = worldData.hardState.find(e => e.id === r.dst);
    return srcEntity && dstEntity && srcEntity.createdAt <= currentTick && dstEntity.createdAt <= currentTick;
  }).length;

  const handlePlayPause = () => {
    if (currentTick >= maxTick) {
      onTickChange(minTick);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    onTickChange(minTick);
  };

  const handleToEnd = () => {
    setIsPlaying(false);
    onTickChange(maxTick);
  };

  return (
    <div className="timeline-control">
      <div className="timeline-header">
        <div className="timeline-title">
          <span className="timeline-icon">⏱️</span>
          <span>Timeline</span>
        </div>
        <div className="timeline-stats">
          <span className="timeline-stat">Tick {currentTick}</span>
          <span className="timeline-divider">•</span>
          <span className="timeline-stat era-badge">{currentEra}</span>
          <span className="timeline-divider">•</span>
          <span className="timeline-stat">{entitiesAtTick} entities</span>
          <span className="timeline-divider">•</span>
          <span className="timeline-stat">{relationshipsAtTick} links</span>
        </div>
      </div>

      <div className="timeline-slider-container">
        <input
          type="range"
          min={minTick}
          max={maxTick}
          value={currentTick}
          onChange={(e) => {
            setIsPlaying(false);
            onTickChange(parseInt(e.target.value));
          }}
          className="timeline-slider"
        />
        <div className="timeline-markers">
          <span>{minTick}</span>
          <span>{maxTick}</span>
        </div>
      </div>

      <div className="timeline-controls">
        <button onClick={handleReset} className="timeline-btn" title="Reset to start">
          ⏮
        </button>
        <button onClick={handlePlayPause} className="timeline-btn timeline-btn-play">
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={handleToEnd} className="timeline-btn" title="Jump to end">
          ⏭
        </button>

        <div className="timeline-speed">
          <label>Speed:</label>
          <select
            value={playSpeed}
            onChange={(e) => setPlaySpeed(Number(e.target.value))}
            className="timeline-speed-select"
          >
            <option value={1}>1x</option>
            <option value={2}>2x</option>
            <option value={5}>5x</option>
            <option value={10}>10x</option>
          </select>
        </div>
      </div>

      <div className="timeline-events">
        <div className="timeline-events-header">
          {currentEvents.length > 0 ? `Events at Tick ${currentTick}:` : 'No events at this tick'}
        </div>
        <div className="timeline-events-ticker">
          {currentEvents.length > 0 ? (
            currentEvents.map((event, idx) => (
              <div key={idx} className={`timeline-event timeline-event-${event.type}`}>
                <span className="timeline-event-type">{event.type === 'growth' ? '🌱' : '⚙️'}</span>
                <span className="timeline-event-desc">{event.description}</span>
              </div>
            ))
          ) : (
            <div className="timeline-event-empty">
              Scrub through time to see historical events unfold
            </div>
          )}
        </div>
      </div>

      {/* Era Narrative & Discovery Milestones */}
      {(eraNarratives.length > 0 || discoveryEvents.length > 0) && (
        <div className="timeline-milestones">
          {/* Era Narratives */}
          {eraNarratives.map(narrative => {
            const tick = narrative.metadata.tick;
            const percent = (tick / maxTick) * 100;
            return (
              <button
                key={narrative.id}
                className={`timeline-milestone timeline-milestone-era ${currentTick === tick ? 'active' : ''}`}
                style={{ left: `${percent}%` }}
                onClick={() => setSelectedEraNarrative(narrative)}
                title={`${narrative.metadata.from} → ${narrative.metadata.to} (Tick ${tick})`}
              >
                📜
              </button>
            );
          })}
          {/* Discovery Events */}
          {discoveryEvents.map(discovery => {
            const tick = discovery.metadata.tick;
            const percent = (tick / maxTick) * 100;
            return (
              <button
                key={discovery.id}
                className={`timeline-milestone timeline-milestone-discovery timeline-milestone-${discovery.metadata.discoveryType} ${currentTick === tick ? 'active' : ''}`}
                style={{ left: `${percent}%` }}
                onClick={() => setSelectedDiscovery(discovery)}
                title={`Discovery by ${discovery.metadata.explorer} (Tick ${tick})`}
              >
                🧭
              </button>
            );
          })}
        </div>
      )}

      {/* Era Narrative Modal */}
      {selectedEraNarrative && (
        <EraNarrative
          lore={selectedEraNarrative}
          onClose={() => setSelectedEraNarrative(null)}
        />
      )}

      {/* Discovery Story Modal */}
      {selectedDiscovery && (
        <DiscoveryStory
          lore={selectedDiscovery}
          onExplorerClick={() => {}}
          onClose={() => setSelectedDiscovery(null)}
          isModal={true}
        />
      )}
    </div>
  );
}
