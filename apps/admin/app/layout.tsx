import type { Metadata } from 'next';
import { AppShell, Header } from '@pokopia/ui';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Pokopia Data Admin', template: '%s · Pokopia Admin' },
  robots: { index: false, follow: false },
};
const nav = [
  { href: '/health', label: 'Salud de datos' },
  { href: '/entities', label: 'Entidades' },
  { href: '/sources', label: 'Fuentes' },
  { href: '/gaps', label: 'Vacíos' },
  { href: '/quantitative', label: 'Cobertura cuantitativa' },
  { href: '/planner', label: 'Planner 5.5' },
];
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>
        <AppShell>
          <Header title="Pokopia Admin" subtitle="Data operations" nav={nav} />
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
        </AppShell>
      </body>
    </html>
  );
}
