#!/usr/bin/env -S npx tsx

/**
 * Read-only scientific-completeness characterization for the current V2 data.
 * It reports repository evidence; it does not validate scientific truth.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DRUGS } from '../src/data/drugs';
import { DRUGS_V2 } from '../src/data/drugs.v2';

const WARNING = 'CURRENT REPOSITORY EVIDENCE — NOT SCIENTIFIC OR CLINICAL VALIDATION';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationFixture = JSON.parse(fs.readFileSync(
  path.join(root, 'tests/fixtures/pharmacology/wave0-migration-characterization.json'),
  'utf8',
));
const qualityFixture = JSON.parse(fs.readFileSync(
  path.join(root, 'tests/fixtures/pharmacology/current-data-quality.json'),
  'utf8',
));

const drugs = Object.values(DRUGS_V2);
const bindings = drugs.flatMap((drug) => drug.bindings.map((binding) => ({ drugId: drug.id, ...binding })));
const metaboliteRecords = drugs.flatMap((drug) =>
  (drug.active_metabolites ?? []).map((metabolite) => ({ drugId: drug.id, ...metabolite })),
);
const metaboliteBindings = metaboliteRecords.flatMap((metabolite) => metabolite.bindings);
const pkValues = drugs.flatMap((drug) => [
  drug.pk.molecular_weight_g_mol,
  drug.pk.oral_bioavailability,
  drug.pk.protein_binding,
  drug.pk.brain_plasma_ratio,
  drug.pk.half_life_hours,
]);
const doseUnits = drugs.reduce<Record<string, typeof drugs>>((groups, drug) => {
  (groups[drug.dose_unit] ??= []).push(drug);
  return groups;
}, {});
const v1Ids = Object.keys(DRUGS).sort();
const v2Ids = Object.keys(DRUGS_V2).sort();

const targetNormalizationIssues = [
  { issue: 'legacy alias', examples: ['a2A', 'alpha2A'] },
  { issue: 'display/canonical spelling aliases', examples: ['5-HT2A', '5HT2A'] },
  { issue: 'display/canonical symbol aliases', examples: ['σ1', 's1', 'α1', 'alpha1'] },
  { issue: 'regional-density alias', examples: ['nACh_alpha4beta2', 'nAChR_a4b2'] },
  { issue: 'mechanisms share receptor namespace', examples: ['glutamateUptake', 'presynapticGluRelease', 'cystineGlutamateAntiporter'] },
  { issue: 'mixed target kinds share one namespace', examples: ['receptors', 'enzymes', 'transporters', 'ion channels'] },
  { issue: 'regional calculation silently defaults unmapped targets', examples: ['density fallback = 1.0'] },
];

const report = {
  warning: WARNING,
  ids: {
    v1: v1Ids.length,
    v2: v2Ids.length,
    exactParity: JSON.stringify(v1Ids) === JSON.stringify(v2Ids),
  },
  bindings: {
    total: bindings.length,
    sourceFieldPresent: bindings.filter((binding) => Boolean(binding.source)).length,
    needsVerification: bindings.filter((binding) => binding.source === 'needs verification').length,
    nonSentinelCitationText: bindings.filter((binding) => binding.source && binding.source !== 'needs verification').length,
    sourceAbsent: bindings.filter((binding) => !binding.source).length,
    explicitlyVerified: 0,
    zeroKi: bindings.filter((binding) => binding.ki_nM === 0).length,
    intrinsicEfficacyPresent: bindings.filter((binding) => binding.intrinsic_efficacy !== undefined).length,
    partialAgonistMissingIntrinsicEfficacy: bindings.filter((binding) =>
      binding.type === 'partial_agonist' && binding.intrinsic_efficacy === undefined
    ).length,
    zeroKiRows: bindings.filter((binding) => binding.ki_nM === 0).map(({ drugId, receptor, type, source }) => ({
      drugId, receptor, type, source: source ?? null,
    })),
  },
  pk: {
    numericFields: pkValues.length,
    zeroPlaceholderFields: pkValues.filter((value) => value === 0).length,
    fullyZeroFilledRecords: drugs.filter((drug) => Object.values(drug.pk)
      .filter((value) => typeof value === 'number')
      .every((value) => value === 0)).length,
    petOccupancyEntries: drugs.reduce((total, drug) => total + (drug.pk.pet_occupancy?.length ?? 0), 0),
  },
  activeMetabolites: {
    records: metaboliteRecords.length,
    bindingCount: metaboliteBindings.length,
    sourcedBindings: metaboliteBindings.filter((binding) => Boolean(binding.source)).length,
    recordLevelSourceSupportedBySchema: false,
    rows: metaboliteRecords.map((metabolite) => ({
      drugId: metabolite.drugId,
      name: metabolite.name,
      formationFraction: metabolite.formation_fraction,
      halfLifeHours: metabolite.half_life_hours,
      bindingCount: metabolite.bindings.length,
    })),
  },
  indications: {
    emptyArrays: drugs.filter((drug) => drug.indications.length === 0).length,
    populatedArrays: drugs.filter((drug) => drug.indications.length > 0).length,
  },
  targets: {
    schemaConformingParentBindings: bindings.length,
    evidenceNormalizationStatusModeled: false,
    issueCount: targetNormalizationIssues.length,
    issues: targetNormalizationIssues,
  },
  units: {
    doseUnitFamilies: Object.fromEntries(Object.entries(doseUnits).map(([unit, records]) => [unit, records?.length ?? 0])),
    nonMgRecords: drugs.filter((drug) => drug.dose_unit !== 'мг').map((drug) => ({ id: drug.id, unit: drug.dose_unit })),
    nonMgValuesFlowThroughDoseMgContract: true,
    issueCount: drugs.filter((drug) => drug.dose_unit !== 'мг').length,
  },
  compatibility: {
    legacyFieldDivergences: qualityFixture.legacyCompatibility.divergenceCount,
    behaviorCriticalAffectedDrugs: new Set(qualityFixture.legacyCompatibility.behaviorCritical.map((row: { id: string }) => row.id)).size,
    unresolvedBehaviorCriticalConflicts: migrationFixture.humanReviewCases.filter(
      (row: { status: string }) => row.status === 'BLOCKS_MIGRATION',
    ).length,
  },
};

if (process.argv.includes('--assert')) {
  const expected = {
    ids: [116, 116, true],
    bindings: [349, 268, 261, 7, 81, 11, 12, 0],
    pk: [580, 580, 116, 0],
    metabolites: [3, 8, 3],
    indications: [111, 5],
    units: [5, 4],
    conflicts: [123, 23],
  };
  const actual = {
    ids: [report.ids.v1, report.ids.v2, report.ids.exactParity],
    bindings: [
      report.bindings.total, report.bindings.sourceFieldPresent, report.bindings.needsVerification,
      report.bindings.nonSentinelCitationText, report.bindings.sourceAbsent, report.bindings.zeroKi,
      report.bindings.intrinsicEfficacyPresent, report.bindings.partialAgonistMissingIntrinsicEfficacy,
    ],
    pk: [report.pk.numericFields, report.pk.zeroPlaceholderFields, report.pk.fullyZeroFilledRecords, report.pk.petOccupancyEntries],
    metabolites: [report.activeMetabolites.records, report.activeMetabolites.bindingCount, report.activeMetabolites.sourcedBindings],
    indications: [report.indications.emptyArrays, report.indications.populatedArrays],
    units: [Object.keys(report.units.doseUnitFamilies).length, report.units.nonMgRecords.length],
    conflicts: [report.compatibility.legacyFieldDivergences, report.compatibility.unresolvedBehaviorCriticalConflicts],
  };
  const failures = Object.entries(expected)
    .filter(([key, value]) => JSON.stringify(actual[key as keyof typeof actual]) !== JSON.stringify(value))
    .map(([key, value]) => ({ metric: key, expected: value, actual: actual[key as keyof typeof actual] }));
  if (failures.length) {
    console.error(JSON.stringify({ warning: WARNING, failures }, null, 2));
    process.exit(1);
  }
}

console.log(JSON.stringify(report, null, 2));
