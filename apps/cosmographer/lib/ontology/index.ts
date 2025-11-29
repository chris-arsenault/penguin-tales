/**
 * Ontology Module
 *
 * Exports the category system and related utilities.
 */

export {
  CATEGORY_REGISTRY,
  CATEGORIES_BY_DOMAIN,
  getCategory,
  getCategoriesForDomain,
  getAllCategoryIds,
  canBeChildOf,
  getValidChildren,
  categoryDistance,
  registerCustomCategory
} from './categories.js';

export * from './domains/index.js';
