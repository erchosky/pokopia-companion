export const PARSER_VERSION = '3.1.1';

export type EncodingName = 'utf-8' | 'windows-1252';

export interface SourceMetadata {
  url: string;
  title: string;
  sha256: string;
  fetched_at: string;
}

export interface DecodingResult {
  text: string;
  encoding: EncodingName;
  declaredEncoding: string | null;
  replacementCharactersBeforeRepair: number;
  mojibakeSignalsBeforeRepair: number;
}

export interface LinkRecord {
  url: string;
  text: string;
  internal: boolean;
}

export interface ImageRecord {
  url: string;
  alt: string;
}

export interface TableCell {
  columnIndex: number;
  text: string;
  isHeader: boolean;
  colspan: number;
  rowspan: number;
  links: LinkRecord[];
  images: ImageRecord[];
}

export interface TableRow {
  rowIndex: number;
  cells: TableCell[];
}

export interface ExtractedTable {
  tableIndex: number;
  caption: string;
  rows: TableRow[];
}

export interface EntityRecord {
  id: string;
  type: string;
  name: string;
  sourceUrl: string;
  sourceKind: 'page' | 'linked_page';
}

export interface RelationshipRecord {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: 'links_to';
  sourceUrl: string;
}

export interface FactRecord {
  id: string;
  entityId: string;
  key: string;
  value: string;
  tableIndex: number;
  rowIndex: number;
  sourceUrl: string;
}

export type QuantitativeUnit =
  'power_unit' | 'block' | 'connection' | 'item' | 'pokemon' | 'hour' | 'day' | 'tile';

export interface QuantitativeAssertion {
  id: string;
  subjectKind: 'automation_system' | 'game_rule' | 'world_mechanic' | 'storage_system';
  subjectSlug: string;
  predicate: string;
  value: number;
  unit: QuantitativeUnit;
  qualifier: string | null;
  derivation: 'source_fact' | 'mathematical_derived';
  parentAssertionIds: string[];
  sourceUrl: string;
  sourceHash: string;
  locator: string;
  evidenceText: string;
  parserId: string;
  parserConfidence: number;
  evidenceConfidence: number;
  sourceVerificationStatus: 'unverified' | 'confirmed';
  assertionStatus: 'accepted' | 'candidate' | 'disputed';
  contentScope: 'base_game' | 'expansion' | 'unknown';
  gameVersion: string | null;
}

export interface RagChunk {
  id: string;
  sourceUrl: string;
  title: string;
  category: string;
  chunkIndex: number;
  text: string;
  sourceHash: string;
  parserVersion: string;
}

export interface ProcessedPage {
  id: string;
  sourceUrl: string;
  title: string;
  category: string;
  sourcePath: string;
  sourceHash: string;
  fetchedAt: string | null;
  processedAt: string;
  parserVersion: string;
  encoding: EncodingName;
  declaredEncoding: string | null;
  rawBytes: number;
  visibleTextChars: number;
  extractedTextChars: number;
  markdownChars: number;
  replacementCharacters: number;
  mojibakeSignals: number;
  replacementCharactersBeforeRepair: number;
  mojibakeSignalsBeforeRepair: number;
  residualNoiseSignals: string[];
  extractionQuality: 'good' | 'acceptable' | 'short';
  markdown: string;
  text: string;
  links: LinkRecord[];
  tables: ExtractedTable[];
  entities: EntityRecord[];
  relationships: RelationshipRecord[];
  facts: FactRecord[];
  quantitativeAssertions: QuantitativeAssertion[];
}

export interface NearDuplicateGroup {
  pages: string[];
  hammingDistance: number;
}

export interface AuditReport {
  schemaVersion: '3.1';
  parserVersion: string;
  generatedAt: string;
  snapshotRoot: string;
  snapshotFingerprint: string;
  pages: number;
  sourceBytes: number;
  sourceMetadata: {
    indexedPages: number;
    missingMetadata: number;
    hashMismatches: number;
    duplicateSourceUrls: number;
  };
  originalDataset: {
    markdownFiles: number;
    tableFiles: number;
    ragDocuments: number;
    structuredFacts: number;
    structuredTableRows: number;
    sqlitePages: number;
    sqliteIntegrity: string;
    indexedAssets: number;
    sourceErrors: number;
  };
  encodings: Record<EncodingName, number>;
  declaredEncodings: Record<string, number>;
  replacementCharacters: number;
  mojibakeSignals: number;
  encodingRepairs: {
    replacementCharactersBeforeRepair: number;
    replacementCharactersAfterRepair: number;
    mojibakeSignalsBeforeRepair: number;
    mojibakeSignalsAfterRepair: number;
  };
  extractedCharacters: number;
  markdownCharacters: number;
  tables: number;
  tableRows: number;
  emptyTables: number;
  referencedAssets: number;
  unresolvedReferencedAssets: string[];
  facts: number;
  entities: number;
  relationships: number;
  ragChunks: number;
  exactDuplicateGroups: string[][];
  nearDuplicateGroups: NearDuplicateGroup[];
  shortPages: Array<{ url: string; extractedChars: number; tables: number }>;
  noisyPages: Array<{ url: string; signals: string[] }>;
  orphanEntityIds: string[];
  invalidSourceUrls: string[];
  unresolvedInternalLinks: string[];
  sourceErrors: Array<{ url: string; stage: string; error: string }>;
  categories: Record<string, number>;
}
