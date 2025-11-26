import { TagMetadata } from '../types/engine';
/**
 * Tag Registry
 *
 * Central registry of all tags used in the world generation system.
 * Based on analysis from tag-analysis.json with added governance rules,
 * relationships, and consolidation opportunities.
 */
export declare const tagRegistry: TagMetadata[];
/**
 * Helper function to get tag metadata by tag name
 */
export declare function getTagMetadata(tag: string): TagMetadata | undefined;
/**
 * Helper function to get all tags in a category
 */
export declare function getTagsByCategory(category: TagMetadata['category']): TagMetadata[];
/**
 * Helper function to get consolidation suggestions
 */
export declare function getConsolidationSuggestions(): Array<{
    from: string;
    to: string;
}>;
/**
 * Helper function to check if two tags conflict
 */
export declare function tagsConflict(tag1: string, tag2: string): boolean;
/**
 * Validate that an entity's tags don't have conflicts
 */
export declare function validateEntityTags(tags: string[]): {
    valid: boolean;
    conflicts: string[];
};
//# sourceMappingURL=tagRegistry.d.ts.map