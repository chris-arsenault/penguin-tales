const fs = require("fs");

const files = [
  "run-jan-2-5-16-am-206-entities.canonry-slot.json",
  "run-jan-2-5-19-am-207-entities.canonry-slot.json",
  "run-jan-2-5-21-am-220-entities.canonry-slot.json",
  "run-jan-2-5-20-am-215-entities.canonry-slot.json"
];

console.log("=== CLEANSING & RE-CORRUPTION ANALYSIS ===\n");

let totalCleanses = 0;
let totalCorruptions = 0;
let totalRecorruptions = 0;
let recorruptionGaps = [];

files.forEach((file, idx) => {
  const d = JSON.parse(fs.readFileSync(file));
  const history = d.worldData.history || [];
  const simEvents = history.filter(e => e.type === "simulation");

  // Track corruption/cleansing events by location
  const locationEvents = {};

  simEvents.forEach(e => {
    // Check for cleansing
    const cleanseMatch = e.description?.match(/purified.*at (.+)$/);
    if (cleanseMatch) {
      const loc = cleanseMatch[1];
      if (!locationEvents[loc]) locationEvents[loc] = [];
      locationEvents[loc].push({ tick: e.tick, type: "cleanse" });
      totalCleanses++;
    }

    // Check for corruption
    const corruptMatch = e.description?.match(/spread corruption to (.+)$/);
    if (corruptMatch) {
      const loc = corruptMatch[1];
      if (!locationEvents[loc]) locationEvents[loc] = [];
      locationEvents[loc].push({ tick: e.tick, type: "corrupt" });
      totalCorruptions++;
    }

    const corruptMatch2 = e.description?.match(/corrupted (.+)$/);
    if (corruptMatch2 && !e.description.includes("purified")) {
      const loc = corruptMatch2[1];
      if (!locationEvents[loc]) locationEvents[loc] = [];
      locationEvents[loc].push({ tick: e.tick, type: "corrupt" });
      totalCorruptions++;
    }
  });

  // Find re-corruptions (cleanse followed by corrupt)
  let runRecorruptions = 0;
  const recorruptionExamples = [];

  Object.entries(locationEvents).forEach(([loc, events]) => {
    events.sort((a, b) => a.tick - b.tick);

    for (let i = 0; i < events.length - 1; i++) {
      if (events[i].type === "cleanse" && events[i + 1].type === "corrupt") {
        runRecorruptions++;
        totalRecorruptions++;
        const gap = events[i + 1].tick - events[i].tick;
        recorruptionGaps.push(gap);
        recorruptionExamples.push({
          loc,
          cleanseTick: events[i].tick,
          corruptTick: events[i + 1].tick,
          gap
        });
      }
    }
  });

  console.log(`Run ${idx + 1}:`);
  console.log(`  Cleansing events: ${Object.values(locationEvents).flat().filter(e => e.type === "cleanse").length}`);
  console.log(`  Corruption events: ${Object.values(locationEvents).flat().filter(e => e.type === "corrupt").length}`);
  console.log(`  Re-corruptions (cleanse then corrupt): ${runRecorruptions}`);

  if (recorruptionExamples.length > 0) {
    console.log(`  Examples:`);
    recorruptionExamples.slice(0, 3).forEach(ex => {
      console.log(`    ${ex.loc}: cleansed@${ex.cleanseTick} -> corrupted@${ex.corruptTick} (${ex.gap} ticks later)`);
    });
  }
  console.log();
});

console.log("=== SUMMARY ===\n");
console.log(`Total cleansing events: ${totalCleanses} (${(totalCleanses / 4).toFixed(1)}/run)`);
console.log(`Total corruption events: ${totalCorruptions} (${(totalCorruptions / 4).toFixed(1)}/run)`);
console.log(`Total re-corruptions: ${totalRecorruptions} (${(totalRecorruptions / 4).toFixed(1)}/run)`);

if (recorruptionGaps.length > 0) {
  const avgGap = recorruptionGaps.reduce((a, b) => a + b, 0) / recorruptionGaps.length;
  const minGap = Math.min(...recorruptionGaps);
  const maxGap = Math.max(...recorruptionGaps);
  console.log(`\nRe-corruption timing:`);
  console.log(`  Average gap: ${avgGap.toFixed(1)} ticks`);
  console.log(`  Min gap: ${minGap} ticks`);
  console.log(`  Max gap: ${maxGap} ticks`);

  // Distribution
  const within5 = recorruptionGaps.filter(g => g <= 5).length;
  const within10 = recorruptionGaps.filter(g => g <= 10).length;
  const within20 = recorruptionGaps.filter(g => g <= 20).length;
  console.log(`\nGap distribution:`);
  console.log(`  Within 5 ticks: ${within5} (${(within5/recorruptionGaps.length*100).toFixed(0)}%)`);
  console.log(`  Within 10 ticks: ${within10} (${(within10/recorruptionGaps.length*100).toFixed(0)}%)`);
  console.log(`  Within 20 ticks: ${within20} (${(within20/recorruptionGaps.length*100).toFixed(0)}%)`);
}

console.log("\n=== INTERPRETATION ===\n");
const cleanseRate = totalCleanses / 4;
const recorruptRate = totalRecorruptions / 4;
if (cleanseRate > 0) {
  const recorruptPct = (recorruptRate / cleanseRate * 100).toFixed(0);
  console.log(`${recorruptPct}% of cleansed locations get re-corrupted`);
}
