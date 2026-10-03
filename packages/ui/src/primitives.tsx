import type { HTMLAttributes, ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      {children}
    </div>
  );
}

export function Header({
  title,
  subtitle,
  nav,
  actions,
}: {
  title: string;
  subtitle: string;
  nav: readonly { href: string; label: string }[];
  actions?: ReactNode;
}) {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label={`${title}, inicio`}>
        <span className="brand-mark" aria-hidden="true">
          P
        </span>
        <span>
          <strong>{title}</strong>
          <small>{subtitle}</small>
        </span>
      </a>
      <nav aria-label="Navegación principal">
        {nav.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </header>
  );
}

export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="page-intro">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      <div className="lede">{children}</div>
    </section>
  );
}

export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <article className={`card ${className}`.trim()} {...props}>
      {children}
    </article>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'accent';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">◇</span>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

export function SourceNote({
  url,
  snapshot,
  status = 'unverified',
}: {
  url: string;
  snapshot: string;
  status?: string;
}) {
  const statusLabel =
    status === 'confirmed'
      ? 'Dato confirmado'
      : status === 'unverified'
        ? 'Pendiente de revisión'
        : 'Estado desconocido';
  return (
    <aside className="source-note">
      <div>
        <strong>Fuente del dato</strong>
        <span>
          {snapshot} · {statusLabel}
        </span>
      </div>
      <a href={url} target="_blank" rel="noreferrer">
        Consultar fuente <span aria-hidden="true">↗</span>
      </a>
    </aside>
  );
}

export function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

export function DefinitionList({
  entries,
}: {
  entries: readonly { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="definition-list">
      {entries.map((entry) => (
        <div key={entry.label}>
          <dt>{entry.label}</dt>
          <dd>{entry.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Pagination({
  page,
  hasNext,
  pathname,
}: {
  page: number;
  hasNext: boolean;
  pathname: string;
}) {
  const separator = pathname.includes('?') ? '&' : '?';
  return (
    <nav className="pagination" aria-label="Paginación">
      {page > 1 ? (
        <a className="button button-secondary" href={`${pathname}${separator}page=${page - 1}`}>
          ← Anterior
        </a>
      ) : (
        <span />
      )}
      <span>Página {page}</span>
      {hasNext ? (
        <a className="button button-secondary" href={`${pathname}${separator}page=${page + 1}`}>
          Siguiente →
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}
