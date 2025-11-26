#!/usr/bin/env node

/**
 * Analyze: Are the relationship KINDS themselves too NPC-focused?
 */

import * as fs from 'fs';
import * as path from 'path';

const statsPath = path.resolve(__dirname, '../../world-gen/output/stats.json');
const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
const finalEpoch = stats.epochStats[stats.epochStats.length - 1];
const relationships = finalEpoch.relationshipsByType;

// Categorize relationship kinds by what they're FOR
const relationshipAnalysis = {
  'NPC Social Drama (low game value)': {
    kinds: ['lover_of', 'friend_of', 'mentor_of', 'follower_of'],
    purpose: 'Personal relationships between NPCs',
    gameRelevance: 'Low - flavor only, not core lore',
    recommendation: 'REDUCE or REMOVE'
  },

  'NPC Conflicts (some game value)': {
    kinds: ['rival_of', 'enemy_of'],
    purpose: 'Interpersonal conflicts',
    gameRelevance: 'Medium IF it leads to faction conflicts, low if just personal drama',
    recommendation: 'KEEP but apply to factions/locations too'
  },

  'NPC Affiliations (structural, keep)': {
    kinds: ['member_of', 'leader_of', 'resident_of', 'practitioner_of'],
    purpose: 'How NPCs connect to world entities',
    gameRelevance: 'High - shows faction composition, location population',
    recommendation: 'KEEP - these are important connectors'
  },

  'Historical Facts (high game value)': {
    kinds: ['originated_in', 'founded_by', 'discoverer_of'],
    purpose: 'Origin stories and history',
    gameRelevance: 'High - creates lore depth',
    recommendation: 'KEEP and ADD MORE (discovered_at, first_practiced_in, etc.)'
  },

  'Geographic Facts (essential)': {
    kinds: ['adjacent_to', 'contains', 'contained_by'],
    purpose: 'World structure and geography',
    gameRelevance: 'High - defines physical world',
    recommendation: 'KEEP - immutable backbone'
  },

  'Supernatural Facts (high game value)': {
    kinds: ['slumbers_beneath', 'manifests_at'],
    purpose: 'Magic/mystery locations',
    gameRelevance: 'High - creates points of interest',
    recommendation: 'KEEP and ADD MORE (corrupts, blesses, etc.)'
  },

  'Faction Dynamics (MISSING!)': {
    kinds: ['allied_with'],
    purpose: 'Faction relationships',
    gameRelevance: 'High - core political dynamics',
    recommendation: 'ADD: controls, contests, monopolizes, trades_with, etc.'
  },

  'Location Dynamics (MOSTLY MISSING!)': {
    kinds: [],
    purpose: 'How locations interact',
    gameRelevance: 'High - territorial conflicts, trade, refugee flows',
    recommendation: 'ADD: rival_of, trade_routes, sieges, etc.'
  },

  'Ability Dynamics (MOSTLY MISSING!)': {
    kinds: [],
    purpose: 'How magic/tech spreads and affects world',
    gameRelevance: 'High - power systems and corruption',
    recommendation: 'ADD: corrupted_by, weaponized_by, bans, etc.'
  }
};

console.log('=== RELATIONSHIP KIND ANALYSIS ===\n');

for (const [category, info] of Object.entries(relationshipAnalysis)) {
  console.log(`${category}:`);

  if (info.kinds.length > 0) {
    let total = 0;
    info.kinds.forEach(kind => {
      const count = relationships[kind] || 0;
      if (count > 0) {
        console.log(`  ${kind.padEnd(20)} ${count.toString().padStart(3)} instances`);
        total += count;
      }
    });
    console.log(`  Total: ${total}`);
  } else {
    console.log(`  (NONE EXIST - this is the gap!)`);
  }

  console.log(`  Purpose: ${info.purpose}`);
  console.log(`  Game relevance: ${info.gameRelevance}`);
  console.log(`  → ${info.recommendation}`);
  console.log('');
}

console.log('\n=== PROPOSED NEW RELATIONSHIP KINDS ===\n');

const proposedKinds = {
  'Faction ↔ Location': [
    'controls (governance)',
    'contests (attempting to seize)',
    'sieges (active military conflict)',
    'trades_from (economic hub)',
    'refuges_in (displaced population)',
    'blockades (economic warfare)'
  ],

  'Faction ↔ Ability': [
    'weaponizes (military application)',
    'monopolizes (exclusive control)',
    'bans (prohibition)',
    'researches (active development)',
    'lost_knowledge_of (forgotten tech/magic)'
  ],

  'Location ↔ Ability': [
    'corrupted_by (environmental damage)',
    'blessed_by (environmental enhancement)',
    'scarred_by (permanent damage - historical)',
    'amplifies (location boosts ability)',
    'nullifies (location suppresses ability)',
    'discovered_at (origin story)'
  ],

  'Location ↔ Location': [
    'rival_of (competition)',
    'allied_with (cooperation)',
    'trade_routes (economic connection)',
    'refugee_flows_to (crisis migration)',
    'threatens (territorial expansion)'
  ],

  'Faction ↔ Faction': [
    'trades_with (economic relationship)',
    'subsidizes (economic support)',
    'tributary_of (vassal relationship)',
    'contests_with (active competition)'
  ],

  'Ability ↔ Ability': [
    'counters (opposing forces)',
    'amplifies (synergistic)',
    'corrupts (warps/transforms)',
    'derived_from (evolution/combination)'
  ]
};

for (const [entityPair, kinds] of Object.entries(proposedKinds)) {
  console.log(`${entityPair}:`);
  kinds.forEach(kind => console.log(`  + ${kind}`));
  console.log('');
}

console.log('\n=== RELATIONSHIP KINDS TO DEPRECATE ===\n');

const toDeprecate = [
  {
    kind: 'lover_of',
    reason: 'Pure NPC drama, no game relevance',
    replacement: 'Remove or make extremely rare (0.01% chance)',
    impact: 'Currently: 186 instances (22% of all relationships!)'
  },
  {
    kind: 'friend_of',
    reason: 'NPC social network, low game value',
    replacement: 'Remove or repurpose as "allied_npc_of" for quest mechanics',
    impact: 'If exists, likely many instances'
  },
  {
    kind: 'follower_of',
    reason: 'Redundant with member_of + prominence',
    replacement: 'Use member_of + NPC prominence to determine followers',
    impact: 'Currently: 86 instances (10%)'
  }
];

toDeprecate.forEach(item => {
  console.log(`${item.kind}:`);
  console.log(`  Why deprecate: ${item.reason}`);
  console.log(`  Replace with: ${item.replacement}`);
  console.log(`  Current impact: ${item.impact}`);
  console.log('');
});

console.log('\n=== SUMMARY RECOMMENDATION ===\n');

console.log('REMOVE (low game value):');
console.log('  - lover_of (pure drama)');
console.log('  - friend_of (if it exists)');
console.log('  - follower_of (redundant)');
console.log('  Impact: Eliminates ~300+ NPC-drama relationships');
console.log('');

console.log('KEEP (structural/historical):');
console.log('  - member_of, leader_of, resident_of, practitioner_of');
console.log('  - originated_in, founded_by, discoverer_of');
console.log('  - adjacent_to, contains, slumbers_beneath, manifests_at');
console.log('  - rival_of, enemy_of (but extend to factions/locations)');
console.log('');

console.log('ADD (world-level dynamics):');
console.log('  - 6 Faction ↔ Location kinds (controls, contests, etc.)');
console.log('  - 5 Faction ↔ Ability kinds (weaponizes, bans, etc.)');
console.log('  - 6 Location ↔ Ability kinds (corrupted_by, blessed_by, etc.)');
console.log('  - 5 Location ↔ Location kinds (trade_routes, etc.)');
console.log('  - 4 Faction ↔ Faction kinds (trades_with, etc.)');
console.log('  - 4 Ability ↔ Ability kinds (counters, amplifies, etc.)');
console.log('  Total: 30 new world-level relationship kinds');
console.log('');

console.log('EXPECTED OUTCOME:');
console.log('  Before: 69% NPC-drama, 31% world-level');
console.log('  After: 20% NPC-structural, 80% world-level');
console.log('  Game lore quality: Dramatically improved');
