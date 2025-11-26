#!/usr/bin/env node

/**
 * Analyze: Are systems creating world-level or NPC-level relationships?
 */

console.log('=== WHAT SYSTEMS ACTUALLY CREATE ===\n');

const systemOutputs = [
  {
    name: 'relationship_formation',
    creates: ['follower_of', 'rival_of', 'enemy_of', 'lover_of', 'mentor_of'],
    entityTypes: 'NPC ↔ NPC',
    gameRelevance: '⚠️  Low (player doesn\'t care who\'s dating who)'
  },
  {
    name: 'conflict_contagion',
    creates: ['enemy_of (spread via allies)'],
    entityTypes: 'NPC/Faction ↔ NPC/Faction',
    gameRelevance: '✓ Medium (faction wars matter, NPC feuds don\'t)'
  },
  {
    name: 'alliance_formation',
    creates: ['allied_with'],
    entityTypes: 'Faction ↔ Faction',
    gameRelevance: '✓✓ High (faction alliances = major lore)'
  },
  {
    name: 'legend_crystallization',
    creates: ['commemorates', 'originated_in'],
    entityTypes: 'Location/Rule ↔ NPC',
    gameRelevance: '✓✓ High (places get history)'
  },
  {
    name: 'succession_vacuum',
    creates: ['rival_of', 'enemy_of (NPC claimants)'],
    entityTypes: 'NPC ↔ NPC',
    gameRelevance: '⚠️  Low (unless it affects faction control)'
  },
  {
    name: 'decay/reinforcement/culling',
    creates: ['(modifies all relationships)'],
    entityTypes: 'All types',
    gameRelevance: '? Currently focused on NPC social dynamics'
  }
];

systemOutputs.forEach(sys => {
  console.log(`${sys.name}:`);
  console.log(`  Creates: ${sys.creates.join(', ')}`);
  console.log(`  Entity types: ${sys.entityTypes}`);
  console.log(`  Game relevance: ${sys.gameRelevance}`);
  console.log('');
});

console.log('\n=== MISSING WORLD-LEVEL SYSTEMS ===\n');

const missingSystems = [
  {
    name: 'territorial_control',
    would_create: ['controls', 'contests', 'sieges'],
    entities: 'Faction ↔ Location',
    why: 'Power struggles over territory - core game lore',
    example: '"The Midnight Claws seize control of the Krill Shoals"'
  },
  {
    name: 'resource_competition',
    would_create: ['monopolizes', 'trades_with', 'blockades'],
    entities: 'Faction ↔ Location, Faction ↔ Faction',
    why: 'Economic conflicts drive faction dynamics',
    example: '"The Icebound Exchange monopolizes Aurora Stack trade"'
  },
  {
    name: 'magical_corruption',
    would_create: ['corrupted_by', 'blessed_by', 'scarred_by'],
    entities: 'Location ↔ Ability',
    why: 'Magic shapes the world physically',
    example: '"The Glow-Fissure corrupts Nightfall Shelf, warping reality"'
  },
  {
    name: 'technological_adoption',
    would_create: ['weaponizes', 'monopolizes', 'bans'],
    entities: 'Faction ↔ Ability',
    why: 'Tech creates power imbalances',
    example: '"East Perch Merchants weaponize fishing gun technology"'
  },
  {
    name: 'location_rivalry',
    would_create: ['rival_of', 'allied_with', 'trade_routes'],
    entities: 'Location ↔ Location',
    why: 'Cities compete for resources/influence',
    example: '"Aurora Stack and East Perch vie for trade dominance"'
  },
  {
    name: 'magical_discovery',
    would_create: ['discovered_at', 'sealed_in', 'unleashed_from'],
    entities: 'Ability ↔ Location, Faction ↔ Ability',
    why: 'Magic emerges from/affects places',
    example: '"Shadow magic discovered beneath Nightfall Shelf"'
  }
];

missingSystems.forEach(sys => {
  console.log(`${sys.name}:`);
  console.log(`  Would create: ${sys.would_create.join(', ')}`);
  console.log(`  Entity types: ${sys.entities}`);
  console.log(`  Why it matters: ${sys.why}`);
  console.log(`  Example: ${sys.example}`);
  console.log('');
});

console.log('\n=== RECOMMENDATION ===\n');

console.log('CURRENT: 69% NPC relationships, 31% world-level');
console.log('GOAL: 30% NPC relationships, 70% world-level');
console.log('');
console.log('Strategy:');
console.log('  1. KEEP: alliance_formation, legend_crystallization (already world-level)');
console.log('  2. REDUCE: relationship_formation throttle (less NPC social drama)');
console.log('  3. ADD: 2-3 new world-level systems from above list');
console.log('  4. REFOCUS: decay/reinforcement on faction/location relationships');
console.log('');
console.log('Quick wins (add these first):');
console.log('  → territorial_control: Factions compete for locations');
console.log('  → magical_corruption: Abilities warp locations');
console.log('  → technological_adoption: Factions weaponize abilities');
console.log('');
console.log('These create the world-shaping dynamics a game needs:');
console.log('  - Why this city is dangerous (corrupted by magic)');
console.log('  - Why these factions are at war (territorial control)');
console.log('  - Why this faction is powerful (monopolizes tech)');
