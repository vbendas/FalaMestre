import { chromium } from 'playwright';

async function testJogoTabAfterOnboarding() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const testUserId = 'user_nmx3i3dci';
  
  // Simulate post-onboarding state: set localStorage as if we just came from onboarding
  await page.addInitScript((userId) => {
    localStorage.setItem('falaMestreUserId', userId);
    localStorage.setItem('falaMestreJustOnboarded', 'true');
  }, testUserId);

  console.log('Navigating to homepage with justOnboarded flag...');
  await page.goto('http://localhost:3003');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  console.log('URL:', page.url());
  
  // Wait for gameState to load (with retry logic we added)
  console.log('Waiting for gameState to load...');
  await page.waitForTimeout(3000);
  
  // Look for the Jogo tab
  const jogoTab = page.locator('button:has-text("Jogo")');
  const jogoTabVisible = await jogoTab.isVisible();
  console.log('Jogo tab visible:', jogoTabVisible);
  
  if (!jogoTabVisible) {
    console.log('Jogo tab not found, page content:', await page.textContent('body'));
    await browser.close();
    return;
  }
  
  console.log('Clicking Jogo tab...');
  await jogoTab.click();
  await page.waitForTimeout(1500);
  
  // Check what's visible
  const pageContent = await page.content();
  const hasVS = pageContent.includes('>VS<') || pageContent.includes('VS</div>');
  const hasJogar = pageContent.includes('JOGAR');
  const hasCarregando = pageContent.includes('Carregando');
  const hasPreparando = pageContent.includes('Preparando');
  
  console.log('--- Results ---');
  console.log('Has VS screen:', hasVS);
  console.log('Has JOGAR button:', hasJogar);
  console.log('Has Carregando:', hasCarregando);
  console.log('Has Preparando:', hasPreparando);
  
  if (hasVS || hasJogar) {
    console.log('✅ SUCCESS: Jogo tab content is displayed!');
  } else if (hasCarregando || hasPreparando) {
    console.log('⏳ Loading state shown (this may be OK if nextMatch is not ready yet)');
    // Check if we can go to chat and back
    console.log('Trying to switch to Chat and back to Jogo...');
    const chatTab = page.locator('button:has-text("Chat")');
    await chatTab.click();
    await page.waitForTimeout(500);
    await jogoTab.click();
    await page.waitForTimeout(1500);
    
    const pageContent2 = await page.content();
    const hasVS2 = pageContent2.includes('>VS<') || pageContent2.includes('VS</div>');
    const hasJogar2 = pageContent2.includes('JOGAR');
    console.log('After tab switch - Has VS:', hasVS2, 'Has JOGAR:', hasJogar2);
    
    if (hasVS2 || hasJogar2) {
      console.log('✅ SUCCESS: Content appears after tab switch!');
    } else {
      console.log('❌ FAIL: Content still not showing');
    }
  } else {
    console.log('❌ FAIL: No match content found');
  }
  
  await browser.close();
}

testJogoTabAfterOnboarding().catch(console.error);
