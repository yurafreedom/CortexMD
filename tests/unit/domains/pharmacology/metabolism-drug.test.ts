import { describe, expect, expectTypeOf, it } from 'vitest';
import type { CanonicalDrug } from '@/domains/pharmacology/model/drug';
import type { CypRelationship } from '@/domains/pharmacology/model/metabolism';
import { CANONICAL_PHARMACOLOGY_MODEL_VERSION } from '@/domains/pharmacology/model/drug';
import { canonicalDrugSchema } from '@/domains/pharmacology/validation/drug';
import { cypRelationshipSchema } from '@/domains/pharmacology/validation/metabolism';

type HasKey<T, Key extends PropertyKey> = Key extends keyof T ? true : false;

const enzyme = {
  targetType: 'MOLECULAR_TARGET',
  id: 'target:CYP-synthetic',
  kind: 'ENZYME',
  preferredLabel: 'Synthetic CYP',
} as const;

const evidenceContext = {
  curationStatus: 'UNREVIEWED',
  evidenceLinks: [],
} as const;

function knownRelationship(value: 'SUBSTRATE' | 'INHIBITOR' | 'INDUCER') {
  return {
    ...evidenceContext,
    knowledge: { state: 'KNOWN', value, derivation: 'LITERATURE_CURATED' },
  } as const;
}

describe('pharmacology metabolism and canonical drug', () => {
  it('accepts known substrate, inhibitor, and inducer CYP facts', () => {
    for (const relationship of ['SUBSTRATE', 'INHIBITOR', 'INDUCER'] as const) {
      expect(cypRelationshipSchema.safeParse({
        enzyme,
        relationship: knownRelationship(relationship),
      }).success).toBe(true);
    }

    expect(cypRelationshipSchema.safeParse({
      enzyme,
      relationship: knownRelationship('INHIBITOR'),
      strength: {
        knowledge: { state: 'KNOWN', value: 'MODERATE', derivation: 'LITERATURE_CURATED' },
        curationStatus: 'NEEDS_REVIEW',
        evidenceLinks: [],
      },
    }).success).toBe(true);
  });

  it('accepts unknown, not-curated, and rationalized not-applicable CYP relationship claims', () => {
    for (const knowledge of [
      { state: 'UNKNOWN', reason: 'relationship not established' },
      { state: 'NOT_CURATED', reason: 'awaiting CYP review' },
      { state: 'NOT_APPLICABLE', rationale: 'relationship category does not apply' },
    ] as const) {
      expect(cypRelationshipSchema.safeParse({
        enzyme,
        relationship: { ...evidenceContext, knowledge },
      }).success).toBe(true);
    }
  });

  it('accepts complete conflicting inhibitor and inducer candidates', () => {
    expect(cypRelationshipSchema.safeParse({
      enzyme,
      relationship: {
        curationStatus: 'NEEDS_REVIEW',
        evidenceLinks: [],
        knowledge: {
          state: 'CONFLICTING',
          reason: 'sources disagree',
          candidates: [
            { value: 'INHIBITOR', derivation: 'LITERATURE_CURATED' },
            { value: 'INDUCER', derivation: 'MEASURED' },
          ],
        },
      },
    }).success).toBe(true);
  });

  it('rejects a bare relationship string', () => {
    expect(cypRelationshipSchema.safeParse({ enzyme, relationship: 'SUBSTRATE' }).success).toBe(false);
  });

  it('requires an enzyme-kind molecular target and contains no product policy', () => {
    expect(cypRelationshipSchema.safeParse({
      enzyme: { ...enzyme, kind: 'RECEPTOR' },
      relationship: knownRelationship('SUBSTRATE'),
    }).success).toBe(false);
    expect(cypRelationshipSchema.safeParse({
      enzyme: { targetType: 'BIOLOGICAL_PROCESS', id: 'process:metabolism' },
      relationship: knownRelationship('SUBSTRATE'),
    }).success).toBe(false);
    expect(cypRelationshipSchema.safeParse({
      enzyme,
      relationship: knownRelationship('INHIBITOR'),
      doseMultiplier: 2,
    }).success).toBe(false);
    expect(cypRelationshipSchema.safeParse({
      enzyme,
      relationship: knownRelationship('INHIBITOR'),
      exposurePolicy: 'increase',
    }).success).toBe(false);
    expectTypeOf<HasKey<CypRelationship, 'doseMultiplier'>>().toEqualTypeOf<false>();
    expectTypeOf<HasKey<CypRelationship, 'exposurePolicy'>>().toEqualTypeOf<false>();
  });

  it('keeps CanonicalDrug limited to foundational identity and relationships', () => {
    const candidate = {
      modelVersion: CANONICAL_PHARMACOLOGY_MODEL_VERSION,
      id: 'drug:synthetic',
      canonicalName: 'Synthetic drug fixture',
      aliases: ['Fixture alias'],
      targetInteractions: [],
      metabolismRelationships: [{ enzyme, relationship: knownRelationship('SUBSTRATE') }],
    } as const;
    const parsed = canonicalDrugSchema.parse(candidate);

    expect(Object.keys(parsed)).toEqual([
      'modelVersion',
      'id',
      'canonicalName',
      'aliases',
      'targetInteractions',
      'metabolismRelationships',
    ]);

    const forbiddenFields = [
      'defaultDose',
      'warningDose',
      'maximumDose',
      'color',
      'regionalTargetMembership',
      'pharmacokinetics',
      'legacyCompatibility',
      'patientContext',
    ] as const;
    for (const field of forbiddenFields) {
      expect(canonicalDrugSchema.safeParse({ ...candidate, [field]: {} }).success).toBe(false);
    }

    expectTypeOf<HasKey<CanonicalDrug, 'defaultDose'>>().toEqualTypeOf<false>();
    expectTypeOf<HasKey<CanonicalDrug, 'legacyCompatibility'>>().toEqualTypeOf<false>();
    expectTypeOf<HasKey<CanonicalDrug, 'pharmacokinetics'>>().toEqualTypeOf<false>();
    expectTypeOf<HasKey<CanonicalDrug, 'regionalTargetMembership'>>().toEqualTypeOf<false>();
  });
});
