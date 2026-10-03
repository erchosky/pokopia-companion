import { expect, test } from '@playwright/test';

test('persists a user-confirmed checklist state', async ({ page }) => {
  await page.goto('/items/portal-pod');
  await page.getByRole('button', { name: 'Marcar Acquired' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Acquired', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.goto('/my-pokopia');
  await expect(page.getByRole('heading', { name: '1 confirmados' })).toBeVisible();
});
