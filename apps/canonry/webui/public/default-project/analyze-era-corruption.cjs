const fs = require("fs");

const files = [
  "run-jan-2-1-38-pm-213-entities.canonry-slot.json",
  "run-jan-2-1-40-pm-218-entities.canonry-slot.json",
  "run-jan-2-1-42-pm-198-entities.canonry-slot.json",
  "run-jan-2-1-42-pm-210-entities.canonry-slot.json"
];

console.log("=== WHY IS CONFLICT ERA MORE CORRUPT THAN INNOVATION? ===\n");

// Aggregate data
const eraData = {};

files.forEach((file, idx) => {
  const d = JSON.parse(fs.readFileSync(file));
  const history = d.worldData.history || [];
  const entities = Object.values(d.worldData.hardState || {});

  // Get era boundaries
  const eras = entities.filter(e => e.kind === "era").sort((a, b) => a.createdAt - b.createdAt);

  eras.forEach(era => {
    const eraId = era.subtype;
    const start = era.createdAt;
    const end = era.temporal?.endTick || 999;
    const duration = Math.min(end, 150) - start;

    if (!eraData[eraId]) {
      eraData[eraId] = {
        durations: [],
        corruptions: [],
        cleanses: [],
        corruptedLocs: [],
        cleansedLocs: [],
        cults: [],
        mysticalLocs: [],
        heroes: [],
        tomes: []
      };
    }

    eraData[eraId].durations.push(duration);

    // Count events during this era
    const eraEvents = history.filter(e => e.tick >= start && e.tick <= end);

    // Corruption events
    const corruptions = eraEvents.filter(e =>
      e.description?.match(/spread corruption to/i) ||
      (e.description?.match(/corrupted/i) && !e.description?.includes("purified"))
    ).length;

    // Cleansing events
    const cleanses = eraEvents.filter(e =>
      e.description?.match(/purified/i) ||
      e.description?.match(/cleansed/i)
    ).length;

    eraData[eraId].corruptions.push(corruptions);
    eraData[eraId].cleanses.push(cleanses);

    // Count entities at era START (available actors)
    const entitiesAtStart = entities.filter(e => e.createdAt <= start);

    // Corrupted locations at era start
    const corruptedLocs = entitiesAtStart.filter(e =>
      e.kind === "location" && e.tags?.corrupted
    ).length;

    // Cleansed locations at era start
    const cleansedLocs = entitiesAtStart.filter(e =>
      e.kind === "location" && e.tags?.cleansed
    ).length;

    // Cults
    const cults = entitiesAtStart.filter(e =>
      e.kind === "faction" && e.subtype === "cult"
    ).length;

    // Mystical locations (can spread corruption)
    const mysticalLocs = entitiesAtStart.filter(e =>
      e.kind === "location" && (e.tags?.mystical || e.tags?.anomaly)
    ).length;

    // Heroes (can cleanse)
    const heroes = entitiesAtStart.filter(e =>
      e.kind === "npc" && e.subtype === "hero" && e.status === "alive"
    ).length;

    // Mystical tomes (can cleanse)
    const tomes = entitiesAtStart.filter(e =>
      e.kind === "artifact" && e.subtype === "tome" && e.tags?.mystical
    ).length;

    eraData[eraId].corruptedLocs.push(corruptedLocs);
    eraData[eraId].cleansedLocs.push(cleansedLocs);
    eraData[eraId].cults.push(cults);
    eraData[eraId].mysticalLocs.push(mysticalLocs);
    eraData[eraId].heroes.push(heroes);
    eraData[eraId].tomes.push(tomes);
  });
});

// Calculate averages and print
const avg = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

console.log("ERA COMPARISON:\n");
console.log("Era            | Dur | Corrupt | Cleanse | Ratio  | Corrupt/tick");
console.log("---------------|-----|---------|---------|--------|-------------");

["expansion", "conflict", "innovation", "invasion", "reconstruction"].forEach(eraId => {
  const data = eraData[eraId];
  if (!data || data.durations.length === 0) return;

  const dur = avg(data.durations).toFixed(0);
  const corrupt = avg(data.corruptions).toFixed(1);
  const cleanse = avg(data.cleanses).toFixed(1);
  const ratio = avg(data.cleanses) > 0
    ? (avg(data.corruptions) / avg(data.cleanses)).toFixed(1)
    : "N/A";
  const perTick = (avg(data.corruptions) / avg(data.durations)).toFixed(2);

  console.log(`${eraId.padEnd(14)} | ${dur.padStart(3)} | ${corrupt.padStart(7)} | ${cleanse.padStart(7)} | ${ratio.padStart(6)} | ${perTick.padStart(12)}`);
});

console.log("\n\nACTOR POOLS AT ERA START:\n");
console.log("Era            | Cults | Mystical Locs | Corrupted | Cleansed | Heroes | Tomes");
console.log("---------------|-------|---------------|-----------|----------|--------|------");

["expansion", "conflict", "innovation", "invasion", "reconstruction"].forEach(eraId => {
  const data = eraData[eraId];
  if (!data || data.durations.length === 0) return;

  console.log(`${eraId.padEnd(14)} | ${avg(data.cults).toFixed(1).padStart(5)} | ${avg(data.mysticalLocs).toFixed(1).padStart(13)} | ${avg(data.corruptedLocs).toFixed(1).padStart(9)} | ${avg(data.cleansedLocs).toFixed(1).padStart(8)} | ${avg(data.heroes).toFixed(1).padStart(6)} | ${avg(data.tomes).toFixed(1).padStart(5)}`);
});

console.log("\n\n=== CORRUPTION RATE ANALYSIS ===\n");

const conflictData = eraData["conflict"];
const innovationData = eraData["innovation"];

if (conflictData && innovationData) {
  const conflictRate = avg(conflictData.corruptions) / avg(conflictData.durations);
  const innovationRate = avg(innovationData.corruptions) / avg(innovationData.durations);

  console.log(`Conflict era:`);
  console.log(`  Duration: ${avg(conflictData.durations).toFixed(0)} ticks`);
  console.log(`  Corruptions: ${avg(conflictData.corruptions).toFixed(1)}`);
  console.log(`  Rate: ${conflictRate.toFixed(2)} corruptions/tick`);
  console.log(`  Corrupted locs at start: ${avg(conflictData.corruptedLocs).toFixed(1)}`);
  console.log(`  Mystical locs (spreaders): ${avg(conflictData.mysticalLocs).toFixed(1)}`);

  console.log(`\nInnovation era:`);
  console.log(`  Duration: ${avg(innovationData.durations).toFixed(0)} ticks`);
  console.log(`  Corruptions: ${avg(innovationData.corruptions).toFixed(1)}`);
  console.log(`  Rate: ${innovationRate.toFixed(2)} corruptions/tick`);
  console.log(`  Corrupted locs at start: ${avg(innovationData.corruptedLocs).toFixed(1)}`);
  console.log(`  Mystical locs (spreaders): ${avg(innovationData.mysticalLocs).toFixed(1)}`);

  console.log(`\n=== KEY FINDING ===`);
  console.log(`Conflict is ${(avg(conflictData.durations) / avg(innovationData.durations)).toFixed(1)}x longer than Innovation`);
  console.log(`Conflict has ${(conflictRate / innovationRate).toFixed(1)}x higher corruption RATE`);
}

// Check why innovation has less corruption
console.log("\n\n=== INNOVATION ERA DEEP DIVE ===\n");

files.forEach((file, idx) => {
  const d = JSON.parse(fs.readFileSync(file));
  const history = d.worldData.history || [];
  const entities = Object.values(d.worldData.hardState || {});

  const innovationEra = entities.find(e => e.kind === "era" && e.subtype === "innovation");
  if (!innovationEra) {
    console.log(`Run ${idx + 1}: No innovation era`);
    return;
  }

  const start = innovationEra.createdAt;
  const end = innovationEra.temporal?.endTick || 150;

  console.log(`Run ${idx + 1}: Innovation tick ${start}-${end} (${end - start} ticks)`);

  // Count cleansed locations during innovation
  const cleansedAtStart = entities.filter(e =>
    e.kind === "location" &&
    e.tags?.cleansed &&
    e.updatedAt <= start
  ).length;

  const cleansedDuring = history.filter(e =>
    e.tick >= start && e.tick <= end &&
    (e.description?.includes("purified") || e.description?.includes("cleansed"))
  ).length;

  console.log(`  Cleansed locs at start: ${cleansedAtStart}`);
  console.log(`  Cleansing events during: ${cleansedDuring}`);

  // Check for spread_corruption action failures
  const spreadEvents = history.filter(e =>
    e.tick >= start && e.tick <= end &&
    e.description?.includes("spread corruption")
  );
  console.log(`  Spread corruption events: ${spreadEvents.length}`);
});
