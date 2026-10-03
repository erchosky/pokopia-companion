import Link from 'next/link';
import { Card, PageIntro } from '@pokopia/ui';

export const metadata = { title: 'Herramientas' };

const tools = [
  {
    href: '/planner',
    title: 'Planner multiobjetivo',
    description:
      'Combina objetivos, dependencias compartidas, unknowns y what-if sin fake optimality.',
  },
  {
    href: '/compare',
    title: 'Comparar opciones',
    description: 'Pokémon, storage y sistemas con unknowns y recomendación contextual.',
  },
  {
    href: '/best-pokemon/construction',
    title: 'Best Pokémon For',
    description: 'Capacidad individual o valor marginal para una composición.',
  },
  {
    href: '/automation#planner',
    title: 'Automation Planner',
    description: 'Elige zona y objetivo; revisa requisitos, orden y blockers.',
  },
  {
    href: '/recipes',
    title: 'Craft Planner',
    description: 'Calcula copias, dependencias recursivas y cantidades desconocidas.',
  },
] as const;

export default function ToolsPage() {
  return (
    <main>
      <PageIntro eyebrow="Herramientas" title="Resuelve una decisión">
        <p>Elige el problema; cada herramienta explica evidencia, límites y siguientes pasos.</p>
      </PageIntro>
      <div className="grid grid-wide">
        {tools.map((tool) => (
          <Link href={tool.href} key={tool.href}>
            <Card className="card-link entity-card">
              <h2>{tool.title}</h2>
              <p>{tool.description}</p>
              <span className="card-arrow">Abrir →</span>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
