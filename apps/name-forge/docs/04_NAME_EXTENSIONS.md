You’re fine. The framework as sketched *can* handle all of that without hard-coding “elves vs orcs” rules into the core — you just need one more layer of abstraction:

* **Domains** = phonotactics + morphology + style (what we already have)
* **NameTypes** = person, location.natural, location.synthetic, spell, technique, battle, law, etc.
* **NamingStrategies** = “how to build this type of name from one or more domains and/or existing entities”

The framework knows about **domains, types, and strategy primitives**.
Only your data/config knows “elves name battles after generals; orks after locations; some laws get weird proper names like *The Constitution*.”

Below is how to structure it so:

* core logic stays generic
* all your cultural specifics live in config
* derivative vs non-derivative names are just weighted strategies.

---

## 1. Core: keep the engine generic

Have a single generic API:

```ts
generateName({
  cultureId,     // e.g. "elf_high", "ork_mire", "imperial"
  type,          // "person", "location.natural", "location.synthetic",
                 // "spell", "technique", "battle", "law"
  tags,          // ["archaic", "holy", "naval", ...]
  context        // access to KG for picking people/places if needed
}): string
```

The engine does only:

1. Resolve `(cultureId, type, tags)` → a **NamingProfile**.
2. Pick a **NamingStrategy** from that profile, by weight.
3. Execute that strategy using generic building blocks:

    * phonotactic domain generators
    * templates
    * “derive from other entity’s name” helpers

No knowledge of elves, orks, or constitutions lives in the engine.

---

## 2. New layer: NamingProfile & NamingStrategy

### 2.1 NamingProfile

For each culture + type, you define a profile:

```ts
interface NamingProfile {
  id: string;             // "elf_high:person", "elf_high:battle", ...
  cultureId: string;
  type: string;           // "person", "battle", "law", etc.

  // Base domains that strategy primitives can call
  baseDomainIds: string[]; // phonotactic domains: "elf_personal", "elf_toponymic"

  // Strategies for this type
  strategies: NamingStrategy[];
}
```

### 2.2 Generic strategy primitives

You only need a small set of **strategy kinds**:

```ts
type StrategyKind =
  | "phonotactic"        // just call a phonology domain
  | "derivedFromEntity"  // transform an existing entity name
  | "templated"          // plug subnames into a text template
  | "compound"           // combine multiple generated parts
  | "alias"              // redirect to another profile
```

```ts
interface NamingStrategyBase {
  id: string;
  weight: number;        // for weighted random choice
  kind: StrategyKind;
}

// Example shapes

interface PhonotacticStrategy extends NamingStrategyBase {
  kind: "phonotactic";
  domainId: string;            // which phonotactic domain to use
}

interface DerivedFromEntityStrategy extends NamingStrategyBase {
  kind: "derivedFromEntity";
  sourceType: string;          // "person", "location", etc.
  sourceSelector: EntitySelectorConfig;
  transform: TransformConfig;  // e.g. add "Battle of {{name}}", or shorten, etc
}

interface TemplatedStrategy extends NamingStrategyBase {
  kind: "templated";
  template: string;            // e.g. "The {{core}} Accord"
  slots: { [slot: string]: SlotConfig };  // how to fill {{core}}, etc
}
```

The **framework** only knows how to:

* resolve a domain and generate a base name (phonotactic)
* query the KG for a reference entity according to `EntitySelectorConfig`
* apply templates and transforms

Everything else (who names what after whom, which template text, what transforms) is data.

---

## 3. How each type fits in (no domain-specific code)

### 3.1 Person names

Usually pure phonotactic:

```jsonc
{
  "id": "elf_high:person",
  "cultureId": "elf_high",
  "type": "person",
  "baseDomainIds": ["elf_personal"],
  "strategies": [
    { "id": "phonotactic_core", "kind": "phonotactic", "weight": 0.8, "domainId": "elf_personal" },
    {
      "id": "epithet",
      "kind": "templated",
      "weight": 0.2,
      "template": "{{core}} the {{epithet}}",
      "slots": {
        "core": { "kind": "subGenerator", "profile": "elf_high:person", "strategy": "phonotactic_core" },
        "epithet": { "kind": "lexemeList", "listId": "elf_epithets" }
      }
    }
  ]
}
```

Framework view: “generate from domain, sometimes add an epithet”.
Zero culture-specific code.

---

### 3.2 Location names (natural vs synthetic)

You treat them as separate `type` or `subType` via tags.

Example: *natural landscape*:

```jsonc
{
  "id": "elf_high:location.natural",
  "cultureId": "elf_high",
  "type": "location.natural",
  "baseDomainIds": ["elf_toponymic"],
  "strategies": [
    { "id": "base_toponym", "kind": "phonotactic", "weight": 0.7, "domainId": "elf_toponymic" },
    {
      "id": "descriptive",
      "kind": "templated",
      "weight": 0.3,
      "template": "{{core}} {{descriptor}}",
      "slots": {
        "core": { "kind": "subGenerator", "profile": "elf_high:location.natural", "strategy": "base_toponym" },
        "descriptor": { "kind": "lexemeList", "listId": "elf_nature_descriptors" }
      }
    }
  ]
}
```

Synthetic locations (fortresses, stations) can share phonotactics but different templates.

---

### 3.3 Spells / combat techniques

Here you often want **semantic hints** plus phonotactic flavor.

Example: elven spell names:

```jsonc
{
  "id": "elf_high:spell",
  "cultureId": "elf_high",
  "type": "spell",
  "baseDomainIds": ["elf_personal"], // reuse phonotactics
  "strategies": [
    {
      "id": "spellish",
      "kind": "templated",
      "weight": 0.7,
      "template": "{{core}} of {{effect}}",
      "slots": {
        "core": { "kind": "phonotactic", "domainId": "elf_personal" },
        "effect": { "kind": "lexemeList", "listId": "spell_effect_nouns" }
      }
    },
    {
      "id": "pure_arcane",
      "kind": "phonotactic",
      "weight": 0.3,
      "domainId": "elf_arcane" // more exotic phonotactics
    }
  ]
}
```

Framework doesn’t need to know what a “spell” is; it just applies a template and subgenerators.

---

### 3.4 Battles

Here is where your “elves name battles after generals, orks after locations, sometimes not derivative” fits nicely as **weighted strategies**.

#### Elven battle names

```jsonc
{
  "id": "elf_high:battle",
  "cultureId": "elf_high",
  "type": "battle",
  "baseDomainIds": ["elf_toponymic"],
  "strategies": [
    {
      "id": "named_after_general",
      "kind": "derivedFromEntity",
      "weight": 0.5,
      "sourceType": "person",
      "sourceSelector": { "tags": ["general"], "cultureId": "elf_high" },
      "transform": {
        "kind": "templated",
        "template": "The Battle of {{name}}",
        "slots": {
          "name": { "kind": "entityName" }
        }
      }
    },
    {
      "id": "named_after_location",
      "kind": "derivedFromEntity",
      "weight": 0.3,
      "sourceType": "location.natural",
      "sourceSelector": { "nearbyToBattlefield": true },
      "transform": {
        "kind": "templated",
        "template": "The {{name}} Campaign",
        "slots": { "name": { "kind": "entityName" } }
      }
    },
    {
      "id": "non_derivative",
      "kind": "templated",
      "weight": 0.2,
      "template": "The {{core}}",
      "slots": {
        "core": { "kind": "lexemeList", "listId": "elf_battle_abstracts" }
      }
    }
  ]
}
```

The **framework**:

* Queries for a `person` or `location` by selector when asked.
* Plugs their existing names into a template.

It doesn’t know what “general” means; that’s just a tag in your KG & selector config.

#### Orkish battle names

```jsonc
{
  "id": "ork_mire:battle",
  "cultureId": "ork_mire",
  "type": "battle",
  "baseDomainIds": ["ork_toponymic"],
  "strategies": [
    {
      "id": "named_after_location",
      "kind": "derivedFromEntity",
      "weight": 0.7,
      "sourceType": "location.synthetic",
      "sourceSelector": { "nearestStronghold": true },
      "transform": {
        "kind": "templated",
        "template": "{{name}} Smash",
        "slots": { "name": { "kind": "entityName" } }
      }
    },
    {
      "id": "brutal_epithet",
      "kind": "templated",
      "weight": 0.3,
      "template": "The {{adjective}} {{noun}}",
      "slots": {
        "adjective": { "kind": "lexemeList", "listId": "ork_battle_adj" },
        "noun": { "kind": "lexemeList", "listId": "ork_battle_noun" }
      }
    }
  ]
}
```

Same framework, different config.

---

### 3.5 Laws / edicts / principles

Mix of **derived** and **abstract/unique** (“The Constitution”).

Example for an imperial human culture:

```jsonc
{
  "id": "imperial:law",
  "cultureId": "imperial",
  "type": "law",
  "baseDomainIds": ["imperial_personal"],
  "strategies": [
    {
      "id": "generic_act",
      "kind": "templated",
      "weight": 0.5,
      "template": "The {{topic}} Act",
      "slots": {
        "topic": { "kind": "lexemeList", "listId": "law_topics" }
      }
    },
    {
      "id": "eponymous",
      "kind": "derivedFromEntity",
      "weight": 0.3,
      "sourceType": "person",
      "sourceSelector": { "tags": ["legislator", "jurist"], "cultureId": "imperial" },
      "transform": {
        "kind": "templated",
        "template": "{{name}} v. {{otherName}}",
        "slots": {
          "name": { "kind": "entityName" },
          "otherName": {
            "kind": "entityNameFromSelector",
            "sourceType": "person",
            "sourceSelector": { "tags": ["opponent"], "cultureId": "imperial" }
          }
        }
      }
    },
    {
      "id": "foundational",
      "kind": "templated",
      "weight": 0.2,
      "template": "The {{core}}",
      "slots": {
        "core": { "kind": "lexemeList", "listId": "foundational_law_names" }
      }
    }
  ]
}
```

“The Constitution”, “The Compact”, etc. are just entries in `foundational_law_names`. Again, no special engine logic.

---

## 4. Handling “sometimes derivative, sometimes not”

This is just **strategy weights**:

* “elves name battles after generals, except when not” → `named_after_general` weight 0.5, non_derivative 0.2.
* “orks mostly name after places” → `named_after_location` weight 0.7, etc.
* “this particular empire has one canonical law with a unique name” → a seeded entity with a fixed `displayName`, no generator needed.

If you want, you can add more control:

* `strategyWeightModifiers` based on tags/time era (e.g., early empire uses more foundational names).

But the pattern remains: no hard-coded culture logic in the engine.

---

## 5. Implementation checkpoints

To keep the framework generic:

1. **Engine exports only generic primitives**:

    * `generateFromDomain(domainId)`
    * `generateFromTemplate(template, slots)`
    * `deriveFromEntity(selector, transform)`
    * `callSubProfile(profileId, strategyId?)`

2. **All cultural specifics** (which domains, which templates, which entities to derive from, what percentages) live in JSON/TS config.

3. **Validation & optimization** (from earlier) operate at the domain/profile level:

    * Phonotactic domains get tuned/validated.
    * Profiles/strategies are checked for capacity, diffuseness, semiotics.

You can then add new types — “ship class”, “religious order”, “holiday”, “industrial product” — without touching the engine, just by:

* adding a `type` string
* defining a `NamingProfile` for each culture+type
* referencing existing phonotactic domains and KG selectors.

If you want, next I can:

* Sketch a type-safe `NamingProfile` / `NamingStrategy` TypeScript schema.
* Show how `generateName()` would dispatch without any culture-specific branching.
