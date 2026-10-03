import { Badge, Card, EmptyState, PageIntro } from '@pokopia/ui';
import { repository } from '@/lib/data';
import Link from 'next/link';
import { ContentScopeNav } from '@/components/content-scope-nav';
import type { ContentScope } from '@pokopia/game-data';

type Props = { searchParams: Promise<{ scope?: string }> };
export default async function RequestsPage({ searchParams }: Props) {
  const { scope: rawScope } = await searchParams;
  const scope = contentScope(rawScope);
  const entries = (await repository()).listQuests({ scope });
  return (
    <main>
      <PageIntro eyebrow="Historia" title="Important Requests">
        <p>
          Guía de las solicitudes principales conocidas. Se muestran pasos narrativos; recompensas,
          repetición y prerrequisitos ausentes siguen sin confirmar.
        </p>
      </PageIntro>
      <ContentScopeNav pathname="/requests" selected={scope} />
      {entries.length ? (
        <div className="grid">
          {entries.map((entry) => (
            <Link href={`/requests/${entry.slug}`} key={entry.slug}>
              <Card className="card-link entity-card">
                <Badge tone="warn">Versión desconocida</Badge>
                <h2>{entry.name}</h2>
                <p>{entry.steps[0]?.description ?? entry.description}</p>
                <span className="card-arrow">Ver {entry.steps.length} pasos narrativos →</span>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin Requests en este filtro">
          La fuente no clasifica estas solicitudes como juego base o expansión. Prueba “Todo” o
          “Desconocido”.
        </EmptyState>
      )}
    </main>
  );
}

function contentScope(value: string | undefined): ContentScope | 'all' {
  return value === 'base_game' || value === 'expansion' || value === 'unknown' ? value : 'all';
}
