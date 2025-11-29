/**
 * Name Forge Validation
 *
 * Validation metrics for testing name generation quality.
 */

// Types
export type {
  ValidationConfig,
  CapacityReport,
  DiffusenessReport,
  SeparationReport,
} from "./validation.js";

// Metrics
export {
  validateCapacity,
  calculateEntropy,
  estimateRequiredSamples,
  theoreticalCapacity,
} from "./metrics/capacity.js";

export {
  validateDiffuseness,
  findSimilarClusters,
  analyzeDiversity,
} from "./metrics/diffuseness.js";

export {
  validateSeparation,
} from "./metrics/separation.js";

// Analysis - Features
export {
  extractFeatures,
  estimateSyllableCount,
  calculateVowelRatio,
  countApostrophes,
  countHyphens,
  extractBigrams,
  getEnding,
  featureVectorToArray,
  buildVocabulary,
  calculateCentroid,
  normalizeFeatures,
} from "./analysis/features.js";

// Analysis - Distance
export {
  levenshtein,
  normalizedLevenshtein,
  toShapeKey,
  shapeDistance,
  pairwiseDistances,
  findNearestNeighbors,
  calculatePercentiles,
  euclideanDistance,
  cosineSimilarity,
} from "./analysis/distance.js";

// Analysis - Classifier
export {
  NearestCentroidClassifier,
  crossValidate,
} from "./analysis/classifier.js";
