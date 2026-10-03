'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import type {
  ContentMode,
  PlanAction,
  PlanConstraint,
  PlannerGoal,
  PlannerPreference,
  PlanResult,
  ScenarioComparisonResult,
} from '@pokopia/planner';
import {
  EMPTY_PROGRESS_SERIALIZED,
  parseProgress,
  readProgressSnapshot,
  setInventoryEntry,
  subscribeProgress,
  writeProgress,
  type PokopiaProgress,
} from '@/lib/progress-store';
import {
  markPlanAction,
  parsePlannerStore,
  plannerStoreSnapshot,
  savePlan,
  saveScenario,
  subscribePlannerStore,
} from '@/lib/planner-store';

type GoalOption = {
  readonly type: PlannerGoal['type'];
  readonly slug: string;
  readonly label: string;
  readonly group: string;
  readonly contentScope?: PlannerGoal['contentScope'];
};

interface PlannerResponse {
  readonly plan: PlanResult;
  readonly simulation: {
    readonly status: 'yes' | 'no' | 'unknown';
    readonly changed: readonly string[];
    readonly unknowns: readonly string[];
  } | null;
  readonly scenarioComparison: ScenarioComparisonResult | null;
  readonly stateRevision: string;
  readonly dataVersion: string;
}

const FILTERS = [
  'all',
  'ready',
  'blocked',
  'unknown',
  'shared',
  'gameplay',
  'confirmation',
  'measurement',
] as const;

export function MultiGoalPlanner({
  goalOptions,
  townOptions,
  automationOptions,
}: {
  readonly goalOptions: readonly GoalOption[];
  readonly townOptions: readonly { readonly slug: string; readonly label: string }[];
  readonly automationOptions: readonly { readonly slug: string; readonly label: string }[];
}) {
  const progressSnapshot = useSyncExternalStore(
    subscribeProgress,
    readProgressSnapshot,
    () => EMPTY_PROGRESS_SERIALIZED,
  );
  const progress = parseProgress(progressSnapshot);
  const plannerSnapshot = useSyncExternalStore(
    subscribePlannerStore,
    plannerStoreSnapshot,
    () => '{"version":1,"plans":[],"scenarios":[]}',
  );
  const localPlanner = parsePlannerStore(plannerSnapshot);
  const defaults = useMemo(
    () =>
      ['antique-chandelier', 'antique-clock']
        .map((slug) => goalOptions.find((option) => option.slug === slug))
        .filter((option): option is GoalOption => Boolean(option))
        .map(asGoal),
    [goalOptions],
  );
  const [selectedGoals, setSelectedGoals] = useState<readonly PlannerGoal[]>(defaults);
  const [candidate, setCandidate] = useState(goalOptions[0] ? optionId(goalOptions[0]) : '');
  const [contentMode, setContentMode] = useState<ContentMode>('all');
  const [selectedTown, setSelectedTown] = useState<string>('');
  const [gameVersion, setGameVersion] = useState('');
  const [pinnedActionIds, setPinnedActionIds] = useState<readonly string[]>([]);
  const [preference, setPreference] = useState<PlannerPreference | 'conservative'>('conservative');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [response, setResponse] = useState<PlannerResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [confirmations, setConfirmations] = useState<Readonly<Record<string, string>>>({});
  const [scenarioSystem, setScenarioSystem] = useState(automationOptions[0]?.slug ?? '');
  const [comparisonSystem, setComparisonSystem] = useState(automationOptions[1]?.slug ?? '');
  const [planName, setPlanName] = useState('Mi plan Pokopia');

  const allOptions = useMemo(() => {
    const progressOptions = progress.goals.map((goal) => ({
      type: goal.type,
      slug: goal.slug,
      label: goal.label,
      group: 'My Pokopia',
      contentScope: undefined,
    }));
    const map = new Map(
      [...progressOptions, ...goalOptions].map((option) => [optionId(option), option]),
    );
    return [...map.values()];
  }, [goalOptions, progress.goals]);

  const constraints: PlanConstraint = {
    contentMode,
    selectedTown: selectedTown || null,
    inventoryReserves: {},
    pinnedActionIds,
  };
  const preferences: readonly PlannerPreference[] =
    preference === 'conservative' ? [] : [preference];

  const generate = async (
    currentProgress: PokopiaProgress = progress,
    scenarioAction: { readonly kind: 'build'; readonly systemSlug: string } | null = null,
    scenarioComparison:
      | readonly [
          { readonly kind: 'build'; readonly systemSlug: string },
          { readonly kind: 'build'; readonly systemSlug: string },
        ]
      | null = null,
  ) => {
    if (!selectedGoals.length) return;
    setStatus('loading');
    try {
      const request = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          goals: selectedGoals,
          entries: currentProgress.entries,
          inventory: currentProgress.inventory,
          constraints,
          preferences,
          gameVersion: gameVersion.trim() || null,
          townInfrastructure: currentProgress.townInfrastructure,
          scenarioAction,
          scenarioComparison,
        }),
      });
      if (!request.ok) throw new Error(`Planner failed: ${request.status}`);
      setResponse((await request.json()) as PlannerResponse);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  const addGoal = () => {
    const option = allOptions.find((entry) => optionId(entry) === candidate);
    if (
      !option ||
      selectedGoals.some((goal) => goal.type === option.type && goal.slug === option.slug)
    )
      return;
    setSelectedGoals([...selectedGoals, asGoal(option)].slice(0, 20));
    setResponse(null);
  };

  const confirmQuantity = async (action: PlanAction) => {
    const slug = action.subjectId.split(':').slice(1).join(':');
    const value = Number(confirmations[action.id]);
    if (!Number.isSafeInteger(value) || value < 0) return;
    const updated = setInventoryEntry(progress, slug, {
      ownership: value > 0 ? 'owned' : 'not_owned',
      quantityState: 'confirmed',
      quantity: value,
    });
    writeProgress(updated);
    await generate(updated);
  };

  const markGameplayDone = async (action: PlanAction) => {
    const slug = action.subjectId.split(':').slice(1).join(':');
    const updated = action.subjectId.startsWith('item:')
      ? setInventoryEntry(progress, slug, {
          ownership: 'owned',
          quantityState: 'unknown',
          quantity: null,
        })
      : {
          ...progress,
          entries: {
            ...progress.entries,
            [action.subjectId]: {
              state: 'confirmed' as const,
              value: true,
              updatedAt: new Date().toISOString(),
            },
          },
        };
    writeProgress(updated);
    await generate(updated);
  };

  const visibleActions = (response?.plan.actions ?? []).filter((action) => {
    if (filter === 'all') return true;
    if (filter === 'ready') return action.dependsOn.length === 0;
    if (filter === 'shared') return action.unlocksGoals.length > 1;
    if (filter === 'gameplay' || filter === 'confirmation') return action.type === filter;
    if (filter === 'measurement') return action.kind === 'measurement_required';
    if (filter === 'unknown') return action.certainty === 'unknown';
    if (filter === 'blocked') return action.dependsOn.length > 0;
    return true;
  });

  const exportPlan = (format: 'json' | 'text') => {
    if (!response) return;
    const content =
      format === 'json'
        ? JSON.stringify(response.plan, null, 2)
        : [
            `Plan: ${selectedGoals.map((goal) => goal.label).join(', ')}`,
            `Estado: ${response.plan.completeness}`,
            `Siguiente: ${response.plan.nextActionReason}`,
            ...response.plan.actions.map(
              (action) => `- ${action.title}: ${action.whyNow} [${action.unlocksGoals.join(', ')}]`,
            ),
          ].join('\n');
    const url = URL.createObjectURL(
      new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `pokopia-plan.${format === 'json' ? 'json' : 'txt'}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="planner-shell">
      <section className="card planner-builder" aria-labelledby="planner-builder-title">
        <div className="section-heading compact-heading">
          <div>
            <p className="eyebrow">Tus objetivos</p>
            <h2 id="planner-builder-title">Construye el plan combinado</h2>
          </div>
          <span className="planner-count">{selectedGoals.length}/20</span>
        </div>
        <div className="planner-controls">
          <label>
            <span>Añadir objetivo</span>
            <select value={candidate} onChange={(event) => setCandidate(event.target.value)}>
              {allOptions.map((option) => (
                <option key={optionId(option)} value={optionId(option)}>
                  {option.group} · {option.label}
                </option>
              ))}
            </select>
          </label>
          <button className="button button-secondary" type="button" onClick={addGoal}>
            Añadir
          </button>
          <label>
            <span>Contenido</span>
            <select
              value={contentMode}
              onChange={(event) => setContentMode(event.target.value as ContentMode)}
            >
              <option value="all">Todo el contenido</option>
              <option value="base_only">Solo juego base</option>
              <option value="expansion_allowed">Expansión permitida</option>
            </select>
          </label>
          <label>
            <span>Pueblo actual</span>
            <select value={selectedTown} onChange={(event) => setSelectedTown(event.target.value)}>
              <option value="">Sin seleccionar</option>
              {townOptions.map((town) => (
                <option key={town.slug} value={town.slug}>
                  {town.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Versión del juego (opcional)</span>
            <input
              value={gameVersion}
              maxLength={80}
              placeholder="Ej. 1.2.0"
              onChange={(event) => setGameVersion(event.target.value)}
            />
          </label>
          <label>
            <span>Prioridad explícita</span>
            <select
              value={preference}
              onChange={(event) => setPreference(event.target.value as typeof preference)}
            >
              <option value="conservative">Política conservadora</option>
              <option value="prioritize_goals_unlocked">Desbloquear más objetivos</option>
              <option value="prioritize_certainty">Priorizar certeza</option>
              <option value="minimize_actions">Menos acciones conocidas</option>
              <option value="prefer_base_game">Preferir juego base</option>
            </select>
          </label>
        </div>
        <div className="goal-chip-list" aria-label="Objetivos seleccionados">
          {selectedGoals.map((goal) => (
            <button
              type="button"
              className="goal-chip"
              key={goal.id}
              onClick={() => {
                setSelectedGoals(selectedGoals.filter((entry) => entry.id !== goal.id));
                setResponse(null);
              }}
              aria-label={`Quitar ${goal.label}`}
            >
              {goal.label} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
        <button
          className="button"
          type="button"
          disabled={!selectedGoals.length || status === 'loading'}
          onClick={() => void generate()}
        >
          {status === 'loading' ? 'Combinando dependencias…' : 'Generar plan multiobjetivo'}
        </button>
        {status === 'error' ? (
          <p role="alert">No se pudo generar el plan. Inténtalo de nuevo.</p>
        ) : null}
      </section>

      {response ? (
        <div className="planner-results" aria-live="polite">
          {response.simulation ? (
            <section className="card scenario-banner">
              <p className="eyebrow">What-if · no modifica My Pokopia</p>
              <h2>Escenario hipotético</h2>
              <p>
                Resultado {response.simulation.status}. Cambios simulados:{' '}
                {response.simulation.changed.join(', ') || 'ninguno aplicable'}.
              </p>
            </section>
          ) : null}
          {response.scenarioComparison ? (
            <section className="card scenario-banner">
              <p className="eyebrow">Comparación what-if · dimensiones conocidas</p>
              <h2>{scenarioRelationLabel(response.scenarioComparison.relation)}</h2>
              <p>{response.scenarioComparison.reason}</p>
              <ul className="semantic-list">
                {response.scenarioComparison.dimensions.map((dimension) => (
                  <li key={dimension.id}>
                    <strong>{dimension.id}</strong>
                    <span>
                      Escenario A: {dimension.left} · Escenario B: {dimension.right}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="planner-summary" aria-labelledby="plan-summary-title">
            <div>
              <p className="eyebrow">Plan {response.plan.completeness}</p>
              <h2 id="plan-summary-title">Qué importa ahora</h2>
              <p>{response.plan.nextActionReason}</p>
            </div>
            <dl className="planner-metrics">
              <div>
                <dt>Objetivos</dt>
                <dd>{response.plan.goals.length}</dd>
              </div>
              <div>
                <dt>Compartidas</dt>
                <dd>{response.plan.sharedDependencies.length}</dd>
              </div>
              <div>
                <dt>Bloqueos</dt>
                <dd>{response.plan.blockers.length}</dd>
              </div>
              <div>
                <dt>Unknowns</dt>
                <dd>{response.plan.unknowns.length}</dd>
              </div>
            </dl>
          </section>

          {response.plan.sharedDependencies.length ? (
            <section className="card shared-callout">
              <p className="eyebrow">Dependencias compartidas</p>
              <div className="shared-grid">
                {response.plan.sharedDependencies.slice(0, 12).map((dependency) => (
                  <div key={dependency.nodeId}>
                    <strong>{dependency.label}</strong>
                    <p>Afecta a {dependency.goalIds.length} objetivos.</p>
                    <small>Dependencia compartida; excedente reutilizable exacto unknown.</small>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <div className="section-heading compact-heading">
              <div>
                <p className="eyebrow">Action Frontier</p>
                <h2>Próximas acciones válidas</h2>
              </div>
              <label className="inline-filter">
                <span>Filtrar</span>
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as typeof filter)}
                >
                  {FILTERS.map((value) => (
                    <option key={value} value={value}>
                      {filterLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="action-frontier">
              {visibleActions.slice(0, 30).map((action) => (
                <article
                  className="card planner-action"
                  key={action.id}
                  data-action-type={action.type}
                >
                  <div className="action-meta">
                    <span>{actionTypeLabel(action.type)}</span>
                    <span>{action.unlocksGoals.length} objetivo(s)</span>
                    <span>{action.certainty}</span>
                  </div>
                  <h3>{action.title}</h3>
                  <p>{action.whyNow}</p>
                  <details>
                    <summary>Por qué y consecuencias</summary>
                    <p>Elimina {action.removesBlockers.length} bloqueo(s).</p>
                    <p>
                      Objetivos: {action.unlocksGoals.join(', ')}. Alternativas equivalentes:{' '}
                      {action.equivalentTo.length || 'ninguna demostrada'}.
                    </p>
                  </details>
                  <button
                    className="button button-secondary"
                    type="button"
                    aria-pressed={pinnedActionIds.includes(action.id)}
                    onClick={() =>
                      setPinnedActionIds(
                        pinnedActionIds.includes(action.id)
                          ? pinnedActionIds.filter((id) => id !== action.id)
                          : [...pinnedActionIds, action.id].slice(0, 100),
                      )
                    }
                  >
                    {pinnedActionIds.includes(action.id)
                      ? 'Quitar fijación'
                      : 'Fijar para el próximo cálculo'}
                  </button>
                  {action.type === 'confirmation' &&
                  action.kind === 'confirm_inventory_quantity' ? (
                    <div className="confirm-row">
                      <label>
                        <span>Cantidad confirmada</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={confirmations[action.id] ?? ''}
                          onChange={(event) =>
                            setConfirmations({ ...confirmations, [action.id]: event.target.value })
                          }
                        />
                      </label>
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => void confirmQuantity(action)}
                      >
                        Guardar y recalcular
                      </button>
                    </div>
                  ) : null}
                  {action.type === 'gameplay' &&
                  ['build', 'craft', 'obtain', 'complete_request', 'unlock'].includes(
                    action.kind,
                  ) &&
                  action.id.startsWith('complete:') ? (
                    <details>
                      <summary>Aplicar acción completada</summary>
                      <p>
                        Se cambiará únicamente `{action.subjectId}` a confirmado. En inventario, la
                        cantidad seguirá unknown. No se inferirán materiales ni otros objetivos.
                      </p>
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => void markGameplayDone(action)}
                      >
                        Marcar acción como hecha y recalcular
                      </button>
                    </details>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="planner-two-column">
            <article className="card">
              <p className="eyebrow">Unknowns to confirm</p>
              <h2>Estado del jugador</h2>
              <ul className="semantic-list">
                {response.plan.blockers
                  .filter((entry) => entry.type === 'state')
                  .slice(0, 12)
                  .map((blocker) => (
                    <li key={blocker.id}>
                      <strong>{blocker.label}</strong>
                      <span>{blocker.reason}</span>
                    </li>
                  ))}
              </ul>
            </article>
            <article className="card">
              <p className="eyebrow">Blocked by game knowledge</p>
              <h2>Mediciones pendientes</h2>
              <ul className="semantic-list">
                {response.plan.blockers
                  .filter((entry) => entry.type === 'measurement' || entry.type === 'evidence')
                  .slice(0, 12)
                  .map((blocker) => (
                    <li key={blocker.id}>
                      <strong>{blocker.label}</strong>
                      <span>{blocker.reason}</span>
                      <small>{blocker.measurementId}</small>
                    </li>
                  ))}
              </ul>
            </article>
          </section>

          <section className="card">
            <p className="eyebrow">Capacidades independientes</p>
            <h2>Qué puede optimizar realmente</h2>
            <div className="capability-grid">
              {response.plan.capabilities.map((capability) => (
                <div key={capability.id} data-capability={capability.state}>
                  <strong>{capabilityLabel(capability.id)}</strong>
                  <span>{capability.state}</span>
                  <p>{capability.reason}</p>
                </div>
              ))}
            </div>
          </section>

          <details className="card planner-details">
            <summary>Ver grafo textual, alternativas y trazas</summary>
            <h3>Grafo semántico</h3>
            <ol className="semantic-list">
              {response.plan.graph.nodes.slice(0, 60).map((node) => (
                <li key={node.id}>
                  <strong>{node.label}</strong>
                  <span>
                    {node.type} · {node.state} · {node.goalIds.length} objetivo(s)
                  </span>
                </li>
              ))}
            </ol>
            <h3>Alternativas</h3>
            {response.plan.alternatives.length ? (
              response.plan.alternatives.map((alternative) => (
                <div className="alternative-row" key={alternative.id}>
                  <strong>{alternative.label}</strong>
                  <span>{alternative.relation}</span>
                  <p>{alternative.reason} Dimensiones conocidas únicamente.</p>
                </div>
              ))
            ) : (
              <p>No hay rutas alternativas estructuradas para estos objetivos.</p>
            )}
            <h3>Traza</h3>
            <ol className="semantic-list">
              {response.plan.traces.slice(0, 40).map((trace) => (
                <li key={trace.id}>
                  <strong>{trace.ruleId}</strong>
                  <span>{trace.consequence}</span>
                </li>
              ))}
            </ol>
          </details>

          <section className="planner-two-column">
            <article className="card">
              <p className="eyebrow">What-if</p>
              <h2>Prueba sin tocar tu partida</h2>
              <label>
                <span>Construcción hipotética</span>
                <select
                  value={scenarioSystem}
                  onChange={(event) => setScenarioSystem(event.target.value)}
                >
                  {automationOptions.map((system) => (
                    <option key={system.slug} value={system.slug}>
                      {system.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Comparar con</span>
                <select
                  value={comparisonSystem}
                  onChange={(event) => setComparisonSystem(event.target.value)}
                >
                  {automationOptions.map((system) => (
                    <option key={system.slug} value={system.slug}>
                      {system.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="button-row">
                <button
                  className="button"
                  type="button"
                  onClick={() =>
                    void generate(progress, { kind: 'build', systemSlug: scenarioSystem })
                  }
                >
                  Simular escenario
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={!scenarioSystem || !comparisonSystem}
                  onClick={() =>
                    void generate(progress, null, [
                      { kind: 'build', systemSlug: scenarioSystem },
                      { kind: 'build', systemSlug: comparisonSystem },
                    ])
                  }
                >
                  Comparar A y B
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() =>
                    saveScenario(localPlanner, {
                      id: `scenario:build:${scenarioSystem}`,
                      label: `Construir ${automationOptions.find((entry) => entry.slug === scenarioSystem)?.label ?? scenarioSystem}`,
                      action: { kind: 'build', systemSlug: scenarioSystem },
                      goalIds: selectedGoals.map((goal) => goal.id),
                      createdAt: new Date().toISOString(),
                    })
                  }
                >
                  Guardar what-if
                </button>
              </div>
            </article>
            <article className="card">
              <p className="eyebrow">Saved plans</p>
              <h2>Guarda y detecta cambios</h2>
              <label>
                <span>Nombre</span>
                <input
                  value={planName}
                  maxLength={120}
                  onChange={(event) => setPlanName(event.target.value)}
                />
              </label>
              <button
                className="button"
                type="button"
                onClick={() =>
                  savePlan(localPlanner, {
                    id: response.plan.id,
                    name: planName,
                    goals: selectedGoals,
                    preferences,
                    constraints,
                    stateRevision: response.stateRevision,
                    dataVersion: response.dataVersion,
                    gameVersion: gameVersion.trim() || null,
                  })
                }
              >
                Guardar plan local
              </button>
              <ul className="semantic-list saved-plan-list">
                {localPlanner.plans.map((plan) => {
                  const stale =
                    plan.createdStateRevision !== response.stateRevision ||
                    plan.dataVersion !== response.dataVersion;
                  return (
                    <li key={plan.id}>
                      <strong>{plan.name}</strong>
                      <span>
                        {stale
                          ? 'Puede estar desactualizado · recalcula'
                          : 'Vigente para este estado'}
                      </span>
                      <small>{plan.completedActionIds.length} acciones marcadas como hechas.</small>
                      {plan.id === response.plan.id ? (
                        <details>
                          <summary>Actualizar progreso del plan</summary>
                          <div className="button-row">
                            {response.plan.actions.slice(0, 8).map((action) => (
                              <button
                                className="button button-secondary"
                                type="button"
                                key={action.id}
                                aria-pressed={plan.completedActionIds.includes(action.id)}
                                onClick={() => markPlanAction(localPlanner, plan.id, action.id)}
                              >
                                {plan.completedActionIds.includes(action.id) ? 'Hecha · ' : ''}
                                {action.title}
                              </button>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </article>
          </section>

          <div className="button-row export-row">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => exportPlan('text')}
            >
              Exportar texto
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => exportPlan('json')}
            >
              Exportar JSON
            </button>
          </div>
        </div>
      ) : (
        <section className="planner-empty">
          <p className="eyebrow">Listo para combinar</p>
          <h2>No se concatenarán planes separados.</h2>
          <p>
            El planner construirá un grafo común y mostrará qué requisitos sirven a más de un
            objetivo.
          </p>
        </section>
      )}
    </div>
  );
}

function optionId(option: Pick<GoalOption, 'type' | 'slug'>): string {
  return `${option.type}|${option.slug}`;
}

function asGoal(option: GoalOption): PlannerGoal {
  return {
    id: `planner:${option.type}:${option.slug}`,
    type: option.type,
    slug: option.slug,
    label: option.label,
    ...(option.contentScope === undefined ? {} : { contentScope: option.contentScope }),
  };
}

function actionTypeLabel(type: PlanAction['type']): string {
  return type === 'gameplay'
    ? 'Gameplay'
    : type === 'confirmation'
      ? 'Confirmación'
      : type === 'research'
        ? 'Medición'
        : 'Decisión';
}

function filterLabel(value: (typeof FILTERS)[number]): string {
  return (
    {
      all: 'Todas',
      ready: 'Válidas ahora',
      blocked: 'Con bloqueo',
      unknown: 'Unknown',
      shared: 'Compartidas',
      gameplay: 'Gameplay',
      confirmation: 'Confirmaciones',
      measurement: 'Mediciones',
    } as const
  )[value];
}

function capabilityLabel(id: PlanResult['capabilities'][number]['id']): string {
  return (
    {
      structuralPlanning: 'Plan estructural',
      exactMaterialPlanning: 'Materiales exactos',
      timeOptimization: 'Tiempo',
      throughputOptimization: 'Throughput',
      powerOptimization: 'Energía',
      rangeReasoning: 'Rango',
    } as const
  )[id];
}

function scenarioRelationLabel(relation: ScenarioComparisonResult['relation']): string {
  if (relation === 'left_dominates') return 'Escenario A domina en lo conocido';
  if (relation === 'right_dominates') return 'Escenario B domina en lo conocido';
  if (relation === 'equivalent') return 'Escenarios equivalentes en lo conocido';
  return 'Escenarios cuantitativamente incomparables';
}
