# World Gen Naming

Domain-aware procedural name generation system for world-building and game development.

## Overview

This system generates culturally-distinct names using:
- **Phonotactic rules** - Control sound patterns and allowed sequences
- **Morphological rules** - Apply prefixes, suffixes, and compound structures
- **Stylistic filters** - Add apostrophes, hyphens, capitalization patterns

Names are generated from **domain configs** that encode cultural/species/faction identity, making names instantly recognizable by their shape alone.

## Architecture

Built in 4 phases:

1. **Framework** (current) - Core generation pipeline
2. **Validation** - Capacity, diffuseness, and semiotic separation metrics
3. **Optimization** - ML-based config tuning
4. **Extensions** - Derivative names, templates, complex strategies

## Installation

```bash
npm install
```

## Usage

```bash
# Generate names from a domain
npm run dev -- generate --domain path/to/domain.json --count 10

# Validate a domain config
npm run dev -- validate --domain path/to/domain.json
```

## Development

```bash
npm run dev           # Run CLI with tsx
npm run build         # Compile TypeScript
npm run typecheck     # Type check without building
npm run clean         # Remove build artifacts
```

## Domain Config Structure

See design docs in this directory:
- `01_FRAMEWORK.md` - Core architecture and generation pipeline
- `02_VALIDATION.md` - Quality metrics and testing
- `03_OPTIMIZATION.md` - ML-based parameter tuning
- `04_NAME_EXTENSIONS.md` - Advanced naming strategies

## Example Domain

```json
{
  "id": "elf_high",
  "appliesTo": {
    "kind": ["npc"],
    "subKind": ["elf"],
    "tags": ["high", "ancient"]
  },
  "phonology": {
    "consonants": ["l", "r", "th", "f", "n", "m"],
    "vowels": ["a", "e", "i", "o", "ae", "ea"],
    "syllableTemplates": ["CV", "CVV", "CVC"],
    "lengthRange": [2, 4]
  },
  "morphology": {
    "prefixes": ["Ael", "Ith", "Lae"],
    "suffixes": ["riel", "ion", "aen"],
    "structure": ["root-suffix", "prefix-root"]
  },
  "style": {
    "apostropheRate": 0.05,
    "capitalization": "title",
    "rhythmBias": "flowing"
  }
}
```

## License

MIT
