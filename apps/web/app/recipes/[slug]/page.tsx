import { notFound } from 'next/navigation';
import { PageIntro, SourceNote } from '@pokopia/ui';
import { repository } from '@/lib/data';
import Link from 'next/link';
import { GoalAction, ProgressAction } from '@/components/progress-actions';
import { CraftingPlanner } from '@/components/crafting-planner';
import { firstParam, type SearchParamValue } from '@/lib/search-params';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ quantity?: SearchParamValue }>;
};

export default async function RecipePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const requested = Math.min(
    999,
    Math.max(1, Math.floor(Number(firstParam((await searchParams).quantity))) || 1),
  );
  const data = await repository();
  const recipe = data.getRecipe(slug);
  if (!recipe) notFound();
  return (
    <main>
      <Link className="back-link" href="/recipes">
        ← Volver a recetas
      </Link>
      <PageIntro eyebrow="Receta" title={recipe.name}>
        <p>
          {recipe.unlock ? `Desbloqueo: ${recipe.unlock}` : 'Requisito de desbloqueo desconocido.'}
        </p>
        <div className="action-row">
          <ProgressAction
            kind="recipe"
            slug={recipe.slug}
            inactiveLabel="Marcar Unlocked"
            activeLabel="Unlocked"
          />
          <GoalAction type="craft-item" slug={recipe.slug} label={`Craft ${recipe.name}`} />
        </div>
      </PageIntro>
      <form className="craft-quantity card" method="get">
        <label htmlFor="quantity">¿Cuántas copias quieres fabricar?</label>
        <div>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            max={999}
            defaultValue={requested}
          />
          <button type="submit">Calcular</button>
        </div>
        <small>
          La fuente no confirma el batch de salida. El motor mantiene ese valor como unknown y no
          fabrica un total exacto para varias copias.
        </small>
      </form>
      <CraftingPlanner recipes={data.listRecipes(10_000)} target={recipe} requested={requested} />
      <SourceNote
        url={recipe.source.url}
        snapshot={recipe.source.snapshot}
        status={recipe.source.verificationStatus}
      />
    </main>
  );
}
