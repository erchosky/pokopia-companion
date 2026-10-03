import type { DecodingResult, EncodingName } from './types.js';

const MOJIBAKE_PATTERN = /(?:\uFFFD|Ã.|Â.|â(?:€|€™|€œ|€\u009d|€“|€”))/g;
const CHARSET_PATTERN = /<meta[^>]+charset\s*=\s*["']?\s*([^\s"'/>]+)/i;
const HTTP_EQUIV_PATTERN = /<meta[^>]+content\s*=\s*["'][^"']*charset\s*=\s*([^\s;"']+)/i;

function countPattern(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

function candidateScore(value: string): number {
  const replacements = countPattern(value, /\uFFFD/g);
  const mojibake = countPattern(value, MOJIBAKE_PATTERN);
  const controls = countPattern(value, /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g);
  return replacements * 100 + mojibake * 20 + controls * 5;
}

const WINDOWS_1252_REVERSE = new Map<string, number>([
  ['€', 0x80],
  ['‚', 0x82],
  ['ƒ', 0x83],
  ['„', 0x84],
  ['…', 0x85],
  ['†', 0x86],
  ['‡', 0x87],
  ['ˆ', 0x88],
  ['‰', 0x89],
  ['Š', 0x8a],
  ['‹', 0x8b],
  ['Œ', 0x8c],
  ['Ž', 0x8e],
  ['‘', 0x91],
  ['’', 0x92],
  ['“', 0x93],
  ['”', 0x94],
  ['•', 0x95],
  ['–', 0x96],
  ['—', 0x97],
  ['˜', 0x98],
  ['™', 0x99],
  ['š', 0x9a],
  ['›', 0x9b],
  ['œ', 0x9c],
  ['ž', 0x9e],
  ['Ÿ', 0x9f],
]);

function cp1252Byte(character: string): number | null {
  const mapped = WINDOWS_1252_REVERSE.get(character);
  if (mapped !== undefined) return mapped;
  const codePoint = character.codePointAt(0);
  return codePoint !== undefined && codePoint <= 0xff ? codePoint : null;
}

export function repairMixedMojibake(value: string): string {
  return value.replace(/(?:Ã.|Â.|â..)/gu, (sequence) => {
    const bytes: number[] = [];
    for (const character of sequence) {
      const byte = cp1252Byte(character);
      if (byte === null) return sequence;
      bytes.push(byte);
    }
    try {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
      return decoded.includes('\uFFFD') ? sequence : decoded;
    } catch {
      return sequence;
    }
  });
}

export function decodeHtml(bytes: Uint8Array): DecodingResult {
  const asciiHead = Buffer.from(bytes.subarray(0, 8192)).toString('latin1');
  const declaration =
    CHARSET_PATTERN.exec(asciiHead)?.[1] ?? HTTP_EQUIV_PATTERN.exec(asciiHead)?.[1] ?? null;
  const normalizedDeclaration = declaration?.toLowerCase().replaceAll('_', '-') ?? null;
  const preferred: EncodingName =
    normalizedDeclaration?.includes('1252') || normalizedDeclaration?.includes('8859-1')
      ? 'windows-1252'
      : 'utf-8';
  const candidates: Array<{ encoding: EncodingName; text: string }> = [
    { encoding: 'utf-8', text: new TextDecoder('utf-8', { fatal: false }).decode(bytes) },
    {
      encoding: 'windows-1252',
      text: new TextDecoder('windows-1252', { fatal: false }).decode(bytes),
    },
  ];
  candidates.sort((a, b) => {
    const scoreDifference = candidateScore(a.text) - candidateScore(b.text);
    if (scoreDifference !== 0) return scoreDifference;
    return a.encoding === preferred ? -1 : 1;
  });
  const chosen = candidates[0];
  if (chosen === undefined) throw new Error('No encoding candidate available');
  return {
    text: repairMixedMojibake(chosen.text.replaceAll('\uFFFD', '')),
    encoding: chosen.encoding,
    declaredEncoding: declaration,
    replacementCharactersBeforeRepair: countPattern(chosen.text, /\uFFFD/g),
    mojibakeSignalsBeforeRepair: countPattern(chosen.text, MOJIBAKE_PATTERN),
  };
}

export function countMojibake(value: string): number {
  return countPattern(value, MOJIBAKE_PATTERN);
}
