// Analyze war creation vs resolution timing
const fs = require('fs');

const runFile = process.argv[2] || 'run-jan-2-2-21-pm-209-entities.canonry-slot.json';
const data = JSON.parse(fs.readFileSync(runFile, 'utf8'));
const entities = data.worldData.hardState;
const relationships = data.worldData.relationships;
const history = data.worldData.history || [];

// Get simulation end state
const finalTick = data.simulationState?.tick || 0;
const finalEra = entities.find(e => e.kind === 'era' && e.status === 'current');

console.log(`\n=== SIMULATION STATE ===`);
console.log(`Final tick: ${finalTick}`);
console.log(`Current era: ${finalEra?.name || 'unknown'}`);

// Get all wars
const wars = entities.filter(e => e.kind === 'occurrence' && e.subtype === 'war');
console.log(`\nTotal wars: ${wars.length}`);
console.log(`Active: ${wars.filter(w => w.status === 'active').length}`);
console.log(`Historical: ${wars.filter(w => w.status === 'historical').length}`);

// Timeline of war creation
console.log(`\n=== WAR CREATION TIMELINE ===`);
const warsByTick = wars.map(w => ({
  name: w.name,
  id: w.id,
  status: w.status,
  createdAt: w.createdAt,
  updatedAt: w.updatedAt
})).sort((a, b) => a.createdAt - b.createdAt);

for (const war of warsByTick) {
  const resolved = war.status === 'historical' ? ` -> resolved tick ${war.updatedAt}` : ' [STILL ACTIVE]';
  console.log(`  Tick ${war.createdAt}: ${war.name}${resolved}`);
}

// Count active wars over time
console.log(`\n=== ACTIVE WAR COUNT OVER TIME ===`);
const tickCounts = new Map();
for (let t = 0; t <= finalTick; t++) {
  let activeCount = 0;
  for (const war of wars) {
    const created = war.createdAt <= t;
    const resolved = war.status === 'historical' && war.updatedAt <= t;
    if (created && !resolved) activeCount++;
  }
  tickCounts.set(t, activeCount);
}

// Sample every 10 ticks
for (let t = 0; t <= finalTick; t += 10) {
  console.log(`  Tick ${t}: ${tickCounts.get(t)} active wars`);
}
console.log(`  Tick ${finalTick}: ${tickCounts.get(finalTick)} active wars`);

// Find peak active wars
let peakActive = 0;
let peakTick = 0;
for (const [t, count] of tickCounts) {
  if (count > peakActive) {
    peakActive = count;
    peakTick = t;
  }
}
console.log(`\nPeak: ${peakActive} active wars at tick ${peakTick}`);

// War duration analysis
console.log(`\n=== WAR DURATION ANALYSIS ===`);
const historicalWars = wars.filter(w => w.status === 'historical');
const activeWars = wars.filter(w => w.status === 'active');

if (historicalWars.length > 0) {
  const durations = historicalWars.map(w => w.updatedAt - w.createdAt);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  console.log(`Resolved wars: ${historicalWars.length}`);
  console.log(`  Avg duration: ${avgDuration.toFixed(1)} ticks`);
  console.log(`  Min: ${minDuration}, Max: ${maxDuration}`);
}

if (activeWars.length > 0) {
  console.log(`\nStill active wars: ${activeWars.length}`);
  for (const war of activeWars) {
    const age = finalTick - war.createdAt;
    console.log(`  ${war.name}: age ${age} ticks (created tick ${war.createdAt})`);
  }
}

// Analyze at_war_with - ACTIVE ONLY at each point
console.log(`\n=== ACTIVE AT_WAR_WITH OVER TIME ===`);
const atWarWith = relationships.filter(r => r.kind === 'at_war_with');

// Track active at_war_with at end
const activeAtWarWith = atWarWith.filter(r => r.status === 'active');
console.log(`Active at_war_with at end: ${activeAtWarWith.length}`);

// Check harmony pressure if available
const pressures = data.worldData.pressures;
if (pressures) {
  console.log(`\n=== PRESSURE STATE ===`);
  for (const [key, value] of Object.entries(pressures)) {
    console.log(`  ${key}: ${typeof value === 'number' ? value.toFixed(2) : JSON.stringify(value)}`);
  }
}

// Analyze why active wars haven't resolved
console.log(`\n=== WHY ACTIVE WARS HAVEN'T RESOLVED ===`);
// Check war_fatigue tag
for (const war of activeWars) {
  const age = finalTick - war.createdAt;
  const hasFatigue = war.tags?.war_fatigue || war.tags?.war_weary;
  console.log(`\n${war.name} (age ${age} ticks):`);
  console.log(`  Tags: ${JSON.stringify(war.tags || {})}`);
  console.log(`  Has fatigue tag: ${hasFatigue ? 'YES' : 'NO'}`);

  // Check participants
  const participants = relationships.filter(r =>
    r.kind === 'participant_in' && r.dst === war.id && r.status === 'active'
  );
  console.log(`  Participants: ${participants.length}`);

  // Check if there's a clear winner (higher prominence?)
  for (const p of participants) {
    const faction = entities.find(e => e.id === p.src);
    if (faction) {
      console.log(`    - ${faction.name} (prominence: ${faction.prominence})`);
    }
  }
}
