/**
 * EntityDetailsModal - Full entity details viewer with metadata sidebar
 *
 * Opens when clicking on an entity's name or description to show all details.
 * Displays entity metadata, visual traits, and debug request/response.
 */

import { useState, useEffect, useCallback } from 'react';
import type { QueueItem, NetworkDebugInfo, DescriptionChainDebug } from '../lib/enrichmentTypes';

interface EntityEnrichment {
  text?: {
    aliases: string[];
    visualThesis?: string;
    visualTraits: string[];
    generatedAt: number;
    model: string;
    estimatedCost?: number;
    actualCost?: number;
    inputTokens?: number;
    outputTokens?: number;
    debug?: NetworkDebugInfo;
    chainDebug?: DescriptionChainDebug;
  };
  image?: {
    imageId: string;
    generatedAt: number;
    model: string;
  };
}

interface Entity {
  id: string;
  name: string;
  kind: string;
  subtype: string;
  prominence: number;
  culture?: string;
  status: string;
  summary?: string;
  description?: string;
  createdAt?: number;
  updatedAt?: number;
  enrichment?: EntityEnrichment;
}

// Convert numeric prominence to display label
function prominenceLabel(value: number): string {
  if (value < 1) return 'forgotten';
  if (value < 2) return 'marginal';
  if (value < 3) return 'recognized';
  if (value < 4) return 'renowned';
  return 'mythic';
}

interface EntityDetailsModalProps {
  isOpen: boolean;
  entity: Entity | null;
  queue: QueueItem[];
  onClose: () => void;
}

function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return 'Unknown';
  return new Date(timestamp).toLocaleString();
}

function formatCost(cost: number | undefined): string {
  if (!cost) return 'N/A';
  return `$${cost.toFixed(4)}`;
}

function MetadataRow({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;

  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{
        fontSize: '11px',
        color: 'rgba(255, 255, 255, 0.5)',
        marginBottom: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '13px',
        color: 'rgba(255, 255, 255, 0.9)',
        wordBreak: 'break-word',
      }}>
        {value}
      </div>
    </div>
  );
}

function ExpandableSection({
  title,
  content,
  defaultExpanded = false,
  charCount,
}: {
  title: string;
  content: string | undefined;
  defaultExpanded?: boolean;
  charCount?: number;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!content) return null;

  return (
    <div style={{ marginBottom: '12px' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          padding: '8px 10px',
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: '12px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          fontSize: '10px',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
        }}>
          ▶
        </span>
        <span style={{ flex: 1 }}>{title}</span>
        {charCount !== undefined && (
          <span style={{
            fontSize: '10px',
            color: 'rgba(255, 255, 255, 0.4)',
          }}>
            {charCount} chars
          </span>
        )}
      </button>
      {expanded && (
        <div style={{
          marginTop: '8px',
          padding: '10px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '4px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.85)',
          lineHeight: '1.5',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '300px',
          overflowY: 'auto',
        }}>
          {content}
        </div>
      )}
    </div>
  );
}

function VisualTraitsList({ traits }: { traits: string[] }) {
  if (!traits || traits.length === 0) return null;

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{
        fontSize: '11px',
        color: 'rgba(255, 255, 255, 0.5)',
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        Visual Traits
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {traits.map((trait, i) => (
          <span
            key={i}
            style={{
              padding: '4px 10px',
              background: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.9)',
            }}
          >
            {trait}
          </span>
        ))}
      </div>
    </div>
  );
}

function AliasesList({ aliases }: { aliases: string[] }) {
  if (!aliases || aliases.length === 0) return null;

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{
        fontSize: '11px',
        color: 'rgba(255, 255, 255, 0.5)',
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        Aliases
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {aliases.map((alias, i) => (
          <span
            key={i}
            style={{
              padding: '4px 10px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.8)',
            }}
          >
            {alias}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function EntityDetailsModal({
  isOpen,
  entity,
  queue,
  onClose
}: EntityDetailsModalProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Get debug info - prefer chain debug, fall back to legacy debug or queue
  const enrichment = entity?.enrichment;
  const textEnrichment = enrichment?.text;

  // Chain debug (narrative → thesis → traits)
  const chainDebug: DescriptionChainDebug | undefined = textEnrichment?.chainDebug;

  // Legacy single debug (for backwards compat)
  let legacyDebug: NetworkDebugInfo | undefined = textEnrichment?.debug;

  // If no persisted debug, check queue for recent task
  if (!legacyDebug && !chainDebug && entity) {
    const descriptionQueueItem = queue.find(
      (item) => item.entityId === entity.id && item.type === 'description' && item.debug
    );
    legacyDebug = descriptionQueueItem?.debug;
  }

  // Close on escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !entity) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: sidebarOpen ? '400px' : '0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)',
          transition: 'right 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 style={{ margin: 0, color: 'white', fontSize: '18px' }}>{entity.name}</h3>
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '4px' }}>
            {entity.kind}/{entity.subtype} · {prominenceLabel(entity.prominence)}
            {entity.culture && ` · ${entity.culture}`}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '4px',
            color: 'white',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Close (Esc)
        </button>
      </div>

      {/* Main content area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '80px 40px 40px 40px',
          paddingRight: sidebarOpen ? '440px' : '40px',
          transition: 'padding-right 0.2s ease',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ maxWidth: '800px', width: '100%' }}>
          {/* Summary - now on entity directly */}
          {entity?.summary && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Summary
              </div>
              <p style={{
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.9)',
                lineHeight: '1.6',
                margin: 0,
              }}>
                {entity.summary}
              </p>
            </div>
          )}

          {/* Visual Thesis - The primary visual signal */}
          {textEnrichment?.visualThesis && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                fontSize: '11px',
                color: 'rgba(139, 92, 246, 0.8)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Visual Thesis
              </div>
              <p style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.95)',
                lineHeight: '1.6',
                margin: 0,
                padding: '12px 16px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                fontStyle: 'italic',
              }}>
                {textEnrichment.visualThesis}
              </p>
            </div>
          )}

          {/* Full Description - now on entity directly */}
          {entity?.description && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Full Description
              </div>
              <p style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.85)',
                lineHeight: '1.7',
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}>
                {entity.description}
              </p>
            </div>
          )}

          {/* Visual Traits */}
          <VisualTraitsList traits={textEnrichment?.visualTraits || []} />

          {/* Aliases */}
          <AliasesList aliases={textEnrichment?.aliases || []} />

          {/* No enrichment message */}
          {!(entity?.summary || entity?.description) && (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: 'rgba(255, 255, 255, 0.5)',
            }}>
              No description enrichment available. Queue a description task for this entity.
            </div>
          )}
        </div>
      </div>

      {/* Sidebar toggle button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setSidebarOpen(!sidebarOpen);
        }}
        style={{
          position: 'absolute',
          right: sidebarOpen ? '400px' : '0',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRight: sidebarOpen ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '4px 0 0 4px',
          color: 'white',
          padding: '12px 8px',
          cursor: 'pointer',
          fontSize: '12px',
          zIndex: 10,
          transition: 'right 0.2s ease',
        }}
        title={sidebarOpen ? 'Hide metadata' : 'Show metadata'}
      >
        {sidebarOpen ? '>' : '<'}
      </button>

      {/* Metadata Sidebar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: sidebarOpen ? '400px' : '0',
          background: 'rgba(0, 0, 0, 0.85)',
          borderLeft: sidebarOpen ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
          overflow: 'hidden',
          transition: 'width 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          width: '400px',
          height: '100%',
          overflowY: 'auto',
          padding: '60px 20px 20px 20px',
        }}>
          <h4 style={{
            margin: '0 0 20px 0',
            color: 'white',
            fontSize: '14px',
            fontWeight: 500,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            paddingBottom: '12px',
          }}>
            Entity Metadata
          </h4>

          {/* Basic info */}
          <MetadataRow label="Entity ID" value={entity.id} />
          <MetadataRow label="Status" value={entity.status} />
          <MetadataRow label="Created" value={formatDate(entity.createdAt)} />
          <MetadataRow label="Updated" value={formatDate(entity.updatedAt)} />

          {/* Enrichment info */}
          {textEnrichment && (
            <>
              <div style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                margin: '16px 0',
              }} />
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Description Generation
              </div>
              <MetadataRow label="Model" value={textEnrichment.model} />
              <MetadataRow label="Generated" value={formatDate(textEnrichment.generatedAt)} />
              <MetadataRow label="Estimated Cost" value={formatCost(textEnrichment.estimatedCost)} />
              <MetadataRow label="Actual Cost" value={formatCost(textEnrichment.actualCost)} />
              {textEnrichment.inputTokens !== undefined && (
                <MetadataRow
                  label="Tokens"
                  value={`${textEnrichment.inputTokens} in / ${textEnrichment.outputTokens || 0} out`}
                />
              )}
            </>
          )}

          {/* Debug Request/Response - Chain Debug (all 3 steps) */}
          {(chainDebug || legacyDebug) && (
            <>
              <div style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                margin: '16px 0',
              }} />
              <div style={{
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                Debug Info
              </div>

              {/* Chain debug: show all 3 steps */}
              {chainDebug && (
                <>
                  {chainDebug.narrative && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{
                        fontSize: '10px',
                        color: 'rgba(59, 130, 246, 0.8)',
                        marginBottom: '6px',
                        fontWeight: 500,
                      }}>
                        Step 1: Narrative
                      </div>
                      <ExpandableSection
                        title="Request"
                        content={chainDebug.narrative.request}
                        defaultExpanded={false}
                        charCount={chainDebug.narrative.request?.length}
                      />
                      <ExpandableSection
                        title="Response"
                        content={chainDebug.narrative.response}
                        defaultExpanded={false}
                        charCount={chainDebug.narrative.response?.length}
                      />
                    </div>
                  )}

                  {chainDebug.thesis && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{
                        fontSize: '10px',
                        color: 'rgba(139, 92, 246, 0.8)',
                        marginBottom: '6px',
                        fontWeight: 500,
                      }}>
                        Step 2: Visual Thesis
                      </div>
                      <ExpandableSection
                        title="Request"
                        content={chainDebug.thesis.request}
                        defaultExpanded={false}
                        charCount={chainDebug.thesis.request?.length}
                      />
                      <ExpandableSection
                        title="Response"
                        content={chainDebug.thesis.response}
                        defaultExpanded={false}
                        charCount={chainDebug.thesis.response?.length}
                      />
                    </div>
                  )}

                  {chainDebug.traits && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{
                        fontSize: '10px',
                        color: 'rgba(34, 197, 94, 0.8)',
                        marginBottom: '6px',
                        fontWeight: 500,
                      }}>
                        Step 3: Visual Traits
                      </div>
                      <ExpandableSection
                        title="Request"
                        content={chainDebug.traits.request}
                        defaultExpanded={false}
                        charCount={chainDebug.traits.request?.length}
                      />
                      <ExpandableSection
                        title="Response"
                        content={chainDebug.traits.response}
                        defaultExpanded={false}
                        charCount={chainDebug.traits.response?.length}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Legacy debug (single step) */}
              {!chainDebug && legacyDebug && (
                <>
                  <ExpandableSection
                    title="Request"
                    content={legacyDebug.request}
                    defaultExpanded={false}
                    charCount={legacyDebug.request?.length}
                  />
                  <ExpandableSection
                    title="Response"
                    content={legacyDebug.response}
                    defaultExpanded={false}
                    charCount={legacyDebug.response?.length}
                  />
                </>
              )}
            </>
          )}

          {!chainDebug && !legacyDebug && textEnrichment && (
            <div style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.4)',
              fontStyle: 'italic',
              marginTop: '12px',
            }}>
              Debug info not available. This entity may have been enriched before debug persistence was added.
            </div>
          )}
        </div>
      </div>

      {/* Hint at bottom */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 0,
          right: sidebarOpen ? '400px' : '0',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '12px',
          transition: 'right 0.2s ease',
        }}
      >
        Click anywhere or press Escape to close
      </div>
    </div>
  );
}
