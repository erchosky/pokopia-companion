import { expect, test } from '@playwright/test';

test('Portal Pod: search, requirements, source, goal and acquired state', async ({ page }) => {
  await page.goto('/buscar?q=cómo%20conseguir%20portal%20pod');
  await expect(page.getByText('Cómo conseguir Portal Pod', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Abrir ficha y requisitos/ }).click();
  await expect(page).toHaveURL(/\/items\/portal-pod$/);
  await expect(page.getByText(/Pokémetal × 10/)).toBeVisible();
  await expect(page.getByText('Fuente del dato').last()).toBeVisible();
  await page.getByRole('button', { name: 'Añadir a objetivos' }).click();
  await page.getByRole('button', { name: 'Marcar Acquired' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Acquired', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('Palette Town: level, residents, duplicate roles and replacement', async ({ page }) => {
  await page.goto('/towns/palettetown#optimizer');
  await page.getByLabel('Tu Environment Level en Palette Town').selectOption('8');
  await expect(page.getByText(/Niveles 1–7 marcados como inferidos/)).toBeVisible();
  const resident = page.getByLabel('Añadir residente a Palette Town');
  await resident.selectOption({ label: 'Machop' });
  await page.getByRole('button', { name: 'Añadir' }).click();
  await resident.selectOption({ label: 'Machoke' });
  await page.getByRole('button', { name: 'Añadir' }).click();
  await expect(page.getByText('redundant').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Valora sustituir/ }).first()).toBeVisible();
  await expect(page.getByText(/Tradeoff/).first()).toBeVisible();
});

test('Best Pokémon: ranking evidence and compare', async ({ page }) => {
  await page.goto('/buscar?q=mejor%20pokemon%20para%20construir');
  await page.getByRole('link', { name: /Abrir ranking explicado/ }).click();
  await expect(page.getByText(/Capability/).first()).toBeVisible();
  await expect(page.getByText(/Evidence coverage/).first()).toBeVisible();
  await page.getByText('Ver evidencia y limitaciones').first().click();
  await expect(page.getByText(/rendimiento comparativo/i).first()).toBeVisible();
  await page.getByRole('link', { name: 'Comparar Pokémon' }).first().click();
  await expect(page.getByRole('heading', { name: /¿Cuál deberías elegir?/ })).toBeVisible();
});

test('Automation planner: town and three-valued build/operation readiness', async ({ page }) => {
  await page.goto('/automation#planner');
  await page.getByLabel('Sistema').selectOption({ label: 'Portal pod' });
  await page.getByLabel('Pueblo').selectOption({ label: 'Palette Town' });
  await expect(page.getByText(/Construcción · Needs verification/)).toBeVisible();
  await expect(page.getByText(/Operación · Needs verification/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Por qué puedo o no construirlo' })).toBeVisible();
});

test('My Pokopia: completed state updates next actions', async ({ page }) => {
  await page.goto('/items/portal-pod');
  await page.getByRole('button', { name: 'Añadir a objetivos' }).click();
  await page.getByRole('button', { name: 'Marcar Acquired' }).click();
  await page.goto('/my-pokopia');
  await expect(page.getByText('Completa: Conseguir Portal pod')).toBeVisible();
  await expect(page.getByText('1 confirmados')).toBeVisible();
  await expect(page.getByText(/Privado por defecto/)).toBeVisible();
});

test('Craft planner: quantity remains unknown when output batch lacks evidence', async ({
  page,
}) => {
  await page.goto('/recipes/portal-pod');
  await page.getByLabel('¿Cuántas copias quieres fabricar?').fill('5');
  await page.getByRole('button', { name: 'Calcular' }).click();
  await expect(page).toHaveURL(/quantity=5/);
  await expect(page.getByText('Fabricaciones · unknown')).toBeVisible();
  await expect(page.getByText(/Portal pod: cantidad de salida por fabricación/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Grafo recursivo' })).toBeVisible();
});
