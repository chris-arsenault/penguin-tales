import { useEffect, useRef, useState, useMemo } from 'react';
import type { WorldState, HardState, RegionSchema, Point, EntityKindMapConfig, AxisConfig } from '../types/world.ts';
import type { EntityKindDefinition } from '@canonry/world-schema';
import './CoordinateMapView.css';

interface CoordinateMapViewProps {
  data: WorldState;
  selectedNodeId?: string;
  onNodeSelect: (nodeId: string | undefined) => void;
}

// Default entity styles for when uiSchema is not present
const DEFAULT_ENTITY_STYLES: EntityKindDefinition[] = [
  { kind: 'npc', description: 'NPCs', subtypes: [], statuses: [], style: { color: '#6FB1FC', shape: 'ellipse' } },
  { kind: 'faction', description: 'Factions', subtypes: [], statuses: [], style: { color: '#FC6B6B', shape: 'diamond' } },
  { kind: 'location', description: 'Locations', subtypes: [], statuses: [], style: { color: '#6BFC9C', shape: 'hexagon' } },
  { kind: 'rules', description: 'Rules', subtypes: [], statuses: [], style: { color: '#FCA86B', shape: 'rectangle' } },
  { kind: 'abilities', description: 'Abilities', subtypes: [], statuses: [], style: { color: '#C76BFC', shape: 'star' } },
];

// Generate a default map config for any entity kind
function getDefaultMapConfig(kind: string): EntityKindMapConfig {
  return {
    entityKind: kind,
    name: `${kind.charAt(0).toUpperCase() + kind.slice(1)} Map`,
    description: `Coordinate space for ${kind} entities`,
    bounds: { min: 0, max: 100 },
    hasZAxis: true,
    zAxisLabel: 'Z'
  };
}

// Default region colors by type (fallback if no color in metadata)
const REGION_COLORS: Record<string, { fill: string; stroke: string }> = {
  colony: { fill: 'rgba(111, 177, 252, 0.15)', stroke: 'rgba(111, 177, 252, 0.6)' },
  geographic_feature: { fill: 'rgba(107, 252, 156, 0.15)', stroke: 'rgba(107, 252, 156, 0.6)' },
  anomaly: { fill: 'rgba(199, 107, 252, 0.15)', stroke: 'rgba(199, 107, 252, 0.6)' },
  iceberg: { fill: 'rgba(200, 220, 255, 0.08)', stroke: 'rgba(200, 220, 255, 0.3)' },
  default: { fill: 'rgba(150, 150, 150, 0.1)', stroke: 'rgba(150, 150, 150, 0.4)' }
};

// Convert hex color to rgba with alpha
function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha})`;
  }
  return `rgba(150, 150, 150, ${alpha})`;
}

// Get region color - prefer color from metadata, fallback to subtype colors
function getRegionColor(region: RegionSchema): { fill: string; stroke: string } {
  // Use color from metadata if available
  const metadataColor = region.metadata?.color as string;
  if (metadataColor) {
    return {
      fill: hexToRgba(metadataColor, 0.15),
      stroke: hexToRgba(metadataColor, 0.7)
    };
  }
  // Fallback to subtype-based colors
  const subtype = (region.metadata?.subtype as string) || 'default';
  return REGION_COLORS[subtype] || REGION_COLORS.default;
}

// Get entity coordinates (now directly on entity as Point)
// Returns {x: 0, y: 0, z: 0, invalid: true} if coordinates are missing or have null values
// This makes invalid coordinates visible instead of hiding them
interface EntityPoint extends Point {
  invalid?: boolean;
}

function getEntityCoords(entity: HardState): EntityPoint {
  const coords = entity.coordinates;

  // Check if we have valid numeric values (not null/undefined)
  if (coords && typeof coords.x === 'number' && typeof coords.y === 'number') {
    return {
      x: coords.x,
      y: coords.y,
      z: typeof coords.z === 'number' ? coords.z : 50
    };
  }

  // Invalid coordinates - place at origin with flag
  console.warn(`Entity "${entity.name}" (${entity.kind}/${entity.id}) has invalid coordinates:`, coords);
  return { x: 0, y: 0, z: 0, invalid: true };
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
  const [mapKind, setMapKind] = useState<string>('location');  // Which entity kind's map to show
  const [showRelatedKinds, setShowRelatedKinds] = useState<boolean>(true);  // Show related entities from other kinds
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set(['regions', 'entities', 'relationships']));
  const [hoveredEntity, setHoveredEntity] = useState<HardState | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<RegionSchema | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Get entity kind schemas
  const entityKindSchemas = data.uiSchema?.entityKinds ?? DEFAULT_ENTITY_STYLES;
  const entityKinds = entityKindSchemas.map(ek => ek.kind).filter((kind): kind is string => !!kind);

  // Ensure mapKind is valid - default to first available kind if current selection is invalid
  useEffect(() => {
    if (entityKinds.length > 0 && !entityKinds.includes(mapKind)) {
      setMapKind(entityKinds[0]);
    }
  }, [entityKinds, mapKind]);

  // Get per-kind map config and regions
  const mapConfig = data.uiSchema?.perKindMaps?.[mapKind] ?? getDefaultMapConfig(mapKind);
  const regions = data.uiSchema?.perKindRegions?.[mapKind] ?? data.uiSchema?.regions ?? [];
  const bounds = mapConfig.bounds ?? { min: 0, max: 100 };

  // Filter entities for the current map - primary kind always shown, related kinds optionally
  const mapEntities = useMemo(() => {
    const primaryEntities = data.hardState.filter(e => e.kind === mapKind);

    if (!showRelatedKinds) {
      return primaryEntities;
    }

    // Find entities related to primary entities
    const primaryIds = new Set(primaryEntities.map(e => e.id));
    const relatedIds = new Set<string>();

    data.relationships.forEach(rel => {
      if (primaryIds.has(rel.src)) relatedIds.add(rel.dst);
      if (primaryIds.has(rel.dst)) relatedIds.add(rel.src);
    });

    const relatedEntities = data.hardState.filter(e =>
      relatedIds.has(e.id) && !primaryIds.has(e.id)
    );

    return [...primaryEntities, ...relatedEntities];
  }, [data.hardState, data.relationships, mapKind, showRelatedKinds]);

  // Build entity color map
  const entityColorMap = useMemo(() => {
    const map = new Map<string, string>();
    entityKindSchemas.forEach(ek => map.set(ek.kind, ek.style?.color || '#999'));
    return map;
  }, [entityKindSchemas]);

  // Calculate entity positions with force layout
  const entityPositions = useMemo(() => {
    const nodes: LayoutNode[] = [];

    // All entities get coordinates - invalid ones are placed at origin
    mapEntities.forEach(entity => {
      const coords = getEntityCoords(entity);
      const isValidCoords = !coords.invalid;

      nodes.push({
        id: entity.id,
        x: coords.x,
        y: coords.y,
        vx: 0,
        vy: 0,
        // Only anchor if valid coords AND primary kind
        anchored: isValidCoords && entity.kind === mapKind,
        entity
      });
    });

    // Run force layout - only include relationships between visible entities
    const visibleIds = new Set(mapEntities.map(e => e.id));
    const relationships = data.relationships
      .filter(r => visibleIds.has(r.src) && visibleIds.has(r.dst))
      .map(r => ({
        src: r.src,
        dst: r.dst,
        strength: r.strength
      }));
    runForceLayout(nodes, relationships);

    return new Map(nodes.map(n => [n.id, { x: n.x, y: n.y, anchored: n.anchored }]));
  }, [mapEntities, data.relationships, mapKind]);

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

    // Draw axis labels - semantic tags at ends, numeric in middle
    const padding = 40;

    // Draw semantic axis labels at ends
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';

    // X-axis labels (low on left, high on right)
    if (mapConfig.xAxis) {
      // Low tag (left side)
      ctx.fillStyle = 'rgba(252, 107, 107, 0.8)';  // Reddish for low
      const xLowPos = worldToCanvas(bounds.min + 5, bounds.min);
      ctx.fillText(`← ${mapConfig.xAxis.lowTag}`, xLowPos.x + 30, xLowPos.y + 25);

      // Axis name (center bottom)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      const xCenterPos = worldToCanvas((bounds.min + bounds.max) / 2, bounds.min);
      ctx.fillText(mapConfig.xAxis.name, xCenterPos.x, xCenterPos.y + 25);

      // High tag (right side)
      ctx.fillStyle = 'rgba(107, 252, 156, 0.8)';  // Greenish for high
      const xHighPos = worldToCanvas(bounds.max - 5, bounds.min);
      ctx.fillText(`${mapConfig.xAxis.highTag} →`, xHighPos.x - 30, xHighPos.y + 25);
    }

    // Y-axis labels (low on bottom, high on top)
    if (mapConfig.yAxis) {
      ctx.save();

      // Low tag (bottom)
      ctx.fillStyle = 'rgba(252, 107, 107, 0.8)';
      const yLowPos = worldToCanvas(bounds.min, bounds.min + 5);
      ctx.translate(yLowPos.x - 25, yLowPos.y - 20);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`← ${mapConfig.yAxis.lowTag}`, 0, 0);
      ctx.restore();

      // Axis name (center left)
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      const yCenterPos = worldToCanvas(bounds.min, (bounds.min + bounds.max) / 2);
      ctx.translate(yCenterPos.x - 25, yCenterPos.y);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(mapConfig.yAxis.name, 0, 0);
      ctx.restore();

      // High tag (top)
      ctx.save();
      ctx.fillStyle = 'rgba(107, 252, 156, 0.8)';
      const yHighPos = worldToCanvas(bounds.min, bounds.max - 5);
      ctx.translate(yHighPos.x - 25, yHighPos.y + 20);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${mapConfig.yAxis.highTag} →`, 0, 0);
      ctx.restore();
    }

    // Draw small numeric labels for reference
    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    for (let i = bounds.min + 20; i < bounds.max; i += 20) {
      const pos = worldToCanvas(i, bounds.min);
      ctx.fillText(i.toString(), pos.x, pos.y + 12);

      ctx.textAlign = 'right';
      const posY = worldToCanvas(bounds.min, i);
      ctx.fillText(i.toString(), posY.x - 5, posY.y + 3);
      ctx.textAlign = 'center';
    }

    // Parse selectedNodeId to check if a region is selected
    const selectedRegionId = selectedNodeId?.startsWith('region:')
      ? selectedNodeId.split(':')[2]
      : null;

    // Draw regions if layer is visible
    if (visibleLayers.has('regions')) {
      regions.forEach(region => {
        const colors = getRegionColor(region);
        const isHovered = hoveredRegion?.id === region.id;
        const isSelected = selectedRegionId === region.id;

        // Adjust colors for hover/selection state
        ctx.fillStyle = isHovered || isSelected
          ? colors.fill.replace(/[\d.]+\)$/, '0.3)')  // Brighter fill
          : colors.fill;
        ctx.strokeStyle = isSelected
          ? '#ffffff'  // White stroke for selected
          : isHovered
            ? colors.stroke.replace(/[\d.]+\)$/, '1)')  // Full opacity on hover
            : colors.stroke;
        ctx.lineWidth = isSelected ? 3 : isHovered ? 2.5 : 2;

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
          ctx.fillStyle = isHovered || isSelected ? '#ffffff' : colors.stroke;
          ctx.font = isHovered || isSelected ? 'bold 13px sans-serif' : 'bold 12px sans-serif';
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
          ctx.fillStyle = isHovered || isSelected ? '#ffffff' : colors.stroke;
          ctx.font = isHovered || isSelected ? 'bold 13px sans-serif' : 'bold 12px sans-serif';
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
      mapEntities.forEach(entity => {
        const pos = entityPositions.get(entity.id);
        if (!pos) return;

        const canvasPos = worldToCanvas(pos.x, pos.y);
        const color = entityColorMap.get(entity.kind) || '#999';
        const isPrimaryKind = entity.kind === mapKind;
        const isSelected = entity.id === selectedNodeId;
        const isHovered = entity.id === hoveredEntity?.id;

        // Check if coordinates are invalid
        const entityCoords = getEntityCoords(entity);
        const hasInvalidCoords = entityCoords.invalid;

        // Draw entity - primary kind entities are larger
        const radius = isPrimaryKind ? 8 : 5;
        ctx.beginPath();
        ctx.arc(canvasPos.x, canvasPos.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = hasInvalidCoords ? '#666' : color;  // Gray out invalid coords
        ctx.fill();

        // Draw invalid coordinates indicator (red dashed border)
        if (hasInvalidCoords) {
          ctx.strokeStyle = '#FF4444';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(canvasPos.x, canvasPos.y, radius + 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);  // Reset dash
        }
        // Draw primary kind indicator (white border)
        else if (isPrimaryKind) {
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

        // Draw label for primary kind or selected/hovered entities
        if (isPrimaryKind || isSelected || isHovered) {
          ctx.fillStyle = hasInvalidCoords ? '#FF4444' : '#fff';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(entity.name, canvasPos.x, canvasPos.y - radius - 5);
        }
      });
    }

  }, [data, dimensions, mapKind, visibleLayers, entityPositions, entityColorMap, regions, bounds, selectedNodeId, hoveredEntity, hoveredRegion, mapEntities]);

  // Check if a point is inside a region
  const isPointInRegion = (region: RegionSchema, worldX: number, worldY: number): boolean => {
    if (region.bounds.shape === 'circle') {
      const dx = worldX - region.bounds.center.x;
      const dy = worldY - region.bounds.center.y;
      return Math.sqrt(dx * dx + dy * dy) <= region.bounds.radius;
    } else if (region.bounds.shape === 'rect') {
      return worldX >= region.bounds.x1 && worldX <= region.bounds.x2 &&
             worldY >= region.bounds.y1 && worldY <= region.bounds.y2;
    }
    return false;
  };

  // Handle mouse events
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const worldPos = canvasToWorld(canvasX, canvasY);
    setMousePos(worldPos);

    // Find entity under cursor (only from visible entities)
    let foundEntity: HardState | null = null;
    let minDist = 3; // Threshold in world units - small to allow region selection

    mapEntities.forEach(entity => {
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

    // Find region under cursor (if no entity found and regions visible)
    // Check regions in reverse order so topmost (last drawn) is selected first
    let foundRegion: RegionSchema | null = null;
    if (!foundEntity && visibleLayers.has('regions')) {
      for (let i = regions.length - 1; i >= 0; i--) {
        if (isPointInRegion(regions[i], worldPos.x, worldPos.y)) {
          foundRegion = regions[i];
          break;
        }
      }
    }
    setHoveredRegion(foundRegion);
  };

  const handleClick = () => {
    if (hoveredEntity) {
      onNodeSelect(hoveredEntity.id);
    } else if (hoveredRegion) {
      // Use prefixed ID for region selection: "region:{mapKind}:{regionId}"
      onNodeSelect(`region:${mapKind}:${hoveredRegion.id}`);
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
        style={{ cursor: (hoveredEntity || hoveredRegion) ? 'pointer' : 'default' }}
      />

      {/* Controls */}
      <div className="coordinate-map-controls">
        <div className="control-section">
          <div className="control-label">Entity Map</div>
          <select
            value={mapKind}
            onChange={e => setMapKind(e.target.value)}
            className="control-select"
          >
            {entityKinds.map(kind => (
              <option key={kind} value={kind}>
                {entityKindSchemas.find(ek => ek.kind === kind)?.description ?? kind}
              </option>
            ))}
          </select>
          <div className="control-description">{mapConfig.description}</div>
        </div>

        <div className="control-section">
          <label className="layer-toggle">
            <input
              type="checkbox"
              checked={showRelatedKinds}
              onChange={() => setShowRelatedKinds(!showRelatedKinds)}
            />
            <span>Show related entities</span>
          </label>
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
                backgroundColor: ek.style?.color || '#999',
                border: ek.kind === mapKind ? '2px solid white' : 'none'
              }}
            />
            <span>{ek.description || ek.kind}</span>
            {ek.kind === mapKind && <span className="anchor-badge">primary</span>}
          </div>
        ))}
        {regions.length > 0 && (
          <>
            <div className="legend-divider" />
            <div className="legend-title">Regions ({regions.length})</div>
            {Object.entries(REGION_COLORS).filter(([k]) => k !== 'default').map(([type, colors]) => (
              <div key={type} className="legend-item">
                <div
                  className="legend-dot"
                  style={{ backgroundColor: colors.stroke }}
                />
                <span>{type.replace('_', ' ')}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Hover tooltip */}
      {hoveredEntity && mousePos && (() => {
        const coords = getEntityCoords(hoveredEntity);
        return (
          <div className="coordinate-map-tooltip" style={{
            left: worldToCanvas(mousePos.x, mousePos.y).x + 15,
            top: worldToCanvas(mousePos.x, mousePos.y).y - 15
          }}>
            <div className="tooltip-name">{hoveredEntity.name}</div>
            <div className="tooltip-info">{hoveredEntity.kind} / {hoveredEntity.subtype}</div>
            <div className="tooltip-info">{hoveredEntity.status}</div>
            {coords.invalid ? (
              <div className="tooltip-coords" style={{ color: '#FF4444' }}>
                ⚠️ INVALID COORDINATES
              </div>
            ) : (
              <div className="tooltip-coords">
                x: {coords.x.toFixed(1)},
                y: {coords.y.toFixed(1)},
                z: {coords.z.toFixed(1)}
              </div>
            )}
          </div>
        );
      })()}

      {/* Coordinate display */}
      {mousePos && (
        <div className="coordinate-display">
          x: {mousePos.x.toFixed(1)}, y: {mousePos.y.toFixed(1)}
        </div>
      )}
    </div>
  );
}
