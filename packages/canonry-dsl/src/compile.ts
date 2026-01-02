import { parseCanon } from './parser.js';
import type {
  AstFile,
  BlockNode,
  Diagnostic,
  AttributeNode,
  StatementNode,
  Value,
  ObjectValue,
  ArrayValue,
  IdentifierValue,
  CallValue,
  CompileResult,
  StaticPagesCompileResult
} from './types.js';

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
  generator: {
    target: 'generators',
    idKey: 'id',
    nameKey: 'name',
    buildItem: (block, diagnostics) => buildGeneratorItem(block, diagnostics)
  },
  action: {
    target: 'actions',
    idKey: 'id',
    nameKey: 'name',
    buildItem: (block, diagnostics) => buildActionItem(block, diagnostics)
  },
  pressure: { target: 'pressures', idKey: 'id', nameKey: 'name' },
  era: { target: 'eras', idKey: 'id', nameKey: 'name' },
  entity_kind: {
    target: 'entityKinds',
    idKey: 'kind',
    buildItem: (block, diagnostics) => buildEntityKindItem(block, diagnostics)
  },
  relationship_kind: {
    target: 'relationshipKinds',
    idKey: 'kind',
    buildItem: (block, diagnostics) => buildRelationshipKindItem(block, diagnostics)
  },
  culture: {
    target: 'cultures',
    idKey: 'id',
    buildItem: (block, diagnostics) => buildCultureItem(block, diagnostics)
  },
  tag: {
    target: 'tagRegistry',
    idKey: 'tag',
    buildItem: (block, diagnostics) => buildTagItem(block, diagnostics)
  },
  axis: {
    target: 'axisDefinitions',
    idKey: 'id',
    buildItem: (block, diagnostics) => buildAxisItem(block, diagnostics)
  },
  ui: { target: 'uiConfig', singleton: true },
  distribution_targets: { target: 'distributionTargets', singleton: true },
  seed_entity: {
    target: 'seedEntities',
    idKey: 'id',
    buildItem: (block, diagnostics) => buildSeedEntityItem(block, diagnostics)
  },
  seed_relationship: {
    target: 'seedRelationships',
    buildItem: (block, diagnostics) => buildSeedRelationshipItem(block, diagnostics)
  },
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

const INLINE_ITEM_KEYS = new Set([
  'axis',
  'entity_kind',
  'relationship_kind',
  'tag',
  'seed_relationship'
]);

interface VariableEntry {
  name: string;
  value: Value;
  span: BlockNode['span'];
}

interface ResourceEntry {
  name: string;
  id: string;
  type: string;
  span: BlockNode['span'];
}

const RESOURCE_BLOCKS = new Set([
  'entity_kind',
  'relationship_kind',
  'era',
  'culture',
  'axis',
  'tag',
  'pressure',
  'region',
  'domain',
  'grammar',
  'profile',
  'lexeme_spec',
  'lexeme',
  'lexeme_list'
]);

const VARIABLE_BLOCK_NAMES = new Set(['vars', 'locals']);
const VARIABLE_ATTRIBUTE_KEYS = new Set(['var', 'variable']);
const VARIABLE_REFERENCE_PREFIXES = ['var.', 'vars.', 'local.'];
const NAMING_RESOURCE_BLOCKS = new Set([
  'domain',
  'grammar',
  'profile',
  'lexeme_spec',
  'lexeme_list',
  'lexeme'
]);

interface EvalContext {
  variables: Map<string, VariableEntry>;
  resources: Map<string, ResourceEntry[]>;
  resolved: Map<string, unknown>;
  resolving: Set<string>;
  diagnostics: Diagnostic[];
}

let activeEvalContext: EvalContext | null = null;

function collectVariables(
  astFiles: AstFile[],
  diagnostics: Diagnostic[]
): { files: AstFile[]; variables: Map<string, VariableEntry> } {
  const variables = new Map<string, VariableEntry>();

  const files = astFiles.map((file) => {
    const statements: StatementNode[] = [];
    for (const stmt of file.statements) {
      if (stmt.type === 'block' && stmt.name === 'def') {
        diagnostics.push({
          severity: 'error',
          message: 'def blocks are no longer supported; declare resources directly',
          span: stmt.span
        });
        continue;
      }
      if (stmt.type === 'block' && VARIABLE_BLOCK_NAMES.has(stmt.name)) {
        registerVariableBlock(stmt, variables, diagnostics);
        continue;
      }
      if (stmt.type === 'attribute' && VARIABLE_ATTRIBUTE_KEYS.has(stmt.key)) {
        registerVariableAttribute(stmt, variables, diagnostics);
        continue;
      }
      statements.push(stmt);
    }
    return { ...file, statements };
  });

  return { files, variables };
}

function registerVariableBlock(
  stmt: BlockNode,
  variables: Map<string, VariableEntry>,
  diagnostics: Diagnostic[]
): void {
  for (const child of stmt.body) {
    if (child.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: `${stmt.name} blocks only support attribute assignments`,
        span: child.span
      });
      continue;
    }
    if (child.labels && child.labels.length > 0) {
      diagnostics.push({
        severity: 'error',
        message: `${stmt.name} assignments cannot use labels`,
        span: child.span
      });
      continue;
    }
    registerVariableEntry(child.key, child.value, child.span, variables, diagnostics);
  }
}

function registerVariableAttribute(
  stmt: AttributeNode,
  variables: Map<string, VariableEntry>,
  diagnostics: Diagnostic[]
): void {
  if (!isObjectValue(stmt.value)) {
    diagnostics.push({
      severity: 'error',
      message: `${stmt.key} requires key:value pairs`,
      span: stmt.span
    });
    return;
  }
  for (const entry of stmt.value.entries) {
    registerVariableEntry(entry.key, entry.value, entry.span, variables, diagnostics);
  }
}

function registerVariableEntry(
  name: string,
  value: Value,
  span: BlockNode['span'],
  variables: Map<string, VariableEntry>,
  diagnostics: Diagnostic[]
): void {
  if (name.includes('.')) {
    diagnostics.push({
      severity: 'error',
      message: `Variable names cannot contain "." (found "${name}")`,
      span
    });
    return;
  }
  if (variables.has(name)) {
    diagnostics.push({
      severity: 'error',
      message: `Duplicate variable "${name}"`,
      span
    });
    return;
  }
  variables.set(name, { name, value, span });
}

function expandStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[]
): StatementNode[] {
  const expanded: StatementNode[] = [];

  for (const stmt of statements) {
    if (stmt.type === 'block') {
      if (stmt.name === 'def') {
        diagnostics.push({
          severity: 'error',
          message: 'def blocks are no longer supported; declare resources directly',
          span: stmt.span
        });
        continue;
      }
      if (VARIABLE_BLOCK_NAMES.has(stmt.name)) {
        diagnostics.push({
          severity: 'error',
          message: `${stmt.name} blocks are only allowed at the top level`,
          span: stmt.span
        });
        continue;
      }
      const body = expandStatements(stmt.body, diagnostics);
      if (body !== stmt.body) {
        expanded.push({ ...stmt, body });
      } else {
        expanded.push(stmt);
      }
      continue;
    }

    expanded.push(stmt);
  }

  return expanded;
}

function createEvalContext(
  variables: Map<string, VariableEntry>,
  resources: Map<string, ResourceEntry[]>,
  diagnostics: Diagnostic[]
): EvalContext {
  return {
    variables,
    resources,
    resolved: new Map<string, unknown>(),
    resolving: new Set<string>(),
    diagnostics
  };
}

function withEvalContext<T>(ctx: EvalContext, fn: () => T): T {
  const previous = activeEvalContext;
  activeEvalContext = ctx;
  try {
    return fn();
  } finally {
    activeEvalContext = previous;
  }
}

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

  const { files: filteredFiles, variables } = collectVariables(astFiles, diagnostics);
  if (diagnostics.some(d => d.severity === 'error')) {
    return { config: null, diagnostics };
  }

  const expandedFiles = filteredFiles.map((file) => ({
    ...file,
    statements: expandStatements(file.statements, diagnostics)
  }));
  if (diagnostics.some(d => d.severity === 'error')) {
    return { config: null, diagnostics };
  }

  const allBlocks = collectTopLevelBlocks(expandedFiles, diagnostics);
  if (diagnostics.some(d => d.severity === 'error')) {
    return { config: null, diagnostics };
  }

  const resources = collectResourceRegistry(allBlocks);
  if (diagnostics.some(d => d.severity === 'error')) {
    return { config: null, diagnostics };
  }

  const evalContext = createEvalContext(variables, resources, diagnostics);
  return withEvalContext(evalContext, () => {
    const { blocks: filteredBlocks, resources: namingResources } = collectNamingResources(allBlocks, diagnostics);
    if (diagnostics.some(d => d.severity === 'error')) {
      return { config: null, diagnostics };
    }
    const config: Record<string, unknown> = {};
    const seenSingletons = new Set<string>();
    const seenIds: Record<string, Map<string, { span: BlockNode['span'] }>> = {};

    for (const block of filteredBlocks) {
      const mapping = BLOCK_MAPPINGS[block.name];
      if (!mapping) {
        if (block.name === 'static_page') {
          continue;
        }
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

    for (const [, mapping] of Object.entries(BLOCK_MAPPINGS)) {
      if (mapping.singleton) continue;
      const target = mapping.target;
      const list = config[target] as Record<string, unknown>[] | undefined;
      if (!list || list.length === 0) continue;
      const sortKey = mapping.sortKey || DEFAULT_SORT(mapping.idKey);
      list.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    }

    validateSeedRelationships(config, diagnostics);
    if (diagnostics.some(d => d.severity === 'error')) {
      return { config: null, diagnostics };
    }

    applyNamingResources(config, namingResources, diagnostics);
    if (diagnostics.some(d => d.severity === 'error')) {
      return { config: null, diagnostics };
    }

    return { config, diagnostics };
  });
}

export function compileCanonStaticPages(
  files: Array<{ path: string; content: string }>
): StaticPagesCompileResult {
  const diagnostics: Diagnostic[] = [];
  const pages: Record<string, unknown>[] = [];
  const contentByPath = new Map<string, string>();
  const astFiles: AstFile[] = [];

  for (const file of files) {
    contentByPath.set(file.path, file.content);
  }

  const canonFiles = files.filter(file => file.path.endsWith('.canon'));
  for (const file of canonFiles) {
    let statements: StatementNode[];
    try {
      statements = parseCanon(file.content, file.path);
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
      continue;
    }
    astFiles.push({ path: file.path, statements });
  }

  if (diagnostics.some(d => d.severity === 'error')) {
    return { pages: null, diagnostics };
  }

  const { files: filteredFiles, variables } = collectVariables(astFiles, diagnostics);
  if (diagnostics.some(d => d.severity === 'error')) {
    return { pages: null, diagnostics };
  }

  const expandedFiles = filteredFiles.map((file) => ({
    ...file,
    statements: expandStatements(file.statements, diagnostics)
  }));
  if (diagnostics.some(d => d.severity === 'error')) {
    return { pages: null, diagnostics };
  }

  const evalContext = createEvalContext(variables, new Map(), diagnostics);
  return withEvalContext(evalContext, () => {
    for (const file of expandedFiles) {
      for (const stmt of file.statements) {
        if (stmt.type !== 'block' || stmt.name !== 'static_page') continue;
        const page = buildStaticPageFromBlock(stmt, contentByPath, diagnostics);
        if (page) pages.push(page);
      }
    }

    if (diagnostics.some(d => d.severity === 'error')) {
      return { pages: null, diagnostics };
    }

    return { pages, diagnostics };
  });
}

function collectTopLevelBlocks(
  files: AstFile[],
  diagnostics: Diagnostic[]
): BlockNode[] {
  const blocks: BlockNode[] = [];

  for (const astFile of files) {
    for (const stmt of astFile.statements) {
      if (stmt.type === 'block') {
        blocks.push(...expandContainers(stmt, diagnostics));
        continue;
      }
      if (stmt.type === 'attribute') {
        const inlineBlock = inlineBlockFromAttribute(stmt, diagnostics);
        if (inlineBlock) {
          blocks.push(...expandContainers(inlineBlock, diagnostics));
          continue;
        }
        diagnostics.push({
          severity: 'error',
          message: `Top-level attribute "${stmt.key}" is not allowed`,
          span: stmt.span
        });
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: `Top-level statement "${stmt.type}" is not allowed`,
        span: stmt.span
      });
    }
  }

  return blocks;
}

function collectResourceRegistry(blocks: BlockNode[]): Map<string, ResourceEntry[]> {
  const resources = new Map<string, ResourceEntry[]>();
  const namingIdsByType = new Map<string, Set<string>>();

  for (const block of blocks) {
    if (!RESOURCE_BLOCKS.has(block.name)) continue;
    const name = block.labels[0];
    if (!name) continue;

    if (NAMING_RESOURCE_BLOCKS.has(block.name)) {
      const seen = namingIdsByType.get(block.name) ?? new Set<string>();
      if (seen.has(name)) {
        continue;
      }
      seen.add(name);
      namingIdsByType.set(block.name, seen);
    }

    const entry: ResourceEntry = {
      name,
      id: name,
      type: block.name,
      span: block.span
    };
    const existing = resources.get(name);
    if (existing) {
      existing.push(entry);
    } else {
      resources.set(name, [entry]);
    }
  }

  return resources;
}

interface NamingResourceEntry {
  item: Record<string, unknown>;
  cultures: string[];
  span: BlockNode['span'];
}

interface NamingResourceCollection {
  domains: NamingResourceEntry[];
  grammars: NamingResourceEntry[];
  profiles: NamingResourceEntry[];
  lexemeSpecs: NamingResourceEntry[];
  lexemeLists: NamingResourceEntry[];
}

function normalizeForSignature(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForSignature(entry));
  }
  if (isRecord(value)) {
    const result: Record<string, unknown> = {};
    const keys = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      result[key] = normalizeForSignature(value[key]);
    }
    return result;
  }
  return value;
}

function signatureForNamingResource(item: Record<string, unknown>): string {
  const payload = { ...item };
  delete payload.cultureId;
  return JSON.stringify(normalizeForSignature(payload));
}

function mergeNamingResourceEntries(
  entries: NamingResourceEntry[],
  label: string,
  diagnostics: Diagnostic[]
): NamingResourceEntry[] {
  const merged: NamingResourceEntry[] = [];
  const grouped = new Map<string, Map<string, NamingResourceEntry>>();

  for (const entry of entries) {
    const id = entry.item?.id;
    if (typeof id !== 'string') {
      merged.push(entry);
      continue;
    }
    const signature = signatureForNamingResource(entry.item);
    const bySignature = grouped.get(id) ?? new Map<string, NamingResourceEntry>();
    const existing = bySignature.get(signature);
    if (existing) {
      const cultures = new Set<string>([...existing.cultures, ...entry.cultures]);
      existing.cultures = Array.from(cultures).sort((a, b) => a.localeCompare(b));
      existing.item.cultureId = existing.cultures.length === 1 ? existing.cultures[0] : existing.cultures;
    } else {
      bySignature.set(signature, {
        ...entry,
        cultures: Array.from(new Set(entry.cultures)).sort((a, b) => a.localeCompare(b))
      });
    }
    grouped.set(id, bySignature);
  }

  for (const [id, bySignature] of grouped.entries()) {
    if (bySignature.size > 1) {
      const spans = Array.from(bySignature.values()).map((entry) => entry.span).filter(Boolean);
      diagnostics.push({
        severity: 'error',
        message: `Duplicate ${label} "${id}" definitions detected; use a single block with culture_id or rename the resource`,
        span: spans[0]
      });
    }
    merged.push(...bySignature.values());
  }

  return merged;
}

function extractCultureIds(
  item: Record<string, unknown>,
  diagnostics: Diagnostic[],
  span: BlockNode['span'],
  label: string
): string[] | null {
  const raw = item.cultureId;
  if (typeof raw === 'string') {
    return [raw];
  }
  if (Array.isArray(raw) && raw.every((entry) => typeof entry === 'string')) {
    return raw as string[];
  }
  diagnostics.push({
    severity: 'error',
    message: `${label} requires culture_id`,
    span
  });
  return null;
}

function collectNamingResources(
  blocks: BlockNode[],
  diagnostics: Diagnostic[]
): { blocks: BlockNode[]; resources: NamingResourceCollection } {
  const resources: NamingResourceCollection = {
    domains: [],
    grammars: [],
    profiles: [],
    lexemeSpecs: [],
    lexemeLists: []
  };

  const remaining: BlockNode[] = [];

  for (const block of blocks) {
    if (!NAMING_RESOURCE_BLOCKS.has(block.name)) {
      remaining.push(block);
      continue;
    }

    if (block.name === 'domain') {
      const domain = buildNamingDomain(block, diagnostics);
      if (!domain) continue;
      const cultures = extractCultureIds(domain, diagnostics, block.span, 'domain');
      if (!cultures) continue;
      resources.domains.push({ item: domain, cultures, span: block.span });
      continue;
    }

    if (block.name === 'grammar') {
      const grammar = buildGrammarFromBlock(block, diagnostics);
      if (!grammar) continue;
      const cultures = extractCultureIds(grammar, diagnostics, block.span, 'grammar');
      if (!cultures) continue;
      resources.grammars.push({ item: grammar, cultures, span: block.span });
      continue;
    }

    if (block.name === 'profile') {
      const profile = buildNamingProfile(block, diagnostics);
      if (!profile) continue;
      const cultures = extractCultureIds(profile, diagnostics, block.span, 'profile');
      if (!cultures) continue;
      resources.profiles.push({ item: profile, cultures, span: block.span });
      continue;
    }

    if (block.name === 'lexeme_spec') {
      const spec = buildLexemeSpec(block, diagnostics);
      if (!spec) continue;
      const cultures = extractCultureIds(spec, diagnostics, block.span, 'lexeme_spec');
      if (!cultures) continue;
      resources.lexemeSpecs.push({ item: spec, cultures, span: block.span });
      continue;
    }

    if (block.name === 'lexeme_list' || block.name === 'lexeme') {
      const list = buildLexemeList(block, diagnostics);
      if (!list) continue;
      const cultures = extractCultureIds(list, diagnostics, block.span, 'lexeme_list');
      if (!cultures) continue;
      resources.lexemeLists.push({ item: list, cultures, span: block.span });
      continue;
    }

    remaining.push(block);
  }

  resources.domains = mergeNamingResourceEntries(resources.domains, 'domain', diagnostics);
  resources.grammars = mergeNamingResourceEntries(resources.grammars, 'grammar', diagnostics);
  resources.profiles = mergeNamingResourceEntries(resources.profiles, 'profile', diagnostics);
  resources.lexemeSpecs = mergeNamingResourceEntries(resources.lexemeSpecs, 'lexeme_spec', diagnostics);
  resources.lexemeLists = mergeNamingResourceEntries(resources.lexemeLists, 'lexeme_list', diagnostics);

  return { blocks: remaining, resources };
}

function applyNamingResources(
  config: Record<string, unknown>,
  resources: NamingResourceCollection,
  diagnostics: Diagnostic[]
): void {
  const cultures = Array.isArray(config.cultures) ? config.cultures : [];
  const cultureById = new Map<string, Record<string, unknown>>();
  for (const culture of cultures) {
    if (isRecord(culture) && typeof culture.id === 'string') {
      cultureById.set(culture.id, culture);
    }
  }

  const ensureNaming = (culture: Record<string, unknown>): Record<string, unknown> => {
    if (isRecord(culture.naming)) {
      return culture.naming as Record<string, unknown>;
    }
    culture.naming = {};
    return culture.naming as Record<string, unknown>;
  };

  const attachArray = (
    culture: Record<string, unknown>,
    key: 'domains' | 'grammars' | 'profiles' | 'lexemeSpecs',
    entry: Record<string, unknown>,
    label: string,
    span: BlockNode['span']
  ) => {
    const naming = ensureNaming(culture);
    const existing = naming[key];
    let list: Record<string, unknown>[];
    if (existing === undefined) {
      list = [];
      naming[key] = list;
    } else if (Array.isArray(existing)) {
      list = existing as Record<string, unknown>[];
    } else {
      diagnostics.push({
        severity: 'error',
        message: `culture "${culture.id}" naming.${key} must be an array`,
        span
      });
      return;
    }
    const id = entry.id;
    if (typeof id === 'string' && list.some((item) => isRecord(item) && item.id === id)) {
      diagnostics.push({
        severity: 'error',
        message: `Duplicate ${label} "${id}" for culture "${culture.id}"`,
        span
      });
      return;
    }
    list.push(entry);
  };

  const attachLexemeList = (
    culture: Record<string, unknown>,
    entry: Record<string, unknown>,
    span: BlockNode['span']
  ) => {
    const naming = ensureNaming(culture);
    const existing = naming.lexemeLists;
    let lists: Record<string, unknown>;
    if (existing === undefined) {
      lists = {};
      naming.lexemeLists = lists;
    } else if (isRecord(existing)) {
      lists = existing as Record<string, unknown>;
    } else {
      diagnostics.push({
        severity: 'error',
        message: `culture "${culture.id}" naming.lexemeLists must be an object`,
        span
      });
      return;
    }
    const id = entry.id;
    if (typeof id !== 'string') {
      diagnostics.push({
        severity: 'error',
        message: 'lexeme_list requires id',
        span
      });
      return;
    }
    if (lists[id]) {
      diagnostics.push({
        severity: 'error',
        message: `Duplicate lexeme_list "${id}" for culture "${culture.id}"`,
        span
      });
      return;
    }
    const payload = { ...entry };
    delete payload.id;
    lists[id] = payload;
  };

  const applyEntries = (
    entries: NamingResourceEntry[],
    key: 'domains' | 'grammars' | 'profiles' | 'lexemeSpecs',
    label: string
  ) => {
    for (const entry of entries) {
      for (const cultureId of entry.cultures) {
        const culture = cultureById.get(cultureId);
        if (!culture) {
          diagnostics.push({
            severity: 'error',
            message: `Unknown culture "${cultureId}" referenced by ${label}`,
            span: entry.span
          });
          continue;
        }
        const payload = { ...entry.item };
        delete payload.cultureId;
        attachArray(culture, key, payload, label, entry.span);
      }
    }
  };

  applyEntries(resources.domains, 'domains', 'domain');
  applyEntries(resources.grammars, 'grammars', 'grammar');
  applyEntries(resources.profiles, 'profiles', 'profile');
  applyEntries(resources.lexemeSpecs, 'lexemeSpecs', 'lexeme_spec');

  for (const entry of resources.lexemeLists) {
    for (const cultureId of entry.cultures) {
      const culture = cultureById.get(cultureId);
      if (!culture) {
        diagnostics.push({
          severity: 'error',
          message: `Unknown culture "${cultureId}" referenced by lexeme_list`,
          span: entry.span
        });
        continue;
      }
      const payload = { ...entry.item };
      delete payload.cultureId;
      attachLexemeList(culture, payload, entry.span);
    }
  }
}

function expandContainers(block: BlockNode, diagnostics: Diagnostic[]): BlockNode[] {
  const alias = CONTAINER_ALIASES[block.name];
  if (!alias) return [block];

  const blocks: BlockNode[] = [];
  for (const stmt of block.body) {
    if (stmt.type === 'block') {
      blocks.push({ ...stmt, name: alias });
    } else if (stmt.type === 'attribute') {
      const inlineBlock = inlineBlockFromAttribute(stmt, diagnostics);
      if (inlineBlock) {
        blocks.push({ ...inlineBlock, name: alias });
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: `Container block "${block.name}" only accepts nested blocks`,
        span: stmt.span
      });
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

function inlineBlockFromAttribute(
  stmt: AttributeNode,
  diagnostics: Diagnostic[]
): BlockNode | null {
  if (!stmt.labels || stmt.labels.length === 0) return null;
  if (!INLINE_ITEM_KEYS.has(stmt.key)) return null;
  if (isObjectValue(stmt.value)) {
    return {
      type: 'block',
      name: stmt.key,
      labels: stmt.labels,
      body: objectValueToStatements(stmt.value),
      span: stmt.span
    };
  }
  if (isArrayValue(stmt.value)) {
    const body = positionalInlineStatements(stmt, diagnostics);
    if (!body) return null;
    return {
      type: 'block',
      name: stmt.key,
      labels: stmt.labels,
      body,
      span: stmt.span
    };
  }
  diagnostics.push({
    severity: 'error',
    message: `Inline ${stmt.key} entries must use key:value pairs or positional fields`,
    span: stmt.span
  });
  return null;
}

function objectValueToStatements(value: ObjectValue): StatementNode[] {
  return value.entries.map((entry) => ({
    type: 'attribute',
    key: entry.key,
    value: entry.value,
    labels: [],
    span: entry.span
  }));
}

function positionalInlineStatements(stmt: AttributeNode, diagnostics: Diagnostic[]): StatementNode[] | null {
  if (!isArrayValue(stmt.value)) return null;
  const items = stmt.value.items;
  if (stmt.key === 'tag') {
    return parseTagInline(items, diagnostics, stmt);
  }
  if (stmt.key === 'relationship_kind') {
    return parseRelationshipKindInline(items, diagnostics, stmt);
  }
  if (stmt.key === 'seed_relationship') {
    return parseSeedRelationshipInline(items, diagnostics, stmt);
  }
  diagnostics.push({
    severity: 'error',
    message: `Inline ${stmt.key} entries must use key:value pairs`,
    span: stmt.span
  });
  return null;
}

function makeAttributeStatement(key: string, value: Value, span: AttributeNode['span']): StatementNode {
  return {
    type: 'attribute',
    key,
    value,
    labels: [],
    span
  };
}

function makeArrayValue(items: Value[], span: AttributeNode['span']): ArrayValue {
  return { type: 'array', items, span };
}

function makeObjectValue(entries: Array<{ key: string; value: Value }>, span: AttributeNode['span']): ObjectValue {
  return {
    type: 'object',
    entries: entries.map((entry) => ({
      key: entry.key,
      value: entry.value,
      span
    })),
    span
  };
}

function ensureArrayValue(
  value: Value | undefined,
  diagnostics: Diagnostic[],
  stmt: AttributeNode,
  label: string
): ArrayValue | null {
  if (!value) {
    diagnostics.push({
      severity: 'error',
      message: `${label} requires a list`,
      span: stmt.span
    });
    return null;
  }
  if (isArrayValue(value)) return value;
  const text = coerceStringValue(value);
  if (text !== null) {
    return makeArrayValue([value], stmt.span);
  }
  diagnostics.push({
    severity: 'error',
    message: `${label} must be a list of identifiers or strings`,
    span: stmt.span
  });
  return null;
}

function parseTagInline(
  items: Value[],
  diagnostics: Diagnostic[],
  stmt: AttributeNode
): StatementNode[] | null {
  if (items.length < 2) {
    diagnostics.push({
      severity: 'error',
      message: 'tag requires category and rarity',
      span: stmt.span
    });
    return null;
  }

  const statements: StatementNode[] = [];
  statements.push(makeAttributeStatement('category', items[0], stmt.span));
  statements.push(makeAttributeStatement('rarity', items[1], stmt.span));

  let index = 2;
  const keywordSet = new Set([
    'kinds',
    'related',
    'conflicts',
    'exclusive',
    'templates',
    'usage',
    'count',
    'axis',
    'framework'
  ]);

  const candidate = items[index];
  if (index < items.length && typeof candidate === 'string' && !keywordSet.has(candidate)) {
    statements.push(makeAttributeStatement('description', candidate, stmt.span));
    index += 1;
  }

  while (index < items.length) {
    const keyword = coerceStringValue(items[index]);
    if (!keyword) {
      diagnostics.push({
        severity: 'error',
        message: 'tag options must be identifiers',
        span: stmt.span
      });
      return null;
    }

    if (keyword === 'axis') {
      statements.push(makeAttributeStatement('isAxis', true, stmt.span));
      index += 1;
      continue;
    }
    if (keyword === 'framework') {
      statements.push(makeAttributeStatement('isFramework', true, stmt.span));
      index += 1;
      continue;
    }

    if (keyword === 'kinds' || keyword === 'related' || keyword === 'conflicts' || keyword === 'exclusive' || keyword === 'templates') {
      const list = ensureArrayValue(items[index + 1], diagnostics, stmt, keyword);
      if (!list) return null;
      const key =
        keyword === 'kinds'
          ? 'entityKinds'
          : keyword === 'related'
            ? 'relatedTags'
            : keyword === 'conflicts'
              ? 'conflictingTags'
              : keyword === 'exclusive'
                ? 'mutuallyExclusiveWith'
                : 'templates';
      statements.push(makeAttributeStatement(key, list, stmt.span));
      index += 2;
      continue;
    }

    if (keyword === 'usage') {
      const next = items[index + 1];
      if (next === undefined) {
        diagnostics.push({
          severity: 'error',
          message: 'usage requires min and max values',
          span: stmt.span
        });
        return null;
      }
      if (isArrayValue(next)) {
        if (next.items.length < 2) {
          diagnostics.push({
            severity: 'error',
            message: 'usage requires min and max values',
            span: stmt.span
          });
          return null;
        }
        statements.push(makeAttributeStatement('minUsage', next.items[0], stmt.span));
        statements.push(makeAttributeStatement('maxUsage', next.items[1], stmt.span));
        index += 2;
        continue;
      }
      const minValue = items[index + 1];
      const maxValue = items[index + 2];
      if (minValue === undefined || maxValue === undefined) {
        diagnostics.push({
          severity: 'error',
          message: 'usage requires min and max values',
          span: stmt.span
        });
        return null;
      }
      statements.push(makeAttributeStatement('minUsage', minValue, stmt.span));
      statements.push(makeAttributeStatement('maxUsage', maxValue, stmt.span));
      index += 3;
      continue;
    }

    if (keyword === 'count') {
      const value = items[index + 1];
      if (value === undefined) {
        diagnostics.push({
          severity: 'error',
          message: 'count requires a value',
          span: stmt.span
        });
        return null;
      }
      statements.push(makeAttributeStatement('usageCount', value, stmt.span));
      index += 2;
      continue;
    }

    diagnostics.push({
      severity: 'error',
      message: `Unknown tag option "${keyword}"`,
      span: stmt.span
    });
    return null;
  }

  return statements;
}

function parseRelationshipKindInline(
  items: Value[],
  diagnostics: Diagnostic[],
  stmt: AttributeNode
): StatementNode[] | null {
  if (items.length < 5) {
    diagnostics.push({
      severity: 'error',
      message: 'relationship_kind requires polarity, decay, cullable flag, src, and dst',
      span: stmt.span
    });
    return null;
  }

  const statements: StatementNode[] = [];
  let index = 0;
  const polaritySet = new Set(['positive', 'neutral', 'negative']);

  const firstLabel = coerceStringValue(items[index]);
  if (typeof items[index] === 'string' || (firstLabel && !polaritySet.has(firstLabel))) {
    statements.push(makeAttributeStatement('description', items[index], stmt.span));
    index += 1;
  }

  const polarity = items[index++];
  const decay = items[index++];
  const cullableToken = items[index++];
  const cullableLabel = coerceStringValue(cullableToken);
  if (!cullableLabel || (cullableLabel !== 'cullable' && cullableLabel !== 'fixed')) {
    diagnostics.push({
      severity: 'error',
      message: 'relationship_kind requires cullable or fixed flag',
      span: stmt.span
    });
    return null;
  }
  statements.push(makeAttributeStatement('polarity', polarity, stmt.span));
  statements.push(makeAttributeStatement('decayRate', decay, stmt.span));
  statements.push(makeAttributeStatement('cullable', cullableLabel === 'cullable', stmt.span));

  const srcKeyword = coerceStringValue(items[index]);
  if (srcKeyword !== 'src') {
    diagnostics.push({
      severity: 'error',
      message: 'relationship_kind requires src list',
      span: stmt.span
    });
    return null;
  }
  const srcList = ensureArrayValue(items[index + 1], diagnostics, stmt, 'src');
  if (!srcList) return null;
  statements.push(makeAttributeStatement('srcKinds', srcList, stmt.span));
  index += 2;

  const dstKeyword = coerceStringValue(items[index]);
  if (dstKeyword !== 'dst') {
    diagnostics.push({
      severity: 'error',
      message: 'relationship_kind requires dst list',
      span: stmt.span
    });
    return null;
  }
  const dstList = ensureArrayValue(items[index + 1], diagnostics, stmt, 'dst');
  if (!dstList) return null;
  statements.push(makeAttributeStatement('dstKinds', dstList, stmt.span));
  index += 2;

  while (index < items.length) {
    const keyword = coerceStringValue(items[index]);
    if (!keyword) {
      diagnostics.push({
        severity: 'error',
        message: 'relationship_kind options must be identifiers',
        span: stmt.span
      });
      return null;
    }
    if (keyword === 'verbs') {
      const formed = items[index + 1];
      const ended = items[index + 2];
      if (formed === undefined || ended === undefined) {
        diagnostics.push({
          severity: 'error',
          message: 'verbs requires formed and ended values',
          span: stmt.span
        });
        return null;
      }
      const verbs = makeObjectValue(
        [
          { key: 'formed', value: formed },
          { key: 'ended', value: ended }
        ],
        stmt.span
      );
      statements.push(makeAttributeStatement('verbs', verbs, stmt.span));
      index += 3;
      continue;
    }
    if (keyword === 'category') {
      const value = items[index + 1];
      if (value === undefined) {
        diagnostics.push({
          severity: 'error',
          message: 'category requires a value',
          span: stmt.span
        });
        return null;
      }
      statements.push(makeAttributeStatement('category', value, stmt.span));
      index += 2;
      continue;
    }
    if (keyword === 'name') {
      const value = items[index + 1];
      if (value === undefined) {
        diagnostics.push({
          severity: 'error',
          message: 'name requires a value',
          span: stmt.span
        });
        return null;
      }
      statements.push(makeAttributeStatement('name', value, stmt.span));
      index += 2;
      continue;
    }
    if (keyword === 'desc') {
      const value = items[index + 1];
      if (value === undefined) {
        diagnostics.push({
          severity: 'error',
          message: 'desc requires a value',
          span: stmt.span
        });
        return null;
      }
      statements.push(makeAttributeStatement('description', value, stmt.span));
      index += 2;
      continue;
    }
    if (keyword === 'symmetric') {
      statements.push(makeAttributeStatement('symmetric', true, stmt.span));
      index += 1;
      continue;
    }
    if (keyword === 'framework') {
      statements.push(makeAttributeStatement('isFramework', true, stmt.span));
      index += 1;
      continue;
    }

    diagnostics.push({
      severity: 'error',
      message: `Unknown relationship_kind option "${keyword}"`,
      span: stmt.span
    });
    return null;
  }

  return statements;
}

function parseSeedRelationshipInline(
  items: Value[],
  diagnostics: Diagnostic[],
  stmt: AttributeNode
): StatementNode[] | null {
  if (items.length === 0) {
    diagnostics.push({
      severity: 'error',
      message: 'seed_relationship requires a strength value',
      span: stmt.span
    });
    return null;
  }

  let index = 0;
  let strength: Value | undefined;
  const keyword = coerceStringValue(items[index]);
  if (keyword === 'strength') {
    strength = items[index + 1];
    index += 2;
  } else {
    strength = items[index];
    index += 1;
  }

  if (strength === undefined) {
    diagnostics.push({
      severity: 'error',
      message: 'seed_relationship requires a strength value',
      span: stmt.span
    });
    return null;
  }

  if (index < items.length) {
    diagnostics.push({
      severity: 'error',
      message: 'seed_relationship only supports a strength value',
      span: stmt.span
    });
    return null;
  }

  return [makeAttributeStatement('strength', strength, stmt.span)];
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

function buildAxisItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const body = buildObjectFromStatements(block.body, diagnostics, block);
  const item = { ...body } as Record<string, unknown>;

  if (block.labels[0]) {
    if (!applyLabelField(item, 'id', block.labels[0], diagnostics, block)) return null;
  }
  if (block.labels[1]) {
    if (!applyLabelField(item, 'name', block.labels[1], diagnostics, block)) return null;
  }

  if (item.low !== undefined && item.lowTag === undefined) {
    item.lowTag = item.low;
    delete item.low;
  }
  if (item.high !== undefined && item.highTag === undefined) {
    item.highTag = item.high;
    delete item.high;
  }

  return item;
}

function buildTagItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const body = buildObjectFromStatements(block.body, diagnostics, block);
  const item = { ...body } as Record<string, unknown>;

  if (block.labels[0]) {
    if (!applyLabelField(item, 'tag', block.labels[0], diagnostics, block)) return null;
  }

  if (item.kinds !== undefined && item.entityKinds === undefined) {
    const normalized = normalizeStringList(item.kinds, diagnostics, block, 'kinds');
    if (!normalized) return null;
    item.entityKinds = normalized;
    delete item.kinds;
  }
  if (item.related !== undefined && item.relatedTags === undefined) {
    const normalized = normalizeStringList(item.related, diagnostics, block, 'related');
    if (!normalized) return null;
    item.relatedTags = normalized;
    delete item.related;
  }
  if (item.conflicts !== undefined && item.conflictingTags === undefined) {
    const normalized = normalizeStringList(item.conflicts, diagnostics, block, 'conflicts');
    if (!normalized) return null;
    item.conflictingTags = normalized;
    delete item.conflicts;
  }
  if (item.exclusive !== undefined && item.mutuallyExclusiveWith === undefined) {
    const normalized = normalizeStringList(item.exclusive, diagnostics, block, 'exclusive');
    if (!normalized) return null;
    item.mutuallyExclusiveWith = normalized;
    delete item.exclusive;
  }
  if (item.axis !== undefined && item.isAxis === undefined) {
    item.isAxis = item.axis;
    delete item.axis;
  }

  return item;
}

function buildRelationshipKindItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const body = buildObjectFromStatements(block.body, diagnostics, block);
  const item = { ...body } as Record<string, unknown>;

  if (block.labels[0]) {
    if (!applyLabelField(item, 'kind', block.labels[0], diagnostics, block)) return null;
  }
  if (block.labels[1]) {
    if (item.description === undefined && item.name === undefined) {
      item.description = block.labels[1];
    } else if (item.description !== undefined) {
      if (!applyLabelField(item, 'description', block.labels[1], diagnostics, block)) return null;
    } else if (item.name !== undefined) {
      if (!applyLabelField(item, 'name', block.labels[1], diagnostics, block)) return null;
    }
  }

  if (item.srcKinds === undefined && item.src !== undefined) {
    const normalized = normalizeKindList(item.src, diagnostics, block, 'src');
    if (!normalized) return null;
    item.srcKinds = normalized;
    delete item.src;
  }

  if (item.dstKinds === undefined && item.dst !== undefined) {
    const normalized = normalizeKindList(item.dst, diagnostics, block, 'dst');
    if (!normalized) return null;
    item.dstKinds = normalized;
    delete item.dst;
  }

  if (item.srcKinds !== undefined && !Array.isArray(item.srcKinds)) {
    const normalized = normalizeKindList(item.srcKinds, diagnostics, block, 'srcKinds');
    if (!normalized) return null;
    item.srcKinds = normalized;
  }

  if (item.dstKinds !== undefined && !Array.isArray(item.dstKinds)) {
    const normalized = normalizeKindList(item.dstKinds, diagnostics, block, 'dstKinds');
    if (!normalized) return null;
    item.dstKinds = normalized;
  }

  return item;
}

function normalizeKindList(
  value: unknown,
  diagnostics: Diagnostic[],
  parent: BlockNode,
  label: string
): string[] | null {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    const items = value.filter((entry) => typeof entry === 'string') as string[];
    if (items.length !== value.length) {
      diagnostics.push({
        severity: 'error',
        message: `${label} must be a list of strings`,
        span: parent.span
      });
      return null;
    }
    return items;
  }
  diagnostics.push({
    severity: 'error',
    message: `${label} must be a string or list of strings`,
    span: parent.span
  });
  return null;
}

function normalizeStringList(
  value: unknown,
  diagnostics: Diagnostic[],
  parent: BlockNode,
  label: string
): string[] | null {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    const items = value.filter((entry) => typeof entry === 'string') as string[];
    if (items.length !== value.length) {
      diagnostics.push({
        severity: 'error',
        message: `${label} must be a list of strings`,
        span: parent.span
      });
      return null;
    }
    return items;
  }
  diagnostics.push({
    severity: 'error',
    message: `${label} must be a string or list of strings`,
    span: parent.span
  });
  return null;
}

function buildSeedEntityItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const item = buildObjectFromStatements(block.body, diagnostics, block);

  if (block.labels[0]) {
    if (!applyLabelField(item, 'id', block.labels[0], diagnostics, block)) return null;
  }

  if (item.coords !== undefined && item.coordinates === undefined) {
    item.coordinates = item.coords;
    delete item.coords;
  }

  if (Array.isArray(item.coordinates)) {
    const [x, y, z] = item.coordinates;
    if ([x, y, z].every((value) => typeof value === 'number')) {
      item.coordinates = { x, y, z };
    } else {
      diagnostics.push({
        severity: 'error',
        message: 'coordinates must be [x y z] numbers',
        span: block.span
      });
      return null;
    }
  }

  if (Array.isArray(item.tags)) {
    const tags: Record<string, boolean> = {};
    for (const entry of item.tags) {
      if (typeof entry !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: 'tags must be a list of identifiers',
          span: block.span
        });
        return null;
      }
      tags[entry] = true;
    }
    item.tags = tags;
  }

  return item;
}

function buildSeedRelationshipItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const body = buildObjectFromStatements(block.body, diagnostics, block);
  const item = { ...body } as Record<string, unknown>;
  const [kindLabel, srcLabel, dstLabel] = block.labels;

  if (kindLabel) {
    if (!applyLabelField(item, 'kind', kindLabel, diagnostics, block)) return null;
  }
  if (srcLabel) {
    if (!applyLabelField(item, 'src', srcLabel, diagnostics, block)) return null;
  }
  if (dstLabel) {
    if (!applyLabelField(item, 'dst', dstLabel, diagnostics, block)) return null;
  }

  if (typeof item.kind !== 'string' || typeof item.src !== 'string' || typeof item.dst !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'seed_relationship requires kind, src, and dst',
      span: block.span
    });
    return null;
  }

  return item;
}

function buildCultureItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const item: Record<string, unknown> = {};
  const axisBiases: Record<string, unknown> = {};
  const homeRegions: Record<string, unknown[]> = {};
  let seenAxisBiases = false;
  let seenHomeRegions = false;

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'naming') {
        diagnostics.push({
          severity: 'error',
          message: 'naming attributes are not allowed; define naming resources at top level',
          span: stmt.span
        });
        continue;
      }
      if (stmt.key === 'axis_bias') {
        const raw = valueToJson(stmt.value, diagnostics, block);
        if (!Array.isArray(raw) || raw.length < 4) {
          diagnostics.push({
            severity: 'error',
            message: 'axis_bias requires kind and x y z values',
            span: stmt.span
          });
          continue;
        }
        const [kind, x, y, z] = raw;
        if (typeof kind !== 'string' || [x, y, z].some((val) => typeof val !== 'number')) {
          diagnostics.push({
            severity: 'error',
            message: 'axis_bias requires kind and numeric x y z values',
            span: stmt.span
          });
          continue;
        }
        seenAxisBiases = true;
        axisBiases[kind] = { x, y, z };
        continue;
      }
      if (stmt.key === 'home_region') {
        const raw = valueToJson(stmt.value, diagnostics, block);
        const normalized = typeof raw === 'string' ? [raw] : raw;
        if (!Array.isArray(normalized) || normalized.length < 1) {
          diagnostics.push({
            severity: 'error',
            message: 'home_region requires kind and at least one region',
            span: stmt.span
          });
          continue;
        }
        const [kind, ...rest] = normalized;
        const regions = rest.flatMap((entry) => Array.isArray(entry) ? entry : [entry]);
        if (typeof kind !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'home_region requires kind and region ids',
            span: stmt.span
          });
          continue;
        }
        if (regions.length === 0) {
          continue;
        }
        if (regions.some((region) => typeof region !== 'string')) {
          diagnostics.push({
            severity: 'error',
            message: 'home_region requires kind and region ids',
            span: stmt.span
          });
          continue;
        }
        seenHomeRegions = true;
        if (!homeRegions[kind]) homeRegions[kind] = [];
        homeRegions[kind].push(...(regions as string[]));
        continue;
      }
      const value = valueToJson(stmt.value, diagnostics, block);
      setObjectValue(item, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'naming') {
        diagnostics.push({
          severity: 'error',
          message: 'naming blocks are not allowed; define domains/grammars/profiles/lexemes at top level',
          span: stmt.span
        });
        continue;
      }
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
      setObjectValue(item, stmt.name, child);
    }
  }

  if (block.labels[0]) {
    if (!applyLabelField(item, 'id', block.labels[0], diagnostics, block)) return null;
  }
  if (block.labels[1]) {
    if (!applyLabelField(item, 'name', block.labels[1], diagnostics, block)) return null;
  }

  if (seenAxisBiases) {
    if (isRecord(item.axisBiases)) {
      Object.assign(item.axisBiases, axisBiases);
    } else {
      item.axisBiases = axisBiases;
    }
  }
  if (seenHomeRegions) {
    if (isRecord(item.homeRegions)) {
      Object.assign(item.homeRegions, homeRegions);
    } else {
      item.homeRegions = homeRegions;
    }
  }

  return item;
}

function buildNamingDomain(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const domain: Record<string, unknown> = {};

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'culture' || stmt.key === 'culture_id') {
        const ref = parseResourceReferenceValue(stmt.value, diagnostics, block, 'culture', {
          allowArray: true,
          allowedTypes: ['culture']
        });
        if (ref !== null) {
          domain.cultureId = ref;
        }
        continue;
      }
      const value = valueToJson(stmt.value, diagnostics, block);
      if (stmt.key === 'phonology' && isRecord(value)) {
        domain.phonology = value;
        continue;
      }
      if (stmt.key === 'morphology' && isRecord(value)) {
        domain.morphology = value;
        continue;
      }
      if (stmt.key === 'style' && isRecord(value)) {
        domain.style = value;
        continue;
      }
      setObjectValue(domain, stmt.key, value);
      continue;
    }
    if (stmt.type === 'block') {
      if (stmt.name === 'culture') {
        diagnostics.push({
          severity: 'error',
          message: 'culture reference must use "<name>.id" (no nested culture blocks)',
          span: stmt.span
        });
        continue;
      }
      if (stmt.name === 'phonology') {
        domain.phonology = buildPhonologyFromStatements(stmt.body, diagnostics, stmt);
        continue;
      }
      if (stmt.name === 'morphology') {
        domain.morphology = buildMorphologyFromStatements(stmt.body, diagnostics, stmt);
        continue;
      }
      if (stmt.name === 'style') {
        domain.style = buildStyleRulesFromStatements(stmt.body, diagnostics, stmt);
        continue;
      }
      const child = buildObjectFromStatements(stmt.body, diagnostics, stmt);
      setObjectValue(domain, stmt.name, child);
    }
  }

  if (!applyLabelField(domain, 'id', block.labels[0], diagnostics, block)) return null;
  return domain;
}

function buildPhonologyFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const phonology: Record<string, unknown> = {};

  for (const stmt of statements) {
    if (stmt.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: 'phonology block only supports attributes',
        span: stmt.span
      });
      continue;
    }
    const value = valueToJson(stmt.value, diagnostics, parent);
    if (stmt.key === 'length' && Array.isArray(value) && value.length >= 2) {
      phonology.lengthRange = [value[0], value[1]];
      continue;
    }
    if (stmt.key === 'templates') {
      phonology.syllableTemplates = value;
      continue;
    }
    if (stmt.key === 'favored_clusters') {
      phonology.favoredClusters = value;
      continue;
    }
    if (stmt.key === 'forbidden_clusters') {
      phonology.forbiddenClusters = value;
      continue;
    }
    if (stmt.key === 'favored_cluster_boost') {
      phonology.favoredClusterBoost = value;
      continue;
    }
    if (stmt.key === 'consonant_weights') {
      phonology.consonantWeights = value;
      continue;
    }
    if (stmt.key === 'vowel_weights') {
      phonology.vowelWeights = value;
      continue;
    }
    if (stmt.key === 'template_weights') {
      phonology.templateWeights = value;
      continue;
    }
    if (stmt.key === 'max_cluster') {
      phonology.maxConsonantCluster = value;
      continue;
    }
    if (stmt.key === 'min_vowel_spacing') {
      phonology.minVowelSpacing = value;
      continue;
    }
    if (stmt.key === 'sonority') {
      phonology.sonorityRanks = value;
      continue;
    }
    setObjectValue(phonology, stmt.key, value);
  }

  return phonology;
}

function buildMorphologyFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const morphology: Record<string, unknown> = {};

  for (const stmt of statements) {
    if (stmt.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: 'morphology block only supports attributes',
        span: stmt.span
      });
      continue;
    }
    const value = valueToJson(stmt.value, diagnostics, parent);
    if (stmt.key === 'word_roots') {
      morphology.wordRoots = value;
      continue;
    }
    if (stmt.key === 'prefix_weights') {
      morphology.prefixWeights = value;
      continue;
    }
    if (stmt.key === 'suffix_weights') {
      morphology.suffixWeights = value;
      continue;
    }
    if (stmt.key === 'structure_weights') {
      morphology.structureWeights = value;
      continue;
    }
    setObjectValue(morphology, stmt.key, value);
  }

  return morphology;
}

function buildStyleRulesFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const style: Record<string, unknown> = {};

  for (const stmt of statements) {
    if (stmt.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: 'style block only supports attributes',
        span: stmt.span
      });
      continue;
    }
    const value = valueToJson(stmt.value, diagnostics, parent);
    if (stmt.key === 'apostrophe_rate') {
      style.apostropheRate = value;
      continue;
    }
    if (stmt.key === 'hyphen_rate') {
      style.hyphenRate = value;
      continue;
    }
    if (stmt.key === 'preferred_endings') {
      style.preferredEndings = value;
      continue;
    }
    if (stmt.key === 'preferred_ending_boost') {
      style.preferredEndingBoost = value;
      continue;
    }
    if (stmt.key === 'rhythm_bias') {
      style.rhythmBias = value;
      continue;
    }
    if (stmt.key === 'target_length') {
      style.targetLength = value;
      continue;
    }
    if (stmt.key === 'length_tolerance') {
      style.lengthTolerance = value;
      continue;
    }
    setObjectValue(style, stmt.key, value);
  }

  return style;
}

function buildLexemeList(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const list: Record<string, unknown> = {};
  const entries: string[] = [];
  let seenEntries = false;

  for (const stmt of block.body) {
    if (stmt.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: 'lexeme_list only supports attributes',
        span: stmt.span
      });
      continue;
    }
    if (stmt.key === 'culture' || stmt.key === 'culture_id') {
      const ref = parseResourceReferenceValue(stmt.value, diagnostics, block, 'culture', {
        allowArray: true,
        allowedTypes: ['culture']
      });
      if (ref !== null) {
        list.cultureId = ref;
      }
      continue;
    }
    if (stmt.key === 'entry') {
      const value = valueToJson(stmt.value, diagnostics, block);
      seenEntries = true;
      if (typeof value === 'string') {
        entries.push(value);
      } else if (Array.isArray(value)) {
        for (const entry of value) {
          if (typeof entry !== 'string') {
            diagnostics.push({
              severity: 'error',
              message: 'entry values must be strings',
              span: stmt.span
            });
            return null;
          }
          entries.push(entry);
        }
      } else {
        diagnostics.push({
          severity: 'error',
          message: 'entry values must be strings',
          span: stmt.span
        });
        return null;
      }
      continue;
    }
    const value = valueToJson(stmt.value, diagnostics, block);
    if (stmt.key === 'entries') {
      seenEntries = true;
      if (!Array.isArray(value)) {
        diagnostics.push({
          severity: 'error',
          message: 'entries must be a list of strings',
          span: stmt.span
        });
        return null;
      }
      for (const entry of value) {
        if (typeof entry !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'entries must be a list of strings',
            span: stmt.span
          });
          return null;
        }
        entries.push(entry);
      }
      continue;
    }
    setObjectValue(list, stmt.key, value);
  }

  if (!applyLabelField(list, 'id', block.labels[0], diagnostics, block)) return null;
  if (seenEntries) list.entries = entries;
  return list;
}

function buildLexemeSpec(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const spec: Record<string, unknown> = {};

  for (const stmt of block.body) {
    if (stmt.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: 'lexeme_spec only supports attributes',
        span: stmt.span
      });
      continue;
    }
    if (stmt.key === 'culture' || stmt.key === 'culture_id') {
      const ref = parseResourceReferenceValue(stmt.value, diagnostics, block, 'culture', {
        allowArray: true,
        allowedTypes: ['culture']
      });
      if (ref !== null) {
        spec.cultureId = ref;
      }
      continue;
    }
    const value = valueToJson(stmt.value, diagnostics, block);
    if (stmt.key === 'target') {
      spec.targetCount = value;
      continue;
    }
    if (stmt.key === 'quality' && Array.isArray(value) && value.length >= 2) {
      spec.qualityFilter = { minLength: value[0], maxLength: value[1] };
      continue;
    }
    if (stmt.key === 'max_words') {
      spec.maxWords = value;
      continue;
    }
    if (stmt.key === 'word_style') {
      spec.wordStyle = value;
      continue;
    }
    setObjectValue(spec, stmt.key, value);
  }

  if (!applyLabelField(spec, 'id', block.labels[0], diagnostics, block)) return null;
  return spec;
}

function buildGrammarFromBlock(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const grammar: Record<string, unknown> = {};
  const rules: Record<string, string[][]> = {};
  let seenRules = false;

  for (const stmt of block.body) {
    if (stmt.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: 'grammar only supports attributes',
        span: stmt.span
      });
      continue;
    }
    if (stmt.key === 'culture' || stmt.key === 'culture_id') {
      const ref = parseResourceReferenceValue(stmt.value, diagnostics, block, 'culture', {
        allowArray: true,
        allowedTypes: ['culture']
      });
      if (ref !== null) {
        grammar.cultureId = ref;
      }
      continue;
    }
    if (stmt.key === 'rule') {
      const raw = valueToJson(stmt.value, diagnostics, block);
      if (!Array.isArray(raw) || raw.length < 2) {
        diagnostics.push({
          severity: 'error',
          message: 'rule requires name and tokens',
          span: stmt.span
        });
        return null;
      }
      const [name, ...rest] = raw;
      if (typeof name !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: 'rule name must be a string',
          span: stmt.span
        });
        return null;
      }
      let tokens: unknown[] = rest;
      if (rest.length === 1 && Array.isArray(rest[0])) {
        tokens = rest[0] as unknown[];
      }
      const parsed: string[] = [];
      for (const token of tokens) {
        if (typeof token !== 'string') {
          diagnostics.push({
            severity: 'error',
            message: 'rule tokens must be strings',
            span: stmt.span
          });
          return null;
        }
        parsed.push(token);
      }
      if (!rules[name]) rules[name] = [];
      rules[name].push(parsed);
      seenRules = true;
      continue;
    }
    const value = valueToJson(stmt.value, diagnostics, block);
    if (stmt.key === 'rules' && isRecord(value)) {
      Object.assign(rules, value);
      seenRules = true;
      continue;
    }
    setObjectValue(grammar, stmt.key, value);
  }

  if (!applyLabelField(grammar, 'id', block.labels[0], diagnostics, block)) return null;
  if (seenRules) grammar.rules = rules;
  return grammar;
}

function buildNamingFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const naming: Record<string, unknown> = {};
  const domains: Record<string, unknown>[] = [];
  const grammars: Record<string, unknown>[] = [];
  const profiles: Record<string, unknown>[] = [];
  const lexemeSpecs: Record<string, unknown>[] = [];
  const lexemeLists: Record<string, unknown> = {};
  let seenDomains = false;
  let seenGrammars = false;
  let seenProfiles = false;
  let seenLexemeSpecs = false;
  let seenLexemeLists = false;

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      const value = valueToJson(stmt.value, diagnostics, parent);
      if (stmt.key === 'domains' && Array.isArray(value)) {
        seenDomains = true;
        domains.push(...(value as Record<string, unknown>[]));
        continue;
      }
      if (stmt.key === 'grammars' && Array.isArray(value)) {
        seenGrammars = true;
        grammars.push(...(value as Record<string, unknown>[]));
        continue;
      }
      if (stmt.key === 'profiles' && Array.isArray(value)) {
        seenProfiles = true;
        profiles.push(...(value as Record<string, unknown>[]));
        continue;
      }
      if (stmt.key === 'lexemeSpecs' && Array.isArray(value)) {
        seenLexemeSpecs = true;
        lexemeSpecs.push(...(value as Record<string, unknown>[]));
        continue;
      }
      if (stmt.key === 'lexemeLists' && isRecord(value)) {
        seenLexemeLists = true;
        Object.assign(lexemeLists, value);
        continue;
      }
      setObjectValue(naming, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'domain') {
        seenDomains = true;
        const domain = buildNamingDomain(stmt, diagnostics);
        if (!domain) continue;
        domains.push(domain);
        continue;
      }
      if (stmt.name === 'lexeme_list' || stmt.name === 'lexeme') {
        seenLexemeLists = true;
        const lexeme = buildLexemeList(stmt, diagnostics);
        if (!lexeme) continue;
        if (lexemeLists[lexeme.id as string]) {
          diagnostics.push({
            severity: 'error',
            message: `Duplicate lexeme list "${lexeme.id}"`,
            span: stmt.span
          });
          continue;
        }
        lexemeLists[lexeme.id as string] = lexeme;
        continue;
      }
      if (stmt.name === 'lexeme_spec') {
        seenLexemeSpecs = true;
        const spec = buildLexemeSpec(stmt, diagnostics);
        if (!spec) continue;
        lexemeSpecs.push(spec);
        continue;
      }
      if (stmt.name === 'grammar') {
        seenGrammars = true;
        const grammar = buildGrammarFromBlock(stmt, diagnostics);
        if (!grammar) continue;
        grammars.push(grammar);
        continue;
      }
      if (stmt.name === 'profile') {
        seenProfiles = true;
        const profile = buildNamingProfile(stmt, diagnostics);
        if (profile) profiles.push(profile);
        continue;
      }
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
      setObjectValue(naming, stmt.name, child);
    }
  }

  if (seenDomains) naming.domains = domains;
  if (seenGrammars) naming.grammars = grammars;
  if (seenProfiles) naming.profiles = profiles;
  if (seenLexemeSpecs) naming.lexemeSpecs = lexemeSpecs;
  if (seenLexemeLists) naming.lexemeLists = lexemeLists;

  return naming;
}

function buildNamingProfile(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const profile: Record<string, unknown> = {};
  const strategyGroups: Record<string, unknown>[] = [];
  let seenStrategyGroups = false;

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'culture' || stmt.key === 'culture_id') {
        const ref = parseResourceReferenceValue(stmt.value, diagnostics, block, 'culture', {
          allowArray: true,
          allowedTypes: ['culture']
        });
        if (ref !== null) {
          profile.cultureId = ref;
        }
        continue;
      }
      const value = valueToJson(stmt.value, diagnostics, block);
      if (stmt.key === 'strategyGroups' && Array.isArray(value)) {
        seenStrategyGroups = true;
        strategyGroups.push(...(value as Record<string, unknown>[]));
        continue;
      }
      setObjectValue(profile, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'strategy_group' || stmt.name === 'strategyGroup') {
        seenStrategyGroups = true;
        const group = buildStrategyGroup(stmt, diagnostics);
        if (group) strategyGroups.push(group);
        continue;
      }
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
      setObjectValue(profile, stmt.name, child);
    }
  }

  if (block.labels[0]) {
    if (!applyLabelField(profile, 'id', block.labels[0], diagnostics, block)) return null;
  }
  if (block.labels[1]) {
    if (!applyLabelField(profile, 'name', block.labels[1], diagnostics, block)) return null;
  }
  if (seenStrategyGroups) {
    profile.strategyGroups = strategyGroups;
  }

  return profile;
}

function buildStrategyGroup(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const group: Record<string, unknown> = {};
  const strategies: Record<string, unknown>[] = [];
  let seenStrategies = false;

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'strategy' && stmt.labels && stmt.labels.length > 0) {
        seenStrategies = true;
        const strategy = buildStrategyFromAttribute(stmt, diagnostics, block);
        if (strategy) strategies.push(strategy);
        continue;
      }
      const value = valueToJson(stmt.value, diagnostics, block);
      if (stmt.key === 'conditions') {
        group.conditions = value;
        continue;
      }
      setObjectValue(group, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'conditions') {
        group.conditions = buildObjectFromStatements(stmt.body, diagnostics, stmt);
        continue;
      }
      if (stmt.name === 'strategy') {
        seenStrategies = true;
        const strategy = buildStrategyFromBlock(stmt, diagnostics);
        if (strategy) strategies.push(strategy);
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: `Unsupported strategy group block "${stmt.name}"`,
        span: stmt.span
      });
    }
  }

  if (block.labels[0]) {
    if (!applyLabelField(group, 'name', block.labels[0], diagnostics, block)) return null;
  }
  if (seenStrategies) {
    group.strategies = strategies;
  }

  return group;
}

function buildStrategyFromAttribute(
  stmt: AttributeNode,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const strategy: Record<string, unknown> = {};
  const typeLabel = stmt.labels?.[0];
  const idLabel = stmt.labels?.[1];
  if (!typeLabel || typeof typeLabel !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'strategy requires a type label',
      span: stmt.span
    });
    return null;
  }

  const value = valueToJson(stmt.value, diagnostics, parent);
  if (isRecord(value)) {
    Object.assign(strategy, value);
  }

  strategy.type = typeLabel;
  if (typeLabel === 'grammar') {
    const resolved = parseResourceReferenceLabel(idLabel, diagnostics, stmt.span, 'grammar', ['grammar']);
    if (!resolved) return null;
    strategy.grammarId = resolved;
  } else if (typeLabel === 'phonotactic') {
    const resolved = parseResourceReferenceLabel(idLabel, diagnostics, stmt.span, 'domain', ['domain']);
    if (!resolved) return null;
    strategy.domainId = resolved;
  }

  if (strategy.weight === undefined) {
    diagnostics.push({
      severity: 'error',
      message: 'strategy requires explicit weight',
      span: stmt.span
    });
    return null;
  }

  return strategy;
}

function buildStrategyFromBlock(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const strategy = buildObjectFromStatements(block.body, diagnostics, block);
  const typeLabel = block.labels[0];
  const idLabel = block.labels[1];

  if (!typeLabel) {
    diagnostics.push({
      severity: 'error',
      message: 'strategy requires a type label',
      span: block.span
    });
    return null;
  }

  strategy.type = typeLabel;
  if (typeLabel === 'grammar') {
    const resolved = parseResourceReferenceLabel(idLabel, diagnostics, block.span, 'grammar', ['grammar']);
    if (!resolved) return null;
    strategy.grammarId = resolved;
  } else if (typeLabel === 'phonotactic') {
    const resolved = parseResourceReferenceLabel(idLabel, diagnostics, block.span, 'domain', ['domain']);
    if (!resolved) return null;
    strategy.domainId = resolved;
  }

  if (strategy.weight === undefined) {
    diagnostics.push({
      severity: 'error',
      message: 'strategy requires explicit weight',
      span: block.span
    });
    return null;
  }

  return strategy;
}

function buildEntityKindItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const item: Record<string, unknown> = {};
  const subtypes: Record<string, unknown>[] = [];
  const statuses: Record<string, unknown>[] = [];
  const requiredRelationships: Record<string, unknown>[] = [];
  let seenSubtypes = false;
  let seenStatuses = false;
  let seenRequired = false;

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'subtype') {
        seenSubtypes = true;
        const subtype = buildSubtypeFromPositional(stmt, diagnostics, block);
        if (subtype) subtypes.push(subtype);
        continue;
      }
      if (stmt.key === 'status') {
        seenStatuses = true;
        const status = buildStatusFromPositional(stmt, diagnostics, block);
        if (status) statuses.push(status);
        continue;
      }
      if (stmt.key === 'required') {
        seenRequired = true;
        const rule = buildRequiredRelationshipFromPositional(stmt, diagnostics, block);
        if (rule) requiredRelationships.push(rule);
        continue;
      }
      if (stmt.key === 'style') {
        const style = buildStyleFromValue(stmt.value, diagnostics, block);
        if (style) {
          item.style = style;
        }
        continue;
      }
      const value = valueToJson(stmt.value, diagnostics, block);
      if (stmt.key === 'subtypes') {
        seenSubtypes = true;
        if (Array.isArray(value)) subtypes.push(...(value as Record<string, unknown>[]));
        else item.subtypes = value;
        continue;
      }
      if (stmt.key === 'statuses') {
        seenStatuses = true;
        if (Array.isArray(value)) statuses.push(...(value as Record<string, unknown>[]));
        else item.statuses = value;
        continue;
      }
      if (stmt.key === 'requiredRelationships') {
        seenRequired = true;
        if (Array.isArray(value)) requiredRelationships.push(...(value as Record<string, unknown>[]));
        else item.requiredRelationships = value;
        continue;
      }
      if (stmt.key === 'semanticPlane' || stmt.key === 'semantic_plane') {
        item.semanticPlane = value;
        continue;
      }
      setObjectValue(item, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'subtypes') {
        seenSubtypes = true;
        subtypes.push(...buildSubtypesFromStatements(stmt.body, diagnostics, stmt));
        continue;
      }
      if (stmt.name === 'statuses') {
        seenStatuses = true;
        statuses.push(...buildStatusesFromStatements(stmt.body, diagnostics, stmt));
        continue;
      }
      if (stmt.name === 'required_relationships' || stmt.name === 'requiredRelationships') {
        seenRequired = true;
        requiredRelationships.push(...buildRequiredRelationshipsFromStatements(stmt.body, diagnostics, stmt));
        continue;
      }
      if (stmt.name === 'semantic_plane' || stmt.name === 'semanticPlane') {
        item.semanticPlane = buildSemanticPlaneFromStatements(stmt.body, diagnostics, stmt);
        continue;
      }
      if (stmt.name === 'style') {
        item.style = buildObjectFromStatements(stmt.body, diagnostics, stmt);
        continue;
      }
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
      setObjectValue(item, stmt.name, child);
    }
  }

  if (block.labels[0]) {
    if (!applyLabelField(item, 'kind', block.labels[0], diagnostics, block)) return null;
  }
  if (seenSubtypes) {
    item.subtypes = subtypes;
  }
  if (seenStatuses) {
    item.statuses = statuses;
  }
  if (seenRequired) {
    item.requiredRelationships = requiredRelationships;
  }

  return item;
}

function buildSubtypesFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown>[] {
  const subtypes: Record<string, unknown>[] = [];

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      const value = valueToJson(stmt.value, diagnostics, parent);
      const subtype = buildSubtypeFromValue(stmt.key, value, diagnostics, parent);
      if (subtype) subtypes.push(subtype);
      continue;
    }
    if (stmt.type === 'block' && stmt.name === 'subtype') {
      const subtype = buildObjectFromStatements(stmt.body, diagnostics, stmt);
      if (!applyLabelField(subtype, 'id', stmt.labels[0], diagnostics, stmt)) continue;
      if (stmt.labels[1]) {
        if (!applyLabelField(subtype, 'name', stmt.labels[1], diagnostics, stmt)) continue;
      }
      normalizeSubtypeFields(subtype);
      if (!ensureNameField(subtype, diagnostics, stmt)) continue;
      subtypes.push(subtype);
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: 'subtypes block only supports subtype entries',
      span: stmt.span
    });
  }

  return subtypes;
}

function buildSubtypeFromPositional(
  stmt: AttributeNode,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const raw = valueToJson(stmt.value, diagnostics, parent);
  if (!Array.isArray(raw) || raw.length < 2) {
    diagnostics.push({
      severity: 'error',
      message: 'subtype requires id and name',
      span: stmt.span
    });
    return null;
  }
  const [id, name, ...rest] = raw;
  if (typeof id !== 'string' || typeof name !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'subtype id and name must be strings',
      span: stmt.span
    });
    return null;
  }
  const subtype: Record<string, unknown> = { id, name };
  for (const entry of rest) {
    if (entry === 'authority') {
      subtype.isAuthority = true;
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: `Unknown subtype flag "${String(entry)}"`,
      span: stmt.span
    });
    return null;
  }
  return subtype;
}

function buildSubtypeFromValue(
  id: string,
  value: unknown,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  if (typeof value === 'string') {
    return { id, name: value };
  }
  if (isRecord(value)) {
    const subtype: Record<string, unknown> = { id, ...value };
    normalizeSubtypeFields(subtype);
    if (!ensureNameField(subtype, diagnostics, parent)) return null;
    return subtype;
  }
  diagnostics.push({
    severity: 'error',
    message: 'subtype entries must be a string or object',
    span: parent.span
  });
  return null;
}

function normalizeSubtypeFields(subtype: Record<string, unknown>): void {
  if (subtype.authority !== undefined && subtype.isAuthority === undefined) {
    subtype.isAuthority = subtype.authority;
    delete subtype.authority;
  }
}

function buildStatusesFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown>[] {
  const statuses: Record<string, unknown>[] = [];

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      const value = valueToJson(stmt.value, diagnostics, parent);
      const status = buildStatusFromValue(stmt.key, value, diagnostics, parent);
      if (status) statuses.push(status);
      continue;
    }
    if (stmt.type === 'block' && stmt.name === 'status') {
      const status = buildObjectFromStatements(stmt.body, diagnostics, stmt);
      if (!applyLabelField(status, 'id', stmt.labels[0], diagnostics, stmt)) continue;
      if (stmt.labels[1]) {
        if (!applyLabelField(status, 'name', stmt.labels[1], diagnostics, stmt)) continue;
      }
      normalizeStatusFields(status);
      if (!ensureNameField(status, diagnostics, stmt)) continue;
      if (status.isTerminal === undefined) {
        status.isTerminal = false;
      }
      statuses.push(status);
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: 'statuses block only supports status entries',
      span: stmt.span
    });
  }

  return statuses;
}

function buildStatusFromPositional(
  stmt: AttributeNode,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const raw = valueToJson(stmt.value, diagnostics, parent);
  if (!Array.isArray(raw) || raw.length < 3) {
    diagnostics.push({
      severity: 'error',
      message: 'status requires id, name, and polarity',
      span: stmt.span
    });
    return null;
  }
  const [id, name, polarity, ...rest] = raw;
  if (typeof id !== 'string' || typeof name !== 'string' || typeof polarity !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'status id, name, and polarity must be strings',
      span: stmt.span
    });
    return null;
  }
  const status: Record<string, unknown> = {
    id,
    name,
    polarity,
    isTerminal: false
  };
  let index = 0;
  if (index < rest.length && typeof rest[index] === 'string' && rest[index] !== 'terminal') {
    status.transitionVerb = rest[index];
    index += 1;
  }
  for (const entry of rest.slice(index)) {
    if (entry === 'terminal') {
      status.isTerminal = true;
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: `Unknown status flag "${String(entry)}"`,
      span: stmt.span
    });
    return null;
  }
  return status;
}

function buildStatusFromValue(
  id: string,
  value: unknown,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  if (typeof value === 'string') {
    return { id, name: value, isTerminal: false };
  }
  if (isRecord(value)) {
    const status: Record<string, unknown> = { id, ...value };
    normalizeStatusFields(status);
    if (status.isTerminal === undefined) {
      status.isTerminal = false;
    }
    if (!ensureNameField(status, diagnostics, parent)) return null;
    return status;
  }
  diagnostics.push({
    severity: 'error',
    message: 'status entries must be a string or object',
    span: parent.span
  });
  return null;
}

function normalizeStatusFields(status: Record<string, unknown>): void {
  if (status.terminal !== undefined && status.isTerminal === undefined) {
    status.isTerminal = status.terminal;
    delete status.terminal;
  }
}

function ensureNameField(
  item: Record<string, unknown>,
  diagnostics: Diagnostic[],
  parent: BlockNode
): boolean {
  if (typeof item.name === 'string' && item.name.length > 0) {
    return true;
  }
  diagnostics.push({
    severity: 'error',
    message: 'entry requires a name',
    span: parent.span
  });
  return false;
}

function buildRequiredRelationshipsFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown>[] {
  const rules: Record<string, unknown>[] = [];

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      const value = valueToJson(stmt.value, diagnostics, parent);
      if (typeof value === 'string') {
        rules.push({ kind: stmt.key, description: value });
        continue;
      }
      if (value === null || value === undefined) {
        rules.push({ kind: stmt.key });
        continue;
      }
      if (isRecord(value)) {
        rules.push({ kind: stmt.key, ...value });
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: 'required relationship entries must be a string or object',
        span: stmt.span
      });
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: 'required_relationships block only supports relationship entries',
      span: stmt.span
    });
  }

  return rules;
}

function buildRequiredRelationshipFromPositional(
  stmt: AttributeNode,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const raw = valueToJson(stmt.value, diagnostics, parent);
  if (!Array.isArray(raw) || raw.length === 0) {
    diagnostics.push({
      severity: 'error',
      message: 'required requires a relationship kind',
      span: stmt.span
    });
    return null;
  }
  const [kind, description] = raw;
  if (typeof kind !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'required relationship kind must be a string',
      span: stmt.span
    });
    return null;
  }
  const rule: Record<string, unknown> = { kind };
  if (description !== undefined) {
    if (typeof description !== 'string') {
      diagnostics.push({
        severity: 'error',
        message: 'required relationship description must be a string',
        span: stmt.span
      });
      return null;
    }
    rule.description = description;
  }
  return rule;
}

function buildStyleFromValue(
  value: Value,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const raw = valueToJson(value, diagnostics, parent);
  if (raw === null || raw === undefined) return null;
  if (isRecord(raw)) {
    return { ...raw };
  }
  if (typeof raw === 'string') {
    return { color: raw };
  }
  if (Array.isArray(raw)) {
    if (raw.length === 1 && typeof raw[0] === 'string') {
      return { color: raw[0] };
    }
    const style: Record<string, unknown> = {};
    for (let i = 0; i < raw.length; i += 2) {
      const key = raw[i];
      const val = raw[i + 1];
      if (typeof key !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: 'style keys must be strings',
          span: parent.span
        });
        return null;
      }
      if (val === undefined) {
        diagnostics.push({
          severity: 'error',
          message: `style value missing for "${key}"`,
          span: parent.span
        });
        return null;
      }
      if (key === 'name' || key === 'display') {
        style.displayName = val;
      } else {
        style[key] = val;
      }
    }
    return style;
  }
  diagnostics.push({
    severity: 'error',
    message: 'style must be a string, list, or object',
    span: parent.span
  });
  return null;
}

function buildSemanticPlaneFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const plane: Record<string, unknown> = {};
  const axes: Record<string, unknown> = {};
  const regions: Record<string, unknown>[] = [];

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'axes') {
        if (isObjectValue(stmt.value)) {
          for (const entry of stmt.value.entries) {
            if (entry.key !== 'x' && entry.key !== 'y' && entry.key !== 'z') {
              diagnostics.push({
                severity: 'error',
                message: 'axes object must use x, y, z keys',
                span: entry.span
              });
              continue;
            }
            const axisId = parseResourceReferenceValue(entry.value, diagnostics, parent, 'axis', {
              allowedTypes: ['axis']
            });
            if (!axisId || Array.isArray(axisId)) continue;
            axes[entry.key] = { axisId };
          }
          continue;
        }
        if (isArrayValue(stmt.value)) {
          const parsed = parseAxesList(stmt.value.items, diagnostics, parent);
          if (parsed) Object.assign(axes, parsed);
          continue;
        }
      }
      if (stmt.key === 'regions') {
        const value = valueToJson(stmt.value, diagnostics, parent);
        if (Array.isArray(value)) {
          regions.push(...(value as Record<string, unknown>[]));
          continue;
        }
      }
      if (stmt.key === 'x' || stmt.key === 'y' || stmt.key === 'z') {
        const axisId = parseResourceReferenceValue(stmt.value, diagnostics, parent, 'axis', {
          allowedTypes: ['axis']
        });
        if (axisId && !Array.isArray(axisId)) {
          axes[stmt.key] = { axisId };
        }
        continue;
      }
      if (stmt.key === 'axis' && stmt.labels && stmt.labels.length >= 2) {
        const [axisKey, axisId] = stmt.labels;
        if (axisKey === 'x' || axisKey === 'y' || axisKey === 'z') {
          const resolved = parseResourceReferenceLabel(axisId, diagnostics, stmt.span, 'axis', ['axis']);
          if (resolved) {
            axes[axisKey] = { axisId: resolved };
          }
          continue;
        }
      }
      diagnostics.push({
        severity: 'error',
        message: `Unsupported semantic_plane attribute "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }

    if (stmt.type === 'block') {
      if (stmt.name === 'axes') {
        Object.assign(axes, buildAxesFromStatements(stmt.body, diagnostics, stmt));
        continue;
      }
      if (stmt.name === 'regions') {
        regions.push(...buildRegionsFromStatements(stmt.body, diagnostics, stmt));
        continue;
      }
      if (stmt.name === 'region') {
        const region = buildRegionFromBlock(stmt, diagnostics);
        if (region) regions.push(region);
        continue;
      }
      if (stmt.name === 'axis') {
        const axisKey = stmt.labels[0];
        const axisId = stmt.labels[1];
        if ((axisKey === 'x' || axisKey === 'y' || axisKey === 'z') && axisId) {
          const resolved = parseResourceReferenceLabel(axisId, diagnostics, stmt.span, 'axis', ['axis']);
          if (resolved) {
            axes[axisKey] = { axisId: resolved };
          }
          continue;
        }
      }
      diagnostics.push({
        severity: 'error',
        message: `Unsupported semantic_plane block "${stmt.name}"`,
        span: stmt.span
      });
    }
  }

  normalizeAxisRefs(axes);
  plane.axes = axes;
  plane.regions = regions;
  return plane;
}

function normalizeAxisRefs(axes: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(axes)) {
    if (typeof value === 'string') {
      axes[key] = { axisId: value };
    }
  }
}

function parseAxesList(
  value: Value[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const axes: Record<string, unknown> = {};
  const items = value.map((item) => coerceStringValue(item));
  if (items.some((item) => item === null)) {
    diagnostics.push({
      severity: 'error',
      message: 'axes must use identifiers',
      span: parent.span
    });
    return null;
  }
  const tokens = items as string[];

  if (tokens.length >= 6 && tokens.length % 2 === 0) {
    for (let i = 0; i < tokens.length; i += 2) {
      const axisKey = tokens[i];
      const axisId = tokens[i + 1];
      if (axisKey !== 'x' && axisKey !== 'y' && axisKey !== 'z') {
        diagnostics.push({
          severity: 'error',
          message: 'axes list must use x, y, z keys',
          span: parent.span
        });
        return null;
      }
      if (!axisId) {
        diagnostics.push({
          severity: 'error',
          message: 'axes ids must use "<name>.id"',
          span: parent.span
        });
        return null;
      }
      const resolved = parseResourceReferenceString(axisId, diagnostics, parent.span, 'axis', ['axis']);
      if (!resolved) return null;
      axes[axisKey] = resolved;
    }
    return axes;
  }

  if (tokens.length >= 2) {
    const [x, y, z] = tokens;
    if (!x || !y) {
      diagnostics.push({
        severity: 'error',
        message: 'axes ids must use "<name>.id"',
        span: parent.span
      });
      return null;
    }
    const resolvedX = parseResourceReferenceString(x, diagnostics, parent.span, 'axis', ['axis']);
    const resolvedY = parseResourceReferenceString(y, diagnostics, parent.span, 'axis', ['axis']);
    if (!resolvedX || !resolvedY) return null;
    axes.x = resolvedX;
    axes.y = resolvedY;
    if (z !== undefined) {
      const resolvedZ = parseResourceReferenceString(z, diagnostics, parent.span, 'axis', ['axis']);
      if (!resolvedZ) return null;
      axes.z = resolvedZ;
    }
    return axes;
  }

  diagnostics.push({
    severity: 'error',
    message: 'axes requires at least x and y',
    span: parent.span
  });
  return null;
}

function buildAxesFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const axes: Record<string, unknown> = {};

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'axis' && stmt.labels && stmt.labels.length >= 2) {
        const [axisKey, axisId] = stmt.labels;
        if (axisKey === 'x' || axisKey === 'y' || axisKey === 'z') {
          const resolved = parseResourceReferenceLabel(axisId, diagnostics, stmt.span, 'axis', ['axis']);
          if (resolved) {
            axes[axisKey] = { axisId: resolved };
          }
          continue;
        }
      }
      if (stmt.key === 'x' || stmt.key === 'y' || stmt.key === 'z') {
        const axisId = parseResourceReferenceValue(stmt.value, diagnostics, parent, 'axis', {
          allowedTypes: ['axis']
        });
        if (axisId && !Array.isArray(axisId)) {
          axes[stmt.key] = { axisId };
        }
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: `Unsupported axes attribute "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }
    if (stmt.type === 'block' && stmt.name === 'axis') {
      const axisKey = stmt.labels[0];
      const axisId = stmt.labels[1];
      if ((axisKey === 'x' || axisKey === 'y' || axisKey === 'z') && axisId) {
        const resolved = parseResourceReferenceLabel(axisId, diagnostics, stmt.span, 'axis', ['axis']);
        if (resolved) {
          axes[axisKey] = { axisId: resolved };
        }
        continue;
      }
    }
    diagnostics.push({
      severity: 'error',
      message: 'axes block only supports axis entries',
      span: stmt.span
    });
  }

  return axes;
}

function buildRegionsFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown>[] {
  const regions: Record<string, unknown>[] = [];

  for (const stmt of statements) {
    if (stmt.type === 'block' && stmt.name === 'region') {
      const region = buildRegionFromBlock(stmt, diagnostics);
      if (region) regions.push(region);
      continue;
    }
    if (stmt.type === 'attribute') {
      const value = valueToJson(stmt.value, diagnostics, parent);
      if (isRecord(value)) {
        const region: Record<string, unknown> = { id: stmt.key, ...value };
        regions.push(region);
        continue;
      }
      diagnostics.push({
        severity: 'error',
        message: 'region entries must be objects',
        span: stmt.span
      });
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: 'regions block only supports region entries',
      span: stmt.span
    });
  }

  return regions;
}

function buildRegionFromBlock(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const region: Record<string, unknown> = {};

  for (const stmt of block.body) {
    if (stmt.type === 'attribute') {
      if (stmt.key === 'bounds' && isArrayValue(stmt.value)) {
        const bounds = buildBoundsFromLine(stmt.value, diagnostics, block);
        if (bounds) {
          region.bounds = bounds;
          continue;
        }
      }
      let value = valueToJson(stmt.value, diagnostics, block);
      if (stmt.key === 'zRange' && Array.isArray(value) && value.length >= 2) {
        value = { min: value[0], max: value[1] };
      }
      setObjectValue(region, stmt.key, value);
      continue;
    }
    if (stmt.type === 'block' && stmt.name === 'bounds') {
      region.bounds = buildBoundsFromBlock(stmt, diagnostics);
      continue;
    }
    diagnostics.push({
      severity: 'error',
      message: `Unsupported region statement "${stmt.type}"`,
      span: stmt.span
    });
  }

  if (!applyLabelField(region, 'id', block.labels[0], diagnostics, block)) return null;
  if (block.labels[1]) {
    if (!applyLabelField(region, 'label', block.labels[1], diagnostics, block)) return null;
  }

  return region;
}

function buildBoundsFromBlock(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const shape = block.labels[0];
  const raw = buildObjectFromStatements(block.body, diagnostics, block);

  if (!shape) {
    diagnostics.push({
      severity: 'error',
      message: 'bounds requires a shape label',
      span: block.span
    });
    return null;
  }

  if (shape === 'circle') {
    const center = normalizePoint(raw.center, diagnostics, block);
    const radius = raw.radius;
    if (!center || typeof radius !== 'number') {
      diagnostics.push({
        severity: 'error',
        message: 'circle bounds require center and radius',
        span: block.span
      });
      return null;
    }
    return { shape, center, radius };
  }

  if (shape === 'rect') {
    const { x1, y1, x2, y2 } = raw as Record<string, unknown>;
    if (![x1, y1, x2, y2].every((value) => typeof value === 'number')) {
      diagnostics.push({
        severity: 'error',
        message: 'rect bounds require x1, y1, x2, y2',
        span: block.span
      });
      return null;
    }
    return { shape, x1, y1, x2, y2 };
  }

  if (shape === 'polygon') {
    const points: { x: number; y: number }[] = [];
    const rawPoints = raw.points;
    if (Array.isArray(rawPoints)) {
      for (const entry of rawPoints) {
        const point = normalizePoint(entry, diagnostics, block);
        if (point) points.push(point);
      }
    }
    const rawPoint = raw.point;
    if (Array.isArray(rawPoint)) {
      if (rawPoint.length >= 2 && typeof rawPoint[0] === 'number') {
        const point = normalizePoint(rawPoint, diagnostics, block);
        if (point) points.push(point);
      } else {
        for (const entry of rawPoint) {
          const point = normalizePoint(entry, diagnostics, block);
          if (point) points.push(point);
        }
      }
    } else if (rawPoint) {
      const point = normalizePoint(rawPoint, diagnostics, block);
      if (point) points.push(point);
    }
    if (points.length === 0) {
      diagnostics.push({
        severity: 'error',
        message: 'polygon bounds require points',
        span: block.span
      });
      return null;
    }
    return { shape, points };
  }

  diagnostics.push({
    severity: 'error',
    message: `Unsupported bounds shape "${shape}"`,
    span: block.span
  });
  return null;
}

function buildBoundsFromLine(
  value: ArrayValue,
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> | null {
  const raw = valueToJson(value, diagnostics, parent);
  if (!Array.isArray(raw) || raw.length < 2) {
    diagnostics.push({
      severity: 'error',
      message: 'bounds requires a shape and coordinates',
      span: parent.span
    });
    return null;
  }

  const [shape, ...rest] = raw;
  if (typeof shape !== 'string') {
    diagnostics.push({
      severity: 'error',
      message: 'bounds shape must be a string',
      span: parent.span
    });
    return null;
  }

  if (shape === 'circle') {
    const [x, y, radius] = rest;
    if ([x, y, radius].every((entry) => typeof entry === 'number')) {
      return { shape, center: { x, y }, radius };
    }
    diagnostics.push({
      severity: 'error',
      message: 'circle bounds require x y radius',
      span: parent.span
    });
    return null;
  }

  if (shape === 'rect') {
    const [x1, y1, x2, y2] = rest;
    if ([x1, y1, x2, y2].every((entry) => typeof entry === 'number')) {
      return { shape, x1, y1, x2, y2 };
    }
    diagnostics.push({
      severity: 'error',
      message: 'rect bounds require x1 y1 x2 y2',
      span: parent.span
    });
    return null;
  }

  if (shape === 'polygon') {
    if (rest.length % 2 !== 0 || rest.length === 0) {
      diagnostics.push({
        severity: 'error',
        message: 'polygon bounds require paired coordinates',
        span: parent.span
      });
      return null;
    }
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < rest.length; i += 2) {
      const x = rest[i];
      const y = rest[i + 1];
      if (typeof x !== 'number' || typeof y !== 'number') {
        diagnostics.push({
          severity: 'error',
          message: 'polygon bounds require numeric coordinates',
          span: parent.span
        });
        return null;
      }
      points.push({ x, y });
    }
    return { shape, points };
  }

  diagnostics.push({
    severity: 'error',
    message: `Unsupported bounds shape "${shape}"`,
    span: parent.span
  });
  return null;
}

function normalizePoint(
  value: unknown,
  diagnostics: Diagnostic[],
  parent: BlockNode
): { x: number; y: number } | null {
  if (Array.isArray(value) && value.length >= 2) {
    const [x, y] = value;
    if (typeof x === 'number' && typeof y === 'number') {
      return { x, y };
    }
  }
  if (isRecord(value)) {
    const { x, y } = value as Record<string, unknown>;
    if (typeof x === 'number' && typeof y === 'number') {
      return { x, y };
    }
  }
  diagnostics.push({
    severity: 'error',
    message: 'point must be [x y] or {x y}',
    span: parent.span
  });
  return null;
}

function buildStaticPageFromBlock(
  block: BlockNode,
  contentByPath: Map<string, string>,
  diagnostics: Diagnostic[]
): Record<string, unknown> | null {
  const titleLabel = block.labels[0];
  if (!titleLabel) {
    diagnostics.push({
      severity: 'error',
      message: 'static_page requires a title label',
      span: block.span
    });
    return null;
  }

  const page: Record<string, unknown> = {};

  for (const stmt of block.body) {
    if (stmt.type !== 'attribute') {
      diagnostics.push({
        severity: 'error',
        message: 'static_page only supports attributes',
        span: stmt.span
      });
      continue;
    }

    if (stmt.key === 'content') {
      const content = resolveStaticPageContent(stmt.value, contentByPath, diagnostics, block);
      if (content !== null) page.content = content;
      continue;
    }

    const value = valueToJson(stmt.value, diagnostics, block);
    if (stmt.key === 'seed_id') {
      page.seedId = value;
      continue;
    }
    setObjectValue(page, stmt.key, value);
  }

  if (page.title !== undefined && page.title !== titleLabel) {
    diagnostics.push({
      severity: 'error',
      message: `static_page title mismatch: label "${titleLabel}" vs title "${page.title}"`,
      span: block.span
    });
    return null;
  }

  page.title = titleLabel;
  if (typeof page.slug !== 'string' || page.slug.length === 0) {
    page.slug = generateStaticPageSlug(titleLabel);
  }

  return page;
}

function resolveStaticPageContent(
  value: Value,
  contentByPath: Map<string, string>,
  diagnostics: Diagnostic[],
  parent: BlockNode
): string | null {
  if (isCallValue(value)) {
    if (value.name !== 'read') {
      diagnostics.push({
        severity: 'error',
        message: `Unsupported call "${value.name}" in static_page content`,
        span: parent.span
      });
      return null;
    }
    const arg = value.args[0];
    const path = coerceStringValue(arg);
    if (!path) {
      diagnostics.push({
        severity: 'error',
        message: 'read() requires a string path',
        span: parent.span
      });
      return null;
    }
    const direct = contentByPath.get(path);
    if (direct !== undefined) return direct;
    for (const [key, content] of contentByPath.entries()) {
      if (key.endsWith(path)) return content;
    }
    diagnostics.push({
      severity: 'error',
      message: `Missing static page content file "${path}"`,
      span: parent.span
    });
    return null;
  }

  if (typeof value === 'string') return value;
  if (isIdentifierValue(value)) return value.value;

  diagnostics.push({
    severity: 'error',
    message: 'content must be a string or read("file.md")',
    span: parent.span
  });
  return null;
}

function coerceStringValue(value: Value | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  if (isIdentifierValue(value)) return value.value;
  return null;
}

function generateStaticPageSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
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

interface GeneratorContext {
  bindings: Map<string, string>;
  diagnostics: Diagnostic[];
  parent: BlockNode;
  selectionDefined: boolean;
  targetAlias?: string;
}

const DSL_BLOCK_NAMES = new Set(['when', 'choose', 'let', 'constraints']);

interface ActionContext extends GeneratorContext {
  actorDefined: boolean;
  targetDefined: boolean;
  instigatorDefined: boolean;
}

const ACTION_DSL_BLOCKS = new Set(['actor', 'target', 'targeting', 'on']);
const ACTION_DSL_ATTRIBUTES = new Set([
  'narrative',
  'success_chance',
  'weight',
  'pressure_modifier',
  'prominence'
]);

function hasDslStatements(statements: StatementNode[]): boolean {
  return statements.some((stmt) => {
    if (stmt.type === 'block') {
      return DSL_BLOCK_NAMES.has(stmt.name);
    }
    if (stmt.type === 'attribute' && stmt.key === 'let') {
      return true;
    }
    return (
      stmt.type === 'predicate'
      || stmt.type === 'in'
      || stmt.type === 'from'
      || stmt.type === 'mutate'
      || stmt.type === 'rel'
    );
  });
}

function hasActionDslStatements(statements: StatementNode[]): boolean {
  return statements.some((stmt) => {
    if (stmt.type === 'block') {
      return ACTION_DSL_BLOCKS.has(stmt.name);
    }
    if (stmt.type === 'attribute') {
      return ACTION_DSL_ATTRIBUTES.has(stmt.key) || stmt.key === 'narrative';
    }
    return stmt.type === 'mutate' || stmt.type === 'rel';
  });
}

function buildGeneratorItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const body = hasDslStatements(block.body)
    ? buildGeneratorFromStatements(block.body, diagnostics, block)
    : buildObjectFromStatements(block.body, diagnostics, block);
  const item = { ...body } as Record<string, unknown>;
  const idLabel = block.labels[0];
  const nameLabel = block.labels[1];

  if (idLabel) {
    const existing = item.id;
    if (existing !== undefined) {
      if (typeof existing !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: 'id must be a string',
          span: block.span
        });
        return null;
      }
      if (existing !== idLabel) {
        diagnostics.push({
          severity: 'error',
          message: `id mismatch: label "${idLabel}" vs value "${existing}"`,
          span: block.span
        });
        return null;
      }
    }
    item.id = idLabel;
  }

  if (nameLabel) {
    const existing = item.name;
    if (existing !== undefined) {
      if (typeof existing !== 'string') {
        diagnostics.push({
          severity: 'error',
          message: 'name must be a string',
          span: block.span
        });
        return null;
      }
      if (existing !== nameLabel) {
        diagnostics.push({
          severity: 'error',
          message: `name mismatch: label "${nameLabel}" vs value "${existing}"`,
          span: block.span
        });
        return null;
      }
    }
    item.name = nameLabel;
  }

  return item;
}

function buildActionItem(block: BlockNode, diagnostics: Diagnostic[]): Record<string, unknown> | null {
  const body = hasActionDslStatements(block.body)
    ? buildActionFromStatements(block.body, diagnostics, block)
    : buildObjectFromStatements(block.body, diagnostics, block);
  const item = { ...body } as Record<string, unknown>;
  const idLabel = block.labels[0];
  const nameLabel = block.labels[1];

  if (idLabel && !applyLabelField(item, 'id', idLabel, diagnostics, block)) return null;
  if (nameLabel && !applyLabelField(item, 'name', nameLabel, diagnostics, block)) return null;

  return item;
}

function buildActionFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  const ctx: ActionContext = {
    bindings: new Map(),
    diagnostics,
    parent,
    selectionDefined: false,
    actorDefined: false,
    targetDefined: false,
    instigatorDefined: false
  };
  ctx.bindings.set('actor', '$actor');
  ctx.bindings.set('target', '$target');

  for (const stmt of statements) {
    applyActionStatement(stmt, obj, ctx);
  }

  return obj;
}

function applyActionStatement(
  stmt: StatementNode,
  obj: Record<string, unknown>,
  ctx: ActionContext
): void {
  if (stmt.type === 'attribute') {
    if (stmt.labels && stmt.labels.length > 0 && applyActionLabeledAttribute(stmt, obj, ctx)) {
      return;
    }

    if (stmt.key === 'description') {
      obj.description = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      return;
    }
    if (stmt.key === 'narrative' || stmt.key === 'descriptionTemplate') {
      const outcome = ensureActionOutcome(obj);
      outcome.descriptionTemplate = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      return;
    }
    if (stmt.key === 'success_chance') {
      const probability = ensureActionProbability(obj);
      probability.baseSuccessChance = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      return;
    }
    if (stmt.key === 'weight') {
      const probability = ensureActionProbability(obj);
      probability.baseWeight = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      return;
    }
    if (stmt.key === 'pressure_modifier') {
      const modifier = parsePressureModifier(stmt.value, ctx);
      if (modifier) {
        const probability = ensureActionProbability(obj);
        pushArrayValue(probability, 'pressureModifiers', modifier);
      }
      return;
    }
    if (stmt.key === 'prominence') {
      applyActionProminence(stmt.value, obj, ctx);
      return;
    }
    if (stmt.key === 'enabled') {
      obj.enabled = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      return;
    }

    const value = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
    setObjectValue(obj, stmt.key, value);
    return;
  }

  if (stmt.type === 'block') {
    if (stmt.name === 'actor') {
      applyActionActorBlock(stmt, obj, ctx);
      return;
    }
    if (stmt.name === 'target' || stmt.name === 'targeting') {
      applyActionTargetBlock(stmt, obj, ctx);
      return;
    }
    if (stmt.name === 'on') {
      applyActionOutcomeBlock(stmt, obj, ctx);
      return;
    }
    if (stmt.name === 'let' || stmt.name === 'var' || stmt.name === 'variable') {
      addVariableEntryDsl(stmt.labels, buildVariableFromStatements(stmt, ctx), obj, ctx);
      return;
    }

    const child = buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt);
    if (stmt.labels.length > 0) {
      applyLabelField(child, 'id', stmt.labels[0], ctx.diagnostics, stmt);
    }
    if (stmt.labels.length > 1) {
      applyLabelField(child, 'name', stmt.labels[1], ctx.diagnostics, stmt);
    }
    setObjectValue(obj, stmt.name, child);
    return;
  }

  if (stmt.type === 'rel' || stmt.type === 'mutate') {
    ctx.diagnostics.push({
      severity: 'error',
      message: `${stmt.type} statements must be inside an "on success" block`,
      span: stmt.span
    });
    return;
  }

  if (stmt.type === 'predicate' || stmt.type === 'in' || stmt.type === 'from') {
    ctx.diagnostics.push({
      severity: 'error',
      message: `"${stmt.type}" statement is not valid at action scope`,
      span: stmt.span
    });
  }
}

function applyActionLabeledAttribute(
  stmt: Extract<StatementNode, { type: 'attribute' }>,
  obj: Record<string, unknown>,
  ctx: ActionContext
): boolean {
  const key = stmt.key;
  const labels = stmt.labels || [];
  if (labels.length === 0) return false;

  if (key === 'let' || key === 'var' || key === 'variable') {
    return addVariableEntryDsl(labels, stmt.value, obj, ctx);
  }

  return false;
}

function ensureActionActor(obj: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(obj.actor)) {
    obj.actor = {};
  }
  return obj.actor as Record<string, unknown>;
}

function ensureActionOutcome(obj: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(obj.outcome)) {
    obj.outcome = {};
  }
  return obj.outcome as Record<string, unknown>;
}

function ensureActionProbability(obj: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(obj.probability)) {
    obj.probability = {};
  }
  return obj.probability as Record<string, unknown>;
}

function applyActionActorBlock(stmt: BlockNode, obj: Record<string, unknown>, ctx: ActionContext): void {
  const actor = ensureActionActor(obj);
  if (stmt.labels.length === 0) {
    actor.selection = buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt);
    return;
  }

  const mode = stmt.labels[0];
  if (mode === 'choose' || mode === 'selection') {
    const selection = buildActionSelectionFromBlock(stmt, ctx, 'actor');
    if (selection) {
      if (ctx.actorDefined) {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'actor selection already defined',
          span: stmt.span
        });
        return;
      }
      ctx.actorDefined = true;
      ctx.bindings.set('actor', '$actor');
      actor.selection = selection;
    }
    return;
  }

  if (mode === 'when' || mode === 'conditions') {
    const conditions = buildConditionsFromStatements(stmt.body, ctx);
    if (conditions.length > 0) {
      actor.conditions = conditions;
    } else {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'actor when block requires at least one condition',
        span: stmt.span
      });
    }
    return;
  }

  if (mode === 'instigator') {
    if (ctx.instigatorDefined) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'instigator already defined',
        span: stmt.span
      });
      return;
    }
    const instigator = buildActionInstigatorFromBlock(stmt, ctx);
    if (instigator) {
      ctx.instigatorDefined = true;
      ctx.bindings.set('instigator', '$instigator');
      actor.instigator = instigator;
    }
    return;
  }

  ctx.diagnostics.push({
    severity: 'error',
    message: `Unsupported actor block "${mode}"`,
    span: stmt.span
  });
}

function applyActionTargetBlock(stmt: BlockNode, obj: Record<string, unknown>, ctx: ActionContext): void {
  if (stmt.labels.length === 0) {
    obj.targeting = buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt);
    return;
  }
  const mode = stmt.labels[0];
  if (mode !== 'choose' && mode !== 'selection') {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported target block "${mode}"`,
      span: stmt.span
    });
    return;
  }

  const selection = buildActionSelectionFromBlock(stmt, ctx, 'target');
  if (selection) {
    if (ctx.targetDefined) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'target selection already defined',
        span: stmt.span
      });
      return;
    }
    ctx.targetDefined = true;
    ctx.bindings.set('target', '$target');
    obj.targeting = selection;
  }
}

function applyActionOutcomeBlock(stmt: BlockNode, obj: Record<string, unknown>, ctx: ActionContext): void {
  const mode = stmt.labels[0];
  if (mode !== 'success') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'only "on success" blocks are supported for actions',
      span: stmt.span
    });
    return;
  }

  const mutations = buildActionMutationsFromStatements(stmt.body, ctx);
  if (mutations.length > 0) {
    const outcome = ensureActionOutcome(obj);
    outcome.mutations = mutations;
  }
}

function buildActionSelectionFromBlock(
  stmt: BlockNode,
  ctx: ActionContext,
  bindingName: string
): Record<string, unknown> | null {
  const kind = parseActionSelectionKind(stmt.labels, ctx, stmt.span);
  if (!kind) return null;
  const chooseBlock: BlockNode = {
    ...stmt,
    name: 'choose',
    labels: [bindingName, 'from', kind]
  };
  const { selection } = buildSelectionFromStatements(chooseBlock, ctx);
  if (!selection) return null;
  normalizeRefsInObject(selection, ctx);
  return selection;
}

function parseActionSelectionKind(
  labels: string[],
  ctx: ActionContext,
  span: BlockNode['span']
): string | null {
  if (labels.length < 2) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'selection requires a kind label',
      span
    });
    return null;
  }
  const mode = labels[0];
  if (mode !== 'choose' && mode !== 'selection') {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported selection mode "${mode}"`,
      span
    });
    return null;
  }
  const rest = labels.slice(1);
  if (rest[0] === 'from') {
    return rest[1] || null;
  }
  if (rest[1] === 'from') {
    return rest[2] || null;
  }
  return rest[0] || null;
}

function buildActionInstigatorFromBlock(stmt: BlockNode, ctx: ActionContext): Record<string, unknown> | null {
  const variable = buildVariableFromStatements(stmt, ctx);
  const select = variable.select;
  if (!isRecord(select)) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'instigator selection must be an object',
      span: stmt.span
    });
    return null;
  }
  const instigator = { ...select };
  if (variable.required !== undefined) {
    instigator.required = variable.required;
  }
  return instigator;
}

function buildActionMutationsFromStatements(
  statements: StatementNode[],
  ctx: ActionContext
): Record<string, unknown>[] {
  const mutations: Record<string, unknown>[] = [];

  for (const stmt of statements) {
    if (stmt.type === 'rel') {
      const mutation = buildActionRelationshipMutation(stmt, ctx);
      if (mutation) mutations.push(mutation);
      continue;
    }
    if (stmt.type === 'mutate') {
      const mutation = buildActionPressureMutation(stmt, ctx);
      if (mutation) mutations.push(mutation);
      continue;
    }
    if (stmt.type === 'attribute') {
      const mutation = buildActionMutationFromAttribute(stmt, ctx);
      if (mutation) {
        mutations.push(mutation);
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported mutation "${stmt.key}"`,
        span: stmt.span
      });
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported mutation statement "${stmt.type}"`,
      span: stmt.span
    });
  }

  return mutations;
}

function buildActionRelationshipMutation(
  stmt: Extract<StatementNode, { type: 'rel' }>,
  ctx: ActionContext
): Record<string, unknown> | null {
  const value = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
  if (!isRecord(value)) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'rel mutation requires attributes',
      span: stmt.span
    });
    return null;
  }
  const mutation: Record<string, unknown> = {
    kind: stmt.kind,
    src: normalizeRefName(stmt.src, ctx),
    dst: normalizeRefName(stmt.dst, ctx)
  };
  Object.assign(mutation, value);

  if (mutation.delta !== undefined) {
    mutation.type = 'adjust_relationship_strength';
  } else {
    mutation.type = 'create_relationship';
  }

  normalizeRefsInObject(mutation, ctx);
  return mutation;
}

function buildActionPressureMutation(
  stmt: Extract<StatementNode, { type: 'mutate' }>,
  ctx: ActionContext
): Record<string, unknown> | null {
  if (stmt.target !== 'pressure') {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported mutate target "${stmt.target}"`,
      span: stmt.span
    });
    return null;
  }
  const delta = stmt.operator === '-=' ? -stmt.value : stmt.value;
  return {
    type: 'modify_pressure',
    pressureId: stmt.id,
    delta
  };
}

function buildActionMutationFromAttribute(
  stmt: Extract<StatementNode, { type: 'attribute' }>,
  ctx: ActionContext
): Record<string, unknown> | null {
  const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
  if (!tokens) return null;

  if (stmt.key === 'set_tag') {
    const [entity, tag, ...rest] = tokens;
    if (typeof entity !== 'string' || typeof tag !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'set_tag requires: set_tag <entity> <tag> <value>',
        span: stmt.span
      });
      return null;
    }
    const mutation: Record<string, unknown> = {
      type: 'set_tag',
      entity: normalizeRefName(entity, ctx),
      tag
    };
    const parsed = parseTagValue(rest, ctx, stmt.span);
    if (parsed.value !== undefined) mutation.value = parsed.value;
    if (parsed.valueFrom !== undefined) mutation.valueFrom = parsed.valueFrom;
    normalizeRefsInObject(mutation, ctx);
    return mutation;
  }

  if (stmt.key === 'remove_tag') {
    const [entity, tag] = tokens;
    if (typeof entity !== 'string' || typeof tag !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'remove_tag requires: remove_tag <entity> <tag>',
        span: stmt.span
      });
      return null;
    }
    return {
      type: 'remove_tag',
      entity: normalizeRefName(entity, ctx),
      tag
    };
  }

  if (stmt.key === 'change_status') {
    const [entity, status] = tokens;
    if (typeof entity !== 'string' || typeof status !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'change_status requires: change_status <entity> <status>',
        span: stmt.span
      });
      return null;
    }
    return {
      type: 'change_status',
      entity: normalizeRefName(entity, ctx),
      newStatus: status
    };
  }

  if (stmt.key === 'adjust_prominence') {
    const [entity, delta] = tokens;
    if (typeof entity !== 'string' || typeof delta !== 'number') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'adjust_prominence requires: adjust_prominence <entity> <delta>',
        span: stmt.span
      });
      return null;
    }
    return {
      type: 'adjust_prominence',
      entity: normalizeRefName(entity, ctx),
      delta
    };
  }

  if (stmt.key === 'archive_relationship') {
    const parsed = parseArchiveRelationship(tokens, ctx, stmt.span);
    if (!parsed) return null;
    return {
      type: 'archive_relationship',
      ...parsed
    };
  }

  if (stmt.key === 'archive_all_relationships') {
    const parsed = parseArchiveRelationship(tokens, ctx, stmt.span, true);
    if (!parsed) return null;
    return {
      type: 'archive_all_relationships',
      ...parsed
    };
  }

  if (stmt.key === 'update_rate_limit') {
    return { type: 'update_rate_limit' };
  }

  return null;
}

function parseTagValue(
  tokens: unknown[],
  ctx: ActionContext,
  span: BlockNode['span']
): { value?: unknown; valueFrom?: string } {
  let value: unknown = undefined;
  let valueFrom: string | undefined;
  if (tokens.length === 0) return { value, valueFrom };
  if (tokens[0] === 'value') {
    value = tokens[1];
  } else if (tokens[0] === 'from') {
    const ref = tokens[1];
    if (typeof ref === 'string') {
      valueFrom = normalizeRefName(ref, ctx);
    }
  } else {
    value = tokens[0];
    if (tokens[1] === 'from' && typeof tokens[2] === 'string') {
      valueFrom = normalizeRefName(tokens[2], ctx);
    }
  }
  if (valueFrom !== undefined && typeof valueFrom !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'set_tag valueFrom must be a reference',
      span
    });
  }
  return { value, valueFrom };
}

function parseArchiveRelationship(
  tokens: unknown[],
  ctx: ActionContext,
  span: BlockNode['span'],
  allowAll: boolean = false
): Record<string, unknown> | null {
  const [entity, kind, withToken, maybeDirection, maybeValue] = tokens;
  if (typeof entity !== 'string' || typeof kind !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      message: allowAll
        ? 'archive_all_relationships requires: archive_all_relationships <entity> <kind> [direction <dir>]'
        : 'archive_relationship requires: archive_relationship <entity> <kind> <with> [direction <dir>]',
      span
    });
    return null;
  }

  const result: Record<string, unknown> = {
    entity: normalizeRefName(entity, ctx),
    relationshipKind: kind
  };

  let idx = 2;
  if (!allowAll) {
    if (typeof withToken !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'archive_relationship requires a target reference',
        span
      });
      return null;
    }
    result.with = normalizeRefName(withToken, ctx);
    idx = 3;
  }

  const label = allowAll ? withToken : maybeDirection;
  const value = allowAll ? maybeDirection : maybeValue;
  if (label === 'direction' && typeof value === 'string') {
    result.direction = value;
  }

  return result;
}

function applyActionProminence(
  value: Value,
  obj: Record<string, unknown>,
  ctx: ActionContext
): void {
  const tokens = valueToTokenList(value, ctx, ctx.parent.span);
  if (!tokens || tokens.length < 3) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'prominence requires: prominence <actor|target> success <value> failure <value>',
      span: ctx.parent.span
    });
    return;
  }
  const target = tokens[0];
  if (target !== 'actor' && target !== 'target') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'prominence requires actor or target',
      span: ctx.parent.span
    });
    return;
  }
  const outcome = ensureActionOutcome(obj);
  const deltaKey = target === 'actor' ? 'actorProminenceDelta' : 'targetProminenceDelta';
  const delta = isRecord(outcome[deltaKey]) ? (outcome[deltaKey] as Record<string, unknown>) : {};

  let idx = 1;
  while (idx < tokens.length) {
    if (tokens[idx] === 'on') {
      idx += 1;
      continue;
    }
    const label = tokens[idx];
    const amount = tokens[idx + 1];
    if ((label === 'success' || label === 'failure') && typeof amount === 'number') {
      const field = label === 'success' ? 'onSuccess' : 'onFailure';
      delta[field] = amount;
      idx += 2;
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: 'prominence requires success/failure entries with numeric values',
      span: ctx.parent.span
    });
    return;
  }

  outcome[deltaKey] = delta;
}

function parsePressureModifier(value: Value, ctx: ActionContext): Record<string, unknown> | null {
  const tokens = valueToTokenList(value, ctx, ctx.parent.span);
  if (!tokens || tokens.length < 2) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'pressure_modifier requires: pressure_modifier <pressure> <multiplier>',
      span: ctx.parent.span
    });
    return null;
  }
  const [pressure, multiplier] = tokens;
  if (typeof pressure !== 'string' || typeof multiplier !== 'number') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'pressure_modifier requires a pressure id and numeric multiplier',
      span: ctx.parent.span
    });
    return null;
  }
  return { pressure, multiplier };
}

function buildGeneratorFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  const ctx: GeneratorContext = {
    bindings: new Map(),
    diagnostics,
    parent,
    selectionDefined: false
  };

  for (const stmt of statements) {
    applyGeneratorStatement(stmt, obj, ctx);
  }

  return obj;
}

function applyGeneratorStatement(
  stmt: StatementNode,
  obj: Record<string, unknown>,
  ctx: GeneratorContext
): void {
  if (stmt.type === 'attribute') {
    if (stmt.labels && stmt.labels.length > 0) {
      if (applyLabeledAttributeDsl(stmt, obj, ctx)) {
        return;
      }
    }
    const value = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
    setObjectValue(obj, stmt.key, value);
    return;
  }

  if (stmt.type === 'block') {
    if (stmt.name === 'constraints') {
      const conditions = buildConditionsFromStatements(stmt.body, ctx);
      if (conditions.length > 0) {
        pushArrayValue(obj, 'applicability', {
          type: 'and',
          conditions
        });
      }
      return;
    }
    if (stmt.name === 'when') {
      const mode = stmt.labels.find((label) => label === 'any' || label === 'or' || label === 'all' || label === 'and');
      const type = (mode === 'any' || mode === 'or') ? 'or' : 'and';
      const conditions = buildConditionsFromStatements(stmt.body, ctx);
      if (conditions.length === 0) {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'when block requires at least one condition',
          span: stmt.span
        });
        return;
      }
      pushArrayValue(obj, 'applicability', {
        type,
        conditions
      });
      return;
    }
    if (stmt.name === 'choose' || stmt.name === 'selection') {
      const { selection, targetAlias } = buildSelectionFromStatements(stmt, ctx);
      if (selection) {
        if (ctx.selectionDefined) {
          ctx.diagnostics.push({
            severity: 'error',
            message: 'selection already defined',
            span: stmt.span
          });
          return;
        }
        ctx.selectionDefined = true;
        if (targetAlias) {
          ctx.targetAlias = targetAlias;
          ctx.bindings.set(targetAlias, '$target');
        } else if (!ctx.bindings.has('target')) {
          ctx.bindings.set('target', '$target');
        }
        normalizeRefsInObject(selection, ctx);
        obj.selection = selection;
      }
      return;
    }
    if (stmt.name === 'let' || stmt.name === 'var' || stmt.name === 'variable') {
      addVariableEntryDsl(stmt.labels, buildVariableFromStatements(stmt, ctx), obj, ctx);
      return;
    }
    if (stmt.name === 'create') {
      addCreationEntryDsl(stmt.labels, buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt), obj, ctx);
      return;
    }
    if (stmt.name === 'relationship' || stmt.name === 'rel') {
      addRelationshipEntryDsl(stmt.labels, buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt), obj, ctx);
      return;
    }
    if (stmt.name === 'applicability') {
      addApplicabilityEntry(stmt.labels, buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt), obj, ctx.diagnostics, stmt);
      return;
    }

    const child = buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt);
    if (stmt.labels.length > 0) {
      const existingId = child.id;
      if (existingId === undefined) {
        child.id = stmt.labels[0];
      } else if (typeof existingId !== 'string') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'block id must be a string',
          span: stmt.span
        });
      } else if (existingId !== stmt.labels[0]) {
        ctx.diagnostics.push({
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
        ctx.diagnostics.push({
          severity: 'error',
          message: 'block name must be a string',
          span: stmt.span
        });
      } else if (existingName !== stmt.labels[1]) {
        ctx.diagnostics.push({
          severity: 'error',
          message: `block name mismatch: label "${stmt.labels[1]}" vs name "${existingName}"`,
          span: stmt.span
        });
      }
    }
    setObjectValue(obj, stmt.name, child);
    return;
  }

  if (stmt.type === 'rel') {
    addRelationshipEntryDsl([stmt.kind, stmt.src, stmt.dst], stmt.value, obj, ctx);
    return;
  }

  if (stmt.type === 'mutate') {
    addMutationEntryDsl(stmt, obj, ctx);
    return;
  }

  if (stmt.type === 'predicate') {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Predicate "${stmt.keyword}" must be inside a when/constraints block`,
      span: stmt.span
    });
    return;
  }

  if (stmt.type === 'in' || stmt.type === 'from') {
    ctx.diagnostics.push({
      severity: 'error',
      message: `"${stmt.type}" statement is not valid at generator scope`,
      span: stmt.span
    });
  }
}

function buildConditionsFromStatements(statements: StatementNode[], ctx: GeneratorContext): Record<string, unknown>[] {
  const conditions: Record<string, unknown>[] = [];

  for (const stmt of statements) {
    if (stmt.type === 'predicate') {
      const condition = conditionFromPredicate(stmt, ctx);
      if (condition) conditions.push(condition);
      continue;
    }
    if (stmt.type === 'block' && (stmt.name === 'path' || stmt.name === 'graph_path' || stmt.name === 'filter')) {
      const condition = parseGraphPathBlock(stmt, ctx);
      if (condition) conditions.push(condition);
      continue;
    }
    if (stmt.type === 'attribute' && stmt.key === 'condition') {
      const value = valueToJson(stmt.value, ctx.diagnostics, ctx.parent);
      if (isRecord(value)) {
        normalizeRefsInObject(value, ctx);
        conditions.push(value);
      } else {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'condition value must be an object',
          span: stmt.span
        });
      }
      continue;
    }
    if (stmt.type === 'attribute' && stmt.key === 'prominence') {
      const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
      if (!tokens || tokens.length < 2) {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'prominence requires: prominence min|max <value>',
          span: stmt.span
        });
        continue;
      }
      const [mode, value] = tokens;
      if (mode !== 'min' && mode !== 'max') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'prominence requires min or max',
          span: stmt.span
        });
        continue;
      }
      if (typeof value !== 'string') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'prominence value must be an identifier',
          span: stmt.span
        });
        continue;
      }
      const condition: Record<string, unknown> = { type: 'prominence' };
      if (mode === 'min') condition.min = value;
      if (mode === 'max') condition.max = value;
      conditions.push(condition);
      continue;
    }
    if (stmt.type === 'attribute' && stmt.key === 'lacks_tag') {
      const tokens = valueToTokenList(stmt.value, ctx, stmt.span);
      if (!tokens || tokens.length === 0) {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'lacks_tag requires a tag',
          span: stmt.span
        });
        continue;
      }
      const tag = tokens.length === 1 ? tokens[0] : tokens[1];
      const entity = tokens.length > 1 ? tokens[0] : undefined;
      if (typeof tag !== 'string') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'lacks_tag requires a tag identifier',
          span: stmt.span
        });
        continue;
      }
      const condition: Record<string, unknown> = { type: 'lacks_tag', tag };
      if (typeof entity === 'string') {
        condition.entity = normalizeRefName(entity, ctx);
      }
      conditions.push(condition);
      continue;
    }
    if (stmt.type === 'block' && stmt.name === 'condition') {
      const value = buildObjectFromStatements(stmt.body, ctx.diagnostics, stmt);
      normalizeRefsInObject(value, ctx);
      conditions.push(value);
      continue;
    }
    if (stmt.type !== 'attribute' && stmt.type !== 'block') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported condition statement "${stmt.type}"`,
        span: stmt.span
      });
      continue;
    }
    if (stmt.type === 'attribute') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported condition attribute "${stmt.key}"`,
        span: stmt.span
      });
    }
  }

  return conditions;
}

function conditionFromPredicate(
  stmt: Extract<StatementNode, { type: 'predicate' }>,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  if (stmt.keyword === 'pressure') {
    const condition: Record<string, unknown> = {
      type: 'pressure',
      pressureId: stmt.subject
    };
    if (stmt.operator === '>=' || stmt.operator === '>') {
      condition.min = stmt.value;
    } else if (stmt.operator === '<=' || stmt.operator === '<') {
      condition.max = stmt.value;
    } else if (stmt.operator === '==') {
      condition.min = stmt.value;
      condition.max = stmt.value;
    } else {
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported pressure operator "${stmt.operator}"`,
        span: stmt.span
      });
      return null;
    }
    return condition;
  }

  if (stmt.keyword === 'cap') {
    if (stmt.field !== 'kind') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'cap requires: cap kind <kind> <operator> <value>',
        span: stmt.span
      });
      return null;
    }
    const condition: Record<string, unknown> = {
      type: 'entity_count',
      kind: stmt.subject
    };
    if (stmt.operator === '>=' || stmt.operator === '>') {
      condition.min = stmt.value;
    } else if (stmt.operator === '<=' || stmt.operator === '<') {
      condition.max = stmt.value;
    } else if (stmt.operator === '==') {
      condition.min = stmt.value;
      condition.max = stmt.value;
    } else {
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported cap operator "${stmt.operator}"`,
        span: stmt.span
      });
      return null;
    }
    return condition;
  }

  if (stmt.keyword === 'relationship_count') {
    const relationshipKind = stmt.field ? stmt.field : stmt.subject;
    const direction = stmt.field ? stmt.subject : undefined;
    if (!relationshipKind) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'relationship_count requires a relationship kind',
        span: stmt.span
      });
      return null;
    }
    const condition: Record<string, unknown> = {
      type: 'relationship_count',
      relationshipKind
    };
    if (direction) {
      condition.direction = direction;
    }
    if (stmt.operator === '>=' || stmt.operator === '>') {
      condition.min = stmt.value;
    } else if (stmt.operator === '<=' || stmt.operator === '<') {
      condition.max = stmt.value;
    } else if (stmt.operator === '==') {
      condition.min = stmt.value;
      condition.max = stmt.value;
    } else {
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported relationship_count operator "${stmt.operator}"`,
        span: stmt.span
      });
      return null;
    }
    return condition;
  }

  ctx.diagnostics.push({
    severity: 'error',
    message: `Unsupported predicate "${stmt.keyword}"`,
    span: stmt.span
  });
  return null;
}

function valueToTokenList(
  value: Value,
  ctx: GeneratorContext,
  span: BlockNode['span']
): unknown[] | null {
  const raw = valueToJson(value, ctx.diagnostics, ctx.parent);
  if (Array.isArray(raw)) return raw;
  if (raw === undefined) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'Expected a value list',
      span
    });
    return null;
  }
  return [raw];
}

function parseFilterValue(
  value: Value,
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  const raw = valueToJson(value, ctx.diagnostics, ctx.parent);
  if (isRecord(raw) && typeof raw.type === 'string') {
    normalizeRefsInObject(raw, ctx);
    return raw;
  }
  const tokens = Array.isArray(raw) ? raw : [raw];
  return parseFilterTokens(tokens, ctx, span);
}

function parseFilterTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  if (tokens.length === 0 || typeof tokens[0] !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'filter requires a type',
      span
    });
    return null;
  }
  const type = tokens[0];
  const rest = tokens.slice(1);

  if (type === 'exclude') {
    const entities = flattenTokenList(rest, ctx, span);
    if (!entities) return null;
    if (entities.length === 0) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'exclude filter requires at least one entity',
        span
      });
      return null;
    }
    return {
      type,
      entities: entities.map((entry) => normalizeRefName(entry, ctx))
    };
  }

  if (type === 'has_relationship' || type === 'lacks_relationship') {
    const kind = rest[0];
    if (typeof kind !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `${type} filter requires a relationship kind`,
        span
      });
      return null;
    }
    const filter: Record<string, unknown> = { type, kind };
    let idx = 1;
    while (idx < rest.length) {
      const token = rest[idx];
      const value = rest[idx + 1];
      if (token === 'with' && typeof value === 'string') {
        filter.with = normalizeRefName(value, ctx);
        idx += 2;
        continue;
      }
      if (token === 'direction' && typeof value === 'string' && type === 'has_relationship') {
        filter.direction = value;
        idx += 2;
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported ${type} filter token "${String(token)}"`,
        span
      });
      return null;
    }
    return filter;
  }

  if (type === 'has_tag' || type === 'lacks_tag') {
    const tag = rest[0];
    if (typeof tag !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `${type} filter requires a tag`,
        span
      });
      return null;
    }
    const filter: Record<string, unknown> = { type, tag };
    if (rest.length > 1) {
      if (rest[1] === 'value') {
        filter.value = rest[2];
      } else {
        filter.value = rest[1];
      }
    }
    return filter;
  }

  if (type === 'has_any_tag') {
    const tags = flattenTokenList(rest, ctx, span);
    if (!tags || tags.length === 0) {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'has_any_tag filter requires tags',
        span
      });
      return null;
    }
    return { type, tags };
  }

  if (type === 'matches_culture' || type === 'not_matches_culture') {
    const ref = rest[0];
    if (typeof ref !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `${type} filter requires a reference`,
        span
      });
      return null;
    }
    return { type, with: normalizeRefName(ref, ctx) };
  }

  if (type === 'has_culture' || type === 'not_has_culture') {
    const culture = rest[0];
    if (typeof culture !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `${type} filter requires a culture`,
        span
      });
      return null;
    }
    return { type, culture };
  }

  ctx.diagnostics.push({
    severity: 'error',
    message: `Unsupported filter type "${type}"`,
    span
  });
  return null;
}

function flattenTokenList(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): string[] | null {
  let list: unknown[] = tokens;
  if (tokens.length === 1 && Array.isArray(tokens[0])) {
    list = tokens[0] as unknown[];
  }
  const result: string[] = [];
  for (const entry of list) {
    if (typeof entry !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'Expected a list of identifiers',
        span
      });
      return null;
    }
    result.push(entry);
  }
  return result;
}

function parseGraphPathBlock(
  stmt: BlockNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  const { check } = parseGraphPathHeader(stmt, ctx);
  if (!check) return null;

  const path: Record<string, unknown>[] = [];
  const where: Record<string, unknown>[] = [];
  let count: number | undefined;

  for (const child of stmt.body) {
    if (child.type === 'attribute' && child.key === 'count') {
      const raw = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      if (typeof raw !== 'number') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'count must be a number',
          span: child.span
        });
      } else {
        count = raw;
      }
      continue;
    }
    if (child.type === 'attribute' && child.key === 'step') {
      const tokens = valueToTokenList(child.value, ctx, child.span);
      if (!tokens) continue;
      const step = parseGraphPathStepTokens(tokens, ctx, child.span);
      if (step) path.push(step);
      continue;
    }
    if (child.type === 'block' && child.name === 'step') {
      const step = parseGraphPathStepBlock(child, ctx);
      if (step) path.push(step);
      continue;
    }
    if (child.type === 'attribute' && child.key === 'where') {
      const constraint = parsePathConstraintValue(child.value, ctx, child.span);
      if (constraint) where.push(constraint);
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported graph path statement "${child.type}"`,
      span: child.span
    });
  }

  if (path.length === 0) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'graph path requires at least one step',
      span: stmt.span
    });
    return null;
  }

  if ((check === 'count_min' || check === 'count_max') && count === undefined) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'graph path count requires count <number>',
      span: stmt.span
    });
    return null;
  }

  const assert: Record<string, unknown> = { check, path };
  if (count !== undefined) assert.count = count;
  if (where.length > 0) assert.where = where;

  return { type: 'graph_path', assert };
}

function parseGraphPathHeader(
  stmt: BlockNode,
  ctx: GeneratorContext
): { check?: string } {
  let labels = stmt.labels;
  if (stmt.name === 'filter' && labels[0] === 'path') {
    labels = labels.slice(1);
  }
  if (stmt.name === 'filter' && labels[0] === 'graph_path') {
    labels = labels.slice(1);
  }
  const check = labels[0];
  if (!check) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'graph path requires a check (exists, not_exists, count_min, count_max)',
      span: stmt.span
    });
    return {};
  }
  if (!['exists', 'not_exists', 'count_min', 'count_max'].includes(check)) {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported graph path check "${check}"`,
      span: stmt.span
    });
    return {};
  }
  return { check };
}

function parseGraphPathStepTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  if (tokens.length < 4) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'step requires: step <via> <direction> <kind> <subtype> [status <status>]',
      span
    });
    return null;
  }
  const [viaToken, direction, targetKind, targetSubtype, statusLabel, statusValue] = tokens;
  const via = parseViaToken(viaToken, ctx, span);
  if (!via || typeof direction !== 'string' || typeof targetKind !== 'string' || typeof targetSubtype !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'step requires via, direction, kind, subtype',
      span
    });
    return null;
  }
  const step: Record<string, unknown> = {
    via,
    direction,
    targetKind,
    targetSubtype
  };
  if (statusLabel !== undefined) {
    if (statusLabel !== 'status' || typeof statusValue !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'step status requires: status <status>',
        span
      });
      return null;
    }
    step.targetStatus = statusValue;
  }
  return step;
}

function parseGraphPathStepBlock(
  stmt: BlockNode,
  ctx: GeneratorContext
): Record<string, unknown> | null {
  const step: Record<string, unknown> = {};
  const filters: Record<string, unknown>[] = [];

  for (const child of stmt.body) {
    if (child.type !== 'attribute') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'step blocks only support attributes',
        span: child.span
      });
      continue;
    }
    if (child.key === 'via') {
      const raw = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      const via = parseViaToken(raw, ctx, child.span);
      if (via) step.via = via;
      continue;
    }
    if (child.key === 'direction') {
      const raw = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      step.direction = raw;
      continue;
    }
    if (child.key === 'target') {
      const tokens = valueToTokenList(child.value, ctx, child.span);
      if (!tokens || tokens.length < 2) {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'target requires: target <kind> <subtype>',
          span: child.span
        });
      } else {
        step.targetKind = tokens[0];
        step.targetSubtype = tokens[1];
      }
      continue;
    }
    if (child.key === 'kind' || child.key === 'targetKind') {
      step.targetKind = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      continue;
    }
    if (child.key === 'subtype' || child.key === 'targetSubtype') {
      step.targetSubtype = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      continue;
    }
    if (child.key === 'status' || child.key === 'targetStatus') {
      step.targetStatus = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      continue;
    }
    if (child.key === 'filter') {
      const filter = parseFilterValue(child.value, ctx, child.span);
      if (filter) filters.push(filter);
      continue;
    }
    if (child.key === 'filters') {
      const raw = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      if (Array.isArray(raw)) {
        step.filters = raw;
        for (const entry of raw) {
          if (isRecord(entry)) {
            normalizeRefsInObject(entry, ctx);
          }
        }
      }
      continue;
    }
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported step attribute "${child.key}"`,
      span: child.span
    });
  }

  if (filters.length > 0) {
    step.filters = filters;
  }

  if (!step.via || !step.direction || !step.targetKind || !step.targetSubtype) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'step requires via, direction, target kind, target subtype',
      span: stmt.span
    });
    return null;
  }

  return step;
}

function parseViaToken(
  token: unknown,
  ctx: GeneratorContext,
  span: BlockNode['span']
): string | string[] | null {
  if (typeof token === 'string') return token;
  if (Array.isArray(token)) {
    const vias: string[] = [];
    for (const entry of token) {
      if (typeof entry !== 'string') {
        ctx.diagnostics.push({
          severity: 'error',
          message: 'via list must contain identifiers',
          span
        });
        return null;
      }
      vias.push(entry);
    }
    return vias;
  }
  ctx.diagnostics.push({
    severity: 'error',
    message: 'via must be a string or list',
    span
  });
  return null;
}

function parsePathConstraintValue(
  value: Value,
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  const raw = valueToJson(value, ctx.diagnostics, ctx.parent);
  if (isRecord(raw) && typeof raw.type === 'string') {
    normalizeRefsInObject(raw, ctx);
    return raw;
  }
  const tokens = Array.isArray(raw) ? raw : [raw];
  return parsePathConstraintTokens(tokens, ctx, span);
}

function parsePathConstraintTokens(
  tokens: unknown[],
  ctx: GeneratorContext,
  span: BlockNode['span']
): Record<string, unknown> | null {
  if (tokens.length === 0 || typeof tokens[0] !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'where requires a constraint type',
      span
    });
    return null;
  }
  const type = tokens[0];
  const rest = tokens.slice(1);

  if (type === 'not_self') {
    return { type };
  }
  if (type === 'in' || type === 'not_in') {
    const set = rest[0];
    if (typeof set !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `${type} requires a set id`,
        span
      });
      return null;
    }
    return { type, set };
  }
  if (type === 'has_relationship' || type === 'lacks_relationship') {
    const kind = rest[0];
    const withToken = rest[1];
    if (typeof kind !== 'string' || typeof withToken !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: `${type} requires: ${type} <kind> <with> [direction <dir>]`,
        span
      });
      return null;
    }
    const constraint: Record<string, unknown> = {
      type,
      kind,
      with: normalizeRefName(withToken, ctx)
    };
    if (rest[2] === 'direction' && typeof rest[3] === 'string') {
      constraint.direction = rest[3];
    }
    return constraint;
  }
  if (type === 'kind') {
    const kind = rest[0];
    if (typeof kind !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'where kind requires a kind',
        span
      });
      return null;
    }
    return { type: 'kind_equals', kind };
  }
  if (type === 'subtype') {
    const subtype = rest[0];
    if (typeof subtype !== 'string') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'where subtype requires a subtype',
        span
      });
      return null;
    }
    return { type: 'subtype_equals', subtype };
  }

  ctx.diagnostics.push({
    severity: 'error',
    message: `Unsupported where constraint "${type}"`,
    span
  });
  return null;
}

function buildSelectionFromStatements(
  stmt: Extract<StatementNode, { type: 'block' }>,
  ctx: GeneratorContext
): { selection: Record<string, unknown> | null; targetAlias?: string } {
  const selection: Record<string, unknown> = {};
  let targetAlias: string | undefined;
  let kindFromLabel: string | undefined;

  if (stmt.name === 'choose') {
    if (stmt.labels.length >= 3 && stmt.labels[1] === 'from') {
      targetAlias = stmt.labels[0];
      kindFromLabel = stmt.labels[2];
    } else if (stmt.labels.length >= 1) {
      targetAlias = stmt.labels[0];
    }
    if (kindFromLabel) {
      selection.kind = kindFromLabel;
    }
  }

  if (!selection.strategy) {
    selection.strategy = 'by_kind';
  }

  const saturationLimits: Record<string, unknown>[] = [];

  for (const child of stmt.body) {
    if (child.type === 'block') {
      if (child.name === 'filter' || child.name === 'path' || child.name === 'graph_path') {
        const filter = parseGraphPathBlock(child, ctx);
        if (filter) {
          pushArrayValue(selection, 'filters', filter);
        }
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported selection block "${child.name}"`,
        span: child.span
      });
      continue;
    }

    if (child.type === 'predicate') {
      const direction = mapSaturationDirection(child.keyword);
      if (!direction) {
        ctx.diagnostics.push({
          severity: 'error',
          message: `Unsupported selection predicate "${child.keyword}"`,
          span: child.span
        });
        continue;
      }
      if (!(child.operator === '<=' || child.operator === '<')) {
        ctx.diagnostics.push({
          severity: 'error',
          message: `Saturation limit requires <= value`,
          span: child.span
        });
        continue;
      }
      saturationLimits.push({
        relationshipKind: child.subject,
        direction,
        maxCount: Math.floor(child.value)
      });
      continue;
    }

    if (child.type === 'in') {
      if (child.key === 'subtype' || child.key === 'subtypes') {
        selection.subtypes = child.items.map((item) => valueToJson(item, ctx.diagnostics, ctx.parent));
        continue;
      }
      if (child.key === 'status' || child.key === 'statuses') {
        const statuses = child.items.map((item) => valueToJson(item, ctx.diagnostics, ctx.parent));
        selection.status = statuses.length === 1 ? statuses[0] : statuses;
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported "in" target "${child.key}" in selection`,
        span: child.span
      });
      continue;
    }

    if (child.type === 'attribute') {
      const value = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      if (child.key === 'filter') {
        const filter = parseFilterValue(child.value, ctx, child.span);
        if (filter) {
          pushArrayValue(selection, 'filters', filter);
        }
        continue;
      }
      if (child.key === 'prefer') {
        const filter = parseFilterValue(child.value, ctx, child.span);
        if (filter) {
          pushArrayValue(selection, 'preferFilters', filter);
        }
        continue;
      }
      if (child.key === 'filters') {
        selection.filters = value;
        continue;
      }
      if (child.key === 'preferFilters') {
        selection.preferFilters = value;
        continue;
      }
      if (child.key === 'pick') {
        selection.pickStrategy = value;
        continue;
      }
      if (child.key === 'status') {
        selection.status = value;
        continue;
      }
      if (child.key === 'subtype') {
        selection.subtypes = [value];
        continue;
      }
      if (child.key === 'max') {
        selection.maxResults = value;
        continue;
      }
      selection[child.key] = value;
      continue;
    }

    if (child.type === 'from') {
      ctx.diagnostics.push({
        severity: 'error',
        message: 'from is not valid in selection blocks',
        span: child.span
      });
      continue;
    }

    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported selection statement "${child.type}"`,
      span: child.span
    });
  }

  if (saturationLimits.length > 0) {
    selection.saturationLimits = saturationLimits;
  }

  if (selection.pickStrategy === undefined) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'selection requires explicit pick strategy',
      span: stmt.span
    });
  }

  if (!selection.kind && !selection.kinds) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'selection requires kind or kinds',
      span: stmt.span
    });
    return { selection: null, targetAlias };
  }

  return { selection, targetAlias };
}

function buildVariableFromStatements(
  stmt: Extract<StatementNode, { type: 'block' }>,
  ctx: GeneratorContext
): Record<string, unknown> {
  const variable: Record<string, unknown> = {};
  const select: Record<string, unknown> = {};

  for (const child of stmt.body) {
    if (child.type === 'from') {
      if (child.source === 'graph') {
        select.from = 'graph';
      } else {
        const relatedTo = resolveRequiredRefName(child.source, ctx, child.span, 'relatedTo');
        if (!relatedTo) continue;
        select.from = {
          relatedTo,
          relationshipKind: child.relationship,
          direction: child.direction
        };
      }
      continue;
    }

    if (child.type === 'block') {
      if (child.name === 'filter' || child.name === 'path' || child.name === 'graph_path') {
        const filter = parseGraphPathBlock(child, ctx);
        if (filter) {
          pushArrayValue(select, 'filters', filter);
        }
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported let block "${child.name}"`,
        span: child.span
      });
      continue;
    }

    if (child.type === 'in') {
      if (child.key === 'subtype' || child.key === 'subtypes') {
        select.subtypes = child.items.map((item) => valueToJson(item, ctx.diagnostics, ctx.parent));
        continue;
      }
      if (child.key === 'status' || child.key === 'statuses') {
        const statuses = child.items.map((item) => valueToJson(item, ctx.diagnostics, ctx.parent));
        select.status = statuses.length === 1 ? statuses[0] : statuses;
        continue;
      }
      ctx.diagnostics.push({
        severity: 'error',
        message: `Unsupported "in" target "${child.key}" in let`,
        span: child.span
      });
      continue;
    }

    if (child.type === 'attribute') {
      const value = valueToJson(child.value, ctx.diagnostics, ctx.parent);
      if (child.key === 'filter') {
        const filter = parseFilterValue(child.value, ctx, child.span);
        if (filter) {
          pushArrayValue(select, 'filters', filter);
        }
        continue;
      }
      if (child.key === 'prefer') {
        const filter = parseFilterValue(child.value, ctx, child.span);
        if (filter) {
          pushArrayValue(select, 'preferFilters', filter);
        }
        continue;
      }
      if (child.key === 'filters') {
        select.filters = value;
        continue;
      }
      if (child.key === 'preferFilters') {
        select.preferFilters = value;
        continue;
      }
      if (child.key === 'pick') {
        select.pickStrategy = value;
        continue;
      }
      if (child.key === 'status') {
        select.status = value;
        continue;
      }
      if (child.key === 'subtype') {
        select.subtypes = [value];
        continue;
      }
      if (child.key === 'required') {
        variable.required = value;
        continue;
      }
      if (child.key === 'select' && isRecord(value)) {
        Object.assign(select, value);
        continue;
      }
      select[child.key] = value;
      continue;
    }

    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported let statement "${child.type}"`,
      span: child.span
    });
  }

  if (select.pickStrategy === undefined) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'let requires explicit pick strategy',
      span: stmt.span
    });
  }

  normalizeRefsInObject(select, ctx);

  variable.select = select;
  return variable;
}

function applyLabeledAttributeDsl(
  stmt: Extract<StatementNode, { type: 'attribute' }>,
  obj: Record<string, unknown>,
  ctx: GeneratorContext
): boolean {
  const key = stmt.key;
  const labels = stmt.labels || [];
  if (labels.length === 0) return false;

  if (key === 'create') {
    return addCreationEntryDsl(labels, stmt.value, obj, ctx);
  }
  if (key === 'relationship' || key === 'rel') {
    return addRelationshipEntryDsl(labels, stmt.value, obj, ctx);
  }
  if (key === 'var' || key === 'variable' || key === 'let') {
    return addVariableEntryDsl(labels, stmt.value, obj, ctx);
  }
  if (key === 'applicability') {
    return addApplicabilityEntry(labels, stmt.value, obj, ctx.diagnostics, ctx.parent);
  }

  return false;
}

function addCreationEntryDsl(
  labels: string[],
  rawValue: Value | Record<string, unknown>,
  obj: Record<string, unknown>,
  ctx: GeneratorContext
): boolean {
  const label = labels[0];
  if (!label) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'create requires an entity label',
      span: ctx.parent.span
    });
    return true;
  }
  const normalizedLabel = normalizeDeclaredBinding(label, ctx);
  if (!normalizedLabel) return true;

  const value = isRecord(rawValue)
    ? rawValue
    : valueToJson(rawValue as Value, ctx.diagnostics, ctx.parent);
  if (!isRecord(value)) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'create entries must be objects',
      span: ctx.parent.span
    });
    return true;
  }

  value.entityRef = normalizedLabel;
  normalizeRefsInObject(value, ctx);
  pushArrayValue(obj, 'creation', value);
  return true;
}

function addRelationshipEntryDsl(
  labels: string[],
  rawValue: Value | Record<string, unknown>,
  obj: Record<string, unknown>,
  ctx: GeneratorContext
): boolean {
  const [kind, src, dst] = labels;
  if (!kind || !src || !dst) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'relationship requires labels: <kind> <src> <dst>',
      span: ctx.parent.span
    });
    return true;
  }

  const value = isRecord(rawValue)
    ? rawValue
    : valueToJson(rawValue as Value, ctx.diagnostics, ctx.parent);
  if (!isRecord(value)) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'relationship entries must be objects',
      span: ctx.parent.span
    });
    return true;
  }

  const normalizedSrc = resolveRequiredRefName(src, ctx, ctx.parent.span, 'src');
  const normalizedDst = resolveRequiredRefName(dst, ctx, ctx.parent.span, 'dst');
  if (!normalizedSrc || !normalizedDst) return true;

  value.kind = kind;
  value.src = normalizedSrc;
  value.dst = normalizedDst;
  if (value.strength === undefined) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'relationship requires explicit strength',
      span: ctx.parent.span
    });
  }

  normalizeRefsInObject(value, ctx);
  pushArrayValue(obj, 'relationships', value);
  return true;
}

function addVariableEntryDsl(
  labels: string[],
  rawValue: Value | Record<string, unknown>,
  obj: Record<string, unknown>,
  ctx: GeneratorContext
): boolean {
  const varName = labels[0];
  if (!varName) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'let requires a variable name label',
      span: ctx.parent.span
    });
    return true;
  }

  const normalizedName = normalizeDeclaredBinding(varName, ctx);
  if (!normalizedName) return true;

  const value = isRecord(rawValue)
    ? rawValue
    : valueToJson(rawValue as Value, ctx.diagnostics, ctx.parent);
  if (!isRecord(value)) {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'let entries must be objects',
      span: ctx.parent.span
    });
    return true;
  }

  normalizeRefsInObject(value, ctx);

  const existingVariables = obj.variables;
  let variables: Record<string, unknown>;
  if (existingVariables === undefined) {
    variables = {};
    obj.variables = variables;
  } else if (isRecord(existingVariables)) {
    variables = existingVariables;
  } else {
    ctx.diagnostics.push({
      severity: 'error',
      message: 'variables must be an object',
      span: ctx.parent.span
    });
    return true;
  }

  if (Object.prototype.hasOwnProperty.call(variables, normalizedName)) {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Duplicate variable "${normalizedName}"`,
      span: ctx.parent.span
    });
    return true;
  }

  variables[normalizedName] = value;
  return true;
}

function addMutationEntryDsl(
  stmt: Extract<StatementNode, { type: 'mutate' }>,
  obj: Record<string, unknown>,
  ctx: GeneratorContext
): void {
  if (stmt.target !== 'pressure') {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unsupported mutate target "${stmt.target}"`,
      span: stmt.span
    });
    return;
  }

  const delta = stmt.operator === '-=' ? -stmt.value : stmt.value;
  const mutation = {
    type: 'modify_pressure',
    pressureId: stmt.id,
    delta
  };
  pushArrayValue(obj, 'stateUpdates', mutation);
}

function normalizeDeclaredBinding(name: string, ctx: GeneratorContext): string | null {
  if (name.includes('.')) {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Invalid binding name "${name}"`,
      span: ctx.parent.span
    });
    return null;
  }
  const bare = name.startsWith('$') ? name.slice(1) : name;
  const normalized = name.startsWith('$') ? name : `$${name}`;
  ctx.bindings.set(bare, normalized);
  return normalized;
}

function resolveRequiredRefName(
  name: string,
  ctx: GeneratorContext,
  span: BlockNode['span'],
  label: string
): string | null {
  if (name === 'any') return name;
  const normalized = normalizeRefName(name, ctx);
  const base = normalized.startsWith('$') ? normalized.slice(1).split('.')[0] : normalized.split('.')[0];
  if (!ctx.bindings.has(base) && !normalized.startsWith('$')) {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unknown reference "${name}" in ${label} (declare before use or quote literal)`,
      span
    });
    return null;
  }
  return normalized;
}

function normalizeRefName(name: string, ctx: GeneratorContext): string {
  if (name.startsWith('$')) return name;
  const [base, ...rest] = name.split('.');
  const bound = ctx.bindings.get(base);
  if (!bound) return name;
  const suffix = rest.length > 0 ? `.${rest.join('.')}` : '';
  return bound + suffix;
}

function normalizeRefsInObject(value: Record<string, unknown>, ctx: GeneratorContext): void {
  const refKeys = new Set(['entityRef', 'src', 'dst', 'entity', 'with', 'relatedTo', 'referenceEntity', 'catalyzedBy', 'inherit', 'ref']);
  const refListKeys = new Set(['entities']);

  for (const [key, entry] of Object.entries(value)) {
    if (refKeys.has(key) && typeof entry === 'string') {
      value[key] = normalizeRefName(entry, ctx);
      continue;
    }
    if (refListKeys.has(key) && Array.isArray(entry)) {
      entry.forEach((item, index) => {
        if (typeof item === 'string') {
          entry[index] = normalizeRefName(item, ctx);
        } else if (isRecord(item)) {
          normalizeRefsInObject(item, ctx);
        }
      });
      continue;
    }
    if (Array.isArray(entry)) {
      entry.forEach((item) => {
        if (isRecord(item)) {
          normalizeRefsInObject(item, ctx);
        }
      });
      continue;
    }
    if (isRecord(entry)) {
      if (key === 'replacements') {
        for (const [repKey, repValue] of Object.entries(entry)) {
          if (typeof repValue === 'string') {
            entry[repKey] = normalizeRefName(repValue, ctx);
          }
        }
        continue;
      }
      normalizeRefsInObject(entry, ctx);
    }
  }
}

function mapSaturationDirection(keyword: string): string | null {
  if (keyword === 'inbound' || keyword === 'in') return 'in';
  if (keyword === 'outbound' || keyword === 'out') return 'out';
  if (keyword === 'both') return 'both';
  return null;
}

function buildObjectFromStatements(
  statements: StatementNode[],
  diagnostics: Diagnostic[],
  parent: BlockNode
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  for (const stmt of statements) {
    if (stmt.type === 'attribute') {
      if (stmt.labels && stmt.labels.length > 0) {
        if (applyLabeledAttribute(stmt, obj, diagnostics, parent)) {
          continue;
        }
      }
      const value = valueToJson(stmt.value, diagnostics, parent);
      setObjectValue(obj, stmt.key, value);
      continue;
    }

    if (stmt.type === 'block') {
      if (applySpecialBlock(stmt, obj, diagnostics)) {
        continue;
      }
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

function applyLabeledAttribute(
  stmt: Extract<StatementNode, { type: 'attribute' }>,
  obj: Record<string, unknown>,
  diagnostics: Diagnostic[],
  parent: BlockNode
): boolean {
  const key = stmt.key;
  const labels = stmt.labels || [];
  if (labels.length === 0) return false;

  if (key === 'create') {
    return addCreationEntry(labels, stmt.value, obj, diagnostics, parent);
  }
  if (key === 'relationship' || key === 'rel') {
    return addRelationshipEntry(labels, stmt.value, obj, diagnostics, parent);
  }
  if (key === 'var' || key === 'variable' || key === 'let') {
    return addVariableEntry(labels, stmt.value, obj, diagnostics, parent);
  }
  if (key === 'applicability') {
    return addApplicabilityEntry(labels, stmt.value, obj, diagnostics, parent);
  }

  return false;
}

function applySpecialBlock(
  stmt: BlockNode,
  obj: Record<string, unknown>,
  diagnostics: Diagnostic[]
): boolean {
  const key = stmt.name;
  if (key === 'create') {
    return addCreationEntry(stmt.labels, buildObjectFromStatements(stmt.body, diagnostics, stmt), obj, diagnostics, stmt);
  }
  if (key === 'relationship' || key === 'rel') {
    return addRelationshipEntry(stmt.labels, buildObjectFromStatements(stmt.body, diagnostics, stmt), obj, diagnostics, stmt);
  }
  if (key === 'var' || key === 'variable' || key === 'let') {
    return addVariableEntry(stmt.labels, buildObjectFromStatements(stmt.body, diagnostics, stmt), obj, diagnostics, stmt);
  }
  if (key === 'applicability') {
    return addApplicabilityEntry(stmt.labels, buildObjectFromStatements(stmt.body, diagnostics, stmt), obj, diagnostics, stmt);
  }
  return false;
}

function addCreationEntry(
  labels: string[],
  rawValue: Value | Record<string, unknown>,
  obj: Record<string, unknown>,
  diagnostics: Diagnostic[],
  parent: BlockNode
): boolean {
  const entityRef = labels[0];
  if (!entityRef) {
    diagnostics.push({
      severity: 'error',
      message: 'create requires an entityRef label',
      span: parent.span
    });
    return true;
  }

  const value = isRecord(rawValue)
    ? rawValue
    : valueToJson(rawValue as Value, diagnostics, parent);
  if (!isRecord(value)) {
    diagnostics.push({
      severity: 'error',
      message: 'create entries must be objects',
      span: parent.span
    });
    return true;
  }

  const existingRef = value.entityRef;
  if (existingRef !== undefined) {
    if (typeof existingRef !== 'string') {
      diagnostics.push({
        severity: 'error',
        message: 'create entityRef must be a string',
        span: parent.span
      });
      return true;
    }
    if (existingRef !== entityRef) {
      diagnostics.push({
        severity: 'error',
        message: `create entityRef mismatch: label "${entityRef}" vs value "${existingRef}"`,
        span: parent.span
      });
      return true;
    }
  } else {
    value.entityRef = entityRef;
  }

  pushArrayValue(obj, 'creation', value);
  return true;
}

function addRelationshipEntry(
  labels: string[],
  rawValue: Value | Record<string, unknown>,
  obj: Record<string, unknown>,
  diagnostics: Diagnostic[],
  parent: BlockNode
): boolean {
  const [kind, src, dst] = labels;
  if (!kind || !src || !dst) {
    diagnostics.push({
      severity: 'error',
      message: 'relationship requires labels: <kind> <src> <dst>',
      span: parent.span
    });
    return true;
  }

  const value = isRecord(rawValue)
    ? rawValue
    : valueToJson(rawValue as Value, diagnostics, parent);
  if (!isRecord(value)) {
    diagnostics.push({
      severity: 'error',
      message: 'relationship entries must be objects',
      span: parent.span
    });
    return true;
  }

  if (!applyLabelField(value, 'kind', kind, diagnostics, parent)) return true;
  if (!applyLabelField(value, 'src', src, diagnostics, parent)) return true;
  if (!applyLabelField(value, 'dst', dst, diagnostics, parent)) return true;

  pushArrayValue(obj, 'relationships', value);
  return true;
}

function addVariableEntry(
  labels: string[],
  rawValue: Value | Record<string, unknown>,
  obj: Record<string, unknown>,
  diagnostics: Diagnostic[],
  parent: BlockNode
): boolean {
  const varName = labels[0];
  if (!varName) {
    diagnostics.push({
      severity: 'error',
      message: 'var requires a variable name label',
      span: parent.span
    });
    return true;
  }

  const value = isRecord(rawValue)
    ? rawValue
    : valueToJson(rawValue as Value, diagnostics, parent);
  if (!isRecord(value)) {
    diagnostics.push({
      severity: 'error',
      message: 'var entries must be objects',
      span: parent.span
    });
    return true;
  }

  if (!isRecord(value.select)) {
    const select: Record<string, unknown> = {};
    let moved = false;

    if ('kind' in value) {
      select.kind = value.kind;
      delete value.kind;
      moved = true;
    }
    if ('kinds' in value) {
      select.kinds = value.kinds;
      delete value.kinds;
      moved = true;
    }
    if ('subtypes' in value) {
      select.subtypes = value.subtypes;
      delete value.subtypes;
      moved = true;
    }
    if ('subtype' in value) {
      select.subtypes = [value.subtype];
      delete value.subtype;
      moved = true;
    }
    if ('status' in value) {
      select.status = value.status;
      delete value.status;
      moved = true;
    }
    if ('statuses' in value) {
      select.status = value.statuses;
      delete value.statuses;
      moved = true;
    }
    if ('statusFilter' in value) {
      select.status = value.statusFilter;
      delete value.statusFilter;
      moved = true;
    }
    if ('pickStrategy' in value) {
      select.pickStrategy = value.pickStrategy;
      delete value.pickStrategy;
      moved = true;
    }
    if ('pick' in value) {
      select.pickStrategy = value.pick;
      delete value.pick;
      moved = true;
    }
    if ('from' in value) {
      select.from = value.from;
      delete value.from;
      moved = true;
    }
    if ('filters' in value) {
      select.filters = value.filters;
      delete value.filters;
      moved = true;
    }
    if ('maxResults' in value) {
      select.maxResults = value.maxResults;
      delete value.maxResults;
      moved = true;
    }

    if (moved) {
      value.select = select;
    }
  } else if (isRecord(value.select.from) && 'relationship' in value.select.from && !('relationshipKind' in value.select.from)) {
    value.select.from.relationshipKind = value.select.from.relationship;
    delete value.select.from.relationship;
  }

  const existingVariables = obj.variables;
  let variables: Record<string, unknown>;
  if (existingVariables === undefined) {
    variables = {};
    obj.variables = variables;
  } else if (isRecord(existingVariables)) {
    variables = existingVariables;
  } else {
    diagnostics.push({
      severity: 'error',
      message: 'variables must be an object',
      span: parent.span
    });
    return true;
  }

  if (Object.prototype.hasOwnProperty.call(variables, varName)) {
    diagnostics.push({
      severity: 'error',
      message: `Duplicate variable "${varName}"`,
      span: parent.span
    });
    return true;
  }

  variables[varName] = value;
  return true;
}

function addApplicabilityEntry(
  labels: string[],
  rawValue: Value | Record<string, unknown>,
  obj: Record<string, unknown>,
  diagnostics: Diagnostic[],
  parent: BlockNode
): boolean {
  const typeLabel = labels[0];
  if (!typeLabel) {
    diagnostics.push({
      severity: 'error',
      message: 'applicability requires a type label',
      span: parent.span
    });
    return true;
  }

  const value = isRecord(rawValue)
    ? rawValue
    : valueToJson(rawValue as Value, diagnostics, parent);
  if (!isRecord(value)) {
    diagnostics.push({
      severity: 'error',
      message: 'applicability entries must be objects',
      span: parent.span
    });
    return true;
  }

  if (!applyLabelField(value, 'type', typeLabel, diagnostics, parent)) return true;

  pushArrayValue(obj, 'applicability', value);
  return true;
}

function applyLabelField(
  target: Record<string, unknown>,
  key: string,
  labelValue: string,
  diagnostics: Diagnostic[],
  parent: BlockNode
): boolean {
  const existing = target[key];
  if (existing !== undefined) {
    if (typeof existing !== 'string') {
      diagnostics.push({
        severity: 'error',
        message: `${key} must be a string`,
        span: parent.span
      });
      return false;
    }
    if (existing !== labelValue) {
      diagnostics.push({
        severity: 'error',
        message: `${key} mismatch: label "${labelValue}" vs value "${existing}"`,
        span: parent.span
      });
      return false;
    }
  } else {
    target[key] = labelValue;
  }

  return true;
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

function pushArrayValue(obj: Record<string, unknown>, key: string, value: unknown): void {
  const existing = obj[key];
  if (existing === undefined) {
    obj[key] = [value];
    return;
  }
  if (Array.isArray(existing)) {
    existing.push(value);
    return;
  }
  obj[key] = [existing, value];
}

function validateSeedRelationships(config: Record<string, unknown>, diagnostics: Diagnostic[]): void {
  const entities = config.seedEntities;
  const relationships = config.seedRelationships;
  if (!Array.isArray(entities) || !Array.isArray(relationships)) return;

  const ids = new Set<string>();
  for (const entity of entities) {
    if (isRecord(entity) && typeof entity.id === 'string') {
      ids.add(entity.id);
    }
  }

  for (const rel of relationships) {
    if (!isRecord(rel)) continue;
    const src = rel.src;
    const dst = rel.dst;
    if (typeof src === 'string' && !ids.has(src)) {
      diagnostics.push({
        severity: 'error',
        message: `seed_relationship src "${src}" does not match any seed_entity id`,
        span: undefined
      });
    }
    if (typeof dst === 'string' && !ids.has(dst)) {
      diagnostics.push({
        severity: 'error',
        message: `seed_relationship dst "${dst}" does not match any seed_entity id`,
        span: undefined
      });
    }
  }
}

function parseVariableReference(value: string): { name: string; path: string[] } | null {
  for (const prefix of VARIABLE_REFERENCE_PREFIXES) {
    if (!value.startsWith(prefix)) continue;
    const remainder = value.slice(prefix.length);
    if (!remainder) return null;
    const parts = remainder.split('.').filter(Boolean);
    if (parts.length === 0) return null;
    return { name: parts[0], path: parts.slice(1) };
  }
  return null;
}

function resolveResourceReference(
  value: string,
  ctx: EvalContext | null,
  span: BlockNode['span'],
  diagnostics: Diagnostic[],
  allowedTypes?: string[],
  allowAmbiguous = false
): string | null {
  if (!ctx) return null;
  const parts = value.split('.');
  if (parts.length !== 2) return null;
  const [name, attr] = parts;
  if (!name || attr !== 'id') return null;
  const resources = ctx.resources.get(name) || [];
  const matches = allowedTypes && allowedTypes.length > 0
    ? resources.filter((entry) => allowedTypes.includes(entry.type))
    : resources;
  if (matches.length === 0) return null;
  if (matches.length > 1 && !allowAmbiguous) {
    diagnostics.push({
      severity: 'error',
      message: `Ambiguous resource reference "${value}" (matches ${matches.map(entry => entry.type).join(', ')})`,
      span
    });
    return null;
  }
  return matches[0].id;
}

function parseResourceReferenceString(
  raw: string,
  diagnostics: Diagnostic[],
  span: BlockNode['span'],
  label: string,
  allowedTypes?: string[],
  allowAmbiguous = false
): string | null {
  const parts = raw.split('.');
  if (parts.length !== 2 || parts[1] !== 'id' || !parts[0]) {
    diagnostics.push({
      severity: 'error',
      message: `${label} reference must use "<name>.id"`,
      span
    });
    return null;
  }
  const resolved = resolveResourceReference(raw, activeEvalContext, span, diagnostics, allowedTypes, allowAmbiguous);
  if (resolved === null) {
    diagnostics.push({
      severity: 'error',
      message: `Unknown ${label} reference "${raw}"`,
      span
    });
    return null;
  }
  return resolved;
}

function parseResourceReferenceValue(
  value: Value,
  diagnostics: Diagnostic[],
  parent: BlockNode,
  label: string,
  options?: { allowArray?: boolean; allowedTypes?: string[]; allowAmbiguous?: boolean }
): string | string[] | null {
  if (isArrayValue(value)) {
    if (!options?.allowArray) {
      diagnostics.push({
        severity: 'error',
        message: `${label} reference must be a single "<name>.id"`,
        span: parent.span
      });
      return null;
    }
    const refs: string[] = [];
    for (const item of value.items) {
      const raw = coerceStringValue(item);
      if (!raw) {
        diagnostics.push({
          severity: 'error',
          message: `${label} reference must use "<name>.id"`,
          span: parent.span
        });
        return null;
      }
      const resolved = parseResourceReferenceString(raw, diagnostics, parent.span, label, options?.allowedTypes, options?.allowAmbiguous ?? false);
      if (!resolved) return null;
      refs.push(resolved);
    }
    return refs;
  }

  const raw = coerceStringValue(value);
  if (!raw) {
    diagnostics.push({
      severity: 'error',
      message: `${label} reference must use "<name>.id"`,
      span: parent.span
    });
    return null;
  }
  return parseResourceReferenceString(raw, diagnostics, parent.span, label, options?.allowedTypes, options?.allowAmbiguous ?? false);
}

function parseResourceReferenceLabel(
  label: string | undefined,
  diagnostics: Diagnostic[],
  span: BlockNode['span'],
  name: string,
  allowedTypes?: string[],
  allowAmbiguous = false
): string | null {
  if (!label) {
    diagnostics.push({
      severity: 'error',
      message: `${name} reference must use "<name>.id"`,
      span
    });
    return null;
  }
  return parseResourceReferenceString(label, diagnostics, span, name, allowedTypes, allowAmbiguous);
}

function resolveVariablePath(
  ref: { name: string; path: string[] },
  ctx: EvalContext | null,
  span: BlockNode['span'],
  diagnostics: Diagnostic[]
): unknown {
  if (!ctx) {
    diagnostics.push({
      severity: 'error',
      message: `Unknown variable "${ref.name}"`,
      span
    });
    return null;
  }
  let value = resolveVariableValue(ref.name, ctx, span);
  for (const segment of ref.path) {
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        const index = Number(segment);
        if (Number.isInteger(index)) {
          value = value[index];
          continue;
        }
      }
      if (Object.prototype.hasOwnProperty.call(value, segment)) {
        value = (value as Record<string, unknown>)[segment];
        continue;
      }
    }
    diagnostics.push({
      severity: 'error',
      message: `Unknown variable path "${ref.name}.${ref.path.join('.')}"`,
      span
    });
    return null;
  }
  return value;
}

function resolveVariableValue(
  name: string,
  ctx: EvalContext,
  span: BlockNode['span']
): unknown {
  if (ctx.resolved.has(name)) {
    return ctx.resolved.get(name);
  }
  if (ctx.resolving.has(name)) {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Circular variable reference "${name}"`,
      span
    });
    return null;
  }
  const entry = ctx.variables.get(name);
  if (!entry) {
    ctx.diagnostics.push({
      severity: 'error',
      message: `Unknown variable "${name}"`,
      span
    });
    return null;
  }

  ctx.resolving.add(name);
  const parent: BlockNode = {
    type: 'block',
    name: 'vars',
    labels: [],
    body: [],
    span: entry.span
  };
  const resolved = valueToJson(entry.value, ctx.diagnostics, parent);
  ctx.resolving.delete(name);
  ctx.resolved.set(name, resolved);
  return resolved;
}

function evaluateCallExpression(
  call: CallValue,
  diagnostics: Diagnostic[],
  parent: BlockNode
): unknown {
  const name = call.name;
  const args = call.args || [];

  const evaluateArg = (index: number): unknown => {
    if (index < 0 || index >= args.length) return null;
    return valueToJson(args[index], diagnostics, parent);
  };

  const requireArgs = (min: number, max?: number): boolean => {
    if (args.length < min || (max !== undefined && args.length > max)) {
      const range = max !== undefined ? `${min}-${max}` : `${min}+`;
      diagnostics.push({
        severity: 'error',
        message: `${name} requires ${range} argument(s)`,
        span: call.span
      });
      return false;
    }
    return true;
  };

  const ensureArray = (value: unknown, index: number): unknown[] | null => {
    if (!Array.isArray(value)) {
      diagnostics.push({
        severity: 'error',
        message: `${name} argument ${index + 1} must be an array`,
        span: call.span
      });
      return null;
    }
    return value;
  };

  const ensureObject = (value: unknown, index: number): Record<string, unknown> | null => {
    if (!isRecord(value)) {
      diagnostics.push({
        severity: 'error',
        message: `${name} argument ${index + 1} must be an object`,
        span: call.span
      });
      return null;
    }
    return value;
  };

  const ensureString = (value: unknown, index: number): string | null => {
    if (typeof value !== 'string') {
      diagnostics.push({
        severity: 'error',
        message: `${name} argument ${index + 1} must be a string`,
        span: call.span
      });
      return null;
    }
    return value;
  };

  const ensureBoolean = (value: unknown, index: number): boolean | null => {
    if (typeof value !== 'boolean') {
      diagnostics.push({
        severity: 'error',
        message: `${name} argument ${index + 1} must be a boolean`,
        span: call.span
      });
      return null;
    }
    return value;
  };

  if (name === 'if') {
    if (!requireArgs(3, 3)) return null;
    const condition = evaluateArg(0);
    const bool = ensureBoolean(condition, 0);
    if (bool === null) return null;
    return bool ? evaluateArg(1) : evaluateArg(2);
  }

  if (name === 'coalesce') {
    if (!requireArgs(1)) return null;
    for (let i = 0; i < args.length; i += 1) {
      const value = evaluateArg(i);
      if (value !== null && value !== undefined) return value;
    }
    return null;
  }

  if (name === 'default') {
    if (!requireArgs(2, 2)) return null;
    const primary = evaluateArg(0);
    return primary === null || primary === undefined ? evaluateArg(1) : primary;
  }

  if (name === 'merge') {
    if (!requireArgs(1)) return null;
    const result: Record<string, unknown> = {};
    for (let i = 0; i < args.length; i += 1) {
      const value = evaluateArg(i);
      const obj = ensureObject(value, i);
      if (!obj) return null;
      Object.assign(result, obj);
    }
    return result;
  }

  if (name === 'concat') {
    if (!requireArgs(1)) return null;
    const result: unknown[] = [];
    for (let i = 0; i < args.length; i += 1) {
      const value = evaluateArg(i);
      const list = ensureArray(value, i);
      if (!list) return null;
      result.push(...list);
    }
    return result;
  }

  if (name === 'distinct') {
    if (!requireArgs(1, 1)) return null;
    const list = ensureArray(evaluateArg(0), 0);
    if (!list) return null;
    const output: unknown[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      if (item === null || item === undefined) continue;
      if (typeof item === 'object') {
        diagnostics.push({
          severity: 'error',
          message: `${name} only supports primitive values`,
          span: call.span
        });
        return null;
      }
      const key = `${typeof item}:${String(item)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(item);
    }
    return output;
  }

  if (name === 'sort') {
    if (!requireArgs(1, 1)) return null;
    const list = ensureArray(evaluateArg(0), 0);
    if (!list) return null;
    const numbers = list.every((item) => typeof item === 'number');
    const strings = list.every((item) => typeof item === 'string');
    if (!numbers && !strings) {
      diagnostics.push({
        severity: 'error',
        message: `${name} only supports string or number arrays`,
        span: call.span
      });
      return null;
    }
    const copy = [...list];
    if (numbers) {
      copy.sort((a, b) => (a as number) - (b as number));
    } else {
      copy.sort((a, b) => String(a).localeCompare(String(b)));
    }
    return copy;
  }

  if (name === 'join') {
    if (!requireArgs(2, 2)) return null;
    const separator = ensureString(evaluateArg(0), 0);
    const list = ensureArray(evaluateArg(1), 1);
    if (!separator || !list) return null;
    if (!list.every((item) => typeof item === 'string')) {
      diagnostics.push({
        severity: 'error',
        message: `${name} list must contain only strings`,
        span: call.span
      });
      return null;
    }
    return (list as string[]).join(separator);
  }

  if (name === 'upper' || name === 'lower') {
    if (!requireArgs(1, 1)) return null;
    const value = ensureString(evaluateArg(0), 0);
    if (!value) return null;
    return name === 'upper' ? value.toUpperCase() : value.toLowerCase();
  }

  if (name === 'replace') {
    if (!requireArgs(3, 3)) return null;
    const source = ensureString(evaluateArg(0), 0);
    const match = ensureString(evaluateArg(1), 1);
    const replacement = ensureString(evaluateArg(2), 2);
    if (!source || match === null || replacement === null) return null;
    return source.split(match).join(replacement);
  }

  if (name === 'lookup') {
    if (!requireArgs(2, 3)) return null;
    const target = ensureObject(evaluateArg(0), 0);
    const key = ensureString(evaluateArg(1), 1);
    if (!target || !key) return null;
    if (Object.prototype.hasOwnProperty.call(target, key)) {
      return target[key];
    }
    return args.length === 3 ? evaluateArg(2) : null;
  }

  if (name === 'keys' || name === 'values') {
    if (!requireArgs(1, 1)) return null;
    const target = ensureObject(evaluateArg(0), 0);
    if (!target) return null;
    return name === 'keys' ? Object.keys(target) : Object.values(target);
  }

  if (name === 'length') {
    if (!requireArgs(1, 1)) return null;
    const target = evaluateArg(0);
    if (typeof target === 'string' || Array.isArray(target)) {
      return target.length;
    }
    if (isRecord(target)) {
      return Object.keys(target).length;
    }
    diagnostics.push({
      severity: 'error',
      message: `${name} only supports strings, arrays, or objects`,
      span: call.span
    });
    return null;
  }

  if (name === 'and' || name === 'or') {
    if (!requireArgs(1)) return null;
    const values = args.map((_, index) => evaluateArg(index));
    if (!values.every((value) => typeof value === 'boolean')) {
      diagnostics.push({
        severity: 'error',
        message: `${name} only supports boolean arguments`,
        span: call.span
      });
      return null;
    }
    return name === 'and'
      ? values.every(Boolean)
      : values.some(Boolean);
  }

  if (name === 'not') {
    if (!requireArgs(1, 1)) return null;
    const value = ensureBoolean(evaluateArg(0), 0);
    if (value === null) return null;
    return !value;
  }

  diagnostics.push({
    severity: 'error',
    message: `Unsupported call "${name}"`,
    span: call.span
  });
  return null;
}

function valueToJson(value: Value, diagnostics: Diagnostic[], parent: BlockNode): unknown {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (isIdentifierValue(value)) {
    const ref = parseVariableReference(value.value);
    if (ref) {
      return resolveVariablePath(ref, activeEvalContext, value.span, diagnostics);
    }
    return value.value;
  }

  if (isCallValue(value)) {
    return evaluateCallExpression(value, diagnostics, parent);
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

function isCallValue(value: Value): value is CallValue {
  return typeof value === 'object' && value !== null && (value as CallValue).type === 'call';
}

function isArrayValue(value: Value): value is ArrayValue {
  return typeof value === 'object' && value !== null && (value as ArrayValue).type === 'array';
}

function isObjectValue(value: Value): value is ObjectValue {
  return typeof value === 'object' && value !== null && (value as ObjectValue).type === 'object';
}

function isValueNode(value: unknown): value is Value {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as { type?: string }).type;
  if (type === 'identifier') {
    return typeof (value as IdentifierValue).value === 'string';
  }
  if (type === 'array') {
    return Array.isArray((value as ArrayValue).items);
  }
  if (type === 'object') {
    return Array.isArray((value as ObjectValue).entries);
  }
  if (type === 'call') {
    return typeof (value as CallValue).name === 'string';
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !isValueNode(value);
}
