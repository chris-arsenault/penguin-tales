/**
 * Shared scale creators for the simulation trace visualization
 */

import { scaleLinear } from '@visx/scale';

/**
 * Create X scale for tick values
 */
export function createXScale(data, width, margin) {
  if (!data?.length) {
    return scaleLinear({
      domain: [0, 100],
      range: [margin.left, width - margin.right],
    });
  }

  const ticks = data.map(d => d.tick);
  return scaleLinear({
    domain: [Math.min(...ticks), Math.max(...ticks)],
    range: [margin.left, width - margin.right],
  });
}

/**
 * Create Y scale for pressure values
 *
 * Note: `chartBottom` is the y-coordinate of the bottom of the chart area.
 * This is NOT height - margin.bottom; the caller passes the actual bottom coordinate.
 */
export function createPressureYScale(data, pressureIds, chartBottom, margin) {
  if (!data?.length || !pressureIds?.length) {
    return scaleLinear({
      domain: [0, 100],
      range: [chartBottom, margin.top],
    });
  }

  let min = Infinity;
  let max = -Infinity;

  for (const point of data) {
    for (const id of pressureIds) {
      const val = point[id];
      if (typeof val === 'number') {
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }
  }

  // Add some padding
  const padding = (max - min) * 0.1 || 10;

  return scaleLinear({
    domain: [Math.max(0, min - padding), max + padding],
    range: [chartBottom, margin.top],
    nice: true,
  });
}

/**
 * Default margins
 */
export const DEFAULT_MARGIN = {
  top: 20,
  right: 30,
  bottom: 80, // Extra space for swimlanes and era timeline
  left: 50,
};

/**
 * Swimlane configuration
 */
export const SWIMLANE_CONFIG = {
  height: 24,
  gap: 2,
  types: ['template', 'system', 'action'],
};

/**
 * Era timeline configuration
 */
export const ERA_TIMELINE_HEIGHT = 36;
