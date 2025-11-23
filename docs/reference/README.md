# Reference Documentation

Stable guides for understanding and using the world generation system. These are actively maintained and updated as the system evolves.

## Guides by Purpose

### For Developers

**SYSTEM_IMPLEMENTATION_GUIDE.md**
How to write templates and systems that integrate with the engine. Covers GrowthTemplate and SimulationSystem interfaces, parameter extraction, and best practices.

**PARAMETER_TUNING.md**
How to tune the 87+ extracted parameters via the centralized configuration file. Explains parameter categories, bounds, and tuning strategies.

**FRAMEWORK_DOMAIN_ANALYSIS.md**
Analysis of framework vs domain layer separation. Useful for understanding the architecture and creating new domains.

### For Content Creators

**LLM_INTEGRATION.md**
LLM enrichment strategy and philosophy. Explains atlas-focused enrichment, prompt strategies, and how to extend lore generation.

**IMAGE_GENERATION.md**
Image generation system using Replicate API. Covers entity illustration, scene generation, and integration points.

**UI.md**
Web UI visualization guide. Interactive graph exploration, entity details, relationship filtering.

### For Understanding the System

**NEW_MECHANICS.md**
Overview of algorithmic foundations: Ising model for kinship, conflict contagion, resource flow, prominence evolution, etc.

## Cross-References

- System architecture: `/world-gen/ARCHITECTURE.md`
- Project overview: `/world-gen/CLAUDE.md` (for Claude Code)
- Domain encapsulation: `/world-gen/DOMAIN_ENCAPSULATION.md`
- Completed implementations: `/docs/archive/completed/`
