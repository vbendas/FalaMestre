import { test, expect } from '@playwright/test';

test.describe('VR Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001/test-vr');
    await page.waitForTimeout(3000);
  });

  test('should render Three.js canvas', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });
  });

  test('should display HUD with score', async ({ page }) => {
    await page.waitForTimeout(3000);
    
    const scoreBar = page.locator('.vr-score-bar, .bg-black\\/85');
    await expect(scoreBar.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display camera mode toggle button', async ({ page }) => {
    await page.waitForTimeout(3000);
    
    const toggleButton = page.locator('button:has-text("Torcida"), button:has-text("Transmissão")');
    await expect(toggleButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('should toggle camera mode', async ({ page }) => {
    await page.waitForTimeout(3000);
    
    const toggleButton = page.locator('button:has-text("Torcida"), button:has-text("Transmissão")');
    const initialText = await toggleButton.first().textContent();
    
    await toggleButton.first().click();
    await page.waitForTimeout(500);
    
    const newText = await toggleButton.first().textContent();
    expect(newText).not.toBe(initialText);
  });

  test('should display exit VR button', async ({ page }) => {
    await page.waitForTimeout(3000);
    
    const exitButton = page.locator('button:has-text("Sair VR")');
    await expect(exitButton).toBeVisible({ timeout: 10000 });
  });

  test('should display tracking mode indicator', async ({ page }) => {
    await page.waitForTimeout(3000);
    
    const trackingIndicator = page.locator('text=Modo VR Ativo');
    await expect(trackingIndicator).toBeVisible({ timeout: 10000 });
  });

  test('should have no console errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(10000);
    
    const criticalErrors = errors.filter(e => 
      !e.includes('404') && 
      !e.includes('favicon') &&
      !e.includes('net::ERR')
    );
    
    console.log('Console errors:', criticalErrors);
    expect(criticalErrors.length).toBe(0);
  });
});
