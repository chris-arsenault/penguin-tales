const fs = require("fs");

const file = "run-jan-2-4-46-am-207-entities.canonry-slot.json";
const d = JSON.parse(fs.readFileSync(file));
const history = d.worldData.history || [];
const epochStats = d.simulationState?.epochStats || [];
const updates = d.simulationState?.pressureUpdates || [];

console.log("=== FIRST ERA (EXPANSION) ANALYSIS ===\n");

// Find when expansion ends
const eraTransition = history.find(e => e.description?.includes("The Great Thaw ends"));
const expansionEndTick = eraTransition?.tick || 25;
console.log(`Expansion era: ticks 0-${expansionEndTick}\n`);

// Look at ACTUAL epoch stats structure
console.log("=== EPOCH STATS STRUCTURE (first 3) ===\n");
epochStats.slice(0, 3).forEach((e, i) => {
  console.log(`Epoch ${i}:`);
  console.log(JSON.stringify(e, null, 2).substring(0, 1500));
  console.log("---\n");
});

// Growth events during expansion only
const expansionGrowth = history.filter(e =>
  e.type === "growth" && e.tick < expansionEndTick
);
console.log(`\n=== GROWTH EVENTS DURING EXPANSION (ticks 0-${expansionEndTick}) ===\n`);
console.log(`Total growth events in expansion: ${expansionGrowth.length}`);

const templateCounts = {};
expansionGrowth.forEach(e => {
  const match = e.description?.match(/^(.+?) executed/);
  if (match) {
    templateCounts[match[1]] = (templateCounts[match[1]] || 0) + 1;
  }
});

console.log("\nTemplates executed during expansion:");
Object.entries(templateCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([name, count]) => {
    console.log(`  ${count}x: ${name}`);
  });

// Resource pressure changes during expansion
console.log("\n=== RESOURCE CHANGES DURING EXPANSION ===\n");
const expansionResourceMods = [];
updates.filter(u => u.tick < expansionEndTick).forEach(u => {
  const mods = u.discreteModifications || [];
  mods.filter(m => m.pressureId === "resource_availibility").forEach(m => {
    expansionResourceMods.push({
      tick: u.tick,
      delta: m.delta,
      source: m.source?.templateId || m.source?.systemId || "unknown"
    });
  });
});

console.log(`Resource modifications during expansion: ${expansionResourceMods.length}`);
expansionResourceMods.forEach(m => {
  console.log(`  Tick ${m.tick}: ${m.delta > 0 ? "+" : ""}${m.delta} from ${m.source}`);
});

// Check what's blocking templates - look at resource pressure values tick by tick
console.log("\n=== RESOURCE PRESSURE BY TICK (first 30) ===\n");
updates.slice(0, 30).forEach(u => {
  const resPressure = u.pressures?.find(p => p.id === "resource_availibility");
  if (resPressure) {
    console.log(`Tick ${u.tick}: prev=${resPressure.previousValue?.toFixed(1)}, new=${resPressure.newValue?.toFixed(1)}, delta=${resPressure.delta?.toFixed(1)}`);
  }
});

// Check applicability conditions we set
console.log("\n=== APPLICABILITY CHECK ===\n");
console.log("Templates with resource > -20 condition:");
console.log("  colony_founding, guild_establishment, economic_colony_decline");
console.log("  krill_bloom_migration has min: -5, max: 100");
console.log("");

// What's the resource value during expansion?
const expansionPressures = updates.filter(u => u.tick < expansionEndTick);
if (expansionPressures.length > 0) {
  const firstRes = expansionPressures[0]?.pressures?.find(p => p.id === "resource_availibility");
  const lastRes = expansionPressures[expansionPressures.length - 1]?.pressures?.find(p => p.id === "resource_availibility");
  console.log(`Resource at tick 0: ${firstRes?.newValue?.toFixed(1)}`);
  console.log(`Resource at tick ${expansionEndTick - 1}: ${lastRes?.newValue?.toFixed(1)}`);
}
