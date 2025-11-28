/**
 * Penguin Tales - World Generation Runner
 *
 * This is the domain-specific entry point that uses the Lore Weave framework
 * to generate penguin colony world history.
 */

import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Framework imports from lore-weave
import {
  WorldEngine,
  EnrichmentService,
  ImageGenerationService,
  normalizeInitialState,
  validateWorld,
  applyParameterOverrides,
  relationshipCulling,
  NameForgeService
} from '@lore-weave/core/index.js';

import type {
  EngineConfig,
  HardState,
  DistributionTargets,
  NameForgeConfig
} from '@lore-weave/core/index.js';

// Domain imports (penguin-specific)
import {
  penguinDomain,
  penguinEras,
  pressures,
  allTemplates,
  allSystems as penguinSystems,
  initialState as penguinInitialState,
  penguinEntityRegistries
} from './index.js';

import { penguinLoreProvider } from './config/loreProvider.js';
import { penguinRegionConfig, penguinKindMaps, penguinKindRegionConfig } from './config/regions.js';
import { penguinFeedbackLoops } from './config/feedbackLoops.js';
import { penguinTagRegistry } from './config/tagRegistry.js';

// Import configuration (domain-specific parameters)
import distributionTargetsData from './config/json/distributionTargets.json' with { type: 'json' };
import parameterOverridesData from './config/json/templateSystemParameters.json' with { type: 'json' };
import nameForgeConfigData from './config/nameforge.json' with { type: 'json' };

// Create NameForgeService from config (cast through unknown for JSON import compatibility)
const nameForgeService = new NameForgeService(nameForgeConfigData as unknown as NameForgeConfig);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sanitize = (value?: string | null): string => (value ?? '').trim();

// ============================================================================
// SCALING CONFIGURATION
// ============================================================================
// Master scale factor for world size. Affects all entity caps, tick limits,
// and relationship budgets proportionally. Default: 1.0 (baseline ~150 entities)
const SCALE_FACTOR = parseFloat(sanitize(process.env.SCALE_FACTOR)) || 1.0;
console.log(`📏 Scale Factor: ${SCALE_FACTOR}x`);

// Scale distribution targets (deep clone and scale all numeric "target" fields)
function scaleDistributionTargets(targets: any, scale: number): any {
  if (typeof targets !== 'object' || targets === null) return targets;
  if (Array.isArray(targets)) return targets.map(item => scaleDistributionTargets(item, scale));

  const scaled: any = {};
  for (const [key, value] of Object.entries(targets)) {
    if (key === 'target' && typeof value === 'number') {
      scaled[key] = Math.ceil(value * scale);
    } else if (typeof value === 'object') {
      scaled[key] = scaleDistributionTargets(value, scale);
    } else {
      scaled[key] = value;
    }
  }
  return scaled;
}

const scaledDistributionTargets = scaleDistributionTargets(distributionTargetsData, SCALE_FACTOR);

// Scale entity registries (shallow clone that preserves functions)
function scaleEntityRegistries(registries: any[], scale: number): any[] {
  return registries.map(registry => {
    // Shallow clone the registry, preserving functions
    const scaled = { ...registry };

    // Scale creators targetCount (create new array to avoid mutating original)
    if (registry.creators) {
      scaled.creators = registry.creators.map((creator: any) => ({
        ...creator,
        targetCount: creator.targetCount ? Math.ceil(creator.targetCount * scale) : creator.targetCount
      }));
    }

    // Scale expectedDistribution.targetCount (create new object to avoid mutating original)
    if (registry.expectedDistribution?.targetCount) {
      scaled.expectedDistribution = {
        ...registry.expectedDistribution,
        targetCount: Math.ceil(registry.expectedDistribution.targetCount * scale)
      };
    }

    return scaled;
  });
}

const scaledEntityRegistries = scaleEntityRegistries(penguinEntityRegistries, SCALE_FACTOR);

// Parse CLI arguments
function parseArgs(): { runId?: string; configPath?: string } {
  const args = process.argv.slice(2);
  let runId: string | undefined;
  let configPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--run-id' && i + 1 < args.length) {
      runId = args[i + 1];
      i++;
    } else if (args[i] === '--config' && i + 1 < args.length) {
      configPath = args[i + 1];
      i++;
    }
  }

  return { runId, configPath };
}

// LLM / lore configuration (default disabled to prevent accidents)
const llmEnv = sanitize(process.env.LLM_ENABLED).toLowerCase();
const llmPartial = llmEnv === 'partial';
const llmEnabled = llmEnv === 'true' || llmEnv === 'full' || llmPartial;
const llmMode: 'off' | 'partial' | 'full' = llmEnabled ? (llmPartial ? 'partial' : 'full') : 'off';
const llmModel = sanitize(process.env.LLM_MODEL) || 'claude-3-5-haiku-20241022';
const llmConfig = {
  enabled: llmEnabled,
  model: llmModel,
  apiKey: sanitize(process.env.ANTHROPIC_API_KEY),
  maxTokens: 512,
  temperature: 0.4
};
const enrichmentConfig = {
  batchSize: Number(process.env.LLM_BATCH_SIZE) || 2,
  mode: llmMode,
  maxEntityEnrichments: llmPartial ? 1 : undefined,
  maxRelationshipEnrichments: llmPartial ? 1 : undefined,
  maxEraNarratives: llmPartial ? 1 : undefined
};
const enrichmentService = llmEnabled
  ? new EnrichmentService(llmConfig, penguinLoreProvider, enrichmentConfig)
  : undefined;

// Image generation configuration (using OpenAI DALL-E)
const imageGenEnv = sanitize(process.env.IMAGE_GENERATION_ENABLED).toLowerCase();
const imageGenEnabled = imageGenEnv === 'true';
const imageGenConfig = {
  enabled: imageGenEnabled,
  apiKey: sanitize(process.env.OPENAI_API_KEY),
  model: sanitize(process.env.IMAGE_MODEL) || 'dall-e-3',
  size: (sanitize(process.env.IMAGE_SIZE) || '1024x1024') as '1024x1024' | '1792x1024' | '1024x1792',
  quality: (sanitize(process.env.IMAGE_QUALITY) || 'standard') as 'standard' | 'hd',
  promptConfig: penguinDomain.imageGenerationConfig
};
const imageGenerationService = imageGenEnabled
  ? new ImageGenerationService(imageGenConfig)
  : undefined;

// Parse CLI arguments and load appropriate config
const cliArgs = parseArgs();
let parameterOverrides = parameterOverridesData;

// Load config in priority order:
// 1. Explicit --config path
// 2. Run-specific config (./config/runs/{runId}/templateSystemParameters.json)
// 3. Default config (./config/templateSystemParameters.json)
if (cliArgs.configPath) {
  // Explicit config path provided
  const customConfigPath = path.join(__dirname, 'config/json', cliArgs.configPath);
  if (fs.existsSync(customConfigPath)) {
    parameterOverrides = JSON.parse(fs.readFileSync(customConfigPath, 'utf-8'));
    console.log(`📂 Using config: ${cliArgs.configPath}`);
  } else {
    console.warn(`⚠️  Custom config not found: ${customConfigPath}, using default`);
  }
} else if (cliArgs.runId) {
  // Check for run-specific config
  const runConfigPath = path.join(__dirname, `config/json/runs/${cliArgs.runId}/templateSystemParameters.json`);
  if (fs.existsSync(runConfigPath)) {
    parameterOverrides = JSON.parse(fs.readFileSync(runConfigPath, 'utf-8'));
    console.log(`📂 Using run-specific config: config/json/runs/${cliArgs.runId}/templateSystemParameters.json`);
  } else {
    console.log(`📂 Using default config (no run-specific config found)`);
  }
} else {
  console.log(`📂 Using default config`);
}

// Combine domain systems with framework systems
const allSystemsCombined = [...penguinSystems, relationshipCulling];

// Apply parameter overrides from config file
const { templates: configuredTemplates, systems: configuredSystems } = applyParameterOverrides(
  allTemplates,
  allSystemsCombined,
  parameterOverrides as any
);

// Configuration
const config: EngineConfig = {
  // Domain schema (penguin-specific world knowledge)
  domain: penguinDomain,

  eras: penguinEras,
  templates: configuredTemplates,
  systems: configuredSystems,
  pressures: pressures,
  entityRegistries: scaledEntityRegistries,  // Framework formalization: entity operator registry (scaled)
  llmConfig,
  enrichmentConfig,

  // Name generation service (used by addEntity when name not provided)
  nameForgeService,

  // Statistical distribution targets (enables mid-run tuning, scaled by SCALE_FACTOR)
  distributionTargets: scaledDistributionTargets as DistributionTargets,

  // Tuning parameters (scaled by SCALE_FACTOR)
  epochLength: Math.ceil(20 * SCALE_FACTOR),                    // ticks per epoch
  simulationTicksPerGrowth: Math.ceil(15 * SCALE_FACTOR),       // simulation ticks between growth phases
  targetEntitiesPerKind: Math.ceil(30 * SCALE_FACTOR),          // target entities per kind (~150 total at 1x)
  maxTicks: Math.ceil(500 * SCALE_FACTOR),                      // maximum simulation ticks
  maxRelationshipsPerType: 3,         // DEPRECATED: now using per-kind warning thresholds in helpers.ts

  // Engine-level safeguards (scaled by SCALE_FACTOR)
  relationshipBudget: {
    maxPerSimulationTick: Math.ceil(50 * SCALE_FACTOR),         // Hard cap: prevent exponential growth during simulation
    maxPerGrowthPhase: Math.ceil(150 * SCALE_FACTOR)            // Hard cap: prevent template spam during growth
  },

  // Pass scale factor to engine for internal calculations
  scaleFactor: SCALE_FACTOR,

  // Feedback loops for homeostatic regulation (penguin-specific)
  feedbackLoops: penguinFeedbackLoops,

  // Tag registry for tag health analysis (penguin-specific)
  tagRegistry: penguinTagRegistry

  // Meta-entity formation is now handled by SimulationSystems:
  // magicSchoolFormation, legalCodeFormation, combatTechniqueFormation
  // These are included in penguinSystems and run at epoch end
};

// Main execution
async function generateWorld() {
  console.log('===========================================');
  console.log('   PROCEDURAL WORLD HISTORY GENERATOR');
  console.log('      Super Penguin Colony Simulation');
  console.log('===========================================\n');
  const llmStatus = llmEnabled ? (llmPartial ? 'partial' : 'full') : 'disabled';
  console.log(`LLM enrichment: ${llmStatus}${llmEnabled ? ` (${llmModel})` : ''}`);
  console.log(`Image generation: ${imageGenEnabled ? 'enabled (DALL-E 3)' : 'disabled'}\n`);

  // Parse and normalize initial state
  const initialState: HardState[] = normalizeInitialState(penguinInitialState.hardState);

  // Create and run engine
  const engine = new WorldEngine(config, initialState, enrichmentService, imageGenerationService);

  console.time('Generation Time');
  const finalGraph = await engine.run();
  console.timeEnd('Generation Time');
  await engine.finalizeEnrichments();

  // Generate images for mythic entities
  await engine.generateMythicImages();

  // Export results
  const worldState = engine.exportState();

  // Validation
  console.log('\n=== WORLD VALIDATION ===');
  const validationReport = validateWorld(finalGraph);
  console.log(`Total Checks: ${validationReport.totalChecks}`);
  console.log(`Passed: ${validationReport.passed} ✓`);
  console.log(`Failed: ${validationReport.failed} ✗\n`);

  validationReport.results.forEach(result => {
    const status = result.passed ? '✓' : '✗';
    console.log(`${status} ${result.name}`);
    if (!result.passed) {
      console.log(`   ${result.details}`);
    }
  });

  // Statistics
  console.log('\n=== FINAL STATISTICS ===');
  console.log(`Total Entities: ${worldState.metadata.entityCount}`);
  console.log(`Total Relationships: ${worldState.metadata.relationshipCount}`);
  console.log(`Simulation Ticks: ${worldState.metadata.tick}`);
  console.log(`Epochs Completed: ${worldState.metadata.epoch}`);

  // Entity breakdown
  const entityBreakdown: Record<string, number> = {};
  worldState.hardState.forEach((entity: HardState) => {
    const key = `${entity.kind}:${entity.subtype}`;
    entityBreakdown[key] = (entityBreakdown[key] || 0) + 1;
  });

  console.log('\n=== ENTITY BREAKDOWN ===');
  Object.entries(entityBreakdown)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  // Catalyst statistics
  console.log('\n=== CATALYST ACTIONS ===');
  const entitiesWithCatalyst = worldState.hardState.filter((e: HardState) => e.catalyst?.canAct);
  const catalystActions = worldState.history.filter((e: any) =>
    e.description &&
    e.type === 'simulation' &&
    e.relationshipsCreated.length > 0 &&
    (e.description.includes('seized control') ||
     e.description.includes('established trade') ||
     e.description.includes('declared war') ||
     e.description.includes('forged alliance') ||
     e.description.includes('raided') ||
     e.description.includes('corrupted') ||
     e.description.includes('manifested') ||
     e.description.includes('spread to') ||
     e.description.includes('converted'))
  );
  console.log(`  Active agents: ${entitiesWithCatalyst.length}`);
  console.log(`  Agent actions: ${catalystActions.length}`);
  const actionsByAgent = new Map<string, number>();
  catalystActions.forEach((action: any) => {
    // Extract agent name (handle "The X" case)
    const words = action.description.split(' ');
    const agentName = words[0] === 'The' && words.length > 1
      ? `${words[0]} ${words[1]}`
      : words[0];
    actionsByAgent.set(agentName, (actionsByAgent.get(agentName) || 0) + 1);
  });
  const topAgents = Array.from(actionsByAgent.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (topAgents.length > 0) {
    console.log('  Top agents by actions:');
    topAgents.forEach(([agent, count]) => {
      console.log(`    ${agent}: ${count} actions`);
    });
  }

  // Relationship breakdown
  const relationshipBreakdown: Record<string, number> = {};
  worldState.relationships.forEach((rel: any) => {
    relationshipBreakdown[rel.kind] = (relationshipBreakdown[rel.kind] || 0) + 1;
  });

  console.log('\n=== RELATIONSHIP TYPES ===');
  Object.entries(relationshipBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  // Sample history events
  console.log('\n=== SAMPLE HISTORY EVENTS ===');
  const sampleEvents = worldState.history
    .filter((e: any) => e.description && (e.entitiesCreated.length > 0 || e.relationshipsCreated.length > 0))
    .slice(-10);

  sampleEvents.forEach((event: any) => {
    console.log(`  [Tick ${event.tick}] ${event.description}`);
  });

  // Notable entities (highest prominence)
  console.log('\n=== NOTABLE ENTITIES ===');
  const notableEntities = worldState.hardState
    .filter((e: HardState) => e.prominence === 'renowned' || e.prominence === 'mythic')
    .slice(0, 10);

  notableEntities.forEach((entity: HardState) => {
    console.log(`  ${entity.name} (${entity.kind}:${entity.subtype}) - ${entity.prominence}`);
    console.log(`    "${entity.description}"`);
  });

  // Write output to file
  // Use run-id to segregate output if provided
  const outputDir = cliArgs.runId ? `./output/runs/${cliArgs.runId}` : './output';
  const outputPath = `${outputDir}/generated_world.json`;

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Log output directory for GA tracking
  if (cliArgs.runId) {
    console.log(`\n📁 Run ID: ${cliArgs.runId}`);
    console.log(`📁 Output directory: ${outputDir}`);
  }

  // Extract UI schema from domain for webui consumption
  const uiSchema = {
    worldName: penguinDomain.name,
    worldIcon: penguinDomain.uiConfig?.worldIcon ?? '🌍',
    entityKinds: penguinDomain.entityKinds.map(ek => ({
      kind: ek.kind,
      displayName: ek.style?.displayName ?? ek.kind.charAt(0).toUpperCase() + ek.kind.slice(1),
      color: ek.style?.color ?? '#999',
      shape: ek.style?.shape ?? 'ellipse',
      subtypes: ek.subtypes,
      statusValues: ek.statusValues
    })),
    relationshipKinds: penguinDomain.relationshipKinds.map(rk => ({
      kind: rk.kind,
      description: rk.description,
      srcKinds: rk.srcKinds,
      dstKinds: rk.dstKinds,
      category: rk.category ?? 'social'
    })),
    prominenceLevels: penguinDomain.uiConfig?.prominenceLevels ?? ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'],
    cultures: penguinDomain.cultures.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description
    })),
    // Legacy global regions (for backward compatibility)
    regions: penguinRegionConfig.regions.map(r => ({
      id: r.id,
      label: r.label,
      description: r.description,
      bounds: r.bounds,
      zRange: r.zRange,
      parentRegion: r.parentRegion,
      metadata: r.metadata
    })),
    coordinateBounds: { min: 0, max: 100 },
    // Per-entity-kind map configurations
    perKindMaps: Object.fromEntries(
      Object.entries(penguinKindMaps).map(([kind, config]) => [
        kind,
        {
          entityKind: config.entityKind,
          name: config.name,
          description: config.description,
          bounds: { min: 0, max: 100 },  // Flatten to simple bounds for UI
          hasZAxis: config.hasZAxis,
          zAxisLabel: config.zAxisLabel
        }
      ])
    ),
    // Per-entity-kind region lists
    perKindRegions: Object.fromEntries(
      Object.entries(penguinKindMaps).map(([kind, config]) => [
        kind,
        (config.seedRegions ?? []).map(r => ({
          id: r.id,
          label: r.label,
          description: r.description,
          bounds: r.bounds,
          zRange: r.zRange,
          parentRegion: r.parentRegion,
          metadata: r.metadata
        }))
      ])
    )
  };

  // Add validation results and UI schema to export
  const exportData = {
    ...worldState,
    uiSchema,
    validation: {
      totalChecks: validationReport.totalChecks,
      passed: validationReport.passed,
      failed: validationReport.failed,
      results: validationReport.results.map(r => ({
        name: r.name,
        passed: r.passed,
        failureCount: r.failureCount,
        details: r.details
      }))
    }
  };

  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  console.log(`\n✅ World state exported to ${outputPath}`);

  // Also export a graph visualization format
  const graphViz = {
    nodes: worldState.hardState.map((e: HardState) => ({
      id: e.id,
      label: e.name,
      group: e.kind,
      subtype: e.subtype,
      prominence: e.prominence
    })),
    edges: worldState.relationships.map((r: any) => ({
      from: r.src,
      to: r.dst,
      label: r.kind
    }))
  };

  fs.writeFileSync(`${outputDir}/graph_viz.json`, JSON.stringify(graphViz, null, 2));
  console.log(`✅ Graph visualization exported to ${outputDir}/graph_viz.json`);

  // Finalize name logging and write report
  engine.finalizeNameLogging();

  const loreOutput = {
    llmEnabled,
    model: llmEnabled ? llmModel : 'disabled',
    records: engine.getLoreRecords()
  };
  fs.writeFileSync(`${outputDir}/lore.json`, JSON.stringify(loreOutput, null, 2));
  console.log(`✅ Lore output exported to ${outputDir}/lore.json (${llmEnabled ? 'enabled' : 'disabled'})`);

  // Export statistics for genetic algorithm fitness evaluation
  const statistics = engine.exportStatistics({
    totalChecks: validationReport.totalChecks,
    passed: validationReport.passed,
    failed: validationReport.failed,
    results: validationReport.results.map(r => ({
      name: r.name,
      passed: r.passed,
      failureCount: r.failureCount,
      details: r.details
    }))
  });
  fs.writeFileSync(`${outputDir}/stats.json`, JSON.stringify(statistics, null, 2));
  console.log(`✅ Statistics exported to ${outputDir}/stats.json`);

  // Add entry to run manifest for GA tracking (JSONL format for easy streaming)
  if (cliArgs.runId) {
    const manifestPath = './output/runs/manifest.jsonl';
    const manifestEntry = {
      runId: cliArgs.runId,
      timestamp: new Date().toISOString(),
      config: cliArgs.configPath || `runs/${cliArgs.runId}/templateSystemParameters.json`,
      fitness: statistics.fitnessMetrics.overallFitness,
      entityCount: statistics.finalEntityCount,
      relationshipCount: statistics.finalRelationshipCount,
      violations: statistics.performanceStats.protectedRelationshipViolations.totalViolations,
      validationPassed: statistics.validationStats.passed,
      validationFailed: statistics.validationStats.failed,
      generationTimeMs: statistics.generationTimeMs
    };

    // Ensure runs directory exists
    if (!fs.existsSync('./output/runs')) {
      fs.mkdirSync('./output/runs', { recursive: true });
    }

    // Append to manifest (JSONL: one JSON object per line)
    fs.appendFileSync(manifestPath, JSON.stringify(manifestEntry) + '\n');
    console.log(`✅ Run manifest updated: ${manifestPath}`);
  }
}

// Run the generator
generateWorld().catch(console.error);
