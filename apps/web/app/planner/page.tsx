import { PageIntro } from '@pokopia/ui';
import { repository } from '@/lib/data';
import { MultiGoalPlanner } from '@/components/multi-goal-planner';

export const metadata = { title: 'Planner multiobjetivo' };

export default async function PlannerPage() {
  const data = await repository();
  const itemNames = new Map(data.listItems(10_000).map((item) => [item.slug, item.name]));
  const goalOptions = [
    ...data.listRecipes(10_000).map((recipe) => ({
      type: 'craft-item' as const,
      slug: recipe.slug,
      label: itemNames.get(recipe.slug) ?? recipe.name,
      group: 'Fabricar',
      contentScope: 'unknown' as const,
    })),
    ...data.listAutomationSystems().map((system) => ({
      type: 'build-automation' as const,
      slug: system.slug,
      label: system.name,
      group: 'Construir',
      contentScope: system.contentScope,
    })),
    ...data.listQuests().map((quest) => ({
      type: 'complete-quest' as const,
      slug: quest.slug,
      label: quest.name,
      group: 'Requests',
      contentScope: quest.classification.scope,
    })),
    ...data.listCollectibles().map((collectible) => ({
      type: 'get-collectible' as const,
      slug: collectible.slug,
      label: `CD #${collectible.catalogNumber} · ${collectible.name}`,
      group: collectible.classification.scope === 'expansion' ? 'Expansion Pass' : 'Music CDs',
      contentScope: collectible.classification.scope,
    })),
  ].sort((left, right) =>
    `${left.group}:${left.label}`.localeCompare(`${right.group}:${right.label}`),
  );
  return (
    <main>
      <PageIntro eyebrow="Planner 5.5" title="Varios objetivos, un solo plan">
        <p>
          Combina dependencias, inventario y bloqueos sin inventar batches, tiempos ni throughput.
          El resultado distingue acciones, confirmaciones y mediciones pendientes.
        </p>
      </PageIntro>
      <MultiGoalPlanner
        goalOptions={goalOptions}
        townOptions={data.listTowns().map((town) => ({ slug: town.slug, label: town.name }))}
        automationOptions={data.listAutomationSystems().map((system) => ({
          slug: system.slug,
          label: system.name,
        }))}
      />
    </main>
  );
}
