/**
 * Location Growth Templates
 *
 * Templates for creating new locations (colonies, anomalies, etc).
 */

import { GrowthTemplate } from '../../../../types/engine';

export { colonyFounding } from './colonyFounding';
export { anomalyManifestation } from './anomalyManifestation';
export { resourceLocationDiscovery } from './resourceLocationDiscovery';
export { strategicLocationDiscovery } from './strategicLocationDiscovery';
export { mysticalLocationDiscovery } from './mysticalLocationDiscovery';
export { geographicExploration } from './geographicExploration';
export { krillBloomMigration } from './krillBloomMigration';

import { colonyFounding } from './colonyFounding';
import { anomalyManifestation } from './anomalyManifestation';
import { resourceLocationDiscovery } from './resourceLocationDiscovery';
import { strategicLocationDiscovery } from './strategicLocationDiscovery';
import { mysticalLocationDiscovery } from './mysticalLocationDiscovery';
import { geographicExploration } from './geographicExploration';
import { krillBloomMigration } from './krillBloomMigration';

export const locationTemplates: GrowthTemplate[] = [
  colonyFounding,
  anomalyManifestation,
  resourceLocationDiscovery,
  strategicLocationDiscovery,
  mysticalLocationDiscovery,
  geographicExploration,
  krillBloomMigration
];
