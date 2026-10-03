import { expect, test } from '@playwright/test';

test('navigates core data routes on mobile', async ({ page }) => {
  await page.goto('/pokemon');
  await expect(page.getByRole('heading', { name: /Pokémon/ })).toBeVisible();
  await page.goto('/items');
  await expect(page.getByRole('heading', { name: 'Objetos y materiales' })).toBeVisible();
  await page.goto('/recipes');
  await expect(page.getByRole('heading', { name: /recetas/i })).toBeVisible();
  await page.goto('/towns');
  await expect(page.getByRole('heading', { name: 'Planifica cada zona' })).toBeVisible();
});

test('shows only explainable recommendations', async ({ page }) => {
  await page.goto('/best-pokemon/water');
  await expect(page.getByText(/confianza/i).first()).toBeVisible();
  await expect(page.getByText(/Capability/).first()).toBeVisible();
  await page.getByText('Ver evidencia y limitaciones').first().click();
  await expect(page.getByText(/specialty/i).first()).toBeVisible();
});
