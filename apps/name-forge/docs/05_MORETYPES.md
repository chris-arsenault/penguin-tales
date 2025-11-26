Argonian-style names fit cleanly, but they do push you toward one more primitive:
**“phrase/grammar-based strategies”** on top of phonotactics.

I’ll show:

1. How to do Argonian “Walks-in-Shadows” in your existing framework.
2. What extra primitive you actually need.
3. Other naming styles that fall outside “single phonotactic word” and how to support them.

---

## 1. Argonian-style names in the framework

Elder Scrolls Argonians basically have two tracks:

* “Normal” names like *Jaree-Ra* → standard phonotactic domain.
* “Histy” phrase names like *Walks-in-Shadows*, *Runs-From-Trouble* → descriptive English-ish micro-phrases, hyphen-separated.

The second track is just a **templated phrase strategy** with lexeme lists.

### 1.1 Argonian personal profile

```jsonc
{
  "id": "argonian:person",
  "cultureId": "argonian",
  "type": "person",
  "baseDomainIds": ["argonian_phonotactic"],
  "strategies": [
    {
      "id": "short_phonotactic",
      "kind": "phonotactic",
      "weight": 0.4,
      "domainId": "argonian_phonotactic"
    },
    {
      "id": "phrase_name",
      "kind": "templated",
      "weight": 0.6,
      "template": "{{verb}}-{{prep}}-{{object}}",
      "slots": {
        "verb":   { "kind": "lexemeList", "listId": "argo_verbs_3sg" },
        "prep":   { "kind": "lexemeList", "listId": "argo_preps" },
        "object": { "kind": "lexemeList", "listId": "argo_objects" }
      }
    }
  ]
}
```

Example lexeme lists:

* `argo_verbs_3sg`: `["Walks", "Sleeps", "Hides", "Runs", "Stands", "Waits"]`
* `argo_preps`: `["-in", "-under", "-through", "from", "along"]`
* `argo_objects`: `["Shadows", "Mud", "Reeds", "Water", "Ash", "Storms"]`

The framework’s template engine only needs to:

* concatenate slot outputs
* preserve punctuation (hyphens) literally

No Argonian-specific code required.

If you want the verb to agree (e.g., “Runs-From-Trouble” vs “Run-From-Trouble”), that’s a lexeme list issue, not an engine issue: you just store the inflected forms in `argo_verbs_3sg`.

---

## 2. What primitive you actually need to add

Right now your strategies assumed:

* “phonotactic word”
* “simple template with sub-generators/lexeme lists”
* “derived from other entity name”

To comfortably handle Argonian phrase names and similar weirdness, the only real upgrade is:

### 2.1 A small “grammar slot” primitive

Extend `SlotConfig` beyond just lists and subgenerators to allow **micro-grammars**:

```ts
type SlotKind =
  | "phonotactic"
  | "lexemeList"
  | "subGenerator"
  | "entityName"
  | "grammar"; // NEW
```

```ts
interface GrammarSlotConfig {
  kind: "grammar";
  grammarId: string;   // references a mini CFG or pattern
}
```

Example: a grammar for “verb-prep-object” phrase could be:

```ts
interface GrammarRule {
  id: string;
  pattern: string; // "V P O"
  symbolSources: { [symbol: string]: SlotConfig }; // V,P,O each map to lexeme lists or phonotactic calls
}
```

Then:

```jsonc
{
  "id": "argonian_phrase_grammar",
  "pattern": "V-P-O",
  "symbolSources": {
    "V": { "kind": "lexemeList", "listId": "argo_verbs_3sg" },
    "P": { "kind": "lexemeList", "listId": "argo_preps" },
    "O": { "kind": "lexemeList", "listId": "argo_objects" }
  }
}
```

And your profile would say:

```jsonc
{
  "id": "phrase_name",
  "kind": "templated",
  "weight": 0.6,
  "template": "{{phrase}}",
  "slots": {
    "phrase": { "kind": "grammar", "grammarId": "argonian_phrase_grammar" }
  }
}
```

The engine doesn’t need to understand “verbs” or “objects” — it just expands symbols using configured sources.

You can reuse the same primitive for all kinds of “phrase-with-hyphens” or “tiny clauses”.

---

## 3. Other naming styles you probably want to handle

These are patterns that either:

* are outright phrases; or
* combine multiple “name” worlds; or
* use non-alphabetic structure as meaning.

All of them can be expressed as combinations of:

* phonotactic slots
* lexeme lists
* grammar slots
* derived-entity slots
* templates

### 3.1 “X of Y” and “The X Y” ritual phrases

Common for:

* spells: *Hand of Radiant Silence*
* swords: *Blade of the First Dawn*
* religious orders: *The Silent Choir*

Template + slots is enough:

```jsonc
{
  "template": "{{core}} of {{domain}}",
  "slots": {
    "core":   { "kind": "phonotactic", "domainId": "elf_arcane" },
    "domain": { "kind": "lexemeList", "listId": "cosmic_concepts" }
  }
}
```

### 3.2 Binary names: formal + nickname

Example styles:

* *Ser Calvest Harrow, “Mud-Lark”*
* *Unit 7Q-19 “Basilisk”*

Strategy type: **compound/templated**:

```jsonc
{
  "template": "{{formal}}, \"{{nickname}}\"",
  "slots": {
    "formal":   { "kind": "subGenerator", "profile": "imperial:person" },
    "nickname": { "kind": "templated", "template": "{{noun}}", "slots": { "noun": { "kind": "lexemeList", "listId": "animal_nouns" } } }
  }
}
```

The engine just does nested generation.

### 3.3 Serial / numeric names

For:

* AI cores: *Node 7B-13*
* mass-manufactured drones: *MK-IV-221*
* bureaucratic laws: *Edict 12.432-B*

You can treat numbers/alphanumerics as lexemes or grammar symbols:

```jsonc
{
  "template": "MK-{{roman}}-{{serial}}",
  "slots": {
    "roman":  { "kind": "lexemeList", "listId": "roman_numerals" },
    "serial": { "kind": "lexemeList", "listId": "three_digit_strings" }
  }
}
```

If you want sequential allocation (not random), that’s a **different system** (ID allocator) that the template just formats.

### 3.4 Patronymics / matronymics / clan strings

Examples:

* *Han Li* (given + family)
* *Olav Gunnarson* (given + “son of Gunnar”)
* *Sera of the Red Lattice*

These are just templates referencing **other entities** or lexeme lists:

```jsonc
{
  "template": "{{given}} {{family}}",
  "slots": {
    "given":  { "kind": "phonotactic", "domainId": "nordic_given" },
    "family": { "kind": "lexemeList", "listId": "nordic_family_roots" }
  }
}
```

or

```jsonc
{
  "template": "{{given}} of {{clan}}",
  "slots": {
    "given": { "kind": "phonotactic", "domainId": "desert_given" },
    "clan":  { "kind": "entityNameFromSelector", "sourceType": "faction", "sourceSelector": { "tags": ["clan"], "cultureId": "desert_nomad" } }
  }
}
```

### 3.5 Kennings / stacked metaphors

Example: Norse-style artifact names or titles:

* *Storm-Eater*
* *Wolf’s-Bane*
* *Sky-Splitter*

Again, exactly the same as Argonian hyphen phrases:

```jsonc
{
  "template": "{{noun1}}-{{noun2}}",
  "slots": {
    "noun1": { "kind": "lexemeList", "listId": "natural_forces" },
    "noun2": { "kind": "lexemeList", "listId": "predatory_nouns" }
  }
}
```

You can also plug in phonotactic words for non-English flavors.

### 3.6 Legalistic / bureaucratic long titles

Things like:

* *The Third Emergency Measures Act of the Southern Prefectures*
* *Resolution 17 Concerning the Handling of Unregistered Thaumic Devices*

This is where the **grammar slot** shines: you create a small grammar for “legalistic English” and call it.

Or keep it as a single template with multiple lexeme lists:

```jsonc
{
  "template": "The {{ordinal}} {{topic}} Act of the {{region}}",
  "slots": {
    "ordinal": { "kind": "lexemeList", "listId": "ordinals" },
    "topic":   { "kind": "lexemeList", "listId": "law_topic_phrases" },
    "region":  { "kind": "entityNameFromSelector", "sourceType": "location.synthetic", "sourceSelector": { "tags": ["administrative_region"] } }
  }
}
```

### 3.7 “True name” vs “use name”

If some species has:

* a phonotactic **true name**
* a phrase or epithet **use name**

You just define:

* `culture:person:true` profile → pure phonotactic.
* `culture:person:use` profile → templated/phrase.

And store both on the entity. Same engine, just two profiles.

---

## 4. Does anything really fall outside?

The patterns you’ve got, plus the **grammar slot**, cover basically everything I’ve seen in games and SFF:

* Single words (phonotactic domains)
* Multi-word phrases (templates)
* Hyphen chains (templates or grammars)
* Derived names (battles, laws, dynasties)
* Mixed human-readable + coded parts (IDs, ship classes)
* Multi-name constructs (formal + nickname, title + name)

The framework doesn’t need to know “Argonian” or “Norse” or “bureaucratic” — it only needs:

* phonotactic generators
* lexeme lists
* grammar slots (tiny CFGs)
* entity-derived slots
* template composition

Everything else stays in config.

If you want, I can sketch a concrete TypeScript definition for `SlotConfig`/`GrammarRule` that can express Argonian hyphen names, bureaucratic edicts, kennings, and binary names without adding new engine code for each.
