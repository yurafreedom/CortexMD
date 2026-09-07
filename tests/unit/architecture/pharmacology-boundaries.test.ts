import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type CatalogModule = {
  path: string;
  layerDomain: string;
  runtime: string;
  directDependencies: string[];
  importantConsumers: string[];
  v1Dependency: string;
  v2Dependency: string;
  derivedHeuristicBehavior: string;
};

const root = process.cwd();
const domainPrefix = 'src/domains/pharmacology/';
const approvedFiles = [
  'README.md',
  'model/drug.ts',
  'model/evidence.ts',
  'model/ids.ts',
  'model/index.ts',
  'model/interaction.ts',
  'model/knowledge.ts',
  'model/metabolism.ts',
  'model/quantity.ts',
  'model/target.ts',
  'validation/drug.ts',
  'validation/epistemics.ts',
  'validation/interaction.ts',
  'validation/metabolism.ts',
  'validation/primitives.ts',
  'validation/target.ts',
] as const;

function filesBelow(directory: string, prefix = ''): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(absolute, relative) : [relative];
  }).sort();
}

const report = JSON.parse(execFileSync(process.execPath, [
  'scripts/audit-current-architecture.mjs',
  '--json',
], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
}));
const modules = report.modules as CatalogModule[];
const byPath = new Map(modules.map((module) => [module.path, module]));
const domainModules = modules.filter(({ path: modulePath }) => modulePath.startsWith(domainPrefix));

function reachableFrom(start: string): Set<string> {
  const reached = new Set<string>();
  const pending = [start];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const dependency of byPath.get(current)?.directDependencies ?? []) {
      if (!byPath.has(dependency) || reached.has(dependency)) continue;
      reached.add(dependency);
      pending.push(dependency);
    }
  }
  return reached;
}

describe('Wave 1 pharmacology boundaries', () => {
  it('contains exactly the approved 16 domain files', () => {
    expect(filesBelow(path.join(root, domainPrefix))).toEqual(approvedFiles);
    expect(domainModules.map(({ path: modulePath }) => modulePath.slice(domainPrefix.length)).sort()).toEqual(approvedFiles);
  });

  it('keeps model reachability inside the model with no framework or data dependencies', () => {
    const forbiddenText = /(?:\bDRUGS(?:_V2)?\b|drugs\.v2|src\/data|@\/data|react|next\/|supabase|anthropic|three|zod)/;
    for (const module of domainModules.filter(({ path: modulePath }) => modulePath.includes('/model/'))) {
      expect(module.layerDomain).toBe('domain/pharmacology/model');
      expect([...reachableFrom(module.path)].every((dependency) => dependency.startsWith(`${domainPrefix}model/`))).toBe(true);
      expect(module.directDependencies.every((dependency) => dependency.startsWith(`${domainPrefix}model/`))).toBe(true);
      expect(fs.readFileSync(path.join(root, module.path), 'utf8')).not.toMatch(forbiddenText);
    }
  });

  it('allows validation to reach only model, validation, and Zod', () => {
    const forbiddenText = /(?:\bDRUGS(?:_V2)?\b|drugs\.v2|src\/data|@\/data|react|next\/|supabase|anthropic|three|components|app\/|persistence)/;
    for (const module of domainModules.filter(({ path: modulePath }) => modulePath.includes('/validation/'))) {
      expect(module.layerDomain).toBe('domain/pharmacology/validation');
      expect(module.directDependencies.every((dependency) =>
        dependency === 'zod'
        || dependency.startsWith(`${domainPrefix}model/`)
        || dependency.startsWith(`${domainPrefix}validation/`),
      )).toBe(true);
      expect([...reachableFrom(module.path)].every((dependency) => dependency.startsWith(domainPrefix))).toBe(true);
      expect(fs.readFileSync(path.join(root, module.path), 'utf8')).not.toMatch(forbiddenText);
    }
  });

  it('has no outside production consumer and is unreachable from current client modules', () => {
    for (const module of domainModules) {
      expect(module.importantConsumers.filter((consumer) => !consumer.startsWith(domainPrefix))).toEqual([]);
      expect(module.v1Dependency).toBe('none');
      expect(module.v2Dependency).toBe('none');
    }

    for (const module of modules.filter(({ runtime }) => runtime === 'client')) {
      expect([...reachableFrom(module.path)].some((dependency) => dependency.startsWith(domainPrefix))).toBe(false);
    }
  });

  it('adds no runtime cycle', () => {
    expect(report.summary.circularDependencyCount).toBe(0);
  });

  it('distinguishes heuristic provenance vocabulary from current heuristic execution', () => {
    expect(byPath.get(`${domainPrefix}model/knowledge.ts`)?.derivedHeuristicBehavior).toBe('none detected by source heuristic');
    expect(byPath.get('src/lib/pharmacology.ts')?.derivedHeuristicBehavior).toBe('yes — current behavior only; review module details');
    expect(byPath.get('src/lib/indicators/balance.ts')?.derivedHeuristicBehavior).toBe('yes — current behavior only; review module details');
  });
});
