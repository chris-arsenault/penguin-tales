# Declarative Template Architecture

## Problem Statement

Current templates are TypeScript code with custom logic. The goal is:
- **No TypeScript code** in template definitions
- **JSON/YAML-composable** building blocks
- **UI-configurable** via DSL
- **Domain-agnostic** reusable patterns

## Proposed Solution

### 1. Declarative Template Schema

```typescript
interface DeclarativeTemplate {
  id: string;
  name: string;

  // Step 1: When should this template run?
  applicability: ApplicabilityRule[];

  // Step 2: What entities to act upon?
  selection: SelectionRule;

  // Step 3: What entities to create?
  creation: CreationRule[];

  // Step 4: What relationships to form?
  relationships: RelationshipRule[];

  // Step 5: What state updates to apply?
  stateUpdates: StateUpdateRule[];

  // Metadata for UI/introspection
  contract: TemplateContract;
  metadata: TemplateMetadata;
}
```

### 2. Applicability Rules (Composable)

```typescript
type ApplicabilityRule =
  | { type: 'pressure_threshold'; pressureId: string; min: number; max: number; extremeChance?: number }
  | { type: 'pressure_any_above'; pressureIds: string[]; threshold: number }
  | { type: 'entity_count_min'; kind: string; subtype?: string; min: number }
  | { type: 'entity_count_max'; kind: string; subtype?: string; max: number; overshoot?: number }
  | { type: 'era_match'; eras: string[] }
  | { type: 'random_chance'; chance: number }
  | { type: 'cooldown_elapsed'; cooldownTicks: number }
  | { type: 'has_expansion_opportunity'; factionKind: string }  // Domain-specific but declarative
  | { type: 'has_available_partners'; entityKind: string; relationshipKind: string }
  | { type: 'and'; rules: ApplicabilityRule[] }
  | { type: 'or'; rules: ApplicabilityRule[] };
```

### 3. Selection Rules

```typescript
type SelectionRule = {
  strategy: 'by_kind' | 'by_preference_order' | 'by_relationship' | 'by_proximity' | 'by_prominence';
  kind: string;
  subtypes?: string[];
  statusFilter?: string;

  // For by_relationship
  relationshipKind?: string;
  mustHave?: boolean;
  direction?: 'src' | 'dst' | 'both';

  // For by_proximity
  referenceEntity?: string;  // Variable reference like "$target"
  maxDistance?: number;

  // For by_preference_order
  subtypePreferences?: string[];

  // For by_prominence
  minProminence?: string;

  // Post-filters (applied after strategy)
  filters?: SelectionFilter[];

  // Result handling
  pickStrategy?: 'random' | 'first' | 'all';
  maxResults?: number;
};

type SelectionFilter =
  | { type: 'exclude_enemies'; ofEntity: string }  // "$target"
  | { type: 'has_relationship'; kind: string; direction: 'src' | 'dst' }
  | { type: 'lacks_relationship'; kind: string; with: string }  // e.g., "trades_with" with "$other"
  | { type: 'same_location'; as: string }
  | { type: 'custom'; id: string; params: Record<string, unknown> };  // Escape hatch for domain-specific
```

### 4. Creation Rules

```typescript
type CreationRule = {
  // What to create
  entityRef: string;  // Variable name like "$newFaction", "$child"
  kind: string;
  subtype: string | { fromPressure: Record<string, string> } | { inherit: string };

  // Attributes
  status?: string;
  prominence?: string;
  culture?: { inherit: string } | { fixed: string };
  description?: string | { template: string; replacements: Record<string, string> };
  tags?: Record<string, boolean>;

  // Placement
  placement:
    | { type: 'near_entity'; entity: string; maxDistance?: number }
    | { type: 'in_culture_region'; culture: string }
    | { type: 'at_location'; location: string }
    | { type: 'random_in_bounds'; bounds?: { x: [number, number]; y: [number, number] } };

  // Count (for batch creation)
  count?: number | { min: number; max: number };

  // Lineage (optional)
  lineage?: {
    kind: string;  // Relationship kind like "inspired_by", "derived_from"
    to: string;    // Entity reference like "$existingSimilar"
    distanceRange: { min: number; max: number };
  };
};
```

### 5. Relationship Rules

```typescript
type RelationshipRule = {
  kind: string;
  src: string;  // Entity reference: "$newEntity", "$target", "$faction.leader"
  dst: string;  // Entity reference

  // Relationship attributes
  strength?: number;
  distance?: number | { min: number; max: number };

  // Special behaviors
  bidirectional?: boolean;
  catalyzedBy?: string;  // Entity reference

  // Conditional creation
  condition?: {
    type: 'random_chance';
    chance: number;
  } | {
    type: 'entity_has_relationship';
    entity: string;
    relationshipKind: string;
  };
};
```

### 6. State Update Rules

```typescript
type StateUpdateRule =
  | { type: 'update_discovery_state' }
  | { type: 'archive_relationship'; entity: string; relationshipKind: string; with: string }
  | { type: 'modify_pressure'; pressureId: string; delta: number }
  | { type: 'update_entity_status'; entity: string; newStatus: string };
```

---

## Example: Trade Route Establishment (Declarative)

```json
{
  "id": "trade_route_establishment",
  "name": "Trade Route Establishment",

  "applicability": [
    { "type": "entity_count_min", "kind": "faction", "min": 2 },
    { "type": "has_available_partners", "entityKind": "faction", "relationshipKind": "trades_with" }
  ],

  "selection": {
    "strategy": "by_kind",
    "kind": "faction",
    "filters": [
      { "type": "has_available_trade_partners" }
    ],
    "pickStrategy": "random"
  },

  "creation": [],

  "relationships": [
    {
      "kind": "trades_with",
      "src": "$target",
      "dst": "$partner",
      "strength": 0.6,
      "bidirectional": true,
      "catalyzedBy": "$catalyst"
    }
  ],

  "stateUpdates": [],

  "variables": {
    "$partner": {
      "select": {
        "strategy": "by_kind",
        "kind": "faction",
        "filters": [
          { "type": "not_same", "as": "$target" },
          { "type": "lacks_relationship", "kind": "trades_with", "with": "$target" },
          { "type": "lacks_relationship", "kind": "at_war_with", "with": "$target" }
        ],
        "preferFilters": [
          { "type": "has_relationship", "kind": "allied_with", "with": "$target" }
        ],
        "pickStrategy": "random"
      }
    },
    "$catalyst": {
      "select": {
        "strategy": "by_preference_order",
        "from": { "related_to": "$target", "relationship": "member_of", "direction": "dst" },
        "subtypePreferences": ["merchant", "leader"],
        "fallback": "$target"
      }
    }
  }
}
```

---

## Example: Family Expansion (Declarative)

```json
{
  "id": "family_expansion",
  "name": "Family Growth",

  "applicability": [
    { "type": "entity_count_min", "kind": "npc", "subtype": null, "status": "alive", "min": 2 }
  ],

  "selection": {
    "strategy": "by_kind",
    "kind": "npc",
    "statusFilter": "alive",
    "filters": [
      { "type": "has_relationship", "kind": "resident_of", "direction": "src" },
      { "type": "colony_has_min_residents", "min": 2 }
    ],
    "pickStrategy": "random"
  },

  "creation": [
    {
      "entityRef": "$child",
      "kind": "npc",
      "subtype": { "inherit": "$target", "chance": 0.7, "fallback": "random" },
      "status": "alive",
      "prominence": "marginal",
      "culture": { "inherit": "$target" },
      "description": { "template": "Child of {parent}, raised in {colony}", "replacements": { "parent": "$target.name", "colony": "$colony.name" } },
      "tags": { "second_generation": true },
      "placement": { "type": "near_entity", "entity": "$target", "maxDistance": 5 },
      "count": { "min": 1, "max": 3 }
    }
  ],

  "relationships": [
    { "kind": "mentor_of", "src": "$target", "dst": "$child" },
    { "kind": "resident_of", "src": "$child", "dst": "$colony" },
    {
      "kind": "member_of",
      "src": "$child",
      "dst": "$parentFaction",
      "condition": { "type": "random_chance", "chance": 0.5 }
    }
  ],

  "variables": {
    "$colony": {
      "select": {
        "from": { "related_to": "$target", "relationship": "resident_of", "direction": "src" },
        "pickStrategy": "first"
      }
    },
    "$parentFaction": {
      "select": {
        "from": { "related_to": "$target", "relationship": "member_of", "direction": "src" },
        "pickStrategy": "first"
      }
    }
  }
}
```

---

## Architecture Changes Required

### 1. Template Interpreter (Framework)

```typescript
// apps/lore-weave/lib/engine/templateInterpreter.ts

export class TemplateInterpreter {
  interpret(template: DeclarativeTemplate, graphView: TemplateGraphView): TemplateResult {
    // 1. Check applicability
    if (!this.evaluateApplicability(template.applicability, graphView)) {
      return emptyResult('Applicability check failed');
    }

    // 2. Select target
    const context = new ExecutionContext(graphView);
    const target = this.executeSelection(template.selection, context);
    if (!target) {
      return emptyResult('No valid target');
    }
    context.set('$target', target);

    // 3. Resolve variables
    for (const [name, def] of Object.entries(template.variables || {})) {
      context.set(name, this.resolveVariable(def, context));
    }

    // 4. Create entities
    const entities = this.executeCreation(template.creation, context);

    // 5. Create relationships
    const relationships = this.executeRelationships(template.relationships, context);

    // 6. Apply state updates
    this.executeStateUpdates(template.stateUpdates, context);

    return templateResult(entities, relationships, template.name);
  }
}
```

### 2. Domain Template Registry

Templates become JSON files in the domain:
```
penguin-tales/lore/templates/
  faction/
    tradeRouteEstablishment.json
    territorialExpansion.json
  npc/
    familyExpansion.json
    heroEmergence.json
```

### 3. Custom Filters/Actions (Escape Hatch)

For truly domain-specific logic that can't be declarative:

```typescript
// penguin-tales/lore/customFilters.ts
export const penguinFilters: Record<string, FilterFunction> = {
  'has_available_trade_partners': (entity, context) => {
    // Domain-specific logic
  },
  'colony_has_min_residents': (entity, context, params) => {
    // Domain-specific logic
  }
};
```

These are registered with the interpreter and referenced by ID in JSON.

---

## Migration Path

1. **Phase 1**: Create template interpreter in framework
2. **Phase 2**: Define declarative schema types
3. **Phase 3**: Create custom filter registry pattern
4. **Phase 4**: Convert simple templates (relationship-only like tradeRouteEstablishment)
5. **Phase 5**: Convert complex templates (with entity creation)
6. **Phase 6**: Build UI for template editing

---

## Benefits

1. **No TypeScript in templates** - Domain authors write JSON
2. **Composable** - Rules combine declaratively
3. **UI-friendly** - JSON maps directly to form fields
4. **Validated** - Schema can be validated at load time
5. **Portable** - Templates work across domains
6. **Versionable** - JSON diffs are clean
