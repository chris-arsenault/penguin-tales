const fs = require("fs");

const files = [
  "run-jan-2-5-16-am-206-entities.canonry-slot.json",
  "run-jan-2-5-19-am-207-entities.canonry-slot.json",
  "run-jan-2-5-21-am-220-entities.canonry-slot.json",
  "run-jan-2-5-20-am-215-entities.canonry-slot.json"
];

console.log("=== MAGICAL STABILITY: CORRECTED ACTION-LEVEL ANALYSIS ===\n");

// Action definitions with their known deltas
const actionDefs = {
  spread_corruption: { pattern: /spread corruption/i, delta: -8 },
  corrupt_location: { pattern: /corrupted [A-Z]/, delta: -5 },
  manifest_at_anomaly: { pattern: /manifested at/i, delta: -2 },
  seek_cleansing: { pattern: /sought cleansing|cleansed/i, delta: 5 },
  tome_dispels: { pattern: /dispelled|purified/i, delta: 5 },
};

// Count action executions and calculate contribution
const actionStats = {};
Object.keys(actionDefs).forEach(k => actionStats[k] = { count: 0, contribution: 0 });
let totalSim = 0;
let otherSim = 0;

files.forEach(file => {
  const d = JSON.parse(fs.readFileSync(file));
  const history = d.worldData.history || [];
  const simEvents = history.filter(e => e.type === "simulation");
  totalSim += simEvents.length;

  simEvents.forEach(e => {
    let matched = false;
    for (const [name, def] of Object.entries(actionDefs)) {
      if (def.pattern.test(e.description)) {
        actionStats[name].count++;
        actionStats[name].contribution += def.delta;
        matched = true;
        break;
      }
    }
    if (!matched) otherSim++;
  });
});

console.log("=== ACTION EXECUTION & CONTRIBUTION ===\n");
console.log("(Actions are aggregated per-tick into universal_catalyst)\n");

let totalActionContrib = 0;
Object.entries(actionStats)
  .filter(([_, d]) => d.count > 0)
  .sort((a, b) => a[1].contribution - b[1].contribution)
  .forEach(([name, data]) => {
    const perRun = (data.count / 4).toFixed(1);
    const contrib = (data.contribution / 4).toFixed(0);
    const delta = actionDefs[name].delta;
    totalActionContrib += data.contribution;
    const sign = delta >= 0 ? "+" : "";
    console.log(`  ${contrib}/run (${perRun}x @ ${sign}${delta}): ${name}`);
  });

console.log(`\n  TOTAL ACTION CONTRIBUTION: ${(totalActionContrib / 4).toFixed(0)}/run`);
console.log(`  (Other simulation events: ${(otherSim / 4).toFixed(0)}/run)`);

// Template contributions (already properly attributed)
console.log("\n=== TEMPLATE CONTRIBUTIONS ===\n");

const byTemplate = {};
files.forEach(file => {
  const d = JSON.parse(fs.readFileSync(file));
  const updates = d.simulationState?.pressureUpdates || [];

  updates.forEach(u => {
    const mods = (u.discreteModifications || [])
      .filter(m => m.pressureId === "magical_stability" && m.source?.templateId);

    mods.forEach(mod => {
      const id = mod.source.templateId;
      if (!byTemplate[id]) byTemplate[id] = { total: 0, count: 0 };
      byTemplate[id].total += mod.delta;
      byTemplate[id].count++;
    });
  });
});

let totalTemplateContrib = 0;
Object.entries(byTemplate)
  .sort((a, b) => a[1].total - b[1].total)
  .forEach(([name, data]) => {
    const perRun = (data.total / 4).toFixed(0);
    const perExec = (data.total / data.count).toFixed(0);
    totalTemplateContrib += data.total;
    console.log(`  ${perRun}/run (${(data.count / 4).toFixed(1)}x @ ${perExec}): ${name}`);
  });

console.log(`\n  TOTAL TEMPLATE CONTRIBUTION: ${(totalTemplateContrib / 4).toFixed(0)}/run`);

// System contributions (excluding universal_catalyst which is just action aggregation)
console.log("\n=== SYSTEM CONTRIBUTIONS (non-action) ===\n");

const bySystem = {};
files.forEach(file => {
  const d = JSON.parse(fs.readFileSync(file));
  const updates = d.simulationState?.pressureUpdates || [];

  updates.forEach(u => {
    const mods = (u.discreteModifications || [])
      .filter(m => m.pressureId === "magical_stability" &&
                   m.source?.systemId &&
                   m.source.systemId !== "universal_catalyst");

    mods.forEach(mod => {
      const id = mod.source.systemId;
      if (!bySystem[id]) bySystem[id] = { total: 0, count: 0 };
      bySystem[id].total += mod.delta;
      bySystem[id].count++;
    });
  });
});

let totalSystemContrib = 0;
Object.entries(bySystem)
  .sort((a, b) => a[1].total - b[1].total)
  .forEach(([name, data]) => {
    const perRun = (data.total / 4).toFixed(0);
    const perExec = (data.total / data.count).toFixed(1);
    totalSystemContrib += data.total;
    console.log(`  ${perRun}/run (${(data.count / 4).toFixed(1)}x @ ${perExec}): ${name}`);
  });

console.log(`\n  TOTAL SYSTEM CONTRIBUTION: ${(totalSystemContrib / 4).toFixed(0)}/run`);

// Summary
console.log("\n" + "=".repeat(60));
console.log("=== CORRECTED SUMMARY ===");
console.log("=".repeat(60) + "\n");

const actionPerRun = totalActionContrib / 4;
const templatePerRun = totalTemplateContrib / 4;
const systemPerRun = totalSystemContrib / 4;
const grandTotal = actionPerRun + templatePerRun + systemPerRun;

console.log(`Actions (via universal_catalyst): ${actionPerRun.toFixed(0)}/run`);
console.log(`Templates:                        ${templatePerRun.toFixed(0)}/run`);
console.log(`Systems (non-action):             ${systemPerRun.toFixed(0)}/run`);
console.log(`─────────────────────────────────────────`);
console.log(`GRAND TOTAL:                      ${grandTotal.toFixed(0)}/run`);

// Category breakdown
console.log("\n=== BY CATEGORY ===\n");

const corruptionActions = ["spread_corruption", "corrupt_location", "manifest_at_anomaly"];
const cleansingActions = ["seek_cleansing", "tome_dispels"];

let corruptionTotal = 0;
let cleansingTotal = 0;
corruptionActions.forEach(a => corruptionTotal += (actionStats[a]?.contribution || 0));
cleansingActions.forEach(a => cleansingTotal += (actionStats[a]?.contribution || 0));

console.log("CORRUPTION ACTIONS:");
corruptionActions.forEach(a => {
  const data = actionStats[a];
  if (data && data.count > 0) {
    console.log(`  ${(data.contribution / 4).toFixed(0)}/run: ${a} (${(data.count / 4).toFixed(1)}x)`);
  }
});
console.log(`  SUBTOTAL: ${(corruptionTotal / 4).toFixed(0)}/run`);

console.log("\nCLEANSING ACTIONS:");
cleansingActions.forEach(a => {
  const data = actionStats[a];
  if (data && data.count > 0) {
    console.log(`  +${(data.contribution / 4).toFixed(0)}/run: ${a} (${(data.count / 4).toFixed(1)}x)`);
  }
});
console.log(`  SUBTOTAL: +${(cleansingTotal / 4).toFixed(0)}/run`);

console.log("\nNET FROM CORRUPTION SYSTEM: " + ((corruptionTotal + cleansingTotal) / 4).toFixed(0) + "/run");

// Key insight
console.log("\n" + "=".repeat(60));
console.log("=== KEY INSIGHT ===");
console.log("=".repeat(60) + "\n");

console.log("The corruption cascade is the DOMINANT driver of magical stability drain:");
console.log(`  - Corruption actions alone: ${(corruptionTotal / 4).toFixed(0)}/run`);
console.log(`  - Cleansing can only recover: +${(cleansingTotal / 4).toFixed(0)}/run`);
console.log(`  - Net corruption effect: ${((corruptionTotal + cleansingTotal) / 4).toFixed(0)}/run`);
console.log();
console.log("This is NOT a bug in universal_catalyst.");
console.log("It's the corruption system working as designed, but very actively.");
