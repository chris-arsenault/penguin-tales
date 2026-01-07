import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

const DEFAULT_INPUT = 'dist/bundles/default/bundle.json';
const DEFAULT_TARGET_BYTES = 500_000;

function parseArgs(argv) {
  const args = new Map();
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args.set(key, next);
      i += 1;
    } else {
      args.set(key, true);
    }
  }
  return args;
}

function normalizeTargetBytes(value) {
  if (!value) return DEFAULT_TARGET_BYTES;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TARGET_BYTES;
  return Math.floor(parsed);
}

function cloneBundle(bundle) {
  if (typeof structuredClone === 'function') {
    return structuredClone(bundle);
  }
  return JSON.parse(JSON.stringify(bundle));
}

function chunkNarrativeHistory(items, targetBytes) {
  const chunks = [];
  let current = [];
  let currentBytes = 2;
  let minTick = null;
  let maxTick = null;

  const flush = () => {
    if (!current.length) return;
    chunks.push({ items: current, bytes: currentBytes, minTick, maxTick });
    current = [];
    currentBytes = 2;
    minTick = null;
    maxTick = null;
  };

  for (const item of items) {
    const itemJson = JSON.stringify(item);
    const itemBytes = Buffer.byteLength(itemJson, 'utf8');
    const extraBytes = itemBytes + (current.length ? 1 : 0);
    if (current.length && currentBytes + extraBytes > targetBytes) {
      flush();
    }
    current.push(item);
    currentBytes += extraBytes;
    const tick = item?.tick;
    if (Number.isFinite(tick)) {
      minTick = minTick === null ? tick : Math.min(minTick, tick);
      maxTick = maxTick === null ? tick : Math.max(maxTick, tick);
    }
  }

  flush();
  return chunks;
}

async function main() {
  const args = parseArgs(process.argv);
  const inputPath = resolve(process.cwd(), args.get('input') ?? DEFAULT_INPUT);
  const outputDir = resolve(process.cwd(), args.get('output') ?? dirname(inputPath));
  const targetBytes = normalizeTargetBytes(args.get('target-bytes'));

  const raw = await readFile(inputPath, 'utf8');
  const bundle = JSON.parse(raw);
  const narrativeHistory = Array.isArray(bundle?.worldData?.narrativeHistory)
    ? bundle.worldData.narrativeHistory
    : [];

  const coreBundle = cloneBundle(bundle);
  if (coreBundle?.worldData && typeof coreBundle.worldData === 'object') {
    coreBundle.worldData.narrativeHistory = [];
  }

  const chunks = chunkNarrativeHistory(narrativeHistory, targetBytes);
  const chunkDir = join(outputDir, 'chunks');
  await mkdir(chunkDir, { recursive: true });

  const width = Math.max(3, String(Math.max(chunks.length - 1, 0)).length);
  const files = [];
  let totalChunkBytes = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const suffix = String(index).padStart(width, '0');
    const filename = `narrativeHistory-${suffix}.json`;
    const relativePath = `chunks/${filename}`;
    const chunkPath = join(chunkDir, filename);
    const payload = JSON.stringify(chunk.items);
    await writeFile(chunkPath, payload, 'utf8');
    totalChunkBytes += chunk.bytes;
    files.push({
      path: relativePath,
      eventCount: chunk.items.length,
      bytes: chunk.bytes,
      minTick: chunk.minTick ?? undefined,
      maxTick: chunk.maxTick ?? undefined,
    });
  }

  const manifest = {
    format: 'viewer-bundle-manifest',
    version: 1,
    generatedAt: new Date().toISOString(),
    core: 'bundle.core.json',
    fallback: 'bundle.json',
    chunks: {
      narrativeHistory: {
        targetBytes,
        totalEvents: narrativeHistory.length,
        totalBytes: totalChunkBytes,
        files,
      },
    },
  };

  await writeFile(join(outputDir, 'bundle.core.json'), JSON.stringify(coreBundle), 'utf8');
  await writeFile(join(outputDir, 'bundle.manifest.json'), JSON.stringify(manifest), 'utf8');

  console.log(
    `Viewer bundle chunked: ${narrativeHistory.length} events -> ${files.length} chunks (target ${targetBytes} bytes).`
  );
}

main().catch((error) => {
  console.error('Failed to chunk viewer bundle:', error);
  process.exitCode = 1;
});
