const INDENT = '  ';
const KEYWORDS = new Set(['do', 'end', 'true', 'false', 'null']);
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const QUALIFIED_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)+$/;
const KIND_SUBTYPE_RE = /^[A-Za-z_][A-Za-z0-9_-]*:[A-Za-z_][A-Za-z0-9_-]*$/;
const VARIABLE_RE = /^\$[A-Za-z_][A-Za-z0-9_-]*(\.[A-Za-z_][A-Za-z0-9_-]*)*$/;
const REF_KEYS = new Set([
  'entityRef',
  'src',
  'dst',
  'entity',
  'with',
  'relatedTo',
  'referenceEntity',
  'catalyzedBy',
  'inherit',
  'ref'
]);
const REF_LIST_KEYS = new Set(['entities']);

export interface CanonFile {
  path: string;
  content: string;
}

export interface StaticPageRecord {
  title?: string;
  slug?: string;
  summary?: string;
  status?: string;
  seedId?: string;
  content?: string;
  [key: string]: unknown;
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

interface StaticPageSerializeOptions extends SerializeOptions {
  pageDir?: string;
}

interface NamingResourceBuckets {
  domains: Record<string, unknown>[];
  grammars: Record<string, unknown>[];
  profiles: Record<string, unknown>[];
  lexemeSpecs: Record<string, unknown>[];
  lexemeLists: Record<string, unknown>[];
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

function collectNamingResourcesFromCultures(cultures: Record<string, unknown>[]): NamingResourceBuckets {
  const resources: NamingResourceBuckets = {
    domains: [],
    grammars: [],
    profiles: [],
    lexemeSpecs: [],
    lexemeLists: []
  };

  for (const culture of cultures) {
    if (!isRecord(culture) || typeof culture.id !== 'string') continue;
    const cultureId = culture.id;
    const naming = culture.naming;
    if (!isRecord(naming)) continue;

    const domains = Array.isArray(naming.domains) ? naming.domains : [];
    for (const domain of domains) {
      if (!isRecord(domain)) continue;
      resources.domains.push({ ...domain, cultureId });
    }

    const grammars = Array.isArray(naming.grammars) ? naming.grammars : [];
    for (const grammar of grammars) {
      if (!isRecord(grammar)) continue;
      resources.grammars.push({ ...grammar, cultureId });
    }

    const profiles = Array.isArray(naming.profiles) ? naming.profiles : [];
    for (const profile of profiles) {
      if (!isRecord(profile)) continue;
      resources.profiles.push({ ...profile, cultureId });
    }

    const specs = Array.isArray(naming.lexemeSpecs) ? naming.lexemeSpecs : [];
    for (const spec of specs) {
      if (!isRecord(spec)) continue;
      resources.lexemeSpecs.push({ ...spec, cultureId });
    }

    const lexemeLists = naming.lexemeLists;
    if (isRecord(lexemeLists)) {
      for (const [id, list] of Object.entries(lexemeLists)) {
        if (!isRecord(list)) continue;
        resources.lexemeLists.push({ id, ...list, cultureId });
      }
    } else if (Array.isArray(lexemeLists)) {
      for (const list of lexemeLists) {
        if (!isRecord(list)) continue;
        resources.lexemeLists.push({ ...list, cultureId });
      }
    }
  }

  resources.domains = mergeNamingResourceEntries(resources.domains);
  resources.grammars = mergeNamingResourceEntries(resources.grammars);
  resources.profiles = mergeNamingResourceEntries(resources.profiles);
  resources.lexemeSpecs = mergeNamingResourceEntries(resources.lexemeSpecs);
  resources.lexemeLists = mergeNamingResourceEntries(resources.lexemeLists);

  return resources;
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

function mergeNamingResourceEntries(entries: Record<string, unknown>[]): Record<string, unknown>[] {
  const grouped = new Map<string, Map<string, { item: Record<string, unknown>; cultures: Set<string> }>>();

  for (const entry of entries) {
    if (!isRecord(entry)) continue;
    const id = entry.id;
    if (typeof id !== 'string') continue;
    const signature = signatureForNamingResource(entry);
    const bySignature = grouped.get(id) ?? new Map();
    const existing = bySignature.get(signature);
    const cultureValues = entry.cultureId;
    const cultureIds: string[] = [];
    if (typeof cultureValues === 'string') {
      cultureIds.push(cultureValues);
    } else if (Array.isArray(cultureValues)) {
      cultureValues.forEach((value) => {
        if (typeof value === 'string') cultureIds.push(value);
      });
    }
    if (existing) {
      cultureIds.forEach((value) => existing.cultures.add(value));
    } else {
      const cultures = new Set<string>(cultureIds);
      bySignature.set(signature, { item: entry, cultures });
    }
    grouped.set(id, bySignature);
  }

  const merged: Record<string, unknown>[] = [];
  for (const [, bySignature] of grouped.entries()) {
    for (const { item, cultures } of bySignature.values()) {
      const cultureId = Array.from(cultures).sort((a, b) => a.localeCompare(b));
      const mergedItem = { ...item };
      mergedItem.cultureId = cultureId.length === 1 ? cultureId[0] : cultureId;
      merged.push(mergedItem);
    }
  }

  return merged;
}

function formatNamingResourceBlocks(resources: NamingResourceBuckets): string[] {
  const blocks: string[] = [];

  const sortById = (items: Record<string, unknown>[]) =>
    items.sort((a, b) => {
      const aId = typeof a.id === 'string' ? a.id : '';
      const bId = typeof b.id === 'string' ? b.id : '';
      return aId.localeCompare(bId);
    });

  for (const domain of sortById(resources.domains)) {
    if (!isRecord(domain)) continue;
    const lines = formatNamingDomainBlock(domain, 0);
    if (lines) blocks.push(lines.join('\n'));
  }

  for (const grammar of sortById(resources.grammars)) {
    if (!isRecord(grammar)) continue;
    const lines = formatGrammarBlock(grammar, 0);
    if (lines) blocks.push(lines.join('\n'));
  }

  for (const profile of sortById(resources.profiles)) {
    if (!isRecord(profile)) continue;
    const lines = formatProfileBlock(profile, 0);
    if (lines) blocks.push(lines.join('\n'));
  }

  for (const spec of sortById(resources.lexemeSpecs)) {
    if (!isRecord(spec)) continue;
    const lines = formatLexemeSpecBlock(spec, 0);
    if (lines) blocks.push(lines.join('\n'));
  }

  for (const list of sortById(resources.lexemeLists)) {
    if (!isRecord(list)) continue;
    const id = list.id;
    if (typeof id !== 'string') continue;
    const payload = { ...list };
    delete payload.id;
    const lines = formatLexemeListBlock(id, payload, 0);
    if (lines) blocks.push(lines.join('\n'));
  }

  return blocks;
}

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
    const namingBlocks =
      def.block === 'culture'
        ? formatNamingResourceBlocks(collectNamingResourcesFromCultures(items.filter(isRecord) as Record<string, unknown>[]))
        : null;
    for (const item of items) {
      if (!isRecord(item)) continue;
      if (def.block === 'system') {
        const block = formatSystemBlock(item);
        if (block) blocks.push(block);
        continue;
      }
      if (def.block === 'axis') {
        const line = formatAxisLine(item);
        if (line) blocks.push(line);
        continue;
      }
      if (def.block === 'relationship_kind') {
        const line = formatRelationshipKindLine(item);
        if (line) blocks.push(line);
        continue;
      }
      if (def.block === 'tag') {
        const line = formatTagLine(item);
        if (line) blocks.push(line);
        continue;
      }
      if (def.block === 'seed_relationship') {
        const block = formatSeedRelationshipBlock(item);
        if (block) blocks.push(block);
        continue;
      }
      if (def.block === 'seed_entity') {
        const block = formatSeedEntityBlock(item);
        if (block) blocks.push(block);
        continue;
      }
      if (def.block === 'entity_kind') {
        const block = formatEntityKindBlock(item);
        if (block) blocks.push(block);
        continue;
      }
      if (def.block === 'culture') {
        const block = formatCultureBlock(item);
        if (block) blocks.push(block);
        continue;
      }
      if (def.block === 'action') {
        const block = formatActionBlock(item);
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

    if (namingBlocks && namingBlocks.length > 0) {
      blocks.push(...namingBlocks);
    }

    files.push({
      path: def.file,
      content: blocks.join('\n\n')
    });
  }

  return files;
}

export function serializeCanonStaticPages(
  pages: StaticPageRecord[],
  options: StaticPageSerializeOptions = {}
): CanonFile[] {
  const includeEmpty = options.includeEmpty ?? true;
  const pageDir = normalizeStaticPageDir(options.pageDir ?? 'page');
  const pagePrefix = pageDir ? `${pageDir}/` : '';
  const files: CanonFile[] = [];
  const blocks: string[] = [];
  const usedNames = new Set<string>();

  for (const page of pages || []) {
    if (!isRecord(page)) continue;
    const title = typeof page.title === 'string' && page.title.length > 0 ? page.title : 'Untitled';
    const inferredSlug = generateStaticPageSlug(title);
    const slug = typeof page.slug === 'string' && page.slug.length > 0 ? page.slug : inferredSlug;
    const filename = resolveStaticPageFilename(slug, usedNames);
    const outputPath = `${pagePrefix}${filename}`;

    const blockLines: string[] = [];
    blockLines.push(`static_page ${formatLabel(title)} do`);

    const remaining: Record<string, unknown> = { ...page };
    delete remaining.title;
    delete remaining.slug;
    delete remaining.content;

    if (page.seedId !== undefined) {
      pushAttributeLine(blockLines, 'seedId', page.seedId, 1);
      delete remaining.seedId;
    } else if ((remaining as Record<string, unknown>).seed_id !== undefined) {
      pushAttributeLine(blockLines, 'seedId', (remaining as Record<string, unknown>).seed_id, 1);
      delete (remaining as Record<string, unknown>).seed_id;
    }

    if (page.summary !== undefined) {
      pushAttributeLine(blockLines, 'summary', page.summary, 1);
      delete remaining.summary;
    }

    if (page.status !== undefined) {
      pushAttributeLine(blockLines, 'status', page.status, 1);
      delete remaining.status;
    }

    if (page.slug !== undefined && page.slug !== inferredSlug) {
      pushAttributeLine(blockLines, 'slug', page.slug, 1);
    }

    const extraLines = formatAttributeLines(remaining, 1);
    if (extraLines.length > 0) {
      blockLines.push(...extraLines);
    }

    blockLines.push(`${indent(1)}content:read(${quoteString(outputPath)})`);
    blockLines.push('end');
    blocks.push(blockLines.join('\n'));

    files.push({
      path: outputPath,
      content: typeof page.content === 'string' ? page.content : ''
    });
  }

  if (blocks.length > 0 || includeEmpty) {
    files.unshift({
      path: 'static_pages.canon',
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

function formatGeneratorBlock(labels: string[], body: Record<string, unknown>): string {
  const header = `generator${labels.length > 0 ? ' ' + labels.map(formatLabel).join(' ') : ''} do`;
  const lines = [header];
  const remaining = { ...body };

  const applicabilityLines = formatApplicabilityBlock(remaining.applicability, 1);
  if (applicabilityLines) {
    delete remaining.applicability;
    lines.push(...applicabilityLines);
  } else if (remaining.applicability !== undefined) {
    const value = cloneAndStripRefs(remaining.applicability);
    delete remaining.applicability;
    pushAttributeLine(lines, 'applicability', value, 1);
  }

  const selectionLines = formatSelectionBlock(remaining.selection, 1);
  if (selectionLines) {
    delete remaining.selection;
    lines.push(...selectionLines);
  } else if (remaining.selection !== undefined) {
    const value = cloneAndStripRefs(remaining.selection);
    delete remaining.selection;
    pushAttributeLine(lines, 'selection', value, 1);
  }

  const variableLines = formatVariableEntries(remaining.variables as Record<string, unknown> | undefined, 1);
  if (variableLines) {
    delete remaining.variables;
    lines.push(...variableLines);
  } else if (remaining.variables !== undefined) {
    const value = cloneAndStripRefs(remaining.variables);
    delete remaining.variables;
    pushAttributeLine(lines, 'variables', value, 1);
  }

  if (Array.isArray(remaining.creation)) {
    const creationValue = remaining.creation;
    const creationLines = formatCreationEntries(creationValue, 1);
    delete remaining.creation;
    if (creationLines && creationLines.length > 0) {
      lines.push(...creationLines);
    } else {
      pushAttributeLine(lines, 'creation', cloneAndStripRefs(creationValue), 1);
    }
  } else if (remaining.creation !== undefined) {
    const value = cloneAndStripRefs(remaining.creation);
    delete remaining.creation;
    pushAttributeLine(lines, 'creation', value, 1);
  }

  if (Array.isArray(remaining.relationships)) {
    const relationshipValue = remaining.relationships;
    const relationshipLines = formatRelationshipEntries(relationshipValue, 1);
    delete remaining.relationships;
    if (relationshipLines && relationshipLines.length > 0) {
      lines.push(...relationshipLines);
    } else {
      pushAttributeLine(lines, 'relationships', cloneAndStripRefs(relationshipValue), 1);
    }
  } else if (remaining.relationships !== undefined) {
    const value = cloneAndStripRefs(remaining.relationships);
    delete remaining.relationships;
    pushAttributeLine(lines, 'relationships', value, 1);
  }

  if (Array.isArray(remaining.stateUpdates)) {
    const stateValue = remaining.stateUpdates;
    const mutationLines = formatMutationEntries(stateValue, 1);
    delete remaining.stateUpdates;
    if (mutationLines && mutationLines.length > 0) {
      lines.push(...mutationLines);
    } else {
      pushAttributeLine(lines, 'stateUpdates', cloneAndStripRefs(stateValue), 1);
    }
  } else if (remaining.stateUpdates !== undefined) {
    const value = cloneAndStripRefs(remaining.stateUpdates);
    delete remaining.stateUpdates;
    pushAttributeLine(lines, 'stateUpdates', value, 1);
  }

  if (remaining.variants !== undefined) {
    const value = cloneAndStripRefs(remaining.variants);
    delete remaining.variants;
    pushAttributeLine(lines, 'variants', value, 1);
  }

  if (remaining.enabled !== undefined) {
    const value = cloneAndStripRefs(remaining.enabled);
    delete remaining.enabled;
    pushAttributeLine(lines, 'enabled', value, 1);
  }

  const extraLines = formatAttributeLines(cloneAndStripRefs(remaining) as Record<string, unknown>, 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push('end');
  return lines.join('\n');
}

function formatActionBlock(item: Record<string, unknown>): string | null {
  const body = { ...item };
  const labels: string[] = [];
  if (typeof body.id === 'string') {
    labels.push(body.id);
    delete body.id;
  }
  if (typeof body.name === 'string') {
    labels.push(body.name);
    delete body.name;
  }

  const header = `action${labels.length > 0 ? ' ' + labels.map(formatLabel).join(' ') : ''} do`;
  const lines = [header];

  if (body.description !== undefined) {
    pushInlinePairLine(lines, 'description', body.description, 1);
    delete body.description;
  }

  const actorLines = formatActionActorLines(body.actor, 1);
  if (actorLines) {
    lines.push(...actorLines);
  } else if (body.actor !== undefined) {
    pushAttributeLine(lines, 'actor', body.actor, 1);
  }
  delete body.actor;

  const targetLines = formatActionTargetLines(body.targeting, 1);
  if (targetLines) {
    lines.push(...targetLines);
  } else if (body.targeting !== undefined) {
    pushAttributeLine(lines, 'targeting', body.targeting, 1);
  }
  delete body.targeting;

  const variableLines = formatVariableEntries(body.variables as Record<string, unknown> | undefined, 1);
  if (variableLines) {
    delete body.variables;
    lines.push(...variableLines);
  } else if (body.variables !== undefined) {
    pushAttributeLine(lines, 'variables', body.variables, 1);
    delete body.variables;
  }

  const outcomeLines = formatActionOutcomeLines(body.outcome, 1);
  if (outcomeLines) {
    lines.push(...outcomeLines);
  } else if (body.outcome !== undefined) {
    pushAttributeLine(lines, 'outcome', body.outcome, 1);
  }
  delete body.outcome;

  const probabilityLines = formatActionProbabilityLines(body.probability, 1);
  if (probabilityLines) {
    lines.push(...probabilityLines);
  } else if (body.probability !== undefined) {
    pushAttributeLine(lines, 'probability', body.probability, 1);
  }
  delete body.probability;

  if (body.enabled !== undefined) {
    if (body.enabled !== true) {
      pushInlinePairLine(lines, 'enabled', body.enabled, 1);
    }
    delete body.enabled;
  }

  const extraLines = formatAttributeLines(cloneAndStripRefs(body) as Record<string, unknown>, 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push('end');
  return lines.join('\n');
}

function formatActionActorLines(actorValue: unknown, indentLevel: number): string[] | null {
  if (!isRecord(actorValue)) return null;
  const actor = cloneAndStripRefs(actorValue) as Record<string, unknown>;
  const selection = actor.selection;
  const conditions = actor.conditions;
  const instigator = actor.instigator;
  delete actor.selection;
  delete actor.conditions;
  delete actor.instigator;

  const hasExtras = Object.values(actor).some((value) => value !== undefined);
  if (hasExtras) return null;

  const lines: string[] = [];
  if (selection !== undefined) {
    const selectionLines = formatActionSelectionBlock('actor', selection, indentLevel);
    if (!selectionLines) return null;
    lines.push(...selectionLines);
  }
  if (conditions !== undefined) {
    const conditionLines = formatActionConditionsBlock('actor', conditions, indentLevel);
    if (!conditionLines) return null;
    lines.push(...conditionLines);
  }
  if (instigator !== undefined) {
    const instigatorLines = formatActionInstigatorBlock(instigator, indentLevel);
    if (!instigatorLines) return null;
    lines.push(...instigatorLines);
  }

  return lines.length > 0 ? lines : null;
}

function formatActionTargetLines(targetValue: unknown, indentLevel: number): string[] | null {
  if (!isRecord(targetValue)) return null;
  const selectionLines = formatActionSelectionBlock('target', targetValue, indentLevel);
  return selectionLines;
}

function formatActionSelectionBlock(
  label: string,
  value: unknown,
  indentLevel: number
): string[] | null {
  if (!isRecord(value)) return null;
  const cleaned = cloneAndStripRefs(value) as Record<string, unknown>;
  const selection = { ...cleaned };
  const kind = typeof selection.kind === 'string' ? selection.kind : null;
  if (kind) delete selection.kind;

  const header = `${indent(indentLevel)}${label} choose${kind ? ' ' + formatLabel(kind) : ''} do`;
  const lines = [header];
  const innerIndent = indentLevel + 1;

  if (selection.strategy !== undefined) {
    if (selection.strategy !== 'by_kind') {
      pushInlinePairLine(lines, 'strategy', selection.strategy, innerIndent);
    }
    delete selection.strategy;
  }

  const pickStrategy = selection.pickStrategy ?? 'random';
  pushInlinePairLine(lines, 'pick', pickStrategy, innerIndent);
  delete selection.pickStrategy;

  if (selection.kinds !== undefined) {
    pushInlinePairLine(lines, 'kinds', selection.kinds, innerIndent);
    delete selection.kinds;
  }

  if (Array.isArray(selection.subtypes) && selection.subtypes.length > 0) {
    if (selection.subtypes.length > 1) {
      const inline = formatInlineValue(selection.subtypes);
      if (inline) {
        lines.push(`${indent(innerIndent)}subtype in ${inline}`);
      } else {
        pushInlinePairLine(lines, 'subtypes', selection.subtypes, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'subtype', selection.subtypes[0], innerIndent);
    }
    delete selection.subtypes;
  }

  if (Array.isArray(selection.statuses) && selection.statuses.length > 0) {
    if (selection.statuses.length > 1) {
      const inline = formatInlineValue(selection.statuses);
      if (inline) {
        lines.push(`${indent(innerIndent)}status in ${inline}`);
      } else {
        pushInlinePairLine(lines, 'statuses', selection.statuses, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'status', selection.statuses[0], innerIndent);
    }
    delete selection.statuses;
  }

  if (selection.statusFilter !== undefined) {
    pushInlinePairLine(lines, 'status', selection.statusFilter, innerIndent);
    delete selection.statusFilter;
  }

  if (selection.maxResults !== undefined) {
    pushInlinePairLine(lines, 'max', selection.maxResults, innerIndent);
    delete selection.maxResults;
  }

  if (Array.isArray(selection.saturationLimits) && selection.saturationLimits.length > 0) {
    const saturationLines = formatSaturationLines(selection.saturationLimits, innerIndent);
    if (saturationLines) {
      lines.push(...saturationLines);
      delete selection.saturationLimits;
    }
  }

  if (selection.referenceEntity !== undefined) {
    pushInlinePairLine(lines, 'referenceEntity', selection.referenceEntity, innerIndent);
    delete selection.referenceEntity;
  }

  if (selection.relationshipKind !== undefined) {
    pushInlinePairLine(lines, 'relationshipKind', selection.relationshipKind, innerIndent);
    delete selection.relationshipKind;
  }

  if (selection.direction !== undefined) {
    pushInlinePairLine(lines, 'direction', selection.direction, innerIndent);
    delete selection.direction;
  }

  if (selection.mustHave !== undefined) {
    pushInlinePairLine(lines, 'mustHave', selection.mustHave, innerIndent);
    delete selection.mustHave;
  }

  if (selection.excludeSubtypes !== undefined) {
    pushInlinePairLine(lines, 'excludeSubtypes', selection.excludeSubtypes, innerIndent);
    delete selection.excludeSubtypes;
  }

  if (selection.notStatus !== undefined) {
    pushInlinePairLine(lines, 'notStatus', selection.notStatus, innerIndent);
    delete selection.notStatus;
  }

  if (selection.subtypePreferences !== undefined) {
    pushInlinePairLine(lines, 'subtypePreferences', selection.subtypePreferences, innerIndent);
    delete selection.subtypePreferences;
  }

  if (selection.maxDistance !== undefined) {
    pushInlinePairLine(lines, 'maxDistance', selection.maxDistance, innerIndent);
    delete selection.maxDistance;
  }

  if (selection.minProminence !== undefined) {
    pushInlinePairLine(lines, 'minProminence', selection.minProminence, innerIndent);
    delete selection.minProminence;
  }

  if (selection.filters !== undefined) {
    const filterLines = formatFilterLines(selection.filters, innerIndent, 'filter');
    if (filterLines) {
      lines.push(...filterLines);
    } else {
      pushInlinePairLine(lines, 'filters', selection.filters, innerIndent);
    }
    delete selection.filters;
  }

  if (selection.preferFilters !== undefined) {
    const preferLines = formatFilterLines(selection.preferFilters, innerIndent, 'prefer');
    if (preferLines) {
      lines.push(...preferLines);
    } else {
      pushInlinePairLine(lines, 'preferFilters', selection.preferFilters, innerIndent);
    }
    delete selection.preferFilters;
  }

  for (const [key, entry] of Object.entries(selection)) {
    if (entry === undefined) continue;
    pushInlinePairLine(lines, key, entry, innerIndent);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatActionConditionsBlock(
  label: string,
  value: unknown,
  indentLevel: number
): string[] | null {
  let conditions: unknown[] | null = null;
  let mode: string | undefined;

  if (Array.isArray(value)) {
    conditions = value;
  } else if (isRecord(value) && (value.type === 'and' || value.type === 'or') && Array.isArray(value.conditions)) {
    conditions = value.conditions as unknown[];
    mode = value.type === 'or' ? 'any' : 'all';
  } else {
    return null;
  }

  if (conditions.length === 0) return null;

  const header = `${indent(indentLevel)}${label} when${mode ? ' ' + mode : ''} do`;
  const lines = [header];
  for (const condition of conditions) {
    lines.push(...formatConditionLines(condition, indentLevel + 1));
  }
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatActionInstigatorBlock(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const instigator = cloneAndStripRefs(value) as Record<string, unknown>;
  const lines: string[] = [];
  const header = `${indent(indentLevel)}actor instigator do`;
  lines.push(header);
  const innerIndent = indentLevel + 1;

  if (instigator.from !== undefined) {
    if (instigator.from === 'graph') {
      lines.push(`${indent(innerIndent)}from graph`);
      delete instigator.from;
    } else if (isRecord(instigator.from)) {
      const relatedTo = instigator.from.relatedTo;
      const relationship = instigator.from.relationshipKind ?? instigator.from.relationship;
      const direction = instigator.from.direction;
      if (typeof relatedTo === 'string' && typeof relationship === 'string' && typeof direction === 'string') {
        lines.push(
          `${indent(innerIndent)}from ${formatLabel(stripBinding(relatedTo))} via ${relationship} ${direction}`
        );
        delete instigator.from;
      }
    }
  }

  if (instigator.kind !== undefined) {
    pushInlinePairLine(lines, 'kind', instigator.kind, innerIndent);
    delete instigator.kind;
  }

  if (instigator.kinds !== undefined) {
    pushInlinePairLine(lines, 'kinds', instigator.kinds, innerIndent);
    delete instigator.kinds;
  }

  if (Array.isArray(instigator.subtypes) && instigator.subtypes.length > 0) {
    if (instigator.subtypes.length > 1) {
      const inline = formatInlineValue(instigator.subtypes);
      if (inline) {
        lines.push(`${indent(innerIndent)}subtype in ${inline}`);
      } else {
        pushInlinePairLine(lines, 'subtypes', instigator.subtypes, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'subtype', instigator.subtypes[0], innerIndent);
    }
    delete instigator.subtypes;
  }

  if (Array.isArray(instigator.statuses) && instigator.statuses.length > 0) {
    if (instigator.statuses.length > 1) {
      const inline = formatInlineValue(instigator.statuses);
      if (inline) {
        lines.push(`${indent(innerIndent)}status in ${inline}`);
      } else {
        pushInlinePairLine(lines, 'statuses', instigator.statuses, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'status', instigator.statuses[0], innerIndent);
    }
    delete instigator.statuses;
  }

  if (instigator.statusFilter !== undefined) {
    pushInlinePairLine(lines, 'status', instigator.statusFilter, innerIndent);
    delete instigator.statusFilter;
  }

  const pickStrategy = instigator.pickStrategy ?? 'random';
  pushInlinePairLine(lines, 'pick', pickStrategy, innerIndent);
  delete instigator.pickStrategy;

  if (instigator.maxResults !== undefined) {
    pushInlinePairLine(lines, 'max', instigator.maxResults, innerIndent);
    delete instigator.maxResults;
  }

  if (instigator.filters !== undefined) {
    const filterLines = formatFilterLines(instigator.filters, innerIndent, 'filter');
    if (filterLines) {
      lines.push(...filterLines);
    } else {
      pushInlinePairLine(lines, 'filters', instigator.filters, innerIndent);
    }
    delete instigator.filters;
  }

  if (instigator.preferFilters !== undefined) {
    const preferLines = formatFilterLines(instigator.preferFilters, innerIndent, 'prefer');
    if (preferLines) {
      lines.push(...preferLines);
    } else {
      pushInlinePairLine(lines, 'preferFilters', instigator.preferFilters, innerIndent);
    }
    delete instigator.preferFilters;
  }

  if (instigator.required !== undefined) {
    pushInlinePairLine(lines, 'required', instigator.required, innerIndent);
    delete instigator.required;
  }

  for (const [key, entry] of Object.entries(instigator)) {
    if (entry === undefined) continue;
    pushInlinePairLine(lines, key, entry, innerIndent);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatActionOutcomeLines(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const outcome = cloneAndStripRefs(value) as Record<string, unknown>;
  const mutations = outcome.mutations;
  const narrative = outcome.descriptionTemplate;
  const actorDelta = outcome.actorProminenceDelta;
  const targetDelta = outcome.targetProminenceDelta;
  delete outcome.mutations;
  delete outcome.descriptionTemplate;
  delete outcome.actorProminenceDelta;
  delete outcome.targetProminenceDelta;

  const hasExtras = Object.values(outcome).some((entry) => entry !== undefined);
  if (hasExtras) return null;

  const lines: string[] = [];

  if (Array.isArray(mutations)) {
    const mutationLines = formatActionMutationLines(mutations, indentLevel + 1);
    if (!mutationLines) return null;
    if (mutationLines.length > 0) {
      lines.push(`${indent(indentLevel)}on success do`);
      lines.push(...mutationLines);
      lines.push(`${indent(indentLevel)}end`);
    }
  } else if (mutations !== undefined) {
    return null;
  }

  if (narrative !== undefined) {
    pushInlinePairLine(lines, 'narrative', narrative, indentLevel);
  }

  const actorLine = formatActionProminenceLine('actor', actorDelta, indentLevel);
  if (actorLine) lines.push(actorLine);
  const targetLine = formatActionProminenceLine('target', targetDelta, indentLevel);
  if (targetLine) lines.push(targetLine);

  return lines.length > 0 ? lines : null;
}

function formatActionProbabilityLines(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const probability = cloneAndStripRefs(value) as Record<string, unknown>;
  const successChance = probability.baseSuccessChance;
  const weight = probability.baseWeight;
  const modifiers = probability.pressureModifiers;
  delete probability.baseSuccessChance;
  delete probability.baseWeight;
  delete probability.pressureModifiers;

  const hasExtras = Object.values(probability).some((entry) => entry !== undefined);
  if (hasExtras) return null;

  const lines: string[] = [];
  if (successChance !== undefined) {
    pushInlinePairLine(lines, 'success_chance', successChance, indentLevel);
  }
  if (weight !== undefined) {
    pushInlinePairLine(lines, 'weight', weight, indentLevel);
  }
  if (Array.isArray(modifiers)) {
    for (const modifier of modifiers) {
      if (!isRecord(modifier)) return null;
      const pressure = modifier.pressure;
      const multiplier = modifier.multiplier;
      if (typeof pressure !== 'string' || typeof multiplier !== 'number') return null;
      lines.push(`${indent(indentLevel)}pressure_modifier ${formatLabel(pressure)} ${multiplier}`);
    }
  } else if (modifiers !== undefined) {
    return null;
  }

  return lines.length > 0 ? lines : null;
}

function formatActionMutationLines(items: unknown[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    const entryLines = formatActionMutationLine(item, indentLevel);
    if (!entryLines) return null;
    lines.push(...entryLines);
  }
  return lines;
}

function formatActionMutationLine(item: unknown, indentLevel: number): string[] | null {
  if (!isRecord(item)) return null;
  const cleaned = cloneAndStripRefs(item) as Record<string, unknown>;
  const type = cleaned.type;
  if (typeof type !== 'string') return null;

  if (type === 'create_relationship' || type === 'adjust_relationship_strength') {
    const kind = cleaned.kind;
    const src = cleaned.src;
    const dst = cleaned.dst;
    if (typeof kind !== 'string' || typeof src !== 'string' || typeof dst !== 'string') return null;
    const body = { ...cleaned };
    delete body.type;
    delete body.kind;
    delete body.src;
    delete body.dst;
    const pairs = formatInlinePairs(body);
    const formattedSrc = stripBinding(src);
    const formattedDst = stripBinding(dst);
    const prefix = `${indent(indentLevel)}rel ${formatLabel(kind)} ${formatLabel(formattedSrc)} -> ${formatLabel(formattedDst)}`;
    if (pairs !== null) {
      return [pairs ? `${prefix} ${pairs}` : prefix];
    }
    const header = `${indent(indentLevel)}rel ${formatLabel(kind)} ${formatLabel(formattedSrc)} ${formatLabel(formattedDst)} do`;
    const lines = [header];
    const bodyLines = formatAttributeLines(body, indentLevel + 1);
    if (bodyLines.length > 0) lines.push(...bodyLines);
    lines.push(`${indent(indentLevel)}end`);
    return lines;
  }

  if (type === 'modify_pressure') {
    const pressureId = cleaned.pressureId;
    const delta = cleaned.delta;
    if (typeof pressureId !== 'string' || typeof delta !== 'number') return null;
    const operator = delta < 0 ? '-=' : '+=';
    const value = Math.abs(delta);
    return [`${indent(indentLevel)}mutate pressure ${formatLabel(pressureId)} ${operator} ${value}`];
  }

  if (type === 'change_status') {
    const entity = cleaned.entity;
    const status = cleaned.newStatus;
    if (typeof entity !== 'string' || typeof status !== 'string') return null;
    return [
      `${indent(indentLevel)}change_status ${formatLabel(stripBinding(entity))} ${formatLabel(status)}`
    ];
  }

  if (type === 'set_tag') {
    const entity = cleaned.entity;
    const tag = cleaned.tag;
    if (typeof entity !== 'string' || typeof tag !== 'string') return null;
    const parts = [
      `${indent(indentLevel)}set_tag`,
      formatLabel(stripBinding(entity)),
      formatLabel(tag)
    ];
    if (cleaned.valueFrom !== undefined && typeof cleaned.valueFrom === 'string') {
      parts.push('from', formatLabel(stripBinding(cleaned.valueFrom)));
    } else if (cleaned.value !== undefined) {
      const valueText = formatInlineValue(cleaned.value);
      if (!valueText) return null;
      parts.push(valueText);
    }
    return [parts.join(' ')];
  }

  if (type === 'remove_tag') {
    const entity = cleaned.entity;
    const tag = cleaned.tag;
    if (typeof entity !== 'string' || typeof tag !== 'string') return null;
    return [
      `${indent(indentLevel)}remove_tag ${formatLabel(stripBinding(entity))} ${formatLabel(tag)}`
    ];
  }

  if (type === 'adjust_prominence') {
    const entity = cleaned.entity;
    const delta = cleaned.delta;
    if (typeof entity !== 'string' || typeof delta !== 'number') return null;
    return [
      `${indent(indentLevel)}adjust_prominence ${formatLabel(stripBinding(entity))} ${delta}`
    ];
  }

  if (type === 'archive_relationship') {
    const entity = cleaned.entity;
    const kind = cleaned.relationshipKind;
    const withEntity = cleaned.with;
    if (typeof entity !== 'string' || typeof kind !== 'string' || typeof withEntity !== 'string') return null;
    const parts = [
      `${indent(indentLevel)}archive_relationship`,
      formatLabel(stripBinding(entity)),
      formatLabel(kind),
      formatLabel(stripBinding(withEntity))
    ];
    if (typeof cleaned.direction === 'string') {
      parts.push('direction', cleaned.direction);
    }
    return [parts.join(' ')];
  }

  if (type === 'archive_all_relationships') {
    const entity = cleaned.entity;
    const kind = cleaned.relationshipKind;
    if (typeof entity !== 'string' || typeof kind !== 'string') return null;
    const parts = [
      `${indent(indentLevel)}archive_all_relationships`,
      formatLabel(stripBinding(entity)),
      formatLabel(kind)
    ];
    if (typeof cleaned.direction === 'string') {
      parts.push('direction', cleaned.direction);
    }
    return [parts.join(' ')];
  }

  if (type === 'update_rate_limit') {
    return [`${indent(indentLevel)}update_rate_limit true`];
  }

  return null;
}

function formatActionProminenceLine(
  target: 'actor' | 'target',
  value: unknown,
  indentLevel: number
): string | null {
  if (!isRecord(value)) return null;
  const onSuccess = value.onSuccess;
  const onFailure = value.onFailure;
  if (onSuccess === undefined && onFailure === undefined) return null;
  const parts = [`${indent(indentLevel)}prominence`, target];
  if (typeof onSuccess === 'number') {
    parts.push('success', String(onSuccess));
  }
  if (typeof onFailure === 'number') {
    parts.push('failure', String(onFailure));
  }
  return parts.join(' ');
}

function formatBlock(name: string, labels: string[], body: Record<string, unknown>): string {
  if (name === 'generator') {
    return formatGeneratorBlock(labels, body);
  }
  const header = `${name}${labels.length > 0 ? ' ' + labels.map(formatLabel).join(' ') : ''} do`;
  const lines = [header];
  const bodyLines = formatAttributeLines(body, 1);
  if (bodyLines.length > 0) {
    lines.push(...bodyLines);
  }
  lines.push('end');
  return lines.join('\n');
}

function formatInlineItemBlock(
  name: string,
  item: Record<string, unknown>,
  idKey: string,
  rename: Record<string, string> = {}
): string | null {
  const body = { ...item };
  const labels: string[] = [];
  const idValue = body[idKey];
  if (typeof idValue === 'string') {
    labels.push(idValue);
    delete body[idKey];
  }

  for (const [outputKey, inputKey] of Object.entries(rename)) {
    if (body[outputKey] === undefined && body[inputKey] !== undefined) {
      body[outputKey] = body[inputKey];
      delete body[inputKey];
    }
  }

  if (!isInlineFriendlyObject(body)) {
    return formatBlock(name, labels, body);
  }

  return formatEntryLineOrBlock(name, labels, body, 0).join('\n');
}

function formatAxisLine(item: Record<string, unknown>): string | null {
  const id = item.id;
  if (typeof id !== 'string') return null;

  const name = typeof item.name === 'string' ? item.name : null;
  const lowTag = typeof item.lowTag === 'string'
    ? item.lowTag
    : (typeof item.low === 'string' ? item.low : null);
  const highTag = typeof item.highTag === 'string'
    ? item.highTag
    : (typeof item.high === 'string' ? item.high : null);
  const description = typeof item.description === 'string' ? item.description : null;

  const remaining = { ...item };
  delete remaining.id;
  delete remaining.name;
  delete remaining.low;
  delete remaining.high;
  delete remaining.lowTag;
  delete remaining.highTag;
  delete remaining.description;

  if (!lowTag || !highTag || Object.keys(remaining).length > 0) {
    const labels = [id];
    if (name) labels.push(name);
    const body = { ...item };
    delete body.id;
    if (name) delete body.name;
    return formatBlock('axis', labels, body);
  }

  let line = `axis ${formatLabel(id)}`;
  if (name) line += ` ${quoteString(name)}`;
  line += ` ${formatLabel(lowTag)} -> ${formatLabel(highTag)}`;
  if (description) line += ` ${quoteString(description)}`;
  return line;
}

function formatTagLine(item: Record<string, unknown>): string | null {
  const tag = item.tag;
  const category = item.category;
  const rarity = item.rarity;
  if (typeof tag !== 'string' || typeof category !== 'string' || typeof rarity !== 'string') {
    return formatBlock('tag', [], { ...item });
  }

  const description = typeof item.description === 'string' ? item.description : null;
  const entityKinds = item.entityKinds;
  const relatedTags = item.relatedTags;
  const conflictingTags = item.conflictingTags;
  const mutuallyExclusiveWith = item.mutuallyExclusiveWith;
  const templates = item.templates;
  const minUsage = item.minUsage;
  const maxUsage = item.maxUsage;
  const usageCount = item.usageCount;
  const isAxis = item.isAxis;
  const isFramework = item.isFramework;

  const remaining = { ...item };
  delete remaining.tag;
  delete remaining.category;
  delete remaining.rarity;
  delete remaining.description;
  delete remaining.entityKinds;
  delete remaining.relatedTags;
  delete remaining.conflictingTags;
  delete remaining.mutuallyExclusiveWith;
  delete remaining.templates;
  delete remaining.minUsage;
  delete remaining.maxUsage;
  delete remaining.usageCount;
  delete remaining.isAxis;
  delete remaining.isFramework;

  if (Object.keys(remaining).length > 0) {
    const body = { ...item };
    delete body.tag;
    return formatBlock('tag', [tag], body);
  }

  let line = `tag ${formatLabel(tag)} ${formatLabel(category)} ${formatLabel(rarity)}`;
  if (description !== null) line += ` ${quoteString(description)}`;

  const kindsValue = formatInlineValue(entityKinds);
  if (kindsValue) line += ` kinds ${kindsValue}`;

  const relatedValue = formatInlineValue(relatedTags);
  if (relatedValue) line += ` related ${relatedValue}`;

  const conflictsValue = formatInlineValue(conflictingTags);
  if (conflictsValue) line += ` conflicts ${conflictsValue}`;

  const exclusiveValue = formatInlineValue(mutuallyExclusiveWith);
  if (exclusiveValue) line += ` exclusive ${exclusiveValue}`;

  const templatesValue = formatInlineValue(templates);
  if (templatesValue) line += ` templates ${templatesValue}`;

  if (typeof minUsage === 'number' && typeof maxUsage === 'number') {
    line += ` usage ${minUsage} ${maxUsage}`;
  } else if (minUsage !== undefined || maxUsage !== undefined) {
    const body = { ...item };
    delete body.tag;
    return formatBlock('tag', [tag], body);
  }

  if (typeof usageCount === 'number') {
    line += ` count ${usageCount}`;
  }

  if (isAxis === true) line += ' axis';
  if (isFramework === true) line += ' framework';

  return line;
}

function formatRelationshipKindLine(item: Record<string, unknown>): string | null {
  const kind = item.kind;
  if (typeof kind !== 'string') return null;

  const description = typeof item.description === 'string' ? item.description : null;
  const polarity = typeof item.polarity === 'string' ? item.polarity : null;
  const decayRate = typeof item.decayRate === 'string' ? item.decayRate : null;
  const cullable = typeof item.cullable === 'boolean' ? item.cullable : null;
  const srcKinds = item.srcKinds ?? item.src;
  const dstKinds = item.dstKinds ?? item.dst;
  const verbs = isRecord(item.verbs) ? item.verbs : null;
  const category = item.category;
  const symmetric = item.symmetric;
  const isFramework = item.isFramework;
  const name = item.name;

  const remaining = { ...item };
  delete remaining.kind;
  delete remaining.description;
  delete remaining.polarity;
  delete remaining.decayRate;
  delete remaining.cullable;
  delete remaining.srcKinds;
  delete remaining.dstKinds;
  delete remaining.src;
  delete remaining.dst;
  delete remaining.verbs;
  delete remaining.category;
  delete remaining.symmetric;
  delete remaining.isFramework;
  delete remaining.name;

  if (!polarity || !decayRate || cullable === null || Object.keys(remaining).length > 0) {
    const body = { ...item };
    delete body.kind;
    return formatBlock('relationship_kind', [kind], body);
  }

  const srcValue = formatInlineValue(srcKinds);
  const dstValue = formatInlineValue(dstKinds);
  if (!srcValue || !dstValue) {
    const body = { ...item };
    delete body.kind;
    return formatBlock('relationship_kind', [kind], body);
  }

  let line = `relationship_kind ${formatLabel(kind)}`;
  if (description !== null) line += ` ${quoteString(description)}`;
  line += ` ${formatLabel(polarity)} ${formatLabel(decayRate)} ${cullable ? 'cullable' : 'fixed'}`;
  line += ` src ${srcValue} dst ${dstValue}`;

  if (verbs && typeof verbs.formed === 'string' && typeof verbs.ended === 'string') {
    line += ` verbs ${quoteString(verbs.formed)} ${quoteString(verbs.ended)}`;
  } else if (verbs) {
    const body = { ...item };
    delete body.kind;
    return formatBlock('relationship_kind', [kind], body);
  }

  if (category !== undefined) {
    const categoryValue = formatInlineValue(category);
    if (!categoryValue) {
      const body = { ...item };
      delete body.kind;
      return formatBlock('relationship_kind', [kind], body);
    }
    line += ` category ${categoryValue}`;
  }
  if (name !== undefined) {
    const nameValue = formatInlineValue(name);
    if (!nameValue) {
      const body = { ...item };
      delete body.kind;
      return formatBlock('relationship_kind', [kind], body);
    }
    line += ` name ${nameValue}`;
  }
  if (symmetric === true) line += ' symmetric';
  if (isFramework === true) line += ' framework';

  return line;
}

function formatSeedRelationshipBlock(item: Record<string, unknown>): string | null {
  const kind = item.kind;
  const src = item.src;
  const dst = item.dst;
  if (typeof kind !== 'string' || typeof src !== 'string' || typeof dst !== 'string') {
    return formatBlock('seed_relationship', [], { ...item });
  }

  const strength = item.strength;
  const remaining = { ...item };
  delete remaining.kind;
  delete remaining.src;
  delete remaining.dst;
  delete remaining.strength;

  if (Object.keys(remaining).length > 0) {
    return formatBlock('seed_relationship', [], { ...item });
  }

  if (typeof strength !== 'number') {
    return formatBlock('seed_relationship', [], { ...item });
  }

  return `seed_relationship ${formatLabel(kind)} ${formatLabel(src)} ${formatLabel(dst)} ${strength}`;
}

function formatSeedEntityBlock(item: Record<string, unknown>): string | null {
  const id = item.id;
  if (typeof id !== 'string') return null;
  const lines = [`seed_entity ${formatLabel(id)} do`];
  const remaining = { ...item };
  delete remaining.id;

  const knownKeys = [
    'kind',
    'subtype',
    'name',
    'summary',
    'description',
    'status',
    'prominence',
    'culture',
    'createdAt',
    'updatedAt'
  ];

  for (const key of knownKeys) {
    if (remaining[key] !== undefined) {
      pushInlinePairLine(lines, key, remaining[key], 1);
      delete remaining[key];
    }
  }

  if (remaining.tags !== undefined) {
    const tags = remaining.tags;
    if (isRecord(tags)) {
      const entries = Object.entries(tags);
      const allTrue = entries.length > 0 && entries.every(([, value]) => value === true);
      if (allTrue) {
        const list = entries.map(([key]) => key);
        const inline = formatInlineValue(list);
        if (inline) {
          lines.push(`${indent(1)}tags ${inline}`);
        } else {
          pushAttributeLine(lines, 'tags', tags, 1);
        }
      } else {
        pushAttributeLine(lines, 'tags', tags, 1);
      }
    } else if (Array.isArray(tags)) {
      const inline = formatInlineValue(tags);
      if (inline) {
        lines.push(`${indent(1)}tags ${inline}`);
      } else {
        pushAttributeLine(lines, 'tags', tags, 1);
      }
    } else {
      pushAttributeLine(lines, 'tags', tags, 1);
    }
    delete remaining.tags;
  }

  const coords = remaining.coords ?? remaining.coordinates;
  if (coords !== undefined) {
    if (isRecord(coords) && typeof coords.x === 'number' && typeof coords.y === 'number' && typeof coords.z === 'number') {
      lines.push(`${indent(1)}coords ${coords.x} ${coords.y} ${coords.z}`);
    } else if (Array.isArray(coords) && coords.length >= 3) {
      const [x, y, z] = coords;
      if ([x, y, z].every((value) => typeof value === 'number')) {
        lines.push(`${indent(1)}coords ${x} ${y} ${z}`);
      } else {
        pushAttributeLine(lines, 'coordinates', coords, 1);
      }
    } else {
      pushAttributeLine(lines, 'coordinates', coords, 1);
    }
    delete remaining.coords;
    delete remaining.coordinates;
  }

  if (remaining.links !== undefined) {
    const inline = formatInlineValue(remaining.links);
    if (inline) {
      lines.push(`${indent(1)}links ${inline}`);
    } else {
      pushAttributeLine(lines, 'links', remaining.links, 1);
    }
    delete remaining.links;
  }

  const extraLines = formatAttributeLines(remaining, 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push('end');
  return lines.join('\n');
}

function formatEntityKindBlock(item: Record<string, unknown>): string | null {
  const kind = item.kind;
  if (typeof kind !== 'string') return null;
  const lines = [`entity_kind ${formatLabel(kind)} do`];
  const remaining = { ...item };
  delete remaining.kind;

  if (remaining.description !== undefined) {
    pushAttributeLine(lines, 'description', remaining.description, 1);
    delete remaining.description;
  }
  if (remaining.category !== undefined) {
    pushAttributeLine(lines, 'category', remaining.category, 1);
    delete remaining.category;
  }
  if (remaining.isFramework !== undefined) {
    pushAttributeLine(lines, 'isFramework', remaining.isFramework, 1);
    delete remaining.isFramework;
  }

  const subtypes = remaining.subtypes;
  delete remaining.subtypes;
  const statuses = remaining.statuses;
  delete remaining.statuses;
  const requiredRelationships = remaining.requiredRelationships;
  delete remaining.requiredRelationships;
  const semanticPlane = remaining.semanticPlane;
  delete remaining.semanticPlane;

  if (Array.isArray(subtypes)) {
    const subtypeLines = formatSubtypeLines(subtypes, 1);
    if (subtypeLines) {
      lines.push(...subtypeLines);
    } else {
      const subtypeBlock = formatSubtypesBlock(subtypes, 1);
      if (subtypeBlock) {
        lines.push(...subtypeBlock);
      } else {
        pushAttributeLine(lines, 'subtypes', subtypes, 1);
      }
    }
  } else if (subtypes !== undefined) {
    pushAttributeLine(lines, 'subtypes', subtypes, 1);
  }

  if (Array.isArray(statuses)) {
    const statusLines = formatStatusLines(statuses, 1);
    if (statusLines) {
      lines.push(...statusLines);
    } else {
      const statusBlock = formatStatusesBlock(statuses, 1);
      if (statusBlock) {
        lines.push(...statusBlock);
      } else {
        pushAttributeLine(lines, 'statuses', statuses, 1);
      }
    }
  } else if (statuses !== undefined) {
    pushAttributeLine(lines, 'statuses', statuses, 1);
  }

  if (Array.isArray(requiredRelationships)) {
    const requiredLines = formatRequiredRelationshipLines(requiredRelationships, 1);
    if (requiredLines) {
      lines.push(...requiredLines);
    } else {
      const requiredBlock = formatRequiredRelationshipsBlock(requiredRelationships, 1);
      if (requiredBlock) {
        lines.push(...requiredBlock);
      } else {
        pushAttributeLine(lines, 'requiredRelationships', requiredRelationships, 1);
      }
    }
  } else if (requiredRelationships !== undefined) {
    pushAttributeLine(lines, 'requiredRelationships', requiredRelationships, 1);
  }

  if (remaining.defaultStatus !== undefined) {
    pushAttributeLine(lines, 'defaultStatus', remaining.defaultStatus, 1);
    delete remaining.defaultStatus;
  }
  if (remaining.style !== undefined) {
    const styleLines = formatStyleLines(remaining.style, 1);
    if (styleLines) {
      lines.push(...styleLines);
    } else {
      pushAttributeLine(lines, 'style', remaining.style, 1);
    }
    delete remaining.style;
  }

  const semanticLines = isRecord(semanticPlane) ? formatSemanticPlaneBlock(semanticPlane, 1) : null;
  if (semanticLines) {
    lines.push(...semanticLines);
  } else if (semanticPlane !== undefined) {
    pushAttributeLine(lines, 'semanticPlane', semanticPlane, 1);
  }

  if (remaining.visualIdentityKeys !== undefined) {
    pushAttributeLine(lines, 'visualIdentityKeys', remaining.visualIdentityKeys, 1);
    delete remaining.visualIdentityKeys;
  }

  const extraLines = formatAttributeLines(remaining, 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push('end');
  return lines.join('\n');
}

function formatSubtypesBlock(items: Record<string, unknown>[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    const entry = formatSubtypeEntry(item, indentLevel + 1);
    if (!entry) return null;
    lines.push(entry);
  }
  if (lines.length === 0) return [`${indent(indentLevel)}subtypes do`, `${indent(indentLevel)}end`];
  return [
    `${indent(indentLevel)}subtypes do`,
    ...lines,
    `${indent(indentLevel)}end`
  ];
}

function formatSubtypeLines(items: Record<string, unknown>[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const id = item.id;
    const name = item.name;
    if (typeof id !== 'string' || typeof name !== 'string') return null;
    const isAuthority = item.isAuthority === true || item.authority === true;
    const remaining = { ...item };
    delete remaining.id;
    delete remaining.name;
    delete remaining.isAuthority;
    delete remaining.authority;
    if (Object.keys(remaining).length > 0) return null;
    let line = `${indent(indentLevel)}subtype ${formatLabel(id)} ${formatLabel(name)}`;
    if (isAuthority) line += ' authority';
    lines.push(line);
  }
  return lines;
}

function formatSubtypeEntry(item: Record<string, unknown>, indentLevel: number): string | null {
  const id = item.id;
  const name = item.name;
  if (typeof id !== 'string' || typeof name !== 'string') return null;

  const body = { ...item };
  delete body.id;
  delete body.name;

  if (body.isAuthority !== undefined) {
    body.authority = body.isAuthority;
    delete body.isAuthority;
  }

  if (Object.keys(body).length === 0) {
    const nameValue = formatInlineValue(name);
    if (!nameValue) return null;
    return `${indent(indentLevel)}${formatAttributeKey(id)} ${nameValue}`;
  }

  body.name = name;
  const pairs = formatInlinePairs(body);
  if (pairs === null) return null;
  return `${indent(indentLevel)}${formatAttributeKey(id)}${pairs ? ' ' + pairs : ''}`;
}

function formatStatusesBlock(items: Record<string, unknown>[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    const entry = formatStatusEntry(item, indentLevel + 1);
    if (!entry) return null;
    lines.push(entry);
  }
  if (lines.length === 0) return [`${indent(indentLevel)}statuses do`, `${indent(indentLevel)}end`];
  return [
    `${indent(indentLevel)}statuses do`,
    ...lines,
    `${indent(indentLevel)}end`
  ];
}

function formatStatusLines(items: Record<string, unknown>[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const id = item.id;
    const name = item.name;
    const polarity = item.polarity;
    const transitionVerb = item.transitionVerb;
    const isTerminal = item.isTerminal === true || item.terminal === true;
    if (typeof id !== 'string' || typeof name !== 'string' || typeof polarity !== 'string') return null;
    const remaining = { ...item };
    delete remaining.id;
    delete remaining.name;
    delete remaining.polarity;
    delete remaining.transitionVerb;
    delete remaining.isTerminal;
    delete remaining.terminal;
    if (Object.keys(remaining).length > 0) return null;
    let line = `${indent(indentLevel)}status ${formatLabel(id)} ${formatLabel(name)} ${formatLabel(polarity)}`;
    if (typeof transitionVerb === 'string') {
      line += ` ${quoteString(transitionVerb)}`;
    }
    if (isTerminal) line += ' terminal';
    lines.push(line);
  }
  return lines;
}

function formatStatusEntry(item: Record<string, unknown>, indentLevel: number): string | null {
  const id = item.id;
  const name = item.name;
  if (typeof id !== 'string' || typeof name !== 'string') return null;

  const body = { ...item };
  delete body.id;
  delete body.name;

  if (body.isTerminal === true) {
    body.terminal = true;
  }
  delete body.isTerminal;

  if (Object.keys(body).length === 0) {
    const nameValue = formatInlineValue(name);
    if (!nameValue) return null;
    return `${indent(indentLevel)}${formatAttributeKey(id)} ${nameValue}`;
  }

  body.name = name;
  const pairs = formatInlinePairs(body);
  if (pairs === null) return null;
  return `${indent(indentLevel)}${formatAttributeKey(id)}${pairs ? ' ' + pairs : ''}`;
}

function formatRequiredRelationshipsBlock(items: Record<string, unknown>[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const kind = item.kind;
    if (typeof kind !== 'string') return null;
    const body = { ...item };
    delete body.kind;
    const description = body.description;
    delete body.description;

    if (Object.keys(body).length === 0 && (description === undefined || typeof description === 'string')) {
      if (description !== undefined) {
        const value = formatInlineValue(description);
        if (!value) return null;
        lines.push(`${indent(indentLevel + 1)}${formatAttributeKey(kind)} ${value}`);
      } else {
        lines.push(`${indent(indentLevel + 1)}${formatAttributeKey(kind)}`);
      }
      continue;
    }

    const entryBody: Record<string, unknown> = { ...body };
    if (description !== undefined) entryBody.description = description;
    const pairs = formatInlinePairs(entryBody);
    if (pairs === null) return null;
    lines.push(`${indent(indentLevel + 1)}${formatAttributeKey(kind)}${pairs ? ' ' + pairs : ''}`);
  }

  if (lines.length === 0) return [`${indent(indentLevel)}required_relationships do`, `${indent(indentLevel)}end`];
  return [
    `${indent(indentLevel)}required_relationships do`,
    ...lines,
    `${indent(indentLevel)}end`
  ];
}

function formatRequiredRelationshipLines(items: Record<string, unknown>[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const kind = item.kind;
    const description = item.description;
    if (typeof kind !== 'string') return null;
    const remaining = { ...item };
    delete remaining.kind;
    delete remaining.description;
    if (Object.keys(remaining).length > 0) return null;
    let line = `${indent(indentLevel)}required ${formatLabel(kind)}`;
    if (typeof description === 'string') {
      line += ` ${quoteString(description)}`;
    }
    lines.push(line);
  }
  return lines;
}

function formatStyleLines(style: unknown, indentLevel: number): string[] | null {
  if (!isRecord(style)) return null;
  const color = style.color;
  const shape = style.shape;
  const displayName = style.displayName;
  const remaining = { ...style };
  delete remaining.color;
  delete remaining.shape;
  delete remaining.displayName;

  const hasExtra = Object.keys(remaining).length > 0;
  if (hasExtra) {
    const lines = [`${indent(indentLevel)}style do`];
    lines.push(...formatAttributeLines(style, indentLevel + 1));
    lines.push(`${indent(indentLevel)}end`);
    return lines;
  }

  const colorValue = color !== undefined ? formatInlineValue(color) : null;
  const shapeValue = shape !== undefined ? formatInlineValue(shape) : null;
  const nameValue = displayName !== undefined ? formatInlineValue(displayName) : null;
  if (colorValue === null && shapeValue === null && nameValue === null) return null;

  let line = `${indent(indentLevel)}style`;
  if (shapeValue || nameValue) {
    if (colorValue) line += ` color ${colorValue}`;
    if (shapeValue) line += ` shape ${shapeValue}`;
    if (nameValue) line += ` name ${nameValue}`;
  } else if (colorValue) {
    line += ` ${colorValue}`;
  }
  return [line];
}
function formatSemanticPlaneBlock(plane: Record<string, unknown>, indentLevel: number): string[] | null {
  const axes = plane.axes;
  const regions = plane.regions;
  const axesLine = isRecord(axes) ? formatAxesLine(axes, indentLevel + 1) : null;
  const axesLines = axesLine ? [axesLine] : (isRecord(axes) ? formatAxesBlock(axes, indentLevel + 1) : null);
  const regionLines = Array.isArray(regions) ? formatRegionBlocks(regions, indentLevel + 1) : null;
  if (!axesLines && !regionLines) return null;

  const lines: string[] = [];
  lines.push(`${indent(indentLevel)}semantic_plane do`);
  if (axesLines) lines.push(...axesLines);
  if (regionLines) lines.push(...regionLines);
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatAxesLine(axes: Record<string, unknown>, indentLevel: number): string | null {
  const axisIds: Record<string, string | null> = {};
  for (const axis of ['x', 'y', 'z']) {
    const axisValue = axes[axis];
    const axisId = isRecord(axisValue) ? axisValue.axisId : axisValue;
    axisIds[axis] = typeof axisId === 'string' ? formatResourceRef(axisId) : null;
  }
  if (!axisIds.x || !axisIds.y) return null;
  let line = `${indent(indentLevel)}axes ${formatScalarString(axisIds.x)} ${formatScalarString(axisIds.y)}`;
  if (axisIds.z) {
    line += ` ${formatScalarString(axisIds.z)}`;
  }
  return line;
}

function formatAxesBlock(axes: Record<string, unknown>, indentLevel: number): string[] | null {
  const axisLines: string[] = [];
  for (const axis of ['x', 'y', 'z']) {
    const axisValue = axes[axis];
    const axisId = isRecord(axisValue) ? axisValue.axisId : axisValue;
    if (typeof axisId === 'string') {
      axisLines.push(`${indent(indentLevel + 1)}${axis} ${formatScalarString(formatResourceRef(axisId))}`);
    }
  }
  if (axisLines.length === 0) return null;
  return [
    `${indent(indentLevel)}axes do`,
    ...axisLines,
    `${indent(indentLevel)}end`
  ];
}

function formatRegionBlocks(regions: Record<string, unknown>[], indentLevel: number): string[] | null {
  if (regions.length === 0) return null;
  const lines: string[] = [];
  for (const region of regions) {
    if (!isRecord(region)) return null;
    const regionLines = formatRegionBlock(region, indentLevel);
    if (!regionLines) return null;
    lines.push(...regionLines);
  }
  return lines;
}

function formatRegionsBlock(regions: Record<string, unknown>[], indentLevel: number): string[] | null {
  if (regions.length === 0) return null;
  const lines: string[] = [];
  for (const region of regions) {
    if (!isRecord(region)) return null;
    const regionLines = formatRegionBlock(region, indentLevel + 1);
    if (!regionLines) return null;
    lines.push(...regionLines);
  }
  return [
    `${indent(indentLevel)}regions do`,
    ...lines,
    `${indent(indentLevel)}end`
  ];
}

function formatRegionBlock(region: Record<string, unknown>, indentLevel: number): string[] | null {
  const id = region.id;
  if (typeof id !== 'string') return null;
  const label = region.label;
  const labels = [formatLabel(id)];
  if (typeof label === 'string') labels.push(formatLabel(label));

  const header = `${indent(indentLevel)}region ${labels.join(' ')} do`;
  const lines = [header];
  const remaining = { ...region };
  delete remaining.id;
  delete remaining.label;

  const bounds = remaining.bounds;
  delete remaining.bounds;

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  if (isRecord(bounds)) {
    const boundsLine = formatBoundsLine(bounds, indentLevel + 1);
    if (boundsLine) {
      lines.push(boundsLine);
    } else {
      const boundsLines = formatBoundsBlock(bounds, indentLevel + 1);
      if (boundsLines) {
        lines.push(...boundsLines);
      } else {
        pushAttributeLine(lines, 'bounds', bounds, indentLevel + 1);
      }
    }
  } else if (bounds !== undefined) {
    pushAttributeLine(lines, 'bounds', bounds, indentLevel + 1);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatBoundsLine(bounds: Record<string, unknown>, indentLevel: number): string | null {
  const shape = bounds.shape;
  if (typeof shape !== 'string') return null;

  if (shape === 'circle') {
    const center = bounds.center;
    const radius = bounds.radius;
    if (!isRecord(center) || typeof center.x !== 'number' || typeof center.y !== 'number' || typeof radius !== 'number') {
      return null;
    }
    return `${indent(indentLevel)}bounds ${formatLabel(shape)} ${center.x} ${center.y} ${radius}`;
  }

  if (shape === 'rect') {
    const { x1, y1, x2, y2 } = bounds as Record<string, unknown>;
    if ([x1, y1, x2, y2].every((value) => typeof value === 'number')) {
      return `${indent(indentLevel)}bounds ${formatLabel(shape)} ${x1} ${y1} ${x2} ${y2}`;
    }
    return null;
  }

  if (shape === 'polygon') {
    const points = bounds.points;
    if (!Array.isArray(points) || points.length === 0) return null;
    const coords: string[] = [];
    for (const point of points) {
      if (!isRecord(point) || typeof point.x !== 'number' || typeof point.y !== 'number') {
        return null;
      }
      coords.push(`${point.x} ${point.y}`);
    }
    return `${indent(indentLevel)}bounds ${formatLabel(shape)} ${coords.join(' ')}`;
  }

  return null;
}

function formatBoundsBlock(bounds: Record<string, unknown>, indentLevel: number): string[] | null {
  const shape = bounds.shape;
  if (typeof shape !== 'string') return null;

  const lines: string[] = [];
  lines.push(`${indent(indentLevel)}bounds ${formatLabel(shape)} do`);

  if (shape === 'circle') {
    const center = bounds.center;
    const radius = bounds.radius;
    if (isRecord(center) && typeof center.x === 'number' && typeof center.y === 'number') {
      lines.push(`${indent(indentLevel + 1)}center ${center.x} ${center.y}`);
    } else {
      return null;
    }
    if (typeof radius === 'number') {
      lines.push(`${indent(indentLevel + 1)}radius ${radius}`);
    } else {
      return null;
    }
  } else if (shape === 'rect') {
    const { x1, y1, x2, y2 } = bounds as Record<string, unknown>;
    if ([x1, y1, x2, y2].every((value) => typeof value === 'number')) {
      lines.push(`${indent(indentLevel + 1)}x1 ${x1}`);
      lines.push(`${indent(indentLevel + 1)}y1 ${y1}`);
      lines.push(`${indent(indentLevel + 1)}x2 ${x2}`);
      lines.push(`${indent(indentLevel + 1)}y2 ${y2}`);
    } else {
      return null;
    }
  } else if (shape === 'polygon') {
    const points = bounds.points;
    if (!Array.isArray(points)) return null;
    for (const point of points) {
      if (!isRecord(point) || typeof point.x !== 'number' || typeof point.y !== 'number') {
        return null;
      }
      lines.push(`${indent(indentLevel + 1)}point ${point.x} ${point.y}`);
    }
  } else {
    return null;
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatCultureBlock(item: Record<string, unknown>): string | null {
  const id = item.id;
  if (typeof id !== 'string') return null;
  const lines = [`culture ${formatLabel(id)} do`];
  const remaining = { ...item };
  delete remaining.id;

  delete remaining.naming;

  const axisBiases = remaining.axisBiases;
  delete remaining.axisBiases;
  const homeRegions = remaining.homeRegions;
  delete remaining.homeRegions;

  const extraLines = formatAttributeLines(remaining, 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  if (isRecord(axisBiases)) {
    const entries = Object.entries(axisBiases).sort(([a], [b]) => a.localeCompare(b));
    for (const [kind, bias] of entries) {
      if (!isRecord(bias) || typeof bias.x !== 'number' || typeof bias.y !== 'number' || typeof bias.z !== 'number') {
        pushAttributeLine(lines, 'axisBiases', axisBiases, 1);
        break;
      }
      lines.push(`${indent(1)}axis_bias ${formatLabel(kind)} ${bias.x} ${bias.y} ${bias.z}`);
    }
  } else if (axisBiases !== undefined) {
    pushAttributeLine(lines, 'axisBiases', axisBiases, 1);
  }

  if (isRecord(homeRegions)) {
    const entries = Object.entries(homeRegions).sort(([a], [b]) => a.localeCompare(b));
    for (const [kind, regions] of entries) {
      if (!Array.isArray(regions)) {
        pushAttributeLine(lines, 'homeRegions', homeRegions, 1);
        break;
      }
      if (regions.length === 0) {
        continue;
      }
      const regionTokens = regions.map((region) => (typeof region === 'string' ? formatLabel(region) : null));
      if (regionTokens.some((token) => token === null)) {
        pushAttributeLine(lines, 'homeRegions', homeRegions, 1);
        break;
      }
      lines.push(`${indent(1)}home_region ${formatLabel(kind)} ${regionTokens.join(' ')}`);
    }
  } else if (homeRegions !== undefined) {
    pushAttributeLine(lines, 'homeRegions', homeRegions, 1);
  }

  lines.push('end');
  return lines.join('\n');
}

function formatNamingBlock(naming: Record<string, unknown>, indentLevel: number): string[] {
  const lines = [`${indent(indentLevel)}naming do`];
  const remaining = { ...naming };

  const domains = Array.isArray(remaining.domains) ? remaining.domains.slice() : null;
  delete remaining.domains;
  const lexemeLists = isRecord(remaining.lexemeLists) ? remaining.lexemeLists : null;
  delete remaining.lexemeLists;
  const lexemeSpecs = Array.isArray(remaining.lexemeSpecs) ? remaining.lexemeSpecs.slice() : null;
  delete remaining.lexemeSpecs;
  const grammars = Array.isArray(remaining.grammars) ? remaining.grammars.slice() : null;
  delete remaining.grammars;
  const profiles = Array.isArray(remaining.profiles) ? remaining.profiles.slice() : null;
  delete remaining.profiles;

  if (domains) {
    domains.sort((a, b) => {
      if (!isRecord(a) || !isRecord(b)) return 0;
      if (typeof a.id !== 'string' || typeof b.id !== 'string') return 0;
      return a.id.localeCompare(b.id);
    });
    for (const domain of domains) {
      if (!isRecord(domain)) continue;
      const domainLines = formatNamingDomainBlock(domain, indentLevel + 1);
      if (domainLines) {
        lines.push(...domainLines);
      } else {
        const body = { ...domain };
        const labels: string[] = [];
        if (typeof body.id === 'string') {
          labels.push(body.id);
          delete body.id;
        }
        lines.push(
          ...formatBlock('domain', labels, body)
            .replace(/^/gm, indent(indentLevel + 1))
            .split('\n')
        );
      }
    }
  }

  if (lexemeLists) {
    const entries = Object.entries(lexemeLists).sort(([a], [b]) => a.localeCompare(b));
    for (const [id, value] of entries) {
      if (!isRecord(value)) continue;
      const lexemeLines = formatLexemeListBlock(id, value, indentLevel + 1);
      if (lexemeLines) {
        lines.push(...lexemeLines);
      } else {
        const body = { ...value };
        delete body.id;
        lines.push(
          ...formatBlock('lexeme_list', [id], body)
            .replace(/^/gm, indent(indentLevel + 1))
            .split('\n')
        );
      }
    }
  }

  if (lexemeSpecs) {
    lexemeSpecs.sort((a, b) => {
      if (!isRecord(a) || !isRecord(b)) return 0;
      if (typeof a.id !== 'string' || typeof b.id !== 'string') return 0;
      return a.id.localeCompare(b.id);
    });
    for (const spec of lexemeSpecs) {
      if (!isRecord(spec)) continue;
      const specLines = formatLexemeSpecBlock(spec, indentLevel + 1);
      if (specLines) {
        lines.push(...specLines);
      } else {
        const body = { ...spec };
        const labels: string[] = [];
        if (typeof body.id === 'string') {
          labels.push(body.id);
          delete body.id;
        }
        lines.push(
          ...formatBlock('lexeme_spec', labels, body)
            .replace(/^/gm, indent(indentLevel + 1))
            .split('\n')
        );
      }
    }
  }

  if (grammars) {
    grammars.sort((a, b) => {
      if (!isRecord(a) || !isRecord(b)) return 0;
      if (typeof a.id !== 'string' || typeof b.id !== 'string') return 0;
      return a.id.localeCompare(b.id);
    });
    for (const grammar of grammars) {
      if (!isRecord(grammar)) continue;
      const grammarLines = formatGrammarBlock(grammar, indentLevel + 1);
      if (grammarLines) {
        lines.push(...grammarLines);
      } else {
        const body = { ...grammar };
        const labels: string[] = [];
        if (typeof body.id === 'string') {
          labels.push(body.id);
          delete body.id;
        }
        lines.push(
          ...formatBlock('grammar', labels, body)
            .replace(/^/gm, indent(indentLevel + 1))
            .split('\n')
        );
      }
    }
  }

  if (profiles) {
    profiles.sort((a, b) => {
      if (!isRecord(a) || !isRecord(b)) return 0;
      if (typeof a.id !== 'string' || typeof b.id !== 'string') return 0;
      return a.id.localeCompare(b.id);
    });
    for (const profile of profiles) {
      if (!isRecord(profile)) continue;
      const profileLines = formatProfileBlock(profile, indentLevel + 1);
      if (profileLines) lines.push(...profileLines);
    }
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatNamingDomainBlock(domain: Record<string, unknown>, indentLevel: number): string[] | null {
  const id = domain.id;
  if (typeof id !== 'string') return null;
  const lines = [`${indent(indentLevel)}domain ${formatLabel(id)} do`];
  const remaining = { ...domain };
  delete remaining.id;

  const phonology = remaining.phonology;
  delete remaining.phonology;
  const morphology = remaining.morphology;
  delete remaining.morphology;
  const style = remaining.style;
  delete remaining.style;
  const cultureId = remaining.cultureId;
  delete remaining.cultureId;

  if (cultureId !== undefined) {
    pushInlinePairLine(lines, 'culture_id', formatResourceRefValue(cultureId), indentLevel + 1);
  }

  if (isRecord(phonology)) {
    lines.push(...formatPhonologyBlock(phonology, indentLevel + 1));
  } else if (phonology !== undefined) {
    pushAttributeLine(lines, 'phonology', phonology, indentLevel + 1);
  }

  if (isRecord(morphology)) {
    lines.push(...formatMorphologyBlock(morphology, indentLevel + 1));
  } else if (morphology !== undefined) {
    pushAttributeLine(lines, 'morphology', morphology, indentLevel + 1);
  }

  if (isRecord(style)) {
    lines.push(...formatNamingStyleBlock(style, indentLevel + 1));
  } else if (style !== undefined) {
    pushAttributeLine(lines, 'style', style, indentLevel + 1);
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatPhonologyBlock(phonology: Record<string, unknown>, indentLevel: number): string[] {
  const lines = [`${indent(indentLevel)}phonology do`];
  const remaining = { ...phonology };

  const lengthRange = remaining.lengthRange;
  delete remaining.lengthRange;
  const syllableTemplates = remaining.syllableTemplates;
  delete remaining.syllableTemplates;
  const favoredClusters = remaining.favoredClusters;
  delete remaining.favoredClusters;
  const forbiddenClusters = remaining.forbiddenClusters;
  delete remaining.forbiddenClusters;
  const favoredClusterBoost = remaining.favoredClusterBoost;
  delete remaining.favoredClusterBoost;
  const consonantWeights = remaining.consonantWeights;
  delete remaining.consonantWeights;
  const vowelWeights = remaining.vowelWeights;
  delete remaining.vowelWeights;
  const templateWeights = remaining.templateWeights;
  delete remaining.templateWeights;
  const maxCluster = remaining.maxConsonantCluster;
  delete remaining.maxConsonantCluster;
  const minVowelSpacing = remaining.minVowelSpacing;
  delete remaining.minVowelSpacing;
  const sonorityRanks = remaining.sonorityRanks;
  delete remaining.sonorityRanks;

  for (const key of ['consonants', 'vowels'] as const) {
    if (remaining[key] !== undefined) {
      pushInlinePairLine(lines, key, remaining[key], indentLevel + 1);
      delete remaining[key];
    }
  }

  if (syllableTemplates !== undefined) {
    pushInlinePairLine(lines, 'templates', syllableTemplates, indentLevel + 1);
  }
  if (Array.isArray(lengthRange) && lengthRange.length >= 2) {
    const [min, max] = lengthRange;
    if (typeof min === 'number' && typeof max === 'number') {
      lines.push(`${indent(indentLevel + 1)}length ${min} ${max}`);
    } else {
      pushAttributeLine(lines, 'lengthRange', lengthRange, indentLevel + 1);
    }
  } else if (lengthRange !== undefined) {
    pushAttributeLine(lines, 'lengthRange', lengthRange, indentLevel + 1);
  }
  if (favoredClusters !== undefined) {
    pushInlinePairLine(lines, 'favored_clusters', favoredClusters, indentLevel + 1);
  }
  if (forbiddenClusters !== undefined) {
    pushInlinePairLine(lines, 'forbidden_clusters', forbiddenClusters, indentLevel + 1);
  }
  if (favoredClusterBoost !== undefined) {
    pushInlinePairLine(lines, 'favored_cluster_boost', favoredClusterBoost, indentLevel + 1);
  }
  if (consonantWeights !== undefined) {
    pushInlinePairLine(lines, 'consonant_weights', consonantWeights, indentLevel + 1);
  }
  if (vowelWeights !== undefined) {
    pushInlinePairLine(lines, 'vowel_weights', vowelWeights, indentLevel + 1);
  }
  if (templateWeights !== undefined) {
    pushInlinePairLine(lines, 'template_weights', templateWeights, indentLevel + 1);
  }
  if (maxCluster !== undefined) {
    pushInlinePairLine(lines, 'max_cluster', maxCluster, indentLevel + 1);
  }
  if (minVowelSpacing !== undefined) {
    pushInlinePairLine(lines, 'min_vowel_spacing', minVowelSpacing, indentLevel + 1);
  }
  if (sonorityRanks !== undefined) {
    pushInlinePairLine(lines, 'sonority', sonorityRanks, indentLevel + 1);
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatMorphologyBlock(morphology: Record<string, unknown>, indentLevel: number): string[] {
  const lines = [`${indent(indentLevel)}morphology do`];
  const remaining = { ...morphology };

  const wordRoots = remaining.wordRoots;
  delete remaining.wordRoots;
  const prefixWeights = remaining.prefixWeights;
  delete remaining.prefixWeights;
  const suffixWeights = remaining.suffixWeights;
  delete remaining.suffixWeights;
  const structureWeights = remaining.structureWeights;
  delete remaining.structureWeights;

  for (const key of ['prefixes', 'suffixes', 'infixes', 'honorifics', 'structure', 'word_roots'] as const) {
    if (key === 'word_roots') {
      if (wordRoots !== undefined) {
        pushInlinePairLine(lines, 'word_roots', wordRoots, indentLevel + 1);
      }
      continue;
    }
    if (remaining[key] !== undefined) {
      pushInlinePairLine(lines, key, remaining[key], indentLevel + 1);
      delete remaining[key];
    }
  }

  if (prefixWeights !== undefined) {
    pushInlinePairLine(lines, 'prefix_weights', prefixWeights, indentLevel + 1);
  }
  if (suffixWeights !== undefined) {
    pushInlinePairLine(lines, 'suffix_weights', suffixWeights, indentLevel + 1);
  }
  if (structureWeights !== undefined) {
    pushInlinePairLine(lines, 'structure_weights', structureWeights, indentLevel + 1);
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatNamingStyleBlock(style: Record<string, unknown>, indentLevel: number): string[] {
  const lines = [`${indent(indentLevel)}style do`];
  const remaining = { ...style };

  const apostropheRate = remaining.apostropheRate;
  delete remaining.apostropheRate;
  const hyphenRate = remaining.hyphenRate;
  delete remaining.hyphenRate;
  const preferredEndings = remaining.preferredEndings;
  delete remaining.preferredEndings;
  const preferredEndingBoost = remaining.preferredEndingBoost;
  delete remaining.preferredEndingBoost;
  const rhythmBias = remaining.rhythmBias;
  delete remaining.rhythmBias;
  const targetLength = remaining.targetLength;
  delete remaining.targetLength;
  const lengthTolerance = remaining.lengthTolerance;
  delete remaining.lengthTolerance;

  if (remaining.capitalization !== undefined) {
    pushInlinePairLine(lines, 'capitalization', remaining.capitalization, indentLevel + 1);
    delete remaining.capitalization;
  }
  if (apostropheRate !== undefined) {
    pushInlinePairLine(lines, 'apostrophe_rate', apostropheRate, indentLevel + 1);
  }
  if (hyphenRate !== undefined) {
    pushInlinePairLine(lines, 'hyphen_rate', hyphenRate, indentLevel + 1);
  }
  if (preferredEndings !== undefined) {
    pushInlinePairLine(lines, 'preferred_endings', preferredEndings, indentLevel + 1);
  }
  if (preferredEndingBoost !== undefined) {
    pushInlinePairLine(lines, 'preferred_ending_boost', preferredEndingBoost, indentLevel + 1);
  }
  if (rhythmBias !== undefined) {
    pushInlinePairLine(lines, 'rhythm_bias', rhythmBias, indentLevel + 1);
  }
  if (targetLength !== undefined) {
    pushInlinePairLine(lines, 'target_length', targetLength, indentLevel + 1);
  }
  if (lengthTolerance !== undefined) {
    pushInlinePairLine(lines, 'length_tolerance', lengthTolerance, indentLevel + 1);
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatLexemeListBlock(id: string, list: Record<string, unknown>, indentLevel: number): string[] | null {
  const lines = [`${indent(indentLevel)}lexeme_list ${formatLabel(id)} do`];
  const remaining = { ...list };
  delete remaining.id;

  const cultureId = remaining.cultureId;
  delete remaining.cultureId;

  const entriesValue = remaining.entries;
  const entries = Array.isArray(entriesValue) ? entriesValue : null;
  delete remaining.entries;

  if (cultureId !== undefined) {
    pushInlinePairLine(lines, 'culture_id', formatResourceRefValue(cultureId), indentLevel + 1);
  }

  if (remaining.description !== undefined) {
    pushInlinePairLine(lines, 'description', remaining.description, indentLevel + 1);
    delete remaining.description;
  }
  if (remaining.source !== undefined) {
    pushInlinePairLine(lines, 'source', remaining.source, indentLevel + 1);
    delete remaining.source;
  }

  if (entries) {
    for (const entry of entries) {
      const inline = formatInlineValue(entry);
      if (!inline) return null;
      lines.push(`${indent(indentLevel + 1)}entry ${inline}`);
    }
  } else if (entriesValue !== undefined) {
    pushAttributeLine(lines, 'entries', entriesValue, indentLevel + 1);
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatLexemeSpecBlock(spec: Record<string, unknown>, indentLevel: number): string[] | null {
  const id = spec.id;
  if (typeof id !== 'string') return null;
  const lines = [`${indent(indentLevel)}lexeme_spec ${formatLabel(id)} do`];
  const remaining = { ...spec };
  delete remaining.id;

  const targetCount = remaining.targetCount;
  delete remaining.targetCount;
  const qualityFilter = remaining.qualityFilter;
  delete remaining.qualityFilter;
  const cultureId = remaining.cultureId;
  delete remaining.cultureId;
  const maxWords = remaining.maxWords;
  delete remaining.maxWords;
  const wordStyle = remaining.wordStyle;
  delete remaining.wordStyle;

  if (remaining.pos !== undefined) {
    pushInlinePairLine(lines, 'pos', remaining.pos, indentLevel + 1);
    delete remaining.pos;
  }
  if (remaining.style !== undefined) {
    pushInlinePairLine(lines, 'style', remaining.style, indentLevel + 1);
    delete remaining.style;
  }
  if (targetCount !== undefined) {
    pushInlinePairLine(lines, 'target', targetCount, indentLevel + 1);
  }
  if (cultureId !== undefined) {
    pushInlinePairLine(lines, 'culture_id', formatResourceRefValue(cultureId), indentLevel + 1);
  }
  if (maxWords !== undefined) {
    pushInlinePairLine(lines, 'max_words', maxWords, indentLevel + 1);
  }
  if (wordStyle !== undefined) {
    pushInlinePairLine(lines, 'word_style', wordStyle, indentLevel + 1);
  }
  if (isRecord(qualityFilter)) {
    const minLength = qualityFilter.minLength;
    const maxLength = qualityFilter.maxLength;
    if (typeof minLength === 'number' && typeof maxLength === 'number') {
      lines.push(`${indent(indentLevel + 1)}quality ${minLength} ${maxLength}`);
    } else {
      pushAttributeLine(lines, 'qualityFilter', qualityFilter, indentLevel + 1);
    }
  } else if (qualityFilter !== undefined) {
    pushAttributeLine(lines, 'qualityFilter', qualityFilter, indentLevel + 1);
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatGrammarBlock(grammar: Record<string, unknown>, indentLevel: number): string[] | null {
  const id = grammar.id;
  if (typeof id !== 'string') return null;
  const lines = [`${indent(indentLevel)}grammar ${formatLabel(id)} do`];
  const remaining = { ...grammar };
  delete remaining.id;

  const cultureId = remaining.cultureId;
  delete remaining.cultureId;

  if (cultureId !== undefined) {
    pushInlinePairLine(lines, 'culture_id', formatResourceRefValue(cultureId), indentLevel + 1);
  }

  const rulesValue = remaining.rules;
  const rules = isRecord(rulesValue) ? (rulesValue as Record<string, unknown>) : null;
  delete remaining.rules;

  if (remaining.start !== undefined) {
    pushInlinePairLine(lines, 'start', remaining.start, indentLevel + 1);
    delete remaining.start;
  }
  if (remaining.capitalization !== undefined) {
    pushInlinePairLine(lines, 'capitalization', remaining.capitalization, indentLevel + 1);
    delete remaining.capitalization;
  }

  if (rules) {
    const ruleEntries = Object.entries(rules).sort(([a], [b]) => a.localeCompare(b));
    for (const [name, value] of ruleEntries) {
      if (!Array.isArray(value)) return null;
      for (const option of value) {
        if (!Array.isArray(option)) return null;
        const tokens: string[] = [];
        for (const token of option) {
          const inline = formatInlineValue(token);
          if (!inline) return null;
          tokens.push(inline);
        }
        lines.push(`${indent(indentLevel + 1)}rule ${formatLabel(name)} [${tokens.join(' ')}]`);
      }
    }
  } else if (rulesValue !== undefined) {
    pushAttributeLine(lines, 'rules', rulesValue, indentLevel + 1);
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatProfileBlock(profile: Record<string, unknown>, indentLevel: number): string[] | null {
  const id = profile.id;
  if (typeof id !== 'string') return null;
  const lines = [`${indent(indentLevel)}profile ${formatLabel(id)} do`];
  const remaining = { ...profile };
  delete remaining.id;

  const cultureId = remaining.cultureId;
  delete remaining.cultureId;

  if (cultureId !== undefined) {
    pushInlinePairLine(lines, 'culture_id', formatResourceRefValue(cultureId), indentLevel + 1);
  }

  const strategyGroups = Array.isArray(remaining.strategyGroups) ? remaining.strategyGroups.slice() : null;
  delete remaining.strategyGroups;

  if (remaining.name !== undefined) {
    pushAttributeLine(lines, 'name', remaining.name, indentLevel + 1);
    delete remaining.name;
  }
  if (remaining.isDefault !== undefined) {
    pushAttributeLine(lines, 'isDefault', remaining.isDefault, indentLevel + 1);
    delete remaining.isDefault;
  }
  if (remaining.entityKinds !== undefined) {
    pushAttributeLine(lines, 'entityKinds', remaining.entityKinds, indentLevel + 1);
    delete remaining.entityKinds;
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  if (strategyGroups) {
    for (const group of strategyGroups) {
      if (!isRecord(group)) continue;
      const groupLines = formatStrategyGroupBlock(group, indentLevel + 1);
      if (groupLines) lines.push(...groupLines);
    }
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatStrategyGroupBlock(group: Record<string, unknown>, indentLevel: number): string[] | null {
  const name = group.name;
  const labels: string[] = [];
  if (typeof name === 'string') labels.push(name);
  const header = `${indent(indentLevel)}strategy_group${labels.length > 0 ? ' ' + labels.map(formatLabel).join(' ') : ''} do`;
  const lines = [header];
  const remaining = { ...group };
  delete remaining.name;

  const conditions = remaining.conditions;
  delete remaining.conditions;
  const strategies = Array.isArray(remaining.strategies) ? remaining.strategies : null;
  delete remaining.strategies;

  if (remaining.priority !== undefined) {
    pushAttributeLine(lines, 'priority', remaining.priority, indentLevel + 1);
    delete remaining.priority;
  }

  const extraLines = formatAttributeLines(remaining, indentLevel + 1);
  if (extraLines.length > 0) {
    lines.push(...extraLines);
  }

  if (conditions !== undefined) {
    if (isRecord(conditions)) {
      lines.push(
        ...formatBlock('conditions', [], conditions)
          .replace(/^/gm, indent(indentLevel + 1))
          .split('\n')
      );
    } else {
      pushAttributeLine(lines, 'conditions', conditions, indentLevel + 1);
    }
  }

  if (strategies) {
    for (const strategy of strategies) {
      if (!isRecord(strategy)) continue;
      const entryLines = formatStrategyEntry(strategy, indentLevel + 1);
      if (entryLines) lines.push(...entryLines);
    }
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatStrategyEntry(strategy: Record<string, unknown>, indentLevel: number): string[] | null {
  const type = strategy.type;
  if (typeof type !== 'string') return null;
  const body = { ...strategy };
  delete body.type;

  const labels = [type];
  if (type === 'grammar' && typeof body.grammarId === 'string') {
    labels.push(formatResourceRef(body.grammarId));
    delete body.grammarId;
  }
  if (type === 'phonotactic' && typeof body.domainId === 'string') {
    labels.push(formatResourceRef(body.domainId));
    delete body.domainId;
  }

  return formatEntryLineOrBlock('strategy', labels, body, indentLevel);
}

function formatAttributeLines(obj: Record<string, unknown>, indentLevel: number): string[] {
  const lines: string[] = [];
  const entries = Object.entries(obj).filter(([, value]) => value !== undefined);

  for (const [key, value] of entries) {
    if (key === 'creation' && Array.isArray(value)) {
      const entryLines = formatCreationEntries(value, indentLevel);
      if (entryLines) {
        lines.push(...entryLines);
        continue;
      }
    }
    if (key === 'relationships' && Array.isArray(value)) {
      const entryLines = formatRelationshipEntries(value, indentLevel);
      if (entryLines) {
        lines.push(...entryLines);
        continue;
      }
    }
    if (key === 'variables' && isRecord(value)) {
      const entryLines = formatVariableEntries(value, indentLevel);
      if (entryLines) {
        lines.push(...entryLines);
        continue;
      }
    }
    if (key === 'applicability' && Array.isArray(value)) {
      const entryLines = formatApplicabilityEntries(value, indentLevel);
      if (entryLines) {
        lines.push(...entryLines);
        continue;
      }
    }
    const valueLines = formatValueLines(value, indentLevel + 1);
    const valueIndent = indent(indentLevel + 1);
    const first = valueLines[0].startsWith(valueIndent)
      ? valueLines[0].slice(valueIndent.length)
      : valueLines[0];
    lines.push(`${indent(indentLevel)}${formatAttributeKey(key)}:${first}`);
    if (valueLines.length > 1) {
      lines.push(...valueLines.slice(1));
    }
  }

  return lines;
}

function formatApplicabilityBlock(value: unknown, indentLevel: number): string[] | null {
  if (value === undefined || value === null) return null;
  let conditions: unknown[] | null = null;
  let mode: string | undefined;

  if (Array.isArray(value)) {
    conditions = value;
  } else if (isRecord(value) && (value.type === 'and' || value.type === 'or') && Array.isArray(value.conditions)) {
    conditions = value.conditions as unknown[];
    mode = value.type === 'or' ? 'any' : 'all';
  } else {
    return null;
  }

  if (conditions.length === 0) return null;

  const header = `${indent(indentLevel)}when${mode ? ' ' + mode : ''} do`;
  const lines = [header];
  for (const condition of conditions) {
    lines.push(...formatConditionLines(condition, indentLevel + 1));
  }
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatConditionLines(condition: unknown, indentLevel: number): string[] {
  if (!isRecord(condition)) {
    const lines: string[] = [];
    pushAttributeLine(lines, 'condition', condition, indentLevel);
    return lines;
  }

  const cleaned = cloneAndStripRefs(condition) as Record<string, unknown>;
  const type = cleaned.type;

  if (type === 'pressure' && typeof cleaned.pressureId === 'string') {
    const min = cleaned.min;
    const max = cleaned.max;
    if (typeof min === 'number' && typeof max === 'number' && min === max) {
      return [`${indent(indentLevel)}pressure ${cleaned.pressureId} == ${min}`];
    }
    if (typeof min === 'number' && max === undefined) {
      return [`${indent(indentLevel)}pressure ${cleaned.pressureId} >= ${min}`];
    }
    if (typeof max === 'number' && min === undefined) {
      return [`${indent(indentLevel)}pressure ${cleaned.pressureId} <= ${max}`];
    }
  }

  if (type === 'entity_count' && typeof cleaned.kind === 'string') {
    const min = cleaned.min;
    const max = cleaned.max;
    if (cleaned.subtype === undefined && cleaned.status === undefined) {
      if (typeof min === 'number' && typeof max === 'number' && min === max) {
        return [`${indent(indentLevel)}cap kind ${cleaned.kind} == ${min}`];
      }
      if (typeof min === 'number' && max === undefined) {
        return [`${indent(indentLevel)}cap kind ${cleaned.kind} >= ${min}`];
      }
      if (typeof max === 'number' && min === undefined) {
        return [`${indent(indentLevel)}cap kind ${cleaned.kind} <= ${max}`];
      }
    }
  }

  if (type === 'relationship_count' && typeof cleaned.relationshipKind === 'string') {
    const min = cleaned.min;
    const max = cleaned.max;
    const direction = typeof cleaned.direction === 'string' ? cleaned.direction : null;
    const kind = formatLabel(cleaned.relationshipKind);
    if (typeof min === 'number' && typeof max === 'number' && min === max) {
      return [
        `${indent(indentLevel)}relationship_count ${kind}${direction ? ' ' + direction : ''} == ${min}`
      ];
    }
    if (typeof min === 'number' && max === undefined) {
      return [
        `${indent(indentLevel)}relationship_count ${kind}${direction ? ' ' + direction : ''} >= ${min}`
      ];
    }
    if (typeof max === 'number' && min === undefined) {
      return [
        `${indent(indentLevel)}relationship_count ${kind}${direction ? ' ' + direction : ''} <= ${max}`
      ];
    }
  }

  if (type === 'prominence') {
    if (typeof cleaned.min === 'string' && cleaned.max === undefined) {
      return [`${indent(indentLevel)}prominence min ${formatLabel(cleaned.min)}`];
    }
    if (typeof cleaned.max === 'string' && cleaned.min === undefined) {
      return [`${indent(indentLevel)}prominence max ${formatLabel(cleaned.max)}`];
    }
  }

  if (type === 'lacks_tag' && typeof cleaned.tag === 'string') {
    if (typeof cleaned.entity === 'string') {
      return [
        `${indent(indentLevel)}lacks_tag ${formatLabel(stripBinding(cleaned.entity))} ${formatLabel(cleaned.tag)}`
      ];
    }
    return [`${indent(indentLevel)}lacks_tag ${formatLabel(cleaned.tag)}`];
  }

  if (type === 'graph_path' && isRecord(cleaned.assert)) {
    const graphLines = formatGraphPathLines(cleaned.assert, indentLevel, 'path');
    if (graphLines) return graphLines;
  }

  return formatEntryLineOrBlock('condition', [], cleaned, indentLevel);
}

function formatSelectionBlock(value: unknown, indentLevel: number): string[] | null {
  if (!isRecord(value)) return null;
  const cleaned = cloneAndStripRefs(value) as Record<string, unknown>;
  const selection = { ...cleaned };
  const labels: string[] = ['target'];

  if (typeof selection.kind === 'string') {
    labels.push('from', selection.kind);
    delete selection.kind;
  }

  const header = `${indent(indentLevel)}choose ${labels.map(formatLabel).join(' ')} do`;
  const lines = [header];
  const innerIndent = indentLevel + 1;

  if (selection.strategy !== undefined) {
    if (selection.strategy !== 'by_kind') {
      pushInlinePairLine(lines, 'strategy', selection.strategy, innerIndent);
    }
    delete selection.strategy;
  }

  const pickStrategy = selection.pickStrategy ?? 'random';
  pushInlinePairLine(lines, 'pick', pickStrategy, innerIndent);
  delete selection.pickStrategy;

  if (selection.kinds !== undefined) {
    pushInlinePairLine(lines, 'kinds', selection.kinds, innerIndent);
    delete selection.kinds;
  }

  if (Array.isArray(selection.subtypes) && selection.subtypes.length > 0) {
    if (selection.subtypes.length > 1) {
      const inline = formatInlineValue(selection.subtypes);
      if (inline) {
        lines.push(`${indent(innerIndent)}subtype in ${inline}`);
      } else {
        pushAttributeLine(lines, 'subtypes', selection.subtypes, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'subtype', selection.subtypes[0], innerIndent);
    }
    delete selection.subtypes;
  }

  if (Array.isArray(selection.statuses) && selection.statuses.length > 0) {
    if (selection.statuses.length > 1) {
      const inline = formatInlineValue(selection.statuses);
      if (inline) {
        lines.push(`${indent(innerIndent)}status in ${inline}`);
      } else {
        pushAttributeLine(lines, 'statuses', selection.statuses, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'status', selection.statuses[0], innerIndent);
    }
    delete selection.statuses;
  }

  if (selection.statusFilter !== undefined) {
    pushInlinePairLine(lines, 'status', selection.statusFilter, innerIndent);
    delete selection.statusFilter;
  }

  if (selection.maxResults !== undefined) {
    pushInlinePairLine(lines, 'max', selection.maxResults, innerIndent);
    delete selection.maxResults;
  }

  if (Array.isArray(selection.saturationLimits) && selection.saturationLimits.length > 0) {
    const saturationLines = formatSaturationLines(selection.saturationLimits, innerIndent);
    if (saturationLines) {
      lines.push(...saturationLines);
      delete selection.saturationLimits;
    }
  }

  if (selection.referenceEntity !== undefined) {
    pushInlinePairLine(lines, 'referenceEntity', selection.referenceEntity, innerIndent);
    delete selection.referenceEntity;
  }

  if (selection.relationshipKind !== undefined) {
    pushInlinePairLine(lines, 'relationshipKind', selection.relationshipKind, innerIndent);
    delete selection.relationshipKind;
  }

  if (selection.direction !== undefined) {
    pushInlinePairLine(lines, 'direction', selection.direction, innerIndent);
    delete selection.direction;
  }

  if (selection.mustHave !== undefined) {
    pushInlinePairLine(lines, 'mustHave', selection.mustHave, innerIndent);
    delete selection.mustHave;
  }

  if (selection.excludeSubtypes !== undefined) {
    pushInlinePairLine(lines, 'excludeSubtypes', selection.excludeSubtypes, innerIndent);
    delete selection.excludeSubtypes;
  }

  if (selection.notStatus !== undefined) {
    pushInlinePairLine(lines, 'notStatus', selection.notStatus, innerIndent);
    delete selection.notStatus;
  }

  if (selection.subtypePreferences !== undefined) {
    pushInlinePairLine(lines, 'subtypePreferences', selection.subtypePreferences, innerIndent);
    delete selection.subtypePreferences;
  }

  if (selection.maxDistance !== undefined) {
    pushInlinePairLine(lines, 'maxDistance', selection.maxDistance, innerIndent);
    delete selection.maxDistance;
  }

  if (selection.minProminence !== undefined) {
    pushInlinePairLine(lines, 'minProminence', selection.minProminence, innerIndent);
    delete selection.minProminence;
  }

  if (selection.filters !== undefined) {
    const filterLines = formatFilterLines(selection.filters, innerIndent, 'filter');
    if (filterLines) {
      lines.push(...filterLines);
    } else {
      pushInlinePairLine(lines, 'filters', selection.filters, innerIndent);
    }
    delete selection.filters;
  }

  if (selection.preferFilters !== undefined) {
    const preferLines = formatFilterLines(selection.preferFilters, innerIndent, 'prefer');
    if (preferLines) {
      lines.push(...preferLines);
    } else {
      pushInlinePairLine(lines, 'preferFilters', selection.preferFilters, innerIndent);
    }
    delete selection.preferFilters;
  }

  for (const [key, value] of Object.entries(selection)) {
    if (value === undefined) continue;
    pushAttributeLine(lines, key, value, innerIndent);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatFilterLines(value: unknown, indentLevel: number, keyword: 'filter' | 'prefer'): string[] | null {
  if (!Array.isArray(value)) return null;
  const lines: string[] = [];
  for (const entry of value) {
    const line = formatFilterLine(entry, indentLevel, keyword);
    if (!line) return null;
    lines.push(...line);
  }
  return lines;
}

function formatFilterLine(
  value: unknown,
  indentLevel: number,
  keyword: 'filter' | 'prefer'
): string[] | null {
  if (!isRecord(value)) return null;
  const cleaned = cloneAndStripRefs(value) as Record<string, unknown>;
  const type = cleaned.type;
  if (typeof type !== 'string') return null;

  if (type === 'graph_path' && isRecord(cleaned.assert)) {
    return formatGraphPathLines(cleaned.assert, indentLevel, `${keyword} path`);
  }

  if (type === 'exclude' && Array.isArray(cleaned.entities)) {
    const entities = cleaned.entities.map((entry) => formatLabel(String(entry)));
    if (entities.length === 0) return null;
    return [`${indent(indentLevel)}${keyword} exclude ${entities.join(' ')}`];
  }

  if (type === 'has_relationship' || type === 'lacks_relationship') {
    const kind = cleaned.kind;
    if (typeof kind !== 'string') return null;
    const parts = [`${indent(indentLevel)}${keyword}`, type, formatLabel(kind)];
    if (typeof cleaned.with === 'string') {
      parts.push('with', formatLabel(stripBinding(cleaned.with)));
    }
    if (type === 'has_relationship' && typeof cleaned.direction === 'string') {
      parts.push('direction', cleaned.direction);
    }
    return [parts.join(' ')];
  }

  if (type === 'has_tag' || type === 'lacks_tag') {
    const tag = cleaned.tag;
    if (typeof tag !== 'string') return null;
    const parts = [`${indent(indentLevel)}${keyword}`, type, formatLabel(tag)];
    if (cleaned.value !== undefined) {
      const valueText = formatInlineValue(cleaned.value);
      if (!valueText) return null;
      parts.push(valueText);
    }
    return [parts.join(' ')];
  }

  if (type === 'has_any_tag' && Array.isArray(cleaned.tags)) {
    const tags = cleaned.tags.map((entry) => formatLabel(String(entry)));
    return [`${indent(indentLevel)}${keyword} has_any_tag ${tags.join(' ')}`];
  }

  if (type === 'matches_culture' || type === 'not_matches_culture') {
    const withValue = cleaned.with;
    if (typeof withValue !== 'string') return null;
    return [`${indent(indentLevel)}${keyword} ${type} ${formatLabel(stripBinding(withValue))}`];
  }

  if (type === 'has_culture' || type === 'not_has_culture') {
    const culture = cleaned.culture;
    if (typeof culture !== 'string') return null;
    return [`${indent(indentLevel)}${keyword} ${type} ${formatLabel(culture)}`];
  }

  return null;
}

function formatGraphPathLines(
  assert: Record<string, unknown>,
  indentLevel: number,
  prefix: string
): string[] | null {
  const check = assert.check;
  const path = assert.path;
  if (typeof check !== 'string' || !Array.isArray(path)) return null;
  const lines: string[] = [];
  lines.push(`${indent(indentLevel)}${prefix} ${check} do`);
  const innerIndent = indentLevel + 1;
  if (typeof assert.count === 'number') {
    lines.push(`${indent(innerIndent)}count ${assert.count}`);
  }
  for (const step of path) {
    const stepLines = formatGraphPathStepLines(step, innerIndent);
    if (!stepLines) return null;
    lines.push(...stepLines);
  }
  if (Array.isArray(assert.where)) {
    for (const constraint of assert.where) {
      const whereLine = formatPathConstraintLine(constraint, innerIndent);
      if (!whereLine) return null;
      lines.push(whereLine);
    }
  }
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatGraphPathStepLines(step: unknown, indentLevel: number): string[] | null {
  if (!isRecord(step)) return null;
  const via = step.via;
  const direction = step.direction;
  const targetKind = step.targetKind;
  const targetSubtype = step.targetSubtype;
  if (typeof direction !== 'string' || typeof targetKind !== 'string' || typeof targetSubtype !== 'string') return null;
  const viaText = formatInlineValue(via);
  if (!viaText) return null;
  const base = `step ${viaText} ${direction} ${formatLabel(targetKind)} ${formatLabel(targetSubtype)}`;
  const status = typeof step.targetStatus === 'string' ? step.targetStatus : null;
  const filters = Array.isArray(step.filters) ? step.filters : null;

  if (!filters || filters.length === 0) {
    const suffix = status ? ` status ${formatLabel(status)}` : '';
    return [`${indent(indentLevel)}${base}${suffix}`];
  }

  const lines = [`${indent(indentLevel)}${base} do`];
  const innerIndent = indentLevel + 1;
  if (status) {
    lines.push(`${indent(innerIndent)}status ${formatLabel(status)}`);
  }
  const filterLines = formatFilterLines(filters, innerIndent, 'filter');
  if (!filterLines) return null;
  lines.push(...filterLines);
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatPathConstraintLine(value: unknown, indentLevel: number): string | null {
  if (!isRecord(value)) return null;
  const cleaned = cloneAndStripRefs(value) as Record<string, unknown>;
  const type = cleaned.type;
  if (typeof type !== 'string') return null;

  if (type === 'not_self') {
    return `${indent(indentLevel)}where not_self`;
  }
  if ((type === 'in' || type === 'not_in') && typeof cleaned.set === 'string') {
    return `${indent(indentLevel)}where ${type} ${formatLabel(cleaned.set)}`;
  }
  if ((type === 'has_relationship' || type === 'lacks_relationship')
    && typeof cleaned.kind === 'string'
    && typeof cleaned.with === 'string') {
    const parts = [
      `${indent(indentLevel)}where`,
      type,
      formatLabel(cleaned.kind),
      formatLabel(stripBinding(cleaned.with))
    ];
    if (typeof cleaned.direction === 'string') {
      parts.push('direction', cleaned.direction);
    }
    return parts.join(' ');
  }
  if (type === 'kind_equals' && typeof cleaned.kind === 'string') {
    return `${indent(indentLevel)}where kind ${formatLabel(cleaned.kind)}`;
  }
  if (type === 'subtype_equals' && typeof cleaned.subtype === 'string') {
    return `${indent(indentLevel)}where subtype ${formatLabel(cleaned.subtype)}`;
  }

  return null;
}

function formatSaturationLines(items: unknown[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const cleaned = cloneAndStripRefs(item) as Record<string, unknown>;
    const kind = cleaned.relationshipKind;
    if (typeof kind !== 'string') return null;
    if (cleaned.fromKind !== undefined) return null;
    const maxCount = cleaned.maxCount;
    if (typeof maxCount !== 'number') return null;
    const direction = cleaned.direction;
    let keyword = 'both';
    if (direction === 'in') keyword = 'inbound';
    else if (direction === 'out') keyword = 'outbound';
    else if (direction === 'both' || direction === undefined) keyword = 'both';
    else return null;
    lines.push(`${indent(indentLevel)}${keyword} ${kind} <= ${Math.floor(maxCount)}`);
  }
  return lines;
}

function formatLetEntry(name: string, value: Record<string, unknown>, indentLevel: number): string[] {
  const cleaned = cloneAndStripRefs(value) as Record<string, unknown>;
  const label = stripBinding(name);
  const selectValue = cleaned.select;

  if (!isRecord(selectValue)) {
    return formatEntryLineOrBlock('let', [label], cleaned, indentLevel);
  }

  const select = { ...selectValue };
  const lines: string[] = [];
  const header = `${indent(indentLevel)}let ${formatLabel(label)} do`;
  lines.push(header);
  const innerIndent = indentLevel + 1;

  if (select.from !== undefined) {
    if (select.from === 'graph') {
      lines.push(`${indent(innerIndent)}from graph`);
      delete select.from;
    } else if (isRecord(select.from)) {
      const relatedTo = select.from.relatedTo;
      const relationship = select.from.relationshipKind ?? select.from.relationship;
      const direction = select.from.direction;
      if (typeof relatedTo === 'string' && typeof relationship === 'string' && typeof direction === 'string') {
        lines.push(
          `${indent(innerIndent)}from ${formatLabel(stripBinding(relatedTo))} via ${relationship} ${direction}`
        );
        delete select.from;
      }
    }
  }

  if (select.kind !== undefined) {
    pushInlinePairLine(lines, 'kind', select.kind, innerIndent);
    delete select.kind;
  }

  if (select.kinds !== undefined) {
    pushInlinePairLine(lines, 'kinds', select.kinds, innerIndent);
    delete select.kinds;
  }

  if (Array.isArray(select.subtypes) && select.subtypes.length > 0) {
    if (select.subtypes.length > 1) {
      const inline = formatInlineValue(select.subtypes);
      if (inline) {
        lines.push(`${indent(innerIndent)}subtype in ${inline}`);
      } else {
        pushAttributeLine(lines, 'subtypes', select.subtypes, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'subtype', select.subtypes[0], innerIndent);
    }
    delete select.subtypes;
  }

  if (Array.isArray(select.statuses) && select.statuses.length > 0) {
    if (select.statuses.length > 1) {
      const inline = formatInlineValue(select.statuses);
      if (inline) {
        lines.push(`${indent(innerIndent)}status in ${inline}`);
      } else {
        pushAttributeLine(lines, 'statuses', select.statuses, innerIndent);
      }
    } else {
      pushInlinePairLine(lines, 'status', select.statuses[0], innerIndent);
    }
    delete select.statuses;
  }

  if (select.statusFilter !== undefined) {
    pushInlinePairLine(lines, 'status', select.statusFilter, innerIndent);
    delete select.statusFilter;
  }

  const pickStrategy = select.pickStrategy ?? 'random';
  pushInlinePairLine(lines, 'pick', pickStrategy, innerIndent);
  delete select.pickStrategy;

  if (select.maxResults !== undefined) {
    pushInlinePairLine(lines, 'max', select.maxResults, innerIndent);
    delete select.maxResults;
  }

  if (select.filters !== undefined) {
    const filterLines = formatFilterLines(select.filters, innerIndent, 'filter');
    if (filterLines) {
      lines.push(...filterLines);
    } else {
      pushInlinePairLine(lines, 'filters', select.filters, innerIndent);
    }
    delete select.filters;
  }

  if (select.preferFilters !== undefined) {
    const preferLines = formatFilterLines(select.preferFilters, innerIndent, 'prefer');
    if (preferLines) {
      lines.push(...preferLines);
    } else {
      pushInlinePairLine(lines, 'preferFilters', select.preferFilters, innerIndent);
    }
    delete select.preferFilters;
  }

  for (const [key, entry] of Object.entries(select)) {
    if (entry === undefined) continue;
    pushInlinePairLine(lines, key, entry, innerIndent);
  }

  if (cleaned.required !== undefined) {
    pushInlinePairLine(lines, 'required', cleaned.required, innerIndent);
  }

  for (const [key, entry] of Object.entries(cleaned)) {
    if (key === 'select' || key === 'required') continue;
    if (entry === undefined) continue;
    pushInlinePairLine(lines, key, entry, innerIndent);
  }

  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatMutationEntries(items: unknown[], indentLevel: number): string[] | null {
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    if (item.type !== 'modify_pressure') return null;
    const pressureId = item.pressureId;
    const delta = item.delta;
    if (typeof pressureId !== 'string' || typeof delta !== 'number') return null;
    const operator = delta < 0 ? '-=' : '+=';
    const value = Math.abs(delta);
    lines.push(`${indent(indentLevel)}mutate pressure ${pressureId} ${operator} ${value}`);
  }
  return lines.length > 0 ? lines : null;
}

function pushAttributeLine(lines: string[], key: string, value: unknown, indentLevel: number): void {
  const valueLines = formatValueLines(value, indentLevel + 1);
  const valueIndent = indent(indentLevel + 1);
  const first = valueLines[0].startsWith(valueIndent)
    ? valueLines[0].slice(valueIndent.length)
    : valueLines[0];
  lines.push(`${indent(indentLevel)}${formatAttributeKey(key)}:${first}`);
  if (valueLines.length > 1) {
    lines.push(...valueLines.slice(1));
  }
}

function pushInlinePairLine(lines: string[], key: string, value: unknown, indentLevel: number): void {
  const inline = formatInlineValue(value);
  if (!inline) {
    pushAttributeLine(lines, key, value, indentLevel);
    return;
  }
  lines.push(`${indent(indentLevel)}${formatAttributeKey(key)} ${inline}`);
}

function formatValueLines(value: unknown, indentLevel: number): string[] {
  if (value === null) {
    return [indent(indentLevel) + 'null'];
  }
  if (isCallValue(value)) {
    const formatted = formatCallValue(value);
    if (!formatted) return [indent(indentLevel) + 'null'];
    return [indent(indentLevel) + formatted];
  }
  if (typeof value === 'string') {
    return [indent(indentLevel) + formatScalarString(value)];
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [indent(indentLevel) + String(value)];
  }
  if (Array.isArray(value)) {
    const inlineValue = formatInlineValue(value);
    if (inlineValue) return [indent(indentLevel) + inlineValue];
    return formatArrayLines(value, indentLevel);
  }
  if (isRecord(value)) {
    const inlineValue = formatInlineValue(value);
    if (inlineValue) return [indent(indentLevel) + inlineValue];
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

  items.forEach((item) => {
    const itemLines = formatValueLines(item, indentLevel + 1);
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

  entries.forEach(([key, value]) => {
    const valueLines = formatValueLines(value, indentLevel + 1);
    const valueIndent = indent(indentLevel + 1);
    const first = valueLines[0].startsWith(valueIndent)
      ? valueLines[0].slice(valueIndent.length)
      : valueLines[0];
    lines.push(`${indent(indentLevel + 1)}${formatObjectKey(key)}:${first}`);
    if (valueLines.length > 1) {
      lines.push(...valueLines.slice(1));
    }
  });

  lines.push(indent(indentLevel) + '}');
  return lines;
}

function formatScalarString(value: string): string {
  if (isIdentifier(value) || isQualifiedIdentifier(value) || isVariableIdentifier(value) || isKindSubtype(value)) {
    return value;
  }
  return quoteString(value);
}

function formatResourceRef(value: string): string {
  return value.endsWith('.id') ? value : `${value}.id`;
}

function formatResourceRefValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return formatResourceRef(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => (typeof entry === 'string' ? formatResourceRef(entry) : entry));
  }
  return value;
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
  if (isIdentifier(value) || isQualifiedIdentifier(value) || isVariableIdentifier(value)) return value;
  return quoteString(value);
}

function formatCreationEntries(items: unknown[], indentLevel: number): string[] | null {
  if (items.length === 0) return null;
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const cleaned = cloneAndStripRefs(item) as Record<string, unknown>;
    const entityRef = cleaned.entityRef;
    if (typeof entityRef !== 'string') return null;
    const body = { ...cleaned };
    delete body.entityRef;
    lines.push(...formatEntryLineOrBlock('create', [stripBinding(entityRef)], body, indentLevel));
  }
  return lines;
}

function formatRelationshipEntries(items: unknown[], indentLevel: number): string[] | null {
  if (items.length === 0) return null;
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const cleaned = cloneAndStripRefs(item) as Record<string, unknown>;
    const kind = cleaned.kind;
    const src = cleaned.src;
    const dst = cleaned.dst;
    if (typeof kind !== 'string' || typeof src !== 'string' || typeof dst !== 'string') return null;
    const body = { ...cleaned };
    delete body.kind;
    delete body.src;
    delete body.dst;
    const pairs = formatInlinePairs(body);
    const formattedSrc = stripBinding(src);
    const formattedDst = stripBinding(dst);
    if (pairs !== null) {
      const prefix = `${indent(indentLevel)}rel ${formatLabel(kind)} ${formatLabel(formattedSrc)} -> ${formatLabel(formattedDst)}`;
      lines.push(pairs ? `${prefix} ${pairs}` : prefix);
      continue;
    }
    const header = `${indent(indentLevel)}rel ${formatLabel(kind)} ${formatLabel(formattedSrc)} ${formatLabel(formattedDst)} do`;
    const blockLines = [header];
    const bodyLines = formatAttributeLines(body, indentLevel + 1);
    if (bodyLines.length > 0) {
      blockLines.push(...bodyLines);
    }
    blockLines.push(`${indent(indentLevel)}end`);
    lines.push(...blockLines);
  }
  return lines;
}

function formatVariableEntries(vars: Record<string, unknown> | undefined, indentLevel: number): string[] | null {
  if (!vars || !isRecord(vars)) return null;
  const rawEntries = Object.entries(vars);
  if (rawEntries.some(([, value]) => !isRecord(value))) return null;
  const entries = rawEntries as Array<[string, Record<string, unknown>]>;
  if (entries.length === 0) return null;
  const lines: string[] = [];
  for (const [name, value] of orderVariableEntries(entries)) {
    lines.push(...formatLetEntry(name, value, indentLevel));
  }
  return lines;
}

function orderVariableEntries(
  entries: Array<[string, Record<string, unknown>]>
): Array<[string, Record<string, unknown>]> {
  const names = entries.map(([name]) => name);
  const entryByName = new Map(entries);
  const nameSet = new Set(names);
  const orderIndex = new Map(names.map((name, index) => [name, index]));

  const deps = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();

  for (const [name, value] of entries) {
    const refs = collectVariableRefs(value);
    const filtered = new Set(
      Array.from(refs).filter((ref) => ref !== name && nameSet.has(ref))
    );
    deps.set(name, filtered);
    for (const ref of filtered) {
      if (!dependents.has(ref)) dependents.set(ref, new Set());
      dependents.get(ref)?.add(name);
    }
  }

  const remainingDeps = new Map<string, Set<string>>();
  for (const [name, set] of deps) {
    remainingDeps.set(name, new Set(set));
  }

  const ready = names.filter((name) => (remainingDeps.get(name)?.size ?? 0) === 0);
  ready.sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));

  const orderedNames: string[] = [];
  while (ready.length > 0) {
    const name = ready.shift();
    if (!name) break;
    orderedNames.push(name);
    const dependentsFor = dependents.get(name);
    if (!dependentsFor) continue;
    for (const dependent of dependentsFor) {
      const set = remainingDeps.get(dependent);
      if (!set) continue;
      set.delete(name);
      if (set.size === 0) {
        ready.push(dependent);
        ready.sort((a, b) => (orderIndex.get(a) ?? 0) - (orderIndex.get(b) ?? 0));
      }
    }
  }

  if (orderedNames.length < names.length) {
    for (const name of names) {
      if (!orderedNames.includes(name)) orderedNames.push(name);
    }
  }

  return orderedNames
    .map((name) => {
      const entry = entryByName.get(name);
      return entry ? [name, entry] as [string, Record<string, unknown>] : null;
    })
    .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry));
}

function collectVariableRefs(value: unknown): Set<string> {
  const refs = new Set<string>();
  const visit = (entry: unknown) => {
    if (typeof entry === 'string') {
      const ref = extractVariableRef(entry);
      if (ref) refs.add(ref);
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    if (isRecord(entry)) {
      for (const [key, val] of Object.entries(entry)) {
        const keyRef = extractVariableRef(key);
        if (keyRef) refs.add(keyRef);
        visit(val);
      }
    }
  };
  visit(value);
  return refs;
}

function extractVariableRef(value: string): string | null {
  if (!VARIABLE_RE.test(value)) return null;
  const base = value.slice(1).split('.')[0];
  if (!base) return null;
  return `$${base}`;
}

function formatApplicabilityEntries(items: unknown[], indentLevel: number): string[] | null {
  if (items.length === 0) return null;
  const lines: string[] = [];
  for (const item of items) {
    if (!isRecord(item)) return null;
    const cleaned = cloneAndStripRefs(item) as Record<string, unknown>;
    const type = cleaned.type;
    if (typeof type !== 'string') return null;
    const body = { ...cleaned };
    delete body.type;
    lines.push(...formatEntryLineOrBlock('applicability', [type], body, indentLevel));
  }
  return lines;
}

function formatEntryLineOrBlock(
  keyword: string,
  labels: string[],
  body: Record<string, unknown>,
  indentLevel: number
): string[] {
  const pairs = formatInlinePairs(body);
  if (pairs !== null) {
    const labelText = labels.map(formatLabel).join(' ');
    const content = `${keyword}${labelText ? ' ' + labelText : ''}${pairs ? ' ' + pairs : ''}`;
    return [indent(indentLevel) + content];
  }

  const header = `${indent(indentLevel)}${keyword}${labels.length ? ' ' + labels.map(formatLabel).join(' ') : ''} do`;
  const lines = [header];
  const bodyLines = formatAttributeLines(body, indentLevel + 1);
  if (bodyLines.length > 0) {
    lines.push(...bodyLines);
  }
  lines.push(`${indent(indentLevel)}end`);
  return lines;
}

function formatInlinePairs(body: Record<string, unknown>): string | null {
  const entries = Object.entries(body).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return '';
  const parts: string[] = [];
  for (const [key, value] of entries) {
    const inlineValue = formatInlineValue(value);
    if (!inlineValue) return null;
    parts.push(`${formatAttributeKey(key)}:${inlineValue}`);
  }
  return parts.join(' ');
}

function isInlineFriendlyObject(value: Record<string, unknown>): boolean {
  return Object.values(value).every(entry => isInlineFriendlyValue(entry));
}

function isInlineFriendlyValue(value: unknown): boolean {
  if (value === undefined) return true;
  if (value === null) return true;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  if (isCallValue(value)) return true;
  if (Array.isArray(value)) {
    return value.every(entry => isInlineFriendlyValue(entry));
  }
  return false;
}

function formatInlineValue(value: unknown): string | null {
  if (value === null) return 'null';
  if (isCallValue(value)) return formatCallValue(value);
  if (typeof value === 'string') return formatScalarString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const parts = value.map(item => formatInlineValue(item));
    if (parts.some(part => part === null)) return null;
    return `[${parts.join(' ')}]`;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);
    if (entries.length === 0) return '{}';
    const parts: string[] = [];
    for (const [key, entry] of entries) {
      const inlineEntry = formatInlineValue(entry);
      if (!inlineEntry) return null;
      parts.push(`${formatObjectKey(key)}:${inlineEntry}`);
    }
    return `{ ${parts.join(' ')} }`;
  }
  return null;
}

function stripBinding(value: string): string {
  if (VARIABLE_RE.test(value)) {
    return value.slice(1);
  }
  return value;
}

function cloneAndStripRefs(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(entry => cloneAndStripRefs(entry));
  }
  if (!isRecord(value)) return value;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'replacements' && isRecord(entry)) {
      const replacements: Record<string, unknown> = {};
      for (const [repKey, repValue] of Object.entries(entry)) {
        if (typeof repValue === 'string') {
          replacements[repKey] = stripBinding(repValue);
        } else {
          replacements[repKey] = cloneAndStripRefs(repValue);
        }
      }
      result[key] = replacements;
      continue;
    }

    if (REF_KEYS.has(key) && typeof entry === 'string') {
      result[key] = stripBinding(entry);
      continue;
    }

    if (REF_LIST_KEYS.has(key) && Array.isArray(entry)) {
      result[key] = entry.map((item) => {
        if (typeof item === 'string') return stripBinding(item);
        return cloneAndStripRefs(item);
      });
      continue;
    }

    result[key] = cloneAndStripRefs(entry);
  }
  return result;
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

function isQualifiedIdentifier(value: string): boolean {
  if (!QUALIFIED_IDENTIFIER_RE.test(value)) return false;
  return value.split('.').every(segment => isIdentifier(segment));
}

function isKindSubtype(value: string): boolean {
  if (!KIND_SUBTYPE_RE.test(value)) return false;
  const [left, right] = value.split(':');
  return isIdentifier(left) && isIdentifier(right);
}

function isVariableIdentifier(value: string): boolean {
  return VARIABLE_RE.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCallValue(value: unknown): value is { type: 'call'; name: string; args: unknown[] } {
  return isRecord(value)
    && value.type === 'call'
    && typeof value.name === 'string'
    && Array.isArray(value.args);
}

function formatCallValue(value: { name: string; args: unknown[] }): string | null {
  const args = value.args.map((arg) => formatInlineValue(arg));
  if (args.some((arg) => arg === null)) return null;
  return `${value.name}(${args.join(', ')})`;
}

function normalizeStaticPageDir(value: string | undefined | null): string {
  if (value === undefined || value === null) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  return trimmed.replace(/[\\/]+/g, '/').replace(/^\/+|\/+$/g, '');
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

function resolveStaticPageFilename(slug: string, used: Set<string>): string {
  const base = slug && slug.length > 0 ? slug : 'page';
  let name = `${base}.md`;
  let suffix = 2;
  while (used.has(name)) {
    name = `${base}-${suffix}.md`;
    suffix += 1;
  }
  used.add(name);
  return name;
}
