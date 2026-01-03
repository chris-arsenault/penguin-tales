# Canonry DSL v2 Plan

## Goals
- Replace JSON-first DSL compiler with DSL-first pipeline.
- Enforce canonical syntax (no {}, [], key:value, commas, inline objects).
- Provide resource-specific parsing and diagnostics with line/column spans.
- Maintain parity with existing JSON configs via bidirectional conversions.

## Constraints
- No edits to default-project root JSON.
- Parity artifacts and checks only under default-project/conduit.
- Lint errors must be parser/validator-driven, not schema validation.

## Approach
1) **New package (v2)**
   - Create `packages/canonry-dsl-v2` with dedicated grammar, AST, parser, validator, compiler, and serializer.
   - Keep v1 untouched for back-compat; add CLI option to select v2.

2) **DSL-first grammar + AST**
   - Grammar only permits resource blocks + flat statements.
   - Collections are represented by repeated statements or set blocks.
   - No JSON-like values or punctuation constructs.
   - AST nodes are resource-specific; no generic object/array nodes.

3) **Resource-specific parsers**
   - Each resource has a dedicated parser that enforces allowed statements and order.
   - Use domain-specific keywords and ensure consistent tokens.
   - Support block references with `resource <id>` references and `resource_id` fields.

4) **Validation layer**
   - Static validation of IDs, relationships, tags, kinds, subtypes, statuses, pressures.
   - Emit diagnostics with resource-scoped messages and spans.
   - Strict duplicate detection with merge rules where applicable.

5) **Backends**
   - Compiler: DSL AST → canonical JSON config.
   - Serializer: JSON → canonical DSL format.
   - JSON is a backend; never a parsing source.

6) **CLI integration**
   - `conduit` CLI supports `--v2` (or `--dsl-version v2`) for lint/convert.
   - `conduit:lint` uses v2 parser/validator for canonical errors.

7) **Parity + validation**
   - Run conversion from JSON → DSL → JSON and compare (using conduit outputs).
   - Store parity artifacts under `default-project/conduit` only.

## Milestones
- M1: v2 skeleton, grammar, parser, AST, diagnostics.
- M2: resource parsers + validator; registry generation.
- M3: compile + serialize; CLI integration.
- M4: parity checks + fix gaps; update docs/scripts.

## Acceptance
- Default project converts to DSL without JSON-lite constructs.
- Round-trip parity JSON ↔ DSL holds for default project.
- Lint errors are DSL-native and resource-scoped.
