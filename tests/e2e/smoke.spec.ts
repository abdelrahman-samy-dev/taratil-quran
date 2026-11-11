import { expect, test } from '@playwright/test';

test.describe('core screens', () => {
  test('home shows the reading card and ayah of the day', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.home-hero')).toBeVisible();
    await expect(page.locator('.daily-text')).not.toBeEmpty();
    await expect(page.locator('.daily-text .ayah-num')).toBeVisible();
  });

  test('mushaf renders a full page with its font and opens ayah actions', async ({ page }) => {
    await page.goto('/mushaf/50');
    const lines = page.locator('.mp-page[data-page="50"] .ln');
    await expect(lines).toHaveCount(15, { timeout: 20_000 });
    await expect(page.locator('.mp-page[data-page="50"]')).toHaveClass(/ready/);
    await page.locator('.mp-page[data-page="50"] .ln-a .w').nth(3).click();
    await expect(page.getByRole('dialog')).toContainText('سورة آل عمران');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('mushaf keyboard navigation moves forward (RTL)', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard only');
    await page.goto('/mushaf/10');
    await expect(page.locator('.mp-page.ready').first()).toBeVisible({ timeout: 20_000 });
    await page.keyboard.press('ArrowLeft');
    await expect(page).toHaveURL(/\/mushaf\/1[12]$/);
  });

  test('listen screen lists all surahs', async ({ page }) => {
    await page.goto('/listen');
    await expect(page.locator('.surah-card')).toHaveCount(114);
    await page.getByRole('searchbox', { name: 'ابحث عن سورة' }).fill('الكهف');
    await expect(page.locator('.surah-card')).toHaveCount(1);
  });

  test('every route renders without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const path of ['/', '/mushaf', '/listen', '/tafsir', '/azkar', '/prayer', '/qibla', '/tasbeeh', '/radio', '/hadith', '/werd', '/search', '/settings']) {
      await page.goto(path);
      await expect(page.locator('#main')).toBeVisible();
      await expect(page.locator('#main h1, #main .mushaf-bar').first()).toBeVisible({ timeout: 15_000 });
    }
    expect(errors).toEqual([]);
  });
});
