# Documentation Overview

**Last Updated**: 2025-11-23

This directory contains documentation for the Penguin History procedural world generator. Documents are organized by status and relevance.

---

## 📂 Current Organization

### ✅ Active Design Documents (`/active`)
Documents representing **next steps** and **future implementations**:

- `WORLD_LEVEL_SYSTEMS_DESIGN.md` - Next major implementation: world-level relationship systems
- `META_FRAMEWORK_CATALYST_MODEL.md` - Core framework refactor: entity agency model
- `NPCS_AS_CATALYSTS_DESIGN.md` - Agent-based world events design
- `NPC_DYNAMICS_SYSTEMS.md` - NPC-focused system designs
- `TEMPLATE_AND_RELATIONSHIP_REDESIGN.md` - Relationship kind redesign
- `TEMPORAL_ENTITIES_CATALYST_MODEL.md` - Era and occurrence entity types

**Status**: Design phase, ready for implementation

---

### 📖 Reference Guides (`/reference`)
Stable documentation for understanding and using the system:

- `SYSTEM_IMPLEMENTATION_GUIDE.md` - How to write templates and systems
- `PARAMETER_TUNING.md` - How to tune the 87+ parameters
- `LLM_INTEGRATION.md` - LLM enrichment strategy and philosophy
- `IMAGE_GENERATION.md` - Image generation system
- `UI.md` - Web UI visualization guide
- `NEW_MECHANICS.md` - Overview of algorithmic foundations
- `FRAMEWORK_DOMAIN_ANALYSIS.md` - Framework/domain separation analysis

**Status**: Keep as-is, update as needed

---

### 📦 Archive (`/archive`)
Historical documents - completed implementations and obsolete proposals:

#### Completed Implementations
- `REFACTORING_COMPLETE.md` - ✅ Framework/domain decoupling complete
- `DOMAIN_ENCAPSULATION.md` - ✅ Penguin domain fully encapsulated (in world-gen/)
- `ATLAS_ENRICHMENT_IMPLEMENTATION.md` - ✅ LLM enrichment implemented
- `RELATIONSHIP_STRENGTH_IMPLEMENTATION.md` - ✅ Strength dynamics implemented
- `STRENGTH_AWARE_SYSTEMS_UPDATE.md` - ✅ Systems updated for strength
- `DISTRIBUTION_STATUS.md` - ✅ Statistical distribution system ready
- `SYSTEM_ENABLED.md` - ✅ Mid-run statistical tuning enabled
- `FINAL_METADATA_STATUS.md` - ✅ Metadata extraction complete

#### Proposals (Superseded by Implementations)
- `ATLAS_ENRICHMENT_PROPOSAL.md` - Superseded by _IMPLEMENTATION
- `RELATIONSHIP_STRENGTH_DYNAMICS.md` - Superseded by _IMPLEMENTATION
- `EDGE_STRENGTH_PROPOSAL.md` - Relationship weight proposal

#### Historical Session Logs
- `CURRENT_STATUS.md` - Status before framework refactor (now complete)
- `PROGRESS_LOG.md` - Metadata extraction progress log
- `MIGRATION.md` - Statistical metadata migration tracker
- `INTEGRATION_SUMMARY.md` - Distribution system integration summary
- `QUICK_FIX.md` - 12-generation GA run fix
- `BUG_FIXES.md` - GA optimizer bug fixes
- `TUNING_TEST_RESULTS.md` - Parameter tuning test results (2025-11-22)
- `SOLUTIONS.md` - Solutions for flat fitness landscape
- `ADAPTIVE_STRATEGIES.md` - GA adaptive mutation strategies

**Status**: Archived for reference, not actively maintained

---

## 🎯 Current Project Status

### ✅ Completed (Nov 2025)

1. **Framework/Domain Decoupling** - Generic framework supports any domain
2. **Domain Encapsulation** - All penguin code in `world-gen/src/domain/penguin/`
3. **Relationship Strength System** - Dynamic strength-based culling and reinforcement
4. **LLM Enrichment** - Atlas-focused lore generation
5. **Statistical Distribution Tracking** - Real-time entity/relationship monitoring
6. **Genetic Algorithm Optimizer** - 87-parameter auto-tuning system
7. **Metadata Extraction** - All 21 templates + systems annotated

### 🔨 Next Major Milestones

1. **World-Level Systems** (see `active/WORLD_LEVEL_SYSTEMS_DESIGN.md`)
   - Goal: Invert relationship focus from 69% NPC to 70% world-level
   - Add territorial control, resource monopolization, magical corruption
   - Make factions/locations/abilities the protagonists

2. **Catalyst Model Refactor** (see `active/META_FRAMEWORK_CATALYST_MODEL.md`)
   - Universal agency model for all entity types
   - Action domains (political, magical, economic, military)
   - Influence and lifecycle tracking

3. **Temporal Entities** (see `active/TEMPORAL_ENTITIES_CATALYST_MODEL.md`)
   - Add `era` and `occurrence` entity types
   - Time-aware relationship formation
   - Historical event tracking

---

## 📊 System Metrics (Current)

- **Entity Distribution**: 174 entities (5 kinds)
- **Relationship Distribution**: 995 relationships (25+ kinds)
- **Tunable Parameters**: 87 parameters across templates/systems
- **Simulation Performance**: ~150-200 entities in 500 ticks
- **Protected Relationships**: 7 immutable kinds (geographic, historical, supernatural)
- **Violations**: ~774 total (target: <360) - addressed by structural bonus

---

## 🗺️ Quick Navigation

**I want to...**

- **Understand the system architecture** → `/world-gen/ARCHITECTURE.md` + `/world-gen/CLAUDE.md`
- **Add a new template or system** → `reference/SYSTEM_IMPLEMENTATION_GUIDE.md`
- **Tune generation parameters** → `reference/PARAMETER_TUNING.md`
- **Understand LLM enrichment** → `reference/LLM_INTEGRATION.md`
- **See what's completed** → `archive/REFACTORING_COMPLETE.md` + `archive/DOMAIN_ENCAPSULATION.md`
- **See what's next** → `active/WORLD_LEVEL_SYSTEMS_DESIGN.md`
- **Understand the catalyst model** → `active/META_FRAMEWORK_CATALYST_MODEL.md`

---

## 🔄 Maintenance Notes

- Archive old session logs after 2 weeks
- Update README.md when designs move to implementation
- Move implementation docs to archive/ when complete
- Keep reference/ guides updated with latest patterns
- Use `git log` for detailed change history
