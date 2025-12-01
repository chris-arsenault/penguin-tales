/**
 * DependencyViewer - Visual representation of schema dependencies
 *
 * Shows a compact summary of how elements reference each other:
 * - Schema elements (entity kinds, relationship kinds) → Generators/Systems/Actions
 * - Pressures → Generators/Systems/Actions
 * - Generators/Systems → Eras
 *
 * Uses a grouped list view with expandable sections for detailed views.
 */

import React, { useState, useMemo } from 'react';

const COLORS = {
  bg: '#0a1929',
  bgCard: '#1e3a5f',
  bgDark: '#0c1f2e',
  border: 'rgba(59, 130, 246, 0.3)',
  text: '#ffffff',
  textMuted: '#93c5fd',
  textDim: '#60a5fa',
  accent: '#f59e0b',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
};

const styles = {
  container: {
    backgroundColor: COLORS.bgCard,
    borderRadius: '12px',
    border: `1px solid ${COLORS.border}`,
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    borderBottom: `1px solid ${COLORS.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: COLORS.text,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  legend: {
    display: 'flex',
    gap: '16px',
    fontSize: '11px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: COLORS.textMuted,
  },
  legendDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  section: {
    borderBottom: `1px solid ${COLORS.border}`,
  },
  sectionHeader: {
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  sectionHeaderHover: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: COLORS.text,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sectionCount: {
    fontSize: '12px',
    color: COLORS.textDim,
    backgroundColor: COLORS.bgDark,
    padding: '2px 8px',
    borderRadius: '10px',
  },
  sectionContent: {
    padding: '0 20px 16px',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: COLORS.bgDark,
    borderRadius: '6px',
    marginBottom: '6px',
    fontSize: '13px',
  },
  itemName: {
    color: COLORS.text,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  usedByList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  badge: {
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: 500,
  },
  badgeGenerator: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    color: '#60a5fa',
  },
  badgeSystem: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    color: '#a855f7',
  },
  badgeAction: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: '#22c55e',
  },
  badgePressure: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    color: '#f59e0b',
  },
  badgeEra: {
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    color: '#ec4899',
  },
  orphanBadge: {
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '4px',
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    color: '#9ca3af',
  },
  expandIcon: {
    color: COLORS.textDim,
    fontSize: '12px',
    transition: 'transform 0.2s',
  },
  expandIconOpen: {
    transform: 'rotate(180deg)',
  },
  emptyState: {
    padding: '20px',
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: '13px',
  },
};

function DependencySection({ title, icon, items, renderItem, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [hovering, setHovering] = useState(false);

  if (items.length === 0) return null;

  return (
    <div style={styles.section}>
      <div
        style={{ ...styles.sectionHeader, ...(hovering ? styles.sectionHeaderHover : {}) }}
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div style={styles.sectionTitle}>
          <span>{icon}</span>
          <span>{title}</span>
          <span style={styles.sectionCount}>{items.length}</span>
        </div>
        <span style={{ ...styles.expandIcon, ...(expanded ? styles.expandIconOpen : {}) }}>▼</span>
      </div>
      {expanded && (
        <div style={styles.sectionContent}>
          {items.map((item, index) => renderItem(item, index))}
        </div>
      )}
    </div>
  );
}

function UsageBadges({ usage }) {
  const badges = [];

  if (usage.generators?.length > 0) {
    badges.push(
      <span key="gen" style={{ ...styles.badge, ...styles.badgeGenerator }}>
        {usage.generators.length} gen
      </span>
    );
  }
  if (usage.systems?.length > 0) {
    badges.push(
      <span key="sys" style={{ ...styles.badge, ...styles.badgeSystem }}>
        {usage.systems.length} sys
      </span>
    );
  }
  if (usage.actions?.length > 0) {
    badges.push(
      <span key="act" style={{ ...styles.badge, ...styles.badgeAction }}>
        {usage.actions.length} act
      </span>
    );
  }
  if (usage.pressures?.length > 0) {
    badges.push(
      <span key="pres" style={{ ...styles.badge, ...styles.badgePressure }}>
        {usage.pressures.length} pres
      </span>
    );
  }
  if (usage.eras?.length > 0) {
    badges.push(
      <span key="era" style={{ ...styles.badge, ...styles.badgeEra }}>
        {usage.eras.length} era{usage.eras.length !== 1 ? 's' : ''}
      </span>
    );
  }

  if (badges.length === 0) {
    return <span style={styles.orphanBadge}>Not used</span>;
  }

  return <div style={styles.usedByList}>{badges}</div>;
}

export default function DependencyViewer({ usageMap }) {
  // Prepare entity kinds data
  const entityKindsData = useMemo(() => {
    if (!usageMap?.entityKinds) return [];
    return Object.entries(usageMap.entityKinds)
      .map(([kind, usage]) => ({
        id: kind,
        usage,
        totalUsage: (usage.generators?.length || 0) + (usage.systems?.length || 0) +
                    (usage.actions?.length || 0) + (usage.pressures?.length || 0),
      }))
      .sort((a, b) => b.totalUsage - a.totalUsage);
  }, [usageMap]);

  // Prepare relationship kinds data
  const relationshipKindsData = useMemo(() => {
    if (!usageMap?.relationshipKinds) return [];
    return Object.entries(usageMap.relationshipKinds)
      .map(([kind, usage]) => ({
        id: kind,
        usage,
        totalUsage: (usage.generators?.length || 0) + (usage.systems?.length || 0) +
                    (usage.actions?.length || 0) + (usage.pressures?.length || 0),
      }))
      .sort((a, b) => b.totalUsage - a.totalUsage);
  }, [usageMap]);

  // Prepare pressures data
  const pressuresData = useMemo(() => {
    if (!usageMap?.pressures) return [];
    return Object.entries(usageMap.pressures)
      .map(([id, usage]) => ({
        id,
        usage,
        totalUsage: (usage.generators?.length || 0) + (usage.systems?.length || 0) + (usage.actions?.length || 0),
      }))
      .sort((a, b) => b.totalUsage - a.totalUsage);
  }, [usageMap]);

  // Prepare generators data
  const generatorsData = useMemo(() => {
    if (!usageMap?.generators) return [];
    return Object.entries(usageMap.generators)
      .map(([id, usage]) => ({
        id,
        usage,
        eraCount: usage.eras?.length || 0,
      }))
      .sort((a, b) => b.eraCount - a.eraCount);
  }, [usageMap]);

  // Prepare systems data
  const systemsData = useMemo(() => {
    if (!usageMap?.systems) return [];
    return Object.entries(usageMap.systems)
      .map(([id, usage]) => ({
        id,
        usage,
        eraCount: usage.eras?.length || 0,
      }))
      .sort((a, b) => b.eraCount - a.eraCount);
  }, [usageMap]);

  if (!usageMap) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>Loading dependency data...</div>
      </div>
    );
  }

  const renderSchemaItem = (item) => (
    <div key={item.id} style={styles.itemRow}>
      <span style={styles.itemName}>{item.id}</span>
      <UsageBadges usage={item.usage} />
    </div>
  );

  const renderEraItem = (item) => (
    <div key={item.id} style={styles.itemRow}>
      <span style={styles.itemName}>{item.id}</span>
      {item.eraCount > 0 ? (
        <div style={styles.usedByList}>
          <span style={{ ...styles.badge, ...styles.badgeEra }}>
            {item.eraCount} era{item.eraCount !== 1 ? 's' : ''}
          </span>
        </div>
      ) : (
        <span style={styles.orphanBadge}>Not in any era</span>
      )}
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <span>🔗</span>
          <span>Dependencies</span>
        </div>
        <div style={styles.legend}>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: '#60a5fa' }} />
            <span>Generators</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: '#a855f7' }} />
            <span>Systems</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: '#22c55e' }} />
            <span>Actions</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: '#ec4899' }} />
            <span>Eras</span>
          </div>
        </div>
      </div>

      <DependencySection
        title="Entity Kinds"
        icon="📦"
        items={entityKindsData}
        renderItem={renderSchemaItem}
        defaultExpanded={true}
      />

      <DependencySection
        title="Relationship Kinds"
        icon="🔗"
        items={relationshipKindsData}
        renderItem={renderSchemaItem}
      />

      <DependencySection
        title="Pressures"
        icon="📊"
        items={pressuresData}
        renderItem={renderSchemaItem}
      />

      <DependencySection
        title="Generators → Eras"
        icon="✨"
        items={generatorsData}
        renderItem={renderEraItem}
      />

      <DependencySection
        title="Systems → Eras"
        icon="⚙️"
        items={systemsData}
        renderItem={renderEraItem}
      />
    </div>
  );
}
