import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const verifierPath = fileURLToPath(import.meta.url);
const ignored = new Set([
  '.git',
  '.next',
  '.turbo',
  '.playwright-cli',
  'node_modules',
  'playwright-report',
  'test-results',
]);
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs']);

function files(directory) {
  return readdirSync(directory).flatMap((name) => {
    if (ignored.has(name)) return [];
    const path = join(directory, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const all = files(root);
const source = all.filter((path) => sourceExtensions.has(extname(path)));
const failures = [];
const serviceSecretName = ['SUPABASE', 'SECRET', 'KEY'].join('_');
const publicSecretPattern = /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE|DATABASE|PASSWORD|TOKEN)/;

for (const path of source) {
  if (path === verifierPath) continue;
  const content = readFileSync(path, 'utf8');
  const name = relative(root, path);
  if (content.includes('dangerouslySetInnerHTML')) failures.push(`${name}: raw HTML rendering`);
  if (publicSecretPattern.test(content))
    failures.push(`${name}: secret-shaped NEXT_PUBLIC variable`);
  if (/^['"]use client['"];?/m.test(content)) {
    if (content.includes('process.env')) failures.push(`${name}: client module reads process.env`);
    if (content.includes(serviceSecretName))
      failures.push(`${name}: client module names service secret`);
    if (/from ['"](?:@pokopia\/db|pg|node:)/.test(content))
      failures.push(`${name}: client module imports a privileged server package`);
  }
}

const forbiddenPrivateEnvironment = all.filter((path) =>
  /(?:^|\/)\.env(?:\.local|\.production)?$/.test(relative(root, path)),
);
if (forbiddenPrivateEnvironment.length)
  failures.push(
    `private environment files: ${forbiddenPrivateEnvironment.map((path) => relative(root, path)).join(', ')}`,
  );

for (const required of [
  'docs/THREAT_MODEL.md',
  'supabase/migrations/202608110002_iteration_4_5_hardening.sql',
  'packages/security/src/rate-limit.ts',
  'packages/security/src/headers.ts',
])
  if (!all.some((path) => relative(root, path) === required)) failures.push(`missing ${required}`);

if (failures.length) {
  process.stderr.write(`${failures.map((failure) => `FAIL: ${failure}`).join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(
  `PASS: ${source.length} source files checked for client/server, XSS, env and release regressions.\n`,
);
