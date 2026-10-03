import { PageIntro } from '@pokopia/ui';
import { repository } from '@/lib/data';
import { MyPokopiaDashboard } from '@/components/my-pokopia-dashboard';
export default async function MyPokopiaPage() {
  const data = await repository();
  const towns = data.listTowns().map(({ slug, name, maxEnvironmentLevel }) => ({
    slug,
    name,
    maxLevel: maxEnvironmentLevel,
  }));
  const progressionCatalog = [
    ...data.listQuests().map((entry) => ({
      kind: 'quest' as const,
      slug: entry.slug,
      label: entry.name,
      group: 'Important Requests',
      href: `/requests/${entry.slug}`,
    })),
    ...data.listTreasureMaps().map((entry) => ({
      kind: 'treasure_map' as const,
      slug: entry.slug,
      label: entry.reward.name,
      group: 'Treasure Maps',
      href: `/treasure-maps/${entry.slug}`,
    })),
    ...data.listCollectibles().map((entry) => ({
      kind: 'collectible' as const,
      slug: entry.slug,
      label: `#${entry.catalogNumber} · ${entry.name}`,
      group: 'Music CDs',
      href: `/collectibles/${entry.slug}`,
    })),
    ...data.listDittoMoves().map((entry) => ({
      kind: 'ditto_move' as const,
      slug: entry.slug,
      label: entry.name,
      group: 'Ditto Moves',
      href: `/ditto-moves/${entry.slug}`,
    })),
  ];
  return (
    <main>
      <PageIntro eyebrow="My Pokopia" title="Tu partida, a tu ritmo">
        <p>
          Confirma solo lo que sabes. Los niveles inferidos permanecen separados y puedes
          corregirlos en cualquier momento.
        </p>
      </PageIntro>
      <MyPokopiaDashboard
        towns={towns}
        automation={data.listAutomationSystems()}
        progressionCatalog={progressionCatalog}
      />
    </main>
  );
}
