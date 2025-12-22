/**
 * CostsPanel - Cost tracking and breakdown view
 *
 * Shows:
 * - Running totals by type (text, image)
 * - Breakdown by model
 * - Session costs vs all-time costs (persisted to localStorage)
 */

import { useMemo, useEffect, useState } from 'react';
import { formatCost } from '../lib/costEstimation';

const STORAGE_KEY = 'illuminator:costHistory';

function CostCard({ title, children }) {
  return (
    <div className="illuminator-card">
      <div className="illuminator-card-header">
        <h2 className="illuminator-card-title">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function CostRow({ label, value, isTotal, isEstimated }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid var(--border-color)',
        fontWeight: isTotal ? 600 : 400,
      }}
    >
      <span>{label}</span>
      <span style={{ fontFamily: 'monospace' }}>
        {isEstimated && '~'}
        {formatCost(value)}
      </span>
    </div>
  );
}

export default function CostsPanel({ entities, queue, projectId, activeSlotIndex }) {
  // Load persisted cost history from localStorage
  const [costHistory, setCostHistory] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : { allTime: { text: 0, image: 0 }, bySlot: {} };
    } catch {
      return { allTime: { text: 0, image: 0 }, bySlot: {} };
    }
  });

  // Calculate current session costs from entities
  const sessionCosts = useMemo(() => {
    let textActual = 0;
    let imageActual = 0;
    let textCount = 0;
    let imageCount = 0;
    const byModel = {};

    for (const entity of entities) {
      const enrichment = entity.enrichment;
      if (!enrichment) continue;

      // Description costs
      if (enrichment.description?.actualCost) {
        textActual += enrichment.description.actualCost;
        textCount++;
        const model = enrichment.description.model || 'unknown';
        byModel[model] = (byModel[model] || 0) + enrichment.description.actualCost;
      }

      // Era narrative costs
      if (enrichment.eraNarrative?.actualCost) {
        textActual += enrichment.eraNarrative.actualCost;
        textCount++;
        const model = enrichment.eraNarrative.model || 'unknown';
        byModel[model] = (byModel[model] || 0) + enrichment.eraNarrative.actualCost;
      }

      // Image costs
      if (enrichment.image?.actualCost) {
        imageActual += enrichment.image.actualCost;
        imageCount++;
        const model = enrichment.image.model || 'unknown';
        byModel[model] = (byModel[model] || 0) + enrichment.image.actualCost;
      }
    }

    return {
      textActual,
      imageActual,
      textCount,
      imageCount,
      total: textActual + imageActual,
      byModel,
    };
  }, [entities]);

  // Calculate pending queue costs (estimated)
  const queueCosts = useMemo(() => {
    let textEstimated = 0;
    let imageEstimated = 0;

    for (const item of queue) {
      if (item.status === 'complete') continue;
      if (item.estimatedCost) {
        if (item.type === 'image') {
          imageEstimated += item.estimatedCost;
        } else {
          textEstimated += item.estimatedCost;
        }
      }
    }

    return {
      textEstimated,
      imageEstimated,
      total: textEstimated + imageEstimated,
    };
  }, [queue]);

  // Persist costs when entities change
  useEffect(() => {
    if (sessionCosts.total > 0) {
      const slotId = Number.isInteger(activeSlotIndex) ? activeSlotIndex : 'session';
      const projectKey = projectId || 'default';

      setCostHistory((prev) => {
        const updated = {
          ...prev,
          allTime: {
            text: prev.allTime.text + sessionCosts.textActual,
            image: prev.allTime.image + sessionCosts.imageActual,
          },
          bySlot: {
            ...prev.bySlot,
            [`${projectKey}:${slotId}`]: {
              text: (prev.bySlot[`${projectKey}:${slotId}`]?.text || 0) + sessionCosts.textActual,
              image: (prev.bySlot[`${projectKey}:${slotId}`]?.image || 0) + sessionCosts.imageActual,
            },
          },
        };

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {}

        return updated;
      });
    }
  }, [sessionCosts.textActual, sessionCosts.imageActual, projectId, activeSlotIndex]);

  // Get current slot key
  const currentSlotKey = useMemo(() => {
    const slotId = Number.isInteger(activeSlotIndex) ? activeSlotIndex : 'session';
    const projectKey = projectId || 'default';
    return `${projectKey}:${slotId}`;
  }, [projectId, activeSlotIndex]);

  const currentSlotCosts = costHistory.bySlot[currentSlotKey] || { text: 0, image: 0 };

  return (
    <div>
      {/* Current Session */}
      <CostCard title="Current Session">
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Costs from this session based on actual API usage.
        </div>
        <CostRow label="Text generations" value={sessionCosts.textActual} />
        <CostRow
          label={`  └ ${sessionCosts.textCount} requests`}
          value={sessionCosts.textActual}
        />
        <CostRow label="Image generations" value={sessionCosts.imageActual} />
        <CostRow
          label={`  └ ${sessionCosts.imageCount} images`}
          value={sessionCosts.imageActual}
        />
        <CostRow label="Session Total" value={sessionCosts.total} isTotal />
      </CostCard>

      {/* Pending Queue */}
      {queueCosts.total > 0 && (
        <CostCard title="Pending Queue (Estimated)">
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Estimated costs for queued tasks not yet completed.
          </div>
          <CostRow label="Text generations" value={queueCosts.textEstimated} isEstimated />
          <CostRow label="Image generations" value={queueCosts.imageEstimated} isEstimated />
          <CostRow label="Queue Total" value={queueCosts.total} isTotal isEstimated />
        </CostCard>
      )}

      {/* By Model */}
      {Object.keys(sessionCosts.byModel).length > 0 && (
        <CostCard title="By Model">
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Cost breakdown by model used.
          </div>
          {Object.entries(sessionCosts.byModel)
            .sort((a, b) => b[1] - a[1])
            .map(([model, cost]) => (
              <CostRow key={model} label={model} value={cost} />
            ))}
        </CostCard>
      )}

      {/* Current Slot History */}
      <CostCard title="Current Slot Total">
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Accumulated costs for this world slot (persisted).
        </div>
        <CostRow label="Text generations" value={currentSlotCosts.text} />
        <CostRow label="Image generations" value={currentSlotCosts.image} />
        <CostRow label="Slot Total" value={currentSlotCosts.text + currentSlotCosts.image} isTotal />
      </CostCard>

      {/* All Time */}
      <CostCard title="All Time Total">
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Accumulated costs across all projects and sessions.
        </div>
        <CostRow label="Text generations" value={costHistory.allTime.text} />
        <CostRow label="Image generations" value={costHistory.allTime.image} />
        <CostRow
          label="All Time Total"
          value={costHistory.allTime.text + costHistory.allTime.image}
          isTotal
        />

        <button
          onClick={() => {
            if (confirm('Clear all cost history? This cannot be undone.')) {
              setCostHistory({ allTime: { text: 0, image: 0 }, bySlot: {} });
              localStorage.removeItem(STORAGE_KEY);
            }
          }}
          className="illuminator-button-link"
          style={{ marginTop: '12px', fontSize: '11px' }}
        >
          Clear History
        </button>
      </CostCard>
    </div>
  );
}
