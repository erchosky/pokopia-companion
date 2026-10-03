import { Badge, Card, DefinitionList, PageIntro, SourceNote } from '@pokopia/ui';
import { repository } from '@/lib/data';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { GoalAction, ProgressAction } from '@/components/progress-actions';

type Props = { params: Promise<{ slug: string }> };
export default async function DittoMovePage({ params }: Props) {
  const entry = (await repository()).getDittoMove((await params).slug);
  if (!entry) notFound();
  return (
    <main>
      <Link className="back-link" href="/ditto-moves">
        ← Ditto Moves
      </Link>
      <PageIntro eyebrow={`Movimiento ${entry.moveClass}`} title={entry.name}>
        <p>{entry.effect}</p>
      </PageIntro>
      <div className="entity-actions">
        <ProgressAction
          kind="ditto_move"
          slug={entry.slug}
          activeLabel="Aprendido"
          inactiveLabel="Marcar aprendido"
        />
        <GoalAction type="learn-ditto-move" slug={entry.slug} label={`Aprender ${entry.name}`} />
      </div>
      <div className="detail-grid">
        <Card>
          <Badge tone="accent">Cómo aprenderlo</Badge>
          <p>{entry.unlock}</p>
          <DefinitionList
            entries={[
              {
                label: 'Pokémon citado',
                value: entry.learnedFromPokemon.join(', ') || 'Sin relación Pokémon unívoca',
              },
              { label: 'Versión', value: 'Desconocida' },
            ]}
          />
        </Card>
        {entry.mealBoost ? (
          <Card>
            <Badge tone="good">Mejora temporal</Badge>
            <h2>{entry.mealBoost.meal}</h2>
            <p>{entry.mealBoost.effect}</p>
          </Card>
        ) : (
          <Card>
            <Badge>Mejora con comida</Badge>
            <p>Sin mejora estructurada documentada.</p>
          </Card>
        )}
      </div>
      <SourceNote {...entry.source} status={entry.source.verificationStatus} />
    </main>
  );
}
