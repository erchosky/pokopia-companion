import { Badge, Card, PageIntro } from '@pokopia/ui';
import { repository } from '@/lib/data';
export default async function GapsPage() {
  const data = await repository();
  const relationships = data.relationshipAudit();
  const gaps = data
    .coverage()
    .filter((entry) => entry.totalUnresolved > 0 || entry.coveragePercent === null);
  return (
    <main>
      <PageIntro eyebrow="Research queue" title="Gaps y conflictos">
        <p>Los unknown permanecen separados de facts, inferencias y recomendaciones.</p>
      </PageIntro>
      <div className="grid grid-wide">
        <Card>
          <Badge tone="warn">KNOWN GAP</Badge>
          <h2>Relaciones canónicas</h2>
          <p>
            {relationships.total.toLocaleString('es-ES')} enlaces documentales;{' '}
            {relationships.semanticRelationships.toLocaleString('es-ES')} están tipados como
            semánticos en SQLite. Ningún <code>links_to</code> se promueve por sí solo.
          </p>
        </Card>
        <Card>
          <Badge tone="warn">DEFERRED</Badge>
          <h2>Pokémon forms</h2>
          <p>
            No existe un contrato fiable de parent/default y diferencias. Las páginas permanecen
            como evidencia sin relaciones especulativas.
          </p>
        </Card>
        <Card>
          <Badge tone="warn">DEFERRED</Badge>
          <h2>Lost Relics</h2>
          <p>
            La fuente describe pools de tasación, no un conjunto estable de coleccionables únicos
            con ubicación individual.
          </p>
        </Card>
        <Card>
          <Badge tone="warn">NEEDS TESTING</Badge>
          <h2>Validación de gameplay</h2>
          <p>
            Las limitaciones contextuales no presentes en el snapshot requieren pruebas manuales; no
            se infieren como certeza.
          </p>
        </Card>
      </div>
      <div className="section-heading">
        <h2>Research queue generada</h2>
      </div>
      <div className="result-list">
        {gaps.map((gap) => {
          const priority = ['Recipes', 'Abilities / Ditto moves'].includes(gap.domain)
            ? 'P0'
            : gap.domain === 'Pokémon forms'
              ? 'P1'
              : 'P2';
          return (
            <Card className="result" key={gap.domain}>
              <span className="result-index">{priority}</span>
              <div>
                <Badge tone={priority === 'P0' ? 'warn' : 'neutral'}>
                  {gap.totalUnresolved} unresolved
                </Badge>
                <h2>{gap.domain}</h2>
                <p>{gap.basis}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
