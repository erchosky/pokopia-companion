import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function stableId(prefix: string, value: string): string {
  return `${prefix}_${sha256(value).slice(0, 24)}`;
}

export function normalizeWhitespace(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export async function writeJsonl(path: string, values: readonly unknown[]): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const body = values.map((value) => JSON.stringify(value)).join('\n');
  await writeFile(path, body.length === 0 ? '' : `${body}\n`, 'utf8');
}

export function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}
