/**
 * Genetic algorithm core - selection, crossover, mutation
 */

import { Genome, Individual, Population, ParameterMetadata, GAConfig } from './types';
import { ConfigLoader } from './configLoader';

export class GeneticAlgorithm {
  private config: GAConfig;
  private configLoader: ConfigLoader;
  private parameterMetadata: ParameterMetadata[];
  private generationCounter: number = 0;

  constructor(config: GAConfig, configLoader: ConfigLoader, parameterMetadata: ParameterMetadata[]) {
    this.config = config;
    this.configLoader = configLoader;
    this.parameterMetadata = parameterMetadata;
  }

  /**
   * Create initial population with random variations
   */
  createInitialPopulation(baseGenome: Genome): Individual[] {
    const individuals: Individual[] = [];

    for (let i = 0; i < this.config.populationSize; i++) {
      const genome = this.mutateGenome(new Map(baseGenome), 0.3); // Higher mutation for initial diversity
      individuals.push({
        id: `gen0_ind${i}`,
        genome,
        fitness: 0, // Will be evaluated later
        generation: 0
      });
    }

    return individuals;
  }

  /**
   * Evolve population to next generation
   */
  evolve(currentPopulation: Individual[]): Individual[] {
    this.generationCounter++;
    const nextGeneration: Individual[] = [];

    // Sort by fitness (descending)
    const sorted = [...currentPopulation].sort((a, b) => b.fitness - a.fitness);

    // Elitism: preserve top performers
    for (let i = 0; i < this.config.elitismCount && i < sorted.length; i++) {
      nextGeneration.push({
        ...sorted[i],
        id: `gen${this.generationCounter}_ind${i}`,
        generation: this.generationCounter
      });
    }

    // Generate rest of population through selection, crossover, and mutation
    while (nextGeneration.length < this.config.populationSize) {
      // Tournament selection
      const parent1 = this.tournamentSelection(sorted);
      const parent2 = this.tournamentSelection(sorted);

      // Crossover
      const childGenome = this.crossover(parent1.genome, parent2.genome);

      // Mutation
      const mutatedGenome = this.mutateGenome(childGenome, this.config.mutationRate);

      nextGeneration.push({
        id: `gen${this.generationCounter}_ind${nextGeneration.length}`,
        genome: mutatedGenome,
        fitness: 0, // Will be evaluated later
        generation: this.generationCounter
      });
    }

    return nextGeneration;
  }

  /**
   * Tournament selection: pick best from random subset
   */
  private tournamentSelection(population: Individual[]): Individual {
    const tournament: Individual[] = [];

    for (let i = 0; i < this.config.tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * population.length);
      tournament.push(population[randomIndex]);
    }

    // Return best from tournament
    return tournament.reduce((best, current) =>
      current.fitness > best.fitness ? current : best
    );
  }

  /**
   * Uniform crossover: randomly pick genes from each parent
   */
  private crossover(genome1: Genome, genome2: Genome): Genome {
    const childGenome = new Map<string, number>();

    for (const [path, value1] of genome1.entries()) {
      const value2 = genome2.get(path);

      if (value2 !== undefined) {
        // 50% chance from each parent
        const value = Math.random() < 0.5 ? value1 : value2;
        childGenome.set(path, value);
      } else {
        childGenome.set(path, value1);
      }
    }

    return childGenome;
  }

  /**
   * Mutate genome by randomly adjusting values
   */
  private mutateGenome(genome: Genome, mutationRate: number): Genome {
    const mutated = new Map(genome);

    for (const metadata of this.parameterMetadata) {
      if (Math.random() < mutationRate) {
        const currentValue = mutated.get(metadata.path);
        if (currentValue !== undefined) {
          const newValue = this.mutateValue(metadata, currentValue);
          mutated.set(metadata.path, newValue);
        }
      }
    }

    return mutated;
  }

  /**
   * Mutate a single value using Gaussian noise
   */
  private mutateValue(metadata: ParameterMetadata, currentValue: number): number {
    const range = metadata.max - metadata.min;
    const sigma = range * 0.15; // 15% of range as standard deviation

    // Gaussian mutation
    const delta = this.gaussianRandom() * sigma;
    let newValue = currentValue + delta;

    // Clamp to bounds
    newValue = this.configLoader.clampValue(metadata, newValue);

    return newValue;
  }

  /**
   * Generate random number from standard normal distribution (Box-Muller transform)
   */
  private gaussianRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Calculate population statistics
   */
  calculatePopulationStats(individuals: Individual[]): Population['stats'] {
    if (individuals.length === 0) {
      return {
        bestFitness: 0,
        averageFitness: 0,
        worstFitness: 0,
        diversity: 0
      };
    }

    const fitnesses = individuals.map(i => i.fitness);
    const bestFitness = Math.max(...fitnesses);
    const worstFitness = Math.min(...fitnesses);
    const averageFitness = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;

    // Calculate genetic diversity as average pairwise distance
    const diversity = this.calculateDiversity(individuals);

    return {
      bestFitness,
      averageFitness,
      worstFitness,
      diversity
    };
  }

  /**
   * Calculate genetic diversity (average normalized Euclidean distance)
   */
  private calculateDiversity(individuals: Individual[]): number {
    if (individuals.length < 2) return 0;

    let totalDistance = 0;
    let comparisons = 0;

    for (let i = 0; i < individuals.length - 1; i++) {
      for (let j = i + 1; j < individuals.length; j++) {
        totalDistance += this.genomicDistance(individuals[i].genome, individuals[j].genome);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalDistance / comparisons : 0;
  }

  /**
   * Calculate normalized Euclidean distance between two genomes
   */
  private genomicDistance(genome1: Genome, genome2: Genome): number {
    let sumSquaredDiff = 0;
    let count = 0;

    for (const metadata of this.parameterMetadata) {
      const val1 = genome1.get(metadata.path);
      const val2 = genome2.get(metadata.path);

      if (val1 !== undefined && val2 !== undefined) {
        const range = metadata.max - metadata.min;
        const normalizedDiff = (val1 - val2) / range;
        sumSquaredDiff += normalizedDiff * normalizedDiff;
        count++;
      }
    }

    return count > 0 ? Math.sqrt(sumSquaredDiff / count) : 0;
  }

}
