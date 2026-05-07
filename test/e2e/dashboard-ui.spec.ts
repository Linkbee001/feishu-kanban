import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Admin Dashboard UI', () => {
  test('Dashboard page loads with HTML structure', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);

    // Wait for page to fully load
    await page.waitForLoadState('domcontentloaded');

    // Check HTML title
    const title = await page.title();
    expect(title).toContain('Admin Dashboard');

    // Check React root exists
    const rootDiv = await page.locator('#root');
    await expect(rootDiv).toBeAttached();

    // Verify script and CSS loaded
    const scripts = await page.locator('script[src*="index"]').count();
    expect(scripts).toBeGreaterThan(0);

    const styles = await page.locator('link[href*="index"]').count();
    expect(styles).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/page-structure.png', fullPage: true });
  });

  test('Dashboard renders content after data load', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);

    // Wait for React to render - look for any Chinese text
    await page.waitForFunction(() => {
      const content = document.body.innerText;
      return content.includes('仪表盘') || content.includes('加载中') || content.includes('机器人');
    }, { timeout: 15000 });

    // Take screenshot after content appears
    await page.screenshot({ path: 'test-results/dashboard-content.png', fullPage: true });

    // Verify some content rendered
    const bodyContent = await page.locator('body').innerText();
    expect(bodyContent.length).toBeGreaterThan(10);
  });

  test('Robot instances API accessible', async ({ page }) => {
    // Direct API call test
    const apiResponse = await page.request.get(`${BASE_URL}/api/admin/robot-instances`);
    expect(apiResponse.status()).toBe(200);

    const data = await apiResponse.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('Dashboard on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'test-results/desktop-view.png', fullPage: true });
  });

  test('Dashboard on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'test-results/mobile-view.png', fullPage: true });
  });

  test('No JavaScript console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');

    // Filter out expected benign errors
    const criticalErrors = errors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('404')
    );

    expect(criticalErrors.length).toBe(0);
  });
});