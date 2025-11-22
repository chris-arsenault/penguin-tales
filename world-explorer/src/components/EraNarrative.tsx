import type { EraNarrativeLore } from '../types/world.ts';
import './EraNarrative.css';

interface EraNarrativeProps {
  lore: EraNarrativeLore;
  onClose: () => void;
}

export default function EraNarrative({ lore, onClose }: EraNarrativeProps) {
  // Extract title from the text (first sentence or before colon)
  const titleMatch = lore.text.match(/^([^:.]+)[:.]/) || lore.text.match(/^(.{0,50})/);
  const title = titleMatch ? titleMatch[1].trim() : 'Era Transition';
  const narrative = lore.text;

  return (
    <div className="era-narrative-overlay" onClick={onClose}>
      <div className="era-narrative-modal" onClick={(e) => e.stopPropagation()}>
        <div className="era-narrative-header">
          <div className="era-narrative-icon">⚔️</div>
          <h2 className="era-narrative-title">{title}</h2>
          <div className="era-narrative-icon">⚔️</div>
        </div>

        <div className="era-narrative-transition">
          <span className="era-narrative-era era-narrative-era-from">{lore.metadata.from}</span>
          <span className="era-narrative-arrow">→</span>
          <span className="era-narrative-era era-narrative-era-to">{lore.metadata.to}</span>
        </div>

        <div className="era-narrative-content">
          {narrative}
        </div>

        <div className="era-narrative-footer">
          <span className="era-narrative-tick">Tick {lore.metadata.tick}</span>
          <button onClick={onClose} className="era-narrative-close">Close</button>
        </div>
      </div>
    </div>
  );
}
