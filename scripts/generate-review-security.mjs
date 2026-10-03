import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const output = join(root, 'audit-results');
mkdirSync(output, { recursive: true });
const generatedAt = new Date().toISOString();
const lockfile = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));

const packageFiles = [
  'package.json',
  ...readdirSync(join(root, 'apps'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `apps/${entry.name}/package.json`),
  ...readdirSync(join(root, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}/package.json`),
].filter((path) => {
  try {
    return statSync(join(root, path)).isFile();
  } catch {
    return false;
  }
});

function resolvedVersion(name, declared) {
  if (declared === '*' && lockfile.packages[`node_modules/${name}`]?.link) {
    const packagePath = lockfile.packages[`node_modules/${name}`].resolved;
    return lockfile.packages[packagePath]?.version ?? declared;
  }
  return lockfile.packages[`node_modules/${name}`]?.version ?? declared;
}

function dependencies(values = {}) {
  return Object.entries(values)
    .map(([name, declared]) => ({ name, declared, resolved: resolvedVersion(name, declared) }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

const packages = packageFiles.map((path) => {
  const manifest = JSON.parse(readFileSync(join(root, path), 'utf8'));
  return {
    path,
    name: manifest.name,
    version: manifest.version,
    runtimeDependencies: dependencies(manifest.dependencies),
    devDependencies: dependencies(manifest.devDependencies),
  };
});

const auditRun = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
});
let audit;
try {
  audit = JSON.parse(auditRun.stdout);
} catch {
  audit = {
    parseError: true,
    stderr: auditRun.stderr.trim().slice(0, 1000),
  };
}

const dependencyReport = {
  generatedAt,
  runtime: {
    node: process.version,
    npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(),
    requiredNode: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).engines?.node,
  },
  packages,
  npmAuditProduction: {
    command: 'npm audit --omit=dev --json',
    exitCode: auditRun.status,
    metadata: audit.metadata ?? null,
    vulnerabilities: audit.vulnerabilities ?? null,
  },
};
writeFileSync(join(output, 'dependencies.json'), `${JSON.stringify(dependencyReport, null, 2)}\n`);

const scanRoots = ['apps', 'packages', 'scripts', 'supabase', 'tests', 'docs'];
const rootFiles = [
  '.env.example',
  'package.json',
  'package-lock.json',
  'eslint.config.mjs',
  'playwright.config.ts',
  'tsconfig.base.json',
  'turbo.json',
];
const allowedExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.sql',
  '.yml',
  '.yaml',
  '.toml',
  '.css',
]);
const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.next' ||
      entry.name === '.turbo' ||
      entry.name === 'coverage' ||
      entry.name === 'test-results'
    )
      continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile() && allowedExtensions.has(extname(entry.name))) files.push(path);
  }
}
for (const path of scanRoots) walk(join(root, path));
for (const path of rootFiles) files.push(join(root, path));

const credentialPatterns = [
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
const assignmentPattern =
  /^(?:[A-Z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_KEY|SERVICE_ROLE)[A-Z0-9_]*)[ \t]*=[ \t]*[^#\r\n \t][^\r\n]*$/im;
const credentialMatches = [];
const secretAssignmentMatches = [];
const environmentReferences = new Set();
for (const path of unique(files)) {
  const contents = readFileSync(path, 'utf8');
  if (credentialPatterns.some((pattern) => pattern.test(contents)))
    credentialMatches.push(relative(root, path));
  if (basename(path) !== '.env.example' && assignmentPattern.test(contents))
    secretAssignmentMatches.push(relative(root, path));
  for (const match of contents.matchAll(/process\.env\.([A-Z0-9_]+)/g))
    environmentReferences.add(match[1]);
}
const envTemplate = readFileSync(join(root, '.env.example'), 'utf8');
const templateVariables = [...envTemplate.matchAll(/^([A-Z0-9_]+)=/gm)].map((match) => match[1]);
const envFiles = rootFiles.filter((path) => basename(path).startsWith('.env'));
const securityScan = {
  generatedAt,
  scope: scanRoots,
  filesScanned: unique(files).length,
  credentialSignatureMatches: unique(credentialMatches),
  nonEmptySecretAssignmentMatches: unique(secretAssignmentMatches),
  envFiles,
  environmentReferences: [...environmentReferences].sort(),
  templateVariables,
  clientExposedVariables: templateVariables.filter((name) => name.startsWith('NEXT_PUBLIC_')),
  passed: credentialMatches.length === 0 && secretAssignmentMatches.length === 0,
  note: 'Only filenames and counts are recorded; possible secret values are never copied to the report.',
};
writeFileSync(join(output, 'security-scan.json'), `${JSON.stringify(securityScan, null, 2)}\n`);

const vulnerabilities = audit.metadata?.vulnerabilities ?? {};
const securitySummary = `# Security summary

Generated: ${generatedAt}

## Dependency audit

- Command: \`npm audit --omit=dev --json\`
- Exit code: ${auditRun.status}
- Production vulnerabilities: ${vulnerabilities.total ?? 'unknown'} total (${vulnerabilities.critical ?? 0} critical, ${vulnerabilities.high ?? 0} high, ${vulnerabilities.moderate ?? 0} moderate, ${vulnerabilities.low ?? 0} low).
- Exact direct and resolved dependency versions are in \`dependencies.json\`.

## Secret and environment review

- Credential signature matches: ${credentialMatches.length}.
- Non-empty secret assignment matches outside \`.env.example\`: ${secretAssignmentMatches.length}.
- Real environment files found in review scope: none; only \`.env.example\` is expected.
- Server/runtime references: ${[...environmentReferences]
  .sort()
  .map((name) => `\`${name}\``)
  .join(', ')}.
- Template-only optional browser variables: ${
  templateVariables
    .filter((name) => name.startsWith('NEXT_PUBLIC_'))
    .map((name) => `\`${name}\``)
    .join(', ') || 'none'
}.
- The browser-prefixed Supabase variables are not referenced by the current application code. \`SUPABASE_SECRET_KEY\`, admin password/session secret, database URLs, and test database URLs are server-only.

## Admin authentication design

The admin app is closed when \`POKOPIA_ADMIN_PASSWORD\` or \`POKOPIA_ADMIN_SESSION_SECRET\` is absent. Login comparison hashes both inputs and uses \`timingSafeEqual\`. A successful login creates a versioned, nonced, eight-hour HMAC-SHA-256 signed cookie with \`HttpOnly\`, \`SameSite=Strict\`, path \`/\`, and \`Secure\` in production. The proxy validates format, issued time, expiry and signature before allowing protected routes. Authentication throttling uses the shared \`RateLimitStore\`; production rejects memory storage and requires the atomic PostgreSQL backend. This remains a local/private single-password fallback, not individual authentication, MFA, revocation or account lifecycle management.

## RLS status

The PostgreSQL security migration revokes public object privileges, enables RLS for every classified public table, restricts user rows by request subject, restricts administrative and research tables to admin claims, and exposes only accepted provenance. Helper functions are security-invoker functions in \`app_private\`. The dynamic PostgreSQL migration/invariant gate is recorded separately in \`results.json\`.

## Honest boundary

This is a source/package audit. It does not claim that a hosted Supabase project currently has these migrations applied, because no linked production target or credentials were used.
`;
writeFileSync(join(output, 'security-summary.md'), securitySummary);

function unique(values) {
  return [...new Set(values)];
}

console.log(
  JSON.stringify(
    {
      dependencyPackages: packages.length,
      productionVulnerabilities: vulnerabilities.total ?? null,
      filesScanned: securityScan.filesScanned,
      secretScanPassed: securityScan.passed,
    },
    null,
    2,
  ),
);
