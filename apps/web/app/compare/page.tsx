import { notFound } from 'next/navigation';
import { Badge, Card, PageIntro, SourceNote } from '@pokopia/ui';
import { compareItems, rankPokemonV2 } from '@pokopia/intelligence';
import { repository } from '@/lib/data';
import type { GameDataRepository } from '@pokopia/game-data';
import { firstParam, type SearchParamValue } from '@/lib/search-params';

export const metadata = { title: 'Comparar' };
type Props = {
  searchParams: Promise<{
    kind?: SearchParamValue;
    left?: SearchParamValue;
    right?: SearchParamValue;
    context?: SearchParamValue;
  }>;
};

export default async function ComparePage({ searchParams }: Props) {
  const raw = await searchParams;
  const params = {
    kind: firstParam(raw.kind),
    left: firstParam(raw.left),
    right: firstParam(raw.right),
    context: firstParam(raw.context),
  };
  const kind = params.kind === 'pokemon' ? 'pokemon' : 'storage';
  const context = params.context ?? 'General';
  const data = await repository();
  const storageOptions = data
    .listItems(10_000)
    .filter((item) => item.isContainer === true)
    .slice(0, 80);
  const pokemonOptions = data.listPokemon(10_000);
  const defaultLeft = kind === 'pokemon' ? 'tinkaton' : 'big-storage-box';
  const defaultRight = kind === 'pokemon' ? 'machop' : 'portal-pod';
  const leftSlug = params.left ?? defaultLeft;
  const rightSlug = params.right ?? defaultRight;
  return (
    <main>
      <PageIntro eyebrow="Comparison Engine" title="¿Cuál deberías elegir?">
        <p>
          Compara la diferencia funcional y la evidencia; un unknown nunca se convierte en ventaja.
        </p>
      </PageIntro>
      <form className="comparison-controls card" action="/compare">
        <label>
          <span>Tipo</span>
          <select name="kind" defaultValue={kind}>
            <option value="storage">Storage vs storage</option>
            <option value="pokemon">Pokémon vs Pokémon</option>
          </select>
        </label>
        <label>
          <span>Primera opción</span>
          <select name="left" defaultValue={leftSlug}>
            {(kind === 'pokemon' ? pokemonOptions : storageOptions).map((entry) => (
              <option value={entry.slug} key={entry.slug}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Segunda opción</span>
          <select name="right" defaultValue={rightSlug}>
            {(kind === 'pokemon' ? pokemonOptions : storageOptions).map((entry) => (
              <option value={entry.slug} key={entry.slug}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Contexto</span>
          <select name="context" defaultValue={context}>
            {['General', 'Early Game', 'Endgame', 'Automation', 'Progression'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button className="button" type="submit">
          Comparar
        </button>
      </form>
      {kind === 'pokemon' ? (
        <PokemonComparison
          data={data}
          leftSlug={leftSlug}
          rightSlug={rightSlug}
          context={context}
        />
      ) : (
        <StorageComparison
          data={data}
          leftSlug={leftSlug}
          rightSlug={rightSlug}
          context={context}
        />
      )}
    </main>
  );
}

function StorageComparison({
  data,
  leftSlug,
  rightSlug,
  context,
}: {
  data: GameDataRepository;
  leftSlug: string;
  rightSlug: string;
  context: string;
}) {
  const comparison = compareItems(data, leftSlug, rightSlug, context);
  if (!comparison) notFound();
  return (
    <section className="comparison-result">
      <Card className="choice-verdict">
        <p className="eyebrow">Which should I choose?</p>
        <h2>{comparison.recommendation ?? 'Evidencia insuficiente'}</h2>
        <p>{comparison.rationale}</p>
        <Badge tone={comparison.confidence === 'medium' ? 'good' : 'warn'}>
          Confidence · {comparison.confidence}
        </Badge>
      </Card>
      <div className="comparison-grid">
        <article className="comparison-column comparison-labels" aria-hidden="true">
          <strong>Criterio</strong>
          {comparison.axes.map((axis) => (
            <span key={axis.label}>{axis.label}</span>
          ))}
        </article>
        {[comparison.left, comparison.right].map((item, optionIndex) => (
          <article className="comparison-column" key={item.slug}>
            <strong>{item.name}</strong>
            {comparison.axes.map((axis) => (
              <span key={axis.label}>
                {optionIndex === 0 ? axis.left : axis.right}
                {axis.confidence === 'unknown' ? <small>Unknown</small> : null}
              </span>
            ))}
          </article>
        ))}
      </div>
      <details className="advanced-details">
        <summary>Unknowns y evidencia</summary>
        <ul className="plain-list">
          {comparison.unknowns.map((unknown) => (
            <li key={unknown}>{unknown}</li>
          ))}
        </ul>
      </details>
      <div className="grid grid-wide">
        <SourceNote
          {...comparison.left.source}
          status={comparison.left.source.verificationStatus}
        />
        <SourceNote
          {...comparison.right.source}
          status={comparison.right.source.verificationStatus}
        />
      </div>
    </section>
  );
}

function PokemonComparison({
  data,
  leftSlug,
  rightSlug,
  context,
}: {
  data: GameDataRepository;
  leftSlug: string;
  rightSlug: string;
  context: string;
}) {
  const candidates = [
    data.listPokemon(10_000).find((entry) => entry.slug === leftSlug),
    data.listPokemon(10_000).find((entry) => entry.slug === rightSlug),
  ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  if (candidates.length !== 2) notFound();
  const ranked = rankPokemonV2(candidates, context);
  const winner = ranked[0];
  return (
    <section className="comparison-result">
      <Card className="choice-verdict">
        <p className="eyebrow">Best individual Pokémon · {context}</p>
        <h2>{winner?.pokemon.name ?? 'Evidencia insuficiente'}</h2>
        <p>
          {winner
            ? `${winner.recommendationBand} para este objetivo; no evalúa todavía tu composición.`
            : 'El contexto no mapea a roles respaldados por specialty.'}
        </p>
      </Card>
      <div className="grid grid-wide">
        {candidates.map((pokemon) => {
          const result = ranked.find((entry) => entry.pokemon.slug === pokemon.slug);
          return (
            <Card key={pokemon.slug}>
              <h2>{pokemon.name}</h2>
              <p>{pokemon.specialty ?? 'Specialty unknown'}</p>
              <div className="score-strip">
                <span>Score {result?.score ?? 'Unknown'}</span>
                <span>Confidence {result?.confidence ?? 'Unknown'}</span>
                <span>Evidence {result?.evidenceCoverage ?? 0}%</span>
              </div>
              <div className="chip-list">
                {pokemon.roles.map((role) => (
                  <span className="chip" key={role.role}>
                    {role.role}
                  </span>
                ))}
              </div>
              <details className="advanced-details">
                <summary>Evidencia y unknowns</summary>
                <ul className="plain-list">
                  {(result?.unknowns ?? ['Sin recomendación']).map((unknown) => (
                    <li key={unknown}>{unknown}</li>
                  ))}
                </ul>
              </details>
              <SourceNote {...pokemon.source} status={pokemon.source.verificationStatus} />
            </Card>
          );
        })}
      </div>
    </section>
  );
}
