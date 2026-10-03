import { notFound } from 'next/navigation';
import { Badge, Card, DefinitionList, PageIntro, SourceNote } from '@pokopia/ui';
import { knowledgeGraph, repository } from '@/lib/data';
import Link from 'next/link';
import {
  GoalAction,
  InventoryQuantityControl,
  ProgressAction,
} from '@/components/progress-actions';
import { EntityActivity } from '@/components/entity-activity';
import { RelationshipPanel } from '@/components/relationship-panel';

type Props = { params: Promise<{ slug: string }> };

export default async function ItemPage({ params }: Props) {
  const { slug } = await params;
  const item = (await repository()).getItem(slug);
  if (!item) notFound();
  const graph = await knowledgeGraph();
  const entity = graph.resolve('item', item.slug);
  return (
    <main>
      <Link className="back-link" href="/items">
        ← Volver a objetos
      </Link>
      <PageIntro eyebrow={item.category ?? 'Objeto'} title={item.name}>
        <p>{item.description ?? 'La descripción no está disponible en la fuente actual.'}</p>
        <div className="action-row">
          <ProgressAction
            kind="item"
            slug={item.slug}
            inactiveLabel="Marcar Acquired"
            activeLabel="Acquired"
          />
          <GoalAction type="get-item" slug={item.slug} label={`Conseguir ${item.name}`} />
          <EntityActivity kind="item" slug={item.slug} label={item.name} />
        </div>
      </PageIntro>
      <section className="card inventory-focus">
        <p className="eyebrow">My Pokopia V5</p>
        <h2>Inventario</h2>
        <InventoryQuantityControl slug={item.slug} name={item.name} />
      </section>
      <DefinitionList
        entries={[
          { label: 'Categoría', value: item.category ?? 'Sin confirmar' },
          {
            label: 'Craftable',
            value: item.craftable === null ? 'Sin confirmar' : item.craftable ? 'Sí' : 'No',
          },
          {
            label: 'Furniture',
            value: item.isFurniture === null ? 'Sin confirmar' : item.isFurniture ? 'Sí' : 'No',
          },
          {
            label: 'DLC',
            value:
              item.dlc === null ? 'Sin confirmar' : item.dlc ? 'Expansion Pass' : 'No detectado',
          },
          { label: '3D Print', value: item.printCost ?? 'Sin confirmar' },
        ]}
      />
      <div className="grid grid-wide">
        <Card>
          <Badge tone="accent">Cómo conseguirlo</Badge>
          <h2>Localizaciones registradas</h2>
          {item.locationEntries.length ? (
            <div className="chip-list">
              {item.locationEntries.map((location) => (
                <span className="chip" key={location}>
                  {location}
                </span>
              ))}
            </div>
          ) : (
            <p>Todavía no hay una localización estructurada.</p>
          )}
        </Card>
        <Card>
          <Badge>Receta</Badge>
          <h2>{item.recipe ? 'Receta vinculada' : 'No vinculada'}</h2>
          {item.recipe ? (
            <>
              <p>{item.recipe.unlock ?? 'Desbloqueo sin confirmar'}</p>
              <div className="compact-list">
                {item.recipe.ingredients.map((ingredient) => (
                  <span key={ingredient.slug}>
                    {ingredient.name} × {ingredient.quantity ?? '?'}
                  </span>
                ))}
              </div>
              <Link className="button" href={`/recipes/${item.recipe.slug}`}>
                Calcular materiales
              </Link>
            </>
          ) : (
            <p>La ausencia de vínculo no confirma que no exista una receta.</p>
          )}
        </Card>
        {item.storage ? (
          <Card>
            <Badge tone="accent">Storage</Badge>
            <h2>
              {item.storage.type === 'shared'
                ? 'Almacenamiento compartido'
                : 'Almacenamiento local'}
            </h2>
            <DefinitionList
              entries={[
                { label: 'Tipo', value: item.storage.type },
                { label: 'Capacidad', value: item.storage.capacity ?? 'Desconocida' },
                { label: 'Evidencia', value: item.storage.evidence ?? 'Sin confirmar' },
              ]}
            />
          </Card>
        ) : null}
        <Card>
          <Badge tone={item.useCases.length ? 'good' : 'warn'}>Usos</Badge>
          <h2>Para qué sirve</h2>
          {item.useCases.length ? (
            <ul className="plain-list">
              {item.useCases.map((use) => (
                <li key={use}>{use}</li>
              ))}
            </ul>
          ) : (
            <p>No hay casos de uso derivados con suficiente evidencia.</p>
          )}
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
        url={item.source.url}
        snapshot={item.source.snapshot}
        status={item.source.verificationStatus}
      />
    </main>
  );
}
