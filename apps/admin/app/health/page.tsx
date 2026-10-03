import { Badge, Card, Metric, PageIntro } from '@pokopia/ui';
import { knowledgeGraph, repository } from '@/lib/data';
export default async function HealthPage() {
  const data = await repository();
  const health = data.health();
  const coverage = data.coverage();
  const graphQuality = (await knowledgeGraph()).quality();
  return (
    <main>
      <PageIntro eyebrow="Operations" title="Data health">
        <p>
          Lectura operativa de la base configurada. El estado legacy se señala para impedir que
          extracción no revisada parezca verdad canónica.
        </p>
      </PageIntro>
      <div className="metric-grid">
        <Metric label="Páginas" value={health.pages} />
        <Metric label="Facts" value={health.facts} />
        <Metric label="Relaciones" value={health.relationships} />
        <Metric label="Schema" value={health.schema} />
      </div>
      <div className="section-heading">
        <h2>Relationship quality</h2>
      </div>
      <div className="metric-grid">
        <Metric label="Raw document links" value={graphQuality.rawDocumentRelationships} />
        <Metric label="Ambiguous for gameplay" value={graphQuality.rawAmbiguousLinks} />
        <Metric label="Semantic projection" value={graphQuality.semanticRelationships} />
        <Metric label="Self-links" value={graphQuality.rawSelfLinks} />
      </div>
      <Card>
        <Badge tone="warn">No promotion</Badge>
        <h2>Links are not gameplay facts</h2>
        <p>
          Raw <code>links_to</code> edges remain documentary navigation. The semantic projection is
          rebuilt from typed tables with direction, class, confidence and evidence.
        </p>
      </Card>
      <div className="section-heading">
        <h2>Alertas activas</h2>
      </div>
      <div className="grid grid-wide">
        {health.warnings.map((warning) => (
          <Card key={warning}>
            <Badge tone="warn">Revisión</Badge>
            <p>{warning}</p>
          </Card>
        ))}
      </div>
      <Card>
        <h2>Base de datos activa</h2>
        <code>{health.databasePath}</code>
        <p>Snapshot: {health.snapshot}</p>
      </Card>
      <div className="section-heading">
        <h2>Cobertura tipada</h2>
      </div>
      <div className="coverage-table card">
        <table>
          <thead>
            <tr>
              <th>Dominio</th>
              <th>Source</th>
              <th>Canonicalized</th>
              <th>Unresolved</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {coverage.map((entry) => (
              <tr key={entry.domain}>
                <th>
                  {entry.domain}
                  <small>{entry.basis}</small>
                </th>
                <td>{entry.totalSource}</td>
                <td>{entry.totalCanonicalized}</td>
                <td>{entry.totalUnresolved}</td>
                <td>{entry.coveragePercent === null ? 'UNKNOWN' : `${entry.coveragePercent}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
