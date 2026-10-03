import { PageIntro } from '@pokopia/ui';
import { repository } from '@/lib/data';
import { PokemonExplorer } from '@/components/pokemon-explorer';
export const metadata = { title: 'Pokédex' };
export default async function PokemonPage() {
  const entries = (await repository())
    .listPokemon(10_000)
    .map(({ slug, name, number, specialty, habitat, roles }) => ({
      slug,
      name,
      number,
      specialty,
      habitat,
      roles: roles.map((assignment) => assignment.role),
    }));
  return (
    <main>
      <PageIntro eyebrow="Pokédex" title="Pokémon">
        <p>Explora especialidades y hábitats para encontrar quién encaja mejor en cada tarea.</p>
      </PageIntro>
      <PokemonExplorer entries={entries} />
    </main>
  );
}
