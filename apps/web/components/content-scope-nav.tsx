import Link from 'next/link';
import type { ContentScope } from '@pokopia/game-data';

const options = [
  ['all', 'Todo'],
  ['base_game', 'Juego base'],
  ['expansion', 'Expansion Pass'],
  ['unknown', 'Desconocido'],
] as const;

export function ContentScopeNav({
  pathname,
  selected,
}: {
  pathname: string;
  selected: ContentScope | 'all';
}) {
  return (
    <nav className="filter-tabs" aria-label="Filtrar por versión">
      {options.map(([scope, label]) => (
        <Link
          aria-current={selected === scope ? 'page' : undefined}
          className={selected === scope ? 'is-active' : ''}
          href={scope === 'all' ? pathname : `${pathname}?scope=${scope}`}
          key={scope}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
