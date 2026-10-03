import { createHash } from 'node:crypto';
import { access, readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { AuditReport, NearDuplicateGroup, ProcessedPage } from './types.js';
import { increment, sha256 } from './util.js';

async function countFiles(root: string): Promise<number> {
  let count = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory()) count += await countFiles(join(root, entry.name));
    else if (entry.isFile() && entry.name !== '.DS_Store') count += 1;
  }
  return count;
}

async function countJsonl(path: string): Promise<number> {
  const body = await readFile(path, 'utf8');
  return body.split('\n').filter(Boolean).length;
}

function normalizedDuplicateText(page: ProcessedPage): string {
  return page.text
    .toLocaleLowerCase('en')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function simhash(value: string): bigint {
  const weights = Array<number>(64).fill(0);
  const tokens = value.split(' ').filter((token) => token.length > 1);
  const frequencies = new Map<string, number>();
  for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  for (const [token, weight] of frequencies) {
    const digest = createHash('sha256').update(token).digest();
    for (let bit = 0; bit < 64; bit += 1) {
      const byte = digest[Math.floor(bit / 8)];
      if (byte === undefined) continue;
      weights[bit] = (weights[bit] ?? 0) + ((byte & (1 << (bit % 8))) === 0 ? -weight : weight);
    }
  }
  return weights.reduce(
    (result, weight, bit) => (weight >= 0 ? result | (1n << BigInt(bit)) : result),
    0n,
  );
}

function hamming(left: bigint, right: bigint): number {
  let value = left ^ right;
  let count = 0;
  while (value !== 0n) {
    value &= value - 1n;
    count += 1;
  }
  return count;
}

function nearDuplicates(pages: readonly ProcessedPage[]): NearDuplicateGroup[] {
  const candidates = pages
    .filter((page) => page.extractedTextChars >= 300)
    .map((page) => ({ page, hash: simhash(normalizedDuplicateText(page)) }));
  const buckets = new Map<string, number[]>();
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (candidate === undefined) continue;
    for (let band = 0; band < 4; band += 1) {
      const key = `${band}:${(candidate.hash >> BigInt(band * 16)) & 0xffffn}`;
      const bucket = buckets.get(key) ?? [];
      bucket.push(index);
      buckets.set(key, bucket);
    }
  }
  const pairs = new Map<string, NearDuplicateGroup>();
  for (const indexes of buckets.values()) {
    for (let left = 0; left < indexes.length; left += 1) {
      for (let right = left + 1; right < indexes.length; right += 1) {
        const a = candidates[indexes[left] ?? -1];
        const b = candidates[indexes[right] ?? -1];
        if (a === undefined || b === undefined) continue;
        const distance = hamming(a.hash, b.hash);
        if (distance > 3) continue;
        const urls = [a.page.sourceUrl, b.page.sourceUrl].sort();
        pairs.set(urls.join('|'), { pages: urls, hammingDistance: distance });
      }
    }
  }
  return [...pairs.values()].sort(
    (a, b) => a.hammingDistance - b.hammingDistance || a.pages[0]!.localeCompare(b.pages[0]!),
  );
}

function candidateAssetPaths(snapshot: string, assetUrl: string): string[] {
  const url = new URL(assetUrl);
  const pathname = decodeURIComponent(url.pathname).replace(/^\//, '');
  return [
    join(snapshot, 'OFFLINE_SITE', '_assets', pathname),
    join(snapshot, 'OFFLINE_SITE', pathname),
  ];
}

async function unresolvedAssets(
  snapshot: string,
  pages: readonly ProcessedPage[],
): Promise<string[]> {
  const urls = new Set<string>();
  for (const page of pages)
    for (const table of page.tables)
      for (const row of table.rows)
        for (const cell of row.cells) for (const image of cell.images) urls.add(image.url);
  const unresolved: string[] = [];
  for (const url of urls) {
    const checks = await Promise.all(
      candidateAssetPaths(snapshot, url).map(async (path) =>
        access(path)
          .then(() => true)
          .catch(() => false),
      ),
    );
    if (!checks.some(Boolean)) unresolved.push(url);
  }
  return unresolved.sort();
}

export interface AuditInput {
  root: string;
  snapshot: string;
  pages: ProcessedPage[];
  indexedPages: Array<{ url: string; sha256: string; raw_path: string }>;
  sourceErrors: Array<{ url: string; stage: string; error: string }>;
  originalStats: Record<string, number>;
  sqlitePages: number;
  sqliteIntegrity: string;
  ragChunks: number;
}

export async function createAudit(input: AuditInput): Promise<AuditReport> {
  const categories: Record<string, number> = {};
  const encodings = { 'utf-8': 0, 'windows-1252': 0 };
  const declaredEncodings: Record<string, number> = {};
  const actualByPath = new Map(input.pages.map((page) => [page.sourcePath, page]));
  let hashMismatches = 0;
  let missingMetadata = 0;
  for (const page of input.pages) {
    increment(categories, page.category);
    encodings[page.encoding] += 1;
    increment(declaredEncodings, page.declaredEncoding ?? 'none');
  }
  for (const indexed of input.indexedPages) {
    const page = actualByPath.get(indexed.raw_path);
    if (page === undefined) missingMetadata += 1;
    else if (page.sourceHash !== indexed.sha256) hashMismatches += 1;
  }
  const urlCounts = new Map<string, number>();
  for (const indexed of input.indexedPages)
    urlCounts.set(indexed.url, (urlCounts.get(indexed.url) ?? 0) + 1);
  const exactByHash = new Map<string, string[]>();
  for (const page of input.pages) {
    const hash = sha256(normalizedDuplicateText(page));
    const values = exactByHash.get(hash) ?? [];
    values.push(page.sourceUrl);
    exactByHash.set(hash, values);
  }
  const allEntityIds = new Set(
    input.pages.flatMap((page) => page.entities.map((entity) => entity.id)),
  );
  const referencedEntityIds = new Set(
    input.pages.flatMap((page) =>
      page.relationships.flatMap((relation) => [relation.sourceEntityId, relation.targetEntityId]),
    ),
  );
  const sourceUrls = new Set(input.pages.map((page) => page.sourceUrl));
  const internalLinks = new Set(
    input.pages.flatMap((page) =>
      page.links.filter((link) => link.internal).map((link) => link.url),
    ),
  );
  const unresolvedReferencedAssets = await unresolvedAssets(input.snapshot, input.pages);
  const referencedAssets = new Set(
    input.pages.flatMap((page) =>
      page.tables.flatMap((table) =>
        table.rows.flatMap((row) =>
          row.cells.flatMap((cell) => cell.images.map((image) => image.url)),
        ),
      ),
    ),
  );
  const snapshotFingerprint = sha256(
    input.pages
      .map((page) => `${page.sourcePath}\0${page.sourceHash}`)
      .sort()
      .join('\n'),
  );
  return {
    schemaVersion: '3.1',
    parserVersion: '3.1.0',
    generatedAt: new Date().toISOString(),
    snapshotRoot: relative(input.root, input.snapshot),
    snapshotFingerprint,
    pages: input.pages.length,
    sourceBytes: input.pages.reduce((sum, page) => sum + page.rawBytes, 0),
    sourceMetadata: {
      indexedPages: input.indexedPages.length,
      missingMetadata,
      hashMismatches,
      duplicateSourceUrls: [...urlCounts.values()].filter((count) => count > 1).length,
    },
    originalDataset: {
      markdownFiles: await countFiles(join(input.snapshot, 'MARKDOWN')),
      tableFiles: await countFiles(join(input.snapshot, 'TABLES')),
      ragDocuments: await countJsonl(join(input.snapshot, 'RAG/rag_documents.jsonl')),
      structuredFacts: await countJsonl(join(input.snapshot, 'STRUCTURED/facts.jsonl')),
      structuredTableRows: await countJsonl(join(input.snapshot, 'STRUCTURED/table_rows.jsonl')),
      sqlitePages: input.sqlitePages,
      sqliteIntegrity: input.sqliteIntegrity,
      indexedAssets: input.originalStats.assets ?? 0,
      sourceErrors: input.sourceErrors.length,
    },
    encodings,
    declaredEncodings,
    replacementCharacters: input.pages.reduce((sum, page) => sum + page.replacementCharacters, 0),
    mojibakeSignals: input.pages.reduce((sum, page) => sum + page.mojibakeSignals, 0),
    encodingRepairs: {
      replacementCharactersBeforeRepair: input.pages.reduce(
        (sum, page) => sum + page.replacementCharactersBeforeRepair,
        0,
      ),
      replacementCharactersAfterRepair: input.pages.reduce(
        (sum, page) => sum + page.replacementCharacters,
        0,
      ),
      mojibakeSignalsBeforeRepair: input.pages.reduce(
        (sum, page) => sum + page.mojibakeSignalsBeforeRepair,
        0,
      ),
      mojibakeSignalsAfterRepair: input.pages.reduce((sum, page) => sum + page.mojibakeSignals, 0),
    },
    extractedCharacters: input.pages.reduce((sum, page) => sum + page.extractedTextChars, 0),
    markdownCharacters: input.pages.reduce((sum, page) => sum + page.markdownChars, 0),
    tables: input.pages.reduce((sum, page) => sum + page.tables.length, 0),
    tableRows: input.pages.reduce(
      (sum, page) => sum + page.tables.reduce((pageSum, table) => pageSum + table.rows.length, 0),
      0,
    ),
    emptyTables: input.pages.reduce(
      (sum, page) =>
        sum +
        page.tables.filter(
          (table) =>
            table.rows.length === 0 ||
            table.rows.every((row) => row.cells.every((cell) => cell.text === '')),
        ).length,
      0,
    ),
    referencedAssets: referencedAssets.size,
    unresolvedReferencedAssets,
    facts: input.pages.reduce((sum, page) => sum + page.facts.length, 0),
    entities: allEntityIds.size,
    relationships: input.pages.reduce((sum, page) => sum + page.relationships.length, 0),
    ragChunks: input.ragChunks,
    exactDuplicateGroups: [...exactByHash.values()]
      .filter((urls) => urls.length > 1)
      .sort((a, b) => b.length - a.length),
    nearDuplicateGroups: nearDuplicates(input.pages),
    shortPages: input.pages
      .filter((page) => page.extractionQuality === 'short')
      .map((page) => ({
        url: page.sourceUrl,
        extractedChars: page.extractedTextChars,
        tables: page.tables.length,
      })),
    noisyPages: input.pages
      .filter((page) => page.residualNoiseSignals.length > 0)
      .map((page) => ({ url: page.sourceUrl, signals: page.residualNoiseSignals })),
    orphanEntityIds: [...allEntityIds].filter((id) => !referencedEntityIds.has(id)),
    invalidSourceUrls: input.pages
      .map((page) => page.sourceUrl)
      .filter((url) => {
        try {
          return new URL(url).protocol !== 'https:';
        } catch {
          return true;
        }
      }),
    unresolvedInternalLinks: [...internalLinks].filter((url) => !sourceUrls.has(url)).sort(),
    sourceErrors: input.sourceErrors,
    categories,
  };
}
