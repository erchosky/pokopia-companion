import { Badge, Card, PageIntro } from '@pokopia/ui';
import { repository } from '@/lib/data';
import Link from 'next/link';
export default async function TownsPage() {
  const entries = (await repository()).listTowns();
  return (
    <main>
      <PageIntro eyebrow="Pueblos" title="Planifica cada zona">
        <p>Reúne recursos, desbloqueos y habitantes conocidos de cada zona en un solo lugar.</p>
      </PageIntro>
      <div className="grid">
        {entries.map((entry) => (
          <Link key={entry.slug} href={`/towns/${entry.slug}`}>
            <Card className="card-link entity-card">
              <Badge>Pueblo o zona</Badge>
              <h2>{entry.name}</h2>
              <p>Consulta los datos que ya conocemos de esta zona.</p>
              <span className="card-arrow">Explorar zona →</span>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
