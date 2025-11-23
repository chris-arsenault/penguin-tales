/**
 * Feedback Analyzer Service
 *
 * Validates that declared feedback loops are functioning correctly.
 * Detects broken loops and suggests corrections.
 */

import { Graph } from '../types/engine';
import { PopulationMetrics } from './populationTracker';

export interface FeedbackLoop {
  id: string;
  type: 'negative' | 'positive';  // negative = stabilizing, positive = amplifying

  // The chain
  source: string;        // What starts it (e.g., "npc:hero.count")
  mechanism: string[];   // How it propagates
  target: string;        // What it affects

  // Coefficients
  strength: number;      // Expected correlation strength
  delay: number;         // Ticks before effect shows

  // Validation
  active: boolean;
  lastValidated: number;
}

export interface ValidationResult {
  loop: FeedbackLoop;
  valid: boolean;
  correlation: number;
  expectedCorrelation: number;
  reason?: string;
  recommendation?: string;
}

export class FeedbackAnalyzer {
  private loops: Map<string, FeedbackLoop>;
  private validationHistory: Map<string, ValidationResult[]>;

  constructor(loops: FeedbackLoop[]) {
    this.loops = new Map(loops.map(loop => [loop.id, loop]));
    this.validationHistory = new Map();
  }

  /**
   * Validate all feedback loops
   */
  validateAll(metrics: PopulationMetrics, graph: Graph): ValidationResult[] {
    const results: ValidationResult[] = [];

    this.loops.forEach(loop => {
      if (!loop.active) return;

      const result = this.validateLoop(loop, metrics);
      results.push(result);

      // Store in history
      const history = this.validationHistory.get(loop.id) || [];
      history.push(result);
      if (history.length > 10) history.shift();
      this.validationHistory.set(loop.id, history);

      // Update loop
      loop.lastValidated = metrics.tick;
    });

    return results;
  }

  private validateLoop(loop: FeedbackLoop, metrics: PopulationMetrics): ValidationResult {
    // Parse source and target
    const source = this.parseMetricPath(loop.source, metrics);
    const target = this.parseMetricPath(loop.target, metrics);

    if (!source || !target) {
      return {
        loop,
        valid: false,
        correlation: 0,
        expectedCorrelation: loop.type === 'negative' ? -Math.abs(loop.strength) : Math.abs(loop.strength),
        reason: 'Source or target metric not found'
      };
    }

    // Check if we have enough history
    if (source.history.length < 5 || target.history.length < 5) {
      return {
        loop,
        valid: true, // Give it benefit of the doubt during warmup
        correlation: 0,
        expectedCorrelation: loop.type === 'negative' ? -Math.abs(loop.strength) : Math.abs(loop.strength),
        reason: 'Insufficient history (warmup period)'
      };
    }

    // Calculate correlation with delay offset
    const correlation = this.calculateCorrelation(
      source.history,
      target.history,
      loop.delay
    );

    const expectedCorrelation = loop.type === 'negative' ? -Math.abs(loop.strength) : Math.abs(loop.strength);
    const correlationMatch = Math.sign(correlation) === Math.sign(expectedCorrelation);
    const correlationStrong = Math.abs(correlation) >= Math.abs(expectedCorrelation) * 0.5; // Within 50%

    const valid = correlationMatch && correlationStrong;

    let reason: string | undefined;
    let recommendation: string | undefined;

    if (!valid) {
      if (!correlationMatch) {
        reason = `Wrong direction: expected ${expectedCorrelation > 0 ? 'positive' : 'negative'} correlation, got ${correlation.toFixed(2)}`;
        recommendation = `Reverse the mechanism or check if ${loop.source} actually affects ${loop.target}`;
      } else {
        reason = `Too weak: expected |correlation| >= ${Math.abs(expectedCorrelation) * 0.5}, got ${Math.abs(correlation).toFixed(2)}`;
        recommendation = `Increase feedback strength from ${loop.strength} to ${(loop.strength * 1.5).toFixed(2)}`;
      }
    }

    return {
      loop,
      valid,
      correlation,
      expectedCorrelation,
      reason,
      recommendation
    };
  }

  /**
   * Parse metric path (e.g., "npc:hero.count" or "conflict.value")
   */
  private parseMetricPath(path: string, metrics: PopulationMetrics): any {
    const parts = path.split('.');

    if (parts.length !== 2) return null;

    const [identifier, field] = parts;

    // Check if it's an entity metric
    if (identifier.includes(':')) {
      const metric = metrics.entities.get(identifier);
      return metric ? { history: metric.history, value: (metric as any)[field] } : null;
    }

    // Check if it's a relationship metric
    const relMetric = metrics.relationships.get(identifier);
    if (relMetric) {
      return { history: relMetric.history, value: (relMetric as any)[field] };
    }

    // Check if it's a pressure metric
    const pressureMetric = metrics.pressures.get(identifier);
    if (pressureMetric) {
      return { history: pressureMetric.history, value: (pressureMetric as any)[field] };
    }

    return null;
  }

  /**
   * Calculate Pearson correlation between two time series with optional delay
   */
  private calculateCorrelation(x: number[], y: number[], delay: number = 0): number {
    if (x.length !== y.length || x.length < 2) return 0;

    // Apply delay offset
    const n = Math.min(x.length - delay, y.length);
    if (n < 2) return 0;

    const xSlice = x.slice(x.length - n);
    const ySlice = delay > 0 ? y.slice(0, n) : y.slice(y.length - n);

    const meanX = xSlice.reduce((a, b) => a + b) / n;
    const meanY = ySlice.reduce((a, b) => a + b) / n;

    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;

    for (let i = 0; i < n; i++) {
      const dx = xSlice[i] - meanX;
      const dy = ySlice[i] - meanY;
      numerator += dx * dy;
      sumSqX += dx * dx;
      sumSqY += dy * dy;
    }

    const denominator = Math.sqrt(sumSqX * sumSqY);

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Get broken loops
   */
  getBrokenLoops(results: ValidationResult[]): ValidationResult[] {
    return results.filter(r => !r.valid && r.reason !== 'Insufficient history (warmup period)');
  }

  /**
   * Get loop by ID
   */
  getLoop(id: string): FeedbackLoop | undefined {
    return this.loops.get(id);
  }

  /**
   * Update loop coefficient (for auto-tuning)
   */
  updateLoopStrength(id: string, newStrength: number): void {
    const loop = this.loops.get(id);
    if (loop) {
      loop.strength = newStrength;
    }
  }
}
