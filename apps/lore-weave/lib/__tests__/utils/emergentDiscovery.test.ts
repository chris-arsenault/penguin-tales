/**
 * Tests for Emergent Discovery Helpers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzeResourceDeficit,
  analyzeConflictPatterns,
  analyzeMagicPresence,
  generateResourceTheme,
  generateStrategicTheme,
  generateMysticalTheme,
  generateExplorationTheme,
  shouldDiscoverLocation,
  calculateThemeSimilarity,
  findNearbyLocations,
  ResourceAnalysis,
  ConflictAnalysis,
  MagicAnalysis
} from '../../utils/emergentDiscovery';
import { Graph } from '../../types/engine';
import { HardState, Relationship, Prominence } from '../../types/worldTypes';

// Helper function to create minimal HardState for testing
function createEntity(
  id: string,
  kind: HardState['kind'],
  subtype: string,
  status: string = 'active',
  prominence: Prominence = 'recognized'
): HardState {
  return {
    id,
    kind,
    subtype,
    name: `Test ${kind}`,
    description: '',
    status,
    prominence, culture: 'world',
    tags: [],
    links: [],
    createdAt: 0,
    updatedAt: 0
  };
}

// Helper function to create minimal Graph for testing
function createGraph(
  entities: HardState[],
  relationships: Relationship[] = [],
  pressures: Record<string, number> = {},
  era: string = 'expansion',
  tick: number = 0
): Graph {
  const entityMap = new Map<string, HardState>();
  entities.forEach(e => entityMap.set(e.id, e));

  return {
    entities: entityMap,
    relationships,
    tick,
    currentEra: { id: era, name: era } as any,
    pressures: new Map(Object.entries(pressures)),
    history: [],
    config: {} as any,
    relationshipCooldowns: new Map(),
    loreRecords: [],
    discoveryState: {
      currentThreshold: 0,
      lastDiscoveryTick: 0,
      discoveriesThisEpoch: 0
    },
    growthMetrics: {
      relationshipsPerTick: [],
      averageGrowthRate: 0
    }
  } as Graph;
}

describe('analyzeResourceDeficit', () => {
  it('should detect food scarcity when colonies are waning', () => {
    const colony1 = createEntity('col1', 'location', 'colony', 'waning');
    const colony2 = createEntity('col2', 'location', 'colony', 'waning');
    const colony3 = createEntity('col3', 'location', 'colony', 'thriving');

    const graph = createGraph([colony1, colony2, colony3], [], { resource_scarcity: 60 });
    const analysis = analyzeResourceDeficit(graph);

    expect(analysis).toBeDefined();
    expect(analysis?.primary).toBe('food');
    expect(analysis?.severity).toBe(60);
    expect(analysis?.specific).toBe('fishing');
    expect(analysis?.affectedColonies).toContain('col1');
    expect(analysis?.affectedColonies).toContain('col2');
  });

  it('should detect water scarcity with high population density', () => {
    const colony1 = createEntity('col1', 'location', 'colony', 'active');
    const colony2 = createEntity('col2', 'location', 'colony', 'active');
    const colony3 = createEntity('col3', 'location', 'colony', 'active');
    const npcs = Array.from({ length: 50 }, (_, i) => createEntity(`npc${i}`, 'npc', 'citizen', 'alive'));

    const graph = createGraph([colony1, colony2, colony3, ...npcs]);
    const analysis = analyzeResourceDeficit(graph);

    expect(analysis).toBeDefined();
    expect(analysis?.primary).toBe('water');
    expect(analysis?.specific).toBe('fresh_water');
    expect(analysis?.severity).toBe(60);
  });

  it('should detect general scarcity from pressure', () => {
    const colony1 = createEntity('col1', 'location', 'colony', 'active');
    const colony2 = createEntity('col2', 'location', 'colony', 'active');

    const graph = createGraph([colony1, colony2], [], { resource_scarcity: 70 });
    const analysis = analyzeResourceDeficit(graph);

    expect(analysis).toBeDefined();
    expect(analysis?.primary).toBe('food');
    expect(analysis?.severity).toBe(70);
    expect(['krill', 'fish', 'kelp']).toContain(analysis?.specific);
  });

  it('should return null when no scarcity', () => {
    const colony1 = createEntity('col1', 'location', 'colony', 'thriving');
    const colony2 = createEntity('col2', 'location', 'colony', 'thriving');

    const graph = createGraph([colony1, colony2], [], { resource_scarcity: 20 });
    const analysis = analyzeResourceDeficit(graph);

    expect(analysis).toBeNull();
  });

  it('should return null when no colonies', () => {
    const npc = createEntity('npc1', 'npc', 'citizen', 'alive');

    const graph = createGraph([npc]);
    const analysis = analyzeResourceDeficit(graph);

    expect(analysis).toBeNull();
  });
});

describe('analyzeConflictPatterns', () => {
  it('should detect territorial conflict', () => {
    const faction1 = createEntity('faction1', 'faction', 'guild');
    const faction2 = createEntity('faction2', 'faction', 'guild');
    const enemies: Relationship[] = [
      { kind: 'enemy_of', src: 'faction1', dst: 'faction2' }
    ];

    const graph = createGraph([faction1, faction2], enemies, { conflict: 50 });
    const analysis = analyzeConflictPatterns(graph);

    expect(analysis).toBeDefined();
    expect(analysis?.type).toBe('territorial');
    expect(analysis?.intensity).toBe(50);
    expect(analysis?.factions).toContain('faction1');
    expect(analysis?.factions).toContain('faction2');
  });

  it('should detect resource-based conflict', () => {
    const faction1 = createEntity('faction1', 'faction', 'guild');
    const faction2 = createEntity('faction2', 'faction', 'guild');
    const enemies: Relationship[] = [
      { kind: 'enemy_of', src: 'faction1', dst: 'faction2' }
    ];

    const graph = createGraph([faction1, faction2], enemies, {
      conflict: 60,
      resource_scarcity: 70
    });
    const analysis = analyzeConflictPatterns(graph);

    expect(analysis).toBeDefined();
    expect(analysis?.type).toBe('resource');
  });

  it('should detect ideological conflict', () => {
    const faction1 = createEntity('faction1', 'faction', 'guild');
    const faction2 = createEntity('faction2', 'faction', 'guild');
    const enemies: Relationship[] = [
      { kind: 'enemy_of', src: 'faction1', dst: 'faction2' }
    ];

    const graph = createGraph([faction1, faction2], enemies, {
      conflict: 50,
      cultural_tension: 60
    });
    const analysis = analyzeConflictPatterns(graph);

    expect(analysis).toBeDefined();
    expect(analysis?.type).toBe('ideological');
  });

  it('should detect defensive conflict when attacks exist', () => {
    const faction1 = createEntity('faction1', 'faction', 'guild');
    const faction2 = createEntity('faction2', 'faction', 'guild');
    const relationships: Relationship[] = [
      { kind: 'enemy_of', src: 'faction1', dst: 'faction2' },
      { kind: 'attacking', src: 'faction1', dst: 'faction2' }
    ];

    const graph = createGraph([faction1, faction2], relationships, { conflict: 50 });
    const analysis = analyzeConflictPatterns(graph);

    expect(analysis).toBeDefined();
    expect(analysis?.type).toBe('defensive');
  });

  it('should set needsAdvantage when many conflicts', () => {
    const factions = Array.from({ length: 4 }, (_, i) => createEntity(`faction${i}`, 'faction', 'guild'));
    const relationships: Relationship[] = [
      { kind: 'enemy_of', src: 'faction0', dst: 'faction1' },
      { kind: 'attacking', src: 'faction0', dst: 'faction1' },
      { kind: 'attacking', src: 'faction2', dst: 'faction3' },
      { kind: 'attacking', src: 'faction1', dst: 'faction2' }
    ];

    const graph = createGraph(factions, relationships, { conflict: 70 });
    const analysis = analyzeConflictPatterns(graph);

    expect(analysis).toBeDefined();
    expect(analysis?.needsAdvantage).toBe(true);
  });

  it('should return null when conflict pressure is low', () => {
    const faction1 = createEntity('faction1', 'faction', 'guild');
    const faction2 = createEntity('faction2', 'faction', 'guild');

    const graph = createGraph([faction1, faction2], [], { conflict: 20 });
    const analysis = analyzeConflictPatterns(graph);

    expect(analysis).toBeNull();
  });

  it('should return null when no enemies exist', () => {
    const faction1 = createEntity('faction1', 'faction', 'guild');
    const faction2 = createEntity('faction2', 'faction', 'guild');

    const graph = createGraph([faction1, faction2], [], { conflict: 60 });
    const analysis = analyzeConflictPatterns(graph);

    expect(analysis).toBeNull();
  });
});

describe('analyzeMagicPresence', () => {
  it('should detect magic instability', () => {
    const magic1 = createEntity('magic1', 'abilities', 'magic');
    const magic2 = createEntity('magic2', 'abilities', 'magic');
    const anomaly = createEntity('anomaly1', 'location', 'anomaly');

    const graph = createGraph([magic1, magic2, anomaly], [], { magical_instability: 50 });
    const analysis = analyzeMagicPresence(graph);

    expect(analysis).toBeDefined();
    expect(analysis?.instability).toBe(50);
    expect(analysis?.existingMagicTypes).toHaveLength(2);
    expect(analysis?.anomalyCount).toBe(1);
  });

  it('should choose convergence manifestation with many anomalies', () => {
    const anomalies = Array.from({ length: 5 }, (_, i) => createEntity(`anomaly${i}`, 'location', 'anomaly'));

    const graph = createGraph(anomalies, [], { magical_instability: 60 });
    const analysis = analyzeMagicPresence(graph);

    expect(analysis).toBeDefined();
    expect(analysis?.manifestationType).toBe('convergence');
  });

  it('should choose artifact manifestation with many magic abilities', () => {
    const magicAbilities = Array.from({ length: 5 }, (_, i) => createEntity(`magic${i}`, 'abilities', 'magic'));

    const graph = createGraph(magicAbilities, [], { magical_instability: 50 });
    const analysis = analyzeMagicPresence(graph);

    expect(analysis).toBeDefined();
    expect(analysis?.manifestationType).toBe('artifact');
  });

  it('should choose temple manifestation during expansion era', () => {
    const magic = createEntity('magic1', 'abilities', 'magic');

    const graph = createGraph([magic], [], { magical_instability: 40 }, 'expansion');
    const analysis = analyzeMagicPresence(graph);

    expect(analysis).toBeDefined();
    expect(analysis?.manifestationType).toBe('temple');
  });

  it('should return null when instability is low', () => {
    const magic = createEntity('magic1', 'abilities', 'magic');

    const graph = createGraph([magic], [], { magical_instability: 20 });
    const analysis = analyzeMagicPresence(graph);

    expect(analysis).toBeNull();
  });
});

describe('generateResourceTheme', () => {
  it('should generate resource theme with correct structure', () => {
    const analysis: ResourceAnalysis = {
      primary: 'food',
      severity: 60,
      specific: 'krill',
      affectedColonies: ['col1', 'col2']
    };

    const theme = generateResourceTheme(analysis, 'expansion');

    expect(theme.subtype).toBe('geographic_feature');
    expect(theme.themeString).toContain('_');
    expect(theme.tags).toContain('resource');
    expect(theme.tags).toContain('food');
    expect(theme.tags).toContain('krill');
    expect(theme.relatedTo).toEqual(['col1', 'col2']);
  });

  it('should use conflict-appropriate depth words', () => {
    const analysis: ResourceAnalysis = {
      primary: 'food',
      severity: 60,
      specific: 'fishing',
      affectedColonies: []
    };

    // Run multiple times to check that it uses conflict words
    const themes = Array.from({ length: 10 }, () => generateResourceTheme(analysis, 'conflict'));
    const hasConflictWords = themes.some(t =>
      t.themeString.includes('hidden') ||
      t.themeString.includes('secret') ||
      t.themeString.includes('deep')
    );

    expect(hasConflictWords).toBe(true);
  });
});

describe('generateStrategicTheme', () => {
  it('should generate strategic theme with correct structure', () => {
    const analysis: ConflictAnalysis = {
      type: 'territorial',
      intensity: 60,
      factions: ['faction1', 'faction2'],
      needsAdvantage: true
    };

    const theme = generateStrategicTheme(analysis, 'conflict');

    expect(theme.subtype).toBe('geographic_feature');
    expect(theme.themeString).toContain('_');
    expect(theme.tags).toContain('strategic');
    expect(theme.tags).toContain('territorial');
    expect(theme.relatedTo).toEqual(['faction1', 'faction2']);
  });

  it('should use appropriate advantage words when needs advantage', () => {
    const analysis: ConflictAnalysis = {
      type: 'defensive',
      intensity: 70,
      factions: ['faction1'],
      needsAdvantage: true
    };

    const themes = Array.from({ length: 10 }, () => generateStrategicTheme(analysis, 'conflict'));
    const hasAdvantageWords = themes.some(t =>
      t.themeString.includes('defensible') ||
      t.themeString.includes('fortified') ||
      t.themeString.includes('strategic') ||
      t.themeString.includes('elevated')
    );

    expect(hasAdvantageWords).toBe(true);
  });

  it('should use appropriate form words for conflict type', () => {
    const resourceAnalysis: ConflictAnalysis = {
      type: 'resource',
      intensity: 60,
      factions: ['faction1'],
      needsAdvantage: false
    };

    const themes = Array.from({ length: 10 }, () => generateStrategicTheme(resourceAnalysis, 'conflict'));
    const hasResourceForms = themes.some(t =>
      t.themeString.includes('cache') ||
      t.themeString.includes('reserve') ||
      t.themeString.includes('depot') ||
      t.themeString.includes('stockpile')
    );

    expect(hasResourceForms).toBe(true);
  });
});

describe('generateMysticalTheme', () => {
  it('should generate mystical theme with correct structure', () => {
    const analysis: MagicAnalysis = {
      instability: 50,
      existingMagicTypes: ['ice_magic', 'tide_magic'],
      anomalyCount: 2,
      manifestationType: 'phenomenon'
    };

    const theme = generateMysticalTheme(analysis, 'innovation');

    expect(theme.subtype).toBe('anomaly');
    expect(theme.themeString).toContain('_');
    expect(theme.tags).toContain('mystical');
    expect(theme.tags).toContain('phenomenon');
    expect(theme.relatedTo).toEqual([]);
  });

  it('should use chaotic words for high instability', () => {
    const analysis: MagicAnalysis = {
      instability: 80,
      existingMagicTypes: [],
      anomalyCount: 1,
      manifestationType: 'convergence'
    };

    const themes = Array.from({ length: 10 }, () => generateMysticalTheme(analysis, 'innovation'));
    const hasChaotic = themes.some(t =>
      t.themeString.includes('chaotic') ||
      t.themeString.includes('wild') ||
      t.themeString.includes('unstable') ||
      t.themeString.includes('volatile')
    );

    expect(hasChaotic).toBe(true);
  });

  it('should use appropriate manifestation words', () => {
    const analysis: MagicAnalysis = {
      instability: 50,
      existingMagicTypes: [],
      anomalyCount: 1,
      manifestationType: 'temple'
    };

    const themes = Array.from({ length: 10 }, () => generateMysticalTheme(analysis, 'expansion'));
    const hasTempleWords = themes.some(t =>
      t.themeString.includes('shrine') ||
      t.themeString.includes('temple') ||
      t.themeString.includes('sanctum') ||
      t.themeString.includes('altar')
    );

    expect(hasTempleWords).toBe(true);
  });
});

describe('generateExplorationTheme', () => {
  it('should generate exploration theme with correct structure', () => {
    const graph = createGraph([], [], {}, 'expansion');
    const theme = generateExplorationTheme(graph);

    expect(theme.subtype).toBe('geographic_feature');
    expect(theme.themeString).toContain('_');
    expect(theme.tags).toContain('exploration');
    expect(theme.tags).toContain('neutral');
    expect(theme.relatedTo).toEqual([]);
  });

  it('should use expansion-appropriate descriptors', () => {
    const graph = createGraph([], [], {}, 'expansion');
    const themes = Array.from({ length: 10 }, () => generateExplorationTheme(graph));
    const hasExpansionWords = themes.some(t =>
      t.themeString.includes('fertile') ||
      t.themeString.includes('pristine') ||
      t.themeString.includes('untouched') ||
      t.themeString.includes('virgin')
    );

    expect(hasExpansionWords).toBe(true);
  });

  it('should use reconstruction-appropriate descriptors', () => {
    const graph = createGraph([], [], {}, 'reconstruction');
    const themes = Array.from({ length: 10 }, () => generateExplorationTheme(graph));
    const hasReconstructionWords = themes.some(t =>
      t.themeString.includes('renewed') ||
      t.themeString.includes('reclaimed') ||
      t.themeString.includes('restored') ||
      t.themeString.includes('peaceful')
    );

    expect(hasReconstructionWords).toBe(true);
  });
});

describe('shouldDiscoverLocation', () => {
  it('should return false when hard cap reached', () => {
    const locations = Array.from({ length: 45 }, (_, i) =>
      createEntity(`loc${i}`, 'location', 'colony')
    );
    const graph = createGraph(locations, [], {}, 'expansion');

    expect(shouldDiscoverLocation(graph)).toBe(false);
  });

  it('should return false when too soon after last discovery', () => {
    const colony = createEntity('col1', 'location', 'colony');
    const explorer = createEntity('npc1', 'npc', 'hero', 'alive');
    const graph = createGraph([colony, explorer], [], {}, 'expansion', 10);
    graph.discoveryState.lastDiscoveryTick = 8;

    expect(shouldDiscoverLocation(graph)).toBe(false);
  });

  it('should return false when too many discoveries this epoch', () => {
    const colony = createEntity('col1', 'location', 'colony');
    const explorer = createEntity('npc1', 'npc', 'hero', 'alive');
    const graph = createGraph([colony, explorer], [], {}, 'expansion');
    graph.discoveryState.discoveriesThisEpoch = 3;

    expect(shouldDiscoverLocation(graph)).toBe(false);
  });

  it('should return false when no explorers', () => {
    const colony = createEntity('col1', 'location', 'colony');
    const npc = createEntity('npc1', 'npc', 'citizen', 'alive');
    const graph = createGraph([colony, npc], [], {}, 'expansion');

    expect(shouldDiscoverLocation(graph)).toBe(false);
  });

  it('should return false when explorers are dead', () => {
    const colony = createEntity('col1', 'location', 'colony');
    const explorer = createEntity('npc1', 'npc', 'hero', 'dead');
    const graph = createGraph([colony, explorer], [], {}, 'expansion');

    expect(shouldDiscoverLocation(graph)).toBe(false);
  });

  it('should have probability based on era', () => {
    const colony = createEntity('col1', 'location', 'colony');
    const explorer = createEntity('npc1', 'npc', 'hero', 'alive');

    // Test multiple times to verify probability exists
    const results: boolean[] = [];
    for (let i = 0; i < 200; i++) {
      const graph = createGraph([colony, explorer], [], {}, 'expansion', 20);
      graph.discoveryState.lastDiscoveryTick = 0; // Long enough ago
      graph.discoveryState.discoveriesThisEpoch = 0; // Haven't hit limit
      results.push(shouldDiscoverLocation(graph));
    }

    const trueCount = results.filter(r => r).length;
    // Should be around 15% for expansion era (with variance, so check it's not 0 or 100)
    expect(trueCount).toBeGreaterThan(10); // At least 5% of 200
    expect(trueCount).toBeLessThan(50); // At most 25% of 200
  });
});

describe('calculateThemeSimilarity', () => {
  it('should calculate overlap between location tags and theme', () => {
    const location = createEntity('loc1', 'location', 'geographic_feature');
    location.tags = ['deep', 'krill', 'resource'];
    location.createdAt = 100;
    location.updatedAt = 100;

    const similarity = calculateThemeSimilarity(location, 'deep_krill_channel');

    expect(similarity).toBeGreaterThan(0);
  });

  it('should give bonus for geographic features', () => {
    const geographicLocation = createEntity('loc1', 'location', 'geographic_feature');
    geographicLocation.tags = ['deep'];
    geographicLocation.createdAt = 100;
    geographicLocation.updatedAt = 100;

    const otherLocation = createEntity('loc2', 'location', 'colony');
    otherLocation.tags = ['deep'];
    otherLocation.createdAt = 100;
    otherLocation.updatedAt = 100;

    const geoSimilarity = calculateThemeSimilarity(geographicLocation, 'deep_channel');
    const otherSimilarity = calculateThemeSimilarity(otherLocation, 'deep_channel');

    expect(geoSimilarity).toBeGreaterThan(otherSimilarity);
  });

  it('should give bonus for recently created locations', () => {
    const recentLocation = createEntity('loc1', 'location', 'geographic_feature');
    recentLocation.tags = ['deep'];
    recentLocation.createdAt = 100;
    recentLocation.updatedAt = 105;

    const oldLocation = createEntity('loc2', 'location', 'geographic_feature');
    oldLocation.tags = ['deep'];
    oldLocation.createdAt = 50;
    oldLocation.updatedAt = 100;

    const recentSimilarity = calculateThemeSimilarity(recentLocation, 'deep_channel');
    const oldSimilarity = calculateThemeSimilarity(oldLocation, 'deep_channel');

    expect(recentSimilarity).toBeGreaterThan(oldSimilarity);
  });

  it('should return 0 when no overlap', () => {
    const location = createEntity('loc1', 'location', 'geographic_feature');
    location.tags = ['fire', 'mountain'];
    location.createdAt = 100;
    location.updatedAt = 100;

    const similarity = calculateThemeSimilarity(location, 'deep_krill_channel');

    expect(similarity).toBe(0);
  });
});

describe('findNearbyLocations', () => {
  it('should find adjacent locations', () => {
    const explorer = createEntity('npc1', 'npc', 'hero', 'alive');
    const colony = createEntity('col1', 'location', 'colony');
    const nearbyLoc1 = createEntity('loc1', 'location', 'geographic_feature');
    const nearbyLoc2 = createEntity('loc2', 'location', 'geographic_feature');
    const farLoc = createEntity('loc3', 'location', 'geographic_feature');

    explorer.links = [{ kind: 'resident_of', src: 'npc1', dst: 'col1' }];
    colony.links = [
      { kind: 'adjacent_to', src: 'col1', dst: 'loc1' },
      { kind: 'adjacent_to', src: 'col1', dst: 'loc2' }
    ];

    const graph = createGraph([explorer, colony, nearbyLoc1, nearbyLoc2, farLoc]);
    const nearby = findNearbyLocations(explorer, graph);

    expect(nearby).toHaveLength(2);
    expect(nearby.map(l => l.id)).toContain('loc1');
    expect(nearby.map(l => l.id)).toContain('loc2');
    expect(nearby.map(l => l.id)).not.toContain('loc3');
  });

  it('should work with leader_of relationship', () => {
    const explorer = createEntity('npc1', 'npc', 'mayor', 'alive');
    const colony = createEntity('col1', 'location', 'colony');
    const nearbyLoc = createEntity('loc1', 'location', 'geographic_feature');

    explorer.links = [{ kind: 'leader_of', src: 'npc1', dst: 'col1' }];
    colony.links = [{ kind: 'adjacent_to', src: 'col1', dst: 'loc1' }];

    const graph = createGraph([explorer, colony, nearbyLoc]);
    const nearby = findNearbyLocations(explorer, graph);

    expect(nearby).toHaveLength(1);
    expect(nearby[0].id).toBe('loc1');
  });

  it('should return empty array when explorer has no location', () => {
    const explorer = createEntity('npc1', 'npc', 'hero', 'alive');
    const graph = createGraph([explorer]);
    const nearby = findNearbyLocations(explorer, graph);

    expect(nearby).toEqual([]);
  });

  it('should return empty array when location not found', () => {
    const explorer = createEntity('npc1', 'npc', 'hero', 'alive');
    explorer.links = [{ kind: 'resident_of', src: 'npc1', dst: 'nonexistent' }];

    const graph = createGraph([explorer]);
    const nearby = findNearbyLocations(explorer, graph);

    expect(nearby).toEqual([]);
  });

  it('should return empty array when no adjacent locations', () => {
    const explorer = createEntity('npc1', 'npc', 'hero', 'alive');
    const colony = createEntity('col1', 'location', 'colony');

    explorer.links = [{ kind: 'resident_of', src: 'npc1', dst: 'col1' }];

    const graph = createGraph([explorer, colony]);
    const nearby = findNearbyLocations(explorer, graph);

    expect(nearby).toEqual([]);
  });
});
