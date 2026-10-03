'use client';

import { useDeferredValue, useState, useSyncExternalStore } from 'react';
import {
  EMPTY_PROGRESS_SERIALIZED,
  parseProgress,
  progressId,
  readProgressSnapshot,
  setInventoryEntry,
  subscribeProgress,
  writeProgress,
  type ProgressKind,
} from '@/lib/progress-store';
import { InventoryQuantityControl } from '@/components/progress-actions';

type Trackable = {
  kind: Extract<ProgressKind, 'pokemon' | 'recipe' | 'item'>;
  slug: string;
  name: string;
};
type Filter = 'all' | Trackable['kind'] | 'goals';

export function MyPokopiaTracker({ entries }: { entries: readonly Trackable[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase('es'));
  const snapshot = useSyncExternalStore(
    subscribeProgress,
    readProgressSnapshot,
    () => EMPTY_PROGRESS_SERIALIZED,
  );
  const progressState = parseProgress(snapshot);
  const availableIds = new Set(entries.map((entry) => progressId(entry.kind, entry.slug)));
  const confirmedCount = Object.entries(progressState.entries).filter(
    ([id, entry]) => availableIds.has(id) && entry.state === 'confirmed' && entry.value === true,
  ).length;
  const progress = entries.length ? Math.round((confirmedCount / entries.length) * 100) : 0;
  const visibleEntries = entries.filter(
    (entry) =>
      filter !== 'goals' &&
      (filter === 'all' || entry.kind === filter) &&
      (!deferredQuery || entry.name.toLocaleLowerCase('es').includes(deferredQuery)),
  );
  function toggle(entry: Trackable) {
    const id = progressId(entry.kind, entry.slug);
    if (entry.kind === 'item') {
      const current = progressState.inventory[entry.slug];
      if (current?.ownership === 'owned') {
        const inventory = { ...progressState.inventory };
        const entriesState = { ...progressState.entries };
        delete inventory[entry.slug];
        delete entriesState[id];
        writeProgress({ ...progressState, inventory, entries: entriesState });
      } else {
        writeProgress(
          setInventoryEntry(progressState, entry.slug, {
            ownership: 'owned',
            quantityState: 'unknown',
            quantity: null,
          }),
        );
      }
      return;
    }
    const entriesState = { ...progressState.entries };
    if (entriesState[id]?.value === true) delete entriesState[id];
    else
      entriesState[id] = {
        state: 'confirmed',
        value: true,
        updatedAt: new Date().toISOString(),
      };
    writeProgress({ ...progressState, entries: entriesState });
  }
  return (
    <section>
      <div className="progress-overview">
        <div className="card progress-row">
          <div className="progress-summary">
            <strong>
              {confirmedCount} de {entries.length} confirmados · guardados aquí
            </strong>
            <span>{progress}%</span>
          </div>
          <div
            className="progress-track"
            aria-label={`${progress}% completado`}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <small>
            Se guarda solo en este dispositivo. Los datos inferidos no cuentan como confirmados.
          </small>
        </div>
        <div className="card goal-summary">
          <span className="eyebrow">Objetivos activos</span>
          <strong>{progressState.goals.length}</strong>
          <p>Añádelos desde fichas de objetos y herramientas.</p>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Tu Pokopia</p>
          <h2>Confirma poco a poco</h2>
        </div>
      </div>
      <div className="tracker-toolbar">
        <label>
          <span className="sr-only">Buscar en tu progreso</span>
          <input
            className="tracker-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar Pokémon, receta u objeto clave…"
          />
        </label>
        <div className="filter-group" aria-label="Filtrar progreso">
          {(
            [
              ['all', 'Todo'],
              ['pokemon', 'Pokémon'],
              ['recipe', 'Recetas'],
              ['item', 'Objetos clave'],
              ['goals', 'Objetivos'],
            ] as const
          ).map(([value, label]) => (
            <button
              className="filter-button"
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              key={value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {filter === 'goals' ? (
        progressState.goals.length ? (
          <div className="check-grid">
            {progressState.goals.map((goal) => (
              <div className="check-item" key={goal.id}>
                <span className="check-copy">
                  <strong>{goal.label}</strong>
                  <small>{goal.type.replaceAll('-', ' ')}</small>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span aria-hidden="true">◇</span>
            <h2>Aún no tienes objetivos</h2>
            <p>Añade uno desde la ficha de un objeto o un sistema de automatización.</p>
          </div>
        )
      ) : (
        <>
          <p className="tracker-count" aria-live="polite">
            Mostrando {visibleEntries.length} de {entries.length}
          </p>
          <div className="check-grid">
            {visibleEntries.map((entry) => {
              const id = progressId(entry.kind, entry.slug);
              const checked =
                entry.kind === 'item'
                  ? progressState.inventory[entry.slug]?.ownership === 'owned'
                  : progressState.entries[id]?.value === true;
              return (
                <div key={id}>
                  <label className="check-item">
                    <input type="checkbox" checked={checked} onChange={() => toggle(entry)} />
                    <span className="check-copy">
                      <strong>{entry.name}</strong>
                      <small>
                        {entry.kind === 'pokemon'
                          ? 'Owned'
                          : entry.kind === 'recipe'
                            ? 'Unlocked'
                            : checked
                              ? 'Owned · confirma cantidad si la conoces'
                              : 'Acquired'}
                      </small>
                    </span>
                  </label>
                  {entry.kind === 'item' && checked ? (
                    <InventoryQuantityControl slug={entry.slug} name={entry.name} />
                  ) : null}
                </div>
              );
            })}
          </div>
          {visibleEntries.length === 0 ? (
            <div className="empty-state">
              <span aria-hidden="true">◇</span>
              <h2>No hay coincidencias</h2>
              <p>Prueba otra búsqueda o cambia el filtro.</p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
