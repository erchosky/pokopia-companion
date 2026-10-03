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
        <h1>Admin no puede leer la base</h1>
        <p>No se realizaron cambios. Revisa POKOPIA_DATABASE_PATH.</p>
        <button className="button" onClick={reset}>
          Reintentar
        </button>
      </div>
    </main>
  );
}
