### Aho–Corasick (semi-technical, implementation-oriented)

Aho–Corasick is a **multi-pattern string matching automaton**.
It lets you search for *many strings at once* in a single left-to-right pass over the text.

Think of it as:

> “`indexOf`, but for hundreds of needles at the same time, without rescanning the haystack.”

---

## The problem it solves

Given:

* A large text `T` (your normalized document)
* A set of patterns `{P₁, P₂, …, Pₙ}` (your entity slugs)

You want:

* All occurrences of all patterns
* In one pass
* Deterministically
* With no backtracking

Naively doing `indexOf` for each pattern is `O(n × |T|)`.
Aho–Corasick is `O(|T| + total_pattern_length + matches)`.

---

## High-level structure

It has **three parts**:

1. **Trie (prefix tree)** of all patterns
2. **Failure links** (what to do when a match breaks)
3. **Output lists** (which patterns end at this node)

Once built, it behaves like a **state machine**.

---

## 1. Trie: storing all patterns at once

Insert every pattern character-by-character into a trie.

Example patterns:

```
newyorkcity
margaretthatcher
york
```

Trie (conceptually):

```
root
 ├─ n → e → w → y → o → r → k → c → i → t → y*
 ├─ m → a → r → g → a → r → e → t → t → h → a → t → c → h → e → r*
 └─ y → o → r → k*
```

Nodes marked `*` are pattern ends.

At this stage:

* You can match prefixes
* But you can’t recover if a character doesn’t match

---

## 2. Failure links: “what’s the longest suffix that still works?”

Failure links solve this:

> If I’m matching and the next character doesn’t fit, where should I jump *without rewinding the input*?

Each node gets a failure link to:

* The longest proper suffix of the current path
* That exists as a prefix in the trie

Example intuition:

If you’ve matched:

```
newyork
```

And the next character breaks the path, you don’t restart from root — you fall back to:

```
york
```

(if that prefix exists)

This is computed once during preprocessing using BFS over the trie.

---

## 3. Output lists: multiple matches at once

A node can correspond to:

* One pattern ending
* Multiple patterns ending (via suffixes)

Example:

```
Patterns: "york", "newyork"
```

When you reach the node for `"newyork"`:

* You should emit **both**

    * `"newyork"`
    * `"york"`

So each node has:

```
node.outputs = [pattern_ids...]
```

This is essential for overlapping and nested matches.

---

## How matching actually runs

After building the automaton:

```
state = root
for each character c in text:
  while state has no edge c:
    state = state.failure
  if edge exists:
    state = state.edge[c]
  emit all patterns in state.outputs
```

Key properties:

* You never move backward in the text
* Each character is processed once
* Failure transitions are amortized constant time

This is why it’s linear.

---

## Why this is perfect for your use case

For wiki backrefs:

* Patterns = normalized entity slugs
* Text = normalized document
* Output = `(entity_id, norm_start, norm_end)`

Advantages:

* Finds **all entities simultaneously**
* Handles overlapping names correctly
* Deterministic and fast
* No heuristics, no fuzz

Once you have the match positions:

* Map normalized indices → raw indices
* Wrap only the first occurrence per entity

---

## Mental model (use this with your coding agent)

> Aho–Corasick is a trie with memory.
>
> It remembers how much of previous matches can still be reused when a mismatch happens.

Or, more bluntly:

> It’s a DFA that recognizes *any* of your entity names at *any* position in one scan.

---

## Implementation notes (important)

* Build once per entity set
* Reuse across documents
* Store **pattern IDs**, not strings, in output lists
* Expect slug collisions — handle them explicitly
* Don’t try to be clever with Unicode during matching
  Normalize **before** building the automaton

---

If you want next:

* a minimal pseudo-code implementation
* memory layout tradeoffs
* or how to integrate alias weights cleanly
