// Analyze at_war_with relationships vs war participation
const fs = require('fs');

const runFile = process.argv[2] || 'run-jan-2-2-21-pm-209-entities.canonry-slot.json';
const data = JSON.parse(fs.readFileSync(runFile, 'utf8'));
const entities = data.worldData.hardState;
const relationships = data.worldData.relationships;

// Get all wars and factions
const wars = entities.filter(e => e.kind === 'occurrence' && e.subtype === 'war');
const factions = entities.filter(e => e.kind === 'faction');
const factionIds = new Set(factions.map(f => f.id));

console.log(`\n=== AT_WAR_WITH ANALYSIS ===`);
console.log(`Factions: ${factions.length}`);
console.log(`Wars: ${wars.length} (${wars.filter(w => w.status === 'active').length} active)`);

// Get all at_war_with relationships
const atWarWith = relationships.filter(r => r.kind === 'at_war_with');
const activeAtWarWith = atWarWith.filter(r => r.status === 'active');
const historicalAtWarWith = atWarWith.filter(r => r.status === 'historical');

console.log(`\nat_war_with relationships: ${atWarWith.length}`);
console.log(`  Active: ${activeAtWarWith.length}`);
console.log(`  Historical: ${historicalAtWarWith.length}`);

// Get all participant_in relationships
const participantIn = relationships.filter(r => r.kind === 'participant_in');
const activeParticipantIn = participantIn.filter(r => r.status === 'active');
const historicalParticipantIn = participantIn.filter(r => r.status === 'historical');

console.log(`\nparticipant_in relationships: ${participantIn.length}`);
console.log(`  Active: ${activeParticipantIn.length}`);
console.log(`  Historical: ${historicalParticipantIn.length}`);

// Build at_war_with graph
const atWarWithGraph = new Map();
for (const f of factions) {
  atWarWithGraph.set(f.id, { active: new Set(), historical: new Set() });
}

for (const rel of atWarWith) {
  if (factionIds.has(rel.src) && factionIds.has(rel.dst)) {
    const status = rel.status === 'active' ? 'active' : 'historical';
    atWarWithGraph.get(rel.src)?.[status].add(rel.dst);
  }
}

// Find connected components in active at_war_with
console.log(`\n=== ACTIVE AT_WAR_WITH COMPONENTS ===`);
const visited = new Set();
const components = [];

function dfs(factionId, component, useActive) {
  if (visited.has(factionId)) return;
  visited.add(factionId);
  component.push(factionId);

  const neighbors = atWarWithGraph.get(factionId);
  if (neighbors) {
    const edges = useActive ? neighbors.active : new Set([...neighbors.active, ...neighbors.historical]);
    for (const neighbor of edges) {
      dfs(neighbor, component, useActive);
    }
  }
}

for (const faction of factions) {
  if (!visited.has(faction.id)) {
    const component = [];
    dfs(faction.id, component, true); // Active only
    if (component.length > 1) {
      components.push(component);
    }
  }
}

components.sort((a, b) => b.length - a.length);
console.log(`Found ${components.length} components with 2+ factions`);
for (const comp of components.slice(0, 5)) {
  console.log(`\nComponent of ${comp.length} factions:`);
  for (const fId of comp.slice(0, 5)) {
    const faction = entities.find(e => e.id === fId);
    console.log(`  - ${faction?.name || fId}`);
  }
  if (comp.length > 5) console.log(`  ... and ${comp.length - 5} more`);
}

// Now check all (active + historical) at_war_with
console.log(`\n=== ALL AT_WAR_WITH COMPONENTS (including historical) ===`);
visited.clear();
const allComponents = [];

for (const faction of factions) {
  if (!visited.has(faction.id)) {
    const component = [];
    dfs(faction.id, component, false); // Include historical
    if (component.length > 1) {
      allComponents.push(component);
    }
  }
}

allComponents.sort((a, b) => b.length - a.length);
console.log(`Found ${allComponents.length} components with 2+ factions`);
for (const comp of allComponents.slice(0, 3)) {
  console.log(`\nComponent of ${comp.length} factions:`);
  for (const fId of comp.slice(0, 8)) {
    const faction = entities.find(e => e.id === fId);
    console.log(`  - ${faction?.name || fId}`);
  }
  if (comp.length > 8) console.log(`  ... and ${comp.length - 8} more`);
}

// Key insight: compare active at_war_with to current war participation
console.log(`\n=== KEY INSIGHT: AT_WAR_WITH vs WAR PARTICIPATION ===`);

// For each active war, which factions are at war with each other?
for (const war of wars.filter(w => w.status === 'active')) {
  const participants = participantIn
    .filter(r => r.dst === war.id && r.status === 'active')
    .map(r => r.src);

  console.log(`\n${war.name} (${participants.length} participants):`);

  // Check at_war_with between participants
  let atWarWithCount = 0;
  let missingAtWarWith = [];
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const p1 = participants[i];
      const p2 = participants[j];
      const hasAtWarWith = activeAtWarWith.some(r =>
        (r.src === p1 && r.dst === p2) || (r.src === p2 && r.dst === p1)
      );
      if (hasAtWarWith) {
        atWarWithCount++;
      } else {
        const f1 = entities.find(e => e.id === p1);
        const f2 = entities.find(e => e.id === p2);
        missingAtWarWith.push(`${f1?.name} <-> ${f2?.name}`);
      }
    }
  }
  console.log(`  at_war_with edges between participants: ${atWarWithCount}`);
  if (missingAtWarWith.length > 0) {
    console.log(`  Missing at_war_with: ${missingAtWarWith.join(', ')}`);
  }
}

// Check: do historical at_war_with correspond to historical wars?
console.log(`\n=== ORPHANED AT_WAR_WITH (no corresponding war) ===`);

// Build map: which wars link which factions via participant_in
const warLinksFactions = new Map(); // "factionA|factionB" -> warIds
for (const war of wars) {
  const participants = participantIn
    .filter(r => r.dst === war.id)
    .map(r => r.src);

  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const key = [participants[i], participants[j]].sort().join('|');
      if (!warLinksFactions.has(key)) {
        warLinksFactions.set(key, []);
      }
      warLinksFactions.get(key).push(war.id);
    }
  }
}

// Check historical at_war_with for corresponding historical wars
let orphanedCount = 0;
for (const rel of historicalAtWarWith.slice(0, 20)) {
  const key = [rel.src, rel.dst].sort().join('|');
  const linkedWars = warLinksFactions.get(key) || [];
  if (linkedWars.length === 0) {
    orphanedCount++;
    const f1 = entities.find(e => e.id === rel.src);
    const f2 = entities.find(e => e.id === rel.dst);
    if (orphanedCount <= 5) {
      console.log(`  ${f1?.name} <-> ${f2?.name}: no war with both as participants`);
    }
  }
}
console.log(`\nTotal orphaned historical at_war_with: ${orphanedCount}/${historicalAtWarWith.length}`);
