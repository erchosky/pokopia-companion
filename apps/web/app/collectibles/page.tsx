import { Badge, Card, EmptyState, Metric, PageIntro } from '@pokopia/ui';
import { repository } from '@/lib/data';
import Link from 'next/link';
import { ContentScopeNav } from '@/components/content-scope-nav';
import type { ContentScope } from '@pokopia/game-data';

type Props = { searchParams: Promise<{ scope?: string }> };
export default async function CollectiblesPage({ searchParams }: Props) {
  const scope = contentScope((await searchParams).scope);
  const data = await repository();
  const all = data.listCollectibles();
  const entries = data.listCollectibles({ scope });
  return (
    <main>
      <PageIntro eyebrow="Colección conocida" title="Music CDs">
        <p>
          Consulta 53 CDs identificados en el snapshot. El progreso usa este denominador conocido,
          no una afirmación sobre todo el juego.
        </p>
      </PageIntro>
      <div className="metric-grid">
        <Metric label="CDs conocidos" value={all.length} />
        <Metric
          label="Juego base verificado"
          value={data.listCollectibles({ scope: 'base_game' }).length}
        />
        <Metric
          label="Expansion Pass verificado"
          value={data.listCollectibles({ scope: 'expansion' }).length}
        />
      </div>
      <ContentScopeNav pathname="/collectibles" selected={scope} />
      {entries.length ? (
        <div className="grid">
          {entries.map((entry) => (
            <Link
              aria-label={`${entry.name}: ver ubicación`}
              href={`/collectibles/${entry.slug}`}
              key={entry.slug}
            >
              <Card className="card-link entity-card">
                <Badge tone={entry.classification.scope === 'expansion' ? 'warn' : 'accent'}>
                  Music CD #{entry.catalogNumber}
                </Badge>
                <h2>{entry.name}</h2>
                <p>{entry.originGame || 'Juego de origen sin confirmar'}</p>
                <span className="card-arrow">Ver ubicación →</span>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin CDs en este filtro">
          No hay registros conocidos con esa clasificación.
        </EmptyState>
      )}
    </main>
  );
}
function contentScope(value: string | undefined): ContentScope | 'all' {
  return value === 'base_game' || value === 'expansion' || value === 'unknown' ? value : 'all';
}
