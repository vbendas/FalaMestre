#!/usr/bin/env node
/**
 * Proves every API route that takes a request body takes it the one shared
 * way, and that each one is covered by the contract tests. Run as
 * `npm run check:bodies`; CI runs it as its own step on every push.
 *
 * Both checks exist as tests too (`body-schema.test.ts` and
 * `route-body-contract.test.ts` call the functions below, so there is one
 * implementation, not two that can drift). They are here as well because in
 * the full suite they are two assertions among eleven hundred, and what they
 * are telling you — "you added a route and skipped the schema" — deserves to
 * arrive as its own red step with the fix written out, not as a diff of two
 * sorted arrays.
 *
 *  1. No route reads a body any way but `ctx.readBody(schema)`. A route that
 *     goes back to casting would pass every behavioural test by simply never
 *     refusing anything, so this one reads the source.
 *  2. Every route that calls `readBody` has a block in the contract tests, so
 *     a new route cannot arrive with no proof that it refuses a bad body and
 *     still accepts a good one.
 *
 * Exit code 0 only if both pass.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, '..');

export const API_DIR = path.join(appDir, 'src/app/api');
export const CONTRACT_TEST = path.join(API_DIR, '__tests__/route-body-contract.test.ts');

/**
 * The ways of reading a body that the shared reader replaced. Each is a
 * substring rather than a parse: they are distinctive enough that a false
 * positive would have to be deliberate, and a regex over TypeScript is a
 * worse bargain than it looks.
 */
const OTHER_WAYS = ['request.json(', 'readJsonBody(', 'ctx.readJson(', 'readJson<'];

/** Every route.ts under src/app/api, as absolute paths. */
export function routeFiles(dir = API_DIR) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : routeFiles(full);
    return entry.name === 'route.ts' ? [full] : [];
  });
}

/** `transfer/buy` for `<api>/transfer/buy/route.ts`. */
function routeName(file) {
  return path.relative(API_DIR, file).replace(/[/\\]route\.ts$/, '').split(path.sep).join('/');
}

/** Routes that take a body, by name, sorted. */
export function routesTakingBody() {
  return routeFiles()
    .filter((file) => readFileSync(file, 'utf8').includes('readBody('))
    .map(routeName)
    .sort();
}

/** Routes reading a body some way other than `ctx.readBody(schema)`. */
export function routesReadingBodyAnotherWay() {
  const offenders = [];
  for (const file of routeFiles()) {
    const source = readFileSync(file, 'utf8');
    for (const way of OTHER_WAYS) {
      if (source.includes(way)) offenders.push({ route: routeName(file), way });
    }
  }
  return offenders;
}

/** Routes that take a body but have no `describe` block in the contract tests. */
export function routesMissingContractTests() {
  const contract = readFileSync(CONTRACT_TEST, 'utf8');
  return routesTakingBody().filter((route) => !contract.includes(`describe('${route}'`));
}

// ---------------------------------------------------------------------------
// CLI

/** Both checks, as `{ problems, remedies }` ready to print. */
export function checkRouteBodies() {
  const problems = [];

  for (const { route, way } of routesReadingBodyAnotherWay()) {
    problems.push({
      what: `${route} reads its request body with \`${way}\``,
      why: 'That skips the schema, so a malformed body reaches the handler as undefined fields and is reported as Forbidden or User not found instead of a 400 naming the field.',
      fix: [
        'Add a schema for the body to src/lib/validations.ts, giving each field a message that names it.',
        "Read the body with `const bodyResult = await ctx.readBody(yourSchema);` and return `bodyResult.response` when `!bodyResult.ok`.",
        'See src/lib/request-schema.ts for what the refusal looks like, and any route under src/app/api for the shape.',
      ],
    });
  }

  for (const route of routesMissingContractTests()) {
    problems.push({
      what: `${route} takes a body but has no block in ${path.relative(appDir, CONTRACT_TEST)}`,
      why: 'Nothing proves it refuses a bad body with the shared reply, or that the body its screen really sends still goes through and still does what it did.',
      fix: [
        `Add \`describe('${route}', ...)\` to that file with two tests:`,
        "  - a body its schema refuses, through `expectRefused(await refusalFrom(...), '<field>')`;",
        '  - the body the screen really sends, asserting the effect on storage, not just a 200.',
        'Copy the nearest existing block; they are all the same shape.',
      ],
    });
  }

  return problems;
}

function main() {
  const problems = checkRouteBodies();
  const routes = routesTakingBody();

  if (problems.length === 0) {
    process.stdout.write(
      `Request body check passed: ${routes.length} routes take a body, all through ctx.readBody(schema), all covered by the contract tests.\n`
    );
    return 0;
  }

  process.stderr.write(`\nRequest body check FAILED — ${problems.length} problem(s).\n`);
  process.stderr.write(
    'Every API route that takes a body must take it through `ctx.readBody(schema)`, so that\n' +
      'a bad body is refused the same way everywhere: 400 `Validation failed` naming the field.\n' +
      'See "Adding a route that takes a body" in README.md.\n'
  );
  for (const problem of problems) {
    process.stderr.write(`\n  ✗ ${problem.what}\n`);
    process.stderr.write(`    Why it matters: ${problem.why}\n`);
    process.stderr.write('    To fix:\n');
    for (const line of problem.fix) process.stderr.write(`      ${line}\n`);
  }
  process.stderr.write('\n');
  return 1;
}

// Only when run directly, so the tests can import the checks above.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
