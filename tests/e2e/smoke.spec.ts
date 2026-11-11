import { expect, test } from '@playwright/test';

test.describe('core screens', () => {
  test('home shows the reading card and ayah of the day', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.home-hero')).toBeVisible();
    await expect(page.locator('.home-ayah-text')).not.toBeEmpty();
    await expect(page.locator('.home-ayah-text .ayah-num')).toBeVisible();
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

test.describe('upgrade from v3', () => {
  test('keeps the last page, bookmarks, theme and werd of a v3 user', async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      localStorage.setItem('prefs_theme', 'dark');
      localStorage.setItem('mushaf_last_page', '250');
      localStorage.setItem('mushaf_bookmarks', JSON.stringify([{ page: 100, label: 'حفظ', date: '1' }]));
      localStorage.setItem('mushaf_werd_2026-11-10', JSON.stringify({ goal: 10, pagesRead: ['5', '6'], completed: false }));
      localStorage.setItem('mushaf_werd_2026-11-09', 'null'); // malformed legacy value must not break anything
      localStorage.setItem('gami_data', JSON.stringify({ azkarTotal: 120, unlockedBadges: ['azkar_100'] }));
    });
    await page.goto('/mushaf');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.locator('.mp-page[data-page="250"]').first()).toBeVisible({ timeout: 20_000 });
    const stored = await page.evaluate(() => ({
      lastRead: JSON.parse(localStorage.getItem('taratil:lastRead') || '{}').page,
      marks: JSON.parse(localStorage.getItem('taratil:bookmarks') || '[]').map((b: { page: number }) => b.page),
      log: Object.keys(JSON.parse(localStorage.getItem('taratil:log') || '{}')),
      azkar: JSON.parse(localStorage.getItem('taratil:stats') || '{}').azkarTotal,
      done: !!localStorage.getItem('taratil:migrated:v3'),
    }));
    expect(stored).toEqual({ lastRead: 250, marks: [100], log: ['2026-11-10'], azkar: 120, done: true });
  });
});
