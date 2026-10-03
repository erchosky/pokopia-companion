import { Card, DefinitionList, PageIntro, SourceNote } from '@pokopia/ui';
import { repository } from '@/lib/data';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { GoalAction, ProgressAction } from '@/components/progress-actions';

type Props = { params: Promise<{ slug: string }> };
export default async function TreasureMapPage({ params }: Props) {
  const entry = (await repository()).getTreasureMap((await params).slug);
  if (!entry) notFound();
  return (
    <main>
      <Link className="back-link" href="/treasure-maps">
        ← Treasure Maps
      </Link>
      <PageIntro eyebrow={`Treasure Map #${entry.number}`} title={entry.reward.name}>
        <p>{entry.area}. La dirección del grafo es mapa → requiere / recompensa / desbloquea.</p>
      </PageIntro>
      <div className="entity-actions">
        <ProgressAction
          kind="treasure_map"
          slug={entry.slug}
          activeLabel="Encontrado"
          inactiveLabel="Marcar encontrado"
        />
        <GoalAction
          type="complete-treasure-map"
          slug={entry.slug}
          label={`Encontrar ${entry.reward.name}`}
        />
      </div>
      {entry.qualityWarnings.map((warning) => (
        <aside className="quality-warning" key={warning}>
          <strong>Advertencia de la fuente</strong>
          <p>{warning}</p>
        </aside>
      ))}
      <div className="detail-grid">
        <Card>
          <h2>Requisitos</h2>
          <ul className="plain-list">
            {entry.requirements.map((requirement) => (
              <li key={requirement.slug}>{requirement.name}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2>Resultado</h2>
          <DefinitionList
            entries={[
              { label: 'Recompensa', value: entry.reward.name },
              { label: 'Después de obtenerla', value: entry.recipeUnlock?.name ?? 'Sin confirmar' },
              { label: 'Versión', value: 'Desconocida' },
            ]}
          />
        </Card>
      </div>
      <section className="detail-section">
        <h2>Cómo encontrarlo</h2>
        <p>{entry.location}</p>
      </section>
      <SourceNote {...entry.source} status={entry.source.verificationStatus} />
    </main>
  );
}
