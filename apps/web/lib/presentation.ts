import type { EntityKind } from '@pokopia/game-data';

const KIND_LABELS: Record<EntityKind, string> = {
  pokemon: 'Pokémon',
  item: 'Objeto',
  recipe: 'Receta',
  town: 'Pueblo',
  ability: 'Habilidad',
  automation: 'Automatización',
  quest: 'Misión',
  treasure_map: 'Mapa del tesoro',
  collectible: 'Coleccionable',
  ditto_move: 'Movimiento de Ditto',
  location: 'Localización',
  page: 'Guía',
};

export function entityKindLabel(kind: EntityKind): string {
  return KIND_LABELS[kind];
}

export function humanizeGameValue(value: string | null | undefined): string {
  if (!value || value.toUpperCase() === 'UNKNOWN') return 'Sin confirmar';
  return value
    .replace(/([a-z])([A-Z])/g, '$1 · $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 · $2')
    .replaceAll('_', ' ')
    .trim();
}

export function sourceStatusLabel(status: string): string {
  if (status === 'confirmed') return 'Dato confirmado';
  if (status === 'unverified') return 'Pendiente de revisión';
  return 'Estado desconocido';
}
