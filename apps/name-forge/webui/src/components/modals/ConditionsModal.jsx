import { useState, useEffect } from 'react';
import { ModalShell } from '@penguin-tales/shared-components';
import { PROMINENCE_LEVELS } from '../constants';

function ConditionsModal({ isOpen, onClose, conditions, onChange }) {
  const [localConditions, setLocalConditions] = useState(conditions || {});

  useEffect(() => {
    setLocalConditions(conditions || {});
  }, [conditions, isOpen]);

  const handleSave = () => {
    // Clean up empty values
    const cleaned = {};
    if (localConditions.tags?.length > 0) cleaned.tags = localConditions.tags;
    if (localConditions.requireAllTags) cleaned.requireAllTags = true;
    if (localConditions.prominence?.length > 0) cleaned.prominence = localConditions.prominence;
    if (localConditions.subtype?.length > 0) cleaned.subtype = localConditions.subtype;

    onChange(Object.keys(cleaned).length > 0 ? cleaned : undefined);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <ModalShell onClose={onClose} title="Strategy Conditions" className="conditions-modal">
      <p className="text-muted text-small mt-0">
        Define when this strategy should be used. Leave empty for unconditional use.
      </p>

      {/* Tags */}
      <div className="form-group">
        <label>Entity Tags</label>
        <input
          value={(localConditions.tags || []).join(', ')}
          onChange={(e) => {
            const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t);
            setLocalConditions({ ...localConditions, tags: tags.length > 0 ? tags : undefined });
          }}
          placeholder="e.g., royal, noble, legendary"
        />
        <small className="text-muted">Comma-separated list of tags to match</small>
        <div className="mt-sm">
          <label className="flex align-center gap-sm text-small">
            <input
              type="checkbox"
              checked={localConditions.requireAllTags || false}
              onChange={(e) => setLocalConditions({
                ...localConditions,
                requireAllTags: e.target.checked || undefined
              })}
            />
            Require ALL tags (default: match any tag)
          </label>
        </div>
      </div>

      {/* Prominence */}
      <div className="form-group">
        <label>Prominence Levels</label>
        <div className="flex flex-wrap gap-sm mt-xs">
          {PROMINENCE_LEVELS.map(level => {
            const isSelected = (localConditions.prominence || []).includes(level);
            return (
              <button
                key={level}
                type="button"
                onClick={() => {
                  const current = localConditions.prominence || [];
                  const updated = isSelected
                    ? current.filter(l => l !== level)
                    : [...current, level];
                  setLocalConditions({
                    ...localConditions,
                    prominence: updated.length > 0 ? updated : undefined
                  });
                }}
                className={`pill-button ${isSelected ? 'selected-gold' : ''}`}
              >
                {level}
              </button>
            );
          })}
        </div>
        <small className="text-muted mt-sm block">
          Only use this strategy for entities with selected prominence levels
        </small>
      </div>

      {/* Subtype */}
      <div className="form-group">
        <label>Entity Subtypes</label>
        <input
          value={(localConditions.subtype || []).join(', ')}
          onChange={(e) => {
            const subtypes = e.target.value.split(',').map(t => t.trim()).filter(t => t);
            setLocalConditions({ ...localConditions, subtype: subtypes.length > 0 ? subtypes : undefined });
          }}
          placeholder="e.g., merchant, artisan, warrior"
        />
        <small className="text-muted">Comma-separated list of subtypes to match</small>
      </div>

      {/* Summary */}
      {(localConditions.tags?.length > 0 || localConditions.prominence?.length > 0 || localConditions.subtype?.length > 0) && (
        <div className="conditions-preview">
          <strong className="text-gold">Preview:</strong> This strategy will be used when entity has{' '}
          {[
            localConditions.tags?.length > 0 && `${localConditions.requireAllTags ? 'ALL' : 'any'} tags: ${localConditions.tags.join(', ')}`,
            localConditions.prominence?.length > 0 && `prominence: ${localConditions.prominence.join(' or ')}`,
            localConditions.subtype?.length > 0 && `subtype: ${localConditions.subtype.join(' or ')}`
          ].filter(Boolean).join(' AND ')}
        </div>
      )}

      <div className="flex gap-md mt-lg justify-end">
        <button className="secondary" onClick={onClose}>Cancel</button>
        <button className="primary" onClick={handleSave}>Save Conditions</button>
      </div>
    </ModalShell>
  );
}

export default ConditionsModal;
