/**
 * RemotePlaceholder - Shown when a remote module is not available
 */

import React from 'react';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '40px',
    textAlign: 'center',
  },
  icon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    marginBottom: '8px',
    color: '#ccc',
  },
  message: {
    fontSize: '14px',
    color: '#888',
    marginBottom: '24px',
    maxWidth: '400px',
  },
  instructions: {
    backgroundColor: '#1a1a2e',
    padding: '16px 24px',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#aaa',
    fontFamily: 'monospace',
  },
};

export default function RemotePlaceholder({ name, port, instructions }) {
  return (
    <div style={styles.container}>
      <div style={styles.icon}>🔌</div>
      <div style={styles.title}>{name} Not Connected</div>
      <div style={styles.message}>
        The {name} module is not currently running. Start it to enable this feature.
      </div>
      {instructions && (
        <div style={styles.instructions}>
          {instructions}
        </div>
      )}
    </div>
  );
}
