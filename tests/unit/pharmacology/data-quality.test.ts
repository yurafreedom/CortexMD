import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DRUGS } from '@/data/drugs';
import { DRUGS_V2 } from '@/data/drugs.v2';
import fixture from '../../fixtures/pharmacology/current-data-quality.json';

const currentWarning = 'CURRENT BEHAVIOR CHARACTERIZATION — NOT SCIENTIFIC VALIDATION — NOT CLINICAL VALIDATION';

function currentQualityFacts() {
  const drugs = Object.values(DRUGS_V2);
  const bindings = drugs.flatMap((drug) => drug.bindings);
  return {
    v1IdCount: Object.keys(DRUGS).length,
    v2IdCount: Object.keys(DRUGS_V2).length,
    bindingsTotal: bindings.length,
    needsVerification: bindings.filter((binding) => binding.source === 'needs verification').length,
    withoutSource: bindings.filter((binding) => !binding.source).length,
    mainPkZeroFilled: drugs.filter((drug) =>
      drug.pk.molecular_weight_g_mol === 0
      && drug.pk.oral_bioavailability === 0
      && drug.pk.protein_binding === 0
      && drug.pk.brain_plasma_ratio === 0
      && drug.pk.half_life_hours === 0
    ).length,
    petOccupancyEntries: drugs.reduce((total, drug) => total + (drug.pk.pet_occupancy?.length ?? 0), 0),
    emptyIndications: drugs.filter((drug) => drug.indications.length === 0).length,
    bindingsWithIntrinsicEfficacy: bindings.filter((binding) => binding.intrinsic_efficacy !== undefined).length,
    zeroKiBindings: bindings.filter((binding) => binding.ki_nM === 0).length,
    activeMetaboliteRecords: drugs.reduce((total, drug) => total + (drug.active_metabolites?.length ?? 0), 0),
  };
}

describe('V1/V2 current data characterization', () => {
  it('labels the fixture as characterization rather than scientific truth', () => {
    expect(fixture.warning).toBe(currentWarning);
  });

  it('freezes every current V1 and V2 ID with exact parity', () => {
    const v1Ids = Object.keys(DRUGS).sort();
    const v2Ids = Object.keys(DRUGS_V2).sort();
    expect(v1Ids).toEqual(fixture.ids);
    expect(v2Ids).toEqual(fixture.ids);
    expect(v2Ids).toEqual(v1Ids);
  });

  it('recomputes the current V2 quality and provenance facts', () => {
    expect(currentQualityFacts()).toEqual(fixture.quality);
  });

  it('freezes current legacy-compatibility behavior, including known divergences', () => {
    const divergences: Array<{ id: string; field: string; v1: unknown; v2: unknown }> = [];
    for (const id of fixture.ids) {
      const v1 = DRUGS[id];
      const v2 = DRUGS_V2[id];
      expect(v2.id, id).toBe(v1.id);
      const fields = {
        legacy_short: [v1.s, v2.legacy_short],
        legacy_name_ru: [v1.n, v2.legacy_name_ru],
        doses: [v1.doses, v2.doses],
        default_dose: [v1.def, v2.default_dose],
        dose_unit: [v1.u, v2.dose_unit],
        warn_dose: [v1.warnDose ?? null, v2.warn_dose ?? null],
        max_dose: [v1.maxDose ?? null, v2.max_dose ?? null],
        warn_text: [v1.warnText ?? null, v2.warn_text ?? null],
        warnings: [v1.warnings ?? {}, v2.warnings ?? {}],
        is_otc: [Boolean(v1.isOTC), v2.is_otc ?? false],
      };
      for (const [field, [v1Value, v2Value]] of Object.entries(fields)) {
        if (JSON.stringify(v1Value) !== JSON.stringify(v2Value)) {
          divergences.push({ id, field, v1: v1Value, v2: v2Value });
        }
      }
    }

    const byFieldCounts = Object.fromEntries(
      [...new Set(divergences.map((item) => item.field))]
        .sort()
        .map((field) => [field, divergences.filter((item) => item.field === field).length]),
    );
    const behaviorFields = new Set(['doses', 'default_dose', 'dose_unit', 'warn_dose', 'max_dose', 'warn_text', 'warnings', 'is_otc']);

    expect(divergences.length).toBe(fixture.legacyCompatibility.divergenceCount);
    expect(createHash('sha256').update(JSON.stringify(divergences)).digest('hex')).toBe(fixture.legacyCompatibility.sha256);
    expect(byFieldCounts).toEqual(fixture.legacyCompatibility.byFieldCounts);
    expect(divergences.filter((item) => behaviorFields.has(item.field))).toEqual(fixture.legacyCompatibility.behaviorCritical);
  });

  it('freezes representative dose ranges and warnings', () => {
    for (const [id, expected] of Object.entries(fixture.representatives)) {
      const drug = DRUGS[id];
      expect({
        defaultDose: drug.def,
        doses: drug.doses,
        warnDose: drug.warnDose ?? null,
        maxDose: drug.maxDose ?? null,
        warnText: drug.warnText ?? null,
        warnings: drug.warnings ?? {},
      }, id).toEqual(expected);
    }
  });

  it('surfaces invalid numeric drift without asserting scientific completeness', () => {
    for (const [id, drug] of Object.entries(DRUGS_V2)) {
      expect(drug.id, id).toBe(id);
      expect(drug.doses.length, id).toBeGreaterThan(0);
      expect(drug.doses.every(Number.isFinite), id).toBe(true);
      expect(Number.isFinite(drug.default_dose), id).toBe(true);
      for (const binding of drug.bindings) {
        expect(Number.isFinite(binding.ki_nM), `${id}:${binding.receptor}`).toBe(true);
        expect(binding.ki_nM, `${id}:${binding.receptor}`).toBeGreaterThanOrEqual(0);
        if (binding.intrinsic_efficacy !== undefined) {
          expect(binding.intrinsic_efficacy, `${id}:${binding.receptor}`).toBeGreaterThanOrEqual(0);
          expect(binding.intrinsic_efficacy, `${id}:${binding.receptor}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
