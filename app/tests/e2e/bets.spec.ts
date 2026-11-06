import { test, expect, type Page } from '@playwright/test';

/**
 * The bets screen in a real browser: a brand-new player opens it, finds the
 * market on their first fixture (opened by onboarding, see
 * src/lib/fixture-markets.ts) and places a bet on it. Before markets were
 * created anywhere this screen could only ever say there were none open.
 */

async function onboard(page: Page, teamName: string) {
  await page.goto('/');
  await page.waitForURL('**/onboarding', { timeout: 30_000 });
  await page.locator('input[type="text"]').first().fill(teamName);
  await page.getByRole('button', { name: /CRIAR MEU TIME/ }).click();
  await page.getByRole('button', { name: /CONFIRMAR/ }).click();
  await page.waitForURL((url) => !url.pathname.includes('onboarding'), { timeout: 30_000 });
}

test('a new player sees the market on their first fixture and places a bet on it', async ({ page }) => {
  await onboard(page, 'Aposta FC');

  const boardRead = page.waitForResponse(
    (response) =>
      response.url().includes('/api/predictions?') && response.request().method() === 'GET'
  );
  await page.locator('nav button', { hasText: 'APOSTAS' }).click();
  const board = await (await boardRead).json();

  // Exactly one market, on round 1, the player's own.
  expect(board.predictions).toHaveLength(1);
  const market = board.predictions[0];
  expect(market.matchId).toBe('round-1');
  expect([market.homeTeam, market.awayTeam]).toContain('Aposta FC');

  // On screen, with the engine's odds on each of the three outcomes.
  await expect(page.getByText('Resultado Final')).toBeVisible();
  await expect(page.getByText(`${market.homeTeam} vs ${market.awayTeam}`)).toBeVisible();
  await expect(page.getByText('Nenhum mercado aberto no momento.')).toHaveCount(0);
  const option = market.options[0];
  const optionButton = page.getByRole('button', { name: new RegExp(`${option.odds}x`) }).first();
  await expect(optionButton).toBeVisible();

  await optionButton.click();
  const placed = page.waitForResponse(
    (response) =>
      response.url().includes('/api/predictions/bet') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'APOSTAR' }).click();

  const reply = await placed;
  expect(reply.status()).toBe(200);
  const sent = JSON.parse(reply.request().postData() ?? '{}');
  expect(sent.predictionId).toBe(market.id);
  const body = await reply.json();
  expect(body.potentialWin).toBe(Math.round(sent.amount * option.odds));
  await expect(page.getByRole('status')).toContainText('1 aposta realizada');

  // The bet is on the player's record, not just announced.
  const userId = await page.evaluate(() => localStorage.getItem('falaMestreUserId'));
  const after = await (
    await page.request.get(`/api/predictions?status=open&userId=${userId}`)
  ).json();
  expect(after.predictions).toHaveLength(1);
  expect(after.userBets).toHaveLength(1);
  expect(after.userBets[0]).toMatchObject({
    predictionId: market.id,
    optionId: option.id,
    amount: sent.amount,
  });
});

test('the bets screen lists a bet as open, then settled with what it paid once the match is banked', async ({ page }) => {
  await onboard(page, 'Liquida FC');
  const boardRead = page.waitForResponse(
    (response) => response.url().includes('/api/predictions?') && response.request().method() === 'GET'
  );
  await page.locator('nav button', { hasText: 'APOSTAS' }).click();
  const market = (await (await boardRead).json()).predictions[0];
  const option = market.options[0];

  await page.getByRole('button', { name: new RegExp(`${option.odds}x`) }).first().click();
  const placed = page.waitForResponse((r) => r.url().includes('/api/predictions/bet'));
  await page.getByRole('button', { name: 'APOSTAR' }).click();
  expect((await placed).status()).toBe(200);

  const mine = page.locator('li[data-bet-status]');
  await expect(mine).toHaveCount(1);
  await expect(mine.first()).toHaveAttribute('data-bet-status', 'open');
  await expect(mine.first()).toContainText('Aberta');

  // Bank the match, as the one-shot match route does.
  const userId = await page.evaluate(() => localStorage.getItem('falaMestreUserId'));
  const banked = await page.request.post('/api/match', { data: { userId, seed: 'e2e-settle-1' } });
  expect(banked.status()).toBe(200);
  const { result } = await banked.json();
  const side = result.homeScore > result.awayScore ? 'home' : result.homeScore < result.awayScore ? 'away' : 'draw';
  const won = option.id === `${market.matchId}-${side}`;

  // Back to the screen: the bet is settled, with its score and its payout.
  await page.locator('nav button', { hasText: 'MESTRE' }).click();
  await page.locator('nav button', { hasText: 'APOSTAS' }).click();
  const settled = page.locator('li[data-bet-status="won"], li[data-bet-status="lost"]');
  await expect(settled).toHaveCount(1, { timeout: 20_000 });
  await expect(settled.first()).toHaveAttribute('data-bet-status', won ? 'won' : 'lost');
  await expect(settled.first()).toContainText(won ? 'Ganhou' : 'Perdeu');
  await expect(settled.first()).toContainText(`${result.homeScore} x ${result.awayScore}`);
  await expect(settled.first()).toContainText(won ? 'Pagou R$' : 'Pagou R$ 0');
});
