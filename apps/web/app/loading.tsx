export default function Loading() {
  return (
    <main aria-busy="true">
      <div className="empty-state">
        <p>Cargando datos del snapshot…</p>
      </div>
    </main>
  );
}
