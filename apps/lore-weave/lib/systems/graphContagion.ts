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

/**
 * Multi-source contagion configuration.
 * When enabled, the system tracks multiple independent contagion sources
 * (e.g., multiple ideologies that can spread independently).
 */
export interface MultiSourceConfig {
  /** Entity kind that acts as contagion source (e.g., 'rules') */
  sourceKind: string;
  /** Status filter for sources (e.g., 'proposed') */
  sourceStatus?: string;
  /** Immunity tag prefix - will be suffixed with source ID (e.g., 'immune' → 'immune:{sourceId}') */
  immunityTagPrefix?: string;
  /** Low adoption threshold - sources below this are marked forgotten */
  lowAdoptionThreshold?: number;
  /** Low adoption status - what to set when below threshold */
  lowAdoptionStatus?: string;
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

  /**
   * Multi-source mode: when configured, the system tracks multiple independent
   * contagion sources. Each source entity spreads independently through the
   * same population using the configured vectors and transmission settings.
   *
   * Example: Multiple ideologies (rules with status='proposed') spreading
   * through NPCs via social networks. Each NPC can believe in some ideologies
   * but not others.
   */
  multiSource?: MultiSourceConfig;
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

    // Note: contract removed - systems don't need lineage and affects is redundant

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

      // Use multi-source mode if configured, otherwise single-source mode
      if (config.multiSource) {
        return applyMultiSourceContagion(config, graphView, modifier);
      } else {
        return applySingleSourceContagion(config, graphView, modifier);
      }
    }
  };
}

/**
 * Single-source contagion: original behavior where one marker indicates infection
 */
function applySingleSourceContagion(
  config: GraphContagionConfig,
  graphView: TemplateGraphView,
  modifier: number
): SystemResult {
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

  for (const entity of entities) {
    if (isInfected(entity, config.contagion, graphView)) {
      infected.push(entity);
    } else if (config.recovery?.immunityTag && isImmune(entity, config.recovery.immunityTag)) {
      // immune - skip
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
      }
    }
  }

  // === PHASE TRANSITIONS ===
  if (config.phaseTransitions) {
    const adoptionRate = infected.length / entities.length;

    for (const transition of config.phaseTransitions) {
      if (adoptionRate >= transition.adoptionThreshold) {
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

/**
 * Multi-source contagion: each source entity spreads independently
 * Example: Multiple ideologies spreading through a population
 */
function applyMultiSourceContagion(
  config: GraphContagionConfig,
  graphView: TemplateGraphView,
  modifier: number
): SystemResult {
  const multiSource = config.multiSource!;
  const modifications: Array<{ id: string; changes: Partial<HardState> }> = [];
  const relationships: Relationship[] = [];
  const modifiedTags = new Map<string, Record<string, boolean | string>>();

  // Find all contagion sources (e.g., proposed rules)
  let sources = graphView.findEntities({ kind: multiSource.sourceKind });
  if (multiSource.sourceStatus) {
    sources = sources.filter(s => s.status === multiSource.sourceStatus);
  }

  // Natural throttling: if no sources, nothing to spread
  if (sources.length === 0) {
    return {
      relationshipsAdded: [],
      entitiesModified: [],
      pressureChanges: {},
      description: `${config.name}: no active sources`
    };
  }

  // Find entities to evaluate (the population)
  let entities = graphView.findEntities({ kind: config.entityKind });
  if (config.entityStatus) {
    entities = entities.filter(e => e.status === config.entityStatus);
  }

  // Process each source independently
  for (const source of sources) {
    // Categorize entities for this specific source
    const infected: HardState[] = [];
    const susceptible: HardState[] = [];

    for (const entity of entities) {
      const isInfectedWithSource = isInfectedWith(entity, config.contagion, source.id, graphView);
      const isImmuneToSource = multiSource.immunityTagPrefix
        ? hasTag(entity.tags, `${multiSource.immunityTagPrefix}:${source.id}`)
        : false;

      if (isInfectedWithSource) {
        infected.push(entity);
      } else if (!isImmuneToSource) {
        susceptible.push(entity);
      }
    }

    // === TRANSMISSION PHASE for this source ===
    for (const entity of susceptible) {
      const contacts = getContacts(entity, config.vectors, graphView);
      const infectedContacts = contacts.filter(c =>
        isInfectedWith(c, config.contagion, source.id, graphView)
      );

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
        // Apply infection action - relationship to source entity
        if (config.infectionAction.type === 'create_relationship') {
          relationships.push({
            kind: config.infectionAction.relationshipKind!,
            src: entity.id,
            dst: source.id,
            strength: config.infectionAction.strength ?? 0.5
          });
        } else if (config.infectionAction.type === 'add_tag') {
          // Tag-based: add source-specific tag
          const tagKey = `${config.infectionAction.tagKey}:${source.id}`;
          const currentTags = modifiedTags.get(entity.id) || { ...entity.tags };
          currentTags[tagKey] = config.infectionAction.tagValue ?? true;
          modifiedTags.set(entity.id, currentTags);
        }
      }
    }

    // === RECOVERY PHASE for this source ===
    if (config.recovery) {
      for (const entity of infected) {
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
          // Add source-specific immunity tag
          if (multiSource.immunityTagPrefix) {
            const currentTags = modifiedTags.get(entity.id) || { ...entity.tags };
            currentTags[`${multiSource.immunityTagPrefix}:${source.id}`] = true;
            modifiedTags.set(entity.id, currentTags);
          }
        }
      }
    }

    // === PHASE TRANSITIONS for this source ===
    if (config.phaseTransitions && entities.length > 0) {
      const adoptionRate = infected.length / entities.length;

      for (const transition of config.phaseTransitions) {
        // Only apply to this specific source entity
        if (source.kind === transition.entityKind &&
            source.status === transition.fromStatus &&
            adoptionRate >= transition.adoptionThreshold) {
          const changes: Partial<HardState> = { status: transition.toStatus };
          if (transition.descriptionSuffix) {
            changes.description = `${source.description} ${transition.descriptionSuffix}`;
          }
          modifications.push({
            id: source.id,
            changes
          });
        }
      }

      // Handle low adoption threshold (source fades away)
      if (multiSource.lowAdoptionThreshold !== undefined &&
          adoptionRate < multiSource.lowAdoptionThreshold &&
          source.status === multiSource.sourceStatus) {
        modifications.push({
          id: source.id,
          changes: {
            status: multiSource.lowAdoptionStatus || 'forgotten'
          }
        });
      }
    }
  }

  // Convert tag modifications to entity modifications
  for (const [entityId, tags] of modifiedTags) {
    // Keep only the most recent tags (limit to 10)
    const tagKeys = Object.keys(tags);
    if (tagKeys.length > 10) {
      const excessCount = tagKeys.length - 10;
      for (let i = 0; i < excessCount; i++) {
        delete tags[tagKeys[i]];
      }
    }
    modifications.push({
      id: entityId,
      changes: { tags }
    });
  }

  // Calculate pressure changes
  const pressureChanges = (relationships.length > 0 || modifications.length > 0)
    ? (config.pressureChanges ?? {})
    : {};

  return {
    relationshipsAdded: relationships,
    entitiesModified: modifications,
    pressureChanges,
    description: `${config.name}: ${relationships.length} new believers, ${modifications.length} modifications across ${sources.length} sources`
  };
}
