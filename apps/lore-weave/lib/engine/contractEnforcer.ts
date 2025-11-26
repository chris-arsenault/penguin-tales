import { Graph, GrowthTemplate, EngineConfig, ComponentContract } from '../types/engine';
import { TemplateGraphView } from '../services/templateGraphView';
import { HardState, Relationship } from '../types/worldTypes';
import { findEntities, addRelationship } from '../utils/helpers';
import { TagHealthAnalyzer } from '../services/tagHealthAnalyzer';
import { getTagMetadata } from '../config/tagRegistry';

/**
 * ContractEnforcer
 *
 * Active framework enforcement that uses component contracts to:
 * 1. Filter templates based on enabledBy conditions
 * 2. Automatically add lineage relationships
 * 3. Prevent saturation of entity kinds
 * 4. Validate template results match contract declarations
 * 5. Enforce tag constraints (saturation, coverage, taxonomy)
 */
export class ContractEnforcer {
  private tagAnalyzer: TagHealthAnalyzer;

  constructor(private config: EngineConfig) {
    this.tagAnalyzer = new TagHealthAnalyzer();
  }

  /**
   * ENFORCEMENT 1: Contract-Based Template Filtering
   *
   * Checks contract.enabledBy conditions before allowing template to run.
   * This is more formal than template.canApply() and enforces framework-level rules.
   */
  public checkContractEnabledBy(
    template: GrowthTemplate,
    graph: Graph,
    graphView: TemplateGraphView
  ): { allowed: boolean; reason?: string } {
    // No contract = always allowed
    if (!template.contract?.enabledBy) {
      return { allowed: true };
    }

    const enabledBy = template.contract.enabledBy;

    // Check pressure thresholds
    if (enabledBy.pressures) {
      for (const p of enabledBy.pressures) {
        const currentPressure = graph.pressures.get(p.name) || 0;
        if (currentPressure < p.threshold) {
          return {
            allowed: false,
            reason: `Pressure '${p.name}' = ${currentPressure.toFixed(1)} (requires ${p.threshold})`
          };
        }
      }
    }

    // Check entity count requirements
    if (enabledBy.entityCounts) {
      for (const ec of enabledBy.entityCounts) {
        const criteria: any = { kind: ec.kind };
        if (ec.subtype) criteria.subtype = ec.subtype;

        const entities = findEntities(graph, criteria);
        const count = entities.length;

        const entityLabel = ec.subtype ? `${ec.kind}:${ec.subtype}` : ec.kind;

        if (count < ec.min) {
          return {
            allowed: false,
            reason: `Need ${ec.min} ${entityLabel}, have ${count}`
          };
        }

        if (ec.max !== undefined && count > ec.max) {
          return {
            allowed: false,
            reason: `Too many ${entityLabel}: ${count} > ${ec.max}`
          };
        }
      }
    }

    // Check era restrictions
    if (enabledBy.era && enabledBy.era.length > 0) {
      if (!enabledBy.era.includes(graph.currentEra.id)) {
        return {
          allowed: false,
          reason: `Era '${graph.currentEra.id}' not in allowed eras: ${enabledBy.era.join(', ')}`
        };
      }
    }

    // Check custom condition if provided
    if (enabledBy.custom) {
      const customResult = enabledBy.custom(graphView);
      if (!customResult) {
        return {
          allowed: false,
          reason: 'Custom enabledBy condition failed'
        };
      }
    }

    return { allowed: true };
  }

  /**
   * ENFORCEMENT 2: Automatic Lineage Enforcement
   *
   * After template creates entities, automatically adds lineage relationships
   * using the entity registry's lineage function.
   */
  public enforceLineage(
    graph: Graph,
    graphView: TemplateGraphView,
    newEntities: HardState[]
  ): Relationship[] {
    const lineageRelationships: Relationship[] = [];

    for (const entity of newEntities) {
      const registry = this.config.entityRegistries?.find(r => r.kind === entity.kind);

      if (!registry?.lineage) continue;

      const ancestor = registry.lineage.findAncestor(graphView, entity);

      if (ancestor) {
        const { min, max } = registry.lineage.distanceRange;
        const distance = min + Math.random() * (max - min);

        // Add to graph
        addRelationship(
          graph,
          registry.lineage.relationshipKind,
          entity.id,
          ancestor.id,
          undefined,
          distance
        );

        // Track for history
        lineageRelationships.push({
          kind: registry.lineage.relationshipKind,
          src: entity.id,
          dst: ancestor.id,
          distance
        });
      }
    }

    return lineageRelationships;
  }

  /**
   * ENFORCEMENT 3: Registry-Based Saturation Control
   *
   * Checks if templates would create entities of kinds/subtypes that are already saturated.
   * Uses entity registries' expectedDistribution.targetCount.
   * Prefers subtype-specific registries over kind-level registries.
   */
  public checkSaturation(
    template: GrowthTemplate,
    graph: Graph
  ): { saturated: boolean; reason?: string } {
    // No metadata = can't check saturation
    if (!template.metadata?.produces?.entityKinds) {
      return { saturated: false };
    }

    const entityKinds = template.metadata.produces.entityKinds;
    const saturatedKinds: string[] = [];
    const unsaturatedKinds: string[] = [];

    for (const kindInfo of entityKinds) {
      // Try to find subtype-specific registry first, fall back to kind registry
      let registry = this.config.entityRegistries?.find(
        r => r.kind === kindInfo.kind && r.subtype === kindInfo.subtype
      );

      if (!registry) {
        registry = this.config.entityRegistries?.find(
          r => r.kind === kindInfo.kind && !r.subtype
        );
      }

      if (!registry) {
        // No registry = can't check saturation, assume OK
        const label = kindInfo.subtype ? `${kindInfo.kind}:${kindInfo.subtype}` : kindInfo.kind;
        unsaturatedKinds.push(label);
        continue;
      }

      // Count entities matching the criteria (subtype if specified, otherwise just kind)
      const criteria: any = { kind: kindInfo.kind };
      if (kindInfo.subtype && registry.subtype) {
        criteria.subtype = kindInfo.subtype;
      }

      const currentCount = findEntities(graph, criteria).length;
      const targetCount = registry.expectedDistribution.targetCount;

      // Allow 100% overshoot before hard blocking (increased from 50% to reduce starvation)
      const saturationThreshold = targetCount * 2.0;

      const label = kindInfo.subtype ? `${kindInfo.kind}:${kindInfo.subtype}` : kindInfo.kind;

      if (currentCount >= saturationThreshold) {
        saturatedKinds.push(`${label} (${currentCount}/${targetCount})`);
      } else {
        unsaturatedKinds.push(label);
      }
    }

    // CRITICAL FIX: Only block if ALL kinds are saturated
    // This allows templates that create mixed kinds (e.g., abilities + rules) to still run
    // if at least one kind is under capacity
    if (saturatedKinds.length > 0 && unsaturatedKinds.length === 0) {
      return {
        saturated: true,
        reason: `All entity kinds saturated: ${saturatedKinds.join(', ')}`
      };
    }

    return { saturated: false };
  }

  /**
   * ENFORCEMENT 4: Contract Affects Validation
   *
   * After template runs, validates that actual effects match contract declarations.
   * Warns if template creates more/fewer entities or relationships than declared.
   */
  public validateAffects(
    template: GrowthTemplate,
    entitiesCreated: number,
    relationshipsCreated: number,
    pressureChanges: Map<string, number>
  ): string[] {
    const warnings: string[] = [];

    // No contract = no validation
    if (!template.contract?.affects) {
      return warnings;
    }

    const affects = template.contract.affects;

    // Validate entity creation
    if (affects.entities) {
      for (const entityAffect of affects.entities) {
        if (entityAffect.operation === 'create' && entityAffect.count) {
          const { min, max } = entityAffect.count;

          if (entitiesCreated < min) {
            warnings.push(
              `Created ${entitiesCreated} entities, but contract requires min ${min}`
            );
          }

          if (entitiesCreated > max) {
            warnings.push(
              `Created ${entitiesCreated} entities, but contract allows max ${max}`
            );
          }
        }
      }
    }

    // Validate relationship creation
    if (affects.relationships) {
      const totalExpectedMax = affects.relationships
        .filter(r => r.operation === 'create')
        .reduce((sum, r) => sum + (r.count?.max || 1), 0);

      if (relationshipsCreated > totalExpectedMax * 1.2) { // Allow 20% overshoot
        warnings.push(
          `Created ${relationshipsCreated} relationships, but contract suggests max ~${totalExpectedMax}`
        );
      }
    }

    // Validate pressure changes
    if (affects.pressures) {
      for (const pressureAffect of affects.pressures) {
        if (pressureAffect.delta !== undefined) {
          const actualChange = pressureChanges.get(pressureAffect.name) || 0;

          // Check if direction matches (both positive or both negative)
          if (
            (pressureAffect.delta > 0 && actualChange < 0) ||
            (pressureAffect.delta < 0 && actualChange > 0)
          ) {
            warnings.push(
              `Pressure '${pressureAffect.name}' changed ${actualChange.toFixed(1)}, but contract declares ${pressureAffect.delta}`
            );
          }
        }
      }
    }

    return warnings;
  }

  /**
   * ENFORCEMENT 5: Check Tag Saturation
   *
   * Before template runs, check if it would add overused tags.
   * Uses tag registry to determine expected counts per tag.
   */
  public checkTagSaturation(
    graph: Graph,
    tagsToAdd: string[]
  ): { saturated: boolean; oversaturatedTags: string[]; reason?: string } {
    // Count current tag usage
    const tagCounts = new Map<string, number>();
    for (const entity of graph.entities.values()) {
      for (const tag of entity.tags) {
        // Handle dynamic location tags
        const normalizedTag = tag.startsWith('name:') ? 'name:*' : tag;
        tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
      }
    }

    // Check which tags would exceed maxUsage
    const oversaturatedTags: string[] = [];

    for (const tag of tagsToAdd) {
      const normalizedTag = tag.startsWith('name:') ? 'name:*' : tag;
      const def = getTagMetadata(normalizedTag);
      if (!def || !def.maxUsage) continue;  // Unregistered tags can't be saturated

      const currentCount = tagCounts.get(normalizedTag) || 0;
      const newCount = currentCount + 1;

      if (newCount > def.maxUsage) {
        oversaturatedTags.push(tag);
      }
    }

    if (oversaturatedTags.length > 0) {
      return {
        saturated: true,
        oversaturatedTags,
        reason: `Tags would be oversaturated: ${oversaturatedTags.join(', ')}`
      };
    }

    return { saturated: false, oversaturatedTags: [] };
  }

  /**
   * ENFORCEMENT 6: Check Tag Orphans
   *
   * Warn if template creates single-use tags not in registry.
   * Legendary tags (single-use by design) are expected and don't trigger warnings.
   */
  public checkTagOrphans(tagsToAdd: string[]): { hasOrphans: boolean; orphanTags: string[] } {
    const orphanTags: string[] = [];

    for (const tag of tagsToAdd) {
      const normalizedTag = tag.startsWith('name:') ? 'name:*' : tag;
      const def = getTagMetadata(normalizedTag);

      if (!def) {
        orphanTags.push(tag);
      }
    }

    return {
      hasOrphans: orphanTags.length > 0,
      orphanTags
    };
  }

  /**
   * ENFORCEMENT 7: Enforce Tag Coverage
   *
   * After entity creation, ensure it has 3-5 tags.
   * Returns suggested tags to add or remove.
   */
  public enforceTagCoverage(
    entity: HardState,
    graph: Graph
  ): { needsAdjustment: boolean; suggestion: string; tagsToAdd?: string[]; tagsToRemove?: string[] } {
    const currentCount = entity.tags.length;

    // Check if coverage is acceptable (3-5 tags)
    if (currentCount >= 3 && currentCount <= 5) {
      return { needsAdjustment: false, suggestion: 'Tag coverage is adequate' };
    }

    // Too few tags - suggest additions
    if (currentCount < 3) {
      const needed = 3 - currentCount;
      return {
        needsAdjustment: true,
        suggestion: `Entity ${entity.name} has only ${currentCount} tags, needs ${needed} more`,
        tagsToAdd: []  // Template should handle this
      };
    }

    // Too many tags - suggest removals
    if (currentCount > 5) {
      const excess = currentCount - 5;
      return {
        needsAdjustment: true,
        suggestion: `Entity ${entity.name} has ${currentCount} tags, should remove ${excess}`,
        tagsToRemove: entity.tags.slice(5)  // Remove excess tags
      };
    }

    return { needsAdjustment: false, suggestion: 'Tag coverage is adequate' };
  }

  /**
   * ENFORCEMENT 8: Validate Tag Taxonomy
   *
   * Check for conflicting tags on entities (e.g., peaceful + warlike).
   * Returns conflicts if found.
   */
  public validateTagTaxonomy(
    entity: HardState
  ): { valid: boolean; conflicts: Array<{ tag1: string; tag2: string; reason: string }> } {
    const conflicts = this.tagAnalyzer.validateTagTaxonomy(entity);

    return {
      valid: conflicts.length === 0,
      conflicts
    };
  }

  /**
   * Get diagnostic info for why a template cannot run
   */
  public getDiagnostic(
    template: GrowthTemplate,
    graph: Graph,
    graphView: TemplateGraphView
  ): string {
    const parts: string[] = [];

    // Check contract
    const contractCheck = this.checkContractEnabledBy(template, graph, graphView);
    if (!contractCheck.allowed) {
      parts.push(`Contract: ${contractCheck.reason}`);
    } else {
      parts.push('Contract: ✓');
    }

    // Check saturation
    const saturationCheck = this.checkSaturation(template, graph);
    if (saturationCheck.saturated) {
      parts.push(`Saturation: ${saturationCheck.reason}`);
    } else {
      parts.push('Saturation: ✓');
    }

    // Check canApply
    const canApply = template.canApply(graphView);
    parts.push(`canApply(): ${canApply ? '✓' : '✗'}`);

    // Check targets
    const targets = template.findTargets ? template.findTargets(graphView) : [];
    parts.push(`Targets: ${targets.length}`);

    return parts.join(' | ');
  }

  /**
   * Get tag health analyzer instance for external use
   */
  public getTagAnalyzer(): TagHealthAnalyzer {
    return this.tagAnalyzer;
  }
}
