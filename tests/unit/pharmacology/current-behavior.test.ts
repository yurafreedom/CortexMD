import { describe, expect, it } from 'vitest';
import { DRUGS_V2 } from '@/data/drugs.v2';
import { calculateDopamineBalance } from '@/lib/indicators/dopamine';
import { calculateNorepinephrineBalance } from '@/lib/indicators/norepinephrine';
import { calculateSerotoninBalance } from '@/lib/indicators/serotonin';
import { calculateGlutamateBalance } from '@/lib/indicators/glutamate';
import { calculateSigma1Balance } from '@/lib/indicators/sigma1';
import { calculateCYPBalance } from '@/lib/indicators/cyp';
import { calculateRegionalBalance } from '@/lib/indicators/regionalBalance';
import {
  CONDITIONAL_INDICATORS,
  calculateACBBalance,
  calculateACBScore,
  calculateAlpha1Balance,
  calculateGABABalance,
  calculateH1Balance,
  calculateOpioidBalance,
  maxH1Occupancy,
  sumGABAaActivity,
} from '@/lib/indicators/conditional';
import { SEROTONIN_WEIGHTS } from '@/constants/receptor-weights';
import { cypVal, gH, occ, realD, zH, type ActiveDrugs } from '@/lib/pharmacology';
import { s1Bal } from '@/lib/sigma1';
import type { ActiveDrug } from '@/lib/indicators/balance';
import type { IndicatorBalance } from '@/types/indicators';
import fixture from '../../fixtures/pharmacology/current-behavior.json';

type IndicatorCalculator = (activeDrugs: ActiveDrug[]) => IndicatorBalance;

const calculators: Record<string, IndicatorCalculator> = {
  DA: calculateDopamineBalance,
  NA: calculateNorepinephrineBalance,
  '5HT': calculateSerotoninBalance,
  Glu: calculateGlutamateBalance,
  s1: calculateSigma1Balance,
  CYP: calculateCYPBalance,
};

const presetCalculators: Record<string, IndicatorCalculator> = {
  DA: calculateDopamineBalance,
  NA: calculateNorepinephrineBalance,
  '5-HT': calculateSerotoninBalance,
  Glu: calculateGlutamateBalance,
  'σ1': calculateSigma1Balance,
  CYP: calculateCYPBalance,
  'ACh (ACB)': calculateACBBalance,
  GABA: calculateGABABalance,
  H1: calculateH1Balance,
  'α1': calculateAlpha1Balance,
  Opioid: calculateOpioidBalance,
};

function activeDrugList(scheme: ActiveDrugs): ActiveDrug[] {
  return Object.entries(scheme).map(([id, dose_mg]) => ({ drug: DRUGS_V2[id], dose_mg }));
}

function triggered(scheme: ActiveDrugs) {
  const list = activeDrugList(scheme);
  return CONDITIONAL_INDICATORS.filter((indicator) => indicator.detect(list)).map((indicator) => indicator.id);
}

describe('current pharmacology calculation behavior', () => {
  it('keeps the scientific-safety warning attached to every golden result', () => {
    expect(fixture.warning).toBe('CURRENT BEHAVIOR CHARACTERIZATION — NOT SCIENTIFIC VALIDATION — NOT CLINICAL VALIDATION');
  });

  it.each(fixture.representativeIndicatorCases)(
    'freezes $drugId $dose $indicator output',
    ({ drugId, dose, indicator, value, rawNet, zone }) => {
      const result = calculators[indicator]([{ drug: DRUGS_V2[drugId], dose_mg: dose }]);
      expect(result.value).toBeCloseTo(value, 10);
      expect(result.raw_net).toBeCloseTo(rawNet, 10);
      expect(result.zone.id).toBe(zone);
    },
  );

  it.each(fixture.zeroKiCases)(
    'freezes current zero-Ki fallback for $drugId',
    ({ drugId, dose, roundedValue }) => {
      const result = calculators.Glu([{ drug: DRUGS_V2[drugId], dose_mg: dose }]);
      expect(Math.round(result.value)).toBe(roundedValue);
    },
  );

  it('freezes current CYP2D6 combination and effective-dose behavior', () => {
    expect(cypVal(fixture.legacy.cyp2d6Combination.scheme)).toBe(fixture.legacy.cyp2d6Combination.cypPercent);
    expect(realD('atomoxetine', fixture.legacy.atomoxetineRealDose.scheme)).toBeCloseTo(fixture.legacy.atomoxetineRealDose.value, 10);
    expect(realD('vortioxetine', fixture.legacy.vortioxetineRealDose.scheme)).toBeCloseTo(fixture.legacy.vortioxetineRealDose.value, 10);
  });

  it('freezes legacy dopamine/noradrenaline/serotonin regional heuristics', () => {
    const scheme = { sertraline: 100 };
    expect(occ('sertraline', 'SERT', scheme)).toBeCloseTo(fixture.legacy.sertraline.sertOccupancy, 10);
    expect(gH('5-HT', scheme)).toBeCloseTo(fixture.legacy.sertraline.globalSerotonin, 10);
    expect(zH('dlPFC', '5-HT', scheme)).toBeCloseTo(fixture.legacy.sertraline.dlPFCSerotonin, 10);
    expect(gH('DA', { bupropion: 300 })).not.toBe(65);
    expect(gH('NA', { atomoxetine: 10 })).not.toBe(65);
  });

  it('freezes sigma agonist, inverse agonist, and antagonist legacy paths', () => {
    expect(s1Bal(fixture.legacy.sigma.agonist.scheme).net).toBeCloseTo(fixture.legacy.sigma.agonist.net, 10);
    expect(s1Bal(fixture.legacy.sigma.inverseAgonist.scheme).net).toBeCloseTo(fixture.legacy.sigma.inverseAgonist.net, 10);
    expect(s1Bal(fixture.legacy.sigma.antagonist.scheme).net).toBeCloseTo(fixture.legacy.sigma.antagonist.net, 10);
  });

  it('freezes PET-density regional behavior', () => {
    const list = activeDrugList({ sertraline: 100 });
    const dlPFC = calculateRegionalBalance({ indicatorId: '5HT', activeDrugs: list, weights: SEROTONIN_WEIGHTS, region: 'dlPFC' });
    const insula = calculateRegionalBalance({ indicatorId: '5HT', activeDrugs: list, weights: SEROTONIN_WEIGHTS, region: 'insula' });
    expect(dlPFC.value).toBeCloseTo(fixture.regional.sertraline100Serotonin.dlPFC, 10);
    expect(insula.value).toBeCloseTo(fixture.regional.sertraline100Serotonin.insula, 10);
    expect(insula.value).toBeGreaterThan(dlPFC.value);
  });

  it('freezes conditional indicator detection and scores', () => {
    expect(triggered({ sertraline: 100 })).toEqual(fixture.conditional.sertraline100Triggered);
    expect(triggered({ amitriptyline: 75 })).toEqual(fixture.conditional.amitriptyline75.triggered);
    expect(calculateACBScore(activeDrugList({ amitriptyline: 75 }))).toBe(fixture.conditional.amitriptyline75.acb);
    expect(triggered({ quetiapine: 100 })).toEqual(fixture.conditional.quetiapine100.triggered);
    expect(Math.round(maxH1Occupancy(activeDrugList({ quetiapine: 100 })))).toBe(fixture.conditional.quetiapine100.h1OccupancyRounded);
    expect(triggered({ topiramate: 200 })).toEqual(fixture.conditional.topiramate200.triggered);
    expect(sumGABAaActivity(activeDrugList({ topiramate: 200 }))).toBe(fixture.conditional.topiramate200.gabaActivity);
  });

  it('freezes active-metabolite contributions captured by the prior diagnostic script', () => {
    expect(Math.round(calculateSigma1Balance(activeDrugList({ sertraline: 100 })).value)).toBe(-85);
    expect(calculateNorepinephrineBalance(activeDrugList({ quetiapine: 100 })).value).toBeCloseTo(3.9, 1);
    expect(calculateSerotoninBalance(activeDrugList({ fluoxetine: 20 })).value).toBeCloseTo(89.2, 1);
  });

  it.each(Object.entries(fixture.presetComparison))('freezes %s preset comparison vector', (_name, preset) => {
    const list = activeDrugList(preset.scheme);
    const actual = Object.fromEntries(Object.entries(presetCalculators).map(([label, calculate]) => [
      label,
      Object.is(Math.round(calculate(list).value), -0) ? 0 : Math.round(calculate(list).value),
    ]));
    expect(actual).toEqual(preset.indicators);
  });
});
