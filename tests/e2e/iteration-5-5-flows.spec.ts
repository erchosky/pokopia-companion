import { expect, test, type Page } from '@playwright/test';

async function openDefaultPlan(page: Page) {
  await page.goto('/planner');
  await page.getByRole('button', { name: 'Generar plan multiobjetivo' }).click();
  await expect(page.getByRole('heading', { name: 'Qué importa ahora' })).toBeVisible();
}

async function clearSelectedGoals(page: Page) {
  const chips = page.locator('.goal-chip');
  while ((await chips.count()) > 0) await chips.first().click();
}

test('combines two goals and exposes a real shared dependency once', async ({ page }) => {
  await openDefaultPlan(page);
  await expect(page.getByText('Dependencias compartidas', { exact: true })).toBeVisible();
  await expect(page.getByText('Afecta a 2 objetivos.').first()).toBeVisible();
  await expect(page.locator('.shared-grid > div')).toHaveCount(4);
});

test('unknown inventory requests confirmation and replans after an explicit quantity', async ({
  page,
}) => {
  await openDefaultPlan(page);
  const glass = page.locator('article.planner-action').filter({ hasText: 'Confirma Glass' });
  await expect(glass).toBeVisible();
  await glass.getByLabel('Cantidad confirmada').fill('20');
  await glass.getByRole('button', { name: 'Guardar y recalcular' }).click();
  await expect(glass).toHaveCount(0);
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('pokopia-progress-v5')!),
  );
  expect(stored.inventory.glass.quantity).toBe(20);
});

test('keeps several structural alternatives incomparable instead of naming a winner', async ({
  page,
}) => {
  await page.goto('/planner');
  await clearSelectedGoals(page);
  await page.getByLabel('Añadir objetivo').selectOption({ label: 'Fabricar · Antique chest' });
  await page.getByRole('button', { name: 'Añadir' }).click();
  await page.getByRole('button', { name: 'Generar plan multiobjetivo' }).click();
  await page.getByText('Ver grafo textual, alternativas y trazas').click();
  await expect(page.locator('.alternative-row')).toHaveCount(4);
  await expect(page.getByText(/No existe ganador demostrable/).first()).toBeVisible();
});

test('Base Game only excludes a verified Expansion Pass goal', async ({ page }) => {
  await page.goto('/planner');
  await clearSelectedGoals(page);
  await page
    .getByLabel('Añadir objetivo')
    .selectOption({ label: 'Expansion Pass · CD #100 · The Sea' });
  await page.getByRole('button', { name: 'Añadir' }).click();
  await page.getByLabel('Contenido').selectOption('base_only');
  await page.getByRole('button', { name: 'Generar plan multiobjetivo' }).click();
  await expect(page.getByText(/requiere Expansion Pass/)).toBeVisible();
  await expect(page.locator('article.planner-action')).toHaveCount(0);
});

test('what-if reevaluates a build while confirmed My Pokopia stays unchanged', async ({ page }) => {
  await openDefaultPlan(page);
  const before = await page.evaluate(() => localStorage.getItem('pokopia-progress-v5'));
  await page.getByRole('button', { name: 'Simular escenario' }).click();
  await expect(page.getByRole('heading', { name: 'Escenario hipotético' })).toBeVisible();
  await expect(page.getByText(/no modifica My Pokopia/i)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pokopia-progress-v5'))).toBe(before);
});

test('compares two what-if scenarios without inventing a quantitative winner', async ({ page }) => {
  await openDefaultPlan(page);
  const before = await page.evaluate(() => localStorage.getItem('pokopia-progress-v5'));
  await page.getByRole('button', { name: 'Comparar A y B' }).click();
  await expect(page.getByText('Comparación what-if · dimensiones conocidas')).toBeVisible();
  await expect(page.getByText(/incomparables/i).first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pokopia-progress-v5'))).toBe(before);
});

test('explicitly applying a gameplay action changes only its confirmed target', async ({
  page,
}) => {
  await page.goto('/planner');
  await clearSelectedGoals(page);
  await page
    .getByLabel('Añadir objetivo')
    .selectOption({ label: 'Music CDs · CD #1 · Title Screen' });
  await page.getByRole('button', { name: 'Añadir' }).click();
  await page.getByRole('button', { name: 'Generar plan multiobjetivo' }).click();
  await expect(page.getByRole('heading', { name: 'Qué importa ahora' })).toBeVisible();
  const action = page
    .locator('article.planner-action')
    .filter({ hasText: 'Consigue Title Screen' });
  await action.getByText('Aplicar acción completada').click();
  await action.getByRole('button', { name: 'Marcar acción como hecha y recalcular' }).click();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('pokopia-progress-v5')!),
  );
  expect(stored.entries['collectible:music-cd-1'].value).toBe(true);
  expect(Object.keys(stored.entries)).toEqual(['collectible:music-cd-1']);
});

test('unknown recipe batches keep a useful structural plan and gate exact optimization', async ({
  page,
}) => {
  await openDefaultPlan(page);
  const capabilities = page
    .getByRole('heading', { name: 'Qué puede optimizar realmente' })
    .locator('..');
  await expect(capabilities.getByText('Materiales exactos')).toBeVisible();
  await expect(capabilities.getByText('unavailable').first()).toBeVisible();
  await expect(page.getByText(/Los batches de receta desconocidos/)).toBeVisible();
  await expect(page.getByText('Throughput', { exact: true })).toBeVisible();
});
