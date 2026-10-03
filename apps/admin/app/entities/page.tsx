import { Badge, Card, PageIntro } from '@pokopia/ui';
import { repository } from '@/lib/data';
export default async function EntitiesPage() {
  const data = await repository();
  const health = data.health();
  const iteration4 = [
    { domain: 'Important Requests', values: data.listQuests() },
    { domain: 'Treasure Maps', values: data.listTreasureMaps() },
    { domain: 'Music CDs', values: data.listCollectibles() },
    { domain: 'Ditto Moves', values: data.listDittoMoves() },
  ];
  return (
    <main>
      <PageIntro eyebrow="Catálogo" title="Entidades detectadas">
        <p>
          Conteos por categoría de origen. Todavía no equivalen a entidades canónicas aprobadas.
        </p>
      </PageIntro>
      <div className="grid">
        {Object.entries(health.entities)
          .sort((a, b) => b[1] - a[1])
          .map(([category, total]) => (
            <Card key={category}>
              <Badge>{category}</Badge>
              <h2>{total.toLocaleString('es-ES')}</h2>
              <p>páginas fuente</p>
            </Card>
          ))}
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Iteration 4 review</p>
          <h2>Proyecciones tipadas</h2>
        </div>
        <p>Revisión individual; sin acciones masivas</p>
      </div>
      <div className="grid">
        {iteration4.map(({ domain, values }) => (
          <Card key={domain}>
            <Badge tone="accent">{values.length} registros</Badge>
            <h2>{domain}</h2>
            <p>
              {values.filter((entry) => entry.classification.status === 'verified').length}{' '}
              verificados ·{' '}
              {values.filter((entry) => entry.classification.status === 'candidate').length}{' '}
              candidatos ·{' '}
              {values.filter((entry) => entry.classification.status === 'unknown').length} unknown
            </p>
          </Card>
        ))}
      </div>
    </main>
  );
}
