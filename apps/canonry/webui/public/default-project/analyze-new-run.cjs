const fs = require("fs");

const file = "run-jan-2-4-46-am-207-entities.canonry-slot.json";
const d = JSON.parse(fs.readFileSync(file));
const updates = d.simulationState?.pressureUpdates || [];
const history = d.worldData.history || [];
const epochStats = d.simulationState?.epochStats || [];

console.log("=== NEW RUN ANALYSIS ===\n");

// Resource trajectory
console.log("Resource trajectory by epoch:");
epochStats.slice(0, 15).forEach((e, i) => {
  console.log(`  Epoch ${i}: ${e.pressures?.resource_availibility?.toFixed(1) || "N/A"}`);
});

// Extract all discrete modifications for resource_availibility
const resourceMods = [];
updates.forEach(u => {
  const mods = u.discreteModifications || [];
  mods.filter(m => m.pressureId === "resource_availibility").forEach(m => {
    resourceMods.push({
      tick: u.tick,
      delta: m.delta,
      source: m.source?.templateId || m.source?.systemId || "unknown",
      type: m.source?.type || "?"
    });
  });
});

console.log(`\nTotal resource modifications: ${resourceMods.length}`);

// Group by source
const bySource = {};
resourceMods.forEach(m => {
  if (!bySource[m.source]) bySource[m.source] = { total: 0, count: 0 };
  bySource[m.source].total += m.delta;
  bySource[m.source].count++;
});

console.log("\nBy source:");
Object.entries(bySource)
  .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
  .forEach(([src, data]) => {
    const sign = data.total > 0 ? "+" : "";
    console.log(`  ${sign}${data.total} (${data.count}x): ${src}`);
  });

// Check template usage
const templateUsage = d.simulationState?.templateUsage || {};
console.log("\n=== TEMPLATE USAGE ===\n");

const relevantTemplates = [
  "colony_founding", "guild_establishment", "krill_bloom_migration",
  "location_discovery", "economic_colony_decline", "economic_colony_recovery"
];

relevantTemplates.forEach(t => {
  const usage = templateUsage[t];
  if (usage) {
    console.log(`${t}: ${usage.count || 0} executions`);
  } else {
    console.log(`${t}: NOT FOUND in templateUsage`);
  }
});

// Check ALL template usage
console.log("\n=== ALL TEMPLATE USAGE (top 20) ===\n");
Object.entries(templateUsage)
  .sort((a, b) => (b[1].count || 0) - (a[1].count || 0))
  .slice(0, 20)
  .forEach(([name, data]) => {
    console.log(`  ${data.count || 0}x: ${name}`);
  });

// Check history for template executions
console.log("\n=== GROWTH EVENTS IN HISTORY ===\n");
const growthEvents = history.filter(e => e.type === "growth");
console.log(`Total growth events: ${growthEvents.length}`);

const templateCounts = {};
growthEvents.forEach(e => {
  const match = e.description?.match(/^(.+?) executed/);
  if (match) {
    const name = match[1];
    templateCounts[name] = (templateCounts[name] || 0) + 1;
  }
});

console.log("\nTemplates executed:");
Object.entries(templateCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([name, count]) => {
    console.log(`  ${count}x: ${name}`);
  });

// Check applicability - are templates blocked?
console.log("\n=== CHECKING APPLICABILITY CONDITIONS ===\n");

// Current pressure values at different epochs
console.log("Pressure values at key epochs:");
[0, 5, 10, 15, 20].forEach(i => {
  if (epochStats[i]) {
    const p = epochStats[i].pressures || {};
    console.log(`  Epoch ${i}: resource=${p.resource_availibility?.toFixed(1)}, harmony=${p.harmony?.toFixed(1)}`);
  }
});

// Check entity counts
const hardState = d.worldData.hardState || {};
const entities = Object.values(hardState);
const colonies = entities.filter(e => e.kind === "location" && e.subtype === "colony");
const guilds = entities.filter(e => e.kind === "faction" && e.subtype === "company");

console.log(`\nEntity counts: ${colonies.length} colonies, ${guilds.length} guilds`);
