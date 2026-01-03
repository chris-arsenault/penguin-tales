# Illuminator

*Where raw data becomes something you might actually want to read.*

---

## The Gap

Lore Weave generates structure. It creates entities with attributes, relationships with types, events with participants. What it doesn't create is *prose*.

A raw generated character might look like:

```
kind: character
subtype: merchant
name: Velmaek (twice-traded)
culture: aurora
prominence: recognized
relationships: [leads: Frost-Salt Consortium, rivals: Taelrik]
tags: {wealth: high, reputation: cautious}
```

That's data. It's not a description. It's not a backstory. It's not something that makes you care about this penguin's fictional life.

Illuminator bridges that gap.

---

## What It Does

Illuminator takes raw generated entities and enriches them with AI-generated content:

### Descriptions
Short prose passages that capture what an entity *is*. For a character: their appearance, mannerisms, first impression. For a faction: their public face, their reputation, their vibe.

### Backstories
Longer passages about where an entity came from. How did this merchant become wealthy? Why did this faction form? What happened to make this location significant?

### Relationship Narratives
Context for connections. These two characters are rivals - but why? This faction controls this territory - how did they get it? Relationships have stories; Illuminator tells them.

### Event Descriptions
What actually happened during generated events. The simulation knows "Faction A defeated Faction B in territorial conflict" - Illuminator knows what the battle looked like, who died, what the aftermath felt like.

---

## How It Works

1. **Context Assembly** - Pull the entity's data, its relationships, related entities, relevant events
2. **Prompt Construction** - Build a prompt that captures the entity's nature and asks for specific content
3. **Generation** - AI generates prose based on the prompt
4. **Validation** - Check for consistency with existing content, flag contradictions
5. **Integration** - Merge generated content into the entity record

Illuminator maintains consistency through context. When generating content for a character, it knows what's already been written about their faction, their rivals, their region. Generated prose should fit with established content.

---

## The Consistency Challenge

The hardest part of enrichment is consistency. Generated content can contradict itself if you're not careful. Character A's backstory says they've never left the Aurora Stack; Character B's backstory says they met Character A in the Nightshelf markets. These contradictions break immersion.

Illuminator addresses this through:

- **Context windows** - Always include related content when generating
- **Constraint prompting** - Explicitly tell the AI what facts must be preserved
- **Post-generation validation** - Check new content against existing content
- **Revision cycles** - Regenerate contradictory content with tighter constraints

It's not perfect. Some contradictions slip through. But the goal is coherence, not perfection.

---

## Tone Control

The Berg has a particular tone - casual but dark, taking its absurd premise seriously without taking itself too seriously. Illuminator has to maintain that tone across thousands of generated passages.

This happens through:

- **Tone examples** - Sample passages that demonstrate the target voice
- **Style constraints** - Rules about what to avoid (excessive grimness, unearned humor)
- **Cultural calibration** - Different tones for different cultures (Aurora is warmer; Nightshelf is more sardonic; Orca is blunter)

---

## The Human Element

Illuminator is a tool, not a replacement for authorial judgment. Generated content gets reviewed. Bad passages get regenerated. Sometimes we write things by hand when the AI can't get it right.

The lore pages you're reading in this wiki? Those were written by hand, not generated. The entity descriptions? Mostly generated, with human editing. The balance shifts depending on how important the content is.

High-prominence entities get more human attention. Background characters might never be touched by human hands. That's the tradeoff of procedural content - you can have quantity or quality, rarely both.

---

## Philosophy

Illuminator exists because data isn't story. A graph of entities and relationships is useful for analysis, for querying, for understanding structure. But it's not something you *read*.

The goal is to create content that makes you forget it was generated. When you read about Velmaek (twice-traded) and their cautious rise through the merchant ranks, you shouldn't be thinking about templates and systems. You should be thinking about a penguin who's made deals, taken risks, earned their echoes.

That's the job. Turn data into something that feels alive.