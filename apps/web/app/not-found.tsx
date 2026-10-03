import { EmptyState } from '@pokopia/ui';
export default function NotFound() {
  return (
    <main>
      <EmptyState title="No encontramos esa ficha">
        Comprueba el enlace o usa la búsqueda universal para llegar al dato correcto.
      </EmptyState>
    </main>
  );
}
