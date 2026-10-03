import { Badge, Card, EmptyState, PageIntro } from '@pokopia/ui';
import { repository } from '@/lib/data';
import Link from 'next/link';
import { ContentScopeNav } from '@/components/content-scope-nav';
import type { ContentScope } from '@pokopia/game-data';

type Props = { searchParams: Promise<{ scope?: string }> };
export default async function TreasureMapsPage({ searchParams }: Props) {
  const { scope: rawScope } = await searchParams;
  const scope = contentScope(rawScope);
  const entries = (await repository()).listTreasureMaps({ scope });
  return (
    <main>
      <PageIntro eyebrow="Bubbly Basin" title="Treasure Maps">
        <p>
          Los seis mapas conocidos conectan requisitos, hallazgo, recompensa y receta posterior.
        </p>
      </PageIntro>
      <ContentScopeNav pathname="/treasure-maps" selected={scope} />
      {entries.length ? (
        <div className="grid">
          {entries.map((entry) => (
            <Link href={`/treasure-maps/${entry.slug}`} key={entry.slug}>
              <Card className="card-link entity-card">
                <Badge tone={entry.qualityWarnings.length ? 'warn' : 'accent'}>
                  Mapa #{entry.number}
                </Badge>
                <h2>{entry.reward.name}</h2>
                <p>{entry.area} · requiere Search y Dowsing Machine.</p>
                <span className="card-arrow">Ver localización →</span>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin mapas en este filtro">
          La versión de los Treasure Maps no está clasificada en la fuente.
        </EmptyState>
      )}
    </main>
  );
}
function contentScope(value: string | undefined): ContentScope | 'all' {
  return value === 'base_game' || value === 'expansion' || value === 'unknown' ? value : 'all';
}
