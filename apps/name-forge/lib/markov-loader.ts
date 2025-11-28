/**
 * Environment-aware Markov Model Loader
 *
 * Detects browser vs Node.js and uses appropriate loading mechanism:
 * - Node.js: Loads from bundled data directory using fs
 * - Browser: Loads via fetch from configurable base URL
 */

import type { MarkovModel, MarkovModelId } from "./markov.js";
import type { Grammar } from "./types/project.js";

// Environment detection - check for browser globals safely
const isBrowser =
  (typeof globalThis !== "undefined" &&
    typeof (globalThis as Record<string, unknown>).window !== "undefined") ||
  (typeof globalThis !== "undefined" &&
    typeof (globalThis as Record<string, unknown>).importScripts === "function");

// Model cache (shared across environments)
const modelCache = new Map<MarkovModelId, MarkovModel>();

// Browser base URL (configurable)
let browserBaseUrl = "/markov-models";

/**
 * Configure the base URL for browser model loading.
 * Call this before loading models in browser environment.
 *
 * @param baseUrl - Base URL where models are served (e.g., "/markov-models" or "https://cdn.example.com/models")
 */
export function setMarkovBaseUrl(baseUrl: string): void {
  browserBaseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
}

/**
 * Load a Markov model by ID.
 * Environment-aware: uses fetch in browser, fs in Node.js.
 *
 * @param modelId - The model ID to load
 * @returns The loaded model or null if not found
 */
export async function loadMarkovModel(
  modelId: MarkovModelId
): Promise<MarkovModel | null> {
  // Check cache first
  if (modelCache.has(modelId)) {
    return modelCache.get(modelId)!;
  }

  try {
    let model: MarkovModel | null = null;

    if (isBrowser) {
      model = await loadFromBrowser(modelId);
    } else {
      model = await loadFromNode(modelId);
    }

    if (model) {
      modelCache.set(modelId, model);
    }
    return model;
  } catch (error) {
    console.warn(`Failed to load Markov model '${modelId}':`, error);
    return null;
  }
}

/**
 * Load model using fetch (browser environment)
 */
async function loadFromBrowser(modelId: string): Promise<MarkovModel | null> {
  const url = `${browserBaseUrl}/${modelId}.json`;
  const response = await fetch(url);

  if (!response.ok) {
    console.warn(`Markov model '${modelId}' not found at ${url}`);
    return null;
  }

  return (await response.json()) as MarkovModel;
}

/**
 * Load model using fs (Node.js environment)
 */
async function loadFromNode(modelId: string): Promise<MarkovModel | null> {
  const fs = await import("fs");
  const path = await import("path");
  const { fileURLToPath } = await import("url");

  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  // Resolve project root - handle both source (lib/) and compiled (dist/lib/) paths
  const projectRoot = __dirname.includes("/dist/")
    ? path.join(__dirname, "..", "..")
    : path.join(__dirname, "..");

  const modelPath = path.join(
    projectRoot,
    "data",
    "markov",
    "models",
    `${modelId}.json`
  );

  if (!fs.existsSync(modelPath)) {
    console.warn(`Markov model '${modelId}' not found at ${modelPath}`);
    return null;
  }

  const data = fs.readFileSync(modelPath, "utf-8");
  return JSON.parse(data) as MarkovModel;
}

/**
 * Get a cached model or load it.
 *
 * @param modelId - The model ID
 * @returns The model or null if not found
 */
export async function getMarkovModel(
  modelId: MarkovModelId
): Promise<MarkovModel | null> {
  return loadMarkovModel(modelId);
}

/**
 * Check if a model is already cached.
 */
export function isModelCached(modelId: MarkovModelId): boolean {
  return modelCache.has(modelId);
}

/**
 * Extract Markov model IDs referenced in grammars.
 *
 * Scans grammar rules for `markov:modelId` tokens.
 */
export function extractMarkovModelIds(grammars: Grammar[]): MarkovModelId[] {
  const modelIds = new Set<MarkovModelId>();

  for (const grammar of grammars) {
    for (const productions of Object.values(grammar.rules || {})) {
      for (const production of productions) {
        for (const token of production) {
          const match = token.match(/markov:([a-z]+)/);
          if (match) {
            modelIds.add(match[1] as MarkovModelId);
          }
        }
      }
    }
  }

  return Array.from(modelIds);
}

/**
 * Preload all Markov models referenced in grammars.
 *
 * Call this before generating names to ensure models are cached.
 * Returns a Map suitable for passing to generate().
 *
 * @param grammars - Array of grammars to scan for markov:* references
 * @returns Map of model ID to loaded model
 */
export async function preloadModels(
  grammars: Grammar[]
): Promise<Map<string, MarkovModel>> {
  const modelIds = extractMarkovModelIds(grammars);
  const models = new Map<string, MarkovModel>();

  await Promise.all(
    modelIds.map(async (id) => {
      const model = await loadMarkovModel(id);
      if (model) {
        models.set(id, model);
      }
    })
  );

  return models;
}

/**
 * Preload specific models by ID.
 *
 * @param modelIds - Array of model IDs to load
 * @returns Map of model ID to loaded model
 */
export async function preloadModelsByIds(
  modelIds: MarkovModelId[]
): Promise<Map<string, MarkovModel>> {
  const models = new Map<string, MarkovModel>();

  await Promise.all(
    modelIds.map(async (id) => {
      const model = await loadMarkovModel(id);
      if (model) {
        models.set(id, model);
      }
    })
  );

  return models;
}

/**
 * Clear the model cache.
 * Useful for testing or freeing memory.
 */
export function clearModelCache(): void {
  modelCache.clear();
}

/**
 * Get all cached model IDs.
 */
export function getCachedModelIds(): MarkovModelId[] {
  return Array.from(modelCache.keys());
}
