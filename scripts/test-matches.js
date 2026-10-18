import { chromium } from 'playwright';

async function runMatchSimulation() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const debugLogs = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('DEBUG') && (text.includes('score') || text.includes('goal') || text.includes('ResultModal') || text.includes('MatchView'))) {
      debugLogs.push(`[${new Date().toISOString()}] ${text}`);
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
    await page.waitForTimeout(3000);
  }

  for (let matchNum = 1; matchNum <= 3; matchNum++) {
    console.log(`\n=== MATCH ${matchNum} ===`);
    debugLogs.length = 0;
    
    // Navigate to Jogo tab
    await page.locator('button:has-text("Jogo")').first().click();
    await page.waitForTimeout(2000);
    
    // Refresh and go to Jogo
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Jogo")').first().click();
    await page.waitForTimeout(2000);

    // Start match
    console.log(`Starting match ${matchNum}...`);
    const playBtn = page.locator('button:has-text("JOGAR")').filter({ hasText: 'AGORA' });
    await playBtn.waitFor({ state: 'visible', timeout: 15000 });
    await playBtn.click({ force: true });
    console.log('Match started!');

    // Wait for match to complete (30 seconds)
    await page.waitForTimeout(35000);
    
    // Get final modal info
    console.log('Match complete, checking results...');
    
    // Get the displayed final scores
    const scoreElements = await page.locator('[class*="text-5xl"], [class*="text-6xl"]').allTextContents();
    console.log('Modal scores displayed:', scoreElements.join(' | '));
    
    // Try to close modal
    try {
      const continuar = page.locator('button:has-text("Continuar")');
      if (await continuar.isVisible({ timeout: 3000 })) {
        await continuar.click();
      }
    } catch {
      await page.keyboard.press('Escape');
    }
    
    await page.waitForTimeout(2000);
    
    // Print debug logs for this match
    console.log(`\n--- Debug logs for Match ${matchNum} ---`);
    for (const log of debugLogs) {
      console.log(log);
    }
  }

  console.log('\n=== ALL MATCHES COMPLETE ===');
  await page.waitForTimeout(5000);
  await browser.close();
}

runMatchSimulation().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
