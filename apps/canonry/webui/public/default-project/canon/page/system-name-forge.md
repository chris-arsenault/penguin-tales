# Name Forge

*Because "Character_7842" doesn't have the same ring as "Voraelin (frost-touched) kria'Spire".*

---

## The Problem

Procedurally generated content needs names. Lots of names. Names for characters, factions, locations, artifacts, events. And they can't just be random syllables - they need to *feel* right for their culture.

A name is a promise. "Kzul-threk-vor" promises something very different from "...tenebris~". Get the names wrong and the whole world feels fake, no matter how good the underlying generation is.

---

## The Solution

Name Forge is a domain-aware naming system. You define naming rules for each culture - phoneme inventories, syllable patterns, grammatical structures, forbidden combinations - and it generates names that follow those rules.

The result: every entity gets a name appropriate to its culture, and names across a culture share recognizable patterns that make the culture feel cohesive.

---

## Culture Profiles

Each culture has a naming profile that defines:

### Phoneme Inventory
What sounds can appear? Aurora favors soft consonants (s, l, r, k, n, m) and rich vowels (ae, ei, ue). Orca demands hard consonants (k, g, r, th, ng, z) and minimal vowels. Nightshelf sits between - liquid sounds, sibilants, Latin-influenced fragments.

### Syllable Patterns
How do sounds combine? Aurora allows flowing CVCV patterns. Orca requires consonant clusters (kr, gr, th, ng) that make names sound harsh. Nightshelf permits partial syllables that trail off.

### Grammatical Structures
How are names composed? Aurora uses parenthetical echoes: `Name (ice-memory)`. Nightshelf uses truncation: `...name` or `name~`. Orca uses deed-chains: `kill-method-territory`.

### Forbidden Patterns
What combinations are banned? Orca names cannot contain soft sounds. Aurora names avoid harsh stops. These constraints give each culture its distinctive sound.

---

## The Three Grammars

### Aurora: Parenthetical Echoes

```
Simple:     Selka (dawn-found)
With clan:  Voraesueina (frost-written) kria'Spire
Layered:    Skailaen (twice-blessed, light-bearer, echo: Skai)
```

The parenthetical content represents what the ice remembers about this entity. More echoes = more history = more significance. The clan marker (kria', rukar', val') indicates lineage.

### Nightshelf: Incomplete Names

```
Moon-prefix:        ☽'varius (beginning consumed)
Moon-suffix:        Umbra☽ (ending fades)
Internal elision:   Dusk∴glide (syllables swallowed)
Whisper-form:       Tenebris~ (trails to silence)
Combined:           ☽'shadow Xarem~ (prefix + trailing)
```

Nightshelf names are never complete. The crescent moon `☽` marks truncation (prefix or suffix), the `∴` marks internal elision, and `~` indicates fading to whisper. The system also supports true word truncation via `~chopL` and `~chopR` modifiers that actually remove characters from generated words.

### Orca: Deed-Chains

```
Young:    Kzul-rend
Mature:   Kzul-threk-rend-vor
Elder:    Deep-kzul-threk-pngk-rend-vor-grrul
```

Orca names are their kill-records. Each segment represents a type of prey and/or method of killing. Names grow longer with experience. An elder orca's name might be barely pronounceable.

---

## Generation Process

1. **Determine culture** - from entity attributes
2. **Select pattern** - based on entity type and prominence
3. **Generate base name** - using phoneme inventory and syllable patterns
4. **Add grammatical elements** - echoes, truncations, or deed-chains
5. **Validate** - check against forbidden patterns, regenerate if invalid
6. **Cache** - store for consistency

The same entity always gets the same name (names are seeded by entity ID). But related entities - members of the same faction, characters from the same region - will share naming elements that suggest connection.

---

## Special Cases

### Translations
When a name needs to be represented across cultures, Name Forge handles the translation. An Aurora character's name might be rendered in Orca trade-tongue with different phonemes but preserved meaning.

### Compound Names
Factions, locations, and artifacts often have compound names - multiple words or phrases. Name Forge handles these by composing multiple generated elements with appropriate connectors.

### Historical Names
Dead characters, fallen factions, and destroyed locations get marked in their names. Aurora adds ancestral echoes. Nightshelf completes previously-incomplete names (the dead have no secrets to protect). Orca adds the terminal "grrul" marker.

---

## Why It Matters

Names are the first thing you encounter about an entity. Before you read the description, before you see the relationships, you see the name. If the name feels right, you're primed to accept the rest. If it feels wrong, everything else has to work harder.

Name Forge exists so that when you read "Velmaerik (trade-blessed, far-spoken) rukar'Reach" you already know something about this character before reading another word. They're Aurora. They're prominent (multiple echoes). They're associated with trade and communication. They belong to clan rukar. They're connected to a place called the Reach.

All of that, from a name. That's the job.