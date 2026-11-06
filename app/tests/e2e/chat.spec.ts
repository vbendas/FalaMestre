import { test, expect, type Page } from '@playwright/test';

/**
 * The chat in a real browser, which is where its one production bug lived:
 * two Enter keydowns delivered in the same task sent the same message twice,
 * and nothing in the jsdom suite could see it — Testing Library flushes React
 * between events, a browser does not. Each test runs in its own browser
 * context (fresh localStorage), so each is a brand-new player and walks
 * through onboarding first, the way a player does.
 */

/** Creates this context's player and lands on the game. */
async function onboard(page: Page, teamName: string) {
  await page.goto('/');
  await page.waitForURL('**/onboarding', { timeout: 30_000 });
  await page.locator('input[type="text"]').first().fill(teamName);
  await page.getByRole('button', { name: /CRIAR MEU TIME/ }).click();
  await page.getByRole('button', { name: /CONFIRMAR/ }).click();
  await page.waitForURL((url) => !url.pathname.includes('onboarding'), { timeout: 30_000 });
}

async function openChat(page: Page) {
  await page.locator('nav button', { hasText: 'MESTRE' }).click();
  await expect(page.getByLabel('Mensagem para o mestre')).toBeVisible();
}

/** Every message the page actually sent to the conversation route. */
function recordSentMessages(page: Page): string[] {
  const sent: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/conversation') && request.method() === 'POST') {
      sent.push(JSON.parse(request.postData() ?? '{}').message);
    }
  });
  return sent;
}

const bubbles = (page: Page) => page.locator('.whitespace-pre-wrap');

test('a new player creates a club and is taken to it', async ({ page }) => {
  await onboard(page, 'Navegador FC');

  // The game shell is up, with the club the player named — not a default.
  await expect(page.locator('nav')).toContainText('NAVEGADOR FC');
  await expect(page.locator('nav button', { hasText: 'MESTRE' })).toBeVisible();
});

test('talks to the assistant and finds the conversation again after a reload', async ({ page }) => {
  await onboard(page, 'Conversa FC');
  await openChat(page);

  const replied = page.waitForResponse(
    (response) =>
      response.url().includes('/api/conversation') && response.request().method() === 'POST'
  );

  const box = page.getByLabel('Mensagem para o mestre');
  await box.fill('Como está o time, mestre?');
  await box.press('Enter');

  // The reply came from the built-in mock. This is also the run's proof that
  // it never reached a real model: a live answer would say `model`, and a
  // live model that failed would say `fallback`.
  const body = await (await replied).json();
  expect(body.source).toBe('mock');
  expect(body.persisted).toBe(true);

  // The reply, in the message history with suggestion chips under it.
  await expect(bubbles(page)).toHaveCount(2, { timeout: 20_000 });
  await expect(bubbles(page).first()).toHaveText('Como está o time, mestre?');
  await expect(page.getByRole('button', { name: 'Ver elenco' })).toBeVisible();

  // What a reload shows is the save, not component state.
  await page.reload();
  await openChat(page);
  await expect(bubbles(page)).toHaveCount(2, { timeout: 20_000 });
  await expect(bubbles(page).first()).toHaveText('Como está o time, mestre?');
  await expect(page.getByRole('button', { name: 'Ver elenco' })).toBeVisible();
});

test('a fast double Enter sends the message once', async ({ page }) => {
  await onboard(page, 'Enter FC');
  await openChat(page);
  const sent = recordSentMessages(page);

  await page.getByLabel('Mensagem para o mestre').fill('enter duplo');
  // Two keydowns in one task — faster than any React flush, which is the
  // sequence that used to send twice. keyboard.press would leave a gap.
  await page.evaluate(() => {
    const box = document.querySelector('textarea');
    const press = () =>
      box?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    press();
    press();
  });

  // One user message and one reply on screen, one request on the wire.
  await expect(bubbles(page)).toHaveCount(2, { timeout: 20_000 });
  expect(sent).toEqual(['enter duplo']);

  // And the save agrees after a reload: the message exists exactly once.
  await page.reload();
  await openChat(page);
  await expect(bubbles(page)).toHaveCount(2, { timeout: 20_000 });
  await expect(bubbles(page).first()).toHaveText('enter duplo');
});
