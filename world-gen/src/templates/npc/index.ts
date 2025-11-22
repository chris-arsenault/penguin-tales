/**
 * NPC Growth Templates
 *
 * Templates for creating and evolving NPC entities.
 */

import { GrowthTemplate } from '../../types/engine';

export { familyExpansion } from './familyExpansion';
export { heroEmergence } from './heroEmergence';
export { outlawRecruitment } from './outlawRecruitment';
export { succession } from './succession';
export { kinshipConstellation } from './kinshipConstellation';
export { mysteriousVanishing } from './mysteriousVanishing';

import { familyExpansion } from './familyExpansion';
import { heroEmergence } from './heroEmergence';
import { outlawRecruitment } from './outlawRecruitment';
import { succession } from './succession';
import { kinshipConstellation } from './kinshipConstellation';
import { mysteriousVanishing } from './mysteriousVanishing';

export const npcTemplates: GrowthTemplate[] = [
  familyExpansion,
  heroEmergence,
  outlawRecruitment,
  succession,
  kinshipConstellation,
  mysteriousVanishing
];
