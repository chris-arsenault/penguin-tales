You can treat this as “hyperparameter optimization for name domains” with:

* LLM = seed generator and occasional critic
* Your validation metrics = fitness function
* Classical CPU ML = optimizer over domain parameters

Below is how to wire it together and what knobs/algos to use.

---

## 1. High-level loop

For each domain:

1. **Input**:

    * Domain schema (kind, subkind, tags, requiredNames, etc.)
    * English style spec (“flowing, ae-heavy, mid-length; like high elves”).

2. **LLM bootstrap** (one-shot or few-shot):

    * LLM returns an initial domain config (consonants/vowels, templates, affixes, style rates).

3. **Optimization loop (offline, CPU only)**:

    * Encode config → parameter vector `θ`.
    * Generate a bunch of names with `θ`.
    * Run your validation functions → scalar fitness `F(θ)`.
    * ML optimizer mutates `θ` to improve `F(θ)`.
    * Repeat until `F(θ)` above threshold or budget exhausted.

4. **Result**:

    * Optimized static config (JSON) that you ship with the game.

No runtime LLM; only dev-time.

---

## 2. What the framework needs: parameters, knobs, and settings

You need to distinguish:

* **Symbolic inventory** (sets of strings) – mostly from LLM.
* **Numeric knobs** (probabilities, weights, lengths) – optimized by ML.

### 2.1 Domain config structure (simplified)

```ts
interface DomainConfig {
  id: string;
  // Symbols (largely from LLM)
  consonants: string[];
  vowels: string[];
  syllableTemplates: string[]; // ["CV", "CVC", ...]
  prefixes: string[];
  suffixes: string[];
  structures: string[]; // ["root", "root-suffix", ...]

  // Numeric knobs (for ML to tune)
  consonantWeights: number[];  // same length as consonants
  vowelWeights: number[];      // same length as vowels
  templateWeights: number[];   // per syllable template
  structureWeights: number[];  // per morphology structure
  lengthRange: [number, number]; // syllables
  apostropheRate: number;      // 0..1
  hyphenRate: number;          // 0..1
  targetVowelRatio: number;    // 0..1
}
```

LLM initial pass sets:

* Symbol lists
* Rough defaults for weights and rates

The optimizer then tweaks **only numeric parts** (and maybe toggles a few symbolic options on/off).

### 2.2 Validation/fitness settings

You’ll want a config for the validator:

```ts
interface ValidationSettings {
  requiredNames: number;     // capacity goal, e.g. 10_000
  sampleFactor: number;      // e.g. 20× requiredNames (capped)
  maxSampleSize: number;     // hard cap, e.g. 20_000

  // Diffuseness thresholds
  minNN_p5: number;          // e.g. 0.3 normalized Levenshtein
  minShapeNN_p5: number;     // e.g. 0.2

  // Separation thresholds vs other domains
  minCentroidDistance: number;  // e.g. 0.2 in feature space
}
```

And a scalar fitness:

```ts
interface FitnessWeights {
  capacity: number;    // importance of collision rate / entropy
  diffuseness: number; // intra-domain distance
  separation: number;  // inter-domain distinctiveness
  style: number;       // optional style alignment score
}
```

Then:

```ts
function fitness(config: DomainConfig, allOtherDomains: DomainConfig[]): number {
  const stats = runValidation(config, allOtherDomains);
  const { capacityScore, diffusenessScore, separationScore, styleScore } = stats;
  return w.capacity*capacityScore
       + w.diffuseness*diffusenessScore
       + w.separation*separationScore
       + w.style*styleScore;
}
```

Where each component is normalized 0–1:

* `capacityScore` from collision rate & entropy
* `diffusenessScore` from nearest-neighbor stats
* `separationScore` from feature centroid distances to other domains
* `styleScore` optionally from a one-time LLM style check (see below)

---

## 3. Style alignment via light LLM usage

You can optionally add a “does this feel right?” score:

1. Sample ~50 names from the current config.
2. Construct a prompt:

    * English style spec
    * List of sample names
    * Ask LLM to return a `styleScore` 0–1 (or 0–100).

This is expensive vs pure stats, so:

* Only call it a few times per domain:

    * at initial config
    * maybe for best candidate every X iterations
* Cache: `configFingerprint → styleScore`.

Then plug `styleScore` into the fitness function.

If you don’t want style in the objective, you can use it as a **post-filter**: only accept configs above a style floor.

---

## 4. Suitable ML algorithms (CPU, classical)

You are doing **black-box, relatively expensive function optimization**:

* Parameters: maybe 20–80 numeric knobs/domain.
* Evaluation: generate 5k–20k names, run stats.
* Objective: single scalar `F(θ)`.

Good CPU-friendly choices:

### 4.1 Random-search + hill-climbing (baseline)

Algorithm:

1. Start from LLM config `θ₀`.
2. For `N` iterations:

    * Propose a small random perturbation `θ' = θ + δ`:

        * add Gaussian noise to weights
        * jitter lengthRange by ±1
        * adjust apostropheRate slightly, etc.
    * Evaluate `F(θ')`.
    * If `F(θ') > F(θ)`, accept (`θ = θ'`).
3. Keep best `θ`.

Pros:

* Trivial to implement, no libs.
* Good enough for small search spaces.

Settings:

* `N ≈ 100–500` per domain.
* Step sizes per parameter:

    * weights: `σ ≈ 0.1` (clamped to ≥0, then renormalized)
    * apostropheRate: ±0.05
    * lengthRange: ±1 syllable (within safe bounds)

You can upgrade to **simulated annealing** by occasionally accepting worse moves with a temperature schedule.

### 4.2 Evolution Strategies (ES / CMA-ES)

If you want something stronger but still CPU-only:

* **CMA-ES** (Covariance Matrix Adaptation Evolution Strategy) is perfect for:

    * 10–50 continuous parameters
    * expensive black-box objective

Use a library (e.g. `cma` in Python or TS equivalent) and treat:

* `θ` = concatenated vector of:

    * log-weights (to keep them positive)
    * logit of probabilities (apostropheRate, hyphenRate, etc.)
    * transformed lengthRange (continuous within [min,max])

Settings:

* Population size: ~8–16.
* Iterations: 50–150 per domain.
* Each iteration: evaluate population in parallel via worker threads.

CMA-ES will automatically tune step sizes and correlations between parameters; nice for subtle multi-parameter interactions (changing syllableWeights and length together).

### 4.3 Genetic Algorithms (GA) for discrete structure

If you want to **change structure lists themselves** (e.g. which syllable templates allowed, which suffixes enabled), a small genetic algorithm can work:

Representation:

```ts
interface Genome {
  // binary masks for which syllable templates are on/off
  templateMask: boolean[];
  // binary masks for which affixes are used
  prefixMask: boolean[];
  suffixMask: boolean[];

  // plus numeric params
  numericParams: number[];
}
```

GA steps:

1. Initialize population from LLM config + random masks.
2. Evaluate fitness for each genome.
3. Select top K.
4. Crossover/mutate:

    * Flip random bits in masks
    * Small Gaussian noise to numericParams
5. Repeat.

Settings:

* Population: 20–50.
* Generations: 20–50.

This is overkill if you’re mostly happy with the LLM-chosen inventories; then you don’t need GA, just ES/hill-climb.

### 4.4 Bayesian Optimization (BO) / TPE

If you prefer data-efficient search:

* Use **Bayesian optimization** (Gaussian Process or TPE from Optuna/Hyperopt style libraries).
* Treat the namegen/validation as a black-box `f(θ)`.

Pros:

* Needs relatively few evaluations to find a good region.

Cons:

* Implementation complexity higher than hill-climb/ES.
* GP scales badly with dimension; keep parameter vector moderate (~<=30).

Given your use case, I’d rank:

1. **ES / CMA-ES** for numeric tuning, if you’re okay adding one library.
2. **Random hill-climbing + annealing** for a zero-dependency baseline.
3. **GA** if you also want to toggle structural components.

---

## 5. Feature-space separation ML

You already have separation metrics; ML can help refine them.

### 5.1 Simple classifier (CPU-friendly)

Use per-name features:

* length, vowel ratio, syllable count
* counts of apostrophes/hyphens
* top K char bigram frequencies
* maybe last-two-character one-hot

Train a **logistic regression** or **random forest**:

* Input: feature vector
* Label: domainId (or domain+type)

Metrics:

* Overall accuracy
* Per-pair confusion (how often domain A is misclassified as domain B)

Use this classifier in two ways:

1. As a **validator**: require that classifier accuracy across domains ≥ threshold (say 0.7).
2. As a **fitness component**:

    * Lower confusion between different domains = higher separation score.

All of this is CPU-only and trivial with scikit-learn or equivalent.

---

## 6. Putting it together: concrete dev-time workflow

For each new domain:

1. **Authoring**:

    * You provide:

        * schema: `kind`, `subKinds`, `tags`
        * English style spec
        * rough requiredNames (capacity need)
        * strictness profile (how much you care about separation vs diffuseness)

2. **LLM bootstrap**:

    * Prompt LLM:

        * style spec & examples from other domains
        * ask for JSON with consonants, vowels, affixes, templates, lengthRange, initial weights.
    * Validate JSON shape and patch if needed.

3. **Optimization**:

    * Pick optimizer:

        * start with hill-climb; move to CMA-ES if you want more refinement.
    * Run for N iterations:

        * For each candidate config:

            * Sample names (respect ValidationSettings).
            * Compute:

                * capacityScore
                * diffusenessScore
                * separationScore (using centroids/classifier, given existing domains)
                * optional styleScore (only for a subset of best configs, via LLM)
            * Combine into `F(θ)`.

4. **Selection & freezing**:

    * Keep best config per domain.
    * Save to `namegen/domains/{domainId}.json`.
    * Optionally store diagnostics (plots of NN distances, sample names, etc.).

5. **Regression**:

    * Whenever you add or change a domain, re-run:

        * domain-level optimization
        * global separation checks (classifier retrain)

---

## 7. Summary of key tunables

Framework-level settings you’ll want to expose:

* `ValidationSettings`:

    * `sampleFactor`, `maxSampleSize`
    * `minNN_p5`, `minShapeNN_p5`
    * `minCentroidDistance`
* `FitnessWeights`:

    * relative importance of capacity/diffuseness/separation/style
* `OptimizationSettings`:

    * algorithm: `"hillclimb" | "sim_anneal" | "cma-es" | "ga" | "bayes"`
    * `iterations`, `populationSize`
    * mutation step sizes, annealing schedule
* `StyleCheckSettings`:

    * how often to query LLM
    * minimum styleScore required

If you want, next step I can sketch:

* A concrete `DomainOptimizer` API in TypeScript (interfaces + stub methods).
* A sample optimization run for one domain (pseudo-code) using hill-climb or CMA-ES.
