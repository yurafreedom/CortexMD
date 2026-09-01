#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { comparableBundleMetrics, measureInitialRoute } from './lib/bundle-metrics.mjs';
import { phase0Environment } from './lib/phase0-environment.mjs';

const root = process.cwd();
const nextDir = path.join(root, '.next');
const baselinePath = path.join(root, 'tests', 'fixtures', 'bundle', 'initial-route-baseline.json');

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: phase0Environment(), stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`)));
  });
}

async function cleanBuildAndMeasure(iteration) {
  await rm(nextDir, { recursive: true, force: true });
  console.log(`Bundle reproducibility build ${iteration}/2`);
  await run('npm', ['run', 'build']);
  return measureInitialRoute({ root, port: 3199 + iteration, includeNormalizedHtml: true });
}

function reportFirstHtmlDifference(firstHtml, secondHtml) {
  const maximum = Math.max(firstHtml.length, secondHtml.length);
  let index = 0;
  while (index < maximum && firstHtml[index] === secondHtml[index]) index += 1;
  const start = Math.max(0, index - 120);
  const end = index + 240;
  console.error(JSON.stringify({
    firstDifferenceIndex: index,
    firstContext: firstHtml.slice(start, end),
    secondContext: secondHtml.slice(start, end),
  }, null, 2));
}

const first = await cleanBuildAndMeasure(1);
const second = await cleanBuildAndMeasure(2);
const firstComparable = comparableBundleMetrics(first);
const secondComparable = comparableBundleMetrics(second);

console.log(JSON.stringify({
  warning: 'CURRENT BUNDLE CHARACTERIZATION — NOT A FUTURE PERFORMANCE TARGET',
  first: firstComparable,
  second: secondComparable,
}, null, 2));

const nondeterministic = Object.keys(firstComparable).filter(
  (key) => JSON.stringify(firstComparable[key]) !== JSON.stringify(secondComparable[key]),
);
if (nondeterministic.length) {
  console.error(`Bundle baseline is nondeterministic: ${nondeterministic.join(', ')}`);
  if (nondeterministic.includes('normalizedHtmlGzipBytes')) {
    reportFirstHtmlDifference(first.normalizedHtml, second.normalizedHtml);
  }
  process.exit(1);
}

if (process.argv.includes('--no-gate')) {
  console.log('Bundle measurements are reproducible; baseline gate skipped by --no-gate.');
  process.exit(0);
}

const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
const baselineMismatches = Object.keys(baseline.metrics).filter(
  (key) => JSON.stringify(secondComparable[key]) !== JSON.stringify(baseline.metrics[key]),
);
if (baselineMismatches.length) {
  console.error(`Reproducible build differs from declared baseline: ${baselineMismatches.join(', ')}`);
  process.exit(1);
}

console.log('Bundle reproducibility gate passed: two consecutive clean builds produced identical normalized measurements and match the declared baseline.');
