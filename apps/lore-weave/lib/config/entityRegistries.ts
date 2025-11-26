/**
 * Entity Operator Registries - DEPRECATED STUB
 *
 * THIS FILE IS DEPRECATED. Entity registries have been moved to the domain layer.
 *
 * For penguin-tales domain:
 *   import { penguinEntityRegistries } from 'penguin-tales/lore/config/entityRegistries.js';
 *
 * This empty export is maintained for backwards compatibility only.
 * New domains should define their own entityRegistries and pass them to EngineConfig.
 *
 * @deprecated Import from your domain layer instead
 */

import type { EntityOperatorRegistry } from '../types/engine.js';

/**
 * Empty entity registries array - for backwards compatibility only.
 * @deprecated Use domain-specific entity registries instead
 */
export const entityRegistries: EntityOperatorRegistry[] = [];
