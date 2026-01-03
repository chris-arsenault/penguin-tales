# Image Generation System

## Overview

The world generator now supports automatic image generation for **mythic entities** using OpenAI's DALL-E 3. Images are generated at the end of world generation, creating visual representations of the most significant entities in the world.

## Setup

### 1. Install Dependencies

The OpenAI SDK is already included in `package.json`:

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file (or copy `.env.example`) and add:

```bash
# Enable image generation
IMAGE_GENERATION_ENABLED=true

# OpenAI API key
OPENAI_API_KEY=sk-...

# Optional: Configure image parameters
IMAGE_MODEL=dall-e-3           # default: dall-e-3
IMAGE_SIZE=1024x1024           # options: 1024x1024 | 1792x1024 | 1024x1792
IMAGE_QUALITY=standard         # options: standard | hd
```

### 3. Run World Generation

```bash
npm start
```

Images will be generated automatically for all mythic entities at the end of the run.

## How It Works

### Mythic-Only Generation

Only entities with `prominence: 'mythic'` receive images. This typically includes:
- **Locations**: The most legendary places (Aurora Stack, Glow-Fissure)
- **Factions**: The most powerful organizations (The Icebound Exchange, The Midnight Claws)
- **NPCs**: Legendary heroes and infamous outlaws (Tide-Splitter Rukan, Fissure-Walker Draen)
- **Abilities**: The most powerful magic/technology
- **Rules**: Culturally defining laws or taboos

### Prompt Construction

Each image prompt includes three components:

#### 1. World Context
```
A frozen Antarctic world of super-intelligent penguins living on massive icebergs.
The character is an anthropomorphic penguin with human-like intelligence and personality.
```

This ensures all images share the penguin/Antarctic theme, even though entity descriptions may not explicitly mention penguins.

#### 2. Entity Description
```
Tide-Splitter Rukan: A daring super-penguin hero of Aurora Stack, whose experimental fishing gun techniques doubled the colony's catch.
A legendary penguin hero, depicted in a heroic, larger-than-life pose.
```

Combines the entity's lore description with subtype-specific guidance.

#### 3. Style Guidance
```
Style: Digital illustration, dramatic lighting, Antarctic color palette (blues, whites, teals, purples).
Character portrait style, focus on personality and details.
```

Ensures visual consistency across all generated images.

### Entity-Specific Styles

Different entity kinds receive different artistic treatments:

| Entity Kind | Style Guidance |
|-------------|----------------|
| **NPC** | Character portrait style, focus on personality and details |
| **Location** | Wide establishing shot, atmospheric, sense of scale |
| **Faction** | Group composition or symbolic representation |
| **Abilities** | Abstract magical/technological effects, ethereal and dynamic |
| **Rules** | Symbolic or metaphorical imagery, cultural significance |

## Output

### Directory Structure

```
output/
  images/
    npc_tide_splitter_rukan_1234567890.png
    location_aurora_stack_1234567890.png
    faction_the_midnight_claws_1234567890.png
    image_metadata.json
  image_generation.log
```

### Metadata File

`output/images/image_metadata.json` contains:

```json
{
  "generatedAt": "2025-11-23T06:30:00.000Z",
  "totalImages": 6,
  "results": [
    {
      "entityId": "npc-012",
      "entityName": "Tide-Splitter Rukan",
      "entityKind": "npc",
      "prompt": "A frozen Antarctic world...",
      "localPath": "output/images/npc_tide_splitter_rukan_1234567890.png"
    }
  ]
}
```

### Log File

`output/image_generation.log` contains detailed logs:

```
=== Image Generation Log - 2025-11-23T06:30:00.000Z ===

Generating images for 6 mythic entities...

=== Generating Image for Tide-Splitter Rukan ===
Entity: npc:hero
Prompt: A frozen Antarctic world of super-intelligent penguins...

✓ Image generated: https://oaidalleapiprodscus.blob.core.windows.net/...
✓ Saved to: /home/user/output/images/npc_tide_splitter_rukan_1234567890.png
```

## Cost Considerations

### DALL-E 3 Pricing (as of 2024)
- **Standard quality (1024x1024)**: $0.040 per image
- **HD quality (1024x1024)**: $0.080 per image

### Typical World Generation
A standard run produces 150-200 entities:
- **Mythic entities**: ~5-10 (3-5% of total)
- **Cost**: $0.20 - $0.40 at standard quality
- **Cost**: $0.40 - $0.80 at HD quality

### Rate Limiting

The service includes automatic rate limiting:
- **1 second delay** between each image generation
- Prevents API rate limit errors
- Total time: ~5-10 seconds for typical run

## Example Prompts

### NPC (Hero)
```
A frozen Antarctic world of super-intelligent penguins living on massive icebergs. The character is an anthropomorphic penguin with human-like intelligence and personality.

Tide-Splitter Rukan: A daring super-penguin hero of Aurora Stack, whose experimental fishing gun techniques doubled the colony's catch. A legendary penguin hero, depicted in a heroic, larger-than-life pose.

Style: Digital illustration, dramatic lighting, Antarctic color palette (blues, whites, teals, purples). Character portrait style, focus on personality and details.
```

### Location (Colony)
```
A frozen Antarctic world of super-intelligent penguins living on massive icebergs. This is a location on or near the massive iceberg Aurora Berg, in a frozen Antarctic seascape.

Aurora Stack: A vertical colony carved into the sunlit face of Aurora Berg, known for orderly terraces and bright trade banners. A bustling penguin settlement carved into ice, with architectural details.

Style: Digital illustration, dramatic lighting, Antarctic color palette (blues, whites, teals, purples). Wide establishing shot, atmospheric, sense of scale.
```

### Faction (Criminal)
```
A frozen Antarctic world of super-intelligent penguins living on massive icebergs. This represents a penguin organization or group, shown through its members and symbols.

The Midnight Claws: A clandestine syndicate ruling Nightfall Shelf from the shadows, smuggling forbidden tech and siphoning magic from the Glow-Fissure. A shadowy syndicate, depicted through darkness and secrecy.

Style: Digital illustration, dramatic lighting, Antarctic color palette (blues, whites, teals, purples). Group composition or symbolic representation.
```

## Console Output

When image generation is enabled, you'll see:

```
=== Generating Images for Mythic Entities ===
✓ Generated 6 images
  Output: output/images
  Log: output/image_generation.log
  Metadata: output/images/image_metadata.json
```

## Troubleshooting

### No Images Generated

**Symptom**: "Generating images for 0 mythic entities"

**Cause**: No entities reached mythic prominence

**Solution**: Either:
- Run a longer simulation (increase distribution target totals)
- Manually boost entity prominence in initial state
- Check enrichment analytics to see if locations/factions became mythic

### API Key Errors

**Symptom**: "Error: Incorrect API key provided"

**Cause**: Invalid or missing OpenAI API key

**Solution**: Check your `.env` file:
```bash
OPENAI_API_KEY=sk-proj-...  # Must start with sk-
```

### Rate Limit Errors

**Symptom**: "Error: Rate limit exceeded"

**Cause**: Generating too many images too quickly

**Solution**: The service includes 1-second delays, but if you have many mythic entities:
- Use `standard` quality instead of `hd`
- Generate images in batches manually
- Wait a few minutes between runs

### Out of Memory

**Symptom**: Node crashes during image download

**Cause**: Large images being downloaded

**Solution**: Use smaller image size:
```bash
IMAGE_SIZE=1024x1024  # Smallest size
```

## Integration with Enrichment

Image generation complements the text enrichment system:

### Workflow
1. **World Generation**: Creates entities and relationships
2. **Text Enrichment** (Anthropic Claude): Generates lore for entities
3. **Image Generation** (OpenAI DALL-E): Visualizes mythic entities

### Separation of Concerns
- **Anthropic (Claude)**: All text generation (descriptions, lore, narratives)
- **OpenAI (DALL-E)**: Image generation only

This keeps each API focused on its strength.

## Future Enhancements

Potential improvements for future versions:

- [ ] Generate images for all prominent entities (not just mythic)
- [ ] Custom art styles via prompt templates
- [ ] Image-to-image variations for consistency
- [ ] Generate location maps/diagrams
- [ ] Relationship visualizations (faction hierarchies, etc.)
- [ ] Export to game asset formats

## Architecture

### Files Modified
- `src/services/imageGenerationService.ts` - New service for DALL-E integration
- `src/engine/worldEngine.ts` - Added `generateMythicImages()` method
- `src/main.ts` - Initialize and configure image generation service
- `package.json` - Added `openai` dependency
- `.env.example` - Documented environment variables

### Key Components

#### ImageGenerationService
- Manages OpenAI client initialization
- Builds prompts with world context
- Downloads images to local storage
- Logs all operations
- Handles errors and retries

#### WorldEngine Integration
- Calls image generation **after** enrichment
- Passes enrichment context to prompt builder
- Filters for mythic entities only
- Exports image metadata

### Design Decisions

1. **Why mythic-only?**
   - Cost optimization (5-10 images vs 150+ images)
   - Focus on most important entities
   - Matches enrichment priority system

2. **Why OpenAI instead of other providers?**
   - DALL-E 3 produces highest quality results
   - Best at understanding complex prompts
   - Good at maintaining style consistency

3. **Why download images locally?**
   - URLs expire after 60 minutes
   - Local copies ensure persistence
   - Enables offline viewing and export

4. **Why separate from enrichment?**
   - Different APIs (Anthropic vs OpenAI)
   - Independent enable/disable
   - Clearer separation of concerns
