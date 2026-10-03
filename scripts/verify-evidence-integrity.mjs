import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const database = new DatabaseSync(`${root}/audit-data/pokopia-review.sqlite`, { readOnly: true });
const assertions = JSON.parse(
  readFileSync(`${root}/audit-data/samples/assertions-evidence.json`, 'utf8'),
);
const checks = [];

function check(id, actual, expected = 0) {
  checks.push({ id, actual, expected, pass: actual === expected });
}

const integrity = database.prepare('pragma integrity_check').get().integrity_check;
const foreignKeys = database.prepare('pragma foreign_key_check').all();
checks.push({
  id: 'sqlite-integrity',
  actual: integrity,
  expected: 'ok',
  pass: integrity === 'ok',
});
check('sqlite-foreign-keys', foreignKeys.length);
for (const [id, table, sourceColumn] of [
  ['orphan-fact-source', 'facts', 'source_url'],
  ['orphan-entity-source', 'entities', 'source_url'],
  ['orphan-relationship-source', 'relationships', 'source_url'],
]) {
  const row = database
    .prepare(
      `select count(*) as count from ${table} record
       where not exists (select 1 from pages where pages.source_url = record.${sourceColumn})`,
    )
    .get();
  check(id, Number(row.count));
}
const duplicatePages = database
  .prepare(
    'select count(*) as count from (select source_url from pages group by source_url having count(*) > 1)',
  )
  .get();
check('duplicate-source-identity', Number(duplicatePages.count));

const assertionIds = new Set();
let invalidAssertions = 0;
let duplicateEvidence = 0;
const sourceStatusCounts = {};
for (const assertion of assertions) {
  if (!assertion.assertionId || assertionIds.has(assertion.assertionId)) invalidAssertions += 1;
  assertionIds.add(assertion.assertionId);
  if (
    !['direct_fact', 'derived_fact', 'inference', 'recommendation'].includes(
      assertion.classification,
    )
  )
    invalidAssertions += 1;
  if (!['high', 'medium', 'low', 'unknown'].includes(assertion.confidence)) invalidAssertions += 1;
  if (assertion.evidenceCoverage === 'complete' && !assertion.evidence?.length)
    invalidAssertions += 1;
  const evidenceKeys = new Set();
  for (const evidence of assertion.evidence ?? []) {
    const key = `${evidence.source?.url ?? ''}\0${evidence.statement ?? ''}`;
    if (evidenceKeys.has(key)) duplicateEvidence += 1;
    evidenceKeys.add(key);
    if (!evidence.statement || !evidence.source?.url || !evidence.source?.snapshot)
      invalidAssertions += 1;
    const status = evidence.source?.verificationStatus ?? 'missing';
    sourceStatusCounts[status] = (sourceStatusCounts[status] ?? 0) + 1;
  }
}
check('invalid-assertion-chain', invalidAssertions);
check('duplicate-evidence-within-assertion', duplicateEvidence);

database.close();
const result = {
  generatedAt: new Date().toISOString(),
  model: {
    assertionConfidence: 'claim-level epistemic confidence',
    evidenceStrength: 'coverage and directness of supporting observations',
    sourceReliability: 'independent source verification state',
    mixedIntoSingleScore: false,
  },
  assertionsChecked: assertions.length,
  sourceStatusCounts,
  checks,
  pass: checks.every((entry) => entry.pass),
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.pass) process.exit(1);
