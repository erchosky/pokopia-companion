import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT_MARKER = 'pokopia-companion';

export function findRepositoryRoot(start = process.cwd()): string {
  let current = resolve(start);
  for (;;) {
    const packagePath = join(current, 'package.json');
    if (existsSync(packagePath)) {
      try {
        const parsed = JSON.parse(readFileSync(packagePath, 'utf8')) as { name?: string };
        if (parsed.name === ROOT_MARKER) return current;
      } catch {
        // Keep walking: nested workspaces also have package.json files.
      }
    }
    const parent = dirname(current);
    if (parent === current) return resolve(start);
    current = parent;
  }
}

const FALLBACKS = [
  'data/canonical/v3.1/pokopia-canonical.sqlite',
  'audit-data/pokopia-review.sqlite',
  'data/canonical/pokopia.sqlite',
  'data/processed/pokopia-v3.1.sqlite',
  'data/source/Pokopia-KB-FULL/pokopia.sqlite',
  'Pokopia-KB-FULL/pokopia.sqlite',
] as const;

function extractLegacyDatabase(root: string): string | null {
  const archive = join(root, 'Pokopia-KB-FULL-20260809-005646.zip');
  if (!existsSync(archive)) return null;

  // Fingerprint only the archive head: the archive is ~1 GB and must not be read into memory.
  const head = Buffer.alloc(65_536);
  const input = openSync(archive, 'r');
  let headLength: number;
  try {
    headLength = readSync(input, head, 0, head.length, 0);
  } finally {
    closeSync(input);
  }
  const fingerprint = createHash('sha256')
    .update(head.subarray(0, headLength))
    .digest('hex')
    .slice(0, 12);
  const destination = join(tmpdir(), 'pokopia-companion', fingerprint, 'pokopia.sqlite');
  if (existsSync(destination)) return destination;

  mkdirSync(dirname(destination), { recursive: true });
  // Extract to a private temporary file and publish it atomically so a failed or concurrent
  // extraction never leaves a truncated database at the cached destination.
  const partial = `${destination}.${process.pid}.${Date.now()}.partial`;
  const output = openSync(partial, 'wx');
  let status: number | null;
  try {
    status = spawnSync('unzip', ['-p', archive, 'Pokopia-KB-FULL/pokopia.sqlite'], {
      stdio: ['ignore', output, 'pipe'],
    }).status;
  } finally {
    closeSync(output);
  }
  if (status !== 0) {
    rmSync(partial, { force: true });
    return null;
  }
  renameSync(partial, destination);
  return destination;
}

export function resolveDatabasePath(root = findRepositoryRoot()): string | null {
  const configured = process.env.POKOPIA_DATABASE_PATH;
  if (configured) {
    const absolute = resolve(configured);
    if (!existsSync(absolute)) {
      throw new Error(`POKOPIA_DATABASE_PATH does not exist: ${absolute}`);
    }
    return absolute;
  }

  for (const relative of FALLBACKS) {
    // Runtime data is deployed independently; avoid tracing the private snapshot into standalone bundles.
    const candidate = join(/*turbopackIgnore: true*/ root, relative);
    if (existsSync(/*turbopackIgnore: true*/ candidate)) return candidate;
  }

  return extractLegacyDatabase(root);
}
