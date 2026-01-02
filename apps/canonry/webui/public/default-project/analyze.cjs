const fs = require("fs");

const files = [
  "run-jan-2-3-23-am-211-entities.canonry-slot.json",
  "run-jan-2-3-23-am-212-entities.canonry-slot.json",
  "run-jan-2-3-22-am-209-entities.canonry-slot.json",
  "run-jan-2-3-22-am-198-entities.canonry-slot.json"
];

function analyzeRun(filename) {
  const data = JSON.parse(fs.readFileSync(filename));
  const worldData = data.worldData;
  const history = worldData.history || [];
  const hardState = worldData.hardState || {};
  const relationships = worldData.relationships || [];
  const epochStats = data.simulationState?.epochStats || [];

  const entities = Object.values(hardState);
  const factions = entities.filter(e => e.kind === "faction");
  const factionIds = new Set(factions.map(f => f.id));

  // Extract relationship events from history
  const simEvents = history.filter(e => e.type === "simulation");
  const relCreations = [];
  const relRemovals = [];

  simEvents.forEach(e => {
    if (e.relationshipsCreated) {
      e.relationshipsCreated.forEach(r => relCreations.push({ tick: e.tick, ...r }));
    }
    if (e.relationshipsRemoved) {
      e.relationshipsRemoved.forEach(r => relRemovals.push({ tick: e.tick, ...r }));
    }
  });

  // Filter to faction-to-faction
  const factionAlliances = relCreations.filter(r =>
    r.kind === "allied_with" && factionIds.has(r.src) && factionIds.has(r.dst)
  );
  const factionWars = relCreations.filter(r =>
    r.kind === "at_war_with" && factionIds.has(r.src) && factionIds.has(r.dst)
  );
  const allWarsCreated = relCreations.filter(r => r.kind === "at_war_with");

  // Count HISTORICAL relationships (archived = broken/ended)
  const historicalAlliances = relationships.filter(r =>
    r.kind === "allied_with" && r.status === "historical" &&
    factionIds.has(r.src) && factionIds.has(r.dst)
  );
  const historicalWars = relationships.filter(r =>
    r.kind === "at_war_with" && r.status === "historical" &&
    factionIds.has(r.src) && factionIds.has(r.dst)
  );

  // For backwards compat, keep these (will be 0 since archiving != removing)
  const alliancesBroken = historicalAlliances;
  const warsEnded = historicalWars;

  // Track war participation per faction
  const warsByFaction = {};
  factionWars.forEach(w => {
    if (!warsByFaction[w.src]) warsByFaction[w.src] = new Set();
    if (!warsByFaction[w.dst]) warsByFaction[w.dst] = new Set();
    warsByFaction[w.src].add(w.dst);
    warsByFaction[w.dst].add(w.src);
  });
  const multiWarFactions = Object.entries(warsByFaction)
    .filter(([f, enemies]) => enemies.size >= 2)
    .map(([f, enemies]) => ({ faction: f, enemies: [...enemies] }));

  // Harmony over epochs
  const harmonyValues = epochStats.map(e => e.pressures?.harmony || 0);
  let oscillations = 0;
  let lastDir = null;
  for (let i = 1; i < harmonyValues.length; i++) {
    const delta = harmonyValues[i] - harmonyValues[i-1];
    if (Math.abs(delta) < 0.5) continue;
    const dir = delta > 0 ? "up" : "down";
    if (lastDir && dir !== lastDir) oscillations++;
    lastDir = dir;
  }

  // Alliance component analysis (final state)
  const alliedWith = {};
  relationships.forEach(r => {
    if (r.kind === "allied_with" && factionIds.has(r.src) && factionIds.has(r.dst)) {
      if (!alliedWith[r.src]) alliedWith[r.src] = [];
      if (!alliedWith[r.dst]) alliedWith[r.dst] = [];
      alliedWith[r.src].push(r.dst);
      alliedWith[r.dst].push(r.src);
    }
  });

  // Find connected components
  const visited = new Set();
  const components = [];
  for (const f of factionIds) {
    if (visited.has(f)) continue;
    const component = [];
    const stack = [f];
    while (stack.length > 0) {
      const curr = stack.pop();
      if (visited.has(curr)) continue;
      visited.add(curr);
      if (factionIds.has(curr)) {
        component.push(curr);
        (alliedWith[curr] || []).forEach(n => {
          if (!visited.has(n)) stack.push(n);
        });
      }
    }
    if (component.length > 0) components.push(component);
  }

  return {
    filename: filename.replace(".canonry-slot.json", ""),
    factions: factions.length,
    alliancesFormed: factionAlliances.length / 2,
    alliancesBroken: alliancesBroken.length, // Not /2 since historical rels are stored once
    warsStarted: factionWars.length / 2,
    warsEnded: warsEnded.length, // Not /2 since historical rels are stored once
    multiWarFactions,
    harmonyRange: [Math.min(...harmonyValues).toFixed(1), Math.max(...harmonyValues).toFixed(1)],
    harmonyOscillations: oscillations,
    allianceComponents: components.filter(c => c.length > 1).map(c => c.length).sort((a,b) => b-a),
    isolatedFactions: components.filter(c => c.length === 1).length
  };
}

console.log("=== FULL DYNAMICS ANALYSIS ===\n");

const results = files.map(f => analyzeRun(f));

results.forEach(r => {
  console.log(`--- ${r.filename} ---`);
  console.log(`Factions: ${r.factions}`);
  console.log(`ALLIANCES: ${r.alliancesFormed} formed, ${r.alliancesBroken} broken`);
  console.log(`WARS: ${r.warsStarted} faction wars, ${r.warsEnded} ended`);
  if (r.multiWarFactions.length > 0) {
    console.log(`  Multi-war factions (${r.multiWarFactions.length}):`);
    r.multiWarFactions.forEach(f => console.log(`    ${f.faction}: ${f.enemies.length} enemies`));
  }
  console.log(`HARMONY: range [${r.harmonyRange.join(" to ")}], ${r.harmonyOscillations} oscillations`);
  console.log(`ALLIANCE BLOCS: [${r.allianceComponents.join(", ")}] + ${r.isolatedFactions} isolated`);
  console.log();
});

// Summary
console.log("=== SUMMARY ===");
const totals = {
  alliances: results.reduce((s, r) => s + r.alliancesFormed, 0),
  broken: results.reduce((s, r) => s + r.alliancesBroken, 0),
  wars: results.reduce((s, r) => s + r.warsStarted, 0),
  warsEnded: results.reduce((s, r) => s + r.warsEnded, 0),
  multiWar: results.reduce((s, r) => s + r.multiWarFactions.length, 0),
  oscillations: results.reduce((s, r) => s + r.harmonyOscillations, 0)
};
console.log(`Alliances: ${totals.alliances} formed, ${totals.broken} broken`);
console.log(`Wars: ${totals.wars} started, ${totals.warsEnded} ended`);
console.log(`Multi-war factions: ${totals.multiWar}`);
console.log(`Total harmony oscillations: ${totals.oscillations}`);
const maxComponent = Math.max(...results.flatMap(r => r.allianceComponents.length > 0 ? r.allianceComponents : [0]));
console.log(`Max alliance component: ${maxComponent}`);

// Check preconditions
console.log("\n=== PRECONDITIONS CHECK ===\n");

files.forEach(filename => {
  const data = JSON.parse(fs.readFileSync(filename));
  const worldData = data.worldData;
  const hardStateRaw = worldData.hardState || {};
  const relationships = worldData.relationships || [];
  const entities = Object.values(hardStateRaw);

  // Build a proper ID -> entity map
  const hardState = {};
  entities.forEach(e => { hardState[e.id] = e; });

  const factions = entities.filter(e => e.kind === "faction");
  const factionIds = new Set(factions.map(f => f.id));
  const occurrences = entities.filter(e => e.kind === "occurrence");
  const wars = occurrences.filter(o => o.subtype === "war");

  // Oath breakers
  const oathBreakers = factions.filter(f => f.tags?.oath_breaker);

  // War occurrences by status
  const warsByStatus = {};
  wars.forEach(w => { warsByStatus[w.status] = (warsByStatus[w.status] || 0) + 1; });

  // Factions at war
  const atWarFactions = new Set();
  relationships.forEach(r => {
    if (r.kind === "at_war_with") {
      atWarFactions.add(r.src);
      atWarFactions.add(r.dst);
    }
  });

  // Factions in active war occurrence
  const inActiveWar = new Set();
  relationships.forEach(r => {
    if (r.kind === "participant_in") {
      const target = hardState[r.dst];
      if (target?.kind === "occurrence" && target?.subtype === "war" && target?.status === "active") {
        inActiveWar.add(r.src);
      }
    }
  });

  const eligibleForCleanup = [...atWarFactions].filter(f => factionIds.has(f) && !inActiveWar.has(f));

  // Check ALL relationship removals
  const history = worldData.history || [];
  const simEvents = history.filter(e => e.type === "simulation");
  const allRemovals = [];
  simEvents.forEach(e => {
    if (e.relationshipsRemoved) {
      e.relationshipsRemoved.forEach(r => allRemovals.push(r));
    }
  });
  const removalsByKind = {};
  allRemovals.forEach(r => { removalsByKind[r.kind] = (removalsByKind[r.kind] || 0) + 1; });

  console.log(`${filename.replace(".canonry-slot.json", "")}:`);
  console.log(`  Oath breakers: ${oathBreakers.length}`);
  console.log(`  War occurrences: ${JSON.stringify(warsByStatus)}`);
  console.log(`  Factions at war: ${atWarFactions.size}, in active war: ${inActiveWar.size}`);
  console.log(`  Eligible for war_tie_cleanup: ${eligibleForCleanup.length}`);
  console.log(`  Total relationship removals: ${allRemovals.length}`, Object.keys(removalsByKind).length > 0 ? removalsByKind : "");

  // Check for HISTORICAL relationships (archived, not removed)
  const historicalRels = relationships.filter(r => r.status === "historical");
  const historicalByKind = {};
  historicalRels.forEach(r => { historicalByKind[r.kind] = (historicalByKind[r.kind] || 0) + 1; });
  if (historicalRels.length > 0) {
    console.log(`  Historical relationships: ${historicalRels.length}`, historicalByKind);
  }

  // Check ALL at_war_with relationships
  const allWars = relationships.filter(r => r.kind === "at_war_with");
  const activeWars = allWars.filter(r => r.status === "active");
  const histWars = allWars.filter(r => r.status === "historical");
  console.log(`  at_war_with: ${allWars.length} total (${activeWars.length} active, ${histWars.length} historical)`);

  // Check what kinds of entities are at war
  if (allWars.length > 0) {
    const warParticipantKinds = {};
    allWars.forEach(w => {
      const srcKind = hardState[w.src]?.kind || "unknown";
      const dstKind = hardState[w.dst]?.kind || "unknown";
      const key = `${srcKind}-${dstKind}`;
      warParticipantKinds[key] = (warParticipantKinds[key] || 0) + 1;
    });
    console.log(`    War participants:`, warParticipantKinds);
    // Show IDs if unknown
    allWars.slice(0, 2).forEach(w => {
      if (!hardState[w.src] || !hardState[w.dst]) {
        console.log(`    Unknown war: ${w.src} -> ${w.dst}`);
      }
    });
  }
});
