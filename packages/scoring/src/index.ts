import type { PokemonSummary, RoleSlug } from '@pokopia/game-data';

export type ScoreDimension = 'objective_capability' | 'contextual_fit' | 'evidence_quality';
export type ScoreWeights = Readonly<Record<ScoreDimension, number>>;
export type ScoringPreset =
  'Balanced' | 'Automation' | 'Production' | 'Progression' | 'Compact' | 'Endgame';

export interface ScoreExplanation {
  readonly dimension: ScoreDimension;
  readonly value: number | null;
  readonly weight: number;
  readonly contribution: number | null;
  readonly reason: string;
}

export interface RankedPokemon {
  readonly pokemon: PokemonSummary;
  readonly objectiveCapabilityScore: number | null;
  readonly contextualScore: number | null;
  readonly recommendationScore: number | null;
  readonly score: number | null;
  readonly evidenceCoverage: number;
  readonly dataCoverage: number;
  readonly evidenceQualityScore: number;
  readonly confidenceScore: number;
  readonly confidence: 'medium' | 'low';
  readonly recommendationBand: 'strong' | 'useful' | 'situational';
  readonly mode: 'individual' | 'team_addition';
  readonly matchedRoles: readonly RoleSlug[];
  readonly uniqueRoles: readonly RoleSlug[];
  readonly marginalRoleGain: number;
  readonly unknowns: readonly string[];
  readonly explanations: readonly ScoreExplanation[];
  readonly status: 'derived' | 'insufficient_evidence';
  readonly tie: {
    readonly isTie: boolean;
    readonly withSlugs: readonly string[];
    readonly reason: string | null;
  };
}

export const PRESET_WEIGHTS: Readonly<Record<ScoringPreset, ScoreWeights>> = {
  Balanced: { objective_capability: 0.65, contextual_fit: 0.2, evidence_quality: 0.15 },
  Automation: { objective_capability: 0.75, contextual_fit: 0.1, evidence_quality: 0.15 },
  Production: { objective_capability: 0.7, contextual_fit: 0.15, evidence_quality: 0.15 },
  Progression: { objective_capability: 0.6, contextual_fit: 0.25, evidence_quality: 0.15 },
  Compact: { objective_capability: 0.7, contextual_fit: 0.2, evidence_quality: 0.1 },
  Endgame: { objective_capability: 0.65, contextual_fit: 0.15, evidence_quality: 0.2 },
};

export const DEFAULT_WEIGHTS = PRESET_WEIGHTS.Balanced;

const CONTEXT_ROLES: Readonly<Record<string, readonly RoleSlug[]>> = {
  construction: ['construction', 'building'],
  construccion: ['construction', 'building'],
  building: ['construction', 'building'],
  farming: ['farming', 'watering', 'harvesting'],
  agricultura: ['farming', 'watering', 'harvesting'],
  watering: ['watering'],
  water: ['watering'],
  regar: ['watering'],
  automation: ['automation', 'electricity', 'power', 'production'],
  automatizacion: ['automation', 'electricity', 'power', 'production'],
  production: ['production', 'resource-generation'],
  resources: ['resource-generation', 'harvesting', 'wood', 'stone', 'metal'],
  resource: ['resource-generation', 'harvesting', 'wood', 'stone', 'metal'],
  logistics: ['logistics', 'storage', 'transport'],
  logistica: ['logistics', 'storage', 'transport'],
  progression: ['town-progression', 'construction', 'resource-generation'],
  exploration: ['exploration', 'transport'],
  mining: ['mining', 'stone', 'metal'],
};

export function rolesForContext(context: string): readonly RoleSlug[] {
  const normalized = context
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en');
  const terms = normalized.split(/[-\s]+/).filter(Boolean);
  return [...new Set(terms.flatMap((term) => CONTEXT_ROLES[term] ?? []))];
}

export function rankPokemon(
  pokemon: readonly PokemonSummary[],
  context: string,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
  currentTeam: readonly PokemonSummary[] = [],
): readonly RankedPokemon[] {
  const requestedRoles = rolesForContext(context);
  const contextTerms = context
    .toLocaleLowerCase('en')
    .split(/[-\s]+/)
    .filter(Boolean);
  const teamRoles = new Set(currentTeam.flatMap((member) => member.roles.map((role) => role.role)));
  const mode = currentTeam.length ? 'team_addition' : 'individual';
  const ranked = pokemon
    .map((candidate): RankedPokemon => {
      const matchedAssignments = candidate.roles.filter((assignment) =>
        requestedRoles.includes(assignment.role),
      );
      const matchedRoles = [...new Set(matchedAssignments.map((assignment) => assignment.role))];
      const objective = matchedAssignments.length
        ? Math.max(...matchedAssignments.map((assignment) => assignment.confidence))
        : null;
      const habitat = candidate.habitat?.toLocaleLowerCase('en') ?? '';
      const contextual = habitat && contextTerms.some((term) => habitat.includes(term)) ? 1 : null;
      const evidence = candidate.roles.length
        ? Math.max(
            ...candidate.roles.map((role) =>
              role.source.verificationStatus === 'confirmed'
                ? 1
                : role.source.verificationStatus === 'unverified'
                  ? 0.55
                  : 0.25,
            ),
          )
        : null;
      const values: Readonly<Record<ScoreDimension, number | null>> = {
        objective_capability: objective,
        contextual_fit: contextual,
        evidence_quality: evidence,
      };
      const knownWeight = (Object.keys(weights) as ScoreDimension[]).reduce(
        (total, dimension) => total + (values[dimension] === null ? 0 : weights[dimension]),
        0,
      );
      const recommendation =
        objective === null || knownWeight === 0
          ? null
          : (Object.keys(weights) as ScoreDimension[]).reduce(
              (total, dimension) => total + (values[dimension] ?? 0) * weights[dimension],
              0,
            ) / knownWeight;
      const reasons: Readonly<Record<ScoreDimension, string>> = {
        objective_capability:
          objective === null
            ? 'No source-backed role matches this objective; absence is not scored as zero.'
            : `Matched derived roles: ${matchedRoles.join(', ')}.`,
        contextual_fit:
          contextual === null
            ? 'No structured context match is available; this dimension remains unknown.'
            : `Ideal habitat “${candidate.habitat}” matches the requested context.`,
        evidence_quality:
          evidence === null
            ? 'No structured specialty evidence is available.'
            : 'Roles derive from a structured specialty table that remains unverified.',
      };
      const explanations = (Object.keys(weights) as ScoreDimension[]).map((dimension) => ({
        dimension,
        value: values[dimension],
        weight: weights[dimension],
        contribution: values[dimension] === null ? null : values[dimension] * weights[dimension],
        reason: reasons[dimension],
      }));
      const evidenceCoverage = Math.round((knownWeight / sumWeights(weights)) * 100);
      const evidenceQualityScore = Math.round((evidence ?? 0) * 100);
      const uniqueRoles = matchedRoles.filter((role) => !teamRoles.has(role));
      const roundedRecommendation =
        recommendation === null ? null : Math.round(recommendation * 100);
      const confidenceScore = roundToFive(
        ((evidenceCoverage / 100) * 0.45 + (evidence ?? 0) * 0.35 + (objective ?? 0) * 0.2) * 100,
      );
      return {
        pokemon: candidate,
        objectiveCapabilityScore: objective === null ? null : Math.round(objective * 100),
        contextualScore: contextual === null ? null : Math.round(contextual * 100),
        recommendationScore: roundedRecommendation,
        score: roundedRecommendation,
        evidenceCoverage,
        dataCoverage: evidenceCoverage,
        evidenceQualityScore,
        confidenceScore,
        confidence: confidenceScore >= 65 ? 'medium' : 'low',
        recommendationBand:
          (roundedRecommendation ?? 0) >= 80
            ? 'strong'
            : (roundedRecommendation ?? 0) >= 65
              ? 'useful'
              : 'situational',
        mode,
        matchedRoles,
        uniqueRoles,
        marginalRoleGain: uniqueRoles.length,
        unknowns: [
          ...(contextual === null ? ['Ajuste contextual sin evidencia estructurada'] : []),
          'No hay pruebas de rendimiento comparativo en gameplay',
          'La specialty no confirma por sí sola residencia ni sinergia',
        ],
        explanations,
        status: recommendation === null ? 'insufficient_evidence' : 'derived',
        tie: { isTie: false, withSlugs: [], reason: null },
      };
    })
    .filter((entry) => entry.status === 'derived')
    .sort((a, b) => compareRanked(a, b, mode));
  return ranked.map((entry) => {
    const tied = ranked.filter(
      (candidate) =>
        candidate.pokemon.slug !== entry.pokemon.slug && sameRank(entry, candidate, mode),
    );
    return {
      ...entry,
      tie: {
        isTie: tied.length > 0,
        withSlugs: tied.map((candidate) => candidate.pokemon.slug),
        reason: tied.length
          ? mode === 'team_addition'
            ? 'Misma ganancia marginal, puntuación y capacidad documentada.'
            : 'Misma puntuación y capacidad documentada.'
          : null,
      },
    };
  });
}

function compareRanked(a: RankedPokemon, b: RankedPokemon, mode: RankedPokemon['mode']): number {
  return (
    (mode === 'team_addition' ? b.marginalRoleGain - a.marginalRoleGain : 0) ||
    (b.recommendationScore ?? -1) - (a.recommendationScore ?? -1) ||
    (b.objectiveCapabilityScore ?? -1) - (a.objectiveCapabilityScore ?? -1) ||
    b.evidenceQualityScore - a.evidenceQualityScore ||
    a.pokemon.name.localeCompare(b.pokemon.name)
  );
}

function sameRank(a: RankedPokemon, b: RankedPokemon, mode: RankedPokemon['mode']): boolean {
  return (
    (mode === 'individual' || a.marginalRoleGain === b.marginalRoleGain) &&
    a.recommendationScore === b.recommendationScore &&
    a.objectiveCapabilityScore === b.objectiveCapabilityScore &&
    a.evidenceQualityScore === b.evidenceQualityScore
  );
}

function sumWeights(weights: ScoreWeights): number {
  return Object.values(weights).reduce((total, weight) => total + weight, 0);
}

function roundToFive(value: number): number {
  return Math.round(value / 5) * 5;
}
