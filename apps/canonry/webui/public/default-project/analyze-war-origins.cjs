const fs = require('fs');
const file = process.argv[2];
const data = JSON.parse(fs.readFileSync(file));
const entities = data.worldData.hardState;
const wars = entities.filter(e => e.kind === 'occurrence' && e.subtype === 'war');

// Count by tags to determine origin
const origins = { declared: 0, outbreak: 0, betrayal: 0, orca: 0, other: 0 };

for (const war of wars) {
  const tags = war.tags || {};
  if (tags.declared_war) origins.declared++;
  else if (tags.betrayal_war) origins.betrayal++;
  else if (tags.orca_offensive) origins.orca++;
  else if (tags.artifact_war || tags.conflict) origins.outbreak++;
  else origins.other++;
}

console.log('Wars by origin:');
console.log('  war_declaration:', origins.declared);
console.log('  war_outbreak:', origins.outbreak);
console.log('  alliance_betrayal:', origins.betrayal);
console.log('  orca_offensive:', origins.orca);
console.log('  other/unknown:', origins.other);
console.log('');
console.log('War details:');
for (const war of wars.sort((a,b) => a.createdAt - b.createdAt)) {
  const tags = Object.keys(war.tags || {});
  const tagList = tags.filter(t => t !== 'conflict').join(', ') || 'none';
  console.log('  tick ' + war.createdAt + ': ' + war.name + ' [' + tagList + ']');
}
