import { test, expect } from '@playwright/test';

test('VR scene renders with mock data', async ({ page }) => {
  const vrLogs: string[] = [];
  const criticalErrors: string[] = [];
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[VR]')) {
      vrLogs.push(text);
    }
    
    const isCriticalError = 
      msg.type() === 'error' && 
      !text.includes('WebGL') &&
      !text.includes('THREE.WebGLRenderer') &&
      !text.includes('Could not create a WebGL context') &&
      !text.includes('Error creating WebGL context');
    
    if (isCriticalError) {
      criticalErrors.push(text);
    }
  });
  
  page.on('pageerror', error => {
    criticalErrors.push(error.message);
  });

  await page.goto('http://localhost:3001/test-vr');
  await page.waitForTimeout(5000);
  
  console.log('=== VR Scene Test Results ===');
  
  const sceneCount = await page.locator('a-scene').count();
  console.log(`a-scene: ${sceneCount}`);
  
  const planes = await page.locator('a-plane').count();
  console.log(`a-plane: ${planes}`);
  
  const spheres = await page.locator('a-sphere').count();
  console.log(`a-sphere: ${spheres}`);
  
  const entities = await page.locator('a-entity').count();
  console.log(`a-entity: ${entities}`);
  
  const isSceneVisible = await page.locator('a-scene').isVisible().catch(() => false);
  console.log(`a-scene visible: ${isSceneVisible}`);
  
  console.log(`\nCritical errors: ${criticalErrors.length}`);
  if (criticalErrors.length > 0) {
    console.log('Errors:', criticalErrors.slice(0, 5));
  }
  
  expect(sceneCount).toBe(1);
  expect(planes).toBeGreaterThan(5);
  expect(spheres).toBeGreaterThan(10);
  expect(entities).toBeGreaterThan(20);
  expect(isSceneVisible).toBe(true);
});
