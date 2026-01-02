const fs = require("fs");

const files = [
  "run-jan-2-5-16-am-206-entities.canonry-slot.json",
  "run-jan-2-5-19-am-207-entities.canonry-slot.json",
  "run-jan-2-5-21-am-220-entities.canonry-slot.json",
  "run-jan-2-5-20-am-215-entities.canonry-slot.json"
];

console.log("=== MAGICAL STABILITY ANALYSIS FOR CLEVER ICE AGE ===\n");

// Era definitions
const ERA_NAMES = {
  expansion: "The Great Thaw",
  conflict: "The Faction Wars",
  innovation: "The Clever Ice Age",
  invasion: "The Orca Incursion",
  reconstruction: "The Frozen Peace"
};

// Analyze each run
const allRunData = [];

files.forEach((file, idx) => {
  const d = JSON.parse(fs.readFileSync(file));
  const updates = d.simulationState?.pressureUpdates || [];
  const epochStats = d.simulationState?.epochStats || [];
  const history = d.worldData.history || [];
  const entities = Object.values(d.worldData.hardState || {});

  // Find era entities to determine when each era started
  const eraEntities = entities.filter(e => e.kind === "era");
  const eraStarts = {};
  eraEntities.forEach(e => {
    eraStarts[e.subtype] = e.createdAt;
  });

  // Innovation era bounds
  const innovationStart = eraStarts.innovation || eraStarts.conflict + 25 || 50;
  const innovationEnd = eraStarts.invasion || updates.length;

  // Extract magical_stability data
  const stabilityData = [];
  updates.forEach(u => {
    const ms = u.pressures?.find(p => p.id === "magical_stability");
    if (!ms) return;

    const discreteMods = (u.discreteModifications || [])
      .filter(m => m.pressureId === "magical_stability");
    const discreteTotal = discreteMods.reduce((s, m) => s + m.delta, 0);
    const feedbackContribution = ms.delta - discreteTotal;

    stabilityData.push({
      tick: u.tick,
      prevValue: ms.previousValue,
      newValue: ms.newValue,
      delta: ms.delta,
      discreteTotal,
      feedbackContribution,
      era: u.tick < (eraStarts.conflict || 999) ? "expansion" :
           u.tick < (eraStarts.innovation || 999) ? "conflict" :
           u.tick < (eraStarts.invasion || 999) ? "innovation" : "invasion",
      discreteMods
    });
  });

  // Get template activity during innovation era
  const innovationTemplates = history.filter(e =>
    e.type === "growth" &&
    e.tick >= innovationStart &&
    e.tick < innovationEnd
  );

  // Count entity types
  const byKindSubtype = {};
  entities.forEach(e => {
    const key = `${e.kind}:${e.subtype}`;
    byKindSubtype[key] = (byKindSubtype[key] || 0) + 1;
  });

  const abilityMagicCount = byKindSubtype["ability:magic"] || 0;
  const abilityTechCount = byKindSubtype["ability:technology"] || 0;
  const cultCount = byKindSubtype["faction:cult"] || 0;
  const artifactCount = (byKindSubtype["artifact:relic"] || 0) +
                        (byKindSubtype["artifact:tome"] || 0) +
                        (byKindSubtype["artifact:weapon"] || 0) +
                        (byKindSubtype["artifact:instrument"] || 0);

  // Count mystical/wild/anomaly tags
  let mysticalTagCount = 0;
  let wildTagCount = 0;
  let anomalyTagCount = 0;
  entities.forEach(e => {
    if (e.tags?.mystical) mysticalTagCount++;
    if (e.tags?.wild) wildTagCount++;
    if (e.tags?.anomaly) anomalyTagCount++;
  });

  allRunData.push({
    file,
    eraStarts,
    innovationStart,
    innovationEnd,
    stabilityData,
    innovationTemplates,
    entityCounts: { abilityMagicCount, abilityTechCount, cultCount, artifactCount },
    tagCounts: { mysticalTagCount, wildTagCount, anomalyTagCount },
    byKindSubtype
  });

  console.log(`--- Run ${idx + 1}: ${file.replace(".canonry-slot.json", "")} ---`);
  console.log(`Era starts: Thaw@${eraStarts.expansion || 0}, Wars@${eraStarts.conflict || '?'}, Innovation@${eraStarts.innovation || '?'}`);
  console.log(`Entities: ${abilityMagicCount} magic abilities, ${abilityTechCount} tech, ${cultCount} cults, ${artifactCount} artifacts`);
  console.log(`Tags: ${mysticalTagCount} mystical, ${wildTagCount} wild, ${anomalyTagCount} anomaly`);
  console.log();
});

// Aggregate template activity during innovation era
console.log("\n=== TEMPLATE ACTIVITY DURING INNOVATION ERA ===\n");

const templateCounts = {};
allRunData.forEach(run => {
  run.innovationTemplates.forEach(e => {
    const match = e.description?.match(/^(.+?) executed/);
    if (match) {
      templateCounts[match[1]] = (templateCounts[match[1]] || 0) + 1;
    }
  });
});

// Sort by count
const sortedTemplates = Object.entries(templateCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);

console.log("Top 20 Templates (across all runs):");
sortedTemplates.forEach(([name, count]) => {
  const avgPerRun = (count / files.length).toFixed(1);
  console.log(`  ${avgPerRun}/run: ${name}`);
});

// Magical stability contributions
console.log("\n=== MAGICAL STABILITY PRESSURE CONTRIBUTIONS ===\n");

const bySource = {};
let totalDiscrete = 0;
let totalFeedback = 0;

// Per-era tracking
const byEra = { expansion: { discrete: 0, feedback: 0 }, conflict: { discrete: 0, feedback: 0 }, innovation: { discrete: 0, feedback: 0 }, invasion: { discrete: 0, feedback: 0 } };

allRunData.forEach(run => {
  run.stabilityData.forEach(tick => {
    totalDiscrete += tick.discreteTotal;
    totalFeedback += tick.feedbackContribution;

    if (byEra[tick.era]) {
      byEra[tick.era].discrete += tick.discreteTotal;
      byEra[tick.era].feedback += tick.feedbackContribution;
    }

    tick.discreteMods.forEach(mod => {
      const src = mod.source?.templateId || mod.source?.systemId || mod.source?.actionId || "unknown";
      if (!bySource[src]) bySource[src] = { total: 0, count: 0 };
      bySource[src].total += mod.delta;
      bySource[src].count++;
    });
  });
});

// Sort sources and sinks
const sources = Object.entries(bySource)
  .filter(([_, d]) => d.total > 0)
  .sort((a, b) => b[1].total - a[1].total);

const sinks = Object.entries(bySource)
  .filter(([_, d]) => d.total < 0)
  .sort((a, b) => a[1].total - b[1].total);

console.log("SOURCES (increase stability):");
sources.forEach(([name, data]) => {
  const avgPerRun = (data.total / files.length).toFixed(0);
  const avgPerExec = (data.total / data.count).toFixed(1);
  console.log(`  +${avgPerRun}/run (${(data.count / files.length).toFixed(1)}x @ +${avgPerExec}): ${name}`);
});
const totalSourcesAvg = sources.reduce((s, [_, d]) => s + d.total, 0) / files.length;
console.log(`  TOTAL SOURCES: +${totalSourcesAvg.toFixed(0)}/run`);

console.log("\nSINKS (decrease stability):");
sinks.forEach(([name, data]) => {
  const avgPerRun = (data.total / files.length).toFixed(0);
  const avgPerExec = (data.total / data.count).toFixed(1);
  console.log(`  ${avgPerRun}/run (${(data.count / files.length).toFixed(1)}x @ ${avgPerExec}): ${name}`);
});
const totalSinksAvg = sinks.reduce((s, [_, d]) => s + d.total, 0) / files.length;
console.log(`  TOTAL SINKS: ${totalSinksAvg.toFixed(0)}/run`);

console.log(`\nNET DISCRETE: ${((totalSourcesAvg + totalSinksAvg)).toFixed(0)}/run`);

// Feedback analysis
console.log("\n=== FEEDBACK SYSTEM ANALYSIS ===\n");

console.log(`Total simulation:`);
console.log(`  Discrete total: ${(totalDiscrete / files.length).toFixed(0)}/run`);
console.log(`  Feedback total: ${(totalFeedback / files.length).toFixed(0)}/run`);
console.log(`  Net change: ${((totalDiscrete + totalFeedback) / files.length).toFixed(0)}/run`);

console.log(`\nBy Era:`);
Object.entries(byEra).forEach(([era, data]) => {
  if (data.discrete !== 0 || data.feedback !== 0) {
    const net = ((data.discrete + data.feedback) / files.length).toFixed(0);
    console.log(`  ${ERA_NAMES[era] || era}: discrete ${(data.discrete / files.length).toFixed(0)}, feedback ${(data.feedback / files.length).toFixed(0)}, net ${net}`);
  }
});

// Trajectory analysis
console.log("\n=== MAGICAL STABILITY TRAJECTORY ===\n");

// Average trajectory across runs
const avgByTick = {};
allRunData.forEach(run => {
  run.stabilityData.forEach(t => {
    if (!avgByTick[t.tick]) avgByTick[t.tick] = { values: [], eras: [] };
    avgByTick[t.tick].values.push(t.newValue);
    avgByTick[t.tick].eras.push(t.era);
  });
});

console.log("Average trajectory (sampled):");
console.log("Tick | Avg Value | Era");
console.log("-----|-----------|-----");
[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140].forEach(tick => {
  const data = avgByTick[tick];
  if (!data) return;
  const avg = data.values.reduce((a, b) => a + b, 0) / data.values.length;
  const era = data.eras[0];
  console.log(`  ${String(tick).padStart(3)} | ${avg.toFixed(1).padStart(9)} | ${era}`);
});

// Calculate range statistics
const allValues = allRunData.flatMap(r => r.stabilityData.map(t => t.newValue));
console.log(`\nRange across all runs: [${Math.min(...allValues).toFixed(1)} to ${Math.max(...allValues).toFixed(1)}]`);

// Count oscillations
let totalOscillations = 0;
allRunData.forEach(run => {
  let lastDir = null;
  let osc = 0;
  for (let i = 1; i < run.stabilityData.length; i++) {
    const delta = run.stabilityData[i].newValue - run.stabilityData[i - 1].newValue;
    if (Math.abs(delta) < 1) continue;
    const dir = delta > 0 ? "up" : "down";
    if (lastDir && dir !== lastDir) osc++;
    lastDir = dir;
  }
  totalOscillations += osc;
});
console.log(`Oscillations: ${(totalOscillations / files.length).toFixed(1)}/run`);

// Calculate feedback coefficients impact
console.log("\n=== FEEDBACK COEFFICIENT IMPACT (END OF SIM) ===\n");
console.log("Current pressure config:");
console.log("  Initial value: 30");
console.log("  Homeostasis: 0.25 (pulls toward zero)");
console.log("  Positive feedback: +3.0 per ability:magic");
console.log("  Negative feedback: -0.6 per faction:cult, -0.15 per mystical/wild/anomaly tag");
console.log();

// Calculate expected feedback based on final entity counts
allRunData.forEach((run, idx) => {
  const { abilityMagicCount, cultCount } = run.entityCounts;
  const { mysticalTagCount, wildTagCount, anomalyTagCount } = run.tagCounts;

  const positiveFeedback = abilityMagicCount * 3.0;
  const negativeFeedbackCults = cultCount * 0.6;
  const negativeFeedbackTags = (mysticalTagCount + wildTagCount + anomalyTagCount) * 0.15;
  const netEntityFeedback = positiveFeedback - negativeFeedbackCults - negativeFeedbackTags;

  console.log(`Run ${idx + 1}:`);
  console.log(`  Magic abilities (${abilityMagicCount}): +${positiveFeedback.toFixed(1)}/tick`);
  console.log(`  Cults (${cultCount}): -${negativeFeedbackCults.toFixed(1)}/tick`);
  console.log(`  Tags (${mysticalTagCount + wildTagCount + anomalyTagCount}): -${negativeFeedbackTags.toFixed(1)}/tick`);
  console.log(`  Net entity feedback (excluding homeostasis): ${netEntityFeedback >= 0 ? '+' : ''}${netEntityFeedback.toFixed(1)}/tick`);
  console.log();
});

// Key findings summary
console.log("\n=== KEY FINDINGS ===\n");

console.log("1. DOMINANT SINK: universal_catalyst");
console.log(`   -${Math.abs(bySource.universal_catalyst?.total / files.length || 0).toFixed(0)}/run - this is the primary drain on stability`);
console.log();

console.log("2. LOCATION DISCOVERY ANOMALY VARIANT:");
console.log(`   -${Math.abs(bySource.location_discovery?.total / files.length || 0).toFixed(0)}/run at -30 per execution`);
console.log("   Fires when magical_stability < resource_availibility");
console.log();

console.log("3. FEEDBACK COMPENSATION:");
console.log(`   Feedback provides +${(totalFeedback / files.length).toFixed(0)}/run`);
console.log("   This offsets most of the discrete drain, net is only ~-92/run");
console.log();

console.log("4. OSCILLATION PRESENT:");
console.log(`   ~${(totalOscillations / files.length).toFixed(0)} direction changes per run`);
console.log("   Values swing from negative to positive throughout simulation");

// Narrative loop analysis
console.log("\n\n==========================================================");
console.log("=== NARRATIVE LOOP ANALYSIS: MAGICAL STABILITY ===");
console.log("==========================================================\n");

console.log("EXISTING LOOPS (already functional):\n");

console.log("1. WILD MAGIC RECOVERY LOOP");
console.log("   NEED: Stability below threshold (-100 to 10)");
console.log("   PROGRESSION: wild_magic_discover fires (+15)");
console.log("   REWARD: Creates ability:magic, which adds +3.0/tick feedback");
console.log("   LOOP: More magic abilities stabilize the system");
console.log(`   EVIDENCE: ${(bySource.wild_magic_discover?.total / files.length).toFixed(0)}/run contribution`);
console.log();

console.log("2. CORRUPTION CASCADE LOOP");
console.log("   NEED: Corrupted artifacts seek to spread corruption");
console.log("   PROGRESSION: corruption_harm (-2), spread_corruption (-8)");
console.log("   REWARD: Low stability enables cult_formation");
console.log("   LOOP: Cults add -0.6/tick feedback, amplifying instability");
console.log(`   EVIDENCE: ${Math.abs(bySource.corruption_harm?.total / files.length || 0).toFixed(0)}/run from corruption_harm`);
console.log();

console.log("UNDERUTILIZED MECHANICS:\n");

console.log("1. magic_discovery template (+10)");
console.log(`   Only fires ${(bySource.magic_discovery?.count / files.length).toFixed(1)}x/run`);
console.log("   Constrained by magical_stability range -50 to 50");
console.log("   Could be major source if constraints loosened");
console.log();

console.log("2. artifact_crafting (-5) / artifact_discovery (-3)");
console.log("   Combined: ~-34/run - moderate drain");
console.log("   Creates artifacts which can become corrupted -> cascade");
console.log();

console.log("MISSING LOOPS (opportunities):\n");

console.log("1. INNOVATION STABILITY TRADEOFF");
console.log("   tech_breakthrough has NO magical_stability effect");
console.log("   The narrative suggests innovation should destabilize magic");
console.log("   SUGGESTION: Add -3 to tech_breakthrough stateUpdates");
console.log();

console.log("2. GUILD MAGIC TEACHING");
console.log("   guild_establishment has NO magical_stability effect");
console.log("   Guilds could stabilize magic through codified teaching");
console.log("   SUGGESTION: Add +2 to guild_establishment stateUpdates");
console.log();

console.log("3. CULT RITUAL DESTABILIZATION");
console.log("   cult_formation only has -5 direct effect");
console.log("   The -0.6/cult feedback is slow-acting");
console.log("   Consider adding cult actions that actively drain stability");
