import { expect, test } from '@playwright/test';

test('progression hub exposes every evidence-backed domain', async ({ page }) => {
  await page.goto('/progression');
  await expect(page.getByRole('heading', { name: 'Tu progreso, sin suposiciones' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Important Requests/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Treasure Maps/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Music CDs/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Ditto Moves/ })).toBeVisible();
});

test('version filter exposes exactly ten verified Expansion Pass CDs', async ({ page }) => {
  await page.goto('/collectibles?scope=expansion');
  await expect(page.getByText('Expansion Pass verificado').locator('..')).toContainText('10');
  await expect(page.locator('.entity-card')).toHaveCount(10);
  await expect(page.getByRole('link', { name: /The Sea/ })).toBeVisible();
});

test('Treasure Map 6 preserves source warning and completes its goal', async ({ page }) => {
  await page.goto('/treasure-maps/treasure-map-6');
  await expect(page.getByText('The Map 6 source paragraph identifies itself')).toBeVisible();
  await page.getByRole('button', { name: 'Añadir a objetivos' }).click();
  await page.getByRole('button', { name: 'Marcar encontrado' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Encontrado', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.goto('/my-pokopia');
  await expect(page.getByTestId('goal-status-complete-treasure-map:treasure-map-6')).toContainText(
    'completed',
  );
});

test('Search V4 routes direct answers and typed entities', async ({ page }) => {
  await page.goto('/buscar?q=como+aprender+Water+Gun');
  await expect(page.getByRole('link', { name: /Abrir movimiento/ })).toHaveAttribute(
    'href',
    '/ditto-moves/water-gun',
  );
  await expect(page.getByRole('link', { name: 'Water Gun' }).first()).toHaveAttribute(
    'href',
    '/ditto-moves/water-gun',
  );
});

test('request search opens conservative steps, unknowns and provenance', async ({ page }) => {
  await page.goto('/buscar?q=Yawn+Up+A+Storm');
  await page.getByRole('link', { name: 'Yawn Up A Storm' }).click();
  await expect(page).toHaveURL('/requests/yawn-up-a-storm');
  await expect(page.getByRole('heading', { name: 'Pasos documentados' })).toBeVisible();
  await expect(page.getByText('Sin confirmar').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Consultar fuente/ })).toBeVisible();
});

test('Ditto Move detail keeps its Pokémon relation, boost and provenance', async ({ page }) => {
  await page.goto('/ditto-moves/water-gun');
  await expect(page.getByRole('heading', { name: 'Water Gun' })).toBeVisible();
  await expect(page.getByText('Squirtle', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Soup' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Consultar fuente/ })).toBeVisible();
});

test('My Pokopia V4 keeps explicit false separate from unknown', async ({ page }) => {
  await page.goto('/my-pokopia');
  await page.getByLabel('Filtrar por grupo').selectOption('Treasure Maps');
  const first = page.locator('.checklist-row').first();
  await first.getByRole('button', { name: 'No' }).click();
  await page.getByLabel('Filtrar por estado').selectOption('missing');
  await expect(page.locator('.checklist-row')).toHaveCount(1);
  await page.reload();
  await page.getByLabel('Filtrar por grupo').selectOption('Treasure Maps');
  await page.getByLabel('Filtrar por estado').selectOption('missing');
  await expect(page.locator('.checklist-row')).toHaveCount(1);
});
