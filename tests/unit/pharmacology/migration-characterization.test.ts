import { describe, expect, it } from 'vitest';
import { DRUGS, type Drug } from '@/data/drugs';
import { DRUGS_V2 } from '@/data/drugs.v2';
import { SEROTONIN_WEIGHTS } from '@/constants/receptor-weights';
import { cypVal, realD, zH } from '@/lib/pharmacology';
import { calculateBalance, type ActiveDrug } from '@/lib/indicators/balance';
import { calculateCYPBalance } from '@/lib/indicators/cyp';
import { calculateGlutamateBalance } from '@/lib/indicators/glutamate';
import { calculateNorepinephrineBalance } from '@/lib/indicators/norepinephrine';
import { calculateOccupancy, estimateBrainConcentration_nM } from '@/lib/indicators/occupancy';
import { calculateRegionalBalance } from '@/lib/indicators/regionalBalance';
import { calculateSerotoninBalance } from '@/lib/indicators/serotonin';
import { calculateSigma1Balance } from '@/lib/indicators/sigma1';
import { sumGABAaActivity } from '@/lib/indicators/conditional';
import { getRegionalDensity } from '@/data/regional-density';
import type { DrugSchemaV2, Receptor, ReceptorBinding } from '@/types/pharmacology';
import fixture from '../../fixtures/pharmacology/wave0-migration-characterization.json';
import phase0Behavior from '../../fixtures/pharmacology/current-behavior.json';

const CHARACTERIZATION_WARNING = 'CURRENT BEHAVIOR CHARACTERIZATION — NOT SCIENTIFIC VALIDATION — NOT CLINICAL VALIDATION';

type CriticalField = 'doses' | 'warn_dose' | 'max_dose' | 'default_dose';
type HumanReviewCase = {
  decisionId: string;
  drugId: string;
  field: CriticalField;
  v1: unknown;
  v2: unknown;
  status: 'BLOCKS_MIGRATION';
};

const humanReviewCases = fixture.humanReviewCases as HumanReviewCase[];

function criticalValues(drugId: string, field: CriticalField): [unknown, unknown] {
  const v1 = DRUGS[drugId];
  const v2 = DRUGS_V2[drugId];
  switch (field) {
    case 'doses': return [v1.doses, v2.doses];
    case 'warn_dose': return [v1.warnDose ?? null, v2.warn_dose ?? null];
    case 'max_dose': return [v1.maxDose ?? null, v2.max_dose ?? null];
    case 'default_dose': return [v1.def, v2.default_dose];
  }
}

function isolatedDrug(binding: ReceptorBinding, activeMetabolites?: DrugSchemaV2['active_metabolites']): DrugSchemaV2 {
  return {
    ...DRUGS_V2.buspirone,
    id: `wave0-${binding.receptor}`,
    bindings: [binding],
    active_metabolites: activeMetabolites,
  };
}

function singleBindingBalance(binding: ReceptorBinding, dose_mg = 1) {
  return calculateBalance({
    indicatorId: 'DA',
    activeDrugs: [{ drug: isolatedDrug(binding), dose_mg }],
    weights: { [binding.receptor]: 1 } as Partial<Record<Receptor, number>>,
  });
}

describe('Wave 0 human-review characterization', () => {
  it('labels every Wave 0 fixture as current behavior rather than scientific truth', () => {
    expect(fixture.warning).toBe(CHARACTERIZATION_WARNING);
    expect(humanReviewCases).toHaveLength(23);
    expect(humanReviewCases.map(({ decisionId }) => decisionId)).toEqual(
      Array.from({ length: 23 }, (_, index) => `HR-${String(index + 1).padStart(3, '0')}`),
    );
  });

  it.each(humanReviewCases)('$decisionId freezes $drugId $field without resolving it', (reviewCase) => {
    expect(criticalValues(reviewCase.drugId, reviewCase.field)).toEqual([reviewCase.v1, reviewCase.v2]);
    expect(reviewCase.status).toBe('BLOCKS_MIGRATION');
  });

  it.each(humanReviewCases.filter((reviewCase) => reviewCase.field === 'warn_dose'))(
    '$decisionId freezes V1 warning absence and V2 below/exact/above behavior',
    ({ drugId, v2 }) => {
      const threshold = v2 as number;
      const v1 = DRUGS[drugId];
      const v2Drug = DRUGS_V2[drugId];
      const hasV1Warning = (dose: number) => v1.warnDose !== undefined && dose >= v1.warnDose;
      const hasV2Warning = (dose: number) => v2Drug.warn_dose !== undefined && dose >= v2Drug.warn_dose;

      expect([threshold - 1, threshold, threshold + 1].map(hasV1Warning)).toEqual([false, false, false]);
      expect([threshold - 1, threshold, threshold + 1].map(hasV2Warning)).toEqual([false, true, true]);
    },
  );

  it.each(humanReviewCases)('$decisionId preserves a versionless numeric scheme round trip', ({ drugId, field, v1, v2 }) => {
    const selectedValue = field === 'doses' ? (v1 as number[]).at(-1)! : (v1 ?? v2) as number;
    const serialized = JSON.stringify({ [drugId]: selectedValue });
    const parsed = JSON.parse(serialized) as Record<string, number>;
    expect(parsed).toEqual({ [drugId]: selectedValue });
    expect(parsed).not.toHaveProperty('version');
  });
});

describe('Wave 0 zero, unknown, and intrinsic-efficacy characterization', () => {
  const zeroKiRows = Object.entries(DRUGS_V2).flatMap(([drugId, drug]) =>
    drug.bindings
      .filter((binding) => binding.ki_nM === 0)
      .map((binding) => ({ drugId, receptor: binding.receptor, type: binding.type, source: binding.source })),
  );

  it('freezes all 11 current zero-Ki rows and their source state', () => {
    expect(zeroKiRows).toEqual(fixture.zeroKiBindings);
  });

  it.each(fixture.zeroKiBindings)('freezes conflicting direct/shared/regional zero-Ki semantics for $drugId:$receptor', ({ drugId, receptor }) => {
    const binding = DRUGS_V2[drugId].bindings.find((candidate) => candidate.receptor === receptor)!;
    const weights = { [binding.receptor]: 1 } as Partial<Record<Receptor, number>>;
    const active = [{ drug: isolatedDrug(binding), dose_mg: 1 }];
    const inactive = [{ drug: isolatedDrug(binding), dose_mg: 0 }];

    expect(calculateOccupancy(2, binding.ki_nM)).toBe(0);
    expect(calculateBalance({ indicatorId: 'Glu', activeDrugs: inactive, weights }).value).toBe(0);
    expect(calculateBalance({ indicatorId: 'Glu', activeDrugs: active, weights }).value).not.toBe(0);
    expect(calculateRegionalBalance({ indicatorId: 'Glu', activeDrugs: inactive, weights, region: 'dlPFC' }).value).toBe(0);
    expect(calculateRegionalBalance({ indicatorId: 'Glu', activeDrugs: active, weights, region: 'dlPFC' }).value).not.toBe(0);
  });

  it('freezes occupancy edge behavior, including reachable nonfinite inputs', () => {
    expect(calculateOccupancy(0, 1)).toBe(0);
    expect(calculateOccupancy(1, 0)).toBe(0);
    expect(calculateOccupancy(1, Number.MIN_VALUE)).toBe(1);
    expect(calculateOccupancy(1, Number.MAX_VALUE)).toBeGreaterThan(0);
    expect(calculateOccupancy(1, Number.MAX_VALUE)).toBe(1 / Number.MAX_VALUE);
    expect(calculateOccupancy(1, Number.POSITIVE_INFINITY)).toBe(0);
    expect(Number.isNaN(calculateOccupancy(Number.POSITIVE_INFINITY, 1))).toBe(true);
    expect(Number.isNaN(calculateOccupancy(Number.NaN, 1))).toBe(true);
  });

  it('freezes missing-target and zero-dose behavior', () => {
    const drug = isolatedDrug({ receptor: 'D2', ki_nM: 1, type: 'agonist' });
    const missingTarget = calculateBalance({ indicatorId: 'DA', activeDrugs: [{ drug, dose_mg: 10 }], weights: { D1: 1 } });
    const zeroDose = calculateBalance({ indicatorId: 'DA', activeDrugs: [{ drug, dose_mg: 0 }], weights: { D2: 1 } });
    expect(missingTarget).toMatchObject({ value: 0, raw_net: 0, contributing_drugs: [] });
    expect(zeroDose).toMatchObject({ value: 0, raw_net: 0 });
  });

  it('freezes absent, zero, partial, and full intrinsic-efficacy behavior', () => {
    const result = (intrinsic_efficacy?: number) => singleBindingBalance({
      receptor: 'D2',
      ki_nM: 0,
      type: 'partial_agonist',
      ...(intrinsic_efficacy === undefined ? {} : { intrinsic_efficacy }),
    });

    expect(result().raw_net).toBe(12.5);
    expect(result().breakdown.partial_agonist).toBe(25);
    expect(result(0).raw_net).toBe(0);
    expect(result(0.4).raw_net).toBe(10);
    expect(result(1).raw_net).toBe(25);
  });

  it('freezes all 12 current intrinsic-efficacy rows as unverified repository facts', () => {
    const rows = Object.entries(DRUGS_V2).flatMap(([drugId, drug]) => drug.bindings
      .filter((binding) => binding.intrinsic_efficacy !== undefined)
      .map((binding) => ({ drugId, receptor: binding.receptor, type: binding.type, efficacy: binding.intrinsic_efficacy, source: binding.source })));
    expect(rows).toHaveLength(12);
    expect(rows.every((row) => row.source === 'needs verification')).toBe(true);
    expect(rows.filter((row) => row.type === 'partial_agonist')).toHaveLength(10);
    expect(rows.filter((row) => row.type === 'agonist')).toHaveLength(2);
  });

  it('freezes the conditional zero-Ki GABA path', () => {
    expect(sumGABAaActivity([{ drug: DRUGS_V2.topiramate, dose_mg: 0 }])).toBe(0);
    expect(sumGABAaActivity([{ drug: DRUGS_V2.topiramate, dose_mg: 200 }])).toBe(50);
  });
});

describe('Wave 0 CYP characterization', () => {
  it.each([
    [0, 0], [74, 0], [75, 20], [149, 20], [150, 45], [224, 45], [225, 70], [299, 70], [300, 80],
  ])('freezes V1 bupropion threshold at %d as %d%%', (dose, expected) => {
    expect(cypVal(dose === 0 ? {} : { bupropion: dose })).toBe(expected);
  });

  it('freezes V1 additive fluoxetine behavior and the 95% cap', () => {
    expect(cypVal({ fluoxetine: 20 })).toBe(75);
    expect(cypVal({ bupropion: 75, fluoxetine: 20 })).toBe(95);
    expect(cypVal({ bupropion: 300, fluoxetine: 20 })).toBe(95);
    expect(cypVal({ sertraline: 100 })).toBe(0);
  });

  it('freezes all nine represented V1/V2 CYP records without reconciling them', () => {
    const expectedV1 = {
      bupropion: { cyp: 1 }, desipramine: { cyp2d6s: 3 }, nortriptyline: { cyp2d6s: 3 },
      protriptyline: { cyp2d6s: 3 }, amitriptyline: { cyp2d6s: 2 }, venlafaxine: { cyp2d6s: 1.5 },
      fluoxetine: { cyp2d6i: 75 }, aripiprazole: { cyp2d6s: 2 }, brexpiprazole: { cyp2d6s: 2 },
    };
    const actualV1 = Object.fromEntries(Object.entries(DRUGS)
      .filter(([, drug]) => drug.cyp || drug.cyp2d6i || drug.cyp2d6s)
      .map(([id, drug]) => [id, { ...(drug.cyp ? { cyp: drug.cyp } : {}), ...(drug.cyp2d6i ? { cyp2d6i: drug.cyp2d6i } : {}), ...(drug.cyp2d6s ? { cyp2d6s: drug.cyp2d6s } : {}) }]));
    const actualV2 = Object.fromEntries(Object.entries(DRUGS_V2)
      .filter(([, drug]) => drug.cyp_inhibits?.length || drug.cyp_metabolized_by?.length)
      .map(([id, drug]) => [id, { inhibits: drug.cyp_inhibits, metabolizedBy: drug.cyp_metabolized_by }]));

    expect(actualV1).toEqual(expectedV1);
    expect(Object.keys(actualV2)).toEqual(Object.keys(expectedV1));
    expect(actualV2.bupropion.inhibits).toEqual([{ enzyme: 'CYP2D6', strength: 'moderate' }]);
    expect(actualV2.fluoxetine.inhibits).toEqual([{ enzyme: 'CYP2D6', strength: 'strong' }]);
    expect(Object.entries(actualV2).filter(([id]) => !['bupropion', 'fluoxetine'].includes(id))
      .every(([, value]) => value.metabolizedBy?.[0] === 'CYP2D6')).toBe(true);
  });

  it('freezes V1 substrate exposure multipliers and special cases', () => {
    for (const [id, multiplier] of Object.entries({
      desipramine: 3, nortriptyline: 3, protriptyline: 3, amitriptyline: 2,
      venlafaxine: 1.5, aripiprazole: 2, brexpiprazole: 2,
    })) {
      expect(realD(id, { [id]: 10, bupropion: 300 })).toBeCloseTo(10 * (1 + 0.8 * multiplier), 10);
    }
    expect(realD('atomoxetine', { atomoxetine: 40, bupropion: 300 })).toBe(168);
    expect(realD('vortioxetine', { vortioxetine: 10, bupropion: 300 })).toBe(18.8);
  });

  it('freezes V2 categorical maximum policy, substrate neutrality, and absence', () => {
    const active = (...ids: string[]): ActiveDrug[] => ids.map((id) => ({ drug: DRUGS_V2[id], dose_mg: 1 }));
    expect(calculateCYPBalance(active('bupropion')).value).toBe(-50);
    expect(calculateCYPBalance(active('fluoxetine')).value).toBe(-80);
    expect(calculateCYPBalance(active('bupropion', 'fluoxetine')).value).toBe(-80);
    expect(Object.is(calculateCYPBalance(active('desipramine')).value, -0)).toBe(true);
    expect(Object.is(calculateCYPBalance(active('sertraline')).value, -0)).toBe(true);
    expect(Object.is(calculateCYPBalance([]).value, -0)).toBe(true);
  });
});

describe('Wave 0 regional and active-metabolite characterization', () => {
  it('freezes V1 regional payload fields, bad flag, and fallback independently of V2', () => {
    expect(DRUGS.sertraline.z.dlPFC).toEqual({
      nt: ['5-HT'], fx: ['SERT->5-HT', 's1 ИНВЕРС->пластичность вниз'], i: 3,
    });
    expect(DRUGS.sertraline.z.hippo).toEqual({
      nt: ['5-HT', 's1'], fx: ['5HT1A->нейрогенез', 's1 ИНВЕРС->LTP вниз!'], i: 3, bad: 1,
    });
    expect(zH('not-a-region', '5-HT', { sertraline: 100 })).toBe(65);
    expect(zH('dlPFC', 'DA', { sertraline: 100 })).toBe(65);
  });

  it('freezes V2 region membership, density, aliases through calculation, and unmapped fallback separately', () => {
    expect(DRUGS_V2.sertraline.region_targets).toEqual([
      'dlPFC', 'amygdala', 'hippo', 'vta', 'nac', 'vmPFC', 'acc', 'raphe', 'brainstem', 'spinal',
    ]);
    expect(getRegionalDensity('dlPFC', 'not-a-density-key')).toBe(1);
    const active = [{ drug: DRUGS_V2.sertraline, dose_mg: 100 }];
    expect(calculateRegionalBalance({ indicatorId: '5HT', activeDrugs: active, weights: SEROTONIN_WEIGHTS, region: 'dlPFC' }).value)
      .toBeCloseTo(phase0Behavior.regional.sertraline100Serotonin.dlPFC, 10);
    expect(calculateRegionalBalance({ indicatorId: '5HT', activeDrugs: active, weights: SEROTONIN_WEIGHTS, region: 'insula' }).value)
      .toBeCloseTo(phase0Behavior.regional.sertraline100Serotonin.insula, 10);
  });

  it('freezes all three active-metabolite records and their incomplete source state', () => {
    const metabolites = Object.entries(DRUGS_V2).flatMap(([parentId, drug]) => (drug.active_metabolites ?? [])
      .map((metabolite) => ({
        parentId,
        name: metabolite.name,
        formationFraction: metabolite.formation_fraction,
        halfLifeHours: metabolite.half_life_hours,
        targets: metabolite.bindings.map((binding) => binding.receptor),
        bindingsWithSource: metabolite.bindings.filter((binding) => binding.source).length,
      })));
    expect(metabolites).toEqual([
      { parentId: 'sertraline', name: 'desmethylsertraline', formationFraction: 0.5, halfLifeHours: 66, targets: ['SERT', 's1'], bindingsWithSource: 1 },
      { parentId: 'quetiapine', name: 'norquetiapine', formationFraction: 0.3, halfLifeHours: 12, targets: ['NET', 'H1', '5HT2A', 'M1'], bindingsWithSource: 1 },
      { parentId: 'fluoxetine', name: 'norfluoxetine', formationFraction: 0.8, halfLifeHours: 336, targets: ['SERT', '5HT2C'], bindingsWithSource: 1 },
    ]);
  });

  it.each([
    ['sertraline', calculateSigma1Balance],
    ['quetiapine', calculateNorepinephrineBalance],
    ['fluoxetine', calculateSerotoninBalance],
  ] as const)('distinguishes parent-only from current %s metabolite contribution', (drugId, calculate) => {
    const current = DRUGS_V2[drugId];
    const parentOnly = { ...current, active_metabolites: undefined };
    expect(calculate([{ drug: current, dose_mg: current.default_dose }]).value)
      .not.toBe(calculate([{ drug: parentOnly, dose_mg: current.default_dose }]).value);
  });
});

describe('Wave 0 dose-unit and legacy dose_mg characterization', () => {
  it('freezes every current non-mg dose-unit family', () => {
    const units = Object.entries(DRUGS_V2)
      .filter(([, drug]) => drug.dose_unit !== 'мг')
      .map(([drugId, drug]) => ({ drugId, unit: drug.dose_unit, defaultDose: drug.default_dose }));
    expect(units).toEqual(fixture.nonMgDoseUnits);
    expect(new Set(Object.values(DRUGS_V2).map((drug) => drug.dose_unit))).toEqual(new Set(['мг', 'таб', 'мг/кг', 'комп', 'МЕ']));
  });

  it.each(fixture.nonMgDoseUnits)('freezes $drugId $unit flowing numerically through dose_mg estimation', ({ drugId, defaultDose }) => {
    expect(estimateBrainConcentration_nM(defaultDose, drugId)).toBe(defaultDose * 2);
    const active: ActiveDrug = { drug: DRUGS_V2[drugId], dose_mg: defaultDose };
    expect(active).toMatchObject({ dose_mg: defaultDose });
    expect(JSON.parse(JSON.stringify({ [drugId]: active.dose_mg }))).toEqual({ [drugId]: defaultDose });
  });

  it('keeps the Wave 0 tests explicitly non-validating', () => {
    expect(CHARACTERIZATION_WARNING).toContain('NOT SCIENTIFIC VALIDATION');
    expect(CHARACTERIZATION_WARNING).toContain('NOT CLINICAL VALIDATION');
  });
});
