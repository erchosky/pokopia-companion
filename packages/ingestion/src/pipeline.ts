import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createAudit } from './audit.js';
import { chunkMarkdown, deriveKnowledge, mergeEntities } from './derive.js';
import { countMojibake, decodeHtml } from './encoding.js';
import { extractHtml } from './html.js';
import type { AuditReport, ProcessedPage, RagChunk } from './types.js';
import { PARSER_VERSION } from './types.js';
import type { PipelinePaths } from './paths.js';
import { writeReports } from './reports.js';
import { inspectLegacySqlite, writeCanonicalSqlite } from './sqlite.js';
import { extractQuantitativeAssertions, reconcileQuantitativeAssertions } from './quantitative.js';
import { sha256, stableId, writeJson, writeJsonl } from './util.js';

interface MasterPage {
  url: string;
  title: string;
  category: string;
  fetched_at: string;
  sha256: string;
  raw_path: string;
}

interface MasterIndex {
  pages: MasterPage[];
  errors: Array<{ url: string; stage: string; error: string }>;
  stats: Record<string, number>;
}

function outputRelativePath(rawPath: string, extension: '.json' | '.md'): string {
  const output = rawPath.replace(/^RAW_HTML\//, '').replace(/\.(?:s?html?)$/i, extension);
  if (isAbsolute(output) || output === '..' || output.startsWith('../'))
    throw new Error(`Snapshot path escapes approved output root: ${rawPath}`);
  return output;
}

async function containedSourcePath(root: string, candidate: string): Promise<string> {
  if (isAbsolute(candidate)) throw new Error(`Absolute snapshot path is not allowed: ${candidate}`);
  const rootPath = await realpath(root);
  const candidatePath = await realpath(resolve(rootPath, candidate));
  const fromRoot = relative(rootPath, candidatePath);
  if (fromRoot === '..' || fromRoot.startsWith('../') || isAbsolute(fromRoot))
    throw new Error(`Snapshot path escapes approved root: ${candidate}`);
  return candidatePath;
}

function containedOutputPath(root: string, candidate: string): string {
  const output = resolve(root, candidate);
  const fromRoot = relative(resolve(root), output);
  if (fromRoot === '..' || fromRoot.startsWith('../') || isAbsolute(fromRoot))
    throw new Error(`Generated path escapes approved root: ${candidate}`);
  return output;
}

async function processPage(
  snapshot: string,
  source: MasterPage,
  processedAt: string,
): Promise<{ page: ProcessedPage; chunks: RagChunk[] }> {
  const path = await containedSourcePath(snapshot, source.raw_path);
  const legacyTablesPath = await containedSourcePath(
    snapshot,
    source.raw_path.replace(/^RAW_HTML\//, 'TABLES/').replace(/\.(?:s?html?)$/i, '.json'),
  );
  const [bytes, legacyTablesRaw] = await Promise.all([
    readFile(path),
    readFile(legacyTablesPath, 'utf8'),
  ]);
  const legacyTables = JSON.parse(legacyTablesRaw) as { tables: Array<{ table_index: number }> };
  const selectedTableIndexes = new Set(legacyTables.tables.map((table) => table.table_index));
  const sourceHash = sha256(bytes);
  const decoded = decodeHtml(bytes);
  const extraction = extractHtml(decoded.text, source.url, selectedTableIndexes);
  const title = extraction.title || source.title;
  const knowledge = deriveKnowledge(source.url, title, extraction.links, extraction.tables);
  const ratio =
    extraction.visibleText.length === 0
      ? 0
      : extraction.text.length / extraction.visibleText.length;
  const extractionQuality: ProcessedPage['extractionQuality'] =
    (extraction.text.length < 200 && extraction.tables.length === 0) ||
    (extraction.visibleText.length > 1_000 && ratio < 0.03)
      ? 'short'
      : extraction.text.length < 500 || ratio < 0.1
        ? 'acceptable'
        : 'good';
  const page: ProcessedPage = {
    id: stableId('page', source.url),
    sourceUrl: source.url,
    title,
    category: source.category,
    sourcePath: source.raw_path,
    sourceHash,
    fetchedAt: source.fetched_at || null,
    processedAt,
    parserVersion: PARSER_VERSION,
    encoding: decoded.encoding,
    declaredEncoding: decoded.declaredEncoding,
    rawBytes: bytes.byteLength,
    visibleTextChars: extraction.visibleText.length,
    extractedTextChars: extraction.text.length,
    markdownChars: extraction.markdown.length,
    replacementCharacters: (extraction.text.match(/\uFFFD/g) ?? []).length,
    mojibakeSignals: countMojibake(extraction.text),
    replacementCharactersBeforeRepair: decoded.replacementCharactersBeforeRepair,
    mojibakeSignalsBeforeRepair: decoded.mojibakeSignalsBeforeRepair,
    residualNoiseSignals: extraction.residualNoiseSignals,
    extractionQuality,
    markdown: extraction.markdown,
    text: extraction.text,
    links: extraction.links,
    tables: extraction.tables,
    ...knowledge,
    quantitativeAssertions: extractQuantitativeAssertions({
      sourceUrl: source.url,
      sourceHash,
      text: extraction.text,
      tables: extraction.tables,
    }),
  };
  return {
    page,
    chunks: chunkMarkdown(
      source.url,
      title,
      source.category,
      extraction.markdown,
      sourceHash,
      PARSER_VERSION,
    ),
  };
}

async function writePageArtifacts(
  paths: PipelinePaths,
  pages: readonly ProcessedPage[],
): Promise<void> {
  const batchSize = 50;
  for (let offset = 0; offset < pages.length; offset += batchSize) {
    await Promise.all(
      pages.slice(offset, offset + batchSize).flatMap((page) => {
        const jsonPath = containedOutputPath(
          paths.processed,
          join('pages', outputRelativePath(page.sourcePath, '.json')),
        );
        const markdownPath = containedOutputPath(
          paths.processed,
          join('markdown', outputRelativePath(page.sourcePath, '.md')),
        );
        return [
          mkdir(dirname(jsonPath), { recursive: true }).then(() =>
            writeFile(jsonPath, `${JSON.stringify(page, null, 2)}\n`, 'utf8'),
          ),
          mkdir(dirname(markdownPath), { recursive: true }).then(() =>
            writeFile(markdownPath, `${page.markdown}\n`, 'utf8'),
          ),
        ];
      }),
    );
  }
}

export async function runPipeline(paths: PipelinePaths): Promise<AuditReport> {
  const master = JSON.parse(
    await readFile(join(paths.snapshot, '00_INDEX/MASTER_INDEX.json'), 'utf8'),
  ) as MasterIndex;
  const processedAt = new Date().toISOString();
  const pages: ProcessedPage[] = [];
  const chunks: RagChunk[] = [];
  for (let offset = 0; offset < master.pages.length; offset += 25) {
    const results = await Promise.all(
      master.pages
        .slice(offset, offset + 25)
        .map((source) => processPage(paths.snapshot, source, processedAt)),
    );
    for (const result of results) {
      pages.push(result.page);
      chunks.push(...result.chunks);
    }
    if ((offset + 25) % 250 === 0 || offset + 25 >= master.pages.length)
      process.stderr.write(
        `Processed ${Math.min(offset + 25, master.pages.length)}/${master.pages.length}\n`,
      );
  }
  const reconciledQuantitative = new Map(
    reconcileQuantitativeAssertions(pages.flatMap((page) => page.quantitativeAssertions)).map(
      (assertion) => [assertion.id, assertion],
    ),
  );
  for (const page of pages)
    page.quantitativeAssertions = page.quantitativeAssertions.map(
      (assertion) => reconciledQuantitative.get(assertion.id) ?? assertion,
    );
  await Promise.all([
    mkdir(paths.processed, { recursive: true }),
    mkdir(paths.canonical, { recursive: true }),
    mkdir(paths.audits, { recursive: true }),
  ]);
  await writePageArtifacts(paths, pages);
  const entities = mergeEntities(pages.flatMap((page) => page.entities));
  const relationships = [
    ...new Map(
      pages
        .flatMap((page) => page.relationships)
        .map((relationship) => [relationship.id, relationship]),
    ).values(),
  ];
  const facts = [
    ...new Map(pages.flatMap((page) => page.facts).map((fact) => [fact.id, fact])).values(),
  ];
  const quantitativeAssertions = [
    ...new Map(
      pages
        .flatMap((page) => page.quantitativeAssertions)
        .map((assertion) => [assertion.id, assertion]),
    ).values(),
  ];
  await Promise.all([
    writeJsonl(join(paths.canonical, 'pages.jsonl'), pages),
    writeJsonl(join(paths.canonical, 'entities.jsonl'), entities),
    writeJsonl(join(paths.canonical, 'relationships.jsonl'), relationships),
    writeJsonl(join(paths.canonical, 'facts.jsonl'), facts),
    writeJsonl(join(paths.canonical, 'quantitative.jsonl'), quantitativeAssertions),
    writeJsonl(join(paths.canonical, 'rag.jsonl'), chunks),
    writeJson(join(paths.processed, 'manifest.json'), {
      schemaVersion: '3.1',
      parserVersion: PARSER_VERSION,
      processedAt,
      sourceSnapshot: relative(paths.root, paths.snapshot),
      pages: pages.length,
      pageJsonRoot: relative(paths.root, join(paths.processed, 'pages')),
      markdownRoot: relative(paths.root, join(paths.processed, 'markdown')),
      canonicalFiles: [
        'pages.jsonl',
        'entities.jsonl',
        'relationships.jsonl',
        'facts.jsonl',
        'quantitative.jsonl',
        'rag.jsonl',
        'pokopia-canonical.sqlite',
      ],
    }),
  ]);
  await writeCanonicalSqlite(join(paths.canonical, 'pokopia-canonical.sqlite'), pages, chunks);
  const legacy = inspectLegacySqlite(join(paths.snapshot, 'pokopia.sqlite'));
  const audit = await createAudit({
    root: paths.root,
    snapshot: paths.snapshot,
    pages,
    indexedPages: master.pages,
    sourceErrors: master.errors,
    originalStats: master.stats,
    sqlitePages: legacy.pages,
    sqliteIntegrity: legacy.integrity,
    ragChunks: chunks.length,
  });
  await Promise.all([
    writeJson(join(paths.audits, 'audit.json'), audit),
    writeReports(paths.docs, audit),
  ]);
  return audit;
}
