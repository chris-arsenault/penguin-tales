const fs = require("fs");

const file = "run-jan-2-4-25-am-210-entities.canonry-slot.json";
const data = JSON.parse(fs.readFileSync(file));
const history = data.worldData.history || [];
const epochStats = data.simulationState?.epochStats || [];

console.log("=== EXPANSION ERA DETAILED ANALYSIS ===\n");

// Get events from expansion era (ticks 0-25)
const expansionEvents = history.filter(e => e.tick !== undefined && e.tick < 30);

// Track resource pressure changes by tick
const tickChanges = {};
expansionEvents.forEach(e => {
  if (!tickChanges[e.tick]) tickChanges[e.tick] = [];

  if (e.pressureChanges && e.pressureChanges.resource_availibility) {
    tickChanges[e.tick].push({
      type: "pressure_change",
      delta: e.pressureChanges.resource_availibility,
      desc: e.description?.substring(0, 60) || e.type
    });
  }

  // Check for era entry events
  if (e.type === "era_transition" || e.description?.includes("era")) {
    tickChanges[e.tick].push({
      type: "era",
      desc: e.description || JSON.stringify(e)
    });
  }

  // Track template executions
  if (e.entitiesCreated && e.entitiesCreated.length > 0) {
    tickChanges[e.tick].push({
      type: "template",
      entities: e.entitiesCreated.length,
      desc: e.description?.substring(0, 60) || "entities created"
    });
  }
});

console.log("Tick-by-tick resource changes (first 30 ticks):\n");
for (let tick = 0; tick < 30; tick++) {
  const changes = tickChanges[tick] || [];
  const resourceChanges = changes.filter(c => c.type === "pressure_change");
  if (resourceChanges.length > 0 || tick < 5) {
    console.log(`Tick ${tick}:`);
    changes.forEach(c => {
      if (c.type === "pressure_change") {
        console.log(`  ${c.delta > 0 ? "+" : ""}${c.delta} resource: ${c.desc}`);
      } else if (c.type === "era") {
        console.log(`  ERA: ${c.desc}`);
      } else if (c.type === "template") {
        console.log(`  TEMPLATE: ${c.entities} entities - ${c.desc}`);
      }
    });
  }
}

// Check epoch stats for resource trajectory
console.log("\n=== EPOCH STATS (resource_availibility) ===\n");
epochStats.slice(0, 10).forEach((e, i) => {
  console.log(`Epoch ${i}: ${e.pressures?.resource_availibility?.toFixed(2) || "N/A"}`);
});

// Count template executions by type during expansion
console.log("\n=== TEMPLATE ACTIVITY (expansion era) ===\n");
const templateCounts = {};
expansionEvents.forEach(e => {
  if (e.description) {
    // Extract template name from description patterns
    const match = e.description.match(/^([A-Za-z\s]+):/);
    if (match) {
      const name = match[1].trim();
      templateCounts[name] = (templateCounts[name] || 0) + 1;
    }
  }
});
Object.entries(templateCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([name, count]) => console.log(`  ${name}: ${count}`));

// Check what generators are actually producing pressure changes
console.log("\n=== PRESSURE CHANGES BY SOURCE ===\n");
const pressureSources = {};
expansionEvents.forEach(e => {
  if (e.pressureChanges && e.pressureChanges.resource_availibility) {
    const delta = e.pressureChanges.resource_availibility;
    const key = e.description?.substring(0, 50) || "unknown";
    if (!pressureSources[key]) pressureSources[key] = { total: 0, count: 0 };
    pressureSources[key].total += delta;
    pressureSources[key].count++;
  }
});
Object.entries(pressureSources)
  .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
  .forEach(([name, data]) => {
    console.log(`  ${data.total > 0 ? "+" : ""}${data.total.toFixed(1)} (${data.count}x): ${name}`);
  });

// Look for era entry mutation in history
console.log("\n=== ERA ENTRY EVENTS ===\n");
history.filter(e =>
  e.type === "era" ||
  e.type === "era_transition" ||
  e.description?.toLowerCase().includes("era") ||
  e.description?.toLowerCase().includes("thaw")
).slice(0, 10).forEach(e => {
  console.log(JSON.stringify(e, null, 2).substring(0, 300));
  console.log("---");
});
