import { pipelinePaths } from './paths.js';
import { runPipeline } from './pipeline.js';
import { validatePipeline } from './validate.js';

const command = process.argv[2] ?? 'process';
const paths = pipelinePaths();

if (command === 'process' || command === 'audit') {
  const audit = await runPipeline(paths);
  process.stdout.write(
    `${JSON.stringify({ pages: audit.pages, tables: audit.tables, facts: audit.facts, ragChunks: audit.ragChunks, shortPages: audit.shortPages.length, audit: 'data/audits/v3.1/audit.json' })}\n`,
  );
} else if (command === 'validate') {
  const audit = await validatePipeline(paths);
  process.stdout.write(
    `Validated ${audit.pages} pages; ${audit.tables} tables; ${audit.ragChunks} RAG chunks.\n`,
  );
} else {
  throw new Error(`Unknown command: ${command}`);
}
