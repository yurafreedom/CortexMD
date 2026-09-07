import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const warning = 'CURRENT ARCHITECTURE CHARACTERIZATION — NOT A TARGET ARCHITECTURE OR SCIENTIFIC VALIDATION';

function runJson(command: string, args: string[]) {
  return JSON.parse(execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  }));
}

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.DS_Store') return [];
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(absolute) : [path.relative(root, absolute).split(path.sep).join('/')];
  }).sort();
}

describe('CURRENT ARCHITECTURE CHARACTERIZATION — NOT A TARGET ARCHITECTURE', () => {
  const architecture = runJson(process.execPath, ['scripts/audit-current-architecture.mjs', '--json']);

  it('catalogues every non-metadata file under src with the required module fields', () => {
    expect(architecture.warning).toBe(warning);
    expect(architecture.modules.map((module: { path: string }) => module.path).sort()).toEqual(sourceFiles(path.join(root, 'src')));
    expect(architecture.modules).toHaveLength(141);
    for (const module of architecture.modules) {
      expect(module).toEqual(expect.objectContaining({
        path: expect.any(String),
        layerDomain: expect.any(String),
        runtime: expect.any(String),
        primaryResponsibility: expect.any(String),
        responsibilityDetails: expect.any(Array),
        secondaryResponsibilities: expect.any(Array),
        architecturalMix: expect.any(Array),
        importantExports: expect.any(Array),
        importantInputs: expect.any(Array),
        importantOutputs: expect.any(Array),
        sideEffects: expect.any(Array),
        directDependencies: expect.any(Array),
        importantConsumers: expect.any(Array),
        v1Dependency: expect.any(String),
        v2Dependency: expect.any(String),
        scientificSourceDataDependency: expect.any(String),
        derivedHeuristicBehavior: expect.any(String),
        persistenceApiDependency: expect.any(String),
        aiDependency: expect.any(String),
        visualizationDependency: expect.any(String),
        testCoverage: expect.any(String),
        knownGaps: expect.any(Array),
        knownRisks: expect.any(Array),
        proposedFutureDomainModule: expect.any(String),
        plannedMigrationWave: expect.any(String),
      }));
    }
  });

  it('freezes the current runtime import graph and V1/V2 consumer counts', () => {
    expect(architecture.summary).toEqual(expect.objectContaining({
      sourceFilesCatalogued: 141,
      productionModulesCatalogued: 138,
      buildTimeDiagnosticModules: 3,
      directV1ProductionConsumers: 13,
      directV2ProductionConsumers: 6,
      directDualProductionConsumers: 2,
      transitiveV1ProductionConsumers: 18,
      transitiveV2ProductionConsumers: 11,
      transitiveDualProductionConsumers: 7,
      pharmacologyDependencyModules: 43,
      circularDependencyCount: 0,
      unresolvedInternalImportCount: 0,
      serverClientBoundaryRiskCount: 3,
      barrelModuleCount: 3,
    }));
    expect(architecture.findings.serverClientBoundaryRisks).toEqual([
      { client: 'src/app/admin/(auth)/AdminDashboard.tsx', reachesServer: 'src/app/admin/(auth)/actions.ts' },
      { client: 'src/app/admin/(auth)/AdminDashboard.tsx', reachesServer: 'src/lib/admin-session.ts' },
      { client: 'src/app/admin/(auth)/AdminDashboard.tsx', reachesServer: 'src/lib/supabase-server.ts' },
    ]);
    expect(architecture.findings.barrelModules.map((item: { file: string }) => item.file)).toEqual([
      'src/components/Brain3D/index.ts',
      'src/components/IndicatorPopup/index.ts',
      'src/domains/pharmacology/model/index.ts',
    ]);
  });

  it('keeps the working-tree module catalog synchronized with the live diagnostic', () => {
    const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/architecture/module-catalog.json'), 'utf8'));
    expect(catalog.warning).toBe(warning);
    expect(catalog.characterizationBaselineCommit).toBe('6d98af672fe9c7dc4a8709734fec9b8d9a10cd9b');
    expect(catalog.workingTreeBaseCommit).toBe('827749bece26c960c9e0a842f2ab0b7600b88eed');
    expect(catalog.characterizationBaselineCommit).toBe(architecture.characterizationBaselineCommit);
    expect(architecture.workingTreeBaseCommit).toBe(execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
    }).trim());
    for (const commit of [catalog.characterizationBaselineCommit, catalog.workingTreeBaseCommit]) {
      // Git rejects missing commits and commits outside the current HEAD history.
      execFileSync('git', ['merge-base', '--is-ancestor', commit, 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
        timeout: 10_000,
        maxBuffer: 1024 * 1024,
      });
    }
    expect(catalog.summary).toEqual(architecture.summary);
    expect(catalog.modules).toEqual(architecture.modules);
  });

  it('records current versionless persistence contracts without changing the schema', () => {
    const initial = fs.readFileSync(path.join(root, 'supabase/migrations/001_initial.sql'), 'utf8');
    const presets = fs.readFileSync(path.join(root, 'supabase/migrations/006_user_presets.sql'), 'utf8');
    const profile = fs.readFileSync(path.join(root, 'supabase/migrations/004_user_profile_extensions.sql'), 'utf8');
    expect(initial).toMatch(/CREATE TABLE schemes[\s\S]*drugs JSONB NOT NULL/);
    expect(initial).toMatch(/CREATE TABLE scheme_history[\s\S]*drugs JSONB NOT NULL/);
    expect(presets).toMatch(/CREATE TABLE IF NOT EXISTS user_presets[\s\S]*drugs JSONB NOT NULL/);
    expect(profile).toMatch(/CREATE TABLE IF NOT EXISTS user_treatment_history[\s\S]*drug_id TEXT NOT NULL[\s\S]*dose_mg NUMERIC NOT NULL/);
    expect(`${initial}\n${presets}\n${profile}`).not.toMatch(/schema[_ ]?version/i);
  });

  it('recomputes the scientific-completeness report from current data', () => {
    const completeness = runJson(process.execPath, [
      '--import', 'tsx', 'scripts/audit-pharmacology-completeness.ts', '--assert',
    ]);
    expect(completeness.warning).toBe('CURRENT REPOSITORY EVIDENCE — NOT SCIENTIFIC OR CLINICAL VALIDATION');
    expect(completeness.ids).toEqual({ v1: 116, v2: 116, exactParity: true });
    expect(completeness.bindings).toEqual(expect.objectContaining({
      total: 349, sourceFieldPresent: 268, needsVerification: 261,
      sourceAbsent: 81, zeroKi: 11, intrinsicEfficacyPresent: 12,
    }));
    expect(completeness.pk).toEqual({
      numericFields: 580, zeroPlaceholderFields: 580, fullyZeroFilledRecords: 116, petOccupancyEntries: 0,
    });
    expect(completeness.activeMetabolites.records).toBe(3);
    expect(completeness.indications).toEqual({ emptyArrays: 111, populatedArrays: 5 });
    expect(completeness.units.nonMgRecords).toHaveLength(4);
    expect(completeness.compatibility.unresolvedBehaviorCriticalConflicts).toBe(23);
  });
});
