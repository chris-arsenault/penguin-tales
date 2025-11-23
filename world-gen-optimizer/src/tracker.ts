/**
 * Evolution tracker - tracks history and maintains top configurations
 */

import * as fs from 'fs';
import * as path from 'path';
import { Individual, Population, GenerationRecord, TopConfiguration } from './types';
import { ConfigLoader } from './configLoader';

export class EvolutionTracker {
  private history: GenerationRecord[] = [];
  private topConfigurations: TopConfiguration[] = [];
  private topN: number;
  private outputDir: string;
  private configLoader: ConfigLoader;

  constructor(outputDir: string, configLoader: ConfigLoader, topN: number = 5) {
    this.outputDir = outputDir;
    this.configLoader = configLoader;
    this.topN = topN;

    this.ensureOutputDir();
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDir(): void {
    const topConfigsDir = path.join(this.outputDir, 'top_configs');
    if (!fs.existsSync(topConfigsDir)) {
      fs.mkdirSync(topConfigsDir, { recursive: true });
    }
  }

  /**
   * Record a generation
   */
  recordGeneration(population: Population): void {
    const sorted = [...population.individuals].sort((a, b) => b.fitness - a.fitness);
    const best = sorted[0];

    const record: GenerationRecord = {
      generation: population.generation,
      timestamp: new Date().toISOString(),
      bestFitness: population.stats.bestFitness,
      averageFitness: population.stats.averageFitness,
      worstFitness: population.stats.worstFitness,
      diversity: population.stats.diversity,
      bestIndividual: {
        id: best.id,
        fitness: best.fitness,
        fitnessBreakdown: best.fitnessBreakdown
      }
    };

    this.history.push(record);

    // Update top configurations
    this.updateTopConfigurations(best, population.generation);
  }

  /**
   * Update top configurations list
   */
  private updateTopConfigurations(individual: Individual, generation: number): void {
    // Check if this individual should be in top N
    const shouldInclude = this.topConfigurations.length < this.topN ||
      individual.fitness > this.topConfigurations[this.topConfigurations.length - 1].individual.fitness;

    if (!shouldInclude) {
      return;
    }

    // Add to list
    const topConfig: TopConfiguration = {
      rank: 0, // Will be set after sorting
      individual: { ...individual },
      discoveredInGeneration: generation,
      timestamp: new Date().toISOString()
    };

    this.topConfigurations.push(topConfig);

    // Sort by fitness descending
    this.topConfigurations.sort((a, b) => b.individual.fitness - a.individual.fitness);

    // Keep only top N
    if (this.topConfigurations.length > this.topN) {
      this.topConfigurations = this.topConfigurations.slice(0, this.topN);
    }

    // Update ranks
    this.topConfigurations.forEach((config, index) => {
      config.rank = index + 1;
    });
  }

  /**
   * Get evolution history
   */
  getHistory(): GenerationRecord[] {
    return this.history;
  }

  /**
   * Get top configurations
   */
  getTopConfigurations(): TopConfiguration[] {
    return this.topConfigurations;
  }

  /**
   * Save evolution history to file
   */
  saveHistory(): void {
    const historyPath = path.join(this.outputDir, 'evolution_history.json');
    const data = {
      totalGenerations: this.history.length,
      startTime: this.history[0]?.timestamp,
      endTime: this.history[this.history.length - 1]?.timestamp,
      finalBestFitness: this.history[this.history.length - 1]?.bestFitness,
      history: this.history
    };

    fs.writeFileSync(historyPath, JSON.stringify(data, null, 2));
    console.log(`\nEvolution history saved to: ${historyPath}`);
  }

  /**
   * Save top configurations
   */
  saveTopConfigurations(): void {
    const topConfigsDir = path.join(this.outputDir, 'top_configs');

    for (const config of this.topConfigurations) {
      const filename = `rank_${config.rank}.json`;
      const filepath = path.join(topConfigsDir, filename);

      const data = {
        rank: config.rank,
        fitness: config.individual.fitness,
        fitnessBreakdown: config.individual.fitnessBreakdown,
        discoveredInGeneration: config.discoveredInGeneration,
        timestamp: config.timestamp,
        configuration: this.configLoader.applyGenomeToConfig(config.individual.genome)
      };

      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    }

    console.log(`\nTop ${this.topConfigurations.length} configurations saved to: ${topConfigsDir}/`);
  }

  /**
   * Save final best configuration
   */
  saveFinalBest(): void {
    if (this.topConfigurations.length === 0) {
      console.warn('No configurations to save');
      return;
    }

    const best = this.topConfigurations[0];
    const filepath = path.join(this.outputDir, 'final_best.json');

    const data = {
      fitness: best.individual.fitness,
      fitnessBreakdown: best.individual.fitnessBreakdown,
      discoveredInGeneration: best.discoveredInGeneration,
      timestamp: best.timestamp,
      configuration: this.configLoader.applyGenomeToConfig(best.individual.genome)
    };

    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`\nFinal best configuration saved to: ${filepath}`);
  }

  /**
   * Print current progress
   */
  printProgress(generation: number): void {
    if (this.history.length === 0) return;

    const latest = this.history[this.history.length - 1];
    const best = this.topConfigurations[0];

    console.log(`\n--- Generation ${generation} ---`);
    console.log(`Best fitness: ${latest.bestFitness.toFixed(4)}`);
    console.log(`Average fitness: ${latest.averageFitness.toFixed(4)}`);
    console.log(`Diversity: ${latest.diversity.toFixed(4)}`);

    if (best && latest.bestFitness >= best.individual.fitness) {
      console.log(`🏆 New best configuration!`);
    }

    if (latest.bestIndividual.fitnessBreakdown) {
      console.log('\nFitness breakdown:');
      console.log(`  Entity distribution: ${latest.bestIndividual.fitnessBreakdown.entityDistribution.toFixed(4)}`);
      console.log(`  Prominence distribution: ${latest.bestIndividual.fitnessBreakdown.prominenceDistribution.toFixed(4)}`);
      console.log(`  Relationship diversity: ${latest.bestIndividual.fitnessBreakdown.relationshipDiversity.toFixed(4)}`);
      console.log(`  Connectivity: ${latest.bestIndividual.fitnessBreakdown.connectivity.toFixed(4)}`);
      console.log(`  Overall: ${latest.bestIndividual.fitnessBreakdown.overall.toFixed(4)}`);
    }
  }

  /**
   * Print final summary
   */
  printSummary(): void {
    if (this.history.length === 0) {
      console.log('\nNo generations recorded');
      return;
    }

    console.log('\n========================================');
    console.log('OPTIMIZATION COMPLETE');
    console.log('========================================');

    const first = this.history[0];
    const last = this.history[this.history.length - 1];
    const improvement = last.bestFitness - first.bestFitness;
    const improvementPercent = (improvement / first.bestFitness) * 100;

    console.log(`\nTotal generations: ${this.history.length}`);
    console.log(`Initial best fitness: ${first.bestFitness.toFixed(4)}`);
    console.log(`Final best fitness: ${last.bestFitness.toFixed(4)}`);
    console.log(`Improvement: ${improvement.toFixed(4)} (${improvementPercent.toFixed(2)}%)`);

    console.log('\n--- Top 5 Configurations ---');
    for (const config of this.topConfigurations) {
      console.log(`\nRank ${config.rank}:`);
      console.log(`  Fitness: ${config.individual.fitness.toFixed(4)}`);
      console.log(`  Discovered in generation: ${config.discoveredInGeneration}`);

      if (config.individual.fitnessBreakdown) {
        console.log(`  Breakdown:`);
        console.log(`    Entity: ${config.individual.fitnessBreakdown.entityDistribution.toFixed(3)}`);
        console.log(`    Prominence: ${config.individual.fitnessBreakdown.prominenceDistribution.toFixed(3)}`);
        console.log(`    Relationships: ${config.individual.fitnessBreakdown.relationshipDiversity.toFixed(3)}`);
        console.log(`    Connectivity: ${config.individual.fitnessBreakdown.connectivity.toFixed(3)}`);
        console.log(`    Overall: ${config.individual.fitnessBreakdown.overall.toFixed(3)}`);
      }
    }

    console.log('\n========================================');
  }

  /**
   * Save all outputs
   */
  saveAll(): void {
    this.saveHistory();
    this.saveTopConfigurations();
    this.saveFinalBest();
  }
}
