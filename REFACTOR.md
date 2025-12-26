# Illuminator Narrative Refactor Plan

This document captures refactor direction and design decisions per request. Execution tracking remains in bd issues, not here.

## Direction (Updated)
Outline blocks: Story plans must include a required story outline block (purpose, key points, era, tone, theme, emotional beats). Document plans must include a required document outline block (purpose, key points, era, tone; veracity/legitimacy optional).
Focus decision: A shared selection step must decide focus mode (single protagonist vs ensemble) and lock the entity set and event set used by every section, for both stories and documents.
Entry point rule: The entrypoint entity and its graph neighbors must appear across the narrative, even in single protagonist mode.
Removal: Era and relationship narrative concepts and tabs are removed entirely from Illuminator.

## Target Architecture
Shared selection and focus stage: A single pre-plan stage uses the narrative style library to filter entities and events, decides focus mode, and produces a stable cast/event packet used by both story and document pipelines. This is the decision point for whether the narrative centers on one entity or a small ensemble, and it must always include the entrypoint plus nearby graph entities.

Story pipeline: Plan, expand, assemble, and validate remain story specific, but they consume the shared cast/event packet rather than re-selecting. Plot structure, scene templates, pacing, and prose directives continue to come from story styles.

Document pipeline: Plan, expand, assemble, and validate are document specific, but they also consume the shared cast/event packet. The document plan must include an explicit outline block (purpose, key points, era, tone; veracity/legitimacy optional) that is later consumed by expansion and validation.

Validation: Validation rules apply the entrypoint and multi-entity interaction constraints to both formats. Document validation focuses on outline coverage and factual correctness but still enforces multi-entity presence and interaction.

Extensibility: Structure the system as separate pipeline modules with shared selection and shared utilities. Avoid inline switches for pipeline behavior; use clear boundaries (per-pipeline files and interfaces) so a future epic-era pipeline can be added without modifying large monolithic files.

## Data Model and Style Library
NarrativeStyle: Explicitly set format for all styles (no fallback). Document styles should include entityRules and eventRules so selection is truly style driven.

ChroniclePlan: Add required outline blocks per format (storyOutline or documentOutline) and add explicit focus metadata (for example, focusMode, primaryEntityIds, supportingEntityIds, requiredNeighborIds, selectedEventIds) that is shared across formats.

### Document Outline Block (Required)
documentOutline should be required for document plans and include these fields:
- purpose: why this document exists and what it intends to accomplish
- keyPoints: 3-7 core claims or takeaways the document must cover
- era: the era or timeframe the document situates itself within
- tone: writing tone or voice keywords for the document

Optional outline fields that help but are not required: veracity, legitimacy, audience, author/provenance, bias/agenda, intendedOutcome.

### Story Outline Block (Required)
storyOutline should be required for story plans and include these fields:
- purpose: why this story matters or the central driving purpose
- keyPoints: 3-7 major plot beats or turning points the story must cover
- era: the era or timeframe the story is set within
- tone: writing tone or voice keywords for the story
- theme: the central thematic statement
- emotionalBeats: 3-7 emotional shifts or beats that anchor the arc

Optional outline fields that help but are not required: stakes, transformation, intendedImpact.

## Meta Guidance
Do not implement migrations, fallbacks, or backwards compatibility. Refactor toward a clean, forward-looking implementation of the new system and remove legacy schema paths that exist only for preservation.
Avoid monolithic modules; split responsibilities across multiple files and keep each pipeline isolated behind shared interfaces.

Context serialization: Include enriched descriptions, tags, and key fields for all selected entities, not only the entrypoint, so the LLM can dress the lore-weave skeleton.

## UI and Feature Removal
Remove Narratives tab and its components, along with era/relationship enrichment types, prompts, and storage paths. Remove any config copy that describes era or relationship narratives.

Chronicle UI: Show the focus decision (single vs ensemble) and the selected cast/event packet in the plan review view. Keep the narrative style selector, but allow styles to clearly indicate story vs document.

## Integration with Chronicler
Define how document outputs map to LoreRecord types and wiki sections. If needed, add a document LoreType or reuse enhanced_entity_page with structured sections so Chronicler can render documents consistently.

## Execution Sequence (Conceptual)
First, remove era and relationship narrative code paths to reduce interference and simplify the codebase. Next, introduce the shared selection and focus stage and pass its output through both pipelines. Then, update the document plan schema to include the outline block and align expansion and validation with it. Finally, add tests for plan parsing, outline handling, and focus enforcement for both formats.

## Success Signals
Document styles run end to end without story-only validation errors. Entry point plus graph neighbors appear across all sections in both formats. The plan output shows a clear focus decision and explicit outline for documents. The UI no longer exposes era or relationship narrative tooling.
