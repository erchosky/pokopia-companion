'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Card } from '@pokopia/ui';
import { humanizeGameValue } from '@/lib/presentation';

export type PokemonExplorerEntry = {
  readonly slug: string;
  readonly name: string;
  readonly number: number | null;
  readonly specialty: string | null;
  readonly habitat: string | null;
  readonly roles: readonly string[];
};

export function PokemonExplorer({ entries }: { entries: readonly PokemonExplorerEntry[] }) {
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('all');
  const [habitat, setHabitat] = useState('all');
  const [sort, setSort] = useState<'number' | 'name'>('number');
  const deferred = useDeferredValue(query.trim().toLocaleLowerCase('es'));
  const specialties = useMemo(
    () => [...new Set(entries.map((entry) => entry.specialty).filter(Boolean))].sort(),
    [entries],
  );
  const habitats = useMemo(
    () => [...new Set(entries.map((entry) => entry.habitat).filter(Boolean))].sort(),
    [entries],
  );
  const visible = entries
    .filter(
      (entry) =>
        (!deferred ||
          `${entry.name} ${entry.specialty ?? ''} ${entry.habitat ?? ''} ${entry.roles.join(' ')}`
            .toLocaleLowerCase('es')
            .includes(deferred)) &&
        (specialty === 'all' || entry.specialty === specialty) &&
        (habitat === 'all' || entry.habitat === habitat),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER),
    );
  return (
    <section>
      <div className="explorer-toolbar card">
        <label className="explorer-search">
          <span>Buscar al instante</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, especialidad o rol…"
          />
        </label>
        <label>
          <span>Especialidad</span>
          <select value={specialty} onChange={(event) => setSpecialty(event.target.value)}>
            <option value="all">Todas</option>
            {specialties.map((value) => (
              <option value={value!} key={value}>
                {humanizeGameValue(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Hábitat ideal</span>
          <select value={habitat} onChange={(event) => setHabitat(event.target.value)}>
            <option value="all">Todos</option>
            {habitats.map((value) => (
              <option value={value!} key={value}>
                {humanizeGameValue(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Orden</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as 'number' | 'name')}
          >
            <option value="number">Número</option>
            <option value="name">Nombre</option>
          </select>
        </label>
      </div>
      <p className="collection-meta" aria-live="polite">
        <span>
          <strong>{visible.length}</strong> de {entries.length} Pokémon
        </span>
        <span>Los roles son inferencias trazables desde la especialidad.</span>
      </p>
      <div className="grid">
        {visible.map((entry) => (
          <Link key={entry.slug} href={`/pokemon/${entry.slug}`}>
            <Card className="card-link entity-card">
              <Badge>{entry.number ? `#${entry.number}` : 'Sin número'}</Badge>
              <h2>{entry.name}</h2>
              <p>{humanizeGameValue(entry.specialty)}</p>
              <div className="chip-list">
                <span className="chip">{humanizeGameValue(entry.habitat)}</span>
                {entry.roles.slice(0, 2).map((role) => (
                  <span className="chip chip-derived" key={role}>
                    {role}
                  </span>
                ))}
              </div>
              <span className="card-arrow">Ver ficha →</span>
            </Card>
          </Link>
        ))}
      </div>
      {!visible.length ? (
        <div className="empty-state">
          <span aria-hidden="true">◇</span>
          <h2>Ningún Pokémon coincide</h2>
          <p>Quita un filtro o busca una especialidad más corta.</p>
        </div>
      ) : null}
    </section>
  );
}
