/**
 * NamingProfileMappingViewer - Shows how naming profiles map to entity creation
 *
 * Displays:
 * 1. Which generators create which entity kinds (with culture inheritance info)
 * 2. For each kind/culture, which naming profile strategy group applies
 * 3. Warnings for gaps where naming may fail (no matching profile)
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
  stats: {
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    color: COLORS.textMuted,
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  statValue: {
    fontWeight: 600,
    color: COLORS.text,
  },
  content: {
    padding: '16px 20px',
  },
  mappingTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    textAlign: 'left',
    padding: '8px 12px',
    fontSize: '11px',
    fontWeight: 600,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: `1px solid ${COLORS.border}`,
  },
  tableRow: {
    borderBottom: `1px solid ${COLORS.border}`,
  },
  tableCell: {
    padding: '10px 12px',
    fontSize: '13px',
    color: COLORS.text,
    verticalAlign: 'top',
  },
  generatorCell: {
    fontWeight: 500,
  },
  cultureCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cultureDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  profileBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
  },
  profileMatch: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    color: COLORS.success,
  },
  profileMissing: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    color: COLORS.danger,
  },
  profileInherited: {
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    color: COLORS.textDim,
  },
  kindBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    backgroundColor: COLORS.bgDark,
    color: COLORS.textDim,
    marginRight: '4px',
  },
  warningRow: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  emptyState: {
    padding: '24px',
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: '13px',
  },
  section: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: COLORS.text,
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  warningList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  warningItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '6px',
    border: `1px solid ${COLORS.danger}30`,
    fontSize: '12px',
    color: COLORS.text,
  },
  warningIcon: {
    color: COLORS.danger,
    fontSize: '14px',
  },
};

/**
 * Find which naming profile strategy group matches a given entity creation
 */
function findMatchingProfile(namingConfig, entityKind, subtype, prominence, tags = []) {
  if (!namingConfig?.profiles) return null;

  for (const profile of namingConfig.profiles) {
    for (const group of (profile.strategyGroups || [])) {
      const cond = group.conditions || {};

      // Check entity kind
      if (cond.entityKinds?.length > 0 && !cond.entityKinds.includes(entityKind)) {
        continue;
      }

      // Check subtype
      if (cond.subtypes?.length > 0) {
        if (cond.subtypeMatchAll) {
          // All subtypes must match - not applicable for single entity
          if (!subtype || !cond.subtypes.includes(subtype)) continue;
        } else {
          // Any subtype matches
          if (!subtype || !cond.subtypes.includes(subtype)) continue;
        }
      }

      // Check prominence
      if (cond.prominence?.length > 0 && !cond.prominence.includes(prominence)) {
        continue;
      }

      // Check tags
      if (cond.tags?.length > 0) {
        const entityTags = Array.isArray(tags) ? tags : Object.keys(tags || {});
        if (cond.tagMatchAll) {
          // All tags must be present
          if (!cond.tags.every(t => entityTags.includes(t))) continue;
        } else {
          // Any tag matches
          if (!cond.tags.some(t => entityTags.includes(t))) continue;
        }
      }

      // Found a match!
      return {
        profileId: profile.id,
        profileName: profile.name,
        groupName: group.name,
        strategy: group.strategy,
        grammarId: group.grammarId,
      };
    }
  }

  return null;
}

/**
 * Analyze generators and build naming mapping data
 */
function analyzeNamingMappings(generators, schema, namingData) {
  const mappings = [];
  const warnings = [];

  // Build culture lookup
  const culturesById = {};
  (schema.cultures || []).forEach(c => {
    culturesById[c.id] = c;
  });

  for (const gen of generators) {
    if (gen.enabled === false) continue;
    if (!gen.creation || gen.creation.length === 0) continue;

    for (const creation of gen.creation) {
      const entityKind = creation.kind;
      // Subtype can be a string or object - ensure we get a string
      const subtype = typeof creation.subtype === 'string' ? creation.subtype : null;
      const status = creation.status;
      const prominence = creation.prominence;
      const tags = creation.tags ? Object.keys(creation.tags) : [];

      // Determine culture source
      let cultureSource = null;
      let cultureIds = [];

      if (creation.culture) {
        if (typeof creation.culture === 'string') {
          cultureIds = [creation.culture];
          cultureSource = 'explicit';
        } else if (creation.culture.inherit) {
          cultureSource = 'inherited';
          // Culture is inherited from target - could be any culture
          cultureIds = Object.keys(culturesById);
        } else if (creation.culture.from) {
          cultureSource = 'reference';
          cultureIds = Object.keys(culturesById);
        }
      } else {
        // No culture specified - could be any
        cultureSource = 'any';
        cultureIds = Object.keys(culturesById);
      }

      // Check each possible culture for naming profile match
      for (const cultureId of cultureIds) {
        const culture = culturesById[cultureId];
        const namingConfig = namingData[cultureId];

        const match = namingConfig
          ? findMatchingProfile(namingConfig, entityKind, subtype, prominence, tags)
          : null;

        mappings.push({
          generatorId: gen.id,
          generatorName: gen.name || gen.id,
          entityKind,
          subtype,
          prominence,
          cultureId,
          cultureName: culture?.name || cultureId,
          cultureColor: culture?.color || '#888',
          cultureSource,
          hasNamingProfile: !!namingConfig,
          match,
        });

        // Add warning if no match found
        if (!match && namingConfig) {
          warnings.push({
            generatorId: gen.id,
            generatorName: gen.name || gen.id,
            entityKind,
            subtype,
            cultureId,
            cultureName: culture?.name || cultureId,
            cultureSource,
            reason: 'No matching strategy group',
          });
        } else if (!namingConfig) {
          warnings.push({
            generatorId: gen.id,
            generatorName: gen.name || gen.id,
            entityKind,
            subtype,
            cultureId,
            cultureName: culture?.name || cultureId,
            cultureSource,
            reason: 'Culture has no naming profiles',
          });
        }
      }
    }
  }

  return { mappings, warnings };
}

export default function NamingProfileMappingViewer({ generators = [], schema = {}, namingData = {} }) {
  const [showInherited, setShowInherited] = useState(false);

  const { mappings, warnings } = useMemo(
    () => analyzeNamingMappings(generators, schema, namingData),
    [generators, schema, namingData]
  );

  // Group by generator for display
  const groupedMappings = useMemo(() => {
    const groups = {};
    for (const m of mappings) {
      if (!groups[m.generatorId]) {
        groups[m.generatorId] = {
          generatorId: m.generatorId,
          generatorName: m.generatorName,
          items: [],
        };
      }
      groups[m.generatorId].items.push(m);
    }
    return Object.values(groups);
  }, [mappings]);

  // Filter warnings - show all by default, but can filter to just explicit cultures
  const displayWarnings = showInherited
    ? warnings
    : warnings.filter(w => w.cultureSource === 'explicit' || w.reason === 'No matching strategy group');

  const successCount = mappings.filter(m => m.match).length;
  const warningCount = warnings.filter(w => w.reason === 'No matching strategy group').length;

  if (mappings.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.title}>
            <span>Naming Profile Mappings</span>
          </div>
        </div>
        <div style={styles.emptyState}>
          No generators with entity creation defined. Add generators to see naming profile mappings.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <span>Naming Profile Mappings</span>
        </div>
        <div style={styles.stats}>
          <div style={styles.statItem}>
            <span style={{ ...styles.statValue, color: COLORS.success }}>{successCount}</span>
            <span>matched</span>
          </div>
          <div style={styles.statItem}>
            <span style={{ ...styles.statValue, color: warningCount > 0 ? COLORS.danger : COLORS.textMuted }}>{warningCount}</span>
            <span>missing</span>
          </div>
          <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="checkbox"
              checked={showInherited}
              onChange={(e) => setShowInherited(e.target.checked)}
            />
            <span>Show inherited cultures</span>
          </label>
        </div>
      </div>

      <div style={styles.content}>
        {/* Warnings section */}
        {displayWarnings.length > 0 && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <span style={styles.warningIcon}>Warning</span>
              <span>Naming May Fail ({displayWarnings.length})</span>
            </div>
            <div style={styles.warningList}>
              {displayWarnings.slice(0, 10).map((w, i) => (
                <div key={`${w.generatorId}-${w.cultureId}-${i}`} style={styles.warningItem}>
                  <span style={styles.warningIcon}>!</span>
                  <span>
                    <strong>{w.generatorName}</strong> creates <strong>{w.entityKind}</strong>
                    {w.subtype && `:${w.subtype}`} for culture <strong>{w.cultureName}</strong>
                    {' '}- {w.reason}
                  </span>
                </div>
              ))}
              {displayWarnings.length > 10 && (
                <div style={{ ...styles.warningItem, backgroundColor: 'transparent', border: 'none', color: COLORS.textMuted }}>
                  ... and {displayWarnings.length - 10} more
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mappings table */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <span>Entity Creation to Naming Profile</span>
          </div>
          <table style={styles.mappingTable}>
            <thead>
              <tr>
                <th style={styles.tableHeader}>Generator</th>
                <th style={styles.tableHeader}>Entity Kind</th>
                <th style={styles.tableHeader}>Culture</th>
                <th style={styles.tableHeader}>Naming Profile</th>
              </tr>
            </thead>
            <tbody>
              {groupedMappings.slice(0, 20).flatMap((group) => {
                // Filter items based on showInherited toggle
                const filteredItems = showInherited
                  ? group.items
                  : group.items.filter(m => m.cultureSource === 'explicit' || m.cultureSource === 'any');
                // If no explicit cultures, show first inherited one as representative
                const displayItems = filteredItems.length > 0
                  ? filteredItems
                  : group.items.slice(0, 1);
                return displayItems.map((m, idx) => (
                    <tr
                      key={`${m.generatorId}-${m.cultureId}-${m.entityKind}-${idx}`}
                      style={{
                        ...styles.tableRow,
                        ...((!m.match && m.hasNamingProfile) ? styles.warningRow : {}),
                      }}
                    >
                      <td style={{ ...styles.tableCell, ...styles.generatorCell }}>
                        {idx === 0 ? m.generatorName : ''}
                      </td>
                      <td style={styles.tableCell}>
                        <span style={styles.kindBadge}>{m.entityKind}</span>
                        {m.subtype && <span style={{ ...styles.kindBadge, backgroundColor: 'transparent' }}>{m.subtype}</span>}
                      </td>
                      <td style={styles.tableCell}>
                        <div style={styles.cultureCell}>
                          <span style={{ ...styles.cultureDot, backgroundColor: m.cultureColor }} />
                          <span>{m.cultureName}</span>
                          {m.cultureSource === 'inherited' && (
                            <span style={{ ...styles.profileBadge, ...styles.profileInherited }}>inherited</span>
                          )}
                        </div>
                      </td>
                      <td style={styles.tableCell}>
                        {m.match ? (
                          <span style={{ ...styles.profileBadge, ...styles.profileMatch }}>
                            {m.match.profileName || m.match.profileId}
                            {m.match.groupName && ` / ${m.match.groupName}`}
                          </span>
                        ) : !m.hasNamingProfile ? (
                          <span style={{ ...styles.profileBadge, ...styles.profileMissing }}>
                            No profiles configured
                          </span>
                        ) : (
                          <span style={{ ...styles.profileBadge, ...styles.profileMissing }}>
                            No matching group
                          </span>
                        )}
                      </td>
                    </tr>
                  ));
              })}
            </tbody>
          </table>
          {groupedMappings.length > 20 && (
            <div style={{ padding: '12px', textAlign: 'center', color: COLORS.textMuted, fontSize: '12px' }}>
              Showing first 20 generators. Total: {groupedMappings.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
