const fs = require("fs");
const data = JSON.parse(fs.readFileSync("run-jan-2-3-23-am-211-entities.canonry-slot.json"));
const history = data.worldData.history || [];
const hardState = data.worldData.hardState || {};

// Build entity lookup
const entities = {};
Object.values(hardState).forEach(e => { entities[e.id] = e; });

// Find era changes
const eras = new Map();
history.forEach(e => {
  if (e.era && !eras.has(e.era)) {
    eras.set(e.era, e.tick);
  }
});
console.log("=== ERA TRANSITIONS ===");
eras.forEach((tick, era) => console.log("  " + era + ": starts at tick " + tick));

// Check entities created during expansion era
const expansionEvents = history.filter(e => e.era === "expansion");
console.log("\n=== EXPANSION ERA (ticks 0-24) ===");
console.log("Total events:", expansionEvents.length);

const entityIds = expansionEvents.flatMap(e => e.entitiesCreated || []);
const kindCounts = {};
const subtypeCounts = {};
entityIds.forEach(id => {
  const entity = entities[id];
  if (entity) {
    const key = entity.kind;
    kindCounts[key] = (kindCounts[key] || 0) + 1;
    const subKey = entity.kind + "/" + entity.subtype;
    subtypeCounts[subKey] = (subtypeCounts[subKey] || 0) + 1;
  }
});
console.log("\nEntities created by kind:");
Object.entries(kindCounts).sort((a,b) => b[1] - a[1]).forEach(([k, c]) => {
  console.log("  " + k + ": " + c);
});

console.log("\nEntities created by kind/subtype:");
Object.entries(subtypeCounts).sort((a,b) => b[1] - a[1]).slice(0, 20).forEach(([k, c]) => {
  console.log("  " + k + ": " + c);
});

// Check relationships created during expansion
const relsCreated = expansionEvents.flatMap(e => e.relationshipsCreated || []);
const relKindCounts = {};
relsCreated.forEach(r => {
  relKindCounts[r.kind] = (relKindCounts[r.kind] || 0) + 1;
});
console.log("\nRelationships created:");
Object.entries(relKindCounts).sort((a,b) => b[1] - a[1]).slice(0, 15).forEach(([k, c]) => {
  console.log("  " + k + ": " + c);
});

// Check event descriptions to understand what's happening
console.log("\n=== SAMPLE EVENT DESCRIPTIONS ===");
expansionEvents.slice(0, 10).forEach(e => {
  if (e.description) console.log("  - " + e.description.substring(0, 80));
});

// Check what tags are being set during expansion
const tagSets = {};
expansionEvents.forEach(e => {
  (e.entitiesModified || []).forEach(mod => {
    if (mod.changes && mod.changes.tags) {
      Object.keys(mod.changes.tags).forEach(tag => {
        tagSets[tag] = (tagSets[tag] || 0) + 1;
      });
    }
  });
});
console.log("\n=== TAGS SET DURING EXPANSION ===");
Object.entries(tagSets).sort((a,b) => b[1] - a[1]).slice(0, 15).forEach(([k, c]) => {
  console.log("  " + k + ": " + c);
});
