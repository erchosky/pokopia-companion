import type { EntityKind } from '@pokopia/game-data';
export function entityHref(kind: EntityKind, slug: string): string {
  if (kind === 'page' || kind === 'ability' || kind === 'location')
    return `/buscar?q=${encodeURIComponent(slug.replaceAll('-', ' '))}`;
  if (kind === 'automation') return `/automation#${slug}`;
  if (kind === 'recipe') return `/recipes/${slug}`;
  if (kind === 'pokemon') return `/pokemon/${slug}`;
  if (kind === 'quest') return `/requests/${slug}`;
  if (kind === 'treasure_map') return `/treasure-maps/${slug}`;
  if (kind === 'collectible') return `/collectibles/${slug}`;
  if (kind === 'ditto_move') return `/ditto-moves/${slug}`;
  return `/${kind === 'town' ? 'towns' : 'items'}/${slug}`;
}
