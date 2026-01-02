// Analyze wars from the war's perspective to detect "Great War" clusters
const fs = require('fs');

const runFile = process.argv[2] || 'run-jan-2-2-21-pm-209-entities.canonry-slot.json';
const data = JSON.parse(fs.readFileSync(runFile, 'utf8'));
const entities = data.worldData.hardState;
const relationships = data.worldData.relationships;

// Get all wars
const wars = entities.filter(e => e.kind === 'occurrence' && e.subtype === 'war');
const factions = entities.filter(e => e.kind === 'faction');

console.log(`\n=== WAR ANALYSIS FROM WAR PERSPECTIVE ===`);
console.log(`Total wars: ${wars.length}`);
console.log(`Active wars: ${wars.filter(w => w.status === 'active').length}`);
console.log(`Historical wars: ${wars.filter(w => w.status === 'historical').length}`);

// Build participant map for each war
const warParticipants = new Map();
const factionWars = new Map(); // Which wars each faction is in

for (const war of wars) {
  warParticipants.set(war.id, []);
}

for (const rel of relationships) {
  if (rel.kind === 'participant_in' && rel.status === 'active') {
    const participants = warParticipants.get(rel.dst);
    if (participants) {
      participants.push(rel.src);

      // Track which wars each faction is in
      if (!factionWars.has(rel.src)) {
        factionWars.set(rel.src, []);
      }
      factionWars.get(rel.src).push(rel.dst);
    }
  }
}

console.log(`\n=== WAR PARTICIPANT COUNTS ===`);
const participantCounts = [];
for (const [warId, participants] of warParticipants) {
  const war = entities.find(e => e.id === warId);
  participantCounts.push({
    warId,
    name: war.name,
    status: war.status,
    participants: participants.length,
    participantIds: participants
  });
}
participantCounts.sort((a, b) => b.participants - a.participants);

for (const war of participantCounts.slice(0, 10)) {
  console.log(`  ${war.name} (${war.status}): ${war.participants} participants`);
}

// Find wars that share participants (war co-occurrence)
console.log(`\n=== WARS SHARING PARTICIPANTS ===`);
const warConnections = new Map(); // warId -> Set of connected warIds

for (const [warId, participants] of warParticipants) {
  warConnections.set(warId, new Set());

  for (const factionId of participants) {
    const otherWars = factionWars.get(factionId) || [];
    for (const otherWarId of otherWars) {
      if (otherWarId !== warId) {
        warConnections.get(warId).add(otherWarId);
      }
    }
  }
}

// Count connections per war
const connectionCounts = [];
for (const [warId, connections] of warConnections) {
  const war = entities.find(e => e.id === warId);
  const sharedFactions = [];

  // Find which factions are shared with each connected war
  for (const connectedWarId of connections) {
    const myParticipants = new Set(warParticipants.get(warId));
    const theirParticipants = warParticipants.get(connectedWarId) || [];
    const shared = theirParticipants.filter(p => myParticipants.has(p));
    if (shared.length > 0) {
      sharedFactions.push({ warId: connectedWarId, shared: shared.length });
    }
  }

  connectionCounts.push({
    warId,
    name: war.name,
    status: war.status,
    participantCount: warParticipants.get(warId).length,
    connectedWars: connections.size,
    sharedFactions
  });
}
connectionCounts.sort((a, b) => b.connectedWars - a.connectedWars);

console.log(`\nWars with most connections to other wars:`);
for (const war of connectionCounts.slice(0, 10)) {
  console.log(`  ${war.name} (${war.status}): ${war.connectedWars} connected wars, ${war.participantCount} participants`);
}

// Detect war clusters using connected components
console.log(`\n=== WAR CLUSTERS (via shared participants) ===`);
const visited = new Set();
const clusters = [];

function dfs(warId, cluster) {
  if (visited.has(warId)) return;
  visited.add(warId);
  cluster.push(warId);

  const connections = warConnections.get(warId);
  if (connections) {
    for (const connectedId of connections) {
      dfs(connectedId, cluster);
    }
  }
}

for (const [warId] of warParticipants) {
  if (!visited.has(warId)) {
    const cluster = [];
    dfs(warId, cluster);
    if (cluster.length > 0) {
      clusters.push(cluster);
    }
  }
}

clusters.sort((a, b) => b.length - a.length);
console.log(`Found ${clusters.length} war clusters`);

for (let i = 0; i < Math.min(5, clusters.length); i++) {
  const cluster = clusters[i];
  const activeInCluster = cluster.filter(id => entities.find(e => e.id === id)?.status === 'active').length;
  console.log(`\nCluster ${i + 1}: ${cluster.length} wars (${activeInCluster} active)`);

  // Get unique factions involved in this cluster
  const clusterFactions = new Set();
  for (const warId of cluster) {
    for (const factionId of (warParticipants.get(warId) || [])) {
      clusterFactions.add(factionId);
    }
  }
  console.log(`  Factions involved: ${clusterFactions.size}`);

  // Show wars in cluster
  for (const warId of cluster.slice(0, 5)) {
    const war = entities.find(e => e.id === warId);
    const participants = warParticipants.get(warId) || [];
    console.log(`    - ${war.name} (${war.status}): ${participants.length} participants`);
  }
  if (cluster.length > 5) {
    console.log(`    ... and ${cluster.length - 5} more wars`);
  }
}

// Detection criteria analysis
console.log(`\n=== DETECTION CRITERIA ANALYSIS ===`);
console.log(`\nPotential conditions for "Great War" detection from war perspective:`);

// Option 1: Wars connected to 3+ other wars
const highlyConnectedWars = connectionCounts.filter(w => w.connectedWars >= 3);
console.log(`\n1. Wars connected to 3+ other active wars: ${highlyConnectedWars.length}`);
for (const w of highlyConnectedWars.slice(0, 5)) {
  console.log(`   ${w.name}: ${w.connectedWars} connections`);
}

// Option 2: Wars with 4+ participants
const largeWars = participantCounts.filter(w => w.participants >= 4);
console.log(`\n2. Wars with 4+ participants: ${largeWars.length}`);
for (const w of largeWars.slice(0, 5)) {
  console.log(`   ${w.name}: ${w.participants} participants`);
}

// Option 3: Wars sharing participants with 2+ other wars
const multiOverlapWars = connectionCounts.filter(w => w.connectedWars >= 2 && w.participantCount >= 3);
console.log(`\n3. Wars with 3+ participants AND connected to 2+ other wars: ${multiOverlapWars.length}`);
for (const w of multiOverlapWars.slice(0, 5)) {
  console.log(`   ${w.name}: ${w.participantCount} participants, ${w.connectedWars} connected wars`);
}

// Analyze factions participating in multiple wars
console.log(`\n=== FACTIONS IN MULTIPLE WARS ===`);
const multiFactionWars = [];
for (const [factionId, warIds] of factionWars) {
  if (warIds.length >= 2) {
    const faction = entities.find(e => e.id === factionId);
    multiFactionWars.push({
      factionId,
      name: faction?.name || factionId,
      warCount: warIds.length
    });
  }
}
multiFactionWars.sort((a, b) => b.warCount - a.warCount);
console.log(`Factions in 2+ wars: ${multiFactionWars.length}`);
for (const f of multiFactionWars.slice(0, 10)) {
  console.log(`  ${f.name}: ${f.warCount} wars`);
}
