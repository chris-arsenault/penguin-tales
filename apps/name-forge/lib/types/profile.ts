/**
 * Naming Profile Types (Phase 4)
 *
 * Adds strategic layer on top of phonotactic domains to support:
 * - Different entity types (person, battle, spell, location, etc.)
 * - Multiple naming strategies per type (weighted selection)
 * - Complex name composition (templates, derivation, grammars)
 */

import { z } from "zod";
import type { AppliesTo, Prominence } from "./domain.js";

/**
 * Slot configuration for template filling
 * Phase 4A: phonotactic only
 * Phase 4B: + lexemeList
 * Phase 4C: + grammar, entityName, subGenerator
 * Phase 4D: + context (for named entity propagation)
 */
export type SlotKind = "phonotactic" | "lexemeList" | "grammar" | "entityName" | "subGenerator" | "context" | "markov";

export const SlotConfigSchema = z.discriminatedUnion("kind", [
  // Phase 4A: Generate from phonotactic domain
  z.object({
    kind: z.literal("phonotactic"),
    domainId: z.string().describe("Which phonotactic domain to use"),
  }),

  // Phase 4B: Pick from word list
  z.object({
    kind: z.literal("lexemeList"),
    listId: z.string().describe("Which lexeme list to use"),
  }),

  // Phase 4C: Expand micro-grammar
  z.object({
    kind: z.literal("grammar"),
    grammarId: z.string().describe("Which grammar rule to expand"),
  }),

  // Phase 4C: Use existing entity's name
  z.object({
    kind: z.literal("entityName"),
    // Additional config for entity selection will be added in Phase 4C
  }),

  // Phase 4C: Recursively call another profile/strategy
  z.object({
    kind: z.literal("subGenerator"),
    profileId: z.string().describe("Which profile to call"),
    strategyId: z.string().optional().describe("Specific strategy, or weighted random"),
  }),

  // Phase 4D: Use context value (for named entity propagation)
  z.object({
    kind: z.literal("context"),
    key: z.string().describe("Key to look up in relatedEntities context, e.g., 'owner', 'parent', 'founder'"),
    fallback: z.string().optional().describe("Fallback value if key not found in context"),
  }),

  // Phase 4E: Generate from Markov chain model
  z.object({
    kind: z.literal("markov"),
    modelId: z.string().describe("Which Markov model to use (norse, germanic, finnish, arabic, celtic, slavic, latin, japanese, african)"),
  }),
]);

export type SlotConfig = z.infer<typeof SlotConfigSchema>;

/**
 * Strategy kinds
 * - phonotactic: Pure phonotactic generation
 * - derivedFromEntity: Transform existing entity name
 * - compound: Combine multiple parts
 */
export type StrategyKind = "phonotactic" | "derivedFromEntity" | "compound";

/**
 * Group conditions for conditional activation
 * Groups with conditions are only used when entity matches
 */
export interface GroupConditions {
  /** Group only used if entity has ANY of these tags (or ALL if requireAllTags) */
  tags?: string[];
  /** If true, require ALL tags instead of ANY */
  requireAllTags?: boolean;
  /** Group only used if entity has one of these prominence levels */
  prominence?: Prominence[];
  /** Group only used if entity subtype matches */
  subtype?: string[];
}

/**
 * Strategy Group - contains strategies with shared conditions
 * Selection algorithm:
 * 1. Find all groups whose conditions match the entity
 * 2. Select the group with highest priority
 * 3. Use weighted random selection within that group's strategies
 */
export interface StrategyGroup {
  /** Optional name for display purposes */
  name?: string;
  /** Higher priority groups are checked first (default: 0) */
  priority: number;
  /** Conditions that must match for this group to be considered (null = always matches) */
  conditions: GroupConditions | null;
  /** Strategies in this group with relative weights */
  strategies: NamingStrategy[];
}

/**
 * Base strategy interface
 */
export interface NamingStrategyBase {
  id: string;
  kind: StrategyKind;
  weight: number;
}

/**
 * Phase 4A: Pure phonotactic generation
 * Calls an existing NamingDomain generator
 */
export interface PhonotacticStrategy extends NamingStrategyBase {
  kind: "phonotactic";
  domainId: string;
}

/**
 * Derived from existing entity
 * Finds an entity in the KG and transforms its name
 */
export interface DerivedFromEntityStrategy extends NamingStrategyBase {
  kind: "derivedFromEntity";
  sourceType: string; // Entity type to search for
  sourceSelector: EntitySelectorConfig;
  transform: TransformConfig;
}

/**
 * Phase 4C: Compound strategy
 * Combines multiple strategies/generators
 */
export interface CompoundStrategy extends NamingStrategyBase {
  kind: "compound";
  parts: SlotConfig[];
  separator?: string;
}

/**
 * Union type for all strategies
 */
export type NamingStrategy =
  | PhonotacticStrategy
  | DerivedFromEntityStrategy
  | CompoundStrategy;

/**
 * Naming Profile
 * Defines how to generate names for a specific culture + entity type
 *
 * Uses strategyGroups for priority-based conditional selection:
 * - Groups are ordered by priority (highest first)
 * - First matching group's strategies are used
 * - Within a group, weighted random selection
 */
export interface NamingProfile {
  id: string; // e.g., "dwarf_mountain:person", "elf_high:battle"
  cultureId: string; // Culture/domain identifier
  type: string; // Entity type: "person", "battle", "spell", "location", etc.
  appliesTo?: AppliesTo; // Optional matching criteria (kind, subKind, tags)

  /** Strategy groups with priority-based selection */
  strategyGroups?: StrategyGroup[];
}

export const GroupConditionsSchema = z.object({
  tags: z.array(z.string()).optional(),
  requireAllTags: z.boolean().optional(),
  prominence: z.array(z.string()).optional(),
  subtype: z.array(z.string()).optional(),
});

export const StrategyGroupSchema = z.object({
  name: z.string().optional(),
  priority: z.number().default(0),
  conditions: GroupConditionsSchema.nullable(),
  strategies: z.array(z.any()), // Will refine with discriminated union later
});

export const NamingProfileSchema = z.object({
  id: z.string(),
  cultureId: z.string(),
  type: z.string(),
  appliesTo: z
    .object({
      kind: z.array(z.string()).optional(),
      subKind: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  strategyGroups: z.array(StrategyGroupSchema).optional(),
});

/**
 * Entity selector configuration
 * Used by derivedFromEntity strategy to find entities in KG
 * Maps to EntitySelector from integration.ts
 */
export interface EntitySelectorConfig {
  type?: string;
  subType?: string;
  tags?: string[];
  requireAllTags?: boolean;
  relatedTo?: string;
  relationshipKind?: string;
  nearbyTo?: string;
  maxDistance?: number;
  hasProperty?: string;
  propertyValue?: { key: string; value: any };
  strategy?: "random" | "first" | "closest" | "highest_prominence";
  limit?: number;
  seed?: string;
}

/**
 * Transform configuration
 * How to transform an entity name into a new name
 */
export interface TransformConfig {
  kind: "templated" | "prefix" | "suffix" | "identity";
  template?: string; // For "templated": "The Battle of {{name}}"
  prefix?: string; // For "prefix": "Saint "
  suffix?: string; // For "suffix": " the Great"
  slots?: Record<string, SlotConfig>; // Additional slots for templated transforms
}

/**
 * Phase 4B: Lexeme List
 * Word lists for template slots
 */
export interface LexemeList {
  id: string;
  description?: string;
  entries: string[];
}

export const LexemeListSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  entries: z.array(z.string()).min(1),
});

/**
 * Phase 4C: Grammar Rule
 * Micro-CFG for phrase generation
 */
export interface GrammarRule {
  id: string;
  description?: string;
  pattern: string; // e.g., "V-P-O" or "ADJ NOUN"
  symbolSources: Record<string, SlotConfig>;
}

export const GrammarRuleSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  pattern: z.string(),
  symbolSources: z.record(z.any()), // SlotConfigSchema
});

/**
 * Profile Collection
 * For loading multiple profiles from a single file
 */
export interface ProfileCollection {
  profiles: NamingProfile[];
  lexemeLists?: LexemeList[];
  grammarRules?: GrammarRule[];
}

export const ProfileCollectionSchema = z.object({
  profiles: z.array(NamingProfileSchema),
  lexemeLists: z.array(LexemeListSchema).optional(),
  grammarRules: z.array(GrammarRuleSchema).optional(),
});
