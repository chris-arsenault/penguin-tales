#!/usr/bin/env node

/**
 * Analyze: Are templates creating too many NPCs?
 */

import * as fs from 'fs';
import * as path from 'path';

const statsPath = path.resolve(__dirname, '../../world-gen/output/stats.json');
const stats = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));

// Get final entity counts
const finalEpoch = stats.epochStats[stats.epochStats.length - 1];
const entityCounts = finalEpoch.entitiesByKind;
const subtypeCounts = finalEpoch.entitiesBySubtype;

console.log('=== ENTITY CREATION ANALYSIS ===\n');

console.log('Final entity counts by kind:');
let total = 0;
for (const [kind, count] of Object.entries(entityCounts as Record<string, number>)) {
  console.log(`  ${kind.padEnd(15)} ${count.toString().padStart(3)} (${(count / stats.finalEntityCount * 100).toFixed(1)}%)`);
  total += count;
}
console.log(`  Total: ${total}\n`);

console.log('Breakdown by subtype:');
for (const [subtype, count] of Object.entries(subtypeCounts as Record<string, number>)) {
  console.log(`  ${subtype.padEnd(30)} ${count.toString().padStart(3)}`);
}

console.log('\n=== GAME RELEVANCE BY ENTITY KIND ===\n');

const entityGameValue = {
  'location': {
    count: entityCounts.location || 0,
    gameValue: 'CRITICAL',
    why: 'Players explore locations, locations have resources, quests, dangers',
    importance: 10
  },
  'faction': {
    count: entityCounts.faction || 0,
    gameValue: 'CRITICAL',
    why: 'Faction reputation, quests, conflicts drive gameplay',
    importance: 10
  },
  'abilities': {
    count: entityCounts.abilities || 0,
    gameValue: 'CRITICAL',
    why: 'Player abilities, magic systems, tech trees',
    importance: 10
  },
  'rules': {
    count: entityCounts.rules || 0,
    gameValue: 'HIGH',
    why: 'World laws, cultural restrictions, quest hooks',
    importance: 7
  },
  'npc': {
    count: entityCounts.npc || 0,
    gameValue: 'MEDIUM',
    why: 'Quest givers, merchants, enemies - BUT only need a few per location',
    importance: 5
  }
};

for (const [kind, info] of Object.entries(entityGameValue)) {
  console.log(`${kind} (${info.count} entities):`);
  console.log(`  Game value: ${info.gameValue} (${info.importance}/10)`);
  console.log(`  Why: ${info.why}`);
  console.log('');
}

console.log('=== ENTITY RATIO ANALYSIS ===\n');

const npcCount = entityCounts.npc || 0;
const locationCount = entityCounts.location || 0;
const factionCount = entityCounts.faction || 0;
const abilityCount = entityCounts.abilities || 0;
const rulesCount = entityCounts.rules || 0;

const worldEntities = locationCount + factionCount + abilityCount + rulesCount;

console.log(`NPCs: ${npcCount} (${(npcCount / total * 100).toFixed(1)}%)`);
console.log(`World entities (location/faction/ability/rules): ${worldEntities} (${(worldEntities / total * 100).toFixed(1)}%)`);
console.log(`Ratio: ${(npcCount / worldEntities).toFixed(2)} NPCs per world entity\n`);

console.log('PROBLEM: High NPC ratio means:');
console.log('  - Most relationships involve NPCs (current: 69%)');
console.log('  - Systems spend compute on NPC drama instead of world dynamics');
console.log('  - Generated lore is "who\'s dating whom" not "faction war over magic"');
console.log('');

console.log('For game lore, ideal ratios:');
console.log('  - Locations: 30-40 (colonies, dungeons, points of interest)');
console.log('  - Factions: 15-20 (guilds, kingdoms, cults, criminal orgs)');
console.log('  - Abilities: 20-30 (magic schools, tech trees, special powers)');
console.log('  - Rules: 10-15 (laws, traditions, taboos)');
console.log('  - NPCs: 20-30 (quest givers, bosses, merchants - just key figures)');
console.log('  Total: ~100-130 entities');
console.log('  NPC ratio: 0.25-0.4 NPCs per world entity (currently: ' + (npcCount / worldEntities).toFixed(2) + ')\n');

console.log('=== TEMPLATE ANALYSIS ===\n');

// Analyze which templates create NPCs
const npcTemplates = [
  {
    name: 'familyExpansion',
    creates: 'NPCs (1-3 children per family)',
    gameValue: 'LOW',
    recommendation: 'REMOVE or make extremely rare',
    reason: 'Creates family trees nobody cares about'
  },
  {
    name: 'heroEmergence',
    creates: 'NPCs (1 hero)',
    gameValue: 'MEDIUM',
    recommendation: 'KEEP but throttle heavily',
    reason: 'Heroes are quest-relevant, but don\'t need many'
  },
  {
    name: 'outlawRecruitment',
    creates: 'NPCs (2-4 outlaws)',
    gameValue: 'LOW',
    recommendation: 'REMOVE or replace with faction expansion',
    reason: 'Individual outlaws less interesting than criminal factions'
  },
  {
    name: 'mysteriousVanishing',
    creates: 'NPCs (disappearance events)',
    gameValue: 'LOW',
    recommendation: 'REMOVE - too niche',
    reason: 'Interesting idea but creates NPC bloat'
  },
  {
    name: 'kinshipConstellation',
    creates: 'NPCs (3-6 family members)',
    gameValue: 'LOW',
    recommendation: 'REMOVE',
    reason: 'Pure NPC social network generation'
  },
  {
    name: 'successionCrisis',
    creates: 'NPCs (claimants to leadership)',
    gameValue: 'LOW',
    recommendation: 'REPLACE with faction_leadership_crisis',
    reason: 'Succession should affect factions, not create more NPCs'
  }
];

console.log('NPC-creating templates (current):');
npcTemplates.forEach(t => {
  console.log(`\n${t.name}:`);
  console.log(`  Creates: ${t.creates}`);
  console.log(`  Game value: ${t.gameValue}`);
  console.log(`  → ${t.recommendation}`);
  console.log(`  Why: ${t.reason}`);
});

console.log('\n\n=== PROPOSED TEMPLATE CHANGES ===\n');

const templateChanges = {
  'REMOVE (NPC bloat)': [
    'familyExpansion - Creates family trees',
    'kinshipConstellation - Creates family networks',
    'outlawRecruitment - Creates individual outlaws',
    'mysteriousVanishing - Creates disappearance drama'
  ],

  'THROTTLE HEAVILY (keep for flavor)': [
    'heroEmergence - Reduce to 1-2 heroes total, not per faction',
    'successionCrisis - Only for major faction leaders'
  ],

  'ADD (world-level templates)': [
    'territorial_expansion - Factions expand into new locations',
    'magical_site_discovery - Locations with magical properties discovered',
    'technological_breakthrough - Factions develop new abilities',
    'faction_merger - Two factions combine',
    'faction_collapse - Faction dissolves, creates power vacuum',
    'location_disaster - Location corrupted/destroyed by magic/conflict',
    'trade_route_establishment - Locations form economic connections',
    'magical_school_founding - Ability gains institutional support',
    'tech_monopoly_formation - Faction gains exclusive ability access',
    'religious_schism - Rules fragment into competing ideologies'
  ]
};

for (const [category, templates] of Object.entries(templateChanges)) {
  console.log(`${category}:`);
  templates.forEach(t => console.log(`  - ${t}`));
  console.log('');
}

console.log('=== EXPECTED OUTCOME ===\n');

console.log('Current entity distribution:');
console.log(`  NPCs: ${npcCount} (${(npcCount / total * 100).toFixed(1)}%)`);
console.log(`  World entities: ${worldEntities} (${(worldEntities / total * 100).toFixed(1)}%)`);
console.log('');

console.log('After template changes:');
console.log('  NPCs: ~25 (20% of total)');
console.log('    - ~15 faction leaders (1 per faction)');
console.log('    - ~5 heroes/bosses (notable figures)');
console.log('    - ~5 quest-critical NPCs');
console.log('');
console.log('  Locations: ~35 (28%)');
console.log('    - Colonies, dungeons, points of interest');
console.log('    - Each location can reference NPCs without creating them');
console.log('');
console.log('  Factions: ~20 (16%)');
console.log('    - Political, economic, religious, criminal organizations');
console.log('');
console.log('  Abilities: ~30 (24%)');
console.log('    - Magic schools, technologies, special powers');
console.log('');
console.log('  Rules: ~15 (12%)');
console.log('    - Laws, traditions, taboos, customs');
console.log('');
console.log('  Total: ~125 entities');
console.log('  NPC ratio: 0.25 NPCs per world entity (down from ' + (npcCount / worldEntities).toFixed(2) + ')');
console.log('');

console.log('Impact on relationships:');
console.log('  - Remove lover_of, follower_of, mentor_of (337 relationships eliminated)');
console.log('  - Add 30 world-level relationship kinds');
console.log('  - Result: 80% world-level, 20% NPC relationships');
console.log('  - Game lore quality: Faction wars, magical corruption, tech monopolies');
console.log('');

console.log('=== KEY INSIGHT ===\n');
console.log('The NPC-focus problem has THREE layers:');
console.log('  1. Templates create too many NPCs (need to remove NPC templates)');
console.log('  2. Relationship kinds are NPC-focused (need world-level kinds)');
console.log('  3. Systems operate on NPC relationships (need world-level systems)');
console.log('');
console.log('Must fix ALL THREE to achieve game-relevant lore generation.');
