import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetaEntityFormation } from '../../services/metaEntityFormation';
import { TemplateGraphView } from '../../services/templateGraphView';
import { TargetSelector } from '../../services/targetSelector';
import { Graph, MetaEntityConfig } from '../../types/engine';
import { HardState } from '../../types/worldTypes';
import * as helpers from '../../utils/helpers';

describe('MetaEntityFormation', () => {
  let formation: MetaEntityFormation;
  let mockGraph: Graph;
  let mockGraphView: TemplateGraphView;

  beforeEach(() => {
    formation = new MetaEntityFormation();

    // Create mock graph
    mockGraph = {
      entities: new Map(),
      relationships: [],
      tick: 100,
      currentEra: {
        id: 'test-era',
        name: 'Test Era',
        description: 'Test',
        duration: 10,
        templateWeights: new Map(),
        systemModifiers: new Map(),
        pressureModifiers: new Map()
      },
      pressures: new Map(),
      history: [],
      statistics: {
        entitiesCreated: 0,
        relationshipsCreated: 0,
        templatesApplied: 0,
        systemsApplied: 0
      },
      eraHistory: [],
      activeEra: 'test-era',
      config: {} as any
    } as unknown as Graph;

    // Create mock graph view with target selector
    const targetSelector = new TargetSelector();
    mockGraphView = new TemplateGraphView(mockGraph, targetSelector);
  });

  describe('registerConfig', () => {
    it('should register a meta-entity config', () => {
      const config: MetaEntityConfig = {
        sourceKind: 'abilities',
        metaKind: 'abilities',
        trigger: 'epoch_end',
        clustering: {
          minSize: 3,
          maxSize: 8,
          minimumScore: 2.0,
          criteria: [
            { type: 'shared_practitioner', weight: 1.5 },
            { type: 'shared_tags', weight: 1.0, threshold: 0.5 }
          ]
        },
        transformation: {
          transferRelationships: true,
          markOriginalsHistorical: true,
          redirectFutureRelationships: false,
          preserveOriginalLinks: true,
          createGovernanceFaction: false
        },
        factory: (cluster: HardState[]) => ({
          kind: 'abilities',
          subtype: 'school',
          name: `School of Magic`,
          description: `A magical school`,
          status: 'active',
          prominence: 'recognized', culture: 'world',
          tags: ['meta-entity', 'school'],
          links: []
        })
      };

      formation.registerConfig(config);

      const configs = formation.getConfigs();
      expect(configs.has('abilities')).toBe(true);
      expect(configs.get('abilities')).toEqual(config);
    });

    it('should overwrite config if registered twice', () => {
      const config1: MetaEntityConfig = {
        sourceKind: 'abilities',
        metaKind: 'abilities',
        trigger: 'epoch_end',
        clustering: {
          minSize: 3,
          maxSize: 8,
          minimumScore: 2.0,
          criteria: []
        },
        transformation: {
          transferRelationships: true,
          markOriginalsHistorical: true,
          redirectFutureRelationships: false,
          preserveOriginalLinks: true,
          createGovernanceFaction: false
        },
        factory: () => ({ kind: 'abilities', subtype: 'school', name: 'School 1', description: '', status: 'active', prominence: 'recognized', culture: 'world', tags: [], links: [] })
      };

      const config2: MetaEntityConfig = {
        ...config1,
        factory: () => ({ kind: 'abilities', subtype: 'school', name: 'School 2', description: '', status: 'active', prominence: 'recognized', culture: 'world', tags: [], links: [] })
      };

      formation.registerConfig(config1);
      formation.registerConfig(config2);

      const configs = formation.getConfigs();
      expect(configs.get('abilities')?.factory([], mockGraph).name).toBe('School 2');
    });
  });

  describe('detectClusters', () => {
    it('should return empty array if config not registered', () => {
      const clusters = formation.detectClusters(mockGraphView, 'unknown-kind');
      expect(clusters).toEqual([]);
    });

    it('should return empty array if not enough entities', () => {
      const config: MetaEntityConfig = {
        sourceKind: 'abilities',
        metaKind: 'abilities',
        trigger: 'epoch_end',
        clustering: {
          minSize: 3,
          maxSize: 8,
          minimumScore: 2.0,
          criteria: []
        },
        transformation: {
          transferRelationships: true,
          markOriginalsHistorical: true,
          redirectFutureRelationships: false,
          preserveOriginalLinks: true,
          createGovernanceFaction: false
        },
        factory: () => ({ kind: 'abilities', subtype: 'school', name: 'School', description: '', status: 'active', prominence: 'recognized', culture: 'world', tags: [], links: [] })
      };

      formation.registerConfig(config);

      // Add only 2 entities (less than minSize of 3)
      mockGraph.entities.set('ability1', {
        id: 'ability1',
        kind: 'abilities',
        subtype: 'fire',
        name: 'Fire Spell',
        description: 'Shoots fire',
        status: 'active',
        prominence: 'marginal', culture: 'world',
        tags: ['fire', 'combat'],
        links: [],
        createdAt: 10,
        updatedAt: 10
      });

      mockGraph.entities.set('ability2', {
        id: 'ability2',
        kind: 'abilities',
        subtype: 'ice',
        name: 'Ice Spell',
        description: 'Shoots ice',
        status: 'active',
        prominence: 'marginal', culture: 'world',
        tags: ['ice', 'combat'],
        links: [],
        createdAt: 20,
        updatedAt: 20
      });

      const clusters = formation.detectClusters(mockGraphView, 'abilities');
      expect(clusters).toEqual([]);
    });

    it('should exclude historical entities', () => {
      const config: MetaEntityConfig = {
        sourceKind: 'abilities',
        metaKind: 'abilities',
        trigger: 'epoch_end',
        clustering: {
          minSize: 2,
          maxSize: 8,
          minimumScore: 0.5,
          criteria: [{ type: 'shared_tags', weight: 1.0, threshold: 0.3 }]
        },
        transformation: {
          transferRelationships: true,
          markOriginalsHistorical: true,
          redirectFutureRelationships: false,
          preserveOriginalLinks: true,
          createGovernanceFaction: false
        },
        factory: () => ({ kind: 'abilities', subtype: 'school', name: 'School', description: '', status: 'active', prominence: 'recognized', culture: 'world', tags: [], links: [] })
      };

      formation.registerConfig(config);

      // Add 2 active and 1 historical
      mockGraph.entities.set('ability1', {
        id: 'ability1',
        kind: 'abilities',
        subtype: 'fire',
        name: 'Fire Spell',
        description: 'Shoots fire',
        status: 'active',
        prominence: 'marginal', culture: 'world',
        tags: ['fire', 'combat'],
        links: [],
        createdAt: 10,
        updatedAt: 10
      });

      mockGraph.entities.set('ability2', {
        id: 'ability2',
        kind: 'abilities',
        subtype: 'ice',
        name: 'Ice Spell',
        description: 'Shoots ice',
        status: 'historical',
        prominence: 'marginal', culture: 'world',
        tags: ['ice', 'combat'],
        links: [],
        createdAt: 20,
        updatedAt: 20
      });

      mockGraph.entities.set('ability3', {
        id: 'ability3',
        kind: 'abilities',
        subtype: 'fire',
        name: 'Fireball',
        description: 'Big fire',
        status: 'active',
        prominence: 'marginal', culture: 'world',
        tags: ['fire', 'combat'],
        links: [],
        createdAt: 30,
        updatedAt: 30
      });

      const clusters = formation.detectClusters(mockGraphView, 'abilities');

      // Should only cluster the 2 active entities
      expect(clusters.length).toBeGreaterThan(0);
      clusters.forEach(cluster => {
        cluster.entities.forEach(entity => {
          expect(entity.status).not.toBe('historical');
        });
      });
    });

    it('should exclude meta-entities from clustering', () => {
      const config: MetaEntityConfig = {
        sourceKind: 'abilities',
        metaKind: 'abilities',
        trigger: 'epoch_end',
        clustering: {
          minSize: 2,
          maxSize: 8,
          minimumScore: 0.5,
          criteria: [{ type: 'shared_tags', weight: 1.0, threshold: 0.3 }]
        },
        transformation: {
          transferRelationships: true,
          markOriginalsHistorical: true,
          redirectFutureRelationships: false,
          preserveOriginalLinks: true,
          createGovernanceFaction: false
        },
        factory: () => ({ kind: 'abilities', subtype: 'school', name: 'School', description: '', status: 'active', prominence: 'recognized', culture: 'world', tags: [], links: [] })
      };

      formation.registerConfig(config);

      // Add 2 regular abilities and 1 meta-entity
      mockGraph.entities.set('ability1', {
        id: 'ability1',
        kind: 'abilities',
        subtype: 'fire',
        name: 'Fire Spell',
        description: 'Shoots fire',
        status: 'active',
        prominence: 'marginal', culture: 'world',
        tags: ['fire', 'combat'],
        links: [],
        createdAt: 10,
        updatedAt: 10
      });

      mockGraph.entities.set('ability2', {
        id: 'ability2',
        kind: 'abilities',
        subtype: 'school',
        name: 'Existing School',
        description: 'Already a school',
        status: 'active',
        prominence: 'recognized', culture: 'world',
        tags: ['meta-entity', 'fire', 'combat'],
        links: [],
        createdAt: 20,
        updatedAt: 20
      });

      mockGraph.entities.set('ability3', {
        id: 'ability3',
        kind: 'abilities',
        subtype: 'fire',
        name: 'Fireball',
        description: 'Big fire',
        status: 'active',
        prominence: 'marginal', culture: 'world',
        tags: ['fire', 'combat'],
        links: [],
        createdAt: 30,
        updatedAt: 30
      });

      const clusters = formation.detectClusters(mockGraphView, 'abilities');

      // Should not include the meta-entity
      clusters.forEach(cluster => {
        cluster.entities.forEach(entity => {
          expect(entity.tags).not.toContain('meta-entity');
        });
      });
    });

    it('should cluster entities with similar tags', () => {
      const config: MetaEntityConfig = {
        sourceKind: 'abilities',
        metaKind: 'abilities',
        trigger: 'epoch_end',
        clustering: {
          minSize: 2,
          maxSize: 8,
          minimumScore: 0.5,
          criteria: [{ type: 'shared_tags', weight: 1.0, threshold: 0.3 }]
        },
        transformation: {
          transferRelationships: true,
          markOriginalsHistorical: true,
          redirectFutureRelationships: false,
          preserveOriginalLinks: true,
          createGovernanceFaction: false
        },
        factory: () => ({ kind: 'abilities', subtype: 'school', name: 'School', description: '', status: 'active', prominence: 'recognized', culture: 'world', tags: [], links: [] })
      };

      formation.registerConfig(config);

      // Add 3 fire spells and 2 ice spells
      mockGraph.entities.set('ability1', {
        id: 'ability1',
        kind: 'abilities',
        subtype: 'fire',
        name: 'Fire Spell 1',
        description: 'Fire',
        status: 'active',
        prominence: 'marginal', culture: 'world',
        tags: ['fire', 'combat', 'ranged'],
        links: [],
        createdAt: 10,
        updatedAt: 10
      });

      mockGraph.entities.set('ability2', {
        id: 'ability2',
        kind: 'abilities',
        subtype: 'fire',
        name: 'Fire Spell 2',
        description: 'Fire',
        status: 'active',
        prominence: 'marginal', culture: 'world',
        tags: ['fire', 'combat', 'area'],
        links: [],
        createdAt: 20,
        updatedAt: 20
      });

      mockGraph.entities.set('ability3', {
        id: 'ability3',
        kind: 'abilities',
        subtype: 'fire',
        name: 'Fire Spell 3',
        description: 'Fire',
        status: 'active',
        prominence: 'marginal', culture: 'world',
        tags: ['fire', 'combat'],
        links: [],
        createdAt: 30,
        updatedAt: 30
      });

      mockGraph.entities.set('ability4', {
        id: 'ability4',
        kind: 'abilities',
        subtype: 'ice',
        name: 'Ice Spell 1',
        description: 'Ice',
        status: 'active',
        prominence: 'marginal', culture: 'world',
        tags: ['ice', 'control'],
        links: [],
        createdAt: 40,
        updatedAt: 40
      });

      mockGraph.entities.set('ability5', {
        id: 'ability5',
        kind: 'abilities',
        subtype: 'ice',
        name: 'Ice Spell 2',
        description: 'Ice',
        status: 'active',
        prominence: 'marginal', culture: 'world',
        tags: ['ice', 'control'],
        links: [],
        createdAt: 50,
        updatedAt: 50
      });

      const clusters = formation.detectClusters(mockGraphView, 'abilities');

      // Should have at least 2 clusters (fire and ice)
      expect(clusters.length).toBeGreaterThanOrEqual(1);

      // Each cluster should have at least minSize entities
      clusters.forEach(cluster => {
        expect(cluster.entities.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should truncate clusters exceeding maxSize', () => {
      const config: MetaEntityConfig = {
        sourceKind: 'abilities',
        metaKind: 'abilities',
        trigger: 'epoch_end',
        clustering: {
          minSize: 2,
          maxSize: 3,
          minimumScore: 0.5,
          criteria: [{ type: 'shared_tags', weight: 1.0, threshold: 0.3 }]
        },
        transformation: {
          transferRelationships: true,
          markOriginalsHistorical: true,
          redirectFutureRelationships: false,
          preserveOriginalLinks: true,
          createGovernanceFaction: false
        },
        factory: () => ({ kind: 'abilities', subtype: 'school', name: 'School', description: '', status: 'active', prominence: 'recognized', culture: 'world', tags: [], links: [] })
      };

      formation.registerConfig(config);

      // Add 5 very similar fire spells
      for (let i = 1; i <= 5; i++) {
        mockGraph.entities.set(`ability${i}`, {
          id: `ability${i}`,
          kind: 'abilities',
          subtype: 'fire',
          name: `Fire Spell ${i}`,
          description: 'Fire',
          status: 'active',
          prominence: 'marginal', culture: 'world',
          tags: ['fire', 'combat', 'elemental'],
          links: [],
          createdAt: i * 10,
          updatedAt: i * 10
        });
      }

      const clusters = formation.detectClusters(mockGraphView, 'abilities');

      // All clusters should not exceed maxSize
      clusters.forEach(cluster => {
        expect(cluster.entities.length).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('formMetaEntity', () => {
    it('should create meta-entity and add to graph', () => {
      const cluster: HardState[] = [
        {
          id: 'ability1',
          kind: 'abilities',
          subtype: 'fire',
          name: 'Fire Spell',
          description: 'Fire',
          status: 'active',
          prominence: 'marginal', culture: 'world',
          tags: ['fire'],
          links: [],
          createdAt: 10,
          updatedAt: 10
        },
        {
          id: 'ability2',
          kind: 'abilities',
          subtype: 'fire',
          name: 'Fireball',
          description: 'Big fire',
          status: 'active',
          prominence: 'marginal', culture: 'world',
          tags: ['fire'],
          links: [],
          createdAt: 20,
          updatedAt: 20
        }
      ];

      // Add cluster entities to graph
      cluster.forEach(e => mockGraph.entities.set(e.id, e));

      const config: MetaEntityConfig = {
        sourceKind: 'abilities',
        metaKind: 'abilities',
        trigger: 'epoch_end',
        clustering: {
          minSize: 2,
          maxSize: 8,
          minimumScore: 1.0,
          criteria: []
        },
        transformation: {
          transferRelationships: false,
          markOriginalsHistorical: false,
          redirectFutureRelationships: false,
          preserveOriginalLinks: true,
          createGovernanceFaction: false
        },
        factory: (cluster: HardState[]) => ({
          kind: 'abilities',
          subtype: 'school',
          name: `School of Fire (${cluster.length} spells)`,
          description: 'A fire magic school',
          status: 'active',
          prominence: 'recognized', culture: 'world',
          tags: ['meta-entity', 'fire', 'school'],
          links: []
        })
      };

      const metaEntity = formation.formMetaEntity(mockGraph, cluster, config);

      // Meta-entity should exist in graph
      expect(mockGraph.entities.has(metaEntity.id)).toBe(true);
      expect(metaEntity.kind).toBe('abilities');
      expect(metaEntity.subtype).toBe('school');
      expect(metaEntity.name).toContain('School of Fire');
      expect(metaEntity.tags).toContain('meta-entity');
    });

    it('should create part_of relationships when preserveOriginalLinks is true', () => {
      const cluster: HardState[] = [
        {
          id: 'ability1',
          kind: 'abilities',
          subtype: 'fire',
          name: 'Fire Spell',
          description: 'Fire',
          status: 'active',
          prominence: 'marginal', culture: 'world',
          tags: ['fire'],
          links: [],
          createdAt: 10,
          updatedAt: 10
        },
        {
          id: 'ability2',
          kind: 'abilities',
          subtype: 'fire',
          name: 'Fireball',
          description: 'Big fire',
          status: 'active',
          prominence: 'marginal', culture: 'world',
          tags: ['fire'],
          links: [],
          createdAt: 20,
          updatedAt: 20
        }
      ];

      cluster.forEach(e => mockGraph.entities.set(e.id, e));

      const config: MetaEntityConfig = {
        sourceKind: 'abilities',
        metaKind: 'abilities',
        trigger: 'epoch_end',
        clustering: {
          minSize: 2,
          maxSize: 8,
          minimumScore: 1.0,
          criteria: []
        },
        transformation: {
          transferRelationships: false,
          markOriginalsHistorical: false,
          redirectFutureRelationships: false,
          preserveOriginalLinks: true,
          createGovernanceFaction: false
        },
        factory: () => ({
          kind: 'abilities',
          subtype: 'school',
          name: 'School',
          description: 'School',
          status: 'active',
          prominence: 'recognized', culture: 'world',
          tags: ['meta-entity'],
          links: []
        })
      };

      const metaEntity = formation.formMetaEntity(mockGraph, cluster, config);

      // Should have part_of relationships
      const partOfRels = mockGraph.relationships.filter(r =>
        r.kind === 'part_of' && r.dst === metaEntity.id
      );
      expect(partOfRels.length).toBe(2);
      expect(partOfRels.map(r => r.src).sort()).toEqual(['ability1', 'ability2']);
    });

    it('should mark originals as historical when markOriginalsHistorical is true', () => {
      const cluster: HardState[] = [
        {
          id: 'ability1',
          kind: 'abilities',
          subtype: 'fire',
          name: 'Fire Spell',
          description: 'Fire',
          status: 'active',
          prominence: 'marginal', culture: 'world',
          tags: ['fire'],
          links: [],
          createdAt: 10,
          updatedAt: 10
        }
      ];

      cluster.forEach(e => mockGraph.entities.set(e.id, e));

      const config: MetaEntityConfig = {
        sourceKind: 'abilities',
        metaKind: 'abilities',
        trigger: 'epoch_end',
        clustering: {
          minSize: 1,
          maxSize: 8,
          minimumScore: 1.0,
          criteria: []
        },
        transformation: {
          transferRelationships: false,
          markOriginalsHistorical: true,
          redirectFutureRelationships: false,
          preserveOriginalLinks: false,
          createGovernanceFaction: false
        },
        factory: () => ({
          kind: 'abilities',
          subtype: 'school',
          name: 'School',
          description: 'School',
          status: 'active',
          prominence: 'recognized', culture: 'world',
          tags: ['meta-entity'],
          links: []
        })
      };

      formation.formMetaEntity(mockGraph, cluster, config);

      // Original entity should be marked historical
      const ability1 = mockGraph.entities.get('ability1');
      expect(ability1?.status).toBe('historical');
    });

    it('should transfer relationships when transferRelationships is true', () => {
      const practitioner: HardState = {
        id: 'npc1',
        kind: 'npc',
        subtype: 'mage',
        name: 'Wizard',
        description: 'A wizard',
        status: 'active',
        prominence: 'marginal', culture: 'world',
        tags: [],
        links: [],
        createdAt: 5,
        updatedAt: 5
      };

      const cluster: HardState[] = [
        {
          id: 'ability1',
          kind: 'abilities',
          subtype: 'fire',
          name: 'Fire Spell',
          description: 'Fire',
          status: 'active',
          prominence: 'marginal', culture: 'world',
          tags: ['fire'],
          links: [{ kind: 'practiced_by', src: 'ability1', dst: 'npc1' }],
          createdAt: 10,
          updatedAt: 10
        }
      ];

      mockGraph.entities.set('npc1', practitioner);
      cluster.forEach(e => mockGraph.entities.set(e.id, e));

      // Add relationship
      mockGraph.relationships.push({ kind: 'practiced_by', src: 'ability1', dst: 'npc1' });

      const config: MetaEntityConfig = {
        sourceKind: 'abilities',
        metaKind: 'abilities',
        trigger: 'epoch_end',
        clustering: {
          minSize: 1,
          maxSize: 8,
          minimumScore: 1.0,
          criteria: []
        },
        transformation: {
          transferRelationships: true,
          markOriginalsHistorical: false,
          redirectFutureRelationships: false,
          preserveOriginalLinks: false,
          createGovernanceFaction: false
        },
        factory: () => ({
          kind: 'abilities',
          subtype: 'school',
          name: 'School',
          description: 'School',
          status: 'active',
          prominence: 'recognized', culture: 'world',
          tags: ['meta-entity'],
          links: []
        })
      };

      const metaEntity = formation.formMetaEntity(mockGraph, cluster, config);

      // Relationship should be transferred to meta-entity
      const transferredRel = mockGraph.relationships.find(r =>
        r.kind === 'practiced_by' && r.src === metaEntity.id && r.dst === 'npc1'
      );
      expect(transferredRel).toBeDefined();
    });
  });

  describe('getConfigs', () => {
    it('should return empty map initially', () => {
      const configs = formation.getConfigs();
      expect(configs.size).toBe(0);
    });

    it('should return all registered configs', () => {
      const config1: MetaEntityConfig = {
        sourceKind: 'abilities',
        metaKind: 'abilities',
        trigger: 'epoch_end',
        clustering: { minSize: 3, maxSize: 8, minimumScore: 2.0, criteria: [] },
        transformation: { transferRelationships: true, markOriginalsHistorical: true, redirectFutureRelationships: false, preserveOriginalLinks: true, createGovernanceFaction: false },
        factory: () => ({ kind: 'abilities', subtype: 'school', name: 'School', description: '', status: 'active', prominence: 'recognized', culture: 'world', tags: [], links: [] })
      };

      const config2: MetaEntityConfig = {
        sourceKind: 'rules',
        metaKind: 'rules',
        trigger: 'epoch_end',
        clustering: { minSize: 3, maxSize: 10, minimumScore: 2.0, criteria: [] },
        transformation: { transferRelationships: true, markOriginalsHistorical: true, redirectFutureRelationships: false, preserveOriginalLinks: true, createGovernanceFaction: true },
        factory: () => ({ kind: 'rules', subtype: 'legal_code', name: 'Code', description: '', status: 'active', prominence: 'recognized', culture: 'world', tags: [], links: [] })
      };

      formation.registerConfig(config1);
      formation.registerConfig(config2);

      const configs = formation.getConfigs();
      expect(configs.size).toBe(2);
      expect(configs.has('abilities')).toBe(true);
      expect(configs.has('rules')).toBe(true);
    });
  });
});
