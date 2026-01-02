const fs = require("fs");

const file = "run-jan-2-4-25-am-210-entities.canonry-slot.json";
const d = JSON.parse(fs.readFileSync(file));
const updates = d.simulationState?.pressureUpdates || [];

console.log("=== UNIVERSAL CATALYST BREAKDOWN ===\n");

// Find all universal_catalyst resource modifications and trace back to actions
const catalystMods = [];
updates.forEach(u => {
  const mods = u.discreteModifications || [];
  mods.filter(m =>
    m.pressureId === "resource_availibility" &&
    m.source?.systemId === "universal_catalyst"
  ).forEach(m => {
    catalystMods.push({
      tick: u.tick,
      delta: m.delta,
      source: m.source
    });
  });
});

console.log(`Total universal_catalyst resource mods: ${catalystMods.length}`);
console.log(`Total delta: +${catalystMods.reduce((s, m) => s + m.delta, 0)}`);

// Group by delta value to see patterns
const byDelta = {};
catalystMods.forEach(m => {
  byDelta[m.delta] = (byDelta[m.delta] || 0) + 1;
});
console.log("\nBy delta value:");
Object.entries(byDelta).sort((a, b) => b[1] - a[1]).forEach(([delta, count]) => {
  console.log(`  +${delta}: ${count}x`);
});

// Now look at systemActions to understand what actions trigger resource changes
const systemActions = d.simulationState?.systemActions || [];
console.log(`\nTotal system actions: ${systemActions.length}`);

// Filter to actions that might affect resources
const resourceActions = systemActions.filter(a =>
  a.pressureChanges?.resource_availibility !== undefined ||
  a.action?.includes("resource") ||
  a.action?.includes("trade") ||
  a.action?.includes("krill")
);

console.log(`Actions affecting resources: ${resourceActions.length}`);

// Group all system actions by action type
const byAction = {};
systemActions.forEach(a => {
  const key = a.action || a.actionId || "unknown";
  if (!byAction[key]) byAction[key] = { count: 0, resourceDelta: 0 };
  byAction[key].count++;
  if (a.pressureChanges?.resource_availibility) {
    byAction[key].resourceDelta += a.pressureChanges.resource_availibility;
  }
});

console.log("\n=== ALL SYSTEM ACTIONS ===\n");
Object.entries(byAction)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 20)
  .forEach(([action, data]) => {
    const resStr = data.resourceDelta !== 0 ? ` (resource: ${data.resourceDelta > 0 ? "+" : ""}${data.resourceDelta})` : "";
    console.log(`  ${data.count}x: ${action}${resStr}`);
  });

// Look at actions.json to see what actions have resource effects
console.log("\n=== CHECKING ACTIONS WITH RESOURCE EFFECTS ===\n");

// Sample some systemActions to see their structure
console.log("Sample system action structure:");
console.log(JSON.stringify(systemActions[0], null, 2));

// Check catalystStats for more detail
const catalystStats = d.simulationState?.catalystStats;
if (catalystStats) {
  console.log("\n=== CATALYST STATS ===\n");
  console.log(JSON.stringify(catalystStats, null, 2).substring(0, 2000));
}
