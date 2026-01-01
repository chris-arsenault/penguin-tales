const INDENT = '  ';
const KEYWORDS = new Set(['do', 'end', 'true', 'false', 'null']);
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const KIND_SUBTYPE_RE = /^[A-Za-z_][A-Za-z0-9_-]*:[A-Za-z_][A-Za-z0-9_-]*$/;

export interface CanonFile {
  path: string;
  content: string;
}

interface CollectionDef {
  key: string;
  block: string;
  file: string;
  idKey?: string;
  nameKey?: string;
  sortKey?: (item: Record<string, unknown>) => string;
}

interface SingletonDef {
  key: string;
  block: string;
  file: string;
}

interface SerializeOptions {
  includeEmpty?: boolean;
}

const COLLECTIONS: CollectionDef[] = [
  { key: 'entityKinds', block: 'entity_kind', file: 'entity_kinds.canon', idKey: 'kind' },
  { key: 'relationshipKinds', block: 'relationship_kind', file: 'relationship_kinds.canon', idKey: 'kind' },
  { key: 'cultures', block: 'culture', file: 'cultures.canon', idKey: 'id' },
  { key: 'tagRegistry', block: 'tag', file: 'tag_registry.canon', idKey: 'tag' },
  { key: 'axisDefinitions', block: 'axis', file: 'axis_definitions.canon', idKey: 'id' },
  { key: 'eras', block: 'era', file: 'eras.canon', idKey: 'id', nameKey: 'name' },
  { key: 'pressures', block: 'pressure', file: 'pressures.canon', idKey: 'id', nameKey: 'name' },
  { key: 'generators', block: 'generator', file: 'generators.canon', idKey: 'id', nameKey: 'name' },
  {
    key: 'systems',
    block: 'system',
    file: 'systems.canon',
    sortKey: (item) => {
      const config = item.config;
      if (isRecord(config) && typeof config.id === 'string') {
        return config.id;
      }
      return '';
    }
  },
  { key: 'actions', block: 'action', file: 'actions.canon', idKey: 'id', nameKey: 'name' },
  { key: 'seedEntities', block: 'seed_entity', file: 'seed_entities.canon', idKey: 'id' },
  { key: 'seedRelationships', block: 'seed_relationship', file: 'seed_relationships.canon' }
];

const SINGLETONS: SingletonDef[] = [
  { key: 'uiConfig', block: 'ui', file: 'ui_config.canon' },
  { key: 'distributionTargets', block: 'distribution_targets', file: 'distribution_targets.canon' }
];

const PROJECT_FILE = 'project.canon';

const ROOT_KEYS = new Set([
  ...COLLECTIONS.map(def => def.key),
  ...SINGLETONS.map(def => def.key)
]);

export function serializeCanonProject(
  project: Record<string, unknown>,
  options: SerializeOptions = {}
): CanonFile[] {
  const includeEmpty = options.includeEmpty ?? true;
  const files: CanonFile[] = [];

  const projectFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(project)) {
    if (ROOT_KEYS.has(key)) continue;
    if (value === undefined) continue;
    projectFields[key] = value;
  }

  files.push({
    path: PROJECT_FILE,
    content: formatBlock('project', [], projectFields)
  });

  for (const def of SINGLETONS) {
    const value = project[def.key];
    if (value === undefined || value === null) {
      if (includeEmpty) {
        files.push({ path: def.file, content: '' });
      }
      continue;
    }
    const body = isRecord(value) ? value : { value };
    files.push({
      path: def.file,
      content: formatBlock(def.block, [], body)
    });
  }

  for (const def of COLLECTIONS) {
    const raw = project[def.key];
    const items = Array.isArray(raw) ? raw.slice() : [];
    if (items.length === 0) {
      if (includeEmpty) {
        files.push({ path: def.file, content: '' });
      }
      continue;
    }

    items.sort((a, b) => {
      if (!isRecord(a) || !isRecord(b)) return 0;
      if (def.sortKey) return def.sortKey(a).localeCompare(def.sortKey(b));
      if (!def.idKey) return 0;
      const aValue = a[def.idKey];
      const bValue = b[def.idKey];
      if (typeof aValue !== 'string' || typeof bValue !== 'string') return 0;
      return aValue.localeCompare(bValue);
    });

    const blocks: string[] = [];
    for (const item of items) {
      if (!isRecord(item)) continue;
      if (def.block === 'system') {
        const block = formatSystemBlock(item);
        if (block) blocks.push(block);
        continue;
      }

      const body = { ...item };
      const labels: string[] = [];
      if (def.idKey && typeof body[def.idKey] === 'string') {
        labels.push(body[def.idKey] as string);
        delete body[def.idKey];
      }
      if (def.nameKey && typeof body[def.nameKey] === 'string') {
        labels.push(body[def.nameKey] as string);
        delete body[def.nameKey];
      }

      blocks.push(formatBlock(def.block, labels, body));
    }

    files.push({
      path: def.file,
      content: blocks.join('\n\n')
    });
  }

  return files;
}

function formatSystemBlock(item: Record<string, unknown>): string | null {
  const systemType = item.systemType;
  if (typeof systemType !== 'string') return null;

  const configValue = item.config;
  const config = isRecord(configValue) ? { ...configValue } : {};
  const idLabel = typeof config.id === 'string' ? config.id : null;
  const nameLabel = typeof config.name === 'string' ? config.name : null;
  if (idLabel) delete config.id;
  if (nameLabel) delete config.name;

  const labels = [systemType];
  if (idLabel) labels.push(idLabel);
  if (nameLabel) labels.push(nameLabel);

  const body: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(item)) {
    if (key === 'systemType' || key === 'config') continue;
    body[key] = value;
  }

  if (Object.keys(config).length > 0) {
    body.config = config;
  }

  return formatBlock('system', labels, body);
}

function formatBlock(name: string, labels: string[], body: Record<string, unknown>): string {
  const header = `${name}${labels.length > 0 ? ' ' + labels.map(formatLabel).join(' ') : ''} do`;
  const lines = [header];
  const bodyLines = formatAttributeLines(body, 1);
  if (bodyLines.length > 0) {
    lines.push(...bodyLines);
  }
  lines.push('end');
  return lines.join('\n');
}

function formatAttributeLines(obj: Record<string, unknown>, indentLevel: number): string[] {
  const lines: string[] = [];
  const entries = Object.entries(obj).filter(([, value]) => value !== undefined);

  for (const [key, value] of entries) {
    const valueLines = formatValueLines(value, indentLevel + 1);
    const valueIndent = indent(indentLevel + 1);
    const first = valueLines[0].startsWith(valueIndent)
      ? valueLines[0].slice(valueIndent.length)
      : valueLines[0];
    lines.push(`${indent(indentLevel)}${formatAttributeKey(key)} ${first}`);
    if (valueLines.length > 1) {
      lines.push(...valueLines.slice(1));
    }
  }

  return lines;
}

function formatValueLines(value: unknown, indentLevel: number): string[] {
  if (value === null) {
    return [indent(indentLevel) + 'null'];
  }
  if (typeof value === 'string') {
    return [indent(indentLevel) + formatScalarString(value)];
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [indent(indentLevel) + String(value)];
  }
  if (Array.isArray(value)) {
    return formatArrayLines(value, indentLevel);
  }
  if (isRecord(value)) {
    return formatObjectLines(value, indentLevel);
  }
  return [indent(indentLevel) + 'null'];
}

function formatArrayLines(items: unknown[], indentLevel: number): string[] {
  if (items.length === 0) {
    return [indent(indentLevel) + '[]'];
  }

  const lines: string[] = [];
  lines.push(indent(indentLevel) + '[');

  items.forEach((item, index) => {
    const itemLines = formatValueLines(item, indentLevel + 1);
    if (index < items.length - 1) {
      itemLines[itemLines.length - 1] += ',';
    }
    lines.push(...itemLines);
  });

  lines.push(indent(indentLevel) + ']');
  return lines;
}

function formatObjectLines(obj: Record<string, unknown>, indentLevel: number): string[] {
  const entries = Object.entries(obj).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return [indent(indentLevel) + '{}'];
  }

  const lines: string[] = [];
  lines.push(indent(indentLevel) + '{');

  entries.forEach(([key, value], index) => {
    const valueLines = formatValueLines(value, indentLevel + 1);
    const valueIndent = indent(indentLevel + 1);
    const first = valueLines[0].startsWith(valueIndent)
      ? valueLines[0].slice(valueIndent.length)
      : valueLines[0];
    lines.push(`${indent(indentLevel + 1)}${formatObjectKey(key)}: ${first}`);
    if (valueLines.length > 1) {
      lines.push(...valueLines.slice(1));
    }
    if (index < entries.length - 1) {
      lines[lines.length - 1] += ',';
    }
  });

  lines.push(indent(indentLevel) + '}');
  return lines;
}

function formatScalarString(value: string): string {
  if (isIdentifier(value)) return value;
  return quoteString(value);
}

function formatAttributeKey(key: string): string {
  if (isIdentifier(key)) return key;
  return quoteString(key);
}

function formatObjectKey(key: string): string {
  if (isIdentifier(key)) return key;
  return quoteString(key);
}

function formatLabel(value: string): string {
  if (isKindSubtype(value) || isIdentifier(value)) return value;
  return quoteString(value);
}

function quoteString(value: string): string {
  return `"${value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')}"`;
}

function indent(level: number): string {
  return INDENT.repeat(level);
}

function isIdentifier(value: string): boolean {
  return IDENTIFIER_RE.test(value) && !KEYWORDS.has(value);
}

function isKindSubtype(value: string): boolean {
  if (!KIND_SUBTYPE_RE.test(value)) return false;
  const [left, right] = value.split(':');
  return isIdentifier(left) && isIdentifier(right);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
