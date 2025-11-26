/**
 * Location Growth Templates
 *
 * Templates for creating new locations (colonies, anomalies, etc).
 */

import { GrowthTemplate } from '../../../../apps/lore-weave/lib/types/engine';

export { colonyFounding } from './colonyFounding';
export { anomalyManifestation } from './anomalyManifestation';
export { resourceLocationDiscovery } from './resourceLocationDiscovery';
export { emergentLocationDiscovery } from './emergentLocationDiscovery';
export { geographicExploration } from './geographicExploration';
export { krillBloomMigration } from './krillBloomMigration';

import { colonyFounding } from './colonyFounding';
import { anomalyManifestation } from './anomalyManifestation';
import { resourceLocationDiscovery } from './resourceLocationDiscovery';
import { emergentLocationDiscovery } from './emergentLocationDiscovery';
import { geographicExploration } from './geographicExploration';
import { krillBloomMigration } from './krillBloomMigration';

export const locationTemplates: GrowthTemplate[] = [
  colonyFounding,
  anomalyManifestation,
  resourceLocationDiscovery,
  emergentLocationDiscovery,
  geographicExploration,
  krillBloomMigration
];
