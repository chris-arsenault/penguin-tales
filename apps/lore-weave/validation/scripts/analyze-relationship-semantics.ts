#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

const statsPath = path.resolve(__dirname, '../../world-gen/output/stats.json');
const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));

// Get final epoch data
const finalEpoch = stats.epochStats[stats.epochStats.length - 1];
const relationships = finalEpoch.relationshipsByType;

// Categorize by semantic type
const categories: Record<string, string[]> = {
  'Geographic Facts (should NEVER change)': ['adjacent_to', 'contains', 'contained_by'],
  'Historical Facts (immutable past)': ['originated_in', 'founded_by', 'discoverer_of'],
  'Supernatural Facts (permanent magic)': ['slumbers_beneath', 'manifests_at'],
  'Affiliations (stable, can change)': ['resident_of', 'member_of', 'leader_of', 'practitioner_of'],
  'Social Bonds (dynamic relationships)': ['friend_of', 'lover_of', 'mentor_of', 'follower_of'],
  'Conflicts (persist, slow decay)': ['enemy_of', 'rival_of']
};

console.log('=== RELATIONSHIP SEMANTIC ANALYSIS ===\n');

for (const [category, kinds] of Object.entries(categories)) {
  console.log(`${category}:`);
  let found = false;
  kinds.forEach(kind => {
    const count = relationships[kind] || 0;
    if (count > 0) {
      console.log(`  ${kind.padEnd(20)} ${count.toString().padStart(3)} instances`);
      found = true;
    }
  });
  if (!found) console.log('  (none present)');
  console.log('');
}

console.log('\n=== THE CORE QUESTION ===\n');
console.log('Current approach: ALL relationships have decay/reinforcement/culling');
console.log('  - relationship_decay applies to ALL');
console.log('  - relationship_reinforcement applies to ALL (now with structuralBonus)');
console.log('  - relationship_culling applies to ALL (with protected exemptions)');
console.log('');
console.log('Does this make SEMANTIC sense?');
console.log('');
console.log('Example 1: "Aurora Stack" adjacent_to "Nightfall Shelf"');
console.log('  - Should this decay? NO - they are geographically fixed');
console.log('  - Should this reinforce? NO - geography doesn\'t change');
console.log('  - Should this be cullable? NEVER');
console.log('');
console.log('Example 2: "Rukan" member_of "The Icebound Exchange"');
console.log('  - Should this decay? MAYBE - if neglected/inactive');
console.log('  - Should this reinforce? YES - through shared experiences');
console.log('  - Should this be cullable? ONLY if defection occurs');
console.log('');
console.log('Example 3: "Rukan" friend_of "Nyla"');
console.log('  - Should this decay? YES - friendships fade without contact');
console.log('  - Should this reinforce? YES - through proximity/shared faction');
console.log('  - Should this be cullable? YES - if it decays to nothing');
console.log('');
console.log('\n=== POSSIBLE DESIGNS ===\n');
console.log('Option A: Category-specific systems');
console.log('  - relationship_decay_social (only social bonds)');
console.log('  - relationship_decay_affiliations (only affiliations, different rates)');
console.log('  - NO decay for facts');
console.log('');
console.log('Option B: Relationship metadata');
console.log('  - Each relationship kind declares: decayable, reinforceable, cullable');
console.log('  - Systems check metadata before applying');
console.log('');
console.log('Option C: Current approach + blanket exemptions');
console.log('  - Keep unified systems');
console.log('  - Add fact_kinds list that skips ALL processing');
console.log('  - Use structuralBonus for affiliations');
console.log('');
console.log('Trade-offs:');
console.log('  A: Most semantically correct, more complex, more parameters');
console.log('  B: Flexible, data-driven, requires schema/metadata system');
console.log('  C: Simple, but loses semantic clarity (current path)');
