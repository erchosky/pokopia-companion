import { expect, test } from '@playwright/test';

test('searches the real snapshot and opens a Pokémon', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Buscar').fill('Abra');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page.getByRole('heading', { name: /coincidencias para “Abra”/ })).toBeVisible();
  await page.getByRole('link', { name: /Abra/ }).first().click();
  await expect(page).toHaveURL(/\/pokemon\/abra$/);
  await expect(page.getByRole('heading', { name: 'Abra', exact: true })).toBeVisible();
  await expect(page.getByText('Fuente del dato')).toBeVisible();
});

test('keeps accented Pokémon names intact', async ({ page }) => {
  await page.goto('/buscar?q=Flab%C3%A9b%C3%A9');
  await expect(page.getByText('Flabébé', { exact: false }).first()).toBeVisible();
});
