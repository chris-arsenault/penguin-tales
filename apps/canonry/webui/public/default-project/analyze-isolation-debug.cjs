const fs = require("fs");

const file = "run-jan-2-1-38-pm-213-entities.canonry-slot.json";
const d = JSON.parse(fs.readFileSync(file));

console.log("=== ISOLATION DECAY DEBUG ===\n");

// Check if system exists in the run config
const systemLogs = d.simulationState?.systemLogs || {};
console.log("System execution logs:");
Object.keys(systemLogs).filter(k => k.includes("cleansed") || k.includes("isolation")).forEach(k => {
  console.log(`  ${k}: ${JSON.stringify(systemLogs[k])}`);
});

// Check history for any cleansed_isolation_decay mentions
const history = d.worldData.history || [];
const isolationMentions = history.filter(e =>
  JSON.stringify(e).toLowerCase().includes("isolation") ||
  JSON.stringify(e).toLowerCase().includes("sacred ground") ||
  e.systemId === "cleansed_isolation_decay"
);
console.log(`\nHistory events mentioning isolation: ${isolationMentions.length}`);
if (isolationMentions.length > 0) {
  isolationMentions.slice(0, 5).forEach(e => console.log(`  ${JSON.stringify(e)}`));
}

// Check pressures directly
console.log("\n=== PRESSURE VALUES ===");
const finalPressures = d.worldData.pressures;
console.log("Final pressures:", finalPressures);

// Try to get trajectory from pressure updates
const updates = d.simulationState?.pressureUpdates || [];
console.log(`\nTotal pressure updates: ${updates.length}`);

if (updates.length > 0) {
  // Sample first few and last few
  console.log("\nFirst 3 updates:");
  updates.slice(0, 3).forEach(u => {
    console.log(`  Tick ${u.tick}: ${JSON.stringify(u.pressures || {})}`);
  });

  console.log("\nLast 3 updates:");
  updates.slice(-3).forEach(u => {
    console.log(`  Tick ${u.tick}: ${JSON.stringify(u.pressures || {})}`);
  });
}

// Check system results for cleansed_isolation_decay
console.log("\n=== LOOKING FOR SYSTEM RESULTS ===");
const systemResults = history.filter(e => e.type === "simulation" && e.systemId);
const uniqueSystems = [...new Set(systemResults.map(e => e.systemId))];
console.log(`Unique system IDs in history: ${uniqueSystems.join(", ")}`);

// Find tick-by-tick simulation events during innovation
const entities = Object.values(d.worldData.hardState || {});
const innovationEra = entities.find(e => e.kind === "era" && e.subtype === "innovation");
if (innovationEra) {
  const start = innovationEra.createdAt;
  const end = innovationEra.temporal?.endTick || 150;
  console.log(`\nInnovation era: tick ${start} - ${end}`);

  const innovationSimEvents = systemResults.filter(e => e.tick >= start && e.tick <= end);
  const innovationSystems = [...new Set(innovationSimEvents.map(e => e.systemId))];
  console.log(`Systems active during innovation: ${innovationSystems.join(", ")}`);
}

// Check if cleansed tag exists on any locations over time
console.log("\n=== CLEANSED TAG TIMELINE ===");
const cleansedHistory = history.filter(e =>
  e.description?.toLowerCase().includes("cleansed") ||
  e.description?.toLowerCase().includes("purified")
);
console.log(`Events adding cleansed: ${cleansedHistory.length}`);
cleansedHistory.slice(0, 10).forEach(e => {
  console.log(`  Tick ${e.tick}: ${e.description?.substring(0, 80)}`);
});

// Check isolation conditions manually
console.log("\n=== MANUAL ISOLATION CHECK (Final State) ===");
const relationships = d.worldData.relationships || [];
const locations = entities.filter(e => e.kind === "location");
const cleansedLocs = locations.filter(e => e.tags?.cleansed);

console.log(`Total locations: ${locations.length}`);
console.log(`Cleansed locations: ${cleansedLocs.length}`);

cleansedLocs.forEach(loc => {
  const adjacencies = relationships.filter(r =>
    r.kind === "adjacent_to" &&
    r.status !== "historical" &&
    (r.src === loc.id || r.dst === loc.id)
  );

  const adjacentIds = adjacencies.map(r => r.src === loc.id ? r.dst : r.src);
  const neighbors = adjacentIds.map(id => entities.find(e => e.id === id)).filter(Boolean);
  const cleansedNeighbors = neighbors.filter(n => n.tags?.cleansed);

  console.log(`  ${loc.name}: ${adjacentIds.length} neighbors, ${cleansedNeighbors.length} cleansed`);
  if (cleansedNeighbors.length === 0) {
    console.log(`    ^ ISOLATED - should trigger decay`);
  }
});

// Check era systemModifiers
console.log("\n=== ERA CONFIG CHECK ===");
const eraConfig = d.config?.eras || [];
eraConfig.forEach(era => {
  const modifier = era.systemModifiers?.cleansed_isolation_decay;
  console.log(`  ${era.id}: cleansed_isolation_decay modifier = ${modifier}`);
});
