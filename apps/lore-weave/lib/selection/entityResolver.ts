/**
 * Entity resolution abstraction for selection filters.
 *
 * This provides a unified interface for resolving entity references (like $actor, $target)
 * that works across different contexts (templates, actions, systems).
 */

import { HardState } from '../core/worldTypes';
import { TemplateGraphView } from '../graph/templateGraphView';

/**
 * Interface for resolving entity references in selection filters.
 */
export interface EntityResolver {
  /** Resolve a reference like "$actor", "$target", "$varName" to an entity */
  resolveEntity(ref: string): HardState | undefined;

  /** Get the graph view for relationship queries */
  getGraphView(): TemplateGraphView;

  /** Store intermediate path results (for graph_path filter) */
  setPathSet(name: string, ids: Set<string>): void;

  /** Get stored path results */
  getPathSet(name: string): Set<string> | undefined;
}

/**
 * Entity resolver for action context.
 * Resolves: $actor, $resolved_actor
 */
export class ActionEntityResolver implements EntityResolver {
  private pathSets: Map<string, Set<string>> = new Map();

  constructor(
    private graphView: TemplateGraphView,
    private actor: HardState,
    private resolvedActor: HardState | null
  ) {}

  resolveEntity(ref: string): HardState | undefined {
    if (!ref.startsWith('$')) {
      // Literal entity ID
      return this.graphView.getEntity(ref);
    }

    const varName = ref.slice(1); // Remove $

    switch (varName) {
      case 'actor':
        return this.actor;
      case 'resolved_actor':
        return this.resolvedActor || undefined;
      case 'self':
        // In action context, $self typically means the entity being filtered
        // This is handled specially in the filter evaluation
        return undefined;
      default:
        return undefined;
    }
  }

  getGraphView(): TemplateGraphView {
    return this.graphView;
  }

  setPathSet(name: string, ids: Set<string>): void {
    this.pathSets.set(name, ids);
  }

  getPathSet(name: string): Set<string> | undefined {
    return this.pathSets.get(name);
  }
}

/**
 * Simple entity resolver that only handles literal IDs.
 * Useful for system context where there are no variable references.
 */
export class SimpleEntityResolver implements EntityResolver {
  private pathSets: Map<string, Set<string>> = new Map();

  constructor(private graphView: TemplateGraphView) {}

  resolveEntity(ref: string): HardState | undefined {
    if (ref.startsWith('$')) {
      return undefined;
    }
    return this.graphView.getEntity(ref);
  }

  getGraphView(): TemplateGraphView {
    return this.graphView;
  }

  setPathSet(name: string, ids: Set<string>): void {
    this.pathSets.set(name, ids);
  }

  getPathSet(name: string): Set<string> | undefined {
    return this.pathSets.get(name);
  }
}
