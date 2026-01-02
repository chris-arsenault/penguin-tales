const d = require("./run-jan-2-4-25-am-210-entities.canonry-slot.json");
const updates = d.simulationState?.pressureUpdates || [];
console.log("Total pressure updates:", updates.length);
console.log("");

// Filter to resource_availibility
const resourceUpdates = updates.filter(u => u.pressureId === "resource_availibility");
console.log("Resource availability updates:", resourceUpdates.length);
console.log("");

// Group by source
const bySource = {};
resourceUpdates.forEach(u => {
  const key = u.source || "unknown";
  if (!bySource[key]) bySource[key] = { total: 0, count: 0 };
  bySource[key].total += u.delta || 0;
  bySource[key].count++;
});

console.log("=== BY SOURCE ===");
Object.entries(bySource)
  .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
  .forEach(([src, data]) => {
    const sign = data.total > 0 ? "+" : "";
    console.log(sign + data.total.toFixed(1) + " (" + data.count + "x): " + src.substring(0, 60));
  });

console.log("");
console.log("=== FIRST 20 CHANGES ===");
resourceUpdates.slice(0, 20).forEach(u => {
  const sign = u.delta > 0 ? "+" : "";
  console.log("Tick " + u.tick + ": " + sign + u.delta + " from " + (u.source || "?").substring(0, 50));
});

// Check for era effects
console.log("");
console.log("=== ERA ENTRY/EXIT EFFECTS ===");
updates.filter(u =>
  u.source?.includes("era") ||
  u.source?.includes("Era") ||
  u.source?.includes("Thaw") ||
  u.source?.includes("entry")
).forEach(u => {
  console.log("Tick " + u.tick + ": " + u.pressureId + " " + (u.delta > 0 ? "+" : "") + u.delta + " from " + u.source);
});
