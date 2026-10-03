import { resolve } from 'node:path';

export interface PipelinePaths {
  root: string;
  snapshot: string;
  rawHtml: string;
  processed: string;
  canonical: string;
  audits: string;
  docs: string;
}

export function pipelinePaths(cwd = process.cwd()): PipelinePaths {
  const root = cwd.endsWith('packages/ingestion') ? resolve(cwd, '../..') : resolve(cwd);
  const snapshot = resolve(root, 'data/source/snapshots/20260809/Pokopia-KB-FULL');
  return {
    root,
    snapshot,
    rawHtml: resolve(snapshot, 'RAW_HTML'),
    processed: resolve(root, 'data/processed/v3.1'),
    canonical: resolve(root, 'data/canonical/v3.1'),
    audits: resolve(root, 'data/audits/v3.1'),
    docs: resolve(root, 'docs'),
  };
}
