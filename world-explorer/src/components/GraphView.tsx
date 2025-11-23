import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import type { Core, NodeSingular } from 'cytoscape';
// @ts-ignore
import coseBilkent from 'cytoscape-cose-bilkent';
import type { WorldState } from '../types/world.ts';
import { transformWorldData } from '../utils/dataTransform.ts';

cytoscape.use(coseBilkent);

interface GraphViewProps {
  data: WorldState;
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string | undefined) => void;
}

export default function GraphView({ data, selectedNodeId, onNodeSelect }: GraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const isInitializedRef = useRef(false);

  const handleRecalculateLayout = () => {
    if (!cyRef.current) return;

    const layout = cyRef.current.layout({
      name: 'cose-bilkent',
      randomize: true,  // Add jitter to break out of local minima
      fit: true,
      idealEdgeLength: 100,
      // Non-linear edge strength → spring length mapping for dramatic clustering
      edgeLength: (edge: any) => {
        const strength = edge.data('strength') ?? 0.5;
        // Non-linear scaling: emphasizes extremes away from 0.5
        // strength 1.0 → 25px (extremely tight clustering)
        // strength 0.7 → 70px (moderate clustering)
        // strength 0.5 → 130px (neutral)
        // strength 0.3 → 230px (loose)
        // strength 0.0 → 400px (very loose, almost disconnected)
        const invStrength = 1 - strength;
        return 25 + Math.pow(invStrength, 1.8) * 375;
      },
      nodeRepulsion: 100000,
      gravity: 0.25,
      numIter: 2500,
      tile: true,
      tilingPaddingVertical: 10,
      tilingPaddingHorizontal: 10,
      animate: true,
      animationDuration: 1000
    } as any);

    layout.run();
  };

  // Initialize graph once
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(name)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': '10px',
            'color': '#fff',
            'text-outline-color': '#000',
            'text-outline-width': 2,
            'width': 'mapData(prominence, 0, 4, 20, 60)',
            'height': 'mapData(prominence, 0, 4, 20, 60)',
            'background-color': '#666'
          }
        },
        {
          selector: 'node[kind="npc"]',
          style: { 'background-color': '#6FB1FC', 'shape': 'ellipse' }
        },
        {
          selector: 'node[kind="faction"]',
          style: { 'background-color': '#FC6B6B', 'shape': 'diamond' }
        },
        {
          selector: 'node[kind="location"]',
          style: { 'background-color': '#6BFC9C', 'shape': 'hexagon' }
        },
        {
          selector: 'node[kind="rules"]',
          style: { 'background-color': '#FCA86B', 'shape': 'rectangle' }
        },
        {
          selector: 'node[kind="abilities"]',
          style: { 'background-color': '#C76BFC', 'shape': 'star' }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#FFD700',
            'background-color': '#FFD700'
          }
        },
        {
          // Edge strength visualization: strength values (0-1) control visual prominence
          // MORE DRAMATIC: wider range for better visual distinction
          // - Width: 0.5-7px (stronger = much thicker)
          // - Color: very light gray to black (stronger = much darker)
          // - Opacity: 0.2-1.0 (stronger = fully opaque, weak = nearly invisible)
          selector: 'edge',
          style: {
            'width': 'mapData(strength, 0, 1, 0.5, 7)',
            'line-color': 'mapData(strength, 0, 1, #aaa, #000)',
            'target-arrow-color': 'mapData(strength, 0, 1, #aaa, #000)',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 'mapData(strength, 0, 1, 0.2, 1)',
            'label': 'data(label)',
            'font-size': '8px',
            'color': '#999',
            'text-rotation': 'autorotate',
            'text-margin-y': -10
          }
        },
        {
          selector: 'edge.highlighted',
          style: {
            'line-color': '#FFD700',
            'target-arrow-color': '#FFD700',
            'width': 3
          }
        }
      ],
      layout: {
        name: 'cose-bilkent',
        randomize: true,
        idealEdgeLength: 100,
        edgeLength: (edge: any) => {
          const strength = edge.data('strength') ?? 0.5;
          const invStrength = 1 - strength;
          return 25 + Math.pow(invStrength, 1.8) * 375;
        },
        nodeRepulsion: 100000,
        gravity: 0.25,
        numIter: 2500,
        tile: true,
        tilingPaddingVertical: 10,
        tilingPaddingHorizontal: 10
      } as any,
      wheelSensitivity: 1.5
    });

    // Handle node click
    cy.on('tap', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      onNodeSelect(node.id());
    });

    // Handle background click (deselect)
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        onNodeSelect(undefined);
      }
    });

    cyRef.current = cy;
    isInitializedRef.current = true;

    return () => {
      cy.destroy();
      isInitializedRef.current = false;
    };
  }, []);

  // Update graph data incrementally when data changes
  useEffect(() => {
    if (!cyRef.current) return;

    const cy = cyRef.current;
    const newElements = transformWorldData(data);

    // Get current element IDs
    const currentNodeIds = new Set(cy.nodes().map(n => n.id()));
    const currentEdgeIds = new Set(cy.edges().map(e => e.id()));

    // Get new element IDs
    const newNodes = newElements.filter(e => !('source' in e.data));
    const newEdges = newElements.filter(e => 'source' in e.data);
    const newNodeIds = new Set(newNodes.map(n => n.data.id));
    const newEdgeIds = new Set(newEdges.map(e => e.data.id));

    // Remove elements that no longer exist
    cy.nodes().forEach(node => {
      if (!newNodeIds.has(node.id())) {
        cy.remove(node);
      }
    });
    cy.edges().forEach(edge => {
      if (!newEdgeIds.has(edge.id())) {
        cy.remove(edge);
      }
    });

    // Add new elements
    const elementsToAdd = newElements.filter(e => {
      const id = e.data.id;
      if ('source' in e.data) {
        return !currentEdgeIds.has(id);
      } else {
        return !currentNodeIds.has(id);
      }
    });

    if (elementsToAdd.length > 0) {
      cy.add(elementsToAdd);

      // Run layout only on new nodes, don't fit viewport
      const layout = cy.layout({
        name: 'cose-bilkent',
        randomize: false,
        fit: false,
        idealEdgeLength: 100,
        edgeLength: (edge: any) => {
          const strength = edge.data('strength') ?? 0.5;
          const invStrength = 1 - strength;
          return 25 + Math.pow(invStrength, 1.8) * 375;
        },
        nodeRepulsion: 100000,
        gravity: 0.25,
        numIter: 1000,
        tile: true,
        tilingPaddingVertical: 10,
        tilingPaddingHorizontal: 10,
        animate: false
      } as any);

      layout.run();
    }
  }, [data]);

  // Handle selection changes from outside
  useEffect(() => {
    if (!cyRef.current) return;

    cyRef.current.nodes().removeClass('highlighted');
    cyRef.current.edges().removeClass('highlighted');

    if (selectedNodeId) {
      const selectedNode = cyRef.current.getElementById(selectedNodeId);
      if (selectedNode.length > 0) {
        selectedNode.select();

        // Highlight connected edges
        const connectedEdges = selectedNode.connectedEdges();
        connectedEdges.addClass('highlighted');

        // Gently pan to selected node if it's off-screen (no zoom change)
        const renderedPos = selectedNode.renderedPosition();
        const containerWidth = cyRef.current.width();
        const containerHeight = cyRef.current.height();

        // Check if node is outside viewport
        const margin = 100;
        if (
          renderedPos.x < margin ||
          renderedPos.x > containerWidth - margin ||
          renderedPos.y < margin ||
          renderedPos.y > containerHeight - margin
        ) {
          // Only pan to bring into view, don't zoom
          cyRef.current.animate({
            center: {
              eles: selectedNode
            }
          }, {
            duration: 300
          });
        }
      }
    } else {
      cyRef.current.nodes().unselect();
    }
  }, [selectedNodeId]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="cytoscape-container" />

      {/* Legend */}
      <div className="absolute bottom-6 left-6 rounded-xl text-white text-sm shadow-2xl border border-blue-500/30 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.95) 0%, rgba(10, 25, 41, 0.95) 100%)' }}>
        <div className="px-5 py-3 border-b border-blue-500/20" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
          <div className="font-bold text-blue-200 uppercase tracking-wider text-xs">Legend</div>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full shadow-lg flex-shrink-0" style={{ backgroundColor: '#6FB1FC' }}></div>
            <span className="font-medium">NPCs</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 shadow-lg flex-shrink-0" style={{
              backgroundColor: '#FC6B6B',
              transform: 'rotate(45deg)'
            }}></div>
            <span className="font-medium">Factions</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 shadow-lg flex-shrink-0" style={{
              backgroundColor: '#6BFC9C',
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
            }}></div>
            <span className="font-medium">Locations</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 shadow-lg flex-shrink-0" style={{ backgroundColor: '#FCA86B' }}></div>
            <span className="font-medium">Rules</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 shadow-lg flex-shrink-0" style={{
              backgroundColor: '#C76BFC',
              clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)'
            }}></div>
            <span className="font-medium">Abilities</span>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-blue-500/20" style={{ background: 'rgba(59, 130, 246, 0.05)' }}>
          <div className="text-xs text-blue-300 italic">Size indicates prominence</div>
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute top-6 left-6 rounded-xl text-white text-xs shadow-2xl border border-blue-500/30 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.95) 0%, rgba(10, 25, 41, 0.95) 100%)' }}>
        <div className="px-5 py-3 border-b border-blue-500/20" style={{ background: 'rgba(59, 130, 246, 0.1)' }}>
          <div className="font-bold text-blue-200 uppercase tracking-wider">Controls</div>
        </div>
        <div className="px-5 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">🖱️</span>
            <span className="font-medium">Click to select</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">🔍</span>
            <span className="font-medium">Scroll to zoom</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">✋</span>
            <span className="font-medium">Drag to pan</span>
          </div>
        </div>
      </div>

      {/* Recalculate Layout Button */}
      <button
        onClick={handleRecalculateLayout}
        className="px-4 py-2 rounded-lg text-white text-sm font-semibold shadow-2xl border border-blue-500/50 transition-all hover:scale-105"
        style={{
          position: 'absolute',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(37, 99, 235, 0.95) 100%)',
          zIndex: 1000
        }}
        title="Recalculate graph layout"
      >
        <span style={{ fontSize: '16px', marginRight: '8px' }}>♻️</span>
        Recalculate Layout
      </button>
    </div>
  );
}
