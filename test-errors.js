import { chromium } from 'playwright';

async function runMatchSimulation() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen to ALL console messages
  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type().toUpperCase()}]: ${msg.text()}`);
  });

  // Listen to page errors
  page.on('pageerror', err => {
    console.log('[PAGE ERROR]:', err.message);
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
    await page.waitForTimeout(3000);
  }

  // Navigate to Jogo tab
  await page.locator('button:has-text("Jogo")').first().click();
  await page.waitForTimeout(2000);
  
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await page.locator('button:has-text("Jogo")').first().click();
  await page.waitForTimeout(2000);

  // Start match
  console.log('Starting match...');
  const playBtn = page.locator('button:has-text("JOGAR")').filter({ hasText: 'AGORA' });
  await playBtn.waitFor({ state: 'visible', timeout: 15000 });
  await playBtn.click({ force: true });

  // Wait for match to complete
  await page.waitForTimeout(35000);
  
  console.log('Match complete!');
  
  await page.waitForTimeout(5000);
  await browser.close();
}

runMatchSimulation().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
