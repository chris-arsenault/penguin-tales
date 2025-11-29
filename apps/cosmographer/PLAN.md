# Cosmographer Implementation Plan

**Purpose:** Visual world-building tool for creating initial world seeds. Outputs JSON configuration consumed by lore-weave for procedural world generation.

## Core Concepts

### What Cosmographer Does
1. Define world schema (entity kinds, subtypes, statuses, relationship types)
2. Define cultures with their characteristics
3. Define semantic planes per entity kind (what x/y/z axes mean, regions)
4. Place seed entities on their semantic planes with visual editor
5. Define seed relationships between entities
6. Export complete world seed as JSON

### What Cosmographer Does NOT Do
- Run simulations (that's lore-weave)
- Generate names (that's name-forge, may integrate later)
- Procedurally create entities (outputs seed data only)

## Data Model

### Project Structure
```typescript
interface CosmographerProject {
  id: string;
  name: string;
  version: string;  // Schema version for migrations
  createdAt: string;
  updatedAt: string;

  worldSchema: WorldSchema;
  cultures: Culture[];
  semanticPlanes: SemanticPlane[];
  seedEntities: SeedEntity[];
  seedRelationships: SeedRelationship[];
}
```

### World Schema
```typescript
interface WorldSchema {
  entityKinds: EntityKindDefinition[];
  relationshipKinds: RelationshipKindDefinition[];
}

interface EntityKindDefinition {
  id: string;           // e.g., 'npc', 'location', 'faction'
  name: string;         // Display name
  subtypes: SubtypeDefinition[];
  statuses: StatusDefinition[];
  prominenceLevels?: string[];  // Override default prominence scale
}

interface SubtypeDefinition {
  id: string;
  name: string;
  description?: string;
  defaultStatus?: string;
}

interface StatusDefinition {
  id: string;
  name: string;
  isTerminal?: boolean;  // Entity won't change from this status
}

interface RelationshipKindDefinition {
  id: string;
  name: string;
  description?: string;
  srcKinds?: string[];   // Allowed source entity kinds (empty = any)
  dstKinds?: string[];   // Allowed destination entity kinds
  symmetric?: boolean;   // A->B implies B->A
}
```

### Cultures
```typescript
interface Culture {
  id: string;
  name: string;
  description?: string;
  color: string;         // For UI visualization

  // Bias values for semantic placement (0-100 per axis)
  axisBiases: Record<string, number>;

  // Which regions this culture originates from (per entity kind)
  homeRegions: Record<string, string[]>;  // entityKind -> regionIds
}
```

### Semantic Planes
```typescript
interface SemanticPlane {
  entityKind: string;    // Which entity kind this plane is for
  name: string;

  axes: {
    x: AxisDefinition;
    y: AxisDefinition;
    z?: AxisDefinition;  // Optional third dimension
  };

  bounds: {
    x: { min: number; max: number };
    y: { min: number; max: number };
    z?: { min: number; max: number };
  };

  regions: Region[];
}

interface AxisDefinition {
  name: string;          // e.g., 'Order', 'Elevation', 'Influence'
  lowLabel: string;      // Label for low end (e.g., 'Chaotic')
  highLabel: string;     // Label for high end (e.g., 'Lawful')
}

interface Region {
  id: string;
  label: string;
  description?: string;
  color?: string;

  bounds: CircleBounds | RectBounds;
  zRange?: { min: number; max: number };

  autoTags?: string[];   // Tags applied to entities in this region
}

interface CircleBounds {
  shape: 'circle';
  center: { x: number; y: number };
  radius: number;
}

interface RectBounds {
  shape: 'rect';
  x1: number; y1: number;
  x2: number; y2: number;
}
```

### Seed Entities
```typescript
interface SeedEntity {
  id: string;
  kind: string;
  subtype: string;

  name: string;
  description?: string;

  status: string;
  prominence: string;
  culture?: string;

  tags: string[];

  coordinates: {
    x: number;
    y: number;
    z?: number;
  };
}
```

### Seed Relationships
```typescript
interface SeedRelationship {
  id: string;
  kind: string;
  srcId: string;
  dstId: string;
  strength?: number;     // 0-1
  metadata?: Record<string, unknown>;
}
```

## UI Architecture

### Technology Stack
- **Framework:** React (same as name-forge)
- **Build:** Vite
- **Storage:** IndexedDB (same pattern as name-forge)
- **Styling:** CSS-in-JS (inline styles, same as name-forge)
- **Canvas:** HTML5 Canvas or SVG for semantic plane visualization

### Main Views

#### 1. Project Manager
- List saved projects
- Create/delete/duplicate projects
- Import/export JSON files
- Same pattern as name-forge

#### 2. Schema Editor
- Define entity kinds with subtypes and statuses
- Define relationship kinds with constraints
- Tabbed interface per entity kind

#### 3. Culture Editor
- Define cultures with names, descriptions, colors
- Set axis biases per culture
- Assign home regions per entity kind

#### 4. Semantic Plane Editor (Core Feature)
- **Plane selector:** Dropdown to pick entity kind's plane
- **Canvas:** 2D visualization of the semantic plane
  - Regions shown as colored shapes
  - Entities shown as icons/dots colored by culture
  - Axes labeled on edges
  - Grid overlay option
- **Entity palette:** List of seed entities, drag to place
- **Region tools:** Draw/edit regions on canvas
- **Entity inspector:** Click entity to edit properties
- **Relationship mode:** Draw lines between entities to create relationships

#### 5. Relationship Matrix
- Table view showing all relationships
- Filter by kind, source, destination
- Bulk operations

#### 6. Export View
- Preview JSON output
- Validation warnings
- Download button

### Component Structure
```
src/
├── App.jsx
├── storage/
│   ├── db.js              # IndexedDB operations
│   └── useProjectStorage.js
├── components/
│   ├── ProjectManager.jsx
│   ├── SchemaEditor/
│   │   ├── EntityKindEditor.jsx
│   │   ├── SubtypeEditor.jsx
│   │   ├── StatusEditor.jsx
│   │   └── RelationshipKindEditor.jsx
│   ├── CultureEditor/
│   │   ├── CultureList.jsx
│   │   ├── CultureForm.jsx
│   │   └── AxisBiasSliders.jsx
│   ├── SemanticPlane/
│   │   ├── PlaneCanvas.jsx
│   │   ├── RegionDrawer.jsx
│   │   ├── EntityPlacer.jsx
│   │   ├── RelationshipDrawer.jsx
│   │   └── PlaneControls.jsx
│   ├── EntityEditor/
│   │   ├── EntityList.jsx
│   │   ├── EntityForm.jsx
│   │   └── EntityInspector.jsx
│   ├── RelationshipEditor/
│   │   ├── RelationshipMatrix.jsx
│   │   └── RelationshipForm.jsx
│   └── common/
│       ├── Accordion.jsx
│       ├── Modal.jsx
│       ├── ColorPicker.jsx
│       └── RangeSlider.jsx
├── types/
│   └── schema.ts          # Zod schemas + TypeScript types
└── utils/
    ├── export.js          # JSON export formatting
    ├── validation.js      # Project validation
    └── geometry.js        # Region/point math
```

## Implementation Phases

### Phase 1: Project Infrastructure
- [ ] Create apps/cosmographer directory structure
- [ ] Set up Vite + React build
- [ ] Implement IndexedDB storage (copy pattern from name-forge)
- [ ] Implement ProjectManager component
- [ ] Basic App shell with navigation

### Phase 2: Schema Editor
- [ ] EntityKindEditor with subtype/status management
- [ ] RelationshipKindEditor with constraints
- [ ] Zod validation schemas
- [ ] Schema preview/summary view

### Phase 3: Culture Editor
- [ ] CultureList with CRUD operations
- [ ] CultureForm with color picker
- [ ] AxisBiasSliders component
- [ ] Home region assignment UI

### Phase 4: Semantic Plane Visualization
- [ ] PlaneCanvas with pan/zoom
- [ ] Axis labels and grid
- [ ] Region rendering (circles, rectangles)
- [ ] Entity rendering with culture colors

### Phase 5: Region Editor
- [ ] Region drawing tools (circle, rectangle)
- [ ] Region selection and editing
- [ ] Region property inspector
- [ ] Z-range editor for 3D regions

### Phase 6: Entity Placement
- [ ] Entity palette/list
- [ ] Drag-and-drop placement on canvas
- [ ] Entity inspector panel
- [ ] Snap-to-region option

### Phase 7: Relationship Editor
- [ ] Visual relationship drawing mode
- [ ] Relationship matrix view
- [ ] Relationship validation

### Phase 8: Export & Polish
- [ ] JSON export with validation
- [ ] Export preview
- [ ] Default project template
- [ ] Documentation

## Shared Code with Name-Forge

### Can Reuse Directly
- IndexedDB storage pattern (`db.js`, `useProjectStorage.js`)
- UI components: Accordion, Modal
- Project manager pattern
- Build configuration (Vite setup)

### Similar but Different
- Project schema structure (different fields, same storage pattern)
- Culture concept (name-forge has naming domains, cosmographer has semantic biases)

### Future Integration Points
- Cosmographer could embed name-forge culture config
- Combined project format containing both world seed + naming rules
- Shared culture IDs across both tools

## Output Format

The exported JSON should be clean and self-documenting:

```json
{
  "$schema": "https://penguin-tales.dev/schemas/world-seed-v1.json",
  "version": "1.0",
  "name": "My World",
  "exportedAt": "2025-11-28T12:00:00Z",

  "schema": {
    "entityKinds": [...],
    "relationshipKinds": [...]
  },

  "cultures": [...],

  "semanticPlanes": [...],

  "seed": {
    "entities": [...],
    "relationships": [...]
  }
}
```

## Open Questions

1. **3D visualization:** Should semantic planes with Z-axis have 3D view, or just show Z as color/size?
2. **Templates:** Should we include starter templates (fantasy, sci-fi, etc.)?
3. **Validation strictness:** Fail on invalid references or warn only?
4. **Name-forge integration:** Embed naming config now or defer?
