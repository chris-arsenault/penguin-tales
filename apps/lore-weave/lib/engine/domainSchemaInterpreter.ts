/**
 * Domain Schema Interpreter
 *
 * Converts JSON domain schema definitions into runtime DomainSchema objects.
 * Follows the same pattern as pressureInterpreter and templateInterpreter.
 */

import {
  DomainSchema,
  BaseDomainSchema,
  EntityKindDefinition,
  RelationshipKindDefinition,
  CultureDefinition,
  SubtypeDefinition,
  StatusDefinition,
  DomainUIConfig,
} from '../domainInterface/domainSchema';

// =============================================================================
// JSON INPUT TYPES (from canonry/UI)
// =============================================================================

/**
 * JSON format for subtype from canonry
 */
export interface JSONSubtype {
  id: string;
  name?: string;
}

/**
 * JSON format for status from canonry
 */
export interface JSONStatus {
  id: string;
  name?: string;
  isTerminal?: boolean;
}

/**
 * JSON format for entity kind from canonry
 */
export interface JSONEntityKind {
  // Support both 'id' (canonry format) and 'kind' (internal format)
  id?: string;
  kind?: string;
  name?: string;
  description?: string;
  subtypes?: JSONSubtype[] | string[];
  statuses?: JSONStatus[] | string[];
  color?: string;
  shape?: string;
}

/**
 * JSON format for relationship kind from canonry
 */
export interface JSONRelationshipKind {
  // Support both 'id' (canonry format) and 'kind' (internal format)
  id?: string;
  kind?: string;
  name?: string;
  description?: string;
  srcKinds?: string[];
  dstKinds?: string[];
  // Canonry format aliases
  sourceKinds?: string[];
  targetKinds?: string[];
}

/**
 * JSON format for culture from canonry
 */
export interface JSONCulture {
  id: string;
  name?: string;
  description?: string;
  homeland?: string;
}

/**
 * JSON format for the complete domain schema from canonry
 */
export interface JSONDomainSchema {
  id?: string;
  name?: string;
  version?: string;
  entityKinds: JSONEntityKind[];
  relationshipKinds: JSONRelationshipKind[];
  cultures?: JSONCulture[];
  uiConfig?: DomainUIConfig;
}

// =============================================================================
// CONVERSION FUNCTIONS
// =============================================================================

/**
 * Convert a JSON subtype to SubtypeDefinition
 */
function convertSubtype(subtype: JSONSubtype | string): SubtypeDefinition {
  if (typeof subtype === 'string') {
    return { id: subtype, name: subtype };
  }
  return {
    id: subtype.id,
    name: subtype.name || subtype.id,
  };
}

/**
 * Convert a JSON status to StatusDefinition
 */
function convertStatus(status: JSONStatus | string): StatusDefinition {
  if (typeof status === 'string') {
    return {
      id: status,
      name: status,
      isTerminal: status === 'historical' || status === 'dead' || status === 'destroyed',
    };
  }
  return {
    id: status.id,
    name: status.name || status.id,
    isTerminal: status.isTerminal ?? false,
  };
}

/**
 * Convert a JSON entity kind to EntityKindDefinition
 */
function convertEntityKind(jsonKind: JSONEntityKind): EntityKindDefinition {
  const kind = jsonKind.kind || jsonKind.id;
  if (!kind) {
    throw new Error('EntityKind must have either "kind" or "id" field');
  }

  // Convert subtypes
  const subtypes: SubtypeDefinition[] = (jsonKind.subtypes || []).map(convertSubtype);

  // Convert statuses, providing defaults if not specified
  let statuses: StatusDefinition[];
  if (jsonKind.statuses && jsonKind.statuses.length > 0) {
    statuses = jsonKind.statuses.map(convertStatus);
  } else {
    // Default statuses
    statuses = [
      { id: 'active', name: 'Active', isTerminal: false },
      { id: 'historical', name: 'Historical', isTerminal: true },
    ];
  }

  return {
    kind,
    description: jsonKind.description || jsonKind.name || kind,
    subtypes,
    statuses,
    style: {
      displayName: jsonKind.name || jsonKind.description || kind,
      color: jsonKind.color,
      shape: jsonKind.shape,
    },
  };
}

/**
 * Convert a JSON relationship kind to RelationshipKindDefinition
 */
function convertRelationshipKind(jsonKind: JSONRelationshipKind): RelationshipKindDefinition {
  const kind = jsonKind.kind || jsonKind.id;
  if (!kind) {
    throw new Error('RelationshipKind must have either "kind" or "id" field');
  }

  return {
    kind,
    description: jsonKind.description || jsonKind.name || kind,
    srcKinds: jsonKind.srcKinds || jsonKind.sourceKinds || [],
    dstKinds: jsonKind.dstKinds || jsonKind.targetKinds || [],
  };
}

/**
 * Convert a JSON culture to CultureDefinition
 */
function convertCulture(jsonCulture: JSONCulture): CultureDefinition {
  return {
    id: jsonCulture.id,
    name: jsonCulture.name || jsonCulture.id,
    description: jsonCulture.description,
    homeland: jsonCulture.homeland,
  };
}

// =============================================================================
// DOMAIN SCHEMA INTERPRETER
// =============================================================================

/**
 * Convert a JSON domain schema to a runtime DomainSchema object.
 * This is the main entry point for domain schema interpretation.
 */
export function createDomainSchemaFromJSON(json: JSONDomainSchema): DomainSchema {
  // Validate required fields
  if (!json.entityKinds || json.entityKinds.length === 0) {
    throw new Error('DomainSchema must have at least one entityKind');
  }
  if (!json.relationshipKinds || json.relationshipKinds.length === 0) {
    throw new Error('DomainSchema must have at least one relationshipKind');
  }

  // Convert all components
  const entityKinds = json.entityKinds.map(convertEntityKind);
  const relationshipKinds = json.relationshipKinds.map(convertRelationshipKind);
  const cultures = (json.cultures || []).map(convertCulture);

  // Create the domain schema using BaseDomainSchema
  return new BaseDomainSchema({
    id: json.id || 'generated-domain',
    name: json.name || 'Generated World',
    version: json.version || '1.0.0',
    entityKinds,
    relationshipKinds,
    cultures,
    uiConfig: json.uiConfig,
  });
}

/**
 * Load a domain schema from a JSON object.
 * Alias for createDomainSchemaFromJSON for consistency with other interpreters.
 */
export function loadDomainSchema(json: JSONDomainSchema): DomainSchema {
  return createDomainSchemaFromJSON(json);
}
