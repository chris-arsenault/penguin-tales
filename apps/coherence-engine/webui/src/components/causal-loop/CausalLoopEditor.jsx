/**
 * CausalLoopEditor - Visualizes causal relationships between pressures, generators, systems
 *
 * Uses react-force-graph-2d for interactive zoom/pan and force-directed layout.
 * Shows nodes (pressures/generators/systems/entity-kinds) and edges with polarity (+/-).
 */

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

// Node type configurations
const NODE_TYPES = {
  pressure: { color: '#f59e0b', label: 'Pressure', val: 8 },
  generator: { color: '#22c55e', label: 'Generator', val: 6 },
  system: { color: '#8b5cf6', label: 'System', val: 6 },
  action: { color: '#06b6d4', label: 'Action', val: 5 },
  entityKind: { color: '#60a5fa', label: 'Entity Kind', val: 4 },
};

const EDGE_COLORS = {
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#6b7280',
};

/**
 * Extract all causal nodes and edges from config data
 */
function extractCausalGraph(pressures, generators, systems, actions, schema) {
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();

  // Helper to add node if not exists
  const addNode = (id, type, label, data = {}) => {
    if (!nodeMap.has(id)) {
      const config = NODE_TYPES[type] || NODE_TYPES.entityKind;
      const node = {
        id,
        type,
        label,
        data,
        color: config.color,
        val: config.val,
      };
      nodes.push(node);
      nodeMap.set(id, node);
    }
    return nodeMap.get(id);
  };

  // 1. Add pressure nodes
  pressures.forEach(p => {
    addNode(`pressure:${p.id}`, 'pressure', p.name || p.id, { pressure: p });
  });

  // 2. Add generator nodes and their edges to pressures
  generators.forEach(g => {
    const gId = g.id || g.config?.id;
    const gName = g.name || g.config?.name || gId;
    addNode(`generator:${gId}`, 'generator', gName, { generator: g });

    // Direct pressure modifications via stateUpdates
    const stateUpdates = g.stateUpdates || [];
    stateUpdates.forEach(update => {
      if (update.type === 'modify_pressure' && update.pressureId) {
        const polarity = (update.delta || 0) >= 0 ? 'positive' : 'negative';
        edges.push({
          source: `generator:${gId}`,
          target: `pressure:${update.pressureId}`,
          polarity,
          label: update.delta > 0 ? `+${update.delta}` : `${update.delta}`,
          edgeType: 'direct',
        });
      }
    });

    // Indirect: generator creates entities that affect pressure factors
    const createsKind = g.entityKind || g.config?.entityKind;
    if (createsKind) {
      addNode(`entityKind:${createsKind}`, 'entityKind', createsKind);
      edges.push({
        source: `generator:${gId}`,
        target: `entityKind:${createsKind}`,
        polarity: 'positive',
        label: 'creates',
        edgeType: 'creates',
      });
    }
  });

  // 3. Add system nodes and their edges
  systems.forEach(s => {
    const sId = s.config?.id || s.id;
    const sName = s.config?.name || s.name || sId;
    addNode(`system:${sId}`, 'system', sName, { system: s });

    // Pressure changes from systems
    const pressureChanges = s.pressureChanges || s.config?.pressureChanges || {};
    Object.entries(pressureChanges).forEach(([pressureId, delta]) => {
      if (typeof delta === 'number') {
        const polarity = delta >= 0 ? 'positive' : 'negative';
        edges.push({
          source: `system:${sId}`,
          target: `pressure:${pressureId}`,
          polarity,
          label: delta > 0 ? `+${delta}` : `${delta}`,
          edgeType: 'direct',
        });
      }
    });
  });

  // 4. Add action nodes
  actions.forEach(a => {
    const aId = a.id || a.config?.id;
    const aName = a.name || a.config?.name || aId;
    addNode(`action:${aId}`, 'action', aName, { action: a });

    // Action outcome pressure changes
    const pressureChanges = a.outcome?.pressureChanges || {};
    Object.entries(pressureChanges).forEach(([pressureId, delta]) => {
      if (typeof delta === 'number') {
        const polarity = delta >= 0 ? 'positive' : 'negative';
        edges.push({
          source: `action:${aId}`,
          target: `pressure:${pressureId}`,
          polarity,
          label: delta > 0 ? `+${delta}` : `${delta}`,
          edgeType: 'direct',
        });
      }
    });
  });

  // 5. Pressure feedback loops - entity counts affect pressures
  pressures.forEach(p => {
    const growth = p.growth || {};
    const feedback = [
      ...(growth.positiveFeedback || []).map(f => ({ ...f, polarity: 'positive' })),
      ...(growth.negativeFeedback || []).map(f => ({ ...f, polarity: 'negative' })),
    ];

    feedback.forEach(factor => {
      if (factor.type === 'entity_count' && factor.kind) {
        const entityId = `entityKind:${factor.kind}`;
        addNode(entityId, 'entityKind', factor.kind);
        edges.push({
          source: entityId,
          target: `pressure:${p.id}`,
          polarity: factor.polarity,
          label: factor.polarity === 'positive' ? '+' : '-',
          edgeType: 'feedback',
        });
      }
    });
  });

  // 6. Pressure thresholds trigger generators/systems via era weights
  pressures.forEach(p => {
    const triggers = p.triggers || [];
    triggers.forEach(trigger => {
      if (trigger.activates) {
        const targetId = trigger.activates.startsWith('generator:')
          ? trigger.activates
          : `generator:${trigger.activates}`;
        if (nodeMap.has(targetId)) {
          edges.push({
            source: `pressure:${p.id}`,
            target: targetId,
            polarity: 'positive',
            label: `>${trigger.threshold}`,
            edgeType: 'trigger',
          });
        }
      }
    });
  });

  return { nodes, links: edges };
}

/**
 * Detect loops in the graph using DFS
 */
function detectLoops(nodes, links) {
  const adjacency = new Map();
  nodes.forEach(n => adjacency.set(n.id, []));
  links.forEach(e => {
    const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
    const adj = adjacency.get(sourceId);
    if (adj) adj.push({ target: typeof e.target === 'object' ? e.target.id : e.target, edge: e });
  });

  const loops = [];
  const visited = new Set();
  const path = [];
  const pathSet = new Set();

  function dfs(nodeId) {
    if (pathSet.has(nodeId)) {
      const loopStart = path.indexOf(nodeId);
      const loop = path.slice(loopStart);
      loop.push(nodeId);
      loops.push(loop);
      return;
    }
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    path.push(nodeId);
    pathSet.add(nodeId);

    const neighbors = adjacency.get(nodeId) || [];
    for (const { target } of neighbors) {
      dfs(target);
    }

    path.pop();
    pathSet.delete(nodeId);
  }

  nodes.forEach(n => {
    if (!visited.has(n.id)) {
      dfs(n.id);
    }
  });

  return loops.map(loop => {
    let negativeCount = 0;
    for (let i = 0; i < loop.length - 1; i++) {
      const edge = links.find(e => {
        const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
        const targetId = typeof e.target === 'object' ? e.target.id : e.target;
        return sourceId === loop[i] && targetId === loop[i + 1];
      });
      if (edge?.polarity === 'negative') negativeCount++;
    }
    const type = negativeCount % 2 === 0 ? 'reinforcing' : 'balancing';
    return { nodes: loop, type };
  });
}

export default function CausalLoopEditor({
  pressures = [],
  generators = [],
  systems = [],
  actions = [],
  schema = {}
}) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [showLegend, setShowLegend] = useState(true);
  const [hoverNode, setHoverNode] = useState(null);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({
        width: rect.width || 800,
        height: Math.max(500, window.innerHeight - rect.top - 100),
      });
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    window.addEventListener('resize', updateDimensions);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  // Extract graph data
  const graphData = useMemo(
    () => extractCausalGraph(pressures, generators, systems, actions, schema),
    [pressures, generators, systems, actions, schema]
  );

  // Detect loops
  const loops = useMemo(() => detectLoops(graphData.nodes, graphData.links), [graphData]);

  const reinforcingLoops = loops.filter(l => l.type === 'reinforcing');
  const balancingLoops = loops.filter(l => l.type === 'balancing');

  // Node styling
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const label = node.label;
    const fontSize = Math.max(12 / globalScale, 4);
    const nodeRadius = Math.sqrt(node.val) * 4;

    // Draw node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
    ctx.fillStyle = node.color;
    ctx.fill();

    // Highlight selected/hovered
    if (selectedNode === node.id || hoverNode === node.id) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // Draw label below node
    ctx.font = `${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#e2e8f0';
    const maxWidth = 100 / globalScale;
    const displayLabel = label.length > 20 ? label.slice(0, 18) + '...' : label;
    ctx.fillText(displayLabel, node.x, node.y + nodeRadius + 2);
  }, [selectedNode, hoverNode]);

  // Link styling
  const linkColor = useCallback((link) => {
    return EDGE_COLORS[link.polarity] || EDGE_COLORS.neutral;
  }, []);

  const linkWidth = useCallback((link) => {
    return link.edgeType === 'feedback' ? 1 : 2;
  }, []);

  const linkLineDash = useCallback((link) => {
    return link.edgeType === 'feedback' ? [4, 4] : [];
  }, []);

  // Handle node click
  const handleNodeClick = useCallback((node) => {
    setSelectedNode(selectedNode === node.id ? null : node.id);
  }, [selectedNode]);

  // Zoom to fit on load
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      setTimeout(() => {
        graphRef.current.zoomToFit(400, 60);
      }, 500);
    }
  }, [graphData.nodes.length]);

  const selectedNodeData = selectedNode
    ? graphData.nodes.find(n => n.id === selectedNode)
    : null;

  // Get edges for selected node
  const selectedNodeEdges = useMemo(() => {
    if (!selectedNode) return { incoming: [], outgoing: [] };
    return {
      incoming: graphData.links.filter(l => {
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        return targetId === selectedNode;
      }),
      outgoing: graphData.links.filter(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        return sourceId === selectedNode;
      }),
    };
  }, [selectedNode, graphData.links]);

  return (
    <div className="editor-container">
      <div className="header">
        <h1 className="title">Causal Loop Diagram</h1>
        <p className="subtitle">
          Visualize feedback loops between pressures, generators, systems, and entity kinds.
          {loops.length > 0 && (
            <span style={{ marginLeft: '8px' }}>
              <span style={{ color: '#ef4444' }}>{reinforcingLoops.length} reinforcing</span>
              {' / '}
              <span style={{ color: '#3b82f6' }}>{balancingLoops.length} balancing</span>
              {' loops detected'}
            </span>
          )}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          className="button-secondary"
          onClick={() => setShowLegend(!showLegend)}
        >
          {showLegend ? 'Hide' : 'Show'} Legend
        </button>
        <button
          className="button-secondary"
          onClick={() => graphRef.current?.zoomToFit(400, 60)}
        >
          Fit to View
        </button>
        <div style={{ color: '#93c5fd', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>{graphData.nodes.length} nodes</span>
          <span>{graphData.links.length} edges</span>
          <span style={{ color: '#6b7280' }}>Scroll to zoom, drag to pan</span>
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div style={{
          display: 'flex',
          gap: '24px',
          padding: '12px 16px',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ color: '#93c5fd', fontSize: '12px', fontWeight: 500 }}>Nodes:</span>
            {Object.entries(NODE_TYPES).map(([type, config]) => (
              <span key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                <span style={{
                  width: '12px',
                  height: '12px',
                  backgroundColor: config.color,
                  borderRadius: '50%',
                }} />
                <span style={{ color: '#e2e8f0' }}>{config.label}</span>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ color: '#93c5fd', fontSize: '12px', fontWeight: 500 }}>Edges:</span>
            <span style={{ color: EDGE_COLORS.positive, fontSize: '11px' }}>+ Positive</span>
            <span style={{ color: EDGE_COLORS.negative, fontSize: '11px' }}>- Negative</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ color: '#93c5fd', fontSize: '12px', fontWeight: 500 }}>Loops:</span>
            <span style={{ color: '#ef4444', fontSize: '11px' }}>Reinforcing (unstable)</span>
            <span style={{ color: '#3b82f6', fontSize: '11px' }}>Balancing (stable)</span>
          </div>
        </div>
      )}

      {/* Graph container */}
      <div
        ref={containerRef}
        style={{
          backgroundColor: '#0f172a',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          overflow: 'hidden',
        }}
      >
        {graphData.nodes.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '400px',
            color: '#93c5fd',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>&#128260;</div>
            <div style={{ fontSize: '16px', fontWeight: 500, color: '#fff', marginBottom: '8px' }}>
              No causal relationships found
            </div>
            <div style={{ fontSize: '13px', maxWidth: '400px', textAlign: 'center' }}>
              Add pressures with feedback factors, generators with state updates,
              or systems with pressure changes to see the causal loop diagram.
            </div>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#0f172a"
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={(node, color, ctx) => {
              const nodeRadius = Math.sqrt(node.val) * 4;
              ctx.beginPath();
              ctx.arc(node.x, node.y, nodeRadius + 5, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            linkColor={linkColor}
            linkWidth={linkWidth}
            linkLineDash={linkLineDash}
            linkDirectionalArrowLength={6}
            linkDirectionalArrowRelPos={0.9}
            linkCurvature={0.2}
            onNodeClick={handleNodeClick}
            onNodeHover={node => setHoverNode(node?.id || null)}
            cooldownTicks={100}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            d3AlphaMin={0.001}
            warmupTicks={50}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            // Increase spacing between nodes
            linkDistance={120}
            d3Force={(forceName, force) => {
              if (forceName === 'charge') {
                force.strength(-300); // Stronger repulsion
              }
              if (forceName === 'link') {
                force.distance(120); // Longer links
              }
            }}
          />
        )}
      </div>

      {/* Selected node details */}
      {selectedNodeData && (
        <div style={{
          marginTop: '16px',
          padding: '16px',
          backgroundColor: 'rgba(15, 23, 42, 0.8)',
          borderRadius: '8px',
          border: `2px solid ${selectedNodeData.color}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{
              padding: '2px 8px',
              backgroundColor: selectedNodeData.color,
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#0a1929',
            }}>
              {NODE_TYPES[selectedNodeData.type]?.label}
            </span>
            <span style={{ color: '#fff', fontWeight: 500 }}>{selectedNodeData.label}</span>
            <button
              onClick={() => setSelectedNode(null)}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: '#93c5fd',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', gap: '24px' }}>
            {/* Incoming edges */}
            <div style={{ flex: 1 }}>
              <span style={{ color: '#93c5fd', fontSize: '12px', fontWeight: 500 }}>
                Incoming ({selectedNodeEdges.incoming.length})
              </span>
              <div style={{ paddingLeft: '8px', fontSize: '12px', color: '#e2e8f0', marginTop: '4px' }}>
                {selectedNodeEdges.incoming.map((e, i) => {
                  const sourceId = typeof e.source === 'object' ? e.source.id : e.source;
                  const sourceNode = graphData.nodes.find(n => n.id === sourceId);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <span style={{ color: EDGE_COLORS[e.polarity] }}>
                        {e.polarity === 'positive' ? '+' : '-'}
                      </span>
                      <span>{sourceNode?.label || sourceId}</span>
                    </div>
                  );
                })}
                {selectedNodeEdges.incoming.length === 0 && (
                  <span style={{ color: '#6b7280' }}>none</span>
                )}
              </div>
            </div>

            {/* Outgoing edges */}
            <div style={{ flex: 1 }}>
              <span style={{ color: '#93c5fd', fontSize: '12px', fontWeight: 500 }}>
                Outgoing ({selectedNodeEdges.outgoing.length})
              </span>
              <div style={{ paddingLeft: '8px', fontSize: '12px', color: '#e2e8f0', marginTop: '4px' }}>
                {selectedNodeEdges.outgoing.map((e, i) => {
                  const targetId = typeof e.target === 'object' ? e.target.id : e.target;
                  const targetNode = graphData.nodes.find(n => n.id === targetId);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <span style={{ color: EDGE_COLORS[e.polarity] }}>
                        {e.polarity === 'positive' ? '+' : '-'}
                      </span>
                      <span>{targetNode?.label || targetId}</span>
                    </div>
                  );
                })}
                {selectedNodeEdges.outgoing.length === 0 && (
                  <span style={{ color: '#6b7280' }}>none</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loop summary */}
      {loops.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h3 style={{ color: '#fff', fontSize: '14px', marginBottom: '8px' }}>Detected Loops</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loops.slice(0, 5).map((loop, i) => (
              <div
                key={i}
                style={{
                  padding: '8px 12px',
                  backgroundColor: loop.type === 'reinforcing' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                  border: `1px solid ${loop.type === 'reinforcing' ? '#ef4444' : '#3b82f6'}`,
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              >
                <span style={{
                  color: loop.type === 'reinforcing' ? '#ef4444' : '#3b82f6',
                  fontWeight: 600,
                  marginRight: '8px',
                }}>
                  {loop.type === 'reinforcing' ? '++ Reinforcing' : '+- Balancing'}
                </span>
                <span style={{ color: '#e2e8f0' }}>
                  {loop.nodes.slice(0, -1).map(id => {
                    const node = graphData.nodes.find(n => n.id === id);
                    return node?.label || id.split(':')[1];
                  }).join(' -> ')}
                </span>
              </div>
            ))}
            {loops.length > 5 && (
              <div style={{ color: '#93c5fd', fontSize: '12px' }}>
                ...and {loops.length - 5} more loops
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { CausalLoopEditor };
