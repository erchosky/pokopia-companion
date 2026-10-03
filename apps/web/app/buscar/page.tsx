import { Badge, Card, EmptyState, PageIntro } from '@pokopia/ui';
import { createSearchEngine, inferSearchIntent, SEARCH_MAX_LENGTH } from '@pokopia/search';
import { repository } from '@/lib/data';
import { entityHref } from '@/lib/links';
import { entityKindLabel, humanizeGameValue } from '@/lib/presentation';
import Link from 'next/link';
import { SearchHistoryRecorder } from '@/components/entity-activity';
import { firstParam, type SearchParamValue } from '@/lib/search-params';

const suggestions = [
  ['Pokémon para regar', 'pokemon para regar'],
  ['Objetos de almacenamiento', 'objetos almacenamiento'],
  ['Recetas', 'recetas'],
] as const;
type Props = { searchParams: Promise<{ q?: SearchParamValue }> };
export default async function SearchPage({ searchParams }: Props) {
  const q = firstParam((await searchParams).q) ?? '';
  const data = await repository();
  const results = q.length >= 2 ? createSearchEngine(data).search({ text: q, limit: 24 }) : [];
  const intent = q.length >= 2 ? inferSearchIntent(q) : null;
  return (
    <main>
      <SearchHistoryRecorder query={q} />
      <PageIntro eyebrow="Búsqueda universal" title="Encuentra una respuesta">
        <p>
          Busca por nombre, tarea o concepto. Te mostraremos primero las coincidencias que mejor
          encajan y podrás revisar su fuente.
        </p>
      </PageIntro>
      <form className="search-form" action="/buscar">
        <label className="sr-only" htmlFor="search">
          Texto de búsqueda
        </label>
        <input
          id="search"
          name="q"
          defaultValue={q}
          placeholder="Pokémon, objeto, receta, pueblo…"
          minLength={2}
          maxLength={SEARCH_MAX_LENGTH}
          required
        />
        <button type="submit">Buscar</button>
      </form>
      {intent ? (
        <section className="direct-answer card">
          <div>
            <Badge tone="accent">Respuesta directa · confianza {intent.confidence}</Badge>
            <h2>{intent.title}</h2>
            <p>{intent.answer}</p>
          </div>
          <Link className="button" href={intent.href}>
            {intent.action} →
          </Link>
        </section>
      ) : null}
      {!q ? (
        <div className="suggestion-row suggestion-row-light" aria-label="Búsquedas sugeridas">
          <span>Ideas para empezar:</span>
          {suggestions.map(([label, query]) => (
            <Link
              className="suggestion-chip"
              href={`/buscar?q=${encodeURIComponent(query)}`}
              key={query}
            >
              {label}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="section-heading">
        <div>
          <p className="eyebrow">Resultados</p>
          <h2>
            {q ? `${results.length} coincidencias para “${q}”` : 'Escribe al menos 2 caracteres'}
          </h2>
        </div>
      </div>
      {results.length ? (
        <div className="result-list">
          {results.map((result, index) => (
            <Link
              aria-label={result.title}
              key={`${result.kind}-${result.slug}`}
              href={entityHref(result.kind, result.slug)}
            >
              <Card className="result card-link">
                <span className="result-index">{index + 1}</span>
                <div className="result-copy">
                  <Badge tone={index === 0 ? 'accent' : 'neutral'}>
                    {index === 0 ? 'Mejor coincidencia · ' : ''}
                    {entityKindLabel(result.kind)}
                  </Badge>
                  <h2>{result.title}</h2>
                  <p>{humanizeGameValue(result.excerpt)}</p>
                </div>
                <span className="result-arrow" aria-hidden="true">
                  →
                </span>
              </Card>
            </Link>
          ))}
        </div>
      ) : q ? (
        <EmptyState title="Sin coincidencias">
          Prueba con un nombre más corto, una categoría como “Pokémon” o una tarea como “regar”.
        </EmptyState>
      ) : null}
    </main>
  );
}
