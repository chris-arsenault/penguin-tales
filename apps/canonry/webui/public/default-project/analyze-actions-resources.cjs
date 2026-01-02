const actions = require("./actions.json");

console.log("=== ACTIONS WITH RESOURCE EFFECTS ===\n");

const resourceActions = [];

actions.forEach(action => {
  const mutations = action.outcome?.mutations || [];
  mutations.forEach(m => {
    if (m.type === "modify_pressure" && m.pressureId === "resource_availibility") {
      resourceActions.push({
        id: action.id,
        name: action.name,
        delta: m.delta,
        enabled: action.enabled !== false
      });
    }
  });
});

console.log("Actions that modify resource_availibility:\n");
resourceActions.sort((a, b) => b.delta - a.delta).forEach(a => {
  const status = a.enabled ? "" : " [DISABLED]";
  console.log(`  ${a.delta > 0 ? "+" : ""}${a.delta}: ${a.id} (${a.name})${status}`);
});

console.log("\n=== SUMMARY ===");
const sources = resourceActions.filter(a => a.delta > 0 && a.enabled);
const sinks = resourceActions.filter(a => a.delta < 0 && a.enabled);
console.log(`Sources (positive): ${sources.length}`);
sources.forEach(a => console.log(`  +${a.delta}: ${a.id}`));
console.log(`Sinks (negative): ${sinks.length}`);
sinks.forEach(a => console.log(`  ${a.delta}: ${a.id}`));

// Now check the run data to see which actions actually fired
console.log("\n=== CHECKING ACTUAL ACTION EXECUTION ===\n");

const fs = require("fs");
const d = JSON.parse(fs.readFileSync("run-jan-2-4-25-am-210-entities.canonry-slot.json"));
const history = d.worldData.history || [];

// Find action descriptions matching our resource actions
const actionPatterns = resourceActions.map(a => ({
  id: a.id,
  delta: a.delta,
  pattern: a.name.toLowerCase()
}));

// Look at simulation events for action patterns
const simEvents = history.filter(e => e.type === "simulation");
const actionCounts = {};

simEvents.forEach(e => {
  const desc = (e.description || "").toLowerCase();
  // Check for trade routes
  if (desc.includes("trade route") || desc.includes("established trade")) {
    actionCounts["establish_trade"] = (actionCounts["establish_trade"] || 0) + 1;
  }
  if (desc.includes("spread to")) {
    actionCounts["spread_technique"] = (actionCounts["spread_technique"] || 0) + 1;
  }
  if (desc.includes("revealed hidden riches")) {
    actionCounts["reveal_resources"] = (actionCounts["reveal_resources"] || 0) + 1;
  }
});

console.log("Action executions found in history:");
Object.entries(actionCounts).forEach(([action, count]) => {
  const actionDef = resourceActions.find(a => a.id === action);
  const delta = actionDef ? actionDef.delta : "?";
  console.log(`  ${count}x: ${action} (${delta > 0 ? "+" : ""}${delta} each = ${count * delta} total)`);
});
