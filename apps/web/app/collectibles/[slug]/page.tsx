import { Badge, Card, DefinitionList, PageIntro, SourceNote } from '@pokopia/ui';
import { repository } from '@/lib/data';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { GoalAction, ProgressAction } from '@/components/progress-actions';

type Props = { params: Promise<{ slug: string }> };
export default async function CollectiblePage({ params }: Props) {
  const entry = (await repository()).getCollectible((await params).slug);
  if (!entry) notFound();
  const scope = entry.classification.scope === 'expansion' ? 'Expansion Pass' : 'Juego base';
  return (
    <main>
      <Link className="back-link" href="/collectibles">
        ← Music CDs
      </Link>
      <PageIntro eyebrow={`Music CD #${entry.catalogNumber}`} title={entry.name}>
        <p>{entry.description}</p>
      </PageIntro>
      <div className="entity-actions">
        <ProgressAction
          kind="collectible"
          slug={entry.slug}
          activeLabel="Conseguido"
          inactiveLabel="Marcar conseguido"
        />
        <GoalAction type="get-collectible" slug={entry.slug} label={`Conseguir ${entry.name}`} />
      </div>
      <Card>
        <Badge tone={entry.classification.scope === 'expansion' ? 'warn' : 'accent'}>
          {scope} · verificado
        </Badge>
        <DefinitionList
          entries={[
            { label: 'Ubicaciones', value: entry.locations },
            { label: 'Juego de origen', value: entry.originGame || 'Sin confirmar' },
            { label: 'Base de clasificación', value: entry.classification.reason },
          ]}
        />
      </Card>
      <SourceNote {...entry.source} status={entry.source.verificationStatus} />
    </main>
  );
}
