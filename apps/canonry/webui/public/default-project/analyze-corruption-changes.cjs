const fs = require("fs");

// New runs (after corruption changes)
const newFiles = [
  "run-jan-2-1-38-pm-213-entities.canonry-slot.json",
  "run-jan-2-1-40-pm-218-entities.canonry-slot.json",
  "run-jan-2-1-42-pm-198-entities.canonry-slot.json",
  "run-jan-2-1-42-pm-210-entities.canonry-slot.json"
];

// Old runs (before corruption changes) for comparison
const oldFiles = [
  "run-jan-2-5-16-am-206-entities.canonry-slot.json",
  "run-jan-2-5-19-am-207-entities.canonry-slot.json",
  "run-jan-2-5-21-am-220-entities.canonry-slot.json",
  "run-jan-2-5-20-am-215-entities.canonry-slot.json"
];

function analyzeRuns(files, label) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`=== ${label} ===`);
  console.log("=".repeat(70));

  let totalCorruptions = 0;
  let totalCleanses = 0;
  let totalRecorruptions = 0;
  let recorruptionGaps = [];
  let magicalStabilityFinal = [];
  let darkRituals = 0;
  let isolationDecays = 0;

  // Track by era
  const byEra = {};

  files.forEach((file, idx) => {
    if (!fs.existsSync(file)) {
      console.log(`  [SKIP] ${file} not found`);
      return;
    }

    const d = JSON.parse(fs.readFileSync(file));
    const history = d.worldData.history || [];
    const simEvents = history.filter(e => e.type === "simulation");
    const pressureUpdates = d.simulationState?.pressureUpdates || [];

    // Get final magical stability
    const finalPressures = d.worldData.pressures || {};
    if (finalPressures.magical_stability !== undefined) {
      magicalStabilityFinal.push(finalPressures.magical_stability);
    }

    // Find era boundaries
    const eraEntities = Object.values(d.worldData.hardState || {}).filter(e => e.kind === "era");
    const eras = eraEntities.map(e => ({ id: e.subtype, start: e.createdAt, end: e.temporal?.endTick || 999 }));
    eras.sort((a, b) => a.start - b.start);

    function getEraForTick(tick) {
      for (const era of eras) {
        if (tick >= era.start && tick <= era.end) return era.id;
      }
      return "unknown";
    }

    // Track corruption/cleansing by location
    const locationEvents = {};

    simEvents.forEach(e => {
      const era = getEraForTick(e.tick);
      if (!byEra[era]) byEra[era] = { corruptions: 0, cleanses: 0, darkRituals: 0, isolationDecays: 0 };

      // Cleansing events
      const cleanseMatch = e.description?.match(/purified.*at (.+)$/) ||
                          e.description?.match(/cleansed (.+)$/);
      if (cleanseMatch) {
        const loc = cleanseMatch[1];
        if (!locationEvents[loc]) locationEvents[loc] = [];
        locationEvents[loc].push({ tick: e.tick, type: "cleanse" });
        totalCleanses++;
        byEra[era].cleanses++;
      }

      // Corruption events
      const corruptMatch = e.description?.match(/spread corruption to (.+)$/) ||
                          e.description?.match(/corrupted (.+)$/);
      if (corruptMatch && !e.description.includes("purified")) {
        const loc = corruptMatch[1];
        if (!locationEvents[loc]) locationEvents[loc] = [];
        locationEvents[loc].push({ tick: e.tick, type: "corrupt" });
        totalCorruptions++;
        byEra[era].corruptions++;
      }

      // Dark ritual events
      if (e.description?.toLowerCase().includes("dark ritual")) {
        darkRituals++;
        byEra[era].darkRituals++;
      }

      // Isolation decay (Sacred Ground Fades)
      if (e.description?.toLowerCase().includes("sacred ground fades") ||
          e.description?.toLowerCase().includes("lost its protection")) {
        isolationDecays++;
        byEra[era].isolationDecays++;
      }
    });

    // Find re-corruptions
    Object.entries(locationEvents).forEach(([loc, events]) => {
      events.sort((a, b) => a.tick - b.tick);
      for (let i = 0; i < events.length - 1; i++) {
        if (events[i].type === "cleanse" && events[i + 1].type === "corrupt") {
          totalRecorruptions++;
          recorruptionGaps.push(events[i + 1].tick - events[i].tick);
        }
      }
    });
  });

  const n = files.length;

  console.log("\n--- CORRUPTION VS CLEANSING ---");
  console.log(`Corruption events: ${(totalCorruptions / n).toFixed(1)}/run`);
  console.log(`Cleansing events:  ${(totalCleanses / n).toFixed(1)}/run`);
  const ratio = totalCleanses > 0 ? (totalCorruptions / totalCleanses).toFixed(1) : "N/A";
  console.log(`Ratio:             ${ratio}:1 (corruption:cleansing)`);

  console.log("\n--- RE-CORRUPTION ANALYSIS ---");
  console.log(`Re-corruptions:    ${(totalRecorruptions / n).toFixed(1)}/run`);
  if (totalCleanses > 0) {
    const recorruptPct = ((totalRecorruptions / totalCleanses) * 100).toFixed(0);
    console.log(`Re-corruption %:   ${recorruptPct}% of cleanses get re-corrupted`);
  }
  if (recorruptionGaps.length > 0) {
    const avgGap = recorruptionGaps.reduce((a, b) => a + b, 0) / recorruptionGaps.length;
    console.log(`Avg gap to re-corrupt: ${avgGap.toFixed(1)} ticks`);
    const within5 = recorruptionGaps.filter(g => g <= 5).length;
    console.log(`Within 5 ticks:    ${((within5 / recorruptionGaps.length) * 100).toFixed(0)}%`);
  }

  console.log("\n--- NEW SYSTEMS ---");
  console.log(`Dark Rituals:      ${(darkRituals / n).toFixed(1)}/run`);
  console.log(`Isolation Decays:  ${(isolationDecays / n).toFixed(1)}/run`);

  console.log("\n--- MAGICAL STABILITY (final) ---");
  if (magicalStabilityFinal.length > 0) {
    const avg = magicalStabilityFinal.reduce((a, b) => a + b, 0) / magicalStabilityFinal.length;
    const min = Math.min(...magicalStabilityFinal);
    const max = Math.max(...magicalStabilityFinal);
    console.log(`Average: ${avg.toFixed(1)}`);
    console.log(`Range:   ${min.toFixed(1)} to ${max.toFixed(1)}`);
  }

  console.log("\n--- BY ERA ---");
  Object.entries(byEra).sort((a, b) => {
    const order = ["expansion", "conflict", "innovation", "invasion", "reconstruction"];
    return order.indexOf(a[0]) - order.indexOf(b[0]);
  }).forEach(([era, data]) => {
    const eraRatio = data.cleanses > 0 ? (data.corruptions / data.cleanses).toFixed(1) : "N/A";
    console.log(`  ${era}:`);
    console.log(`    Corruptions: ${(data.corruptions / n).toFixed(1)}, Cleanses: ${(data.cleanses / n).toFixed(1)}, Ratio: ${eraRatio}:1`);
    if (data.darkRituals > 0) console.log(`    Dark Rituals: ${(data.darkRituals / n).toFixed(1)}`);
    if (data.isolationDecays > 0) console.log(`    Isolation Decays: ${(data.isolationDecays / n).toFixed(1)}`);
  });

  return {
    corruptionsPerRun: totalCorruptions / n,
    cleansesPerRun: totalCleanses / n,
    recorruptionsPerRun: totalRecorruptions / n,
    recorruptPct: totalCleanses > 0 ? (totalRecorruptions / totalCleanses) * 100 : 0,
    magicalStabilityAvg: magicalStabilityFinal.length > 0
      ? magicalStabilityFinal.reduce((a, b) => a + b, 0) / magicalStabilityFinal.length
      : null
  };
}

// Analyze pressure trajectory for new runs
function analyzePressureTrajectory(files) {
  console.log(`\n${"=".repeat(70)}`);
  console.log("=== MAGICAL STABILITY TRAJECTORY (New Runs) ===");
  console.log("=".repeat(70));

  files.forEach((file, idx) => {
    if (!fs.existsSync(file)) return;

    const d = JSON.parse(fs.readFileSync(file));
    const updates = d.simulationState?.pressureUpdates || [];

    // Sample at key ticks
    const sampleTicks = [0, 25, 50, 75, 100, 125, 150, 175, 200];
    const trajectory = {};

    updates.forEach(u => {
      if (sampleTicks.includes(u.tick)) {
        const ms = u.pressures?.magical_stability;
        if (ms !== undefined) trajectory[u.tick] = ms;
      }
    });

    // Find min/max and when they occur
    let minMs = 100, maxMs = -100, minTick = 0, maxTick = 0;
    updates.forEach(u => {
      const ms = u.pressures?.magical_stability;
      if (ms !== undefined) {
        if (ms < minMs) { minMs = ms; minTick = u.tick; }
        if (ms > maxMs) { maxMs = ms; maxTick = u.tick; }
      }
    });

    console.log(`\nRun ${idx + 1}:`);
    console.log(`  Trajectory: ${Object.entries(trajectory).map(([t, v]) => `t${t}:${v.toFixed(0)}`).join(" → ")}`);
    console.log(`  Min: ${minMs.toFixed(1)} @ tick ${minTick}, Max: ${maxMs.toFixed(1)} @ tick ${maxTick}`);
  });
}

// Run analysis
const oldStats = analyzeRuns(oldFiles, "BEFORE CHANGES (Old Runs)");
const newStats = analyzeRuns(newFiles, "AFTER CHANGES (New Runs)");

analyzePressureTrajectory(newFiles);

// Comparison
console.log(`\n${"=".repeat(70)}`);
console.log("=== COMPARISON: BEFORE vs AFTER ===");
console.log("=".repeat(70));

console.log("\n                        BEFORE    AFTER     CHANGE");
console.log(`Corruptions/run:        ${oldStats.corruptionsPerRun.toFixed(1).padStart(6)}    ${newStats.corruptionsPerRun.toFixed(1).padStart(6)}    ${(newStats.corruptionsPerRun - oldStats.corruptionsPerRun).toFixed(1).padStart(6)}`);
console.log(`Cleanses/run:           ${oldStats.cleansesPerRun.toFixed(1).padStart(6)}    ${newStats.cleansesPerRun.toFixed(1).padStart(6)}    ${(newStats.cleansesPerRun - oldStats.cleansesPerRun).toFixed(1).padStart(6)}`);
console.log(`Re-corruptions/run:     ${oldStats.recorruptionsPerRun.toFixed(1).padStart(6)}    ${newStats.recorruptionsPerRun.toFixed(1).padStart(6)}    ${(newStats.recorruptionsPerRun - oldStats.recorruptionsPerRun).toFixed(1).padStart(6)}`);
console.log(`Re-corruption %:        ${oldStats.recorruptPct.toFixed(0).padStart(5)}%    ${newStats.recorruptPct.toFixed(0).padStart(5)}%    ${(newStats.recorruptPct - oldStats.recorruptPct).toFixed(0).padStart(5)}%`);
if (oldStats.magicalStabilityAvg && newStats.magicalStabilityAvg) {
  console.log(`Magical Stability:      ${oldStats.magicalStabilityAvg.toFixed(1).padStart(6)}    ${newStats.magicalStabilityAvg.toFixed(1).padStart(6)}    ${(newStats.magicalStabilityAvg - oldStats.magicalStabilityAvg).toFixed(1).padStart(6)}`);
}

console.log("\n=== ASSESSMENT ===");
const corruptionReduction = ((oldStats.corruptionsPerRun - newStats.corruptionsPerRun) / oldStats.corruptionsPerRun * 100).toFixed(0);
const recorruptReduction = ((oldStats.recorruptPct - newStats.recorruptPct)).toFixed(0);

if (newStats.recorruptPct < oldStats.recorruptPct) {
  console.log(`✓ Re-corruption rate DECREASED by ${recorruptReduction}% points`);
  console.log("  (cleansed tag protection is working)");
} else {
  console.log(`✗ Re-corruption rate increased - cleansed protection may not be working`);
}

const ratio = newStats.corruptionsPerRun / newStats.cleansesPerRun;
if (ratio < 3) {
  console.log(`✓ Corruption:Cleansing ratio is ${ratio.toFixed(1)}:1 (more balanced)`);
} else {
  console.log(`⚠ Corruption:Cleansing ratio is ${ratio.toFixed(1)}:1 (still corruption-heavy)`);
}

if (newStats.magicalStabilityAvg > -50 && newStats.magicalStabilityAvg < 50) {
  console.log(`✓ Magical stability ends in reasonable range (${newStats.magicalStabilityAvg.toFixed(1)})`);
} else if (newStats.magicalStabilityAvg <= -50) {
  console.log(`⚠ Magical stability ends very low (${newStats.magicalStabilityAvg.toFixed(1)}) - corruption still dominant`);
} else {
  console.log(`⚠ Magical stability ends very high (${newStats.magicalStabilityAvg.toFixed(1)}) - cleansing dominant`);
}
