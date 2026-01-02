const fs = require("fs");

const file = "run-jan-2-4-46-am-207-entities.canonry-slot.json";
const d = JSON.parse(fs.readFileSync(file));
const updates = d.simulationState?.pressureUpdates || [];

console.log("=== FEEDBACK ANALYSIS ===\n");

// Look at first 10 ticks in detail
console.log("=== TICK-BY-TICK BREAKDOWN (first 15 ticks) ===\n");

updates.slice(0, 15).forEach(u => {
  const res = u.pressures?.find(p => p.id === "resource_availibility");
  if (!res) return;

  const breakdown = res.breakdown || {};
  const discreteMods = (u.discreteModifications || [])
    .filter(m => m.pressureId === "resource_availibility");
  const discreteTotal = discreteMods.reduce((s, m) => s + m.delta, 0);

  console.log(`Tick ${u.tick}:`);
  console.log(`  Previous: ${res.previousValue?.toFixed(2)}`);
  console.log(`  New: ${res.newValue?.toFixed(2)}`);
  console.log(`  Total delta: ${res.delta?.toFixed(2)}`);
  console.log(`  Discrete mods: ${discreteTotal} (${discreteMods.map(m => m.delta).join(', ') || 'none'})`);

  if (breakdown.feedbackTotal !== undefined) {
    console.log(`  Feedback total: ${breakdown.feedbackTotal?.toFixed(2)}`);
    console.log(`  Homeostatic delta: ${breakdown.homeostaticDelta?.toFixed(2)}`);
    console.log(`  Scaled feedback: ${breakdown.scaledFeedback?.toFixed(2)}`);
    console.log(`  Raw delta (feedback only): ${breakdown.rawDelta?.toFixed(2)}`);
  }

  // Calculate feedback vs discrete contribution
  const feedbackContribution = res.delta - discreteTotal;
  console.log(`  Feedback contribution to delta: ${feedbackContribution.toFixed(2)}`);
  console.log();
});

// Calculate average feedback per tick
console.log("=== AVERAGE FEEDBACK ANALYSIS ===\n");

let totalFeedback = 0;
let totalDiscrete = 0;
let count = 0;

updates.slice(0, 50).forEach(u => {
  const res = u.pressures?.find(p => p.id === "resource_availibility");
  if (!res) return;

  const discreteMods = (u.discreteModifications || [])
    .filter(m => m.pressureId === "resource_availibility");
  const discreteTotal = discreteMods.reduce((s, m) => s + m.delta, 0);
  const feedbackContribution = res.delta - discreteTotal;

  totalFeedback += feedbackContribution;
  totalDiscrete += discreteTotal;
  count++;
});

console.log(`Over first 50 ticks:`);
console.log(`  Total feedback contribution: ${totalFeedback.toFixed(2)}`);
console.log(`  Total discrete contribution: ${totalDiscrete.toFixed(2)}`);
console.log(`  Avg feedback per tick: ${(totalFeedback / count).toFixed(2)}`);
console.log(`  Avg discrete per tick: ${(totalDiscrete / count).toFixed(2)}`);

// Look at the feedback coefficients from pressures.json
console.log("\n=== FEEDBACK COEFFICIENTS (from pressures.json) ===\n");
const pressures = require("./pressures.json");
const resPressure = pressures.find(p => p.id === "resource_availibility");
console.log("Positive feedback:");
resPressure.growth.positiveFeedback.forEach(f => {
  console.log(`  ${f.type}: coefficient ${f.coefficient} (${f.kind}:${f.subtype || '*'})`);
});
console.log("\nNegative feedback:");
resPressure.growth.negativeFeedback.forEach(f => {
  console.log(`  ${f.type}: coefficient ${f.coefficient}`);
});
console.log(`\nHomeostasis: ${resPressure.homeostasis}`);
console.log(`Initial value: ${resPressure.initialValue}`);

// Calculate what feedback SHOULD be based on entity counts
console.log("\n=== EXPECTED FEEDBACK CALCULATION ===\n");
const hardState = d.worldData.hardState || {};
const entities = Object.values(hardState);

// At tick 0, count entities
const colonies = entities.filter(e => e.kind === "location" && e.subtype === "colony" && e.createdAt <= 0);
const resourceNodes = entities.filter(e => e.kind === "location" && e.subtype === "resource_node" && e.createdAt <= 0);
const totalEntities = entities.filter(e => e.createdAt <= 0).length;
const locations = entities.filter(e => e.kind === "location" && e.createdAt <= 0).length;

console.log(`Initial entity counts (tick 0):`);
console.log(`  Colonies: ${colonies.length}`);
console.log(`  Resource nodes: ${resourceNodes.length}`);
console.log(`  Total locations: ${locations.length}`);
console.log(`  Total entities: ${totalEntities}`);

const positiveFeedback = resourceNodes.length * 1.5;
const negativeFeedback1 = colonies.length * 0.4;
const ratio = locations / totalEntities;
const negativeFeedback2 = ratio * 0.15;
const netFeedback = positiveFeedback - negativeFeedback1 - negativeFeedback2;

console.log(`\nExpected feedback at tick 0:`);
console.log(`  Positive (resource_nodes * 1.5): ${positiveFeedback.toFixed(2)}`);
console.log(`  Negative (colonies * 0.4): ${negativeFeedback1.toFixed(2)}`);
console.log(`  Negative (location ratio * 0.15): ${negativeFeedback2.toFixed(3)}`);
console.log(`  Net feedback: ${netFeedback.toFixed(2)}`);

// With homeostasis
const homeostasisPull = (0 - 15) * 0.35; // pull toward 0
console.log(`\nHomeostasis pull (toward 0): ${homeostasisPull.toFixed(2)}`);
console.log(`Expected total pressure change: ${(netFeedback + homeostasisPull).toFixed(2)}`);

// What SHOULD the coefficients be?
console.log("\n=== RECOMMENDED COEFFICIENT ADJUSTMENTS ===\n");

// Target: templates should dominate, feedback should be ~10-20% of template effects
// Our templates: sinks ~-20 per era, sources ~+20 per era (roughly balanced)
// Feedback should be ~2-4 total, not ~5-10

console.log("Current feedback is too strong relative to templates.");
console.log("Templates fire ~20 times per era with ~+/-5 magnitude = ~100 total pressure change");
console.log("Feedback at ~5 per tick * 25 ticks = ~125 total pressure change (dominates!)");
console.log("");
console.log("Recommendation: Reduce feedback coefficients by ~50-70%");
console.log("  colony coefficient: 0.4 -> 0.15");
console.log("  ratio coefficient: 0.15 -> 0.05");
console.log("  OR reduce homeostasis: 0.35 -> 0.15");
