import { Badge, Card, EmptyState, PageIntro } from '@pokopia/ui';
import { PRESET_WEIGHTS, rankPokemon, rolesForContext, type ScoringPreset } from '@pokopia/scoring';
import { repository } from '@/lib/data';
import { humanizeGameValue } from '@/lib/presentation';
import Link from 'next/link';
import { firstParam, type SearchParamValue } from '@/lib/search-params';

type Props = {
  params: Promise<{ context: string }>;
  searchParams: Promise<{
    preset?: SearchParamValue;
    mode?: SearchParamValue;
    team?: SearchParamValue;
  }>;
};

export default async function RankingPage({ params, searchParams }: Props) {
  const { context } = await params;
  const requested = safeDecode(context);
  const raw = await searchParams;
  const query = {
    preset: firstParam(raw.preset),
    mode: firstParam(raw.mode),
    team: firstParam(raw.team),
  };
  const rawPreset = query.preset;
  // Own-property check: `in` also accepts prototype keys such as `toString`.
  const preset: ScoringPreset =
    rawPreset && Object.hasOwn(PRESET_WEIGHTS, rawPreset)
      ? (rawPreset as ScoringPreset)
      : 'Balanced';
  const allPokemon = (await repository()).listPokemon(10_000);
  const teamMode = query.mode === 'team';
  const currentTeam = teamMode ? allPokemon.filter((entry) => entry.slug === query.team) : [];
  const ranked = rankPokemon(
    allPokemon.filter((entry) => !currentTeam.some((member) => member.slug === entry.slug)),
    requested,
    PRESET_WEIGHTS[preset],
    currentTeam,
  ).slice(0, 25);
  const roles = rolesForContext(requested);
  return (
    <main>
      <PageIntro
        eyebrow="Recomendación derivada"
        title={`Mejores Pokémon para ${humanizeGameValue(context.replaceAll('-', ' '))}`}
      >
        <p>
          Comparamos capacidades objetivas, ajuste contextual y calidad de evidencia. Los campos
          ausentes permanecen unknown y no valen cero.
        </p>
      </PageIntro>
      <form className="ranking-controls card" method="get">
        <label>
          <span>Perfil de pesos</span>
          <select name="preset" defaultValue={preset}>
            {Object.keys(PRESET_WEIGHTS).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button type="submit">Recalcular</button>
        <label>
          <span>Modo de ranking</span>
          <select name="mode" defaultValue={teamMode ? 'team' : 'individual'}>
            <option value="individual">Mejor individual</option>
            <option value="team">Mejor incorporación al equipo</option>
          </select>
        </label>
        <label>
          <span>Pokémon ya en el equipo</span>
          <select name="team" defaultValue={query.team ?? ''}>
            <option value="">Ninguno confirmado</option>
            {allPokemon.map((pokemon) => (
              <option value={pokemon.slug} key={pokemon.slug}>
                {pokemon.name}
              </option>
            ))}
          </select>
        </label>
        <span>Roles buscados: {roles.join(', ') || 'sin mapeo fiable'}</span>
      </form>
      {ranked.length ? (
        <>
          <p className="evidence-banner">
            Resultados con la misma puntuación comparten posición probatoria: el orden alfabético no
            afirma que uno sea mejor.
          </p>
          <div className="result-list ranking-list">
            {ranked.map((entry, index) => (
              <Card className="result" key={entry.pokemon.slug}>
                <span className="result-index">{evidenceRank(ranked, index)}</span>
                <div className="result-copy">
                  <Badge tone={entry.recommendationBand === 'strong' ? 'good' : 'warn'}>
                    {entry.recommendationBand} · {entry.mode.replaceAll('_', ' ')} · confianza{' '}
                    {entry.confidence}
                  </Badge>
                  <h2>
                    <Link href={`/pokemon/${entry.pokemon.slug}`}>{entry.pokemon.name}</Link>
                  </h2>
                  <div className="score-strip">
                    <span>
                      Capability <strong>{entry.objectiveCapabilityScore ?? 'unknown'}</strong>
                    </span>
                    <span>
                      Context <strong>{entry.contextualScore ?? 'unknown'}</strong>
                    </span>
                    <span>
                      Evidence coverage <strong>{entry.evidenceCoverage}%</strong>
                    </span>
                    <span>
                      Calidad evidencia <strong>{entry.evidenceQualityScore}%</strong>
                    </span>
                    <span>
                      Confianza reconstruible <strong>{entry.confidenceScore}%</strong>
                    </span>
                    <span>
                      Ganancia marginal{' '}
                      <strong>
                        {entry.mode === 'team_addition'
                          ? `${entry.marginalRoleGain} roles`
                          : 'no aplica'}
                      </strong>
                    </span>
                  </div>
                  {entry.tie.isTie ? (
                    <div className="evidence-banner">
                      <strong>
                        Empate probatorio con {entry.tie.withSlugs.length} candidatos.
                      </strong>{' '}
                      {entry.tie.reason}
                      <details>
                        <summary>Ver candidatos empatados</summary>
                        <p>{entry.tie.withSlugs.join(', ')}</p>
                      </details>
                    </div>
                  ) : null}
                  <div className="chip-list">
                    {entry.matchedRoles.map((role) => (
                      <span className="chip chip-derived" key={role}>
                        {role}
                      </span>
                    ))}
                  </div>
                  <details>
                    <summary>Ver evidencia y limitaciones</summary>
                    {entry.explanations.map((explanation) => (
                      <p key={explanation.dimension}>
                        <strong>
                          {explanation.contribution === null
                            ? 'unknown'
                            : `${Math.round(explanation.contribution * 100)} pts`}
                        </strong>{' '}
                        · {explanation.reason}
                      </p>
                    ))}
                    <ul className="plain-list">
                      {entry.unknowns.map((unknown) => (
                        <li key={unknown}>{unknown}</li>
                      ))}
                    </ul>
                  </details>
                  <Link
                    className="button button-secondary"
                    href={`/compare?kind=pokemon&left=${entry.pokemon.slug}&context=${encodeURIComponent(requested)}`}
                  >
                    Comparar Pokémon
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <EmptyState title="Evidencia insuficiente">
          No existe un mapeo de roles suficientemente fiable para este contexto. No mostramos un
          ranking artificial.
        </EmptyState>
      )}
    </main>
  );
}

function evidenceRank(
  ranked: readonly ReturnType<typeof rankPokemon>[number][],
  index: number,
): number {
  const entry = ranked[index];
  if (!entry) return index + 1;
  const first = ranked.findIndex(
    (candidate) =>
      (entry.mode === 'individual' || candidate.marginalRoleGain === entry.marginalRoleGain) &&
      candidate.recommendationScore === entry.recommendationScore &&
      candidate.objectiveCapabilityScore === entry.objectiveCapabilityScore &&
      candidate.evidenceQualityScore === entry.evidenceQualityScore,
  );
  return first + 1;
}

// Route params arrive decoded; decoding again throws on a literal `%` (for example `/best-pokemon/%25`).
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
