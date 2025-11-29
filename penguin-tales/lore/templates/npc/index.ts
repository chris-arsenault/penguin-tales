/**
 * NPC Growth Templates
 *
 * Templates for creating and evolving NPC entities.
 *
 * REMOVED (NPC bloat):
 * - familyExpansion (created 3-5 family NPCs per invocation)
 * - outlawRecruitment (created outlaws, 39 existed!)
 * - kinshipConstellation (created 2-4 related NPCs)
 * - mysteriousVanishing (pure narrative, low game value)
 *
 * KEPT (catalysts for world events):
 * - heroEmergence (creates 1 NPC that drives major events)
 * - succession (creates 1 NPC to resolve power vacuum)
 * - orcaRaiderArrival (creates external threat NPC)
 */

import { GrowthTemplate } from '@lore-weave/core';

// REMOVED: familyExpansion, outlawRecruitment, kinshipConstellation, mysteriousVanishing
export { heroEmergence } from './heroEmergence';
export { succession } from './succession';
export { orcaRaiderArrival } from './orcaRaiderArrival';

import { heroEmergence } from './heroEmergence';
import { succession } from './succession';
import { orcaRaiderArrival } from './orcaRaiderArrival';

export const npcTemplates: GrowthTemplate[] = [
  heroEmergence,
  succession,
  orcaRaiderArrival
];
