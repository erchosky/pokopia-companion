import { expect, test } from '@playwright/test';

test('Goal Engine: Portal Pod changes from unknown to completed', async ({ page }) => {
  await page.goto('/items/portal-pod');
  await page.getByRole('button', { name: 'Añadir a objetivos' }).click();
  await page.goto('/my-pokopia');
  await expect(page.getByTestId('goal-status-get-item:portal-pod')).toContainText('unknown');
  await page.goto('/items/portal-pod');
  await page.getByRole('button', { name: 'Marcar Acquired' }).click();
  await page.goto('/my-pokopia');
  await expect(page.getByTestId('goal-status-get-item:portal-pod')).toContainText('completed');
});

test('Palette Town keeps a partial collection distinct from ideal candidates', async ({ page }) => {
  await page.goto('/pokemon/machop');
  await page.getByRole('button', { name: 'Marcar Owned' }).click();
  await page.goto('/towns/palettetown#optimizer');
  await expect(page.getByLabel('Perfil de candidatos')).toHaveValue('known_collection');
  await expect(page.getByTestId('optimizer-profile-summary')).toContainText('colección partial');
  await expect(page.getByTestId('optimizer-profile-summary')).toContainText('Mejor Owned: Machop');
  await page.getByLabel('Perfil de candidatos').selectOption('ideal');
  await expect(page.getByTestId('optimizer-profile-summary')).toContainText('Perfil ideal');
});

test('construction ranking separates individual and team-addition modes', async ({ page }) => {
  await page.goto('/best-pokemon/construction');
  await expect(
    page
      .locator('.result')
      .first()
      .getByText(/individual/),
  ).toBeVisible();
  await page.getByLabel('Modo de ranking').selectOption('team');
  await page.getByLabel('Pokémon ya en el equipo').selectOption({ label: 'Machop' });
  await page.getByRole('button', { name: 'Recalcular' }).click();
  await expect(
    page
      .locator('.result')
      .first()
      .getByText(/team addition/),
  ).toBeVisible();
  await expect(page.getByText(/Ganancia marginal/).first()).toBeVisible();
});

test('Neo Dowsing Machine exposes the recursive graph without inventing batch totals', async ({
  page,
}) => {
  await page.goto('/recipes/neo-dowsing-machine?quantity=2');
  await expect(page.getByText(/Dowsing Machine/i).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Grafo recursivo' })).toBeVisible();
  await expect(page.getByText(/Pokémetal/).first()).toBeVisible();
  await expect(page.getByText('Fabricaciones · unknown')).toBeVisible();
});
