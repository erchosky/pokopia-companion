import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractHtml } from '../src/html.js';

const fixture = fileURLToPath(new URL('fixtures/serebii-page.html', import.meta.url));

describe('extractHtml', () => {
  it('extracts main content, table structure and source links without navigation', async () => {
    const html = await readFile(fixture, 'utf8');
    const result = extractHtml(html, 'https://www.serebii.net/pokemonpokopia/test.shtml');
    expect(result.title).toBe('Pokémon Pokopia — Abilities');
    expect(result.text).toContain('Flabébé');
    expect(result.text).not.toContain('Quick Links');
    expect(result.text).not.toContain('Copyright');
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0]?.rows[1]?.cells[0]?.text).toBe('Leafage');
    expect(result.links[0]?.url).toBe('https://www.serebii.net/pokemonpokopia/abilities.shtml');
    expect(result.markdown).toContain('| Move | Effect |');
  });

  it('falls back to body and reports known residual navigation', () => {
    const result = extractHtml(
      '<html><title>X</title><body><p>Quick Links</p><p>Useful text</p></body></html>',
      'https://www.serebii.net/pokemonpokopia/x.shtml',
    );
    expect(result.text).toContain('Useful text');
    expect(result.residualNoiseSignals).toContain('quick-links');
  });
});
