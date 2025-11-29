/**
 * PlaneCanvas - 2D canvas for visualizing and editing semantic planes.
 * Supports pan, zoom, region rendering, and entity placement.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';

const styles = {
  container: {
    position: 'relative',
    flex: 1,
    backgroundColor: '#0d1117',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  canvas: {
    display: 'block',
    cursor: 'grab'
  },
  canvasDragging: {
    cursor: 'grabbing'
  },
  axisLabel: {
    position: 'absolute',
    fontSize: '11px',
    color: '#666',
    pointerEvents: 'none'
  },
  controls: {
    position: 'absolute',
    bottom: '12px',
    right: '12px',
    display: 'flex',
    gap: '4px'
  },
  controlButton: {
    padding: '6px 10px',
    fontSize: '14px',
    backgroundColor: '#16213e',
    color: '#aaa',
    border: '1px solid #0f3460',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};

export default function PlaneCanvas({
  plane,
  regions = [],
  entities = [],
  cultures = [],
  selectedEntityId,
  onSelectEntity,
  onMoveEntity,
  width = 600,
  height = 500
}) {
  const canvasRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedEntity, setDraggedEntity] = useState(null);

  // Convert world coordinates to canvas coordinates
  const worldToCanvas = useCallback((wx, wy) => {
    const bounds = plane?.bounds || { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } };
    const scaleX = width / (bounds.x.max - bounds.x.min);
    const scaleY = height / (bounds.y.max - bounds.y.min);
    const scale = Math.min(scaleX, scaleY) * zoom;

    return {
      x: (wx - bounds.x.min) * scale + pan.x + width / 2 - (bounds.x.max - bounds.x.min) * scale / 2,
      y: height - ((wy - bounds.y.min) * scale + pan.y + height / 2 - (bounds.y.max - bounds.y.min) * scale / 2)
    };
  }, [plane, width, height, zoom, pan]);

  // Convert canvas coordinates to world coordinates
  const canvasToWorld = useCallback((cx, cy) => {
    const bounds = plane?.bounds || { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } };
    const scaleX = width / (bounds.x.max - bounds.x.min);
    const scaleY = height / (bounds.y.max - bounds.y.min);
    const scale = Math.min(scaleX, scaleY) * zoom;

    return {
      x: (cx - pan.x - width / 2 + (bounds.x.max - bounds.x.min) * scale / 2) / scale + bounds.x.min,
      y: (height - cy - pan.y - height / 2 + (bounds.y.max - bounds.y.min) * scale / 2) / scale + bounds.y.min
    };
  }, [plane, width, height, zoom, pan]);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#1a2332';
    ctx.lineWidth = 1;
    const gridSize = 10;
    const bounds = plane?.bounds || { x: { min: 0, max: 100 }, y: { min: 0, max: 100 } };

    for (let x = bounds.x.min; x <= bounds.x.max; x += gridSize) {
      const { x: cx } = worldToCanvas(x, 0);
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();
    }
    for (let y = bounds.y.min; y <= bounds.y.max; y += gridSize) {
      const { y: cy } = worldToCanvas(0, y);
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();
    }

    // Draw regions
    regions.forEach((region) => {
      const regionBounds = region.bounds;
      ctx.fillStyle = (region.color || '#0f3460') + '40';
      ctx.strokeStyle = region.color || '#0f3460';
      ctx.lineWidth = 2;

      if (regionBounds.shape === 'circle') {
        const { x: cx, y: cy } = worldToCanvas(regionBounds.center.x, regionBounds.center.y);
        const radius = regionBounds.radius * zoom * (width / (bounds.x.max - bounds.x.min));

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.fillStyle = '#888';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(region.label, cx, cy + radius + 14);
      } else if (regionBounds.shape === 'rect') {
        const { x: x1, y: y1 } = worldToCanvas(regionBounds.x1, regionBounds.y2);
        const { x: x2, y: y2 } = worldToCanvas(regionBounds.x2, regionBounds.y1);

        ctx.beginPath();
        ctx.rect(x1, y1, x2 - x1, y2 - y1);
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.fillStyle = '#888';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(region.label, (x1 + x2) / 2, y2 + 14);
      }
    });

    // Draw entities
    entities.forEach((entity) => {
      if (!entity.coordinates) return;

      const { x: cx, y: cy } = worldToCanvas(entity.coordinates.x, entity.coordinates.y);
      const culture = cultures.find(c => c.id === entity.culture);
      const color = culture?.color || '#888';
      const isSelected = entity.id === selectedEntityId;

      // Entity dot
      ctx.beginPath();
      ctx.arc(cx, cy, isSelected ? 10 : 7, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Entity label
      ctx.fillStyle = '#ccc';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(entity.name || entity.id, cx, cy - 12);
    });

  }, [plane, regions, entities, cultures, selectedEntityId, width, height, zoom, pan, worldToCanvas]);

  // Mouse handlers
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Check if clicking on an entity
    for (const entity of entities) {
      if (!entity.coordinates) continue;
      const { x: ex, y: ey } = worldToCanvas(entity.coordinates.x, entity.coordinates.y);
      const dist = Math.sqrt((cx - ex) ** 2 + (cy - ey) ** 2);
      if (dist < 12) {
        onSelectEntity?.(entity.id);
        setDraggedEntity(entity.id);
        return;
      }
    }

    // Start panning
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    onSelectEntity?.(null);
  };

  const handleMouseMove = (e) => {
    if (draggedEntity) {
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const world = canvasToWorld(cx, cy);
      onMoveEntity?.(draggedEntity, world);
    } else if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedEntity(null);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.5, Math.min(3, z * delta)));
  };

  const resetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  const axes = plane?.axes || {};

  return (
    <div style={styles.container}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          ...styles.canvas,
          ...(isDragging ? styles.canvasDragging : {})
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Axis labels */}
      {axes.x && (
        <>
          <div style={{ ...styles.axisLabel, bottom: '8px', left: '8px' }}>
            {axes.x.lowLabel}
          </div>
          <div style={{ ...styles.axisLabel, bottom: '8px', right: '60px' }}>
            {axes.x.highLabel}
          </div>
          <div style={{ ...styles.axisLabel, bottom: '8px', left: '50%', transform: 'translateX(-50%)' }}>
            ← {axes.x.name} →
          </div>
        </>
      )}
      {axes.y && (
        <>
          <div style={{ ...styles.axisLabel, top: '8px', left: '8px' }}>
            {axes.y.highLabel}
          </div>
          <div style={{ ...styles.axisLabel, bottom: '28px', left: '8px' }}>
            {axes.y.lowLabel}
          </div>
        </>
      )}

      <div style={styles.controls}>
        <button style={styles.controlButton} onClick={() => setZoom(z => Math.min(3, z * 1.2))}>
          +
        </button>
        <button style={styles.controlButton} onClick={() => setZoom(z => Math.max(0.5, z * 0.8))}>
          −
        </button>
        <button style={styles.controlButton} onClick={resetView}>
          ⌂
        </button>
      </div>
    </div>
  );
}
