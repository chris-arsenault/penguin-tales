import { useEffect, useRef, useState, useMemo } from 'react';
import type { WorldState, HardState, RegionSchema, Point, EntityKindSchema } from '../types/world.ts';
import './CoordinateMapView.css';

interface CoordinateMapViewProps {
  data: WorldState;
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string | undefined) => void;
}

// Default entity styles for when uiSchema is not present
const DEFAULT_ENTITY_STYLES: EntityKindSchema[] = [
  { kind: 'npc', displayName: 'NPCs', color: '#6FB1FC', shape: 'ellipse', subtypes: [], statusValues: [] },
  { kind: 'faction', displayName: 'Factions', color: '#FC6B6B', shape: 'diamond', subtypes: [], statusValues: [] },
  { kind: 'location', displayName: 'Locations', color: '#6BFC9C', shape: 'hexagon', subtypes: [], statusValues: [] },
  { kind: 'rules', displayName: 'Rules', color: '#FCA86B', shape: 'rectangle', subtypes: [], statusValues: [] },
  { kind: 'abilities', displayName: 'Abilities', color: '#C76BFC', shape: 'star', subtypes: [], statusValues: [] },
];

// Region colors by type
const REGION_COLORS: Record<string, { fill: string; stroke: string }> = {
  colony: { fill: 'rgba(111, 177, 252, 0.15)', stroke: 'rgba(111, 177, 252, 0.6)' },
  geographic_feature: { fill: 'rgba(107, 252, 156, 0.15)', stroke: 'rgba(107, 252, 156, 0.6)' },
  anomaly: { fill: 'rgba(199, 107, 252, 0.15)', stroke: 'rgba(199, 107, 252, 0.6)' },
  iceberg: { fill: 'rgba(200, 220, 255, 0.08)', stroke: 'rgba(200, 220, 255, 0.3)' },
  default: { fill: 'rgba(150, 150, 150, 0.1)', stroke: 'rgba(150, 150, 150, 0.4)' }
};

// Get region color by subtype from metadata
function getRegionColor(region: RegionSchema): { fill: string; stroke: string } {
  const subtype = (region.metadata?.subtype as string) || 'default';
  return REGION_COLORS[subtype] || REGION_COLORS.default;
}

// Get entity coordinates (prefer region coordinates)
function getEntityCoords(entity: HardState): Point | null {
  if (entity.coordinates?.region) {
    return entity.coordinates.region;
  }
  return null;
}

// Simple force-directed layout for floating entities
interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  anchored: boolean;
  entity: HardState;
}

function runForceLayout(
  nodes: LayoutNode[],
  relationships: Array<{ src: string; dst: string; strength?: number }>,
  iterations: number = 50
): void {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (let i = 0; i < iterations; i++) {
    // Reset velocities
    nodes.forEach(n => {
      if (!n.anchored) {
        n.vx = 0;
        n.vy = 0;
      }
    });

    // Attraction to related anchored nodes
    relationships.forEach(rel => {
      const src = nodeMap.get(rel.src);
      const dst = nodeMap.get(rel.dst);
      if (!src || !dst) return;

      const dx = dst.x - src.x;
      const dy = dst.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const strength = (rel.strength ?? 0.5) * 0.1;

      if (!src.anchored) {
        src.vx += dx / dist * strength;
        src.vy += dy / dist * strength;
      }
      if (!dst.anchored) {
        dst.vx -= dx / dist * strength;
        dst.vy -= dy / dist * strength;
      }
    });

    // Repulsion between floating nodes
    nodes.forEach(a => {
      if (a.anchored) return;
      nodes.forEach(b => {
        if (a.id === b.id) return;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 10) {
          const force = 0.5 / dist;
          a.vx += dx / dist * force;
          a.vy += dy / dist * force;
        }
      });
    });

    // Apply velocities
    nodes.forEach(n => {
      if (!n.anchored) {
        n.x = Math.max(0, Math.min(100, n.x + n.vx));
        n.y = Math.max(0, Math.min(100, n.y + n.vy));
      }
    });
  }
}

export default function CoordinateMapView({ data, selectedNodeId, onNodeSelect }: CoordinateMapViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [anchorKind, setAnchorKind] = useState<string>('location');
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set(['regions', 'entities', 'relationships']));
  const [hoveredEntity, setHoveredEntity] = useState<HardState | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Get entity kind schemas
  const entityKindSchemas = data.uiSchema?.entityKinds ?? DEFAULT_ENTITY_STYLES;
  const entityKinds = entityKindSchemas.map(ek => ek.kind);
  const regions = data.uiSchema?.regions ?? [];
  const bounds = data.uiSchema?.coordinateBounds ?? { min: 0, max: 100 };

  // Build entity color map
  const entityColorMap = useMemo(() => {
    const map = new Map<string, string>();
    entityKindSchemas.forEach(ek => map.set(ek.kind, ek.color));
    return map;
  }, [entityKindSchemas]);

  // Calculate entity positions with force layout
  const entityPositions = useMemo(() => {
    const nodes: LayoutNode[] = [];
    const entitiesWithCoords: HardState[] = [];
    const entitiesWithoutCoords: HardState[] = [];

    // Separate entities by whether they have coordinates
    data.hardState.forEach(entity => {
      const coords = getEntityCoords(entity);
      if (coords) {
        entitiesWithCoords.push(entity);
      } else {
        entitiesWithoutCoords.push(entity);
      }
    });

    // Create nodes for entities with coordinates
    entitiesWithCoords.forEach(entity => {
      const coords = getEntityCoords(entity)!;
      nodes.push({
        id: entity.id,
        x: coords.x,
        y: coords.y,
        vx: 0,
        vy: 0,
        anchored: entity.kind === anchorKind,
        entity
      });
    });

    // Create nodes for entities without coordinates
    // Position them near related entities with coordinates
    entitiesWithoutCoords.forEach(entity => {
      // Find a related entity with coordinates
      let baseX = 50, baseY = 50;
      const relatedWithCoords = entity.links.find(link => {
        const relatedId = link.src === entity.id ? link.dst : link.src;
        const related = data.hardState.find(e => e.id === relatedId);
        return related && getEntityCoords(related);
      });

      if (relatedWithCoords) {
        const relatedId = relatedWithCoords.src === entity.id ? relatedWithCoords.dst : relatedWithCoords.src;
        const related = data.hardState.find(e => e.id === relatedId);
        if (related) {
          const coords = getEntityCoords(related)!;
          baseX = coords.x + (Math.random() - 0.5) * 10;
          baseY = coords.y + (Math.random() - 0.5) * 10;
        }
      }

      nodes.push({
        id: entity.id,
        x: Math.max(0, Math.min(100, baseX)),
        y: Math.max(0, Math.min(100, baseY)),
        vx: 0,
        vy: 0,
        anchored: false,
        entity
      });
    });

    // Run force layout
    const relationships = data.relationships.map(r => ({
      src: r.src,
      dst: r.dst,
      strength: r.strength
    }));
    runForceLayout(nodes, relationships);

    return new Map(nodes.map(n => [n.id, { x: n.x, y: n.y, anchored: n.anchored }]));
  }, [data.hardState, data.relationships, anchorKind]);

  // Convert world coordinates to canvas coordinates
  const worldToCanvas = (x: number, y: number): { x: number; y: number } => {
    const padding = 40;
    const scaleX = (dimensions.width - padding * 2) / (bounds.max - bounds.min);
    const scaleY = (dimensions.height - padding * 2) / (bounds.max - bounds.min);
    return {
      x: padding + (x - bounds.min) * scaleX,
      y: dimensions.height - padding - (y - bounds.min) * scaleY // Flip Y for canvas
    };
  };

  // Convert canvas coordinates to world coordinates
  const canvasToWorld = (canvasX: number, canvasY: number): { x: number; y: number } => {
    const padding = 40;
    const scaleX = (dimensions.width - padding * 2) / (bounds.max - bounds.min);
    const scaleY = (dimensions.height - padding * 2) / (bounds.max - bounds.min);
    return {
      x: bounds.min + (canvasX - padding) / scaleX,
      y: bounds.min + (dimensions.height - padding - canvasY) / scaleY
    };
  };

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Draw the map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#0a1929';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Draw grid
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.lineWidth = 1;
    const padding = 40;
    const gridStep = 10;

    for (let i = bounds.min; i <= bounds.max; i += gridStep) {
      const start = worldToCanvas(i, bounds.min);
      const end = worldToCanvas(i, bounds.max);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      const hStart = worldToCanvas(bounds.min, i);
      const hEnd = worldToCanvas(bounds.max, i);
      ctx.beginPath();
      ctx.moveTo(hStart.x, hStart.y);
      ctx.lineTo(hEnd.x, hEnd.y);
      ctx.stroke();
    }

    // Draw axis labels
    ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
    ctx.font = '10px monospace';
    for (let i = bounds.min; i <= bounds.max; i += 20) {
      const pos = worldToCanvas(i, bounds.min);
      ctx.fillText(i.toString(), pos.x - 5, pos.y + 15);

      const posY = worldToCanvas(bounds.min, i);
      ctx.fillText(i.toString(), posY.x - 25, posY.y + 3);
    }

    // Draw regions if layer is visible
    if (visibleLayers.has('regions')) {
      regions.forEach(region => {
        const colors = getRegionColor(region);
        ctx.fillStyle = colors.fill;
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 2;

        if (region.bounds.shape === 'circle') {
          const center = worldToCanvas(region.bounds.center.x, region.bounds.center.y);
          const edgePoint = worldToCanvas(
            region.bounds.center.x + region.bounds.radius,
            region.bounds.center.y
          );
          const radiusPixels = edgePoint.x - center.x;

          ctx.beginPath();
          ctx.arc(center.x, center.y, radiusPixels, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Draw label
          ctx.fillStyle = colors.stroke;
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(region.label, center.x, center.y);
        } else if (region.bounds.shape === 'rect') {
          const topLeft = worldToCanvas(region.bounds.x1, region.bounds.y2);
          const bottomRight = worldToCanvas(region.bounds.x2, region.bounds.y1);

          ctx.beginPath();
          ctx.rect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
          ctx.fill();
          ctx.stroke();

          // Draw label
          ctx.fillStyle = colors.stroke;
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          const centerX = (topLeft.x + bottomRight.x) / 2;
          const centerY = (topLeft.y + bottomRight.y) / 2;
          ctx.fillText(region.label, centerX, centerY);
        } else if (region.bounds.shape === 'polygon') {
          const points = region.bounds.points.map(p => worldToCanvas(p.x, p.y));
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      });
    }

    // Draw relationships if layer is visible
    if (visibleLayers.has('relationships')) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;

      data.relationships.forEach(rel => {
        const srcPos = entityPositions.get(rel.src);
        const dstPos = entityPositions.get(rel.dst);
        if (!srcPos || !dstPos) return;

        const start = worldToCanvas(srcPos.x, srcPos.y);
        const end = worldToCanvas(dstPos.x, dstPos.y);

        ctx.globalAlpha = (rel.strength ?? 0.5) * 0.5;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    }

    // Draw entities if layer is visible
    if (visibleLayers.has('entities')) {
      data.hardState.forEach(entity => {
        const pos = entityPositions.get(entity.id);
        if (!pos) return;

        const canvasPos = worldToCanvas(pos.x, pos.y);
        const color = entityColorMap.get(entity.kind) || '#999';
        const isAnchored = entity.kind === anchorKind;
        const isSelected = entity.id === selectedNodeId;
        const isHovered = entity.id === hoveredEntity?.id;

        // Draw entity
        const radius = isAnchored ? 8 : 5;
        ctx.beginPath();
        ctx.arc(canvasPos.x, canvasPos.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Draw anchor indicator
        if (isAnchored) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Draw selection/hover highlight
        if (isSelected || isHovered) {
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(canvasPos.x, canvasPos.y, radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Draw label for anchored entities
        if (isAnchored || isSelected || isHovered) {
          ctx.fillStyle = '#fff';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(entity.name, canvasPos.x, canvasPos.y - radius - 5);
        }
      });
    }

  }, [data, dimensions, anchorKind, visibleLayers, entityPositions, entityColorMap, regions, bounds, selectedNodeId, hoveredEntity]);

  // Handle mouse events
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const worldPos = canvasToWorld(canvasX, canvasY);
    setMousePos(worldPos);

    // Find entity under cursor
    let foundEntity: HardState | null = null;
    let minDist = 10; // Threshold in world units

    data.hardState.forEach(entity => {
      const pos = entityPositions.get(entity.id);
      if (!pos) return;

      const dx = pos.x - worldPos.x;
      const dy = pos.y - worldPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDist) {
        minDist = dist;
        foundEntity = entity;
      }
    });

    setHoveredEntity(foundEntity);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredEntity) {
      onNodeSelect(hoveredEntity.id);
    } else {
      onNodeSelect(undefined);
    }
  };

  const toggleLayer = (layer: string) => {
    setVisibleLayers(prev => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  };

  return (
    <div className="coordinate-map-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        style={{ cursor: hoveredEntity ? 'pointer' : 'default' }}
      />

      {/* Controls */}
      <div className="coordinate-map-controls">
        <div className="control-section">
          <div className="control-label">Anchor Layer</div>
          <select
            value={anchorKind}
            onChange={e => setAnchorKind(e.target.value)}
            className="control-select"
          >
            {entityKinds.map(kind => (
              <option key={kind} value={kind}>
                {entityKindSchemas.find(ek => ek.kind === kind)?.displayName ?? kind}
              </option>
            ))}
          </select>
        </div>

        <div className="control-section">
          <div className="control-label">Layers</div>
          <div className="layer-toggles">
            {['regions', 'entities', 'relationships'].map(layer => (
              <label key={layer} className="layer-toggle">
                <input
                  type="checkbox"
                  checked={visibleLayers.has(layer)}
                  onChange={() => toggleLayer(layer)}
                />
                <span>{layer}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="coordinate-map-legend">
        <div className="legend-title">Entity Types</div>
        {entityKindSchemas.map(ek => (
          <div key={ek.kind} className="legend-item">
            <div
              className="legend-dot"
              style={{
                backgroundColor: ek.color,
                border: ek.kind === anchorKind ? '2px solid white' : 'none'
              }}
            />
            <span>{ek.displayName}</span>
            {ek.kind === anchorKind && <span className="anchor-badge">anchored</span>}
          </div>
        ))}
        <div className="legend-divider" />
        <div className="legend-title">Regions</div>
        {Object.entries(REGION_COLORS).filter(([k]) => k !== 'default').map(([type, colors]) => (
          <div key={type} className="legend-item">
            <div
              className="legend-dot"
              style={{ backgroundColor: colors.stroke }}
            />
            <span>{type.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hoveredEntity && mousePos && (
        <div className="coordinate-map-tooltip" style={{
          left: worldToCanvas(mousePos.x, mousePos.y).x + 15,
          top: worldToCanvas(mousePos.x, mousePos.y).y - 15
        }}>
          <div className="tooltip-name">{hoveredEntity.name}</div>
          <div className="tooltip-info">{hoveredEntity.kind} / {hoveredEntity.subtype}</div>
          <div className="tooltip-info">{hoveredEntity.status}</div>
          {getEntityCoords(hoveredEntity) && (
            <div className="tooltip-coords">
              x: {getEntityCoords(hoveredEntity)!.x.toFixed(1)},
              y: {getEntityCoords(hoveredEntity)!.y.toFixed(1)},
              z: {getEntityCoords(hoveredEntity)!.z.toFixed(1)}
            </div>
          )}
        </div>
      )}

      {/* Coordinate display */}
      {mousePos && (
        <div className="coordinate-display">
          x: {mousePos.x.toFixed(1)}, y: {mousePos.y.toFixed(1)}
        </div>
      )}
    </div>
  );
}
