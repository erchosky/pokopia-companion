'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { nextActions } from '@pokopia/intelligence';
import type { AutomationSystem } from '@pokopia/game-data';
import type { GoalEvaluation } from '@pokopia/goals';
import type { readProgressRecovery } from '@/lib/progress-store';
import {
  EMPTY_PROGRESS_SERIALIZED,
  clearProgressRecovery,
  parseProgress,
  readProgressRecoverySnapshot,
  readProgressSnapshot,
  revertInference,
  subscribeProgress,
  writeProgress,
  type ProgressGoal,
  type ProgressKind,
} from '@/lib/progress-store';

type TownSummary = {
  readonly slug: string;
  readonly name: string;
  readonly maxLevel: number | null;
};

type ProgressionCatalogEntry = {
  readonly kind: Extract<ProgressKind, 'quest' | 'treasure_map' | 'collectible' | 'ditto_move'>;
  readonly slug: string;
  readonly label: string;
  readonly group: string;
  readonly href: string;
};

export function MyPokopiaDashboard({
  towns,
  automation,
  progressionCatalog,
}: {
  towns: readonly TownSummary[];
  automation: readonly AutomationSystem[];
  progressionCatalog: readonly ProgressionCatalogEntry[];
}) {
  const snapshot = useSyncExternalStore(
    subscribeProgress,
    readProgressSnapshot,
    () => EMPTY_PROGRESS_SERIALIZED,
  );
  const progress = parseProgress(snapshot);
  const [goalResponse, setGoalResponse] = useState<{
    readonly snapshot: string;
    readonly evaluations: readonly GoalEvaluation[];
    readonly error: boolean;
  }>({ snapshot: '', evaluations: [], error: false });
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogGroup, setCatalogGroup] = useState('all');
  const [catalogState, setCatalogState] = useState('all');
  const [catalogLimit, setCatalogLimit] = useState(24);
  const recoverySnapshot = useSyncExternalStore(
    subscribeProgress,
    readProgressRecoverySnapshot,
    () => 'null',
  );
  const recovery = JSON.parse(recoverySnapshot) as ReturnType<typeof readProgressRecovery>;
  const goalEvaluations = goalResponse.snapshot === snapshot ? goalResponse.evaluations : [];
  const goalState = !progress.goals.length
    ? 'idle'
    : goalResponse.snapshot !== snapshot
      ? 'loading'
      : goalResponse.error
        ? 'error'
        : 'ready';
  useEffect(() => {
    const effectProgress = parseProgress(snapshot);
    if (!effectProgress.goals.length) return;
    const controller = new AbortController();
    void fetch('/api/goals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        goals: effectProgress.goals,
        entries: effectProgress.entries,
        inventory: effectProgress.inventory,
      }),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Goal evaluation failed: ${response.status}`);
        return response.json() as Promise<{ evaluations: readonly GoalEvaluation[] }>;
      })
      .then(({ evaluations }) => {
        setGoalResponse({ snapshot, evaluations, error: false });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setGoalResponse({ snapshot, evaluations: [], error: true });
      });
    return () => controller.abort();
  }, [snapshot]);
  const confirmedIds = Object.entries(progress.entries)
    .filter(([, entry]) => entry.state === 'confirmed' && entry.value === true)
    .map(([id]) => id);
  const inferred = Object.entries(progress.entries).filter(
    ([, entry]) => entry.state === 'inferred',
  );
  const actions = nextActions({
    goals: progress.goals,
    confirmedIds,
    towns: towns.map((town) => ({
      ...town,
      currentLevel: numberValue(progress.entries[`town:${town.slug}:level`]?.value),
    })),
    automation,
  });
  const removeGoal = (id: string) =>
    writeProgress({ ...progress, goals: progress.goals.filter((goal) => goal.id !== id) });
  const visibleProgression = progressionCatalog.filter((entry) => {
    const value = progress.entries[`${entry.kind}:${entry.slug}`]?.value;
    if (catalogGroup !== 'all' && entry.group !== catalogGroup) return false;
    if (catalogState === 'complete' && value !== true) return false;
    if (catalogState === 'missing' && value !== false) return false;
    if (catalogState === 'unknown' && value !== undefined) return false;
    return entry.label.toLocaleLowerCase('es').includes(catalogQuery.toLocaleLowerCase('es'));
  });
  const setCatalogEntry = (entry: ProgressionCatalogEntry, value: boolean | undefined) => {
    const id = `${entry.kind}:${entry.slug}`;
    const entries = { ...progress.entries };
    if (value === undefined) delete entries[id];
    else entries[id] = { state: 'confirmed', value, updatedAt: new Date().toISOString() };
    writeProgress({ ...progress, entries });
  };
  const downloadRecovery = () => {
    if (!recovery) return;
    const url = URL.createObjectURL(new Blob([recovery.backup], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pokopia-progress-recovery.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="brain-dashboard">
      {recovery ? (
        <section className="card" role="status" aria-live="polite">
          <p className="eyebrow">Recuperación local</p>
          <h2>Protegimos una copia de tu progreso</h2>
          <p>
            El estado guardado estaba dañado, incompleto o pertenece a una versión futura. La app
            recuperó solo datos válidos y conservó el original en este navegador.
          </p>
          <div className="button-row">
            <button type="button" onClick={downloadRecovery}>
              Descargar copia original
            </button>
            <button
              type="button"
              onClick={() => {
                clearProgressRecovery();
              }}
            >
              Entendido
            </button>
          </div>
        </section>
      ) : null}
      <section className="card active-plans-callout">
        <div>
          <p className="eyebrow">My Pokopia V5.5</p>
          <h2>Planes activos y próximos pasos</h2>
          <p>
            Combina tus objetivos, detecta requisitos compartidos y separa bloqueos de gameplay,
            estado y conocimiento del juego.
          </p>
        </div>
        <Link className="button" href="/planner">
          Abrir Planner 5.5
        </Link>
      </section>
      <section className="decision-hero">
        <div>
          <p className="eyebrow">Next Actions</p>
          <h2>Tu mejor siguiente paso</h2>
          <p>Ordenado por objetivos explícitos, impacto y datos confirmados.</p>
        </div>
        <div className="next-action-grid">
          {actions.map((action, index) => (
            <Link className="next-action-card" href={action.href} key={action.id}>
              <span className="action-rank">{index + 1}</span>
              <div>
                <strong>{action.title}</strong>
                <p>{action.reason}</p>
                <small>
                  Impacto {action.impact} · Esfuerzo {action.effort} · Confianza {action.confidence}
                </small>
              </div>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card progression-checklist">
        <div className="section-heading">
          <div>
            <p className="eyebrow">My Pokopia V5</p>
            <h2>Checklists conocidas</h2>
          </div>
          <p>
            {
              progressionCatalog.filter(
                (entry) => progress.entries[`${entry.kind}:${entry.slug}`]?.value === true,
              ).length
            }{' '}
            de {progressionCatalog.length} conocidos confirmados
          </p>
        </div>
        <div className="catalog-toolbar">
          <label>
            <span>Buscar</span>
            <input
              type="search"
              value={catalogQuery}
              onChange={(event) => {
                setCatalogQuery(event.target.value);
                setCatalogLimit(24);
              }}
              placeholder="Request, CD, movimiento…"
            />
          </label>
          <label>
            <span>Grupo</span>
            <select
              aria-label="Filtrar por grupo"
              value={catalogGroup}
              onChange={(event) => {
                setCatalogGroup(event.target.value);
                setCatalogLimit(24);
              }}
            >
              <option value="all">Todos</option>
              {[...new Set(progressionCatalog.map((entry) => entry.group))].map((group) => (
                <option value={group} key={group}>
                  {group}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Estado</span>
            <select
              aria-label="Filtrar por estado"
              value={catalogState}
              onChange={(event) => {
                setCatalogState(event.target.value);
                setCatalogLimit(24);
              }}
            >
              <option value="all">Todos</option>
              <option value="complete">Confirmado</option>
              <option value="missing">No completado</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
        </div>
        <p className="tracker-count" aria-live="polite">
          Mostrando {Math.min(catalogLimit, visibleProgression.length)} de{' '}
          {visibleProgression.length} coincidencias
        </p>
        <div className="checklist-table">
          {visibleProgression.slice(0, catalogLimit).map((entry) => {
            const value = progress.entries[`${entry.kind}:${entry.slug}`]?.value;
            return (
              <div className="checklist-row" key={`${entry.kind}:${entry.slug}`}>
                <div>
                  <small>{entry.group}</small>
                  <Link href={entry.href}>{entry.label}</Link>
                </div>
                <div className="tri-state-actions" aria-label={`Progreso de ${entry.label}`}>
                  <button
                    className={value === true ? 'is-active' : ''}
                    type="button"
                    onClick={() => setCatalogEntry(entry, true)}
                  >
                    ✓
                  </button>
                  <button
                    className={value === false ? 'is-active is-missing' : ''}
                    type="button"
                    onClick={() => setCatalogEntry(entry, false)}
                  >
                    No
                  </button>
                  <button
                    className={value === undefined ? 'is-active is-unknown' : ''}
                    type="button"
                    onClick={() => setCatalogEntry(entry, undefined)}
                  >
                    ?
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {visibleProgression.length > catalogLimit ? (
          <button
            className="checklist-more"
            type="button"
            onClick={() => setCatalogLimit((current) => current + 24)}
          >
            Mostrar 24 más
          </button>
        ) : null}
        {!visibleProgression.length ? (
          <p className="muted-copy">No hay entradas que coincidan con estos filtros.</p>
        ) : null}
      </section>

      <div className="dashboard-grid">
        <section className="card dashboard-card">
          <p className="eyebrow">Inventario cuantificado</p>
          <h2>
            {
              Object.values(progress.inventory).filter(
                (entry) => entry.quantityState === 'confirmed',
              ).length
            }{' '}
            cantidades confirmadas
          </h2>
          <p>
            {
              Object.values(progress.inventory).filter((entry) => entry.ownership === 'owned')
                .length
            }{' '}
            objetos owned ·{' '}
            {
              Object.values(progress.inventory).filter(
                (entry) => entry.ownership === 'owned' && entry.quantityState === 'unknown',
              ).length
            }{' '}
            con cantidad unknown
          </p>
          <Link href="/items">Actualizar inventario</Link>
        </section>

        <section className="card dashboard-card">
          <p className="eyebrow">Infraestructura y sistemas</p>
          <h2>
            {
              Object.entries(progress.entries).filter(
                ([id, entry]) => id.startsWith('automation:') && entry.value === true,
              ).length
            }{' '}
            sistemas Built
          </h2>
          <p>
            {Object.values(progress.townInfrastructure).reduce(
              (total, states) =>
                total + Object.values(states).filter((state) => state === 'confirmed').length,
              0,
            )}{' '}
            elementos de infraestructura confirmados
          </p>
          <Link href="/automation#planner">Evaluar readiness</Link>
        </section>

        <section className="card dashboard-card">
          <p className="eyebrow">Objetivos activos</p>
          <h2>{progress.goals.length || 'Ninguno'}</h2>
          {progress.goals.length ? (
            <div className="compact-list">
              {progress.goals.map((goal) => (
                <div className="dashboard-row" key={goal.id}>
                  <div>
                    <Link href={goalHref(goal)}>{goal.label}</Link>
                    {goalEvaluations.find((evaluation) => evaluation.goalId === goal.id) ? (
                      <GoalStatus
                        evaluation={goalEvaluations.find(
                          (evaluation) => evaluation.goalId === goal.id,
                        )!}
                      />
                    ) : (
                      <small>
                        {goalState === 'error' ? 'Análisis no disponible' : 'Analizando…'}
                      </small>
                    )}
                  </div>
                  <button type="button" onClick={() => removeGoal(goal.id)}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p>Añade uno desde una ficha de objeto, Pokémon o automatización.</p>
          )}
        </section>

        <section className="card dashboard-card">
          <p className="eyebrow">My Towns</p>
          <h2>{Object.keys(progress.townResidents).length} configurados</h2>
          <div className="compact-list">
            {towns.map((town) => {
              const level = numberValue(progress.entries[`town:${town.slug}:level`]?.value);
              const residents = progress.townResidents[town.slug]?.length ?? 0;
              return (
                <Link href={`/towns/${town.slug}#optimizer`} key={town.slug}>
                  {town.name} · nivel {level ?? '?'} · {residents} residentes
                </Link>
              );
            })}
          </div>
        </section>

        <section className="card dashboard-card">
          <p className="eyebrow">Recientes</p>
          <h2>Retoma donde estabas</h2>
          {progress.recentlyViewed.length ? (
            <div className="compact-list">
              {progress.recentlyViewed.slice(0, 6).map((entry) => (
                <Link href={entityHref(entry.kind, entry.slug)} key={`${entry.kind}:${entry.slug}`}>
                  {entry.label}
                </Link>
              ))}
            </div>
          ) : (
            <p>Las fichas que abras aparecerán aquí.</p>
          )}
        </section>

        <section className="card dashboard-card">
          <p className="eyebrow">Estado local</p>
          <h2>{confirmedIds.length} confirmados</h2>
          <p>
            {progress.favorites.length} favoritos · {inferred.length} inferencias revisables
          </p>
          {inferred.length ? (
            <details className="advanced-details">
              <summary>Revisar inferencias</summary>
              {inferred.map(([id, entry]) => (
                <div className="dashboard-row" key={id}>
                  <span>
                    {id} · regla {entry.ruleId ?? entry.rule ?? 'desconocida'}
                  </span>
                  <button
                    type="button"
                    onClick={() => writeProgress(revertInference(progress, id))}
                  >
                    Revertir
                  </button>
                </div>
              ))}
            </details>
          ) : null}
        </section>
      </div>

      <section className="privacy-note">
        <strong>Privado por defecto.</strong> Tu progreso vive en este navegador. El análisis de
        objetivos se calcula de forma efímera en esta app y no se persiste en la base de datos.
      </section>
    </div>
  );
}

function GoalStatus({ evaluation }: { evaluation: GoalEvaluation }) {
  return (
    <div className="goal-evaluation" data-testid={`goal-status-${evaluation.goalId}`}>
      <span
        className={`health-pill state-${evaluation.status === 'completed' ? 'complete' : evaluation.status === 'blocked' ? 'missing' : 'unknown'}`}
      >
        {evaluation.status}
      </span>
      <small>
        {evaluation.satisfied.length} satisfechos · {evaluation.missing.length} faltantes ·{' '}
        {evaluation.unknown.length} unknown · confianza {evaluation.confidence}
      </small>
      {evaluation.nextStep ? (
        <Link href={evaluation.nextStep.href}>{evaluation.nextStep.title}</Link>
      ) : null}
      {evaluation.blockers.length || evaluation.unknowns.length ? (
        <details>
          <summary>Bloqueos, evidencia y unknowns</summary>
          <ul className="plain-list">
            {[...evaluation.blockers, ...evaluation.unknowns].slice(0, 8).map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function numberValue(value: boolean | number | string | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value)))
    return Number(value);
  return null;
}

function goalHref(goal: ProgressGoal): string {
  if (goal.type === 'acquire-pokemon') return `/pokemon/${goal.slug}`;
  if (goal.type === 'reach-town-level') return `/towns/${goal.slug}`;
  if (goal.type === 'build-automation') return `/automation#${goal.slug}`;
  if (goal.type === 'craft-item') return `/recipes/${goal.slug}`;
  if (goal.type === 'complete-quest') return `/requests/${goal.slug}`;
  if (goal.type === 'complete-treasure-map') return `/treasure-maps/${goal.slug}`;
  if (goal.type === 'get-collectible') return `/collectibles/${goal.slug}`;
  if (goal.type === 'learn-ditto-move') return `/ditto-moves/${goal.slug}`;
  return `/items/${goal.slug}`;
}

function entityHref(kind: string, slug: string): string {
  if (kind === 'pokemon') return `/pokemon/${slug}`;
  if (kind === 'recipe') return `/recipes/${slug}`;
  if (kind === 'town') return `/towns/${slug}`;
  if (kind === 'automation') return `/automation#${slug}`;
  if (kind === 'quest') return `/requests/${slug}`;
  if (kind === 'treasure_map') return `/treasure-maps/${slug}`;
  if (kind === 'collectible') return `/collectibles/${slug}`;
  if (kind === 'ditto_move') return `/ditto-moves/${slug}`;
  return `/items/${slug}`;
}
