import { Badge, Card, DefinitionList, PageIntro, SourceNote } from '@pokopia/ui';
import { repository } from '@/lib/data';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { GoalAction, ProgressAction } from '@/components/progress-actions';

type Props = { params: Promise<{ slug: string }> };
export default async function RequestPage({ params }: Props) {
  const { slug } = await params;
  const entry = (await repository()).getQuest(slug);
  if (!entry) notFound();
  return (
    <main>
      <Link className="back-link" href="/requests">
        ← Important Requests
      </Link>
      <PageIntro eyebrow="Important Request" title={entry.name}>
        <p>
          Secuencia narrativa extraída de la guía; no es una checklist de requisitos inventados.
        </p>
      </PageIntro>
      <div className="entity-actions">
        <ProgressAction
          kind="quest"
          slug={entry.slug}
          activeLabel="Completada"
          inactiveLabel="Marcar completada"
        />
        <GoalAction type="complete-quest" slug={entry.slug} label={`Completar ${entry.name}`} />
      </div>
      <Card>
        <Badge tone="warn">Versión desconocida</Badge>
        <DefinitionList
          entries={[
            { label: 'Repetible', value: 'Sin confirmar' },
            { label: 'Recompensas', value: 'Sin confirmar' },
            { label: 'Desbloqueos', value: 'Sin confirmar' },
          ]}
        />
      </Card>
      <section className="detail-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Secuencia</p>
            <h2>Pasos documentados</h2>
          </div>
        </div>
        <ol className="timeline-list">
          {entry.steps.map((step) => (
            <li key={step.order}>
              <strong>Paso {step.order}</strong>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>
      <SourceNote {...entry.source} status={entry.source.verificationStatus} />
    </main>
  );
}
