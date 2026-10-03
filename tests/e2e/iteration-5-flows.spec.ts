import { expect, test } from '@playwright/test';

test('V4 owned item migrates to V5 with unknown quantity, never one', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'pokopia-progress-v4',
      JSON.stringify({
        version: 4,
        entries: {
          'item:portal-pod': { state: 'confirmed', value: true, updatedAt: 'legacy' },
        },
        goals: [],
        townResidents: {},
        favorites: [],
        recentlyViewed: [],
        recentSearches: [],
      }),
    );
  });
  await page.goto('/items/portal-pod');
  await expect(page.getByLabel('Cantidad de Portal Pod')).toHaveValue('');
  await expect(page.getByText('Owned confirmado; la cantidad sigue siendo unknown.')).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('pokopia-progress-v5')!),
  );
  expect(stored.inventory['portal-pod'].quantity).toBeNull();
});

test('confirmed zero stays distinct and blocks a numeric build material', async ({ page }) => {
  await page.goto('/automation#planner');
  await page.getByLabel('Cantidad de Glass (necesita 1)').fill('0');
  await expect(page.getByText('Construcción · Blocked')).toBeVisible();
});

test('recipe planner explains unknown batch instead of inventing 20 crafts', async ({ page }) => {
  await page.goto('/recipes/portal-pod?quantity=20');
  await expect(page.getByText('Fabricaciones · unknown')).toBeVisible();
  await expect(page.getByText(/cantidad de salida por fabricación/)).toBeVisible();
});

test('automation planner separates build and operational readiness', async ({ page }) => {
  await page.goto('/automation#planner');
  await expect(page.getByText(/Construcción ·/)).toBeVisible();
  await expect(page.getByText(/Operación ·/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Por qué puedo o no construirlo' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Por qué puede o no operar' })).toBeVisible();
});

test('town infrastructure can be confirmed without changing recipe materials', async ({ page }) => {
  await page.goto('/automation#planner');
  const infrastructure = page.locator('.infrastructure-state').first();
  if (await infrastructure.count()) {
    await infrastructure.getByRole('button', { name: '✓' }).click();
    await expect(
      page.getByText(/Infraestructura confirmada|Suministro confirmado/).first(),
    ).toBeVisible();
  }
  await expect(page.getByText('Throughput · no disponible')).toBeVisible();
});

test('quantitative automation stays explicit about known parameters and missing throughput', async ({
  page,
}) => {
  await page.goto('/automation');
  const system = page.getByLabel('Sistema');
  await expect(async () => {
    await system.selectOption('windmill-kit');
    await expect(system).toHaveValue('windmill-kit');
    await expect(page.getByText('Parámetros utilizables · 3')).toBeVisible();
  }).toPass({ timeout: 15_000 });
  await expect(page.getByText('Throughput · no disponible')).toBeVisible();
  await expect(page.getByText(/Generación · 20 unidades de energía · gran altitud/)).toBeVisible();
  const card = page.locator('#windmill-kit');
  await expect(card.getByText('7 valores cuantitativos')).toBeVisible();
  await expect(card.getByText(/Tiempo de construcción · 1 hora/)).toBeVisible();
});

test('Search V5 routes a quantified craft intent deterministically', async ({ page }) => {
  await page.goto('/buscar?q=quiero+fabricar+20+Portal+Pod');
  await expect(page.getByRole('link', { name: 'Abrir Crafting Planner V2' })).toHaveAttribute(
    'href',
    '/recipes/portal-pod?quantity=20',
  );
});

test('production chain view is structural and labels effects', async ({ page }) => {
  await page.goto('/automation');
  const chain = page.getByRole('group', { name: /Cadena estructural/ }).first();
  await expect(chain).toBeVisible();
  await expect(chain.getByText('Construcción')).toBeVisible();
  await expect(chain.getByText('Efecto, no material')).toBeVisible();
});

test('corrupt V5 state is recovered with a visible backup notice', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pokopia-progress-v5', '{broken'));
  await page.goto('/my-pokopia');
  await expect(
    page.getByRole('heading', { name: 'Protegimos una copia de tu progreso' }),
  ).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pokopia-progress-recovery-backup'))).toBe(
    '{broken',
  );
});
