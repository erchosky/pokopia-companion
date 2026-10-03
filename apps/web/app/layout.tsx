import type { Metadata } from 'next';
import { AppShell, Header } from '@pokopia/ui';
import './globals.css';
import { CommandPalette } from '@/components/command-palette';

export const metadata: Metadata = {
  title: { default: 'Pokopia Companion', template: '%s · Pokopia Companion' },
  description: 'Enciclopedia y planner trazable para Pokémon Pokopia.',
};
const nav = [
  { href: '/buscar', label: 'Buscar' },
  { href: '/pokemon', label: 'Pokédex' },
  { href: '/items', label: 'Objetos' },
  { href: '/recipes', label: 'Recetas' },
  { href: '/towns', label: 'Pueblos' },
  { href: '/progression', label: 'Progresión' },
  { href: '/automation', label: 'Automatización' },
  { href: '/planner', label: 'Planner' },
  { href: '/tools', label: 'Herramientas' },
  { href: '/my-pokopia', label: 'My Pokopia' },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>
        <AppShell>
          <Header title="Pokopia" subtitle="Companion" nav={nav} actions={<CommandPalette />} />
          <div id="main-content" tabIndex={-1}>
            {children}
          </div>
          <footer className="footer">
            Hecho con datos trazables. Las recomendaciones siempre se distinguen de los datos
            extraídos.
          </footer>
        </AppShell>
      </body>
    </html>
  );
}
