const fs = require("fs");

const files = [
  "run-jan-2-5-16-am-206-entities.canonry-slot.json",
  "run-jan-2-5-19-am-207-entities.canonry-slot.json",
  "run-jan-2-5-21-am-220-entities.canonry-slot.json",
  "run-jan-2-5-20-am-215-entities.canonry-slot.json"
];

console.log("=== CORRUPTION VS CLEANSING ACTOR POOL ANALYSIS ===\n");

let totals = {
  magicAbilities: 0,
  mysticalLocs: 0,
  anomalyLocs: 0,
  dangerousLocs: 0,
  heroes: 0,
  heroesWithPractice: 0,
  tomes: 0,
  mysticalTomes: 0,
  corruptedLocs: 0
};

files.forEach((file, idx) => {
  const d = JSON.parse(fs.readFileSync(file));
  const entities = Object.values(d.worldData.hardState || {});
  const rels = d.worldData.relationships || [];

  // Count corruption actors
  const magicAbilities = entities.filter(e => e.kind === "ability" && e.subtype === "magic").length;
  const mysticalLocs = entities.filter(e => e.kind === "location" && e.tags?.mystical).length;
  const anomalyLocs = entities.filter(e => e.kind === "location" && e.tags?.anomaly).length;
  const dangerousLocs = entities.filter(e => e.kind === "location" && e.tags?.dangerous).length;

  // Count cleansing actors
  const heroes = entities.filter(e => e.kind === "npc" && e.subtype === "hero").length;
  const tomes = entities.filter(e => e.kind === "artifact" && e.subtype === "tome").length;
  const mysticalTomes = entities.filter(e => e.kind === "artifact" && e.subtype === "tome" && e.tags?.mystical).length;

  // Count heroes with practitioner_of
  const practitionerRels = rels.filter(r => r.kind === "practitioner_of" && r.status !== "historical");
  const heroIds = new Set(entities.filter(e => e.kind === "npc" && e.subtype === "hero").map(e => e.id));
  const heroesWithPractice = new Set(practitionerRels.filter(r => heroIds.has(r.src)).map(r => r.src)).size;

  // Count corrupted locations
  const corruptedLocs = entities.filter(e => e.kind === "location" && e.tags?.corrupted).length;

  totals.magicAbilities += magicAbilities;
  totals.mysticalLocs += mysticalLocs;
  totals.anomalyLocs += anomalyLocs;
  totals.dangerousLocs += dangerousLocs;
  totals.heroes += heroes;
  totals.heroesWithPractice += heroesWithPractice;
  totals.tomes += tomes;
  totals.mysticalTomes += mysticalTomes;
  totals.corruptedLocs += corruptedLocs;

  console.log(`Run ${idx + 1}:`);
  console.log("  CORRUPTION ACTORS:");
  console.log(`    Magic abilities: ${magicAbilities}`);
  console.log(`    Mystical locations: ${mysticalLocs}`);
  console.log(`    Anomaly locations: ${anomalyLocs}`);
  console.log(`    Dangerous locations: ${dangerousLocs}`);
  console.log("  CLEANSING ACTORS:");
  console.log(`    Heroes total: ${heroes}`);
  console.log(`    Heroes w/ practitioner_of: ${heroesWithPractice}`);
  console.log(`    Tomes total: ${tomes}`);
  console.log(`    Tomes w/ mystical tag: ${mysticalTomes}`);
  console.log("  STATE:");
  console.log(`    Corrupted locations: ${corruptedLocs}`);
  console.log();
});

console.log("=== AVERAGES ===\n");
const n = files.length;
console.log("CORRUPTION ACTORS (can cause corruption):");
console.log(`  Magic abilities:     ${(totals.magicAbilities / n).toFixed(1)}/run`);
console.log(`  Mystical locations:  ${(totals.mysticalLocs / n).toFixed(1)}/run (can spread_corruption)`);
console.log(`  Anomaly locations:   ${(totals.anomalyLocs / n).toFixed(1)}/run (can spread_corruption)`);
console.log(`  Dangerous locations: ${(totals.dangerousLocs / n).toFixed(1)}/run (can spread_corruption)`);

console.log("\nCLEANSING ACTORS (can cleanse corruption):");
console.log(`  Heroes w/ practitioner_of: ${(totals.heroesWithPractice / n).toFixed(1)}/run (cleanse_corruption)`);
console.log(`  Mystical tomes:            ${(totals.mysticalTomes / n).toFixed(1)}/run (tome_cleanses_corruption)`);

console.log("\n=== THE PROBLEM ===\n");
const corruptionActors = (totals.magicAbilities + totals.mysticalLocs) / n;
const cleansingActors = (totals.heroesWithPractice + totals.mysticalTomes) / n;
console.log(`Corruption actors: ~${corruptionActors.toFixed(0)}`);
console.log(`Cleansing actors:  ~${cleansingActors.toFixed(0)}`);
console.log(`Ratio: ${(corruptionActors / cleansingActors).toFixed(1)}:1`);
console.log();
console.log("ISSUES:");
console.log("1. tome_cleanses_corruption requires 'mystical' tag on tome - almost none have it!");
console.log("2. cleanse_corruption requires heroes with practitioner_of - limited pool");
console.log("3. Corruption spreads from corrupted locations (cascade), cleansing doesn't");
console.log("4. baseWeight for cleansing (0.4) is lower than corruption (0.5-0.6)");
