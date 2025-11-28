import { MetaEntityConfig } from '@lore-weave/core/types/engine';
import { Graph } from '@lore-weave/core/types/engine';
import { HardState } from '@lore-weave/core/types/worldTypes';
import { pickRandom, slugifyName, hasTag } from '@lore-weave/core/utils/helpers';

/**
 * Magic School Formation Configuration
 *
 * Clusters magic abilities into unified schools to create narrative density.
 * Example: 10 NPCs × 5 spells = thin history
 *         10 NPCs × 1 school = rich history
 */
export const magicSchoolFormation: MetaEntityConfig = {
  sourceKind: 'abilities',
  metaKind: 'abilities',  // Meta-entity IS an ability, not a new type
  trigger: 'epoch_end',

  clustering: {
    minSize: 3,
    maxSize: 8,
    criteria: [
      { type: 'shared_practitioner', weight: 5.0 },  // Cluster by shared practitioners
      { type: 'shared_tags', weight: 2.0, threshold: 0.3 },  // Lower threshold for tag overlap
      { type: 'temporal_proximity', weight: 1.5, threshold: 50 }  // Longer time window
    ],
    minimumScore: 5.0  // Lower minimum score
  },

  transformation: {
    markOriginalsHistorical: true,   // Abilities become historical
    transferRelationships: true,      // Transfer practitioner_of, etc. to school
    redirectFutureRelationships: true, // New practitioners practice the school
    preserveOriginalLinks: true       // Keep part_of links for lore
  },

  factory: (cluster: HardState[], graph: Graph): Partial<HardState> => {
    // Determine school subtype from cluster majority
    const subtypeCounts = new Map<string, number>();
    cluster.forEach(ability => {
      const subtype = ability.subtype;
      subtypeCounts.set(subtype, (subtypeCounts.get(subtype) || 0) + 1);
    });

    // Find most common subtype
    let majoritySubtype = 'magic';
    let maxCount = 0;
    subtypeCounts.forEach((count, subtype) => {
      if (count > maxCount) {
        maxCount = count;
        majoritySubtype = subtype;
      }
    });

    // Generate school name based on subtype
    const nameFragments = {
      magic: ['Arcane', 'Mystical', 'Ethereal', 'Elemental', 'Cosmic'],
      faith: ['Sacred', 'Divine', 'Holy', 'Blessed', 'Hallowed'],
      technology: ['Innovative', 'Advanced', 'Mechanical', 'Industrial', 'Technical'],
      physical: ['Martial', 'Athletic', 'Physical', 'Kinetic', 'Bodily'],
      combat: ['Warrior', 'Battle', 'Combat', 'Tactical', 'Strategic']
    };

    const descriptor = pickRandom(nameFragments[majoritySubtype as keyof typeof nameFragments] || nameFragments.magic);
    const schoolName = `${descriptor} School of ${cluster.length} Arts`;

    // Aggregate tags from cluster
    const allTags = new Set<string>();
    cluster.forEach(ability => {
      Object.keys(ability.tags || {}).forEach(tag => allTags.add(tag));
    });

    // Take top 4 most common tags (save room for meta-entity tag)
    const tagArray = Array.from(allTags).slice(0, 4);

    // Build description
    const abilityNames = cluster.map(a => a.name).join(', ');
    const description = `A unified tradition encompassing ${abilityNames}. Formed from ${cluster.length} related abilities practiced by multiple penguins.`;

    // Determine prominence based on cluster size
    let prominence: HardState['prominence'] = 'recognized';
    if (cluster.length >= 6) {
      prominence = 'renowned';
    } else if (cluster.length >= 4) {
      prominence = 'recognized';
    } else {
      prominence = 'marginal';
    }

    // Determine dominant culture from cluster
    const cultureCounts = new Map<string, number>();
    cluster.forEach(ability => {
      const culture = ability.culture || 'world';
      cultureCounts.set(culture, (cultureCounts.get(culture) || 0) + 1);
    });
    let majorityCulture = 'world';
    let maxCultureCount = 0;
    cultureCounts.forEach((count, culture) => {
      if (count > maxCultureCount) {
        maxCultureCount = count;
        majorityCulture = culture;
      }
    });

    // Convert to tag object
    const tags: Record<string, boolean> = {};
    tagArray.forEach(tag => tags[tag] = true);
    tags['meta-entity'] = true;

    // Create an ABILITY that represents the school
    // It functions as an ability in all existing systems
    return {
      kind: 'abilities',  // THIS IS KEY - it's an ability, not a new type
      subtype: majoritySubtype,
      name: schoolName,
      description,
      status: 'active',
      prominence,
      culture: majorityCulture,  // Inherit dominant culture from cluster
      tags  // Mark as meta-entity via tag
    };
  }
};

/**
 * Legal Code Formation Configuration
 *
 * Clusters rules into unified legal codes to create coherent legal systems.
 * Example: 15 scattered laws → 2-3 unified codes
 *
 * Also creates a faction:political to govern the legal code when formed.
 */
export const legalCodeFormation: MetaEntityConfig = {
  sourceKind: 'rules',
  metaKind: 'rules',  // Meta-entity IS a rule, not a new type
  trigger: 'epoch_end',

  clustering: {
    minSize: 4,
    criteria: [
      { type: 'shared_location', weight: 5.0 },  // Cluster by applies_in or active_during
      { type: 'temporal_proximity', weight: 2.0, threshold: 40 }
    ],
    minimumScore: 5.0
  },

  transformation: {
    markOriginalsHistorical: true,   // Individual laws become historical when unified into code
    transferRelationships: true,      // Transfer enacted_by, etc. to legal code
    redirectFutureRelationships: true, // Future enforcement targets the code
    preserveOriginalLinks: true       // Keep part_of links for lore
    // NOTE: Governance faction creation is handled by domain's legalCodeFormation SimulationSystem
  },

  factory: (cluster: HardState[], graph: Graph): Partial<HardState> => {
    // Determine code subtype from cluster majority
    const subtypeCounts = new Map<string, number>();
    cluster.forEach(rule => {
      const subtype = rule.subtype;
      subtypeCounts.set(subtype, (subtypeCounts.get(subtype) || 0) + 1);
    });

    // Find most common subtype
    let majoritySubtype = 'institutional';
    let maxCount = 0;
    subtypeCounts.forEach((count, subtype) => {
      if (count > maxCount) {
        maxCount = count;
        majoritySubtype = subtype;
      }
    });

    // Keep original subtype (edict, taboo, social, natural)
    // Don't map to new subtypes - this is a rule, it uses rule subtypes

    // Generate code name based on original subtype
    const nameFragments = {
      edict: ['Statutory', 'Administrative', 'Governmental', 'Official', 'Imperial'],
      taboo: ['Sacred', 'Divine', 'Ecclesiastical', 'Forbidden', 'Holy'],
      social: ['Traditional', 'Ancestral', 'Cultural', 'Folk', 'Common'],
      natural: ['Natural', 'Universal', 'Fundamental', 'Eternal', 'Immutable']
    };

    const descriptor = pickRandom(nameFragments[majoritySubtype as keyof typeof nameFragments] || nameFragments.edict);
    const codeName = `${descriptor} Code of ${cluster.length} Laws`;

    // Aggregate tags
    const allTags = new Set<string>();
    cluster.forEach(rule => {
      Object.keys(rule.tags || {}).forEach(tag => allTags.add(tag));
    });
    const tagArray = Array.from(allTags).slice(0, 4);  // Save room for meta-entity tag

    // Build description
    const ruleNames = cluster.map(r => r.name).join(', ');
    const description = `A unified legal system encompassing ${ruleNames}. Codified from ${cluster.length} related rules.`;

    // Determine prominence
    let prominence: HardState['prominence'] = 'recognized';
    if (cluster.length >= 7) {
      prominence = 'renowned';
    } else if (cluster.length >= 5) {
      prominence = 'recognized';
    } else {
      prominence = 'marginal';
    }

    // Determine dominant culture from cluster
    const cultureCounts = new Map<string, number>();
    cluster.forEach(rule => {
      const culture = rule.culture || 'world';
      cultureCounts.set(culture, (cultureCounts.get(culture) || 0) + 1);
    });
    let majorityCulture = 'world';
    let maxCultureCount = 0;
    cultureCounts.forEach((count, culture) => {
      if (count > maxCultureCount) {
        maxCultureCount = count;
        majorityCulture = culture;
      }
    });

    // Convert to tag object
    const tags: Record<string, boolean> = {};
    tagArray.forEach(tag => tags[tag] = true);
    tags['meta-entity'] = true;

    // Create a RULE that represents the legal code
    // It functions as a rule in all existing systems
    return {
      kind: 'rules',  // THIS IS KEY - it's a rule, not a new type
      subtype: majoritySubtype,  // Keep original subtype
      name: codeName,
      description,
      status: 'enacted',
      prominence,
      culture: majorityCulture,  // Inherit dominant culture from cluster
      tags  // Mark as meta-entity via tag
    };
  }
};

/**
 * Combat Technique Formation Configuration
 *
 * Clusters combat abilities into unified fighting styles.
 * Similar to magic schools but for physical/combat abilities.
 */
export const combatTechniqueFormation: MetaEntityConfig = {
  sourceKind: 'abilities',
  metaKind: 'abilities',  // Meta-entity IS an ability, not a new type
  trigger: 'epoch_end',

  clustering: {
    minSize: 3,
    maxSize: 8,
    criteria: [
      { type: 'shared_practitioner', weight: 5.0 },  // Cluster by shared practitioners
      { type: 'shared_tags', weight: 2.0, threshold: 0.3 },  // Lower threshold for tag overlap
      { type: 'temporal_proximity', weight: 1.5, threshold: 50 }  // Longer time window
    ],
    minimumScore: 5.0  // Lower minimum score
  },

  transformation: {
    markOriginalsHistorical: true,   // Individual techniques become historical
    transferRelationships: true,      // Transfer practitioner_of, etc. to style
    redirectFutureRelationships: true,
    preserveOriginalLinks: true
  },

  factory: (cluster: HardState[], graph: Graph): Partial<HardState> => {
    // Filter to only combat-type abilities
    const combatAbilities = cluster.filter(a =>
      a.subtype === 'combat' || a.subtype === 'physical'
    );

    // If no combat abilities, this shouldn't have clustered
    if (combatAbilities.length === 0) {
      combatAbilities.push(...cluster);  // Fallback to all
    }

    // Determine style subtype from cluster majority
    const subtypeCounts = new Map<string, number>();
    combatAbilities.forEach(ability => {
      const subtype = ability.subtype;
      subtypeCounts.set(subtype, (subtypeCounts.get(subtype) || 0) + 1);
    });

    let majoritySubtype = 'combat';
    let maxCount = 0;
    subtypeCounts.forEach((count, subtype) => {
      if (count > maxCount) {
        maxCount = count;
        majoritySubtype = subtype;
      }
    });

    // Generate style name
    const nameFragments = {
      combat: ['Deadly', 'Swift', 'Brutal', 'Precise', 'Devastating'],
      physical: ['Athletic', 'Graceful', 'Powerful', 'Agile', 'Coordinated']
    };

    const descriptor = pickRandom(nameFragments[majoritySubtype as keyof typeof nameFragments] || nameFragments.combat);
    const styleName = `${descriptor} Style of ${combatAbilities.length} Techniques`;

    // Aggregate tags
    const allTags = new Set<string>();
    combatAbilities.forEach(ability => {
      Object.keys(ability.tags || {}).forEach(tag => allTags.add(tag));
    });
    const tagArray = Array.from(allTags).slice(0, 4);

    // Build description
    const techniqueNames = combatAbilities.map(a => a.name).join(', ');
    const description = `A unified combat tradition encompassing ${techniqueNames}. Mastered by warriors who practice ${combatAbilities.length} techniques in harmony.`;

    // Determine prominence
    let prominence: HardState['prominence'] = 'recognized';
    if (combatAbilities.length >= 6) {
      prominence = 'renowned';
    } else if (combatAbilities.length >= 4) {
      prominence = 'recognized';
    } else {
      prominence = 'marginal';
    }

    // Determine dominant culture from cluster
    const cultureCounts = new Map<string, number>();
    combatAbilities.forEach(ability => {
      const culture = ability.culture || 'world';
      cultureCounts.set(culture, (cultureCounts.get(culture) || 0) + 1);
    });
    let majorityCulture = 'world';
    let maxCultureCount = 0;
    cultureCounts.forEach((count, culture) => {
      if (count > maxCultureCount) {
        maxCultureCount = count;
        majorityCulture = culture;
      }
    });

    // Convert to tag object
    const tags: Record<string, boolean> = {};
    tagArray.forEach(tag => tags[tag] = true);
    tags['meta-entity'] = true;
    tags['combat-style'] = true;

    return {
      kind: 'abilities',
      subtype: majoritySubtype,
      name: styleName,
      description,
      status: 'active',
      prominence,
      culture: majorityCulture,  // Inherit dominant culture from cluster
      tags
    };
  }
};
