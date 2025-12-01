# Documentation Overview

**Last Updated**: 2025-12

This directory contains documentation for the Lore Weave procedural world generation framework. Documents are organized by status and relevance.

---

## Current Organization

### Active Design Documents (`/active`)
Documents representing **next steps** and **future implementations**:

- `WORLD_LEVEL_SYSTEMS_DESIGN.md` - World-level relationship systems
- `META_FRAMEWORK_CATALYST_MODEL.md` - Entity agency model
- `NPCS_AS_CATALYSTS_DESIGN.md` - Agent-based world events design
- `NPC_DYNAMICS_SYSTEMS.md` - NPC-focused system designs
- `TEMPLATE_AND_RELATIONSHIP_REDESIGN.md` - Relationship kind redesign
- `TEMPORAL_ENTITIES_CATALYST_MODEL.md` - Era and occurrence entity types

**Status**: Design phase, ready for implementation

---

### Reference Guides (`/reference`)
Stable documentation for understanding and using the system:

- `SYSTEM_IMPLEMENTATION_GUIDE.md` - How to write templates and systems
- `PARAMETER_TUNING.md` - How to tune generation parameters
- `LLM_INTEGRATION.md` - LLM enrichment strategy
- `IMAGE_GENERATION.md` - Image generation system
- `UI.md` - Web UI visualization guide
- `NEW_MECHANICS.md` - Overview of algorithmic foundations
- `FRAMEWORK_DOMAIN_ANALYSIS.md` - Framework/domain separation analysis

**Status**: Keep as-is, update as needed

---

### Archive (`/archive`)
Historical documents - completed implementations and obsolete proposals.

**Status**: Archived for reference, not actively maintained

---

## Quick Navigation

**I want to...**

- **Understand the system architecture** → `apps/lore-weave/README.md`
- **Add a new template or system** → `reference/SYSTEM_IMPLEMENTATION_GUIDE.md`
- **Tune generation parameters** → `reference/PARAMETER_TUNING.md`
- **Understand LLM enrichment** → `reference/LLM_INTEGRATION.md`
- **See what's next** → `active/WORLD_LEVEL_SYSTEMS_DESIGN.md`
- **Understand the catalyst model** → `active/META_FRAMEWORK_CATALYST_MODEL.md`

---

## Maintenance Notes

- Archive old session logs after 2 weeks
- Update README.md when designs move to implementation
- Move implementation docs to archive/ when complete
- Keep reference/ guides updated with latest patterns
