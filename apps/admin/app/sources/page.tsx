import { Badge, Card, PageIntro } from '@pokopia/ui';
import { repository } from '@/lib/data';
export default async function SourcesPage() {
  const health = (await repository()).health();
  return (
    <main>
      <PageIntro eyebrow="Procedencia" title="Fuentes y snapshots">
        <p>
          La UI pública conserva evidencia interna, mientras este panel hace visible el origen y su
          estado de verificación.
        </p>
      </PageIntro>
      <Card>
        <Badge tone="accent">Snapshot activo</Badge>
        <h2>{health.snapshot}</h2>
        <p>
          {health.pages.toLocaleString('es-ES')} documentos · {health.facts.toLocaleString('es-ES')}{' '}
          facts candidatos
        </p>
        <code>{health.databasePath}</code>
      </Card>
    </main>
  );
}
