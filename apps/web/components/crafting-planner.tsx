'use client';

import { useSyncExternalStore } from 'react';
import type { RecipeSummary } from '@pokopia/game-data';
import { calculateCraftPlan, CraftingCycleError } from '@pokopia/rules';
import { Badge, Card } from '@pokopia/ui';
import { InventoryQuantityControl } from '@/components/progress-actions';
import {
  EMPTY_PROGRESS_SERIALIZED,
  parseProgress,
  readProgressSnapshot,
  subscribeProgress,
} from '@/lib/progress-store';

export function CraftingPlanner({
  recipes,
  target,
  requested,
}: {
  recipes: readonly RecipeSummary[];
  target: RecipeSummary;
  requested: number;
}) {
  const snapshot = useSyncExternalStore(
    subscribeProgress,
    readProgressSnapshot,
    () => EMPTY_PROGRESS_SERIALIZED,
  );
  const progress = parseProgress(snapshot);
  const inventory = Object.fromEntries(
    Object.entries(progress.inventory).map(([slug, entry]) => [
      slug,
      {
        ownership:
          entry.ownership === 'owned'
            ? ('yes' as const)
            : entry.ownership === 'not_owned'
              ? ('no' as const)
              : ('unknown' as const),
        quantity: entry.quantity,
      },
    ]),
  );
  let plan: ReturnType<typeof calculateCraftPlan> | null = null;
  let error: string | null = null;
  try {
    plan = calculateCraftPlan(recipes, target.slug, requested, { inventory });
  } catch (cause) {
    error =
      cause instanceof CraftingCycleError
        ? `Ciclo detenido: ${cause.cycle.join(' → ')}`
        : 'No se pudo evaluar el grafo de forma segura.';
  }
  if (!plan)
    return (
      <Card>
        <Badge tone="warn">Blocked</Badge>
        <p>{error}</p>
      </Card>
    );
  return (
    <section className="crafting-planner" aria-live="polite">
      <div className="score-strip">
        <span>Plan · {statusLabel(plan.status)}</span>
        <span>Fabricaciones · {plan.crafts ?? 'unknown'}</span>
        <span>
          Batch de salida ·{' '}
          {target.outputQuantity !== null &&
          ['source_backed', 'accepted_measurement'].includes(target.outputQuantityStatus)
            ? target.outputQuantity
            : 'unknown'}
        </span>
      </div>
      <div className="grid grid-wide">
        <Card>
          <Badge tone="accent">Inventario</Badge>
          <h2>Confirma solo lo que sabes</h2>
          {plan.requirements.length
            ? plan.requirements.map((requirement) => (
                <InventoryQuantityControl
                  key={requirement.slug}
                  slug={requirement.slug}
                  name={requirement.name}
                />
              ))
            : target.ingredients.map((ingredient) => (
                <InventoryQuantityControl
                  key={ingredient.slug}
                  slug={ingredient.slug}
                  name={ingredient.name}
                />
              ))}
        </Card>
        <Card>
          <Badge>Materiales base</Badge>
          <h2>Necesidad máxima conocida</h2>
          {plan.baseMaterials.length ? (
            <div className="compact-list">
              {plan.baseMaterials.map((material) => (
                <span key={material.slug}>
                  {material.name} <strong>× {material.quantity}</strong>
                </span>
              ))}
            </div>
          ) : (
            <p>No hay materiales base pendientes con cantidad exacta.</p>
          )}
        </Card>
        <Card>
          <Badge>Subrecetas y excedente</Badge>
          <h2>Grafo recursivo</h2>
          <div className="compact-list">
            {plan.craftedDependencies.map((dependency) => (
              <span key={dependency.slug}>
                {dependency.name} <strong>× {dependency.quantity}</strong>
              </span>
            ))}
            {plan.surplus.map((item) => (
              <span key={`surplus:${item.slug}`}>
                Excedente {item.name} <strong>× {item.quantity}</strong>
              </span>
            ))}
          </div>
          {!plan.craftedDependencies.length && !plan.surplus.length ? (
            <p>Sin total recursivo exacto.</p>
          ) : null}
        </Card>
      </div>
      {plan.unknownQuantities.length || plan.unknownInventory.length ? (
        <Card>
          <Badge tone="warn">Needs verification</Badge>
          <h2>Por qué el plan no es exacto</h2>
          <ul className="plain-list">
            {[
              ...plan.unknownQuantities,
              ...plan.unknownInventory.map((name) => `${name}: cantidad en My Pokopia`),
            ].map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Card>
      ) : null}
      <details className="advanced-details">
        <summary>Ver traza de evaluación</summary>
        <p>{plan.trace.reason}</p>
        <code>
          {plan.trace.ruleId}@{plan.trace.ruleVersion}
        </code>
      </details>
    </section>
  );
}

function statusLabel(status: ReturnType<typeof calculateCraftPlan>['status']) {
  if (status === 'ready') return 'Ready';
  if (status === 'blocked') return 'Blocked';
  if (status === 'choice_required') return 'Choose a recipe';
  return 'Needs verification';
}
