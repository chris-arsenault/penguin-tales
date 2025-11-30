/**
 * Entity Selection
 *
 * Handles entity selection for simulation rules, including scored selection.
 */

import type { SelectionSpec, ScoringSpec } from '@canonry/world-schema';
import type { RuntimeEntity, ExecutionContext } from './types.js';
import { queryEntities, randomPickN, seededRandom } from './conditions.js';
import { resolveEntityRef, resolveCount, createEntities } from './entities.js';

// ============================================================================
// SCORING
// ============================================================================

/**
 * Score an entity based on scoring specification
 */
function scoreEntity(
  entity: RuntimeEntity,
  scoring: ScoringSpec,
  ctx: ExecutionContext
): number {
  let score = 1.0;

  // Preferences (increase score)
  if (scoring.prefer) {
    const boost = scoring.prefer.boost ?? 1.5;

    // Same location preference
    if (scoring.prefer.sameLocationAs) {
      const targets = resolveEntityRef(scoring.prefer.sameLocationAs, ctx);
      if (targets.length > 0) {
        const target = targets[0];
        if (target.coordinates && entity.coordinates) {
          // Calculate distance
          const dx = entity.coordinates.x - target.coordinates.x;
          const dy = entity.coordinates.y - target.coordinates.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Closer = higher boost
          if (dist < 0.2) {
            score *= boost;
          } else if (dist < 0.5) {
            score *= boost * 0.5;
          }
        }
      }
    }

    // Same culture preference
    if (scoring.prefer.sameCultureAs) {
      let targetCultureId: string | undefined;

      if (typeof scoring.prefer.sameCultureAs === 'string') {
        targetCultureId = scoring.prefer.sameCultureAs;
      } else {
        const targets = resolveEntityRef(scoring.prefer.sameCultureAs, ctx);
        if (targets.length > 0) {
          targetCultureId = targets[0].cultureId;
        }
      }

      if (targetCultureId && entity.cultureId === targetCultureId) {
        score *= boost;
      }
    }

    // Subtype preference
    if (scoring.prefer.subtypes && scoring.prefer.subtypes.includes(entity.subtype)) {
      score *= boost;
    }

    // Tag preference
    if (scoring.prefer.hasTags) {
      const matchingTags = scoring.prefer.hasTags.filter(t => entity.tags.includes(t));
      if (matchingTags.length > 0) {
        score *= boost * (1 + matchingTags.length * 0.1);
      }
    }
  }

  // Avoidances (decrease score)
  if (scoring.avoid) {
    // Count relationships
    const relationshipCount = countRelationships(entity.id, ctx);

    // Hub penalty
    if (scoring.avoid.hubPenalty && relationshipCount > 5) {
      const penalty = Math.pow(scoring.avoid.hubPenalty, relationshipCount - 5);
      score *= penalty;
    }

    // Hard cutoff
    if (scoring.avoid.maxRelationships !== undefined && relationshipCount >= scoring.avoid.maxRelationships) {
      score = 0;
    }

    // Specific relationship avoidance
    if (scoring.avoid.hasRelationships) {
      for (const relKind of scoring.avoid.hasRelationships) {
        if (hasRelationshipKind(entity.id, relKind, ctx)) {
          score *= 0.5;
        }
      }
    }

    // Cross-culture penalty
    if (scoring.avoid.differentCulturePenalty) {
      // This would be applied when comparing against a reference entity
      // For now, we just note it's available
    }
  }

  return score;
}

/**
 * Count all relationships an entity has
 */
function countRelationships(entityId: string, ctx: ExecutionContext): number {
  let count = 0;
  for (const rel of ctx.state.relationships.values()) {
    if (rel.archived) continue;
    if (rel.srcId === entityId || rel.dstId === entityId) {
      count++;
    }
  }
  return count;
}

/**
 * Check if entity has a specific relationship kind
 */
function hasRelationshipKind(entityId: string, kind: string, ctx: ExecutionContext): boolean {
  for (const rel of ctx.state.relationships.values()) {
    if (rel.archived) continue;
    if (rel.kind === kind && (rel.srcId === entityId || rel.dstId === entityId)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// SELECTION STRATEGIES
// ============================================================================

/**
 * Random selection from candidates
 */
function selectRandom(
  candidates: RuntimeEntity[],
  count: number,
  ctx: ExecutionContext
): RuntimeEntity[] {
  return randomPickN(ctx.state, candidates, count);
}

/**
 * Scored selection - weight by score, then sample
 */
function selectScored(
  candidates: RuntimeEntity[],
  count: number,
  scoring: ScoringSpec,
  ctx: ExecutionContext
): RuntimeEntity[] {
  if (candidates.length === 0) return [];
  if (candidates.length <= count) return [...candidates];

  // Calculate scores
  const scored = candidates.map(entity => ({
    entity,
    score: scoreEntity(entity, scoring, ctx),
  }));

  // Filter out zero scores
  const viable = scored.filter(s => s.score > 0);
  if (viable.length === 0) return [];

  // Weighted random selection
  const selected: RuntimeEntity[] = [];
  const remaining = [...viable];

  for (let i = 0; i < count && remaining.length > 0; i++) {
    const totalScore = remaining.reduce((sum, s) => sum + s.score, 0);
    let roll = seededRandom(ctx.state) * totalScore;

    for (let j = 0; j < remaining.length; j++) {
      roll -= remaining[j].score;
      if (roll <= 0) {
        selected.push(remaining[j].entity);
        remaining.splice(j, 1);
        break;
      }
    }
  }

  return selected;
}

// ============================================================================
// MAIN SELECTION FUNCTION
// ============================================================================

/**
 * Execute a selection specification
 */
export function executeSelection(
  spec: SelectionSpec,
  ctx: ExecutionContext
): RuntimeEntity[] {
  // Find candidates
  const candidates = queryEntities(ctx.state, spec.query);

  // Determine how many to select
  const count = resolveCount(spec.count, ctx);

  let selected: RuntimeEntity[];

  if (spec.strategy === 'scored' && spec.scoring) {
    selected = selectScored(candidates, count, spec.scoring, ctx);

    // Handle createIfNone
    if (spec.scoring.createIfNone && selected.length < count) {
      const bestScore = selected.length > 0
        ? Math.max(...selected.map(e => scoreEntity(e, spec.scoring!, ctx)))
        : 0;

      if (bestScore < spec.scoring.createIfNone.threshold) {
        const toCreate = Math.min(
          count - selected.length,
          spec.scoring.createIfNone.maxCreate
        );

        if (toCreate > 0) {
          const template = {
            ...spec.scoring.createIfNone.template,
            count: toCreate,
          };
          const created = createEntities(template, ctx);
          selected.push(...created);
        }
      }
    }
  } else {
    selected = selectRandom(candidates, count, ctx);
  }

  // Store in context for reference
  ctx.selectedEntities.set(spec.ref, selected);

  return selected;
}

/**
 * Execute multiple selections
 */
export function executeSelections(
  specs: SelectionSpec[],
  ctx: ExecutionContext
): Map<string, RuntimeEntity[]> {
  const result = new Map<string, RuntimeEntity[]>();

  for (const spec of specs) {
    const selected = executeSelection(spec, ctx);
    result.set(spec.ref, selected);
  }

  return result;
}
