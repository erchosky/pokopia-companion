import { createHash } from 'node:crypto';
import {
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const archiveName = 'Pokopia-Companion-Iteration-5.5-REVIEW.zip';
const archiveRootName = 'Pokopia-Companion-Iteration-5.5-REVIEW';
const archivePath = join(root, archiveName);
const sidecarPath = `${archivePath}.sha256`;
const temporaryRoot = mkdtempSync(join(tmpdir(), 'pokopia-i55-archive-'));
const stagingRoot = join(temporaryRoot, archiveRootName);

const rootFiles = [
  '.env.example',
  '.gitignore',
  '.npmrc',
  '.prettierignore',
  '.prettierrc.json',
  'README.md',
  'REVIEW_README.md',
  'ITERATION_5_5_REVIEW_README.md',
  'ARCHIVE_REPORT_ITERATION_5_5.md',
  'eslint.config.mjs',
  'package.json',
  'package-lock.json',
  'playwright.config.ts',
  'tsconfig.base.json',
  'turbo.json',
];
const directories = [
  'apps',
  'packages',
  'scripts',
  'supabase',
  'tests',
  'docs',
  'audit-data',
  'audit-results',
];
const selectedDataFiles = [
  'data/source/SNAPSHOT_MANIFEST.json',
  'data/audits/v3.1/audit.json',
  'data/processed/v3.1/manifest.json',
  'data/canonical/.gitkeep',
];
const forbiddenSegments = new Set([
  '.git',
  '.next',
  '.turbo',
  '.playwright-cli',
  'node_modules',
  'test-results',
  'playwright-report',
  'coverage',
  'dist',
  'output',
]);

mkdirSync(stagingRoot, { recursive: true });
for (const file of rootFiles) copySelected(file);
for (const directory of directories) copySelected(directory);
for (const file of selectedDataFiles) copySelected(file);

const files = [];
walk(stagingRoot, (path) => files.push(path));
const forbidden = files.filter((path) => !allowed(relative(stagingRoot, path), path));
if (forbidden.length) throw new Error(`Forbidden archive paths: ${forbidden.join(', ')}`);
if (!files.some((path) => path.endsWith('/audit-data/pokopia-review.sqlite')))
  throw new Error('Compact review SQLite is missing from staging.');

rmSync(archivePath, { force: true });
rmSync(sidecarPath, { force: true });
const zipped = spawnSync('zip', ['-X', '-q', '-r', archivePath, archiveRootName], {
  cwd: temporaryRoot,
  encoding: 'utf8',
});
if (zipped.status !== 0) throw new Error(zipped.stderr || 'zip failed');
const digest = createHash('sha256').update(readFileSync(archivePath)).digest('hex');
writeFileSync(sidecarPath, `${digest}  ${archiveName}\n`);
rmSync(temporaryRoot, { recursive: true, force: true });
process.stdout.write(
  `${JSON.stringify({ archive: archivePath, sha256: digest, files: files.length })}\n`,
);

function copySelected(relativePath) {
  const source = join(root, relativePath);
  const destination = join(stagingRoot, relativePath);
  mkdirSync(resolve(destination, '..'), { recursive: true });
  cpSync(source, destination, {
    recursive: true,
    dereference: false,
    filter: (candidate) => allowed(relative(root, candidate), candidate),
  });
}

function allowed(relativePath, absolutePath) {
  if (relativePath === '') return true;
  const segments = relativePath.split('/');
  if (segments.some((segment) => forbiddenSegments.has(segment))) return false;
  const name = basename(relativePath);
  if (name === '.DS_Store' || name.endsWith('.log') || name.endsWith('.zip')) return false;
  if (name.endsWith('.sqlite-wal') || name.endsWith('.sqlite-shm')) return false;
  if (name.startsWith('.env') && name !== '.env.example') return false;
  if (name.endsWith('.sqlite') && relativePath !== 'audit-data/pokopia-review.sqlite') return false;
  if (/RAW_HTML|Pokopia-KB-FULL|data\/source\/snapshots/.test(relativePath)) return false;
  try {
    if (lstatSync(absolutePath).isSymbolicLink()) return false;
  } catch {
    return false;
  }
  return true;
}

function walk(directory, visit) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink entered staging: ${path}`);
    if (entry.isDirectory()) walk(path, visit);
    else if (entry.isFile()) visit(path);
  }
}
