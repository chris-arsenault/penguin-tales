# Chronicler

*You're soaking in it.*

---

## What You're Using

Chronicler is the presentation layer for Penguin Tales. Everything you're reading - the lore pages, the entity entries, the relationship maps - is rendered through Chronicler.

It's a wiki-style viewer built to present procedurally generated content. The content comes from Lore Weave (simulation) and Illuminator (enrichment). Chronicler's job is to make it navigable, readable, and interconnected.

---

## Features

### Entity Pages
Every generated entity gets a page. Characters, factions, locations, artifacts, events - each has a dedicated view showing its attributes, description, relationships, and history.

### Relationship Navigation
Entities link to related entities. Click on a character's faction to see the faction page. Click on a rival to see who that rival is. The whole graph is explorable through these connections.

### Search and Filter
Find entities by name, kind, culture, tags. Filter the wiki down to "all Aurora merchants" or "all factions with the 'militant' tag" or "all events during the Trade Wars era".

### Static Pages
Hand-written content (like what you're reading now) lives alongside generated content. Lore overviews, system documentation, cultural guides - these provide context for the generated material.

### Graph Visualization
Relationship maps showing how entities connect. See a character's web of relationships, a faction's sphere of influence, a region's political landscape.

---

## Design Philosophy

Chronicler is built on a few principles:

### Everything Links
No dead ends. Every entity mentioned in text should be clickable. Every relationship should be navigable in both directions. The wiki is a web; act like it.

### Context First
When you land on a page, you should immediately understand what you're looking at. Entity kind, culture, prominence - the key facts are visible before you start reading.

### Graceful Degradation
Not all entities are equally enriched. Some have detailed descriptions; some have stubs. Chronicler handles both, showing what's available without making sparse content feel broken.

### Mobile Friendly
Because sometimes you want to read about penguin politics on your phone. The layout adapts; the content remains accessible.

---

## What It Doesn't Do

Chronicler is read-only. You can't edit content through the wiki interface. You can't create new entities or modify relationships. That's by design - the wiki presents what the simulation generated, not what users wish existed.

(There are authoring tools - Canonry for configuration, Illuminator for enrichment - but they're separate from the reading experience.)

Chronicler also doesn't do:
- User accounts or personalization
- Comments or discussion
- Edit history or versioning
- Translation or localization

It's a viewer. It views things. That's the scope.

---

## The Reading Experience

Ideally, using Chronicler feels like exploring a real wiki about a real world. You click on something that catches your interest. That leads to something else. An hour later, you've learned about trade disputes between Aurora merchant guilds, the assassination techniques of Nightshelf shadow-walkers, and the mating rituals of orca pods.

You might forget the content was generated. That's the goal.

---

## Still Growing

Chronicler is actively developed. New features get added. The interface gets refined. The connection to upstream systems (Lore Weave, Illuminator) gets tighter.

What you're seeing now is a snapshot. Check back later and things will have changed - probably more content, hopefully better navigation, definitely bugs we haven't found yet.

That's the nature of procedural projects. They're never finished. They just keep generating.