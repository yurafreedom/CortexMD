import { describe, expect, expectTypeOf, it } from 'vitest';
import type { BiologicalProcessId, MolecularTargetId } from '@/domains/pharmacology/model/ids';
import { MOLECULAR_TARGET_KINDS } from '@/domains/pharmacology/model/target';
import {
  affinityInteractionSchema,
  functionalInteractionSchema,
} from '@/domains/pharmacology/validation/interaction';
import {
  biologicalProcessRefSchema,
  molecularTargetRefSchema,
} from '@/domains/pharmacology/validation/target';

const molecularTarget = molecularTargetRefSchema.parse({
  targetType: 'MOLECULAR_TARGET',
  id: 'target:synthetic',
  kind: 'RECEPTOR',
});

const biologicalProcess = biologicalProcessRefSchema.parse({
  targetType: 'BIOLOGICAL_PROCESS',
  id: 'process:synthetic',
});

const noEvidence = {
  curationStatus: 'UNREVIEWED',
  evidenceLinks: [],
} as const;

const baseAffinity = {
  interactionType: 'AFFINITY',
  target: molecularTarget,
  affinity: {
    ...noEvidence,
    knowledge: { state: 'KNOWN', value: { value: 12, unit: 'nM' }, derivation: 'MEASURED' },
  },
  pharmacologicalMode: {
    ...noEvidence,
    knowledge: { state: 'KNOWN', value: 'PARTIAL_AGONIST', derivation: 'LITERATURE_CURATED' },
  },
  intrinsicEfficacy: {
    ...noEvidence,
    knowledge: { state: 'UNKNOWN', reason: 'assay-normalized efficacy unavailable' },
  },
} as const;

describe('pharmacology targets and interactions', () => {
  it('keeps molecular-target and biological-process IDs structurally distinct', () => {
    expectTypeOf<MolecularTargetId>().not.toEqualTypeOf<BiologicalProcessId>();
    expect(molecularTarget.targetType).toBe('MOLECULAR_TARGET');
    expect(biologicalProcess.targetType).toBe('BIOLOGICAL_PROCESS');
  });

  it('requires an explicit foundational kind for every molecular target', () => {
    for (const kind of MOLECULAR_TARGET_KINDS) {
      expect(molecularTargetRefSchema.safeParse({ ...molecularTarget, kind }).success).toBe(true);
    }
    expect(molecularTargetRefSchema.safeParse({ ...molecularTarget, kind: 'MECHANISM' }).success).toBe(false);
  });

  it('allows affinity interactions only for molecular targets', () => {
    expect(affinityInteractionSchema.safeParse(baseAffinity).success).toBe(true);
    expect(affinityInteractionSchema.safeParse({ ...baseAffinity, target: biologicalProcess }).success).toBe(false);
  });

  it('requires a known affinity to be finite, positive, and expressed in nM', () => {
    const withAffinity = (value: number, unit: string) => ({
      ...baseAffinity,
      affinity: {
        ...noEvidence,
        knowledge: { state: 'KNOWN', value: { value, unit }, derivation: 'MEASURED' },
      },
    });

    expect(affinityInteractionSchema.safeParse(withAffinity(0.01, 'nM')).success).toBe(true);
    expect(affinityInteractionSchema.safeParse(withAffinity(0, 'nM')).success).toBe(false);
    expect(affinityInteractionSchema.safeParse(withAffinity(Number.NaN, 'nM')).success).toBe(false);
    expect(affinityInteractionSchema.safeParse(withAffinity(12, 'mg')).success).toBe(false);
  });

  it('accepts unknown and not-curated affinity without interpreting legacy zero', () => {
    for (const knowledge of [
      { state: 'UNKNOWN', reason: 'unknown affinity' },
      { state: 'NOT_CURATED', reason: 'not curated yet' },
    ] as const) {
      expect(affinityInteractionSchema.safeParse({
        ...baseAffinity,
        affinity: { ...noEvidence, knowledge },
      }).success).toBe(true);
    }
  });

  it('accepts partial agonism with unknown or not-curated efficacy and adds no default', () => {
    for (const knowledge of [
      { state: 'UNKNOWN', reason: 'unknown efficacy' },
      { state: 'NOT_CURATED', reason: 'not curated efficacy' },
    ] as const) {
      const parsed = affinityInteractionSchema.parse({
        ...baseAffinity,
        intrinsicEfficacy: { ...noEvidence, knowledge },
      });
      expect(parsed.intrinsicEfficacy.knowledge).toEqual(knowledge);
    }

    const missing = { ...baseAffinity } as Record<string, unknown>;
    delete missing.intrinsicEfficacy;
    expect(affinityInteractionSchema.safeParse(missing).success).toBe(false);
    expect(missing.intrinsicEfficacy).toBeUndefined();
    expect(JSON.stringify(missing)).not.toMatch(/"value":(?:0|0\.5|1)(?:,|})/);
  });

  it('does not impose a universal intrinsic-efficacy range', () => {
    expect(affinityInteractionSchema.safeParse({
      ...baseAffinity,
      intrinsicEfficacy: {
        ...noEvidence,
        knowledge: { state: 'KNOWN', value: { value: 1.25, unit: 'ratio' }, derivation: 'MEASURED' },
      },
    }).success).toBe(true);
  });

  it('models functional direction without a fake affinity', () => {
    const functional = {
      interactionType: 'FUNCTIONAL',
      target: biologicalProcess,
      direction: {
        ...noEvidence,
        knowledge: { state: 'KNOWN', value: 'INCREASES', derivation: 'LITERATURE_CURATED' },
      },
    } as const;

    expect(functionalInteractionSchema.parse(functional)).not.toHaveProperty('affinity');
    expect(functionalInteractionSchema.safeParse({ ...functional, affinity: baseAffinity.affinity }).success).toBe(false);
  });
});
