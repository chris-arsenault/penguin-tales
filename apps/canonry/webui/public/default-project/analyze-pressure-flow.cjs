const fs = require("fs");

const file = "run-jan-2-4-25-am-210-entities.canonry-slot.json";
const data = JSON.parse(fs.readFileSync(file));

console.log("=== INITIAL STATE ===\n");
console.log("Initial pressures:", data.simulationState?.pressures);

console.log("\n=== FIRST 10 HISTORY EVENTS WITH FULL DETAIL ===\n");
const history = data.worldData.history || [];
history.slice(0, 10).forEach((e, i) => {
  console.log(`[${i}] Tick ${e.tick} (${e.type}):`);
  console.log(`  Description: ${e.description || "N/A"}`);
  console.log(`  Era: ${e.era || "N/A"}`);
  if (e.pressureChanges && Object.keys(e.pressureChanges).length > 0) {
    console.log(`  Pressure Changes: ${JSON.stringify(e.pressureChanges)}`);
  }
  if (e.entitiesCreated && e.entitiesCreated.length > 0) {
    console.log(`  Entities Created: ${e.entitiesCreated.length}`);
  }
  console.log();
});

// Check ALL events for pressureChanges
console.log("=== ALL EVENTS WITH PRESSURE CHANGES ===\n");
const withPressure = history.filter(e => e.pressureChanges && Object.keys(e.pressureChanges).length > 0);
console.log(`Total events with pressureChanges: ${withPressure.length} / ${history.length}`);
withPressure.slice(0, 10).forEach(e => {
  console.log(`  Tick ${e.tick}: ${JSON.stringify(e.pressureChanges)} - ${e.description?.substring(0, 40)}`);
});

// Look for era entry events specifically
console.log("\n=== ERA TRANSITIONS ===\n");
history.filter(e => e.type === "special" || e.type === "era_transition").forEach(e => {
  console.log(`Tick ${e.tick}: ${e.description}`);
  console.log(`  pressureChanges: ${JSON.stringify(e.pressureChanges) || "NONE"}`);
});

// Check simulation state for pressure history
console.log("\n=== PRESSURE VALUES BY EPOCH (first 15) ===\n");
const epochStats = data.simulationState?.epochStats || [];
epochStats.slice(0, 15).forEach((e, i) => {
  const p = e.pressures || {};
  console.log(`Epoch ${i}: res=${p.resource_availibility?.toFixed(1)}, harm=${p.harmony?.toFixed(1)}, sec=${p.security?.toFixed(1)}, mag=${p.magical_stability?.toFixed(1)}`);
});

// Look at pressure feedback vs template stateUpdates
console.log("\n=== CHECKING PRESSURE FEEDBACK SYSTEM ===\n");
// The resource_diffusion system should show in epochStats
// Let's look at what's in pressures.json that might affect initial state
