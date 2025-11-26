Below is a **concrete, implementable blueprint** for an offline, domain-aware name-generation system that avoids “two-word combo” gimmicks and produces names whose **shape alone conveys culture, species, faction, or concept**. This is the kind of system roguelikes, CRPGs, and lit-RPGs use when they want strong semiotics.

I’m giving you the process, the algorithms, and the data shapes you’ll need.

---

# 1. Core Idea

Names = **phonotactic rules + morphological rules + stylistic filters**, selected by `(kind, subKind, tags[])`.

Every “culture/species/style” defines its own **Phonology Profile**, **Morphology Profile**, and **Stylistic Rules**.

LLMs are used once to *bootstrap lists*, then everything is embedded offline as static data + RNG.

---

# 2. Data Model

## 2.1 Phonology Profile

Controls **sound inventory** and **allowed sequences**.

```ts
interface PhonologyProfile {
  consonants: string[];     // e.g. ["t", "th", "l", "r", "f"]
  vowels: string[];         // e.g. ["a", "ae", "e", "i", "o"]
  syllableTemplates: string[]; // e.g. ["CV", "CVC", "VC", "CVV"]
  forbiddenClusters?: string[]; // e.g. ["tl", "ngk"]
  favoredClusters?: string[];   // boost probability
  lengthRange: [number, number]; // syllables
}
```

## 2.2 Morphology Profile

Controls **prefixes, infixes, suffixes**, and **meaning-bearing morphemes** for title-type names.

```ts
interface MorphologyProfile {
  prefixes?: string[];
  suffixes?: string[];
  infixes?: string[];
  wordRoots?: string[];
  honorifics?: string[];
  structure: string[]; // e.g. ["root", "root-suffix", "prefix-root", "root-root"]
}
```

## 2.3 Stylistic Rules

Finer shape constraints.

```ts
interface StyleRules {
  apostropheRate?: number; // 0–1
  hyphenRate?: number;
  capitalization: "title" | "allcaps" | "mixed";
  preferredEndings?: string[]; // e.g. ["-iel", "-ion", "-ar"]
  rhythmBias?: "soft" | "harsh" | "staccato" | "flowing";
}
```

## 2.4 Domain Selector

Maps `(kind, subKind, tags[])` to a set of profiles.

```ts
interface NamingDomain {
  id: string; // "elf", "goauld", "dwarven", "high-tech-protocol", etc.
  appliesTo: {
    kind: string[];
    subKind?: string[];
    tags?: string[];
  };
  phonology: PhonologyProfile;
  morphology: MorphologyProfile;
  style: StyleRules;
}
```

---

# 3. Generation Pipeline (Offline)

### Step 1 — Pick a domain

Given `(kind, subKind, tags[])`, select the appropriate NamingDomain.
Tie-break with tag priority.

### Step 2 — Generate a phonotactically valid syllable sequence

Use syllable templates and weighted phoneme lists.
Check forbidden clusters.
Apply favored clusters with increased weight.

### Step 3 — Apply morphological shaping

Randomly pick a structure (root-suffix, prefix-root, root-root, etc).
Insert morphemes accordingly.

### Step 4 — Apply stylistic transforms

Apostrophes with weighted probability (e.g. “Sha’keth”).
Hyphens, capitalization, special endings, rhythm smoothing.

### Step 5 — Validate shape

Ensure resulting name meets domain expectations:
Length, flow, character class vibe, etc.

---

# 4. Example Domains

## 4.1 Elven (Tolkien-inspired)

**Flavor:** flowing, vowel-rich, mid-length, lots of **ae**, **iel**, **ion**.

Phonology:

* consonants: `l r th f n m v s h`
* vowels: `a e i o u ae ea ie ai oi`
* templates: `["CV", "CVV", "CVC", "VC"]`
* lengthRange: `[2, 4]`

Morphology:

* prefixes: `["Ael", "Ith", "Vor", "Lae", "Eli"]`
* suffixes: `["riel", "ion", "aen", "iel", "ar"]`
* structure: `["root-suffix", "prefix-root"]`

Style:

* apostropheRate: `0.05`
* rhythmBias: `flowing`
* preferredEndings: `["iel", "ion"]`

Generated: *Aeltharion, Laevriel, Ithaeon*

## 4.2 Goa’uld-style

**Flavor:** short, sharp, 1–2 syllables, apostrophes common.

Phonology:

* consonants: `t k d q r s`
* vowels: `a e i o`
* templates: `["CV", "CVC"]`
* lengthRange: `[1, 2]`

Style:

* apostropheRate: `0.4`
* rhythmBias: `staccato`

Generated: *Tek’ra, Dak’no, Sarq*

## 4.3 Industrial/Techno-Faction

**Flavor:** clipped Germanic + alphanumeric marks for protocols.

Phonology:

* consonants: broad set
* vowels: standard
* templates: `["CVC", "CVCC"]`

Morphology:

* suffixes: `["-sys", "-core", "-ware"]`
* prefixes: `["Proto", "Hex", "Tri", "Neuro"]`

Style:

* hyphenRate: `0.2`
* capitalization: `mixed`

Generated: *Hexan-Core, Protofar, Neuro-Varr*

---

# 5. Algorithms

## 5.1 Syllable Generator

```
function generateSyllable(profile):
  template = random(profile.syllableTemplates)
  output = ""
  for symbol in template:
    if symbol == "C": pick random consonant
    if symbol == "V": pick random vowel
  reject if matches forbidden cluster
  return output
```

## 5.2 Word Constructor

```
function buildWord(profile):
  n = randomInRange(profile.lengthRange)
  syllables = repeat call generateSyllable(n)
  return join(syllables)
```

## 5.3 Morphology Application

```
function applyMorphology(word, morphology):
  pattern = random(morphology.structure)
  if pattern == "root-suffix": return word + random(suffixes)
  if pattern == "prefix-root": return random(prefixes) + word
  if pattern == "root-root":   return word + buildWord(profile)
```

## 5.4 Styling

```
with probability apostropheRate:
   insert "'" at legal boundary (between syllables)

apply capitalization rules
ensure preferred endings have +weight in final pick
```

---

# 6. Domain-Aware Inference

Players should **infer culture/type at a glance** because:

* Elves → vowel heavy, flowing, “ae/iel/ion” endings
* Goa’uld-analogs → short, hard consonants, apostrophes
* Dwarves → consonant clusters (gr, kr, dn), heavy endings (“ruk”, “dun”)
* Tech-faction → hyphens, numeric/code style
* Demon/void → sibilant, guttural, maybe forbidden vowels, heavy repetition
* Academic → Latinate multi-syllable, low apostrophe count
* Rural human → English/Scandi phonotactics
* High Imperium → Tri-syllabic, authoritarian, fewer vowels

This is what makes names instantly readable.

---

# 7. Seeding Using LLMs (Initial Only)

You can use an LLM once per domain to generate:

* lists of suitable consonants/vowels
* morphemes for prefixes/suffixes
* sample honorifics
* sample roots
* syllable templates

Then lock the resulting lists into static JSON and never call the LLM again.

---

# 8. Multi-Domain Output

Given one entity:

```
kind: "location"
subKind: "ancient elven ruin"
tags: ["elf", "archaic", "mythic"]
```

Resolver picks the “Archaic Elven Toponymy” domain, where style rules differ from “Modern Elven Personal Names” (more apostrophes, archaic diphthongs, longer structures).

Example: *Ael’tharune*, *O’riandel*, *Thaevaenor*

---

# 9. Suggestion: Three Tiers of Domains

You should distinguish:

### 1. **Personal Names**

People, NPCs, monsters with intelligence.

* Typically 1–3 syllables with morphology rules for lineage or caste.

### 2. **Toponyms**

Places.

* Longer, often compound, sometimes using morphemes that imply location or geology.

### 3. **Concepts/Abstracts**

Artifacts, factions, philosophies.

* Allow symbolic morphology (“Triune-”, “Astral-”, “Void-”, “Lattice-”).
* Allow repeated morphemes for ritualistic flavor.

All use separate domain profiles.

---

# 10. Implementation Approach

In your monorepo:
**`packages/namegen/`** with:

* `/data/domains/*.json` (each domain’s phonology+morphology+style)
* `/lib/phonology.ts`
* `/lib/morphology.ts`
* `/lib/style.ts`
* `/index.ts` (choose domain + orchestrate pipeline)

Everything is deterministic if you pass a seeded RNG.

---

If you want, I can produce:

* a fully structured JSON seed format
* a TS implementation skeleton
* a library-ready `chooseDomain()` resolver
* initial phonology kits for elves, dwarves, goblins, technomancers, megacorps, void cults, industrial humans, space bureaucrats, planar beings, etc.
* a test harness to validate “shape conveys meaning.”

Just specify which part you want next.
