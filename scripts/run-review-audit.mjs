import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const canonicalDatabase = resolve(root, 'data/canonical/v3.1/pokopia-canonical.sqlite');
const command = existsSync(canonicalDatabase)
  ? [resolve(root, 'node_modules/.bin/tsx'), 'scripts/generate-review-audit.ts']
  : [process.execPath, 'scripts/verify-review-audit.mjs'];

const result = spawnSync(command[0], command.slice(1), {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
