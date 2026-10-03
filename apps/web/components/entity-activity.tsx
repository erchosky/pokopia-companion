'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  EMPTY_PROGRESS_SERIALIZED,
  parseProgress,
  progressId,
  readProgressSnapshot,
  recordRecentEntity,
  recordSearch,
  subscribeProgress,
  toggleFavorite,
  writeProgress,
  type ProgressKind,
} from '@/lib/progress-store';

export function EntityActivity({
  kind,
  slug,
  label,
}: {
  kind: ProgressKind;
  slug: string;
  label: string;
}) {
  const recorded = useRef('');
  const snapshot = useSyncExternalStore(
    subscribeProgress,
    readProgressSnapshot,
    () => EMPTY_PROGRESS_SERIALIZED,
  );
  const progress = parseProgress(snapshot);
  const id = progressId(kind, slug);
  const favorite = progress.favorites.includes(id);
  useEffect(() => {
    // Key by entity so a reused instance still records the next entity it renders.
    if (recorded.current === id) return;
    recorded.current = id;
    writeProgress(recordRecentEntity(parseProgress(readProgressSnapshot()), { kind, slug, label }));
  }, [id, kind, label, slug]);
  return (
    <button
      className="favorite-action"
      type="button"
      aria-pressed={favorite}
      onClick={() => writeProgress(toggleFavorite(parseProgress(readProgressSnapshot()), id))}
    >
      <span aria-hidden="true">{favorite ? '★' : '☆'}</span>
      {favorite ? 'Favorito' : 'Guardar favorito'}
    </button>
  );
}

export function SearchHistoryRecorder({ query }: { query: string }) {
  const recorded = useRef('');
  useEffect(() => {
    if (query.trim().length < 2 || recorded.current === query) return;
    recorded.current = query;
    writeProgress(recordSearch(parseProgress(readProgressSnapshot()), query));
  }, [query]);
  return null;
}
