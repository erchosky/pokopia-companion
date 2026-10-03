import type { ExtractedTable, QuantitativeAssertion, QuantitativeUnit } from './types.js';
import { stableId } from './util.js';

export interface QuantitativePageInput {
  sourceUrl: string;
  sourceHash: string;
  text: string;
  tables: readonly ExtractedTable[];
}

interface AssertionInput {
  subjectKind: QuantitativeAssertion['subjectKind'];
  subjectSlug: string;
  predicate: string;
  value: number;
  unit: QuantitativeUnit;
  qualifier?: string | null;
  evidenceText: string;
  locator: string;
  gameVersion?: string | null;
  contentScope?: QuantitativeAssertion['contentScope'];
}

const PARSER_ID = 'pokopia-quantitative-v1';

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function makeAssertion(page: QuantitativePageInput, input: AssertionInput): QuantitativeAssertion {
  const qualifier = input.qualifier ?? null;
  const identity = [
    input.subjectKind,
    input.subjectSlug,
    input.predicate,
    input.value,
    input.unit,
    qualifier ?? '',
    input.gameVersion ?? '',
    page.sourceUrl,
    input.locator,
  ].join('|');
  return {
    id: stableId('quant', identity),
    subjectKind: input.subjectKind,
    subjectSlug: input.subjectSlug,
    predicate: input.predicate,
    value: input.value,
    unit: input.unit,
    qualifier,
    derivation: 'source_fact',
    parentAssertionIds: [],
    sourceUrl: page.sourceUrl,
    sourceHash: page.sourceHash,
    locator: input.locator,
    evidenceText: input.evidenceText,
    parserId: PARSER_ID,
    parserConfidence: 1,
    evidenceConfidence: 0.95,
    sourceVerificationStatus: 'unverified',
    assertionStatus: 'accepted',
    contentScope: input.contentScope ?? 'unknown',
    gameVersion: input.gameVersion ?? null,
  };
}

function cells(table: ExtractedTable): string[][] {
  return table.rows.map((row) => row.cells.map((cell) => cell.text.trim()));
}

function tableWithHeader(
  tables: readonly ExtractedTable[],
  required: readonly string[],
): ExtractedTable | undefined {
  return tables.find((table) => {
    const values = table.rows.flatMap((row) => row.cells.map((cell) => cell.text.trim()));
    return required.every((label) => values.includes(label));
  });
}

function parseElectricityTables(page: QuantitativePageInput): QuantitativeAssertion[] {
  const assertions: QuantitativeAssertion[] = [];
  const generators = tableWithHeader(page.tables, ['Name', 'Units of Electricity Generated']);
  if (generators) {
    for (const row of cells(generators).slice(1)) {
      const name = row[1] ?? '';
      const rawValue = row[3] ?? '';
      if (!name || !rawValue) continue;
      const locator = `table:${generators.tableIndex}/name:${name}`;
      if (/^\d+$/.test(rawValue)) {
        assertions.push(
          makeAssertion(page, {
            subjectKind: 'automation_system',
            subjectSlug: slug(name),
            predicate: 'power_generation',
            value: Number(rawValue),
            unit: 'power_unit',
            evidenceText: `${name}: ${rawValue} units of electricity generated`,
            locator,
          }),
        );
      } else {
        const wind = rawValue.match(/^(\d+)\s*standard\s*(\d+)\s*high-altitude$/i);
        if (!wind) continue;
        for (const [value, qualifier] of [
          [wind[1], 'standard'],
          [wind[2], 'high_altitude'],
        ] as const) {
          assertions.push(
            makeAssertion(page, {
              subjectKind: 'automation_system',
              subjectSlug: slug(name),
              predicate: 'power_generation',
              value: Number(value),
              unit: 'power_unit',
              qualifier,
              evidenceText: `${name}: ${rawValue}`,
              locator,
            }),
          );
        }
      }
    }
  }

  const transmitters = tableWithHeader(page.tables, ['Name', 'Distance', 'Size']);
  if (transmitters) {
    for (const row of cells(transmitters).slice(1)) {
      const name = row[1] ?? '';
      const distance = row[3] ?? '';
      const match = distance.match(/^(\d+)\s*blocks\s*(\d+)\s*between transmitters$/i);
      if (!name || !match) continue;
      const locator = `table:${transmitters.tableIndex}/name:${name}`;
      for (const [predicate, value, qualifier] of [
        ['transmission_range', match[1], 'to_target'],
        ['transmission_range', match[2], 'between_transmitters'],
      ] as const) {
        assertions.push(
          makeAssertion(page, {
            subjectKind: 'automation_system',
            subjectSlug: slug(name),
            predicate,
            value: Number(value),
            unit: 'block',
            qualifier,
            evidenceText: `${name}: ${distance}`,
            locator,
          }),
        );
      }
      assertions.push(
        makeAssertion(page, {
          subjectKind: 'automation_system',
          subjectSlug: slug(name),
          predicate: 'connection_capacity',
          value: 20,
          unit: 'connection',
          evidenceText:
            'Each Utility pole or Wireless transmitter can connect to up to 20 things at once.',
          locator: 'narrative:Transmitting Electricity',
        }),
      );
    }
  }

  const consumers = page.tables.find((table) => {
    const values = table.rows.flatMap((row) => row.cells.map((cell) => cell.text.trim()));
    return values.includes('Automatic doors') && values.includes('String lights');
  });
  if (consumers) {
    for (const row of cells(consumers).slice(1)) {
      const name = row[1] ?? '';
      if (!name) continue;
      const value = /^(String lights|Surface light)$/i.test(name) ? 0 : 1;
      assertions.push(
        makeAssertion(page, {
          subjectKind: 'automation_system',
          subjectSlug: slug(name),
          predicate: 'power_demand',
          value,
          unit: 'power_unit',
          evidenceText:
            value === 0
              ? `${name} is an explicit zero-unit exception.`
              : `${name} is listed as requiring electricity; the source states required items consume 1 unit except named zero-unit lights.`,
          locator: `table:${consumers.tableIndex}/name:${name}+narrative:Electricity`,
        }),
      );
    }
  }
  return assertions;
}

function narrativeAssertions(page: QuantitativePageInput): QuantitativeAssertion[] {
  const assertions: QuantitativeAssertion[] = [];
  const add = (input: AssertionInput) => assertions.push(makeAssertion(page, input));
  const text = page.text.replace(/\s+/g, ' ');

  if (page.sourceUrl.endsWith('/electricity.shtml')) {
    const specs: Array<[RegExp, AssertionInput]> = [
      [
        /no more than 64[^.]+Mini Generators/i,
        {
          subjectKind: 'game_rule',
          subjectSlug: 'electricity-network',
          predicate: 'generator_limit',
          value: 64,
          unit: 'item',
          evidenceText: 'No more than 64 generators in any location.',
          locator: 'narrative:Electricity',
        },
      ],
      [
        /cannot have more than 1024 electric items/i,
        {
          subjectKind: 'game_rule',
          subjectSlug: 'electricity-network',
          predicate: 'electric_item_limit',
          value: 1024,
          unit: 'item',
          evidenceText: 'Cannot have more than 1024 electric items at any one time.',
          locator: 'narrative:Electricity',
          gameVersion: '1.1.0',
        },
      ],
      [
        /connect to up to 20 things at once/i,
        {
          subjectKind: 'automation_system',
          subjectSlug: 'electricity-transmitter',
          predicate: 'connection_capacity',
          value: 20,
          unit: 'connection',
          evidenceText:
            'Each Utility pole or Wireless transmitter can connect to up to 20 things at once.',
          locator: 'narrative:Transmitting Electricity',
        },
      ],
      [
        /cannot go more than 5 vertical blocks/i,
        {
          subjectKind: 'game_rule',
          subjectSlug: 'electricity-network',
          predicate: 'vertical_transmission_limit',
          value: 5,
          unit: 'block',
          evidenceText:
            'Power generated cannot go more than 5 vertical blocks up or down at any one time.',
          locator: 'narrative:Transmitting Electricity',
        },
      ],
      [
        /placed over 256 transmitters/i,
        {
          subjectKind: 'game_rule',
          subjectSlug: 'electricity-network',
          predicate: 'transmitter_limit',
          value: 256,
          unit: 'item',
          evidenceText: 'Transmitters placed after the 256th no longer work.',
          locator: 'narrative:Transmitting Electricity',
        },
      ],
      [
        /display up to 40 units of electricity/i,
        {
          subjectKind: 'storage_system',
          subjectSlug: 'charging-station',
          predicate: 'display_capacity',
          value: 40,
          unit: 'power_unit',
          evidenceText: 'Charging Station can display up to 40 units of electricity.',
          locator: 'narrative:Charging Station',
        },
      ],
      [
        /each light showing it has 8 units/i,
        {
          subjectKind: 'storage_system',
          subjectSlug: 'charging-station',
          predicate: 'power_per_light',
          value: 8,
          unit: 'power_unit',
          evidenceText: 'Each Charging Station light represents 8 units.',
          locator: 'narrative:Charging Station',
        },
      ],
    ];
    for (const [pattern, input] of specs) if (pattern.test(text)) add(input);
  }

  if (page.sourceUrl.endsWith('/vegetables.shtml')) {
    if (/Sprinkler works in a diamond which reaches out 5 squares/i.test(text))
      add({
        subjectKind: 'automation_system',
        subjectSlug: 'sprinkler',
        predicate: 'watering_axial_range',
        value: 5,
        unit: 'tile',
        qualifier: 'diamond',
        evidenceText:
          'A Sprinkler works in a diamond which reaches out 5 squares horizontally and vertically.',
        locator: 'narrative:Vegetables',
      });
    if (/covering up to 60 blocks/i.test(text))
      add({
        subjectKind: 'automation_system',
        subjectSlug: 'sprinkler',
        predicate: 'watering_capacity',
        value: 60,
        unit: 'tile',
        qualifier: 'diamond',
        evidenceText: 'Sprinkler covers up to 60 blocks.',
        locator: 'narrative:Vegetables',
      });
  }

  if (page.sourceUrl.endsWith('/patch.shtml')) {
    if (
      /Increased the placement limit for items that use electricity from 512 to 1,?024/i.test(text)
    ) {
      add({
        subjectKind: 'game_rule',
        subjectSlug: 'electricity-network',
        predicate: 'previous_electric_item_limit',
        value: 512,
        unit: 'item',
        evidenceText: 'Version 1.1.0 increased the electric-item limit from 512 to 1,024.',
        locator: 'table:1/version:1.1.0',
        gameVersion: 'pre-1.1.0',
      });
      add({
        subjectKind: 'game_rule',
        subjectSlug: 'electricity-network',
        predicate: 'electric_item_limit',
        value: 1024,
        unit: 'item',
        evidenceText: 'Version 1.1.0 increased the electric-item limit from 512 to 1,024.',
        locator: 'table:1/version:1.1.0',
        gameVersion: '1.1.0',
      });
    }
  }
  return assertions;
}

function buildKitAssertions(page: QuantitativePageInput): QuantitativeAssertion[] {
  if (!page.sourceUrl.includes('/build/')) return [];
  const detail = tableWithHeader(page.tables, ['Concept', 'Time Required', 'Size']);
  if (!detail) return [];
  const values = cells(detail);
  const subject = slug(values[0]?.[0] ?? page.sourceUrl.split('/').at(-1) ?? 'build-kit');
  if (!['windmill-kit', 'waterwheel-kit', 'furnace-kit', 'charging-station-kit'].includes(subject))
    return [];
  const time = values.flat().find((value) => /^\d+\s+hours?$/i.test(value));
  if (!time) return [];
  const value = Number(time.match(/^\d+/)?.[0]);
  if (!Number.isSafeInteger(value) || value < 1) return [];
  const assertions = [
    makeAssertion(page, {
      subjectKind: 'automation_system',
      subjectSlug: subject,
      predicate: 'build_duration',
      value,
      unit: 'hour',
      evidenceText: `Time Required: ${time}`,
      locator: `table:${detail.tableIndex}/header:Time Required`,
    }),
  ];
  const detailValues = values.flat();
  const size = detailValues.find((entry) =>
    /Width:\s*\d+.*Depth:\s*\d+.*Height:\s*\d+/i.test(entry),
  );
  const dimensions = size?.match(/Width:\s*(\d+)\s*Depth:\s*(\d+)\s*Height:\s*(\d+)/i);
  if (dimensions) {
    for (const [predicate, raw] of [
      ['build_width', dimensions[1]],
      ['build_depth', dimensions[2]],
      ['build_height', dimensions[3]],
    ] as const)
      assertions.push(
        makeAssertion(page, {
          subjectKind: 'automation_system',
          subjectSlug: subject,
          predicate,
          value: Number(raw),
          unit: 'block',
          evidenceText: size ?? '',
          locator: `table:${detail.tableIndex}/header:Size`,
        }),
      );
  }
  const workerTable = tableWithHeader(page.tables, ['Materials', 'Pokémon']);
  const workerText = workerTable ? cells(workerTable).flat().join(' ') : '';
  const workers = workerText.match(/(\d+)\s*Pokémon including/i);
  if (workers)
    assertions.push(
      makeAssertion(page, {
        subjectKind: 'automation_system',
        subjectSlug: subject,
        predicate: 'build_worker_count',
        value: Number(workers[1]),
        unit: 'pokemon',
        qualifier: /\bBuild\b/i.test(workerText) ? 'specialty:build' : null,
        evidenceText: workers[0],
        locator: `table:${workerTable?.tableIndex ?? 'unknown'}/header:Pokémon`,
      }),
    );
  return assertions;
}

export function extractQuantitativeAssertions(
  page: QuantitativePageInput,
): QuantitativeAssertion[] {
  const values = [
    ...parseElectricityTables(page),
    ...narrativeAssertions(page),
    ...buildKitAssertions(page),
  ];
  return [...new Map(values.map((value) => [value.id, value])).values()];
}

export function reconcileQuantitativeAssertions(
  assertions: readonly QuantitativeAssertion[],
): QuantitativeAssertion[] {
  const groups = new Map<string, QuantitativeAssertion[]>();
  for (const assertion of assertions) {
    const key = [
      assertion.subjectKind,
      assertion.subjectSlug,
      assertion.predicate,
      assertion.qualifier ?? '',
      assertion.gameVersion ?? '',
      assertion.contentScope,
    ].join('|');
    groups.set(key, [...(groups.get(key) ?? []), assertion]);
  }
  return [...groups.values()].flatMap((group) => {
    const values = new Set(group.map((entry) => `${entry.value}|${entry.unit}`));
    return values.size > 1
      ? group.map((entry) => ({ ...entry, assertionStatus: 'disputed' as const }))
      : group;
  });
}
