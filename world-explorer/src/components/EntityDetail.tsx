import { useState } from 'react';
import type { WorldState, LoreData, DescriptionLore, RelationshipBackstoryLore, ChainLinkLore, DiscoveryEventLore } from '../types/world.ts';
import { getEntityById, getRelatedEntities, getRelationships } from '../utils/dataTransform.ts';
import LoreSection from './LoreSection.tsx';
import RelationshipStoryModal from './RelationshipStoryModal.tsx';
import ChainLinkSection from './ChainLinkSection.tsx';
import DiscoveryStory from './DiscoveryStory.tsx';
import './EntityDetail.css';

interface EntityDetailProps {
  entityId?: string;
  worldData: WorldState;
  loreData: LoreData | null;
  onRelatedClick: (entityId: string) => void;
}

export default function EntityDetail({ entityId, worldData, loreData, onRelatedClick }: EntityDetailProps) {
  // Hooks must be called before any early returns
  const [selectedRelationshipLore, setSelectedRelationshipLore] = useState<RelationshipBackstoryLore | null>(null);
  const [expandedOutgoing, setExpandedOutgoing] = useState<Set<string>>(new Set());
  const [expandedIncoming, setExpandedIncoming] = useState<Set<string>>(new Set());

  if (!entityId) {
    return (
      <div className="entity-detail empty">
        <div className="text-center">
          <div className="text-5xl mb-4" style={{ filter: 'drop-shadow(0 0 20px rgba(59, 130, 246, 0.4))' }}>👈</div>
          <div className="text-blue-300 font-medium">Select a node to view details</div>
        </div>
      </div>
    );
  }

  const entity = getEntityById(worldData, entityId);

  if (!entity) {
    return (
      <div className="entity-detail">
        <div className="text-red-400 font-medium">Entity not found</div>
      </div>
    );
  }

  const relatedEntities = getRelatedEntities(worldData, entityId);
  const relationships = getRelationships(worldData, entityId);

  // Find lore for this entity
  const descriptionLore = loreData?.records.find(
    record => record.type === 'description' && record.targetId === entityId
  ) as DescriptionLore | undefined;

  const chainLinkLore = loreData?.records.find(
    record => record.type === 'chain_link' && record.targetId === entityId
  ) as ChainLinkLore | undefined;

  const discoveryEventLore = loreData?.records.find(
    record => record.type === 'discovery_event' && record.targetId === entityId
  ) as DiscoveryEventLore | undefined;

  // Helper to find relationship lore
  const findRelationshipLore = (srcId: string, dstId: string, kind: string): RelationshipBackstoryLore | undefined => {
    return loreData?.records.find(
      record => {
        if (record.type !== 'relationship_backstory') return false;
        const relLore = record as RelationshipBackstoryLore;
        return relLore.relationship.src === srcId &&
               relLore.relationship.dst === dstId &&
               relLore.relationship.kind === kind;
      }
    ) as RelationshipBackstoryLore | undefined;
  };

  const outgoingRels = relationships.filter(r => r.src === entityId);
  const incomingRels = relationships.filter(r => r.dst === entityId);

  const getRelatedEntity = (relId: string) => getEntityById(worldData, relId);

  // Group relationships by kind
  const groupByKind = (rels: typeof relationships) => {
    const groups = new Map<string, typeof relationships>();
    rels.forEach(rel => {
      const kind = rel.kind;
      if (!groups.has(kind)) {
        groups.set(kind, []);
      }
      groups.get(kind)!.push(rel);
    });
    return groups;
  };

  const outgoingGroups = groupByKind(outgoingRels);
  const incomingGroups = groupByKind(incomingRels);

  const toggleOutgoing = (kind: string) => {
    const newExpanded = new Set(expandedOutgoing);
    if (newExpanded.has(kind)) {
      newExpanded.delete(kind);
    } else {
      newExpanded.add(kind);
    }
    setExpandedOutgoing(newExpanded);
  };

  const toggleIncoming = (kind: string) => {
    const newExpanded = new Set(expandedIncoming);
    if (newExpanded.has(kind)) {
      newExpanded.delete(kind);
    } else {
      newExpanded.add(kind);
    }
    setExpandedIncoming(newExpanded);
  };

  return (
    <div className="entity-detail">
      {/* Header */}
      <div className="mb-6 pb-6 border-b border-blue-500/20">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-2xl font-bold leading-tight flex-1 break-words"
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #93c5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
            {entity.name}
          </h2>
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-lg flex-shrink-0 ${
            entity.prominence === 'mythic' ? 'bg-purple-600 text-purple-100' :
            entity.prominence === 'renowned' ? 'bg-blue-600 text-blue-100' :
            entity.prominence === 'recognized' ? 'bg-green-600 text-green-100' :
            entity.prominence === 'marginal' ? 'bg-yellow-600 text-yellow-100' :
            'bg-gray-600 text-gray-100'
          }`}>
            {entity.prominence}
          </span>
        </div>
        <div className="flex gap-3 text-sm flex-wrap">
          <span className="capitalize font-medium text-blue-300">{entity.kind}</span>
          <span className="text-blue-500">•</span>
          <span className="capitalize text-blue-200">{entity.subtype}</span>
        </div>
      </div>

      {/* Description or Lore */}
      {descriptionLore ? (
        <LoreSection lore={descriptionLore} />
      ) : (
        <div className="detail-card">
          <div className="section-header">Description</div>
          <p className="text-sm text-blue-100 leading-relaxed break-words detail-card-content">
            {entity.description}
          </p>
        </div>
      )}

      {/* Chain Link */}
      {chainLinkLore && <ChainLinkSection lore={chainLinkLore} />}

      {/* Discovery Story */}
      {discoveryEventLore && (
        <DiscoveryStory
          lore={discoveryEventLore}
          onExplorerClick={onRelatedClick}
        />
      )}

      {/* Status */}
      <div className="mb-6">
        <div className="section-header">Status</div>
        <div className="detail-card">
          <div className="text-sm font-medium capitalize text-white break-words">
            {entity.status}
          </div>
        </div>
      </div>

      {/* Tags */}
      {entity.tags.length > 0 && (
        <div className="mb-6">
          <div className="section-header">Tags</div>
          <div className="tags-container">
            {entity.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="detail-card">
        <div className="section-header">Timeline</div>
        <div className="detail-card-content">
          <div className="timeline-row">
            <span className="text-blue-400">Created:</span>
            <span className="text-white font-semibold">Tick {entity.createdAt}</span>
          </div>
          <div className="timeline-row">
            <span className="text-blue-400">Updated:</span>
            <span className="text-white font-semibold">Tick {entity.updatedAt}</span>
          </div>
        </div>
      </div>

      {/* Outgoing Relationships */}
      {outgoingRels.length > 0 && (
        <div className="mb-6">
          <div className="section-header">
            Relationships ({outgoingRels.length})
          </div>
          <div className="accordion-container">
            {Array.from(outgoingGroups.entries()).map(([kind, rels]) => {
              const isExpanded = expandedOutgoing.has(kind);
              return (
                <div key={kind} className="accordion-item">
                  <button onClick={() => toggleOutgoing(kind)} className="accordion-header">
                    <div className="accordion-header-left">
                      <span className="accordion-icon">{isExpanded ? '−' : '+'}</span>
                      <span className="accordion-title">{kind.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="accordion-badge">{rels.length}</span>
                  </button>
                  {isExpanded && (
                    <div className="accordion-content">
                      {rels.map((rel, i) => {
                        const target = getRelatedEntity(rel.dst);
                        const relLore = findRelationshipLore(rel.src, rel.dst, rel.kind);
                        return target ? (
                          <div key={i} className={`accordion-row ${i % 2 === 0 ? 'even' : 'odd'}`}>
                            <button
                              onClick={() => onRelatedClick(target.id)}
                              className="accordion-row-button"
                            >
                              <div className="accordion-row-name">{target.name}</div>
                              <div className="accordion-row-kind">({target.kind})</div>
                            </button>
                            {relLore && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRelationshipLore(relLore);
                                }}
                                className="lore-indicator"
                                title="View relationship story"
                              >
                                📜
                              </button>
                            )}
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Incoming Relationships */}
      {incomingRels.length > 0 && (
        <div className="mb-6">
          <div className="section-header">
            Referenced By ({incomingRels.length})
          </div>
          <div className="accordion-container">
            {Array.from(incomingGroups.entries()).map(([kind, rels]) => {
              const isExpanded = expandedIncoming.has(kind);
              return (
                <div key={kind} className="accordion-item incoming">
                  <button onClick={() => toggleIncoming(kind)} className="accordion-header">
                    <div className="accordion-header-left">
                      <span className="accordion-icon">{isExpanded ? '−' : '+'}</span>
                      <span className="accordion-title">{kind.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="accordion-badge">{rels.length}</span>
                  </button>
                  {isExpanded && (
                    <div className="accordion-content">
                      {rels.map((rel, i) => {
                        const source = getRelatedEntity(rel.src);
                        const relLore = findRelationshipLore(rel.src, rel.dst, rel.kind);
                        return source ? (
                          <div key={i} className={`accordion-row ${i % 2 === 0 ? 'even' : 'odd'}`}>
                            <button
                              onClick={() => onRelatedClick(source.id)}
                              className="accordion-row-button"
                            >
                              <div className="accordion-row-name">{source.name}</div>
                              <div className="accordion-row-kind">({source.kind})</div>
                            </button>
                            {relLore && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRelationshipLore(relLore);
                                }}
                                className="lore-indicator"
                                title="View relationship story"
                              >
                                📜
                              </button>
                            )}
                          </div>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Connection Summary */}
      <div className="pt-6 border-t border-blue-500/20">
        <div className="section-header">Connection Summary</div>
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">Connections</div>
            <div className="summary-value">{relationships.length}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Entities</div>
            <div className="summary-value">{relatedEntities.length}</div>
          </div>
        </div>
      </div>

      {/* Relationship Story Modal */}
      {selectedRelationshipLore && (
        <RelationshipStoryModal
          lore={selectedRelationshipLore}
          worldData={worldData}
          onClose={() => setSelectedRelationshipLore(null)}
        />
      )}
    </div>
  );
}
