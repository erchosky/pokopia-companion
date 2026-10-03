import { describe, expect, it } from 'vitest';
import { chunkMarkdown, deriveKnowledge, mergeEntities } from '../src/derive.js';

describe('knowledge derivation', () => {
  it('only emits conservative two-value facts with traceability', () => {
    const result = deriveKnowledge(
      'https://www.serebii.net/pokemonpokopia/items/test.shtml',
      'Test Item',
      [
        {
          url: 'https://www.serebii.net/pokemonpokopia/locations/test.shtml',
          text: 'Test Place',
          internal: true,
        },
      ],
      [
        {
          tableIndex: 1,
          caption: '',
          rows: [
            {
              rowIndex: 1,
              cells: [
                {
                  columnIndex: 1,
                  text: 'Cost',
                  isHeader: false,
                  colspan: 1,
                  rowspan: 1,
                  links: [],
                  images: [],
                },
                {
                  columnIndex: 2,
                  text: '10',
                  isHeader: false,
                  colspan: 1,
                  rowspan: 1,
                  links: [],
                  images: [],
                },
              ],
            },
            {
              rowIndex: 2,
              cells: [
                {
                  columnIndex: 1,
                  text: 'Ambiguous',
                  isHeader: false,
                  colspan: 1,
                  rowspan: 1,
                  links: [],
                  images: [],
                },
                {
                  columnIndex: 2,
                  text: 'A',
                  isHeader: false,
                  colspan: 1,
                  rowspan: 1,
                  links: [],
                  images: [],
                },
                {
                  columnIndex: 3,
                  text: 'B',
                  isHeader: false,
                  colspan: 1,
                  rowspan: 1,
                  links: [],
                  images: [],
                },
              ],
            },
          ],
        },
      ],
    );
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]).toMatchObject({ key: 'Cost', value: '10', tableIndex: 1, rowIndex: 1 });
    expect(result.relationships).toHaveLength(1);
    expect(result.entities).toHaveLength(2);
  });

  it('does not let a self-link replace the parsed page entity', () => {
    const sourceUrl = 'https://www.serebii.net/pokemonpokopia/';
    const result = deriveKnowledge(
      sourceUrl,
      'Pokémon Pokopia',
      [{ url: sourceUrl, text: 'Home', internal: true }],
      [],
    );
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0]).toMatchObject({ name: 'Pokémon Pokopia', sourceKind: 'page' });
    expect(result.relationships).toHaveLength(1);
  });

  it('chunks deterministically with source metadata', () => {
    const chunks = chunkMarkdown(
      'https://example.test',
      'Title',
      'general',
      'a'.repeat(2_500),
      'hash',
      '3.1.0',
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(
      chunks.every((chunk) => chunk.sourceHash === 'hash' && chunk.parserVersion === '3.1.0'),
    ).toBe(true);
  });

  it('prefers a parsed page entity over navigation-only references', () => {
    const id = 'ent_same';
    const entities = mergeEntities([
      {
        id,
        type: 'page',
        name: 'Navigation label',
        sourceUrl: 'https://example.test/page',
        sourceKind: 'linked_page',
      },
      {
        id,
        type: 'page',
        name: 'Canonical page title',
        sourceUrl: 'https://example.test/page',
        sourceKind: 'page',
      },
      {
        id,
        type: 'page',
        name: 'Later link',
        sourceUrl: 'https://example.test/page',
        sourceKind: 'linked_page',
      },
    ]);
    expect(entities).toEqual([
      expect.objectContaining({ name: 'Canonical page title', sourceKind: 'page' }),
    ]);
  });
});
