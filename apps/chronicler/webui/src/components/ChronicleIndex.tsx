/**
 * ChronicleIndex - list view for accepted chronicles
 */

import type { WikiPage, HardState } from '../types/world.ts';
import styles from './ChronicleIndex.module.css';

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
      <div className={styles.container}>
        <h1 className={styles.heading}>{heading}</h1>
        <p className={styles.description}>{description}</p>
        <div className={styles.empty}>No chronicles found.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>{heading}</h1>
      <p className={styles.description}>{description}</p>

      <div className={styles.list}>
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
              className={styles.item}
              onClick={() => onNavigate(page.id)}
            >
              <div className={styles.itemHeader}>
                <span className={styles.itemTitle}>{page.title}</span>
                <span className={styles.badge}>{formatLabel}</span>
              </div>
              <div className={styles.itemMeta}>
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
