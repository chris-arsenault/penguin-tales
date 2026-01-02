const fs = require("fs");

const file = "run-jan-2-1-38-pm-213-entities.canonry-slot.json";
const d = JSON.parse(fs.readFileSync(file));

const history = d.worldData.history || [];

console.log("=== SEARCHING FOR SYSTEM EXECUTION EVIDENCE ===\n");

// Search for any mention of "Sacred Ground" or system-related descriptions
const sacredGroundEvents = history.filter(e =>
  e.description?.includes("Sacred Ground")
);
console.log(`Events with "Sacred Ground": ${sacredGroundEvents.length}`);

// Search for "dormant", "no matches", "trigger(s)"
const systemStatusEvents = history.filter(e =>
  e.description?.includes("dormant") ||
  e.description?.includes("no matches") ||
  e.description?.includes("trigger(s)")
);
console.log(`Events with system status words: ${systemStatusEvents.length}`);
if (systemStatusEvents.length > 0) {
  systemStatusEvents.slice(0, 5).forEach(e => console.log(`  ${e.description}`));
}

// Search for any event that mentions cleansed_isolation_decay
const isoDecayEvents = history.filter(e =>
  JSON.stringify(e).includes("cleansed_isolation_decay") ||
  JSON.stringify(e).includes("isolation")
);
console.log(`Events mentioning isolation: ${isoDecayEvents.length}`);

// Look at the structure of simulation events
console.log("\n=== SIMULATION EVENT STRUCTURE ===\n");
const simEvents = history.filter(e => e.type === "simulation");
console.log(`Total simulation events: ${simEvents.length}`);

// Sample a few simulation events to see their structure
console.log("\nSample simulation events:");
simEvents.slice(0, 3).forEach((e, i) => {
  console.log(`\nEvent ${i + 1}:`);
  console.log(JSON.stringify(e, null, 2));
});

// Check if there's a separate systems log
console.log("\n=== CHECKING FOR SYSTEM LOGS ===\n");
const simState = d.simulationState || {};
console.log("simulationState keys:", Object.keys(simState));

if (simState.systemLogs) {
  console.log("systemLogs:", Object.keys(simState.systemLogs));
}

if (simState.systemResults) {
  console.log("systemResults sample:", JSON.stringify(simState.systemResults.slice?.(0, 2), null, 2));
}

// Check for any systems-related field in the run data
console.log("\n=== TOP-LEVEL KEYS ===\n");
console.log(Object.keys(d));
