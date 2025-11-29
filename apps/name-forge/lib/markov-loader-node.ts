/**
 * Node.js Markov Model Loader
 *
 * Loads models from the bundled data directory using fs.
 * This file should only be imported in Node.js environments.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { MarkovModel } from "./markov.js";

// Resolve paths once at module load
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = __dirname.includes("/dist/")
  ? path.join(__dirname, "..", "..")
  : path.join(__dirname, "..");
const modelsDir = path.join(projectRoot, "data", "markov", "models");

/**
 * Load a model from the filesystem.
 */
export function loadModelFromFilesystem(modelId: string): MarkovModel | null {
  const modelPath = path.join(modelsDir, `${modelId}.json`);

  if (!fs.existsSync(modelPath)) {
    console.warn(`Markov model '${modelId}' not found at ${modelPath}`);
    return null;
  }

  const data = fs.readFileSync(modelPath, "utf-8");
  return JSON.parse(data) as MarkovModel;
}
