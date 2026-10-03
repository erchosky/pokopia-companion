'use client';

import { useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import type { AutomationSystem, TownDetail } from '@pokopia/game-data';
import {
  analyzeTown,
  TOWN_PRESET_ROLES,
  type TownPokemonCandidate,
  type TownCandidateMode,
  type TownPreset,
} from '@pokopia/intelligence';
import {
  EMPTY_PROGRESS_SERIALIZED,
  parseProgress,
  progressId,
  readProgressSnapshot,
  subscribeProgress,
  writeProgress,
} from '@/lib/progress-store';

const HEALTH_LABELS = {
  complete: 'Complete',
  partial: 'Partial',
  missing: 'Missing',
  unknown: 'Unknown',
} as const;

export function TownOptimizer({
  town,
  pokemon,
  compatibleAutomation,
}: {
  town: TownDetail;
  pokemon: readonly TownPokemonCandidate[];
  compatibleAutomation: readonly AutomationSystem[];
}) {
  const [preset, setPreset] = useState<TownPreset>('Balanced');
  const [candidateMode, setCandidateMode] = useState<TownCandidateMode>('known_collection');
  const [residentToAdd, setResidentToAdd] = useState('');
  const snapshot = useSyncExternalStore(
    subscribeProgress,
    readProgressSnapshot,
    () => EMPTY_PROGRESS_SERIALIZED,
  );
  const progress = useMemo(() => parseProgress(snapshot), [snapshot]);
  const residentSlugs = useMemo(
    () => progress.townResidents[town.slug] ?? [],
    [progress.townResidents, town.slug],
  );
  const ownedSlugs = useMemo(
    () =>
      pokemon
        .filter((entry) => progress.entries[progressId('pokemon', entry.slug)]?.value === true)
        .map((entry) => entry.slug),
    [pokemon, progress.entries],
  );
  const builtAutomationSlugs = useMemo(
    () =>
      compatibleAutomation
        .filter((system) => progress.entries[progressId('automation', system.slug)]?.value === true)
        .map((system) => system.slug),
    [compatibleAutomation, progress.entries],
  );
  const level = Number(progress.entries[`town:${town.slug}:level`]?.value) || null;
  const analysis = useMemo(() => {
    const ownership = Object.fromEntries(
      pokemon.map((entry) => {
        const value = progress.entries[progressId('pokemon', entry.slug)]?.value;
        return [entry.slug, value === true ? 'owned' : value === false ? 'not_owned' : 'unknown'];
      }),
    ) as Record<string, 'owned' | 'not_owned' | 'unknown'>;
    const input = {
      town,
      pokemon,
      residentSlugs,
      preset,
      compatibleAutomation,
      builtAutomationSlugs,
      userLevel: level,
      ownership,
      candidateMode,
    };
    return analyzeTown(input);
  }, [
    builtAutomationSlugs,
    compatibleAutomation,
    candidateMode,
    level,
    pokemon,
    preset,
    progress.entries,
    residentSlugs,
    town,
  ]);
  const setResidents = (next: readonly string[]) => {
    writeProgress({
      ...progress,
      townResidents: { ...progress.townResidents, [town.slug]: next },
    });
  };
  const addResident = () => {
    if (!residentToAdd || residentSlugs.includes(residentToAdd)) return;
    setResidents([...residentSlugs, residentToAdd]);
    setResidentToAdd('');
  };
  return (
    <section className="optimizer" id="optimizer">
      <div className="optimizer-header">
        <div>
          <p className="eyebrow">Town Intelligence V2</p>
          <h2>¿Qué deberías mejorar ahora?</h2>
          <p>Analiza residentes confirmados. Owned no implica residencia; debes añadirlos aquí.</p>
        </div>
        <label>
          <span>Objetivo</span>
          <select value={preset} onChange={(event) => setPreset(event.target.value as TownPreset)}>
            {Object.keys(TOWN_PRESET_ROLES).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Perfil de candidatos</span>
          <select
            aria-label="Perfil de candidatos"
            value={candidateMode}
            onChange={(event) => setCandidateMode(event.target.value as TownCandidateMode)}
          >
            <option value="known_collection">Colección conocida</option>
            <option value="owned_only">Solo Owned</option>
            <option value="ideal">Ideal, aunque no lo tenga</option>
          </select>
        </label>
      </div>

      <div className="resident-picker card">
        <div>
          <strong>Town Residents</strong>
          <p>Composición explícita: {residentSlugs.length} residentes.</p>
        </div>
        <label>
          <span className="sr-only">Añadir residente a {town.name}</span>
          <select value={residentToAdd} onChange={(event) => setResidentToAdd(event.target.value)}>
            <option value="">Elige un Pokémon…</option>
            {pokemon
              .filter((entry) => !residentSlugs.includes(entry.slug))
              .map((entry) => (
                <option value={entry.slug} key={entry.slug}>
                  {entry.name}
                  {ownedSlugs.includes(entry.slug) ? ' · Owned' : ''}
                </option>
              ))}
          </select>
        </label>
        <button className="button" type="button" onClick={addResident} disabled={!residentToAdd}>
          Añadir
        </button>
      </div>

      {analysis.residents.length ? (
        <div className="resident-list">
          {analysis.residents.map((resident) => (
            <article className="resident-row" key={resident.pokemon.slug}>
              <div>
                <span
                  className={`health-pill state-${resident.category === 'redundant' ? 'missing' : 'partial'}`}
                >
                  {resident.category.replaceAll('_', ' ')}
                </span>
                <strong>{resident.pokemon.name}</strong>
                <small>{resident.reason}</small>
              </div>
              <button
                type="button"
                onClick={() =>
                  setResidents(residentSlugs.filter((slug) => slug !== resident.pokemon.slug))
                }
              >
                Quitar
              </button>
            </article>
          ))}
        </div>
      ) : (
        <p className="unknown-state">
          Añade residentes para evaluar cobertura y redundancia. No usamos los Pokémon relacionados
          con la zona como residencia automática.
        </p>
      )}

      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">Town Health</p>
          <h3>Estado por dimensiones</h3>
        </div>
      </div>
      <p className="unknown-state" data-testid="optimizer-profile-summary">
        Perfil {analysis.candidateMode.replaceAll('_', ' ')} · colección{' '}
        {analysis.ownershipCompleteness}. Mejor Owned:{' '}
        {analysis.ownedRecommendations[0]?.with.name ?? 'sin candidato confirmado'} · mejora ideal:{' '}
        {analysis.idealRecommendations[0]?.with.name ?? 'sin candidato documentado'}. Límite de
        residentes: unknown.
      </p>
      <div className="health-grid">
        {analysis.health.map((signal) => (
          <article className="health-card" key={signal.dimension}>
            <span className={`health-pill state-${signal.state}`}>
              {HEALTH_LABELS[signal.state]}
            </span>
            <h3>{signal.dimension}</h3>
            <p>{signal.summary}</p>
            <details>
              <summary>Por qué</summary>
              <small>{signal.evidence}</small>
            </details>
          </article>
        ))}
      </div>

      <div className="role-coverage-strip">
        <div>
          <span className="eyebrow">Coverage verificable</span>
          <strong>
            {analysis.coveredRoles.length} / {analysis.requiredRoles.length} roles
          </strong>
        </div>
        <div className="chip-list">
          {analysis.requiredRoles.map((role) => (
            <span
              className={`chip ${analysis.coveredRoles.includes(role) ? 'chip-covered' : 'chip-missing'}`}
              title={analysis.roleReasons[role]}
              key={role}
            >
              {role}
            </span>
          ))}
        </div>
      </div>

      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">Top 3 improvements</p>
          <h3>Acciones explicables</h3>
        </div>
      </div>
      {analysis.topImprovements.length ? (
        <div className="improvement-list">
          {analysis.topImprovements.map((improvement, index) => (
            <article className="improvement-row" key={`${improvement.title}:${index}`}>
              <span className="result-index">{index + 1}</span>
              <div>
                <h3>{improvement.title}</h3>
                <p>{improvement.why}</p>
                <dl className="micro-definition">
                  <div>
                    <dt>Benefit</dt>
                    <dd>{improvement.benefit}</dd>
                  </div>
                  <div>
                    <dt>Tradeoff</dt>
                    <dd>{improvement.tradeoff}</dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>{improvement.confidence}</dd>
                  </div>
                </dl>
                <details>
                  <summary>Evidence</summary>
                  <small>{improvement.evidence}</small>
                </details>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="unknown-state">No recommendation: faltan gaps o evidencia accionable.</p>
      )}
      <div className="optimizer-footer">
        <Link href="/best-pokemon/construction">Explorar Best Pokémon For →</Link>
        <Link href="/compare?kind=pokemon">Comparar dos Pokémon →</Link>
      </div>
    </section>
  );
}
