/**
 * Faction Growth Templates
 *
 * Templates for creating and evolving faction entities.
 */

import { GrowthTemplate } from '../../../../types/engine';

export { factionSplinter } from './factionSplinter';
export { guildEstablishment } from './guildEstablishment';
export { cultFormation } from './cultFormation';
export { territorialExpansion } from './territorialExpansion';
export { tradeRouteEstablishment } from './tradeRouteEstablishment';

import { factionSplinter } from './factionSplinter';
import { guildEstablishment } from './guildEstablishment';
import { cultFormation } from './cultFormation';
import { territorialExpansion } from './territorialExpansion';
import { tradeRouteEstablishment } from './tradeRouteEstablishment';

export const factionTemplates: GrowthTemplate[] = [
  factionSplinter,
  guildEstablishment,
  cultFormation,
  territorialExpansion,
  tradeRouteEstablishment
];
