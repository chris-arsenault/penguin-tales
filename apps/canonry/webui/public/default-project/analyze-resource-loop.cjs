const fs = require("fs");

const files = [
  "run-jan-2-4-25-am-210-entities.canonry-slot.json",
  "run-jan-2-4-25-am-204-entities.canonry-slot.json",
  "run-jan-2-4-26-am-209-entities.canonry-slot.json",
  "run-jan-2-4-26-am-204-entities.canonry-slot.json"
];

function analyzeRun(filename) {
  const data = JSON.parse(fs.readFileSync(filename));
  const worldData = data.worldData;
  const history = worldData.history || [];
  const epochStats = data.simulationState?.epochStats || [];
  const hardState = worldData.hardState || {};

  // Get resource_availability over time
  const resourceValues = epochStats.map(e => e.pressures?.resource_availibility || 0);

  // Count oscillations
  let oscillations = 0;
  let lastDir = null;
  for (let i = 1; i < resourceValues.length; i++) {
    const delta = resourceValues[i] - resourceValues[i-1];
    if (Math.abs(delta) < 1) continue;
    const dir = delta > 0 ? "up" : "down";
    if (lastDir && dir !== lastDir) oscillations++;
    lastDir = dir;
  }

  // Track pressure modifications from templates
  const simEvents = history.filter(e => e.type === "simulation");
  const pressureMods = { sources: {}, sinks: {} };

  simEvents.forEach(e => {
    if (e.pressureChanges) {
      Object.entries(e.pressureChanges).forEach(([pressure, delta]) => {
        if (pressure === "resource_availibility") {
          const bucket = delta > 0 ? "sources" : "sinks";
          const key = e.description?.substring(0, 50) || "unknown";
          pressureMods[bucket][key] = (pressureMods[bucket][key] || 0) + Math.abs(delta);
        }
      });
    }
  });

  // Count entities by relevant types
  const entities = Object.values(hardState);
  const colonies = entities.filter(e => e.kind === "location" && e.subtype === "colony");
  const guilds = entities.filter(e => e.kind === "faction" && e.subtype === "company");
  const crises = entities.filter(e => e.kind === "occurrence" && e.subtype === "disaster");
  const recoveries = entities.filter(e => e.kind === "occurrence" && e.subtype === "celebration");

  // Era tracking
  const eras = new Map();
  history.forEach(e => {
    if (e.era && !eras.has(e.era)) {
      eras.set(e.era, e.tick);
    }
  });

  // Find expansion era resource tracking
  const expansionTicks = [];
  let inExpansion = false;
  epochStats.forEach((e, i) => {
    // Check if we have era info or just track early ticks
    if (i < 30) { // Expansion typically first ~25 ticks
      expansionTicks.push(e.pressures?.resource_availibility || 0);
    }
  });

  return {
    filename: filename.replace(".canonry-slot.json", ""),
    resourceRange: [
      Math.min(...resourceValues).toFixed(1),
      Math.max(...resourceValues).toFixed(1)
    ],
    oscillations,
    resourceAtEpoch: {
      0: resourceValues[0]?.toFixed(1) || "N/A",
      5: resourceValues[5]?.toFixed(1) || "N/A",
      10: resourceValues[10]?.toFixed(1) || "N/A",
      15: resourceValues[15]?.toFixed(1) || "N/A",
      20: resourceValues[20]?.toFixed(1) || "N/A"
    },
    colonies: colonies.length,
    guilds: guilds.length,
    crises: crises.length,
    recoveries: recoveries.length,
    topSources: Object.entries(pressureMods.sources)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    topSinks: Object.entries(pressureMods.sinks)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    eras: [...eras.entries()]
  };
}

console.log("=== RESOURCE AVAILABILITY LOOP ANALYSIS ===\n");

files.forEach(f => {
  try {
    const r = analyzeRun(f);
    console.log(`--- ${r.filename} ---`);
    console.log(`Resource range: [${r.resourceRange.join(" to ")}], ${r.oscillations} oscillations`);
    console.log(`Resource by epoch: 0=${r.resourceAtEpoch[0]}, 5=${r.resourceAtEpoch[5]}, 10=${r.resourceAtEpoch[10]}, 15=${r.resourceAtEpoch[15]}, 20=${r.resourceAtEpoch[20]}`);
    console.log(`Entities: ${r.colonies} colonies, ${r.guilds} guilds, ${r.crises} crises, ${r.recoveries} recoveries`);
    console.log(`Eras: ${r.eras.map(([id, tick]) => `${id}@${tick}`).join(", ")}`);

    if (r.topSources.length > 0) {
      console.log("Top resource sources:");
      r.topSources.forEach(([desc, amt]) => console.log(`  +${amt}: ${desc}`));
    }
    if (r.topSinks.length > 0) {
      console.log("Top resource sinks:");
      r.topSinks.forEach(([desc, amt]) => console.log(`  -${amt}: ${desc}`));
    }
    console.log();
  } catch (err) {
    console.log(`Error analyzing ${f}: ${err.message}\n`);
  }
});

// Detailed epoch-by-epoch for first run
console.log("=== DETAILED RESOURCE TRAJECTORY (first run) ===\n");
try {
  const data = JSON.parse(fs.readFileSync(files[0]));
  const epochStats = data.simulationState?.epochStats || [];
  console.log("Epoch | Resource | Harmony | Security | Magical");
  console.log("------|----------|---------|----------|--------");
  epochStats.slice(0, 25).forEach((e, i) => {
    const p = e.pressures || {};
    console.log(`  ${String(i).padStart(2)}  |  ${String(p.resource_availibility?.toFixed(1) || 0).padStart(6)} |  ${String(p.harmony?.toFixed(1) || 0).padStart(5)} |   ${String(p.security?.toFixed(1) || 0).padStart(5)} |  ${String(p.magical_stability?.toFixed(1) || 0).padStart(5)}`);
  });
} catch (err) {
  console.log(`Error: ${err.message}`);
}
