/**
 * StoryPlanEditor - View and edit story plans before scene expansion
 *
 * Displays the structured plan from Step 1 and allows the user to:
 * - View all plan elements (characters, plot, scenes)
 * - Edit plan elements before proceeding
 * - Approve the plan to start scene expansion
 * - Regenerate the entire plan if needed
 *
 * See CHRONICLE_DESIGN.md for architecture documentation.
 */

import { useState, useCallback } from 'react';

/** Check if plot is ThreeActPlotStructure */
function isThreeActPlot(plot) {
  return plot && 'incitingIncident' in plot && 'climax' in plot;
}

/** Check if plot is FlexiblePlotStructure */
function isFlexiblePlot(plot) {
  return plot && 'type' in plot && 'normalizedBeats' in plot;
}

/** Get color for an entity's narrative role */
function getRoleColor(role) {
  const lowerRole = (role || '').toLowerCase();

  // Primary roles (blue)
  if (lowerRole.includes('protagonist') || lowerRole.includes('hero') ||
      lowerRole.includes('central') || lowerRole.includes('primary') ||
      lowerRole.includes('main') || lowerRole.includes('focus')) return '#3b82f6';

  // Antagonist roles (red)
  if (lowerRole.includes('antagonist') || lowerRole.includes('villain') ||
      lowerRole.includes('obstacle') || lowerRole.includes('threat')) return '#ef4444';

  // Supporting roles (green)
  if (lowerRole.includes('support') || lowerRole.includes('ally') ||
      lowerRole.includes('mentor') || lowerRole.includes('love') ||
      lowerRole.includes('companion')) return '#10b981';

  // Setting/Background (amber)
  if (lowerRole.includes('setting') || lowerRole.includes('backdrop') ||
      lowerRole.includes('location') || lowerRole.includes('environment')) return '#f59e0b';

  // Object/Item roles (purple)
  if (lowerRole.includes('macguffin') || lowerRole.includes('artifact') ||
      lowerRole.includes('object') || lowerRole.includes('item') ||
      lowerRole.includes('tool') || lowerRole.includes('catalyst')) return '#8b5cf6';

  // Minor/Background (gray)
  if (lowerRole.includes('minor') || lowerRole.includes('background') ||
      lowerRole.includes('extra')) return '#6b7280';

  return '#8b5cf6'; // Purple for custom roles
}

/** Get a more appropriate role label based on entity kind */
function getDefaultRoleForKind(kind) {
  const kindLower = (kind || '').toLowerCase();
  if (kindLower.includes('location') || kindLower.includes('place') ||
      kindLower.includes('region') || kindLower.includes('settlement')) {
    return 'setting';
  }
  if (kindLower.includes('artifact') || kindLower.includes('item') ||
      kindLower.includes('object') || kindLower.includes('weapon')) {
    return 'object';
  }
  if (kindLower.includes('ability') || kindLower.includes('power') ||
      kindLower.includes('skill')) {
    return 'element';
  }
  if (kindLower.includes('event') || kindLower.includes('occurrence')) {
    return 'event';
  }
  if (kindLower.includes('organization') || kindLower.includes('faction') ||
      kindLower.includes('group')) {
    return 'faction';
  }
  return 'character'; // Default for person/NPC types
}

/** Get color for entity kind badges */
const KIND_COLORS = {
  person: '#3b82f6',
  npc: '#3b82f6',
  location: '#10b981',
  settlement: '#10b981',
  organization: '#f59e0b',
  faction: '#f59e0b',
  artifact: '#8b5cf6',
  item: '#8b5cf6',
  culture: '#ec4899',
  event: '#6366f1',
};

const EMOTIONAL_BEATS = [
  'tension',
  'revelation',
  'relief',
  'confrontation',
  'intimacy',
  'loss',
  'triumph',
  'despair',
  'wonder',
  'dread',
];

function EditableText({ value, onChange, multiline = false, placeholder = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => {
    onChange(draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
        {multiline ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              minHeight: '60px',
              resize: 'vertical',
            }}
            autoFocus
          />
        ) : (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '13px',
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') handleCancel();
            }}
          />
        )}
        <button
          onClick={handleSave}
          style={{
            padding: '6px 12px',
            background: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Save
        </button>
        <button
          onClick={handleCancel}
          style={{
            padding: '6px 12px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={{
        padding: '8px',
        background: 'var(--bg-primary)',
        border: '1px solid transparent',
        borderRadius: '4px',
        cursor: 'pointer',
        color: value ? 'var(--text-primary)' : 'var(--text-muted)',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'transparent')}
    >
      {value || placeholder || '(click to edit)'}
    </div>
  );
}

function SectionHeader({ title, count, isOpen, onToggle }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-tertiary)',
        border: 'none',
        borderRadius: '6px 6px 0 0',
        cursor: 'pointer',
        color: 'var(--text-primary)',
        fontSize: '14px',
        fontWeight: 600,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontFamily: 'monospace', fontSize: '10px' }}>
          {isOpen ? '▾' : '▸'}
        </span>
        {title}
        {count !== undefined && (
          <span
            style={{
              background: 'var(--bg-secondary)',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            {count}
          </span>
        )}
      </span>
    </button>
  );
}

/** Normalize a string for comparison - strips punctuation, lowercases, removes common prefixes */
function normalizeForMatch(str) {
  return str
    .toLowerCase()
    // Handle possessives first: 's or 's becomes just s (Swale's → swales)
    .replace(/['']s\b/g, 's')
    // Convert remaining apostrophes to dashes (for names like Raesotaphoia'Tier → raesotaphoia-tier)
    .replace(/[''`´]/g, '-')
    // Remove other punctuation entirely
    .replace(/[()[\]{}"",.:;!?]/g, '')
    // Normalize all separators (spaces, underscores, dashes, multiple) to single dash
    .replace(/[-_\s]+/g, '-')
    // Strip kind prefixes that LLM might add
    .replace(/^(abilities|ability|locations|location|factions|faction|artifacts|artifact|npcs|npc|persons|person|events|event|organizations|organization|settlements|settlement)-/, '')
    // Trim leading/trailing dashes
    .replace(/^-+|-+$/g, '');
}

function StoryElementCard({ character, entity, entityMap, onUpdate, onRemove }) {
  // Try multiple strategies to resolve entity
  let resolvedEntity = entity;
  let resolutionMethod = entity ? 'direct' : null;

  if (!resolvedEntity && entityMap && character.entityId) {
    const entityId = character.entityId;
    const normalizedSearchId = normalizeForMatch(entityId);

    // Strategy 1: Direct lookup by ID
    resolvedEntity = entityMap.get(entityId);
    if (resolvedEntity) resolutionMethod = 'id-exact';

    // Strategy 2: Case-insensitive ID lookup
    if (!resolvedEntity) {
      for (const [id, e] of entityMap) {
        if (id.toLowerCase() === entityId.toLowerCase()) {
          resolvedEntity = e;
          resolutionMethod = 'id-case-insensitive';
          break;
        }
      }
    }

    // Strategy 3: Match by entity name (exact)
    if (!resolvedEntity) {
      for (const [, e] of entityMap) {
        if (e.name === entityId || e.name.toLowerCase() === entityId.toLowerCase()) {
          resolvedEntity = e;
          resolutionMethod = 'name-exact';
          break;
        }
      }
    }

    // Strategy 4: Normalized name match (handles "Floe-slumber (veil)" vs "floe-slumber-veil")
    if (!resolvedEntity) {
      for (const [, e] of entityMap) {
        const normalizedName = normalizeForMatch(e.name);
        if (normalizedName === normalizedSearchId) {
          resolvedEntity = e;
          resolutionMethod = 'name-normalized';
          break;
        }
      }
    }

    // Strategy 5: Normalized ID match (handles kind-prefixed slugs like "abilities-floe-slumber-veil")
    if (!resolvedEntity) {
      for (const [id, e] of entityMap) {
        const normalizedMapId = normalizeForMatch(id);
        if (normalizedMapId === normalizedSearchId) {
          resolvedEntity = e;
          resolutionMethod = 'id-normalized';
          break;
        }
      }
    }

    // Strategy 6: Partial normalized match (substring containment)
    if (!resolvedEntity) {
      for (const [id, e] of entityMap) {
        const normalizedMapId = normalizeForMatch(id);
        const normalizedName = normalizeForMatch(e.name);
        if (normalizedMapId.includes(normalizedSearchId) ||
            normalizedSearchId.includes(normalizedMapId) ||
            normalizedName.includes(normalizedSearchId) ||
            normalizedSearchId.includes(normalizedName)) {
          resolvedEntity = e;
          resolutionMethod = 'partial-normalized';
          break;
        }
      }
    }

    // Strategy 7: Match by kind + normalized name (LLM might create "abilities-name" from kind + name)
    if (!resolvedEntity) {
      // Extract potential kind prefix from the search ID
      const kindPrefixMatch = entityId.toLowerCase().match(/^(abilities|ability|locations|location|factions|faction|artifacts|artifact|npcs|npc|persons|person|events|event|organizations|organization)[-_]/);
      if (kindPrefixMatch) {
        const namePartOnly = normalizedSearchId; // Already has prefix stripped
        for (const [, e] of entityMap) {
          const normalizedName = normalizeForMatch(e.name);
          if (normalizedName === namePartOnly) {
            resolvedEntity = e;
            resolutionMethod = 'kind-prefix-stripped';
            break;
          }
        }
      }
    }
  }

  const entityKind = resolvedEntity?.kind || '';
  const roleColor = getRoleColor(character.role);
  const kindColor = KIND_COLORS[entityKind.toLowerCase()] || '#6b7280';
  const displayName = resolvedEntity?.name || character.entityId;
  const isUnresolved = !resolvedEntity;

  // Get a sensible role label based on kind if the current role seems inappropriate
  const effectiveRole = character.role || getDefaultRoleForKind(entityKind);

  const [editingRole, setEditingRole] = useState(false);
  const [roleValue, setRoleValue] = useState(effectiveRole);

  const handleRoleSave = () => {
    onUpdate({ ...character, role: roleValue });
    setEditingRole(false);
  };

  return (
    <div
      style={{
        padding: '12px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        marginBottom: '8px',
      }}
    >
      {/* Header with name and metadata badges */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>
            {displayName}
            {isUnresolved && (
              <span
                style={{
                  marginLeft: '8px',
                  padding: '2px 6px',
                  fontSize: '9px',
                  fontWeight: 500,
                  background: '#ef444420',
                  color: '#ef4444',
                  borderRadius: '4px',
                }}
                title={`Could not resolve entity ID: ${character.entityId}`}
              >
                unresolved
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {/* Show raw ID if unresolved */}
            {isUnresolved && (
              <span
                style={{
                  padding: '2px 8px',
                  fontSize: '10px',
                  fontWeight: 500,
                  fontFamily: 'monospace',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-muted)',
                  borderRadius: '4px',
                }}
              >
                ID: {character.entityId}
              </span>
            )}
            {/* Entity kind badge */}
            {entityKind && (
              <span
                style={{
                  padding: '2px 8px',
                  fontSize: '10px',
                  fontWeight: 500,
                  background: `${kindColor}20`,
                  color: kindColor,
                  borderRadius: '4px',
                }}
              >
                {entityKind}
              </span>
            )}
            {/* Culture badge */}
            {resolvedEntity?.culture && (
              <span
                style={{
                  padding: '2px 8px',
                  fontSize: '10px',
                  fontWeight: 500,
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  borderRadius: '4px',
                }}
              >
                {resolvedEntity.culture}
              </span>
            )}
            {/* Prominence badge */}
            {resolvedEntity?.prominence && (
              <span
                style={{
                  padding: '2px 8px',
                  fontSize: '10px',
                  fontWeight: 500,
                  background: resolvedEntity.prominence === 'mythic' ? '#f59e0b20' : 'var(--bg-tertiary)',
                  color: resolvedEntity.prominence === 'mythic' ? '#f59e0b' : 'var(--text-muted)',
                  borderRadius: '4px',
                }}
              >
                {resolvedEntity.prominence}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Role - editable text */}
          {editingRole ? (
            <div style={{ display: 'flex', gap: '4px' }}>
              <input
                type="text"
                value={roleValue}
                onChange={(e) => setRoleValue(e.target.value)}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  width: '100px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRoleSave();
                  if (e.key === 'Escape') setEditingRole(false);
                }}
                autoFocus
              />
              <button
                onClick={handleRoleSave}
                style={{
                  padding: '4px 6px',
                  fontSize: '10px',
                  background: 'var(--accent-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                ✓
              </button>
            </div>
          ) : (
            <span
              onClick={() => {
                setRoleValue(effectiveRole);
                setEditingRole(true);
              }}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 500,
                background: `${getRoleColor(effectiveRole)}20`,
                color: getRoleColor(effectiveRole),
                border: `1px solid ${getRoleColor(effectiveRole)}40`,
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              title="Click to edit role"
            >
              {effectiveRole}
            </span>
          )}
          <button
            onClick={onRemove}
            style={{
              padding: '4px 8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Remove from story"
          >
            ✕
          </button>
        </div>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Narrative Role:</div>
      <EditableText
        value={character.arc}
        onChange={(arc) => onUpdate({ ...character, arc })}
        multiline
        placeholder="Describe this entity's narrative role and arc in the story..."
      />
    </div>
  );
}

function PlotBeatCard({ title, beat, onUpdate }) {
  // Handle missing or malformed beat
  if (!beat) {
    return (
      <div
        style={{
          padding: '12px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          marginBottom: '8px',
          color: 'var(--text-muted)',
          fontStyle: 'italic',
        }}
      >
        {title}: (no data)
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '12px',
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        marginBottom: '8px',
      }}
    >
      <div style={{ fontWeight: 500, fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
        {title}
      </div>
      <EditableText
        value={beat.description || ''}
        onChange={(description) => onUpdate({ ...beat, description })}
        multiline
        placeholder={`Describe the ${title.toLowerCase()}...`}
      />
      {beat.eventIds?.length > 0 && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
          Events: {beat.eventIds.join(', ')}
        </div>
      )}
    </div>
  );
}

/**
 * Render a flexible plot structure (non-three-act)
 * Displays the normalized beats with the plot type header
 */
function FlexiblePlotSection({ plot, onUpdateBeat }) {
  const plotTypeName = plot.type
    ? plot.type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Custom Plot';

  return (
    <div>
      <div
        style={{
          padding: '8px 12px',
          marginBottom: '12px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--accent-primary)',
          borderRadius: '6px',
          fontSize: '12px',
          color: 'var(--accent-primary)',
        }}
      >
        Plot Type: {plotTypeName}
      </div>

      {plot.normalizedBeats && plot.normalizedBeats.length > 0 ? (
        plot.normalizedBeats.map((beat, index) => (
          <PlotBeatCard
            key={index}
            title={`Beat ${index + 1}`}
            beat={beat}
            onUpdate={(updated) => onUpdateBeat(index, updated)}
          />
        ))
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
          No plot beats defined.
        </div>
      )}

      {/* Show raw data for debugging/advanced editing */}
      {plot.raw && Object.keys(plot.raw).length > 0 && (
        <details style={{ marginTop: '12px' }}>
          <summary
            style={{
              cursor: 'pointer',
              fontSize: '11px',
              color: 'var(--text-muted)',
              padding: '8px 0',
            }}
          >
            View raw plot structure
          </summary>
          <pre
            style={{
              padding: '12px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              fontSize: '11px',
              overflow: 'auto',
              maxHeight: '200px',
            }}
          >
            {JSON.stringify(plot.raw, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

/**
 * Render a three-act plot structure
 */
function ThreeActPlotSection({ plot, onUpdateBeat, onUpdateRisingAction }) {
  return (
    <div>
      <PlotBeatCard
        title="Inciting Incident"
        beat={plot.incitingIncident}
        onUpdate={(updated) => onUpdateBeat('incitingIncident', updated)}
      />

      {plot.risingAction && plot.risingAction.map((beat, index) => (
        <PlotBeatCard
          key={index}
          title={`Rising Action ${index + 1}`}
          beat={beat}
          onUpdate={(updated) => onUpdateRisingAction(index, updated)}
        />
      ))}

      <PlotBeatCard
        title="Climax"
        beat={plot.climax}
        onUpdate={(updated) => onUpdateBeat('climax', updated)}
      />

      <PlotBeatCard
        title="Resolution"
        beat={plot.resolution}
        onUpdate={(updated) => onUpdateBeat('resolution', updated)}
      />
    </div>
  );
}

function SceneCard({ scene, index, entityMap, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        marginBottom: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Scene header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px',
          background: 'var(--bg-tertiary)',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{ fontFamily: 'monospace', fontSize: '10px', marginRight: '8px' }}>
          {expanded ? '▾' : '▸'}
        </span>
        <span style={{ fontWeight: 600, fontSize: '13px', marginRight: '12px' }}>
          Scene {index + 1}
        </span>
        <span style={{ color: 'var(--text-secondary)', fontSize: '13px', flex: 1 }}>
          {scene.title || '(untitled)'}
        </span>
        <span
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            background: 'var(--bg-secondary)',
            borderRadius: '4px',
            color: 'var(--text-muted)',
          }}
        >
          {scene.emotionalBeat || 'no beat'}
        </span>
        <div
          style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            style={{
              padding: '4px 8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: isFirst ? 'not-allowed' : 'pointer',
              opacity: isFirst ? 0.5 : 1,
              fontSize: '10px',
            }}
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            style={{
              padding: '4px 8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: isLast ? 'not-allowed' : 'pointer',
              opacity: isLast ? 0.5 : 1,
              fontSize: '10px',
            }}
          >
            ↓
          </button>
          <button
            onClick={onRemove}
            style={{
              padding: '4px 8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Remove scene"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Scene details */}
      {expanded && (
        <div style={{ padding: '12px' }}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Scene Title
            </label>
            <EditableText
              value={scene.title}
              onChange={(title) => onUpdate({ ...scene, title })}
              placeholder="Scene title..."
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Goal (what this scene MUST accomplish)
            </label>
            <EditableText
              value={scene.goal}
              onChange={(goal) => onUpdate({ ...scene, goal })}
              multiline
              placeholder="What must this scene achieve narratively?"
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Setting
            </label>
            <EditableText
              value={scene.setting}
              onChange={(setting) => onUpdate({ ...scene, setting })}
              placeholder="Where does this scene take place?"
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Emotional Beat
            </label>
            <select
              value={scene.emotionalBeat || ''}
              onChange={(e) => onUpdate({ ...scene, emotionalBeat: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '13px',
              }}
            >
              <option value="">Select emotional beat...</option>
              {EMOTIONAL_BEATS.map((beat) => (
                <option key={beat} value={beat}>
                  {beat.charAt(0).toUpperCase() + beat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {scene.characterIds?.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Characters in Scene
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {scene.characterIds.map((id) => (
                  <span
                    key={id}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: '4px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {entityMap?.get(id)?.name || id}
                  </span>
                ))}
              </div>
            </div>
          )}

          {scene.eventIds?.length > 0 && (
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Related Events
              </label>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {scene.eventIds.join(', ')}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StoryPlanEditor({
  plan,
  entityMap,
  onPlanChange,
  onApprove,
  onRegenerate,
  isGenerating = false,
}) {
  const [openSections, setOpenSections] = useState({
    overview: true,
    characters: true,
    setting: false,
    plot: true,
    scenes: true,
  });

  const toggleSection = useCallback((section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Character updates
  const updateCharacter = useCallback(
    (index, updated) => {
      const characters = [...plan.characters];
      characters[index] = updated;
      onPlanChange({ ...plan, characters });
    },
    [plan, onPlanChange]
  );

  const removeCharacter = useCallback(
    (index) => {
      const characters = plan.characters.filter((_, i) => i !== index);
      onPlanChange({ ...plan, characters });
    },
    [plan, onPlanChange]
  );

  // Plot updates
  const updatePlotBeat = useCallback(
    (beatType, updated) => {
      onPlanChange({
        ...plan,
        plot: { ...plan.plot, [beatType]: updated },
      });
    },
    [plan, onPlanChange]
  );

  const updateRisingAction = useCallback(
    (index, updated) => {
      const risingAction = [...(plan.plot.risingAction || [])];
      risingAction[index] = updated;
      onPlanChange({
        ...plan,
        plot: { ...plan.plot, risingAction },
      });
    },
    [plan, onPlanChange]
  );

  // Flexible plot beat updates (for non-three-act structures)
  const updateFlexibleBeat = useCallback(
    (index, updated) => {
      const normalizedBeats = [...(plan.plot.normalizedBeats || [])];
      normalizedBeats[index] = updated;
      onPlanChange({
        ...plan,
        plot: { ...plan.plot, normalizedBeats },
      });
    },
    [plan, onPlanChange]
  );

  // Scene updates
  const updateScene = useCallback(
    (index, updated) => {
      const scenes = [...plan.scenes];
      scenes[index] = updated;
      onPlanChange({ ...plan, scenes });
    },
    [plan, onPlanChange]
  );

  const removeScene = useCallback(
    (index) => {
      const scenes = plan.scenes.filter((_, i) => i !== index);
      onPlanChange({ ...plan, scenes });
    },
    [plan, onPlanChange]
  );

  const moveScene = useCallback(
    (index, direction) => {
      const scenes = [...plan.scenes];
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= scenes.length) return;
      [scenes[index], scenes[newIndex]] = [scenes[newIndex], scenes[index]];
      onPlanChange({ ...plan, scenes });
    },
    [plan, onPlanChange]
  );

  if (!plan) {
    return (
      <div
        style={{
          padding: '48px',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}
      >
        No story plan generated yet. Generate a plan to begin.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header with actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          padding: '16px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>{plan.title}</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {plan.characters.length} elements • {plan.scenes.length} scenes
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onRegenerate}
            disabled={isGenerating}
            style={{
              padding: '10px 20px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              opacity: isGenerating ? 0.6 : 1,
              fontSize: '13px',
            }}
          >
            Clear and Restart
          </button>
          <button
            onClick={onApprove}
            disabled={isGenerating}
            style={{
              padding: '10px 20px',
              background: 'var(--accent-primary)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              opacity: isGenerating ? 0.6 : 1,
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            Approve & Expand Scenes →
          </button>
        </div>
      </div>

      {/* Overview section */}
      <div style={{ marginBottom: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <SectionHeader
          title="Overview"
          isOpen={openSections.overview}
          onToggle={() => toggleSection('overview')}
        />
        {openSections.overview && (
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Theme
                </label>
                <EditableText
                  value={plan.theme}
                  onChange={(theme) => onPlanChange({ ...plan, theme })}
                  placeholder="Central theme or message..."
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Tone
                </label>
                <EditableText
                  value={plan.tone}
                  onChange={(tone) => onPlanChange({ ...plan, tone })}
                  placeholder="Emotional/stylistic tone..."
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Story Elements section */}
      <div style={{ marginBottom: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <SectionHeader
          title="Story Elements"
          count={plan.characters.length}
          isOpen={openSections.characters}
          onToggle={() => toggleSection('characters')}
        />
        {openSections.characters && (
          <div style={{ padding: '16px' }}>
            {plan.characters.map((char, index) => (
              <StoryElementCard
                key={char.entityId}
                character={char}
                entity={entityMap?.get(char.entityId)}
                entityMap={entityMap}
                onUpdate={(updated) => updateCharacter(index, updated)}
                onRemove={() => removeCharacter(index)}
              />
            ))}
            {plan.characters.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                No story elements defined yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Setting section */}
      <div style={{ marginBottom: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <SectionHeader
          title="Setting"
          isOpen={openSections.setting}
          onToggle={() => toggleSection('setting')}
        />
        {openSections.setting && (
          <div style={{ padding: '16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Timespan
              </label>
              <EditableText
                value={plan.setting.timespan}
                onChange={(timespan) =>
                  onPlanChange({ ...plan, setting: { ...plan.setting, timespan } })
                }
                placeholder="How long does the story span?"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Locations
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(plan.setting.locations || []).map((loc, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {loc}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Plot Structure section */}
      <div style={{ marginBottom: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <SectionHeader
          title="Plot Structure"
          isOpen={openSections.plot}
          onToggle={() => toggleSection('plot')}
        />
        {openSections.plot && (
          <div style={{ padding: '16px' }}>
            {isThreeActPlot(plan.plot) ? (
              <ThreeActPlotSection
                plot={plan.plot}
                onUpdateBeat={updatePlotBeat}
                onUpdateRisingAction={updateRisingAction}
              />
            ) : isFlexiblePlot(plan.plot) ? (
              <FlexiblePlotSection
                plot={plan.plot}
                onUpdateBeat={updateFlexibleBeat}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                Unknown plot structure format
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scenes section */}
      <div style={{ marginBottom: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <SectionHeader
          title="Scenes"
          count={plan.scenes.length}
          isOpen={openSections.scenes}
          onToggle={() => toggleSection('scenes')}
        />
        {openSections.scenes && (
          <div style={{ padding: '16px' }}>
            {plan.scenes.map((scene, index) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                index={index}
                entityMap={entityMap}
                onUpdate={(updated) => updateScene(index, updated)}
                onRemove={() => removeScene(index)}
                onMoveUp={() => moveScene(index, -1)}
                onMoveDown={() => moveScene(index, 1)}
                isFirst={index === 0}
                isLast={index === plan.scenes.length - 1}
              />
            ))}
            {plan.scenes.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                No scenes defined yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Debug section - Raw Plan Data */}
      <details style={{ marginTop: '24px' }}>
        <summary
          style={{
            cursor: 'pointer',
            fontSize: '12px',
            color: 'var(--text-muted)',
            padding: '8px 0',
            userSelect: 'none',
          }}
        >
          Debug: View Raw Plan Data
        </summary>
        <div
          style={{
            marginTop: '8px',
            padding: '16px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Entity Map Keys ({entityMap?.size || 0} entities):
            </div>
            <div
              style={{
                padding: '8px',
                background: 'var(--bg-primary)',
                borderRadius: '4px',
                fontSize: '10px',
                fontFamily: 'monospace',
                maxHeight: '100px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {entityMap ? Array.from(entityMap.keys()).join(', ') : '(no entity map)'}
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Character Entity IDs in Plan:
            </div>
            <div
              style={{
                padding: '8px',
                background: 'var(--bg-primary)',
                borderRadius: '4px',
                fontSize: '10px',
                fontFamily: 'monospace',
                maxHeight: '100px',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {plan.characters.map((c) => c.entityId).join(', ') || '(none)'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Full Plan JSON:
            </div>
            <pre
              style={{
                padding: '12px',
                background: 'var(--bg-primary)',
                borderRadius: '4px',
                fontSize: '10px',
                overflow: 'auto',
                maxHeight: '400px',
                margin: 0,
              }}
            >
              {JSON.stringify(plan, null, 2)}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
}
