/**
 * UnmappedTab - Shows unrecognized/deprecated properties in a generator
 *
 * Displays any properties that aren't part of the current schema,
 * allowing users to remove deprecated fields from old project files.
 */

import React, { useMemo } from 'react';

// Known top-level properties for a DeclarativeTemplate
const KNOWN_PROPERTIES = new Set([
  'id',
  'name',
  'enabled',
  'applicability',
  'selection',
  'creation',
  'relationships',
  'stateUpdates',
  'variables',
  'metadata',
]);

/**
 * Recursively find unknown keys in an object based on expected structure
 */
function findUnknownProperties(obj, path = '') {
  const unknown = [];

  if (!obj || typeof obj !== 'object') return unknown;

  // At top level, check against known properties
  if (path === '') {
    Object.keys(obj).forEach(key => {
      if (!KNOWN_PROPERTIES.has(key)) {
        unknown.push({
          path: key,
          value: obj[key],
        });
      }
    });
  }

  return unknown;
}

export function UnmappedTab({ generator, onChange }) {
  const unknownProperties = useMemo(
    () => findUnknownProperties(generator),
    [generator]
  );

  const handleRemove = (propertyPath) => {
    const updated = { ...generator };
    delete updated[propertyPath];
    onChange(updated);
  };

  const handleRemoveAll = () => {
    const updated = { ...generator };
    unknownProperties.forEach(prop => {
      delete updated[prop.path];
    });
    onChange(updated);
  };

  if (unknownProperties.length === 0) {
    return (
      <div className="section">
        <div style={{
          textAlign: 'center',
          padding: '48px 24px',
          color: 'var(--text-muted)',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '16px' }}>✓</div>
          <div>No unrecognized properties found.</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>
            This generator matches the current schema.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section" style={{
        backgroundColor: 'rgba(248, 113, 113, 0.1)',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '24px',
      }}>
        <div className="section-title" style={{ color: '#f87171' }}>
          <span>⚠️</span> Unrecognized Properties
        </div>
        <div className="section-desc" style={{ marginBottom: '16px' }}>
          These properties are not part of the current generator schema.
          They may be from an older version of the application and can be safely removed.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button
            className="btn btn-danger"
            onClick={handleRemoveAll}
          >
            Remove All ({unknownProperties.length})
          </button>
        </div>

        {unknownProperties.map((prop, idx) => (
          <div key={idx} className="item-card" style={{ borderColor: 'rgba(248, 113, 113, 0.4)', marginBottom: '12px' }}>
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: '8px', fontFamily: 'monospace' }}>
                    {prop.path}
                  </div>
                  <pre style={{
                    fontSize: '11px',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    padding: '8px',
                    borderRadius: '4px',
                    overflow: 'auto',
                    margin: 0,
                    maxHeight: '150px',
                  }}>
                    {JSON.stringify(prop.value, null, 2)}
                  </pre>
                </div>
                <button
                  className="btn btn-danger"
                  onClick={() => handleRemove(prop.path)}
                  style={{ flexShrink: 0 }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UnmappedTab;
