/**
 * Feedback Analyzer Service
 *
 * Validates that declared feedback loops are functioning correctly.
 * Detects broken loops and suggests corrections.
 */

import { Graph, EngineConfig } from '../engine/types';
import { PopulationMetrics } from '../statistics/populationTracker';

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
  private config?: EngineConfig;

  constructor(loops: FeedbackLoop[], config?: EngineConfig) {
    this.loops = new Map(loops.map(loop => [loop.id, loop]));
    this.validationHistory = new Map();
    this.config = config;
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

  /**
   * ENFORCEMENT 4: Generate detailed diagnostics for broken feedback loops
   * Checks component contracts to identify why loops are not functioning
   */
  generateDetailedDiagnostics(brokenLoop: ValidationResult): string[] {
    const diagnostics: string[] = [];

    if (!this.config) {
      return [`No config available for contract analysis`];
    }

    const loop = brokenLoop.loop;

    // Parse mechanism to find involved components
    const components = loop.mechanism.map(m => {
      // Extract component ID from mechanism description
      // e.g., "template.hero_emergence creates heroes" -> "hero_emergence"
      const match = m.match(/template\.(\w+)|system\.(\w+)|pressure\.(\w+)/);
      return match ? match[1] || match[2] || match[3] : null;
    }).filter(Boolean) as string[];

    diagnostics.push(`Feedback Loop: ${loop.id}`);
    diagnostics.push(`Expected: ${loop.source} → ${loop.target} (${loop.type} feedback)`);
    diagnostics.push(`Problem: ${brokenLoop.reason}`);
    diagnostics.push(`Recommendation: ${brokenLoop.recommendation}`);
    diagnostics.push(``);

    // Check templates involved
    const templates = this.config.templates.filter(t => components.includes(t.id));
    if (templates.length > 0) {
      diagnostics.push(`Involved Templates:`);
      templates.forEach(t => {
        if (t.contract) {
          const affects = t.contract.affects;

          // Check if template affects the expected entities/pressures
          diagnostics.push(`  • ${t.id}`);

          if (affects.entities) {
            diagnostics.push(`      Creates: ${affects.entities.map(e => e.kind).join(', ')}`);
          }

          if (affects.pressures) {
            diagnostics.push(`      Affects pressures: ${affects.pressures.map(p => `${p.name} (${p.delta || 'formula'})`).join(', ')}`);
          }

          // Check if direction matches expectation
          if (loop.type === 'negative' && affects.pressures) {
            const pressureAffect = affects.pressures.find(p => loop.target.includes(p.name));
            if (pressureAffect && pressureAffect.delta && pressureAffect.delta > 0) {
              diagnostics.push(`      ⚠️  WARNING: Template increases '${pressureAffect.name}' but loop expects negative feedback!`);
            }
          }
        } else {
          diagnostics.push(`  • ${t.id} (no contract - cannot diagnose)`);
        }
      });
      diagnostics.push(``);
    }

    // Check systems involved
    const systems = this.config.systems.filter(s => components.includes(s.id));
    if (systems.length > 0) {
      diagnostics.push(`Involved Systems:`);
      systems.forEach(s => {
        if (s.contract) {
          const affects = s.contract.affects;

          diagnostics.push(`  • ${s.id}`);

          if (affects.entities) {
            diagnostics.push(`      Modifies: ${affects.entities.map(e => `${e.kind} (${e.operation})`).join(', ')}`);
          }

          if (affects.relationships) {
            diagnostics.push(`      ${affects.relationships.map(r => `${r.operation}s ${r.kind}`).join(', ')}`);
          }
        } else {
          diagnostics.push(`  • ${s.id} (no contract - cannot diagnose)`);
        }
      });
      diagnostics.push(``);
    }

    // Suggest fixes
    diagnostics.push(`Suggested Fixes:`);
    if (brokenLoop.reason?.includes('Wrong direction')) {
      diagnostics.push(`  1. Check if components actually implement the mechanism described`);
      diagnostics.push(`  2. Verify contract.affects declarations match actual behavior`);
      diagnostics.push(`  3. Consider inverting the feedback loop type (${loop.type} → ${loop.type === 'negative' ? 'positive' : 'negative'})`);
    } else if (brokenLoop.reason?.includes('Too weak')) {
      diagnostics.push(`  1. Increase loop.strength parameter from ${loop.strength} to ${(loop.strength * 1.5).toFixed(2)}`);
      diagnostics.push(`  2. Verify all components in mechanism chain are active`);
      diagnostics.push(`  3. Check if delay parameter (${loop.delay} ticks) is too long`);
    }

    return diagnostics;
  }

  /**
   * Print detailed diagnostics for all broken loops
   */
  printDetailedDiagnostics(results: ValidationResult[]): void {
    const brokenLoops = this.getBrokenLoops(results);

    if (brokenLoops.length === 0) {
      console.log('  ✓ All feedback loops functioning correctly');
      return;
    }

    console.log(`\n  Broken loops requiring attention:`);
    brokenLoops.forEach((broken, index) => {
      const diagnostics = this.generateDetailedDiagnostics(broken);

      console.log(`\n  ${index + 1}. ${broken.loop.id}`);
      console.log(`     ${broken.reason}`);
      console.log(`     → ${broken.recommendation}`);

      // Only show full diagnostics for first 3 broken loops (to avoid spam)
      if (index < 3 && this.config) {
        console.log(`\n     Detailed Analysis:`);
        diagnostics.forEach(line => {
          if (line.trim().length > 0) {
            console.log(`     ${line}`);
          }
        });
      }
    });

    if (brokenLoops.length > 3) {
      console.log(`\n     ... and ${brokenLoops.length - 3} more broken loops`);
      console.log(`     Use printDetailedDiagnostics() for full analysis`);
    }
  }
}
