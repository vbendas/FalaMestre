import { chromium } from 'playwright';

async function testHighlightOverlay() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capture console logs
  page.on('console', msg => {
    console.log('BROWSER LOG:', msg.text());
  });
  
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });
  
  const testUserId = 'user_nmx3i3dci';
  
  // Set localStorage
  await page.addInitScript((userId) => {
    localStorage.setItem('falaMestreUserId', userId);
  }, testUserId);

  console.log('Navigating to homepage...');
  await page.goto('http://localhost:3003');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Find and click Jogo tab
  const jogoTab = page.locator('button:has-text("Jogo")');
  if (await jogoTab.isVisible()) {
    await jogoTab.click();
    await page.waitForTimeout(1000);
  }
  
  // Check if VS screen is visible
  const pageContent = await page.content();
  const hasVS = pageContent.includes('VS');
  console.log('Has VS screen:', hasVS);
  
  // Find and click JOGAR button
  const jogarBtn = page.locator('button:has-text("JOGAR")');
  if (await jogarBtn.isVisible()) {
    console.log('Clicking JOGAR button...');
    await jogarBtn.click();
    await page.waitForTimeout(3000);
    
    // Check for match content
    const matchContent = await page.content();
    const hasMatchSimulation = matchContent.includes('Pênalti') || matchContent.includes('homeScore') || matchContent.includes('Estádio');
    console.log('Match started (has simulation):', hasMatchSimulation);
    
    // Wait for potential highlight event (if the match has any)
    await page.waitForTimeout(15000);
    
    // Check if highlight overlay appeared
    const highlightContent = await page.content();
    const hasGOOOOL = highlightContent.includes('GOOOOL');
    const hasPenalty = highlightContent.includes('PÊNALTI');
    const hasDefesa = highlightContent.includes('DEFESA');
    
    console.log('--- Results ---');
    console.log('Has GOOOOL overlay:', hasGOOOOL);
    console.log('Has PENALTI overlay:', hasPenalty);
    console.log('Has DEFESA overlay:', hasDefesa);
    
    if (hasGOOOOL || hasPenalty || hasDefesa) {
      console.log('✅ SUCCESS: Highlight overlay triggered!');
      
      // Test skip functionality
      const skipBtn = page.locator('button').filter({ has: page.locator('svg') }).first();
      if (await skipBtn.isVisible()) {
        await skipBtn.click();
        await page.waitForTimeout(500);
        console.log('✅ Skip button clicked');
      }
    } else {
      console.log('⏳ No highlight overlay (may need match with highlight events)');
    }
  }
  
  await browser.close();
}

testHighlightOverlay().catch(console.error);
