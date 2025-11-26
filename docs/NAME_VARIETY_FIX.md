# Name Variety Fix

## Problem
Entities were getting duplicate or very similar names (e.g., three "Crescent Ledge" locations). Names lacked variety and creativity.

## Root Causes
1. **Small batch sizes** (6 entities max) - LLM couldn't see enough context to ensure variety across batches
2. **Naming and description together** - LLM focused on descriptions, treating names as afterthought
3. **No uniqueness tracking** - No feedback to prevent duplicates across batches
4. **Weak prompts** - Didn't explicitly forbid duplicates or encourage creativity
5. **Low temperature** (0.2) - Too deterministic for creative naming

## Solution

### 1. Separate Naming Phase (`batchGenerateNames`)
- **PHASE 1: Names First** - All entities get named in large batches (20 entities per batch)
- **PHASE 2: Descriptions Second** - Descriptions generated using finalized names
- This ensures lore text references final names, not placeholders

### 2. Increased Batch Size
- **Before**: 6 entities per batch
- **After**: 20 entities per batch for naming, 6 for descriptions
- Larger batches give LLM more context for uniqueness

### 3. Name Logging System (`nameLogger.ts`)
```typescript
class NameLogger {
  - Tracks every name change (old → new)
  - Detects duplicate names in real-time
  - Provides uniqueness statistics
  - Logs warnings for collisions
  - Generates final report with stats
}
```

**Output**: `output/name_changes.log`

### 4. Improved Prompts
New requirements explicitly included:
- ✅ Every name MUST be completely unique
- ✅ Names must be SIGNIFICANTLY different from each other
- ✅ Provides list of 30 most recent names to avoid
- ✅ BANNED patterns (generic descriptors, cardinal directions)
- ✅ Variety requirements (structures, themes, syllables)
- ✅ Creative metaphors and unexpected combinations

### 5. Higher Temperature
- **Before**: 0.2 (deterministic)
- **After**: 0.8 for naming (creative), 0.2 for descriptions (consistent)

### 6. Better System Prompt
```
"You generate unique, creative, memorable names.
Every name must be completely different. NO DUPLICATES.
Be bold and inventive."
```

## Files Changed

### New Files
- `src/services/nameLogger.ts` - Name tracking and statistics
- `NAME_VARIETY_FIX.md` - This documentation

### Modified Files
- `src/services/enrichmentService.ts`:
  - Added `nameLogger` instance
  - New `batchGenerateNames()` method (Phase 1)
  - Updated `enrichEntities()` to separate phases
  - Improved prompts with explicit uniqueness requirements
  - Higher temperature for naming

- `src/engine/worldEngine.ts`:
  - Added `finalizeNameLogging()` method
  - Exports name statistics

- `src/main.ts`:
  - Calls `engine.finalizeNameLogging()` before export

## Expected Results

### Name Uniqueness
- **Before**: Multiple duplicates (e.g., 3x "Crescent Ledge")
- **After**: 95%+ uniqueness rate

### Name Variety
- **Before**: Similar patterns, generic structures
- **After**:
  - Varied word structures (2-word, 3-word, compounds)
  - Mixed themes (geographic, mythical, functional, emotional)
  - Different syllable counts
  - Creative metaphors

### Logging Output
```
=== Name Change Log ===

[Tick 42] location_1014 (location): "South Perch" → "Shadowmelt Cavern"
[Tick 42] location_1015 (location): "North Perch" → "Tidemark Spire"
[Tick 42] location_1016 (location): "East Perch" → "Frostwhisper Shelf"

=== Final Name Statistics ===
Total name changes: 147
Unique names generated: 145
Duplicate names: 2
Uniqueness rate: 98.6%

⚠️  DUPLICATE NAMES DETECTED:
  • "Echo Hollow" used by 2 entities: location_34, location_89
```

## Testing
Run world generation and check:
1. `output/name_changes.log` - Review all name changes and uniqueness stats
2. Console output - Look for duplicate warnings during generation
3. Final statistics - Should see 95%+ uniqueness rate
4. Generated names - Should be varied and creative

## Future Improvements
- Track name similarity scores (Levenshtein distance)
- Reject names too similar to existing ones (e.g., "Frost Peak" vs "Frostpeak")
- Category-specific naming pools to ensure thematic variety
- Name generation with rejection sampling
