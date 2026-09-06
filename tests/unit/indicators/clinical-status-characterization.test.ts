import { describe, expect, it } from 'vitest';
import { calculateHPAStatus } from '@/lib/indicators/hpaAxis';
import { calculateInflammatoryLoad } from '@/lib/indicators/inflammatoryLoad';

const CHARACTERIZATION_WARNING = 'CURRENT BEHAVIOR CHARACTERIZATION — NOT SCIENTIFIC VALIDATION — NOT CLINICAL VALIDATION';

describe('CURRENT BEHAVIOR CHARACTERIZATION — HPA axis, not scientific validation', () => {
  it('freezes missing and single-marker behavior', () => {
    expect(calculateHPAStatus({})).toEqual({
      status: 'insufficient_data',
      cortisolLevel: 'unknown',
      dheaLevel: 'unknown',
      ratio: null,
      ratioInterpretation: 'No HPA markers available.',
      color: '#475569',
      recommendation: 'Need both AM cortisol and DHEA-S to assess HPA axis status.',
    });
    expect(calculateHPAStatus({ dhea_s: 100 })).toMatchObject({
      status: 'insufficient_data', cortisolLevel: 'unknown', dheaLevel: 'normal', ratio: null, ratioInterpretation: '',
    });
    expect(calculateHPAStatus({ cortisol_am: 5 })).toMatchObject({ status: 'hypoactivation', cortisolLevel: 'low', dheaLevel: 'unknown' });
    expect(calculateHPAStatus({ cortisol_am: 10 })).toMatchObject({ status: 'normal', cortisolLevel: 'normal', dheaLevel: 'unknown' });
    expect(calculateHPAStatus({ cortisol_am: 24 })).toMatchObject({ status: 'hyperactivation', cortisolLevel: 'high', dheaLevel: 'unknown' });
  });

  it('freezes cortisol and DHEA-S classification boundaries', () => {
    expect(calculateHPAStatus({ cortisol_am: 5.999 }).cortisolLevel).toBe('low');
    expect(calculateHPAStatus({ cortisol_am: 6 }).cortisolLevel).toBe('normal');
    expect(calculateHPAStatus({ cortisol_am: 23 }).cortisolLevel).toBe('normal');
    expect(calculateHPAStatus({ cortisol_am: 23.001 }).cortisolLevel).toBe('high');
    expect(calculateHPAStatus({ dhea_s: 34.999 }).dheaLevel).toBe('low');
    expect(calculateHPAStatus({ dhea_s: 35 }).dheaLevel).toBe('normal');
    expect(calculateHPAStatus({ dhea_s: 430 }).dheaLevel).toBe('normal');
    expect(calculateHPAStatus({ dhea_s: 430.001 }).dheaLevel).toBe('high');
  });

  it('freezes ratio boundaries, status precedence, and exact clinical-looking text', () => {
    expect(calculateHPAStatus({ cortisol_am: 10, dhea_s: 400 })).toMatchObject({
      status: 'normal', ratio: 0.025, ratioInterpretation: 'Low ratio — relative cortisol deficiency or DHEA excess.',
    });
    expect(calculateHPAStatus({ cortisol_am: 10, dhea_s: 200 })).toMatchObject({
      status: 'normal', ratio: 0.05, ratioInterpretation: 'Normal ratio — balanced HPA function.',
    });
    expect(calculateHPAStatus({ cortisol_am: 20, dhea_s: 100 })).toMatchObject({
      status: 'normal', ratio: 0.2, ratioInterpretation: 'Normal ratio — balanced HPA function.',
    });
    expect(calculateHPAStatus({ cortisol_am: 25, dhea_s: 50 })).toMatchObject({
      status: 'hyperactivation', ratio: 0.5, ratioInterpretation: 'Elevated ratio — chronic stress pattern.',
      recommendation: 'Elevated cortisol/DHEA-S ratio suggests chronic stress. Consider stress management, adaptogenic support.',
    });
    expect(calculateHPAStatus({ cortisol_am: 25.001, dhea_s: 50 })).toMatchObject({
      status: 'severe_hyperactivation', ratioInterpretation: 'Very high ratio — severe HPA dysregulation.',
      recommendation: 'Severe HPA dysregulation. Rule out Cushing\'s syndrome. Consider cortisol-lowering interventions.',
    });
    expect(calculateHPAStatus({ cortisol_am: 5, dhea_s: 34 })).toMatchObject({ status: 'burnout' });
    expect(calculateHPAStatus({ cortisol_am: 10, dhea_s: 0 })).toMatchObject({ status: 'normal', ratio: null, ratioInterpretation: '' });
  });
});

describe('CURRENT BEHAVIOR CHARACTERIZATION — inflammatory load, not scientific validation', () => {
  it('freezes empty, unknown-marker, and missing-marker output', () => {
    expect(calculateInflammatoryLoad([])).toEqual({
      score: 0,
      zone: { label: 'Low', color: '#22c55e', recommendation: 'No anti-inflammatory intervention needed.' },
      markers: [],
      missingMarkers: ['CRP (hs)', 'IL-6', 'TNF-α', 'Homocysteine', 'ESR'],
    });
    expect(calculateInflammatoryLoad([{ name: 'unknown', value: 999 }])).toEqual(calculateInflammatoryLoad([]));
  });

  it.each([
    ['CRP (hs)', 1, 0], ['IL-6', 7, 0], ['TNF-α', 8.1, 0], ['Homocysteine', 15, 0], ['ESR', 20, 0],
    ['CRP (hs)', 10, 100], ['IL-6', 30, 100], ['TNF-α', 25, 100], ['Homocysteine', 30, 100], ['ESR', 60, 100],
  ] as const)('freezes %s value %d at individual score %d', (name, value, score) => {
    const result = calculateInflammatoryLoad([{ name, value }]);
    expect(result.score).toBe(score);
    expect(result.markers).toEqual([{ name, value, score, weight: expect.any(Number) }]);
  });

  it('freezes clamping, partial-data normalization, duplicate handling, and retained negative input', () => {
    expect(calculateInflammatoryLoad([{ name: 'CRP (hs)', value: 100 }]).score).toBe(100);
    expect(calculateInflammatoryLoad([{ name: 'CRP (hs)', value: -1 }])).toMatchObject({
      score: 0, markers: [{ name: 'CRP (hs)', value: -1, score: 0, weight: 0.3 }],
    });
    const duplicate = calculateInflammatoryLoad([
      { name: 'CRP (hs)', value: 1 },
      { name: 'CRP (hs)', value: 10 },
    ]);
    expect(duplicate.markers).toHaveLength(2);
    expect(duplicate.score).toBe(50);
  });

  it('freezes zone boundaries and their exact clinical-looking recommendations', () => {
    expect(calculateInflammatoryLoad([{ name: 'CRP (hs)', value: 2.349 }]).zone.label).toBe('Low');
    expect(calculateInflammatoryLoad([{ name: 'CRP (hs)', value: 2.35 }]).zone.label).toBe('Moderate');
    expect(calculateInflammatoryLoad([{ name: 'CRP (hs)', value: 4.6 }])).toMatchObject({ score: 40, zone: { label: 'High' } });
    expect(calculateInflammatoryLoad([{ name: 'CRP (hs)', value: 4.600001 }]).zone.label).toBe('High');
    expect(calculateInflammatoryLoad([{ name: 'CRP (hs)', value: 7.300001 }])).toMatchObject({
      score: 70,
      zone: {
        label: 'Severe',
        recommendation: 'Rule out autoimmune, infectious, or malignant etiology.',
      },
    });
  });

  it('keeps this suite explicitly non-validating', () => {
    expect(CHARACTERIZATION_WARNING).toContain('CURRENT BEHAVIOR CHARACTERIZATION');
    expect(CHARACTERIZATION_WARNING).toContain('NOT SCIENTIFIC VALIDATION');
  });
});
