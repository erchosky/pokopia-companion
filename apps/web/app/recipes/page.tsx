import { Badge, Card, EmptyState, PageIntro, Pagination } from '@pokopia/ui';
import { repository } from '@/lib/data';
import Link from 'next/link';
type Props = { searchParams: Promise<{ page?: string }> };
const PAGE_SIZE = 48;
export default async function RecipesPage({ searchParams }: Props) {
  const current = Math.max(1, Number((await searchParams).page) || 1);
  const entries = (await repository()).listRecipes(PAGE_SIZE + 1, (current - 1) * PAGE_SIZE);
  const visible = entries.slice(0, PAGE_SIZE);
  return (
    <main>
      <PageIntro eyebrow="Crafting" title="Recetas">
        <p>Revisa ingredientes y cantidades conocidas antes de empezar a construir.</p>
      </PageIntro>
      {visible.length ? (
        <>
          <div className="collection-meta">
            <span>
              Página <strong>{current}</strong>
            </span>
            <span>{visible.length} recetas en esta vista</span>
          </div>
          <div className="grid">
            {visible.map((entry) => (
              <Link key={entry.slug} href={`/recipes/${entry.slug}`}>
                <Card className="card-link entity-card">
                  <Badge>Receta</Badge>
                  <h2>{entry.name}</h2>
                  <p>
                    {entry.ingredients
                      .map((ingredient) => `${ingredient.name} × ${ingredient.quantity ?? '?'}`)
                      .join(' · ')}
                  </p>
                  <span className="card-arrow">Abrir receta →</span>
                </Card>
              </Link>
            ))}
          </div>
          <Pagination page={current} hasNext={entries.length > PAGE_SIZE} pathname="/recipes" />
        </>
      ) : (
        <EmptyState title="No hay recetas compatibles">
          Todavía no hay recetas disponibles para esta vista.
        </EmptyState>
      )}
    </main>
  );
}
