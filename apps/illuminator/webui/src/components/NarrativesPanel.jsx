/**
 * NarrativesPanel - Era and Relationship enrichments
 *
 * Allows generating narrative text for:
 * - Eras (historical summaries)
 * - Significant relationships (stories about connections)
 */

import { useState, useMemo, useCallback } from 'react';

function EnrichmentStatusBadge({ status }) {
  const styles = {
    missing: { background: 'var(--bg-tertiary)', color: 'var(--text-muted)' },
    queued: { background: '#3b82f6', color: 'white' },
    running: { background: '#f59e0b', color: 'white' },
    complete: { background: '#10b981', color: 'white' },
    error: { background: '#ef4444', color: 'white' },
  };

  const icons = {
    missing: '○',
    queued: '◷',
    running: '◐',
    complete: '✓',
    error: '✗',
  };

  const labels = {
    missing: 'Missing',
    queued: 'Queued',
    running: 'Running',
    complete: 'Complete',
    error: 'Error',
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        fontWeight: 500,
        ...styles[status],
      }}
    >
      <span>{icons[status]}</span>
      <span>{labels[status]}</span>
    </span>
  );
}

function EraCard({ era, narrative, status, onQueue, onCancel }) {
  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        marginBottom: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>{era.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {era.description}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <EnrichmentStatusBadge status={status} />
          {status === 'missing' && (
            <button
              onClick={() => onQueue(era)}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 12px', fontSize: '11px' }}
            >
              Generate
            </button>
          )}
          {(status === 'queued' || status === 'running') && (
            <button
              onClick={() => onCancel(era)}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 12px', fontSize: '11px' }}
            >
              Cancel
            </button>
          )}
          {status === 'error' && (
            <button
              onClick={() => onQueue(era)}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 12px', fontSize: '11px' }}
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {narrative && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            background: 'var(--bg-secondary)',
            borderRadius: '4px',
            fontSize: '13px',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
          }}
        >
          {narrative}
        </div>
      )}
    </div>
  );
}

function RelationshipCard({ relationship, entities, narrative, status, onQueue, onCancel }) {
  const srcEntity = entities.find((e) => e.id === relationship.src);
  const dstEntity = entities.find((e) => e.id === relationship.dst);

  if (!srcEntity || !dstEntity) return null;

  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        marginBottom: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '14px' }}>
            {srcEntity.name} → {dstEntity.name}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {relationship.kind} · Strength: {(relationship.strength * 100).toFixed(0)}%
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <EnrichmentStatusBadge status={status} />
          {status === 'missing' && (
            <button
              onClick={() => onQueue(relationship)}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 12px', fontSize: '11px' }}
            >
              Generate
            </button>
          )}
          {(status === 'queued' || status === 'running') && (
            <button
              onClick={() => onCancel(relationship)}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 12px', fontSize: '11px' }}
            >
              Cancel
            </button>
          )}
          {status === 'error' && (
            <button
              onClick={() => onQueue(relationship)}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 12px', fontSize: '11px' }}
            >
              Retry
            </button>
          )}
        </div>
      </div>

      {narrative && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            background: 'var(--bg-secondary)',
            borderRadius: '4px',
            fontSize: '13px',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
          }}
        >
          {narrative}
        </div>
      )}
    </div>
  );
}

export default function NarrativesPanel({
  worldData,
  entities,
  queue,
  onEnqueue,
  onCancel,
  worldContext,
  eraNarratives,
  relationshipNarratives,
}) {
  const [activeTab, setActiveTab] = useState('eras');
  const [minStrength, setMinStrength] = useState(0.5);
  const [hideCompleted, setHideCompleted] = useState(false);

  // Extract eras from world data history
  const allEras = useMemo(() => {
    if (!worldData?.history) return [];

    // Find era entities from hardState
    const eraEntities = entities.filter((e) => e.kind === 'era');
    return eraEntities.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description || '',
    }));
  }, [worldData, entities]);

  // Get era narrative status
  const getEraStatus = useCallback(
    (era) => {
      const queueItem = queue.find(
        (item) => item.entityId === era.id && item.type === 'eraNarrative'
      );
      if (queueItem) return queueItem.status;
      if (eraNarratives?.[era.id]) return 'complete';
      return 'missing';
    },
    [queue, eraNarratives]
  );

  // Filter eras based on hideCompleted
  const eras = useMemo(() => {
    if (!hideCompleted) return allEras;
    return allEras.filter((era) => getEraStatus(era) !== 'complete');
  }, [allEras, hideCompleted, getEraStatus]);

  // Get relationship narrative status
  const getRelationshipStatus = useCallback(
    (rel) => {
      const relId = `${rel.src}_${rel.dst}_${rel.kind}`;
      const queueItem = queue.find(
        (item) => item.entityId === relId && item.type === 'relationship'
      );
      if (queueItem) return queueItem.status;
      if (relationshipNarratives?.[relId]) return 'complete';
      return 'missing';
    },
    [queue, relationshipNarratives]
  );

  // Get significant relationships (high strength)
  const allRelationships = useMemo(() => {
    if (!worldData?.relationships) return [];

    return worldData.relationships
      .filter((r) => r.strength >= minStrength)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 50); // Limit to top 50
  }, [worldData, minStrength]);

  // Filter relationships based on hideCompleted
  const significantRelationships = useMemo(() => {
    if (!hideCompleted) return allRelationships;
    return allRelationships.filter((rel) => getRelationshipStatus(rel) !== 'complete');
  }, [allRelationships, hideCompleted, getRelationshipStatus]);

  // Build era narrative prompt
  const buildEraPrompt = useCallback(
    (era) => {
      const worldName = worldContext?.name || 'the world';
      const description = worldContext?.description || '';

      return `Write a narrative summary of the era "${era.name}" in ${worldName}.

Era description: ${era.description}

${description ? `World context: ${description}` : ''}

Write 2-3 paragraphs summarizing the major events, themes, and lasting impact of this era.
Focus on the dramatic arc - what tensions arose, what changed, and what legacy remained.
Be specific and evocative, grounding the narrative in concrete details.`;
    },
    [worldContext]
  );

  // Build relationship narrative prompt
  const buildRelationshipPrompt = useCallback(
    (rel) => {
      const srcEntity = entities.find((e) => e.id === rel.src);
      const dstEntity = entities.find((e) => e.id === rel.dst);
      const worldName = worldContext?.name || 'the world';

      return `Write a short narrative about the ${rel.kind} relationship between ${srcEntity?.name || rel.src} and ${dstEntity?.name || rel.dst} in ${worldName}.

${srcEntity?.name || rel.src}: ${srcEntity?.kind}/${srcEntity?.subtype}, ${srcEntity?.prominence} prominence
${dstEntity?.name || rel.dst}: ${dstEntity?.kind}/${dstEntity?.subtype}, ${dstEntity?.prominence} prominence

Relationship strength: ${(rel.strength * 100).toFixed(0)}%

Write 1-2 paragraphs describing how this relationship formed, what it means to both parties, and how it has shaped their stories.`;
    },
    [entities, worldContext]
  );

  // Queue era narrative
  const queueEra = useCallback(
    (era) => {
      const prompt = buildEraPrompt(era);
      onEnqueue([{
        entity: { id: era.id, name: era.name, kind: 'era', subtype: 'narrative' },
        type: 'eraNarrative',
        prompt,
      }]);
    },
    [buildEraPrompt, onEnqueue]
  );

  // Queue relationship narrative
  const queueRelationship = useCallback(
    (rel) => {
      const relId = `${rel.src}_${rel.dst}_${rel.kind}`;
      const srcEntity = entities.find((e) => e.id === rel.src);
      const dstEntity = entities.find((e) => e.id === rel.dst);
      const prompt = buildRelationshipPrompt(rel);
      onEnqueue([{
        entity: {
          id: relId,
          name: `${srcEntity?.name || rel.src} - ${dstEntity?.name || rel.dst}`,
          kind: 'relationship',
          subtype: rel.kind,
        },
        type: 'relationship',
        prompt,
      }]);
    },
    [entities, buildRelationshipPrompt, onEnqueue]
  );

  // Cancel era
  const cancelEra = useCallback(
    (era) => {
      const queueItem = queue.find(
        (item) => item.entityId === era.id && item.type === 'eraNarrative'
      );
      if (queueItem) onCancel(queueItem.id);
    },
    [queue, onCancel]
  );

  // Cancel relationship
  const cancelRelationship = useCallback(
    (rel) => {
      const relId = `${rel.src}_${rel.dst}_${rel.kind}`;
      const queueItem = queue.find(
        (item) => item.entityId === relId && item.type === 'relationship'
      );
      if (queueItem) onCancel(queueItem.id);
    },
    [queue, onCancel]
  );

  // Queue all missing eras
  const queueAllEras = useCallback(() => {
    const items = eras
      .filter((era) => getEraStatus(era) === 'missing')
      .map((era) => ({
        entity: { id: era.id, name: era.name, kind: 'era', subtype: 'narrative' },
        type: 'eraNarrative',
        prompt: buildEraPrompt(era),
      }));
    if (items.length > 0) onEnqueue(items);
  }, [eras, getEraStatus, buildEraPrompt, onEnqueue]);

  // Queue all missing relationships
  const queueAllRelationships = useCallback(() => {
    const items = significantRelationships
      .filter((rel) => getRelationshipStatus(rel) === 'missing')
      .map((rel) => {
        const relId = `${rel.src}_${rel.dst}_${rel.kind}`;
        const srcEntity = entities.find((e) => e.id === rel.src);
        const dstEntity = entities.find((e) => e.id === rel.dst);
        return {
          entity: {
            id: relId,
            name: `${srcEntity?.name || rel.src} - ${dstEntity?.name || rel.dst}`,
            kind: 'relationship',
            subtype: rel.kind,
          },
          type: 'relationship',
          prompt: buildRelationshipPrompt(rel),
        };
      });
    if (items.length > 0) onEnqueue(items);
  }, [significantRelationships, entities, getRelationshipStatus, buildRelationshipPrompt, onEnqueue]);

  // Count missing
  const missingEras = eras.filter((e) => getEraStatus(e) === 'missing').length;
  const missingRelationships = significantRelationships.filter((r) => getRelationshipStatus(r) === 'missing').length;

  return (
    <div>
      {/* Tab switcher */}
      <div className="illuminator-card">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
          <button
            onClick={() => setActiveTab('eras')}
            className={`illuminator-button ${activeTab === 'eras' ? '' : 'illuminator-button-secondary'}`}
          >
            Eras ({eras.length})
          </button>
          <button
            onClick={() => setActiveTab('relationships')}
            className={`illuminator-button ${activeTab === 'relationships' ? '' : 'illuminator-button-secondary'}`}
          >
            Relationships ({significantRelationships.length})
          </button>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              marginLeft: 'auto',
            }}
          >
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
            />
            Hide completed
          </label>
        </div>

        {activeTab === 'eras' && (
          <>
            <div className="illuminator-card-header">
              <h2 className="illuminator-card-title">Era Narratives</h2>
              <button
                onClick={queueAllEras}
                className="illuminator-button illuminator-button-secondary"
                disabled={missingEras === 0}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Generate All ({missingEras})
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Generate narrative summaries for each era in your world&apos;s history.
            </p>

            {eras.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No eras found in world data. Run a simulation first.
              </div>
            ) : (
              eras.map((era) => (
                <EraCard
                  key={era.id}
                  era={era}
                  narrative={eraNarratives?.[era.id]}
                  status={getEraStatus(era)}
                  onQueue={queueEra}
                  onCancel={cancelEra}
                />
              ))
            )}
          </>
        )}

        {activeTab === 'relationships' && (
          <>
            <div className="illuminator-card-header">
              <h2 className="illuminator-card-title">Relationship Stories</h2>
              <button
                onClick={queueAllRelationships}
                className="illuminator-button illuminator-button-secondary"
                disabled={missingRelationships === 0}
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                Generate All ({missingRelationships})
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px',
                padding: '8px 12px',
                background: 'var(--bg-tertiary)',
                borderRadius: '4px',
              }}
            >
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Min strength:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={minStrength * 100}
                onChange={(e) => setMinStrength(e.target.value / 100)}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: '12px', width: '40px' }}>{(minStrength * 100).toFixed(0)}%</span>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Generate narrative stories for significant relationships between entities.
            </p>

            {significantRelationships.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No relationships meet the minimum strength threshold.
              </div>
            ) : (
              significantRelationships.map((rel) => (
                <RelationshipCard
                  key={`${rel.src}_${rel.dst}_${rel.kind}`}
                  relationship={rel}
                  entities={entities}
                  narrative={relationshipNarratives?.[`${rel.src}_${rel.dst}_${rel.kind}`]}
                  status={getRelationshipStatus(rel)}
                  onQueue={queueRelationship}
                  onCancel={cancelRelationship}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
