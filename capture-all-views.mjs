import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch({ headless: true });
// Use a clean context so we start fresh and get onboarding
const context = await browser.newContext();
const page = await context.newPage();

async function captureView(viewName, buttonText) {
  console.log(`Switching to ${viewName} (${buttonText})...`);
  try {
    if (buttonText) {
      // Find button by text in the sidebar navigation
      const button = page.locator(`nav button:has-text("${buttonText}")`);
      await button.waitFor({ state: 'visible', timeout: 5000 });
      await button.click();
      await page.waitForTimeout(2000); // Wait for transition/data loading
    }
    
    const screenshotPath = `screenshots/view-${viewName}.png`;
    await page.screenshot({ path: screenshotPath });
    console.log(`  Saved ${screenshotPath}`);
  } catch (error) {
    console.error(`  Error capturing ${viewName}:`, error.message);
  }
}

try {
  if (!fs.existsSync('screenshots')) {
    fs.mkdirSync('screenshots');
  }

  console.log('Navigating to home page (should redirect to onboarding)...');
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  console.log('Current URL:', page.url());
  
  // Fill onboarding if visible
  const nameInput = page.locator('input[placeholder*="Dragões do Cerrado"]');
  if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Onboarding is visible. Filling team info...');
    await nameInput.fill('Galo de Ouro FC');
    
    // Choose Circle emblem for variety
    const circleOption = page.locator('button:has-text("Circle")');
    if (await circleOption.isVisible()) {
      await circleOption.click();
    }
    
    // Select a preset color scheme (e.g., silver/black or yellow/green)
    // Click random color a few times for fun
    const randomColorBtn = page.locator('button:has-text("RANDOM")').last();
    if (await randomColorBtn.isVisible()) {
      await randomColorBtn.click();
    }

    const createBtn = page.locator('button:has-text("CRIAR MEU TIME!")');
    await createBtn.click();
    console.log('Clicked "CRIAR MEU TIME!". Waiting for preview step...');
    await page.waitForTimeout(2000);
    
    const confirmBtn = page.locator('button:has-text("CONFIRMAR")');
    await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
    await confirmBtn.click();
    console.log('Clicked "CONFIRMAR". Waiting for dashboard redirect...');
    await page.waitForTimeout(5000);
    console.log('Post-create URL:', page.url());
  }

  // Capture dashboard view (default)
  await captureView('dashboard', null);

  // Capture other views
  await captureView('squad', 'ELENCO');
  await captureView('transfers', 'MERCADO');
  await captureView('standings', 'LIGA');
  await captureView('stadium', 'ESTÁDIO');
  await captureView('facilities', 'INSTALAÇÕES');
  await captureView('youth', 'ACADEMIA');
  await captureView('staff', 'STAFF');
  await captureView('apostas', 'APOSTAS');
  await captureView('investir', 'INVESTIR');

  console.log('\nAll views captured successfully!');
} catch (error) {
  console.error('Error during capture:', error);
} finally {
  await browser.close();
}
