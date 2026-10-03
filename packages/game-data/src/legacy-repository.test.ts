import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { automationRelevanceFor, LegacySnapshotRepository } from './legacy-repository';
import { resolveDatabasePath } from './path';

const temporary: string[] = [];
afterEach(() =>
  temporary.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })),
);

function fixture(): string {
  const directory = mkdtempSync(join(tmpdir(), 'pokopia-data-test-'));
  temporary.push(directory);
  const path = join(directory, 'fixture.sqlite');
  const db = new Database(path);
  db.exec(`
    CREATE TABLE pages(url TEXT, title TEXT, category TEXT);
    CREATE TABLE table_rows(source_url TEXT, title TEXT, category TEXT, table_index INTEGER, row_index INTEGER, cells_json TEXT);
    CREATE TABLE facts(source_url TEXT, title TEXT, category TEXT, key TEXT, value TEXT, table_index INTEGER, row_index INTEGER);
    CREATE TABLE chunks(id TEXT, source_url TEXT, title TEXT, category TEXT, section TEXT, chunk_index INTEGER, text TEXT);
    CREATE VIRTUAL TABLE chunks_fts USING fts5(id UNINDEXED,title,category,section,text);
    INSERT INTO pages VALUES ('https://example.test/pokedex/flabebe.shtml','Flabébé - Poké Dex - Pokémon Pokopia','pokedex');
    INSERT INTO table_rows VALUES ('https://example.test/pokedex/flabebe.shtml','','pokedex',1,1,'["#001 Flabébé"]');
    INSERT INTO table_rows VALUES ('https://example.test/pokedex/flabebe.shtml','','pokedex',2,1,'["Specialty","Ideal Habitat","Favorites","Go Underwater?"]');
    INSERT INTO table_rows VALUES ('https://example.test/pokedex/flabebe.shtml','','pokedex',2,2,'["Watering","Flowers","Soft stuff","No"]');
    INSERT INTO pages VALUES ('https://example.test/pokedex/specialty/build.shtml','Build - Poké Dex - Pokémon Pokopia','pokedex');
  `);
  db.close();
  return path;
}

function canonicalTownFixture(): string {
  const directory = mkdtempSync(join(tmpdir(), 'pokopia-town-test-'));
  temporary.push(directory);
  const path = join(directory, 'fixture.sqlite');
  const db = new Database(path);
  db.exec(`
    CREATE TABLE pages(id TEXT PRIMARY KEY, source_url TEXT, title TEXT, category TEXT);
    CREATE TABLE page_tables(page_id TEXT, table_index INTEGER, caption TEXT, PRIMARY KEY(page_id,table_index));
    CREATE TABLE table_cells(page_id TEXT, table_index INTEGER, row_index INTEGER, column_index INTEGER, text TEXT, links_json TEXT DEFAULT '[]', images_json TEXT DEFAULT '[]', PRIMARY KEY(page_id,table_index,row_index,column_index));
    CREATE VIRTUAL TABLE rag_fts USING fts5(id,title,category,text);
    INSERT INTO pages VALUES ('w','https://example.test/locations/waste.shtml','Waste Locations - Pokémon Pokopia','locations');
    INSERT INTO table_cells(page_id,table_index,row_index,column_index,text) VALUES
      ('w',1,2,1,'A dry area'),
      ('w',3,1,1,'Stone'),
      ('w',4,1,1,'Dry grass'),
      ('w',5,1,1,'Workbench'),
      ('w',6,1,1,'Utility pole'),
      ('w',7,1,1,'Small lost relic'),
      ('w',8,1,1,'Picture'),('w',8,1,2,'Name'),('w',8,1,3,'Level'),
      ('w',8,2,2,'Storage box'),('w',8,2,3,'Lv. 2');
  `);
  db.close();
  return path;
}

describe('legacy snapshot repository', () => {
  it('preserves accented Pokémon names and structured attributes', () => {
    const pokemon = new LegacySnapshotRepository(fixture()).getPokemon('flabebe');
    expect(pokemon?.name).toBe('Flabébé');
    expect(pokemon?.specialty).toBe('Watering');
    expect(pokemon?.canDive).toBe(false);
  });

  it('resolves slugs exactly instead of as LIKE patterns or nested pages', () => {
    const repository = new LegacySnapshotRepository(fixture());
    expect(repository.getPokemon('%')).toBeNull();
    expect(repository.getPokemon('_labebe')).toBeNull();
    expect(repository.getPokemon('specialty/build')).toBeNull();
    expect(repository.getPokemon('flabebe')).toBe(repository.getPokemon('flabebe'));
    const towns = new LegacySnapshotRepository(canonicalTownFixture(), 'canonical');
    expect(towns.getTown('%')).toBeNull();
    expect(towns.getTown('waste')?.name).toBe('Waste');
  });

  it('does not classify a generic machine name as direct automation', () => {
    expect(
      automationRelevanceFor('Arcade machine', 'A game machine from a facility somewhere.', null),
    ).toBe('related');
    expect(
      automationRelevanceFor(
        'Automatic doors',
        'They function automatically when hooked up to electricity.',
        null,
      ),
    ).toBe('direct');
    expect(
      automationRelevanceFor('Portal pod', 'Anything placed here can be retrieved anywhere.', {
        type: 'shared',
        capacity: null,
        evidence: 'retrieved from any of these machines',
      }),
    ).toBe('direct');
  });

  it('does not present a resource table as exclusive Pokémon when that table is absent', () => {
    const town = new LegacySnapshotRepository(canonicalTownFixture(), 'canonical').getTown('waste');
    expect(town?.exclusivePokemon).toEqual([]);
    expect(town?.resources).toEqual(['Stone']);
    expect(town?.plantsAndBlocks).toEqual(['Dry grass']);
    expect(town?.facilities).toEqual(['Workbench', 'Utility pole']);
    expect(town?.treasure).toEqual(['Small lost relic']);
  });

  it('projects Iteration 4 domains from the immutable canonical snapshot', () => {
    const canonical = resolveDatabasePath();
    expect(canonical).not.toBeNull();
    const repository = new LegacySnapshotRepository(canonical!, 'canonical');
    expect(repository.listQuests()).toHaveLength(5);
    expect(repository.listTreasureMaps()).toHaveLength(6);
    expect(repository.listCollectibles()).toHaveLength(53);
    expect(repository.listCollectibles({ scope: 'base_game' })).toHaveLength(43);
    expect(repository.listCollectibles({ scope: 'expansion' })).toHaveLength(10);
    expect(repository.listDittoMoves()).toHaveLength(14);
    expect(repository.getTreasureMap('treasure-map-6')?.qualityWarnings).toHaveLength(1);
    expect(repository.getDittoMove('water-gun')?.mealBoost?.meal).toBe('Soup');
    const recipes = repository.listRecipes(10_000);
    expect(recipes).toHaveLength(882);
    expect(
      recipes.every(
        (recipe) => recipe.outputQuantity === null && recipe.outputQuantityStatus === 'unknown',
      ),
    ).toBe(true);
    expect(repository.listAutomationSystems()).toHaveLength(15);
    expect(
      repository
        .listAutomationSystems()
        .find((system) => system.slug === 'sprinkler')
        ?.quantitative.map((entry) => [entry.predicate, entry.value, entry.unit]),
    ).toEqual([
      ['watering_axial_range', 5, 'tile'],
      ['watering_capacity', 60, 'tile'],
    ]);
  });

  it('fails explicitly instead of treating a corrupt SQLite file as empty canonical data', () => {
    const directory = mkdtempSync(join(tmpdir(), 'pokopia-corrupt-db-test-'));
    temporary.push(directory);
    const path = join(directory, 'corrupt.sqlite');
    writeFileSync(path, 'not a sqlite database');
    const repository = new LegacySnapshotRepository(path, 'canonical');
    expect(() => repository.health()).toThrow();
  });
});
