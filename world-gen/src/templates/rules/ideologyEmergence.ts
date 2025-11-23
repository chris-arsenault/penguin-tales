import { GrowthTemplate, TemplateResult, Graph } from '../../types/engine';
import { HardState, Relationship } from '../../types/worldTypes';
import { pickRandom, findEntities, slugifyName } from '../../utils/helpers';

/**
 * Ideology Emergence Template
 *
 * Creates new ideological movements that start as 'proposed' and spread
 * through the beliefContagion system. These represent reform movements,
 * new philosophies, or cultural shifts that must gain social acceptance.
 *
 * Unlike crisis legislation (which is enacted immediately), ideologies
 * start with a small group of believers and spread through social networks.
 * NPCs can adopt (gain belief:* tags), resist, or reject (gain immune:* tags).
 *
 * Triggered by:
 * - High cultural tension (competing ideas)
 * - Innovation era (new thinking)
 * - Reconstruction era (societal reform)
 */
export const ideologyEmergence: GrowthTemplate = {
  id: 'ideology_emergence',
  name: 'Ideological Movement',

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'rules',
          subtype: 'various',
          count: { min: 1, max: 1 },
          prominence: [{ level: 'marginal', probability: 1.0 }],
        },
      ],
      relationships: [
        { kind: 'champion_of', category: 'cultural', probability: 1.0, comment: 'Champion promotes ideology' },
        { kind: 'originated_in', category: 'spatial', probability: 0.8, comment: 'Ideology originated in location' },
        { kind: 'believer_of', category: 'cultural', probability: 7.0, comment: '3-8 initial believers' },
      ],
    },
    effects: {
      graphDensity: 0.6,
      clusterFormation: 0.7,
      diversityImpact: 0.8,
      comment: 'Creates ideological movements that spread through social networks',
    },
    parameters: {
      unstableActivationChance: {
        value: 0.3,
        min: 0.1,
        max: 0.7,
        description: 'Probability when stability is low',
      },
    },
    tags: ['ideology', 'cultural-shift', 'belief-driven'],
  },

  canApply: (graph: Graph) => {
    const params = ideologyEmergence.metadata?.parameters || {};
    const unstableActivationChance = params.unstableActivationChance?.value ?? 0.3;

    const culturalTension = graph.pressures.get('cultural_tension') || 0;
    const stability = graph.pressures.get('stability') || 0;
    const npcs = findEntities(graph, { kind: 'npc', status: 'alive' });

    // Need enough NPCs for ideology to spread
    if (npcs.length < 10) return false;

    // Triggered by cultural tension OR during innovation/reconstruction eras
    const hasTension = culturalTension > 30;
    const isReformEra = ['innovation', 'reconstruction'].includes(graph.currentEra.id);
    const unstable = stability < 40 && Math.random() < unstableActivationChance;

    return hasTension || isReformEra || unstable;
  },

  findTargets: (graph: Graph) => {
    // Ideologies are championed by charismatic NPCs
    const npcs = findEntities(graph, { kind: 'npc', status: 'alive' });
    const charismatic = npcs.filter(npc =>
      npc.subtype === 'hero' ||
      npc.tags.includes('charismatic') ||
      npc.tags.includes('mystic')
    );

    return charismatic.length > 0 ? charismatic : npcs;
  },

  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const champion = target || pickRandom(findEntities(graph, { kind: 'npc', status: 'alive' }));

    if (!champion) {
      return {
        entities: [],
        relationships: [],
        description: 'No champion found for ideology'
      };
    }

    const culturalTension = graph.pressures.get('cultural_tension') || 0;
    const conflict = graph.pressures.get('conflict') || 0;

    // Select ideology type based on world state
    let ideologyType: 'edict' | 'taboo' | 'social';
    let ideologyTheme: string;
    let ideologyName: string;

    if (conflict > 60) {
      // War-time ideologies
      ideologyType = pickRandom(['edict', 'social']);
      ideologyTheme = pickRandom(['militarism', 'pacifism', 'unity', 'isolation']);
      ideologyName = pickRandom([
        'The Way of the Soldier',
        'The Path of Peace',
        'The United Flippers',
        'The Fortress Doctrine'
      ]);
    } else if (culturalTension > 50) {
      // Cultural reform movements
      ideologyType = 'social';
      ideologyTheme = pickRandom(['equality', 'tradition', 'innovation', 'hierarchy']);
      ideologyName = pickRandom([
        'The Equal Ice Movement',
        'The Old Ways Revival',
        'The New Thinkers',
        'The Natural Order'
      ]);
    } else {
      // Mystical or philosophical movements
      ideologyType = pickRandom(['taboo', 'social']);
      ideologyTheme = pickRandom(['mysticism', 'rationalism', 'asceticism', 'hedonism']);
      ideologyName = pickRandom([
        'The Fissure Watchers',
        'The Logical Mind',
        'The Simple Life',
        'The Joy Seekers'
      ]);
    }

    const relationships: Relationship[] = [];

    // Champion is the first believer
    relationships.push({
      kind: 'champion_of',
      src: champion.id,
      dst: 'will-be-assigned-0'
    });

    // Find champion's location if they have one
    const championLocation = graph.relationships.find(r =>
      r.src === champion.id && r.kind === 'resident_of'
    );

    if (championLocation) {
      relationships.push({
        kind: 'originated_in',
        src: 'will-be-assigned-0',
        dst: championLocation.dst
      });
    }

    // Seed initial believers from champion's followers and faction members
    const followers = graph.relationships
      .filter(r => r.kind === 'follower_of' && r.dst === champion.id)
      .slice(0, 5); // Up to 5 initial believers (increased from 3)

    followers.forEach(follower => {
      relationships.push({
        kind: 'believer_of',
        src: follower.src,
        dst: 'will-be-assigned-0'
      });
    });

    // Also seed believers from champion's faction if they have one
    const factionMembership = graph.relationships.find(r =>
      r.src === champion.id && r.kind === 'member_of'
    );

    if (factionMembership) {
      const factionMembers = graph.relationships
        .filter(r => r.kind === 'member_of' && r.dst === factionMembership.dst && r.src !== champion.id)
        .slice(0, 3); // Up to 3 faction members

      factionMembers.forEach(member => {
        relationships.push({
          kind: 'believer_of',
          src: member.src,
          dst: 'will-be-assigned-0'
        });
      });
    }

    return {
      entities: [{
        kind: 'rules',
        subtype: ideologyType,
        name: ideologyName,
        description: `A ${ideologyTheme} ideology championed by ${champion.name}. This belief is spreading through whispered conversations and passionate debates.`,
        status: 'proposed', // Key: starts as proposed, will become enacted if adopted widely
        prominence: 'marginal', // Will grow with adoption
        tags: [ideologyTheme, 'ideology', `name:${slugifyName(champion.name)}`].slice(0, 10)
      }],
      relationships,
      description: `${champion.name} champions new ${ideologyTheme} ideology: ${ideologyName}`
    };
  }
};
