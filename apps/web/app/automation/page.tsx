import { Badge, Card, EmptyState, PageIntro, SourceNote } from '@pokopia/ui';
import { repository } from '@/lib/data';
import Link from 'next/link';
import { BuildReadiness, GoalAction } from '@/components/progress-actions';
import { AutomationPlanner } from '@/components/automation-planner';

export const metadata = { title: 'Automation Hub' };

export default async function AutomationPage() {
  const data = await repository();
  const systems = data.listAutomationSystems();
  const towns = data.listTowns().map(({ slug, name }) => ({ slug, name }));
  const pokemonRoles = Object.fromEntries(
    data
      .listPokemon(10_000)
      .map((pokemon) => [pokemon.slug, pokemon.roles.map((role) => role.role)]),
  );
  return (
    <main>
      <PageIntro eyebrow="Automation Hub" title="Sistemas que ahorran trabajo">
        <p>
          Catálogo conservador: solo aparecen objetos cuya ficha describe conducta automática,
          generación, activación, riego, transmisión eléctrica o almacenamiento conectado.
        </p>
      </PageIntro>
      <div id="planner">
        <AutomationPlanner systems={systems} towns={towns} pokemonRoles={pokemonRoles} />
      </div>
      {systems.length ? (
        <div className="automation-list">
          {systems.map((system) => (
            <Card className="automation-card" id={system.slug} key={system.slug}>
              <div className="automation-heading">
                <div>
                  <Badge tone={system.quantitative.length ? 'accent' : 'neutral'}>
                    {system.quantitative.length
                      ? `${system.quantitative.length} valores cuantitativos`
                      : 'Solo estructural'}
                  </Badge>
                  <h2>{system.name}</h2>
                </div>
                {system.source.url.includes('/build/') ? (
                  <a
                    className="button button-secondary"
                    href={system.source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Ver fuente
                  </a>
                ) : (
                  <Link className="button button-secondary" href={`/items/${system.slug}`}>
                    Abrir objeto
                  </Link>
                )}
              </div>
              <div className="automation-grid">
                <div>
                  <strong>QUÉ HACE</strong>
                  <p>{system.what}</p>
                </div>
                <div>
                  <strong>POR QUÉ IMPORTA</strong>
                  <p>{system.why}</p>
                </div>
                <div>
                  <strong>DESBLOQUEO</strong>
                  <p>{system.unlock ?? 'Desconocido'}</p>
                </div>
                <div>
                  <strong>ZONAS COMPATIBLES</strong>
                  <p>{system.compatibleTowns.join(', ') || 'Compatibilidad desconocida'}</p>
                </div>
              </div>
              <div className="automation-grid automation-operations">
                <div>
                  <strong>POKÉMON</strong>
                  <p>{system.pokemon?.join(', ') ?? 'No hay un rol obligatorio documentado'}</p>
                </div>
                <div>
                  <strong>INFRAESTRUCTURA</strong>
                  <p>{system.infrastructure?.join(', ') ?? 'Desconocida'}</p>
                </div>
                <div>
                  <strong>INPUTS OPERATIVOS</strong>
                  <p>{system.operationalInputs?.join(', ') ?? 'Desconocidos'}</p>
                </div>
                <div>
                  <strong>EFECTOS OPERATIVOS</strong>
                  <p>{system.operationalOutputs?.join(', ') ?? 'Desconocidos'}</p>
                </div>
              </div>
              <div
                className="production-chain"
                role="group"
                aria-label={`Cadena estructural de ${system.name}`}
              >
                <div>
                  <small>Construcción</small>
                  <strong>
                    {system.requirements.map((entry) => entry.name).join(' + ') || 'Receta unknown'}
                  </strong>
                </div>
                <span aria-hidden="true">→</span>
                <div>
                  <small>Sistema</small>
                  <strong>{system.name}</strong>
                </div>
                <span aria-hidden="true">→</span>
                <div>
                  <small>Efecto, no material</small>
                  <strong>{system.operationalOutputs?.join(' + ') ?? 'Unknown'}</strong>
                </div>
              </div>
              <div className="score-strip" aria-label="Detalles conocidos y desconocidos">
                <span>KNOWN · comportamiento respaldado por fuente</span>
                <span>QUANT · {system.quantitative.length} valores documentados</span>
                <span>UNKNOWN · {system.limitations.length} límites abiertos</span>
              </div>
              {system.quantitative.length ? (
                <div>
                  <h3>Parámetros cuantitativos</h3>
                  <div className="compact-list">
                    {system.quantitative.map((parameter) => (
                      <span key={parameter.id}>
                        {parameterLabel(parameter.predicate)} · {parameter.value}{' '}
                        {unitLabel(parameter.unit)}
                        {parameter.qualifier ? ` · ${qualifierLabel(parameter.qualifier)}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="grid grid-wide">
                <div>
                  <h3>Requisitos / objetos</h3>
                  {system.requirements.length ? (
                    <div className="compact-list">
                      {system.requirements.map((ingredient) => (
                        <span key={ingredient.slug}>
                          {ingredient.name} × {ingredient.quantity ?? '?'}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p>Receta no estructurada.</p>
                  )}
                </div>
                <div>
                  <h3>Límites conocidos</h3>
                  <ul className="plain-list">
                    {system.limitations.map((limitation) => (
                      <li key={limitation}>{limitation}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <BuildReadiness ingredients={system.requirements} />
              <GoalAction
                type="build-automation"
                slug={system.slug}
                label={`Construir ${system.name}`}
              />
              <SourceNote
                url={system.source.url}
                snapshot={system.source.snapshot}
                status={system.source.verificationStatus}
              />
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Evidencia insuficiente">
          No hay sistemas con evidencia estructurada suficiente.
        </EmptyState>
      )}
    </main>
  );
}

function parameterLabel(predicate: string): string {
  return (
    {
      build_depth: 'Profundidad de construcción',
      build_duration: 'Tiempo de construcción',
      build_height: 'Altura de construcción',
      build_width: 'Anchura de construcción',
      build_worker_count: 'Equipo de construcción',
      connection_capacity: 'Conexiones máximas',
      display_capacity: 'Capacidad mostrada',
      power_demand: 'Consumo eléctrico',
      power_generation: 'Generación eléctrica',
      power_per_light: 'Energía por luz',
      transmission_range: 'Alcance de transmisión',
      watering_axial_range: 'Alcance axial de riego',
      watering_capacity: 'Cobertura de riego',
    }[predicate] ?? textLabel(predicate)
  );
}

function unitLabel(unit: string): string {
  return (
    {
      power_unit: 'unidades de energía',
      block: 'bloques',
      connection: 'conexiones',
      item: 'objetos',
      pokemon: 'Pokémon',
      hour: 'hora',
      day: 'días',
      tile: 'casillas',
    }[unit] ?? textLabel(unit)
  );
}

function textLabel(value: string): string {
  return value.replaceAll('_', ' ').replaceAll(':', ' · ');
}

function qualifierLabel(value: string): string {
  return (
    {
      high_altitude: 'gran altitud',
      standard: 'estándar',
      'specialty:build': 'especialidad · Build',
      to_target: 'hasta el objetivo',
      between_transmitters: 'entre transmisores',
      diamond: 'patrón rombo',
    }[value] ?? textLabel(value)
  );
}
