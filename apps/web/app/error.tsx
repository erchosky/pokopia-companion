'use client';
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main>
      <div className="empty-state">
        <h1>No se pudo leer el dataset</h1>
        <p>La fuente sigue intacta. Revisa la ruta de la base de datos y vuelve a intentarlo.</p>
        <button className="button" onClick={reset}>
          Reintentar
        </button>
      </div>
    </main>
  );
}
