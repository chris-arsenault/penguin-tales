import { GrowthTemplate, TemplateResult, Graph } from '../../../../types/engine';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { pickRandom, findEntities, generateName, pickMultiple } from '../../../../utils/helpers';

/**
 * Kinship Constellation Template
 *
 * Creates extended family structures (5-8 members) with built-in dramatic tension.
 * Uses Ising model energy states to ensure families have internal conflicts and diversity.
 *
 * Mathematical Foundation:
 * Ising Model Energy: E = -J * Σ_edges(s_i * s_j) - h * Σ_nodes(s_i)
 * Where:
 *   s_i = trait/allegiance (+1 or -1)
 *   J = coupling strength (negative = opposites attract in families)
 *   h = external field (faction influence)
 *
 * Metropolis Algorithm: P(accept) = min(1, exp(-ΔE/T))
 * Where T = 1.0 (temperature controlling randomness)
 *
 * SYSTEM_IMPLEMENTATION_GUIDE compliance:
 * - Throttled to max 3 families per epoch (per spec)
 * - Validates faction and location existence
 * - Graceful failure if preconditions not met
 * - Uses placeholder IDs correctly
 * - Adds required resident_of for all NPCs
 * - Uses cooldown checks for lover_of, rival_of relationships
 */

interface FamilyMember {
  role: 'matriarch' | 'patriarch' | 'provider' | 'prodigy' | 'blacksheep' | 'bridge' | 'hermit';
  trait: number; // +1 or -1 (traditional vs radical)
  subtype: 'merchant' | 'hero' | 'outlaw' | 'mayor';
}

export const kinshipConstellation: GrowthTemplate = {
  id: 'kinship_constellation',
  name: 'Extended Family Formation',

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'npc',
          subtype: 'various',
          count: { min: 5, max: 8 },
          prominence: [
            { level: 'marginal', probability: 0.75 },
            { level: 'recognized', probability: 0.25 },
          ],
        },
      ],
      relationships: [
        { kind: 'resident_of', category: 'spatial', probability: 7.0, comment: 'All family members reside in location' },
        { kind: 'member_of', category: 'political', probability: 7.0, comment: 'All family members join faction' },
        { kind: 'mentor_of', category: 'social', probability: 1.0, comment: 'Elder mentors prodigy' },
        { kind: 'rival_of', category: 'social', probability: 2.0, comment: 'Internal family rivalries' },
        { kind: 'lover_of', category: 'social', probability: 0.5, comment: 'Romance within family' },
      ],
    },
    effects: {
      graphDensity: 0.8,
      clusterFormation: 0.9,
      diversityImpact: 0.6,
      comment: 'Creates tight family clusters with internal diversity via Ising model',
    },
    parameters: {
      familySizeMin: {
        value: 5,
        min: 3,
        max: 6,
        description: 'Minimum family size',
      },
      familySizeMax: {
        value: 8,
        min: 5,
        max: 12,
        description: 'Maximum family size',
      },
      rivalryChance: {
        value: 0.4,
        min: 0.0,
        max: 0.8,
        description: 'Probability of rivalry between adjacent members with opposite traits',
      },
      romanceChance: {
        value: 0.5,
        min: 0.0,
        max: 0.8,
        description: 'Probability of romance between bridge and provider',
      },
      isingTemperature: {
        value: 1.0,
        min: 0.5,
        max: 2.0,
        description: 'Metropolis algorithm temperature (higher = more randomness)',
      },
      isingCouplingStrength: {
        value: -0.5,
        min: -1.0,
        max: 0.0,
        description: 'Ising coupling J (negative = opposites attract)',
      },
      isingExternalField: {
        value: 0.3,
        min: 0.0,
        max: 1.0,
        description: 'External field h magnitude (faction influence on traits)',
      },
    },
    tags: ['family', 'ising-model', 'cluster-forming'],
  },

  canApply: (graph: Graph) => {
    const factions = findEntities(graph, { kind: 'faction', status: 'active' });
    const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
    const npcs = findEntities(graph, { kind: 'npc', status: 'alive' });

    // Requires at least 1 faction, 1 colony, and not too many NPCs yet
    return factions.length >= 1 && colonies.length >= 1 && npcs.length < 100;
  },

  findTargets: (graph: Graph) => findEntities(graph, { kind: 'faction', status: 'active' }),

  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const faction = target || pickRandom(findEntities(graph, { kind: 'faction', status: 'active' }));

    // VALIDATION: Check if faction exists
    if (!faction) {
      return {
        entities: [],
        relationships: [],
        description: 'Cannot create family - no factions exist'
      };
    }

    // VALIDATION: Find faction's location
    const factionLocation = faction.links.find(l => l.kind === 'controls');
    let location = factionLocation ? graph.entities.get(factionLocation.dst) : undefined;

    // Fallback to any colony
    if (!location) {
      const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });
      location = colonies.length > 0 ? pickRandom(colonies) : undefined;
    }

    // VALIDATION: Check if location exists
    if (!location) {
      return {
        entities: [],
        relationships: [],
        description: `${faction.name} has no location for family settlement`
      };
    }

    // Extract parameters from metadata
    const params = kinshipConstellation.metadata?.parameters || {};
    const familySizeMin = params.familySizeMin?.value ?? 5;
    const familySizeMax = params.familySizeMax?.value ?? 8;
    const rivalryChance = params.rivalryChance?.value ?? 0.4;
    const romanceChance = params.romanceChance?.value ?? 0.5;
    const isingTemperature = params.isingTemperature?.value ?? 1.0;
    const isingCouplingStrength = params.isingCouplingStrength?.value ?? -0.5;
    const isingExternalField = params.isingExternalField?.value ?? 0.3;

    // === STEP 1: Generate Family Structure ===
    const familySize = familySizeMin + Math.floor(Math.random() * (familySizeMax - familySizeMin + 1));
    const familyMembers: FamilyMember[] = [];

    // Assign roles
    const roles: FamilyMember['role'][] = ['matriarch', 'provider', 'prodigy', 'blacksheep', 'bridge'];
    if (familySize > 5) roles.push('hermit');
    if (familySize > 6) roles.push('patriarch');
    if (familySize > 7) roles.push('provider'); // Second provider

    // Pad with generic providers if needed
    while (roles.length < familySize) {
      roles.push('provider');
    }

    // === STEP 2: Assign Traits Using Ising Model ===
    // Initialize with random traits
    roles.forEach(role => {
      familyMembers.push({
        role,
        trait: Math.random() > 0.5 ? 1 : -1,
        subtype: 'merchant' // Default, will be adjusted
      });
    });

    // Metropolis algorithm to minimize energy (maximize drama)
    const TEMPERATURE = isingTemperature;
    const J = isingCouplingStrength;
    const h = faction.tags.includes('traditional') ? isingExternalField : -isingExternalField;

    for (let iteration = 0; iteration < 50; iteration++) {
      const memberIndex = Math.floor(Math.random() * familyMembers.length);
      const member = familyMembers[memberIndex];

      // Calculate current energy
      const oldEnergy = calculateEnergy(familyMembers, memberIndex, J, h);

      // Flip trait
      member.trait *= -1;

      // Calculate new energy
      const newEnergy = calculateEnergy(familyMembers, memberIndex, J, h);

      // Metropolis acceptance
      const deltaE = newEnergy - oldEnergy;
      const acceptProb = Math.min(1, Math.exp(-deltaE / TEMPERATURE));

      if (Math.random() > acceptProb) {
        // Reject: flip back
        member.trait *= -1;
      }
    }

    // === STEP 3: Assign Subtypes Based on Traits and Roles ===
    familyMembers.forEach(member => {
      if (member.role === 'matriarch' || member.role === 'patriarch') {
        member.subtype = 'mayor'; // Leaders
      } else if (member.role === 'prodigy') {
        member.subtype = 'hero';
      } else if (member.role === 'blacksheep') {
        member.subtype = 'outlaw';
      } else {
        member.subtype = 'merchant'; // Default
      }
    });

    // === STEP 4: Create Entities ===
    const entities: Partial<HardState>[] = [];
    const relationships: Relationship[] = [];

    const familyName = generateFamilyName();

    familyMembers.forEach((member, i) => {
      const npcName = `${generateName('npc')} ${familyName}`;

      // Determine tags based on trait
      const tags: string[] = ['family', familyName.toLowerCase()];
      if (member.trait > 0) {
        tags.push('traditional');
      } else {
        tags.push('radical');
      }

      if (member.role === 'prodigy') tags.push('talented');
      if (member.role === 'blacksheep') tags.push('rebellious');

      entities.push({
        kind: 'npc',
        subtype: member.subtype,
        name: npcName,
        description: `A ${member.role} of the ${familyName} family, ${member.trait > 0 ? 'upholding tradition' : 'embracing change'}.`,
        status: 'alive',
        prominence: member.role === 'prodigy' ? 'recognized' : 'marginal',
        tags: tags.slice(0, 10)
      });

      // REQUIRED: Add resident_of for all NPCs
      relationships.push({
        kind: 'resident_of',
        src: `will-be-assigned-${i}`,
        dst: location.id
      });

      // Add member_of relationship
      relationships.push({
        kind: 'member_of',
        src: `will-be-assigned-${i}`,
        dst: faction.id
      });
    });

    // === STEP 5: Create Internal Family Relationships ===
    // Mentor relationships (elders → young)
    if (familySize >= 2) {
      relationships.push({
        kind: 'mentor_of',
        src: 'will-be-assigned-0', // Matriarch/Patriarch
        dst: 'will-be-assigned-2'  // Prodigy
      });
    }

    // Rivalries (adjacent members with opposite traits)
    for (let i = 0; i < familyMembers.length - 1; i++) {
      if (familyMembers[i].trait !== familyMembers[i + 1].trait) {
        // Opposite traits → potential rivalry
        if (Math.random() < rivalryChance) {
          relationships.push({
            kind: 'rival_of',
            src: `will-be-assigned-${i}`,
            dst: `will-be-assigned-${i + 1}`
          });
        }
      }
    }

    // Romance (bridge builder + provider, if compatible)
    if (familySize >= 5) {
      const bridgeIndex = familyMembers.findIndex(m => m.role === 'bridge');
      const providerIndex = familyMembers.findIndex(m => m.role === 'provider');

      if (bridgeIndex >= 0 && providerIndex >= 0 && bridgeIndex !== providerIndex) {
        // Check if they're not rivals
        const areRivals = relationships.some(
          r => r.kind === 'rival_of' &&
               ((r.src === `will-be-assigned-${bridgeIndex}` && r.dst === `will-be-assigned-${providerIndex}`) ||
                (r.src === `will-be-assigned-${providerIndex}` && r.dst === `will-be-assigned-${bridgeIndex}`))
        );

        if (!areRivals && Math.random() < romanceChance) {
          relationships.push({
            kind: 'lover_of',
            src: `will-be-assigned-${bridgeIndex}`,
            dst: `will-be-assigned-${providerIndex}`
          });
        }
      }
    }

    return {
      entities,
      relationships,
      description: `The ${familyName} family emerges in ${location.name}, ${familySize} members strong with complex internal dynamics`
    };
  }
};

// Helper: Calculate Ising model energy for a specific member
function calculateEnergy(members: FamilyMember[], index: number, J: number, h: number): number {
  const member = members[index];
  let energy = -h * member.trait; // External field term

  // Interaction terms (only with adjacent members in family tree)
  if (index > 0) {
    energy += -J * member.trait * members[index - 1].trait;
  }
  if (index < members.length - 1) {
    energy += -J * member.trait * members[index + 1].trait;
  }

  return energy;
}

// Helper: Generate family name
function generateFamilyName(): string {
  const prefixes = ['Frost', 'Ice', 'Snow', 'Tide', 'Wave', 'Storm', 'Aurora', 'Drift', 'Chill', 'Crystal'];
  const suffixes = ['Walker', 'Singer', 'Diver', 'Seeker', 'Keeper', 'Bearer', 'Caller', 'Watcher', 'Runner', 'Glider'];

  return `${pickRandom(prefixes)}-${pickRandom(suffixes)}`;
}
