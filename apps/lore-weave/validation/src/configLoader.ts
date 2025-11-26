/**
 * Config loader - extracts parameters from templateSystemParameters.json
 * and creates genome/parameter metadata
 */

import * as fs from 'fs';
import * as path from 'path';
import { Genome, ParameterMetadata } from './types';

export class ConfigLoader {
  private configPath: string;
  private parameterMetadata: ParameterMetadata[] = [];

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  /**
   * Load the config file and extract all numeric parameters
   */
  loadParameters(): { genome: Genome; metadata: ParameterMetadata[] } {
    const configData = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
    const genome = new Map<string, number>();
    this.parameterMetadata = [];

    // Extract from templates
    if (configData.templates) {
      this.extractParameters(configData.templates, 'templates', genome);
    }

    // Extract from systems
    if (configData.systems) {
      this.extractParameters(configData.systems, 'systems', genome);
    }

    return { genome, metadata: this.parameterMetadata };
  }

  /**
   * Recursively extract numeric parameters from nested object
   */
  private extractParameters(obj: any, basePath: string, genome: Genome): void {
    for (const key in obj) {
      const currentPath = `${basePath}.${key}`;
      const value = obj[key];

      if (typeof value === 'object' && value !== null) {
        // Recursively process nested objects
        this.extractParameters(value, currentPath, genome);
      } else if (typeof value === 'number') {
        // Found a numeric parameter
        genome.set(currentPath, value);

        // Create metadata for this parameter
        const metadata = this.inferMetadata(currentPath, value);
        this.parameterMetadata.push(metadata);
      }
    }
  }

  /**
   * Infer parameter metadata from path and value
   */
  private inferMetadata(path: string, value: number): ParameterMetadata {
    // Determine if integer or float
    const isInteger = Number.isInteger(value);
    const type: 'int' | 'float' = isInteger ? 'int' : 'float';

    // Infer reasonable bounds based on parameter name and value
    let min: number;
    let max: number;

    if (path.includes('Chance') || path.includes('Rate') || path.includes('Multiplier')) {
      // Probabilities and rates
      min = 0;
      max = type === 'float' ? 1.0 : 100;

      // If it's currently > 1, it's likely a multiplier
      if (value > 1) {
        max = type === 'float' ? 5.0 : 500;
      }
    } else if (path.includes('Cooldown') || path.includes('Period') || path.includes('Frequency')) {
      // Time-based parameters
      min = 1;
      max = type === 'int' ? 200 : 200.0;
    } else if (path.includes('Threshold')) {
      // Thresholds
      min = 0;
      max = type === 'float' ? 1.0 : 10;

      if (value > 1) {
        max = type === 'int' ? 100 : 10.0;
      }
    } else if (path.includes('Count') || path.includes('num') || path.includes('Max') || path.includes('Min') || path.includes('Size')) {
      // Count parameters
      min = 1;
      max = 20;
    } else if (path.includes('alpha') || path.includes('beta') || path.includes('Weight') || path.includes('Strength')) {
      // Model parameters
      min = 0;
      max = type === 'float' ? 2.0 : 100;
    } else if (path.includes('temperature') || path.includes('Temperature')) {
      // Temperature parameters (physics/model)
      min = 0.1;
      max = 5.0;
    } else {
      // Default bounds
      min = 0;
      max = type === 'float' ? 1.0 : 10;

      // Expand range if current value is outside
      if (value > max) {
        max = value * 2;
      }
    }

    return {
      path,
      type,
      min,
      max,
      default: value
    };
  }

  /**
   * Apply a genome to the config structure
   */
  applyGenomeToConfig(genome: Genome): any {
    const configData = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));

    // Apply each gene to the config
    for (const [path, value] of genome.entries()) {
      this.setNestedValue(configData, path, value);
    }

    return configData;
  }

  /**
   * Set a value in a nested object using dot-notation path
   */
  private setNestedValue(obj: any, path: string, value: number): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Save a genome as a new config file
   */
  saveGenomeAsConfig(genome: Genome, outputPath: string): void {
    const configData = this.applyGenomeToConfig(genome);
    const dir = path.dirname(outputPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(configData, null, 2));
  }

  /**
   * Get parameter metadata
   */
  getMetadata(): ParameterMetadata[] {
    return this.parameterMetadata;
  }

  /**
   * Clamp a value to parameter constraints
   */
  clampValue(metadata: ParameterMetadata, value: number): number {
    let clamped = Math.max(metadata.min, Math.min(metadata.max, value));

    // Round integers
    if (metadata.type === 'int') {
      clamped = Math.round(clamped);
    }

    return clamped;
  }
}
