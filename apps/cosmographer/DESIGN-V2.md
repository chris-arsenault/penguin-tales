# Cosmographer v2 - Schema-Driven Inference

## Core Insight

Cosmographer should **read the domain schema** and **infer** coordinate spaces, not require manual plane specification.

## Input: Domain Schema (already exists)

```typescript
// From penguin-tales/lore/schema.ts
const penguinDomain = {
  entityKinds: {
    location: {
      subtypes: ['colony', 'hunting_ground', 'sacred_site', 'underwater_cave', 'ice_tunnel'],
      defaultPlacement: 'physical'
    },
    npc: {
      subtypes: ['elder', 'hunter', 'crafter', 'fledgling', 'outcast'],
      defaultPlacement: 'physical'  // but also has 'social' coordinates
    },
    faction: {
      subtypes: ['colony_council', 'fishing_guild', 'ice_crafters', 'criminal_gang'],
      defaultPlacement: 'political'
    },
    rules: {
      subtypes: ['colonial_law', 'guild_rule', 'tradition', 'taboo'],
      defaultPlacement: 'legal'
    },
    abilities: {
      subtypes: ['aurora_vision', 'ice_shaping', 'deep_song', 'ancestor_speech'],
      defaultPlacement: 'magical'
    }
  },

  relationshipKinds: {
    member_of: { ... },
    controls: { ... },
    allied_with: { ... },
    teaches: { ... }
  }
};
```

## Inference Process

### Step 1: Identify Coordinate Spaces from Entity Kinds

```
location, npc → physical (spatial entities)
faction → political (power structures)
rules → legal (governance)
abilities → magical (supernatural)
npc (also) → social (status)
```

### Step 2: Infer Planes from Subtypes

For each coordinate space, analyze subtypes using semantic patterns:

```
PHYSICAL space (from location subtypes):
  'colony' → surface (settlement keyword)
  'hunting_ground' → aquatic (hunting + penguin context)
  'sacred_site' → surface or elevated
  'underwater_cave' → subterranean + aquatic
  'ice_tunnel' → subterranean

  Inferred planes: [surface, underwater, subterranean]

POLITICAL space (from faction subtypes):
  'colony_council' → sovereign_law
  'fishing_guild' → guild_law
  'ice_crafters' → guild_law
  'criminal_gang' → outlaw

  Inferred planes: [sovereign, guild, outlaw]

LEGAL space (from rules subtypes):
  'colonial_law' → statutory_law
  'guild_rule' → guild_law
  'tradition' → customary_law
  'taboo' → informal_rules

  Inferred planes: [statutory, guild, customary, informal]

MAGICAL space (from abilities subtypes):
  'aurora_vision' → divine_magic (aurora = celestial)
  'ice_shaping' → elemental_magic
  'deep_song' → primal
  'ancestor_speech' → necromancy or divine

  Inferred planes: [divine, elemental, primal]
```

### Step 3: Build Hierarchy from Category Relationships

Use the ontology's `typicalParents` / `typicalChildren` to order planes:

```
PHYSICAL: surface (primary) → [underwater, subterranean]
POLITICAL: sovereign (primary) → guild → outlaw
LEGAL: statutory (primary) → [guild, customary] → informal
MAGICAL: divine (primary) → elemental → primal
```

### Step 4: Calculate Distances from Category Properties

Use `accessibilityWeight` and `categoryDistance()` to generate the distance matrix.

## Output: Multiple Coordinate Space Configs

```json
{
  "coordinateSpaces": [
    {
      "id": "physical",
      "entityKinds": ["location", "npc"],
      "axes": {
        "plane": {
          "enumValues": [
            { "id": "surface", "numericValue": 0.5 },
            { "id": "underwater", "numericValue": 0.3 },
            { "id": "subterranean", "numericValue": 0.7 }
          ]
        }
      },
      "manifoldConfig": {
        "planeHierarchy": [
          { "planeId": "surface", "children": ["underwater", "subterranean"], "priority": 1 }
        ]
      }
    },
    {
      "id": "political",
      "entityKinds": ["faction"],
      "axes": { ... },
      "manifoldConfig": { ... }
    }
  ]
}
```

## Integration with Lore-Weave

### Option A: Build-Time Generation

```bash
# During domain development
cosmographer infer ./penguin-tales/lore/schema.ts -o ./penguin-tales/lore/coordinates.json

# Schema imports generated coordinates
import coordinates from './coordinates.json';
```

### Option B: Runtime Inference

```typescript
// In WorldEngine initialization
const coordinates = await Cosmographer.inferFromSchema(penguinDomain);
const engine = new WorldEngine({ ...config, coordinateSpaces: coordinates });
```

## Subtype → Plane Mapping

The key insight is that **subtypes ARE semantic signals**. When a template creates:

```typescript
view.addEntity({ kind: 'faction', subtype: 'criminal_gang' })
```

The framework can:
1. Look up `criminal_gang` in the subtype→plane mapping
2. Find it maps to `outlaw` plane in `political` space
3. Place the entity there (or cascade if saturated)

This mapping is what Cosmographer generates:

```json
{
  "subtypeMappings": {
    "faction": {
      "colony_council": { "space": "political", "plane": "sovereign" },
      "fishing_guild": { "space": "political", "plane": "guild" },
      "criminal_gang": { "space": "political", "plane": "outlaw" }
    },
    "abilities": {
      "aurora_vision": { "space": "magical", "plane": "divine" },
      "ice_shaping": { "space": "magical", "plane": "elemental" }
    }
  }
}
```

## What Templates Do

With this system, templates become simpler:

```typescript
// OLD: Template specifies everything
const guild = view.addEntity({
  kind: 'faction',
  subtype: 'fishing_guild',
  coordinates: {
    political: { plane: 'guild', sector_x: 45, ... }  // Manual!
  }
});

// NEW: Template just specifies semantic info
const guild = view.addEntity({
  kind: 'faction',
  subtype: 'fishing_guild'  // Coordinates inferred from subtype!
});
```

## Benefits

1. **Less configuration** - Domain author just defines entity kinds and subtypes
2. **Semantic consistency** - Plane assignment follows ontology rules
3. **Automatic saturation** - When "guild" plane fills, new guilds cascade to "outlaw"
4. **Cross-domain queries** - Find all entities near a coordinate across spaces
