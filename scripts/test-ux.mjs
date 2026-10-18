import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function capturePage(url, name) {
  console.log(`Capturing ${name}...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: false });
  console.log(`  Saved to screenshots/${name}.png`);
  const title = await page.title();
  console.log(`  Title: ${title}`);
}

async function checkConsoleErrors() {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

try {
  // Create screenshots directory if it doesn't exist
  const fs = await import('fs');
  if (!fs.existsSync('screenshots')) {
    fs.mkdirSync('screenshots');
  }

  // Test login page
  await capturePage('http://localhost:3001/login', 'login');

  // Test onboarding
  await capturePage('http://localhost:3001/onboarding', 'onboarding');

  // Check console errors on main page (will redirect to onboarding if no user)
  console.log('\nChecking for console errors on main page...');
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`  Console error: ${msg.text()}`);
    }
  });
  
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle', timeout: 30000 });
  
  // Take a final screenshot
  await page.screenshot({ path: 'screenshots/final.png', fullPage: false });

  console.log('\n✅ All pages loaded successfully!');
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await browser.close();
}