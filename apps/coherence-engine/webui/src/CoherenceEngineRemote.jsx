/**
 * CoherenceEngineRemote - Module Federation entry point for Coherence Engine
 *
 * This component is loaded by The Canonry shell and receives:
 * - schema: Read-only world schema (entityKinds, relationshipKinds, cultures)
 * - eras: Array of era configurations
 * - onErasChange: Callback when eras are modified
 * - activeSection: Current navigation section
 * - onSectionChange: Callback when navigation changes
 *
 * The Coherence Engine provides configuration and validation tools for
 * world simulation parameters: pressures, eras, generators, actions, and systems.
 */

import React from 'react';
import ErasEditor from './components/ErasEditor';
import PressuresEditor from './components/PressuresEditor';
import GeneratorsEditor from './components/GeneratorsEditor';

const TABS = [
  { id: 'pressures', label: 'Pressures' },
  { id: 'eras', label: 'Eras' },
  { id: 'generators', label: 'Generators' },
  { id: 'actions', label: 'Actions' },
  { id: 'systems', label: 'Systems' },
];

// Coherence Engine accent gradient (amber) - Arctic Blue base theme
const ACCENT_GRADIENT = 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)';
const ACCENT_COLOR = '#f59e0b';

const styles = {
  container: {
    display: 'flex',
    height: '100%',
    backgroundColor: '#0a1929',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  sidebar: {
    width: '200px',
    backgroundColor: '#0c1f2e',
    borderRight: '1px solid rgba(59, 130, 246, 0.3)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  nav: {
    padding: '12px',
  },
  navButton: {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    marginBottom: '4px',
    fontSize: '13px',
    fontWeight: 500,
    textAlign: 'left',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    fontFamily: 'inherit',
  },
  navButtonInactive: {
    backgroundColor: 'transparent',
    color: '#93c5fd',
  },
  navButtonActive: {
    background: ACCENT_GRADIENT,
    color: '#0a1929',
    fontWeight: 600,
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#60a5fa',
    textAlign: 'center',
  },
  placeholderIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.5,
  },
  placeholderTitle: {
    fontSize: '18px',
    fontWeight: 500,
    marginBottom: '8px',
    color: '#ffffff',
  },
  placeholderDesc: {
    fontSize: '14px',
    color: '#93c5fd',
    maxWidth: '400px',
  },
};

// Placeholder descriptions for each section
const SECTION_INFO = {
  pressures: {
    title: 'Pressures',
    description: 'Configure environmental and social pressures that drive world evolution. Pressures create constraints and opportunities that shape entity behavior.',
  },
  eras: {
    title: 'Eras',
    description: 'Define historical eras and their characteristics. Eras determine which templates and systems are active during different phases of world generation.',
  },
  generators: {
    title: 'Generators',
    description: 'Configure entity generators (growth templates) that populate the world. Each generator creates entities with specific characteristics and relationships.',
  },
  actions: {
    title: 'Actions',
    description: 'Define the action domains available to entities. Actions determine how entities interact with each other and the world.',
  },
  systems: {
    title: 'Systems',
    description: 'Configure simulation systems that run during the simulation phase. Systems create relationships and modify entity states based on world conditions.',
  },
};

export default function CoherenceEngineRemote({
  schema,
  eras = [],
  onErasChange,
  pressures = [],
  onPressuresChange,
  generators = [],
  onGeneratorsChange,
  activeSection,
  onSectionChange,
}) {
  // Use passed-in section or default to 'pressures'
  const activeTab = activeSection || 'pressures';
  const setActiveTab = onSectionChange || (() => {});

  const currentSection = SECTION_INFO[activeTab] || SECTION_INFO.pressures;

  const renderContent = () => {
    switch (activeTab) {
      case 'pressures':
        return (
          <PressuresEditor
            pressures={pressures}
            onChange={onPressuresChange || (() => {})}
          />
        );
      case 'eras':
        return (
          <ErasEditor
            eras={eras}
            onChange={onErasChange || (() => {})}
          />
        );
      case 'generators':
        return (
          <GeneratorsEditor
            generators={generators}
            onChange={onGeneratorsChange || (() => {})}
          />
        );
      default:
        return (
          <div style={styles.placeholder}>
            <div style={styles.placeholderIcon}></div>
            <div style={styles.placeholderTitle}>{currentSection.title}</div>
            <div style={styles.placeholderDesc}>{currentSection.description}</div>
          </div>
        );
    }
  };

  return (
    <div style={styles.container}>
      {/* Left sidebar with nav */}
      <div style={styles.sidebar}>
        <nav style={styles.nav}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.navButton,
                ...(activeTab === tab.id
                  ? styles.navButtonActive
                  : styles.navButtonInactive),
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.backgroundColor = 'rgba(245, 158, 11, 0.15)';
                  e.target.style.color = ACCENT_COLOR;
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#93c5fd';
                }
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main content area */}
      <div style={styles.main}>
        <div style={styles.content}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
