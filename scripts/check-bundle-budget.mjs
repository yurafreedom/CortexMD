#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { comparableBundleMetrics, measureInitialRoute } from './lib/bundle-metrics.mjs';

const root = process.cwd();
const baselinePath = path.join(root, 'tests', 'fixtures', 'bundle', 'initial-route-baseline.json');
const report = await measureInitialRoute({ root, port: Number(process.env.CORTEXMD_BUNDLE_PORT ?? 3199) });
const comparable = comparableBundleMetrics(report);

console.log(JSON.stringify({
  warning: 'CURRENT BUNDLE CHARACTERIZATION — NOT A FUTURE PERFORMANCE TARGET',
  ...report,
}, null, 2));

if (process.argv.includes('--no-gate')) process.exit(0);

const baseline = JSON.parse(await readFile(baselinePath, 'utf8'));
const maximumDeclaredGzipBytes = baseline.metrics.initialAssetsGzipBytes + baseline.regressionAllowanceGzipBytes;

if (comparable.initialAssetsGzipBytes > maximumDeclaredGzipBytes) {
  console.error(`Initial-route gzip regression: ${comparable.initialAssetsGzipBytes} B exceeds ${maximumDeclaredGzipBytes} B.`);
  process.exit(1);
}

if (comparable.threeInInitialGraph !== baseline.metrics.threeInInitialGraph) {
  console.error(`Initial-route Three.js graph state changed: expected ${baseline.metrics.threeInInitialGraph}, got ${comparable.threeInInitialGraph}.`);
  process.exit(1);
}

console.log(`Bundle gate passed: ${comparable.initialAssetsGzipBytes} B normalized initial-route gzip; allowance ${baseline.regressionAllowanceGzipBytes} B; Three.js initial graph=${comparable.threeInInitialGraph}.`);
