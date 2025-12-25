/**
 * ChroniclePanel - Multi-step narrative generation pipeline
 *
 * Orchestrates the 4-step chronicle generation process:
 * 1. Plan - Generate structured plan with entities, plot, sections
 * 2. Expand - Expand each section into narrative prose
 * 3. Assemble - Combine sections with transitions and wiki links
 * 4. Validate - Check output against stated goals
 *
 * See CHRONICLE_DESIGN.md for architecture documentation.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import ChroniclePlanEditor from './ChroniclePlanEditor';
import CohesionReportViewer from './CohesionReportViewer';
import EventsPanel from './EventsPanel';
import {
  buildEraChronicleContext,
  buildEntityStoryContext,
  checkPrerequisites,
} from '../lib/chronicleContextBuilder';
import { useChronicleGeneration, deriveStatus } from '../hooks/useChronicleGeneration';
import { useStyleLibrary } from '../hooks/useStyleLibrary';

// Pipeline stages
const STAGES = [
  { id: 'plan', label: 'Plan', icon: '📋' },
  { id: 'expand', label: 'Expand', icon: '📝' },
  { id: 'assemble', label: 'Assemble', icon: '📖' },
  { id: 'validate', label: 'Validate', icon: '✓' },
];

// Content type definitions
const CONTENT_TYPES = [
  { id: 'eraChronicle', label: 'Era Chronicles', description: 'Coming soon (not yet implemented)' },
  { id: 'entityStory', label: 'Entity Stories', description: 'Multi-entity narratives anchored on an entrypoint (no primary required)' },
  { id: 'events', label: 'Events', description: 'View narrative events from simulation' },
];

function StageIndicator({ stages, currentStage, status }) {
  const getStageStatus = (stageId) => {
    const stageIndex = stages.findIndex((s) => s.id === stageId);
    const currentIndex = stages.findIndex((s) => s.id === currentStage);

    if (status === 'complete') return 'complete';
    if (stageIndex < currentIndex) return 'complete';
    if (stageIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {stages.map((stage, i) => {
        const stageStatus = getStageStatus(stage.id);
        return (
          <div key={stage.id} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                background:
                  stageStatus === 'complete'
                    ? '#10b981'
                    : stageStatus === 'active'
                    ? '#3b82f6'
                    : 'var(--bg-tertiary)',
                color:
                  stageStatus === 'complete' || stageStatus === 'active'
                    ? 'white'
                    : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
              title={stage.label}
            >
              {stageStatus === 'complete' ? '✓' : stage.icon}
            </div>
            {i < stages.length - 1 && (
              <div
                style={{
                  width: '20px',
                  height: '2px',
                  background: stageStatus === 'complete' ? '#10b981' : 'var(--bg-tertiary)',
                  marginLeft: '4px',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Badge color schemes for different metadata types
const BADGE_COLORS = {
  // Prominence colors
  mythic: { bg: 'rgba(168, 85, 247, 0.2)', text: '#a855f7', border: 'rgba(168, 85, 247, 0.4)' },
  renowned: { bg: 'rgba(234, 179, 8, 0.2)', text: '#eab308', border: 'rgba(234, 179, 8, 0.4)' },
  recognized: { bg: 'rgba(34, 197, 94, 0.2)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.4)' },
  marginal: { bg: 'rgba(156, 163, 175, 0.2)', text: '#9ca3af', border: 'rgba(156, 163, 175, 0.4)' },
  forgotten: { bg: 'rgba(107, 114, 128, 0.2)', text: '#6b7280', border: 'rgba(107, 114, 128, 0.4)' },
  // Status colors
  active: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' },
  historical: { bg: 'rgba(156, 163, 175, 0.15)', text: '#9ca3af', border: 'rgba(156, 163, 175, 0.3)' },
  current: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
  future: { bg: 'rgba(99, 102, 241, 0.15)', text: '#6366f1', border: 'rgba(99, 102, 241, 0.3)' },
  // Kind colors
  kind: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
  subtype: { bg: 'rgba(14, 165, 233, 0.15)', text: '#0ea5e9', border: 'rgba(14, 165, 233, 0.3)' },
  era: { bg: 'rgba(236, 72, 153, 0.15)', text: '#ec4899', border: 'rgba(236, 72, 153, 0.3)' },
  culture: { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316', border: 'rgba(249, 115, 22, 0.3)' },
};

function EntityBadge({ label, type }) {
  const colors = BADGE_COLORS[type] || BADGE_COLORS[label?.toLowerCase()] || {
    bg: 'rgba(107, 114, 128, 0.15)',
    text: '#6b7280',
    border: 'rgba(107, 114, 128, 0.3)',
  };

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        fontSize: '10px',
        fontWeight: 500,
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        borderRadius: '4px',
        textTransform: 'capitalize',
      }}
    >
      {label}
    </span>
  );
}

function ChronicleItemCard({ item, isSelected, onClick, entityMap }) {
  const entity = entityMap?.get(item.targetId);

  const getTargetName = () => {
    if (item.type === 'eraChronicle') {
      return entity?.name || item.targetId;
    }
    if (item.type === 'entityStory') {
      return entity?.name || item.targetId;
    }
    return item.targetId;
  };

  const getStatusLabel = () => {
    switch (item.status) {
      case 'not_started':
        return { label: 'Not Started', color: 'var(--text-muted)' };
      case 'planning':
        return { label: 'Planning...', color: '#3b82f6' };
      case 'plan_ready':
        return { label: 'Plan Ready', color: '#f59e0b' };
      case 'expanding':
        return { label: 'Expanding...', color: '#3b82f6' };
      case 'sections_ready':
        return { label: 'Sections Ready', color: '#f59e0b' };
      case 'assembling':
        return { label: 'Assembling...', color: '#3b82f6' };
      case 'assembly_ready':
        return { label: 'Assembly Ready', color: '#f59e0b' };
      case 'validating':
        return { label: 'Validating...', color: '#3b82f6' };
      case 'validation_ready':
        return { label: 'Review', color: '#f59e0b' };
      case 'complete':
        return { label: 'Complete', color: '#10b981' };
      default:
        return { label: 'Unknown', color: 'var(--text-muted)' };
    }
  };

  // Build badges array based on entity data
  const badges = useMemo(() => {
    if (!entity) return [];
    const b = [];

    // Kind badge (always show for non-era entities)
    if (entity.kind && entity.kind !== 'era') {
      b.push({ label: entity.kind, type: 'kind' });
    }

    // Subtype badge (if different from kind)
    if (entity.subtype && entity.subtype !== entity.kind) {
      b.push({ label: entity.subtype, type: 'subtype' });
    }

    // Prominence badge
    if (entity.prominence) {
      b.push({ label: entity.prominence, type: entity.prominence });
    }

    // Status badge (only if notable - not 'active' which is the default)
    if (entity.status && entity.status !== 'active') {
      b.push({ label: entity.status, type: entity.status });
    }

    // Culture badge
    if (entity.culture && entity.culture !== 'universal') {
      b.push({ label: entity.culture, type: 'culture' });
    }

    return b;
  }, [entity]);

  const status = getStatusLabel();

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        background: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
        border: `1px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
        borderRadius: '6px',
        cursor: 'pointer',
        marginBottom: '8px',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ fontWeight: 500, fontSize: '14px', flex: 1 }}>{getTargetName()}</span>
        <span style={{ fontSize: '11px', color: status.color, fontWeight: 500, whiteSpace: 'nowrap' }}>
          {status.label}
        </span>
      </div>

      {/* Entity metadata badges */}
      {badges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
          {badges.map((badge, idx) => (
            <EntityBadge key={idx} label={badge.label} type={badge.type} />
          ))}
        </div>
      )}

      {item.status !== 'not_started' && item.status !== 'complete' && (
        <div style={{ marginTop: '8px' }}>
          <StageIndicator
            stages={STAGES}
            currentStage={
              item.status === 'planning' || item.status === 'plan_ready'
                ? 'plan'
                : item.status === 'expanding' || item.status === 'sections_ready'
                ? 'expand'
                : item.status === 'assembling' || item.status === 'assembly_ready'
                ? 'assemble'
                : 'validate'
            }
            status={item.status}
          />
        </div>
      )}
    </div>
  );
}

function PrerequisiteWarning({ missing, onGeneratePrereqs }) {
  if (missing.length === 0) return null;

  return (
    <div
      style={{
        padding: '16px',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '8px',
        marginBottom: '16px',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', color: '#ef4444' }}>
        Missing Prerequisites
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
        The following items need to be enriched before generating this chronicle:
      </div>
      <ul style={{ margin: '0 0 12px 0', paddingLeft: '20px', fontSize: '12px' }}>
        {missing.slice(0, 5).map((m) => (
          <li key={m.id} style={{ marginBottom: '4px' }}>
            <strong>{m.name}</strong> - {m.type.replace(/([A-Z])/g, ' $1').toLowerCase()}
          </li>
        ))}
        {missing.length > 5 && <li>...and {missing.length - 5} more</li>}
      </ul>
      <button
        onClick={onGeneratePrereqs}
        className="illuminator-button illuminator-button-primary"
        style={{ padding: '8px 16px', fontSize: '12px' }}
      >
        Generate Prerequisites ({missing.length})
      </button>
    </div>
  );
}

function SectionProgressList({ sections, onSectionClick }) {
  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--bg-tertiary)',
          fontWeight: 600,
          fontSize: '14px',
        }}
      >
        Section Progress
      </div>
      {sections.map((section, i) => (
        <div
          key={section.id}
          onClick={() => onSectionClick?.(section.id)}
          style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: section.generatedContent ? 'pointer' : 'default',
          }}
        >
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '8px' }}>
              {i + 1}.
            </span>
            <span style={{ fontSize: '13px' }}>{section.name}</span>
          </div>
          <span
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              background: section.generatedContent ? '#10b981' : 'var(--bg-tertiary)',
              color: section.generatedContent ? 'white' : 'var(--text-muted)',
            }}
          >
            {section.generatedContent ? '✓' : '○'}
          </span>
        </div>
      ))}
    </div>
  );
}

function AssembledContentViewer({ content, wordCount, wikiLinks, onCopy }) {
  const [showLinks, setShowLinks] = useState(false);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {wordCount.toLocaleString()} words • {wikiLinks.length} entity links
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setShowLinks(!showLinks)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {showLinks ? 'Hide Links' : 'Show Links'}
          </button>
          <button
            onClick={onCopy}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Copy
          </button>
        </div>
      </div>

      {showLinks && wikiLinks.length > 0 && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px',
            background: 'var(--bg-tertiary)',
            borderRadius: '6px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '8px' }}>
            Wiki Links ({wikiLinks.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {wikiLinks.map((link) => (
              <span
                key={link.entityId}
                style={{
                  padding: '4px 8px',
                  fontSize: '11px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                }}
              >
                [[{link.name}]] {link.count > 1 && `×${link.count}`}
              </span>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          padding: '20px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          fontSize: '14px',
          lineHeight: 1.8,
          maxHeight: '600px',
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
        }}
      >
        {content}
      </div>
    </div>
  );
}

export default function ChroniclePanel({
  worldData,
  entities,
  queue,
  onEnqueue,
  onCancel,
  worldContext,
  projectId,
  simulationRunId,
  buildPrompt,
}) {
  // Load persisted state from localStorage
  const [activeType, setActiveType] = useState(() => {
    const saved = localStorage.getItem('illuminator:chronicle:activeType');
    const allowed = new Set(CONTENT_TYPES.map((type) => type.id));
    if (saved && allowed.has(saved)) return saved;
    return 'entityStory';
  });
  const [selectedItemId, setSelectedItemId] = useState(() => {
    const saved = localStorage.getItem('illuminator:chronicle:selectedItemId');
    return saved || null;
  });
  const [selectedNarrativeStyleId, setSelectedNarrativeStyleId] = useState(() => {
    const saved = localStorage.getItem('illuminator:chronicle:narrativeStyleId');
    return saved || 'epic-drama';
  });

  // Persist state changes to localStorage
  useEffect(() => {
    localStorage.setItem('illuminator:chronicle:activeType', activeType);
  }, [activeType]);

  useEffect(() => {
    if (selectedItemId) {
      localStorage.setItem('illuminator:chronicle:selectedItemId', selectedItemId);
    } else {
      localStorage.removeItem('illuminator:chronicle:selectedItemId');
    }
  }, [selectedItemId]);

  useEffect(() => {
    localStorage.setItem('illuminator:chronicle:narrativeStyleId', selectedNarrativeStyleId);
  }, [selectedNarrativeStyleId]);

  // State for restart confirmation modal
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [pendingRestartEntityId, setPendingRestartEntityId] = useState(null);

  // Load style library for narrative styles
  const { styleLibrary, loading: stylesLoading } = useStyleLibrary();

  // Use the chronicle generation hook
  // Returns chronicle records Map<entityId, StoryRecord> loaded from IndexedDB
  const {
    stories,
    generateStory,
    continueStory,
    acceptStory,
    restartStory,
    isGenerating,
    refresh,
  } = useChronicleGeneration(projectId, simulationRunId, queue, onEnqueue);

  // Get the selected narrative style
  const selectedNarrativeStyle = useMemo(() => {
    if (stylesLoading || !styleLibrary?.narrativeStyles) return null;
    return styleLibrary.narrativeStyles.find((s) => s.id === selectedNarrativeStyleId);
  }, [styleLibrary, selectedNarrativeStyleId, stylesLoading]);

  // Build entity map for lookups
  const entityMap = useMemo(() => {
    if (!entities) return new Map();
    return new Map(entities.map((e) => [e.id, e]));
  }, [entities]);

  const eventMap = useMemo(() => {
    if (!worldData?.narrativeHistory) return new Map();
    return new Map(worldData.narrativeHistory.map((e) => [e.id, e]));
  }, [worldData]);

  // Helper to get status considering both IndexedDB and queue state
  const getEffectiveStatus = useCallback((entityId, story) => {
    // First check queue for running/queued tasks for this entity
    const queueTask = queue.find(
      (item) => item.type === 'entityStory' && item.entityId === entityId
    );

    if (queueTask) {
      if (queueTask.status === 'running') {
        // Map chronicleStep to status
        switch (queueTask.chronicleStep) {
          case 'plan': return 'planning';
          case 'expand': return 'expanding';
          case 'assemble': return 'assembling';
          case 'validate': return 'validating';
          default: return 'planning';
        }
      }
      if (queueTask.status === 'queued') {
        return 'planning'; // Waiting to start
      }
    }

    // Fall back to IndexedDB-derived status
    return deriveStatus(story);
  }, [queue]);

  // Build list of chronicle items by type
  const chronicleItems = useMemo(() => {
    if (!worldData?.hardState) return [];

    const items = [];

    if (activeType === 'eraChronicle') {
      const eras = worldData.hardState.filter((e) => e.kind === 'era');
      for (const era of eras) {
        const story = stories.get(era.id);
        items.push({
          id: era.id,
          type: 'eraChronicle',
          targetId: era.id,
          status: getEffectiveStatus(era.id, story),
          // Include full story record if exists
          storyId: story?.storyId,
          plan: story?.plan,
          sectionsCompleted: story?.sectionsCompleted,
          sectionsTotal: story?.sectionsTotal,
          assembledContent: story?.assembledContent,
          cohesionReport: story?.cohesionReport,
          wikiLinks: story?.wikiLinks,
          finalContent: story?.finalContent,
        });
      }
    } else if (activeType === 'entityStory') {
      const prominentEntities = (entities || []).filter(
        (e) =>
          e.kind !== 'era' && (e.prominence === 'mythic' || e.prominence === 'renowned')
      );
      for (const entity of prominentEntities) {
        const story = stories.get(entity.id);
        items.push({
          id: entity.id,
          type: 'entityStory',
          targetId: entity.id,
          status: getEffectiveStatus(entity.id, story),
          // Include full story record if exists
          storyId: story?.storyId,
          plan: story?.plan,
          sectionsCompleted: story?.sectionsCompleted,
          sectionsTotal: story?.sectionsTotal,
          assembledContent: story?.assembledContent,
          cohesionReport: story?.cohesionReport,
          wikiLinks: story?.wikiLinks,
          finalContent: story?.finalContent,
        });
      }
    }

    return items;
  }, [worldData, entities, activeType, entityMap, stories, getEffectiveStatus]);

  // Get selected item
  const selectedItem = useMemo(() => {
    return chronicleItems.find((item) => item.id === selectedItemId);
  }, [chronicleItems, selectedItemId]);

  // Clear selection if stored item no longer exists in current data
  useEffect(() => {
    if (selectedItemId && chronicleItems.length > 0 && !selectedItem) {
      console.log('[Chronicle] Stored selectedItemId not found in current items, clearing');
      setSelectedItemId(null);
    }
  }, [selectedItemId, chronicleItems, selectedItem]);

  // Build generation context for selected item
  const generationContext = useMemo(() => {
    if (!selectedItem || !worldData) return null;

    try {
      const wc = {
        name: worldContext?.name || 'The World',
        description: worldContext?.description || '',
        canonFacts: worldContext?.canonFacts || [],
        tone: worldContext?.tone || '',
      };

      if (selectedItem.type === 'eraChronicle') {
        return buildEraChronicleContext(selectedItem.targetId, worldData, wc);
      } else if (selectedItem.type === 'entityStory') {
        return buildEntityStoryContext(selectedItem.targetId, worldData, wc);
      }
    } catch (e) {
      console.error('Failed to build generation context:', e);
    }
    return null;
  }, [selectedItem, worldData, worldContext]);

  const isEraUnimplemented = selectedItem?.type === 'eraChronicle';
  // Check prerequisites
  const prerequisites = useMemo(() => {
    if (!generationContext || isEraUnimplemented) return { ready: true, missing: [] };
    return checkPrerequisites(generationContext);
  }, [generationContext, isEraUnimplemented]);

  // Handle chronicle generation (runs all 4 steps in worker)
  const handleGenerateChronicle = useCallback(() => {
    if (!selectedItem || !generationContext) return;
    if (selectedItem.type === 'eraChronicle') return;
    if (!selectedNarrativeStyle) return;
    // Pass the selected narrative style to the generation
    generateStory(selectedItem.id, generationContext, selectedNarrativeStyle);
  }, [selectedItem, generationContext, generateStory, selectedNarrativeStyle]);

  // Handle accept chronicle
  const handleAcceptChronicle = useCallback(() => {
    if (!selectedItem) return;
    acceptStory(selectedItem.id);
  }, [selectedItem, acceptStory]);

  // Handle regenerate (delete and go back to start screen) - uses restart modal
  const handleRegenerate = useCallback(() => {
    if (!selectedItem) return;
    // Use the same restart modal
    setPendingRestartEntityId(selectedItem.targetId);
    setShowRestartModal(true);
  }, [selectedItem]);

  // Handle restart with confirmation modal (for completed chronicles)
  const handleRestartClick = useCallback((entityId) => {
    setPendingRestartEntityId(entityId);
    setShowRestartModal(true);
  }, []);

  const handleRestartConfirm = useCallback(async () => {
    if (pendingRestartEntityId) {
      await restartStory(pendingRestartEntityId);
    }
    setShowRestartModal(false);
    setPendingRestartEntityId(null);
  }, [pendingRestartEntityId, restartStory]);

  const handleRestartCancel = useCallback(() => {
    setShowRestartModal(false);
    setPendingRestartEntityId(null);
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const byStatus = {
      not_started: 0,
      planning: 0,
      plan_ready: 0,
      expanding: 0,
      sections_ready: 0,
      assembling: 0,
      assembly_ready: 0,
      validating: 0,
      validation_ready: 0,
      complete: 0,
    };
    for (const item of chronicleItems) {
      byStatus[item.status] = (byStatus[item.status] || 0) + 1;
    }
    return byStatus;
  }, [chronicleItems]);

  const activeTypeLabel = useMemo(() => {
    if (activeType === 'eraChronicle') return 'era chronicle';
    if (activeType === 'entityStory') return 'entity chronicle';
    return 'chronicle';
  }, [activeType]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Chronicle Pipeline</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Generate long-form narrative content in 4 steps: Plan → Expand → Assemble → Validate
            </p>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {stats.complete} / {chronicleItems.length} complete
          </div>
        </div>
      </div>

      {/* Content type tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-primary)',
        }}
      >
        {CONTENT_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => {
              setActiveType(type.id);
              setSelectedItemId(null);
            }}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: activeType === type.id ? 'var(--bg-secondary)' : 'transparent',
              borderBottom:
                activeType === type.id
                  ? '2px solid var(--accent-primary)'
                  : '2px solid transparent',
              color: activeType === type.id ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeType === type.id ? 600 : 400,
            }}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Events tab - full width panel */}
        {activeType === 'events' ? (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <EventsPanel worldData={worldData} entityMap={entityMap} />
          </div>
        ) : (
          <>
            {/* Left panel: Item list */}
            <div
              style={{
                width: '300px',
                borderRight: '1px solid var(--border-color)',
                overflow: 'auto',
                padding: '16px',
              }}
            >
              {chronicleItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '14px' }}>No items available</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Run a simulation to populate world data.
                  </div>
                </div>
              ) : (
                chronicleItems.map((item) => (
                  <ChronicleItemCard
                    key={item.id}
                    item={item}
                    isSelected={item.id === selectedItemId}
                    onClick={() => setSelectedItemId(item.id)}
                    entityMap={entityMap}
                  />
                ))
              )}
            </div>

        {/* Right panel: Selected item detail */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {!selectedItem ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
              }}
            >
              Select an item to begin generation
            </div>
          ) : (
            <>
              {isEraUnimplemented && (
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(234, 179, 8, 0.12)',
                    border: '1px solid rgba(234, 179, 8, 0.3)',
                    borderRadius: '8px',
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                    marginBottom: '16px',
                  }}
                >
                  Era chronicles are not implemented yet. This tab remains as a placeholder for future work.
                </div>
              )}

              {/* Prerequisites check */}
              {!prerequisites.ready && (
                <PrerequisiteWarning
                  missing={prerequisites.missing}
                  onGeneratePrereqs={() => {
                    // Queue description generation for missing entities
                    const items = prerequisites.missing
                      .filter((prereq) => prereq.type === 'entityDescription')
                      .map((prereq) => {
                        const entity = entities.find((e) => e.id === prereq.id);
                        if (!entity) return null;
                        return {
                          entity,
                          type: 'description',
                          prompt: buildPrompt(entity, 'description'),
                        };
                      })
                      .filter(Boolean);
                    if (items.length > 0) {
                      onEnqueue(items);
                    }
                  }}
                />
              )}

              {!isEraUnimplemented && (
                <>
                  {/* Pipeline stage content */}
                  {selectedItem.status === 'not_started' && (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '48px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>
                        Ready to Generate
                      </h3>
                      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
                        Start by creating a plan for this {activeTypeLabel}.
                      </p>

                      {/* Narrative Style Selector */}
                      <div style={{ marginBottom: '24px', maxWidth: '400px', margin: '0 auto 24px auto' }}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: 500,
                            marginBottom: '8px',
                            textAlign: 'left',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          Narrative Style
                        </label>
                        <select
                          value={selectedNarrativeStyleId}
                          onChange={(e) => setSelectedNarrativeStyleId(e.target.value)}
                          disabled={isEraUnimplemented}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: '14px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          {styleLibrary?.narrativeStyles?.map((style) => (
                            <option key={style.id} value={style.id}>
                              {style.name}
                            </option>
                          ))}
                        </select>
                        {selectedNarrativeStyle && (
                          <div
                            style={{
                              marginTop: '8px',
                              padding: '12px',
                              background: 'var(--bg-tertiary)',
                              borderRadius: '6px',
                              textAlign: 'left',
                            }}
                          >
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                              {selectedNarrativeStyle.description}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              {/* Format badge */}
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  background: selectedNarrativeStyle.format === 'document' ? '#059669' : 'var(--accent-primary)',
                                  color: 'white',
                                  borderRadius: '4px',
                                }}
                              >
                                {selectedNarrativeStyle.format === 'document'
                                  ? selectedNarrativeStyle.documentConfig?.documentType || 'document'
                                  : selectedNarrativeStyle.plotStructure?.type || 'narrative'}
                              </span>
                              {/* Word count badge */}
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  background: 'var(--bg-secondary)',
                                  borderRadius: '4px',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {selectedNarrativeStyle.format === 'document'
                                  ? `${selectedNarrativeStyle.documentConfig?.wordCount?.min || 500}-${selectedNarrativeStyle.documentConfig?.wordCount?.max || 1500} words`
                                  : `${selectedNarrativeStyle.pacing?.totalWordCount?.min || 1000}-${selectedNarrativeStyle.pacing?.totalWordCount?.max || 2000} words`}
                              </span>
                              {/* Scenes/sections badge */}
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 6px',
                                  background: 'var(--bg-secondary)',
                                  borderRadius: '4px',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {selectedNarrativeStyle.format === 'document'
                                  ? `${selectedNarrativeStyle.documentConfig?.sections?.length || 0} sections`
                                  : `${selectedNarrativeStyle.pacing?.sceneCount?.min || 3}-${selectedNarrativeStyle.pacing?.sceneCount?.max || 5} sections`}
                              </span>
                            </div>
                            {selectedNarrativeStyle.tags && selectedNarrativeStyle.tags.length > 0 && (
                              <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {selectedNarrativeStyle.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    style={{
                                      fontSize: '10px',
                                      padding: '2px 6px',
                                      background: 'rgba(99, 102, 241, 0.2)',
                                      borderRadius: '4px',
                                      color: 'var(--text-muted)',
                                    }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={handleGenerateChronicle}
                        disabled={!prerequisites.ready || stylesLoading || !selectedNarrativeStyle || isEraUnimplemented}
                        className="illuminator-button illuminator-button-primary"
                        style={{
                          padding: '12px 24px',
                          fontSize: '14px',
                          opacity: prerequisites.ready && !stylesLoading && selectedNarrativeStyle && !isEraUnimplemented ? 1 : 0.5,
                        }}
                      >
                        Generate Chronicle
                      </button>
                    </div>
                  )}

              {/* In-progress states - show spinner */}
              {(selectedItem.status === 'planning' ||
                selectedItem.status === 'expanding' ||
                selectedItem.status === 'assembling' ||
                selectedItem.status === 'validating') && (
                <div style={{ textAlign: 'center', padding: '48px' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      margin: '0 auto 16px',
                      border: '4px solid var(--bg-tertiary)',
                      borderTopColor: 'var(--accent-primary)',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <h3 style={{ margin: '0 0 8px 0' }}>
                    {selectedItem.status === 'planning' && 'Generating Plan...'}
                    {selectedItem.status === 'expanding' && `Expanding Sections (${selectedItem.sectionsCompleted || 0}/${selectedItem.sectionsTotal || '?'})...`}
                    {selectedItem.status === 'assembling' && 'Assembling Content...'}
                    {selectedItem.status === 'validating' && 'Validating Cohesion...'}
                  </h3>
                  <div style={{ color: 'var(--text-muted)' }}>
                    {selectedItem.plan && selectedItem.status === 'expanding' && (
                      <SectionProgressList sections={selectedItem.plan.sections} />
                    )}
                    {!selectedItem.plan && <p>This may take a moment. Progress is saved automatically.</p>}
                  </div>
                </div>
              )}

              {/* Plan ready - show plan for review */}
              {selectedItem.status === 'plan_ready' && selectedItem.plan && (
                <div>
                  <h3 style={{ margin: '0 0 16px 0' }}>Plan Ready for Review</h3>
                  <ChroniclePlanEditor
                    plan={selectedItem.plan}
                    entityMap={entityMap}
                    eventMap={eventMap}
                    onRegenerate={handleRegenerate}
                    onApprove={() => {
                      if (generationContext && selectedNarrativeStyle) {
                        continueStory(selectedItem.targetId, generationContext, selectedNarrativeStyle);
                      }
                    }}
                    isGenerating={isGenerating}
                  />
                </div>
              )}

              {/* Sections ready - show expanded sections for review */}
              {selectedItem.status === 'sections_ready' && selectedItem.plan && (
                <div>
                  <h3 style={{ margin: '0 0 16px 0' }}>Sections Expanded - Ready for Review</h3>
                  <div style={{ marginBottom: '24px' }}>
                    {selectedItem.plan.sections.map((section, idx) => (
                      <div key={section.id} style={{ marginBottom: '16px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                        <h4 style={{ margin: '0 0 8px 0' }}>Section {idx + 1}: {section.name}</h4>
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{section.generatedContent || 'No content'}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => {
                        if (generationContext && selectedNarrativeStyle) {
                          continueStory(selectedItem.targetId, generationContext, selectedNarrativeStyle);
                        }
                      }}
                      disabled={isGenerating || !generationContext || !selectedNarrativeStyle}
                      className="illuminator-button illuminator-button-primary"
                      style={{ padding: '12px 24px', fontSize: '14px' }}
                    >
                      Continue to Assembly
                    </button>
                  </div>
                </div>
              )}

              {/* Assembly ready - show assembled content for review */}
              {selectedItem.status === 'assembly_ready' && selectedItem.assembledContent && (
                <div>
                  <h3 style={{ margin: '0 0 16px 0' }}>Content Assembled - Ready for Validation</h3>
                  <AssembledContentViewer
                    content={selectedItem.assembledContent}
                    wordCount={selectedItem.assembledContent.split(/\s+/).filter(Boolean).length}
                    wikiLinks={selectedItem.wikiLinks || []}
                    onCopy={() => navigator.clipboard.writeText(selectedItem.assembledContent)}
                  />
                  <div style={{ marginTop: '24px', textAlign: 'center' }}>
                    <button
                      onClick={() => {
                        if (generationContext && selectedNarrativeStyle) {
                          continueStory(selectedItem.targetId, generationContext, selectedNarrativeStyle);
                        }
                      }}
                      disabled={isGenerating || !generationContext || !selectedNarrativeStyle}
                      className="illuminator-button illuminator-button-primary"
                      style={{ padding: '12px 24px', fontSize: '14px' }}
                    >
                      Continue to Validation
                    </button>
                  </div>
                </div>
              )}

              {selectedItem.status === 'validation_ready' && (
                <div>
                  {selectedItem.cohesionReport && (
                    <CohesionReportViewer
                      report={selectedItem.cohesionReport}
                      plan={selectedItem.plan}
                      onAccept={handleAcceptChronicle}
                      onRegenerate={handleRegenerate}
                      isGenerating={isGenerating}
                    />
                  )}
                  {selectedItem.assembledContent && (
                    <div style={{ marginTop: '24px' }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Preview</h3>
                      <AssembledContentViewer
                        content={selectedItem.assembledContent}
                        wordCount={selectedItem.assembledContent.split(/\s+/).filter(Boolean).length}
                        wikiLinks={selectedItem.wikiLinks || []}
                        onCopy={() => navigator.clipboard.writeText(selectedItem.assembledContent)}
                      />
                    </div>
                  )}
                </div>
              )}

              {selectedItem.status === 'complete' && selectedItem.finalContent && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Completed Chronicle</h3>
                    <button
                      onClick={() => handleRestartClick(selectedItem.id)}
                      style={{
                        padding: '8px 16px',
                        fontSize: '12px',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Restart
                    </button>
                  </div>
                  <AssembledContentViewer
                    content={selectedItem.finalContent}
                    wordCount={selectedItem.finalContent.split(/\s+/).filter(Boolean).length}
                    wikiLinks={selectedItem.wikiLinks || []}
                    onCopy={() => navigator.clipboard.writeText(selectedItem.finalContent)}
                  />
                </div>
              )}
                </>
              )}
            </>
          )}
        </div>
      </>
    )}
      </div>

      {/* Restart confirmation modal */}
      {showRestartModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleRestartCancel}
        >
          <div
            style={{
              background: 'var(--bg-primary)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>Restart Chronicle?</h3>
            <p style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
              This will permanently delete the generated chronicle content and start over from the beginning.
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleRestartCancel}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRestartConfirm}
                style={{
                  padding: '10px 20px',
                  fontSize: '14px',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Delete & Restart
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
