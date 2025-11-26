Think of this as: “Can this domain produce enough distinct names that are internally de-confusable and externally distinguishable?”

You can treat that as three separate validation problems:

1. **Capacity** – big enough to support N names without lots of collisions.
2. **Diffuseness** – names in the same domain aren’t too similar to each other.
3. **Semiotic separation** – domains/types are distinguishable from each other on shape alone.

Below is a concrete, automatable approach.

---

## 1. Capacity: can this domain support N names?

You don’t need a closed-form; just sample and measure.

### 1.1 Sampling procedure

For each `(domain, objectType)` config (e.g. `elf:personal`, `elf:toponym`):

```ts
const SAMPLE_FACTOR = 20; // e.g. 20× the number you expect to actually need
const targetN = config.requiredNames; // e.g. max population or “total across campaign”
const sampleCount = SAMPLE_FACTOR * targetN;

const names = sampleNames(domainConfig, sampleCount); // your namegen
const uniqueNames = new Set(names);
const collisionRate = 1 - uniqueNames.size / names.length;
```

### 1.2 Capacity heuristics

* If `collisionRate` is **> ~5%**, domain is probably too tight:

    * too few templates
    * lengthRange too small
    * phoneme set too constrained

You can also check **effective entropy**:

```ts
function charEntropy(names: string[]): number {
  const freq = new Map<string, number>();
  let total = 0;
  for (const n of names) {
    for (const ch of n) {
      total++;
      freq.set(ch, (freq.get(ch) ?? 0) + 1);
    }
  }
  let H = 0;
  for (const [, c] of freq) {
    const p = c / total;
    H -= p * Math.log2(p);
  }
  return H;
}
```

If `H` is very low (e.g. ~1–2 bits/char) and collisions are high, you know you’ve overconstrained the domain.

Output a simple report:

* `uniqueCount`, `collisionRate`, `avgLen`, `entropy`.

---

## 2. Diffuseness: are names in-domain too similar?

You don’t just want uniqueness; you want **perceptual distance**. Dave/Daave/Daeve is technically unique but confusing.

### 2.1 Normalized distance metric

Use a normalized string distance:

* **Levenshtein** normalized to `[0,1]` (0 = identical, 1 = completely different).
* Optionally augment with a “shape” transform that collapses vowels and repeated letters.

Example shape normalization:

```ts
function shapeKey(name: string): string {
  // lowercase
  let s = name.toLowerCase();
  // collapse vowels
  s = s.replace(/[aeiou]+/g, "V");
  // collapse consonant runs
  s = s.replace(/[^V]+/g, "C");
  // collapse repeats
  s = s.replace(/(.)\1+/g, "$1");
  return s;
}
```

Dave, Daave, Daeve all become roughly similar shape keys; then compare both raw and shape distances.

### 2.2 Nearest-neighbor analysis

You don’t need all pairs (O(n²) is expensive). For each name, just find its closest neighbor within the same sample:

```ts
interface NNStats {
  min: number;
  p1: number;
  p5: number;
  median: number;
}

function nearestNeighborStats(names: string[]): NNStats { /* impl */ }
```

Procedure:

1. Sample `M` names (again, `M ≈ 10–20 × expected max active names`).
2. For each name:

    * Find the closest other name in the sample by:

        * raw normalized Levenshtein, and
        * shapeKey distance.
3. Collect the nearest-neighbor distances.
4. Compute stats: `min`, 1st percentile, 5th percentile, median.

### 2.3 Diffuseness heuristics

You want something like:

* For **95%** of names, nearest-neighbor distance ≥ `D_threshold`.

Rough starting points (tune empirically):

* **Raw Levenshtein NN ≥ 0.3** for 95% of names.
* **Shape distance NN ≥ 0.2** for 95% (to avoid near-homophones).

If a domain fails this:

* Increase syllable variety or lengthRange.
* Allow more consonant/vowel combinations.
* Reduce reuse of fixed prefixes/suffixes (or add more variants).

Emit an automatic “diffuseness report” per domain.

---

## 3. Semiotic separation: can you tell domains/types apart by shape?

You want:

* Names in the same domain clustered together.
* Names from different domains relatively far apart.

There are two ways: **cheap feature-based** and **ML-classifier-based**.

### 3.1 Cheap feature-based check

Build simple feature vectors from each name:

* `len` – length in chars
* `syllables` – estimated syllable count (count of vowel groups)
* `vowelRatio` – vowels / length
* `apostropheCount`, `hyphenCount`
* `endsWith` – categorical (e.g. one-hot of last 2 chars)
* maybe bigram frequencies (top K char bigrams as features)

Build:

```ts
interface NameFeature {
  domainId: string;
  features: number[]; // flattened
}
```

For each domain:

1. Sample `M` names.
2. Compute average feature vector (centroid).
3. Compute **intra-domain** variance and **inter-domain** distances between centroids.

Heuristics:

* **Intra-domain variance** should be low-ish (names share a “shape”).
* **Inter-domain centroid distances** should exceed some margin.

If centroids are very close and intra-domain variance is similar, those domains are semiotically too alike (e.g. two different human cultures that look identical).

### 3.2 Simple classifier check

If you’re okay adding a dev-time ML dependency:

1. Sample labeled data:

   ```ts
   // For each domainId
   const examples: { domainId: string; features: number[] }[] = /* ... */;
   ```

2. Train a tiny classifier (logistic regression, random forest, etc.) to predict `domainId` from features.

3. Measure accuracy with cross-validation.

If the classifier is barely better than random guessing:

* Your phonotactics for those domains aren’t distinctive enough.
* Add domain-specific constraints: vowels, endings, apostrophes, etc.

You can repeat this at the **object-type level** within a domain (e.g. `elf:person` vs `elf:location` vs `elf:artifact`). If the classifier can’t tell them apart at all, your semiotics between types are too weak.

---

## 4. Putting it together: an offline `validateDomains` script

High-level flow:

```ts
interface DomainValidationConfig {
  domainId: string;
  objectTypeId: string; // person, location, artifact, etc.
  requiredNames: number;
}

function validateDomains(configs: DomainValidationConfig[]) {
  // 1. Capacity & diffuseness per (domain, objectType)
  for (const cfg of configs) {
    const names = sampleNamesForValidation(cfg);
    const capacity = computeCapacityStats(names, cfg);
    const nnStats = computeNNStats(names);

    reportPerDomainType(cfg, capacity, nnStats);
  }

  // 2. Semiotic separation across domains/types
  const featureSet = buildFeatureSetAcrossAll(configs);
  const separationReport = computeSeparation(featureSet);

  return { capacityReport, diffusenessReport, separationReport };
}
```

Where each report contains:

* capacity: `uniqueCount`, `collisionRate`, `entropy`, pass/fail
* diffuseness: `minNN`, `p1`, `p5`, `medianNN`, pass/fail
* separation: centroid distances, optional classifier accuracy, pass/fail

You can JSON-dump this and have a human glance at a summary:

* Domains that can’t support enough unique names.
* Domains where names are too similar internally.
* Pairs of domains (or types) that are not distinguishable enough.

---

## 5. Practical thresholds (starting points)

You’ll tune these, but initial defaults:

* **Capacity**:

    * `sampleCount = 20 × requiredNames`
    * `collisionRate ≤ 5%` (soft cap)
* **Diffuseness**:

    * For each `(domain, type)`:

        * `nearestNeighborLevenshtein_p5 ≥ 0.3`
        * `nearestNeighborShape_p5 ≥ 0.2`
* **Separation**:

    * For any two distinct `(domain, type)`:

        * centroid distance ≥ `0.2` (normalized feature space)
    * Optional classifier:

        * cross-val accuracy ≥ `0.7` for major buckets
        * if < `0.6`, flag as “merge or differentiate”

---

## 6. How this connects back to design

This validation layer gives you **red flags** like:

* “Elven locations and elven personal names look identical; consider adding locative morphemes or lengthening toponyms.”
* “Goa’uld-like domain can’t produce 500 distinct names without heavy collision; broaden phoneme inventory or syllable templates.”
* “Techno-faction and Imperial human share too many shapes; add more hyphens/numerals to tech or more Latinate endings to Imperium.”

You run this offline whenever you:

* add a new domain
* tweak phonology/morphology
* change length ranges or styles

No runtime tests, just a “domain design linter”.

If you want next, I can sketch concrete TS helpers for:

* nearest-neighbor stats (with reasonable performance)
* feature extraction and centroid/separation calculation
* a sample JSON validation report format that you can plug into your monorepo.
