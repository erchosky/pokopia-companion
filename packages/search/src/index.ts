import type { EntityKind, GameDataRepository, SearchRecord } from '@pokopia/game-data';

export interface SearchQuery {
  readonly text: string;
  readonly kinds?: readonly EntityKind[];
  readonly limit?: number;
}

export interface SearchEngine {
  search(query: SearchQuery): readonly SearchRecord[];
}

export interface SearchIntent {
  readonly title: string;
  readonly answer: string;
  readonly href: string;
  readonly action: string;
  readonly confidence: 'high' | 'medium';
}

export const SEARCH_MAX_LENGTH = 120;
const SEARCH_MAX_TOKENS = 12;
const SEARCH_MAX_VARIANTS = 20;
const SEARCH_MAX_RESULTS = 100;

const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  regar: ['water', 'watering'],
  almacenamiento: ['storage', 'container'],
  almacen: ['storage', 'container'],
  baul: ['storage', 'chest'],
  compartido: ['shared', 'portal pod'],
  construccion: ['construction', 'build'],
  construir: ['construction', 'build'],
  build: ['construction'],
  automatizacion: ['automation', 'automatic', 'machine'],
  automatizar: ['automation', 'automatic', 'machine'],
  recursos: ['resource', 'gather', 'collect'],
  agricultura: ['farming', 'grow', 'water'],
  'portal pot': ['portal pod'],
  palette: ['palette town'],
  grande: ['large', 'big'],
  large: ['big'],
};

const QUERY_PREFIXES =
  /^(?:como|how|mejor|best|quiero|necesito)\s+(?:aprender|learn|conseguir|get|obtener|encontrar|find|pokemon|pokémon|un|una|el|la|para\s+)?/;

const KIND_TERMS: Readonly<Record<string, EntityKind>> = {
  pokemon: 'pokemon',
  pokémon: 'pokemon',
  pokedex: 'pokemon',
  pokédex: 'pokemon',
  objeto: 'item',
  objetos: 'item',
  item: 'item',
  items: 'item',
  baul: 'item',
  baúl: 'item',
  storage: 'item',
  container: 'item',
  receta: 'recipe',
  recetas: 'recipe',
  recipe: 'recipe',
  recipes: 'recipe',
  pueblo: 'town',
  pueblos: 'town',
  town: 'town',
  towns: 'town',
  habilidad: 'ability',
  habilidades: 'ability',
  ability: 'ability',
  abilities: 'ability',
  automatizacion: 'automation',
  automation: 'automation',
  quest: 'quest',
  quests: 'quest',
  mision: 'quest',
  misiones: 'quest',
  solicitud: 'quest',
  solicitudes: 'quest',
  request: 'quest',
  requests: 'quest',
  mapa: 'treasure_map',
  mapas: 'treasure_map',
  tesoro: 'treasure_map',
  treasure: 'treasure_map',
  cd: 'collectible',
  cds: 'collectible',
  coleccionable: 'collectible',
  coleccionables: 'collectible',
  movimiento: 'ditto_move',
  movimientos: 'ditto_move',
  ditto: 'ditto_move',
};

export function normalizeSearchText(input: string): string {
  return [...input.normalize('NFKC').trim().replace(/\s+/g, ' ')]
    .slice(0, SEARCH_MAX_LENGTH)
    .join('')
    .split(' ')
    .slice(0, SEARCH_MAX_TOKENS)
    .join(' ');
}

export function expandSearchText(input: string): string {
  return searchVariants(input).join(' ');
}

export function searchVariants(input: string): readonly string[] {
  const normalized = normalizeSearchText(input);
  const normalizedKey = searchKey(normalized);
  const terms = normalized.toLocaleLowerCase('es').split(' ');
  const specificFirst = [
    ...(SYNONYMS[normalizedKey] ?? []),
    ...[...terms].reverse().flatMap((term) => SYNONYMS[searchKey(term)] ?? []),
  ];
  const phraseVariants = terms.flatMap((term, index) =>
    (SYNONYMS[searchKey(term)] ?? []).flatMap((synonym) => {
      const replacedTerms = [...terms];
      replacedTerms[index] = synonym;
      const replaced = replacedTerms.join(' ');
      return terms.length === 2 ? [replaced, replaced.split(' ').reverse().join(' ')] : [replaced];
    }),
  );
  const semanticTarget = normalizedKey.replace(QUERY_PREFIXES, '').trim();
  return [
    ...new Set([
      normalized,
      ...(semanticTarget ? [semanticTarget] : []),
      ...phraseVariants,
      ...specificFirst,
    ]),
  ].slice(0, SEARCH_MAX_VARIANTS);
}

export function inferKinds(input: string): readonly EntityKind[] | undefined {
  const inferred = normalizeSearchText(input)
    .toLocaleLowerCase('es')
    .split(' ')
    .map((term) => KIND_TERMS[term])
    .filter((kind): kind is EntityKind => Boolean(kind));
  return inferred.length ? [...new Set(inferred)] : undefined;
}

export function inferSearchIntent(input: string): SearchIntent | null {
  const key = searchKey(normalizeSearchText(input));
  if (
    /(quiero construir|que necesito para).*(\s+y\s+|\s+e\s+).+/.test(key) ||
    /(que comparten|que necesito para estos|estos tres objetivos)/.test(key)
  )
    return {
      title: 'Plan multiobjetivo',
      answer:
        'El Planner combina los objetivos en un solo grafo y detecta requisitos compartidos sin sumar rutas independientes.',
      href: '/planner',
      action: 'Elegir objetivos',
      confidence: 'high',
    };
  if (
    /(que hago primero|que deberia hacer ahora|que me desbloquea mas|puedo hacer .* antes que|que informacion me falta)/.test(
      key,
    )
  )
    return {
      title: 'Siguiente acción demostrable',
      answer:
        'El Planner usa tu estado para devolver una acción conocida o varias equivalentes y explica la incertidumbre.',
      href: '/planner',
      action: 'Recalcular plan',
      confidence: 'high',
    };
  const craftAmount = key.match(/(?:fabricar|craft|hacer)\s+(\d+)\s+(.+)/);
  if (craftAmount?.[1] && craftAmount[2]) {
    const quantity = Math.min(999, Math.max(1, Number(craftAmount[1])));
    const slug = toRouteSlug(craftAmount[2]);
    return {
      title: `Plan de fabricación · ${quantity}`,
      answer:
        'Calcula materiales directos, recursivos, inventario, excedentes y unknowns sin asumir batch size.',
      href: `/recipes/${slug}?quantity=${quantity}`,
      action: 'Abrir Crafting Planner V2',
      confidence: 'high',
    };
  }
  const craftTarget = key.match(/(?:que necesito para|como)\s+(?:fabricar|craft|hacer)\s+(.+)/);
  if (craftTarget?.[1])
    return {
      title: 'Requisitos de fabricación',
      answer:
        'La receta muestra el grafo, las cantidades respaldadas y los datos que faltan por confirmar.',
      href: `/recipes/${toRouteSlug(craftTarget[1])}`,
      action: 'Evaluar receta',
      confidence: 'high',
    };
  if (/(que puedo hacer ahora|what can i do now|siguiente paso)/.test(key))
    return {
      title: 'Qué puedes hacer ahora',
      answer: 'My Pokopia evalúa tus objetivos contra inventario, progreso y estados unknown.',
      href: '/my-pokopia',
      action: 'Ver Next Actions',
      confidence: 'high',
    };
  if (/(que puedo automatizar|what can i automate|puedo automatizar)/.test(key))
    return {
      title: 'Qué puedes automatizar',
      answer:
        'Clasifica sistemas Ready, Blocked o Needs verification separando construcción y operación.',
      href: '/automation#planner',
      action: 'Evaluar Automation Planner',
      confidence: 'high',
    };
  if (/(que bloquea|what blocks).*(electric|power|energia)/.test(key))
    return {
      title: 'Bloqueos de electricidad',
      answer:
        'Revisa sistema construido, suministro, infraestructura e inputs operativos sin tratarlos como materiales.',
      href: '/automation#planner',
      action: 'Ver traza operativa',
      confidence: 'high',
    };
  if (/(que desbloquea|what unlocks).*(automatic doors|puertas automaticas)/.test(key))
    return {
      title: 'Desbloqueo de Automatic Doors',
      answer: 'La ficha conserva el requisito de desbloqueo y su evidencia fuente.',
      href: '/items/automatic-doors',
      action: 'Abrir Automatic Doors',
      confidence: 'high',
    };
  if (/^(mejor|best).*(pokemon).*(constru|build)/.test(key))
    return {
      title: 'Ranking para construcción',
      answer: 'Compara cobertura, evidencia y límites de los candidatos para construir.',
      href: '/best-pokemon/construction',
      action: 'Abrir ranking explicado',
      confidence: 'high',
    };
  if (/(como|how).*(conseguir|get).*(portal pod)/.test(key))
    return {
      title: 'Cómo conseguir Portal Pod',
      answer: 'La ficha reúne localizaciones, desbloqueo, receta y evidencia disponible.',
      href: '/items/portal-pod',
      action: 'Abrir ficha y requisitos',
      confidence: 'high',
    };
  if (/(que necesito|subir|upgrade).*(palette town|palettetown)/.test(key))
    return {
      title: 'Siguiente nivel de Palette Town',
      answer: 'Confirma tu nivel actual para ordenar los desbloqueos sin asumir progreso.',
      href: '/towns/palettetown#optimizer',
      action: 'Abrir Town Intelligence',
      confidence: 'high',
    };
  if (/(automatizar|automation).*(agricultura|farm|watering|regar)/.test(key))
    return {
      title: 'Plan de automatización agrícola',
      answer: 'El planner contrasta requisitos, pueblo, progreso confirmado y unknowns.',
      href: '/automation#planner',
      action: 'Crear plan',
      confidence: 'medium',
    };
  if (/(automatizar|automation).*(palette town|palettetown)/.test(key))
    return {
      title: 'Automatización de Palette Town',
      answer: 'Contrasta sistemas compatibles, requisitos confirmados y límites aún desconocidos.',
      href: '/towns/palettetown#optimizer',
      action: 'Abrir plan de Palette Town',
      confidence: 'high',
    };
  if (/(comparar|compare).*(storage|almacen|baul)/.test(key))
    return {
      title: 'Comparar almacenamiento',
      answer: 'Compara modelo, capacidad, desbloqueo y requisitos sin premiar datos desconocidos.',
      href: '/compare?kind=storage&context=Automation',
      action: 'Abrir comparador',
      confidence: 'medium',
    };
  if (/(treasure map|mapa del tesoro|mapa).*(6|quick ball)/.test(key))
    return {
      title: 'Treasure Map 6 · Quick Ball',
      answer: 'Consulta la localización conservando la advertencia de calidad del texto fuente.',
      href: '/treasure-maps/treasure-map-6',
      action: 'Abrir mapa y requisitos',
      confidence: 'high',
    };
  if (/(cd|music).*(expansion|dlc)/.test(key))
    return {
      title: 'CDs del Expansion Pass',
      answer: 'Hay 10 CDs conocidos cuya fila exige explícitamente el Expansion Pass.',
      href: '/collectibles?scope=expansion',
      action: 'Ver CDs verificados',
      confidence: 'high',
    };
  if (/(como|how).*(aprender|learn).*(water gun|pistola agua)/.test(key))
    return {
      title: 'Aprender Water Gun',
      answer: 'La ficha separa el movimiento de Ditto de las especialidades Pokémon.',
      href: '/ditto-moves/water-gun',
      action: 'Abrir movimiento',
      confidence: 'high',
    };
  return null;
}

function toRouteSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface IndexedCandidate {
  readonly record: Omit<SearchRecord, 'rank'>;
  readonly titleKey: string;
  readonly haystack: string;
  readonly words: readonly string[];
}

interface PreparedNeedle {
  readonly key: string;
  readonly titleBonus: number;
  readonly typoLimit: number;
}

// Repositories are immutable snapshots, so the normalized candidate index is built once per
// repository instead of re-normalizing every candidate for every variant of every query.
const candidateIndexes = new WeakMap<GameDataRepository, readonly IndexedCandidate[]>();

function candidateIndex(repository: GameDataRepository): readonly IndexedCandidate[] {
  const cached = candidateIndexes.get(repository);
  if (cached) return cached;
  const candidates: IndexedCandidate[] = [];
  const add = (record: Omit<SearchRecord, 'rank'>, searchable: string) => {
    const haystack = searchKey(searchable);
    candidates.push({
      record,
      titleKey: searchKey(record.title),
      haystack,
      words: [...new Set(haystack.split(/\s+/))],
    });
  };
  for (const candidate of repository.listPokemon(10_000))
    add(
      {
        kind: 'pokemon',
        slug: candidate.slug,
        title: candidate.name,
        excerpt: `Especialidad: ${candidate.specialty ?? 'sin confirmar'}. Hábitat: ${candidate.habitat ?? 'sin confirmar'}.`,
        url: candidate.source.url,
      },
      `${candidate.name} ${candidate.specialty ?? ''} ${candidate.habitat ?? ''} ${candidate.roles.map((role) => role.role).join(' ')}`,
    );
  for (const candidate of repository.listItems(10_000))
    add(
      {
        kind: 'item',
        slug: candidate.slug,
        title: candidate.name,
        excerpt: candidate.description ?? 'Descripción no disponible.',
        url: candidate.source.url,
      },
      `${candidate.name} ${candidate.description ?? ''}`,
    );
  for (const candidate of repository.listRecipes(10_000))
    add(
      {
        kind: 'recipe',
        slug: candidate.slug,
        title: candidate.name,
        excerpt: `Ingredientes: ${candidate.ingredients.map((ingredient) => ingredient.name).join(', ')}.`,
        url: candidate.source.url,
      },
      `${candidate.name} ${candidate.ingredients.map((ingredient) => ingredient.name).join(' ')}`,
    );
  for (const candidate of repository.listTowns())
    add(
      {
        kind: 'town',
        slug: candidate.slug,
        title: candidate.name,
        excerpt: candidate.description ?? 'Descripción no disponible.',
        url: candidate.source.url,
      },
      `${candidate.name} ${candidate.description ?? ''}`,
    );
  for (const candidate of repository.listAutomationSystems())
    add(
      {
        kind: 'automation',
        slug: candidate.slug,
        title: candidate.name,
        excerpt: candidate.what,
        url: candidate.source.url,
      },
      `${candidate.name} ${candidate.what} ${candidate.why}`,
    );
  for (const candidate of repository.listQuests())
    add(
      {
        kind: 'quest',
        slug: candidate.slug,
        title: candidate.name,
        excerpt: candidate.description,
        url: candidate.source.url,
      },
      `${candidate.name} ${candidate.description}`,
    );
  for (const candidate of repository.listTreasureMaps())
    add(
      {
        kind: 'treasure_map',
        slug: candidate.slug,
        title: candidate.name,
        excerpt: `${candidate.area} · ${candidate.reward.name}`,
        url: candidate.source.url,
      },
      `${candidate.name} ${candidate.area} ${candidate.location} ${candidate.reward.name}`,
    );
  for (const candidate of repository.listCollectibles())
    add(
      {
        kind: 'collectible',
        slug: candidate.slug,
        title: candidate.name,
        excerpt: `Music CD #${candidate.catalogNumber} · ${candidate.originGame}`,
        url: candidate.source.url,
      },
      `${candidate.name} Music CD ${candidate.catalogNumber} ${candidate.originGame} ${candidate.locations}`,
    );
  for (const candidate of repository.listDittoMoves())
    add(
      {
        kind: 'ditto_move',
        slug: candidate.slug,
        title: candidate.name,
        excerpt: `${candidate.effect} · ${candidate.unlock}`,
        url: candidate.source.url,
      },
      `${candidate.name} ${candidate.effect} ${candidate.unlock}`,
    );
  candidateIndexes.set(repository, candidates);
  return candidates;
}

function matchScore(candidate: IndexedCandidate, needles: readonly PreparedNeedle[]): number {
  let best = 0;
  for (const needle of needles) {
    let score = 0;
    if (candidate.titleKey === needle.key) score = 100;
    else if (candidate.titleKey.includes(needle.key)) score = 80 + needle.titleBonus;
    else if (candidate.haystack.includes(needle.key)) score = 60;
    else if (best < 30 && candidate.words.some((word) => withinEditDistance(word, needle)))
      score = 30;
    if (score > best) best = score;
    if (best === 100) break;
  }
  return best;
}

export function createSearchEngine(repository: GameDataRepository): SearchEngine {
  return {
    search(query) {
      const text = normalizeSearchText(query.text);
      if (text.length < 2) return [];
      const requestedLimit = Math.min(Math.max(query.limit ?? 24, 1), SEARCH_MAX_RESULTS);
      const maximum = Math.max(requestedLimit, 24);
      const variants = searchVariants(text);
      const kinds = query.kinds ?? inferKinds(text);
      const accepts = (kind: EntityKind) =>
        !kinds || kinds.includes(kind) || (kind === 'town' && kinds.includes('location'));
      const needles = variants.map((variant): PreparedNeedle => {
        const key = searchKey(variant);
        return {
          key,
          titleBonus: Math.min(10, Math.max(0, key.split(' ').length - 1) * 5),
          typoLimit: typoLimit(key),
        };
      });
      const structured: SearchRecord[] = [];
      for (const candidate of candidateIndex(repository)) {
        if (!accepts(candidate.record.kind)) continue;
        const rank = matchScore(candidate, needles);
        if (rank > 0) structured.push({ ...candidate.record, rank });
      }
      const combined = [
        ...structured.sort((left, right) =>
          right.rank !== left.rank ? right.rank - left.rank : left.title.localeCompare(right.title),
        ),
        ...variants.flatMap((variant) => repository.search(variant, maximum)),
      ];
      const bestByEntity = new Map<string, SearchRecord>();
      for (const record of combined) {
        const key = `${record.kind}:${record.slug}`;
        const previous = bestByEntity.get(key);
        if (!previous || record.rank > previous.rank) bestByEntity.set(key, record);
      }
      const direct = [...bestByEntity.values()].sort(
        (left, right) =>
          right.rank - left.rank ||
          left.title.localeCompare(right.title) ||
          left.slug.localeCompare(right.slug),
      );
      return direct
        .filter((record) => !kinds || kinds.includes(record.kind))
        .slice(0, requestedLimit);
    },
  };
}

function searchKey(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function typoLimit(value: string): number {
  if (value.length < 4) return 0;
  return value.length < 8 ? 1 : 2;
}

/** Bounded Levenshtein check: stops as soon as the distance is known to exceed the needle limit. */
function withinEditDistance(word: string, needle: PreparedNeedle): boolean {
  const limit = needle.typoLimit;
  const target = needle.key;
  if (Math.abs(word.length - target.length) > limit) return false;
  if (limit === 0) return word === target;
  let previous = Array.from({ length: target.length + 1 }, (_, index) => index);
  for (let row = 1; row <= word.length; row += 1) {
    const current = [row];
    let rowMinimum = row;
    for (let column = 1; column <= target.length; column += 1) {
      const value = Math.min(
        (current[column - 1] ?? 0) + 1,
        (previous[column] ?? 0) + 1,
        (previous[column - 1] ?? 0) + (word[row - 1] === target[column - 1] ? 0 : 1),
      );
      current[column] = value;
      if (value < rowMinimum) rowMinimum = value;
    }
    if (rowMinimum > limit) return false;
    previous = current;
  }
  return (previous[target.length] ?? Number.POSITIVE_INFINITY) <= limit;
}
