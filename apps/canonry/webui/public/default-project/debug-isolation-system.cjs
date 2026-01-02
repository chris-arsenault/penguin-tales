const fs = require("fs");

const file = "run-jan-2-1-38-pm-213-entities.canonry-slot.json";
const d = JSON.parse(fs.readFileSync(file));

console.log("=== ISOLATION DECAY SYSTEM DEBUG ===\n");

const history = d.worldData.history || [];
const entities = Object.values(d.worldData.hardState || {});
const relationships = d.worldData.relationships || [];

// Find innovation era
const innovationEra = entities.find(e => e.kind === "era" && e.subtype === "innovation");
if (!innovationEra) {
  console.log("No innovation era found");
  process.exit(1);
}

const innovStart = innovationEra.createdAt;
const innovEnd = innovationEra.temporal?.endTick || 150;
console.log(`Innovation era: tick ${innovStart} - ${innovEnd}\n`);

// Track cleansed locations tick by tick during innovation
console.log("=== CLEANSED LOCATIONS DURING INNOVATION ===\n");

// Find all cleansing events
const cleansingEvents = history.filter(e =>
  e.description?.includes("purified") ||
  e.description?.includes("cleansed")
);

// Find all corruption events (that remove cleansed)
const corruptionEvents = history.filter(e =>
  e.description?.includes("spread corruption") ||
  (e.description?.includes("corrupted") && !e.description?.includes("purified"))
);

// Build timeline of cleansed status by location
const locationStatus = {};
const allLocations = entities.filter(e => e.kind === "location");

// Initialize - check which were cleansed at start
allLocations.forEach(loc => {
  // Check if cleansed before innovation
  const cleansesBefore = cleansingEvents.filter(e =>
    e.tick < innovStart &&
    e.description?.includes(loc.name)
  );
  const corruptsBefore = corruptionEvents.filter(e =>
    e.tick < innovStart &&
    e.description?.includes(loc.name)
  );

  // Simple heuristic: was last event a cleanse?
  const lastCleanse = cleansesBefore.length > 0 ? Math.max(...cleansesBefore.map(e => e.tick)) : -1;
  const lastCorrupt = corruptsBefore.length > 0 ? Math.max(...corruptsBefore.map(e => e.tick)) : -1;

  locationStatus[loc.id] = {
    name: loc.name,
    cleansed: lastCleanse > lastCorrupt,
    lastChange: Math.max(lastCleanse, lastCorrupt)
  };
});

// Count cleansed at innovation start
const cleansedAtStart = Object.values(locationStatus).filter(s => s.cleansed);
console.log(`Cleansed locations at innovation start: ${cleansedAtStart.length}`);
cleansedAtStart.forEach(s => console.log(`  - ${s.name}`));

// Simulate tick by tick during innovation
console.log(`\n=== TICK-BY-TICK DURING INNOVATION ===\n`);

for (let tick = innovStart; tick <= innovEnd; tick++) {
  // Apply events at this tick
  const tickCleanses = cleansingEvents.filter(e => e.tick === tick);
  const tickCorrupts = corruptionEvents.filter(e => e.tick === tick);

  tickCleanses.forEach(e => {
    const loc = allLocations.find(l => e.description?.includes(l.name));
    if (loc && locationStatus[loc.id]) {
      locationStatus[loc.id].cleansed = true;
      locationStatus[loc.id].lastChange = tick;
    }
  });

  tickCorrupts.forEach(e => {
    const loc = allLocations.find(l => e.description?.includes(l.name));
    if (loc && locationStatus[loc.id]) {
      locationStatus[loc.id].cleansed = false;
      locationStatus[loc.id].lastChange = tick;
    }
  });

  // Count cleansed and check for isolated ones
  const cleansedNow = Object.entries(locationStatus).filter(([_, s]) => s.cleansed);

  if (cleansedNow.length > 0) {
    // Check for isolated cleansed (0 cleansed neighbors)
    const isolated = cleansedNow.filter(([locId, _]) => {
      const adjacencies = relationships.filter(r =>
        r.kind === "adjacent_to" &&
        r.status !== "historical" &&
        (r.src === locId || r.dst === locId)
      );

      const adjacentIds = adjacencies.map(r => r.src === locId ? r.dst : r.src);
      const cleansedNeighbors = adjacentIds.filter(id => locationStatus[id]?.cleansed);
      return cleansedNeighbors.length === 0;
    });

    if (isolated.length > 0) {
      console.log(`Tick ${tick}: ${cleansedNow.length} cleansed, ${isolated.length} ISOLATED`);
      isolated.forEach(([_, s]) => console.log(`    ^ ${s.name} - should trigger decay!`));
    }
  }
}

// Check what systems were recorded as running
console.log(`\n=== SYSTEM EXECUTION CHECK ===\n`);

// Check if any threshold trigger systems logged during innovation
const simEvents = history.filter(e =>
  e.type === "simulation" &&
  e.tick >= innovStart &&
  e.tick <= innovEnd
);

console.log(`Simulation events during innovation: ${simEvents.length}`);

// Look for any system-related fields
const systemFields = new Set();
simEvents.forEach(e => {
  Object.keys(e).forEach(k => {
    if (k !== "tick" && k !== "type" && k !== "description" && k !== "era") {
      systemFields.add(k);
    }
  });
});
console.log(`Event fields found: ${[...systemFields].join(", ") || "(none besides standard)"}`);

// Sample some simulation events
console.log(`\nSample simulation events during innovation:`);
simEvents.slice(0, 5).forEach(e => {
  console.log(`  Tick ${e.tick}: ${e.description?.substring(0, 70)}...`);
});

// Check the run's config to see if system was included
console.log(`\n=== CHECKING IF SYSTEM WAS IN RUN CONFIG ===\n`);

// The systems config isn't usually saved in the run file, so let's check if we can find evidence
const allDescriptions = history.map(e => e.description || "").join(" ");
if (allDescriptions.includes("Sacred Ground Fades")) {
  console.log("✓ Found 'Sacred Ground Fades' in history - system ran at least once");
} else {
  console.log("✗ No 'Sacred Ground Fades' found - system may not have run");
}

// Check for the system name variations
const systemIndicators = [
  "isolation decay",
  "sacred ground",
  "lost its protection",
  "wards weaken"
];

systemIndicators.forEach(indicator => {
  const found = allDescriptions.toLowerCase().includes(indicator.toLowerCase());
  console.log(`  "${indicator}": ${found ? "found" : "not found"}`);
});
