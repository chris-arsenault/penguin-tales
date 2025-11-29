/**
 * Navigation - Tab bar for switching between tools
 */

import React from 'react';

const styles = {
  nav: {
    display: 'flex',
    gap: '4px',
    padding: '8px 16px',
    backgroundColor: '#12121a',
    borderBottom: '1px solid #1e1e2e',
  },
  tab: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 500,
    border: 'none',
    borderRadius: '6px 6px 0 0',
    cursor: 'pointer',
    transition: 'background-color 0.15s, color 0.15s',
  },
  tabInactive: {
    backgroundColor: 'transparent',
    color: '#888',
  },
  tabActive: {
    backgroundColor: '#1a1a2e',
    color: '#e94560',
  },
  tabDisabled: {
    backgroundColor: 'transparent',
    color: '#444',
    cursor: 'not-allowed',
  },
  badge: {
    marginLeft: '6px',
    padding: '2px 6px',
    fontSize: '10px',
    backgroundColor: '#333',
    borderRadius: '10px',
    color: '#666',
  },
};

const TABS = [
  { id: 'enumerist', label: 'Enumerist', enabled: true },
  { id: 'names', label: 'Name Forge', enabled: true },
  { id: 'cosmography', label: 'Cosmographer', enabled: true },
  { id: 'simulation', label: 'Lore Weave', enabled: false, badge: 'Soon' },
];

export default function Navigation({ activeTab, onTabChange }) {
  return (
    <nav style={styles.nav}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => tab.enabled && onTabChange(tab.id)}
          style={{
            ...styles.tab,
            ...(tab.id === activeTab
              ? styles.tabActive
              : tab.enabled
              ? styles.tabInactive
              : styles.tabDisabled),
          }}
          disabled={!tab.enabled}
        >
          {tab.label}
          {tab.badge && <span style={styles.badge}>{tab.badge}</span>}
        </button>
      ))}
    </nav>
  );
}
