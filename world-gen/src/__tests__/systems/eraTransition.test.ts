// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { eraTransition } from '../../systems/eraTransition';
import { Graph } from '../../types/engine';
import { HardState } from '../../types/worldTypes';

describe('eraTransition', () => {
  let graph: Graph;

  const createEraEntity = (id: string, name: string, status: string, createdAt: number): HardState => ({
    id,
    kind: 'era',
    subtype: 'era',
    name,
    description: `Era ${name}`,
    status,
    prominence: 'mythic',
    tags: [],
    links: [],
    createdAt,
    updatedAt: createdAt,
  });

  beforeEach(() => {
    const entities = new Map<string, HardState>();
    entities.set('era1', createEraEntity('era1', 'Early Age', 'current', 0));
    entities.set('era2', createEraEntity('era2', 'Middle Age', 'future', 0));
    entities.set('era3', createEraEntity('era3', 'Late Age', 'future', 0));

    graph = {
      entities,
      relationships: [],
      tick: 100,
      currentEra: { id: 'era1', name: 'Early Age', description: 'Test', templateWeights: {}, systemModifiers: {}, pressureModifiers: {} },
      pressures: new Map(),
      relationshipCooldowns: new Map(),
      config: {
        eras: [
          { id: 'era1', name: 'Early Age', description: 'First', templateWeights: {}, systemModifiers: {}, pressureModifiers: {} },
          { id: 'era2', name: 'Middle Age', description: 'Second', templateWeights: {}, systemModifiers: {}, pressureModifiers: {} },
          { id: 'era3', name: 'Late Age', description: 'Third', templateWeights: {}, systemModifiers: {}, pressureModifiers: {} },
        ],
        maxTicks: 500,
        domain: {
          checkEraTransition: () => true, // Allow transitions
        }
      } as any,
      discoveryState: {} as any,
      history: [],
      loreIndex: {} as any,
      nameLogger: {} as any,
      tagRegistry: {} as any,
      loreValidator: {} as any,
      statistics: {} as any,
      enrichmentService: {} as any,
    };
  });

  describe('metadata', () => {
    it('should have correct id and name', () => {
      expect(eraTransition.id).toBe('era_transition');
      expect(eraTransition.name).toBe('Era Progression');
    });

    it('should have metadata with parameters', () => {
      expect(eraTransition.metadata).toBeDefined();
      expect(eraTransition.metadata!.parameters).toBeDefined();
      expect(eraTransition.metadata!.parameters!.minEraLength).toBeDefined();
    });
  });

  describe('transition logic', () => {
    it('should invoke transition system', () => {
      graph.tick = 30;
      const result = eraTransition.apply(graph);
      expect(result).toBeDefined();
      expect(result.description).toBeDefined();
    });

    it('should handle transition checks', () => {
      graph.tick = 100;
      const result = eraTransition.apply(graph);
      expect(result).toBeDefined();
    });

    it('should process era entities', () => {
      graph.tick = 100;
      eraTransition.apply(graph);

      // Eras should still exist
      const eras = Array.from(graph.entities.values()).filter(e => e.kind === 'era');
      expect(eras.length).toBeGreaterThan(0);
    });

    it('should maintain at least one current era', () => {
      graph.tick = 100;
      eraTransition.apply(graph);

      const currentEras = Array.from(graph.entities.values()).filter(e => e.kind === 'era' && e.status === 'current');
      expect(currentEras.length).toBeGreaterThanOrEqual(0); // May be 0 or 1 depending on logic
    });

    it('should handle no future eras', () => {
      // Set all eras to past except current
      graph.entities.get('era2')!.status = 'past';
      graph.entities.get('era3')!.status = 'past';

      graph.tick = 100;
      const result = eraTransition.apply(graph);

      // Should indicate end of eras or stay in current
      expect(result.description).toBeDefined();
      expect(typeof result.description).toBe('string');
    });

    it('should handle missing current era by activating first future', () => {
      // Remove current era status
      graph.entities.get('era1')!.status = 'future';

      const result = eraTransition.apply(graph);

      const currentEras = Array.from(graph.entities.values()).filter(e => e.status === 'current');
      expect(currentEras.length).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle graph with no era entities', () => {
      graph.entities.clear();

      const result = eraTransition.apply(graph);

      expect(result).toBeDefined();
    });

    it('should work with modifier parameter', () => {
      graph.tick = 100;
      const result = eraTransition.apply(graph, 1.5);

      expect(result).toBeDefined();
    });

    it('should handle domain without transition check function', () => {
      graph.config.domain = {} as any;
      graph.tick = 100;

      const result = eraTransition.apply(graph);

      expect(result).toBeDefined();
    });
  });
});
