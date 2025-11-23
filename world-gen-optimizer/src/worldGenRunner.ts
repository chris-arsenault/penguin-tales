/**
 * World-gen runner - executes world-gen with specific configurations
 * Supports parallel execution with worker pool
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { Individual } from './types';
import { ConfigLoader } from './configLoader';
import { FitnessEvaluator } from './fitnessEvaluator';

export interface RunResult {
  individual: Individual;
  success: boolean;
  error?: string;
}

export class WorldGenRunner {
  private worldGenPath: string;
  private tempConfigDir: string;
  private tempOutputDir: string;
  private configLoader: ConfigLoader;
  private fitnessEvaluator: FitnessEvaluator;
  private maxParallel: number;

  constructor(
    worldGenPath: string,
    configLoader: ConfigLoader,
    fitnessEvaluator: FitnessEvaluator,
    maxParallel: number = 4
  ) {
    this.worldGenPath = worldGenPath;
    this.configLoader = configLoader;
    this.fitnessEvaluator = fitnessEvaluator;
    this.maxParallel = maxParallel;

    // Setup run directories (matching world-gen's structure)
    this.tempConfigDir = path.join(worldGenPath, 'config', 'runs');
    this.tempOutputDir = path.join(worldGenPath, 'output', 'runs');

    this.ensureDirectories();
  }

  /**
   * Ensure temp directories exist
   */
  private ensureDirectories(): void {
    if (!fs.existsSync(this.tempConfigDir)) {
      fs.mkdirSync(this.tempConfigDir, { recursive: true });
    }
    if (!fs.existsSync(this.tempOutputDir)) {
      fs.mkdirSync(this.tempOutputDir, { recursive: true });
    }
  }

  /**
   * Evaluate a batch of individuals in parallel
   */
  async evaluateBatch(individuals: Individual[]): Promise<RunResult[]> {
    const results: RunResult[] = [];
    const queue = [...individuals];

    // Process in parallel batches
    while (queue.length > 0) {
      const batch = queue.splice(0, this.maxParallel);
      const batchResults = await Promise.all(
        batch.map(individual => this.evaluateIndividual(individual))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Evaluate a single individual
   */
  async evaluateIndividual(individual: Individual): Promise<RunResult> {
    const runId = individual.id;

    try {
      // Save genome as config file in run-specific directory
      const runConfigDir = path.join(this.tempConfigDir, runId);
      if (!fs.existsSync(runConfigDir)) {
        fs.mkdirSync(runConfigDir, { recursive: true });
      }
      const configPath = path.join(runConfigDir, 'templateSystemParameters.json');
      this.configLoader.saveGenomeAsConfig(individual.genome, configPath);

      // Run world-gen with run-id (it will automatically find the config)
      const success = await this.runWorldGen(runId);

      if (!success) {
        return {
          individual,
          success: false,
          error: 'World-gen execution failed'
        };
      }

      // Load stats and calculate fitness
      const statsPath = path.join(this.tempOutputDir, runId, 'stats.json');
      const evaluation = this.fitnessEvaluator.evaluateFromFile(statsPath);

      if (!evaluation) {
        return {
          individual,
          success: false,
          error: 'Failed to load or parse stats'
        };
      }

      // Update individual with fitness
      individual.fitness = evaluation.fitness;
      individual.fitnessBreakdown = evaluation.breakdown;
      individual.violationMetrics = evaluation.violationMetrics;

      // Cleanup temp files
      this.cleanupRun(runId);

      return {
        individual,
        success: true
      };
    } catch (error) {
      return {
        individual,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Run world-gen with specific run-id
   * World-gen will automatically look for config in config/runs/{runId}/templateSystemParameters.json
   * and output to output/runs/{runId}/
   */
  private runWorldGen(runId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('npm', ['start', '--', '--run-id', runId], {
        cwd: this.worldGenPath,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          console.error(`World-gen failed for ${runId}:`);
          console.error(stderr);
          resolve(false);
        } else {
          resolve(true);
        }
      });

      child.on('error', (error) => {
        console.error(`Failed to spawn world-gen for ${runId}:`, error);
        resolve(false);
      });
    });
  }

  /**
   * Cleanup temporary files for a run
   */
  private cleanupRun(runId: string): void {
    try {
      // Remove config directory
      const configDir = path.join(this.tempConfigDir, runId);
      if (fs.existsSync(configDir)) {
        fs.rmSync(configDir, { recursive: true, force: true });
      }

      // Remove output directory
      const outputDir = path.join(this.tempOutputDir, runId);
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`Failed to cleanup run ${runId}:`, error);
    }
  }

  /**
   * Cleanup all temp files
   */
  cleanupAll(): void {
    try {
      if (fs.existsSync(this.tempConfigDir)) {
        fs.rmSync(this.tempConfigDir, { recursive: true, force: true });
        fs.mkdirSync(this.tempConfigDir, { recursive: true });
      }
      if (fs.existsSync(this.tempOutputDir)) {
        fs.rmSync(this.tempOutputDir, { recursive: true, force: true });
        fs.mkdirSync(this.tempOutputDir, { recursive: true });
      }
    } catch (error) {
      console.warn('Failed to cleanup temp directories:', error);
    }
  }
}
