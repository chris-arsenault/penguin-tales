const fs = require("fs");

const files = [
  "run-jan-2-4-59-am-199-entities.canonry-slot.json",
  "run-jan-2-5-00-am-211-entities.canonry-slot.json",
  "run-jan-2-5-00-am-218-entities.canonry-slot.json",
  "run-jan-2-5-00-am-204-entities.canonry-slot.json"
];

console.log("=== FULL DYNAMICS ANALYSIS (INCLUDING FEEDBACK) ===\n");

let allTickData = [];

files.forEach((file, fileIdx) => {
  const d = JSON.parse(fs.readFileSync(file));
  const updates = d.simulationState?.pressureUpdates || [];

  updates.forEach(u => {
    const res = u.pressures?.find(p => p.id === "resource_availibility");
    if (!res) return;

    const discreteMods = (u.discreteModifications || [])
      .filter(m => m.pressureId === "resource_availibility");
    const discreteTotal = discreteMods.reduce((s, m) => s + m.delta, 0);
    const feedbackContribution = res.delta - discreteTotal;

    allTickData.push({
      file: fileIdx,
      tick: u.tick,
      prevValue: res.previousValue,
      newValue: res.newValue,
      totalDelta: res.delta,
      discreteTotal,
      feedbackContribution,
      feedbackTotal: res.breakdown?.feedbackTotal,
      homeostaticDelta: res.breakdown?.homeostaticDelta,
      scaledFeedback: res.breakdown?.scaledFeedback
    });
  });
});

// Aggregate statistics
const avgByTick = {};
allTickData.forEach(t => {
  if (!avgByTick[t.tick]) avgByTick[t.tick] = { discrete: [], feedback: [], total: [], value: [] };
  avgByTick[t.tick].discrete.push(t.discreteTotal);
  avgByTick[t.tick].feedback.push(t.feedbackContribution);
  avgByTick[t.tick].total.push(t.totalDelta);
  avgByTick[t.tick].value.push(t.newValue);
});

console.log("=== TICK-BY-TICK AVERAGES (first 30 ticks) ===\n");
console.log("Tick | Avg Value | Discrete | Feedback | Total Delta");
console.log("-----|-----------|----------|----------|------------");

for (let tick = 0; tick < 30; tick++) {
  const data = avgByTick[tick];
  if (!data) continue;

  const avgDiscrete = data.discrete.reduce((a, b) => a + b, 0) / data.discrete.length;
  const avgFeedback = data.feedback.reduce((a, b) => a + b, 0) / data.feedback.length;
  const avgTotal = data.total.reduce((a, b) => a + b, 0) / data.total.length;
  const avgValue = data.value.reduce((a, b) => a + b, 0) / data.value.length;

  console.log(`  ${String(tick).padStart(2)} |    ${avgValue.toFixed(1).padStart(5)} |   ${avgDiscrete >= 0 ? '+' : ''}${avgDiscrete.toFixed(1).padStart(5)} |   ${avgFeedback >= 0 ? '+' : ''}${avgFeedback.toFixed(1).padStart(5)} |      ${avgTotal >= 0 ? '+' : ''}${avgTotal.toFixed(1).padStart(5)}`);
}

// Overall breakdown
console.log("\n=== OVERALL PRESSURE CHANGE BREAKDOWN ===\n");

let totalDiscrete = 0;
let totalFeedback = 0;
let totalDelta = 0;
let tickCount = 0;

allTickData.forEach(t => {
  totalDiscrete += t.discreteTotal;
  totalFeedback += t.feedbackContribution;
  totalDelta += t.totalDelta;
  tickCount++;
});

console.log(`Across ${files.length} runs, ${tickCount} total ticks:`);
console.log(`  Total discrete (templates/actions): ${totalDiscrete >= 0 ? '+' : ''}${totalDiscrete.toFixed(0)}`);
console.log(`  Total feedback (homeostasis+entity): ${totalFeedback >= 0 ? '+' : ''}${totalFeedback.toFixed(0)}`);
console.log(`  Total delta: ${totalDelta >= 0 ? '+' : ''}${totalDelta.toFixed(0)}`);
console.log();
console.log(`Per run averages:`);
console.log(`  Discrete: ${(totalDiscrete / 4) >= 0 ? '+' : ''}${(totalDiscrete / 4).toFixed(0)}`);
console.log(`  Feedback: ${(totalFeedback / 4) >= 0 ? '+' : ''}${(totalFeedback / 4).toFixed(0)}`);
console.log(`  Net delta: ${(totalDelta / 4) >= 0 ? '+' : ''}${(totalDelta / 4).toFixed(0)}`);

// Analyze feedback components from first run in detail
console.log("\n=== FEEDBACK COMPONENT BREAKDOWN (sample ticks from run 1) ===\n");

const d = JSON.parse(fs.readFileSync(files[0]));
const updates = d.simulationState?.pressureUpdates || [];

console.log("Tick | Resource | FeedbackTotal | Homeostasis | Scaled FB | Discrete | Net");
console.log("-----|----------|---------------|-------------|-----------|----------|-----");

[0, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100].forEach(tick => {
  const u = updates.find(u => u.tick === tick);
  if (!u) return;

  const res = u.pressures?.find(p => p.id === "resource_availibility");
  if (!res) return;

  const b = res.breakdown || {};
  const discreteMods = (u.discreteModifications || [])
    .filter(m => m.pressureId === "resource_availibility");
  const discreteTotal = discreteMods.reduce((s, m) => s + m.delta, 0);

  console.log(`  ${String(tick).padStart(3)} |   ${res.newValue?.toFixed(1).padStart(5)} |        ${(b.feedbackTotal || 0) >= 0 ? '+' : ''}${(b.feedbackTotal || 0).toFixed(2).padStart(5)} |      ${(b.homeostaticDelta || 0) >= 0 ? '+' : ''}${(b.homeostaticDelta || 0).toFixed(2).padStart(5)} |    ${(b.scaledFeedback || 0) >= 0 ? '+' : ''}${(b.scaledFeedback || 0).toFixed(2).padStart(5)} |   ${discreteTotal >= 0 ? '+' : ''}${String(discreteTotal).padStart(4)} | ${res.delta >= 0 ? '+' : ''}${res.delta.toFixed(2)}`);
});

// Analyze what happens at different resource levels
console.log("\n=== FEEDBACK BEHAVIOR AT DIFFERENT RESOURCE LEVELS ===\n");

const byLevel = { negative: [], low: [], medium: [], high: [] };

allTickData.forEach(t => {
  if (t.prevValue < 0) byLevel.negative.push(t);
  else if (t.prevValue < 15) byLevel.low.push(t);
  else if (t.prevValue < 30) byLevel.medium.push(t);
  else byLevel.high.push(t);
});

Object.entries(byLevel).forEach(([level, ticks]) => {
  if (ticks.length === 0) return;
  const avgFeedback = ticks.reduce((s, t) => s + t.feedbackContribution, 0) / ticks.length;
  const avgDiscrete = ticks.reduce((s, t) => s + t.discreteTotal, 0) / ticks.length;
  const avgValue = ticks.reduce((s, t) => s + t.prevValue, 0) / ticks.length;

  console.log(`${level.toUpperCase()} (avg value ${avgValue.toFixed(1)}, ${ticks.length} ticks):`);
  console.log(`  Avg feedback/tick: ${avgFeedback >= 0 ? '+' : ''}${avgFeedback.toFixed(2)}`);
  console.log(`  Avg discrete/tick: ${avgDiscrete >= 0 ? '+' : ''}${avgDiscrete.toFixed(2)}`);
  console.log();
});

// Final recommendation
console.log("=== BALANCE ANALYSIS ===\n");
const discretePerRun = totalDiscrete / 4;
const feedbackPerRun = totalFeedback / 4;
const netPerRun = totalDelta / 4;

console.log(`Current per-run totals:`);
console.log(`  Discrete contribution: ${discretePerRun >= 0 ? '+' : ''}${discretePerRun.toFixed(0)}`);
console.log(`  Feedback contribution: ${feedbackPerRun >= 0 ? '+' : ''}${feedbackPerRun.toFixed(0)}`);
console.log(`  Net pressure change: ${netPerRun >= 0 ? '+' : ''}${netPerRun.toFixed(0)}`);
console.log();

if (netPerRun > 20) {
  console.log(`System is ${netPerRun.toFixed(0)} too positive.`);
  console.log(`Discrete is ${discretePerRun >= 0 ? '+' : ''}${discretePerRun.toFixed(0)}, Feedback is ${feedbackPerRun >= 0 ? '+' : ''}${feedbackPerRun.toFixed(0)}`);
  console.log();
  if (Math.abs(feedbackPerRun) > Math.abs(discretePerRun) * 0.5) {
    console.log(`WARNING: Feedback is significant (>${Math.abs(discretePerRun * 0.5).toFixed(0)}).`);
    console.log(`Tuning templates alone may not achieve balance.`);
  }
}
