/**
 * Profile Executor (Phase 4)
 *
 * Resolves profiles and executes naming strategies.
 */

import { createRNG } from "../utils/rng.js";
import { generateWordWithDebug } from "./phonology.js";
import { applyMorphologyBest, canApplyMorphology } from "./morphology.js";
import { applyStyle } from "./style.js";
import type { NamingDomain } from "../types/domain.js";
import type {
  NamingProfile,
  NamingStrategy,
  PhonotacticStrategy,
  TemplatedStrategy,
  DerivedFromEntityStrategy,
  CompoundStrategy,
  SlotConfig,
  LexemeList,
  GrammarRule,
  TransformConfig,
  StrategyConditions,
} from "../types/profile.js";
import type { EntityLookup, Entity } from "../types/integration.js";
import type { Prominence } from "../types/domain.js";

/**
 * Entity attributes for conditional strategy selection
 */
export interface EntityAttributes {
  /** Entity tags for condition matching */
  tags?: string[];
  /** Entity prominence level */
  prominence?: Prominence;
  /** Entity subtype for condition matching */
  subtype?: string;
}

/**
 * Context for strategy execution
 */
export interface ExecutionContext {
  domains: NamingDomain[];
  profiles: NamingProfile[];
  lexemeLists: LexemeList[];
  grammarRules: GrammarRule[];
  seed?: string;
  entityLookup?: EntityLookup; // For derivedFromEntity strategies

  /** Entity attributes for conditional strategy selection */
  entityAttributes?: EntityAttributes;

  /** Related entity names for named entity propagation
   * e.g., { owner: "Duke Zixtrex", parent: "King Gorban", founder: "Lady Elmara" }
   */
  relatedEntities?: Record<string, string>;
}

/**
 * Resolve profile for a given culture + type
 * Phase 4A: Basic resolution
 */
export function resolveProfile(
  cultureId: string,
  type: string,
  profiles: NamingProfile[]
): NamingProfile | null {
  // Exact match: cultureId + type
  const exactMatch = profiles.find(
    (p) => p.cultureId === cultureId && p.type === type
  );

  if (exactMatch) {
    return exactMatch;
  }

  // Fallback: match by type only (for default profiles)
  const typeMatch = profiles.find((p) => p.type === type && !p.cultureId);

  return typeMatch || null;
}

/**
 * Check if a strategy's conditions match the entity attributes
 * Returns true if the strategy should be considered for selection
 */
function matchesConditions(
  conditions: StrategyConditions | undefined,
  attributes: EntityAttributes | undefined
): boolean {
  // No conditions means always matches
  if (!conditions) {
    return true;
  }

  // Check tag conditions
  if (conditions.tags && conditions.tags.length > 0) {
    const entityTags = attributes?.tags || [];

    if (conditions.requireAllTags) {
      // ALL specified tags must be present
      const hasAll = conditions.tags.every((tag) => entityTags.includes(tag));
      if (!hasAll) return false;
    } else {
      // ANY specified tag must be present
      const hasAny = conditions.tags.some((tag) => entityTags.includes(tag));
      if (!hasAny) return false;
    }
  }

  // Check prominence conditions
  if (conditions.prominence && conditions.prominence.length > 0) {
    const entityProminence = attributes?.prominence;
    if (!entityProminence || !conditions.prominence.includes(entityProminence)) {
      return false;
    }
  }

  // Check subtype conditions
  if (conditions.subtype && conditions.subtype.length > 0) {
    const entitySubtype = attributes?.subtype;
    if (!entitySubtype || !conditions.subtype.includes(entitySubtype)) {
      return false;
    }
  }

  return true;
}

/**
 * Select a strategy from a profile using weighted random selection
 * Filters strategies by conditions before selection
 */
export function selectStrategy(
  profile: NamingProfile,
  seed?: string,
  entityAttributes?: EntityAttributes
): NamingStrategy | null {
  if (profile.strategies.length === 0) {
    return null;
  }

  // Filter strategies by conditions
  const eligibleStrategies = profile.strategies.filter((s) =>
    matchesConditions(s.conditions, entityAttributes)
  );

  if (eligibleStrategies.length === 0) {
    // No eligible strategies - fall back to unconditional strategies
    const unconditionalStrategies = profile.strategies.filter(
      (s) => !s.conditions
    );
    if (unconditionalStrategies.length === 0) {
      return null;
    }
    // Use unconditional strategies
    return selectFromStrategies(unconditionalStrategies, seed);
  }

  return selectFromStrategies(eligibleStrategies, seed);
}

/**
 * Weighted random selection from a list of strategies
 */
function selectFromStrategies(
  strategies: NamingStrategy[],
  seed?: string
): NamingStrategy {
  if (strategies.length === 1) {
    return strategies[0];
  }

  const rng = createRNG(seed);
  const totalWeight = strategies.reduce((sum, s) => sum + s.weight, 0);

  if (totalWeight === 0) {
    // All weights are zero, pick first
    return strategies[0];
  }

  let roll = rng() * totalWeight;

  for (const strategy of strategies) {
    roll -= strategy.weight;
    if (roll <= 0) {
      return strategy;
    }
  }

  // Fallback (shouldn't happen)
  return strategies[strategies.length - 1];
}

/**
 * Generate a name from a profile
 * Phase 4A: phonotactic strategy only
 * Phase 4D: + conditional strategy selection based on entity attributes
 */
export function generateFromProfile(
  profile: NamingProfile,
  context: ExecutionContext
): string {
  const strategy = selectStrategy(profile, context.seed, context.entityAttributes);

  if (!strategy) {
    throw new Error(`No strategies available for profile ${profile.id}`);
  }

  return executeStrategy(strategy, context);
}

/**
 * Execute a naming strategy
 * Phase 4A: phonotactic
 * Phase 4B: + templated
 * Phase 4C: + derivedFromEntity, compound
 */
export function executeStrategy(
  strategy: NamingStrategy,
  context: ExecutionContext
): string {
  switch (strategy.kind) {
    case "phonotactic":
      return executePhonotacticStrategy(strategy, context);

    case "templated":
      return executeTemplatedStrategy(strategy, context);

    case "derivedFromEntity":
      return executeDerivedFromEntityStrategy(strategy, context);

    case "compound":
      return executeCompoundStrategy(strategy, context);

    default:
      throw new Error(`Unknown strategy kind: ${(strategy as any).kind}`);
  }
}

/**
 * Phase 4A: Execute phonotactic strategy
 * Calls existing domain generator
 */
function executePhonotacticStrategy(
  strategy: PhonotacticStrategy,
  context: ExecutionContext
): string {
  const domain = context.domains.find((d) => d.id === strategy.domainId);

  if (!domain) {
    throw new Error(
      `Domain not found: ${strategy.domainId} (referenced by strategy ${strategy.id})`
    );
  }

  // Generate name using existing domain system (same as generator.ts)
  const rng = createRNG(context.seed);

  // Step 1: Generate phonological base
  const { word } = generateWordWithDebug(rng, domain.phonology);

  // Step 2: Apply morphology (if configured)
  let morphedName = word;
  if (canApplyMorphology(domain.morphology)) {
    const morphed = applyMorphologyBest(rng, word, domain.morphology);
    morphedName = morphed.result;
  }

  // Step 3: Apply style transforms
  const styled = applyStyle(rng, morphedName, domain.style);

  return styled.result;
}

/**
 * Phase 4B: Execute templated strategy
 * Fills template slots with sub-generators
 */
function executeTemplatedStrategy(
  strategy: TemplatedStrategy,
  context: ExecutionContext
): string {
  let result = strategy.template;

  // Find all slots in template ({{slotName}})
  const slotPattern = /\{\{(\w+)\}\}/g;
  const slots = new Map<string, string>();

  // Fill each slot
  for (const [slotName, slotConfig] of Object.entries(strategy.slots)) {
    const slotValue = fillSlot(slotConfig, context);
    slots.set(slotName, slotValue);
  }

  // Replace slots in template
  result = result.replace(slotPattern, (match, slotName) => {
    return slots.get(slotName) || match;
  });

  return result;
}

/**
 * Fill a template slot based on its configuration
 * Phase 4A: phonotactic
 * Phase 4B: + lexemeList
 * Phase 4C: + grammar, entityName, subGenerator
 * Phase 4D: + context (named entity propagation)
 */
function fillSlot(slotConfig: SlotConfig, context: ExecutionContext): string {
  switch (slotConfig.kind) {
    case "phonotactic": {
      const domain = context.domains.find((d) => d.id === slotConfig.domainId);
      if (!domain) {
        throw new Error(`Domain not found: ${slotConfig.domainId}`);
      }
      const rng = createRNG(context.seed);
      const { word } = generateWordWithDebug(rng, domain.phonology);
      let morphedName = word;
      if (canApplyMorphology(domain.morphology)) {
        const morphed = applyMorphologyBest(rng, word, domain.morphology);
        morphedName = morphed.result;
      }
      const styled = applyStyle(rng, morphedName, domain.style);
      return styled.result;
    }

    case "lexemeList": {
      const list = context.lexemeLists.find((l) => l.id === slotConfig.listId);
      if (!list) {
        throw new Error(`Lexeme list not found: ${slotConfig.listId}`);
      }
      const rng = createRNG(context.seed);
      const index = Math.floor(rng() * list.entries.length);
      return list.entries[index];
    }

    case "grammar": {
      const grammar = context.grammarRules.find(
        (g) => g.id === slotConfig.grammarId
      );
      if (!grammar) {
        throw new Error(`Grammar rule not found: ${slotConfig.grammarId}`);
      }
      return expandGrammar(grammar, context);
    }

    case "entityName": {
      // Look up entity in KG and use its name
      if (!context.entityLookup) {
        throw new Error("entityName slot requires entityLookup in context");
      }

      // EntityName slots need a selector - for now, this is a placeholder
      // In practice, the selector would come from the slot config
      // For now, this is handled by derivedFromEntity strategy instead
      throw new Error(
        "entityName slot should be used within derivedFromEntity strategy transform"
      );
    }

    case "subGenerator": {
      const profile = context.profiles.find(
        (p) => p.id === slotConfig.profileId
      );
      if (!profile) {
        throw new Error(`Profile not found: ${slotConfig.profileId}`);
      }

      // If specific strategy requested, use it
      if (slotConfig.strategyId) {
        const strategy = profile.strategies.find(
          (s) => s.id === slotConfig.strategyId
        );
        if (!strategy) {
          throw new Error(
            `Strategy ${slotConfig.strategyId} not found in profile ${slotConfig.profileId}`
          );
        }
        return executeStrategy(strategy, context);
      }

      // Otherwise, weighted random selection
      return generateFromProfile(profile, context);
    }

    case "context": {
      // Phase 4D: Look up related entity name from context
      const key = slotConfig.key;
      const value = context.relatedEntities?.[key];

      if (value !== undefined) {
        return value;
      }

      // Use fallback if provided
      if (slotConfig.fallback !== undefined) {
        return slotConfig.fallback;
      }

      throw new Error(
        `Context key '${key}' not found in relatedEntities and no fallback provided`
      );
    }

    default:
      throw new Error(`Unknown slot kind: ${(slotConfig as any).kind}`);
  }
}

/**
 * Phase 4C: Expand grammar rule
 */
function expandGrammar(
  grammar: GrammarRule,
  context: ExecutionContext
): string {
  // Pattern like "V-P-O" or "ADJ NOUN"
  const symbols = grammar.pattern.split(/(\s|-)/);

  const parts: string[] = [];

  for (const symbol of symbols) {
    // Preserve whitespace and punctuation
    if (/^\s$/.test(symbol) || symbol === "-") {
      parts.push(symbol);
      continue;
    }

    // Look up symbol in sources
    const slotConfig = grammar.symbolSources[symbol];
    if (!slotConfig) {
      throw new Error(
        `Symbol ${symbol} not defined in grammar ${grammar.id}`
      );
    }

    parts.push(fillSlot(slotConfig, context));
  }

  return parts.join("");
}

/**
 * Execute derivedFromEntity strategy
 * Finds an entity in the KG and transforms its name
 */
function executeDerivedFromEntityStrategy(
  strategy: DerivedFromEntityStrategy,
  context: ExecutionContext
): string {
  if (!context.entityLookup) {
    throw new Error(
      `derivedFromEntity strategy requires entityLookup in context (strategy: ${strategy.id})`
    );
  }

  // Find entity using selector
  const entity = context.entityLookup.findEntity(strategy.sourceSelector);

  if (!entity) {
    throw new Error(
      `No entity found matching selector in strategy ${strategy.id}: ${JSON.stringify(strategy.sourceSelector)}`
    );
  }

  // Transform the entity's name
  return transformEntityName(entity, strategy.transform, context);
}

/**
 * Transform an entity's name according to transformation config
 */
function transformEntityName(
  entity: Entity,
  transform: TransformConfig,
  context: ExecutionContext
): string {
  switch (transform.kind) {
    case "identity":
      // Use name as-is
      return entity.name;

    case "prefix":
      // Add prefix to name
      return `${transform.prefix || ""}${entity.name}`;

    case "suffix":
      // Add suffix to name
      return `${entity.name}${transform.suffix || ""}`;

    case "templated": {
      // Fill template with entity name and optional additional slots
      if (!transform.template) {
        throw new Error("Templated transform requires template string");
      }

      let result = transform.template;

      // Replace {{name}} with entity name
      result = result.replace(/\{\{name\}\}/g, entity.name);

      // Fill additional slots if provided
      if (transform.slots) {
        for (const [slotName, slotConfig] of Object.entries(transform.slots)) {
          const slotValue = fillSlot(slotConfig, context);
          result = result.replace(new RegExp(`\\{\\{${slotName}\\}\\}`, "g"), slotValue);
        }
      }

      return result;
    }

    default:
      throw new Error(`Unknown transform kind: ${(transform as any).kind}`);
  }
}

/**
 * Phase 4C: Execute compound strategy
 */
function executeCompoundStrategy(
  strategy: CompoundStrategy,
  context: ExecutionContext
): string {
  const separator = strategy.separator || "";
  const parts = strategy.parts.map((part) => fillSlot(part, context));
  return parts.join(separator);
}
