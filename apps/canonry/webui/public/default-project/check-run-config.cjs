const d = require('./run-jan-2-1-38-pm-213-entities.canonry-slot.json');

// Check if config has systems
const systems = d.config?.systems || [];
console.log('Total systems in run config:', systems.length);

const isoSystem = systems.find(s => s.config?.id === 'cleansed_isolation_decay');
console.log('cleansed_isolation_decay in run config:', isoSystem ? 'YES' : 'NO');

if (!isoSystem) {
  // List all threshold trigger systems
  const thresholdSystems = systems.filter(s => s.systemType === 'thresholdTrigger');
  console.log('\nThreshold trigger systems in run:', thresholdSystems.length);
  thresholdSystems.forEach(s => console.log('  -', s.config?.id));
}

// Check era modifiers
const eras = d.config?.eras || [];
console.log('\nEra modifiers for cleansed_isolation_decay:');
eras.forEach(era => {
  const mod = era.systemModifiers?.cleansed_isolation_decay;
  console.log(`  ${era.id}: ${mod !== undefined ? mod : 'NOT SET'}`);
});
