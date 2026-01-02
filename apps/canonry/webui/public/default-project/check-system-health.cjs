const fs = require("fs");

const file = "run-jan-2-1-38-pm-213-entities.canonry-slot.json";
const d = JSON.parse(fs.readFileSync(file));

const simState = d.simulationState || {};

console.log("=== SYSTEM HEALTH ===\n");
const health = simState.systemHealth || {};
console.log(JSON.stringify(health, null, 2));

console.log("\n=== SYSTEM ACTIONS ===\n");
const actions = simState.systemActions || {};
console.log(JSON.stringify(actions, null, 2));

// Check if cleansed_isolation_decay is mentioned anywhere
console.log("\n=== SEARCHING FOR cleansed_isolation_decay ===\n");
const fullJson = JSON.stringify(d);
if (fullJson.includes("cleansed_isolation_decay")) {
  console.log("Found 'cleansed_isolation_decay' in run data");

  // Find context
  const idx = fullJson.indexOf("cleansed_isolation_decay");
  console.log("Context:", fullJson.substring(Math.max(0, idx - 100), idx + 150));
} else {
  console.log("'cleansed_isolation_decay' NOT found anywhere in run data");
}

// Check for "Sacred Ground"
if (fullJson.includes("Sacred Ground")) {
  console.log("\nFound 'Sacred Ground' in run data");
} else {
  console.log("\n'Sacred Ground' NOT found anywhere in run data");
}

// List all unique system names from systemHealth
console.log("\n=== SYSTEMS IN HEALTH REPORT ===\n");
Object.keys(health).forEach(k => console.log(`  - ${k}`));
