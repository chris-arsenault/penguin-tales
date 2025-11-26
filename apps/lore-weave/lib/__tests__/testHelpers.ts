/**
 * Shared test helpers for creating mock entities
 */

import { HardState, Relationship, Prominence } from '../types/worldTypes';

/**
 * Create a minimal HardState entity for testing
 */
export function createTestEntity(
  overrides: Partial<HardState> = {}
): HardState {
  return {
    id: overrides.id || 'test-entity',
    kind: overrides.kind || 'npc',
    subtype: overrides.subtype || 'merchant',
    name: overrides.name || 'Test Entity',
    description: overrides.description || 'A test entity',
    status: overrides.status || 'active',
    prominence: overrides.prominence || 'marginal',
    culture: overrides.culture || 'world',
    tags: overrides.tags || [],
    links: overrides.links || [],
    createdAt: overrides.createdAt ?? 0,
    updatedAt: overrides.updatedAt ?? 0,
    ...overrides
  };
}

/**
 * Create a minimal NPC for testing
 */
export function createTestNpc(
  id: string,
  name: string,
  overrides: Partial<HardState> = {}
): HardState {
  return createTestEntity({
    id,
    kind: 'npc',
    name,
    ...overrides
  });
}

/**
 * Create a minimal faction for testing
 */
export function createTestFaction(
  id: string,
  name: string,
  overrides: Partial<HardState> = {}
): HardState {
  return createTestEntity({
    id,
    kind: 'faction',
    subtype: 'political',
    name,
    ...overrides
  });
}

/**
 * Create a minimal location for testing
 */
export function createTestLocation(
  id: string,
  name: string,
  overrides: Partial<HardState> = {}
): HardState {
  return createTestEntity({
    id,
    kind: 'location',
    subtype: 'colony',
    name,
    ...overrides
  });
}
