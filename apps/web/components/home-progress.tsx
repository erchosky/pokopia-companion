'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  EMPTY_PROGRESS_SERIALIZED,
  parseProgress,
  readProgressSnapshot,
  subscribeProgress,
} from '@/lib/progress-store';

export function HomeProgress() {
  const snapshot = useSyncExternalStore(
    subscribeProgress,
    readProgressSnapshot,
    () => EMPTY_PROGRESS_SERIALIZED,
  );
  const progress = parseProgress(snapshot);
  const confirmed = Object.values(progress.entries).filter(
    (entry) => entry.state === 'confirmed',
  ).length;
  const nextGoal = progress.goals[0];
  const recent = progress.recentlyViewed.slice(0, 3);
  return (
    <div className="home-brain">
      <section className="continue-panel">
        <div>
          <p className="eyebrow">Continúa tu Pokopia</p>
          <h2>
            {nextGoal?.label ??
              (confirmed ? `${confirmed} estados confirmados` : 'Empieza con un solo dato')}
          </h2>
          <p>
            {nextGoal
              ? 'Es tu objetivo activo con mayor prioridad.'
              : 'Confirma el nivel de un pueblo para obtener un siguiente paso fiable.'}
          </p>
        </div>
        <div className="action-row">
          <Link className="button" href="/my-pokopia">
            Ver próximos pasos
          </Link>
          <Link className="button button-secondary" href="/towns">
            Abrir mis pueblos
          </Link>
        </div>
      </section>
      {recent.length || progress.recentSearches.length ? (
        <section className="recent-strip" aria-label="Actividad reciente">
          <strong>Reciente</strong>
          {recent.map((entry) => (
            <Link href={entityHref(entry.kind, entry.slug)} key={`${entry.kind}:${entry.slug}`}>
              {entry.label}
            </Link>
          ))}
          {progress.recentSearches.slice(0, 2).map((entry) => (
            <Link href={`/buscar?q=${encodeURIComponent(entry.query)}`} key={entry.query}>
              Buscar: {entry.query}
            </Link>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function entityHref(kind: string, slug: string): string {
  if (kind === 'pokemon') return `/pokemon/${slug}`;
  if (kind === 'recipe') return `/recipes/${slug}`;
  if (kind === 'town') return `/towns/${slug}`;
  if (kind === 'automation') return `/automation#${slug}`;
  return `/items/${slug}`;
}
