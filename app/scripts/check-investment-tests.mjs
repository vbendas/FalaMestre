#!/usr/bin/env node
/**
 * Breaks one investment guarantee at a time and checks a test notices.
 *
 * A green suite does not prove the tests are load-bearing — only that
 * nothing is currently broken. This reintroduces, one at a time, each bug
 * the investment lifecycle actually had, and fails unless the suite goes red
 * for it. Every mutation is a single edit to shipped code or to the
 * migration; the file is always put back, including when a run throws.
 *
 * Run as `npm run check:investments`. Not part of `vitest run`: it rewrites
 * source files on disk, so it must never race the suite.
 *
 *   node scripts/check-investment-tests.mjs             # every mutation
 *   node scripts/check-investment-tests.mjs no-close    # one, by id
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const MUTATIONS = [
  {
    id: 'no-close',
    guarantee: 'an investment stops paying once its printed duration is over',
    file: 'src/app/api/cron/daily-yield/route.ts',
    find: `    const closed = await db.update(fanClubInvestments)
      .set({ active: false })`,
    replace: `    const closed = await db.update(fanClubInvestments)
      .set({ active: true })`,
    tests: 'src/app/api/__tests__/investment-journey.test.ts src/app/api/__tests__/investment-lifecycle.test.ts',
  },
  {
    id: 'bonus-ignores-lock',
    guarantee: 'an investment stops boosting once its printed duration is over',
    file: 'src/lib/investment-bonuses-store.ts',
    find: `        eq(fanClubInvestments.active, true),
        gt(fanClubInvestments.unlockDate, new Date())`,
    replace: `        eq(fanClubInvestments.active, true)`,
    tests: 'src/app/api/__tests__/investment-journey.test.ts src/app/api/__tests__/investment-lifecycle.test.ts',
  },
  {
    id: 'pay-twice',
    guarantee: "a day's yield can only be paid once",
    file: 'src/app/api/cron/daily-yield/route.ts',
    find: `        .onConflictDoNothing({
          target: [investmentYields.investmentId, investmentYields.yieldDate],
        })`,
    replace: ``,
    tests: 'src/app/api/__tests__/investment-journey.test.ts src/app/api/__tests__/investment-lifecycle.test.ts',
  },
  {
    id: 'empty-rows',
    guarantee: 'a product that pays nothing leaves no yield row',
    file: 'src/app/api/cron/daily-yield/route.ts',
    find: `      if (investment.yieldPerDay <= 0) continue;`,
    replace: ``,
    tests: 'src/app/api/__tests__/investment-journey.test.ts src/app/api/__tests__/investment-lifecycle.test.ts',
  },
  {
    id: 'claim-eats-expired',
    guarantee: 'a player never loses money silently on a claim',
    file: 'src/app/api/investment/claim/route.ts',
    find: `    const claimable = yields.filter((y) => new Date(y.expiryDate) >= now);`,
    replace: `    const claimable = yields;`,
    tests: 'src/app/api/__tests__/investment-journey.test.ts src/app/api/__tests__/investment-lifecycle.test.ts',
  },
  {
    id: 'screen-overstates',
    guarantee: 'the screen never shows a pending total the claim will not pay',
    file: 'src/app/api/investment/route.ts',
    find: `        eq(investmentYields.expired, false),
        gte(investmentYields.expiryDate, now)`,
    replace: `        eq(investmentYields.expired, false)`,
    tests: 'src/app/api/__tests__/investment-journey.test.ts',
  },
  {
    id: 'claim-double-credits',
    guarantee: 'two claims racing each other pay a yield once',
    file: 'src/app/api/investment/claim/route.ts',
    find: `        .where(and(
          eq(investmentYields.id, yieldRecord.id),
          eq(investmentYields.claimed, false),
          eq(investmentYields.expired, false)
        ))`,
    replace: `        .where(eq(investmentYields.id, yieldRecord.id))`,
    tests: 'src/app/api/__tests__/investment-lifecycle.test.ts',
  },
  {
    id: 'sweep-books-loss-as-paid',
    guarantee: 'money lost to the window is booked as lost, not as paid',
    file: 'src/app/api/cron/expire-yields/route.ts',
    find: `      .set({ expired: true })`,
    replace: `      .set({ claimed: true, claimedAt: now })`,
    tests: 'src/app/api/__tests__/investment-lifecycle.test.ts',
  },
  {
    id: 'no-backfill',
    guarantee: 'a day the old job already paid is not paid again after the migration',
    file: 'drizzle/0002_investment_yield_ledger.sql',
    findRegex: /UPDATE "investment_yields" AS y[\s\S]*?LIMIT 1\n  \);--> statement-breakpoint\n/,
    replace: '',
    tests: 'src/app/api/__tests__/investment-journey.test.ts',
  },
];

function run(mutation) {
  const file = path.join(APP, mutation.file);
  const original = readFileSync(file, 'utf8');

  let mutated;
  if (mutation.findRegex) {
    if (!mutation.findRegex.test(original)) {
      throw new Error(`[${mutation.id}] pattern not found in ${mutation.file}`);
    }
    mutated = original.replace(mutation.findRegex, mutation.replace);
  } else {
    if (!original.includes(mutation.find)) {
      throw new Error(`[${mutation.id}] snippet not found in ${mutation.file}`);
    }
    mutated = original.replace(mutation.find, mutation.replace);
  }
  if (mutated === original) throw new Error(`[${mutation.id}] mutation changed nothing`);

  writeFileSync(file, mutated);
  let output = '';
  let failed = false;
  try {
    output = execSync(`npx vitest run ${mutation.tests} 2>&1`, {
      cwd: APP,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 600_000,
    });
  } catch (error) {
    failed = true;
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  } finally {
    writeFileSync(file, original);
  }

  const plain = output.replace(/\u001b\[[0-9;]*m/g, '');
  const red = [...new Set(
    [...plain.matchAll(/^\s*×\s+(.+?)(?:\s+\d+ms)?\s*$/gm)].map((m) => m[1].trim())
  )];
  const summary = plain.match(/^\s*Tests\s+.*$/m)?.[0]?.replace(/\s+/g, ' ').trim() ?? 'no summary';
  return { failed, red, summary };
}

const only = process.argv[2];
const chosen = only ? MUTATIONS.filter((m) => m.id === only) : MUTATIONS;
if (chosen.length === 0) throw new Error(`no mutation with id ${only}`);

let survivors = 0;
for (const mutation of chosen) {
  const { failed, red, summary } = run(mutation);
  const verdict = failed && red.length > 0 ? 'CAUGHT' : 'SURVIVED';
  if (verdict === 'SURVIVED') survivors++;
  console.log(`\n=== ${mutation.id} — ${verdict}`);
  console.log(`    guarantee: ${mutation.guarantee}`);
  console.log(`    broke:     ${mutation.file}`);
  console.log(`    ${summary}`);
  for (const name of red.slice(0, 6)) console.log(`      × ${name}`);
  if (red.length > 6) console.log(`      … and ${red.length - 6} more`);
}

console.log(`\n${chosen.length - survivors}/${chosen.length} mutations caught.`);
process.exit(survivors === 0 ? 0 : 1);
