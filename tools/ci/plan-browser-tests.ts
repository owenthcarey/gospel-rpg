import { execFile, execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import type { JSONReport, JSONReportSuite } from '@playwright/test/reporter';
import { balanceBrowserTests, UNKNOWN_TEST_SECONDS } from './browser-shards.ts';

// Ask Playwright for the current suite, so added/renamed tests are always scheduled.
const report: JSONReport = JSON.parse(
  execFileSync(
    process.execPath,
    ['node_modules/@playwright/test/cli.js', 'test', '--list', '--reporter=json'],
    {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    },
  ),
);
if (report.errors.length) throw new Error(JSON.stringify(report.errors));
function testSelectors(report: JSONReport): string[] {
  const selectors: string[] = [];
  function collect(suite: JSONReportSuite, parents: string[] = []) {
    // Top-level suite titles are filenames; nested suites contribute to the title.
    for (const spec of suite.specs) {
      for (const test of spec.tests) {
        const title = [...parents, spec.title];
        if (title.some((part) => /[\r\n›>]/u.test(part) || part !== part.trim())) {
          throw new Error(`Title cannot be represented in a Playwright test list: ${spec.title}`);
        }
        // Test-list paths are relative to Playwright's rootDir, like JSON spec.file.
        selectors.push(`[${test.projectName}] › ${spec.file} › ${title.join(' › ')}`);
      }
    }
    for (const child of suite.suites ?? []) collect(child, [...parents, child.title]);
  }
  for (const suite of report.suites) collect(suite);
  return selectors;
}
// This file has its own required Chromium job in ci.yml.
const selectors = testSelectors(report).filter(
  (test) => !test.includes('] › continuous-journey.spec.ts › '),
);
const timings = JSON.parse(readFileSync('tools/ci/browser-durations.json', 'utf8')) as {
  seconds: Record<string, number>;
};
const shards = balanceBrowserTests(selectors, timings.seconds);
const output = resolve('artifacts/browser-plan');
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
for (const [index, shard] of shards.entries()) {
  writeFileSync(`${output}/${index + 1}.txt`, `${shard.tests.join('\n')}\n`);
}
// Playwright allows an unmatched --test-list to succeed with zero tests. Verify
// every list against real discovery before publishing the matrix, failing closed
// for omissions, extra matches, or a change in Playwright's selector semantics.
const execute = promisify(execFile);
for (let offset = 0; offset < shards.length; offset += 4) {
  await Promise.all(
    shards.slice(offset, offset + 4).map(async (shard, index) => {
      const number = offset + index + 1;
      const { stdout } = await execute(
        process.execPath,
        [
          'node_modules/@playwright/test/cli.js',
          'test',
          '--list',
          '--reporter=json',
          `--test-list=${output}/${number}.txt`,
        ],
        { maxBuffer: 16 * 1024 * 1024 },
      );
      const selected: JSONReport = JSON.parse(stdout);
      if (
        selected.errors.length ||
        JSON.stringify(testSelectors(selected).sort()) !== JSON.stringify([...shard.tests].sort())
      ) {
        throw new Error(`Browser group ${number} does not select exactly its planned tests`);
      }
    }),
  );
}
const unknown = selectors.filter((test) => timings.seconds[test] === undefined);
writeFileSync(`${output}/plan.json`, `${JSON.stringify({ unknown, shards }, null, 2)}\n`);
const summary = [
  `Browser plan: ${selectors.length} cases in ${shards.length} groups.`,
  `Longest estimate: ${Math.max(...shards.map((shard) => shard.estimatedSeconds))} seconds.`,
  `New/renamed cases: ${unknown.length} (estimated at ${UNKNOWN_TEST_SECONDS} seconds each).`,
].join(' ');
console.log(summary);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `shards=${JSON.stringify(shards.map((_, i) => i + 1))}\n`,
  );
}
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `${summary}\n\nSee the browser-plan artifact for exact assignments.\n`,
  );
}
