/**
 * PlaneCanvas - 2D canvas for visualizing and editing semantic planes.
 * Coordinate system: 0-100 on both axes, with (0,0) at bottom-left.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';

const WORLD_MIN = 0;
const WORLD_MAX = 100;
const WORLD_SIZE = WORLD_MAX - WORLD_MIN;
const PADDING = 40; // Padding for axis labels

export default function PlaneCanvas({
  plane,
  regions = [],
  entities = [],
  cultures = [],
  selectedEntityId,
  onSelectEntity,
  onMoveEntity
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ width: 600, height: 400 });
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [interaction, setInteraction] = useState({ type: null, startX: 0, startY: 0, startCamera: null });

  // Resize observer to fill container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Calculate the drawable area (inside padding)
  const drawArea = {
    left: PADDING,
    top: PADDING,
    width: size.width - PADDING * 2,
    height: size.height - PADDING * 2
  };

  // Base scale to fit world in draw area (maintaining aspect ratio)
  const baseScale = Math.min(drawArea.width / WORLD_SIZE, drawArea.height / WORLD_SIZE);

  // Convert world coordinates (0-100) to canvas pixel coordinates
  const worldToCanvas = useCallback((wx, wy) => {
    const scale = baseScale * camera.zoom;
    // Center the world in the draw area
    const worldPixelSize = WORLD_SIZE * scale;
    const offsetX = drawArea.left + (drawArea.width - worldPixelSize) / 2;
    const offsetY = drawArea.top + (drawArea.height - worldPixelSize) / 2;

    return {
      x: offsetX + (wx - WORLD_MIN) * scale + camera.x,
      // Flip Y so 0 is at bottom
      y: offsetY + (WORLD_MAX - wy) * scale + camera.y
    };
  }, [baseScale, camera, drawArea]);

  // Convert canvas pixel coordinates to world coordinates
  const canvasToWorld = useCallback((cx, cy) => {
    const scale = baseScale * camera.zoom;
    const worldPixelSize = WORLD_SIZE * scale;
    const offsetX = drawArea.left + (drawArea.width - worldPixelSize) / 2;
    const offsetY = drawArea.top + (drawArea.height - worldPixelSize) / 2;

    return {
      x: (cx - camera.x - offsetX) / scale + WORLD_MIN,
      // Flip Y so 0 is at bottom
      y: WORLD_MAX - (cy - camera.y - offsetY) / scale
    };
  }, [baseScale, camera, drawArea]);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = size;

    // Clear
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, width, height);

    const scale = baseScale * camera.zoom;

    // Get world corners in canvas space
    const topLeft = worldToCanvas(WORLD_MIN, WORLD_MAX);
    const bottomRight = worldToCanvas(WORLD_MAX, WORLD_MIN);
    const worldWidth = bottomRight.x - topLeft.x;
    const worldHeight = bottomRight.y - topLeft.y;

    // Draw world background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(topLeft.x, topLeft.y, worldWidth, worldHeight);

    // Draw grid
    ctx.strokeStyle = '#1a2332';
    ctx.lineWidth = 1;
    const gridStep = 10;

    for (let x = WORLD_MIN; x <= WORLD_MAX; x += gridStep) {
      const { x: cx } = worldToCanvas(x, 0);
      ctx.beginPath();
      ctx.moveTo(cx, topLeft.y);
      ctx.lineTo(cx, bottomRight.y);
      ctx.stroke();
    }
    for (let y = WORLD_MIN; y <= WORLD_MAX; y += gridStep) {
      const { y: cy } = worldToCanvas(0, y);
      ctx.beginPath();
      ctx.moveTo(topLeft.x, cy);
      ctx.lineTo(bottomRight.x, cy);
      ctx.stroke();
    }

    // Draw center crosshair
    ctx.strokeStyle = '#2a3a4a';
    ctx.lineWidth = 1;
    const center = worldToCanvas(50, 50);
    ctx.beginPath();
    ctx.moveTo(topLeft.x, center.y);
    ctx.lineTo(bottomRight.x, center.y);
    ctx.moveTo(center.x, topLeft.y);
    ctx.lineTo(center.x, bottomRight.y);
    ctx.stroke();

    // Draw world border
    ctx.strokeStyle = '#3a4a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(topLeft.x, topLeft.y, worldWidth, worldHeight);

    // Draw regions
    regions.forEach((region) => {
      const regionBounds = region.bounds;
      if (!regionBounds) return;

      ctx.fillStyle = (region.color || '#0f3460') + '30';
      ctx.strokeStyle = region.color || '#0f3460';
      ctx.lineWidth = 2;

      if (regionBounds.shape === 'circle' && regionBounds.center) {
        const { x: cx, y: cy } = worldToCanvas(regionBounds.center.x, regionBounds.center.y);
        const radius = (regionBounds.radius || 10) * scale;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Label
        ctx.fillStyle = '#888';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(region.label || '', cx, cy + radius + 14);
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

    // Draw axis labels on the edges
    const axes = plane?.axes || {};

    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';

    // X axis labels
    if (axes.x) {
      ctx.textAlign = 'left';
      ctx.fillText(axes.x.lowLabel || '0', topLeft.x, bottomRight.y + 16);
      ctx.textAlign = 'right';
      ctx.fillText(axes.x.highLabel || '100', bottomRight.x, bottomRight.y + 16);
      ctx.textAlign = 'center';
      ctx.fillText(axes.x.name || 'X Axis', (topLeft.x + bottomRight.x) / 2, bottomRight.y + 28);
    }

    // Y axis labels
    if (axes.y) {
      ctx.textAlign = 'right';
      ctx.fillText(axes.y.lowLabel || '0', topLeft.x - 6, bottomRight.y);
      ctx.fillText(axes.y.highLabel || '100', topLeft.x - 6, topLeft.y + 4);

      // Rotated Y axis name
      ctx.save();
      ctx.translate(topLeft.x - 28, (topLeft.y + bottomRight.y) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(axes.y.name || 'Y Axis', 0, 0);
      ctx.restore();
    }

  }, [plane, regions, entities, cultures, selectedEntityId, size, camera, baseScale, worldToCanvas]);

  // Find entity at canvas position
  const findEntityAt = (cx, cy) => {
    for (const entity of entities) {
      if (!entity.coordinates) continue;
      const { x: ex, y: ey } = worldToCanvas(entity.coordinates.x, entity.coordinates.y);
      const dist = Math.sqrt((cx - ex) ** 2 + (cy - ey) ** 2);
      if (dist < 12) return entity;
    }
    return null;
  };

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Check if clicking on an entity
    const entity = findEntityAt(cx, cy);
    if (entity) {
      onSelectEntity?.(entity.id);
      setInteraction({
        type: 'drag-entity',
        entityId: entity.id,
        startX: cx,
        startY: cy
      });
      return;
    }

    // Start panning
    onSelectEntity?.(null);
    setInteraction({
      type: 'pan',
      startX: cx,
      startY: cy,
      startCamera: { ...camera }
    });
  };

  const handleMouseMove = (e) => {
    if (!interaction.type) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (interaction.type === 'drag-entity') {
      const world = canvasToWorld(cx, cy);
      // Clamp to world bounds
      const clampedX = Math.max(WORLD_MIN, Math.min(WORLD_MAX, world.x));
      const clampedY = Math.max(WORLD_MIN, Math.min(WORLD_MAX, world.y));
      onMoveEntity?.(interaction.entityId, { x: clampedX, y: clampedY });
    } else if (interaction.type === 'pan') {
      // Pan moves in same direction as mouse (natural scrolling)
      const dx = cx - interaction.startX;
      const dy = cy - interaction.startY;
      setCamera({
        ...camera,
        x: interaction.startCamera.x + dx,
        y: interaction.startCamera.y + dy
      });
    }
  };

  const handleMouseUp = () => {
    setInteraction({ type: null });
  };

  const handleWheel = (e) => {
    e.preventDefault();

    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Zoom towards cursor position
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(4, camera.zoom * zoomFactor));

    // Adjust pan to keep point under cursor stationary
    const scale = baseScale * camera.zoom;
    const newScale = baseScale * newZoom;
    const scaleRatio = newScale / scale;

    // Get world coords before zoom
    const worldPos = canvasToWorld(cx, cy);

    // Calculate new camera position to keep world point under cursor
    const worldPixelSize = WORLD_SIZE * newScale;
    const offsetX = drawArea.left + (drawArea.width - worldPixelSize) / 2;
    const offsetY = drawArea.top + (drawArea.height - worldPixelSize) / 2;

    const newCameraX = cx - offsetX - (worldPos.x - WORLD_MIN) * newScale;
    const newCameraY = cy - offsetY - (WORLD_MAX - worldPos.y) * newScale;

    setCamera({
      x: newCameraX,
      y: newCameraY,
      zoom: newZoom
    });
  };

  const resetView = () => {
    setCamera({ x: 0, y: 0, zoom: 1 });
  };

  const zoomIn = () => {
    setCamera(c => ({ ...c, zoom: Math.min(4, c.zoom * 1.25) }));
  };

  const zoomOut = () => {
    setCamera(c => ({ ...c, zoom: Math.max(0.5, c.zoom * 0.8) }));
  };

  const getCursor = () => {
    if (interaction.type === 'pan') return 'grabbing';
    if (interaction.type === 'drag-entity') return 'move';
    return 'grab';
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0e14',
        borderRadius: '8px',
        overflow: 'hidden'
      }}
    >
      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        style={{
          display: 'block',
          cursor: getCursor()
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Zoom controls */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        right: '12px',
        display: 'flex',
        gap: '4px'
      }}>
        <button
          onClick={zoomIn}
          style={{
            padding: '6px 12px',
            fontSize: '16px',
            backgroundColor: '#16213e',
            color: '#aaa',
            border: '1px solid #0f3460',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          +
        </button>
        <button
          onClick={zoomOut}
          style={{
            padding: '6px 12px',
            fontSize: '16px',
            backgroundColor: '#16213e',
            color: '#aaa',
            border: '1px solid #0f3460',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          −
        </button>
        <button
          onClick={resetView}
          style={{
            padding: '6px 12px',
            fontSize: '14px',
            backgroundColor: '#16213e',
            color: '#aaa',
            border: '1px solid #0f3460',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reset
        </button>
      </div>

      {/* Zoom indicator */}
      <div style={{
        position: 'absolute',
        bottom: '12px',
        left: '12px',
        fontSize: '11px',
        color: '#666',
        backgroundColor: '#16213e',
        padding: '4px 8px',
        borderRadius: '4px'
      }}>
        {Math.round(camera.zoom * 100)}%
      </div>
    </div>
  );
}
