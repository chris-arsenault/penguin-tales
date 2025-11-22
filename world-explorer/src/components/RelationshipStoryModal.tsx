import type { RelationshipBackstoryLore, WorldState } from '../types/world.ts';
import { getEntityById } from '../utils/dataTransform.ts';
import './RelationshipStoryModal.css';

interface RelationshipStoryModalProps {
  lore: RelationshipBackstoryLore;
  worldData: WorldState;
  onClose: () => void;
}

export default function RelationshipStoryModal({ lore, worldData, onClose }: RelationshipStoryModalProps) {
  const srcEntity = getEntityById(worldData, lore.relationship.src);
  const dstEntity = getEntityById(worldData, lore.relationship.dst);

  // Parse the text which is formatted as "backstory | stakes | perception"
  const parts = lore.text.split('|').map(p => p.trim());
  const backstory = parts[0] || '';
  const stakes = parts[1]?.replace(/^Stakes:\s*/i, '') || '';
  const perception = parts[2]?.replace(/^Perception:\s*/i, '') || '';

  return (
    <div className="relationship-story-overlay" onClick={onClose}>
      <div className="relationship-story-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="relationship-story-header">
          <div className="relationship-story-entities">
            <span className="relationship-story-entity">{srcEntity?.name || lore.relationship.src}</span>
            <span className="relationship-story-kind">{lore.relationship.kind.replace(/_/g, ' ')}</span>
            <span className="relationship-story-entity">{dstEntity?.name || lore.relationship.dst}</span>
          </div>
          <button onClick={onClose} className="relationship-story-close">×</button>
        </div>

        {/* Backstory */}
        <div className="relationship-story-section">
          <div className="relationship-story-section-header">
            <span className="relationship-story-section-icon">📖</span>
            <span className="relationship-story-section-title">How It Began</span>
          </div>
          <div className="relationship-story-section-content">
            {backstory}
          </div>
        </div>

        {/* Stakes */}
        {stakes && (
          <div className="relationship-story-section">
            <div className="relationship-story-section-header">
              <span className="relationship-story-section-icon">⚠️</span>
              <span className="relationship-story-section-title">What's at Stake</span>
            </div>
            <div className="relationship-story-section-content">
              {stakes}
            </div>
          </div>
        )}

        {/* Perception */}
        {perception && (
          <div className="relationship-story-section">
            <div className="relationship-story-section-header">
              <span className="relationship-story-section-icon">👁️</span>
              <span className="relationship-story-section-title">Different Perspectives</span>
            </div>
            <div className="relationship-story-section-content">
              {perception}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
