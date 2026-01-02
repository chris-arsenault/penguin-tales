const fs = require("fs");

const files = [
  "run-jan-2-1-38-pm-213-entities.canonry-slot.json",
  "run-jan-2-1-40-pm-218-entities.canonry-slot.json",
  "run-jan-2-1-42-pm-198-entities.canonry-slot.json",
  "run-jan-2-1-42-pm-210-entities.canonry-slot.json"
];

console.log("=== SEARCHING SYSTEM ACTIONS FOR ISOLATION DECAY ===\n");

files.forEach((file, idx) => {
  const d = JSON.parse(fs.readFileSync(file));
  const systemActions = d.simulationState?.systemActions || [];

  console.log(`\nRun ${idx + 1}: ${systemActions.length} system action records`);

  // Look for our system
  const isoDecay = systemActions.filter(a =>
    a.systemId === "cleansed_isolation_decay" ||
    a.systemName?.includes("Sacred Ground")
  );

  if (isoDecay.length > 0) {
    console.log(`  Found ${isoDecay.length} isolation decay actions:`);
    isoDecay.forEach(a => {
      console.log(`    Tick ${a.tick}: ${a.description}`);
    });
  } else {
    console.log(`  NO isolation decay actions found`);
  }

  // List unique system IDs
  const uniqueIds = [...new Set(systemActions.map(a => a.systemId))];
  console.log(`  Unique systems that ran: ${uniqueIds.length}`);
  console.log(`  Systems: ${uniqueIds.sort().join(", ")}`);
});
