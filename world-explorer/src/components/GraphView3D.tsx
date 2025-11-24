import { useEffect, useRef, useCallback, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import type { WorldState } from '../types/world.ts';
import { getKindColor } from '../utils/dataTransform.ts';
import * as THREE from 'three';

interface GraphView3DProps {
  data: WorldState;
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string | undefined) => void;
  showCatalyzedBy?: boolean;
}

interface GraphNode {
  id: string;
  name: string;
  kind: string;
  prominence: number;
  color: string;
  val: number;
}

interface GraphLink {
  source: string;
  target: string;
  kind: string;
  strength: number;
  catalyzed?: boolean;
}

export default function GraphView3D({ data, selectedNodeId, onNodeSelect, showCatalyzedBy = false }: GraphView3DProps) {
  const fgRef = useRef<any>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Get container dimensions
  useEffect(() => {
    if (containerRef.current) {
      const updateDimensions = () => {
        if (containerRef.current) {
          setDimensions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight
          });
        }
      };

      updateDimensions();

      // Update on window resize
      window.addEventListener('resize', updateDimensions);
      return () => window.removeEventListener('resize', updateDimensions);
    }
  }, []);

  // Transform data to force-graph format
  const graphData = useRef({ nodes: [] as GraphNode[], links: [] as GraphLink[] });

  useEffect(() => {
    const prominenceToNumber = (prominence: string): number => {
      const map: Record<string, number> = {
        forgotten: 0,
        marginal: 1,
        recognized: 2,
        renowned: 3,
        mythic: 4
      };
      return map[prominence] || 0;
    };

    const nodes: GraphNode[] = data.hardState.map(entity => ({
      id: entity.id,
      name: entity.name,
      kind: entity.kind,
      prominence: prominenceToNumber(entity.prominence),
      color: getKindColor(entity.kind),
      val: prominenceToNumber(entity.prominence) + 1 // Size multiplier (1-5)
    }));

    const links: GraphLink[] = data.relationships.map(rel => {
      const catalyzedBy = (rel as any).catalyzedBy;
      return {
        source: rel.src,
        target: rel.dst,
        kind: rel.kind,
        strength: rel.strength ?? 0.5,
        catalyzed: showCatalyzedBy && !!catalyzedBy
      };
    });

    graphData.current = { nodes, links };
  }, [data, showCatalyzedBy]);

  // Handle node click
  const handleNodeClick = useCallback((node: any) => {
    onNodeSelect(node.id);
  }, [onNodeSelect]);

  // Handle background click
  const handleBackgroundClick = useCallback(() => {
    onNodeSelect(undefined);
  }, [onNodeSelect]);

  // Custom node appearance
  const nodeThreeObject = useCallback((node: any) => {
    const geometry = new THREE.SphereGeometry(node.val * 2, 16, 16);
    const material = new THREE.MeshLambertMaterial({
      color: node.color,
      transparent: true,
      opacity: node.id === selectedNodeId ? 1 : 0.9
    });
    const mesh = new THREE.Mesh(geometry, material);

    // Add glow for selected node
    if (node.id === selectedNodeId) {
      const glowGeometry = new THREE.SphereGeometry(node.val * 2.5, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: '#FFD700',
        transparent: true,
        opacity: 0.3
      });
      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      mesh.add(glow);
    }

    return mesh;
  }, [selectedNodeId]);

  // Custom link appearance
  const linkColor = useCallback((link: any) => {
    if (link.catalyzed) {
      return '#a78bfa'; // Purple for catalyzed
    }
    // Fade color based on strength
    const opacity = Math.floor(link.strength * 255).toString(16).padStart(2, '0');
    return `#ffffff${opacity}`;
  }, []);

  const linkWidth = useCallback((link: any) => {
    return link.strength * 2; // 0-2px width based on strength
  }, []);

  const linkOpacity = useCallback((link: any) => {
    return link.catalyzed ? 0.9 : link.strength * 0.6;
  }, []);

  // Auto-rotate camera gently
  useEffect(() => {
    if (fgRef.current) {
      const fg = fgRef.current;

      // Set initial camera position
      const camera = fg.camera();
      camera.position.set(0, 0, 400);

      // Optional: gentle auto-rotation
      let angle = 0;
      const rotationSpeed = 0.001;
      const animate = () => {
        angle += rotationSpeed;
        // Gentle orbit
        // Uncomment if you want auto-rotation:
        // camera.position.x = 400 * Math.sin(angle);
        // camera.position.z = 400 * Math.cos(angle);
        // camera.lookAt(0, 0, 0);
      };
      const interval = setInterval(animate, 50);

      return () => clearInterval(interval);
    }
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData.current}
        width={dimensions.width}
        height={dimensions.height}
        nodeId="id"
        nodeLabel="name"
        nodeColor="color"
        nodeVal="val"
        nodeThreeObject={nodeThreeObject}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        linkSource="source"
        linkTarget="target"
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkOpacity={linkOpacity}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        enableNodeDrag={true}
        enableNavigationControls={true}
        showNavInfo={false}
        backgroundColor="#0a1929"
        d3VelocityDecay={0.6}
        d3AlphaDecay={0.02}
        d3AlphaMin={0.001}
        warmupTicks={100}
        cooldownTicks={0}
        cooldownTime={15000}
        onEngineStop={() => {
          if (fgRef.current) {
            fgRef.current.pauseAnimation();
          }
        }}
      />

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
            <div className="w-5 h-5 rounded-full shadow-lg flex-shrink-0" style={{ backgroundColor: '#FC6B6B' }}></div>
            <span className="font-medium">Factions</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full shadow-lg flex-shrink-0" style={{ backgroundColor: '#6BFC9C' }}></div>
            <span className="font-medium">Locations</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full shadow-lg flex-shrink-0" style={{ backgroundColor: '#FCA86B' }}></div>
            <span className="font-medium">Rules</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full shadow-lg flex-shrink-0" style={{ backgroundColor: '#C76BFC' }}></div>
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
          <div className="font-bold text-blue-200 uppercase tracking-wider">3D Controls</div>
        </div>
        <div className="px-5 py-3 space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">🖱️</span>
            <span className="font-medium">Click to select</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">🔄</span>
            <span className="font-medium">Drag to rotate</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">🔍</span>
            <span className="font-medium">Scroll to zoom</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">⌨️</span>
            <span className="font-medium">Right-click drag to pan</span>
          </div>
        </div>
      </div>
    </div>
  );
}
