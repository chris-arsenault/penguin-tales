import { SimulationSystem, SystemResult, ComponentPurpose } from '../engine/types';
import { HardState, Relationship } from '../core/worldTypes';
import { TemplateGraphView } from '../graph/templateGraphView';
import { rollProbability, hasTag } from '../utils';

/**
 * Graph Contagion System Factory
 *
 * Creates configurable systems that spread state through relationship networks
 * using an SIR (Susceptible-Infected-Recovered) epidemic model.
 *
 * This pattern can implement:
 * - Belief contagion (ideological spread through social networks)
 * - Conflict contagion (wars spreading through alliance networks)
 * - Disease spread, cultural drift, influence propagation
 *
 * The factory creates a SimulationSystem from a GraphContagionConfig.
 */

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export type MarkerType = 'relationship' | 'tag';

export interface ContagionMarker {
  type: MarkerType;
  /** For relationship type: the relationship kind (e.g., 'believer_of', 'enemy_of') */
  relationshipKind?: string;
  /** For tag type: the tag key pattern (e.g., 'infected', 'believes_in') */
  tagPattern?: string;
  /** For relationship type: the target entity to check relationship against (optional) */
  /** If not specified, any relationship of this kind counts as infected */
  targetEntityId?: string;
}

export interface TransmissionVector {
  /** Relationship kind that enables transmission */
  relationshipKind: string;
  /** Direction to check for contacts */
  direction: 'src' | 'dst' | 'both';
  /** Minimum relationship strength to count as contact */
  minStrength?: number;
}

export interface TransmissionConfig {
  /** Base transmission probability per tick (0-1) */
  baseRate: number;
  /** Multiplier applied per infected contact (stacks additively) */
  contactMultiplier: number;
  /** Maximum transmission probability (capped before rolling) */
  maxProbability?: number;
}

export interface RecoveryConfig {
  /** Base recovery probability per tick (0-1) */
  baseRate: number;
  /** Tag to add when entity recovers (grants immunity) */
  immunityTag?: string;
  /** Trait tags that increase recovery probability */
  recoveryBonusTraits?: Array<{ tag: string; bonus: number }>;
}

export interface ContagionAction {
  type: 'create_relationship' | 'add_tag';
  /** For create_relationship: the relationship kind to create */
  relationshipKind?: string;
  /** For add_tag: the tag key to add */
  tagKey?: string;
  /** For add_tag: the tag value (default: true) */
  tagValue?: string | boolean;
  /** For create_relationship: strength of created relationship */
  strength?: number;
  /** For create_relationship: the target entity to create relationship to */
  /** If 'source', creates relationship to the entity that spread the contagion */
  /** If 'contagion_source', creates relationship to the original source of contagion */
  target?: 'source' | 'contagion_source';
}

export interface PhaseTransition {
  /** Entity kind that can transition */
  entityKind: string;
  /** Status required for transition */
  fromStatus: string;
  /** New status after transition */
  toStatus: string;
  /** Adoption threshold (0-1, proportion of entities that must be infected) */
  adoptionThreshold: number;
  /** Optional: also update description */
  descriptionSuffix?: string;
}

export interface GraphContagionConfig {
  /** Unique system identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;

  /** Entity kind to evaluate (the "population") */
  entityKind: string;
  /** Optional: only evaluate entities with this status */
  entityStatus?: string;

  /** What marks an entity as "infected" (the contagion marker) */
  contagion: ContagionMarker;

  /** Relationship types that enable transmission */
  vectors: TransmissionVector[];

  /** Transmission parameters */
  transmission: TransmissionConfig;

  /** What action to take when infection occurs */
  infectionAction: ContagionAction;

  /** Optional recovery mechanics */
  recovery?: RecoveryConfig;

  /** Optional phase transitions when adoption thresholds are met */
  phaseTransitions?: PhaseTransition[];

  /** Traits that modify susceptibility */
  susceptibilityModifiers?: Array<{
    tag: string;
    modifier: number; // negative = more susceptible, positive = more resistant
  }>;

  /** Throttle: only run on some ticks (0-1, default: 1.0 = every tick) */
  throttleChance?: number;

  /** Cooldown: ticks before same entity can be infected again */
  cooldown?: number;

  /** Pressure changes when contagion spreads */
  pressureChanges?: Record<string, number>;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function isInfected(
  entity: HardState,
  config: ContagionMarker,
  graphView: TemplateGraphView
): boolean {
  if (config.type === 'tag') {
    return hasTag(entity.tags, config.tagPattern || '');
  }

  if (config.type === 'relationship' && config.relationshipKind) {
    const relationships = graphView.getAllRelationships();
    return relationships.some(r => {
      if (r.kind !== config.relationshipKind) return false;
      if (r.src !== entity.id) return false;
      if (config.targetEntityId && r.dst !== config.targetEntityId) return false;
      return true;
    });
  }

  return false;
}

function isInfectedWith(
  entity: HardState,
  config: ContagionMarker,
  targetId: string,
  graphView: TemplateGraphView
): boolean {
  if (config.type === 'tag') {
    // For tag-based contagion with specific target
    return hasTag(entity.tags, `${config.tagPattern}:${targetId}`);
  }

  if (config.type === 'relationship' && config.relationshipKind) {
    return graphView.hasRelationship(entity.id, targetId, config.relationshipKind);
  }

  return false;
}

function isImmune(entity: HardState, immunityTag: string, targetId?: string): boolean {
  if (targetId) {
    return hasTag(entity.tags, `${immunityTag}:${targetId}`);
  }
  return hasTag(entity.tags, immunityTag);
}

function getContacts(
  entity: HardState,
  vectors: TransmissionVector[],
  graphView: TemplateGraphView
): HardState[] {
  const contactIds = new Set<string>();

  for (const vector of vectors) {
    const minStrength = vector.minStrength ?? 0;

    if (vector.direction === 'src' || vector.direction === 'both') {
      const related = graphView.getRelated(entity.id, vector.relationshipKind, 'src', { minStrength });
      related.forEach(e => contactIds.add(e.id));
    }

    if (vector.direction === 'dst' || vector.direction === 'both') {
      const related = graphView.getRelated(entity.id, vector.relationshipKind, 'dst', { minStrength });
      related.forEach(e => contactIds.add(e.id));
    }
  }

  // Convert IDs to entities
  const contacts: HardState[] = [];
  contactIds.forEach(id => {
    const entity = graphView.getEntity(id);
    if (entity) contacts.push(entity);
  });

  return contacts;
}

function calculateSusceptibility(
  entity: HardState,
  modifiers: Array<{ tag: string; modifier: number }> | undefined
): number {
  if (!modifiers) return 0;

  let totalModifier = 0;
  for (const mod of modifiers) {
    if (hasTag(entity.tags, mod.tag)) {
      totalModifier += mod.modifier;
    }
  }
  return totalModifier;
}

// =============================================================================
// SYSTEM FACTORY
// =============================================================================

/**
 * Create a SimulationSystem from a GraphContagionConfig
 */
export function createGraphContagionSystem(
  config: GraphContagionConfig
): SimulationSystem {
  return {
    id: config.id,
    name: config.name,

    contract: {
      purpose: ComponentPurpose.TAG_PROPAGATION,
      enabledBy: {
        entityCounts: [{ kind: config.entityKind, min: 1 }]
      },
      affects: {
        entities: [{ kind: config.entityKind, operation: 'modify' }],
        relationships: config.infectionAction.type === 'create_relationship'
          ? [{ kind: config.infectionAction.relationshipKind || 'unknown', operation: 'create', count: { min: 0, max: 100 } }]
          : undefined,
        tags: config.infectionAction.type === 'add_tag'
          ? [{ operation: 'add', pattern: config.infectionAction.tagKey || '*' }]
          : undefined
      }
    },

    metadata: {
      produces: {
        relationships: config.infectionAction.type === 'create_relationship'
          ? [{ kind: config.infectionAction.relationshipKind || 'unknown', frequency: 'common', comment: `Created by ${config.name}` }]
          : [],
        modifications: [
          { type: 'tags', frequency: 'common', comment: config.description || config.name }
        ]
      },
      effects: {
        graphDensity: 0.3,
        clusterFormation: 0.6,
        diversityImpact: 0.5,
        comment: config.description || config.name
      },
      parameters: {},
      triggers: {
        graphConditions: ['Infected entities exist', 'Contact networks'],
        comment: `SIR-style contagion through ${config.vectors.map(v => v.relationshipKind).join(', ')}`
      }
    },

    apply: (graphView: TemplateGraphView, modifier: number = 1.0): SystemResult => {
      // Throttle check
      if (config.throttleChance !== undefined && config.throttleChance < 1.0) {
        if (!rollProbability(config.throttleChance, modifier)) {
          return {
            relationshipsAdded: [],
            entitiesModified: [],
            pressureChanges: {},
            description: `${config.name}: dormant`
          };
        }
      }

      const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];
      const relationships: Relationship[] = [];

      // Find entities to evaluate
      let entities = graphView.findEntities({ kind: config.entityKind });
      if (config.entityStatus) {
        entities = entities.filter(e => e.status === config.entityStatus);
      }

      // Categorize entities: infected, susceptible, immune
      const infected: HardState[] = [];
      const susceptible: HardState[] = [];
      const immune: HardState[] = [];

      for (const entity of entities) {
        if (isInfected(entity, config.contagion, graphView)) {
          infected.push(entity);
        } else if (config.recovery?.immunityTag && isImmune(entity, config.recovery.immunityTag)) {
          immune.push(entity);
        } else {
          susceptible.push(entity);
        }
      }

      // If no infected entities, nothing to spread
      if (infected.length === 0) {
        return {
          relationshipsAdded: [],
          entitiesModified: [],
          pressureChanges: {},
          description: `${config.name}: no carriers`
        };
      }

      // === TRANSMISSION PHASE ===
      for (const entity of susceptible) {
        const contacts = getContacts(entity, config.vectors, graphView);
        const infectedContacts = contacts.filter(c => isInfected(c, config.contagion, graphView));

        if (infectedContacts.length === 0) continue;

        // Calculate susceptibility modifier
        const susceptibilityMod = calculateSusceptibility(entity, config.susceptibilityModifiers);

        // Calculate infection probability
        const baseProb = config.transmission.baseRate +
          (infectedContacts.length * config.transmission.contactMultiplier);
        const modifiedProb = baseProb * (1 - susceptibilityMod);
        const maxProb = config.transmission.maxProbability ?? 0.95;
        const infectionProb = Math.min(maxProb, Math.max(0, modifiedProb));

        if (rollProbability(infectionProb, modifier)) {
          // Check cooldown if configured
          if (config.cooldown && config.infectionAction.relationshipKind) {
            if (!graphView.canFormRelationship(entity.id, config.infectionAction.relationshipKind, config.cooldown)) {
              continue;
            }
          }

          // Apply infection action
          if (config.infectionAction.type === 'create_relationship') {
            // Pick a random infected contact as the source
            const source = infectedContacts[Math.floor(Math.random() * infectedContacts.length)];
            relationships.push({
              kind: config.infectionAction.relationshipKind!,
              src: entity.id,
              dst: source.id,
              strength: config.infectionAction.strength ?? 0.5,
              catalyzedBy: source.id
            });

            if (config.infectionAction.relationshipKind) {
              graphView.recordRelationshipFormation(entity.id, config.infectionAction.relationshipKind);
            }
          } else if (config.infectionAction.type === 'add_tag') {
            const newTags = { ...entity.tags };
            newTags[config.infectionAction.tagKey!] = config.infectionAction.tagValue ?? true;
            modifications.push({
              id: entity.id,
              changes: { tags: newTags }
            });
          }
        }
      }

      // === RECOVERY PHASE ===
      if (config.recovery) {
        for (const entity of infected) {
          // Calculate recovery probability with trait bonuses
          let recoveryProb = config.recovery.baseRate;
          if (config.recovery.recoveryBonusTraits) {
            for (const trait of config.recovery.recoveryBonusTraits) {
              if (hasTag(entity.tags, trait.tag)) {
                recoveryProb += trait.bonus;
              }
            }
          }
          recoveryProb = Math.min(0.95, Math.max(0, recoveryProb));

          if (rollProbability(recoveryProb, modifier)) {
            // Add immunity tag if configured
            if (config.recovery.immunityTag) {
              const newTags = { ...entity.tags };
              newTags[config.recovery.immunityTag] = true;

              // Remove infection tag if using tag-based contagion
              if (config.contagion.type === 'tag' && config.contagion.tagPattern) {
                delete newTags[config.contagion.tagPattern];
              }

              modifications.push({
                id: entity.id,
                changes: { tags: newTags }
              });
            }

            // Note: For relationship-based contagion, recovery would need to
            // delete/archive the relationship - this is handled by returning
            // a separate relationshipsRemoved array (not currently supported)
          }
        }
      }

      // === PHASE TRANSITIONS ===
      if (config.phaseTransitions) {
        const adoptionRate = infected.length / entities.length;

        for (const transition of config.phaseTransitions) {
          if (adoptionRate >= transition.adoptionThreshold) {
            // Find entities matching the transition criteria
            const candidates = graphView.findEntities({
              kind: transition.entityKind,
              status: transition.fromStatus
            });

            for (const candidate of candidates) {
              const changes: Partial<HardState> = { status: transition.toStatus };
              if (transition.descriptionSuffix) {
                changes.description = `${candidate.description} ${transition.descriptionSuffix}`;
              }
              modifications.push({
                id: candidate.id,
                changes
              });
            }
          }
        }
      }

      // Calculate pressure changes
      const pressureChanges = (relationships.length > 0 || modifications.length > 0)
        ? (config.pressureChanges ?? {})
        : {};

      return {
        relationshipsAdded: relationships,
        entitiesModified: modifications,
        pressureChanges,
        description: `${config.name}: ${relationships.length} new infections, ${modifications.length} modifications`
      };
    }
  };
}
