import { notFound } from 'next/navigation';
import { Badge, Card, PageIntro, SourceNote } from '@pokopia/ui';
import { repository } from '@/lib/data';
import Link from 'next/link';
import { TownLevelControl } from '@/components/progress-actions';
import { TownOptimizer } from '@/components/town-optimizer';

type Props = { params: Promise<{ slug: string }> };

export default async function TownPage({ params }: Props) {
  const { slug } = await params;
  const data = await repository();
  const town = data.getTown(slug);
  if (!town) notFound();
  const pokemonByName = new Map(data.listPokemon(10_000).map((entry) => [entry.name, entry]));
  return (
    <main>
      <Link className="back-link" href="/towns">
        ← Volver a pueblos
      </Link>
      <PageIntro eyebrow="Pueblo / zona" title={town.name}>
        <p>{town.description ?? 'La fuente actual no incluye una descripción.'}</p>
      </PageIntro>
      {town.maxEnvironmentLevel ? (
        <Card className="level-card">
          <Badge tone="accent">Environment Level</Badge>
          <TownLevelControl
            slug={town.slug}
            name={town.name}
            maxLevel={town.maxEnvironmentLevel}
            unlocks={town.unlocks}
          />
        </Card>
      ) : null}
      <TownOptimizer
        town={town}
        pokemon={data.listPokemon(10_000).map(({ slug, name, roles }) => ({
          slug,
          name,
          roles: roles.map(({ role, evidence }) => ({ role, evidence })),
        }))}
        compatibleAutomation={data
          .listAutomationSystems()
          .filter((system) => system.compatibleTowns.includes(town.name))}
      />
      <div className="grid grid-wide">
        <Card>
          <Badge tone="accent">Pokémon exclusivos documentados</Badge>
          <h2>{town.exclusivePokemon.length} exclusivos registrados</h2>
          {town.exclusivePokemon.length ? (
            <div className="chip-list">
              {town.exclusivePokemon.map((name) => {
                const pokemon = pokemonByName.get(name);
                return pokemon ? (
                  <Link className="chip" href={`/pokemon/${pokemon.slug}`} key={name}>
                    {name}
                  </Link>
                ) : (
                  <span className="chip" key={name}>
                    {name}
                  </span>
                );
              })}
            </div>
          ) : (
            <p>
              La tabla de esta zona no registra Pokémon exclusivos; no significa que no haya
              Pokémon.
            </p>
          )}
        </Card>
        <Card>
          <Badge>Recursos</Badge>
          <h2>Materiales naturales</h2>
          <div className="chip-list">
            {town.resources.map((resource) => (
              <span className="chip" key={resource}>
                {resource}
              </span>
            ))}
          </div>
        </Card>
        <Card>
          <Badge>Facilities</Badge>
          <h2>Infraestructura y hallazgos</h2>
          <div className="chip-list">
            {town.facilities.slice(0, 18).map((facility) => (
              <span className="chip" key={facility}>
                {facility}
              </span>
            ))}
          </div>
          {town.facilities.length > 18 ? (
            <details className="advanced-details">
              <summary>Ver {town.facilities.length - 18} entradas adicionales</summary>
              <div className="chip-list">
                {town.facilities.slice(18).map((facility) => (
                  <span className="chip" key={facility}>
                    {facility}
                  </span>
                ))}
              </div>
            </details>
          ) : null}
        </Card>
        <Card>
          <Badge>Farming & building</Badge>
          <h2>Plantas y bloques</h2>
          <div className="chip-list collapsed-chips">
            {town.plantsAndBlocks.slice(0, 18).map((entry) => (
              <span className="chip" key={entry}>
                {entry}
              </span>
            ))}
          </div>
          {town.plantsAndBlocks.length > 18 ? (
            <details className="advanced-details">
              <summary>Ver {town.plantsAndBlocks.length - 18} entradas adicionales</summary>
              <div className="chip-list">
                {town.plantsAndBlocks.slice(18).map((entry) => (
                  <span className="chip" key={entry}>
                    {entry}
                  </span>
                ))}
              </div>
            </details>
          ) : null}
        </Card>
      </div>
      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Progression</p>
            <h2>Desbloqueos por nivel</h2>
          </div>
          <p>{town.unlocks.length} entradas estructuradas</p>
        </div>
        <div className="unlock-timeline">
          {Array.from(new Set(town.unlocks.map((unlock) => unlock.level))).map((level) => (
            <Card key={level}>
              <Badge>Lv. {level}</Badge>
              <div className="compact-list">
                {town.unlocks
                  .filter((unlock) => unlock.level === level)
                  .map((unlock) => (
                    <span key={`${unlock.kind}:${unlock.name}`}>
                      {unlock.name} <small>{unlock.kind}</small>
                    </span>
                  ))}
              </div>
            </Card>
          ))}
        </div>
      </section>
      <SourceNote
        url={town.source.url}
        snapshot={town.source.snapshot}
        status={town.source.verificationStatus}
      />
    </main>
  );
}
