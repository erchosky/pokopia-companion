import { Badge, Card, Metric, PageIntro } from '@pokopia/ui';
import { repository } from '@/lib/data';

export const metadata = { title: 'Cobertura cuantitativa' };

export default async function QuantitativeCoveragePage() {
  const data = await repository();
  const recipes = data.listRecipes(10_000);
  const systems = data.listAutomationSystems();
  const parameters = data.listQuantitativeParameters();
  const exactRecipes = recipes.filter(
    (recipe) =>
      recipe.outputQuantity !== null &&
      recipe.outputQuantityStatus !== 'unknown' &&
      recipe.outputQuantityStatus !== 'derived_default' &&
      recipe.ingredients.every((ingredient) => ingredient.quantity !== null),
  );
  const structuralRecipes = recipes.filter((recipe) =>
    recipe.ingredients.every((ingredient) => ingredient.quantity === null),
  );
  const partialRecipes = recipes.filter(
    (recipe) => !exactRecipes.includes(recipe) && !structuralRecipes.includes(recipe),
  );
  const quantitativeSystems = systems.filter((system) => system.quantitative.length > 0);
  const disputed = parameters.filter((parameter) => parameter.assertionStatus === 'disputed');
  const uniqueFacts = new Set(
    parameters.map((parameter) =>
      [
        parameter.subjectKind,
        parameter.subjectSlug,
        parameter.predicate,
        parameter.value,
        parameter.unit,
        parameter.qualifier ?? '',
        parameter.gameVersion ?? '',
      ].join('|'),
    ),
  ).size;

  return (
    <main>
      <PageIntro eyebrow="Iteration 5.1" title="Cobertura cuantitativa">
        <p>
          Estado calculado desde la SQLite activa. Un parser seguro no convierte una fuente
          comunitaria en fuente confirmada: aceptación de la assertion y verificación de la fuente
          permanecen separadas.
        </p>
      </PageIntro>
      <div className="metric-grid">
        <Metric label="Recipes exact" value={`${exactRecipes.length}/${recipes.length}`} />
        <Metric label="Recipes partial" value={partialRecipes.length} />
        <Metric label="Recipes structural" value={structuralRecipes.length} />
        <Metric
          label="Automation quantitative"
          value={`${quantitativeSystems.length}/${systems.length}`}
        />
      </div>
      <div className="grid grid-wide">
        <Card>
          <Badge tone="accent">{parameters.length} evidence records</Badge>
          <h2>Evidencia recuperada</h2>
          <p>
            {uniqueFacts} hechos únicos ·{' '}
            {parameters.filter((entry) => entry.assertionStatus === 'accepted').length} evidencias
            aceptadas localmente · {disputed.length} disputed ·{' '}
            {parameters.filter((entry) => entry.gameVersion !== null).length} con versión explícita.
          </p>
        </Card>
        <Card>
          <Badge tone="warn">P0</Badge>
          <h2>Rendimiento de recetas</h2>
          <p>
            Ninguna de las 882 fuentes declara el output batch. El valor permanece unknown; no se
            usa el antiguo default 1.
          </p>
        </Card>
      </div>
      <div className="section-heading">
        <h2>Sistemas con parámetros aceptados</h2>
      </div>
      <div className="result-list">
        {quantitativeSystems.map((system) => (
          <Card className="result" key={system.slug}>
            <span className="result-index">{system.quantitative.length}</span>
            <div>
              <h2>{system.name}</h2>
              <p>
                {system.quantitative
                  .map(
                    (parameter) =>
                      `${parameter.predicate.replaceAll('_', ' ')}: ${parameter.value} ${parameter.unit.replaceAll('_', ' ')}`,
                  )
                  .join(' · ')}
              </p>
            </div>
          </Card>
        ))}
      </div>
    </main>
  );
}
