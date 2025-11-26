/**
 * Abilities Growth Templates
 *
 * Templates for creating technologies and magical abilities.
 */

import { GrowthTemplate } from '../../../../apps/lore-weave/lib/types/engine';

export { techInnovation } from './techInnovation';
export { magicDiscovery } from './magicDiscovery';
export { orcaCombatTechnique } from './orcaCombatTechnique';
export { magicalSiteDiscovery } from './magicalSiteDiscovery';
export { techBreakthrough } from './techBreakthrough';

import { techInnovation } from './techInnovation';
import { magicDiscovery } from './magicDiscovery';
import { orcaCombatTechnique } from './orcaCombatTechnique';
import { magicalSiteDiscovery } from './magicalSiteDiscovery';
import { techBreakthrough } from './techBreakthrough';

export const abilitiesTemplates: GrowthTemplate[] = [
  techInnovation,
  magicDiscovery,
  orcaCombatTechnique,
  magicalSiteDiscovery,
  techBreakthrough
];
