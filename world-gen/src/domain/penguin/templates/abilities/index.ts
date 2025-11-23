/**
 * Abilities Growth Templates
 *
 * Templates for creating technologies and magical abilities.
 */

import { GrowthTemplate } from '../../../../types/engine';

export { techInnovation } from './techInnovation';
export { magicDiscovery } from './magicDiscovery';
export { orcaCombatTechnique } from './orcaCombatTechnique';

import { techInnovation } from './techInnovation';
import { magicDiscovery } from './magicDiscovery';
import { orcaCombatTechnique } from './orcaCombatTechnique';

export const abilitiesTemplates: GrowthTemplate[] = [
  techInnovation,
  magicDiscovery,
  orcaCombatTechnique
];
