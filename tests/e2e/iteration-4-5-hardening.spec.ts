import { expect, test } from '@playwright/test';

test('security headers are present and reflected search text stays inert', async ({ page }) => {
  const response = await page.goto(
    `/buscar?q=${encodeURIComponent('<img src=x onerror="window.__pokopiaXss=1">')}`,
  );
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  expect(response?.headers()['x-frame-options']).toBe('DENY');
  expect(response?.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, '__pokopiaXss'))).toBeUndefined();
});

test('corrupt local progress is preserved and visibly recovered', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pokopia-progress-v4', '{broken-json'));
  await page.goto('/my-pokopia');
  await expect(
    page.getByRole('heading', { name: 'Protegimos una copia de tu progreso' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Descargar copia original' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pokopia-progress-recovery-backup'))).toBe(
    '{broken-json',
  );
});

test('recovery controls remain keyboard reachable and announce their status', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('pokopia-progress-v4', '{broken-json'));
  await page.goto('/my-pokopia');
  await expect(page.getByRole('status')).toContainText('Protegimos una copia de tu progreso');
  const download = page.getByRole('button', { name: 'Descargar copia original' });
  for (
    let index = 0;
    index < 25 && !(await download.evaluate((node) => node.matches(':focus')));
    index += 1
  )
    await page.keyboard.press('Tab');
  await expect(download).toBeFocused();
});
