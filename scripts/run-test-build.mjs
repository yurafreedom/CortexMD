#!/usr/bin/env node

import { spawn } from 'node:child_process';
import process from 'node:process';
import { phase0Environment } from './lib/phase0-environment.mjs';

const child = spawn('npm', ['run', 'build'], {
  cwd: process.cwd(),
  env: phase0Environment(),
  stdio: 'inherit',
});

child.once('error', (error) => {
  console.error(error);
  process.exit(1);
});
child.once('exit', (code, signal) => {
  if (signal) {
    console.error(`Test build terminated by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
