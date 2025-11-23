import { GrowthTemplate, TemplateResult, Graph } from '../../../../types/engine';
import { HardState, Relationship } from '../../../../types/worldTypes';
import { pickRandom, pickMultiple, findEntities, slugifyName } from '../../../../utils/helpers';

/**
 * Great Festival Template
 *
 * Major celebrations that unite colonies and reduce conflict pressure.
 * Creates festival traditions that generate temporary alliances and cultural cohesion.
 *
 * Triggered by:
 * - Era transitions (major historical moments)
 * - High conflict pressure (> 80) - festivals as pressure release
 *
 * SYSTEM_IMPLEMENTATION_GUIDE compliance:
 * - Event-triggered (has built-in throttling)
 * - Validates faction and colony existence
 * - Graceful failure if preconditions not met
 * - Uses pressure reduction instead of temporary relationships
 */
export const greatFestival: GrowthTemplate = {
  id: 'great_festival',
  name: 'Great Festival',

  metadata: {
    produces: {
      entityKinds: [
        {
          kind: 'rules',
          subtype: 'social',
          count: { min: 1, max: 1 },
          prominence: [
            { level: 'recognized', probability: 0.7 },
            { level: 'renowned', probability: 0.3 },
          ],
        },
      ],
      relationships: [
        { kind: 'originated_in', category: 'spatial', probability: 1.0, comment: 'Festival originated in colony' },
        { kind: 'celebrated_by', category: 'cultural', probability: 3.0, comment: '2-4 factions celebrate' },
        { kind: 'allied_with', category: 'political', probability: 6.0, comment: 'Temporary festival alliances' },
      ],
    },
    effects: {
      graphDensity: 0.8,
      clusterFormation: 0.7,
      diversityImpact: 0.6,
      comment: 'Creates festivals that unite factions and reduce conflict',
    },
    parameters: {
      stableActivationChance: {
        value: 0.05,
        min: 0.01,
        max: 0.2,
        description: 'Probability when conflict is low (peaceful festivals)',
      },
    },
    tags: ['festival', 'unity', 'cultural'],
  },

  canApply: (graph: Graph) => {
    const params = greatFestival.metadata?.parameters || {};
    const stableActivationChance = params.stableActivationChance?.value ?? 0.05;

    const conflict = graph.pressures.get('conflict') || 0;
    const factions = findEntities(graph, { kind: 'faction', status: 'active' });
    const colonies = findEntities(graph, { kind: 'location', subtype: 'colony' });

    // Requires at least 2 factions and 1 colony
    // Triggered by high conflict OR randomly during stable periods
    const hasConflict = conflict > 80;
    const stableRandom = conflict < 30 && Math.random() < stableActivationChance;

    return (hasConflict || stableRandom) && factions.length >= 2 && colonies.length >= 1;
  },

  findTargets: (graph: Graph) => findEntities(graph, { kind: 'location', subtype: 'colony' }),

  expand: (graph: Graph, target?: HardState): TemplateResult => {
    const colony = target || pickRandom(findEntities(graph, { kind: 'location', subtype: 'colony' }));

    // VALIDATION: Check if colony exists
    if (!colony) {
      return {
        entities: [],
        relationships: [],
        description: 'Cannot create festival - no colonies exist'
      };
    }

    const factions = findEntities(graph, { kind: 'faction', status: 'active' });

    // VALIDATION: Check if enough factions exist
    if (factions.length < 2) {
      return {
        entities: [],
        relationships: [],
        description: `${colony.name} lacks factions for festival`
      };
    }

    const conflict = graph.pressures.get('conflict') || 0;

    // Select festival type based on trigger
    let festivalType: 'harvest' | 'memorial' | 'treaty' | 'celestial';
    let festivalName: string;

    if (conflict > 80) {
      festivalType = 'treaty';
      festivalName = pickRandom([
        'Peace Accord Festival',
        'Truce Celebration',
        'Unity Gathering',
        'Reconciliation Feast'
      ]);
    } else {
      festivalType = pickRandom(['harvest', 'memorial', 'celestial']);
      festivalName = pickRandom(
        festivalType === 'harvest' ? [
          'First Catch Festival',
          'Ice Harvest Celebration',
          'Krill Bloom Feast'
        ] : festivalType === 'memorial' ? [
          'The Long Swim Remembrance',
          'Fallen Heroes Day',
          'Founders Festival'
        ] : [
          'Aurora Peak Celebration',
          'Fissure Light Dance',
          'The Quiet Tide'
        ]
      );
    }

    const relationships: Relationship[] = [];

    // Create festival rule
    relationships.push({
      kind: 'originated_in',
      src: 'will-be-assigned-0',
      dst: colony.id
    });

    // Create celebrated_by relationships with participating factions
    // Limit to 2-4 factions to avoid relationship spam
    const participatingFactions = pickMultiple(factions, Math.min(4, factions.length));
    participatingFactions.forEach(faction => {
      relationships.push({
        kind: 'celebrated_by',
        src: 'will-be-assigned-0',
        dst: faction.id
      });
    });

    // Create temporary allied_with relationships between participating factions
    // This simulates the festival truce
    for (let i = 0; i < participatingFactions.length; i++) {
      for (let j = i + 1; j < participatingFactions.length; j++) {
        relationships.push({
          kind: 'allied_with',
          src: participatingFactions[i].id,
          dst: participatingFactions[j].id
        });
      }
    }

    return {
      entities: [{
        kind: 'rules',
        subtype: 'social',
        name: festivalName,
        description: `A great festival celebrating ${festivalType === 'harvest' ? 'abundance and prosperity' : festivalType === 'memorial' ? 'shared history and fallen heroes' : festivalType === 'treaty' ? 'peace and unity between factions' : 'the aurora and celestial wonders'}, held in ${colony.name}`,
        status: 'enacted',
        prominence: conflict > 80 ? 'renowned' : 'recognized', // Treaty festivals more prominent
        tags: ['festival', festivalType, `name:${slugifyName(colony.name)}`].slice(0, 10)
      }],
      relationships,
      description: `${festivalName} established in ${colony.name}, bringing together ${participatingFactions.length} factions in celebration`
    };
  }
};
