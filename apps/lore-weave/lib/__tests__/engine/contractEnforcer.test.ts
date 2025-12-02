// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContractEnforcer } from '../../engine/contractEnforcer';
import { Graph, GrowthTemplate, EngineConfig, EntityRegistry, ComponentPurpose } from '../../engine/types';
import { HardState, Relationship } from '../../core/worldTypes';
import { TemplateGraphView } from '../../graph/templateGraphView';

// Mock dependencies
vi.mock('../../statistics/tagHealthAnalyzer');
vi.mock('../../config/tagRegistry');

describe('ContractEnforcer', () => {
  let enforcer: ContractEnforcer;
  let mockConfig: EngineConfig;
  let mockGraph: Graph;
  let mockGraphView: TemplateGraphView;

  beforeEach(() => {
    // Setup mock config
    mockConfig = {
      domain: {} as any,
      templates: [],
      systems: [],
      entityRegistries: [],
      epochLength: 20,
      simulationTicksPerGrowth: 10,
      targetEntitiesPerKind: 30,
      maxTicks: 500
    };

    // Setup mock graph with mutation methods
    const _entities = new Map<string, HardState>();
    let _relationships: Relationship[] = [];

    mockGraph = {
      tick: 0,
      epoch: 0,
      currentEra: { id: 'expansion', name: 'Expansion Era' } as any,
      pressures: new Map<string, number>(),
      history: [],
      tagIndex: new Map(),
      relationshipIndex: new Map(),
      config: {} as any,

      // Entity read methods
      getEntity(id: string): HardState | undefined {
        const entity = _entities.get(id);
        return entity ? { ...entity, tags: { ...entity.tags }, links: [...entity.links] } : undefined;
      },
      hasEntity(id: string): boolean {
        return _entities.has(id);
      },
      getEntityCount(): number {
        return _entities.size;
      },
      getEntities(): HardState[] {
        return Array.from(_entities.values()).map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
      },
      getEntityIds(): string[] {
        return Array.from(_entities.keys());
      },
      forEachEntity(callback: (entity: HardState, id: string) => void): void {
        _entities.forEach((entity, id) => {
          callback({ ...entity, tags: { ...entity.tags }, links: [...entity.links] }, id);
        });
      },
      findEntities(criteria: { kind?: string; subtype?: string; status?: string; prominence?: string; culture?: string; tag?: string; exclude?: string[] }): HardState[] {
        return Array.from(_entities.values())
          .filter(e => {
            if (criteria.kind && e.kind !== criteria.kind) return false;
            if (criteria.subtype && e.subtype !== criteria.subtype) return false;
            if (criteria.status && e.status !== criteria.status) return false;
            if (criteria.prominence && e.prominence !== criteria.prominence) return false;
            if (criteria.culture && e.culture !== criteria.culture) return false;
            if (criteria.tag && !(criteria.tag in e.tags)) return false;
            if (criteria.exclude && criteria.exclude.includes(e.id)) return false;
            return true;
          })
          .map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
      },
      getEntitiesByKind(kind: string): HardState[] {
        return Array.from(_entities.values())
          .filter(e => e.kind === kind)
          .map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
      },
      getConnectedEntities(entityId: string, relationKind?: string): HardState[] {
        const connectedIds = new Set<string>();
        _relationships.forEach(r => {
          if (relationKind && r.kind !== relationKind) return;
          if (r.src === entityId) connectedIds.add(r.dst);
          if (r.dst === entityId) connectedIds.add(r.src);
        });
        return Array.from(connectedIds)
          .map(id => _entities.get(id))
          .filter((e): e is HardState => e !== undefined)
          .map(e => ({ ...e, tags: { ...e.tags }, links: [...e.links] }));
      },

      // Entity mutation methods
      setEntity(id: string, entity: HardState): void {
        _entities.set(id, entity);
      },
      updateEntity(id: string, changes: Partial<HardState>): boolean {
        const entity = _entities.get(id);
        if (!entity) return false;
        Object.assign(entity, changes);
        entity.updatedAt = this.tick;
        return true;
      },
      deleteEntity(id: string): boolean {
        return _entities.delete(id);
      },

      // Relationship read methods
      getRelationships(): Relationship[] {
        return [..._relationships];
      },
      getRelationshipCount(): number {
        return _relationships.length;
      },
      findRelationships(criteria: { kind?: string; src?: string; dst?: string; category?: string; minStrength?: number }): Relationship[] {
        return _relationships.filter(r => {
          if (criteria.kind && r.kind !== criteria.kind) return false;
          if (criteria.src && r.src !== criteria.src) return false;
          if (criteria.dst && r.dst !== criteria.dst) return false;
          if (criteria.minStrength !== undefined && (r.strength ?? 0.5) < criteria.minStrength) return false;
          return true;
        });
      },
      getEntityRelationships(entityId: string, direction?: 'src' | 'dst' | 'both'): Relationship[] {
        return _relationships.filter(r => {
          if (direction === 'src') return r.src === entityId;
          if (direction === 'dst') return r.dst === entityId;
          return r.src === entityId || r.dst === entityId;
        });
      },
      hasRelationship(srcId: string, dstId: string, kind?: string): boolean {
        return _relationships.some(r =>
          r.src === srcId && r.dst === dstId && (!kind || r.kind === kind)
        );
      },

      // Relationship mutation methods
      pushRelationship(relationship: Relationship): void {
        _relationships.push(relationship);
        const srcEntity = _entities.get(relationship.src);
        if (srcEntity) {
          srcEntity.links.push({ ...relationship });
          srcEntity.updatedAt = this.tick;
        }
        const dstEntity = _entities.get(relationship.dst);
        if (dstEntity) {
          dstEntity.updatedAt = this.tick;
        }
      },
      addRelationship(kind: string, srcId: string, dstId: string, strength?: number, distance?: number, category?: string): void {
        const relationship: Relationship = { kind, src: srcId, dst: dstId, strength, distance, category };
        _relationships.push(relationship);
        const srcEntity = _entities.get(srcId);
        if (srcEntity) {
          srcEntity.links.push({ ...relationship });
          srcEntity.updatedAt = this.tick;
        }
      },
      setRelationships(rels: Relationship[]): void {
        _relationships = rels;
      },
      removeRelationship(srcId: string, dstId: string, kind: string): boolean {
        const idx = _relationships.findIndex(r => r.src === srcId && r.dst === dstId && r.kind === kind);
        if (idx >= 0) {
          _relationships.splice(idx, 1);
          const srcEntity = _entities.get(srcId);
          if (srcEntity) {
            srcEntity.links = srcEntity.links.filter(l => !(l.src === srcId && l.dst === dstId && l.kind === kind));
            srcEntity.updatedAt = this.tick;
          }
          return true;
        }
        return false;
      },

      get entities() { return _entities; },
      get relationships() { return _relationships; },
      set relationships(rels: Relationship[]) { _relationships = rels; }
    } as Graph;

    // Setup mock graph view
    mockGraphView = {
      query: vi.fn(),
      getRelated: vi.fn(),
      hasRelationship: vi.fn(),
      countEntities: vi.fn(),
      getEntityById: vi.fn(),
      findEntities: vi.fn().mockImplementation((criteria: any) => {
        // Filter entities from mockGraph based on criteria
        const entities = Array.from(mockGraph.entities.values());
        return entities.filter((e: any) => {
          if (criteria.kind && e.kind !== criteria.kind) return false;
          if (criteria.subtype && e.subtype !== criteria.subtype) return false;
          if (criteria.status && e.status !== criteria.status) return false;
          return true;
        });
      })
    } as any;

    enforcer = new ContractEnforcer(mockConfig);
  });


  // Note: checkContractEnabledBy tests removed - input conditions are now
  // handled via applicability rules in templateInterpreter.ts

  // Note: enforceLineage tests removed - lineage is now handled via:
  // 1. near_ancestor placement type in templates (creates relationship during placement)
  // 2. Explicit relationships in template's relationships array

  // NOTE: checkSaturation tests removed - saturation is handled via
  // applicability rules (entity_count_max) in canApply()

  // NOTE: validateAffects tests removed - contract.affects has been removed
  // Declarative templates already define what they create, making validation redundant

  describe('getDiagnostic', () => {
    it('should provide comprehensive diagnostic output', () => {
      const template: GrowthTemplate = {
        id: 'test_template',
        canApply: vi.fn().mockReturnValue(true),
        findTargets: vi.fn().mockReturnValue([{ id: 'target1' }]),
        expand: () => ({ entities: [], relationships: [], description: '' })
      };

      // Note: getDiagnostic no longer requires graph parameter (enabledBy removed)
      const diagnostic = enforcer.getDiagnostic(template, mockGraphView);

      // Note: Contract check removed - input conditions handled by applicability rules
      expect(diagnostic).toContain('canApply()');
      expect(diagnostic).toContain('Targets: 1');
    });
  });

  describe('getTagAnalyzer', () => {
    it('should return tag analyzer instance', () => {
      const analyzer = enforcer.getTagAnalyzer();
      expect(analyzer).toBeDefined();
    });
  });

  describe('enforceTagCoverage', () => {
    it('should accept entity with 3-5 tags', () => {
      const entity: HardState = {
        id: 'entity1',
        kind: 'npc',
        tags: { tag1: 'true', tag2: 'true', tag3: 'true', tag4: 'true' },
        links: []
      } as HardState;

      const result = enforcer.enforceTagCoverage(entity, mockGraph);
      expect(result.needsAdjustment).toBe(false);
    });

    it('should suggest adding tags when too few', () => {
      const entity: HardState = {
        id: 'entity1',
        kind: 'npc',
        name: 'Test Entity',
        tags: { tag1: 'true' },
        links: []
      } as HardState;

      const result = enforcer.enforceTagCoverage(entity, mockGraph);
      expect(result.needsAdjustment).toBe(true);
      expect(result.suggestion).toContain('only 1 tags');
      expect(result.suggestion).toContain('needs 2 more');
    });

    it('should suggest removing tags when too many', () => {
      const entity: HardState = {
        id: 'entity1',
        kind: 'npc',
        name: 'Test Entity',
        tags: { tag1: 'true', tag2: 'true', tag3: 'true', tag4: 'true', tag5: 'true', tag6: 'true', tag7: 'true' },
        links: []
      } as HardState;

      const result = enforcer.enforceTagCoverage(entity, mockGraph);
      expect(result.needsAdjustment).toBe(true);
      expect(result.suggestion).toContain('7 tags');
      expect(result.suggestion).toContain('should remove 2');
      expect(result.tagsToRemove).toEqual(['tag6', 'tag7']);
    });
  });

  // Note: checkContractEnabledBy tests removed - input conditions are now
  // handled via applicability rules in templateInterpreter.ts
});
