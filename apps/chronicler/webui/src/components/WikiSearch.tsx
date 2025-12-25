/**
 * WikiSearch - Full-text search for wiki pages
 *
 * Uses fuse.js for fuzzy matching across page titles and content.
 */

import { useMemo, useState, useRef, useEffect } from 'react';
import Fuse from 'fuse.js';
import type { WikiPage } from '../types/world.ts';

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
    position: 'relative' as const,
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    backgroundColor: colors.bgTertiary,
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    color: colors.textPrimary,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  dropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    backgroundColor: colors.bgSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: '6px',
    maxHeight: '300px',
    overflow: 'auto',
    zIndex: 100,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  },
  result: {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    color: colors.textPrimary,
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${colors.border}`,
    textAlign: 'left' as const,
    cursor: 'pointer',
  },
  resultType: {
    fontSize: '11px',
    color: colors.textMuted,
    marginLeft: '8px',
  },
  noResults: {
    padding: '12px',
    fontSize: '13px',
    color: colors.textMuted,
    textAlign: 'center' as const,
  },
};

interface WikiSearchProps {
  pages: WikiPage[];
  query: string;
  onQueryChange: (query: string) => void;
  onSelect: (pageId: string) => void;
}

export default function WikiSearch({
  pages,
  query,
  onQueryChange,
  onSelect,
}: WikiSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build fuse.js search index
  const fuse = useMemo(() => {
    return new Fuse(pages, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'content.summary', weight: 1 },
      ],
      threshold: 0.3,
      includeScore: true,
      minMatchCharLength: 2,
    });
  }, [pages]);

  // Search results
  const results = useMemo(() => {
    if (!query || query.length < 2) return [];
    return fuse.search(query).slice(0, 10);
  }, [fuse, query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex].item.id);
          setIsOpen(false);
          onQueryChange('');
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  return (
    <div ref={containerRef} style={styles.container}>
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        style={styles.input}
      />

      {isOpen && query.length >= 2 && (
        <div style={styles.dropdown}>
          {results.length > 0 ? (
            results.map((result, index) => (
              <button
                key={result.item.id}
                style={{
                  ...styles.result,
                  backgroundColor: index === selectedIndex ? colors.bgTertiary : 'transparent',
                }}
                onClick={() => {
                  onSelect(result.item.id);
                  setIsOpen(false);
                  onQueryChange('');
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {result.item.title}
                <span style={styles.resultType}>{result.item.type}</span>
              </button>
            ))
          ) : (
            <div style={styles.noResults}>No results found</div>
          )}
        </div>
      )}
    </div>
  );
}
