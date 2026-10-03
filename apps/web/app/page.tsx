import { Badge, Card, Metric } from '@pokopia/ui';
import { repository } from '@/lib/data';
import Link from 'next/link';
import { humanizeGameValue } from '@/lib/presentation';
import { HomeProgress } from '@/components/home-progress';
import { SEARCH_MAX_LENGTH } from '@pokopia/search';

const quickActions = [
  {
    href: '/planner',
    icon: '↗',
    title: 'Planifica varios objetivos',
    description: 'Comparte requisitos y decide qué confirmar o hacer primero.',
    action: 'Abrir planner',
  },
  {
    href: '/buscar?q=pokemon+para+regar',
    icon: '✦',
    title: 'Encuentra un ayudante',
    description: 'Busca por tarea, especialidad o hábitat.',
    action: 'Probar búsqueda',
  },
  {
    href: '/items',
    icon: '□',
    title: 'Consigue un objeto',
    description: 'Localiza, compara y sigue su desbloqueo.',
    action: 'Buscar objetos',
  },
  {
    href: '/recipes',
    icon: '◇',
    title: 'Fabrica algo',
    description: 'Calcula materiales para varias copias.',
    action: 'Abrir crafting',
  },
  {
    href: '/towns',
    icon: '⌂',
    title: 'Mejora un pueblo',
    description: 'Niveles, unlocks, recursos y optimizer.',
    action: 'Elegir zona',
  },
  {
    href: '/automation',
    icon: '⚙',
    title: 'Automatiza una tarea',
    description: 'Sistemas reales, requisitos y límites.',
    action: 'Ver sistemas',
  },
  {
    href: '/best-pokemon/logistics',
    icon: '⇄',
    title: 'Elige residentes',
    description: 'Rankings conservadores con evidencia.',
    action: 'Comparar roles',
  },
  {
    href: '/buscar?q=resources',
    icon: '◆',
    title: 'Encuentra recursos',
    description: 'Busca materiales, zonas y recetas.',
    action: 'Buscar recursos',
  },
  {
    href: '/my-pokopia',
    icon: '✓',
    title: 'Sigue tu progreso',
    description: 'Objetivos, próximos pasos, pueblos y favoritos.',
    action: 'Abrir My Pokopia',
  },
  {
    href: '/progression',
    icon: '↟',
    title: 'Avanza en la historia',
    description: 'Requests, mapas y movimientos con requisitos trazables.',
    action: 'Abrir progresión',
  },
  {
    href: '/collectibles',
    icon: '♫',
    title: 'Completa tus CDs',
    description: '53 conocidos, con Base y Expansion Pass separados.',
    action: 'Ver colección',
  },
] as const;

export default async function HomePage() {
  const data = await repository();
  const health = data.health();
  const pokemon = data.listPokemon(6);
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <Badge tone="accent">Datos reales conectados</Badge>
          <h1>Menos buscar. Más construir.</h1>
          <p>
            Encuentra el Pokémon, objeto o receta que necesitas y entiende por qué encaja en tu
            próximo paso.
          </p>
        </div>
        <form className="search-form" action="/buscar">
          <label className="sr-only" htmlFor="home-search">
            Buscar
          </label>
          <input
            id="home-search"
            name="q"
            placeholder="¿Qué necesitas hacer o encontrar?"
            required
            minLength={2}
            maxLength={SEARCH_MAX_LENGTH}
          />
          <button type="submit">Buscar</button>
        </form>
        <div className="suggestion-row" aria-label="Búsquedas sugeridas">
          <span>Prueba:</span>
          <Link className="suggestion-chip" href="/buscar?q=pokemon+para+regar">
            Pokémon para regar
          </Link>
          <Link className="suggestion-chip" href="/buscar?q=storage+box">
            Storage Box
          </Link>
          <Link className="suggestion-chip" href="/buscar?q=recetas">
            Recetas
          </Link>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Empieza aquí</p>
          <h2>¿Qué quieres hacer?</h2>
        </div>
        <p>Atajos a las tareas más útiles</p>
      </div>
      <HomeProgress />
      <div className="quick-actions">
        {quickActions.map((action) => (
          <Link className="action-card" href={action.href} key={action.href}>
            <span className="action-icon" aria-hidden="true">
              {action.icon}
            </span>
            <div>
              <h3>{action.title}</h3>
              <p>{action.description}</p>
            </div>
            <span>{action.action} →</span>
          </Link>
        ))}
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Cobertura</p>
          <h2>Tu mapa del juego, conectado</h2>
        </div>
        <p>Actualizado desde {health.snapshot}</p>
      </div>
      <div className="metric-grid">
        <Metric label="Pokémon conectados" value={data.listPokemon(1000).length} />
        <Metric label="Objetos navegables" value={data.listItems(10_000).length} />
        <Metric label="Recetas calculables" value={data.listRecipes(10_000).length} />
        <Metric
          label="Hitos de progresión"
          value={
            data.listQuests().length + data.listTreasureMaps().length + data.listDittoMoves().length
          }
        />
        <Metric label="CDs conocidos" value={data.listCollectibles().length} />
        <Metric label="Páginas analizadas" value={health.pages.toLocaleString('es-ES')} />
        <Metric
          label="Confianza"
          value="Trazable"
          hint="Hecho e inferencia se muestran separados"
        />
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Descubrir</p>
          <h2>Descubre Pokémon</h2>
        </div>
        <Link href="/pokemon">Ver Pokédex →</Link>
      </div>
      <div className="grid">
        {pokemon.map((entry) => (
          <Link key={entry.slug} href={`/pokemon/${entry.slug}`}>
            <Card className="card-link entity-card">
              <Badge>{entry.number ? `#${entry.number}` : 'Pokémon'}</Badge>
              <h3>{entry.name}</h3>
              <p>
                {humanizeGameValue(entry.specialty)} · {humanizeGameValue(entry.habitat)}
              </p>
              <span className="card-arrow">Abrir ficha →</span>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
