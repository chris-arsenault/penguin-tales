/**
 * ChronicleIndex - list view for accepted chronicles
 */

import type { WikiPage, HardState } from '../types/world.ts';

const colors = {
  bgPrimary: '#0a1929',
  bgSecondary: '#1e3a5f',
  bgTertiary: '#2d4a6f',
  border: 'rgba(59, 130, 246, 0.3)',
  textPrimary: '#ffffff',
  textSecondary: '#93c5fd',
  textMuted: '#60a5fa',
  accent: '#10b981',
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
    backgroundColor: colors.accent,
    padding: '2px 8px',
    borderRadius: '999px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  itemMeta: {
    fontSize: '12px',
    color: colors.textMuted,
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
    marginBottom: '6px',
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

interface ChronicleIndexProps {
  chronicles: WikiPage[];
  filter: 'all' | 'story' | 'document';
  onNavigate: (pageId: string) => void;
  entityIndex: Map<string, HardState>;
}

export default function ChronicleIndex({
  chronicles,
  filter,
  onNavigate,
  entityIndex,
}: ChronicleIndexProps) {
  const filtered = chronicles
    .filter((page) => page.chronicle)
    .filter((page) => {
      if (filter === 'all') return true;
      return page.chronicle?.format === filter;
    })
    .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

  const heading = filter === 'story'
    ? 'Stories'
    : filter === 'document'
    ? 'Documents'
    : 'Chronicles';

  const description = filter === 'all'
    ? 'Accepted chronicles from Illuminator.'
    : `Accepted ${filter === 'story' ? 'stories' : 'documents'} from Illuminator.`;

  if (filtered.length === 0) {
    return (
      <div style={styles.container}>
        <h1 style={styles.heading}>{heading}</h1>
        <p style={styles.description}>{description}</p>
        <div style={styles.empty}>No chronicles found.</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>{heading}</h1>
      <p style={styles.description}>{description}</p>

      <div style={styles.list}>
        {filtered.map((page) => {
          const entrypointName = page.chronicle?.entrypointId
            ? entityIndex.get(page.chronicle.entrypointId)?.name
            : null;
          const formatLabel = page.chronicle?.format === 'document' ? 'Document' : 'Story';
          const dateLabel = page.lastUpdated
            ? new Date(page.lastUpdated).toLocaleDateString()
            : null;

          return (
            <button
              key={page.id}
              style={styles.item}
              onClick={() => onNavigate(page.id)}
            >
              <div style={styles.itemHeader}>
                <span style={styles.itemTitle}>{page.title}</span>
                <span style={styles.badge}>{formatLabel}</span>
              </div>
              <div style={styles.itemMeta}>
                {entrypointName && <span>Entrypoint: {entrypointName}</span>}
                {dateLabel && <span>Accepted: {dateLabel}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
