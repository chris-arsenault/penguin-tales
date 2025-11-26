/**
 * Diagnostic utilities to verify GA is working correctly
 */

import { Individual, Population } from './types';

export interface GenerationDiagnostics {
  generation: number;

  // Fitness stats
  bestFitness: number;
  worstFitness: number;
  avgFitness: number;

  // Violation stats
  bestViolationRate: number;
  worstViolationRate: number;
  avgViolationRate: number;

  // Sanity checks
  fitnessIncreasing: boolean;  // Best fitness should increase or stay same (elitism)
  violationsDecreasing: boolean;  // Violations should decrease if GA working
  selectionWorking: boolean;  // Best should be better than average
}

export class GADiagnostics {
  private history: GenerationDiagnostics[] = [];

  recordGeneration(population: Population): void {
    const individuals = population.individuals;

    // Fitness stats
    const fitnesses = individuals.map(i => i.fitness);
    const bestFitness = Math.max(...fitnesses);
    const worstFitness = Math.min(...fitnesses);
    const avgFitness = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;

    // Violation stats
    const violationRates = individuals
      .map(i => i.violationMetrics?.violationRate)
      .filter((v): v is number => v !== undefined);

    const bestViolationRate = violationRates.length > 0 ? Math.min(...violationRates) : 0;
    const worstViolationRate = violationRates.length > 0 ? Math.max(...violationRates) : 0;
    const avgViolationRate = violationRates.length > 0
      ? violationRates.reduce((a, b) => a + b, 0) / violationRates.length
      : 0;

    // Sanity checks
    const previousBest = this.history.length > 0
      ? this.history[this.history.length - 1].bestFitness
      : bestFitness;

    const previousAvgViolations = this.history.length > 0
      ? this.history[this.history.length - 1].avgViolationRate
      : avgViolationRate;

    const fitnessIncreasing = bestFitness >= previousBest - 0.001; // Allow tiny rounding errors
    const violationsDecreasing = avgViolationRate < previousAvgViolations || population.generation < 5;
    const selectionWorking = bestFitness > avgFitness;

    const diagnostics: GenerationDiagnostics = {
      generation: population.generation,
      bestFitness,
      worstFitness,
      avgFitness,
      bestViolationRate,
      worstViolationRate,
      avgViolationRate,
      fitnessIncreasing,
      violationsDecreasing,
      selectionWorking
    };

    this.history.push(diagnostics);
  }

  printDiagnostics(generation: number): void {
    const current = this.history[this.history.length - 1];
    if (!current) return;

    console.log('\n--- GA DIAGNOSTICS ---');

    // Fitness trend
    if (this.history.length >= 5) {
      const recent = this.history.slice(-5);
      const fitnessChange = recent[recent.length - 1].bestFitness - recent[0].bestFitness;
      const violationChange = recent[recent.length - 1].avgViolationRate - recent[0].avgViolationRate;

      console.log(`Last 5 gen fitness trend: ${fitnessChange >= 0 ? '+' : ''}${fitnessChange.toFixed(4)}`);
      console.log(`Last 5 gen violation trend: ${violationChange >= 0 ? '+' : ''}${violationChange.toFixed(2)}/tick`);
    }

    // Sanity checks
    const issues: string[] = [];

    if (!current.fitnessIncreasing && generation > 0) {
      issues.push('❌ Best fitness DECREASED (elitism bug?)');
    }

    if (!current.selectionWorking) {
      issues.push('❌ Best = Average (selection not working?)');
    }

    if (generation > 20 && this.checkStagnation()) {
      issues.push('⚠️  STAGNATION: No improvement in 20 generations');
    }

    if (generation > 10 && this.checkViolationsIncreasing()) {
      issues.push('🔴 VIOLATIONS INCREASING (fitness function bug?)');
    }

    if (issues.length > 0) {
      console.log('\nISSUES DETECTED:');
      issues.forEach(issue => console.log(`  ${issue}`));
    } else {
      console.log('✓ GA sanity checks passed');
    }

    // Current stats
    console.log(`\nCurrent population:`);
    console.log(`  Best violations: ${current.bestViolationRate.toFixed(2)}/tick`);
    console.log(`  Avg violations:  ${current.avgViolationRate.toFixed(2)}/tick`);
    console.log(`  Worst violations: ${current.worstViolationRate.toFixed(2)}/tick`);
    console.log(`  Spread: ${(current.worstViolationRate - current.bestViolationRate).toFixed(2)}/tick`);
  }

  private checkStagnation(): boolean {
    if (this.history.length < 20) return false;

    const recent = this.history.slice(-20);
    const firstFitness = recent[0].bestFitness;
    const lastFitness = recent[recent.length - 1].bestFitness;

    return Math.abs(lastFitness - firstFitness) < 0.001;
  }

  private checkViolationsIncreasing(): boolean {
    if (this.history.length < 10) return false;

    const recent = this.history.slice(-10);
    const firstViolations = recent[0].avgViolationRate;
    const lastViolations = recent[recent.length - 1].avgViolationRate;

    return lastViolations > firstViolations + 0.5; // Violations went UP by 0.5/tick
  }

  getHistory(): GenerationDiagnostics[] {
    return this.history;
  }
}
