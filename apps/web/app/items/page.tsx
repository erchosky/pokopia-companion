import { Badge, Card, EmptyState, PageIntro, Pagination } from '@pokopia/ui';
import { repository } from '@/lib/data';
import Link from 'next/link';
import { firstParam, type SearchParamValue } from '@/lib/search-params';
type Props = {
  searchParams: Promise<{
    page?: SearchParamValue;
    q?: SearchParamValue;
    filter?: SearchParamValue;
  }>;
};
const PAGE_SIZE = 48;
export default async function ItemsPage({ searchParams }: Props) {
  const raw = await searchParams;
  const params = {
    page: firstParam(raw.page),
    q: firstParam(raw.q),
    filter: firstParam(raw.filter),
  };
  const query = params.q?.trim().toLocaleLowerCase('es');
  const current = Math.max(1, Number(params.page) || 1);
  const all = (await repository()).listItems(10_000).filter((entry) => {
    if (
      query &&
      !`${entry.name} ${entry.description ?? ''}`.toLocaleLowerCase('es').includes(query)
    )
      return false;
    if (params.filter === 'craftable' && entry.craftable !== true) return false;
    if (params.filter === 'storage' && entry.isContainer !== true) return false;
    if (params.filter === 'automation' && entry.automationRelevance === 'unknown') return false;
    if (params.filter === 'dlc' && entry.dlc !== true) return false;
    return true;
  });
  const entries = all.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE + 1);
  const visible = entries.slice(0, PAGE_SIZE);
  return (
    <main>
      <PageIntro eyebrow="Base de objetos" title="Objetos y materiales">
        <p>
          Descubre para qué sirve cada objeto, dónde aparece y qué recetas se relacionan con él.
        </p>
      </PageIntro>
      <form className="catalog-toolbar card" action="/items">
        <label>
          <span>Buscar objetos</span>
          <input
            name="q"
            type="search"
            defaultValue={params.q}
            placeholder="Portal Pod, storage, metal…"
          />
        </label>
        <label>
          <span>Filtro</span>
          <select name="filter" defaultValue={params.filter ?? 'all'}>
            <option value="all">Todos</option>
            <option value="craftable">Craftable</option>
            <option value="storage">Storage detectado</option>
            <option value="automation">Automatización</option>
            <option value="dlc">Expansion Pass</option>
          </select>
        </label>
        <button type="submit">Aplicar</button>
      </form>
      {visible.length ? (
        <>
          <div className="collection-meta">
            <span>
              Página <strong>{current}</strong>
            </span>
            <span>{all.length.toLocaleString('es-ES')} objetos coinciden</span>
          </div>
          <div className="grid">
            {visible.map((entry) => (
              <Link key={entry.slug} href={`/items/${entry.slug}`}>
                <Card className="card-link entity-card">
                  <Badge>Objeto</Badge>
                  <h2>{entry.name}</h2>
                  <p>{entry.description ?? 'Descripción pendiente de confirmación.'}</p>
                  <span className="card-arrow">Ver detalles →</span>
                </Card>
              </Link>
            ))}
          </div>
          <Pagination
            page={current}
            hasNext={entries.length > PAGE_SIZE}
            pathname={`/items${params.q || params.filter ? `?q=${encodeURIComponent(params.q ?? '')}&filter=${encodeURIComponent(params.filter ?? 'all')}` : ''}`}
          />
        </>
      ) : (
        <EmptyState title="Objetos pendientes de ingestión">
          La fuente está conectada, pero todavía no hay objetos compatibles con esta vista.
        </EmptyState>
      )}
    </main>
  );
}
