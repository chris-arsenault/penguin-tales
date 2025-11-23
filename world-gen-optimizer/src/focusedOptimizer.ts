/**
 * Focused optimizer - only optimizes high-impact parameters
 * Use this after identifying which parameters actually matter
 */

import { ParameterMetadata } from './types';

// Parameters that most affect relationship violations
// Based on domain knowledge - these control relationship decay/reinforcement
const VIOLATION_CRITICAL_PARAMS = [
  'relationship_decay.narrativeDecayRate',
  'relationship_decay.socialDecayRate',
  'relationship_decay.spatialDecayRate',
  'relationship_decay.conflictDecayRate',
  'relationship_decay.proximityReduction',
  'relationship_decay.sharedFactionReduction',
  'relationship_decay.decayFloor',
  'relationship_reinforcement.proximityBonus',
  'relationship_reinforcement.sharedFactionBonus',
  'relationship_reinforcement.sharedConflictBonus',
  'relationship_culling.cullThreshold',
  'relationship_culling.cullFrequency',
  'relationship_culling.gracePeriod'
];

// Parameters that affect entity/relationship balance
const BALANCE_CRITICAL_PARAMS = [
  'relationship_formation.throttleChance',
  'relationship_formation.friendshipBaseChance',
  'relationship_formation.romanceBaseChance',
  'relationship_formation.mentorshipBaseChance',
  'familyExpansion.numChildrenMin',
  'familyExpansion.numChildrenMax',
  'outlawRecruitment.numOutlawsMin',
  'outlawRecruitment.numOutlawsMax'
];

/**
 * Filter parameter metadata to only include critical parameters
 */
export function getFocusedParameters(
  allMetadata: ParameterMetadata[],
  focus: 'violations' | 'balance' | 'both' = 'violations'
): ParameterMetadata[] {
  let criticalParams: string[];

  switch (focus) {
    case 'violations':
      criticalParams = VIOLATION_CRITICAL_PARAMS;
      break;
    case 'balance':
      criticalParams = BALANCE_CRITICAL_PARAMS;
      break;
    case 'both':
      criticalParams = [...VIOLATION_CRITICAL_PARAMS, ...BALANCE_CRITICAL_PARAMS];
      break;
  }

  return allMetadata.filter(param =>
    criticalParams.some(critical => param.path.includes(critical))
  );
}

/**
 * Expand parameter bounds for more aggressive exploration
 */
export function expandParameterBounds(
  metadata: ParameterMetadata,
  multiplier: number = 2.0
): ParameterMetadata {
  const range = metadata.max - metadata.min;
  const center = (metadata.max + metadata.min) / 2;
  const newRange = range * multiplier;

  return {
    ...metadata,
    min: Math.max(0, center - newRange / 2),
    max: center + newRange / 2
  };
}
