import { load, type CheerioAPI, type Cheerio } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { ExtractedTable, ImageRecord, LinkRecord } from './types.js';
import { normalizeWhitespace } from './util.js';

const NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'template',
  'iframe',
  'form',
  '.ad',
  '.advert',
  '.advertisement',
  '#nn_lb1',
  '#nn_mobile_lb1',
  '#nn_lb2',
  '#nn_mobile_lb2',
  '#celtra-reveal-wrapper',
];

export function canonicalUrl(value: string, baseUrl: string): string | null {
  try {
    const resolved = new URL(value, baseUrl);
    resolved.hash = '';
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

function elementText($: CheerioAPI, element: Element): string {
  return normalizeWhitespace($(element).text());
}

function collectLinks($: CheerioAPI, root: Cheerio<AnyNode>, sourceUrl: string): LinkRecord[] {
  const byUrl = new Map<string, LinkRecord>();
  root.find('a[href]').each((_, node) => {
    const href = $(node).attr('href');
    if (href === undefined) return;
    const url = canonicalUrl(href, sourceUrl);
    if (url === null) return;
    const parsed = new URL(url);
    if (parsed.hostname !== 'www.serebii.net' || !parsed.pathname.startsWith('/pokemonpokopia'))
      return;
    const text =
      normalizeWhitespace($(node).text()) ||
      parsed.pathname
        .split('/')
        .filter(Boolean)
        .at(-1)
        ?.replace(/\.shtml$/, '') ||
      url;
    byUrl.set(url, { url, text, internal: true });
  });
  return [...byUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
}

function collectImages($: CheerioAPI, root: Cheerio<AnyNode>, sourceUrl: string): ImageRecord[] {
  const images: ImageRecord[] = [];
  root.find('img[src]').each((_, node) => {
    const src = $(node).attr('src');
    if (src === undefined) return;
    const url = canonicalUrl(src, sourceUrl);
    if (url !== null) images.push({ url, alt: normalizeWhitespace($(node).attr('alt') ?? '') });
  });
  return images;
}

function markdownInline($: CheerioAPI, node: AnyNode, sourceUrl: string): string {
  if (node.type === 'text') return node.data.replace(/\s+/g, ' ');
  if (node.type !== 'tag') return '';
  const element = $(node);
  const tag = node.name.toLowerCase();
  const children = node.children.map((child) => markdownInline($, child, sourceUrl)).join('');
  if (tag === 'br') return '  \n';
  if (tag === 'strong' || tag === 'b') return `**${children.trim()}**`;
  if (tag === 'em' || tag === 'i') return `_${children.trim()}_`;
  if (tag === 'a') {
    const href = element.attr('href');
    const url = href === undefined ? null : canonicalUrl(href, sourceUrl);
    return url === null || children.trim() === '' ? children : `[${children.trim()}](${url})`;
  }
  if (tag === 'img') {
    const src = element.attr('src');
    const url = src === undefined ? null : canonicalUrl(src, sourceUrl);
    return url === null ? '' : `![${element.attr('alt') ?? ''}](${url})`;
  }
  return children;
}

function tableMarkdown(table: ExtractedTable): string {
  const rows = table.rows.map((row) =>
    row.cells.map((cell) => cell.text.replaceAll('|', '\\|').replaceAll('\n', ' ')),
  );
  const width = Math.max(0, ...rows.map((row) => row.length));
  if (width === 0 || rows.length === 0) return '';
  const padded = rows.map((row) => [...row, ...Array<string>(width - row.length).fill('')]);
  const header = padded[0];
  if (header === undefined) return '';
  return [
    `| ${header.join(' | ')} |`,
    `| ${Array<string>(width).fill('---').join(' | ')} |`,
    ...padded.slice(1).map((row) => `| ${row.join(' | ')} |`),
  ].join('\n');
}

function buildMarkdown(
  $: CheerioAPI,
  root: Cheerio<AnyNode>,
  sourceUrl: string,
  tables: ExtractedTable[],
): string {
  let sourceTableIndex = 0;
  const tableByIndex = new Map(tables.map((table) => [table.tableIndex, table]));
  const blocks: string[] = [];
  root.find('h1,h2,h3,h4,h5,h6,p,ul,ol,table').each((_, node) => {
    const tag = node.name.toLowerCase();
    if (tag === 'table') {
      sourceTableIndex += 1;
      const table = tableByIndex.get(sourceTableIndex);
      if ($(node).parents('table').length > 0) return;
      if (table !== undefined) blocks.push(tableMarkdown(table));
      return;
    }
    if ($(node).parents('table').length > 0) return;
    if (tag === 'ul' || tag === 'ol') {
      const ordered = tag === 'ol';
      const list = $(node)
        .children('li')
        .toArray()
        .map((li, index) => {
          const value = normalizeWhitespace($(li).text());
          return `${ordered ? `${index + 1}.` : '-'} ${value}`;
        })
        .filter((value) => value.length > 2)
        .join('\n');
      if (list !== '') blocks.push(list);
      return;
    }
    const content = normalizeWhitespace(
      node.children.map((child) => markdownInline($, child, sourceUrl)).join(''),
    );
    if (content === '') return;
    const level = /^h([1-6])$/.exec(tag)?.[1];
    blocks.push(level === undefined ? content : `${'#'.repeat(Number(level))} ${content}`);
  });
  return blocks
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface HtmlExtraction {
  title: string;
  visibleText: string;
  text: string;
  markdown: string;
  links: LinkRecord[];
  tables: ExtractedTable[];
  residualNoiseSignals: string[];
}

export function extractHtml(
  html: string,
  sourceUrl: string,
  selectedTableIndexes?: ReadonlySet<number>,
): HtmlExtraction {
  const $ = load(html);
  const title = normalizeWhitespace($('title').first().text());
  $(NOISE_SELECTORS.join(',')).remove();
  const visibleText = normalizeWhitespace($('body').text());
  const root =
    $('main').first().length > 0
      ? $('main').first()
      : $('#content').first().length > 0
        ? $('#content').first()
        : $('body').first();
  const tables: ExtractedTable[] = [];
  root.find('table').each((tableOffset, tableNode) => {
    const tableIndex = tableOffset + 1;
    if (selectedTableIndexes !== undefined && !selectedTableIndexes.has(tableIndex)) return;
    const ownRows = $(tableNode)
      .children('tr')
      .add($(tableNode).children('thead,tbody,tfoot').children('tr'));
    const rows = ownRows.toArray().map((rowNode, rowOffset) => ({
      rowIndex: rowOffset + 1,
      cells: $(rowNode)
        .children('th,td')
        .toArray()
        .map((cellNode, cellOffset) => ({
          columnIndex: cellOffset + 1,
          text: elementText($, cellNode),
          isHeader: cellNode.name.toLowerCase() === 'th',
          colspan: Number.parseInt($(cellNode).attr('colspan') ?? '1', 10) || 1,
          rowspan: Number.parseInt($(cellNode).attr('rowspan') ?? '1', 10) || 1,
          links: collectLinks($, $(cellNode), sourceUrl),
          images: collectImages($, $(cellNode), sourceUrl),
        })),
    }));
    tables.push({
      tableIndex,
      caption: normalizeWhitespace($(tableNode).children('caption').first().text()),
      rows,
    });
  });
  const textRoot = root.clone();
  textRoot.find('h1,h2,h3,h4,h5,h6,p,li,tr,br').append('\n');
  const text = normalizeWhitespace(textRoot.text());
  const markdown = buildMarkdown($, root, sourceUrl, tables);
  const noiseChecks: Array<[string, RegExp]> = [
    ['quick-links', /\bQuick\s*Links\b/i],
    ['copyright-footer', /All Content is .*Copyright of Serebii/i],
    ['cookie-settings', /Manage Cookie Settings/i],
    ['support-patreon', /Support us on Patreon/i],
  ];
  return {
    title,
    visibleText,
    text,
    markdown,
    links: collectLinks($, root, sourceUrl),
    tables,
    residualNoiseSignals: noiseChecks
      .filter(([, pattern]) => pattern.test(text))
      .map(([name]) => name),
  };
}
