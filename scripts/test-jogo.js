import { chromium } from 'playwright';

async function runMatchSimulation() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('ViewTabs') || text.includes('ERROR')) {
      console.log(`[CONSOLE]: ${text}`);
    }
  });

  console.log('Opening app...');
  await page.goto('http://localhost:3001');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000);

  // Create team if needed
  const criarBtn = page.locator('button:has-text("Criar Meu Time")');
  if (await criarBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('Creating team...');
    await page.locator('input[type="text"]').first().fill('Test FC');
    await criarBtn.click();
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Confirmar")').click();
    console.log('Team created, waiting for redirect...');
    await page.waitForTimeout(3000);
  }

  console.log('Clicking Jogo tab with force...');
  
  // Try clicking using evaluate to ensure click happens
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const jogoBtn = buttons.find(b => b.textContent?.includes('Jogo'));
    if (jogoBtn) {
      console.log('[TEST] Found Jogo button, clicking...');
      (jogoBtn as HTMLButtonElement).click();
    }
  });
  
  await page.waitForTimeout(3000);

  // Check what's visible now
  const contentHtml = await page.evaluate(() => {
    const mainContent = document.querySelector('.max-w-4xl');
    return mainContent ? mainContent.innerHTML.substring(0, 300) : 'No main content found';
  });
  console.log('Main content after click:', contentHtml);

  await browser.close();
}

runMatchSimulation().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
