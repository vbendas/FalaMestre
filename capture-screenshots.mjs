import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function capturePage(url, name) {
  console.log(`Capturing ${name}...`);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false });
  console.log(`  Saved to screenshots/${name}.png`);
}

try {
  // Create screenshots directory if it doesn't exist
  const fs = await import('fs');
  if (!fs.existsSync('screenshots')) {
    fs.mkdirSync('screenshots');
  }

  // Capture login page
  await capturePage('http://localhost:3001/login', 'login');

  // Check if there's an onboarding redirect or if we need to simulate the flow
  await capturePage('http://localhost:3001/onboarding', 'onboarding');

  // Check main page (will likely redirect to onboarding since no user)
  await capturePage('http://localhost:3001/', 'main');

  console.log('\nScreenshots captured successfully!');
} catch (error) {
  console.error('Error:', error);
} finally {
  await browser.close();
}