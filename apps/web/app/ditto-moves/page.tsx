import { Badge, Card, EmptyState, Metric, PageIntro } from '@pokopia/ui';
import { repository } from '@/lib/data';
import Link from 'next/link';

export default async function DittoMovesPage() {
  const entries = (await repository()).listDittoMoves();
  return (
    <main>
      <PageIntro eyebrow="Ditto" title="Movimientos">
        <p>
          Movimientos que Ditto aprende para progresar. Son una mecánica propia y no cuentan como
          especialidades Pokémon.
        </p>
      </PageIntro>
      <div className="metric-grid">
        <Metric label="Movimientos conocidos" value={entries.length} />
        <Metric
          label="Primarios"
          value={entries.filter((entry) => entry.moveClass === 'primary').length}
        />
        <Metric
          label="Secundarios"
          value={entries.filter((entry) => entry.moveClass === 'secondary').length}
        />
      </div>
      {entries.length ? (
        <div className="grid">
          {entries.map((entry) => (
            <Link href={`/ditto-moves/${entry.slug}`} key={entry.slug}>
              <Card className="card-link entity-card">
                <Badge tone={entry.moveClass === 'primary' ? 'accent' : 'neutral'}>
                  {entry.moveClass === 'primary' ? 'Primario' : 'Secundario'}
                </Badge>
                <h2>{entry.name}</h2>
                <p>{entry.effect}</p>
                <span className="card-arrow">Ver cómo aprenderlo →</span>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="Sin movimientos tipados">
          La fuente no ofrece filas compatibles.
        </EmptyState>
      )}
    </main>
  );
}
