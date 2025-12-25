# Chronicle Generation Pipeline Design

## Overview

The Chronicle system generates short stories from world simulation data using a multi-step pipeline that maintains knowledge graph cohesion throughout.

## Core Principles

1. **Structured data flows forward, not just prose** - Each step receives full entity objects + enriched descriptions
2. **Simulation events drive plot** - NarrativeEvents from lore-weave become story beats
3. **Short story, not encyclopedia** - Explicit plot structure with validation
4. **Cohesion validation** - Final step checks output against stated goals

## Input Context

All steps have access to:

```
STRUCTURED DATA (Knowledge Graph)          ENRICHED TEXT
├── Entity Objects                         ├── Entity Descriptions (Layer 1)
│   • id, name, kind, subtype              ├── Relationship Backstories (Layer 2)
│   • prominence, culture, status          └── Era Summaries (Layer 2)
│   • tags, coordinates
│   • createdAt, updatedAt
├── Relationships
│   • src, dst, kind, strength
├── Eras
│   • id, name, description
│   • templateWeights, modifiers
└── NarrativeEvents (from lore-weave)
    • entity_lifecycle (births, deaths)
    • state_change (prominence shifts)
    • relationship_change (alliances, betrayals)
    • era_transition
    • conflict, discovery, achievement
    Each has: significance score, headline, stateChanges
```

## Pipeline Steps

### Step 1: Story Planning

**Input:** Full context above

**Output:** StoryPlan with:
- Title
- Characters (with entity references, roles, arcs)
- Setting (era, locations, timespan)
- Plot structure:
  - Inciting incident (with NarrativeEvent IDs)
  - Rising action beats
  - Climax
  - Resolution
- Scenes (each with goals, characters, events, emotional beat)
- Theme and tone
- Key NarrativeEvent IDs

**User can:** Review, edit plan before proceeding

### Step 2: Scene Expansion

**For each scene, input includes:**
- Complete story plan (for narrative coherence)
- This scene's goals and emotional beat
- Full entity OBJECTS for characters (not just descriptions)
- NarrativeEvent objects for this scene
- Previously generated scenes (for continuity)
- Relationship data between characters

**Output:** 300-500 words of narrative prose per scene

**LLM instructed to:**
- Honor entity facts (prominence, culture, traits)
- Incorporate NarrativeEvents as plot beats
- Achieve scene's stated goal
- Match emotional beat
- Maintain continuity with previous scenes

### Step 3: Assembly + Cross-Reference

- Combine scenes with transitions
- Add scene breaks / section headers
- Inject [[Entity Name]] links (validated against entity list)
- Format for wiki display

### Step 4: Cohesion Validation

**Input:** Assembled story + original plan + entity data

**LLM evaluates:**
- Plot structure (inciting incident → climax → resolution)
- Character consistency (actions match traits)
- Scene goals (each scene achieves stated purpose)
- Resolution quality
- Factual accuracy (entity facts consistent)
- Theme expression

**Output:** CohesionReport with score, checks, and issues

**User can:**
- Accept with issues
- Regenerate flagged scenes with issue context
- Edit manually

## Data Structures

```typescript
interface StoryPlan {
  id: string;
  title: string;

  characters: {
    entityId: string;
    role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
    arc: string;
  }[];

  setting: {
    eraId: string;
    locations: string[];
    timespan: string;
  };

  plot: {
    incitingIncident: { description: string; eventIds: string[] };
    risingAction: { description: string; eventIds: string[] }[];
    climax: { description: string; eventIds: string[] };
    resolution: { description: string; eventIds: string[] };
  };

  scenes: {
    id: string;
    title: string;
    goal: string;
    characterIds: string[];
    eventIds: string[];
    setting: string;
    emotionalBeat: string;
    generatedContent?: string;
  }[];

  theme: string;
  tone: string;
  keyEventIds: string[];
}

interface CohesionReport {
  overallScore: number;

  checks: {
    plotStructure: { pass: boolean; notes: string };
    characterConsistency: { pass: boolean; notes: string };
    sceneGoals: { sceneId: string; pass: boolean; notes: string }[];
    resolution: { pass: boolean; notes: string };
    factualAccuracy: { pass: boolean; notes: string };
    themeExpression: { pass: boolean; notes: string };
  };

  issues: {
    severity: 'critical' | 'minor';
    sceneId?: string;
    checkType: string;
    description: string;
    suggestion: string;
  }[];
}

interface ChronicleContent {
  id: string;
  type: 'eraChronicle' | 'entityStory' | 'relationshipTale';
  targetId: string; // era ID, entity ID, or relationship ID

  status: 'not_started' | 'planning' | 'expanding' | 'assembling' | 'validating' | 'complete';

  plan?: StoryPlan;
  scenes?: { id: string; content: string }[];
  assembledContent?: string;
  cohesionReport?: CohesionReport;

  generatedAt?: number;
}
```

## UI Structure

```
Chronicle Tab
├── Header: Readiness overview + [Generate All]
├── Content Type Tabs: [Era Chronicles] [Entity Stories] [Relationship Tales]
└── Item List
    └── Each item shows:
        ├── Title + Pipeline Status (○ ◔ ◑ ◕ ●)
        └── Expanded view:
            ├── Prerequisites Check
            │   └── "Missing: 3 entity descriptions" [Generate Prerequisites]
            ├── Step 1: Story Plan [Generate] [Edit]
            ├── Step 2: Scenes (list with individual status)
            ├── Step 3: Assembly (automatic)
            ├── Step 4: Validation (cohesion report)
            └── Final Output (full story)
```

## Implementation Order

1. Define TypeScript types (StoryPlan, CohesionReport, ChronicleContent)
2. Create context builder (gathers all input data for generation)
3. Implement Step 1: Story plan generation + UI
4. Implement Step 2: Scene expansion + UI
5. Implement Step 3: Assembly + cross-reference injection
6. Implement Step 4: Cohesion validation + UI
7. Wire into enrichment queue system
8. Integration testing
