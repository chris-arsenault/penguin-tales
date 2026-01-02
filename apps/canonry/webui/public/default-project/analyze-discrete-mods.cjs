const fs = require("fs");

const files = [
  "run-jan-2-4-25-am-210-entities.canonry-slot.json",
  "run-jan-2-4-25-am-204-entities.canonry-slot.json",
  "run-jan-2-4-26-am-209-entities.canonry-slot.json",
  "run-jan-2-4-26-am-204-entities.canonry-slot.json"
];

console.log("=== RESOURCE AVAILABILITY LOOP VERIFICATION ===\n");

files.forEach(file => {
  const d = JSON.parse(fs.readFileSync(file));
  const updates = d.simulationState?.pressureUpdates || [];

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

  // Group by source
  const bySource = {};
  resourceMods.forEach(m => {
    if (!bySource[m.source]) bySource[m.source] = { total: 0, count: 0 };
    bySource[m.source].total += m.delta;
    bySource[m.source].count++;
  });

  console.log(`--- ${file.replace(".canonry-slot.json", "")} ---`);
  console.log(`Total resource modifications: ${resourceMods.length}`);
  console.log("");
  console.log("By source:");
  Object.entries(bySource)
    .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
    .forEach(([src, data]) => {
      const sign = data.total > 0 ? "+" : "";
      console.log(`  ${sign}${data.total} (${data.count}x): ${src}`);
    });

  // Check for era entry bonus
  const tick0Mods = resourceMods.filter(m => m.tick === 0);
  console.log("");
  console.log("Tick 0 modifications:", tick0Mods.length > 0 ? tick0Mods.map(m => `${m.delta} from ${m.source}`).join(", ") : "NONE");

  // First 10 chronological
  console.log("");
  console.log("First 10 resource changes:");
  resourceMods.slice(0, 10).forEach(m => {
    const sign = m.delta > 0 ? "+" : "";
    console.log(`  Tick ${m.tick}: ${sign}${m.delta} from ${m.source}`);
  });
  console.log("");
});

// Summary across all runs
console.log("=== SUMMARY ACROSS ALL RUNS ===\n");
const allSources = {};
files.forEach(file => {
  const d = JSON.parse(fs.readFileSync(file));
  const updates = d.simulationState?.pressureUpdates || [];
  updates.forEach(u => {
    (u.discreteModifications || [])
      .filter(m => m.pressureId === "resource_availibility")
      .forEach(m => {
        const src = m.source?.templateId || m.source?.systemId || "unknown";
        if (!allSources[src]) allSources[src] = { total: 0, count: 0 };
        allSources[src].total += m.delta;
        allSources[src].count++;
      });
  });
});

console.log("Resource pressure changes (all runs combined):");
Object.entries(allSources)
  .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
  .forEach(([src, data]) => {
    const sign = data.total > 0 ? "+" : "";
    const avg = (data.total / data.count).toFixed(1);
    console.log(`  ${sign}${data.total} total (${data.count}x, avg ${avg}): ${src}`);
  });
