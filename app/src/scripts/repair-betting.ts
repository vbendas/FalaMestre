/**
 * Entry point of `npm run repair:betting`; scripts/repair-betting.mjs bundles
 * this with esbuild and runs it, so it can use the app's own modules.
 *
 *   npm run repair:betting            report only
 *   npm run repair:betting -- --fix   also repair what can be repaired
 *   npm run repair:betting -- --json  the report as JSON, for a ticket
 *
 * Which database: DATABASE_URL (from the environment or .env.local, as the
 * app reads it) for the hosted one; otherwise the embedded store at
 * PGLITE_DATA_DIR or .data/pglite. Exit code 0 when nothing is left to do,
 * 1 when something needs a person, 2 when a fix failed.
 */

import { repairBetting, formatReport } from '@/lib/betting-repair';
import { describeDatabaseUrl } from '@/lib/log-safe';

async function main() {
  const args = new Set(process.argv.slice(2));
  const fix = args.has('--fix');
  const json = args.has('--json');
  for (const arg of args) {
    if (!['--fix', '--json'].includes(arg)) {
      console.error(`Unknown option ${arg}. Options: --fix, --json`);
      process.exit(2);
    }
  }

  const url = process.env.DATABASE_URL;
  const where = url
    ? `hosted database ${JSON.stringify(describeDatabaseUrl(url))}`
    : `embedded store at ${process.env.PGLITE_DATA_DIR ?? '.data/pglite'}`;
  if (!json) console.log(`${fix ? 'Repairing' : 'Inspecting'} betting on the ${where}.\n`);

  const errors: string[] = [];
  const report = await repairBetting({
    fix,
    onError: (finding, error) =>
      errors.push(`${finding.kind} ${finding.userId} ${finding.matchId}: ${error instanceof Error ? error.message : String(error)}`),
  });

  if (json) {
    console.log(JSON.stringify({ fix, ...report, failed: report.failed.map(f => ({ finding: f.finding, error: String(f.error) })) }, null, 2));
  } else {
    console.log(formatReport(report, { fix }));
  }

  const { closeLocalDatabase } = await import('@/db/local');
  await closeLocalDatabase().catch(() => {});

  if (report.failed.length > 0) process.exit(2);
  if (report.findings.some(f => !f.fixable)) process.exit(1);
  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(2);
});
