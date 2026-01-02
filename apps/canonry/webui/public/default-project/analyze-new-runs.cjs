const fs = require("fs");

const files = [
  "run-jan-2-4-59-am-199-entities.canonry-slot.json",
  "run-jan-2-5-00-am-211-entities.canonry-slot.json",
  "run-jan-2-5-00-am-218-entities.canonry-slot.json",
  "run-jan-2-5-00-am-204-entities.canonry-slot.json"
];

console.log("=== NEW RUNS ANALYSIS ===\n");

const allSourceTotals = {};
const allSinkTotals = {};

files.forEach(file => {
  const d = JSON.parse(fs.readFileSync(file));
  const updates = d.simulationState?.pressureUpdates || [];
  const epochStats = d.simulationState?.epochStats || [];
  const history = d.worldData.history || [];

  // Resource trajectory
  const resourceValues = epochStats.map(e => e.pressures?.resource_availibility || 0);
  const minRes = Math.min(...resourceValues);
  const maxRes = Math.max(...resourceValues);

  // Count oscillations
  let oscillations = 0;
  let lastDir = null;
  for (let i = 1; i < resourceValues.length; i++) {
    const delta = resourceValues[i] - resourceValues[i - 1];
    if (Math.abs(delta) < 1) continue;
    const dir = delta > 0 ? "up" : "down";
    if (lastDir && dir !== lastDir) oscillations++;
    lastDir = dir;
  }

  // Extract discrete modifications
  const bySource = {};
  updates.forEach(u => {
    (u.discreteModifications || [])
      .filter(m => m.pressureId === "resource_availibility")
      .forEach(m => {
        const src = m.source?.templateId || m.source?.systemId || "unknown";
        if (!bySource[src]) bySource[src] = { total: 0, count: 0 };
        bySource[src].total += m.delta;
        bySource[src].count++;
      });
  });

  // Separate sources and sinks
  const sources = Object.entries(bySource).filter(([_, d]) => d.total > 0);
  const sinks = Object.entries(bySource).filter(([_, d]) => d.total < 0);

  const totalSources = sources.reduce((s, [_, d]) => s + d.total, 0);
  const totalSinks = sinks.reduce((s, [_, d]) => s + d.total, 0);

  // Accumulate for averages
  sources.forEach(([name, data]) => {
    if (!allSourceTotals[name]) allSourceTotals[name] = { total: 0, count: 0 };
    allSourceTotals[name].total += data.total;
    allSourceTotals[name].count += data.count;
  });
  sinks.forEach(([name, data]) => {
    if (!allSinkTotals[name]) allSinkTotals[name] = { total: 0, count: 0 };
    allSinkTotals[name].total += data.total;
    allSinkTotals[name].count += data.count;
  });

  // Feedback analysis
  let totalFeedback = 0;
  updates.forEach(u => {
    const res = u.pressures?.find(p => p.id === "resource_availibility");
    if (!res) return;
    const discreteTotal = (u.discreteModifications || [])
      .filter(m => m.pressureId === "resource_availibility")
      .reduce((s, m) => s + m.delta, 0);
    totalFeedback += (res.delta - discreteTotal);
  });

  console.log(`--- ${file.replace(".canonry-slot.json", "")} ---`);
  console.log(`Resource range: [${minRes.toFixed(1)} to ${maxRes.toFixed(1)}], ${oscillations} oscillations`);
  console.log(`Sources: +${totalSources.toFixed(0)}, Sinks: ${totalSinks.toFixed(0)}, Feedback: ${totalFeedback.toFixed(0)}`);
  console.log(`Net discrete: ${(totalSources + totalSinks).toFixed(0)}, Net total: ${(totalSources + totalSinks + totalFeedback).toFixed(0)}`);
  console.log();
});

// Summary across all runs
console.log("=== AVERAGE ACROSS ALL RUNS ===\n");

console.log("SOURCES:");
Object.entries(allSourceTotals)
  .sort((a, b) => b[1].total - a[1].total)
  .forEach(([name, data]) => {
    const avgPerRun = data.total / 4;
    const avgPerExec = data.total / data.count;
    console.log(`  +${avgPerRun.toFixed(0)}/run (${data.count / 4}x @ +${avgPerExec.toFixed(1)}): ${name}`);
  });

const totalSourcesAvg = Object.values(allSourceTotals).reduce((s, d) => s + d.total, 0) / 4;
console.log(`  TOTAL SOURCES: +${totalSourcesAvg.toFixed(0)}/run`);

console.log("\nSINKS:");
Object.entries(allSinkTotals)
  .sort((a, b) => a[1].total - b[1].total)
  .forEach(([name, data]) => {
    const avgPerRun = data.total / 4;
    const avgPerExec = data.total / data.count;
    console.log(`  ${avgPerRun.toFixed(0)}/run (${data.count / 4}x @ ${avgPerExec.toFixed(1)}): ${name}`);
  });

const totalSinksAvg = Object.values(allSinkTotals).reduce((s, d) => s + d.total, 0) / 4;
console.log(`  TOTAL SINKS: ${totalSinksAvg.toFixed(0)}/run`);

console.log(`\nNET DISCRETE: ${(totalSourcesAvg + totalSinksAvg).toFixed(0)}/run`);

// Detailed template firing during expansion era
console.log("\n=== EXPANSION ERA TEMPLATE ACTIVITY ===\n");

files.forEach(file => {
  const d = JSON.parse(fs.readFileSync(file));
  const history = d.worldData.history || [];

  const expansionGrowth = history.filter(e => e.type === "growth" && e.tick < 25);
  const templateCounts = {};
  expansionGrowth.forEach(e => {
    const match = e.description?.match(/^(.+?) executed/);
    if (match) templateCounts[match[1]] = (templateCounts[match[1]] || 0) + 1;
  });

  console.log(`${file.replace(".canonry-slot.json", "")}: ${expansionGrowth.length} templates in expansion`);
});

// Check what's needed for balance
console.log("\n=== BALANCE CALCULATION ===\n");
console.log(`Current imbalance: +${(totalSourcesAvg + totalSinksAvg).toFixed(0)} (too positive)`);
console.log(`\nTo balance, need to either:`);
console.log(`  1. Reduce sources by ${(totalSourcesAvg + totalSinksAvg).toFixed(0)}`);
console.log(`  2. Increase sinks by ${Math.abs(totalSourcesAvg + totalSinksAvg).toFixed(0)}`);
console.log(`  3. Some combination`);
