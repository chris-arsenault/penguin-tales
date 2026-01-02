const fs = require("fs");

const files = [
  "run-jan-2-1-38-pm-213-entities.canonry-slot.json",
  "run-jan-2-1-40-pm-218-entities.canonry-slot.json",
  "run-jan-2-1-42-pm-198-entities.canonry-slot.json",
  "run-jan-2-1-42-pm-210-entities.canonry-slot.json"
];

console.log("=== DEEP DIVE: NEW SYSTEMS ANALYSIS ===\n");

files.forEach((file, idx) => {
  const d = JSON.parse(fs.readFileSync(file));
  const history = d.worldData.history || [];
  const entities = Object.values(d.worldData.hardState || {});
  const pressureUpdates = d.simulationState?.pressureUpdates || [];

  console.log(`\n--- Run ${idx + 1} ---`);

  // Check for dark_ritual template executions
  const templateEvents = history.filter(e => e.type === "growth" || e.type === "template");
  const darkRitualEvents = templateEvents.filter(e =>
    e.templateId === "dark_ritual" ||
    e.description?.toLowerCase().includes("dark ritual")
  );
  console.log(`Dark Ritual template executions: ${darkRitualEvents.length}`);

  // Check for cleansed_isolation_decay system executions
  const systemEvents = history.filter(e => e.type === "simulation");
  const isolationEvents = systemEvents.filter(e =>
    e.systemId === "cleansed_isolation_decay" ||
    e.description?.toLowerCase().includes("sacred ground") ||
    e.description?.toLowerCase().includes("isolation")
  );
  console.log(`Isolation decay events: ${isolationEvents.length}`);

  // Count cults (needed for dark_ritual)
  const cults = entities.filter(e => e.kind === "faction" && e.subtype === "cult");
  console.log(`Cults in final state: ${cults.length}`);

  // Count cleansed locations (needed for both systems)
  const cleansedLocs = entities.filter(e => e.kind === "location" && e.tags?.cleansed);
  console.log(`Cleansed locations in final state: ${cleansedLocs.length}`);

  // Magical stability trajectory
  console.log("\nMagical Stability Trajectory:");
  const msValues = [];
  pressureUpdates.forEach(u => {
    if (u.pressures?.magical_stability !== undefined) {
      msValues.push({ tick: u.tick, value: u.pressures.magical_stability });
    }
  });

  if (msValues.length > 0) {
    // Sample every 25 ticks
    const samples = [0, 25, 50, 75, 100, 125, 150, 175, 200];
    samples.forEach(targetTick => {
      const closest = msValues.reduce((prev, curr) =>
        Math.abs(curr.tick - targetTick) < Math.abs(prev.tick - targetTick) ? curr : prev
      );
      if (Math.abs(closest.tick - targetTick) < 10) {
        process.stdout.write(`  t${targetTick}: ${closest.value.toFixed(0)} → `);
      }
    });
    console.log();

    const minEntry = msValues.reduce((a, b) => a.value < b.value ? a : b);
    const maxEntry = msValues.reduce((a, b) => a.value > b.value ? a : b);
    console.log(`  Min: ${minEntry.value.toFixed(1)} @ tick ${minEntry.tick}`);
    console.log(`  Max: ${maxEntry.value.toFixed(1)} @ tick ${maxEntry.tick}`);
    console.log(`  Final: ${msValues[msValues.length - 1].value.toFixed(1)}`);
  }

  // Era boundaries
  const eras = entities.filter(e => e.kind === "era").sort((a, b) => a.createdAt - b.createdAt);
  console.log("\nEra Timeline:");
  eras.forEach(era => {
    const start = era.createdAt;
    const end = era.temporal?.endTick || "ongoing";
    console.log(`  ${era.subtype}: tick ${start} - ${end}`);
  });
});

// Check why dark_ritual might not be firing
console.log("\n\n=== DARK RITUAL APPLICABILITY CHECK ===\n");

files.forEach((file, idx) => {
  const d = JSON.parse(fs.readFileSync(file));
  const entities = Object.values(d.worldData.hardState || {});
  const pressureUpdates = d.simulationState?.pressureUpdates || [];

  // Get innovation era ticks
  const innovationEra = entities.find(e => e.kind === "era" && e.subtype === "innovation");
  if (!innovationEra) {
    console.log(`Run ${idx + 1}: Innovation era not reached`);
    return;
  }

  const innovationStart = innovationEra.createdAt;
  const innovationEnd = innovationEra.temporal?.endTick || 999;

  // Count cults during innovation
  const cultsCreatedBeforeInnovationEnd = entities.filter(e =>
    e.kind === "faction" &&
    e.subtype === "cult" &&
    e.createdAt <= innovationEnd
  );

  // Check magical stability during innovation
  const msDuringInnovation = pressureUpdates
    .filter(u => u.tick >= innovationStart && u.tick <= innovationEnd)
    .map(u => u.pressures?.magical_stability)
    .filter(v => v !== undefined);

  const msMin = msDuringInnovation.length > 0 ? Math.min(...msDuringInnovation) : "N/A";
  const msMax = msDuringInnovation.length > 0 ? Math.max(...msDuringInnovation) : "N/A";

  // Count cleansed locations created before innovation
  const cleansedDuringInnovation = entities.filter(e =>
    e.kind === "location" &&
    e.tags?.cleansed &&
    e.updatedAt <= innovationEnd
  );

  console.log(`Run ${idx + 1}:`);
  console.log(`  Innovation era: tick ${innovationStart} - ${innovationEnd}`);
  console.log(`  Cults available: ${cultsCreatedBeforeInnovationEnd.length}`);
  console.log(`  Cleansed locations: ${cleansedDuringInnovation.length}`);
  console.log(`  Magical stability range: ${msMin} to ${msMax} (dark_ritual needs > -30)`);

  if (cultsCreatedBeforeInnovationEnd.length === 0) {
    console.log(`  ⚠ NO CULTS - dark_ritual cannot fire`);
  }
  if (cleansedDuringInnovation.length === 0) {
    console.log(`  ⚠ NO CLEANSED LOCATIONS - dark_ritual has no targets`);
  }
});

// Check why isolation decay might not be firing
console.log("\n\n=== ISOLATION DECAY CHECK ===\n");

files.forEach((file, idx) => {
  const d = JSON.parse(fs.readFileSync(file));
  const entities = Object.values(d.worldData.hardState || {});
  const relationships = d.worldData.relationships || [];

  // Find cleansed locations and check their adjacencies
  const cleansedLocs = entities.filter(e => e.kind === "location" && e.tags?.cleansed);
  const allLocs = entities.filter(e => e.kind === "location");

  console.log(`Run ${idx + 1}:`);
  console.log(`  Total locations: ${allLocs.length}`);
  console.log(`  Cleansed locations: ${cleansedLocs.length}`);

  if (cleansedLocs.length > 0) {
    // For each cleansed location, count adjacent cleansed neighbors
    let isolatedCount = 0;
    cleansedLocs.forEach(loc => {
      const adjacencies = relationships.filter(r =>
        r.kind === "adjacent_to" &&
        r.status !== "historical" &&
        (r.src === loc.id || r.dst === loc.id)
      );

      const adjacentIds = adjacencies.map(r => r.src === loc.id ? r.dst : r.src);
      const adjacentCleansed = adjacentIds.filter(id => {
        const adjLoc = entities.find(e => e.id === id);
        return adjLoc?.tags?.cleansed;
      });

      if (adjacentCleansed.length === 0) {
        isolatedCount++;
      }
    });
    console.log(`  Isolated cleansed (0 cleansed neighbors): ${isolatedCount}`);
    if (isolatedCount === 0) {
      console.log(`  → All cleansed locations have cleansed neighbors (no isolation decay triggers)`);
    }
  }
});
