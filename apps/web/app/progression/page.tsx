import { Badge, Card, Metric, PageIntro } from '@pokopia/ui';
import { repository } from '@/lib/data';
import Link from 'next/link';

export default async function ProgressionPage() {
  const data = await repository();
  const domains = [
    {
      href: '/requests',
      eyebrow: 'Historia',
      title: 'Important Requests',
      count: data.listQuests().length,
      copy: 'Cinco solicitudes narrativas, con pasos conservadores y unknowns explícitos.',
    },
    {
      href: '/treasure-maps',
      eyebrow: 'Exploración',
      title: 'Treasure Maps',
      count: data.listTreasureMaps().length,
      copy: 'Requisitos, localización, recompensa y desbloqueo de receta con dirección verificable.',
    },
    {
      href: '/collectibles',
      eyebrow: 'Colección',
      title: 'Music CDs',
      count: data.listCollectibles().length,
      copy: 'Progreso sobre 53 CDs conocidos, con Base game y Expansion Pass separados.',
    },
    {
      href: '/ditto-moves',
      eyebrow: 'Capacidades',
      title: 'Ditto Moves',
      count: data.listDittoMoves().length,
      copy: 'Movimientos primarios y secundarios sin mezclarlos con especialidades Pokémon.',
    },
  ] as const;
  return (
    <main>
      <PageIntro eyebrow="Progression Intelligence" title="Tu progreso, sin suposiciones">
        <p>
          Consulta qué existe, qué requiere y qué has confirmado. Los datos ausentes se mantienen
          como desconocidos; nunca cuentan como incompletos por defecto.
        </p>
      </PageIntro>
      <div className="metric-grid">
        {domains.map((domain) => (
          <Metric label={domain.title} value={domain.count} key={domain.href} />
        ))}
      </div>
      <div className="grid progression-grid">
        {domains.map((domain) => (
          <Link
            aria-label={`${domain.title}: abrir ${domain.count} conocidos`}
            href={domain.href}
            key={domain.href}
          >
            <Card className="card-link entity-card">
              <Badge tone="accent">{domain.eyebrow}</Badge>
              <h2>{domain.title}</h2>
              <p>{domain.copy}</p>
              <span className="card-arrow">Abrir {domain.count} conocidos →</span>
            </Card>
          </Link>
        ))}
      </div>
      <aside className="privacy-note">
        <strong>Clasificación de versión.</strong> “Juego base” y “Expansion Pass” solo aparecen
        cuando la fuente lo afirma. “Desconocido” significa que la evidencia actual no permite
        decidir; “Todo” incluye esos casos.
      </aside>
    </main>
  );
}
