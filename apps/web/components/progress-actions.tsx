'use client';

import { useSyncExternalStore } from 'react';
import { inferLowerTownLevels } from '@pokopia/rules';
import {
  EMPTY_PROGRESS_SERIALIZED,
  parseProgress,
  progressId,
  readProgressSnapshot,
  setInventoryEntry,
  subscribeProgress,
  writeProgress,
  type ProgressGoal,
  type ProgressKind,
} from '@/lib/progress-store';

function useProgress() {
  const snapshot = useSyncExternalStore(
    subscribeProgress,
    readProgressSnapshot,
    () => EMPTY_PROGRESS_SERIALIZED,
  );
  return parseProgress(snapshot);
}

export function ProgressAction({
  kind,
  slug,
  activeLabel,
  inactiveLabel,
}: {
  kind: ProgressKind;
  slug: string;
  activeLabel: string;
  inactiveLabel: string;
}) {
  const progress = useProgress();
  const id = progressId(kind, slug);
  const inventory = kind === 'item' ? progress.inventory[slug] : undefined;
  const active = inventory ? inventory.ownership === 'owned' : progress.entries[id]?.value === true;
  const explicitlyMissing = inventory
    ? inventory.ownership === 'not_owned'
    : progress.entries[id]?.value === false;
  const toggle = () => {
    if (kind === 'item') {
      if (active) {
        const entries = { ...progress.entries };
        const nextInventory = { ...progress.inventory };
        delete entries[id];
        delete nextInventory[slug];
        writeProgress({ ...progress, entries, inventory: nextInventory });
      } else {
        writeProgress(
          setInventoryEntry(progress, slug, {
            ownership: 'owned',
            quantityState: 'unknown',
            quantity: null,
          }),
        );
      }
      return;
    }
    const entries = { ...progress.entries };
    if (active) delete entries[id];
    else
      entries[id] = {
        state: 'confirmed',
        value: true,
        updatedAt: new Date().toISOString(),
      };
    writeProgress({ ...progress, entries });
  };
  const toggleMissing = () => {
    if (kind === 'item') {
      if (explicitlyMissing) {
        const entries = { ...progress.entries };
        const nextInventory = { ...progress.inventory };
        delete entries[id];
        delete nextInventory[slug];
        writeProgress({ ...progress, entries, inventory: nextInventory });
      } else {
        writeProgress(
          setInventoryEntry(progress, slug, {
            ownership: 'not_owned',
            quantityState: 'confirmed',
            quantity: 0,
          }),
        );
      }
      return;
    }
    const entries = { ...progress.entries };
    if (explicitlyMissing) delete entries[id];
    else
      entries[id] = {
        state: 'confirmed',
        value: false,
        updatedAt: new Date().toISOString(),
      };
    writeProgress({ ...progress, entries });
  };
  return (
    <span className="progress-action-group">
      <button
        className={`button progress-action ${active ? 'is-active' : ''}`}
        type="button"
        aria-pressed={active}
        onClick={toggle}
      >
        <span aria-hidden="true">{active ? '✓' : '+'}</span>
        {active ? activeLabel : inactiveLabel}
      </button>
      <button
        className={`button button-secondary progress-missing-action ${explicitlyMissing ? 'is-active' : ''}`}
        type="button"
        aria-pressed={explicitlyMissing}
        onClick={toggleMissing}
      >
        {explicitlyMissing ? 'Estado: no lo tengo' : 'Marcar no lo tengo'}
      </button>
    </span>
  );
}

export function InventoryQuantityControl({ slug, name }: { slug: string; name: string }) {
  const progress = useProgress();
  const entry = progress.inventory[slug];
  const setUnknown = () =>
    writeProgress(
      setInventoryEntry(progress, slug, {
        ownership: 'owned',
        quantityState: 'unknown',
        quantity: null,
      }),
    );
  const setQuantity = (quantity: number) => {
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > 1e9) return;
    writeProgress(
      setInventoryEntry(progress, slug, {
        ownership: quantity > 0 ? 'owned' : 'not_owned',
        quantityState: 'confirmed',
        quantity,
      }),
    );
  };
  return (
    <div className="inventory-quantity-control">
      <label htmlFor={`inventory-${slug}`}>Cantidad de {name}</label>
      <input
        id={`inventory-${slug}`}
        type="number"
        inputMode="numeric"
        min={0}
        max={1_000_000_000}
        placeholder="Sin confirmar"
        value={entry?.quantityState === 'confirmed' ? (entry.quantity ?? 0) : ''}
        onChange={(event) => {
          if (event.target.value === '') setUnknown();
          else setQuantity(Number(event.target.value));
        }}
      />
      <button
        className="button button-secondary"
        type="button"
        aria-pressed={entry?.quantityState === 'unknown'}
        onClick={setUnknown}
      >
        La tengo, cantidad desconocida
      </button>
      <small>
        {entry?.quantityState === 'confirmed'
          ? `Cantidad confirmada: ${entry.quantity}.`
          : entry?.ownership === 'owned'
            ? 'Owned confirmado; la cantidad sigue siendo unknown.'
            : 'Sin dato: no equivale a cero.'}
      </small>
    </div>
  );
}

export function GoalAction({ type, slug, label }: Pick<ProgressGoal, 'type' | 'slug' | 'label'>) {
  const progress = useProgress();
  const id = `${type}:${slug}`;
  const active = progress.goals.some((goal) => goal.id === id);
  const toggle = () => {
    const goals = active
      ? progress.goals.filter((goal) => goal.id !== id)
      : [...progress.goals, { id, type, slug, label, createdAt: new Date().toISOString() }];
    writeProgress({ ...progress, goals });
  };
  return (
    <button
      className="button button-secondary"
      type="button"
      aria-pressed={active}
      onClick={toggle}
    >
      {active ? 'Quitar de objetivos' : 'Añadir a objetivos'}
    </button>
  );
}

export function TownLevelControl({
  slug,
  name,
  maxLevel,
  unlocks = [],
}: {
  slug: string;
  name: string;
  maxLevel: number;
  unlocks?: readonly { name: string; level: number }[];
}) {
  const progress = useProgress();
  const id = `town:${slug}:level`;
  const current = Number(progress.entries[id]?.value) || 0;
  const nextLevel = [...unlocks]
    .filter((unlock) => unlock.level > current)
    .sort((a, b) => a.level - b.level)[0]?.level;
  const nextUnlocks = nextLevel
    ? unlocks.filter((unlock) => unlock.level === nextLevel).slice(0, 3)
    : [];
  const setLevel = (level: number) => {
    const entries = Object.fromEntries(
      Object.entries(progress.entries).filter(
        ([key]) => key !== id && !key.startsWith(`town-level:${slug}:`),
      ),
    );
    if (level > 0) {
      const timestamp = new Date().toISOString();
      entries[id] = { state: 'confirmed', value: level, updatedAt: timestamp };
      for (const inferred of inferLowerTownLevels(slug, level, timestamp))
        entries[inferred.id] = {
          state: 'inferred',
          value: true,
          updatedAt: inferred.timestamp,
          inferredFrom: inferred.inferredFrom,
          rule: inferred.rule,
          ruleId: inferred.rule,
        };
    }
    writeProgress({ ...progress, entries });
  };
  return (
    <div className="town-level-control">
      <label htmlFor={`town-level-${slug}`}>Tu Environment Level en {name}</label>
      <select
        id={`town-level-${slug}`}
        value={current}
        onChange={(event) => setLevel(Number(event.target.value))}
      >
        <option value={0}>Sin confirmar</option>
        {Array.from({ length: maxLevel }, (_, index) => index + 1).map((level) => (
          <option value={level} key={level}>
            Nivel {level}
          </option>
        ))}
      </select>
      <small>
        {current > 1
          ? `Niveles 1–${current - 1} marcados como inferidos. Puedes corregirlos cambiando este valor.`
          : 'No se infieren objetos ni recetas solo por elegir un nivel.'}
      </small>
      <div className="next-action" aria-live="polite">
        {nextLevel ? (
          <>
            <strong>Siguiente acción: nivel {nextLevel}</strong>
            <span>{nextUnlocks.map((unlock) => unlock.name).join(' · ')}</span>
          </>
        ) : (
          <strong>No hay un nivel posterior documentado.</strong>
        )}
      </div>
    </div>
  );
}

export function BuildReadiness({
  ingredients,
}: {
  ingredients: readonly { slug: string; name: string; quantity: number | null }[];
}) {
  const progress = useProgress();
  const evaluated = ingredients.map((ingredient) => {
    const entry = progress.inventory[ingredient.slug];
    if (ingredient.quantity === null || !entry || entry.quantityState === 'unknown')
      return { ingredient, state: 'unknown' as const };
    return {
      ingredient,
      state: entry.quantity! >= ingredient.quantity ? ('known' as const) : ('missing' as const),
    };
  });
  const known = evaluated.filter((entry) => entry.state === 'known');
  const missing = evaluated.filter((entry) => entry.state === 'missing');
  const unknown = evaluated.filter((entry) => entry.state === 'unknown');
  return (
    <div className="readiness" aria-live="polite">
      <strong>
        {unknown.length === 0 && missing.length === 0 && ingredients.length
          ? 'Tienes cantidad suficiente de todos los materiales'
          : 'Aún no podemos confirmar que puedas construirlo'}
      </strong>
      <p>
        {known.length} suficientes · {missing.length} insuficientes · {unknown.length} unknown. Cero
        confirmado y cantidad unknown se evalúan de forma distinta.
      </p>
    </div>
  );
}
