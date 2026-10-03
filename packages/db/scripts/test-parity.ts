import { createGameDataRepository, loadPostgresGameDataRepository } from '@pokopia/game-data';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const [sqlitePath, connectionString, outputPath] = process.argv.slice(2);
if (!sqlitePath || !connectionString)
  throw new Error('Usage: test-parity.ts <sqlite-path> <postgres-url>');

const sqlite = createGameDataRepository(sqlitePath);
const postgres = await loadPostgresGameDataRepository(connectionString);
const checks = {
  pokemon: [sqlite.listPokemon(10_000).length, postgres.listPokemon(10_000).length],
  items: [sqlite.listItems(10_000).length, postgres.listItems(10_000).length],
  recipes: [sqlite.listRecipes(10_000).length, postgres.listRecipes(10_000).length],
  towns: [sqlite.listTowns().length, postgres.listTowns().length],
  automation: [sqlite.listAutomationSystems().length, postgres.listAutomationSystems().length],
  quests: [sqlite.listQuests().length, postgres.listQuests().length],
  treasureMaps: [sqlite.listTreasureMaps().length, postgres.listTreasureMaps().length],
  collectibles: [sqlite.listCollectibles().length, postgres.listCollectibles().length],
  dittoMoves: [sqlite.listDittoMoves().length, postgres.listDittoMoves().length],
  portalPod: [sqlite.getItem('portal-pod')?.name, postgres.getItem('portal-pod')?.name],
  neoRecipe: [
    sqlite.getRecipe('neo-dowsing-machine')?.ingredients.map((entry) => entry.slug),
    postgres.getRecipe('neo-dowsing-machine')?.ingredients.map((entry) => entry.slug),
  ],
  paletteTown: [
    sqlite.getTown('palettetown')?.maxEnvironmentLevel,
    postgres.getTown('palettetown')?.maxEnvironmentLevel,
  ],
  treasureMap6Warning: [
    sqlite.getTreasureMap('treasure-map-6')?.qualityWarnings,
    postgres.getTreasureMap('treasure-map-6')?.qualityWarnings,
  ],
  expansionCdCount: [
    sqlite.listCollectibles({ scope: 'expansion' }).length,
    postgres.listCollectibles({ scope: 'expansion' }).length,
  ],
  waterGunMeal: [
    sqlite.getDittoMove('water-gun')?.mealBoost,
    postgres.getDittoMove('water-gun')?.mealBoost,
  ],
};
const mismatches = Object.entries(checks).filter(
  ([, [left, right]]) => JSON.stringify(left) !== JSON.stringify(right),
);
if (mismatches.length)
  throw new Error(`SQLite/PostgreSQL parity failed: ${JSON.stringify(mismatches)}`);
if (outputPath) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: { ...sqlite.health(), databasePath: '[canonical SQLite]' },
        postgres: { ...postgres.health(), databasePath: '[disposable PostgreSQL]' },
        checks,
        mismatches,
        passed: true,
      },
      null,
      2,
    )}\n`,
  );
}
process.stdout.write(`pokopia_repository_parity_ok ${JSON.stringify(checks)}\n`);
