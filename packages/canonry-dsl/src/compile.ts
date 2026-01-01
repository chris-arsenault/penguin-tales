import { parseCanon } from './parser';
import type {
  AstFile,
  BlockNode,
  Diagnostic,
  StatementNode,
  Value,
  ObjectValue,
  ArrayValue,
  IdentifierValue,
  CompileResult
} from './types';

interface SourceFile {
  path: string;
  content: string;
}

interface BlockMapping {
  target: string;
  idKey?: string;
  nameKey?: string;
  singleton?: boolean;
  mergeIntoRoot?: boolean;
  sortKey?: (item: Record<string, unknown>) => string;
  buildItem?: (block: BlockNode, diagnostics: Diagnostic[]) => Record<string, unknown> | null;
}

const DEFAULT_SORT = (key?: string) => (item: Record<string, unknown>) => {
  if (!key) return '';
  const value = item[key];
  return typeof value === 'string' ? value : '';
};

const BLOCK_MAPPINGS: Record<string, BlockMapping> = {
  project: { target: 'project', singleton: true, mergeIntoRoot: true },
  generator: { target: 'generators', idKey: 'id', nameKey: 'name' },
  action: { target: 'actions', idKey: 'id', nameKey: 'name' },
  pressure: { target: 'pressures', idKey: 'id', nameKey: 'name' },
  era: { target: 'eras', idKey: 'id', nameKey: 'name' },
  entity_kind: { target: 'entityKinds', idKey: 'kind' },
  relationship_kind: { target: 'relationshipKinds', idKey: 'kind' },
  culture: { target: 'cultures', idKey: 'id' },
  tag: { target: 'tagRegistry', idKey: 'tag' },
  axis: { target: 'axisDefinitions', idKey: 'id' },
  ui: { target: 'uiConfig', singleton: true },
  distribution_targets: { target: 'distributionTargets', singleton: true },
  seed_entity: { target: 'seedEntities', idKey: 'id' },
  seed_relationship: { target: 'seedRelationships' },
  system: {
    target: 'systems',
    buildItem: (block, diagnostics) => buildSystemItem(block, diagnostics),
    sortKey: (item) => {
      const config = item.config as Record<string, unknown> | undefined;
      const value = config?.id;
      return typeof value === 'string' ? value : '';
    }
  }
};

const CONTAINER_ALIASES: Record<string, string> = {
  generators: 'generator',
  actions: 'action',
  pressures: 'pressure',
  eras: 'era',
  entity_kinds: 'entity_kind',
  relationship_kinds: 'relationship_kind',
  cultures: 'culture',
  tags: 'tag',
  axes: 'axis',
  systems: 'system',
  seed_entities: 'seed_entity',
  seed_relationships: 'seed_relationship'
};

export function compileCanonProject(files: SourceFile[]): CompileResult<Record<string, unknown>> {
  const diagnostics: Diagnostic[] = [];
  const astFiles: AstFile[] = [];

  for (const file of files) {
    try {
      const statements = parseCanon(file.content, file.path);
      astFiles.push({ path: file.path, statements });
    } catch (error) {
      const err = error as { message?: string; location?: { start: { line: number; column: number; offset: number }; end: { line: number; column: number; offset: number } } };
      diagnostics.push({
        severity: 'error',
        message: err.message || 'Failed to parse .canon file',
        span: err.location
          ? {
              file: file.path,
              start: err.location.start,
              end: err.location.end
            }
          : { file: file.path, start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } }
      });
    }
  }

  if (diagnostics.some(d => d.severity === 'error')) {
    return { config: null, diagnostics };
  }

  const config: Record<string, unknown> = {};
  const seenSingletons = new Set<string>();
  const seenIds: Record<string, Map<string, { span: BlockNode['span'] }>> = {};

  const allBlocks: BlockNode[] = [];
  for (const astFile of astFiles) {
    for (const stmt of astFile.statements) {
      if (stmt.type === 'block') {
        allBlocks.push(...expandContainers(stmt, diagnostics));
      } else {
        diagnostics.push({
          severity: 'error',
          message: `Top-level attribute "${stmt.key}" is not allowed`,
          span: stmt.span
        });
      }
    }
  }

  for (const block of allBlocks) {
    const mapping = BLOCK_MAPPINGS[block.name];
    if (!mapping) {
      diagnostics.push({
        severity: 'error',
        message: `Unknown block type "${block.name}"`,
        span: block.span
      });
      continue;
    }

    if (mapping.singleton) {
      if (seenSingletons.has(mapping.target)) {
        diagnostics.push({
          severity: 'error',
          message: `Duplicate singleton block for "${mapping.target}"`,
          span: block.span
        });
        continue;
      }
      seenSingletons.add(mapping.target);
      const singletonValue = mapping.buildItem
        ? mapping.buildItem(block, diagnostics)
        : buildObjectFromStatements(block.body, diagnostics, block);
      if (singletonValue) {
        if (mapping.mergeIntoRoot) {
          for (const [key, value] of Object.entries(singletonValue)) {
            if (key in config) {
              diagnostics.push({
                severity: 'error',
                message: `Duplicate project field "${key}"`,
                span: block.span
              });
              continue;
            }
            config[key] = value;
          }
        } else {
          config[mapping.target] = singletonValue;
        }
      }
      continue;
    }

    const item = mapping.buildItem
      ? mapping.buildItem(block, diagnostics)
      : buildItemFromBlock(block, mapping, diagnostics);
    if (!item) continue;

    const target = mapping.target;
    if (!config[target]) config[target] = [];
    const list = config[target] as Record<string, unknown>[];

    if (mapping.idKey) {
      const idValue = item[mapping.idKey];
      if (typeof idValue === 'string') {
        if (!seenIds[target]) seenIds[target] = new Map();
        const existing = seenIds[target].get(idValue);
        if (existing) {
          diagnostics.push({
            severity: 'error',
            message: `Duplicate ${mapping.idKey} "${idValue}" in ${target}`,
            span: block.span
          });
          continue;
        }
        seenIds[target].set(idValue, { span: block.span });
      }
    }

    list.push(item);
  }

  if (!seenSingletons.has('project')) {
    diagnostics.push({
      severity: 'error',
      message: 'Missing required project block',
      span: undefined
    });
  }

  if (diagnostics.some(d => d.severity === 'error')) {
    return { config: null, diagnostics };
  }

  for (const [blockName, mapping] of Object.entries(BLOCK_MAPPINGS)) {
    if (mapping.singleton) continue;
    const target = mapping.target;
    const list = config[target] as Record<string, unknown>[] | undefined;
    if (!list || list.length === 0) continue;
    const sortKey = mapping.sortKey || DEFAULT_SORT(mapping.idKey);
    list.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  }

  return { config, diagnostics };
}

function expandContainers(block: BlockNode, diagnostics: Diagnostic[]): BlockNode[] {
  const alias = CONTAINER_ALIASES[block.name];
  if (!alias) return [block];

  const blocks: BlockNode[] = [];
  for (const stmt of block.body) {
    if (stmt.type === 'block') {
      blocks.push({ ...stmt, name: alias });
    } else {
      diagnostics.push({
        severity: 'error',
        message: `Container block "${block.name}" only accepts nested blocks`,
        span: stmt.span
      });
    }
  }

  return blocks;
}

function buildSystemItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  if (block.labels.length < 2) {
    diagnostics.push({
      severity: 'error',
      message: 'system block requires: system <systemType> <id> ["name"]',
      span: block.span
    });
    return null;
  }

  const [systemType, idLabel, nameLabel] = block.labels;
  const rawBody = buildObjectFromStatements(block.body, diagnostics, block);
  const configFromBody = (rawBody.config && typeof rawBody.config === 'object' && !Array.isArray(rawBody.config))
    ? (rawBody.config as Record<string, unknown>)
    : { ...rawBody };

  if (!rawBody.config && rawBody.enabled !== undefined) {
    delete configFromBody.enabled;
  }

  const configId = configFromBody.id;
  if (configId !== undefined) {
    if (typeof configId !== 'string') {
      diagnostics.push({
        severity: 'error',
        message: 'system config.id must be a string',
        span: block.span
      });
      return null;
    }
    if (configId !== idLabel) {
      diagnostics.push({
        severity: 'error',
        message: `system id mismatch: label "${idLabel}" vs config.id "${configId}"`,
        span: block.span
      });
      return null;
    }
  }

  const configName = configFromBody.name;
  if (nameLabel && configName !== undefined) {
    if (typeof configName !== 'string') {
      diagnostics.push({
        severity: 'error',
        message: 'system config.name must be a string',
        span: block.span
      });
      return null;
    }
    if (configName !== nameLabel) {
      diagnostics.push({
        severity: 'error',
        message: `system name mismatch: label "${nameLabel}" vs config.name "${configName}"`,
        span: block.span
      });
      return null;
    }
  }

  const config = {
    ...configFromBody,
    id: idLabel,
    ...(nameLabel ? { name: nameLabel } : {})
  };

  const enabled = rawBody.enabled;

  return {
    systemType,
    config,
    ...(enabled !== undefined ? { enabled } : {})
  };
}

function buildItemFromBlock(
  block: BlockNode,
  mapping: BlockMapping,
  diagnostics: Diagnostic[]
): Record<string, unknown> | null {
  const body = buildObjectFromStatements(block.body, diagnostics, block);
  const item = { ...body } as Record<string, unknown>;
  const idLabel = block.labels[0];
  const nameLabel = block.labels[1];

  if (mapping.idKey && idLabel) {
    const existing = item[mapping.idKey];
    if (existing !== undefined) {
      if (typeof existing !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: `${mapping.idKey} must be a string`,
          span: block.span
        });
        return null;
      }
      if (existing !== idLabel) {
        diagnostics.push({
          severity: 'error',
          message: `${mapping.idKey} mismatch: label "${idLabel}" vs value "${existing}"`,
          span: block.span
        });
        return null;
      }
    }
    item[mapping.idKey] = idLabel;
  }

  if (mapping.nameKey && nameLabel) {
    const existing = item[mapping.nameKey];
    if (existing !== undefined) {
      if (typeof existing !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: `${mapping.nameKey} must be a string`,
          span: block.span
        });
        return null;
      }
      if (existing !== nameLabel) {
        diagnostics.push({
          severity: 'error',
          message: `${mapping.nameKey} mismatch: label "${nameLabel}" vs value "${existing}"`,
          span: block.span
        });
        return null;
      }
    }
    item[mapping.nameKey] = nameLabel;
  }

  return item;
}

function buildObjectFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      const value = valueToJson(stmt.value, diagnostics, parent);
      setObjectValue(obj, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      const child = buildObjectFromStatements(stmt.body, diagnostics, stmt);
      if (stmt.labels.length > 0) {
        const existingId = child.id;
        if (existingId === undefined) {
          child.id = stmt.labels[0];
        } else if (typeof existingId !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'block id must be a string',
            span: stmt.span
          });
        } else if (existingId !== stmt.labels[0]) {
          diagnostics.push({
            severity: 'error',
            message: `block id mismatch: label "${stmt.labels[0]}" vs id "${existingId}"`,
            span: stmt.span
          });
        }
      }
      if (stmt.labels.length > 1) {
        const existingName = child.name;
        if (existingName === undefined) {
          child.name = stmt.labels[1];
        } else if (typeof existingName !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'block name must be a string',
            span: stmt.span
          });
        } else if (existingName !== stmt.labels[1]) {
          diagnostics.push({
            severity: 'error',
            message: `block name mismatch: label "${stmt.labels[1]}" vs name "${existingName}"`,
            span: stmt.span
          });
        }
      }

      setObjectValue(obj, stmt.name, child);
    }
  }

  return obj;
}

function setObjectValue(obj: Record<string, unknown>, key: string, value: unknown): void {
  if (key in obj) {
    const existing = obj[key];
    if (Array.isArray(existing)) {
      existing.push(value);
      return;
    }
    obj[key] = [existing, value];
    return;
  }
  obj[key] = value;
}

function valueToJson(value: Value, diagnostics: Diagnostic[], parent: BlockNode): unknown {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (isIdentifierValue(value)) {
    return value.value;
  }

  if (isArrayValue(value)) {
    return value.items.map(item => valueToJson(item, diagnostics, parent));
  }

  if (isObjectValue(value)) {
    const obj: Record<string, unknown> = {};
    for (const entry of value.entries) {
      const jsonValue = valueToJson(entry.value, diagnostics, parent);
      setObjectValue(obj, entry.key, jsonValue);
    }
    return obj;
  }

  return value;
}

function isIdentifierValue(value: Value): value is IdentifierValue {
  return typeof value === 'object' && value !== null && (value as IdentifierValue).type === 'identifier';
}

function isArrayValue(value: Value): value is ArrayValue {
  return typeof value === 'object' && value !== null && (value as ArrayValue).type === 'array';
}

function isObjectValue(value: Value): value is ObjectValue {
  return typeof value === 'object' && value !== null && (value as ObjectValue).type === 'object';
}
