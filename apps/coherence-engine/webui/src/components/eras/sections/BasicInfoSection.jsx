/**
 * BasicInfoSection - Era basic information (ID, name, description)
 */

import React from 'react';
import { SectionHeader } from '../../shared';

/**
 * @param {Object} props
 * @param {Object} props.era - The era object
 * @param {Function} props.onFieldChange - Called when a field changes
 */
export function BasicInfoSection({ era, onFieldChange }) {
  return (
    <div className="section">
      <SectionHeader icon="📝" title="Basic Information" />
      <div className="input-grid">
        <div className="form-group">
          <label className="label">ID</label>
          <input
            type="text"
            value={era.id}
            onChange={(e) => onFieldChange('id', e.target.value)}
            className="input"
          />
        </div>
        <div className="form-group">
          <label className="label">Name</label>
          <input
            type="text"
            value={era.name}
            onChange={(e) => onFieldChange('name', e.target.value)}
            className="input"
          />
        </div>
      </div>
      <div className="form-group" style={{ marginTop: '16px' }}>
        <label className="label">Description</label>
        <textarea
          value={era.description}
          onChange={(e) => onFieldChange('description', e.target.value)}
          className="textarea"
        />
      </div>
    </div>
  );
}
