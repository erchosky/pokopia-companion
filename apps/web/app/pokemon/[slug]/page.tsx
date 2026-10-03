import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Badge, Card, DefinitionList, PageIntro, SourceNote } from '@pokopia/ui';
import { knowledgeGraph, repository } from '@/lib/data';
import Link from 'next/link';
import { humanizeGameValue } from '@/lib/presentation';
import { ProgressAction } from '@/components/progress-actions';
import { EntityActivity } from '@/components/entity-activity';
import { RelationshipPanel } from '@/components/relationship-panel';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = (await repository()).getPokemon(slug);
  return { title: entry?.name ?? 'Pokémon' };
}
export default async function PokemonDetailPage({ params }: Props) {
  const { slug } = await params;
  const entry = (await repository()).getPokemon(slug);
  if (!entry) notFound();
  const graph = await knowledgeGraph();
  const entity = graph.resolve('pokemon', entry.slug);
  return (
    <main>
      <Link className="back-link" href="/pokemon">
        ← Volver a la Pokédex
      </Link>
      <PageIntro eyebrow={entry.number ? `Pokédex #${entry.number}` : 'Pokédex'} title={entry.name}>
        <p>Consulta sus habilidades, preferencias y los datos disponibles sobre este Pokémon.</p>
        <ProgressAction
          kind="pokemon"
          slug={entry.slug}
          inactiveLabel="Marcar Owned"
          activeLabel="Owned"
        />
        <EntityActivity kind="pokemon" slug={entry.slug} label={entry.name} />
      </PageIntro>
      <DefinitionList
        entries={[
          { label: 'Especialidad', value: humanizeGameValue(entry.specialty) },
          { label: 'Hábitat ideal', value: humanizeGameValue(entry.habitat) },
          { label: 'Clasificación', value: humanizeGameValue(entry.classification) },
          {
            label: 'Puede bucear',
            value: entry.canDive === null ? 'Sin confirmar' : entry.canDive ? 'Sí' : 'No',
          },
          { label: 'Altura', value: humanizeGameValue(entry.height) },
          { label: 'Peso', value: humanizeGameValue(entry.weight) },
        ]}
      />
      <div className="grid grid-wide">
        <Card>
          <Badge tone="accent">Roles derivados</Badge>
          <h2>Para qué puede encajar</h2>
          {entry.roles.length ? (
            <div className="evidence-list">
              {entry.roles.map((role) => (
                <div key={role.role}>
                  <strong>{humanizeGameValue(role.role)}</strong>
                  <span>
                    {role.confidence >= 0.8
                      ? 'Probable'
                      : role.confidence >= 0.55
                        ? 'Necesita revisión'
                        : 'Necesita pruebas'}
                  </span>
                  <small>
                    {role.evidence} · {role.derivationMethod}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <p>Evidencia insuficiente para asignar roles.</p>
          )}
        </Card>
        <Card>
          <Badge tone="accent">Relaciones</Badge>
          <h2>Localizaciones</h2>
          {entry.locations.length ? (
            <div className="chip-list">
              {entry.locations.map((location) => (
                <span className="chip" key={location}>
                  {location}
                </span>
              ))}
            </div>
          ) : (
            <p>Aún no hay una localización confirmada en los datos disponibles.</p>
          )}
        </Card>
        <Card>
          <Badge>Hábitats de aparición</Badge>
          <h2>Entornos compatibles</h2>
          {entry.habitatTypes.length ? (
            <div className="chip-list">
              {entry.habitatTypes.map((habitat) => (
                <span className="chip" key={habitat}>
                  {habitat}
                </span>
              ))}
            </div>
          ) : (
            <p>Sin datos estructurados.</p>
          )}
        </Card>
        <Card>
          <Badge>Preferencias</Badge>
          <h2>Favoritos</h2>
          {entry.favorites.length ? (
            <div className="chip-list">
              {entry.favorites.map((favorite) => (
                <span className="chip" key={favorite}>
                  {humanizeGameValue(favorite)}
                </span>
              ))}
            </div>
          ) : (
            <p>Preferencias todavía sin confirmar.</p>
          )}
        </Card>
        <Card>
          <Badge tone="warn">Recomendación</Badge>
          <h2>¿Dónde encaja?</h2>
          <p>
            Consulta un ranking contextual. La puntuación se deriva de la especialidad y siempre
            explica sus pesos.
          </p>
          <Link
            className="button"
            href={`/best-pokemon/${encodeURIComponent(entry.specialty?.toLowerCase() ?? 'utility')}`}
          >
            Comparar para esta tarea
          </Link>
        </Card>
      </div>
      {entity ? (
        <RelationshipPanel
          entity={entity}
          relationships={graph.getRelations(entity)}
          alternatives={graph.getAlternatives(entity)}
        />
      ) : null}
      <SourceNote
        url={entry.source.url}
        snapshot={entry.source.snapshot}
        status={entry.source.verificationStatus}
      />
    </main>
  );
}
