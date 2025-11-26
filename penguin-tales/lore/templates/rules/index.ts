/**
 * Rules Growth Templates
 *
 * Templates for creating laws, edicts, taboos, and social norms.
 */

import { GrowthTemplate } from '@lore-weave/core/types/engine';

export { crisisLegislation } from './crisisLegislation';
export { greatFestival } from './greatFestival';
export { ideologyEmergence } from './ideologyEmergence';

import { crisisLegislation } from './crisisLegislation';
import { greatFestival } from './greatFestival';
import { ideologyEmergence } from './ideologyEmergence';

export const rulesTemplates: GrowthTemplate[] = [
  crisisLegislation,
  greatFestival,
  ideologyEmergence
];
