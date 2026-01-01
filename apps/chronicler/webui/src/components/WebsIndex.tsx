/**
 * WebsIndex - List view for webs (connected entity networks)
 * Shows largest webs first - the point is to find significant structures
 */

import { useState, useMemo } from 'react';
import type { PageIndexEntry } from '../types/world.ts';

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
    flexWrap: 'wrap' as const,
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
    backgroundColor: colors.accent,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
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

interface WebsIndexProps {
  webPages: PageIndexEntry[];
  onNavigate: (pageId: string) => void;
}

export default function WebsIndex({
  webPages,
  onNavigate,
}: WebsIndexProps) {
  const [entityKindFilter, setEntityKindFilter] = useState<string>('all');

  // Get unique entity kinds for filtering
  const entityKinds = useMemo(() => {
    const kinds = new Set<string>();
    for (const page of webPages) {
      if (page.webType?.entityKind) {
        kinds.add(page.webType.entityKind);
      }
    }
    return Array.from(kinds).sort();
  }, [webPages]);

  // Filter and sort webs - largest first
  const filtered = useMemo(() => {
    const withWebType = webPages.filter((page) => page.webType);

    // Apply entity kind filter
    const kindFiltered = entityKindFilter === 'all'
      ? withWebType
      : withWebType.filter((page) => page.webType?.entityKind === entityKindFilter);

    // Sort by largest web size descending
    return kindFiltered.sort(
      (a, b) => (b.webType?.largestSize ?? 0) - (a.webType?.largestSize ?? 0)
    );
  }, [webPages, entityKindFilter]);

  // Calculate stats
  const totalWebTypes = webPages.filter(p => p.webType).length;
  const totalInstances = webPages
    .filter(p => p.webType)
    .reduce((sum, p) => sum + (p.webType?.instanceCount ?? 0), 0);
  const totalEntities = webPages
    .filter(p => p.webType)
    .reduce((sum, p) => sum + (p.webType?.totalEntities ?? 0), 0);
  const largestWeb = Math.max(
    ...webPages.filter(p => p.webType).map(p => p.webType?.largestSize ?? 0),
    0
  );

  if (totalWebTypes === 0) {
    return (
      <div style={styles.container}>
        <h1 style={styles.heading}>Huddles</h1>
        <p style={styles.description}>
          Huddles are connected groups of same-kind entities linked by the same relationship type.
        </p>
        <div style={styles.empty}>No huddles detected. A huddle requires at least 3 entities connected by the same relationship type.</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Huddles</h1>
      <p style={styles.description}>
        Huddles are connected groups of same-kind entities linked by the same relationship type.
        Sorted by size - the largest huddles appear first.
      </p>

      <div style={styles.statsBar}>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{totalWebTypes}</span>
          <span style={styles.statLabel}>Types</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{totalInstances}</span>
          <span style={styles.statLabel}>Huddles</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{totalEntities}</span>
          <span style={styles.statLabel}>Entities</span>
        </div>
        <div style={styles.statItem}>
          <span style={styles.statValue}>{largestWeb}</span>
          <span style={styles.statLabel}>Largest</span>
        </div>
      </div>

      {entityKinds.length > 1 && (
        <div style={styles.filterBar}>
          <button
            style={{
              ...styles.filterButton,
              ...(entityKindFilter === 'all' ? styles.filterButtonActive : {}),
            }}
            onClick={() => setEntityKindFilter('all')}
          >
            All
          </button>
          {entityKinds.map((kind) => (
            <button
              key={kind}
              style={{
                ...styles.filterButton,
                ...(entityKindFilter === kind ? styles.filterButtonActive : {}),
              }}
              onClick={() => setEntityKindFilter(kind)}
            >
              {kind.charAt(0).toUpperCase() + kind.slice(1)}s
            </button>
          ))}
        </div>
      )}

      <div style={styles.list}>
        {filtered.map((page) => {
          const webType = page.webType!;
          return (
            <button
              key={page.id}
              style={styles.item}
              onClick={() => onNavigate(page.id)}
            >
              <div style={styles.itemHeader}>
                <span style={styles.itemTitle}>{page.title}</span>
                <span style={styles.badge}>
                  {webType.entityKind}
                </span>
              </div>
              <div style={styles.itemMeta}>
                <span>
                  <span style={styles.metaValue}>{webType.instanceCount}</span> {webType.instanceCount === 1 ? 'huddle' : 'huddles'}
                </span>
                <span>
                  <span style={styles.metaValue}>{webType.largestSize}</span> in largest
                </span>
                <span>
                  <span style={styles.metaValue}>{webType.totalEntities}</span> total entities
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
