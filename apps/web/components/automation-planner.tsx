'use client';

import { useState, useSyncExternalStore } from 'react';
import type { AutomationSystem, RoleSlug } from '@pokopia/game-data';
import { planAutomation, type AutomationTownTarget } from '@pokopia/intelligence';
import {
  EMPTY_PROGRESS_SERIALIZED,
  parseProgress,
  progressId,
  readProgressSnapshot,
  subscribeProgress,
  writeProgress,
} from '@/lib/progress-store';
import { InventoryQuantityControl } from '@/components/progress-actions';

export function AutomationPlanner({
  systems,
  towns,
  pokemonRoles,
}: {
  systems: readonly AutomationSystem[];
  towns: readonly AutomationTownTarget[];
  pokemonRoles: Readonly<Record<string, readonly RoleSlug[]>>;
}) {
  const [systemSlug, setSystemSlug] = useState(systems[0]?.slug ?? '');
  const [townSlug, setTownSlug] = useState(towns[0]?.slug ?? '');
  const snapshot = useSyncExternalStore(
    subscribeProgress,
    readProgressSnapshot,
    () => EMPTY_PROGRESS_SERIALIZED,
  );
  const progress = parseProgress(snapshot);
  const system = systems.find((entry) => entry.slug === systemSlug);
  const town = towns.find((entry) => entry.slug === townSlug);
  if (!system || !town) return null;
  const ownedItems = Object.entries(progress.inventory)
    .filter(([, entry]) => entry.ownership === 'owned')
    .map(([slug]) => slug);
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
  const residentRoles = (progress.townResidents[town.slug] ?? []).flatMap(
    (slug) => pokemonRoles[slug] ?? [],
  );
  const levelValue = progress.entries[`town:${town.slug}:level`]?.value;
  const townLevel = typeof levelValue === 'number' ? levelValue : null;
  const plan = planAutomation(system, town, {
    ownedItemSlugs: ownedItems,
    residentRoles,
    townLevel,
    inventory,
    infrastructure: Object.fromEntries(
      Object.entries(progress.townInfrastructure[town.slug] ?? {}).map(([slug, state]) => [
        slug,
        state === 'confirmed' ? 'yes' : state === 'missing' ? 'no' : 'unknown',
      ]),
    ),
    built: progress.entries[progressId('automation', system.slug)]
      ? progress.entries[progressId('automation', system.slug)]?.value === true
        ? 'yes'
        : 'no'
      : 'unknown',
  });
  const builtId = progressId('automation', system.slug);
  const built = progress.entries[builtId]?.value === true;
  const toggleBuilt = () => {
    const entries = { ...progress.entries };
    if (built) delete entries[builtId];
    else
      entries[builtId] = { state: 'confirmed', value: true, updatedAt: new Date().toISOString() };
    writeProgress({ ...progress, entries });
  };
  const setInfrastructure = (label: string, state: 'confirmed' | 'missing' | 'unknown') => {
    const slug = label
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('en')
      .replace(/[^a-z0-9]+/g, '-');
    writeProgress({
      ...progress,
      townInfrastructure: {
        ...progress.townInfrastructure,
        [town.slug]: { ...progress.townInfrastructure[town.slug], [slug]: state },
      },
    });
  };
  return (
    <section className="planner card">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">Automation Planner V3</p>
          <h2>Planifica un sistema para tu pueblo</h2>
        </div>
      </div>
      <div className="planner-controls">
        <label>
          <span>Sistema</span>
          <select value={systemSlug} onChange={(event) => setSystemSlug(event.target.value)}>
            {systems.map((entry) => (
              <option value={entry.slug} key={entry.slug}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Pueblo</span>
          <select value={townSlug} onChange={(event) => setTownSlug(event.target.value)}>
            {towns.map((entry) => (
              <option value={entry.slug} key={entry.slug}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className={built ? 'button button-secondary' : 'button'}
          type="button"
          onClick={toggleBuilt}
        >
          {built ? 'Built ✓' : 'Marcar Built'}
        </button>
      </div>
      <div className="score-strip">
        <span>Construcción · {readinessLabel(plan.buildReadiness.state)}</span>
        <span>Operación · {readinessLabel(plan.operationalReadiness.state)}</span>
        <span>
          Parámetros utilizables · {plan.evaluation.measurements.length || 'ninguno documentado'}
        </span>
        <span>Throughput · no disponible</span>
      </div>
      {plan.evaluation.measurements.length ? (
        <div className="compact-list" aria-label="Parámetros cuantitativos aceptados">
          {plan.evaluation.measurements.map((parameter) => (
            <span key={parameter.sourceParameterId ?? `${parameter.metric}:${parameter.value}`}>
              {metricLabel(parameter.metric)} · {parameter.value} {unitLabel(parameter.unit)}
              {parameter.qualifier ? ` · ${qualifierLabel(parameter.qualifier)}` : ''}
            </span>
          ))}
        </div>
      ) : (
        <p className="unknown-state">Este sistema sigue en modo estructural.</p>
      )}
      <div className="grid grid-wide">
        <div>
          <h3>Materiales de construcción</h3>
          <div className="compact-list">
            {system.requirements.map((requirement) => (
              <InventoryQuantityControl
                key={requirement.slug}
                slug={requirement.slug}
                name={`${requirement.name} (necesita ${requirement.quantity ?? '?'})`}
              />
            ))}
          </div>
        </div>
        <div>
          <h3>Infraestructura del pueblo</h3>
          {(system.infrastructure ?? []).length ? (
            (system.infrastructure ?? []).map((label) => (
              <div className="infrastructure-state" key={label}>
                <strong>{label}</strong>
                <div className="tri-state-actions" aria-label={`Estado de ${label}`}>
                  <button type="button" onClick={() => setInfrastructure(label, 'confirmed')}>
                    ✓
                  </button>
                  <button type="button" onClick={() => setInfrastructure(label, 'missing')}>
                    No
                  </button>
                  <button type="button" onClick={() => setInfrastructure(label, 'unknown')}>
                    ?
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p>La fuente no registra infraestructura obligatoria.</p>
          )}
        </div>
      </div>
      <div className="grid grid-wide readiness-details">
        <ReadinessDetails title="Por qué puedo o no construirlo" result={plan.buildReadiness} />
        <ReadinessDetails title="Por qué puede o no operar" result={plan.operationalReadiness} />
      </div>
      <details className="advanced-details">
        <summary>Ver orden recomendado, unknowns y traza</summary>
        <ol className="plain-list">
          {plan.recommendedSequence.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <ul className="plain-list">
          {plan.unknowns.map((unknown) => (
            <li key={unknown}>{unknown}</li>
          ))}
        </ul>
        <p>{plan.evaluation.trace.reason}</p>
      </details>
      <p className="unknown-state">
        Outputs de efecto: {plan.evaluation.effects.join(' · ') || 'unknown'}. Inputs, efectos y
        materiales no se intercambian. Los parámetros exactos visibles proceden de assertions
        aceptadas; no se calculan items/min sin duración y rendimiento aceptados.
      </p>
    </section>
  );
}

function readinessLabel(state: 'yes' | 'no' | 'unknown') {
  return state === 'yes' ? 'Ready' : state === 'no' ? 'Blocked' : 'Needs verification';
}

function metricLabel(metric: string): string {
  return (
    {
      duration: 'Tiempo',
      yield: 'Generación',
      consumption: 'Consumo',
      range: 'Alcance',
      capacity: 'Capacidad',
    }[metric] ?? textLabel(metric)
  );
}

function unitLabel(unit: string | null): string {
  if (unit === null) return 'unidad desconocida';
  return (
    {
      power_unit: 'unidades de energía',
      item_per_minute: 'objetos/min',
      item_per_second: 'objetos/s',
      hour: 'hora',
      block: 'bloques',
      tile: 'casillas',
    }[unit] ?? textLabel(unit)
  );
}

function textLabel(value: string): string {
  return value.replaceAll('_', ' ').replaceAll(':', ' · ');
}

function qualifierLabel(value: string): string {
  return { high_altitude: 'gran altitud', standard: 'estándar' }[value] ?? textLabel(value);
}

function ReadinessDetails({
  title,
  result,
}: {
  title: string;
  result: ReturnType<typeof planAutomation>['buildReadiness'];
}) {
  return (
    <div>
      <h3>{title}</h3>
      <ul className="plain-list">
        {result.requirements.map((requirement) => (
          <li key={requirement.id}>
            <strong>
              {requirement.state === 'yes' ? '✓' : requirement.state === 'no' ? '✕' : '?'}
            </strong>{' '}
            {requirement.label}: {requirement.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
