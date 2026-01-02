const fs = require("fs");

const file = "run-jan-2-4-25-am-210-entities.canonry-slot.json";
const data = JSON.parse(fs.readFileSync(file));

const trace = data.simulationState?.simulationTrace || [];

console.log("=== SIMULATION TRACE PRESSURE CHANGES ===\n");
console.log(`Total trace entries: ${trace.length}\n`);

// Find entries with resource_availibility changes
const resourceChanges = trace.filter(t =>
  t.pressureChanges && t.pressureChanges.resource_availibility !== undefined
);

console.log(`Entries with resource_availibility changes: ${resourceChanges.length}\n`);

// Group by source
const bySource = {};
resourceChanges.forEach(t => {
  const key = t.source || t.description || "unknown";
  if (!bySource[key]) bySource[key] = { total: 0, count: 0 };
  bySource[key].total += t.pressureChanges.resource_availibility;
  bySource[key].count++;
});

console.log("=== RESOURCE CHANGES BY SOURCE ===\n");
Object.entries(bySource)
  .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
  .forEach(([src, data]) => {
    const sign = data.total > 0 ? "+" : "";
    console.log(`${sign}${data.total.toFixed(1)} (${data.count}x): ${src.substring(0, 60)}`);
  });

// Show first 20 resource changes chronologically
console.log("\n=== FIRST 20 RESOURCE CHANGES ===\n");
resourceChanges.slice(0, 20).forEach(t => {
  const delta = t.pressureChanges.resource_availibility;
  const sign = delta > 0 ? "+" : "";
  console.log(`Tick ${t.tick}: ${sign}${delta} - ${(t.source || t.description || "?").substring(0, 50)}`);
});

// Check for era entry effects
console.log("\n=== ERA ENTRY/EXIT EFFECTS ===\n");
trace.filter(t =>
  t.source?.includes("era") ||
  t.description?.includes("era") ||
  t.type === "era_entry" ||
  t.type === "era_exit"
).slice(0, 10).forEach(t => {
  console.log(`Tick ${t.tick}: ${t.source || t.description}`);
  if (t.pressureChanges) console.log(`  Changes: ${JSON.stringify(t.pressureChanges)}`);
});
