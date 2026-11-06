#!/usr/bin/env node
/**
 * Breaks each betting and fixture guarantee on purpose and checks the suite
 * goes red. Run as `npm run test:guarantees` (optionally with names, e.g.
 * `npm run test:guarantees -- settle-pay-and-mark-apart`). `--list` prints
 * the names; `--shard=i/n` runs every n-th break starting at i (0-based),
 * which is how CI spreads them over parallel jobs (.github/workflows/
 * betting-guarantees.yml). Under GitHub Actions each uncaught break is also
 * an error annotation naming the guarantee, and the run writes a summary.
 *
 * Nothing here touches the real tree. Each break is made in a fresh copy of
 * src/ and drizzle/ in a temporary directory (node_modules symlinked), and
 * the suites that cover that guarantee run there:
 *
 *   0. the unbroken copy must be green, or nothing below means anything;
 *   1. each break must apply to exactly one place in today's code, or the
 *      script says the code has moved under it and fails, rather than
 *      quietly testing nothing;
 *   2. with the break in, at least one test must fail, and the failing
 *      tests are listed so you can see the right ones went red.
 *
 * Exit code 0 only if the baseline is green and every break is caught.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const appDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const T = (name) => `src/app/api/__tests__/${name}.test.ts`;
const LIFECYCLE = T('fixture-lifecycle');
const EDGE = T('fixture-edge-cases');
const MONEY = T('bet-money-integrity');
const SEED = T('fixture-seed-integrity');
const SETTLEMENT = T('market-settlement');
const CONCURRENCY = T('save-version-concurrency');

/**
 * Each guarantee, the break that violates it, and the suites that should
 * catch it. A break is one or more exact replacements in one file.
 */
const BREAKS = [
  {
    name: 'settle-pay-and-mark-apart',
    guarantee: 'Paying a bet and marking it settled are one step: a crash between them cannot leave one without the other.',
    file: 'src/lib/market-settlement.ts',
    edits: [
      // The statement marks the bet but no longer credits it...
      ['bet.payout > 0 and ${credit}', 'bet.payout > 0 and false'],
      // ...the credit comes after, as its own write, the way it used to.
      [
        '  return rows.length > 0 ? { payout: Number(rows[0].payout) } : null;',
        `  if (rows.length > 0 && Number(rows[0].payout) > 0 && claim === 'unclaimed') {
    const owner = await db.query.userBets.findFirst({ where: eq(userBets.id, betId) });
    await db.update(gameStates).set({
      currentState: sql\`jsonb_set(\${gameStates.currentState}, '{user,money}', to_jsonb(\${money} + \${Number(rows[0].payout)}))\`,
    }).where(eq(gameStates.userId, owner!.userId));
  }
  return rows.length > 0 ? { payout: Number(rows[0].payout) } : null;`,
      ],
    ],
    tests: [LIFECYCLE, MONEY],
  },
  {
    name: 'settle-pays-twice',
    guarantee: 'Settlement pays a bet once, however many runs land on it together.',
    file: 'src/lib/market-settlement.ts',
    edits: [['        and coalesce(${userBets.settled}, false) = false\n', '']],
    tests: [LIFECYCLE, SETTLEMENT],
  },
  {
    name: 'bet-without-stake',
    guarantee: 'Placing a bet and taking its stake are all or nothing.',
    file: 'src/app/api/predictions/bet/route.ts',
    edits: [['        from debited\n', '        from market\n']],
    tests: [CONCURRENCY, MONEY],
  },
  {
    name: 'bet-after-kickoff',
    guarantee: 'The open-market check is inside the same step as the bet, so no bet lands after kickoff.',
    file: 'src/app/api/predictions/bet/route.ts',
    edits: [["          and ${predictions.status} = 'open'\n", '']],
    tests: [SETTLEMENT],
  },
  {
    name: 'kickoff-leaves-market-open',
    guarantee: 'Kickoff closes the market.',
    file: 'src/lib/fixture-kickoff.ts',
    edits: [["      set status = 'closed', kicked_off_at", '      set kicked_off_at']],
    tests: [LIFECYCLE, SEED],
  },
  {
    name: 'finalize-uses-client-seed',
    guarantee: 'A fixture is played and banked under the server’s seed, never the client’s.',
    file: 'src/app/api/match/finalize/route.ts',
    edits: [['    const seed = kickoff.seed;', '    const seed = String(bodyResult.body.seed);']],
    tests: [LIFECYCLE, SEED],
  },
  {
    name: 'stream-does-not-kick-off',
    guarantee: 'Watching a fixture in full is its kickoff: the stream is the match that banks.',
    file: 'src/app/api/match/stream/route.ts',
    edits: [['    if (isFixture) {', '    if (false) {']],
    tests: [LIFECYCLE, SEED],
  },
  {
    name: 'replayed-turn-takes-new-choice',
    guarantee: 'A turn already played plays as it went the first time, whatever is chosen on a replay.',
    file: 'src/app/api/match/decide/route.ts',
    edits: [['    const played = playedId === sentId ? sentOption : resolveOffered(playedId);', '    const played = sentOption;']],
    tests: [LIFECYCLE, SEED],
  },
  {
    name: 'finalize-reads-morale-now',
    guarantee: 'The match banks from the setup frozen at kickoff, not from a save changed mid-match.',
    file: 'src/app/api/match/finalize/route.ts',
    edits: [['          userMorale: kickoff.setup.userMorale,', '          userMorale: effectiveMorale(gameState.squad.morale, bonuses),']],
    tests: [SEED],
  },
  {
    name: 'finalize-reveals-score-unrecorded',
    guarantee: 'Finalize records the decisions before any reply can reveal the replayed score.',
    file: 'src/app/api/match/finalize/route.ts',
    edits: [[
      '    let nowRecorded: Record<string, string | null>;',
      `    if (claimedScore && (claimedScore.homeScore !== settled.match.homeScore || claimedScore.awayScore !== settled.match.awayScore)) {
      return NextResponse.json({ error: 'Score mismatch', replayed: { homeScore: settled.match.homeScore, awayScore: settled.match.awayScore } }, { status: 409 });
    }
    let nowRecorded: Record<string, string | null>;`,
    ]],
    tests: [SEED],
  },
  {
    name: 'decide-plays-unoffered-decision',
    guarantee: 'A decision the turn never offered is refused before anything is recorded or shown.',
    file: 'src/app/api/match/decide/route.ts',
    edits: [['    if (sentId !== null && !sentOption) {', '    if (false) {']],
    tests: [EDGE],
  },
  {
    name: 'claimed-winner-paid-blind',
    guarantee: 'A winning bet the old code left claimed is held for an operator, never paid or written off blind.',
    file: 'src/lib/market-settlement.ts',
    edits: [['        result.held++;\n        continue;\n', '']],
    tests: [EDGE],
  },
  {
    name: 'claimed-loser-left-forever',
    guarantee: 'A losing bet the old code left claimed is finished by the job.',
    file: 'src/lib/market-settlement.ts',
    edits: [['      claim = { claimed: true, credit: false };', '      result.skipped++;\n      continue;']],
    tests: [EDGE],
  },
  {
    name: 'resolve-credits-a-paid-bet',
    guarantee: 'Resolving a held bet credits it only if the old run had not, so it is paid exactly once.',
    file: 'src/lib/market-settlement.ts',
    edits: [['  const credit = won && !paidByOldRun;', '  const credit = won;']],
    tests: [EDGE],
  },
  {
    name: 'history-in-table-order',
    guarantee: 'A fixture’s bets are counted in history in the order they were placed.',
    file: 'src/lib/market-settlement.ts',
    edits: [['    orderBy: [asc(userBets.createdAt), asc(userBets.id)],\n', '']],
    tests: [EDGE],
  },
  {
    name: 'market-ignores-season',
    guarantee: 'A second season’s round gets its own market.',
    file: 'src/lib/fixture-markets.ts',
    edits: [['  return n > 1 ? `s${n}-round-${season.week}` : `round-${season.week}`;', '  return `round-${season.week}`;']],
    tests: [EDGE],
  },
  {
    name: 'kickoff-ignores-season',
    guarantee: 'A second season’s round gets its own kickoff and seed.',
    file: 'src/lib/fixture-kickoff.ts',
    edits: [['    eq(fixtureKickoffs.season, seasonNumber(season)),\n', '']],
    tests: [EDGE],
  },
];

const argv = process.argv.slice(2);
if (argv.includes('--list')) {
  for (const b of BREAKS) console.log(b.name);
  process.exit(0);
}
const shardArg = argv.find((a) => a.startsWith('--shard='));
const only = argv.filter((a) => !a.startsWith('--'));
let selected = only.length ? BREAKS.filter((b) => only.includes(b.name)) : BREAKS;
if (shardArg) {
  const [i, n] = shardArg.slice('--shard='.length).split('/').map(Number);
  if (!(n > 0 && i >= 0 && i < n)) {
    console.error(`--shard wants i/n with 0 <= i < n, got ${shardArg}`);
    process.exit(2);
  }
  selected = selected.filter((_, index) => index % n === i);
}
const onActions = process.env.GITHUB_ACTIONS === 'true';
const summaryLines = [];
function annotate(kind, title, message) {
  if (onActions) console.log(`::${kind} title=${title}::${message.replace(/\n/g, '%0A')}`);
}
if (only.length && selected.length !== only.length) {
  const known = new Set(BREAKS.map((b) => b.name));
  console.error(`Unknown break(s): ${only.filter((n) => !known.has(n)).join(', ')}`);
  console.error(`Known: ${BREAKS.map((b) => b.name).join(', ')}`);
  process.exit(2);
}

const workRoot = mkdtempSync(path.join(tmpdir(), 'falamestre-guarantees-'));
const vitestBin = path.join(appDir, 'node_modules', 'vitest', 'vitest.mjs');

/** A fresh copy of the app's sources, with one break (or none) applied. */
function prepare(label, brk) {
  const dir = path.join(workRoot, label);
  cpSync(path.join(appDir, 'src'), path.join(dir, 'src'), { recursive: true });
  cpSync(path.join(appDir, 'drizzle'), path.join(dir, 'drizzle'), { recursive: true });
  for (const file of ['package.json', 'tsconfig.json', 'vitest.config.ts']) {
    cpSync(path.join(appDir, file), path.join(dir, file));
  }
  symlinkSync(path.join(appDir, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
  if (brk) {
    const target = path.join(dir, brk.file);
    let text = readFileSync(target, 'utf8');
    for (const [find, replace] of brk.edits) {
      const count = text.split(find).length - 1;
      if (count !== 1) {
        throw new Error(
          `${brk.name}: expected the text to break exactly once in ${brk.file}, found it ${count} time(s). ` +
            'The code has moved under this script; update the break.\n  ' + find.split('\n')[0]
        );
      }
      text = text.replace(find, () => replace);
    }
    writeFileSync(target, text);
  }
  return dir;
}

/** Runs the given test files in `dir`; returns pass/fail and the failed tests' names. */
function run(dir, tests) {
  const report = path.join(dir, 'report.json');
  const result = spawnSync(
    process.execPath,
    [vitestBin, 'run', ...tests, '--reporter=json', `--outputFile=${report}`],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, CI: '' }, maxBuffer: 64 * 1024 * 1024 }
  );
  let failed = [];
  if (existsSync(report)) {
    const json = JSON.parse(readFileSync(report, 'utf8'));
    failed = json.testResults.flatMap((file) =>
      file.assertionResults
        .filter((t) => t.status === 'failed')
        .map((t) => `${path.basename(file.name)} › ${t.fullName}`)
    );
    if (failed.length === 0 && json.numFailedTestSuites > 0) {
      failed = json.testResults.filter((f) => f.status === 'failed').map((f) => `${path.basename(f.name)} (did not load: ${f.message.split('\n')[0]})`);
    }
  }
  return { green: result.status === 0, failed, output: (result.stdout ?? '') + (result.stderr ?? '') };
}

let ok = true;
try {
  const allTests = [...new Set(selected.flatMap((b) => b.tests))];
  process.stdout.write(`Baseline: ${allTests.length} suite(s) on an unbroken copy... `);
  const baseline = run(prepare('baseline', null), allTests);
  if (!baseline.green) {
    console.log('RED. Fix these before trusting anything below:');
    for (const name of baseline.failed) console.log(`    ${name}`);
    if (baseline.failed.length === 0) console.log(baseline.output.slice(-3000));
    annotate('error', 'Guarantee check: baseline is red', `The unbroken code fails: ${baseline.failed.slice(0, 5).join('; ')}`);
    process.exit(1);
  }
  console.log('green');

  for (const brk of selected) {
    console.log(`\n■ ${brk.name}\n  ${brk.guarantee}`);
    let dir;
    try {
      dir = prepare(brk.name, brk);
    } catch (error) {
      console.log(`  ✗ ${error.message}`);
      annotate('error', `Guarantee break could not be applied: ${brk.name}`, error.message);
      summaryLines.push(`| ✗ | \`${brk.name}\` | ${brk.guarantee} | **break no longer applies** |`);
      ok = false;
      continue;
    }
    const result = run(dir, brk.tests);
    if (result.green) {
      ok = false;
      console.log(`  ✗ NOT CAUGHT: ${brk.tests.map((t) => path.basename(t)).join(', ')} stayed green with this broken`);
      annotate(
        'error',
        `Guarantee no longer checked: ${brk.name}`,
        `"${brk.guarantee}" can be broken (${brk.file}) without ${brk.tests.map((t) => path.basename(t)).join(', ')} failing. ` +
          'Either the tests stopped covering it or the break in scripts/break-guarantees.mjs no longer breaks it.'
      );
      summaryLines.push(`| ✗ | \`${brk.name}\` | ${brk.guarantee} | **not caught** |`);
    } else {
      console.log(`  ✓ caught by ${result.failed.length} failing test(s):`);
      for (const name of result.failed) console.log(`      ${name}`);
      if (result.failed.length === 0) console.log(result.output.slice(-2000));
      summaryLines.push(`| ✓ | \`${brk.name}\` | ${brk.guarantee} | ${result.failed.length} test(s) |`);
    }
    rmSync(dir, { recursive: true, force: true });
  }
} finally {
  rmSync(workRoot, { recursive: true, force: true });
}

console.log(ok ? `\nAll ${selected.length} break(s) caught.` : '\nSome breaks were not caught (see above).');
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [`### Betting guarantees${shardArg ? ` (shard ${shardArg.slice(8)})` : ''}`, '', '| | Break | Guarantee | Caught by |', '|-|-|-|-|', ...summaryLines, ''].join('\n')
  );
}
process.exit(ok ? 0 : 1);
