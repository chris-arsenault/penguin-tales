/**
 * ConfluxesIndex - List view for confluxes (rare world forces)
 * Shows rare confluxes first - the point is to find uncommon phenomena
 */

import { useState, useMemo } from 'react';
import type { PageIndexEntry } from '../types/world.ts';

/**
 * Map internal source types to in-universe terminology:
 * - system → "Tide" (recurring background force)
 * - action → "Deed" (deliberate act by an entity)
 * - template → "Emergence" (things coming into being)
 */
const SOURCE_TYPE_LABELS: Record<string, string> = {
  system: 'Tide',
  action: 'Deed',
  template: 'Emergence',
};

function getSourceTypeLabel(sourceType: string): string {
  return SOURCE_TYPE_LABELS[sourceType] || sourceType;
}

const colors = {
  bgPrimary: '#0a1929',
  bgSecondary: '#1e3a5f',
  bgTertiary: '#2d4a6f',
  border: 'rgba(59, 130, 246, 0.3)',
  textPrimary: '#ffffff',
  textSecondary: '#93c5fd',
  textMuted: '#60a5fa',
  accent: '#10b981',
  accentSecondary: '#f59e0b',
  accentTertiary: '#8b5cf6',
};

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
  },
  heading: {
    fontSize: '28px',
    fontWeight: 600,
    color: colors.textPrimary,
    marginBottom: '8px',
  },
  description: {
    fontSize: '14px',
    color: colors.textSecondary,
    marginBottom: '24px',
    lineHeight: 1.6,
  },
  statsBar: {
    display: 'flex',
    gap: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap' as const,
  },
  statItem: {
    backgroundColor: colors.bgSecondary,
    padding: '12px 16px',
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: colors.accent,
    display: 'block',
  },
  statLabel: {
    fontSize: '12px',
    color: colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  filterBar: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  filterButton: {
    padding: '6px 12px',
    fontSize: '13px',
    borderRadius: '6px',
    border: `1px solid ${colors.border}`,
    backgroundColor: 'transparent',
    color: colors.textSecondary,
    cursor: 'pointer',
  },
  filterButtonActive: {
    backgroundColor: colors.accent,
    color: colors.bgPrimary,
    border: `1px solid ${colors.accent}`,
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
    fontSize: '13px',
    color: colors.textSecondary,
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
    accentColor: colors.accent,
  },
  frequentNote: {
    fontSize: '12px',
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  list: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  item: {
    textAlign: 'left' as const,
    padding: '16px',
    backgroundColor: colors.bgSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
    width: '100%',
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '8px',
  },
  itemTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: colors.textPrimary,
  },
  badge: {
    fontSize: '11px',
    fontWeight: 600,
    color: colors.bgPrimary,
    padding: '2px 8px',
    borderRadius: '999px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  badgeSystem: {
    backgroundColor: colors.accent,
  },
  badgeAction: {
    backgroundColor: colors.accentSecondary,
  },
  badgeTemplate: {
    backgroundColor: colors.accentTertiary,
  },
  itemMeta: {
    fontSize: '12px',
    color: colors.textMuted,
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap' as const,
  },
  metaValue: {
    color: colors.textSecondary,
    fontWeight: 500,
  },
  itemSummary: {
    fontSize: '13px',
    color: colors.textSecondary,
    marginTop: '8px',
    lineHeight: 1.5,
  },
  empty: {
    padding: '24px',
    textAlign: 'center' as const,
    color: colors.textMuted,
    backgroundColor: colors.bgSecondary,
    borderRadius: '8px',
    border: `1px solid ${colors.border}`,
  },
};

interface ConfluxesIndexProps {
  confluxPages: PageIndexEntry[];
  onNavigate: (pageId: string) => void;
}

type FilterType = 'all' | 'system' | 'action' | 'template';

export default function ConfluxesIndex({
  confluxPages,
  onNavigate,
}: ConfluxesIndexProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [showFrequent, setShowFrequent] = useState(false);

  // Calculate median manifestations for frequency threshold
  const { frequencyThreshold } = useMemo(() => {
    const manifestations = confluxPages
      .filter(p => p.conflux)
      .map(p => p.conflux?.manifestations ?? 0)
      .sort((a, b) => a - b);

    if (manifestations.length === 0) {
      return { frequencyThreshold: 0 };
    }

    const mid = Math.floor(manifestations.length / 2);
    const median = manifestations.length % 2 === 0
      ? (manifestations[mid - 1] + manifestations[mid]) / 2
      : manifestations[mid];

    return {
      frequencyThreshold: median * 2,
    };
  }, [confluxPages]);

  // Filter and sort confluxes - rarest first
  const { filtered, hiddenCount } = useMemo(() => {
    const withConflux = confluxPages.filter((page) => page.conflux);

    // Apply type filter
    const typeFiltered = withConflux.filter((page) => {
      if (filter === 'all') return true;
      return page.conflux?.sourceType === filter;
    });

    // Count how many are "frequent" (> 2x median)
    const frequent = typeFiltered.filter(
      p => (p.conflux?.manifestations ?? 0) > frequencyThreshold
    );

    // Apply frequency filter if not showing frequent
    const frequencyFiltered = showFrequent
      ? typeFiltered
      : typeFiltered.filter(p => (p.conflux?.manifestations ?? 0) <= frequencyThreshold);

    // Sort by manifestations ascending (rarest first)
    const sorted = frequencyFiltered.sort(
      (a, b) => (a.conflux?.manifestations ?? 0) - (b.conflux?.manifestations ?? 0)
    );

    return {
      filtered: sorted,
      hiddenCount: frequent.length,
    };
  }, [confluxPages, filter, showFrequent, frequencyThreshold]);

  // Calculate stats
  const totalConfluxes = confluxPages.filter(p => p.conflux).length;
  const totalTouched = new Set(
    confluxPages
      .filter(p => p.conflux)
      .flatMap(p => p.linkedEntities)
  ).size;

  const getBadgeStyle = (sourceType: string) => {
    switch (sourceType) {
      case 'system': return { ...styles.badge, ...styles.badgeSystem };
      case 'action': return { ...styles.badge, ...styles.badgeAction };
      case 'template': return { ...styles.badge, ...styles.badgeTemplate };
      default: return styles.badge;
    }
  };

  if (totalConfluxes === 0) {
    return (
      <div style={styles.container}>
        <h1 style={styles.heading}>Confluxes</h1>
        <p style={styles.description}>
          Confluxes are the recurring forces and phenomena that shape entity fates in this world.
        </p>
        <div style={styles.empty}>No confluxes detected. Run a simulation to generate narrative history.</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Confluxes</h1>
      <p style={styles.description}>
        Confluxes are the rare forces and phenomena that shape entity fates in this world.
        Sorted by rarity - the most unusual manifestations appear first.
      </p>

      <div style={styles.statsBar}>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{filtered.length}</span>
          <span style={styles.statLabel}>Rare Confluxes</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{totalConfluxes}</span>
          <span style={styles.statLabel}>Total</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{totalTouched}</span>
          <span style={styles.statLabel}>Entities Touched</span>
        </div>
      </div>

      <div style={styles.filterBar}>
        {(['all', 'system', 'action', 'template'] as FilterType[]).map((f) => (
          <button
            key={f}
            style={{
              ...styles.filterButton,
              ...(filter === f ? styles.filterButtonActive : {}),
            }}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'All' : getSourceTypeLabel(f) + 's'}
          </button>
        ))}
      </div>

      <div style={styles.checkboxRow}>
        <input
          type="checkbox"
          id="showFrequent"
          checked={showFrequent}
          onChange={(e) => setShowFrequent(e.target.checked)}
          style={styles.checkbox}
        />
        <label htmlFor="showFrequent">
          Show frequent confluxes
          {!showFrequent && hiddenCount > 0 && (
            <span style={styles.frequentNote}> ({hiddenCount} hidden)</span>
          )}
        </label>
      </div>

      <div style={styles.list}>
        {filtered.map((page) => {
          const conflux = page.conflux!;
          return (
            <button
              key={page.id}
              style={styles.item}
              onClick={() => onNavigate(page.id)}
            >
              <div style={styles.itemHeader}>
                <span style={styles.itemTitle}>{page.title}</span>
                <span style={getBadgeStyle(conflux.sourceType)}>
                  {getSourceTypeLabel(conflux.sourceType)}
                </span>
              </div>
              <div style={styles.itemMeta}>
                <span>
                  <span style={styles.metaValue}>{conflux.manifestations}</span> manifestations
                </span>
                <span>
                  <span style={styles.metaValue}>{conflux.touchedCount}</span> entities touched
                </span>
              </div>
              {page.summary && (
                <div style={styles.itemSummary}>{page.summary}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
