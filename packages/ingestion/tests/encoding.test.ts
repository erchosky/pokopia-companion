import { describe, expect, it } from 'vitest';
import { decodeHtml } from '../src/encoding.js';

describe('decodeHtml', () => {
  it('preserves UTF-8 Pokémon and special characters', () => {
    const bytes = new TextEncoder().encode('<meta charset="utf-8"><p>Pokémon Flabébé — ♀</p>');
    const result = decodeHtml(bytes);
    expect(result.encoding).toBe('utf-8');
    expect(result.text).toContain('Pokémon Flabébé — ♀');
    expect(result.text).not.toContain('\uFFFD');
  });

  it('selects Windows-1252 when raw bytes are not valid UTF-8', () => {
    const bytes = Uint8Array.from(
      Buffer.from('<meta charset="windows-1252"><p>Pok\xE9mon \x97 Pokopia</p>', 'latin1'),
    );
    const result = decodeHtml(bytes);
    expect(result.encoding).toBe('windows-1252');
    expect(result.text).toContain('Pokémon — Pokopia');
    expect(result.text).not.toContain('\uFFFD');
  });

  it('repairs isolated UTF-8 mojibake inside a Windows-1252 page', () => {
    const bytes = Uint8Array.from(
      Buffer.from(
        '<p>Pok\xE9mon and Caf\xC3\xA9 \xE2\x80\x94 test \xE2\x80\x99s \xE2\x80\xA6</p>',
        'latin1',
      ),
    );
    const result = decodeHtml(bytes);
    expect(result.text).toContain('Pokémon and Café — test ’s …');
  });
});
